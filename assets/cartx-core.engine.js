/**
 * CartX Engine — Cart fetch, update pipeline, offer evaluation, drawer control
 *
 * This is the brain. All cart mutations go through one POST /cart/update.js call.
 * Section re-render via GET /?sections=cartx-drawer,cart-icon-bubble
 *
 * Registered as module 'engine' via CartX.register().
 */
CartX.register('engine', function (ctx) {
  'use strict';

  // ===== Constants =====
  var FREE_GIFT_PRICE = 100; // ₹1 in cents
  var PRICE_ARRAY = [0, 1, 100]; // cents considered "free"
  var MAX_RETRIES = 3;
  var UNAVAIL_RETRY_MS = 60000; // 60s between OOS gift retries
  var LOADER_TIMEOUT_MS = 10000;
  var MAX_ITEM_QTY = 40;
  var SECTION_ID = 'cartx-drawer';
  var BUBBLE_SECTION_ID = 'cart-icon-bubble';

  // ===== State =====
  var userCart = null;
  var isProcessing = false;
  var loaderTimeout = null;
  var cartxRetryCount = 0;
  var showConfetti = false;
  var currentDiscountCodes = [];
  var unavailableGiftVariants = [];
  var unavailableGiftLastAttempt = 0;
  var originalFetch = window.fetch.bind(window);

  // ===== Public API =====
  ctx.cart = {
    get: function () { return userCart; },
    getDiscountCodes: function () { return currentDiscountCodes; },
    isProcessing: function () { return isProcessing; },
    triggerConfetti: function () { showConfetti = true; }
  };

  // ===== Initialization =====
  _init();

  function _init() {
    // Cart page redirect
    if (window.location.pathname === '/cart') {
      window.location.replace('/?open_cart=1');
      return;
    }

    // Initial cart fetch
    _fetchCart(function () {
      // Run initial offer evaluation (no variant change, no event)
      _runPipeline(null, null, { skipLoader: true, initial: true });

      // Check URL for open_cart param
      if (_getParam('open_cart') === '1') {
        _openDrawer();
        _cleanUrl('open_cart');
      }
    });

    // Bind events (event delegation on document for global ATC buttons)
    _bindGlobalEvents();

    // Intercept fetch for cart protection
    _interceptFetch();

    ctx.log('Engine initialized');
  }

  // ===== Cart Fetch =====
  function _fetchCart(callback) {
    originalFetch('/cart.js', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        userCart = cart;
        _extractDiscountCodes(cart);
        ctx.events.emit('cart:fetched', cart);
        if (callback) callback(cart);
      })
      .catch(function (err) {
        ctx.error('fetchCart failed:', err);
        ctx.events.emit('cart:error', { type: 'fetch', error: err });
      });
  }

  // ===== Main Pipeline =====
  /**
   * The main cart update pipeline. All add/remove/gift logic runs through here.
   *
   * @param {Object|null} variantObject - { variantId: { quantity, price, type, collection_ids } }
   * @param {string|null} event - 'ADD', 'REMOVE', or null
   * @param {Object} opts - { skipLoader, initial }
   */
  function _runPipeline(variantObject, event, opts) {
    opts = opts || {};

    if (isProcessing && !opts.force) {
      ctx.log('Pipeline busy, updating UI only');
      if (variantObject && event) _updateQuantityUI(variantObject, event);
      return;
    }

    isProcessing = true;
    if (!opts.skipLoader) _startLoader();
    ctx.events.emit('cart:updating', { variant: variantObject, event: event });

    // 1. Read config from data bridge
    var config = _readConfig();
    var giftRules = _readJsonScript('cartx-gift-manage', []);
    var freebieRules = _readJsonScript('cartx-cart-freebie', []);
    var claimRules = _readJsonScript('cartx-claim-gift', []);
    var bogoOffers = _readJsonScript('cartx-bogo-offers', []);

    // 2. Snapshot current cart state
    var snapshot = _computeSnapshot(userCart);

    // 3. Build update object from current cart
    var updates = {};
    if (userCart && userCart.items) {
      for (var i = 0; i < userCart.items.length; i++) {
        var item = userCart.items[i];
        updates[String(item.variant_id)] = item.quantity;
      }
    }

    // 4. Remove existing free gifts (they'll be re-added if still eligible)
    _removeFreeGifts(updates, userCart);

    // 5. Adjust totals for incoming change
    var adjQty = snapshot.adjustedQuantity;
    var adjPrice = snapshot.adjustedPrice;

    if (variantObject && event) {
      var vKeys = Object.keys(variantObject);
      for (var k = 0; k < vKeys.length; k++) {
        var vid = vKeys[k];
        var vData = variantObject[vid];
        var qty = vData.quantity || 1;
        var price = vData.price || 0;
        var type = vData.type || '';

        if (type !== 'Combos') {
          if (event === 'ADD') {
            adjQty += qty;
            adjPrice += price * qty;
          } else if (event === 'REMOVE') {
            adjQty = Math.max(0, adjQty - qty);
            adjPrice = Math.max(0, adjPrice - price * qty);
          }
        }

        // Apply to updates object
        var current = updates[vid] || 0;
        if (event === 'ADD') {
          updates[vid] = Math.min(current + qty, MAX_ITEM_QTY);
        } else if (event === 'REMOVE') {
          updates[vid] = Math.max(0, current - qty);
        }
      }
    }

    // 6. GWP evaluation: highest matching threshold wins
    ctx.events.emit('offer:evaluating', { type: 'gwp' });
    _evaluateGWP(giftRules, config, adjQty, adjPrice, updates);

    // 7. Claim Gift evaluation
    _evaluateClaimGift(claimRules, config, adjQty, adjPrice, updates);

    // 8. Freebie evaluation: all matching rules fire
    _evaluateFreebies(freebieRules, updates, userCart);

    // 9. BOGO evaluation: auto-add triggers
    _evaluateBOGO(bogoOffers, updates, userCart, adjPrice);

    // 10. Clean zero-quantity entries
    var cleanUpdates = {};
    var updateKeys = Object.keys(updates);
    for (var u = 0; u < updateKeys.length; u++) {
      // Keep items with qty > 0, but also send qty=0 to remove items
      cleanUpdates[updateKeys[u]] = Math.max(0, updates[updateKeys[u]]);
    }

    // 11. Remove unavailable variants
    for (var uv = 0; uv < unavailableGiftVariants.length; uv++) {
      var unavailId = String(unavailableGiftVariants[uv]);
      if (cleanUpdates[unavailId] !== undefined) {
        cleanUpdates[unavailId] = 0;
      }
    }

    // 12. POST /cart/update.js
    _postCartUpdate(cleanUpdates, event, opts);
  }

  // ===== Cart Update API Call =====
  function _postCartUpdate(updates, event, opts) {
    originalFetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: updates })
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (err) { throw err; });
        return res.json();
      })
      .then(function (cart) {
        userCart = cart;
        isProcessing = false;
        cartxRetryCount = 0;

        _extractDiscountCodes(cart);
        ctx.events.emit('cart:updated', cart);

        // Re-render drawer
        _reloadSection(function () {
          _updateBubble(cart.item_count);
          _stopLoader();
          if (!opts.initial && event) _showToast('Product updated!');
        });
      })
      .catch(function (err) {
        ctx.error('Cart update failed:', err);
        isProcessing = false;

        // Handle variant not found
        if (err && err.description && err.description.indexOf('not found') >= 0) {
          _handleVariantNotFound(err, updates, event, opts);
          return;
        }

        _stopLoader();
        ctx.events.emit('cart:error', { type: 'update', error: err });
      });
  }

  // ===== Variant Not Found Handler =====
  function _handleVariantNotFound(err, updates, event, opts) {
    ctx.warn('Variant not found, retrying without failed variants');
    var desc = err.description || '';
    // Try to extract variant IDs from error
    var match = desc.match(/\d+/g);
    if (match) {
      for (var m = 0; m < match.length; m++) {
        var failedId = match[m];
        unavailableGiftVariants.push(failedId);
        delete updates[failedId];
      }
    }
    unavailableGiftLastAttempt = Date.now();
    // Retry with cleaned updates
    _postCartUpdate(updates, event, opts);
  }

  // ===== Section Re-Render =====
  function _reloadSection(callback) {
    var inner = document.querySelector('.cartx-drawer-inner');
    var scrollEl = inner ? inner.querySelector('.cartx-drawer-body-wrap') : null;
    var scrollTop = scrollEl ? scrollEl.scrollTop : 0;

    var url = window.location.pathname + '?sections=' + SECTION_ID + ',' + BUBBLE_SECTION_ID;

    originalFetch(url)
      .then(function (res) { return res.json(); })
      .then(function (sections) {
        // Update drawer content
        if (sections[SECTION_ID] && inner) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(sections[SECTION_ID], 'text/html');
          var newInner = doc.querySelector('.cartx-drawer-inner');
          if (newInner) {
            inner.innerHTML = newInner.innerHTML;
            // Copy ai-cart-upsell attribute
            var aiAttr = newInner.getAttribute('ai-cart-upsell');
            if (aiAttr) inner.setAttribute('ai-cart-upsell', aiAttr);
          }

          // Restore scroll
          var newScrollEl = inner.querySelector('.cartx-drawer-body-wrap');
          if (newScrollEl) newScrollEl.scrollTop = scrollTop;

          // Re-bind drawer events
          _bindDrawerEvents();

          ctx.events.emit('section:rerendered');
        }

        // Update bubble
        if (sections[BUBBLE_SECTION_ID]) {
          _updateBubbleHtml(sections[BUBBLE_SECTION_ID]);
        }

        // Confetti
        if (showConfetti) {
          showConfetti = false;
          _playConfetti();
        }

        // Update gift unavailable message
        _updateGiftUnavailableMessage();

        if (callback) callback();
      })
      .catch(function (err) {
        ctx.error('Section reload failed:', err);
        if (callback) callback();
      });
  }

  // ===== Offer Evaluation Helpers =====

  function _computeSnapshot(cart) {
    var adjQty = 0;
    var adjPrice = 0;
    var freeQty = 0;
    var freePrice = 0;
    var comboQty = 0;
    var comboPrice = 0;

    if (cart && cart.items) {
      for (var i = 0; i < cart.items.length; i++) {
        var item = cart.items[i];
        var finalPrice = item.final_line_price;
        var origPrice = item.original_line_price;

        // Free gift check
        if (_isFreeItem(finalPrice, origPrice)) {
          freeQty += item.quantity;
          freePrice += finalPrice;
          continue;
        }
        // Combo check
        if (item.product_type === 'Combos') {
          comboQty += item.quantity;
          comboPrice += finalPrice;
          continue;
        }
      }

      adjQty = cart.item_count - freeQty - comboQty;
      adjPrice = cart.total_price - freePrice - comboPrice;
    }

    return {
      adjustedQuantity: adjQty,
      adjustedPrice: adjPrice,
      freeQuantity: freeQty,
      freePrice: freePrice,
      comboQuantity: comboQty,
      comboPrice: comboPrice
    };
  }

  function _isFreeItem(finalPrice, origPrice) {
    var f = PRICE_ARRAY.indexOf(finalPrice) >= 0;
    var o = PRICE_ARRAY.indexOf(origPrice) >= 0;
    return f && o;
  }

  function _removeFreeGifts(updates, cart) {
    if (!cart || !cart.items) return;
    for (var i = 0; i < cart.items.length; i++) {
      var item = cart.items[i];
      var finalPrice = item.final_line_price;
      var origPrice = item.original_line_price;
      // Remove free gifts (but not claimed gifts)
      if (_isFreeItem(finalPrice, origPrice)) {
        var props = item.properties || {};
        if (props.claimed_gift !== 'true') {
          updates[String(item.variant_id)] = 0;
        }
      }
    }
  }

  /**
   * GWP: highest matching threshold wins.
   * Sorted descending by threshold; first match = applicable rule.
   */
  function _evaluateGWP(rules, config, adjQty, adjPrice, updates) {
    if (!rules || !rules.length) return;

    var isPriceBased = config.isPriceBased;
    var applicable = null;

    // Sort by threshold descending
    var sorted = rules.slice().sort(function (a, b) {
      var aVal = isPriceBased
        ? (parseFloat(a.trigger_price && a.trigger_price.value || a.trigger_price || 0) * 100)
        : parseInt(a.triggered_quantity && a.triggered_quantity.value || a.triggered_quantity || 0);
      var bVal = isPriceBased
        ? (parseFloat(b.trigger_price && b.trigger_price.value || b.trigger_price || 0) * 100)
        : parseInt(b.triggered_quantity && b.triggered_quantity.value || b.triggered_quantity || 0);
      return bVal - aVal;
    });

    for (var i = 0; i < sorted.length; i++) {
      var rule = sorted[i];
      var threshold;
      if (isPriceBased) {
        threshold = parseFloat(rule.trigger_price && rule.trigger_price.value || rule.trigger_price || 0) * 100;
        if (adjPrice >= threshold) {
          applicable = rule;
          break;
        }
      } else {
        threshold = parseInt(rule.triggered_quantity && rule.triggered_quantity.value || rule.triggered_quantity || 0);
        if (adjQty >= threshold) {
          applicable = rule;
          break;
        }
      }
    }

    if (applicable) {
      var getY = applicable.get_y && (applicable.get_y.value || applicable.get_y) || [];
      if (Array.isArray(getY)) {
        for (var g = 0; g < getY.length; g++) {
          var giftVid = ctx.cleanGid(getY[g]);
          if (giftVid && unavailableGiftVariants.indexOf(giftVid) < 0) {
            updates[giftVid] = 1;
          }
        }
      }
      ctx.events.emit('offer:changed', { type: 'gwp', rule: applicable });
    }
  }

  /**
   * Claim Gift: highest matching threshold, restore from localStorage.
   */
  function _evaluateClaimGift(rules, config, adjQty, adjPrice, updates) {
    if (!rules || !rules.length) return;

    var isPriceBased = config.isPriceBased;
    var applicable = null;

    var sorted = rules.slice().sort(function (a, b) {
      var aVal = isPriceBased
        ? (parseFloat(a.trigger_price && a.trigger_price.value || a.trigger_price || 0) * 100)
        : parseInt(a.triggered_quantity && a.triggered_quantity.value || a.triggered_quantity || 0);
      var bVal = isPriceBased
        ? (parseFloat(b.trigger_price && b.trigger_price.value || b.trigger_price || 0) * 100)
        : parseInt(b.triggered_quantity && b.triggered_quantity.value || b.triggered_quantity || 0);
      return bVal - aVal;
    });

    for (var i = 0; i < sorted.length; i++) {
      var rule = sorted[i];
      if (isPriceBased) {
        var tp = parseFloat(rule.trigger_price && rule.trigger_price.value || rule.trigger_price || 0) * 100;
        if (adjPrice >= tp) { applicable = rule; break; }
      } else {
        var tq = parseInt(rule.triggered_quantity && rule.triggered_quantity.value || rule.triggered_quantity || 0);
        if (adjQty >= tq) { applicable = rule; break; }
      }
    }

    if (applicable) {
      // Restore claimed gifts from localStorage
      var claimed = ctx.safeJsonParse(localStorage.getItem('claimedGiftProducts'), []);
      if (Array.isArray(claimed) && claimed.length > 0) {
        for (var c = 0; c < claimed.length; c++) {
          var cVid = ctx.cleanGid(claimed[c]);
          if (cVid && unavailableGiftVariants.indexOf(cVid) < 0) {
            updates[cVid] = 1;
          }
        }
      }
    }
  }

  /**
   * Freebies: ALL matching rules fire.
   * If trigger product in cart → add freebie[0].
   */
  function _evaluateFreebies(rules, updates, cart) {
    if (!rules || !rules.length || !cart || !cart.items) return;

    // Build set of variant IDs currently in cart
    var cartVariants = {};
    for (var i = 0; i < cart.items.length; i++) {
      cartVariants[String(cart.items[i].variant_id)] = true;
    }
    // Also include variants being added
    var uKeys = Object.keys(updates);
    for (var u = 0; u < uKeys.length; u++) {
      if (updates[uKeys[u]] > 0) cartVariants[uKeys[u]] = true;
    }

    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r];
      var triggers = rule.products && (rule.products.value || rule.products) || [];
      var freebies = rule.freebie && (rule.freebie.value || rule.freebie) || [];

      if (!Array.isArray(triggers) || !Array.isArray(freebies) || !freebies.length) continue;

      var triggered = false;
      for (var t = 0; t < triggers.length; t++) {
        var triggerVid = ctx.cleanGid(triggers[t]);
        if (triggerVid && cartVariants[triggerVid] && updates[triggerVid] !== 0) {
          triggered = true;
          break;
        }
      }

      if (triggered) {
        var freebieVid = ctx.cleanGid(freebies[0]);
        if (freebieVid && unavailableGiftVariants.indexOf(freebieVid) < 0) {
          updates[freebieVid] = 1;
        }
      }
    }
  }

  /**
   * BOGO: check all offers with auto_add=true.
   */
  function _evaluateBOGO(offers, updates, cart, adjPrice) {
    if (!offers || !offers.length || !cart || !cart.items) return;

    for (var o = 0; o < offers.length; o++) {
      var offer = offers[o];
      var autoAdd = offer.auto_add && (offer.auto_add.value || offer.auto_add);
      if (!autoAdd) continue;

      var isTriggered = false;
      var isPriceBased = offer.is_price_base && (offer.is_price_base.value || offer.is_price_base);
      var triggerCollectionId = ctx.cleanGid(
        offer.trigger_collection && (offer.trigger_collection.value || offer.trigger_collection)
      );

      if (isPriceBased) {
        var bogoPrice = parseFloat(offer.trigger_price && (offer.trigger_price.value || offer.trigger_price) || 0) * 100;
        // Sum prices of trigger collection products in cart
        var collTotal = _sumCollectionPrice(cart, triggerCollectionId, updates);
        isTriggered = collTotal >= bogoPrice;
      } else {
        var triggerCount = parseInt(offer.trigger_count && (offer.trigger_count.value || offer.trigger_count) || 0);
        var collCount = _countCollectionProducts(cart, triggerCollectionId, updates);
        isTriggered = collCount >= triggerCount;
      }

      if (isTriggered) {
        var offerProducts = offer.offer_products && (offer.offer_products.value || offer.offer_products) || [];
        // Auto-add only if exactly 1 variant
        if (Array.isArray(offerProducts) && offerProducts.length === 1) {
          var offerVid = ctx.cleanGid(offerProducts[0]);
          if (offerVid && unavailableGiftVariants.indexOf(offerVid) < 0) {
            updates[offerVid] = (updates[offerVid] || 0) + 1;
          }
        }
      }
    }
  }

  function _sumCollectionPrice(cart, collectionId, updates) {
    var total = 0;
    if (!cart || !cart.items || !collectionId) return total;
    for (var i = 0; i < cart.items.length; i++) {
      var item = cart.items[i];
      if (updates[String(item.variant_id)] === 0) continue;
      var collIds = _getItemCollectionIds(item);
      if (collIds.indexOf(collectionId) >= 0) {
        total += item.final_line_price;
      }
    }
    return total;
  }

  function _countCollectionProducts(cart, collectionId, updates) {
    var count = 0;
    if (!cart || !cart.items || !collectionId) return count;
    for (var i = 0; i < cart.items.length; i++) {
      var item = cart.items[i];
      if (updates[String(item.variant_id)] === 0) continue;
      var collIds = _getItemCollectionIds(item);
      if (collIds.indexOf(collectionId) >= 0) {
        count += item.quantity;
      }
    }
    return count;
  }

  function _getItemCollectionIds(item) {
    // From product.collections (Liquid sets these via data attr, but we also check properties)
    if (item._collectionIds) return item._collectionIds;
    return [];
  }

  // ===== Discount Code Helpers =====
  function _extractDiscountCodes(cart) {
    currentDiscountCodes = [];
    if (cart && cart.cart_level_discount_applications) {
      for (var i = 0; i < cart.cart_level_discount_applications.length; i++) {
        var d = cart.cart_level_discount_applications[i];
        if (d.title) currentDiscountCodes.push(d.title.toUpperCase());
      }
    }
  }

  /**
   * Apply a discount code.
   */
  ctx.applyDiscount = function (code, callback) {
    if (!code || !code.trim()) return;
    code = code.trim().toUpperCase();

    _startLoader();
    ctx.events.emit('cart:updating', { type: 'coupon', code: code });

    // Append to existing codes
    var allCodes = currentDiscountCodes.slice();
    if (allCodes.indexOf(code) < 0) allCodes.push(code);
    var discountStr = allCodes.join(',');

    originalFetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount: discountStr })
    })
      .then(function () { return originalFetch('/cart.js'); })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        userCart = cart;
        _extractDiscountCodes(cart);

        // Verify code was applied
        var applied = currentDiscountCodes.indexOf(code) >= 0;
        if (applied) {
          showConfetti = true;
          ctx.events.emit('coupon:applied', { code: code });
        } else {
          ctx.events.emit('coupon:error', { code: code, reason: 'not_applied' });
        }

        _reloadSection(function () {
          _stopLoader();
          if (callback) callback(applied);
        });
      })
      .catch(function (err) {
        ctx.error('Apply discount failed:', err);
        _stopLoader();
        ctx.events.emit('cart:error', { type: 'coupon', error: err });
        if (callback) callback(false);
      });
  };

  /**
   * Remove a discount code.
   */
  ctx.removeDiscount = function (code, callback) {
    if (!code) return;
    code = code.trim().toUpperCase();

    _startLoader();

    var remaining = currentDiscountCodes.filter(function (c) { return c !== code; });
    var discountStr = remaining.join(',');

    originalFetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount: discountStr || '' })
    })
      .then(function () { return originalFetch('/cart.js'); })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        userCart = cart;
        _extractDiscountCodes(cart);
        ctx.events.emit('coupon:removed', { code: code });

        _reloadSection(function () {
          _stopLoader();
          if (callback) callback(true);
        });
      })
      .catch(function (err) {
        ctx.error('Remove discount failed:', err);
        _stopLoader();
        if (callback) callback(false);
      });
  };

  // ===== Drawer Open/Close =====
  function _openDrawer() {
    var drawer = document.querySelector('.cartx-drawer');
    var overlay = document.getElementById('cartx-drawer-overlay');
    if (drawer) drawer.classList.add('drawer-open');
    if (overlay) overlay.classList.add('open-overlay');
    document.body.classList.add('cartx-drawer-open');
    ctx.events.emit('drawer:opened');
  }

  function _closeDrawer() {
    var drawer = document.querySelector('.cartx-drawer');
    var overlay = document.getElementById('cartx-drawer-overlay');
    if (drawer) drawer.classList.remove('drawer-open');
    if (overlay) overlay.classList.remove('open-overlay');
    document.body.classList.remove('cartx-drawer-open');
    ctx.events.emit('drawer:closed');
  }

  ctx.openDrawer = _openDrawer;
  ctx.closeDrawer = _closeDrawer;

  // ===== Event Delegation =====
  function _bindGlobalEvents() {
    // Delegate all clicks on document
    document.addEventListener('click', function (e) {
      var target = e.target;

      // Open drawer: .cartx-icon or a[href="/cart"]
      if (target.closest('.cartx-icon') || _isCartLink(target)) {
        e.preventDefault();
        _openDrawer();
        return;
      }

      // Close drawer: close button or overlay
      if (target.closest('.cartx-drawer-close')) {
        _closeDrawer();
        return;
      }
      if (target.id === 'cartx-drawer-overlay' || target.closest('#cartx-drawer-overlay')) {
        _closeDrawer();
        return;
      }

      // Add to cart (sitewide button)
      if (target.closest('.cartx-add-to-cart')) {
        e.preventDefault();
        _handleAddToCart(target.closest('.cartx-add-to-cart'));
        return;
      }

      // Drawer quantity buttons
      if (target.closest('.cartx-drawer-product-quantity-button')) {
        e.preventDefault();
        _handleQuantityButton(target.closest('.cartx-drawer-product-quantity-button'));
        return;
      }

      // Remove item button
      if (target.closest('.cartx-item-remove')) {
        e.preventDefault();
        _handleRemoveItem(target.closest('.cartx-item-remove'));
        return;
      }

      // Coupon apply
      if (target.closest('.cartx-apply-button-wrapper')) {
        e.preventDefault();
        var code = target.closest('.cartx-apply-button-wrapper').getAttribute('data-code');
        if (code) ctx.applyDiscount(code);
        return;
      }

      // Coupon remove
      if (target.closest('.cartx-remove-button-wrapper')) {
        e.preventDefault();
        var rcode = target.closest('.cartx-remove-button-wrapper').getAttribute('data-code');
        if (rcode) ctx.removeDiscount(rcode);
        return;
      }

      // Coupon panel toggle
      if (target.closest('.prv-view-all')) {
        var panel = document.querySelector('.cartx-all-offers');
        if (panel) panel.classList.add('is--visible');
        return;
      }
      if (target.closest('.cartx-offer-close')) {
        var opanel = document.querySelector('.cartx-all-offers');
        if (opanel) opanel.classList.remove('is--visible');
        return;
      }

      // Coupon manual input submit
      if (target.closest('.cartx-coupon-apply-btn')) {
        e.preventDefault();
        var input = document.querySelector('.cartx-coupon-input');
        if (input && input.value.trim()) ctx.applyDiscount(input.value.trim());
        return;
      }

      // Claim gift selection
      if (target.closest('[data-claim-variant]')) {
        e.preventDefault();
        _handleClaimGift(target.closest('[data-claim-variant]'));
        return;
      }

      // BOGO add to cart
      if (target.closest('[data-bogo-add-variant]')) {
        e.preventDefault();
        _handleBogoAdd(target.closest('[data-bogo-add-variant]'));
        return;
      }

      // BOGO add bundle
      if (target.closest('[data-bogo-add-bundle]')) {
        e.preventDefault();
        _handleBogoBundle(target.closest('[data-bogo-add-bundle]'));
        return;
      }

      // Upsell add
      if (target.closest('[data-upsell-add]')) {
        e.preventDefault();
        _handleUpsellAdd(target.closest('[data-upsell-add]'));
        return;
      }
    });

    // Escape key closes drawer
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') _closeDrawer();
    });

    // Also bind drawer-specific events
    _bindDrawerEvents();
  }

  function _bindDrawerEvents() {
    // Announcement ribbon rotation
    _initAnnouncementRibbon();
  }

  function _isCartLink(target) {
    var link = target.closest('a[href="/cart"]') || target.closest('a[href*="/cart"]');
    if (!link) return false;
    var href = link.getAttribute('href');
    return href === '/cart' || href === window.routes.cart_url;
  }

  // ===== Action Handlers =====
  function _handleAddToCart(btn) {
    var wrap = btn.closest('.cartx-product-button-wrap') || btn.closest('[data-variant-id]');
    if (!wrap) return;

    var vid = wrap.getAttribute('data-variant-id');
    var qty = parseInt(wrap.getAttribute('data-quantity') || '1');
    var price = parseInt(wrap.getAttribute('data-price') || '0');
    var type = wrap.getAttribute('data-product-type') || '';
    var collIds = ctx.safeJsonParse(wrap.getAttribute('data-collection-ids'), []);

    if (!vid) return;

    var variantObject = {};
    variantObject[vid] = { quantity: qty, price: price, type: type, collection_ids: collIds };

    // Show button loading state if not in drawer
    if (!btn.closest('.cartx-drawer')) {
      var bwrap = btn.closest('.cartx-product-button-wrap');
      if (bwrap) bwrap.classList.add('cartx-button-loadding');
    }

    _runPipeline(variantObject, 'ADD', {});
    _openDrawer();
  }

  function _handleQuantityButton(btn) {
    var li = btn.closest('.cartx-drawer-product-item');
    if (!li) return;

    var vid = li.getAttribute('data-variant-id');
    var price = parseInt(li.getAttribute('data-price') || '0');
    var type = li.getAttribute('data-product-type') || '';
    var collIds = ctx.safeJsonParse(li.getAttribute('data-collection-ids'), []);
    var action = btn.getAttribute('name'); // 'plus' or 'minus'
    var event = action === 'plus' ? 'ADD' : 'REMOVE';

    var variantObject = {};
    variantObject[vid] = { quantity: 1, price: price, type: type, collection_ids: collIds };

    _runPipeline(variantObject, event, {});
  }

  function _handleRemoveItem(btn) {
    var vid = btn.getAttribute('data-variant-id');
    if (!vid) return;

    var li = btn.closest('.cartx-drawer-product-item');
    var qty = li ? parseInt(li.getAttribute('data-quantity') || '1') : 1;
    var price = li ? parseInt(li.getAttribute('data-price') || '0') : 0;
    var type = li ? (li.getAttribute('data-product-type') || '') : '';

    // Remove entire quantity
    var variantObject = {};
    variantObject[vid] = { quantity: qty, price: price, type: type, collection_ids: [] };

    _runPipeline(variantObject, 'REMOVE', {});
  }

  function _handleClaimGift(el) {
    var vid = el.getAttribute('data-claim-variant');
    if (!vid) return;

    // Save to localStorage
    var claimed = ctx.safeJsonParse(localStorage.getItem('claimedGiftProducts'), []);
    if (claimed.indexOf(vid) < 0) claimed.push(vid);
    localStorage.setItem('claimedGiftProducts', JSON.stringify(claimed));

    // Add to cart
    var variantObject = {};
    variantObject[vid] = { quantity: 1, price: 0, type: '', collection_ids: [] };
    _runPipeline(variantObject, 'ADD', {});
  }

  function _handleBogoAdd(el) {
    var vid = el.getAttribute('data-bogo-add-variant');
    if (!vid) return;

    var variantObject = {};
    variantObject[vid] = { quantity: 1, price: 0, type: '', collection_ids: [] };
    _runPipeline(variantObject, 'ADD', {});
  }

  function _handleBogoBundle(el) {
    var variants = ctx.safeJsonParse(el.getAttribute('data-bogo-add-bundle'), []);
    if (!variants.length) return;

    var variantObject = {};
    for (var i = 0; i < variants.length; i++) {
      variantObject[variants[i]] = { quantity: 1, price: 0, type: '', collection_ids: [] };
    }
    _runPipeline(variantObject, 'ADD', {});
  }

  function _handleUpsellAdd(el) {
    var vid = el.getAttribute('data-upsell-add');
    var price = parseInt(el.getAttribute('data-upsell-price') || '0');
    if (!vid) return;

    var variantObject = {};
    variantObject[vid] = { quantity: 1, price: price, type: '', collection_ids: [] };
    _runPipeline(variantObject, 'ADD', {});
  }

  // ===== UI Helpers =====
  function _updateQuantityUI(variantObject, event) {
    // Optimistic UI update for quantity display
    var keys = Object.keys(variantObject);
    for (var k = 0; k < keys.length; k++) {
      var vid = keys[k];
      var li = document.querySelector('.cartx-drawer-product-item[data-variant-id="' + vid + '"]');
      if (!li) continue;
      var input = li.querySelector('.cartx-drawer-product-quantity-input');
      if (!input) continue;
      var current = parseInt(input.value) || 0;
      input.value = event === 'ADD' ? current + 1 : Math.max(0, current - 1);
    }
  }

  function _updateBubble(count) {
    var bubbles = document.querySelectorAll('.cartx-drawer-item-count');
    for (var i = 0; i < bubbles.length; i++) {
      bubbles[i].setAttribute('data-count', count);
      bubbles[i].textContent = '(' + count + ')';
    }
    // Also update Dawn's cart count bubble
    var dawnBubble = document.querySelector('.cart-count-bubble span[aria-hidden]');
    if (dawnBubble) dawnBubble.textContent = count;
  }

  function _updateBubbleHtml(html) {
    var container = document.getElementById('cart-icon-bubble');
    if (container && html) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var newBubble = doc.querySelector('#cart-icon-bubble') || doc.body;
      if (newBubble) container.innerHTML = newBubble.innerHTML;
    }
  }

  function _startLoader() {
    var loader = document.querySelector('.cartx-loader');
    if (loader) loader.style.display = 'flex';
    clearTimeout(loaderTimeout);
    loaderTimeout = setTimeout(function () {
      _stopLoader();
      isProcessing = false;
      ctx.warn('Loader safety timeout hit');
    }, LOADER_TIMEOUT_MS);
  }

  function _stopLoader() {
    var loader = document.querySelector('.cartx-loader');
    if (loader) loader.style.display = 'none';
    clearTimeout(loaderTimeout);

    // Clear sitewide button loading states
    var btns = document.querySelectorAll('.cartx-button-loadding');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove('cartx-button-loadding');
    }
  }

  function _showToast(message) {
    var toast = document.getElementById('cartx-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(function () {
      toast.classList.remove('active');
    }, 3000);
  }

  ctx.showToast = _showToast;

  function _updateGiftUnavailableMessage() {
    var el = document.querySelector('.cartx-gift-unavailable-sticky');
    if (!el) return;
    el.style.display = unavailableGiftVariants.length > 0 ? 'block' : 'none';
  }

  // ===== Announcement Ribbon =====
  function _initAnnouncementRibbon() {
    var ribbon = document.querySelector('.cartx-announcement-ribbon');
    if (!ribbon) return;

    var slides = ribbon.querySelectorAll('.cartx-announcement-slide');
    if (slides.length <= 1) {
      // Single or no slide — just show first
      if (slides[0]) slides[0].classList.add('active');
      return;
    }

    var autoplay = ribbon.getAttribute('data-autoplay') !== 'false';
    var speed = parseInt(ribbon.getAttribute('data-speed') || '3') * 1000;
    var current = 0;

    // Set first active
    slides[0].classList.add('active');

    if (autoplay) {
      var interval = setInterval(function () {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
      }, speed);

      // Pause on hover
      ribbon.addEventListener('mouseenter', function () { clearInterval(interval); });
      ribbon.addEventListener('mouseleave', function () {
        interval = setInterval(function () {
          slides[current].classList.remove('active');
          current = (current + 1) % slides.length;
          slides[current].classList.add('active');
        }, speed);
      });
    }
  }

  // ===== Confetti =====
  function _playConfetti() {
    var container = document.getElementById('cartx-confetti');
    if (!container || typeof window.bodymovin === 'undefined') {
      // Try loading Lottie dynamically
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
      script.onload = function () { _doConfetti(container); };
      script.onerror = function () { ctx.log('Lottie not loaded — skipping confetti'); };
      document.head.appendChild(script);
      return;
    }
    _doConfetti(container);
  }

  function _doConfetti(container) {
    if (!container || typeof bodymovin === 'undefined') return;
    try {
      var anim = bodymovin.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: 'https://assets2.lottiefiles.com/packages/lf20_u4yrau.json'
      });
      anim.addEventListener('complete', function () {
        anim.destroy();
      });
    } catch (e) {
      ctx.log('Confetti animation failed:', e);
    }
  }

  // ===== Fetch Interception =====
  function _interceptFetch() {
    window.fetch = function () {
      var url = arguments[0];
      if (typeof url === 'string') {
        var isCartEndpoint = url.indexOf('/cart/add') >= 0 ||
          url.indexOf('/cart/update') >= 0 ||
          url.indexOf('/cart/change') >= 0;

        if (isCartEndpoint) {
          // Check if called from CartX (via originalFetch) or from outside
          var stack = new Error().stack || '';
          var isExternal = stack.indexOf('<anonymous>') >= 0 || stack.indexOf('VM') >= 0;

          if (isExternal) {
            ctx.warn('Blocked external cart API call:', url);
            return Promise.reject(new Error('CartX: Direct cart API calls are blocked'));
          }
        }
      }
      return originalFetch.apply(window, arguments);
    };
  }

  // ===== Config Reader =====
  function _readConfig() {
    var el = document.getElementById('cartx-config');
    return ctx.safeJsonParse(el ? el.textContent : null, {});
  }

  function _readJsonScript(id, fallback) {
    var el = document.getElementById(id);
    return ctx.safeJsonParse(el ? el.textContent : null, fallback);
  }

  // ===== URL Helpers =====
  function _getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function _cleanUrl(param) {
    var url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.replaceState({}, '', url.pathname + url.search);
  }

  // ===== Dawn Product Form Interception =====
  // Listen for Dawn's native form submissions and route through our pipeline
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches('form[action*="/cart/add"]')) return;

    e.preventDefault();
    e.stopPropagation();

    var formData = new FormData(form);
    var vid = formData.get('id');
    var qty = parseInt(formData.get('quantity') || '1');

    if (!vid) return;

    var variantObject = {};
    variantObject[vid] = { quantity: qty, price: 0, type: '', collection_ids: [] };
    _runPipeline(variantObject, 'ADD', {});
    _openDrawer();
  }, true);
});
