/* ============================================================
 * 程序化纹理：全部用 canvas 现画，不依赖任何外部图片
 * ============================================================ */
window.APP = window.APP || {};

(function (APP) {
  'use strict';

  var cache = {};

  function cvs(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function toTex(c, repeatX, repeatY) {
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repeatX || repeatY) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX || 1, repeatY || 1);
    }
    return t;
  }

  function once(key, build) {
    if (!cache[key]) cache[key] = build();
    return cache[key];
  }

  function radial(size, stops) {
    var c = cvs(size, size);
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function rnd(seed) {
    var s = seed || 1;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  var T = {

    /* Cloud bands on the distant planet, painted once at startup. */
    planet: function () {
      return once('planet', function () {
        var c = cvs(1024, 512), g = c.getContext('2d'), r = rnd(823);
        g.fillStyle = '#46579a'; g.fillRect(0, 0, 1024, 512);
        for (var j = 0; j < 280; j++) {
          var y = r() * 512, phase = r() * 6.28;
          g.strokeStyle = ['rgba(149,150,223,.2)', 'rgba(30,34,94,.24)', 'rgba(183,169,232,.14)'][j % 3];
          g.lineWidth = 1 + r() * 7; g.beginPath();
          for (var x = 0; x <= 1024; x += 8) {
            var yy = y + Math.sin(x / 110 + phase) * 5 + Math.sin(x / 43 + phase) * 2;
            if (!x) g.moveTo(x, yy); else g.lineTo(x, yy);
          }
          g.stroke();
        }
        return toTex(c);
      });
    },

    /* 柔光点：用于灯晕、星尘 */
    glow: function () {
      return once('glow', function () {
        return toTex(radial(128, [
          [0, 'rgba(255,255,255,1)'],
          [0.25, 'rgba(255,246,225,.72)'],
          [0.55, 'rgba(255,220,170,.22)'],
          [1, 'rgba(255,200,140,0)']
        ]));
      });
    },

    dot: function () {
      return once('dot', function () {
        return toTex(radial(64, [
          [0, 'rgba(255,255,255,1)'],
          [0.4, 'rgba(214,232,255,.65)'],
          [1, 'rgba(180,210,255,0)']
        ]));
      });
    },

    /* 天文数字般的星云 */
    nebula: function () {
      return once('nebula', function () {
        var S = 512, c = cvs(S, S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        var r = rnd(7);
        for (var i = 0; i < 26; i++) {
          var x = S * (0.15 + r() * 0.7), y = S * (0.15 + r() * 0.7);
          var rad = S * (0.08 + r() * 0.22);
          var grad = g.createRadialGradient(x, y, 0, x, y, rad);
          var hue = r() < 0.45 ? '150,90,220' : (r() < 0.5 ? '70,90,200' : '210,120,200');
          grad.addColorStop(0, 'rgba(' + hue + ',.5)');
          grad.addColorStop(0.45, 'rgba(' + hue + ',.16)');
          grad.addColorStop(1, 'rgba(' + hue + ',0)');
          g.fillStyle = grad;
          g.beginPath();
          g.arc(x, y, rad, 0, Math.PI * 2);
          g.fill();
        }
        // 细微星尘
        for (var k = 0; k < 500; k++) {
          g.fillStyle = 'rgba(255,255,255,' + (0.1 + r() * 0.6) + ')';
          g.fillRect(r() * S, r() * S, 1.2, 1.2);
        }
        return toTex(c);
      });
    },

    /* 木地板：横向木条 */
    wood: function (repeatX, repeatY) {
      return once('wood_' + repeatX + '_' + repeatY, function () {
        var S = 512, c = cvs(S, S), g = c.getContext('2d');
        var r = rnd(3);
        g.fillStyle = '#2e1c0f';
        g.fillRect(0, 0, S, S);
        var rows = 8;
        for (var i = 0; i < rows; i++) {
          var y = i * S / rows;
          var h = S / rows;
          var shade = 0.72 + r() * 0.26;
          g.fillStyle = 'rgb(' + Math.round(92 * shade) + ',' + Math.round(58 * shade) + ',' + Math.round(32 * shade) + ')';
          g.fillRect(0, y, S, h - 2);
          // 木纹
          g.strokeStyle = 'rgba(28,15,7,.45)';
          g.lineWidth = 1;
          for (var k = 0; k < 6; k++) {
            var yy = y + 4 + r() * (h - 8);
            g.beginPath();
            g.moveTo(0, yy);
            for (var x = 0; x <= S; x += 32) {
              g.lineTo(x, yy + (r() - 0.5) * 3);
            }
            g.stroke();
          }
          // 板缝
          g.fillStyle = 'rgba(18,10,5,.9)';
          g.fillRect(0, y + h - 2, S, 2);
        }
        return toTex(c, repeatX, repeatY);
      });
    },

    /* 圆形地毯 */
    rug: function () {
      return once('rug', function () {
        var S = 512, c = cvs(S, S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        var cx = S / 2, cy = S / 2;
        g.beginPath();
        g.arc(cx, cy, S * 0.48, 0, Math.PI * 2);
        g.fillStyle = '#5c2b3a';
        g.fill();
        var rings = [
          [0.46, '#7a3a4c'], [0.40, '#4a2230'], [0.36, '#8a4453'],
          [0.26, '#4a2230'], [0.18, '#8a4453'], [0.10, '#3d1c28']
        ];
        rings.forEach(function (rr) {
          g.beginPath();
          g.arc(cx, cy, S * rr[0], 0, Math.PI * 2);
          g.fillStyle = rr[1];
          g.fill();
        });
        // 金色花纹
        g.strokeStyle = 'rgba(214,168,104,.55)';
        g.lineWidth = 3;
        for (var i = 0; i < 16; i++) {
          var a = (i / 16) * Math.PI * 2;
          g.beginPath();
          g.arc(cx + Math.cos(a) * S * 0.33, cy + Math.sin(a) * S * 0.33, S * 0.045, 0, Math.PI * 2);
          g.stroke();
        }
        g.beginPath();
        g.arc(cx, cy, S * 0.33, 0, Math.PI * 2);
        g.stroke();
        // Fine woven borders and a central eight-fold medallion.
        g.strokeStyle = 'rgba(228,180,113,.62)';
        g.lineWidth = 1.3;
        [0.44, 0.425, 0.29, 0.275, 0.13].forEach(function (rad) {
          g.beginPath(); g.arc(cx, cy, S * rad, 0, Math.PI * 2); g.stroke();
        });
        for (var n = 0; n < 48; n++) {
          var angle = n / 48 * Math.PI * 2;
          g.save(); g.translate(cx, cy); g.rotate(angle);
          g.beginPath(); g.moveTo(S * 0.405, 0);
          g.lineTo(S * 0.415, -3); g.lineTo(S * 0.425, 0); g.lineTo(S * 0.415, 3);
          g.closePath(); g.stroke(); g.restore();
        }
        for (var petal = 0; petal < 8; petal++) {
          g.save(); g.translate(cx, cy); g.rotate(petal * Math.PI / 4);
          g.beginPath(); g.moveTo(0, 0);
          g.bezierCurveTo(-27, -30, -22, -68, 0, -83);
          g.bezierCurveTo(22, -68, 27, -30, 0, 0); g.stroke();
          g.restore();
        }
        return toTex(c);
      });
    },

    /* 紫藤：从上往下垂的花串 */
    wisteria: function () {
      return once('wisteria', function () {
        var W = 128, H = 512, c = cvs(W, H), g = c.getContext('2d');
        g.clearRect(0, 0, W, H);
        var r = rnd(11);
        // 主茎
        g.strokeStyle = 'rgba(70,52,40,.85)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(W / 2, 0);
        g.bezierCurveTo(W / 2 + 6, H * 0.3, W / 2 - 8, H * 0.6, W / 2 + 2, H * 0.95);
        g.stroke();
        // 花簇：越往下越少越小
        for (var i = 0; i < 190; i++) {
          var t = Math.pow(r(), 0.72);
          var y = 6 + t * (H - 22);
          var spread = (1 - t) * W * 0.44 + 5;
          var x = W / 2 + (r() - 0.5) * 2 * spread;
          var rad = (1 - t * 0.5) * (4.2 + r() * 4.6);
          var pal = ['#c9a6f2', '#a97bea', '#e0c8ff', '#8f5fd6', '#f0e2ff', '#b48bf0'];
          g.fillStyle = pal[Math.floor(r() * pal.length)];
          g.globalAlpha = 0.8 + r() * 0.2;
          g.beginPath();
          g.ellipse(x, y, rad, rad * 1.2, r() * 3, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        return toTex(c);
      });
    },

    /* 藤叶 */
    leaf: function () {
      return once('leaf', function () {
        var S = 128, c = cvs(S, S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        g.translate(S / 2, S / 2);
        g.rotate(-0.2);
        var grad = g.createLinearGradient(-30, 0, 30, 0);
        grad.addColorStop(0, '#3f7a45');
        grad.addColorStop(0.5, '#63a25c');
        grad.addColorStop(1, '#2f5f38');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, -52);
        g.bezierCurveTo(38, -26, 34, 26, 0, 52);
        g.bezierCurveTo(-34, 26, -38, -26, 0, -52);
        g.fill();
        g.strokeStyle = 'rgba(24,54,30,.5)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, -46);
        g.lineTo(0, 46);
        g.stroke();
        return toTex(c);
      });
    },

    /* 花簇（绣球 / 勿忘我那种一头多朵） */
    bloomCluster: function (kind) {
      return once('bloom_' + kind, function () {
        var S = 256, c = cvs(S, S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        var r = rnd(kind === 'pink' ? 5 : 17);
        var pals = {
          pink: ['#f6b3cf', '#ee8fb6', '#ffd7e6', '#d9709d', '#fff0f6'],
          blue: ['#b9c7ff', '#93a5f5', '#dbe3ff', '#7a8ce8', '#eef2ff'],
          violet: ['#c9a6f2', '#a97bea', '#e6d6ff', '#8f5fd6', '#f4ecff'],
          cream: ['#ffe6c2', '#ffd39a', '#fff5e2', '#e8b878', '#fffbf0']
        };
        var pal = pals[kind] || pals.violet;
        for (var i = 0; i < 46; i++) {
          var a = r() * Math.PI * 2;
          var d = Math.pow(r(), 0.6) * S * 0.34;
          var x = S / 2 + Math.cos(a) * d;
          var y = S / 2 + Math.sin(a) * d * 0.92;
          var rad = 10 + r() * 15;
          g.fillStyle = pal[Math.floor(r() * pal.length)];
          g.globalAlpha = 0.85 + r() * 0.15;
          // 四瓣小花
          for (var p = 0; p < 4; p++) {
            var pa = p * Math.PI / 2 + r();
            g.beginPath();
            g.ellipse(x + Math.cos(pa) * rad * 0.55, y + Math.sin(pa) * rad * 0.55,
                      rad * 0.55, rad * 0.45, pa, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = 'rgba(255,255,255,.55)';
          g.beginPath();
          g.arc(x, y, rad * 0.2, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        return toTex(c);
      });
    },

    /* 书页：占位排版 */
    page: function (kind) {
      return once('page_' + kind, function () {
        var W = 512, H = 700, c = cvs(W, H), g = c.getContext('2d');
        g.fillStyle = '#f4efe3';
        g.fillRect(0, 0, W, H);
        // 纸纹
        var r = rnd(23);
        for (var i = 0; i < 260; i++) {
          g.fillStyle = 'rgba(180,168,146,' + (0.03 + r() * 0.05) + ')';
          g.fillRect(r() * W, r() * H, 2 + r() * 3, 1 + r() * 2);
        }
        g.fillStyle = '#8a7f6b';
        g.font = '600 15px Georgia, serif';
        g.fillText(kind === 'title' ? 'FOLIO' : '— — —', 44, 62);
        g.strokeStyle = 'rgba(120,108,92,.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(44, 78);
        g.lineTo(W - 44, 78);
        g.stroke();

        if (kind === 'title') {
          g.fillStyle = '#2a2620';
          g.font = '700 54px Georgia, serif';
          g.fillText('Chapter', 44, 190);
          g.font = '700 54px Georgia, serif';
          g.fillText('— —', 44, 250);
          // 打字占位线
          g.fillStyle = 'rgba(42,38,32,.75)';
          g.fillRect(44, 300, 210, 3);
          g.fillRect(44, 320, 150, 3);
          g.fillRect(44, 340, 120, 3);
          // 大数字占位
          g.fillStyle = 'rgba(42,38,32,.35)';
          g.font = '700 68px Georgia, serif';
          g.fillText('00000', 44, 480);
          g.strokeStyle = 'rgba(120,108,92,.35)';
          g.beginPath();
          g.moveTo(44, 510);
          g.lineTo(W - 44, 510);
          g.stroke();
        } else {
          g.fillStyle = 'rgba(42,38,32,.28)';
          for (var j = 0; j < 9; j++) {
            g.fillRect(44, 130 + j * 26, (j % 3 === 2 ? 240 : 400) - (j % 2) * 60, 3);
          }
        }
        g.fillStyle = 'rgba(42,38,32,.4)';
        g.font = '12px Georgia, serif';
        g.fillText('page ' + (kind === 'title' ? '1' : '2'), 44, H - 40);
        return toTex(c);
      });
    },


    /* 钟面 */
    clockFace: function () {
      return once('clockface', function () {
        var S = 256, c = cvs(S, S), g = c.getContext('2d');
        var cx = S / 2, cy = S / 2, R = S * 0.47;
        g.clearRect(0, 0, S, S);
        g.beginPath();
        g.arc(cx, cy, R, 0, Math.PI * 2);
        g.fillStyle = '#f2e6cc';
        g.fill();
        g.lineWidth = S * 0.03;
        g.strokeStyle = '#4a2f18';
        g.stroke();
        // 刻度
        for (var i = 0; i < 12; i++) {
          var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          var r1 = R * (i % 3 === 0 ? 0.74 : 0.84);
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          g.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
          g.lineWidth = i % 3 === 0 ? S * 0.018 : S * 0.009;
          g.strokeStyle = '#3a2412';
          g.stroke();
        }
        // 罗马数字位用点代替，保持简洁
        g.fillStyle = '#3a2412';
        g.beginPath();
        g.arc(cx, cy, S * 0.022, 0, Math.PI * 2);
        g.fill();
        return toTex(c);
      });
    },

    /* 蝴蝶翅膀（半透明贴图） */
    wing: function (kind) {
      return once('wing_' + kind, function () {
        var S = 256, c = cvs(S, S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        var pals = {
          violet: ['#c9a6f2', '#a071e0', '#e6d2ff'],
          amber: ['#ffd08a', '#f2a94e', '#fff0d0'],
          blue: ['#a9c4ff', '#7f9ef0', '#dce7ff']
        };
        var pal = pals[kind] || pals.violet;
        // 上翅
        g.beginPath();
        g.moveTo(S * 0.5, S * 0.5);
        g.bezierCurveTo(S * 0.1, S * 0.06, S * 0.86, S * 0.02, S * 0.94, S * 0.28);
        g.bezierCurveTo(S * 0.98, S * 0.44, S * 0.74, S * 0.5, S * 0.5, S * 0.5);
        var grad = g.createLinearGradient(S * 0.2, 0, S * 0.9, S);
        grad.addColorStop(0, pal[0]);
        grad.addColorStop(0.6, pal[1]);
        grad.addColorStop(1, pal[2]);
        g.fillStyle = grad;
        g.fill();
        // 下翅
        g.beginPath();
        g.moveTo(S * 0.5, S * 0.5);
        g.bezierCurveTo(S * 0.24, S * 0.6, S * 0.26, S * 0.96, S * 0.5, S * 0.94);
        g.bezierCurveTo(S * 0.74, S * 0.94, S * 0.76, S * 0.62, S * 0.5, S * 0.5);
        g.fillStyle = pal[1];
        g.globalAlpha = 0.92;
        g.fill();
        g.globalAlpha = 1;
        // 翅脉与斑点
        g.strokeStyle = 'rgba(40,24,60,.45)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(S * 0.5, S * 0.5);
        g.lineTo(S * 0.9, S * 0.2);
        g.moveTo(S * 0.5, S * 0.5);
        g.lineTo(S * 0.86, S * 0.38);
        g.moveTo(S * 0.5, S * 0.5);
        g.lineTo(S * 0.6, S * 0.9);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.75)';
        g.beginPath();
        g.arc(S * 0.72, S * 0.3, S * 0.045, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(S * 0.58, S * 0.72, S * 0.03, 0, Math.PI * 2);
        g.fill();
        return toTex(c);
      });
    }
  };


  APP.tex = T;
}(window.APP));
