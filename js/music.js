/* User-gesture playback. An original synthesized melody is used until a file is configured. */
(function (APP) {
  'use strict';
  APP.createMusic = function (onChange) {
    var config = window.GRAMOPHONE_MUSIC || {}, context = null, master = null, timer = null;
    var voices = new Set(), audio = null, playing = false, next = 0, step = 0;
    var melody = [72, 76, 79, 76, 74, 77, 81, 77, 71, 74, 79, 74, 72, 76, 79, 83,
      81, 79, 76, 74, 77, 76, 72, 69, 71, 74, 76, 79, 76, 74, 72, 0];
    var bass = [48, 53, 55, 48, 57, 53, 55, 48];
    function notify() { if (onChange) onChange(playing); }
    function note(midi, time, length, level) {
      if (!midi) return;
      var gain = context.createGain(); gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(level, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
      gain.connect(master);
      var ended = 0;
      [1, 2].forEach(function (harmonic) {
        var osc = context.createOscillator(); osc.type = 'sine';
        osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12) * harmonic;
        var tone = context.createGain(); tone.gain.value = harmonic === 1 ? 0.8 : 0.12;
        osc.connect(tone); tone.connect(gain); voices.add(osc);
        osc.onended = function () { voices.delete(osc); tone.disconnect(); if (++ended === 2) gain.disconnect(); };
        osc.start(time); osc.stop(time + length + 0.05);
      });
    }
    function schedule() {
      if (!playing || !context) return;
      while (next < context.currentTime + 0.45) {
        note(melody[step % melody.length], next, 1.9, 0.25);
        if (step % 4 === 0) note(bass[Math.floor(step / 4) % bass.length], next, 3.1, 0.15);
        next += 0.66; step++;
      }
    }
    function pause() {
      playing = false; if (timer) { clearInterval(timer); timer = null; }
      if (audio) audio.pause();
      if (master && context) master.gain.setTargetAtTime(0.0001, context.currentTime, 0.035);
      voices.forEach(function (osc) { try { osc.stop(); } catch (_) {} }); voices.clear();
      notify();
    }
    async function play() {
      if (playing) return;
      if (config.src) {
        if (!audio) {
          audio = new Audio(config.src); audio.loop = true; audio.volume = Math.max(0, Math.min(1, config.volume || 0.18));
          audio.addEventListener('error', pause);
        }
        await audio.play(); playing = true; notify(); return;
      }
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('当前浏览器不支持音乐播放');
      if (!context) {
        context = new AudioContext(); master = context.createGain();
        master.gain.value = 0; master.connect(context.destination);
      }
      // resume is invoked synchronously from the click before awaiting the promise.
      await context.resume();
      master.gain.setTargetAtTime(Math.max(0, Math.min(0.4, config.volume || 0.18)), context.currentTime, 0.06);
      playing = true; next = context.currentTime + 0.04; schedule(); timer = setInterval(schedule, 160); notify();
    }
    return { toggle: async function () {
      if (playing) { pause(); return; }
      try { await play(); } catch (error) { pause(); throw error; }
    }, play: play, pause: pause, isPlaying: function () { return playing; },
    title: config.title || '花房 · 示范旋律' };
  };
}(window.APP = window.APP || {}));
