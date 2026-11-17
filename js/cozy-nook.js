/* Low decorative sleeping cat and woven flower basket. No click targets. */
(function (APP) {
  'use strict';
  APP.createCozyNook = function (parent, botany) {
    var root = new THREE.Group(); root.name = 'cat-and-flower-basket'; parent.add(root);
    function material(color, roughness) {return new THREE.MeshStandardMaterial({color:color,roughness:roughness || 0.85,envMapIntensity:0.2});}
    var fur=material(0xf3f0e8), cream=material(0xfff7eb), stripe=material(0xe3e1dc), pink=material(0xcb9e9d), ink=material(0x493b3c);
    var sphere=new THREE.SphereGeometry(1,24,16);
    function ball(target,mat,x,y,z,sx,sy,sz){var mesh=new THREE.Mesh(sphere,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;target.add(mesh);return mesh;}
    function tube(target, points, radius, mat) {var curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));var mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,radius,8,false),mat);target.add(mesh);return mesh;}
    var mat=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.36,0.035,48),material(0x9d8794));
    mat.position.set(-0.62,0.027,-0.05);mat.scale.z=0.7;mat.receiveShadow=true;root.add(mat);
    var seam=new THREE.Mesh(new THREE.TorusGeometry(0.36,0.008,6,64),material(0xcbb9b8));
    seam.rotation.x=Math.PI/2;seam.scale.y=0.7;seam.position.set(-0.62,0.047,-0.05);root.add(seam);
    var cat=new THREE.Group();cat.name='sleeping-cat';cat.position.set(-0.62,0.045,-0.05);cat.rotation.y=-0.15;root.add(cat);
    var body=ball(cat,fur,-0.055,0.135,0,0.28,0.12,0.19);
    ball(cat,cream,0.13,0.068,0.16,0.073,0.034,0.06);ball(cat,cream,0.25,0.068,0.13,0.06,0.032,0.055);
    var head=new THREE.Group();head.position.set(0.18,0.17,0.065);head.rotation.z=-0.12;cat.add(head);
    ball(head,fur,0,0,0,0.115,0.1,0.108);
    ball(head,cream,0,-0.032,0.09,0.068,0.04,0.025);
    var closedEyes=new THREE.Group(), openEyes=new THREE.Group();head.add(closedEyes);head.add(openEyes);openEyes.visible=false;
    [-1,1].forEach(function(side){
      var ear=new THREE.Mesh(new THREE.ConeGeometry(0.048,0.09,3),fur);ear.position.set(side*0.069,0.083,-0.006);ear.rotation.z=-side*0.22;head.add(ear);
      var inner=new THREE.Mesh(new THREE.ConeGeometry(0.026,0.052,3),pink);inner.position.set(side*0.069,0.087,0.02);inner.rotation.z=-side*0.22;inner.scale.z=0.35;head.add(inner);
      tube(closedEyes,[[side*0.04-0.019,0.002,0.101],[side*0.04,-0.006,0.108],[side*0.04+0.019,0.002,0.101]],0.0025,ink);
      ball(openEyes,ink,side*0.04,0.002,0.108,0.008,0.012,0.004);
    });
    ball(head,pink,0,-0.025,0.117,0.012,0.007,0.006);
    tube(cat,[[-0.24,0.13,-0.1],[-0.34,0.1,-0.025],[-0.3,0.075,0.15],[-0.1,0.07,0.23],[0.07,0.073,0.19]],0.038,fur);
    ball(cat,cream,0.07,0.073,0.19,0.04,0.035,0.035);
    for(var i=0;i<3;i++){var patch=ball(cat,stripe,-0.16+i*0.08,0.232-i*0.008,-0.015,0.015,0.008,0.064);patch.rotation.y=-0.3;}
    var basketX=-0.16,basketZ=-1.5;
    var basket=new THREE.Group();basket.name='woven-flower-basket';basket.position.set(basketX,0.015,basketZ);root.add(basket);
    var reed=material(0xa78353), lightReed=material(0xc4a474);
    var bowl=new THREE.Mesh(new THREE.LatheGeometry([[0.095,0],[0.11,0.04],[0.15,0.17],[0.15,0.2]].map(p=>new THREE.Vector2(...p)),32),reed);basket.add(bowl);
    for(var row=0;row<9;row++){var y=0.025+row*0.021,r=0.104+y*0.24;var ring=new THREE.Mesh(new THREE.TorusGeometry(r,0.004,5,40),row%2?reed:lightReed);ring.rotation.x=Math.PI/2;ring.position.y=y;basket.add(ring);}
    for(var strand=0;strand<24;strand++){var a=strand/24*Math.PI*2,points=[];for(var j=0;j<=5;j++){var y=j/5*0.2,r=0.098+y*0.27;points.push([Math.cos(a+j*0.025)*r,y,Math.sin(a+j*0.025)*r]);}tube(basket,points,0.003,lightReed);}
    var handle=[];for(var h=0;h<=24;h++){var a=h/24*Math.PI;handle.push([Math.cos(a)*0.15,0.19+Math.sin(a)*0.18,0]);}tube(basket,handle,0.008,lightReed);
    botany.bouquet(basketX,0.2,basketZ,0.24,'pink');
    botany.cluster(new THREE.Vector3(basketX+0.09,0.37,basketZ-0.02),0.065,'cream',12);
    [[-0.13,0.28,0.04,'pink'],[0.13,0.29,0.03,'cream'],[-0.06,0.31,-0.12,'violet'],[0.07,0.32,-0.1,'pink'],[-0.12,0.19,0.15,'violet'],[0.08,0.16,0.16,'pink']].forEach(function(p){
      botany.cluster(new THREE.Vector3(basketX+p[0],p[1],basketZ+p[2]),0.085,p[3],14);
      botany.leaf(new THREE.Vector3(basketX+p[0],0.2,basketZ+p[2]),0.15,p[0]*12);
    });
    APP.batchStatic(root,[cat]);APP.batchStatic(cat,[body,head]);APP.batchStatic(head,[closedEyes,openEyes]);
    var sleepPosition=head.position.clone(),sleepRotation=head.quaternion.clone();
    function ease(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
    function wake(time, viewer){
      if(time>=3.4){head.position.copy(sleepPosition);head.quaternion.copy(sleepRotation);openEyes.visible=false;closedEyes.visible=true;return;}
      var lift=ease(time/0.65)*(1-ease((time-2.2)/1));
      var eyes=ease((time-0.12)/0.5)*(1-ease((time-1.8)/0.8));
      head.position.copy(sleepPosition);head.position.y+=0.035*lift;head.position.z-=0.008*lift;
      head.quaternion.copy(sleepRotation);
      if(viewer){head.updateWorldMatrix(true,false);head.lookAt(viewer);var gaze=head.quaternion.clone();head.quaternion.copy(sleepRotation).slerp(gaze,0.65*lift);}
      else head.rotation.z=-0.12+0.09*lift;
      openEyes.visible=eyes>0.08;closedEyes.visible=!openEyes.visible;openEyes.scale.y=Math.max(0.04,eyes);
    }
    return {group:root,cat:cat,body:body,basket:basket,head:head,openEyes:openEyes,closedEyes:closedEyes,wake:wake};
  };
}(window.APP=window.APP||{}));
