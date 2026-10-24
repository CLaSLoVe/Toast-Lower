'use strict';
// Original loop, one audio element per game. Resume keeps its place; a new run restarts it.
(() => {
  const track = new Audio('assets/audio/banquet-shuffle.mp3');
  track.id = 'game-music'; track.hidden = true; document.body.append(track);
  track.loop = true;
  track.preload = 'auto';
  const SOURCE_BPM = 126, LOOP_SECONDS = 64 * 60 / SOURCE_BPM;
  let wanted = false, pending = false, blocked = false, loops = 0, lastTime = 0;
  window.ToastMusic = {
    gesture() { blocked = false; },
    reset() { wanted = false; track.pause(); track.currentTime = 0; loops = 0; lastTime = 0; },
    // Unwrapped playback clock, including across the 16-bar loop boundary.
    clock() {
      if (!wanted || track.paused || blocked || track.error) return null;
      const t = track.currentTime;
      if (t < lastTime - 1) loops++;
      lastTime = t;
      return (loops * LOOP_SECONDS + t) / track.playbackRate;
    },
    update(playing, volume, bpm = SOURCE_BPM) {
      track.playbackRate = Math.max(90, Math.min(160, bpm)) / SOURCE_BPM;
      wanted = !!playing;
      track.volume = Math.max(0, Math.min(1, volume));
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
