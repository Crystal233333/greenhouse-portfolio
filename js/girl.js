/* A small articulated flower girl. All geometry is local; no model downloads. */
(function (APP) {
  'use strict';
  var V = THREE.Vector3;

  APP.createGirl = function (parent) {
    var group = new THREE.Group();
    group.name = 'flower-girl';
    group.position.set(1.26, 0, 0.9);
    group.rotation.y = -0.08;
    group.scale.setScalar(0.57);
    parent.add(group);

    function material(color, roughness) {
      return new THREE.MeshStandardMaterial({ color: color, roughness: roughness === undefined ? 0.72 : roughness,
        envMapIntensity: 0.3 });
    }
    var skin = material(0xffc4a3, 0.7), skinShade = material(0xe6a786, 0.76);
    var hair = material(0x30272b, 0.38), hairLight = material(0x44353b, 0.4);
    var white = material(0xf7eaf0, 0.8), ribbonMat = material(0xf4e6e8, 0.65);
    var brown = material(0x65402f, 0.46), sole = material(0x392b26, 0.85);
    var green = material(0x6f8150, 0.8), purple = material(0xb590d8, 0.67);
    var pink = material(0xe3acc9, 0.75), pollen = material(0xeab85f, 0.6);
    var ink = new THREE.MeshBasicMaterial({ color: 0x30262a });
    var lip = material(0xa45d50, 0.7);
    var unitSphere = new THREE.SphereGeometry(1, 24, 16);

    function ball(target, mat, x, y, z, sx, sy, sz) {
      var mesh = new THREE.Mesh(unitSphere, mat);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
      mesh.castShadow = mesh.receiveShadow = true; target.add(mesh); return mesh;
    }
    function tube(target, points, radius, mat, tapered) {
      var curve = new THREE.CatmullRomCurve3(points.map(function (p) { return new V(p[0], p[1], p[2]); }));
      var geo = new THREE.TubeGeometry(curve, 20, radius, 8, false);
      if (tapered) {
        var pos = geo.attributes.position;
        for (var i = 0; i <= 20; i++) {
          var t = i / 20, c = curve.getPointAt(t), scale = 0.28 + 0.72 * Math.pow(Math.sin(Math.PI * (0.05 + t * 0.91)), 0.45);
          for (var j = 0; j <= 8; j++) {
            var k = i * 9 + j;
            pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * scale,
              c.y + (pos.getY(k) - c.y) * scale, c.z + (pos.getZ(k) - c.z) * scale);
          }
        }
        geo.computeVertexNormals();
      }
      var mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
      target.add(mesh); return mesh;
    }
    function daisy(target, x, y, z, size, petalMat) {
      var flower = new THREE.Group(); flower.position.set(x, y, z); target.add(flower);
      for (var i = 0; i < 5; i++) {
        var a = i * Math.PI * 2 / 5;
        var petal = ball(flower, petalMat || white, Math.cos(a) * size * 0.47, Math.sin(a) * size * 0.47, 0,
          size * 0.36, size * 0.23, size * 0.12);
        petal.rotation.z = a;
      }
      ball(flower, pollen, 0, 0, size * 0.11, size * 0.2, size * 0.2, size * 0.15);
      return flower;
    }
    function leaf(target, x, y, z, length, angle) {
      var mesh = new THREE.Mesh(APP.petalGeometry(length, length * 0.28, 0.016), green);
      mesh.position.set(x, y, z); mesh.rotation.set(0.2, 0.1, angle); target.add(mesh);
    }

    var body = new THREE.Group(); group.add(body);
    // Feet touch the floor. Short calves remain visible below the dress.
    [-1, 1].forEach(function (side) {
      var x = side * 0.13;
      ball(body, skin, x, 0.27, 0, 0.063, 0.19, 0.068);
      ball(body, sole, x, 0.035, 0.075, 0.108, 0.03, 0.17);
      ball(body, brown, x, 0.082, 0.085, 0.108, 0.067, 0.165);
      ball(body, skin, x, 0.135, 0.018, 0.071, 0.043, 0.075);
      var strap = new THREE.Mesh(APP.roundedBox(0.18, 0.026, 0.037, 0.008), brown);
      strap.position.set(x, 0.15, 0.047); body.add(strap);
      ball(body, pollen, x + side * 0.087, 0.15, 0.052, 0.018, 0.019, 0.012);
    });

    var skirtGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.445, 0.3), new THREE.Vector2(0.47, 0.32),
      new THREE.Vector2(0.466, 0.36), new THREE.Vector2(0.437, 0.51),
      new THREE.Vector2(0.394, 0.7), new THREE.Vector2(0.327, 0.94),
      new THREE.Vector2(0.237, 1.16)
    ], 80);
    var skirtPos = skirtGeo.attributes.position;
    for (var s = 0; s < skirtPos.count; s++) {
      var angle = Math.atan2(skirtPos.getZ(s), skirtPos.getX(s));
      var amount = (1.17 - skirtPos.getY(s)) / 0.87;
      var pleat = 1 + 0.022 * Math.cos(angle * 16) * Math.max(0, amount);
      skirtPos.setX(s, skirtPos.getX(s) * pleat); skirtPos.setZ(s, skirtPos.getZ(s) * pleat);
    }
    skirtGeo.computeVertexNormals();
    var skirt = new THREE.Mesh(skirtGeo, white); skirt.castShadow = skirt.receiveShadow = true; body.add(skirt);
    var bodice = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.237, 1.15), new THREE.Vector2(0.243, 1.23),
      new THREE.Vector2(0.25, 1.37), new THREE.Vector2(0.232, 1.46),
      new THREE.Vector2(0.18, 1.51)
    ], 48), white);
    bodice.scale.z = 0.74; bodice.castShadow = bodice.receiveShadow = true; body.add(bodice);
    var sash = new THREE.Mesh(new THREE.TorusGeometry(0.237, 0.018, 8, 56), ribbonMat);
    sash.rotation.x = Math.PI / 2; sash.position.y = 1.16; body.add(sash);
    ball(body, skin, 0, 1.575, 0, 0.093, 0.135, 0.085);
    // Applique flowers follow the front surface of the skirt.
    for (var f = 0; f < 12; f++) {
      var fy = 0.39 + f * 0.048, fx = -0.28 + f * 0.045;
      var radius = 0.47 - (fy - 0.33) * 0.28;
      var fz = Math.sqrt(Math.max(0.015, radius * radius - fx * fx)) + 0.015;
      var applique = daisy(body, fx, fy, fz, 0.069 + f % 3 * 0.014, f % 2 ? purple : pink);
      applique.rotation.y = Math.asin(fx / radius) * 0.6;
    }

    var head = new THREE.Group(); head.name = 'girl-head'; head.position.set(0, 2.015, 0.015); group.add(head);
    ball(head, hair, 0, 0.025, -0.075, 0.473, 0.49, 0.355);
    ball(head, skin, 0, -0.02, 0.025, 0.427, 0.447, 0.36);
    [-1, 1].forEach(function (side) {
      ball(head, skin, side * 0.414, -0.12, 0.005, 0.072, 0.105, 0.065);
      ball(head, skinShade, side * 0.449, -0.12, 0.031, 0.027, 0.056, 0.025);
    });
    var cap = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.acos((0.27 - 0.025) / 0.48)), hair);
    cap.scale.set(0.48, 0.48, 0.4); cap.position.set(0, 0.025, -0.015); head.add(cap);
    // Three shallow swept panels hug the skull: a short centre and two curtains.
    var fringe = new THREE.Group(); fringe.name = 'three-piece-fringe'; head.add(fringe);
    function fringePanel(side) {
      var shape = new THREE.Shape();
      if (!side) {
        shape.moveTo(-0.15, 0.4); shape.quadraticCurveTo(0, 0.51, 0.15, 0.4);
        shape.quadraticCurveTo(0.12, 0.25, 0.06, 0.16); shape.quadraticCurveTo(0, 0.12, -0.07, 0.16);
        shape.quadraticCurveTo(-0.12, 0.23, -0.15, 0.4);
      } else {
        shape.moveTo(side * 0.06, 0.42); shape.quadraticCurveTo(side * 0.28, 0.48, side * 0.4, 0.28);
        shape.quadraticCurveTo(side * 0.46, 0.08, side * 0.41, -0.07);
        shape.quadraticCurveTo(side * 0.34, 0.05, side * 0.24, 0.15);
        shape.quadraticCurveTo(side * 0.13, 0.18, side * 0.06, 0.42);
      }
      var flat = new THREE.ShapeGeometry(shape, 20).toNonIndexed(), source = flat.attributes.position;
      var vertices = [], normals = [];
      function vertex(p) {
        var x = p.x, y = p.y;
        var z = Math.sqrt(Math.max(0.005, 1 - x * x / (0.48 * 0.48) - (y - 0.025) * (y - 0.025) / (0.49 * 0.49))) * 0.4;
        vertices.push(x, y, z + (side ? 0.004 : 0.008));
        var normal = new V(x / (0.48 * 0.48), (y - 0.025) / (0.49 * 0.49), z / (0.4 * 0.4)).normalize();
        normals.push(normal.x, normal.y, normal.z);
      }
      function subdivide(a, b, c, depth) {
        if (!depth) { vertex(a); vertex(b); vertex(c); return; }
        var ab = a.clone().lerp(b, 0.5), bc = b.clone().lerp(c, 0.5), ca = c.clone().lerp(a, 0.5);
        subdivide(a, ab, ca, depth - 1); subdivide(ab, b, bc, depth - 1);
        subdivide(ca, bc, c, depth - 1); subdivide(ab, bc, ca, depth - 1);
      }
      for (var v = 0; v < source.count; v += 3) subdivide(new V().fromBufferAttribute(source, v), new V().fromBufferAttribute(source, v + 1), new V().fromBufferAttribute(source, v + 2), 3);
      flat.dispose();
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      var panel = new THREE.Mesh(geometry, hair); panel.castShadow = true; fringe.add(panel);
    }
    fringePanel(0); fringePanel(-1); fringePanel(1);
    tube(head, [[-0.4, 0.2, 0.12], [-0.44, -0.02, 0.12], [-0.4, -0.25, 0.02]], 0.065, hair, true);
    tube(head, [[0.4, 0.2, 0.12], [0.44, -0.02, 0.12], [0.4, -0.25, 0.02]], 0.065, hair, true);

    var ponytails = [];
    [-1, 1].forEach(function (side) {
      var tail = new THREE.Group(); tail.position.set(side * 0.37, -0.29, -0.08); head.add(tail);
      for (var lock = 0; lock < 6; lock++) {
        var offset = (lock - 2.5) * 0.026;
        tube(tail, [[offset, 0, 0], [side * 0.06 + offset, -0.28, -0.035],
          [side * 0.13 + offset, -0.61, 0.015], [side * 0.06 + offset, -0.9, 0.07],
          [-side * 0.035 + offset, -1.01 + lock % 2 * 0.08, 0.1]], 0.068, lock % 3 ? hair : hairLight, true);
      }
      ponytails.push(tail);
      var bow = new THREE.Group(); bow.position.set(side * 0.386, -0.29, 0.115); head.add(bow);
      var a = ball(bow, ribbonMat, -0.075, 0, 0, 0.085, 0.048, 0.035); a.rotation.z = -0.3;
      var b = ball(bow, ribbonMat, 0.075, 0, 0, 0.085, 0.048, 0.035); b.rotation.z = 0.3;
      ball(bow, white, 0, 0, 0.015, 0.036, 0.04, 0.034);
      [-1, 1].forEach(function (r) {
        var ribbon = new THREE.Mesh(APP.petalGeometry(0.18, 0.036, 0.008), ribbonMat);
        ribbon.position.set(r * 0.025, -0.018, 0); ribbon.rotation.z = Math.PI + r * 0.3; bow.add(ribbon);
      });
    });
    daisy(head, -0.34, 0.26, 0.215, 0.088);
    daisy(head, -0.405, 0.15, 0.21, 0.057);
    daisy(head, 0.33, 0.29, 0.20, 0.074);
    daisy(head, 0.411, 0.17, 0.18, 0.049);
    leaf(head, -0.425, 0.19, 0.22, 0.13, 0.7);
    leaf(head, 0.36, 0.29, 0.21, 0.12, -0.7);

    var eyes = [];
    [-1, 1].forEach(function (side) {
      var eye = new THREE.Group(); eye.position.set(side * 0.13, 0.012, 0.371); head.add(eye); eyes.push(eye);
      // Small matte bean eyes: no sclera, iris, eyelashes or glassy highlights.
      ball(eye, ink, 0, 0, 0, 0.035, 0.044, 0.018);
      var blushMat = material(0xf29ca1, 0.9); blushMat.transparent = true; blushMat.opacity = 0.28; blushMat.depthWrite = false;
      ball(head, blushMat, side * 0.245, -0.1, 0.337, 0.065, 0.035, 0.012);
    });
    ball(head, skin, 0, -0.07, 0.383, 0.023, 0.023, 0.024);
    var neutralMouth = new THREE.Group(); head.add(neutralMouth);
    tube(neutralMouth, [[-0.076, -0.18, 0.367], [0, -0.203, 0.378], [0.076, -0.18, 0.367]], 0.009, lip);
    var happyMouth = new THREE.Group(); happyMouth.visible = false; head.add(happyMouth);
    tube(happyMouth, [[-0.09, -0.178, 0.367], [0, -0.218, 0.38], [0.09, -0.178, 0.367]], 0.009, lip);

    function arm(side, waving) {
      var shoulder = new THREE.Group(); shoulder.position.set(side * 0.278, 1.445, 0.015); group.add(shoulder);
      ball(shoulder, skin, 0, -0.16, 0, 0.078, 0.192, 0.074);
      var elbow = new THREE.Group(); elbow.position.y = -0.34; shoulder.add(elbow);
      ball(elbow, skin, 0, -0.14, 0.006, 0.062, 0.17, 0.061);
      var wrist = new THREE.Group(); wrist.position.set(0, -0.29, 0.015); elbow.add(wrist);
      ball(wrist, skin, 0, -0.035, 0.012, 0.061, 0.075, 0.036);
      for (var finger = 0; finger < 4; finger++) {
        ball(wrist, skin, -0.038 + finger * 0.025, -0.1 - Math.sin(finger / 3 * Math.PI) * 0.014, 0.019,
          0.014, 0.049 + Math.sin(finger / 3 * Math.PI) * 0.008, 0.016);
      }
      var thumb = ball(wrist, skin, side * 0.058, -0.029, 0.018, 0.023, 0.045, 0.023); thumb.rotation.z = side * 0.45;
      if (waving) {
        for (var b = 0; b < 7; b++) {
          var ba = b / 7 * Math.PI * 2;
          ball(wrist, b % 2 ? purple : pink, Math.cos(ba) * 0.061, 0.012, Math.sin(ba) * 0.045, 0.023, 0.026, 0.023);
        }
        shoulder.rotation.z = -0.16; elbow.rotation.z = -0.1; wrist.rotation.z = 0.05;
      } else { shoulder.rotation.z = 0.12; elbow.rotation.z = 0.06; wrist.rotation.z = -0.03; }
      return { shoulder: shoulder, elbow: elbow, wrist: wrist };
    }
    var waveArm = arm(-1, true), holdingArm = arm(1, false);
    // A real twig and hanging raceme sit in the held hand.
    var heldFlowers = new THREE.Group(); heldFlowers.position.set(0, -0.07, 0.04); holdingArm.wrist.add(heldFlowers);
    tube(heldFlowers, [[0, 0, 0], [0.015, 0.16, 0], [0.055, 0.31, 0]], 0.009, green);
    leaf(heldFlowers, 0.04, 0.26, 0, 0.11, -1.1);
    leaf(heldFlowers, 0.03, 0.28, -0.005, 0.09, 0.5);
    for (var bud = 0; bud < 14; bud++) {
      var t = bud / 14, ba = bud * 2.4;
      ball(heldFlowers, bud % 3 ? purple : pink, 0.07 + Math.cos(ba) * (1 - t) * 0.045,
        0.26 - t * 0.28, Math.sin(ba) * 0.025, 0.025 * (1 - t * 0.5), 0.036 * (1 - t * 0.5), 0.025);
    }

    // Merge static decorations inside each articulated part, never across joints.
    APP.batchStatic(body, []);
    ponytails.forEach(function (tail) { APP.batchStatic(tail, []); });
    APP.batchStatic(head, eyes.concat(ponytails, [neutralMouth, happyMouth, fringe]));
    APP.batchStatic(waveArm.wrist, []);
    APP.batchStatic(waveArm.elbow, [waveArm.wrist]);
    APP.batchStatic(waveArm.shoulder, [waveArm.elbow]);
    APP.batchStatic(holdingArm.shoulder, []);

    var active = false, smileAmount = 0;
    function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function resetGreeting() {
      active = false; smileAmount = 0;
      waveArm.shoulder.rotation.z = -0.16; waveArm.elbow.rotation.z = -0.1; waveArm.wrist.rotation.z = 0.05;
      head.rotation.set(0, 0, 0); neutralMouth.visible = true; happyMouth.visible = false;
    }
    function greet(time) {
      if (time >= 3.2) { resetGreeting(); return; }
      active = true;
      var lift = ease(time / 0.5) * (1 - ease((time - 2.55) / 0.65));
      var wave = ease((time - 0.4) / 0.2) * (1 - ease((time - 2.3) / 0.25));
      waveArm.shoulder.rotation.z = -0.16 - 1.92 * lift;
      waveArm.elbow.rotation.z = -0.1 - 0.66 * lift;
      waveArm.wrist.rotation.z = 0.05 + Math.sin(time * 12) * 0.36 * wave;
      head.rotation.set(0, 0, 0);
      smileAmount = lift;
      neutralMouth.visible = lift < 0.12; happyMouth.visible = lift >= 0.12;
      happyMouth.scale.setScalar(0.85 + 0.15 * lift);
    }
    function updateIdle(dt, time) {
      var blinkPhase = time % 5.7, blink = blinkPhase > 4.9 && blinkPhase < 5.1 ? Math.abs(blinkPhase - 5) / 0.1 : 1;
      eyes.forEach(function (eye) { eye.scale.y = Math.max(0.1, blink) * (1 - 0.1 * smileAmount); });
      ponytails.forEach(function (tail, i) { tail.rotation.z = Math.sin(time * 1.2 + i) * 0.025; });
      head.rotation.set(0, 0, 0);
    }
    return { group: group, head: head, waveArm: waveArm, holdingArm: holdingArm, fringe: fringe, eyes: eyes,
      happyMouth: happyMouth, neutralMouth: neutralMouth,
      greet: greet, updateIdle: updateIdle, resetGreeting: resetGreeting,
      isGreeting: function () { return active; } };
  };
}(window.APP = window.APP || {}));
