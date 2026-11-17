/* Shared geometry and instanced botanical details. No downloaded assets. */
(function (APP) {
  'use strict';
  var V = THREE.Vector3;

  APP.roundedBox = function (w, h, d, radius) {
    var r = Math.min(radius || 0.025, w / 3, h / 3, d / 3);
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    var g = new THREE.ExtrudeGeometry(s, {
      depth: d - r * 2, bevelEnabled: true, bevelThickness: r,
      bevelSize: r * 0.45, bevelSegments: 2, steps: 1, curveSegments: 3
    });
    g.translate(0, 0, -(d - r * 2) / 2);
    return g;
  };

  // The petal grows along +Y; its edges curl back in depth.
  APP.petalGeometry = function (length, width, curl, small) {
    var g = new THREE.PlaneGeometry(1, 1, small ? 3 : 6, small ? 4 : 10), a = g.attributes.position;
    for (var i = 0; i < a.count; i++) {
      var t = a.getY(i) + 0.5, u = a.getX(i) * 2;
      var breadth = Math.pow(Math.sin(Math.PI * t), 0.8);
      a.setXYZ(i, u * width * breadth, t * length,
        (curl || 0.12) * Math.sin(t * Math.PI * 0.85) + u * u * length * 0.1 * breadth);
    }
    g.computeVertexNormals();
    return g;
  };

  APP.createEnvironment = function (renderer) {
    var faces = [];
    for (var i = 0; i < 6; i++) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var ctx = c.getContext('2d'), grad = ctx.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, i === 2 ? '#b8bad2' : '#39435c');
      grad.addColorStop(0.45, i === 4 ? '#ac8158' : '#746552');
      grad.addColorStop(1, '#171524');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
      if (i === 4 || i === 0) {
        ctx.fillStyle = '#e8c69b'; ctx.fillRect(22, 8, 7, 36);
      }
      faces.push(c);
    }
    var cube = new THREE.CubeTexture(faces);
    cube.encoding = THREE.sRGBEncoding; cube.needsUpdate = true;
    var pmrem = new THREE.PMREMGenerator(renderer), target = pmrem.fromCubemap(cube);
    cube.dispose(); pmrem.dispose();
    return target;
  };

  // Merge only immobile opaque pieces with the same material and shadow flags.
  // Animated groups, glass, sprites, instances and picking meshes stay intact.
  APP.batchStatic = function (parent, exclusions) {
    var buckets = new Map(), blocked = new Set(exclusions || []);
    parent.updateWorldMatrix(true, true);
    var inverse = parent.matrixWorld.clone().invert();
    function walk(node) {
      if (blocked.has(node)) return;
      if (node.isMesh && !node.isInstancedMesh && !Array.isArray(node.material) && !node.material.transparent) {
        var key = node.material.uuid + ':' + node.castShadow + ':' + node.receiveShadow;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(node);
      }
      node.children.forEach(walk);
    }
    parent.children.forEach(walk);
    buckets.forEach(function (items) {
      if (items.length < 2) return;
      var parts = items.map(function (m) {
        var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
      });
      var merged = new THREE.BufferGeometry();
      ['position', 'normal', 'uv'].forEach(function (attr) {
        var size = attr === 'uv' ? 2 : 3, count = 0;
        parts.forEach(function (g) { count += g.attributes.position.count * size; });
        var array = new Float32Array(count), offset = 0;
        parts.forEach(function (g) {
          var source = g.attributes[attr];
          if (source) array.set(source.array, offset);
          offset += g.attributes.position.count * size;
        });
        merged.setAttribute(attr, new THREE.BufferAttribute(array, size));
      });
      merged.computeBoundingSphere();
      var mesh = new THREE.Mesh(merged, items[0].material);
      mesh.castShadow = items[0].castShadow; mesh.receiveShadow = items[0].receiveShadow;
      mesh.name = 'static-detail-batch'; parent.add(mesh);
      items.forEach(function (m) { m.removeFromParent(); });
      parts.forEach(function (g) { g.dispose(); });
    });
  };

  APP.surfaceTexture = function (kind) {
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var ctx = c.getContext('2d'), seed = kind === 'rock' ? 913 : 707;
    function rand() { seed = seed * 16807 % 2147483647; return seed / 2147483647; }
    ctx.fillStyle = kind === 'rock' ? '#78717c' : '#805234';
    ctx.fillRect(0, 0, 512, 512);
    if (kind === 'rock') {
      for (var i = 0; i < 2300; i++) {
        var x = rand() * 512, y = rand() * 512, r = 1 + rand() * 24;
        ctx.fillStyle = rand() > 0.5 ? 'rgba(22,20,29,.08)' : 'rgba(190,169,147,.08)';
        ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.15 + rand()), rand() * 3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      for (var j = 0; j < 420; j++) {
        var y2 = rand() * 512, drift = rand() * 14;
        ctx.strokeStyle = j % 3 ? 'rgba(37,18,9,.15)' : 'rgba(230,181,119,.13)';
        ctx.lineWidth = 0.3 + rand() * 1.4; ctx.beginPath(); ctx.moveTo(0, y2);
        for (var px = 0; px <= 512; px += 16) ctx.lineTo(px, y2 + Math.sin(px * 0.015 + drift) * drift);
        ctx.stroke();
      }
    }
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  };

  APP.createBotany = function (parent) {
    var root = new THREE.Group(); root.name = 'crafted-botany'; parent.add(root);
    var seed = 511;
    function rand() { seed = seed * 16807 % 2147483647; return seed / 2147483647; }
    var petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, envMapIntensity: 0.12,
      metalness: 0, side: THREE.DoubleSide });
    var leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.87, envMapIntensity: 0.1,
      side: THREE.DoubleSide });
    var stemMat = new THREE.MeshStandardMaterial({ color: 0x526037, roughness: 0.9, envMapIntensity: 0.1 });
    var petals = new THREE.InstancedMesh(APP.petalGeometry(1, 0.43, 0.14, true), petalMat, 18000);
    var leaves = new THREE.InstancedMesh(APP.petalGeometry(1, 0.32, -0.1, true), leafMat, 4500);
    var stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), stemMat, 2500);
    var counts = [0, 0, 0], meshes = [petals, leaves, stems];
    meshes.forEach(function (m) { m.count = 0; m.castShadow = false; m.receiveShadow = true; root.add(m); });
    var dummy = new THREE.Object3D(), col = new THREE.Color(), up = new V(0, 1, 0);
    function instance(type, p, scale, rotation, color) {
      var mesh = meshes[type], n = counts[type]++;
      if (n >= mesh.instanceMatrix.count) throw new Error('Botanical instance budget exceeded');
      dummy.position.copy(p); dummy.scale.copy(scale); dummy.rotation.set(rotation.x, rotation.y, rotation.z);
      dummy.updateMatrix(); mesh.setMatrixAt(n, dummy.matrix);
      if (color !== undefined) { col.set(color); mesh.setColorAt(n, col); }
    }
    function stem(a, b, radius) {
      var n = counts[2]++, direction = b.clone().sub(a);
      if (n >= stems.instanceMatrix.count) throw new Error('Stem instance budget exceeded');
      dummy.position.copy(a).add(b).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      dummy.scale.set(radius, direction.length(), radius); dummy.updateMatrix();
      stems.setMatrixAt(n, dummy.matrix);
    }
    var palettes = {
      pink: [0xcf719f, 0xe7a0bc, 0xf3c6d4, 0xb95e91],
      violet: [0x9670c7, 0xb18bd9, 0xd6b1e7, 0x8053ad],
      blue: [0x8a8ccc, 0xafb3e3, 0xd4d0f4, 0x7777b9],
      cream: [0xf0d5a8, 0xe2b97a, 0xf7e6c6, 0xcfa66c]
    };
    function leaf(p, scale, angle) {
      instance(1, p, new V(scale * 0.7, scale, scale), new V(0.4 + rand(), angle, (rand() - 0.5) * 1.4),
        [0x647445, 0x718352, 0x4b653e, 0x8c8950][Math.floor(rand() * 4)]);
    }
    function cluster(center, radius, kind, number) {
      var pal = palettes[kind] || palettes.violet;
      for (var j = 0; j < (number || 32); j++) {
        var angle = rand() * Math.PI * 2, v = rand() * 1.7 - 0.4;
        var rr = Math.sqrt(Math.max(0.1, 1 - v * v));
        var p = center.clone().add(new V(Math.cos(angle) * radius * rr, v * radius * 0.85, Math.sin(angle) * radius * rr));
        var size = radius * (0.19 + rand() * 0.12), phase = rand() * 6.28;
        var color = pal[Math.floor(rand() * pal.length)];
        for (var k = 0; k < 5; k++) {
          instance(0, p, new V(size, size, size), new V(0.6 + rand() * 0.6, phase, k * Math.PI * 0.4), color);
        }
      }
    }
    function bouquet(x, y, z, size, kind) {
      for (var i = 0; i < 3; i++) {
        var a = i * 2.4, rad = size * (i ? 0.24 : 0);
        var end = new V(x + Math.cos(a) * rad, y + size * (0.65 + rand() * 0.23), z + Math.sin(a) * rad);
        stem(new V(x, y, z), end, size * 0.012);
        cluster(end, size * (0.32 + rand() * 0.04), kind, 36);
        leaf(new V(x + Math.cos(a) * rad * 0.5, y + size * 0.38, z + Math.sin(a) * rad * 0.5), size * 0.34, a);
      }
    }
    function wisteria(x, y, z, length) {
      var start = new V(x, y, z), end = new V(x + (rand() - 0.5) * 0.14, y - length, z + 0.04);
      stem(start, end, 0.006);
      for (var i = 0; i < 30; i++) {
        var t = i / 30, a = i * 2.4, radius = (1 - t) * 0.085;
        var p = start.clone().lerp(end, t).add(new V(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        instance(0, p, new V(0.05 * (1 - t * 0.65), 0.078 * (1 - t * 0.7), 0.07),
          new V(0.2, a, 2.8 + Math.sin(a) * 0.4), palettes.violet[Math.floor(rand() * 4)]);
      }
      leaf(start, 0.18, rand() * 6.28);
    }
    function finish() {
      meshes.forEach(function (m, i) {
        m.count = counts[i]; m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        // r150 does not compute instanced bounds; these fixed botanical batches
        // span the whole small island, so use the batch without frustum culling.
        m.frustumCulled = false;
      });
    }
    return { root: root, bouquet: bouquet, cluster: cluster, leaf: leaf, stem: stem, wisteria: wisteria, finish: finish };
  };
}(window.APP = window.APP || {}));
