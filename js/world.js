/* ============================================================
 * 世界：浮岛 + 拱形玻璃花房 + 室内陈设 + 星空
 * 程序化主体、实例化花叶与少量本地岩石模型
 * ============================================================ */
window.APP = window.APP || {};

(function (APP) {
  'use strict';

  var T = APP.tex;
  var V3 = THREE.Vector3;
  var beijingFormatter = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Shanghai', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
  var lastClockSecond = null, clockParts = {};
  APP.beijingClockAngles = function (epoch) {
    epoch = epoch === undefined ? Date.now() : epoch;
    var whole = Math.floor(epoch / 1000);
    if (whole !== lastClockSecond) {
      beijingFormatter.formatToParts(new Date(epoch)).forEach(function (part) { clockParts[part.type] = Number(part.value); });
      lastClockSecond = whole;
    }
    var seconds = clockParts.second + (epoch % 1000) / 1000;
    var minutes = clockParts.minute + seconds / 60;
    return {hour:-(clockParts.hour % 12 + minutes / 60) * Math.PI / 6,
      minute:-minutes * Math.PI / 30, second:-seconds * Math.PI / 30};
  };

  function rnd(seed) {
    var s = seed || 1;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function std(color, o) {
    o = o || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: o.rough === undefined ? 0.85 : o.rough,
      metalness: o.metal === undefined ? 0 : o.metal,
      flatShading: !!o.flat,
      side: o.side || THREE.FrontSide,
      transparent: !!o.transparent,
      opacity: o.opacity === undefined ? 1 : o.opacity,
      emissive: o.emissive === undefined ? 0x000000 : o.emissive,
      emissiveIntensity: o.ei === undefined ? 1 : o.ei,
      map: o.map || null,
      bumpMap: o.bumpMap || null,
      bumpScale: o.bumpScale || 0,
      envMapIntensity: o.env === undefined ? 0.16 : o.env,
      alphaTest: o.alphaTest || 0,
      depthWrite: o.depthWrite === undefined ? true : o.depthWrite
    });
  }

  function box(w, h, d, material, x, y, z) {
    var m = new THREE.Mesh(APP.roundedBox(w, h, d, 0.012), material);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  function cyl(rt, rb, h, seg, material, x, y, z) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), material);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  function archSurface(R, z0, z1, segZ, segA) {
    var g = new THREE.BufferGeometry();
    var pos = [], idx = [];
    for (var i = 0; i <= segZ; i++) {
      var z = z0 + (z1 - z0) * i / segZ;
      for (var j = 0; j <= segA; j++) {
        var a = Math.PI * j / segA;
        pos.push(Math.cos(a) * R, Math.sin(a) * R, z);
      }
    }
    for (var ii = 0; ii < segZ; ii++) {
      for (var jj = 0; jj < segA; jj++) {
        var a0 = ii * (segA + 1) + jj, b0 = a0 + segA + 1;
        idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function archCap(R, z, segA) {
    var g = new THREE.BufferGeometry();
    var pos = [0, 0, z], idx = [];
    for (var j = 0; j <= segA; j++) {
      var a = Math.PI * j / segA;
      pos.push(Math.cos(a) * R, Math.sin(a) * R, z);
    }
    for (var k = 1; k <= segA; k++) idx.push(0, k, k + 1);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    var uv = [];
    for (var u = 0; u < pos.length; u += 3) uv.push(0.5 + pos[u] / (2 * R), pos[u + 1] / R);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function glassMaterial(color, baseOpacity) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: baseOpacity === undefined ? 0.16 : baseOpacity }
      },
      vertexShader: [
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  vN = normalize(normalMatrix * normal);',
        '  vV = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uOpacity;',
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.1);',
        '  vec3 col = mix(uColor, vec3(0.9, 0.95, 1.0), f * 0.55);',
        '  float a = uOpacity + f * 0.52;',
        '  gl_FragColor = vec4(col, clamp(a, 0.0, 0.94));',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }

  function ghost(geo) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, transparent: true, opacity: 0
    }));
  }

  /* ============================================================
   * 主构建
   * ============================================================ */
  APP.buildWorld = function (scene) {
    var root = new THREE.Group();
    scene.add(root);

    var R = 2.78, EAVES = 1.45, RISE = 2.0;
    var Z0 = -2.35, Z1 = 2.15;
    var woodGrain = APP.surfaceTexture("wood");
    var rockGrain = APP.surfaceTexture("rock");

    /* ---------- 材质 ---------- */
    var M = {
      wood: std(0xffffff, { map: T.wood(1.6, 1.2), rough: 0.86 }),
      woodDeck: std(0xffffff, { map: T.wood(3.0, 2.2), rough: 0.9 }),
      woodDark: std(0x493022, { map: woodGrain, rough: 0.76 }),
      woodShelf: std(0xbe9265, { map: woodGrain, rough: 0.73 }),
      woodMid: std(0xab825a, { map: woodGrain, rough: 0.7 }),
      metal: std(0x69503b, { rough: 0.37, metal: 0.73, env: 0.72 }),
      metalWarm: std(0xb38449, { rough: 0.3, metal: 0.8, env: 0.8 }),
      rock: std(0x8c8490, { map: rockGrain, bumpMap: rockGrain, bumpScale: 0.1, rough: 0.97, flat: true }),
      rockDark: std(0x696473, { map: rockGrain, bumpMap: rockGrain, bumpScale: 0.08, rough: 0.96, flat: true }),
      leaf: std(0xffffff, { map: T.leaf(), transparent: true, alphaTest: 0.42, side: THREE.DoubleSide, rough: 0.9 }),
      wisteria: std(0xb4a0d8, { map: T.wisteria(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, rough: 0.95, emissive: 0x4a3273, ei: 0.55 }),
      crystal: std(0x9b79c2, { emissive: 0x51316f, ei: 0.8, rough: 0.28, metal: 0.1, transparent: true, opacity: 0.86 }),
      gold: std(0xc9944a, { rough: 0.3, metal: 0.78, env: 0.8 })
    };

    var glass = glassMaterial(0xcfe2ff, 0.07);
    var glassCapFront = glassMaterial(0xcfe2ff, 0.07);

    /* ============================================================
     * 浮岛
     * ============================================================ */
    var island = new THREE.Group();
    root.add(island);

    (function buildIsland() {
      var profile = [];
      var N = 22;
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        var y = -3.2 + t * 3.08;
        var r = 3.35 * Math.pow(t, 0.5) * (0.94 + 0.14 * Math.sin(t * 9.5));
        profile.push(new THREE.Vector2(Math.max(0.05, r), y));
      }
      var geo = new THREE.LatheGeometry(profile, 42);
      var pos = geo.attributes.position;
      for (var k = 0; k < pos.count; k++) {
        var x = pos.getX(k), y2 = pos.getY(k), z = pos.getZ(k);
        var ang = Math.atan2(z, x);
        var noise = Math.sin(ang * 5.0 + y2 * 1.9) * 0.22 + Math.cos(ang * 9.0 - y2 * 2.4) * 0.14
                  + Math.sin(ang * 17.0 + y2 * 3.1) * 0.06;
        var len = Math.sqrt(x * x + z * z);
        if (len > 0.01) {
          var s = 1 + noise / Math.max(0.45, len);
          pos.setX(k, x * s);
          pos.setZ(k, z * s);
        }
        pos.setY(k, y2 + Math.sin(ang * 6.0 + y2 * 1.3) * 0.16);
      }
      geo.computeVertexNormals();
      var rock = new THREE.Mesh(geo, M.rock);
      rock.receiveShadow = true;
      rock.castShadow = true;
      island.add(rock);

      // Varied outcrops break the lathed silhouette and the rectangular deck edge.
      var crags = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.rock, 86);
      var transform = new THREE.Object3D(), cragCount = 0, cr = rnd(153);
      for (var ci = 0; ci < 86; ci++) {
        var theta = ci * 2.39996, height = ci < 38 ? -0.22 - cr() * 0.22 : -0.6 - cr() * 2.1;
        var radius = ci < 38 ? 3.1 : 3.15 * Math.sqrt((height + 3.25) / 3.25);
        var xx = Math.cos(theta) * radius, zz = Math.sin(theta) * radius * 0.87;
        if (ci < 38) {
          xx = Math.sign(Math.cos(theta)) * Math.sqrt(Math.abs(Math.cos(theta))) * 3.12;
          zz = Math.sign(Math.sin(theta)) * Math.sqrt(Math.abs(Math.sin(theta))) * 2.83;
        }
        if (zz > 2.0 && xx > 1.05 && xx < 2.2) continue;
        transform.position.set(xx, height, zz);
        transform.rotation.set(cr() * 3, cr() * 3, cr() * 3);
        transform.scale.set(0.2 + cr() * 0.38, 0.16 + cr() * 0.3, 0.21 + cr() * 0.35);
        transform.updateMatrix(); crags.setMatrixAt(cragCount++, transform.matrix);
      }
      crags.count = cragCount; crags.instanceMatrix.needsUpdate = true;
      crags.castShadow = crags.receiveShadow = true; crags.frustumCulled = false; island.add(crags);

      var r = rnd(31);
      var crystalAnim = [];
      for (var c = 0; c < 11; c++) {
        var a = (c / 11) * Math.PI * 2 + r() * 0.5;
        var rad = 1.0 + r() * 1.7;
        var h = 0.35 + r() * 0.55;
        var m = new THREE.Mesh(new THREE.ConeGeometry(0.16 + r() * 0.14, h, 5), M.crystal.clone());
        m.position.set(Math.cos(a) * rad, -2.2 - r() * 0.7, Math.sin(a) * rad);
        m.rotation.set(Math.PI + (r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5);
        island.add(m);
        crystalAnim.push({ mesh: m, phase: r() * 6.28, base: 0.45 + r() * 0.2 });
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T.glow(), color: 0xc75cff, transparent: true, opacity: 0.22,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sp.position.copy(m.position);
        sp.scale.setScalar(1.9 + r() * 1.2);
        island.add(sp);
      }

      var rocks = [];
      for (var q = 0; q < 7; q++) {
        var rr = 0.14 + r() * 0.32;
        var rk = new THREE.Mesh(new THREE.OctahedronGeometry(rr, 0), M.rockDark);
        rk.position.set((r() - 0.5) * 10, -1.8 + r() * 2.6, (r() - 0.5) * 8);
        rk.rotation.set(r() * 3, r() * 3, r() * 3);
        island.add(rk);
        rocks.push({ mesh: rk, base: rk.position.y, phase: r() * 6.28, spin: (r() - 0.5) * 0.2 });
      }

      island.userData.crystals = crystalAnim;
      island.userData.rocks = rocks;
    }());

    /* ============================================================
     * 露台
     * ============================================================ */
    (function buildDeck() {
      var deck = box(6.15, 0.18, 5.55, M.woodDeck, 0, -0.09, 0.05);
      deck.receiveShadow = true; root.add(deck);
      root.add(box(6.2, 0.12, 0.12, M.woodDark, 0, -0.02, 2.83));
      root.add(box(6.2, 0.12, 0.12, M.woodDark, 0, -0.02, -2.73));
      // A walkable stair continues from the front-right edge, with supported treads.
      for (var i = 0; i < 4; i++) {
        var z = 3.0 + i * 0.36, y = -0.09 - i * 0.22;
        var tread = box(0.94 - i * 0.055, 0.11, 0.38, M.wood, 1.68 + i * 0.07, y, z);
        tread.castShadow = tread.receiveShadow = true; root.add(tread);
        for (var j = 0; j < 3; j++) root.add(box(0.008, 0.003, 0.33, M.woodDark, 1.4 + j * 0.25 + i * 0.07, y + 0.058, z));
      }
      for (var side = -1; side <= 1; side += 2) {
        var beam = box(0.07, 0.09, 1.6, M.woodDark, 1.77 + side * 0.32, -0.51, 3.45);
        beam.rotation.x = 0.54; root.add(beam);
      }
    }());



    /* ============================================================
     * 玻璃花房
     * ============================================================ */
    var house = new THREE.Group();
    root.add(house);
    var botany = APP.createBotany(house);
    var dust = null;

    (function buildFrame() {
      // Upright walls below an elliptical roof. The front middle is an open doorway.
      function roofPoint(a, z) { return new V3(Math.cos(a) * R, EAVES + Math.sin(a) * RISE, z); }
      var ribs = 7;
      for (var i = 0; i < ribs; i++) {
        var z = Z0 + (Z1 - Z0) * i / (ribs - 1), pts = [];
        for (var j = 0; j <= 40; j++) pts.push(roofPoint(Math.PI * j / 40, z));
        var rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.035, 8, false), M.metal);
        rib.castShadow = true; house.add(rib);
        [-1, 1].forEach(function (side) {
          house.add(box(0.067, EAVES, 0.07, M.metal, side * R, EAVES / 2, z));
          house.add(box(0.12, 0.12, 0.12, M.metalWarm, side * R, 0.12, z));
        });
      }
      [0.16, 0.35, 0.5, 0.65, 0.84].forEach(function (f) {
        var p = roofPoint(Math.PI * f, (Z0 + Z1) / 2);
        house.add(box(0.035, 0.045, Z1 - Z0 + 0.08, M.metal, p.x, p.y, p.z));
      });
      [-1, 1].forEach(function (side) {
        [0.18, 0.76, EAVES].forEach(function (y) {
          house.add(box(0.07, 0.055, Z1 - Z0 + 0.1, M.metal, side * R, y, (Z0 + Z1) / 2));
        });
        var pane = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, EAVES), glass);
        pane.rotation.y = Math.PI / 2; pane.position.set(side * R, EAVES / 2, (Z0 + Z1) / 2);
        pane.renderOrder = 2; house.add(pane);
        house.add(box(0.11, 0.2, Z1 - Z0, M.woodMid, side * R, 0.1, (Z0 + Z1) / 2));
      });
      var roofGeo = archSurface(R, Z0, Z1, 7, 48), pos = roofGeo.attributes.position;
      for (var k = 0; k < pos.count; k++) pos.setY(k, EAVES + pos.getY(k) * RISE / R);
      roofGeo.computeVertexNormals();
      var roof = new THREE.Mesh(roofGeo, glass); roof.renderOrder = 2; house.add(roof);
      // Back timber panel anchors shelves, clock and storage; it is not a glass void.
      house.add(box(5.48, 2.15, 0.1, M.woodShelf, 0, 1.075, Z0 + 0.025));
      for (var n = 0; n < 17; n++) house.add(box(0.012, 2.08, 0.012, M.woodDark, -2.6 + n * 0.325, 1.08, Z0 + 0.082));
      var backGeo = archCap(R, Z0, 48), bp = backGeo.attributes.position;
      for (var b = 0; b < bp.count; b++) bp.setY(b, EAVES + bp.getY(b) * RISE / R);
      backGeo.computeVertexNormals();
      var backPane = new THREE.Mesh(backGeo, M.woodShelf); house.add(backPane);
      // Side returns frame the entrance without putting bars across the opening.
      [-2.1, 2.1].forEach(function (x) {
        house.add(box(0.06, 2.61, 0.07, M.metal, x, 1.305, Z1));
        var panel = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 2.05), glassCapFront);
        panel.position.set(x < 0 ? -2.44 : 2.44, 1.12, Z1); panel.renderOrder = 2; house.add(panel);
        house.add(box(0.68, 0.05, 0.065, M.metal, x < 0 ? -2.44 : 2.44, 1.05, Z1));
      });
      // Leave the glass vault open above the room; no suspended timber ceiling.
    }());

    /* Persian-style circular rug, on the open floor in front of the counter. */


    var rug = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), std(0xffffff, { map: T.rug(), rough: 0.96 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.12, 0.012, 1.05);
    rug.receiveShadow = true;
    house.add(rug);

    /* --- 后墙 + 书架 --- */
    var SH_X0 = -2.4, SH_X1 = -0.75, SH_Z = -2.3, SH_W = SH_X1 - SH_X0;
    (function buildShelf() {
      // 木质后墙，让书架不悬空
      var back = box(2.15, 2.4, 0.08, M.woodShelf, -1.58, 1.2, -2.32);
      back.receiveShadow = true;
      house.add(back);

      var g = new THREE.Group();
      var sideL = box(0.06, 2.12, 0.38, M.woodMid, SH_X0, 1.06, SH_Z);
      var sideR = box(0.06, 2.12, 0.38, M.woodMid, SH_X1, 1.06, SH_Z);
      [sideL, sideR].forEach(function (s) { s.castShadow = true; g.add(s); });
      g.add(box(SH_W, 2.12, 0.04, M.woodDark, (SH_X0 + SH_X1) / 2, 1.06, SH_Z - 0.17));

      [0.44, 1.0, 1.56].forEach(function (y) {
        var b = box(SH_W, 0.055, 0.38, M.woodMid, (SH_X0 + SH_X1) / 2, y, SH_Z);
        b.castShadow = true;
        b.receiveShadow = true;
        g.add(b);
      });

      var r = rnd(41);
      var cols = [0x5a2020, 0x1f2c4d, 0x1c3a2c, 0x5a421a, 0x321f3d, 0x5a2c14, 0x24312f, 0x6a2a35];
      var bookGeo = new THREE.BoxGeometry(1, 1, 1);
      var bookMat = std(0xffffff, { rough: 0.82 });
      var inst = new THREE.InstancedMesh(bookGeo, bookMat, 40);
      var dummy = new THREE.Object3D();
      var n = 0;
      [0.47, 1.03, 1.59].forEach(function (y) {
        var x = SH_X0 + 0.1;
        while (x < SH_X1 - 0.14 && n < 40) {
          var w = 0.055 + r() * 0.06;
          var h = 0.26 + r() * 0.14;
          dummy.position.set(x + w / 2, y + h / 2, SH_Z + (r() - 0.5) * 0.06);
          dummy.rotation.set(0, 0, (r() - 0.5) * 0.05);
          dummy.scale.set(w, h, 0.28 + r() * 0.04);
          dummy.updateMatrix();
          inst.setMatrixAt(n, dummy.matrix);
          inst.setColorAt(n, new THREE.Color(cols[Math.floor(r() * cols.length)]));
          n++;
          x += w + 0.01 + r() * 0.03;
        }
      });
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = true;
      g.add(inst);
      g.add(box(SH_W + 0.1, 0.1, 0.46, M.woodDark, (SH_X0 + SH_X1) / 2, 2.18, SH_Z));
      g.add(box(SH_W + 0.08, 0.12, 0.44, M.woodDark, (SH_X0 + SH_X1) / 2, 0.12, SH_Z));
      // Fine leather bands make the book spines readable up close.
      [0.57, 1.13, 1.69].forEach(function (y) {
        for (var k = 0; k < 11; k++) g.add(box(0.045, 0.008, 0.008, M.gold, SH_X0 + 0.17 + k * 0.16, y, SH_Z + 0.17));
      });
      house.add(g);
    }());

    /* --- 柜台 --- */
    (function buildCounter() {
      // A long counter across the back-right, with the service face toward the door.
      var body = box(2.25, 0.84, 0.86, M.woodShelf, 1.27, 0.42, -0.76);
      body.castShadow = body.receiveShadow = true; house.add(body);
      var top = new THREE.Mesh(APP.roundedBox(2.4, 0.09, 0.99, 0.026), M.wood);
      top.position.set(1.27, 0.895, -0.76); top.castShadow = top.receiveShadow = true; house.add(top);
      house.add(box(2.3, 0.09, 0.9, M.woodDark, 1.27, 0.08, -0.76));
      for (var i = 0; i < 3; i++) {
        var x = 0.56 + i * 0.71;
        house.add(box(0.59, 0.59, 0.035, M.woodDark, x, 0.46, -0.305));
        house.add(box(0.51, 0.51, 0.035, M.woodMid, x, 0.46, -0.28));
        house.add(box(0.46, 0.045, 0.025, M.woodShelf, x, 0.67, -0.253));
      }
    }());

    (function buildStool() {
      var g = new THREE.Group(); g.position.set(0.5, 0, 0.34);
      var seat = cyl(0.24, 0.225, 0.065, 36, M.wood, 0, 0.53, 0);
      seat.castShadow = seat.receiveShadow = true; g.add(seat);
      var pts = [new THREE.Vector2(0.02, 0), new THREE.Vector2(0.026, 0.05), new THREE.Vector2(0.018, 0.22), new THREE.Vector2(0.026, 0.4), new THREE.Vector2(0.021, 0.5)];
      for (var i = 0; i < 4; i++) {
        var a = i * Math.PI / 2 + Math.PI / 4;
        var leg = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), M.woodMid);
        leg.position.set(Math.cos(a) * 0.17, 0.015, Math.sin(a) * 0.17);
        leg.rotation.z = -Math.cos(a) * 0.12; leg.rotation.x = Math.sin(a) * 0.12;
        leg.castShadow = true; g.add(leg);
      }
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.015, 8, 32), M.woodDark);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.19; g.add(ring); house.add(g);
    }());



    /* --- 玻璃罩花 --- */
    (function buildCloche() {
      var g = new THREE.Group();
      g.position.set(2.08, 0.945, -0.69);
      g.add(cyl(0.22, 0.23, 0.042, 32, M.woodDark, 0, 0.021, 0));
      g.add(cyl(0.205, 0.22, 0.016, 32, M.metalWarm, 0, 0.048, 0));
      var domeGlass = glassMaterial(0xd4dcf2, 0.045);
      var dome = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.32, 32, 1, true), domeGlass);
      dome.position.y = 0.17;
      g.add(dome);
      var capS = new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeGlass);
      capS.position.y = 0.33;
      g.add(capS);
      var shapes = APP.createClocheShapes(g);
      g.userData.shapes = shapes;
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T.glow(), color: 0xff9ec6, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.position.y = 0.21;
      halo.scale.setScalar(0.8);
      g.add(halo);
      var pl = new THREE.PointLight(0xff9ec6, 0.9, 2.6, 2);
      pl.position.y = 0.22;
      g.add(pl);
      g.userData.halo = halo;
      house.add(g);
      house.userData.cloche = g;
    }());

    /* --- 吊灯（交互 01）--- */
    var lamp = (function buildLamp() {
      var g = new THREE.Group();
      g.position.set(-1.02, 2.36, 0.1);

      g.add(cyl(0.007, 0.007, 0.95, 6, M.metal, 0, 0.475, 0));

      var capTop = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.06, 14), M.metalWarm);
      capTop.position.y = 0.13;
      g.add(capTop);

      var shadeMat = std(0xffb877, { emissive: 0xff8a3a, ei: 1.5, transparent: true, opacity: 0.96, rough: 0.45 });
      var shade = new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 24), shadeMat);
      shade.position.y = -0.01;
      g.add(shade);
      // Brass ribs and collars turn a bare glowing ball into a crafted lantern.
      for (var r = 0; r < 8; r++) {
        var rib = new THREE.Mesh(new THREE.TorusGeometry(0.193, 0.004, 5, 36, Math.PI), M.metalWarm);
        rib.rotation.set(0, r * Math.PI / 4, Math.PI / 2); rib.position.y = -0.01; g.add(rib);
      }
      [-0.17, 0.15].forEach(function (y) { g.add(cyl(0.07, 0.07, 0.025, 20, M.metalWarm, 0, y, 0)); });

      var core = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 10), std(0xfff3da, { emissive: 0xffb45e, ei: 1.1 }));
      core.position.y = -0.01;
      g.add(core);

      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T.glow(), color: 0xffa85c, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.position.y = -0.01;
      halo.scale.setScalar(1.0);
      g.add(halo);

      var light = new THREE.PointLight(0xffa257, 1.25, 8, 1.9);
      light.position.y = -0.01;
      g.add(light);

      house.add(g);

      var hit = ghost(new THREE.SphereGeometry(0.44, 10, 8));
      hit.position.copy(g.position);
      hit.userData.chapter = 'lamp';
      house.add(hit);

      return { group: g, core: core, halo: halo, light: light, shadeMat: shadeMat, hit: hit, base: 1.25 };
    }());

    /* --- 星形吊灯 --- */
    (function buildStarPendant() {
      var g = new THREE.Group();
      g.position.set(0, 2.65, 0.35);
      g.add(cyl(0.006, 0.006, 0.835, 6, M.metal, 0, 0.4175, 0));
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.009, 8, 64), M.metalWarm);
      ring.rotation.x = 1.12;
      g.add(ring);
      var shape = new THREE.Shape();
      for (var i = 0; i < 10; i++) {
        var a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        var rr = i % 2 === 0 ? 0.12 : 0.05;
        if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      shape.closePath();
      var star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }),
        std(0xffe2b0, { emissive: 0xffab4a, ei: 2.2 }));
      star.position.y = -0.05;
      g.add(star);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T.glow(), color: 0xffc07a, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.scale.setScalar(1.0);
      halo.position.y = -0.05;
      g.add(halo);
      var pl = new THREE.PointLight(0xffb066, 0.7, 4.5, 2);
      pl.position.y = -0.05;
      g.add(pl);
      house.add(g);
      house.userData.starPendant = { group: g, core: star, halo: halo, sparks: APP.createStarSparks(g) };
    }());

    /* --- 壁灯 --- */
    (function buildWallLamp() {
      var g = new THREE.Group();
      g.position.set(2.72, 1.92, 1.47);
      g.add(box(0.09, 0.12, 0.09, M.metal, 0, 0, 0));
      var arm = cyl(0.014, 0.014, 0.24, 6, M.metal, -0.12, 0.05, 0);
      arm.rotation.z = Math.PI / 2.6;
      g.add(arm);
      g.add(cyl(0.065, 0.105, 0.11, 12, M.metalWarm, -0.22, 0.12, 0));
      var flame = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), std(0xfff0cf, { emissive: 0xffb95e, ei: 2.4 }));
      flame.position.set(-0.22, 0.19, 0);
      g.add(flame);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T.glow(), color: 0xffc27a, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.position.copy(flame.position);
      halo.scale.setScalar(0.75);
      g.add(halo);
      house.add(g);
      house.userData.wallFlame = flame;
    }());

    /* --- 花桶 --- */
    function vase(x, y, z, height, color) {
      var profile = [[0.09, 0], [0.12, 0.04], [0.17, 0.16], [0.18, 0.29], [0.13, 0.39], [0.085, 0.45], [0.095, 0.48]];
      var g = new THREE.Group(); g.position.set(x, y, z);
      var style = Math.abs(Math.round(x * 17 + z * 11)) % 5;
      var colors = [0xa86e43, 0x82704e, 0xe6d4bc, 0x8c958b, 0x70556e];
      var mat = std(colors[style], { metal: style < 2 ? (style ? 0.7 : 0.82) : 0,
        rough: [0.28, 0.45, 0.25, 0.36, 0.33][style], env: style < 2 ? 0.85 : 0.45 });
      mat.name = ['vase-copper', 'vase-bronze', 'vase-porcelain', 'vase-sage', 'vase-plum'][style];
      var body = new THREE.Mesh(new THREE.LatheGeometry(profile.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40), mat);
      body.castShadow = body.receiveShadow = true; g.add(body); g.scale.setScalar(height / 0.48);
      g.add(cyl(0.084, 0.084, 0.008, 24, mat, 0, 0.465, 0));
      house.add(g); return g;
    }
    (function buildBuckets() {
      [[-2.25, 1.5, 0.5, 'pink'], [-2.48, 0.1, 0.43, 'violet'], [-1.72, 2.25, 0.34, 'blue'],
       [-2.34, -1.3, 0.32, 'cream'], [2.42, 1.55, 0.43, 'pink']].forEach(function (p) {
        vase(p[0], 0, p[1], p[2]); botany.bouquet(p[0], p[2] * 0.9, p[1], p[2] * 1.25, p[3]);
      });
    }());



    /* --- 主角花（交互 03）--- */
    var flower = (function buildFlower() {
      var g = new THREE.Group();
      g.position.set(-1.85, 0, 1.45);

      var pot = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.13, 0), new THREE.Vector2(0.17, 0.04),
        new THREE.Vector2(0.21, 0.2), new THREE.Vector2(0.18, 0.29)
      ], 40), std(0xa86e43, { metal: 0.82, rough: 0.28, env: 0.85 }));
      pot.castShadow = true;
      g.add(pot);
      g.add(cyl(0.18, 0.18, 0.03, 16, M.woodDark, 0, 0.29, 0));

      g.add(cyl(0.018, 0.024, 1.0, 8, std(0x4a7a46, { rough: 0.9 }), 0, 0.78, 0));

      [0.6, 1.2].forEach(function (ang, i) {
        var leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), M.leaf);
        leaf.position.set(Math.cos(ang) * 0.18, 0.66 + i * 0.18, Math.sin(ang) * 0.18);
        leaf.rotation.set(-0.85 + i * 0.3, ang, 0.35);
        g.add(leaf);
      });

      var bloom = new THREE.Group();
      bloom.position.set(0, 1.32, 0);
      var petalMat = std(0xa98cf0, {
        emissive: 0x3d2a80, ei: 0.3, side: THREE.DoubleSide, rough: 0.72
      });
      var petals = [];
      var COUNT = 6;
      for (var i = 0; i < COUNT; i++) {
        var shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.1, 0.08, 0.13, 0.26, 0, 0.44);
        shape.bezierCurveTo(-0.13, 0.26, -0.1, 0.08, 0, 0);
        var geo = APP.petalGeometry(0.49, 0.13, 0.12);
        var petal = new THREE.Mesh(geo, petalMat);
        var pivot = new THREE.Object3D();
        pivot.rotation.y = (i / COUNT) * Math.PI * 2;
        pivot.add(petal);
        bloom.add(pivot);
        petals.push({ pivot: pivot, petal: petal });
      }
      var center = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), std(0xffe4a8, { emissive: 0xffb64a, ei: 1.6 }));
      center.position.y = 0.02;
      bloom.add(center);
      for (var s2 = 0; s2 < 12; s2++) {
        var a2 = (s2 / 12) * Math.PI * 2;
        var stamen = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), std(0xfff0c0, { emissive: 0xffcf72, ei: 2.2 }));
        stamen.position.set(Math.cos(a2) * 0.06, 0.05, Math.sin(a2) * 0.06);
        bloom.add(stamen);
      }
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T.glow(), color: 0xd9c2ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.scale.setScalar(1.2);
      bloom.add(halo);
      g.add(bloom);

      house.add(g);

      var hit = ghost(new THREE.SphereGeometry(0.48, 10, 8));
      hit.position.set(0, 1.34, 0);
      hit.userData.chapter = 'flower';
      g.add(hit);

      return { group: g, bloom: bloom, petals: petals, center: center, halo: halo, hit: hit };
    }());

    /* --- 交互书（交互 02）--- */
    var book = (function buildBook() {
      var g = new THREE.Group();
      var REST = { pos: new V3(-1.62, 1.03, -2.26), rot: new V3(0.06, 0.34, 0) };
      var ACTIVE = { pos: new V3(-0.65, 1.55, -0.6), rot: new V3(0.55, 0, 0) };
      g.position.copy(REST.pos);
      g.rotation.set(REST.rot.x, REST.rot.y, REST.rot.z);

      var coverMat = std(0x7a2f1e, { rough: 0.62, emissive: 0x2a0d06, ei: 0.6 });
      var back = box(0.5, 0.024, 0.66, coverMat, 0.25, 0, 0);
      g.add(back);
      var paper = std(0xf3e7ce, { rough: 0.95 });
      g.add(box(0.465, 0.026, 0.62, paper, 0.25, 0.026, 0));
      var rightPage = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.61),
        std(0xffffff, { map: T.page('body'), side: THREE.DoubleSide, rough: 0.94 }));
      rightPage.rotation.x = -Math.PI / 2; rightPage.position.set(0.25, 0.043, 0); g.add(rightPage);

      function makePage(texKind, y) {
        var pivot = new THREE.Object3D();
        pivot.position.set(0, y, 0);
        var m = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.62),
          std(0xffffff, { map: T.page(texKind), rough: 0.92, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(0.25, 0, 0);
        pivot.add(m);
        g.add(pivot);
        return pivot;
      }

      var page1 = makePage('title', 0.036);
      var page2 = makePage('body', 0.044);
      var page3 = makePage('body', 0.058);

      var front = new THREE.Object3D();
      front.position.set(0, 0.078, 0);
      front.add(box(0.5, 0.018, 0.66, coverMat, 0.25, 0, 0));
      var leftPage = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.61),
        std(0xffffff, { map: T.page('body'), side: THREE.DoubleSide, rough: 0.94 }));
      leftPage.rotation.x = Math.PI / 2; leftPage.position.set(0.25, -0.014, 0); front.add(leftPage);
      g.add(front);

      house.add(g);

      var hit = ghost(new THREE.BoxGeometry(0.66, 0.38, 0.84));
      hit.position.set(0.25, 0.05, 0);
      hit.userData.chapter = 'book';
      g.add(hit);

      return { group: g, rest: REST, active: ACTIVE, pages: [front, page1, page2, page3], hit: hit };
    }());

    /* --- 招牌 --- */
    (function buildSign() {
      var g = new THREE.Group();
      // 挂在拱侧，托架根部贴住拱框
      var anchorY = 2.32, anchorA = R * Math.sqrt(1 - Math.pow((anchorY + 0.06 - EAVES) / RISE, 2));
      g.position.set(anchorA, anchorY, Z1 - 0.75);
      g.rotation.y = -0.3;

      var arm = box(1.08, 0.045, 0.045, M.metal, 0.51, 0.06, 0);
      g.add(arm);
      g.add(box(0.09, 0.17, 0.1, M.metal, 0, 0.06, 0));
      var support = new THREE.CatmullRomCurve3([new V3(0, -0.16, 0), new V3(0.2, -0.06, 0), new V3(0.4, 0.06, 0)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(support, 12, 0.016, 8, false), M.metal));
      var brace = box(0.045, 0.045, 0.045, M.metal, 0.02, 0.02, 0);
      g.add(brace);
      var scroll = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 16, Math.PI * 1.4), M.metal);
      scroll.position.set(0.06, 0.02, 0);
      g.add(scroll);

      g.add(box(0.018, 0.22, 0.018, M.metal, 1.0, -0.045, 0));

      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.045, 32), M.woodDark);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(1.0, -0.32, 0);
      disc.castShadow = true;
      g.add(disc);

      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.02, 8, 36), M.gold);
      rim.position.set(1.0, -0.32, 0.026);
      g.add(rim);

      var emblem = new THREE.Group();
      emblem.position.set(1.0, -0.32, 0.032);
      emblem.add(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 6, 20), M.gold));
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2;
        var petal = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), M.gold);
        petal.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
        petal.scale.set(1.5, 0.75, 0.4);
        petal.rotation.z = a;
        emblem.add(petal);
      }
      g.add(emblem);

      house.add(g);
      house.userData.sign = g;
    }());

    /* ============================================================
     * 藤蔓 / 紫藤
     * ============================================================ */
    (function buildVines() {
      // A planted crown at the front left; strings descend from real support points.
      for (var i = 0; i < 20; i++) {
        var x = -2.4 + i * 0.16, a = Math.acos(x / R), y = EAVES + Math.sin(a) * RISE;
        botany.wisteria(x, y + 0.06, Z1 + 0.04, 0.32 + (i % 5) * 0.13);
        for (var j = 0; j < 3; j++) botany.leaf(new V3(x, y + 0.09, Z1 - j * 0.12), 0.21, i * 1.8 + j);
      }
      for (var w = 0; w < 22; w++) {
        var wx = -1.75 + w % 7 * 0.23, wz = Z1 - Math.floor(w / 7) * 0.23;
        var wy = EAVES + Math.sqrt(1 - wx * wx / (R * R)) * RISE;
        botany.wisteria(wx, wy + 0.06, wz, 0.55 + w % 5 * 0.14);
        for (var l = 0; l < 4; l++) botany.leaf(new V3(wx + (l - 1.5) * 0.08, wy + 0.11, wz), 0.25, w * 1.7 + l);
      }
      [-1, 1].forEach(function (side) {
        // Loose garlands grow along the wall rails; keep the aisle and faces clear.
        for (var spray = 0; spray < 14; spray++) {
          var sz = -2.1 + spray * 0.28, sx = side * (2.43 + Math.sin(spray * 1.7) * 0.1);
          var sy = 0.65 + Math.sin(spray * 0.8) * 0.14;
          var start = new V3(sx, sy, sz), end = new V3(sx - side * 0.15, sy + 0.25, sz + 0.19);
          botany.stem(start, end, 0.007);
          for (var frond = 0; frond < 6; frond++) {
            var fp = start.clone().lerp(end, frond / 6);
            fp.x += (frond % 2 ? 1 : -1) * 0.07;
            botany.leaf(fp, 0.17 + frond % 3 * 0.025, spray * 2.4 + frond);
          }
          if (spray % 2 === 0) botany.cluster(end, 0.105, spray % 3 ? 'pink' : 'cream', 12);
        }
        for (var k = 0; k < 9; k++) {
          var z = Z0 + 0.25 + k * 0.48;
          botany.wisteria(side * (R + 0.02), EAVES + 0.09, z, 0.3 + (k % 3) * 0.2);
          botany.leaf(new V3(side * R, EAVES + 0.17, z), 0.23, side * Math.PI / 2);
        }
        for (var n = 0; n < 8; n++) {
          botany.wisteria(side * (2.8 + (n % 2) * 0.15), 0.16, -2.0 + n * 0.6, 0.42 + n % 3 * 0.15);
        }
      });
    }());

    /* Small working objects, with the central walkway kept clear. */


    (function buildDetails() {
      var r = rnd(131);

      var dummy = new THREE.Object3D();

      /* --- 串灯：三串小暖灯挂在梁下 --- */
      var beadGeo = new THREE.SphereGeometry(0.015, 8, 6);
      var beadMat = std(0xfff0cf, { emissive: 0xffb35c, ei: 1.3 });
      function stringLights(a, b, sag, n) {
        var beads = new THREE.InstancedMesh(beadGeo, beadMat, n);
        var d = new THREE.Object3D();
        var pts = [];
        for (var k = 0; k < n; k++) {
          var t = k / (n - 1);
          var x = a.x + (b.x - a.x) * t;
          var y = a.y + (b.y - a.y) * t - sag * Math.sin(Math.PI * t);
          var z = a.z + (b.z - a.z) * t;
          pts.push(new THREE.Vector3(x, y, z));
          d.position.set(x, y, z);
          d.updateMatrix();
          beads.setMatrixAt(k, d.matrix);
        }
        beads.instanceMatrix.needsUpdate = true;
        house.add(beads);
        var curve = new THREE.CatmullRomCurve3(pts);
        var wire = new THREE.Mesh(new THREE.TubeGeometry(curve, n * 3, 0.005, 4, false), M.metal);
        house.add(wire);
        var s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T.glow(), color: 0xffb870, transparent: true, opacity: 0.35,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        s.position.copy(pts[Math.floor(n / 2)]);
        s.scale.setScalar(0.7);
        house.add(s);
      }
      stringLights(new THREE.Vector3(-2.7, 2.5, -1.9), new THREE.Vector3(0.4, 2.62, -2.2), 0.32, 11);
      stringLights(new THREE.Vector3(0.5, 2.62, -2.2), new THREE.Vector3(2.5, 2.1, -1.0), 0.3, 10);
      stringLights(new THREE.Vector3(-2.5, 2.2, 0.9), new THREE.Vector3(-0.4, 2.55, 0.2), 0.26, 9);
      // A warm strip follows the rear vault, with its ends fixed to the frame.
      var stripPoints = [];
      for (var strip = 0; strip <= 48; strip++) {
        var stripAngle = 0.26 + strip / 48 * (Math.PI - 0.52);
        stripPoints.push(new V3(Math.cos(stripAngle) * (R - 0.025), EAVES + Math.sin(stripAngle) * RISE - 0.025, Z0 + 0.1));
      }
      var stripMaterial = std(0xffdcac, {emissive:0xffa44e, ei:1.7, rough:0.55});
      var lightStrip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripPoints), 72, 0.008, 6, false), stripMaterial);
      lightStrip.name = 'rear-warm-light-strip'; house.add(lightStrip);

      // Keep broad additive sprites out of the working area: real lights do the shading.

      /* --- 书架上：玻璃罐、成摞的盆 --- */
      var jarGlass = std(0xd8ecff, { transparent: true, opacity: 0.26, rough: 0.18, metal: 0.1, side: THREE.DoubleSide });
      [[0.62, -1.05], [0.85, -2.05], [1.27, -0.95], [1.92, -1.9], [1.28, -2.1]].forEach(function (p, i) {
        var g = new THREE.Group();
        g.position.set(p[1], p[0] + 0.03, -2.22);
        var h = 0.14 + (i % 3) * 0.05;
        var jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 12), jarGlass);
        jar.position.y = h / 2;
        g.add(jar);
        var lid = cyl(0.058, 0.058, 0.018, 12, M.woodDark, 0, h + 0.008, 0);
        g.add(lid);
        var inner = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6),
          std(0xffd9a0, { emissive: 0xff9c4a, ei: 0.9 }));
        inner.position.y = h * 0.45;
        g.add(inner);
        house.add(g);
      });

      // 摞起来的小花盆（放在地面，别飘在书架中间）
      [[-0.75, 0.06, 1.15], [-0.7, 0.07, 1.0], [-0.66, 0.06, 0.88]].forEach(function (p, i) {
        var pot = cyl(0.13, 0.1, 0.12, 12, M.woodMid, p[0], p[1] + i * 0.11, -2.05);
        house.add(pot);
      });

      /* --- 柜台上：书堆、花瓶、蜡烛 --- */
      var stack = new THREE.Group();
      stack.position.set(1.1, 0.95, -0.78);
      [[0.34, 0.05, 0.26, 0x5a2a1e], [0.31, 0.045, 0.24, 0x22384f], [0.28, 0.04, 0.22, 0x5c4a1c]].forEach(function (b, i) {
        var bk = box(b[0], b[1], b[2], std(b[3], { rough: 0.75 }), 0.02 * i, 0.02 + i * 0.048, 0);
        bk.rotation.y = 0.12 * i;
        stack.add(bk);
      });
      house.add(stack);

      [[0.5, -0.82, 'pink'], [1.55, -0.97, 'violet']].forEach(function (v) {
        vase(v[0], 0.95, v[1], 0.2, 0x987950);
        botany.bouquet(v[0], 1.13, v[1], 0.36, v[2]);
      });



      // A rear workbench and stocked shelves break up the blank timber wall.
      house.add(box(2.25, 0.78, 0.4, M.woodMid, 1.24, 0.39, -2.06));
      house.add(box(2.35, 0.055, 0.49, M.woodDark, 1.24, 0.82, -2.06));
      [1.42, 1.93].forEach(function (y) {
        house.add(box(1.87, 0.055, 0.3, M.woodDark, 1.34, y, -2.08));
        [0.58, 2.08].forEach(function (x) {
          house.add(box(0.025, 0.16, 0.14, M.metalWarm, x, y - 0.09, -2.12));
        });
        for (var j = 0; j < 6; j++) {
          var bx = 0.57 + j * 0.24, bh = 0.1 + j % 3 * 0.045;
          var bottle = new THREE.Mesh(new THREE.LatheGeometry([
            new THREE.Vector2(0.035, 0), new THREE.Vector2(0.047, 0.02),
            new THREE.Vector2(0.047, bh * 0.72), new THREE.Vector2(0.022, bh * 0.84),
            new THREE.Vector2(0.022, bh)
          ], 16), j % 2 ? M.metalWarm : jarGlass);
          bottle.position.set(bx, y + 0.03, -2.04); house.add(bottle);
          house.add(cyl(0.025, 0.025, 0.016, 12, M.woodDark, bx, y + bh + 0.04, -2.04));
        }
      });
      vase(2.03, 0.85, -2.0, 0.2, 0x8c714d);
      botany.bouquet(2.03, 1.02, -2.0, 0.31, 'cream');

      var candle = new THREE.Group();
      candle.position.set(1.65, 0.95, -0.47);
      candle.add(cyl(0.045, 0.045, 0.16, 10, std(0xf2e4c8, { rough: 0.9 }), 0, 0.08, 0));
      var flame = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6),
        std(0xffe9b8, { emissive: 0xff9a3c, ei: 3.2 }));
      flame.position.y = 0.18;
      flame.scale.y = 1.7;
      candle.add(flame);
      var cLight = new THREE.PointLight(0xff9a44, 0.55, 2.2, 2);
      cLight.position.y = 0.2;
      candle.add(cLight);
      house.add(candle);
      house.userData.candleFlame = flame;
      house.userData.candleLight = cLight;

      /* --- 岩体：苔藓与嵌进去的碎石 --- */
      for (var m = 0; m < 5; m++) {
        var ma = (m / 5) * Math.PI * 2 + r() * 0.6;
        var mr = 2.55 + r() * 0.35;
        var moss = new THREE.Mesh(new THREE.SphereGeometry(0.12 + r() * 0.1, 7, 5),
          std(0x24361f, { rough: 0.96, flat: true }));
        moss.position.set(Math.cos(ma) * mr, -0.3 - r() * 0.2, Math.sin(ma) * mr * 0.85);
        moss.scale.set(1.5, 0.4, 1.2);
        island.add(moss);
      }
      for (var b2 = 0; b2 < 4; b2++) {
        var ba = r() * Math.PI * 2;
        var rock = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + r() * 0.3, 0), M.rockDark);
        rock.position.set(Math.cos(ba) * (2.7 + r() * 0.4), -0.35 - r() * 0.3, Math.sin(ba) * (2.4 + r() * 0.4));
        rock.rotation.set(r() * 3, r() * 3, r() * 3);
        island.add(rock);
      }

      /* --- 室内浮尘 --- */
      var N = 80;
      var dustPos = new Float32Array(N * 3);
      var dustSeed = [];
      for (var d2 = 0; d2 < N; d2++) {
        dustPos[d2 * 3] = (r() - 0.5) * 5.4;
        dustPos[d2 * 3 + 1] = 0.2 + r() * 2.5;
        dustPos[d2 * 3 + 2] = (r() - 0.5) * 5.0;
        dustSeed.push({ phase: r() * 6.28, speed: 0.1 + r() * 0.25, amp: 0.05 + r() * 0.12 });
      }
      var dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
        map: T.dot(), color: 0xffd9a8, size: 0.035, sizeAttenuation: true,
        transparent: true, opacity: 0.55, depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      dust.userData.seeds = dustSeed;
      dust.name = 'wandering-fireflies';
      dust.userData.base = dustPos.slice();
      house.add(dust);
    }());


    /* ============================================================
     * 引导光点：在可点物件旁悬一颗暖色小灯，代替文字标签
     * ============================================================ */
    var guides = [];
    (function buildGuides() {
      var defs = [
        { id: 'lamp', p: new V3(-1.02, 2.36, 0.1) },
        { id: 'flower', p: new V3(-1.85, 1.56, 1.45) }
      ];
      defs.forEach(function (d, i) {
        var g = new THREE.Group();
        g.position.copy(d.p);

        var core = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8),
          std(0xffcf94, { emissive: 0xff8a2e, ei: 2.0 }));
        g.add(core);

        var halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T.glow(), color: 0xff9a45, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        halo.scale.setScalar(0.4);
        g.add(halo);

        var wide = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T.glow(), color: 0xff7a2e, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        wide.scale.setScalar(0.95);
        g.add(wide);

        house.add(g);
        guides.push({ id: d.id, group: g, core: core, halo: halo, wide: wide, base: d.p.clone(), phase: i * 2.0 });
      });
    }());


      // Front groups have different heights; nothing is planted down the center aisle.
      [[-2.85, 2.4, 0.32, 'violet'], [2.65, 2.3, 0.37, 'pink']].forEach(function (p) {
        vase(p[0], 0, p[1], p[2]); botany.bouquet(p[0], p[2] * 0.9, p[1], 0.43, p[3]);
      });



    /* ============================================================
     * 星空
     * ============================================================ */
    var sky = APP.createSky(scene);

    /* ============================================================
     * 光照
     * ============================================================ */
    scene.add(new THREE.HemisphereLight(0x7587bd, 0x322218, 0.36));

    var moon = new THREE.DirectionalLight(0xa9b9ed, 0.72);
    moon.position.set(-10, 14, 8);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 44;
    moon.shadow.camera.left = -9;
    moon.shadow.camera.right = 9;
    moon.shadow.camera.top = 9;
    moon.shadow.camera.bottom = -9;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.035;
    scene.add(moon);

    // 室内的暖色基调（补充吊灯之外的整体氛围）
    var warmFill = new THREE.PointLight(0xffb269, 1.45, 9, 2);
    warmFill.position.set(-0.6, 2.55, 0.2);
    scene.add(warmFill);

    // 书架与柜台各补一处暖光，室内从外面看才有光斑层次
    var shelfGlow = new THREE.PointLight(0xffb672, 1.2, 4.5, 2);
    shelfGlow.position.set(-1.5, 1.7, -1.9);
    scene.add(shelfGlow);

    var counterGlow = new THREE.PointLight(0xffb070, 0.95, 4.5, 2);
    counterGlow.position.set(1.5, 1.25, 0.2);
    scene.add(counterGlow);

    // 地面暖反弹，让木地板有一层横向的光
    var floorBounce = new THREE.PointLight(0xff8f4a, 0.45, 5.5, 2);
    floorBounce.position.set(0.2, 0.35, 1.0);
    scene.add(floorBounce);

    // 行星方向来的冷轮廓光，给右侧勾一道边
    var rim = new THREE.DirectionalLight(0x839cde, 0.6);
    rim.position.set(14, 5, -10);
    scene.add(rim);
    var stoneBounce = new THREE.DirectionalLight(0x8e7fba, 0.65);
    stoneBounce.position.set(-7, -3, 8); scene.add(stoneBounce);

    root.rotation.y = -0.14;   // 收窄视角：正面更朝向页面（合计约 25 度）

    /* ============================================================
     * API
     * ============================================================ */
    var api = {
      cameraNavigation: { space: house, entranceZ: Z1, clearance: 0.7, openingHalfWidth: 1.72 },
      sky: sky,
      root: root,
      house: house,
      lamp: lamp,
      book: book,
      flower: flower,
      frontGlass: glassCapFront,
      anchors: {
        lamp: new V3(-1.02, 2.36, 0.1),
        book: new V3(-1.4, 1.12, -2.25),
        flower: new V3(-1.85, 1.35, 1.45)
      },
      hits: [lamp.hit, book.hit, flower.hit],
      guides: guides,
      guideStrength: 0,
      hoverId: null,
      update: function (dt, t) {
        house.rotation.z = Math.sin(t * 0.45) * 0.004;

        var cr = island.userData.crystals || [];
        for (var i = 0; i < cr.length; i++) {
          var c = cr[i];
          c.mesh.material.emissiveIntensity = c.base * (0.7 + 0.5 * Math.sin(t * 1.6 + c.phase));
        }

        var rk = island.userData.rocks || [];
        for (var j = 0; j < rk.length; j++) {
          rk[j].mesh.position.y = rk[j].base + Math.sin(t * 0.7 + rk[j].phase) * 0.12;
          rk[j].mesh.rotation.y += rk[j].spin * dt;
        }

        if (lamp.light) lamp.light.intensity = lamp.base * (0.93 + 0.07 * Math.sin(t * 3.1));
        if (house.userData.cloche) {
          house.userData.cloche.userData.halo.material.opacity = 0.45 + 0.2 * Math.sin(t * 2.4);
        }
        if (house.userData.wallFlame) {
          house.userData.wallFlame.material.emissiveIntensity = 2.2 + 0.5 * Math.sin(t * 6.1);
        }

        if (dust) {
          var dp = dust.geometry.attributes.position;
          var seeds = dust.userData.seeds;
          var baseDust = dust.userData.base;
          for (var q = 0; q < seeds.length; q++) {
            var s = seeds[q], u = t * s.speed, phase = s.phase;
            dp.array[q * 3] = baseDust[q * 3] + s.amp * (Math.sin(u + phase) + 0.45 * Math.sin(u * 1.73 + phase * 2));
            dp.array[q * 3 + 1] = baseDust[q * 3 + 1] + s.amp * (Math.sin(u * 1.21 + phase * 1.7) + 0.3 * Math.cos(u * 2.1 + phase));
            dp.array[q * 3 + 2] = baseDust[q * 3 + 2] + s.amp * (Math.cos(u * 0.83 + phase) + 0.4 * Math.sin(u * 1.43 + phase * 3));
          }
          dp.needsUpdate = true;
        }
        if (house.userData.candleFlame) {
          var flame = house.userData.candleFlame;
          var flicker = Math.sin(t * 8.3) * 0.5 + Math.sin(t * 13.7 + 0.8) * 0.3;
          flame.rotation.z = Math.sin(t * 3.1) * 0.12 + Math.sin(t * 6.7) * 0.045;
          flame.rotation.x = Math.sin(t * 4.3 + 0.7) * 0.07;
          flame.scale.set(0.92 + flicker * 0.07, 1.7 + flicker * 0.18, 0.92 + flicker * 0.05);
          flame.position.x = Math.sin(t * 3.1) * 0.003;
          flame.material.emissiveIntensity = 3.0 + flicker * 0.55;
          house.userData.candleLight.intensity = 0.55 + flicker * 0.06;
        }
        // 引导光点：轻微呼吸 + 悬停变亮
        for (var gi = 0; gi < guides.length; gi++) {
          var gd = guides[gi];
          var near = api.hoverId === 'chapter:' + gd.id ? 1.5 : 1;
          var pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + gd.phase);
          var k2 = Math.max(api.guideStrength, api.hoverId === 'chapter:' + gd.id ? 1 : 0);
          gd.halo.material.opacity = k2 * (0.44 + 0.24 * pulse) * near;
          gd.wide.material.opacity = k2 * (0.15 + 0.09 * pulse) * near;
          gd.halo.scale.setScalar((0.42 + 0.1 * pulse) * (near > 1 ? 1.15 : 1));
          gd.wide.scale.setScalar(0.95 + 0.25 * pulse);
          gd.core.material.emissiveIntensity = (2.4 + 1.6 * pulse) * (near > 1 ? 1.3 : 1);
          gd.core.scale.setScalar(0.85 + 0.3 * pulse);
          gd.group.position.y = gd.base.y + Math.sin(t * 1.05 + gd.phase) * 0.028;
          gd.group.visible = k2 > 0.01;
        }

        // 花园：蝴蝶扇翅、绿植轻摆、钟摆、水面
        if (api.props) {
          var pr = api.props;
          for (var bi = 0; bi < pr.butterflies.length; bi++) {
            var bf = pr.butterflies[bi];
            var flightTime = t * (0.36 + bi * 0.047), phase = bf.phase;
            var flap = Math.sin(t * bf.speed * 2.2 + phase + Math.sin(t * 0.9 + phase) * 0.45);
            bf.left.rotation.y = -flap * 1.15;
            bf.right.rotation.y = flap * 1.15;
            bf.group.position.set(
              bf.base.x + Math.sin(flightTime + phase) * 0.48 + Math.sin(flightTime * 2.17 + phase) * 0.12,
              bf.base.y + Math.sin(flightTime * 1.37 + phase) * 0.24 + Math.sin(t * 2.1 + phase) * 0.025 + (bf.lift || 0),
              bf.base.z + Math.cos(flightTime * 0.91 + phase) * 0.44 + Math.sin(flightTime * 1.83) * 0.1);
            var vx = Math.cos(flightTime + phase) * 0.48 + 2.17 * Math.cos(flightTime * 2.17 + phase) * 0.12;
            var vz = -0.91 * Math.sin(flightTime * 0.91 + phase) * 0.44 + 1.83 * Math.cos(flightTime * 1.83) * 0.1;
            bf.group.rotation.set(0.12 * Math.sin(flightTime + phase), Math.atan2(vx, vz), 0.16 * Math.sin(flightTime * 1.4 + phase));
            if (api.props2 && api.props2.butterflyTargets) api.props2.butterflyTargets[bi].position.copy(bf.group.position);
          }
          for (var pi = 0; pi < pr.plants.length; pi++) {
            var pl = pr.plants[pi];
            pl.group.rotation.z = pl.base + Math.sin(t * 1.1 + pl.phase) * 0.022;
          }
          if (pr.clock) {
            pr.clock.pendulum.rotation.z = Math.sin(t * 2.1) * 0.3;
            var clockAngles = APP.beijingClockAngles();
            pr.clock.hour.rotation.z = clockAngles.hour;
            pr.clock.minute.rotation.z = clockAngles.minute;
            pr.clock.second.rotation.z = clockAngles.second;
          }
          if (pr.water) {
            pr.water.material.opacity = 0.56 + 0.08 * Math.sin(t * 1.4);
          }
        }

        if (api.props2 && api.props2.fireflyJar) {
          api.props2.fireflyJar.flies.forEach(function (fly) {
            var u = t * fly.sp;
            fly.mesh.position.set(fly.base.x + Math.sin(u + fly.phase) * 0.008,
              fly.base.y + Math.sin(u * 1.37 + fly.phase) * 0.009,
              fly.base.z + Math.cos(u * 0.83 + fly.phase) * 0.008);
            fly.mesh.material.emissiveIntensity = 2.4 + Math.sin(u * 1.6 + fly.phase) * 0.8;
          });
        }
        if (api.props2 && api.props2.girl) api.props2.girl.updateIdle(dt, t);
        if (api.props2 && api.props2.nook) api.props2.nook.body.scale.y = 0.12 * (1 + Math.sin(t * 1.45) * 0.025);
        sky.update(dt, t);
      }
    };


    /* ============================================================
     * 外部 glb 模型：加载完成后由 main 调用这里摆放
     * ============================================================ */
    var modelCount = 0;
    function placeModel(proto, x, y, z, targetH, rotY) {
      var m = proto.clone(true);
      m.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(m);
      var h = Math.max(0.001, box.max.y - box.min.y);
      var k = targetH / h;
      m.scale.setScalar(k);
      m.updateMatrixWorld(true);
      var b2 = new THREE.Box3().setFromObject(m);
      m.position.set(x, y - b2.min.y, z);
      m.rotation.y = rotY;
      m.traverse(function (o) {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = false;
          if (o.material) {
            o.material.side = THREE.DoubleSide;
            if (o.material.map) {
              o.material.map.anisotropy = 4;
              // 暗场景里给模型一点自发光，颜色仍然来自它自己的贴图
              o.material.emissiveMap = o.material.map;
              o.material.emissive = new THREE.Color(0x6a6a6a);
              o.material.emissiveIntensity = 0.55;
            }
            if (o.material.transparent) o.material.alphaTest = 0.35;
            if (o.material.roughness !== undefined) o.material.roughness = Math.max(0.6, o.material.roughness);
          }
        }
      });
      house.add(m);
      modelCount++;
      return m;
    }

    api.addModels = function (models) {
      if (!models) return;
      api.modelCount = modelCount;
      api.props = buildGarden(models);
      api.props2 = buildProps2(models, api.props);
      botany.finish();
      var animated = [lamp.group, book.group, flower.group];
      animated.push(house.userData.candleFlame);
      api.props.butterflies.forEach(function (b) { animated.push(b.group); });
      api.props.plants.forEach(function (p) { animated.push(p.group); });
      if (api.props.clock) animated.push(api.props.clock.group);
      Object.keys(api.props2).forEach(function (key) {
        if (api.props2[key] && api.props2[key].group) animated.push(api.props2[key].group);
      });
      APP.batchStatic(house, animated);
      api.modelCount = modelCount;
    };


    /* ============================================================
     * 花园：模型（Kenney Nature Kit, CC0）摆放 + 池塘雕塑 + 钟 + 蝴蝶
     * 所有可交互部件都挂在 api.props 上，方便之后加点击行为
     * ============================================================ */
    function buildGarden(models) {
      var P = models || {};
      var rr = rnd(307);
      var props = { butterflies: [], plants: [], flowers: [], fountain: null, clock: null, water: null };

      // Smooth pottery and curved foliage replace the faceted kit plants.
      [[-2.48, -1.45, 0.26], [-2.62, 0.35, 0.33], [2.57, -1.75, 0.25], [2.6, 1.25, 0.3]].forEach(function (p, i) {
        vase(p[0], 0, p[1], p[2], i % 2 ? 0x7b7774 : 0x9e7861);
        var plant = new THREE.Group(); plant.position.set(p[0], p[2] * 0.92, p[1]); house.add(plant);
        for (var j = 0; j < 9; j++) {
          var leaf = new THREE.Mesh(APP.petalGeometry(0.32 + j % 3 * 0.08, 0.08, 0.07), std(0x647447, { side: THREE.DoubleSide, rough: 0.8 }));
          leaf.rotation.set(0.35 + j % 3 * 0.17, j * 2.4, j % 2 ? 0.25 : -0.25); plant.add(leaf);
        }
        props.plants.push({ group: plant, base: 0, phase: rr() * 6.28 });
      });
      vase(-2.32, 0, -0.55, 0.3);
      botany.bouquet(-2.32, 0.27, -0.55, 0.48, 'cream');
      for (var n = 0; n < 14; n++) {
        var side = n < 8 ? -1 : 1, z = -2.15 + (n % 8) * 0.6;
        botany.bouquet(side * (2.95 + (n % 2) * 0.06), 0.02, z, 0.23 + n % 3 * 0.06, n % 4 ? 'violet' : 'pink');
      }



      /* --- 挂钟：表盘 + 指针 + 钟摆 --- */
      var clock = new THREE.Group();
      clock.position.set(0.0, 2.16, -2.24);
      var caseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 28), M.woodMid);
      caseDisc.rotation.x = Math.PI / 2;
      clock.add(caseDisc);
      var rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.026, 8, 30), M.gold);
      rim2.position.z = 0.02;
      clock.add(rim2);
      var face = new THREE.Mesh(new THREE.CircleGeometry(0.245, 32),
        std(0xffffff, { map: T.clockFace(), rough: 0.9 }));
      face.position.z = 0.038;
      clock.add(face);

      var hourHand = box(0.014, 0.14, 0.006, M.metal, 0, 0.06, 0.05);
      var hourPivot = new THREE.Object3D();
      hourPivot.position.set(0, 0, 0.045);
      hourPivot.add(hourHand);
      hourPivot.rotation.z = -0.9;
      clock.add(hourPivot);

      var minHand = box(0.011, 0.2, 0.006, M.metal, 0, 0.09, 0.055);
      var minPivot = new THREE.Object3D();
      minPivot.position.set(0, 0, 0.05);
      minPivot.add(minHand);
      minPivot.rotation.z = 2.1;
      clock.add(minPivot);
      var secondPivot = new THREE.Object3D(); secondPivot.position.z = 0.06;
      secondPivot.add(box(0.005, 0.22, 0.005, std(0x9e493d, {rough:0.5}), 0, 0.08, 0.055));
      clock.add(secondPivot);
      var initialTime = APP.beijingClockAngles();
      hourPivot.rotation.z = initialTime.hour; minPivot.rotation.z = initialTime.minute; secondPivot.rotation.z = initialTime.second;

      // 钟摆
      var pendPivot = new THREE.Object3D();
      pendPivot.position.set(0, -0.26, 0);
      var rod = cyl(0.007, 0.007, 0.34, 6, M.gold, 0, -0.17, 0);
      pendPivot.add(rod);
      var bob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.gold);
      bob.scale.z = 0.45;
      bob.position.y = -0.36;
      pendPivot.add(bob);
      clock.add(pendPivot);

      house.add(clock);
      props.clock = { group: clock, hour: hourPivot, minute: minPivot, second: secondPivot, pendulum: pendPivot };

      /* --- 蝴蝶 --- */
      var wingKinds = ['violet', 'amber', 'blue', 'violet'];
      var wingMatCache = {};
      for (var b2 = 0; b2 < 4; b2++) {
        var kind = wingKinds[b2];
        if (!wingMatCache[kind]) {
          wingMatCache[kind] = std(0xffffff, {
            map: T.wing(kind), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, rough: 0.8, ei: 0.35, emissive: 0x33204a
          });
        }
        var bf = new THREE.Group();
        var bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), std(0x2a2030, { rough: 0.8 }));
        bodyMesh.scale.set(0.6, 1.7, 0.6);
        bf.add(bodyMesh);
        var wl = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.09), wingMatCache[kind]);
        wl.position.x = 0.055;
        var pivotL = new THREE.Object3D();
        pivotL.add(wl);
        bf.add(pivotL);
        var wr = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.09), wingMatCache[kind]);
        wr.position.x = -0.055;
        wr.scale.x = -1;
        var pivotR = new THREE.Object3D();
        pivotR.add(wr);
        bf.add(pivotR);

        var base = new THREE.Vector3(-1.6 + b2 * 0.68, 1.25 + (b2 % 2) * 0.35, -0.2 + (b2 % 3) * 0.42);
        bf.position.copy(base);
        bf.rotation.y = rr() * 6.28;
        house.add(bf);
        props.butterflies.push({
          group: bf, left: pivotL, right: pivotR, base: base,
          phase: rr() * 6.28, speed: 6.5 + rr() * 3
        });
      }


      // Edge foliage hugs the rim instead of floating across the aisle.
      for (var f = 0; f < 28; f++) {
        var angle = f / 28 * Math.PI * 2;
        botany.leaf(new V3(Math.cos(angle) * 3.0, -0.08 - f % 4 * 0.08, Math.sin(angle) * 2.65), 0.22, -angle);
      }
      botany.finish();


      return props;
    }


    /* ============================================================
     * 第二批道具：鸟笼 / 留声机 / 洒水壶 / 风铃 / 菌灯 / 干花 / 萤火罐 / 花架
     * 全部多段落建模，黄铜、马口铁、玻璃分开给材质
     * ============================================================ */
    function buildProps2(models, garden) {
      var G = garden || {};
      var P = models || {};
      var r = rnd(733);
      var out = {};

      var brass = std(0xc08a3e, { rough: 0.26, metal: 0.95 });
      var brassDark = std(0x8a5f28, { rough: 0.34, metal: 0.9 });
      var tin = std(0xb9c3cc, { rough: 0.34, metal: 0.8 });
      var woodPolish = std(0x6f4523, { rough: 0.5 });
      var woodDeep = std(0x4a2d16, { rough: 0.62 });

      /* ---------- 1. 铜丝鸟笼 ---------- */
      (function birdcage() {
        var g = new THREE.Group();
        g.position.set(1.4, 2.35, -0.1);

        var suspension = EAVES + Math.sqrt(1 - 1.4 * 1.4 / (R * R)) * RISE - 2.35;
        g.add(cyl(0.006, 0.006, suspension - 0.34, 6, brass, 0, (suspension + 0.34) / 2, 0));
        var hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 5, 12, Math.PI * 1.5), brass);
        hook.position.y = suspension - 0.02;
        hook.rotation.y = Math.PI / 2;
        g.add(hook);

        var cage = new THREE.Group();
        cage.position.y = 0.06;
        cage.scale.setScalar(1.32);
        g.add(cage);

        var R2 = 0.155;
        var dome = new THREE.Mesh(
          new THREE.SphereGeometry(R2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass);
        dome.position.y = 0.13;
        dome.scale.y = 0.62;
        cage.add(dome);

        for (var i = 0; i < 10; i++) {
          var a = (i / 10) * Math.PI * 2;
          var bar = cyl(0.005, 0.005, 0.28, 5, brass,
                        Math.cos(a) * R2, 0, Math.sin(a) * R2);
          cage.add(bar);
        }
        [0.0, 0.145, -0.14].forEach(function (yy) {
          var ring = new THREE.Mesh(new THREE.TorusGeometry(R2, 0.005, 5, 22), brass);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = yy;
          cage.add(ring);
        });
        var base = cyl(R2 + 0.012, R2 + 0.012, 0.028, 20, brassDark, 0, -0.155, 0);
        cage.add(base);

        var bird = new THREE.Group();
        bird.position.y = -0.09;
        var doveWhite = std(0xf4f0e7, { rough: 0.62 });
        var body = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), doveWhite);
        body.scale.set(1, 0.9, 1.4);
        bird.add(body);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), doveWhite);
        head.position.set(0, 0.035, 0.029); bird.add(head);
        var wings = [];
        [-1, 1].forEach(function (side) {
          var hinge = new THREE.Group(); hinge.position.set(side * 0.027, 0.014, -0.004);
          hinge.scale.set(1, 1.18, 1.12);
          hinge.userData.side = side; hinge.rotation.z = side * 0.1; bird.add(hinge); wings.push(hinge);
          var wing = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), std(0xe0dedc, { rough: 0.74 }));
          wing.scale.set(0.012, 0.035, 0.037); wing.position.set(side * 0.006, -0.021, -0.009); hinge.add(wing);
          for (var feather = 0; feather < 4; feather++) {
            var plume = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), doveWhite);
            plume.scale.set(0.005, 0.026, 0.008);
            plume.position.set(side * 0.006, -0.043, -0.028 + feather * 0.013); hinge.add(plume);
          }
          var eye = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), std(0x27242b));
          eye.position.set(side * 0.021, 0.04, 0.039); bird.add(eye);
        });
        var bk = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), std(0xe8a23c, { rough: 0.6 }));
        bk.rotation.x = Math.PI / 2;
        bk.position.set(0, 0.031, 0.058);
        bird.add(bk);
        var tail = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 7), doveWhite);
        tail.rotation.x = -Math.PI / 2.2;
        tail.position.z = -0.06;
        bird.add(tail);
        [-1, 1].forEach(function (side) {
          bird.add(cyl(0.002, 0.002, 0.016, 6, brassDark, side * 0.012, -0.038, 0));
          var toes = cyl(0.002, 0.002, 0.017, 6, brassDark, side * 0.012, -0.046, 0.003);
          toes.rotation.x = Math.PI / 2; bird.add(toes);
        });
        cage.add(bird);
        var perch = cyl(0.006, 0.006, 0.22, 8, woodPolish, 0, -0.139, 0);
        perch.rotation.z = Math.PI / 2; cage.add(perch);

        var warm = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6),
          std(0xffe6b8, { emissive: 0xffab52, ei: 2.6 }));
        warm.position.set(0, 0.1, 0);
        cage.add(warm);
        var pl = new THREE.PointLight(0xffb066, 0.5, 1.8, 2);
        pl.position.set(0, 0.1, 0);
        cage.add(pl);
        var halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T.glow(), color: 0xffb877, transparent: true, opacity: 0.45,
          blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.position.set(0, 0.1, 0);
        halo.scale.setScalar(0.5);
        cage.add(halo);

        house.add(g);
        out.cage = { group: g, bird: bird, wings: wings, halo: halo, cage: cage };
      }());

      /* ---------- 2. 留声机 ---------- */
      (function gramophone() {
        var g = new THREE.Group();
        g.position.set(0.75, 0.95, -0.96);
        g.rotation.y = -Math.PI / 4;

        g.add(box(0.3, 0.055, 0.26, woodDeep, 0, 0.03, 0));
        g.add(box(0.28, 0.14, 0.24, woodPolish, 0, 0.13, 0));
        g.add(box(0.29, 0.02, 0.25, brassDark, 0, 0.205, 0));

        var tt = cyl(0.095, 0.095, 0.008, 24, std(0x201a18, { rough: 0.5, metal: 0.3 }), -0.01, 0.216, 0);
        g.add(tt);
        g.add(cyl(0.012, 0.012, 0.01, 10, brass, -0.01, 0.222, 0));

        var arm = cyl(0.006, 0.006, 0.12, 6, brass, 0.075, 0.25, -0.03);
        arm.rotation.set(0.5, 0, -0.7);
        g.add(arm);

        var horn = new THREE.Group();
        horn.position.set(0.1, 0.35, 0.02);
        horn.rotation.set(1.1, 0, 0);
        var neck = new THREE.CatmullRomCurve3([new V3(0.1, 0.205, -0.06), new V3(0.1, 0.26, -0.08), new V3(0.1, 0.311, -0.056)]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(neck, 16, 0.024, 10, false), brass));
        var hornMetal = brass.clone();
        hornMetal.side = THREE.DoubleSide;
        hornMetal.envMapIntensity = 0.55;
        var bell = new THREE.Mesh(new THREE.LatheGeometry([
          new THREE.Vector2(0.027, -0.085), new THREE.Vector2(0.03, -0.04),
          new THREE.Vector2(0.041, 0.005), new THREE.Vector2(0.066, 0.05),
          new THREE.Vector2(0.11, 0.085)
        ], 32), hornMetal);
        horn.add(bell);
        var throat = new THREE.Mesh(new THREE.CircleGeometry(0.027, 24),
          new THREE.MeshBasicMaterial({ color: 0x211309, side: THREE.DoubleSide }));
        throat.rotation.x = -Math.PI / 2; throat.position.y = -0.084;
        horn.add(throat);
        var lip = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 24), brass);
        lip.rotation.x = Math.PI / 2;
        lip.position.y = 0.085;
        horn.add(lip);
        g.add(horn);

        var crank = cyl(0.006, 0.006, 0.07, 6, brass, -0.16, 0.13, 0.06);
        crank.rotation.z = Math.PI / 2;
        g.add(crank);
        g.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 5, 12), brass));

        house.add(g);
        out.gramophone = { group: g, turntable: tt, horn: horn };
      }());

      /* ---------- 3. 洒水壶 ---------- */
      (function wateringCan() {
        var g = new THREE.Group();
        g.position.set(1.95, 0, 1.9);
        g.rotation.y = 0.8;

        var body = cyl(0.105, 0.125, 0.2, 18, tin, 0, 0.1, 0);
        g.add(body);
        g.add(cyl(0.125, 0.125, 0.012, 18, tin, 0, 0.004, 0));
        g.add(cyl(0.07, 0.07, 0.014, 16, tin, 0, 0.205, 0));

        var spout = cyl(0.016, 0.026, 0.26, 10, tin, 0.13, 0.14, 0);
        spout.rotation.z = -0.85;
        g.add(spout);
        var rose = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.026, 0.03, 12), tin);
        rose.position.set(0.235, 0.225, 0);
        rose.rotation.z = -0.85;
        g.add(rose);

        var handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 18, Math.PI), tin);
        handle.position.set(-0.06, 0.21, 0);
        handle.rotation.set(0, 0, 0.2);
        g.add(handle);

        house.add(g);
        out.wateringCan = { group: g, spout: rose };
      }());

      /* ---------- 5. 发光菌灯 ---------- */
      (function mushroomLamps() {
        var g = new THREE.Group();
        g.position.set(-2.45, 0, -1.95);
        var caps = [];
        [[0, 0.2, 0, 0.075], [0.13, 0.14, 0.06, 0.055], [-0.1, 0.1, 0.09, 0.045]].forEach(function (m) {
          var stem = cyl(0.018, 0.026, m[1], 10, std(0xe8dfcc, { rough: 0.85 }), m[0], m[1] / 2, m[2]);
          g.add(stem);
          var cap = new THREE.Mesh(new THREE.SphereGeometry(m[3], 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            std(0xff9db0, { emissive: 0xff5577, ei: 1.5, rough: 0.5 }));
          cap.position.set(m[0], m[1], m[2]);
          cap.scale.y = 0.8;
          g.add(cap);
          caps.push(cap);
          var h = new THREE.Sprite(new THREE.SpriteMaterial({
            map: T.glow(), color: 0xff7f9c, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false }));
          h.position.set(m[0], m[1] + 0.01, m[2]);
          h.scale.setScalar(m[3] * 5);
          g.add(h);
        });
        var pl = new THREE.PointLight(0xff7f9c, 0.55, 1.6, 2);
        pl.position.y = 0.2;
        g.add(pl);
        house.add(g);
        out.mushroomLamp = { group: g, caps: caps };
      }());

      /* ---------- 6. 捕梦网；保留旧交互 ID 以兼容作品配置 ---------- */
      (function dreamcatcher() {
        var g = new THREE.Group();
        g.name = 'dreamcatcher';
        g.position.set(-2.42, EAVES + Math.sqrt(1 - 2.42 * 2.42 / (R * R)) * RISE, -1.6);
        g.rotation.y = 0.12;
        var yarn = [], feathers = [];
        function thread(a, b) { yarn.push(a.x, a.y, a.z, b.x, b.y, b.z); }
        var centre = new V3(0, -0.34, 0);
        var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.009, 10, 64), woodPolish);
        hoop.position.copy(centre); g.add(hoop);
        var innerRim = new THREE.Mesh(new THREE.TorusGeometry(0.139, 0.003, 6, 64), brass);
        innerRim.position.copy(centre); g.add(innerRim);
        thread(new V3(0, 0, 0), new V3(0, -0.19, 0));
        var previous = null;
        for (var level = 0; level < 5; level++) {
          var nodes = [], radius = 0.139 * Math.pow(0.72, level);
          for (var i = 0; i < 12; i++) {
            var a = i / 12 * Math.PI * 2 + level * Math.PI / 12;
            nodes.push(new V3(Math.cos(a) * radius, centre.y + Math.sin(a) * radius, 0.004));
          }
          for (var j = 0; j < 12; j++) {
            thread(nodes[j], nodes[(j + 1) % 12]);
            if (previous) thread(previous[j], nodes[j]);
          }
          previous = nodes;
        }
        [-1, 0, 1].forEach(function (side) {
          var x = side * 0.095, startY = centre.y - Math.sqrt(0.15 * 0.15 - x * x);
          var endY = -0.63 + Math.abs(side) * 0.07;
          thread(new V3(x, startY, 0), new V3(x, endY, 0));
          for (var bead = 0; bead < 2; bead++) {
            var gem = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), bead ? brass : std(0xb69ac9));
            gem.position.set(x, endY + 0.025 + bead * 0.026, 0); g.add(gem);
          }
          var feather = new THREE.Mesh(APP.petalGeometry(0.15, 0.027, 0.012), std(side ? 0xd0b9d8 : 0xf1e5d1, {side: THREE.DoubleSide, rough: 0.82}));
          feather.position.set(x, endY, 0); feather.rotation.z = Math.PI; g.add(feather); feathers.push(feather);
          thread(new V3(x, endY, 0.006), new V3(x, endY - 0.145, 0.006));
          for (var barb = 1; barb < 7; barb++) {
            var y = endY - barb * 0.019, width = Math.sin(barb / 8 * Math.PI) * 0.021;
            thread(new V3(x, y, 0.007), new V3(x - width, y + 0.014, 0.007));
            thread(new V3(x, y, 0.007), new V3(x + width, y + 0.014, 0.007));
          }
        });
        var webGeo = new THREE.BufferGeometry(); webGeo.setAttribute('position', new THREE.Float32BufferAttribute(yarn, 3));
        var web = new THREE.LineSegments(webGeo, new THREE.LineBasicMaterial({color:0xe1ceb0})); g.add(web);
        house.add(g);
        out.driedBunch = { group: g, hoop: hoop, web: web, feathers: feathers };
      }());

      /* ---------- 7. 萤火玻璃罐（放在石柱上） ---------- */
      (function fireflyJar() {
        var base = new THREE.Group();
        base.position.set(-1.65, 0.45, 0.75);
        house.add(cyl(0.19, 0.18, 0.035, 24, woodPolish, -1.65, 0.4325, 0.75));
        house.add(cyl(0.045, 0.07, 0.4, 16, woodPolish, -1.65, 0.215, 0.75));
        house.add(cyl(0.16, 0.18, 0.035, 24, woodPolish, -1.65, 0.0175, 0.75));


        var g = new THREE.Group();
        g.position.y = 0;
        base.add(g);

        var jarGlass = glassMaterial(0xd7ecff, 0.12);
        var jar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 16, 1, true), jarGlass);
        jar.position.y = 0.08;
        g.add(jar);
        var bottom = cyl(0.075, 0.075, 0.008, 16, jarGlass, 0, 0.004, 0);
        g.add(bottom);
        var lid = cyl(0.078, 0.078, 0.016, 16, brassDark, 0, 0.163, 0);
        g.add(lid);
        g.add(cyl(0.006, 0.006, 0.02, 6, brass, 0, 0.176, 0));

        var flies = [];
        for (var i = 0; i < 6; i++) {
          var a = r() * Math.PI * 2;
          var rad = r() * 0.05;
          var fly = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 5),
            std(0xffe9a8, { emissive: 0xffc24a, ei: 3.2 }));
          fly.position.set(Math.cos(a) * rad, 0.03 + r() * 0.11, Math.sin(a) * rad);
          g.add(fly);
          flies.push({ mesh: fly, base: fly.position.clone(), phase: r() * 6.28, sp: 0.6 + r() * 0.8 });
        }
        var h = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T.glow(), color: 0xffd27a, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false }));
        h.position.y = 0.08;
        h.scale.setScalar(0.34);
        g.add(h);
        var pl = new THREE.PointLight(0xffcf7a, 0.45, 1.3, 2);
        pl.position.y = 0.09;
        g.add(pl);

        house.add(base);
        out.fireflyJar = { group: base, flies: flies };
      }());

      /* ---------- 8. 木质花架 ---------- */
      (function plantStand() {
        var g = new THREE.Group();
        g.position.set(2.2, 0, 1.05);
        g.rotation.y = -0.12;

        var w = 0.44, d = 0.26;
        var post = box(0.03, 0.86, 0.03, woodDeep, -w / 2, 0.43, -d / 2);
        g.add(post);
        g.add(box(0.03, 0.86, 0.03, woodDeep, w / 2, 0.43, -d / 2));
        g.add(box(0.03, 0.86, 0.03, woodDeep, -w / 2, 0.43, d / 2));
        g.add(box(0.03, 0.86, 0.03, woodDeep, w / 2, 0.43, d / 2));

        [0.28, 0.56, 0.84].forEach(function (y, i) {
          var b = box(w + 0.06, 0.022, d + 0.03, woodPolish, 0, y, 0);
          b.castShadow = true;
          g.add(b);
        });

        house.add(g);

        // Each pot is a child of the shelf. It follows the shelf's click animation.
        [[-0.12, 0.3, 0.04], [0.12, 0.58, 0], [-0.08, 0.86, 0.01]].forEach(function (sp) {
          var pot = cyl(0.064, 0.043, 0.1, 20, M.woodMid, sp[0], sp[1] + 0.05, sp[2]);
          g.add(pot);
          for (var n = 0; n < 5; n++) {
            var leaf = new THREE.Mesh(APP.petalGeometry(0.14, 0.035, 0.03), std(0x75844e, { side: THREE.DoubleSide, rough: 0.85 }));
            leaf.position.set(sp[0], sp[1] + 0.1, sp[2]); leaf.rotation.set(0.5, n * 2.4, 0.2); g.add(leaf);
          }
        });



        out.plantStand = { group: g };
      }());

      // Restrained rock pieces belong to the island rim, never to the open floor.
      // The optional kit stones were visibly flat-coloured; the instanced
      // textured crags around the island now supply these edge details.



      // Beside the stool, with independently articulated head and arm.
      out.girl = APP.createGirl(house);
      out.nook = APP.createCozyNook(house, botany);
      out.cat = {group:out.nook.cat,wake:out.nook.wake};
      out.star = house.userData.starPendant;
      out.cloche = { group: house.userData.cloche, morph: house.userData.cloche.userData.shapes };

      /* ---------- 点击碰撞体 ---------- */
      var hits = [];
      function hit(id, x, y, z, rad) {
        var h = ghost(new THREE.SphereGeometry(rad, 8, 6));
        h.position.set(x, y, z);
        h.userData.prop = id;
        house.add(h);
        hits.push(h);
        return h;
      }
      var girlHit = ghost(new THREE.BoxGeometry(0.7, 1.5, 0.62));
      girlHit.position.copy(out.girl.group.position).add(new V3(0, 0.75, 0));
      girlHit.userData.prop = 'girl'; house.add(girlHit); hits.push(girlHit);
      out.girl.hit = girlHit;
      var catHit=ghost(new THREE.BoxGeometry(0.68,0.35,0.5));
      catHit.position.set(out.nook.cat.position.x-0.02,0.215,out.nook.cat.position.z+0.01);
      catHit.userData.prop='cat';house.add(catHit);hits.push(catHit);
      hit('cage', 1.4, 2.41, -0.1, 0.31);
      hit('gramophone', 0.75, 1.13, -0.96, 0.22);
      hit('wateringCan', 1.95, 0.14, 1.9, 0.23);
      hit('mushroomLamp', -2.45, 0.18, -1.95, 0.22);
      hit('driedBunch', -2.42, 2.08, -1.6, 0.26);
      hit('fireflyJar', -1.65, 0.55, 0.75, 0.23);
      hit('plantStand', 2.2, 0.5, 1.05, 0.3);
      hit('clock', 0, 2.16, -2.2, 0.28);
      hit('star', 0, 2.6, 0.35, 0.4);
      hit('cloche', 2.08, 1.21, -0.69, 0.23);

      if (G.butterflies) {
        out.butterflyTargets = [];
        G.butterflies.forEach(function (b, i) {
          out.butterflyTargets.push(hit('butterfly' + i, b.base.x, b.base.y, b.base.z, 0.14));
        });
        out.butterflyHits = G.butterflies.length;
      }

      out.hits = hits;
      return out;
    }

    botany.finish();
    return api;
  };
}(window.APP));
