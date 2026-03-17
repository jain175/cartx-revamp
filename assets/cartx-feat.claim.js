/**
 * CartX Claim Gift — Customer picks a gift from a list at threshold
 * Uses localStorage('claimedGiftProducts') for persistence.
 * The properties.claimed_gift = "true" prevents auto-removal by GWP.
 */
CartX.register('claim', function (ctx) {
  'use strict';

  ctx.events.on('section:rerendered', _highlightClaimed);
  ctx.events.on('cart:updated', _highlightClaimed);

  function _highlightClaimed() {
    var claimed = ctx.safeJsonParse(localStorage.getItem('claimedGiftProducts'), []);
    var buttons = document.querySelectorAll('[data-claim-variant]');

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var vid = btn.getAttribute('data-claim-variant');
      if (claimed.indexOf(vid) >= 0) {
        btn.classList.add('claimed');
        btn.textContent = 'Claimed';
        btn.disabled = true;
      }
    }
  }

  // Clear claimed gifts when cart is emptied
  ctx.events.on('cart:updated', function (cart) {
    if (cart && cart.item_count === 0) {
      localStorage.removeItem('claimedGiftProducts');
    }
  });
});
