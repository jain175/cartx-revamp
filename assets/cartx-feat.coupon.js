/**
 * CartX Coupon — Coupon drawer, apply/remove, confetti, VIP/guest segmentation
 *
 * Apply/remove logic is handled in the engine (ctx.applyDiscount/ctx.removeDiscount).
 * This module handles the coupon panel UI: slide-in, input, state updates.
 */
CartX.register('coupon', function (ctx) {
  'use strict';

  ctx.events.on('section:rerendered', _updateCouponUI);
  ctx.events.on('cart:updated', _updateCouponUI);
  ctx.events.on('coupon:applied', _onCouponApplied);

  function _updateCouponUI() {
    var cart = ctx.cart.get();
    if (!cart) return;

    var appliedCodes = ctx.cart.getDiscountCodes();
    var coupons = CartX.safeJsonParse(
      document.getElementById('cartx-coupons') ?
        document.getElementById('cartx-coupons').textContent : null, []
    );

    // Update coupon card states
    var cards = document.querySelectorAll('.cartx-coupon-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var code = (card.getAttribute('data-coupon-code') || '').toUpperCase();
      var applyBtn = card.querySelector('.cartx-apply-button-wrapper');
      var removeBtn = card.querySelector('.cartx-remove-button-wrapper');
      var statusMsg = card.querySelector('.cartx-coupon-status');

      var isApplied = appliedCodes.indexOf(code) >= 0;

      if (applyBtn) applyBtn.style.display = isApplied ? 'none' : '';
      if (removeBtn) removeBtn.style.display = isApplied ? '' : 'none';

      if (statusMsg) {
        if (isApplied) {
          // Find matching coupon definition for success message
          var couponDef = _findCouponDef(coupons, code);
          statusMsg.textContent = couponDef && couponDef.coupon_success_message
            ? (couponDef.coupon_success_message.value || couponDef.coupon_success_message)
            : 'Coupon applied!';
          statusMsg.classList.add('applied');
        } else {
          statusMsg.classList.remove('applied');
          _updateCouponMessage(statusMsg, card, coupons, cart);
        }
      }
    }

    // Update inline applied coupon display
    var inlineApplied = document.querySelector('.cartx-applied-coupon-container');
    if (inlineApplied) {
      if (appliedCodes.length > 0) {
        inlineApplied.style.display = '';
        var codeEl = inlineApplied.querySelector('.cartx-applied-code');
        if (codeEl) codeEl.textContent = appliedCodes[0];
      } else {
        inlineApplied.style.display = 'none';
      }
    }
  }

  function _updateCouponMessage(statusEl, card, coupons, cart) {
    var code = (card.getAttribute('data-coupon-code') || '').toUpperCase();
    var def = _findCouponDef(coupons, code);
    if (!def || !statusEl) return;

    var config = CartX.safeJsonParse(
      document.getElementById('cartx-config') ?
        document.getElementById('cartx-config').textContent : null, {}
    );

    // Determine eligibility message
    var triggerQty = parseInt(def.trigger_quantity && (def.trigger_quantity.value || def.trigger_quantity) || 0);
    var triggerPrice = parseFloat(def.trigger_price && (def.trigger_price.value || def.trigger_price) || 0) * 100;

    var snapshot = _quickSnapshot(cart);

    if (triggerQty > 0 && snapshot.qty < triggerQty) {
      var msg = def.coupon_description && (def.coupon_description.value || def.coupon_description) || '';
      var remaining = triggerQty - snapshot.qty;
      statusEl.textContent = msg.replace('[[PRODUCT]]', remaining);
    } else if (triggerPrice > 0 && snapshot.price < triggerPrice) {
      var pmsg = def.coupon_before_message && (def.coupon_before_message.value || def.coupon_before_message) || '';
      var premaining = triggerPrice - snapshot.price;
      statusEl.textContent = pmsg.replace('[[PRICE]]', CartX.formatMoneyShort(premaining));
    } else {
      var afterMsg = def.coupon_after_message && (def.coupon_after_message.value || def.coupon_after_message) || '';
      statusEl.textContent = afterMsg;
    }
  }

  function _findCouponDef(coupons, code) {
    for (var i = 0; i < coupons.length; i++) {
      var c = coupons[i];
      var cCode = (c.coupon_code && (c.coupon_code.value || c.coupon_code) || '').toUpperCase();
      if (cCode === code) return c;
    }
    return null;
  }

  function _quickSnapshot(cart) {
    var qty = 0, price = 0;
    if (!cart || !cart.items) return { qty: 0, price: 0 };
    for (var i = 0; i < cart.items.length; i++) {
      var item = cart.items[i];
      var fp = item.final_line_price;
      var op = item.original_line_price;
      if ((fp === 0 || fp === 1 || fp === 100) && (op === 0 || op === 1 || op === 100)) continue;
      if (item.product_type === 'Combos') continue;
      qty += item.quantity;
      price += fp;
    }
    return { qty: qty, price: price };
  }

  function _onCouponApplied(data) {
    ctx.log('Coupon applied:', data.code);
    // Confetti is triggered via engine's showConfetti flag
  }
});
