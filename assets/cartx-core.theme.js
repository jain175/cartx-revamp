/**
 * CartX Theme Switcher — Reads preset from section settings, applies to body
 */
CartX.register('theme', function (ctx) {
  'use strict';

  var ATTR = 'data-cartx-theme';
  var VALID = ['normal', 'sale', 'festive'];

  /**
   * Apply a theme preset to <body>.
   */
  ctx.setTheme = function (preset) {
    var theme = VALID.indexOf(preset) >= 0 ? preset : 'normal';
    document.body.setAttribute(ATTR, theme);
    ctx.log('Theme set:', theme);
    ctx.events.emit('theme:changed', theme);
  };

  /**
   * Get current theme.
   */
  ctx.getTheme = function () {
    return document.body.getAttribute(ATTR) || 'normal';
  };

  // Read initial theme from drawer section data attribute
  var drawerEl = document.querySelector('[data-cartx-theme-preset]');
  var initial = drawerEl ? drawerEl.getAttribute('data-cartx-theme-preset') : 'normal';
  ctx.setTheme(initial);
});
