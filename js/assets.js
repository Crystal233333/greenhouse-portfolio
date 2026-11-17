/* ============================================================
 * 外部模型加载：assets/models/*.glb
 * 用经典脚本版的 GLTFLoader，file:// 也能用
 * 加载失败不影响场景（程序化几何仍然在）
 * ============================================================ */
window.APP = window.APP || {};

(function (APP) {
  'use strict';

  APP.assets = { models: {}, ready: false };

  APP.loadModels = function (manifest, onDone) {
    var out = {};
    if (!THREE.GLTFLoader) {
      console.warn('[assets] 没有 GLTFLoader，跳过模型加载');
      APP.assets.ready = true;
      if (onDone) onDone(out);
      return;
    }

    var loader = new THREE.GLTFLoader();
    var keys = Object.keys(manifest);
    var left = keys.length;
    if (!left) { APP.assets.ready = true; if (onDone) onDone(out); return; }

    keys.forEach(function (key) {
      loader.load(
        manifest[key],
        function (gltf) {
          out[key] = gltf.scene || gltf.scenes[0];
          APP.assets.models[key] = out[key];
          if (--left === 0) { APP.assets.ready = true; if (onDone) onDone(out); }
        },
        undefined,
        function (err) {
          console.warn('[assets] 加载失败：' + manifest[key], err);
          if (--left === 0) { APP.assets.ready = true; if (onDone) onDone(out); }
        }
      );
    });
  };
}(window.APP));
