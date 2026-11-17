/* ============================================================
 * 主程序：渲染器、相机路线、滚动推进、限位拖拽、拾取、面板
 * ============================================================ */
(function () {
  'use strict';
  THREE.ColorManagement.enabled = true;

  var canvas = document.getElementById('scene');
  var boot = document.getElementById('boot');
  var bootText = document.getElementById('boot-text');
  var fallback = document.getElementById('fallback');
  var progressFill = document.getElementById('progress-fill');
  var toastEl = document.getElementById('toast');

  var panel = document.getElementById('panel');
  var panelNo = document.getElementById('panel-no');
  var panelKicker = document.getElementById('panel-kicker');
  var panelTitle = document.getElementById('panel-title');
  var panelSummary = document.getElementById('panel-summary');
  var panelTags = document.getElementById('panel-tags');
  var panelLink = document.getElementById('panel-link');
  var panelUnset = document.getElementById('panel-unset');
  var panelNote = document.getElementById('panel-note');
  var panelClose = document.getElementById('panel-close');
  var panelBack = document.getElementById('panel-back');
  var scrim = document.getElementById('panel-scrim');
  var typing = document.getElementById('typing');

  var PROJECTS = window.PROJECTS || [];
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionPaused = false, motionTime = 0;
  var entry = document.getElementById('entry');
  var enterButton = document.getElementById('enter-world');
  var entered = /^#(inside|overview)$/.test(window.location.hash);
  var stage = document.getElementById('scene-stage'), header = document.querySelector('.topbar');
  if (entered) entry.hidden = true;
  else { stage.inert = true; header.inert = true; }
  function enterWorld() {
    if (entered || enterButton.disabled) return;
    music.play().catch(function () { toast('点右上角开启声音'); });
    entered = true; entry.classList.add('is-opening');
    setTimeout(function () { entry.hidden = true; stage.inert = false; header.inert = false; canvas.focus({ preventScroll: true }); }, mqReduce.matches ? 180 : 2000);
  }
  entry.addEventListener('click', enterWorld);

  /* ---------- WebGL 兜底 ---------- */
  function showFallback(reason) {
    boot.classList.add('is-done');
    fallback.hidden = false;
    entry.hidden = true; header.inert = false;
    var fallbackImage = fallback.querySelector('img');
    if (fallbackImage && !fallbackImage.getAttribute('src')) fallbackImage.src = fallbackImage.dataset.src;
    var txt = document.getElementById('fallback-text');
    if (txt && reason) txt.textContent = reason;
    var list = document.getElementById('fallback-list');
    if (list) {
      list.innerHTML = PROJECTS.map(function (p) {
        var name = (p.title && p.title.trim()) ? p.title : (p.object + ' · 尚未配置');
        return '<li>' + p.no + ' &nbsp; ' + name + '</li>';
      }).join('');
    }
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    showFallback('当前浏览器无法创建 WebGL 上下文，这里用静态图代替 3D 场景。');
    return;
  }
  if (!renderer || !renderer.getContext()) {
    showFallback();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060f);
  var environment = APP.createEnvironment(renderer);
  scene.environment = environment.texture;

  var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(3.8, 4.6, 13.2);

  /* ---------- 世界 ---------- */
  var world = APP.buildWorld(scene);
  world.viewCamera = camera;
  var hoverGlow = APP.createHoverGlow(scene, world);

  /* ---------- 外部 glb（异步；失败不影响程序化场景） ---------- */
  var MODELS = {}; // The current scene is procedural; keep the .glb pipeline for future additions.
  var propActions = null;
  if (APP.loadModels) {
    APP.loadModels(MODELS, function (models) {
      if (world.addModels) world.addModels(models);
      if (APP.createPropActions) propActions = APP.createPropActions(world);
    });
  }

  var musicButton = document.getElementById('music-toggle');
  var music = APP.createMusic(function (playing) {
    if (world.props2 && world.props2.gramophone) world.props2.gramophone.playing = playing;
    var label = playing ? '停止声音' : '开启声音';
    musicButton.hidden = false; musicButton.setAttribute('aria-label', label);
    musicButton.setAttribute('aria-pressed', String(playing));
    musicButton.title = label;
  });
  function toggleMusic() { music.toggle().catch(function () { toast('音乐暂时无法播放，请再点一次试试'); }); }
  musicButton.addEventListener('click', toggleMusic);

  /* ---------- 交互 ---------- */
  var interactions = APP.createInteractions(world, {
    onOpen: function (id) {
      if (cameraRig && cameraRig.mode === 'focused' && cameraRig.subject && cameraRig.subject.id === id) openPanel(id);
    }
  });

  /* ---------- 相机路线 ---------- */
  var cameraRig = APP.createCameraRig(camera, { navigation: world.cameraNavigation });

  function smoothstep(x) { return x * x * (3 - 2 * x); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- 状态 ---------- */
  var state = {
    progress: 1,
    scrollFraction: 0,
    eased: 0,
    targetYaw: 0, yaw: 0,
    targetPitch: 0, pitch: 0,
    inside: false,
    hoverId: null,
    panelId: null,
    dragging: false
  };

  function inScene() { return state.eased > 0.5; }

  /* ---------- 滚动 ---------- */
  function onScroll() {
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (cameraRig.isBusy()) {
      window.scrollTo(0, (1 - state.progress) * max);
      return;
    }
    var f = Math.min(1, Math.max(0, window.scrollY / max));
    state.scrollFraction = f;
    // 向下滚 = 相机后退（变远）；向上滚 = 靠近
    state.progress = 1 - f;
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- 指针 ---------- */
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2(-10, -10);
  var down = { x: 0, y: 0, t: 0, id: null };
  var lastTouch = { x: 0, y: 0 };

  function setPointer(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function pickTargets() {
    var list = world.hits.slice();
    if (world.props2 && world.props2.hits) list = list.concat(world.props2.hits);
    return list;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(pickTargets(), false);
    if (!hits.length) return null;
    var u = hits[0].object.userData;
    if (u.chapter) return { kind: 'chapter', id: u.chapter };
    if (u.prop) return { kind: 'prop', id: u.prop };
    return null;
  }

  canvas.addEventListener('pointerdown', function (e) {
    down.x = e.clientX;
    down.y = e.clientY;
    down.t = performance.now();
    down.id = e.pointerId;
    state.dragging = true;
    canvas.classList.add('is-dragging');
    if (e.pointerType === 'touch') {
      lastTouch.x = e.clientX;
      lastTouch.y = e.clientY;
    }
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', function (e) {
    setPointer(e);
    if (cameraRig.isBusy()) return;

    if (e.pointerType === 'touch' && state.dragging) {
      var dx = e.clientX - lastTouch.x;
      var dy = e.clientY - lastTouch.y;
      lastTouch.x = e.clientX;
      lastTouch.y = e.clientY;
      state.targetYaw = clamp(state.targetYaw - dx * 0.0016, -0.24, 0.24);
      state.targetPitch = clamp(state.targetPitch + dy * 0.0012, -0.12, 0.12);
      return;
    }

    if (e.pointerType === 'mouse') {
      state.targetYaw = ((e.clientX / window.innerWidth) * 2 - 1) * 0.085;
      state.targetPitch = ((e.clientY / window.innerHeight) * 2 - 1) * 0.042;

      var hov = pick();
      var hid = hov ? hov.kind + ':' + hov.id : null;
      if (hid !== state.hoverId) {
        state.hoverId = hid;
        canvas.classList.toggle('is-pointing', !!hid);
      }
    }
  });

  canvas.addEventListener('pointerup', function (e) {
    var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
    var dur = performance.now() - down.t;
    state.dragging = false;
    canvas.classList.remove('is-dragging');

    if (moved < 10 && dur < 700) {
      setPointer(e);
      var hit = pick();
      if (hit) {
        if (hit.kind === 'chapter') activate(hit.id);
        else triggerProp(hit.id);
      }
    }
  });

  canvas.addEventListener('pointercancel', function () {
    state.dragging = false;
    canvas.classList.remove('is-dragging');
  });

  canvas.addEventListener('pointerleave', function () {
    state.hoverId = null; pointer.set(-10, -10); canvas.classList.remove('is-pointing');
    state.targetYaw = 0;
    state.targetPitch = 0;
  });

  /* ---------- 触发 ---------- */
  function focusSpec(kind, id) {
    world.house.updateWorldMatrix(true, true);
    var object = pickTargets().find(function (h) { return kind === 'chapter' ? h.userData.chapter === id : h.userData.prop === id; });
    if (!object) return null;
    var target = object.getWorldPosition(new THREE.Vector3());
    if (kind === 'chapter' && id === 'book') target = world.house.localToWorld(world.book.active.pos.clone());
    var distance = id === 'cat' ? 1.8 : (id === 'cage' ? 1.45 : (id === 'girl' ? 3.2 : (id === 'plantStand' ? 2.9 : 2.6)));
    return { kind: kind, id: id, target: target, distance: distance };
  }
  function triggerProp(id) {
    if (/^plant\d+$/.test(id)) return;
    if (!entered || state.panelId || cameraRig.isBusy()) return;
    var spec = focusSpec('prop', id);
    if (!spec || !propActions) return;
    // Audio must be unlocked in the original user gesture, before the camera trip.
    if (id === 'gramophone') toggleMusic();
    var durations = { cat:3.6, girl: 3.4, gramophone: 3.2, cage: 3.2, star: 2.1, cloche: 1.1, plantStand: 1.8, clock: 2.2, fireflyJar: 1.8, driedBunch: 2.4 };
    state.targetYaw = state.yaw; state.targetPitch = state.pitch;
    cameraRig.focus(spec, function () {
      propActions.trigger(id.replace(/^butterfly\d+$/, 'butterfly').replace(/^plant\d+$/, 'plant'));
    }, durations[id] || 2.5);
  }

  function activate(id) {
    if (!entered || state.panelId || cameraRig.isBusy()) return;
    var spec = focusSpec('chapter', id);
    if (!spec) return;
    state.targetYaw = state.yaw; state.targetPitch = state.pitch;
    cameraRig.focus(spec, function () { interactions.trigger(id); });
  }

  /* ---------- 引导光点：由世界里的暖色光点承担，不用文字 ---------- */

  /* ---------- 面板 ---------- */
  function findProject(id) {
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].id === id) return PROJECTS[i];
    return null;
  }

  function hasUrl(p) {
    var u = (p && p.url ? p.url : '').trim();
    return !!u && u.charAt(0) !== '#';
  }

  function openPanel(id) {
    var p = findProject(id);
    if (!p) return;

    var title = (p.title || '').trim();
    var summary = (p.summary || '').trim();

    panelNo.textContent = p.no || '';
    panelKicker.textContent = p.object || '';
    panelTitle.textContent = title || '尚未配置';
    typing.hidden = !!title;

    panelSummary.textContent = summary;
    panelSummary.hidden = !summary;

    panelTags.innerHTML = (p.tags && p.tags.length)
      ? p.tags.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      : '';
    panelTags.hidden = !(p.tags && p.tags.length);

    if (hasUrl(p)) {
      panelLink.href = p.url.trim();
      panelLink.hidden = false;
      panelUnset.hidden = true;
      panelNote.hidden = true;
    } else {
      panelLink.hidden = true;
      panelUnset.hidden = false;
      panelNote.hidden = false;
      panelNote.textContent = '这个作品还在准备中。';
    }

    state.panelId = id;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    scrim.hidden = false;
    requestAnimationFrame(function () { scrim.classList.add('is-on'); });
    panelClose.focus({ preventScroll: true });
  }

  function closePanel() {
    if (!state.panelId) return;
    var id = state.panelId;
    state.panelId = null;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('is-on');
    setTimeout(function () {
      if (!state.panelId) scrim.hidden = true;
    }, 360);
    interactions.reset(id);
    cameraRig.release();
    canvas.focus({ preventScroll: true });
  }

  panelClose.addEventListener('click', closePanel);
  panelBack.addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    if (!entered) {
      if ((e.key === 'Enter' || e.key === ' ') && !enterButton.disabled) { e.preventDefault(); enterWorld(); }
      if (e.key === 'Tab') { e.preventDefault(); enterButton.focus({ preventScroll: true }); }
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].indexOf(e.key) >= 0) e.preventDefault();
      return;
    }
    if (cameraRig.isBusy() && !panel.contains(document.activeElement) && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].indexOf(e.key) >= 0) e.preventDefault();
    if (e.key === 'Escape' && state.panelId) closePanel();
    else if (e.key === 'Escape' && cameraRig.isBusy()) {
      if (cameraRig.subject && cameraRig.subject.kind === 'chapter') interactions.reset(cameraRig.subject.id);
      cameraRig.release();
    }
    if (document.activeElement === canvas && !state.panelId && /^[1234]$/.test(e.key)) {
      e.preventDefault();
      if (e.key === '4') triggerProp('girl');
      else activate(['lamp', 'book', 'flower'][Number(e.key) - 1]);
    }
    if (e.key === 'Tab' && state.panelId) {
      var controls = Array.prototype.filter.call(panel.querySelectorAll('button, a[href]'), function (el) { return !el.hidden && el.offsetParent !== null; });
      var first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function setView(inside, immediate) {
    if (cameraRig.isBusy()) return;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: inside ? 0 : max, behavior: immediate || mqReduce.matches ? 'instant' : 'smooth' });
    if (immediate) { state.progress = inside ? 1 : 0; state.eased = smoothstep(state.progress); }
  }

  ['wheel', 'touchmove'].forEach(function (evName) {
    window.addEventListener(evName, function (e) {
      if (!entered || (cameraRig.isBusy() && !panel.contains(e.target))) e.preventDefault();
    }, { passive: false });
  });

  /* ---------- 提示 ---------- */
  var toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  /* ---------- 尺寸 ---------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    cameraRig.resize();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);

  /* ---------- 主循环 ---------- */
  var clock = new THREE.Clock();
  var booted = false;

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var resting = mqReduce.matches || motionPaused;
    if (!resting) motionTime += dt;
    var t = motionTime;

    if (!cameraRig.isBusy()) {
      var target = smoothstep(state.progress);
      state.eased += (target - state.eased) * Math.min(1, dt * 6);
      if (Math.abs(target - state.eased) < 0.0004) state.eased = target;
      state.yaw += (state.targetYaw - state.yaw) * Math.min(1, dt * 5);
      state.pitch += (state.targetPitch - state.pitch) * Math.min(1, dt * 5);
    }

    var pe = state.eased;
    cameraRig.update(dt, pe, state.yaw, state.pitch);

    if (world.frontGlass) {
      world.frontGlass.uniforms.uOpacity.value = 0.07 * clamp(1 - (Math.max(pe, cameraRig.blend) - 0.58) / 0.24, 0, 1);
    }

    world.update(resting ? 0 : dt, t);
    interactions.update(dt);
    if (propActions) propActions.update(dt);

    progressFill.style.height = (state.scrollFraction * 100).toFixed(1) + '%';
    state.inside = pe > 0.55;

    // 引导光点：走进来才亮，开着面板时压暗
    world.guideStrength = cameraRig.isBusy() ? 0 : Math.min(1, Math.max(0, (pe - 0.6) / 0.14));
    world.hoverId = cameraRig.isBusy() ? null : state.hoverId;
    if (entered && !cameraRig.isBusy() && !state.panelId && pointer.x > -5) {
      var hovered = pick(); state.hoverId = hovered ? hovered.kind + ':' + hovered.id : null;
      canvas.classList.toggle('is-pointing', !!hovered);
    }
    hoverGlow.update(cameraRig.isBusy() || !entered ? null : state.hoverId, dt,
      cameraRig.isBusy() || !entered ? 0 : world.guideStrength, window.innerWidth, window.innerHeight);

    renderer.render(scene, camera);

    if (!booted) {
      booted = true;
      document.documentElement.dataset.ready = '1';
      enterButton.disabled = false; enterButton.textContent = '点击任意处 · 拨开云雾';
      boot.classList.add('is-done');
      setTimeout(function () { boot.style.display = 'none'; }, 900);
    }

    requestAnimationFrame(frame);
  }

  /* ---------- 启动 ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var initialProgress = window.location.hash === '#inside' ? 1 : (window.location.hash === '#overview' ? 0 : 0.41);
  window.scrollTo(0, (1 - initialProgress) * Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
  onScroll();
  state.eased = smoothstep(state.progress);
  resize();
  if (bootText) bootText.textContent = '星空已点亮';
  requestAnimationFrame(frame);

  window.__FARMHOUSE__ = {
    state: state,
    setView: setView,
    activate: activate,
    greet: function () { triggerProp('girl'); },
    triggerProp: triggerProp,
    enterWorld: enterWorld,
    hasEntered: function () { return entered; },
    music: music,
    closePanel: closePanel,
    world: world,
    hoverGlow: hoverGlow,
    camera: camera,
    renderer: renderer,
    scene: scene,
    rig: cameraRig,
    animations: interactions,
    propAnimations: propActions
  };
}());
