/* Scroll framing and cancellable object-focus transitions. No DOM dependencies. */
(function (APP) {
  'use strict';
  var V = THREE.Vector3;
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function copy(pose) { return { position: pose.position.clone(), look: pose.look.clone(), fov: pose.fov }; }

  APP.createCameraRig = function (camera, options) {
    options = options || {};
    var path = new THREE.CatmullRomCurve3([
      new V(-9, 6.4, 21), new V(-5, 4.6, 12.4), new V(-1.1, 2.8, 7), new V(1.35, 2.1, 5.4)
    ]);
    var aim = new THREE.CatmullRomCurve3([
      new V(0, -0.1, 0), new V(0, 0.9, 0), new V(0, 1.5, -0.6), new V(-0.15, 1.48, -1.15)
    ]);
    var fovs = [43, 45, 50, 58], home = null, transition = null, hold = null;
    var current = { position: camera.position.clone(), look: new V(0, 1, 0), fov: camera.fov };
    var lastBase = { progress: 0, yaw: 0, pitch: 0 };
    var rig = { mode: 'free', subject: null, blend: 0 };

    function basePose(progress, yaw, pitch) {
      var look = aim.getPoint(progress), position = path.getPoint(progress);
      if (camera.aspect < 1) position.lerp(look, 1 - Math.min(2.1, 1 / camera.aspect));
      var offset = position.clone().sub(look), spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += yaw || 0;
      spherical.phi = Math.max(0.4, Math.min(Math.PI - 0.4, spherical.phi - (pitch || 0)));
      position.copy(look).add(offset.setFromSpherical(spherical));
      var t = progress * 3, i = Math.min(2, Math.floor(t));
      return { position: position, look: look, fov: fovs[i] + (fovs[i + 1] - fovs[i]) * (t - i) };
    }
    function apply(pose) {
      current = copy(pose); camera.position.copy(pose.position); camera.fov = pose.fov;
      camera.updateProjectionMatrix(); camera.lookAt(pose.look); camera.updateMatrixWorld();
    }
    function focusedPose(spec) {
      var target = spec.target.clone();
      var direction = current.position.clone().sub(target).normalize();
      direction.lerp(new V(0.04, 0.18, 1).applyAxisAngle(new V(0, 1, 0), -0.14).normalize(), 0.72).normalize();
      direction.y = Math.max(0.1, Math.min(0.34, direction.y)); direction.normalize();
      var distance = spec.distance * (camera.aspect < 1 ? 1.3 : 1);
      var look = target.clone();
      if (spec.kind === 'chapter') {
        if (camera.aspect < 1) look.y -= 0.34;
        else look.add(new V().crossVectors(new V(0, 1, 0), direction).normalize().multiplyScalar(0.24));
      }
      var position = target.clone().addScaledVector(direction, distance), fov = 43;
      var nav = options.navigation;
      if (nav) {
        nav.space.updateWorldMatrix(true, false);
        var p = nav.space.worldToLocal(position.clone());
        var subject = nav.space.worldToLocal(spec.target.clone());
        // All focus cameras stay in the exterior half-space. Its convexity also
        // makes the entire approach and return safe, including near-plane margin.
        p.z = Math.max(nav.entranceZ + nav.clearance, p.z);
        p.x = Math.max(-1.25, Math.min(1.25, p.x));
        if (subject.z < nav.entranceZ) {
          var f = (p.z - nav.entranceZ) / (p.z - subject.z);
          var crossing = p.x * (1 - f) + subject.x * f;
          var clearX = Math.max(-nav.openingHalfWidth, Math.min(nav.openingHalfWidth, crossing));
          // Keep the sightline through the open entrance, away from both posts.
          p.x = (clearX - subject.x * f) / (1 - f);
        }
        position.copy(nav.space.localToWorld(p));
        var actualDistance = position.distanceTo(spec.target);
        fov = THREE.MathUtils.clamp(2 * Math.atan(Math.tan(43 * Math.PI / 360) * distance / actualDistance) * 180 / Math.PI, 18, 48);
      }
      return { position: position, look: look, fov: fov };
    }
    function begin(to, mode, duration, callback) {
      var control = current.position.clone().lerp(to.position, 0.5);
      if (options.navigation) {
        var nav = options.navigation;
        var local = nav.space.worldToLocal(control.clone());
        local.x *= 0.82;
        local.z += Math.min(0.75, current.position.distanceTo(to.position) * 0.08);
        control.copy(nav.space.localToWorld(local));
      }
      transition = { from: copy(current), to: copy(to), control: control, time: 0, duration: duration, callback: callback };
      rig.mode = mode;
    }
    rig.focus = function (spec, callback, autoReturn) {
      if (rig.mode !== 'free') return false;
      home = copy(current); rig.subject = spec; hold = autoReturn === undefined ? null : autoReturn;
      var goal = focusedPose(spec), duration = Math.max(0.8, Math.min(1.5, current.position.distanceTo(goal.position) * 0.055));
      begin(goal, 'focusing', duration, callback);
      if (options.onBusy) options.onBusy(true);
      return true;
    };
    rig.release = function () {
      if (rig.mode === 'free' || rig.mode === 'returning') return;
      hold = null;
      begin(home, 'returning', 1.05, null);
    };
    rig.update = function (dt, progress, yaw, pitch) {
      lastBase = { progress: progress, yaw: yaw, pitch: pitch };
      if (rig.mode === 'free') { rig.blend = 0; apply(basePose(progress, yaw, pitch)); return; }
      if (transition) {
        transition.time += dt;
        var t = Math.min(1, transition.time / transition.duration), e = ease(t);
        var pose = {
          position: transition.from.position.clone().multiplyScalar((1 - e) * (1 - e))
            .addScaledVector(transition.control, 2 * (1 - e) * e).addScaledVector(transition.to.position, e * e),
          look: transition.from.look.clone().lerp(transition.to.look, e),
          fov: transition.from.fov + (transition.to.fov - transition.from.fov) * e
        };
        pose.position.y += Math.sin(Math.PI * t) * 0.16;
        rig.blend = rig.mode === 'returning' ? 1 - e : e;
        apply(pose);
        if (t >= 1) {
          var callback = transition.callback, wasReturning = rig.mode === 'returning';
          transition = null;
          if (wasReturning) {
            rig.mode = 'free'; rig.subject = null; rig.blend = 0;
            if (options.onBusy) options.onBusy(false);
          } else { rig.mode = 'focused'; rig.blend = 1; if (callback) callback(); }
        }
      } else if (rig.mode === 'focused' && hold !== null) {
        hold -= dt; if (hold <= 0) rig.release();
      }
    };
    rig.resize = function () {
      if (!rig.isBusy()) return;
      home = basePose(lastBase.progress, lastBase.yaw, lastBase.pitch);
      if (transition) {
        var goal = rig.mode === 'returning' ? copy(home) : focusedPose(rig.subject);
        begin(goal, rig.mode, Math.max(0.45, transition.duration - transition.time), transition.callback);
      }
      else if (rig.mode === 'focused' && rig.subject) apply(focusedPose(rig.subject));
    };
    rig.basePose = basePose;
    rig.getPose = function () { return copy(current); };
    rig.isBusy = function () { return rig.mode !== 'free'; };
    return rig;
  };
}(window.APP = window.APP || {}));
