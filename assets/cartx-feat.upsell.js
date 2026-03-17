/**
 * CartX Upsell — 3-mode upsell engine
 * Mode 1: Product metafield (custom.cartx_upsell_products) — highest priority
 * Mode 2: Section settings (product_base_upsell_products)
 * Mode 3: AI recommendations (external API) — lowest priority
 *
 * Mode determined by ai-cart-upsell attribute on .cartx-drawer-inner:
 * "true" = AI mode, "false" = product-based mode
 */
CartX.register('upsell', function (ctx) {
  'use strict';

  var AI_API_URL = ''; // Set externally if needed
  var AI_BEARER_TOKEN = ''; // Set externally if needed

  ctx.events.on('section:rerendered', _checkUpsellMode);
  ctx.events.on('drawer:opened', _checkUpsellMode);

  function _checkUpsellMode() {
    var inner = document.querySelector('.cartx-drawer-inner');
    if (!inner) return;

    var aiMode = inner.getAttribute('ai-cart-upsell') === 'true';
    var upsellContainer = inner.querySelector('.cartx-upsell-section');

    if (!upsellContainer) return;

    if (aiMode && AI_API_URL) {
      _fetchAiUpsells(upsellContainer);
    }
    // Product-based upsells are rendered server-side in Liquid
  }

  function _fetchAiUpsells(container) {
    var cart = ctx.cart.get();
    if (!cart || !cart.items || !cart.items.length) return;

    // Get last added product handle
    var lastItem = cart.items[cart.items.length - 1];
    if (!lastItem) return;

    var handle = lastItem.handle || lastItem.product_id;
    if (!handle || !AI_API_URL) return;

    var headers = { 'Content-Type': 'application/json' };
    if (AI_BEARER_TOKEN) {
      headers['Authorization'] = 'Bearer ' + AI_BEARER_TOKEN;
    }

    fetch(AI_API_URL + '?handle=' + encodeURIComponent(handle), {
      method: 'GET',
      headers: headers
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.products && data.products.length) {
          _renderAiUpsells(container, data.products);
        }
      })
      .catch(function (err) {
        ctx.log('AI upsell fetch failed (non-critical):', err);
      });
  }

  function _renderAiUpsells(container, products) {
    var html = '';
    var max = Math.min(products.length, 4);
    for (var i = 0; i < max; i++) {
      var p = products[i];
      var vid = p.variant_id || (p.variants && p.variants[0] && p.variants[0].id) || '';
      var price = p.price || (p.variants && p.variants[0] && p.variants[0].price) || 0;
      var imgSrc = p.image || (p.images && p.images[0]) || '';

      html += '<div class="cartx-upsell-product">';
      html += '<div class="cartx-upsell-image">';
      if (imgSrc) html += '<img src="' + imgSrc + '" alt="" width="60" height="60" loading="lazy">';
      html += '</div>';
      html += '<div class="cartx-upsell-info">';
      html += '<div class="cartx-upsell-title">' + (p.title || '') + '</div>';
      html += '<div class="cartx-upsell-price">' + CartX.formatMoney(price) + '</div>';
      html += '</div>';
      html += '<button class="cartx-upsell-add-btn" data-upsell-add="' + vid + '" data-upsell-price="' + price + '">Add</button>';
      html += '</div>';
    }

    var list = container.querySelector('.cartx-upsell-products');
    if (list) list.innerHTML = html;
  }
});
