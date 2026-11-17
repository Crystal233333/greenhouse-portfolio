/* ============================================================
 * 三个物件的交互动画：灯闪 / 书翻页 / 花绽放
 * 每个交互自己管自己的时间轴，主循环只负责喂 dt
 * ============================================================ */
window.APP = window.APP || {};

(function (APP) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
  function easeOutBack(x) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  APP.createInteractions = function (world, hooks) {
    hooks = hooks || {};

    var LAMP = world.lamp;
    var BOOK = world.book;
    var FLOWER = world.flower;

    /* ---------- 灯 ---------- */
    var lamp = { t: -1, fired: false };

    function flashLamp() {
      lamp.t = 0;
      lamp.fired = false;
    }

    function updateLamp(dt) {
      if (lamp.t < 0) return;
      lamp.t += dt;
      var k = lamp.t;

      // 0 → 0.14 快速起亮，之后 1.1 秒衰减
      var boost = k < 0.14 ? k / 0.14 : Math.max(0, 1 - (k - 0.14) / 1.1);
      boost = Math.pow(boost, 1.5);

      LAMP.light.intensity = LAMP.base + 2.2 * boost;
      LAMP.core.material.emissiveIntensity = 1.1 + 2.6 * boost;
      LAMP.shadeMat.emissiveIntensity = 1.5 + 2.2 * boost;
      LAMP.halo.scale.setScalar(0.75 + 0.8 * boost);
      LAMP.halo.material.opacity = 0.25 + 0.28 * boost;

      if (!lamp.fired && k > 0.22) {
        lamp.fired = true;
        if (hooks.onOpen) hooks.onOpen('lamp');
      }

      if (k > 1.35) {
        lamp.t = -1;
        LAMP.light.intensity = LAMP.base;
        LAMP.core.material.emissiveIntensity = 1.1;
        LAMP.shadeMat.emissiveIntensity = 1.5;
        LAMP.halo.scale.setScalar(0.75);
        LAMP.halo.material.opacity = 0.25;
      }
    }

    /* ---------- 书 ---------- */
    // 时间轴：0-0.85 抬出 → 0.85-1.4 翻封面 → 1.4-1.85 / 1.85-2.3 翻页
    var book = { t: -1, mode: 'idle' };  // idle | open | closing
    var COVER_OPEN = Math.PI - 0.12;
    var PAGE_OPEN = Math.PI - 0.04;

    var bookRest = {
      p: BOOK.rest.pos.clone(),
      r: BOOK.rest.rot.clone()
    };

    function openBook() {
      book.mode = 'open';
      book.t = 0;
    }

    function closeBook() {
      if (book.mode === 'idle') return;
      book.mode = 'closing';
      book.t = 0;
    }

    function setPose(t01) {
      var e = easeOutCubic(t01);
      BOOK.group.position.lerpVectors(bookRest.p, BOOK.active.pos, e);
      BOOK.group.rotation.set(
        lerp(bookRest.r.x, BOOK.active.rot.x, e),
        lerp(bookRest.r.y, BOOK.active.rot.y, e),
        lerp(bookRest.r.z, BOOK.active.rot.z, e)
      );
    }

    function decay(t01) {
      var e = easeInOutCubic(t01);
      BOOK.group.position.lerpVectors(BOOK.active.pos, bookRest.p, e);
      BOOK.group.rotation.set(
        lerp(BOOK.active.rot.x, bookRest.r.x, e),
        lerp(BOOK.active.rot.y, bookRest.r.y, e),
        lerp(BOOK.active.rot.z, bookRest.r.z, e)
      );
    }

    function updateBook(dt) {
      if (book.mode === 'idle') return;
      book.t += dt;
      var t = book.t;

      if (book.mode === 'open') {
        setPose(seg(t, 0, 0.85));

        var cover = easeInOutCubic(seg(t, 0.85, 1.4));
        BOOK.pages[0].rotation.z = COVER_OPEN * cover;

        var p1 = easeInOutCubic(seg(t, 1.4, 1.85));
        var p2 = easeInOutCubic(seg(t, 1.85, 2.3));
        BOOK.pages[1].rotation.z = PAGE_OPEN * p1;
        BOOK.pages[2].rotation.z = PAGE_OPEN * p2;
        BOOK.pages[3].rotation.z = PAGE_OPEN * easeInOutCubic(seg(t, 2.25, 2.65));

        if (t > 1.5 && !book.notified) {
          book.notified = true;
          setPose(1);
        }
        if (book.notified && !book.shown) {
          book.shown = true;
          if (hooks.onOpen) hooks.onOpen('book');
        }
      } else {
        var k = seg(t, 0, 0.8);
        var e = easeInOutCubic(k);
        // 先合页再回架
        var pageBack = easeInOutCubic(seg(t, 0, 0.45));
        BOOK.pages[0].rotation.z = COVER_OPEN * (1 - pageBack);
        BOOK.pages[1].rotation.z = PAGE_OPEN * (1 - pageBack);
        BOOK.pages[2].rotation.z = PAGE_OPEN * (1 - pageBack);
        BOOK.pages[3].rotation.z = PAGE_OPEN * (1 - pageBack);
        decay(seg(t, 0.35, 1.05));

        if (t > 1.1) {
          book.mode = 'idle';
          book.notified = false;
          book.shown = false;
          BOOK.pages[0].rotation.z = 0;
          BOOK.pages[1].rotation.z = 0;
          BOOK.pages[2].rotation.z = 0;
          BOOK.pages[3].rotation.z = 0;
          setPose(0);
        }
      }
    }

    /* ---------- 花 ---------- */
    var CLOSED = -0.92;
    var OPEN = -1.45;
    var flower = { t: -1, mode: 'idle' };   // idle | open | closing
    var flowerOpenAmount = 0;

    function applyFlower(amount) {
      amount = clamp(amount, 0, 1.06);
      for (var i = 0; i < FLOWER.petals.length; i++) {
        var p = FLOWER.petals[i];
        p.petal.rotation.x = lerp(CLOSED, OPEN, amount);
        var s = lerp(0.72, 1, Math.min(1, amount));
        p.petal.scale.setScalar(s);
      }
      FLOWER.center.scale.setScalar(lerp(0.8, 1.1, Math.min(1, amount)));
      FLOWER.bloom.scale.setScalar(lerp(0.94, 1.02, Math.min(1, amount)));
    }

    function openFlower() {
      flower.mode = 'open';
      flower.t = 0;
    }

    function closeFlower() {
      if (flower.mode === 'idle' && flowerOpenAmount <= 0) return;
      flower.mode = 'closing';
      flower.t = 0;
    }

    function updateFlower(dt) {
      if (flower.mode === 'idle') return;
      flower.t += dt;

      if (flower.mode === 'open') {
        var k = clamp(flower.t / 1.05, 0, 1);
        flowerOpenAmount = easeOutBack(k);
        applyFlower(flowerOpenAmount);

        // 绽放时的光晕脉冲
        var pulse = Math.sin(clamp(flower.t / 1.05, 0, 1) * Math.PI);
        FLOWER.halo.material.opacity = pulse * 0.9;
        FLOWER.halo.scale.setScalar(1.1 + pulse * 0.9);

        if (k >= 1) {
          flower.mode = 'idle';
          flowerOpenAmount = 1;
          applyFlower(1);
          FLOWER.halo.material.opacity = 0.14;
          FLOWER.halo.scale.setScalar(1.2);
          if (hooks.onOpen) hooks.onOpen('flower');
        }
      } else {
        var c = clamp(flower.t / 0.6, 0, 1);
        flowerOpenAmount = 1 - easeInOutCubic(c);
        applyFlower(flowerOpenAmount);
        FLOWER.halo.material.opacity = 0.14 * (1 - c);
        if (c >= 1) {
          flower.mode = 'idle';
          flowerOpenAmount = 0;
          applyFlower(0);
          FLOWER.halo.material.opacity = 0;
        }
      }
    }

    /* ---------- 初始化姿态 ---------- */
    applyFlower(0);
    FLOWER.halo.material.opacity = 0;
    setPose(0);

    return {
      trigger: function (id) {
        if (id === 'lamp') flashLamp();
        if (id === 'book') openBook();
        if (id === 'flower') openFlower();
      },
      reset: function (id) {
        if (id === 'book') closeBook();
        if (id === 'flower') closeFlower();
        // 灯是瞬时闪光，不需要复位
      },
      update: function (dt) {
        updateLamp(dt);
        updateBook(dt);
        updateFlower(dt);
      },
      isFlowerOpen: function () { return flowerOpenAmount > 0.5; }
    };
  };

  /* ============================================================
   * 环境道具的点击反应：鸟笼 / 留声机 / 洒水壶 / 风铃 / 菌灯 /
   * 干花 / 萤火罐 / 花架 / 钟 / 蝴蝶 / 绿植
   * 只做动画，不弹内容面板
   * ============================================================ */
  APP.createPropActions = function (world) {
    var P2 = world.props2 || {};
    var G = world.props || {};
    var timers = {};
    var base = {};

    function get(id) { return timers[id] === undefined ? -1 : timers[id]; }
    function play(id) {
      if (id === 'cloche' && P2.cloche) P2.cloche.morph.cycle();
      if (id === 'star' && P2.star) P2.star.sparks.trigger();
      if (get(id) < 0) timers[id] = 0;
    }
    function over(id, dur) {
      if (get(id) > dur) { timers[id] = -1; return true; }
      return false;
    }
    function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

    function update(dt) {
      for (var id in timers) if (timers[id] >= 0) timers[id] += dt;
      var k, e;
      if (P2.cloche) P2.cloche.morph.update(dt);
      if (P2.star) P2.star.sparks.update(dt);
      k = get('star');
      if (k >= 0 && P2.star) {
        var starPulse = Math.sin(Math.min(1, k / 1.8) * Math.PI);
        P2.star.core.scale.setScalar(1 + starPulse * 0.35);
        P2.star.halo.material.opacity = 0.6 + starPulse * 0.35;
        if (over('star', 1.8)) { P2.star.core.scale.setScalar(1); P2.star.halo.material.opacity = 0.6; }
      }
      if (get('cloche') >= 0) over('cloche', 0.6);

      k = get('girl');
      if (k >= 0 && P2.girl) {
        P2.girl.greet(k);
        over('girl', 3.2);
      }
      k=get('cat');
      if(k>=0 && P2.cat){P2.cat.wake(k,world.viewCamera && world.viewCamera.position);over('cat',3.4);}

      /* 鸟笼：小鸟扑腾 + 笼里灯变亮 */
      k = get('cage');
      if (k >= 0 && P2.cage) {
        if (base.birdY === undefined) base.birdY = P2.cage.bird.position.y;
        var birdEnvelope = Math.sin(Math.min(1, k / 2.8) * Math.PI);
        P2.cage.bird.position.y = base.birdY + birdEnvelope * (0.04 + Math.pow(Math.max(0, Math.sin(k * 8.5)), 1.3) * 0.045);
        P2.cage.bird.rotation.x = -0.16 * birdEnvelope;
        P2.cage.bird.rotation.z = Math.sin(k * 8.5) * 0.06 * birdEnvelope;
        P2.cage.bird.rotation.y = Math.sin(k * 3) * 0.18 * birdEnvelope;
        P2.cage.wings.forEach(function (wing) {
          wing.rotation.z = wing.userData.side * (0.1 + birdEnvelope * (1.0 + 0.7 * Math.sin(k * 17)));
        });
        P2.cage.halo.material.opacity = 0.45 + 0.35 * birdEnvelope;
        if (over('cage', 2.8)) {
          P2.cage.bird.rotation.set(0, 0, 0);
          P2.cage.bird.position.y = base.birdY;
          P2.cage.halo.material.opacity = 0.45;
          P2.cage.wings.forEach(function (wing) { wing.rotation.z = wing.userData.side * 0.1; });
        }
      }

      /* 留声机：唱片转起来 */
      k = get('gramophone');
      if (P2.gramophone && (k >= 0 || P2.gramophone.playing)) {
        var spinning = P2.gramophone.playing ? 6 : (k < 2.2 ? 9 : 9 * Math.max(0, (3 - k) / 0.8));
        P2.gramophone.turntable.rotation.y += dt * spinning;
        P2.gramophone.horn.rotation.z = k >= 0 ? Math.sin(k * 3.2) * 0.04 : 0;
        if (k >= 0 && over('gramophone', 3.0)) P2.gramophone.horn.rotation.z = 0;
      }

      /* 洒水壶：壶身一倾一倾 */
      k = get('wateringCan');
      if (k >= 0 && P2.wateringCan) {
        P2.wateringCan.group.rotation.z = Math.sin(Math.min(1, k / 0.5) * Math.PI * 2) * 0.18;
        if (over('wateringCan', 1.6)) P2.wateringCan.group.rotation.z = 0;
      }

      /* 风铃：铜管摆动 */
      k = get('windChime');
      if (k >= 0 && P2.windChime) {
        e = Math.max(0, 1 - k / 2.6);
        P2.windChime.tubes.rotation.z = Math.sin(k * 7) * 0.35 * e;
        P2.windChime.tubes.rotation.x = Math.sin(k * 5.3 + 1) * 0.2 * e;
        P2.windChime.catchPlate.rotation.z = Math.sin(k * 8) * 0.4 * e;
        if (over('windChime', 2.6)) {
          P2.windChime.tubes.rotation.set(0, 0, 0);
          P2.windChime.catchPlate.rotation.z = 0;
        }
      }

      /* 菌灯：菌盖脉冲 */
      k = get('mushroomLamp');
      if (k >= 0 && P2.mushroomLamp) {
        e = Math.sin(Math.min(1, k / 1.8) * Math.PI);
        for (var mi = 0; mi < P2.mushroomLamp.caps.length; mi++) {
          P2.mushroomLamp.caps[mi].material.emissiveIntensity = 1.5 + 3.2 * e;
        }
        if (over('mushroomLamp', 1.8)) {
          for (var mj = 0; mj < P2.mushroomLamp.caps.length; mj++) {
            P2.mushroomLamp.caps[mj].material.emissiveIntensity = 1.5;
          }
        }
      }

      /* 干花：晃两下 */
      k = get('driedBunch');
      if (k >= 0 && P2.driedBunch) {
        e = Math.max(0, 1 - k / 2.2);
        if (base.driedZ === undefined) base.driedZ = P2.driedBunch.group.rotation.z;
        P2.driedBunch.group.rotation.z = base.driedZ + Math.sin(k * 6.5) * 0.16 * e;
        if (over('driedBunch', 2.2)) P2.driedBunch.group.rotation.z = base.driedZ;
      }

      /* 萤火罐：光点散开再聚回 */
      k = get('fireflyJar');
      if (k >= 0 && P2.fireflyJar) {
        var fk = Math.min(1, k / 1.6);
        var spread = Math.sin(fk * Math.PI) * 1.0;
        for (var fi = 0; fi < P2.fireflyJar.flies.length; fi++) {
          var f = P2.fireflyJar.flies[fi];
          var ang = f.phase + k * 2.2;
          f.mesh.position.set(
            f.base.x + Math.cos(ang) * 0.035 * spread,
            f.base.y + Math.sin(ang * 1.7) * 0.05 * spread,
            f.base.z + Math.sin(ang) * 0.035 * spread
          );
          f.mesh.scale.setScalar(1 + spread * 0.6);
        }
        if (over('fireflyJar', 1.6)) {
          for (var fj = 0; fj < P2.fireflyJar.flies.length; fj++) {
            P2.fireflyJar.flies[fj].mesh.position.copy(P2.fireflyJar.flies[fj].base);
          }
        }
      }

      /* 花架：整架转一圈 */
      k = get('plantStand');
      if (k >= 0 && P2.plantStand) {
        if (base.standY === undefined) base.standY = P2.plantStand.group.rotation.y;
        P2.plantStand.group.rotation.y = base.standY + easeOut(Math.min(1, k / 1.5)) * Math.PI * 2;
        if (over('plantStand', 1.5)) P2.plantStand.group.rotation.y = base.standY;
      }

      /* 钟：钟摆幅度加大 */
      k = get('clock');
      if (k >= 0 && G.clock) {
        e = Math.sin(Math.min(1, k / 2.0) * Math.PI);
        G.clock.pendulum.rotation.z = Math.sin(k * 6) * (0.3 + 0.5 * e);
        if (over('clock', 2.0)) G.clock.pendulum.rotation.z = 0;
      }

      /* 蝴蝶：飞高一点 */
      k = get('butterfly');
      if (k >= 0 && G.butterflies) {
        e = Math.sin(Math.min(1, k / 2.2) * Math.PI);
        for (var bi = 0; bi < G.butterflies.length; bi++) {
          G.butterflies[bi].lift = 0.35 * e;
        }
        if (over('butterfly', 2.2)) {
          for (var bj = 0; bj < G.butterflies.length; bj++) {
            G.butterflies[bj].lift = 0;
          }
        }
      }

      /* 绿植：整株摇 */
      k = get('plant');
      if (k >= 0 && G.plants) {
        e = Math.max(0, 1 - k / 2.0);
        for (var pi = 0; pi < G.plants.length; pi++) {
          G.plants[pi].group.rotation.z = G.plants[pi].base + Math.sin(k * 9) * 0.09 * e;
        }
        if (over('plant', 2.0)) {
          for (var pj = 0; pj < G.plants.length; pj++) {
            G.plants[pj].group.rotation.z = G.plants[pj].base;
          }
        }
      }
    }

    return { trigger: play, update: update };
  };
}(window.APP));
