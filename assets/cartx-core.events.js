/**
 * CartX Event Bus — Decoupled pub/sub for all modules
 *
 * Usage:
 *   CartX.events.on('cart:updated', handler)
 *   CartX.events.once('drawer:opened', handler)
 *   CartX.events.emit('cart:updated', data)
 *   CartX.events.off('cart:updated', handler)
 *
 * Bridges into Dawn's PUB_SUB_EVENTS for compatibility with product forms.
 */
(function () {
  'use strict';

  window.CartX = window.CartX || {};

  var listeners = {};

  CartX.events = {
    /**
     * Subscribe to an event.
     */
    on: function (event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ fn: handler, once: false });
    },

    /**
     * Subscribe to an event, auto-remove after first fire.
     */
    once: function (event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ fn: handler, once: true });
    },

    /**
     * Emit an event with data. Each listener is try/catch isolated.
     */
    emit: function (event, data) {
      CartX.log('Event:', event, data || '');
      var list = listeners[event];
      if (!list) return;

      // Iterate in reverse to safely remove once-listeners
      for (var i = list.length - 1; i >= 0; i--) {
        try {
          list[i].fn(data);
        } catch (err) {
          CartX.error('Event handler error [' + event + ']:', err);
        }
        if (list[i] && list[i].once) {
          list.splice(i, 1);
        }
      }

      // Bridge cart:updated to Dawn's PUB_SUB_EVENTS
      if (event === 'cart:updated') {
        _bridgeToDawn(data);
      }
    },

    /**
     * Unsubscribe a specific handler from an event.
     */
    off: function (event, handler) {
      var list = listeners[event];
      if (!list) return;
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].fn === handler) {
          list.splice(i, 1);
        }
      }
    },

    /**
     * Remove all listeners (useful for testing).
     */
    reset: function () {
      listeners = {};
    }
  };

  /**
   * Bridge cart:updated to Dawn's PUB_SUB_EVENTS.cartUpdate
   * so product forms and cart-notification update their state.
   */
  function _bridgeToDawn(cart) {
    if (typeof window.PUB_SUB_EVENTS !== 'undefined' && typeof window.publish === 'function') {
      try {
        window.publish(PUB_SUB_EVENTS.cartUpdate, {
          source: 'cartx',
          cartData: cart
        });
      } catch (e) {
        // Dawn PubSub not available — that's fine
      }
    }
  }
})();
