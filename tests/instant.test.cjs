'use strict';
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function game(layer = 0, mode = 'normal', options = {}) {
  const g = createGame({ search: `?tut=0&seed=7&layer=${layer}&difficulty=${mode}`, ...options });
  g.tap('Enter'); return g;
}
function pose(g, offset = 0) {
  const r = g.inspect.st.round, p = g.inspect.player, margin = g.inspect.perfBand() / 2;
  r.t = r.T + .5 - g.inspect.reachTime() - offset;
  g.inspect.revealAlienTarget();
  p.P.rim.y = g.inspect.toastRimY() + margin;
  p.w = p.tilt = p.cupRate = 0;
  r.mh = Array.from({ length: 10 }, (_, i) => [g.inspect.st.t - i / 60, margin, 0, 0]);
  r.cue = { next: 2, target: r.T + .5 - g.inspect.reachTime(), gap: 60 / g.inspect.config.musicBpm };
}
test('zero tap gives same-event judgement and a visual gesture without changing height or wine', () => {
  for (const layer of [0, 3, 6, 7, 8, 9, 10, 11]) for (const mode of ['easy', 'normal', 'hard']) {
    const g = game(layer, mode); pose(g);
    const r = g.inspect.st.round, p = g.inspect.player, beforeY = p.P.rim.y, wine = p.wine;
    const tc = r.partner, others = g.inspect.st.alien?.leaders.filter(c => c !== tc).map(c => [c, c.x]);
    const beforeX = tc.x;
    g.tap('Space');
    assert.equal(g.inspect.contacts.length, 1); assert.equal(g.inspect.st.toasts, 1);
    assert.ok(Math.abs(g.inspect.contacts[0].timing) < 1e-9);
    assert.equal(p.P.rim.y, beforeY); assert.equal(p.wine, wine);
    assert.equal(tc.x, beforeX, 'the immediate judgement cannot teleport the leader');
    const m = g.inspect.st.toastMotion; g.inspect.stepToastMotion(m.contact);
    const pp = g.inspect.toastPose(p, p.P), bp = g.inspect.toastPose(tc, tc.P);
    assert.ok(Math.abs(bp.rim.x - pp.rim.x - 24 * p.spec.scale) < 1e-8);
    for (const [c, x] of others || []) assert.equal(c.x, x);
    const sounds = g.sandbox.__sounds.map(s => s.type);
    assert.ok(sounds.includes('countGo')); assert.ok(sounds.includes('perfect'));
  }
});
test('early accepted taps preserve the third cue and cannot score the same beat twice', () => {
  for (const layer of [0, 6, 7, 8, 9]) {
    const g = game(layer); pose(g, .08);
    const r = g.inspect.st.round;
    g.tap('Space'); const score = g.inspect.st.score;
    assert.equal(g.inspect.contacts.length, 1); assert.equal(r.waitForBeat, true);
    g.tap('Space'); assert.equal(g.inspect.contacts.length, 1);
    r.t += .08; g.inspect.stepRound(0);
    assert.equal(g.sandbox.__sounds.filter(s => s.type === 'countGo').length, 1);
    assert.equal(g.inspect.st.score, score); assert.equal(r.waitForBeat, false);
    assert.equal(r.chain ? r.chainIndex : r.phase, r.chain ? 1 : 'react');
  }
});
test('early-hit feedback cannot freeze the clock or delay the upcoming audible beat', () => {
  for (const layer of [0, 8, 9]) {
    const g = game(layer); pose(g, .08);
    const r = g.inspect.st.round, zero = r.T + .5 - g.inspect.reachTime();
    r.musicAnchor = 10; g.sandbox.__musicClock = 10 + r.t;
    g.tap('Space'); assert.equal(g.inspect.st.freeze, 0);
    assert.equal(g.inspect.contacts[0].result, 'ok');
    for (let f = 1; f <= 8; f++) { g.sandbox.__musicClock = 10 + zero - .08 + f / 60; g.advance(1); }
    const pulses = g.sandbox.__sounds.filter(s => s.type === 'countGo');
    assert.equal(pulses.length, 1); assert.ok(Math.abs(pulses[0].inputLeft) < 1 / 60);
    assert.equal(g.inspect.st.toasts, 1);
  }
});
test('live music clock is sampled at the tap rather than using the previous rendered frame', () => {
  const g = game(); pose(g, .15); const r = g.inspect.st.round;
  r.musicAnchor = 10; g.sandbox.__musicClock = 10 + r.T + .5 - g.inspect.reachTime();
  g.tap('Space'); assert.ok(Math.abs(g.inspect.contacts[0].timing) < 1e-9);
});
test('only the centre beat flashes red; expired numeric zero vanishes while late taps still work', () => {
  for (const layer of [0, 8, 9]) {
    const labels = [];
    const g = game(layer, 'normal', {onDraw(k, a) { if (k === 'fillText') labels.push(a[0]); }});
    pose(g, .10); assert.equal(g.inspect.toastClockVisual().color, '#ffffff');
    pose(g); assert.equal(g.inspect.toastClockVisual().label, '0s'); assert.equal(g.inspect.toastClockVisual().color, '#ff6666');
    pose(g, -.08); assert.equal(g.inspect.toastClockVisual().label, '');
    g.render(); assert.ok(!labels.some(s => s === '0.0s'));
    g.tap('Space'); assert.equal(g.inspect.st.toasts, 1, 'late tolerance stays intact');
    const expired = game(layer); pose(expired, -.20); assert.equal(expired.inspect.toastClockVisual().alpha, 0);
  }
});
test('timeout uses the input window once; no delayed reach can cause a second penalty', () => {
  for (const layer of [0, 8, 9]) {
    const g = game(layer); pose(g, -g.api.dbg().timingWindow - .001);
    const r = g.inspect.st.round;
    g.inspect.stepRound(0); const penalty = g.inspect.st.wineLedger.penalty;
    assert.equal(g.inspect.st.strikes, 1);
    g.inspect.stepRound(0); assert.equal(g.inspect.st.strikes, 1); assert.equal(g.inspect.st.wineLedger.penalty, penalty);
    if (!r.chain) { g.tap('Space'); assert.equal(g.inspect.st.strikes, 1); }
  }
});
console.log(`${checks}/${checks} immediate feedback checks passed`);
