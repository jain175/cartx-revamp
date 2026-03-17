/**
 * CartX Progress Bar — Dynamic progress engine
 * Auto-derives stages from gift_manage rules when no explicit progressbar stages exist.
 * Partial DOM updates on cart:updated.
 */
CartX.register('progress', function (ctx) {
  'use strict';

  ctx.events.on('cart:fetched', _updateProgress);
  ctx.events.on('cart:updated', _updateProgress);
  ctx.events.on('section:rerendered', _cacheElements);

  var els = {};

  function _cacheElements() {
    els.container = document.querySelector('.cartx-progress-container-wrap');
    els.bar = document.querySelector('.cartx-progress-bar-fill');
    els.topMsg = document.querySelector('.cartx-progress-top-message');
    els.circles = document.querySelectorAll('.cartx-progress-icon-container');
    els.labels = document.querySelectorAll('.cartx-progress-stage-label');
  }

  _cacheElements();

  /**
   * Get stages — uses explicit progressbar stages if available,
   * otherwise auto-derives from gift_manage rules.
   */
  function _getStages() {
    var explicitStages = _readScript('cartx-progressbar-stages', []);
    if (explicitStages.length > 0) {
      return { stages: explicitStages, derivedFromGwp: false };
    }

    // Fallback: derive from gift_manage rules
    var giftRules = _readScript('cartx-gift-manage', []);
    if (giftRules.length > 0) {
      return { stages: giftRules, derivedFromGwp: true };
    }

    return { stages: [], derivedFromGwp: false };
  }

  function _readScript(id, fallback) {
    var el = document.getElementById(id);
    return CartX.safeJsonParse(el ? el.textContent : null, fallback);
  }

  function _updateProgress(cart) {
    if (!els.container) _cacheElements();
    if (!els.container) return;

    var config = _readScript('cartx-config', {});

    if (config.disableProgressBar) {
      els.container.style.display = 'none';
      return;
    }

    var stageData = _getStages();
    var stages = stageData.stages;
    var derivedFromGwp = stageData.derivedFromGwp;

    if (!stages.length) {
      els.container.style.display = 'none';
      return;
    }
    els.container.style.display = '';

    // When derived from GWP, use the GWP's isPriceBased flag (not the separate progressbar toggle)
    var isPriceBased = derivedFromGwp ? config.isPriceBased : config.progressbarIsPriceBased;

    // Compute adjusted value (exclude free gifts + combos)
    var adjValue = 0;
    if (cart && cart.items) {
      var freePrice = 0, comboPrice = 0, freeQty = 0, comboQty = 0;
      for (var i = 0; i < cart.items.length; i++) {
        var item = cart.items[i];
        var fp = item.final_line_price;
        var op = item.original_line_price;
        if ((fp === 0 || fp === 1 || fp === 100) && (op === 0 || op === 1 || op === 100)) {
          freeQty += item.quantity; freePrice += fp; continue;
        }
        if (item.product_type === 'Combos') {
          comboQty += item.quantity; comboPrice += fp; continue;
        }
      }
      if (isPriceBased) {
        adjValue = cart.total_price - freePrice - comboPrice;
      } else {
        adjValue = cart.item_count - freeQty - comboQty;
      }
    }

    // Get threshold from a stage, handling both explicit and derived formats
    function getThreshold(stage) {
      if (isPriceBased) {
        var tp = stage.trigger_price;
        var val = (tp && tp.value !== undefined) ? tp.value : tp;
        return parseFloat(val || 0) * 100; // Convert to cents
      } else {
        // Explicit progressbar uses trigger_product, GWP uses triggered_quantity
        var tq = derivedFromGwp ? stage.triggered_quantity : stage.trigger_product;
        var qval = (tq && tq.value !== undefined) ? tq.value : tq;
        return parseInt(qval || 0);
      }
    }

    // Sort stages by threshold ascending for correct progress rendering
    var sorted = stages.slice().sort(function (a, b) {
      return getThreshold(a) - getThreshold(b);
    });

    // Calculate progress
    var totalStages = sorted.length;
    var completedStages = 0;
    var nextThreshold = 0;
    var prevThreshold = 0;

    for (var s = 0; s < sorted.length; s++) {
      var threshold = getThreshold(sorted[s]);

      if (adjValue >= threshold) {
        completedStages = s + 1;
        prevThreshold = threshold;
      } else if (nextThreshold === 0) {
        nextThreshold = threshold;
      }
    }

    // Calculate bar width percentage with partial fill
    var progressPct = 0;
    if (completedStages >= totalStages) {
      progressPct = 100;
    } else if (totalStages > 0) {
      var segmentSize = 100 / totalStages;
      var completedPct = completedStages * segmentSize;
      if (nextThreshold > prevThreshold) {
        var partialPct = ((adjValue - prevThreshold) / (nextThreshold - prevThreshold)) * segmentSize;
        progressPct = completedPct + Math.min(partialPct, segmentSize);
      } else {
        progressPct = completedPct;
      }
    }

    // --- Update DOM ---

    // Bar fill
    if (els.bar) {
      els.bar.style.width = Math.min(progressPct, 100) + '%';
    }

    // Circles: active / glowing / inactive
    if (els.circles && els.circles.length) {
      for (var c = 0; c < els.circles.length; c++) {
        var circle = els.circles[c];
        circle.classList.remove('active', 'inactive', 'glowing-effect');
        if (c < completedStages) {
          circle.classList.add('active');
        } else if (c === completedStages) {
          circle.classList.add('inactive', 'glowing-effect');
        } else {
          circle.classList.add('inactive');
        }
      }
    }

    // Labels: active state
    if (els.labels && els.labels.length) {
      for (var l = 0; l < els.labels.length; l++) {
        if (l < completedStages) {
          els.labels[l].classList.add('active');
        } else {
          els.labels[l].classList.remove('active');
        }
      }
    }

    // Top message
    if (els.topMsg) {
      if (completedStages >= totalStages) {
        els.topMsg.innerHTML = config.topMessageAfter || 'You\'ve unlocked all rewards!';
      } else {
        var nextStage = sorted[completedStages];
        var msg = '';

        if (derivedFromGwp) {
          // Use gift_locked_message from GWP rule
          var glm = nextStage.gift_locked_message;
          msg = (glm && glm.value !== undefined) ? glm.value : (glm || '');
        } else {
          var tmfs = nextStage.top_message_for_stage;
          msg = (tmfs && tmfs.value !== undefined) ? tmfs.value : (tmfs || '');
        }

        // Default message if none set
        if (!msg) {
          if (isPriceBased) {
            msg = 'Add \u20B9[[PRICE]] more to unlock your next reward!';
          } else {
            msg = 'Add [[PRODUCT]] more to unlock your next reward!';
          }
        }

        var remaining = Math.max(0, nextThreshold - adjValue);
        els.topMsg.innerHTML = CartX.replacePlaceholders(msg, {
          price: remaining,
          product: isPriceBased ? Math.ceil(remaining / 100) : remaining
        });
      }
    }
  }
});
