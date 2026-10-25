'use strict';
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
let checks = 0;
function test(name, run) { run(); checks++; console.log('PASS ' + name); }
function game(layer = 0, difficulty = 'normal', seed = 7, storage) {
  return createGame({ search: `?capture=1&tut=0&bot=none&layer=${layer}&difficulty=${difficulty}&seed=${seed}`, storage });
}
// Controlled contact poses isolate scoring from player skill and visual RNG.
// Natural campaigns below separately exercise the unchanged input and contact paths.
function hit(g) {
  const r = g.inspect.st.round, p = g.inspect.player;
  const margin = g.inspect.perfBand() / 2;
  p.P.rim.y = g.inspect.toastRimY() + margin; p.tilt = p.w = p.cupRate = 0;
  p.wine = .8; r.manual = true; r.t = .5 + r.T;
  r.mh = Array.from({ length: 10 }, (_, i) => [g.inspect.st.t - i / 60, margin, 0, 0]);
  g.inspect.judgeClink();
}
function miss(g) { g.inspect.player.wine = .8; g.inspect.strike(null, null, 'late'); g.inspect.finishToastAttempt(); }
function next(g) { assert.equal(g.inspect.st.round.phase, 'react'); g.inspect.newRound(false); }

test('fixed opportunities survive retries across story, endless, seeds and modes', () => {
  const expected = [3, 3, 2, 2, 2, 2, 4, 6, 8, 3, 3, 3, 2, 6, 3];
  for (let layer = 0; layer < expected.length; layer++) for (const difficulty of ['easy', 'normal', 'hard']) for (const seed of [1, 7]) {
    const clean = game(layer, difficulty, seed), retry = game(layer, difficulty, seed);
    assert.equal(clean.inspect.st.floorPlan.claimed.length, expected[layer]);
    const original = retry.inspect.st.round, target = original.target, choice = original.alienChoice, event = original.event;
    const notes = original.chain || 1;
    for (let i = 0; i < notes; i++) miss(retry);
    next(retry);
    assert.equal(retry.inspect.st.round.target, target);
    assert.equal(retry.inspect.st.round.alienChoice, choice);
    assert.equal(retry.inspect.st.round.event, event);
    assert.equal(retry.inspect.st.round.progress, 0);
    assert.equal(retry.inspect.st.floorPlan.claimed.length, expected[layer]);
    const combo = retry.inspect.st.combo, hype = retry.inspect.st.hype;
    for (let i = 0; i < notes; i++) hit(retry);
    assert.equal(retry.inspect.st.score, 0, 'retries cannot earn any points');
    assert.equal(retry.inspect.st.combo, combo); assert.equal(retry.inspect.st.hype, hype);
    assert.equal(retry.inspect.st.perfects, 0); assert.equal(retry.inspect.st.bursts, 0);
    next(retry);
    for (let i = 0; i < notes; i++) hit(clean);
    next(clean);
    assert.equal(retry.inspect.st.round.progress, 1);
    assert.equal(retry.inspect.st.round.target, clean.inspect.st.round.target);
    while (!clean.inspect.st.round.smash) {
      const n = clean.inspect.st.round.chain || 1;
      for (let i = 0; i < n; i++) { hit(clean); hit(retry); }
      next(clean); next(retry);
    }
    assert.equal(retry.inspect.st.round.smash, true);
    assert.equal(clean.inspect.st.floorPlan.claimed.filter(x => x === 'hit').length, expected[layer]);
    assert.equal(retry.inspect.st.floorPlan.claimed.filter(x => x === 'hit').length, expected[layer] - notes);
    assert.ok(clean.inspect.st.score > retry.inspect.st.score);
  }
});

test('a missed middle chain note loses only that opportunity, never replays earned notes', () => {
  const g = game(8), plan = g.inspect.st.floorPlan;
  hit(g); const score = g.inspect.st.score;
  miss(g); assert.equal(g.inspect.st.score, score);
  hit(g); hit(g); next(g);
  assert.deepEqual(Array.from(plan.claimed.slice(0, 4)), ['hit', 'miss', 'hit', 'hit']);
  assert.equal(g.inspect.st.round.progress, 1);
  assert.equal(g.inspect.st.round.chainIndex, 0);
});

test('duplicate judgments and floor awards cannot score twice; restart clears claims', () => {
  const g = game(); hit(g); const score = g.inspect.st.score;
  g.inspect.judgeClink(); assert.equal(g.inspect.st.score, score);
  g.inspect.st.round.result = null; g.inspect.st.round.phase = 'aim'; hit(g);
  assert.equal(g.inspect.st.score, score);
  g.inspect.breakFloor(); const floorScore = g.inspect.st.score;
  g.inspect.st.state = 'play'; g.inspect.breakFloor(); assert.equal(g.inspect.st.score, floorScore);
  g.api.restart(); assert.equal(g.inspect.st.score, 0);
  assert.ok(g.inspect.st.floorPlan.claimed.every(x => x === null));
});

test('story clear award occurs only at twelve completed floors from the first stage', () => {
  const g = game(); g.inspect.st.L = 11; g.inspect.st.breaks = 11; g.inspect.newRound(true);
  const before = g.inspect.st.score, wine = g.inspect.player.wine, cfg = g.inspect.config;
  g.inspect.breakFloor();
  assert.equal(g.inspect.st.score - before, cfg.floorScore * 12 + Math.round(wine * 120 * 12) + cfg.clearScore);
  const jumped = game(11); jumped.inspect.breakFloor();
  assert.equal(jumped.inspect.st.score, cfg.floorScore * 12 + Math.round(jumped.inspect.player.wine * 120 * 12));
});

test('one shared highest score retains its difficulty across reloads and lower runs', () => {
  const g = game(0, 'hard', 7, { 'toastLower.best': '999999' });
  assert.equal(g.inspect.st.hiscore, 0, 'legacy scores are not compared to the new formula');
  hit(g); const score = g.inspect.st.score; g.inspect.gameOver('beer');
  assert.equal(g.storage.get('toastLower.best'), '999999', 'legacy record remains untouched');
  const restored = game(0, 'easy', 7, Object.fromEntries(g.storage));
  assert.equal(restored.inspect.st.hiscore, score); assert.equal(restored.inspect.st.bestDifficulty, 'hard');
  restored.inspect.gameOver('beer'); assert.equal(restored.inspect.st.bestDifficulty, 'hard');
  restored.api.restart(); restored.inspect.st.score = score + 1; restored.inspect.gameOver('beer');
  const again = game(0, 'normal', 7, Object.fromEntries(restored.storage));
  assert.equal(again.inspect.st.hiscore, score + 1); assert.equal(again.inspect.st.bestDifficulty, 'easy');
});
console.log(`${checks}/${checks} scoring checks passed`);
