/* One soft hover light point; the book glows through its own materials. */
(function (APP) {
  'use strict';
  APP.createHoverGlow = function (scene, world) {
    var root = new THREE.Group(); root.name = 'interaction-glow-point'; scene.add(root);
    var selected = null, strength = 0, bookAmount = 0;
    var warm = new THREE.Color(0xffb35b), bookMaterials = [], seen = new Set();
    world.book.group.traverse(function (mesh) {
      var mat = mesh.material;
      if (!mesh.isMesh || !mat || !mat.emissive || seen.has(mat)) return;
      seen.add(mat); bookMaterials.push({material:mat, emission:mat.emissive.clone()});
    });
    [0, 1].forEach(function (i) {
      var sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:APP.tex.glow(), color:i ? 0xffb665 : 0xffe6b6,
        transparent:true, opacity:0, depthWrite:false, depthTest:true, blending:THREE.AdditiveBlending}));
      sprite.scale.setScalar(i ? 0.4 : 0.13); root.add(sprite);
    });
    function resolve(key) {
      if (!key) return null;
      var parts = key.split(':'), id = parts[1], p = world.props2 || {};
      if (parts[0] === 'chapter') return world[id] && world[id].group;
      if (p[id]) return p[id].group;
      if (id === 'clock' && world.props) return world.props.clock.group;
      var butterfly = /^butterfly(\d+)$/.exec(id);
      return butterfly && world.props ? world.props.butterflies[Number(butterfly[1])].group : null;
    }
    return {
      root:root, resolve:resolve,
      update:function (key, dt, guideStrength) {
        selected = key;
        var id = key && key.split(':')[1], object = resolve(key);
        var usesOriginalGuide = id === 'lamp' || id === 'flower';
        var point = !!object && id !== 'book' && !usesOriginalGuide;
        strength += ((point ? 1 : 0) - strength) * Math.min(1, dt * 10);
        root.visible = point && strength > 0.005;
        world.house.updateWorldMatrix(true, true);
        if (point) {
          var hit = world.hits.concat(world.props2 ? world.props2.hits : []).find(function (h) {
            return key.indexOf('chapter:') === 0 ? h.userData.chapter === id : h.userData.prop === id;
          });
          if (hit) hit.getWorldPosition(root.position); else object.getWorldPosition(root.position);
          root.position.y += id === 'plantStand' ? 0.52 : 0.15;
          if (id === 'girl') {
            world.props2.girl.head.getWorldPosition(root.position); root.position.y += 0.31;
          }
          if (id === 'star') world.props2.star.core.getWorldPosition(root.position);
        }
        root.children[0].material.opacity = strength * 0.85;
        root.children[1].material.opacity = strength * 0.36;
        var bookTarget = id === 'book' ? 1 : Math.max(0, guideStrength || 0) * 0.18;
        bookAmount += (bookTarget - bookAmount) * Math.min(1, dt * 9);
        bookMaterials.forEach(function (item) {item.material.emissive.copy(item.emission).lerp(warm, bookAmount * 0.48);});
      },
      selected:function () { return selected; },
      dispose:function () {
        bookMaterials.forEach(function (item) {item.material.emissive.copy(item.emission);});
        root.children.forEach(function (sprite) {sprite.material.dispose();}); root.removeFromParent();
      }
    };
  };
}(window.APP = window.APP || {}));
