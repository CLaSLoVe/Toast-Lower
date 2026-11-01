'use strict';
// One playback clock, one Web Audio context, separate music/effects gain buses.
// MediaElement.volume is deliberately not used for mixing (ignored by iOS).
(() => {
  const track = new Audio('assets/audio/banquet-shuffle.mp3');
  track.id = 'game-music'; track.hidden = true; document.body.append(track);
  track.loop = true; track.preload = 'auto';
  const SOURCE_BPM = 126, LOOP_SECONDS = 64 * 60 / SOURCE_BPM;
  let wanted = false, pending = false, blocked = false, loops = 0, lastTime = 0;
  let audioFailed = false;
  let graph = null, musicVolume = 0, effectsVolume = 1, ducked = false;
  const clampVolume = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  function setGain(node, value, time) {
    if (node.target === value) return;
    node.target = value;
    const now = graph.context.currentTime;
    if (node.gain.cancelAndHoldAtTime) node.gain.cancelAndHoldAtTime(now);
    else node.gain.cancelScheduledValues(now);
    if (value === 0) node.gain.setValueAtTime(0, now);
    else node.gain.setTargetAtTime(value, now, time);
  }
  function mix() {
    if (!graph) { track.volume = musicVolume * (ducked ? 0.45 : 1); return; }
    // Keep the media element at unity: the gain bus controls even mobile Safari.
    track.volume = 1;
    setGain(graph.music, musicVolume * (ducked ? 0.45 : 1), ducked ? 0.025 : 0.12);
    setGain(graph.effects, effectsVolume, 0.015);
  }
  function audio() {
    if (audioFailed) return null;
    let constructing;
    try {
      if (!graph) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) { audioFailed = true; return null; }
        const context = constructing = new Context(), music = context.createGain(), effects = context.createGain();
        music.gain.value = 0; effects.gain.value = effectsVolume;
        const source = context.createMediaElementSource(track);
        source.connect(music); music.connect(context.destination); effects.connect(context.destination);
        graph = { context, source, music, effects }; mix();
      }
      if (graph.context.state !== 'running') {
        // Resume only from calls made after a gesture; never rebuild the graph/source.
        Promise.resolve(graph.context.resume()).catch(() => {});
      }
      return graph;
    } catch (_) {
      // Audio is optional. Avoid throwing from an input event or animation frame.
      audioFailed = true;
      if (!graph && constructing?.close) { try { Promise.resolve(constructing.close()).catch(() => {}); } catch (_) {} }
      return null;
    }
  }
  window.ToastMusic = {
    audio,
    gesture() { blocked = false; audioFailed = false; audio(); },
    reset() { wanted = false; track.pause(); track.currentTime = 0; loops = 0; lastTime = 0; ducked = false; mix(); },
    clock() {
      if (!wanted || track.paused || blocked || track.error || graph && graph.context.state !== 'running') return null;
      const t = track.currentTime;
      if (t < lastTime - 1) loops++;
      lastTime = t;
      return (loops * LOOP_SECONDS + t) / track.playbackRate;
    },
    update(playing, volume, bpm = SOURCE_BPM, sfxVolume = 1, duck = false) {
      track.playbackRate = Math.max(90, Math.min(160, bpm)) / SOURCE_BPM;
      wanted = !!playing; musicVolume = clampVolume(volume); effectsVolume = clampVolume(sfxVolume); ducked = !!duck;
      if (wanted && !audio()) { track.pause(); return; }
      mix();
      if (!wanted) { if (!track.paused) track.pause(); return; }
      if (!track.paused || pending || blocked) return;
      pending = true;
      try {
        Promise.resolve(track.play()).then(() => {
          pending = false;
          if (!wanted) track.pause();
        }).catch(() => { pending = false; blocked = true; });
      } catch (_) { pending = false; blocked = true; }
    }
  };
})();
