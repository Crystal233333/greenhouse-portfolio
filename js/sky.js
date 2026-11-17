/* Layered galaxy, star fields, constellation lines and distant planets. */
(function (APP) {
  'use strict';
  var V = THREE.Vector3;
  APP.createSky = function (scene) {
    var root = new THREE.Group(); root.name = 'celestial-sky'; scene.add(root);
    var seed = 859;
    function rand() { seed = seed * 16807 % 2147483647; return seed / 2147483647; }
    function gaussian() { return Math.sqrt(-2 * Math.log(Math.max(0.00001, rand()))) * Math.cos(6.283 * rand()); }
    var eye = new V(-9, 6.4, 21), forward = new V(0, 0.3, 0).sub(eye).normalize();
    var right = new V().crossVectors(forward, new V(0, 1, 0)).normalize();
    var up = new V().crossVectors(right, forward).normalize();
    var orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward.clone().negate()));
    function at(x, y, depth) { return eye.clone().addScaledVector(forward, depth).addScaledVector(right, x).addScaledVector(up, y); }

    function galaxyTexture() {
      var canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 768;
      var g = canvas.getContext('2d');
      function cloud(x, y, radius, color, alpha) {
        var grad = g.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
        grad.addColorStop(0.4, 'rgba(' + color + ',' + alpha * 0.32 + ')'); grad.addColorStop(1, 'rgba(' + color + ',0)');
        g.fillStyle = grad; g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 150; i++) {
        var t = rand(), x = t * 1750 - 100, y = 690 - t * 620 + gaussian() * 38;
        var colors = t < 0.34 ? ['49,112,242', '73,152,230'] : (t < 0.65 ? ['146,69,234', '205,91,213'] : ['222,90,172', '123,104,244']);
        cloud(x, y, 95 + rand() * 135, colors[i % 2], 0.075 + rand() * 0.08);
      }
      for (var n = 0; n < 45; n++) {
        var t2 = rand(); cloud(t2 * 1700 - 70, 690 - t2 * 620 + gaussian() * 12, 35 + rand() * 65, '240,214,228', 0.025);
      }
      cloud(310, 220, 270, '47,100,230', 0.14);
      cloud(1140, 570, 290, '188,64,164', 0.14);
      cloud(760, 470, 220, '109,65,223', 0.11);
      // Dust lanes leave dark filaments inside the luminous band.
      g.globalCompositeOperation = 'destination-out';
      for (var lane = 0; lane < 22; lane++) {
        g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 5 + rand() * 15; g.beginPath();
        var offset = gaussian() * 23;
        for (var x = -30; x < 1600; x += 20) {
          var y = 660 - x * 0.355 + Math.sin(x * 0.013 + lane) * 16 + offset;
          if (x === -30) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      // Sideways close-ups must not reveal the rectangular billboard boundary.
      g.globalCompositeOperation = 'destination-in';
      var horizontal = g.createLinearGradient(0, 0, canvas.width, 0);
      horizontal.addColorStop(0, 'rgba(255,255,255,0)'); horizontal.addColorStop(0.16, 'white');
      horizontal.addColorStop(0.84, 'white'); horizontal.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = horizontal; g.fillRect(0, 0, canvas.width, canvas.height);
      var vertical = g.createLinearGradient(0, 0, 0, canvas.height);
      vertical.addColorStop(0, 'rgba(255,255,255,0)'); vertical.addColorStop(0.14, 'white');
      vertical.addColorStop(0.86, 'white'); vertical.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = vertical; g.fillRect(0, 0, canvas.width, canvas.height);
      g.globalCompositeOperation = 'source-over';
      var texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
      return texture;
    }
    var galaxy = new THREE.Mesh(new THREE.PlaneGeometry(146, 86), new THREE.MeshBasicMaterial({
      map: galaxyTexture(), transparent: true, opacity: 0.92, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide
    }));
    galaxy.position.copy(at(0, 4, 92)); galaxy.quaternion.copy(orientation); root.add(galaxy);

    function particles(count, dust) {
      var positions = [], colors = [], sizes = [], phases = [], c = new THREE.Color();
      var palette = dust ? [0xaebcff, 0xc9a5ef, 0xf3c3d8, 0xffdebb] : [0xe7edff, 0x9dc7ff, 0xffd7b1, 0xd0b8ff];
      for (var i = 0; i < count; i++) {
        var p;
        if (dust) {
          var x = (rand() - 0.5) * 139;
          p = at(x, 4 + x * 0.36 + gaussian() * 3.4, 87 + gaussian() * 4);
        } else {
          var theta = rand() * Math.PI * 2, z = rand() * 2 - 1, radius = 75 + rand() * 40;
          p = new V(Math.sqrt(1 - z * z) * Math.cos(theta), z, Math.sqrt(1 - z * z) * Math.sin(theta)).multiplyScalar(radius);
        }
        positions.push(p.x, p.y, p.z); c.set(palette[i % palette.length]); colors.push(c.r, c.g, c.b);
        sizes.push(dust ? 0.25 + rand() * 0.75 : 0.45 + Math.pow(rand(), 7) * 3.7); phases.push(rand() * 6.283);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
      geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
      var mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: dust ? 0.46 : 0.92 } },
        vertexShader: 'attribute vec3 color; attribute float aSize; attribute float aPhase; uniform float uTime; varying vec3 vColor; varying float vAlpha; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(aSize*220.0/max(1.0,-mv.z),0.9,7.0); vColor=color; vAlpha=0.66+0.28*sin(uTime*(0.35+aPhase*0.06)+aPhase); }',
        fragmentShader: 'uniform float uOpacity; varying vec3 vColor; varying float vAlpha; void main(){vec2 p=gl_PointCoord-0.5; float r=length(p); if(r>0.5)discard; float glow=exp(-r*r*24.0); gl_FragColor=vec4(vColor*1.35,glow*vAlpha*uOpacity);}',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var mesh = new THREE.Points(geo, mat); mesh.frustumCulled = false; root.add(mesh); return mesh;
    }
    var stars = particles(8000, false), dust = particles(4800, true);

    var constellationLines = [], constellationStars = [];
    function constellation(points, edges, x, y, scale) {
      var mapped = points.map(function (p) { return at(x + p[0] * scale, y + p[1] * scale, 76); });
      mapped.forEach(function (p) { constellationStars.push(p.x, p.y, p.z); });
      edges.forEach(function (edge) {
        [mapped[edge[0]], mapped[edge[1]]].forEach(function (p) { constellationLines.push(p.x, p.y, p.z); });
      });
    }
    // Familiar asterism silhouettes; decorative positions, not a navigational sky map.
    constellation([[-3, 1], [-2, 0.4], [-1, 0.6], [0, 0], [1.4, 0.1], [1.6, 1.3], [0.3, 1.5]],
      [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]], -30, 14, 2.2);
    constellation([[-1.4, 1.6], [1.1, 1.5], [-0.55, 0], [0, -0.1], [0.55, -0.2], [-1.2, -1.8], [1.3, -1.7]],
      [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]], 30, -8, 2.0);
    constellation([[-2, 0.9], [-1, -0.3], [0, 0.6], [1, -0.5], [2, 1]],
      [[0, 1], [1, 2], [2, 3], [3, 4]], -6, 23, 2.3);
    var lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(constellationLines, 3));
    root.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xa4b8ed, transparent: true, opacity: 0.25, depthWrite: false })));
    var pinGeo = new THREE.BufferGeometry(); pinGeo.setAttribute('position', new THREE.Float32BufferAttribute(constellationStars, 3));
    root.add(new THREE.Points(pinGeo, new THREE.PointsMaterial({ color: 0xf5e6cd, map: APP.tex.dot(), size: 0.72,
      transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })));

    var planets = [], rings = [];
    function planet(x, y, depth, radius, color, hasRing) {
      var sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.MeshStandardMaterial({
        color: color, map: APP.tex.planet(), roughness: 0.93, envMapIntensity: 0.12,
        emissive: color, emissiveIntensity: 0.16
      }));
      sphere.position.copy(at(x, y, depth)); root.add(sphere); planets.push(sphere);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: APP.tex.glow(), color: color,
        transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.copy(sphere.position); glow.scale.setScalar(radius * 3.4); root.add(glow);
      if (hasRing) {
        var ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.32, radius * 1.85, 96),
          new THREE.MeshBasicMaterial({ color: 0xc8b9e4, transparent: true, opacity: 0.27, side: THREE.DoubleSide, depthWrite: false }));
        ring.position.copy(sphere.position); ring.rotation.set(-0.95, 0.2, 0.22); root.add(ring); rings.push(ring);
      }
    }
    planet(26, 16, 82, 6.1, 0x8198ed, true);
    planet(-33, -12, 92, 3.2, 0xe7a6bd, true);
    planet(5, 26, 105, 1.25, 0xeed9c1, false);
    return { root: root, stars: stars, dust: dust, planets: planets,
      update: function (dt, time) {
        stars.material.uniforms.uTime.value = time; dust.material.uniforms.uTime.value = time * 0.6;
        stars.rotation.y = time * 0.0006;
        dust.position.copy(right).multiplyScalar(Math.sin(time * 0.035) * 0.35);
        planets.forEach(function (p, i) { p.rotation.y = time * (0.008 + i * 0.003); });
      } };
  };
}(window.APP = window.APP || {}));
