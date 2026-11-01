'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
(async () => {
  let track, accept, fail = false, count = 0, contexts = 0, sources = 0;
  class Audio {
    constructor() { track = this; this.paused = true; this.currentTime = 0; }
    // Simulate iOS ignoring media-element volume, including attempts to set zero.
    set volume(_) {} get volume() { return 1; }
    pause() { this.paused = true; }
    play() { count++; if (fail) return Promise.reject(new Error('autoplay blocked')); return new Promise(resolve => { accept = () => { this.paused = false; resolve(); }; }); }
  }
  function node() {
    return { connections: [], connect(to) { this.connections.push(to); },
      gain: { value: 1, calls: [], cancelScheduledValues(t) { this.calls.push(['cancel',t]); },
        setValueAtTime(v,t) { this.value=v;this.calls.push(['set',v,t]); },
        setTargetAtTime(v,t,ramp) { this.value=v;this.calls.push(['target',v,t,ramp]); } } };
  }
  class AudioContext {
    constructor() { contexts++; this.state='suspended';this.currentTime=0;this.destination={}; }
    resume() { this.state='running'; return Promise.resolve(); }
    createGain() { return node(); }
    createMediaElementSource(media) { sources++; assert.equal(media,track);return node(); }
  }
  const scope = { Audio, AudioContext, document: { body: { append() {} } }, Promise }; scope.window = scope;
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../music.js'), 'utf8'), scope);
  const music = scope.ToastMusic, settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  assert.equal(count, 0); assert.equal(track.loop, true); assert.equal(contexts,0);
  music.gesture();const graph=music.audio();assert.equal(contexts,1);assert.equal(sources,1);
  assert.equal(graph.source.connections[0],graph.music);assert.equal(graph.music.connections[0],graph.context.destination);
  assert.equal(graph.effects.connections[0],graph.context.destination);
  music.update(true, .18); music.update(true, .18); assert.equal(count, 1, 'no overlapping players');
  music.update(false, .18); accept(); await settle(); assert.equal(track.paused, true, 'late play resolution respects pause');
  music.update(true, .18); accept(); await settle(); track.currentTime = 8;
  music.update(false, .18); assert.equal(track.currentTime, 8);
  music.update(true, .18); accept(); await settle(); assert.equal(track.currentTime, 8);
  const clock=music.clock();music.update(true,.18,126,.6,true);
  assert.equal(graph.music.target,.18*.45);assert.equal(graph.effects.target,.6);assert.equal(music.clock(),clock);
  assert.equal(graph.music.gain.calls.at(-1)[3],.025,'duck has a short ramp');
  const calls=graph.music.gain.calls.length;for(let i=0;i<60;i++)music.update(true,.18,126,.6,true);
  assert.equal(graph.music.gain.calls.length,calls,'identical frame updates do not restart gain ramps');
  music.update(true,.18,126,.25,false);assert.equal(graph.music.target,.18);assert.equal(graph.effects.target,.25);
  assert.equal(graph.music.gain.calls.at(-1)[3],.12,'music returns gently after the cues');
  music.update(true,0,126,0);assert.equal(track.volume,1,'iOS media volume is still ignored');
  assert.equal(graph.music.gain.value,0);assert.equal(graph.effects.gain.value,0,'both buses really mute');
  assert.equal(music.clock(),clock,'muting does not reset or pause the beat clock');
  music.reset(); assert.equal(track.currentTime, 0); assert.equal(track.paused, true);
  fail = true; music.update(true, .18); await settle(); const blockedCount = count;
  music.update(true, .18); assert.equal(count, blockedCount, 'no autoplay retry flood');
  music.gesture(); fail = false; music.update(true, 2,126,2); accept(); await settle();
  assert.equal(graph.music.target,1);assert.equal(graph.effects.target,1);
  track.currentTime = 30.4; const beforeLoop = music.clock();
  track.currentTime = 0.1; const afterLoop = music.clock();
  assert.ok(afterLoop > beforeLoop && afterLoop - beforeLoop < .2, 'clock unwraps loop continuously');
  graph.context.state='interrupted';assert.equal(music.clock(),null);music.gesture();assert.notEqual(music.clock(),null);
  music.update(false, .18); assert.equal(music.clock(), null);
  music.reset(); music.update(true, 0, 90); accept(); await settle();
  track.currentTime = 60 / 126;
  assert.ok(Math.abs(music.clock() - 60 / 90) < 1e-9, 'tempo changes music and beat clock together');
  assert.equal(graph.music.target,0,'music-only mute leaves the FX bus on');assert.equal(graph.effects.target,1);
  assert.equal(contexts,1);assert.equal(sources,1,'one graph/source across pause, mute, restart and resume');
  console.log('PASS shared audio graph, iOS-style volume restriction, independent levels, ducking, clock, autoplay and lifecycle');
})().catch(error => { console.error(error); process.exitCode = 1; });
