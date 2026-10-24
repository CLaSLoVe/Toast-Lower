'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
(async () => {
  let track, accept, fail = false, count = 0;
  class Audio {
    constructor() { track = this; this.paused = true; this.currentTime = 0; }
    pause() { this.paused = true; }
    play() { count++; if (fail) return Promise.reject(new Error('autoplay blocked')); return new Promise(resolve => { accept = () => { this.paused = false; resolve(); }; }); }
  }
  const scope = { Audio, document: { body: { append() {} } }, Promise }; scope.window = scope;
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../music.js'), 'utf8'), scope);
  const music = scope.ToastMusic, settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  assert.equal(count, 0); assert.equal(track.loop, true);
  music.update(true, .28); music.update(true, .28); assert.equal(count, 1, 'no overlapping players');
  music.update(false, .28); accept(); await settle(); assert.equal(track.paused, true, 'late play resolution respects pause');
  music.update(true, .28); accept(); await settle(); track.currentTime = 8;
  music.update(false, .28); assert.equal(track.currentTime, 8);
  music.update(true, .28); accept(); await settle(); assert.equal(track.currentTime, 8);
  music.reset(); assert.equal(track.currentTime, 0); assert.equal(track.paused, true);
  fail = true; music.update(true, .28); await settle(); const blockedCount = count;
  music.update(true, .28); assert.equal(count, blockedCount, 'no autoplay retry flood');
  music.gesture(); fail = false; music.update(true, 2); accept(); await settle(); assert.equal(track.volume, 1);
  track.currentTime = 30.4; const beforeLoop = music.clock();
  track.currentTime = 0.1; const afterLoop = music.clock();
  assert.ok(afterLoop > beforeLoop && afterLoop - beforeLoop < .2, 'clock unwraps loop continuously');
  music.update(false, .28); assert.equal(music.clock(), null);
  music.reset(); music.update(true, 0, 90); accept(); await settle();
  track.currentTime = 60 / 126;
  assert.ok(Math.abs(music.clock() - 60 / 90) < 1e-9, 'tempo changes music and beat clock together');
  assert.equal(track.volume, 0, 'muted music keeps a silent beat clock');
  console.log('PASS music lifecycle, promise races, single playback, and autoplay retry');
})().catch(error => { console.error(error); process.exitCode = 1; });
