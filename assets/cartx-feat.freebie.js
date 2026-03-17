/**
 * CartX Product Freebies — All matching rules fire
 * Product-to-product freebie mapping: trigger product in cart → add freebie[0].
 *
 * Evaluation is handled in the engine pipeline.
 * This module handles UI refresh concerns.
 */
CartX.register('freebie', function (ctx) {
  'use strict';

  ctx.events.on('section:rerendered', function () {
    ctx.log('Freebie: UI refreshed');
  });
});
