/**
 * CartX Loader — Module registry and initialization orchestrator
 *
 * Pattern: CartX.register(name, factory)
 * Each module registers a factory function.
 * CartX.init() calls them in registration order with try/catch isolation.
 * One module crash never kills others.
 */
(function () {
  'use strict';

  window.CartX = window.CartX || {};

  var modules = [];
  var initialized = false;

  /**
   * Register a module factory.
   * @param {string} name - Module name (e.g., 'events', 'progress', 'gwp')
   * @param {Function} factory - Called during init. Receives CartX as arg.
   */
  CartX.register = function (name, factory) {
    if (typeof factory !== 'function') {
      CartX.warn('register: factory for "' + name + '" is not a function');
      return;
    }
    modules.push({ name: name, factory: factory });
    CartX.log('Module registered:', name);

    // If already initialized (late registration), init immediately
    if (initialized) {
      _initModule(modules[modules.length - 1]);
    }
  };

  /**
   * Initialize all registered modules in order.
   * Safe: each module wrapped in try/catch.
   */
  CartX.init = function () {
    if (initialized) {
      CartX.warn('init: already initialized');
      return;
    }
    initialized = true;
    CartX.log('Initializing ' + modules.length + ' modules...');

    for (var i = 0; i < modules.length; i++) {
      _initModule(modules[i]);
    }

    CartX.log('All modules initialized.');
    CartX.events.emit('cartx:ready');
  };

  /**
   * Check if CartX has been initialized.
   */
  CartX.isReady = function () {
    return initialized;
  };

  /**
   * Get list of registered module names.
   */
  CartX.getModules = function () {
    return modules.map(function (m) { return m.name; });
  };

  function _initModule(mod) {
    try {
      CartX.log('Initializing module:', mod.name);
      mod.factory(CartX);
      mod.loaded = true;
    } catch (err) {
      CartX.error('Module "' + mod.name + '" failed to initialize:', err);
      mod.loaded = false;
    }
  }
})();
