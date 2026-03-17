/**
 * CartX Helpers — Utility functions used across all modules
 */
(function () {
  'use strict';

  window.CartX = window.CartX || {};

  /**
   * Safe JSON parse — never throws. Returns fallback on failure.
   * Fixes the JSON.parse(null) crash from old CartX.
   */
  CartX.safeJsonParse = function (str, fallback) {
    if (str == null || str === '' || str === 'undefined' || str === 'null') {
      return fallback !== undefined ? fallback : [];
    }
    try {
      return JSON.parse(str);
    } catch (e) {
      CartX.warn('safeJsonParse failed:', e.message);
      return fallback !== undefined ? fallback : [];
    }
  };

  /**
   * Format cents to display currency.
   * 29900 → "₹299.00", 100 → "₹1.00", 0 → "₹0.00"
   */
  CartX.formatMoney = function (cents) {
    if (cents == null || isNaN(cents)) return '₹0.00';
    var amount = (Math.round(cents) / 100).toFixed(2);
    return '\u20B9' + amount;
  };

  /**
   * Format money without decimals for display in messages.
   * 150000 → "₹1,500"
   */
  CartX.formatMoneyShort = function (cents) {
    if (cents == null || isNaN(cents)) return '₹0';
    var amount = Math.round(cents / 100);
    return '\u20B9' + amount.toLocaleString('en-IN');
  };

  /**
   * Debounce — delays execution until after wait ms of inactivity.
   */
  CartX.debounce = function (fn, delay) {
    var timer;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, delay);
    };
  };

  /**
   * Extract numeric ID from Shopify GID.
   * "gid://shopify/ProductVariant/12345" → "12345"
   * "12345" → "12345"
   */
  CartX.cleanGid = function (gid) {
    if (!gid) return '';
    var str = String(gid);
    var idx = str.lastIndexOf('/');
    return idx >= 0 ? str.substring(idx + 1) : str;
  };

  /**
   * Read a body attribute and parse as JSON safely.
   */
  CartX.readBodyAttr = function (name, fallback) {
    var val = document.body.getAttribute(name);
    return CartX.safeJsonParse(val, fallback !== undefined ? fallback : []);
  };

  /**
   * Replace placeholders in message strings.
   * Supports: [[PRICE]], [[PRODUCT]], [[TITLE]], [[CODE]]
   */
  CartX.replacePlaceholders = function (msg, data) {
    if (!msg) return '';
    var result = msg;
    if (data.price !== undefined) {
      result = result.replace(/\[\[PRICE\]\]/g, CartX.formatMoneyShort(data.price));
    }
    if (data.product !== undefined) {
      result = result.replace(/\[\[PRODUCT\]\]/g, data.product);
    }
    if (data.title !== undefined) {
      result = result.replace(/\[\[TITLE\]\]/g, data.title);
    }
    if (data.code !== undefined) {
      result = result.replace(/\[\[CODE\]\]/g, data.code);
    }
    return result;
  };

  /**
   * Check if a price is considered "free" (₹0 or ₹1).
   */
  CartX.isFreePrice = function (priceInCents) {
    return priceInCents === 0 || priceInCents === 1 || priceInCents === 100;
  };

  /**
   * Clamp a value between min and max.
   */
  CartX.clamp = function (val, min, max) {
    return Math.min(Math.max(val, min), max);
  };
})();
