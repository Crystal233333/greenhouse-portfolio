/* ============================================================
 * 花房作品集入口 · 交互脚本
 * 依赖 works.js 提供的 window.WORKS，不依赖任何框架或网络资源。
 * 热点位置、悬停提示、手机卡片、星空、视差都按图片自身的
 * 归一化坐标工作，所以任何屏幕尺寸下热点都跟着图片走。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
   * 0. 元素与常量
   * ------------------------------------------------------- */

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqCoarse = window.matchMedia('(pointer: coarse)');

  var els = {
    tilt: document.getElementById('tilt'),
    frame: document.getElementById('frame'),
    layer: document.getElementById('hotspots'),
    hint: document.getElementById('hint'),
    sky: document.getElementById('sky'),
    tooltip: document.getElementById('tooltip'),
    tooltipName: document.getElementById('tooltip-name'),
    tooltipState: document.getElementById('tooltip-state'),
    toast: document.getElementById('toast'),
    sheet: document.getElementById('sheet'),
    sheetCard: document.querySelector('.sheet-card'),
    sheetKicker: document.getElementById('sheet-kicker'),
    sheetTitle: document.getElementById('sheet-title'),
    sheetSummary: document.getElementById('sheet-summary'),
    sheetLink: document.getElementById('sheet-link'),
    sheetUnset: document.getElementById('sheet-unset'),
    sheetNote: document.getElementById('sheet-note'),
    sheetClose: document.getElementById('sheet-close')
  };

  var WORKS = Array.isArray(window.WORKS) ? window.WORKS : [];

  /* ---------------------------------------------------------
   * 1. 小工具
   * ------------------------------------------------------- */

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /* 空字符串、'#' 开头都不算有效链接；未配置就不会跳转 */
  function hasLink(work) {
    var url = text(work && work.url);
    if (!url || url.charAt(0) === '#') return false;
    return !/^javascript:/i.test(url);
  }

  function labelOf(work) {
    return text(work.name) || text(work.slot) || '作品';
  }

  function pct(value) {
    if (typeof value === 'number') return value + '%';
    var raw = text(value);
    return raw || '0%';
  }

  /* ---------------------------------------------------------
   * 2. 生成热点
   * ------------------------------------------------------- */

  var hotspotEls = [];
  var activeEl = null;

  function ariaFor(work, configured) {
    var parts = [];
    if (text(work.slot)) parts.push(text(work.slot));
    if (text(work.subject)) parts.push(text(work.subject));
    if (configured) parts.push(text(work.name) || '已配置作品链接');
    else if (text(work.name)) parts.push(text(work.name) + '，尚未配置网址');
    else parts.push('尚未配置作品信息');
    return parts.join('，');
  }

  function buildHotspots() {
    var frag = document.createDocumentFragment();

    WORKS.forEach(function (work, index) {
      var spot = work.hotspot || {};
      var configured = hasLink(work);
      var el = document.createElement(configured ? 'a' : 'button');

      if (configured) {
        el.href = text(work.url);
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      } else {
        el.type = 'button';
      }

      el.className = 'hotspot' + (spot.shape === 'circle' ? ' is-round' : '');
      el.style.left = pct(spot.left);
      el.style.top = pct(spot.top);
      el.style.width = pct(spot.width);
      el.style.height = pct(spot.height);
      el.setAttribute('aria-label', ariaFor(work, configured));
      el.setAttribute('data-id', text(work.id) || 'work-' + (index + 1));
      el.__work = work;

      el.addEventListener('pointerenter', function (ev) {
        if (ev.pointerType === 'touch') return;
        activeEl = el;
        showTooltip(el);
        dismissHint();
      });

      el.addEventListener('pointerleave', function () {
        if (activeEl !== el) return;
        if (document.activeElement === el) return;  /* 键盘聚焦时保留提示 */
        activeEl = null;
        hideTooltip();
      });

      el.addEventListener('focus', function () {
        activeEl = el;
        showTooltip(el);
        dismissHint();
      });

      el.addEventListener('blur', function () {
        if (activeEl !== el) return;
        activeEl = null;
        hideTooltip();
      });

      el.addEventListener('click', function (ev) {
        activate(ev, el, work);
      });

      hotspotEls.push({ el: el, work: work });
      frag.appendChild(el);
    });

    els.layer.appendChild(frag);
  }

  function activate(ev, el, work) {
    dismissHint();

    /* 触摸设备：先给卡片，点了“进入作品”才跳转，减少误触 */
    if (mqCoarse.matches) {
      ev.preventDefault();
      openSheet(work, el);
      return;
    }

    /* 已配置：<a> 自己会在新标签页打开，这里不拦 */
    if (hasLink(work)) return;

    ev.preventDefault();
    showToast(labelOf(work) + '：这个位置还没有配置作品网址');
  }

  /* ---------------------------------------------------------
   * 3. 桌面悬停提示
   * ------------------------------------------------------- */

  function showTooltip(el) {
    var work = el.__work || {};
    var configured = hasLink(work);

    els.tooltipName.textContent = labelOf(work);
    els.tooltipState.textContent = configured ? '进入作品' : '尚未配置';
    els.tooltip.classList.toggle('is-unset', !configured);
    els.tooltip.hidden = false;
    placeTooltip(el);
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  function placeTooltip(el) {
    if (els.tooltip.hidden) return;

    var rect = el.getBoundingClientRect();
    var tw = els.tooltip.offsetWidth;
    var th = els.tooltip.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var gap = 14;

    var x = rect.left + rect.width / 2 - tw / 2;
    var y = rect.top - th - gap;

    if (y < 8) y = rect.bottom + gap;
    x = Math.min(Math.max(8, x), Math.max(8, vw - tw - 8));
    y = Math.min(y, Math.max(8, vh - th - 8));

    els.tooltip.style.transform =
      'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }

  /* ---------------------------------------------------------
   * 4. 手机作品卡片
   * ------------------------------------------------------- */

  var sheetTimer = 0;
  var sheetReturnEl = null;

  function openSheet(work, el) {
    var configured = hasLink(work);
    sheetReturnEl = el || null;

    els.sheetKicker.textContent = text(work.slot) || '作品';
    els.sheetTitle.textContent = text(work.name) ||
      (configured ? '未命名作品' : '尚未配置作品信息');

    var summary = text(work.summary);
    if (configured) {
      els.sheetSummary.textContent = summary;
    } else {
      els.sheetSummary.textContent = summary || '这个位置的作品还没有填写名称和简介。';
    }
    els.sheetSummary.hidden = els.sheetSummary.textContent === '';

    if (configured) {
      els.sheetLink.href = text(work.url);
      els.sheetLink.hidden = false;
      els.sheetUnset.hidden = true;
      els.sheetNote.hidden = true;
    } else {
      els.sheetLink.hidden = true;
      els.sheetUnset.hidden = false;
      els.sheetNote.hidden = false;
      els.sheetNote.textContent = '在 works.js 里填写名称、简介和网址后，这里会出现“进入作品”。';
    }

    window.clearTimeout(sheetTimer);
    els.sheet.hidden = false;
    window.requestAnimationFrame(function () {
      els.sheet.classList.add('is-open');
    });
    els.sheetClose.focus({ preventScroll: true });
    hideTooltip();
  }

  function closeSheet() {
    if (els.sheet.hidden) return;

    els.sheet.classList.remove('is-open');
    var finish = function () {
      els.sheet.hidden = true;
      if (sheetReturnEl && typeof sheetReturnEl.focus === 'function') {
        sheetReturnEl.focus({ preventScroll: true });
      }
      sheetReturnEl = null;
    };

    if (mqReduce.matches) finish();
    else sheetTimer = window.setTimeout(finish, 240);
  }

  /* ---------------------------------------------------------
   * 5. 轻提示与初始引导
   * ------------------------------------------------------- */

  var toastTimer = 0;

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-on');
    }, 2800);
  }

  var hintTimer = 0;
  var hintDismissed = false;

  function dismissHint() {
    if (hintDismissed || !els.hint) return;
    hintDismissed = true;
    els.hint.classList.add('is-hidden');
    window.clearTimeout(hintTimer);
  }

  function scheduleHint() {
    if (!els.hint) return;
    hintTimer = window.setTimeout(dismissHint, 7000);
  }

  /* ---------------------------------------------------------
   * 6. 星空
   * ------------------------------------------------------- */

  var sky = (function () {
    var canvas = els.sky;
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var stars = [];
    var w = 0;
    var h = 0;

    function build() {
      var count = Math.round(Math.min(190, Math.max(70, (w * h) / 8000)));
      stars.length = 0;
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: 0.4 + Math.random() * 1.2,
          a: 0.2 + Math.random() * 0.55,
          tw: 0.5 + Math.random() * 1.7,
          ph: Math.random() * Math.PI * 2,
          d: 0.3 + Math.random() * 0.7,
          warm: Math.random() < 0.22
        });
      }
    }

    function resize() {
      if (!ctx) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth || window.innerWidth;
      h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      paint(0, 0);
    }

    function paint(px, py) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var flicker = 0.55 + 0.45 * Math.sin(s.ph);
        var alpha = s.a * flicker;
        if (alpha <= 0.01) continue;
        ctx.beginPath();
        ctx.arc(s.x * w + px * s.d, s.y * h + py * s.d, s.r, 0, 6.2832);
        ctx.fillStyle = s.warm
          ? 'rgba(255,226,190,' + alpha.toFixed(3) + ')'
          : 'rgba(206,218,255,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
    }

    function tick(dt, px, py) {
      if (!ctx) return;
      var step = Math.min(dt, 64);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.ph += step * 0.00042 * s.tw;
        if (s.ph > 6.2832) s.ph -= 6.2832;
        s.x -= step * 0.0000022 * s.d;
        s.y -= step * 0.0000013 * s.d;
        if (s.x < -0.02) s.x += 1.04;
        if (s.y < -0.02) s.y += 1.04;
      }
      paint(px, py);
    }

    return { resize: resize, tick: tick, paint: paint };
  }());

  /* ---------------------------------------------------------
   * 7. 视差 + 主循环
   * ------------------------------------------------------- */

  var motion = { tx: 0, ty: 0, cx: 0, cy: 0 };
  var rafId = 0;
  var lastTime = 0;

  function applyTilt() {
    if (!els.tilt) return;
    if (mqReduce.matches) {
      els.tilt.style.transform = '';
      return;
    }
    els.tilt.style.transform =
      'translate3d(' + (motion.cx * 9).toFixed(2) + 'px,' + (motion.cy * 7).toFixed(2) + 'px,0) ' +
      'rotateX(' + (-motion.cy * 1.4).toFixed(3) + 'deg) ' +
      'rotateY(' + (motion.cx * 2).toFixed(3) + 'deg)';
  }

  function loop(now) {
    rafId = window.requestAnimationFrame(loop);
    var dt = lastTime ? now - lastTime : 16;
    lastTime = now;

    motion.cx += (motion.tx - motion.cx) * 0.075;
    motion.cy += (motion.ty - motion.cy) * 0.075;
    if (Math.abs(motion.tx - motion.cx) < 0.0008) motion.cx = motion.tx;
    if (Math.abs(motion.ty - motion.cy) < 0.0008) motion.cy = motion.ty;

    applyTilt();
    sky.tick(dt, -motion.cx * 16, -motion.cy * 12);

    if (activeEl) placeTooltip(activeEl);
  }

  function startLoop() {
    if (rafId || mqReduce.matches) return;
    lastTime = 0;
    rafId = window.requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* ---------------------------------------------------------
   * 8. 事件装配
   * ------------------------------------------------------- */

  function bindEvents() {
    window.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch' || mqReduce.matches) return;
      motion.tx = (ev.clientX / window.innerWidth) * 2 - 1;
      motion.ty = (ev.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      motion.tx = 0;
      motion.ty = 0;
    });

    window.addEventListener('blur', function () {
      motion.tx = 0;
      motion.ty = 0;
    });

    window.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!els.sheet.hidden) {
        closeSheet();
      } else if (activeEl && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
    });

    els.sheet.addEventListener('click', function (ev) {
      if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-close')) {
        closeSheet();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopLoop();
      else startLoop();
    });

    if (mqReduce.addEventListener) {
      mqReduce.addEventListener('change', function () {
        motion.tx = 0;
        motion.ty = 0;
        motion.cx = 0;
        motion.cy = 0;
        applyTilt();
        if (mqReduce.matches) {
          stopLoop();
          sky.paint(0, 0);
        } else {
          startLoop();
        }
      });
    }

    var resizeTimer = 0;
    var onResize = function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        sky.resize();
        if (activeEl) placeTooltip(activeEl);
      }, 150);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }

  /* ---------------------------------------------------------
   * 9. 初始化
   * ------------------------------------------------------- */

  function init() {
    buildHotspots();
    sky.resize();
    bindEvents();
    scheduleHint();

    if (mqReduce.matches) {
      sky.paint(0, 0);
    } else {
      startLoop();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
