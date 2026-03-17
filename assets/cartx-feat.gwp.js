/**
 * CartX GWP (Gift With Purchase) — Auto-add free gift variants
 * Highest threshold wins. OOS handling with retry.
 *
 * Note: The actual gift evaluation/addition is handled in the engine pipeline.
 * This module handles UI concerns: locked gift preview, OOS retry timer.
 */
CartX.register('gwp', function (ctx) {
  'use strict';

  var RETRY_INTERVAL = 60000; // 60s
  var retryTimer = null;

  ctx.events.on('section:rerendered', _bindGiftDetails);
  ctx.events.on('cart:updated', _checkOosRetry);

  function _bindGiftDetails() {
    // Gift details are rendered server-side; no JS binding needed
    // But we can update lock icons and messages dynamically
    ctx.log('GWP: UI refreshed');
  }

  function _checkOosRetry(cart) {
    // Check if we should retry unavailable gifts
    var unavailEl = document.querySelector('.cartx-gift-unavailable-sticky');
    if (!unavailEl || unavailEl.style.display === 'none') {
      if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
      return;
    }

    if (!retryTimer) {
      retryTimer = setInterval(function () {
        ctx.log('GWP: Retrying unavailable gifts');
        ctx.events.emit('gift:retry');
      }, RETRY_INTERVAL);
    }
  }
});
