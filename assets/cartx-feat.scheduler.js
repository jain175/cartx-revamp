/**
 * CartX Scheduler — Offer scheduler + countdown timer
 * Reads offer expiry times from data attributes, shows countdown,
 * emits offer:expired when timer hits zero.
 */
CartX.register('scheduler', function (ctx) {
  'use strict';

  var timers = [];
  var tickInterval = null;

  ctx.events.on('section:rerendered', _initTimers);
  ctx.events.on('drawer:opened', _startTicking);
  ctx.events.on('drawer:closed', _stopTicking);

  _initTimers();

  function _initTimers() {
    // Clear existing
    timers = [];

    var els = document.querySelectorAll('[data-cartx-expires]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var expiresAt = parseInt(el.getAttribute('data-cartx-expires'));
      if (!expiresAt || isNaN(expiresAt)) continue;

      var offerId = el.getAttribute('data-cartx-offer-id') || 'offer-' + i;

      timers.push({
        el: el,
        expiresAt: expiresAt,
        offerId: offerId,
        expired: false
      });
    }

    if (timers.length > 0) {
      _tick();
      _startTicking();
    }
  }

  function _startTicking() {
    if (tickInterval) return;
    if (timers.length === 0) return;
    tickInterval = setInterval(_tick, 1000);
  }

  function _stopTicking() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function _tick() {
    var now = Math.floor(Date.now() / 1000);
    var allExpired = true;

    for (var i = 0; i < timers.length; i++) {
      var timer = timers[i];
      if (timer.expired) continue;

      var remaining = timer.expiresAt - now;

      if (remaining <= 0) {
        timer.expired = true;
        _renderExpired(timer.el);
        ctx.events.emit('offer:expired', { offerId: timer.offerId });
        continue;
      }

      allExpired = false;
      _renderCountdown(timer.el, remaining);
    }

    if (allExpired) _stopTicking();
  }

  function _renderCountdown(el, seconds) {
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds % 3600) / 60);
    var secs = seconds % 60;

    var display = el.querySelector('.cartx-countdown-display');
    if (!display) return;

    var parts = [];
    if (hours > 0) parts.push(_pad(hours) + 'h');
    parts.push(_pad(mins) + 'm');
    parts.push(_pad(secs) + 's');

    display.textContent = parts.join(' ');
  }

  function _renderExpired(el) {
    var display = el.querySelector('.cartx-countdown-display');
    if (display) display.textContent = 'Expired';
    el.classList.add('cartx-timer-expired');
  }

  function _pad(n) {
    return n < 10 ? '0' + n : String(n);
  }
});
