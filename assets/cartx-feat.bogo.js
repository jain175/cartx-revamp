/**
 * CartX BOGO — Collection-triggered buy-X-get-Y offers
 * Supports: auto-add, bundle mode, reverse offers.
 *
 * Auto-add evaluation is in the engine pipeline.
 * This module handles BOGO offer card UI and bundle add interaction.
 */
CartX.register('bogo', function (ctx) {
  'use strict';

  ctx.events.on('section:rerendered', _refreshBogoUI);
  ctx.events.on('cart:updated', _refreshBogoUI);

  function _refreshBogoUI() {
    // Update offer headings with remaining product counts
    var cards = document.querySelectorAll('.cartx-bogo-offer-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var remaining = card.getAttribute('data-remaining');
      var heading = card.querySelector('.cartx-bogo-heading');
      if (heading && remaining) {
        var text = heading.getAttribute('data-template') || heading.textContent;
        heading.textContent = text.replace('[[PRODUCT]]', remaining);
      }
    }
    ctx.log('BOGO: UI refreshed');
  }
});
