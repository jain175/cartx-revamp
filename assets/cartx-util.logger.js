/**
 * CartX Logger — Central logging with debug toggle
 * Usage: CartX.debug = true; CartX.log('message');
 */
(function () {
  'use strict';

  window.CartX = window.CartX || {};

  var PREFIX = '[CartX]';
  CartX.debug = false;

  CartX.log = function () {
    if (!CartX.debug) return;
    var args = [PREFIX].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  };

  CartX.warn = function () {
    var args = [PREFIX].concat(Array.prototype.slice.call(arguments));
    console.warn.apply(console, args);
  };

  CartX.error = function () {
    var args = [PREFIX + ' ERROR'].concat(Array.prototype.slice.call(arguments));
    console.error.apply(console, args);
  };
})();
