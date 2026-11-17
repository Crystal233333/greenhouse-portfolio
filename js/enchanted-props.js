/* Small deterministic effects for the central star and the glass cloche. */
(function (APP) {
  'use strict';
  APP.createStarSparks = function (parent) {
    var count = 96, values = new Float32Array(count * 3), velocities = [], seed = 509;
    function rand() { seed = seed * 16807 % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < count; i++) {
      var a = rand() * Math.PI * 2, r = 0.35 + rand() * 0.6;
      velocities.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r + 0.18, (rand() - 0.5) * 0.6));
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(values, 3));
    var mat = new THREE.PointsMaterial({ color: 0xffd49b, map: APP.tex.dot(), size: 0.075,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var points = new THREE.Points(geo, mat); points.position.y = -0.05; points.visible = false;
    points.frustumCulled = false; parent.add(points);
    var time = 2;
    return { points: points,
      trigger: function () { time = 0; points.visible = true; mat.opacity = 1; },
      update: function (dt) {
        if (time >= 1.8) return;
        time += dt;
        for (var i = 0; i < count; i++) {
          var v = velocities[i]; values[i * 3] = v.x * time;
          values[i * 3 + 1] = v.y * time - time * time * 0.18;
          values[i * 3 + 2] = v.z * time;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, 1 - time / 1.8);
        if (time >= 1.8) { points.visible = false; mat.opacity = 0; }
      }
    };
  };

  APP.createClocheShapes = function (parent) {
    var root = new THREE.Group(); root.position.y = 0.25; parent.add(root);
    function cloudShape(kind) {
      var canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      var ctx=canvas.getContext('2d');
      function puff(x,y,r,rgb,alpha){var g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+rgb+','+alpha+')');g.addColorStop(0.55,'rgba('+rgb+','+alpha*0.7+')');g.addColorStop(1,'rgba('+rgb+',0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
      function cloud(x,y,r,rgb){puff(x,y,r,rgb,0.68);for(var i=0;i<8;i++){var a=i*2.4,rr=r*(0.34+(i%3)*0.07);puff(x+Math.cos(a)*rr,y+Math.sin(a)*rr,r*0.55,i%3?'246,224,245':rgb,0.48);}}
      if(kind==='planet'){
        for(var i=0;i<42;i++){var a=i/42*Math.PI*2;puff(128+Math.cos(a)*79,128+Math.sin(a)*23,7,'244,214,168',0.62);}
        cloud(128,123,54,'205,179,235');
        for(var i=0;i<22;i++){var a=i/21*Math.PI;puff(128+Math.cos(a)*79,128+Math.sin(a)*23,6,'249,228,191',0.54);}
      }else if(kind==='flower'){
        for(var y=148;y<205;y+=7)puff(128,y,9,'170,195,166',0.5);
        for(var p=0;p<6;p++){var a=p/6*Math.PI*2;cloud(128+Math.cos(a)*44,112+Math.sin(a)*44,28,'229,184,222');}
        cloud(128,112,24,'255,227,170');
      }else{
        cloud(128,139,53,'216,195,235');
        cloud(89,89,25,'221,199,238');cloud(167,89,25,'221,199,238');
        puff(87,68,14,'237,217,242',0.58);puff(169,68,14,'237,217,242',0.58);
        puff(108,143,7,'112,89,148',0.8);puff(148,143,7,'112,89,148',0.8);puff(128,160,5,'235,180,193',0.85);
      }
      var texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
      var group=new THREE.Group();root.add(group);
      var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:0.92,depthWrite:false,color:0xffffff}));
      sprite.scale.set(0.31,0.31,1);sprite.renderOrder=3;group.add(sprite);return group;
    }
    var planet=cloudShape('planet'),flower=cloudShape('flower'),cat=cloudShape('cat');
    var shapes = [planet, flower, cat], names = ['planet', 'flower', 'cat'];
    var index = 0, old = 0, elapsed = 1, cloudTime = 0;
    shapes.forEach(function (s, i) { s.visible = i === 0; });
    var api = { group: root, shapes: shapes, names: names, index: 0,
      cycle: function () {
        shapes.forEach(function (s, i) { s.visible = i === index; s.scale.setScalar(1); s.rotation.y = 0; });
        old = index; index = (index + 1) % 3; api.index = index; elapsed = 0;
        shapes[index].visible = true; shapes[index].scale.setScalar(0.001);
      },
      update: function (dt) {
        cloudTime+=dt;root.position.y=0.25+Math.sin(cloudTime*0.8)*0.006;
        shapes.forEach(function(shape,i){shape.children[0].material.rotation=Math.sin(cloudTime*0.5+i)*0.018;});
        if (elapsed >= 0.48) return;
        elapsed += dt; var t = Math.min(1, elapsed / 0.48), e = t * t * (3 - 2 * t);
        shapes[old].scale.setScalar(Math.max(0.001, 1 - e)); shapes[old].rotation.y = e * 0.6;
        shapes[index].scale.setScalar(Math.max(0.001, e)); shapes[index].rotation.y = (1 - e) * -0.6;
        if (t === 1) { shapes[old].visible = false; shapes[index].rotation.y = 0; }
      }
    };
    return api;
  };
}(window.APP = window.APP || {}));
