'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createGame } = require('./harness.cjs');

const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const source = option('--source');
const reportPath = option('--report');
const matrixOnly = args.includes('--matrix-only');
const quick = args.includes('--quick');
const results = [];
const report = { source: source || 'game.js', tests: results, matrix: [], campaigns: [], exploits: [] };

function test(name, run) {
  try { run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
function game(search = '?tut=0&seed=20261022', options = {}) { return createGame({ source, search, ...options }); }
function finiteState(g) {
  const s = g.api.state(), p = g.inspect.player;
  for (const key of ['score', 'beer', 'strikes', 'toasts', 'perfects', 'depth', 'tilt']) assert.ok(Number.isFinite(s[key]), `${key} is finite`);
  for (const key of ['x', 'y', 'tilt', 'wine']) assert.ok(Number.isFinite(p[key]), `player.${key} is finite`);
  assert.ok(p.wine >= 0 && p.wine <= g.inspect.wineCapacity() + 1e-9, `wine remains within this cup: ${p.wine}`);
}
function until(g, predicate, maxFrames = 600) {
  for (let frame = 0; frame < maxFrames; frame++) {
    if (predicate()) return;
    g.advance(1);
  }
  assert.ok(predicate(), `condition reached within ${maxFrames} frames`);
}
function playCampaign(bot, seed, targetLayer = 12) {
  const g = game(`?capture=1&tut=0&bot=${bot}&seed=${seed}`);
  let frames = 0, firstFloor = null;
  while (frames < 60 * 300 && g.inspect.st.state !== 'over' && g.inspect.st.L < targetLayer) {
    g.advance(1); frames++;
    if (firstFloor === null && g.inspect.st.L > 0) firstFloor = frames / 60;
    if (frames % 60 === 0) finiteState(g);
  }
  g.render(); const s = g.api.state();
  return { bot, seed, seconds: +(frames / 60).toFixed(2), layer: s.layer,
    firstFloor, toasts: s.toasts, perfects: s.perfects, manual: g.inspect.st.manualToasts,
    strikes: s.strikes, beer: s.beer, cupPresses: s.qw?.presses || 0, why: s.why,
    over: s.over?.reason || null };
}

if (!matrixOnly) {
  test('music follows user start, mute, pause, hidden page, restart and game over', () => {
    const g = game('?tut=0', { storage: { toast_mute: '0' } });
    assert.equal(g.sandbox.__music, undefined, 'no playback before interaction');
    g.tap('Enter'); assert.equal(g.sandbox.__music.playing, true);
    assert.equal(g.sandbox.__music.volume, 0.28);
    g.tap('KeyM'); assert.equal(g.sandbox.__music.volume, 0); assert.equal(g.sandbox.__music.playing, true, 'silent clock keeps its phase');
    g.tap('KeyM'); assert.equal(g.sandbox.__music.playing, true);
    g.tap('Escape'); assert.equal(g.sandbox.__music.playing, false);
    g.tap('Escape'); assert.equal(g.sandbox.__music.playing, true);
    g.sandbox.document.hidden = true; g.sandbox.document.dispatch('visibilitychange');
    assert.equal(g.sandbox.__music.playing, false);
    g.sandbox.document.hidden = false; g.sandbox.document.dispatch('visibilitychange');
    assert.equal(g.sandbox.__music.playing, false, 'returning does not unpause the game');
    g.tap('Escape'); assert.equal(g.sandbox.__music.playing, true);
    g.inspect.player.wine = 0.1; g.inspect.strike(null, null, 'late');
    assert.equal(g.sandbox.__music.playing, false);
    g.tap('KeyR'); assert.equal(g.sandbox.__music.playing, true);
    const bot = game('?capture=1&tut=0&bot=expert', { storage: { toast_mute: '0' } });
    bot.tap('KeyO'); assert.equal(bot.sandbox.__music.playing, false);
  });
  test('a missed toast deducts 20 percent once and lethal loss cannot refill', () => {
    const g = game(); g.tap('Enter'); g.inspect.player.wine = 0.5;
    g.inspect.strike('miss', null, 'late');
    assert.ok(Math.abs(g.inspect.player.wine - 0.3) < 1e-9);
    g.inspect.strike('miss', null, 'late');
    assert.ok(Math.abs(g.inspect.player.wine - 0.3) < 1e-9);
    const lethal = game(); lethal.tap('Enter'); lethal.inspect.player.wine = 0.2;
    lethal.inspect.strike('miss', null, 'late');
    assert.equal(lethal.api.state().over.reason, 'beer'); lethal.advance(120);
    assert.equal(lethal.inspect.player.wine, 0);
  });
  test('parameter edits save explicitly, persist, validate, and reset to file values', () => {
    const g = game(), c = g.sandbox.ToastConfig;
    assert.equal(g.inspect.config.roundWait, 2);
    g.key('KeyD', true, { shiftKey: true }); g.key('KeyD', false);
    let settings = g.inspect.settings;
    const draft = { ...settings.values, roundWait: 2.1 };
    assert.equal(g.inspect.config.roundWait, 2, 'editing a draft does not alter the game');
    settings.onSave({ ...settings, values: draft }); settings.onClose();
    assert.equal(g.inspect.config.roundWait, 2.1);
    const restored = game('?tut=0', { storage: Object.fromEntries(g.storage) });
    assert.equal(restored.inspect.config.roundWait, 2.1);
    settings.onSave({ ...settings, values: c.defaults });
    assert.equal(g.inspect.config.roundWait, 2);
    g.tap('Enter'); g.tap('Escape');
    g.key('KeyD', true, { shiftKey: true }); g.key('KeyD', false);
    settings = g.inspect.settings;
    assert.equal(settings.paused, true);
    settings.onSave({ ...settings, values: { ...settings.values, roundWait: 2.1 } }); settings.onClose();
    assert.equal(g.api.state().state, 'play'); assert.equal(g.api.dbg().paused, false);
    assert.ok(Math.abs(g.inspect.st.round.T + 0.5 - 2.1) < 1e-9);
    const changedDefaults = game('?tut=0', { storage: { 'toastLower.parameters.v1': JSON.stringify({ signature: 'old defaults', values: { roundWait: 5 } }) } });
    assert.equal(changedDefaults.inspect.config.roundWait, 2);
    const valid = c.validate({ spillMultiplier: NaN, missPenalty: 999, normalTime: 0.1, normalTaper: 0.3 });
    assert.equal(valid.spillMultiplier, 1); assert.equal(valid.missPenalty, 100);
    assert.ok(valid.normalTime - valid.normalTaper >= 0.05);
  });
  test('spill multiplier and per-second cap change actual wine loss', () => {
    const trials = [0, 1, 3].map(multiplier => {
      const g = game(); g.inspect.config.spillMultiplier = multiplier;
      g.inspect.config.spillMax = 5; g.tap('Enter'); g.key('KeyW'); g.advance(100);
      assert.equal(g.api.state().strikes, 0);
      return 1 - g.inspect.player.wine;
    });
    assert.equal(trials[0], 0); assert.ok(trials[1] > 0);
    assert.ok(trials[2] >= trials[1]); assert.ok(trials[2] <= 0.05 * 100 / 60 + 1e-9);
  });
  test('control tuning is available only inside the hidden debug panel', () => {
    const g = game(), original = g.api.dbg().ctl;
    g.tap('KeyC'); assert.equal(g.api.dbg().ctl, original);
    assert.equal(g.api.state().state, 'title');
    g.key('KeyD', true, { shiftKey: true }); g.key('KeyD', false);
    g.tap('KeyC'); assert.equal(g.api.dbg().ctl, original);
    g.tap('Enter'); assert.equal(g.api.state().state, 'title');
    const settings = g.inspect.settings;
    settings.onSave({ ...settings, ctl: original === 'accel' ? 'vel' : 'accel' });
    assert.notEqual(g.api.dbg().ctl, original);
    settings.onClose(); g.tap('Enter'); assert.equal(g.api.state().state, 'play');
  });
  test('misses cost wine instead of lives and completed rounds refill once', () => {
    const g = game(); g.tap('Enter');
    until(g, () => g.api.state().strikes >= 3, 1800);
    assert.equal(g.api.state().state, 'play');
    const round = g.inspect.st.round;
    g.inspect.player.wine = 0.5;
    let before = g.inspect.player.wine;
    for (let i = 0; i < 90 && g.inspect.st.round === round; i++) {
      before = g.inspect.player.wine; g.advance(1);
    }
    assert.notEqual(g.inspect.st.round, round);
    const refill = g.inspect.player.wine - before;
    // Continuous spilling can still drain up to 0.11 / 60 on this frame.
    assert.ok(refill >= 0.03 - 0.11 / 60 - 1e-9 && refill <= 0.03 + 1e-9);
    const wine = g.inspect.player.wine; g.advance(3);
    assert.ok(g.inspect.player.wine <= wine + 1e-9, 'no repeated refill during aim');
  });
  test('difficulty selection stays on title, persists, and changes timing and setup', () => {
    const windows = [], durations = [];
    assert.equal(game().api.dbg().difficulty, 'normal');
    for (const [i, id] of ['easy', 'normal', 'hard'].entries()) {
      const g = game(); g.tap(`Digit${i + 1}`);
      assert.equal(g.api.state().state, 'title');
      assert.equal(g.api.dbg().difficulty, id);
      assert.equal(g.storage.get('toastLower.difficulty'), id);
      const restored = game('?tut=0', { storage: Object.fromEntries(g.storage) });
      assert.equal(restored.api.dbg().difficulty, id);
      g.tap('Enter');
      windows.push(g.api.dbg().timingWindow); durations.push(g.inspect.st.round.T);
      g.tap('KeyR'); assert.equal(g.api.dbg().difficulty, id);
      g.render();
    }
    assert.ok(windows[0] > windows[1] && windows[1] > windows[2]);
    assert.ok(durations[0] > durations[1] && durations[1] > durations[2]);
    assert.ok(Math.abs(durations[1] + 0.5 - 2) < 1e-9, 'normal opening countdown is 2 seconds');
    assert.equal(game('?tut=0&difficulty=invalid').api.dbg().difficulty, 'normal');
  });
  test('title starts, QWOP respond, keyup and blur release input', () => {
    const g = game();
    assert.equal(g.api.state().state, 'title'); g.render();
    g.tap('Enter'); assert.equal(g.api.state().state, 'play');
    for (const code of ['KeyQ', 'KeyW', 'KeyO', 'KeyP']) {
      const key = code.at(-1); g.key(code); assert.equal(g.api.state().keys[key], 1);
      g.key(code, false); assert.equal(g.api.state().keys[key], 0);
    }
    g.key('KeyO'); g.advance(12); assert.ok(g.inspect.player.h > 0, 'bow control moves the body');
    g.dispatch('blur'); assert.ok(Object.values(g.api.state().keys).every(v => !v));
    finiteState(g);
  });
  test('pause freezes game time and releases controls; resume and restart work', () => {
    const g = game(); g.tap('Enter'); g.key('KeyO'); g.advance(12); g.tap('Escape');
    assert.equal(g.api.dbg().paused, true);
    const time = g.inspect.st.t, h = g.inspect.player.h;
    g.advance(240, true); assert.equal(g.inspect.st.t, time); assert.equal(g.inspect.player.h, h);
    assert.ok(Object.values(g.api.state().keys).every(v => !v));
    g.tap('Escape'); assert.equal(g.api.dbg().paused, false);
    g.advance(12); assert.ok(g.inspect.st.t > time);
    g.tap('KeyR'); const s = g.api.state();
    assert.equal(s.state, 'play'); assert.equal(s.score, 0); assert.equal(s.strikes, 0); assert.equal(s.toasts, 0); assert.equal(s.layer, 0);
    assert.equal(g.inspect.player.h, 0); assert.ok(Object.values(s.keys).every(v => !v));
  });
  test('touch drag switches controls and all release paths clear them', () => {
    const g = game(); g.tap('Enter');
    g.pointer('pointerdown', 'O'); assert.equal(g.api.state().keys.O, 1);
    g.pointer('pointermove', 'P'); assert.equal(g.api.state().keys.O, 0); assert.equal(g.api.state().keys.P, 1);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      g.pointer('pointerdown', 'Q'); g.pointer(event, 'Q');
      assert.ok(Object.values(g.api.state().keys).every(v => !v), event);
    }
    g.pointer('pointerdown', 'O'); g.dispatch('blur');
    assert.ok(Object.values(g.api.state().keys).every(v => !v));
    if (g.api.dbg().paused) g.tap('Enter');
    // A stale pointer must not resurrect a held key after focus returns.
    g.pointer('pointerdown', 'Q', 2); g.pointer('pointerup', 'Q', 2);
    assert.ok(Object.values(g.api.state().keys).every(v => !v), 'stale pointer cleared by blur');
  });
  test('keyboard and touch coexist; aliases release independently', () => {
    const g = game(); g.tap('Enter');
    g.key('KeyO'); g.pointer('pointerdown', 'Q');
    assert.equal(g.api.state().keys.O, 1); assert.equal(g.api.state().keys.Q, 1);
    g.pointer('pointerup', 'Q'); assert.equal(g.api.state().keys.O, 1);
    g.key('ArrowDown'); g.key('KeyO', false); assert.equal(g.api.state().keys.O, 1);
    g.key('ArrowDown', false); assert.equal(g.api.state().keys.O, 0);
    g.pointer('pointerdown', 'O'); g.tap('Escape'); g.tap('Escape');
    g.pointer('pointerdown', 'Q', 2); g.pointer('pointerup', 'Q', 2);
    assert.ok(Object.values(g.api.state().keys).every(v => !v), 'pause clears pointer history');
    g.pointer('pointerdown', 'O'); g.tap('KeyR');
    g.pointer('pointerdown', 'Q', 2); g.pointer('pointerup', 'Q', 2);
    assert.ok(Object.values(g.api.state().keys).every(v => !v), 'restart clears pointer history');
  });
  test('tab hide pauses and releases input; key repeats cannot toggle pause', () => {
    const g = game(); g.tap('Enter'); g.key('KeyO');
    g.sandbox.document.hidden = true; g.sandbox.document.dispatch('visibilitychange');
    assert.equal(g.api.dbg().paused, true); assert.ok(Object.values(g.api.state().keys).every(v => !v));
    g.sandbox.document.hidden = false; g.sandbox.document.dispatch('visibilitychange');
    assert.equal(g.api.dbg().paused, true); g.tap('Enter');
    g.key('Escape'); g.key('Escape', true, { repeat: true }); assert.equal(g.api.dbg().paused, true);
    g.tap('Escape'); assert.equal(g.api.dbg().paused, false);
  });
  test('first-run tutorial renders and can be deliberately skipped', () => {
    const g = game('?tut=1&seed=20261022', { storage: { toast_mute: '1' } });
    assert.ok(g.api.tut()); g.tap('Enter'); g.advance(120, true);
    g.tap('KeyS'); assert.equal(g.api.tut(), null); assert.equal(g.api.state().state, 'play');
    g.advance(60, true); finiteState(g);
  });
  test('normal games do not expose the floor-skip debug shortcut', () => {
    const g = game(); g.tap('Enter'); g.tap('BracketRight');
    assert.equal(g.api.state().state, 'play'); assert.equal(g.api.state().layer, 0);
  });
  test('Space starts one physical reach; release and repeats do not change the committed beat', () => {
    const g = game(); g.tap('Enter'); g.advance(24);
    g.key('Space'); const r = g.inspect.st.round, deadline = r.T + 0.5;
    assert.equal(g.api.state().reach, 0); assert.equal(g.api.state().manualToasts, 0);
    assert.equal(r.attacking, true); assert.equal(r.attempts, 1);
    for (let i = 0; i < 12; i++) g.key('Space', true, { repeat: true });
    assert.equal(r.attempts, 1); g.advance(8); const reach = g.inspect.player.reach;
    assert.ok(reach > 0 && reach < 0.8); assert.equal(g.api.state().manualToasts, 0);
    assert.equal(g.api.dbg().reach, g.inspect.player.reach, 'debug reports actual reach, not cup window');
    g.key('Space', false); g.advance(6); assert.ok(g.inspect.player.reach > reach, 'the tap commits to a complete swing');
    assert.equal(r.T + 0.5, deadline, 'pressing never moves the leader deadline');
    until(g, () => g.inspect.contacts.length > 0, 60);
    assert.equal(g.inspect.contacts.length, 1); assert.equal(g.api.state().manualToasts, 1); g.render();
  });
  test('touch taps start a physical reach in desktop and landscape layouts', () => {
    for (const view of ['desktop', 'landscape']) {
      const g = game(`?tut=0&seed=20261022&view=${view}`, { width: view === 'portrait' ? 390 : view === 'landscape' ? 844 : 1080, height: view === 'portrait' ? 844 : view === 'landscape' ? 390 : 1080 });
      g.tap('Enter'); g.advance(24); g.pressAction();
      assert.equal(g.inspect.st.round.attacking, true); g.advance(8); const reach = g.inspect.player.reach;
      assert.ok(reach > 0 && reach < 1); assert.equal(g.api.state().manualToasts, 0);
      g.actionPointer('pointercancel'); g.advance(6); assert.ok(g.inspect.player.reach > reach);
      until(g, () => g.inspect.contacts.length === 1, 60);
      assert.ok(Object.values(g.api.state().keys).every(v => !v));
    }
  });
  test('both hands and the target stay live throughout the reach', () => {
    const g = game(); g.tap('Enter'); g.advance(24); g.key('Space');
    const p = g.inspect.player, h = p.h, tilt = p.tilt, bossY = g.inspect.toastRimY();
    g.key('KeyO'); g.key('KeyQ'); g.advance(18);
    assert.ok(p.h > h + 0.01, 'body responds while reaching');
    assert.ok(Math.abs(p.tilt - tilt) > 0.02, 'wrist responds while reaching');
    assert.notEqual(g.inspect.toastRimY(), bossY, 'target is not frozen at the button press');
    assert.ok(p.reach > 0 && p.reach < 1); assert.equal(g.inspect.contacts.length, 0);
    g.key('KeyO', false); g.key('KeyQ', false); g.key('Space', false);
  });
  test('contact uses the live pose; tipping has no separate leader-splash penalty', () => {
    const good = game('?capture=1&tut=0&bot=expert&seed=20261022');
    until(good, () => good.inspect.contacts.length > 0, 600);
    const goodHit = good.inspect.contacts[0];
    assert.equal(goodHit.result, 'ok'); assert.equal(goodHit.margin, goodHit.judgedMargin);
    assert.equal(goodHit.reach, 1);
    const bad = game('?capture=1&tut=0&bot=expert&seed=20261022');
    until(bad, () => bad.inspect.player.reach > 0.1, 600);
    const atPress = bad.inspect.player.P.rim.y - bad.inspect.toastRimY();
    // Alter only the player's input, never geometry or judgment state.
    bad.overrideControls({ Q: 0, W: 1, Space: 1 });
    until(bad, () => bad.inspect.contacts.length > 0, 180);
    const badHit = bad.inspect.contacts[0];
    assert.equal(bad.inspect.st.why?.tilt, undefined);
    assert.ok(!bad.api.dbg().jword.includes('一身'));
    assert.equal(badHit.result, badHit.margin >= 0 && badHit.margin <= bad.inspect.winSpan() && Math.abs(badHit.timing) <= bad.api.dbg().timingWindow ? 'ok' : 'strike');
    assert.equal(badHit.margin, badHit.judgedMargin); assert.notEqual(badHit.margin, atPress);
    assert.ok(badHit.level > goodHit.level);
  });
  test('full hype rewards score without duplicate wine or skipping the floor', () => {
    const g = game('?capture=1&tut=0&bot=expert&seed=20261022');
    // Set up a nearly full reward meter; movement and contact remain natural.
    g.inspect.st.hype = 99; g.inspect.player.wine = 0.5;
    until(g, () => g.inspect.st.toasts > 0, 600);
    assert.equal(g.inspect.st.bursts, 1); assert.equal(g.inspect.st.hype, 0);
    assert.ok(g.inspect.player.wine <= 0.5 && g.inspect.player.wine > 0.45); assert.equal(g.inspect.st.breaks, 0);
    assert.ok(g.inspect.st.score >= 500); assert.ok(!g.inspect.st.judge.bonus.includes('回酒'));
    const firstRound = g.inspect.st.round;
    until(g, () => g.inspect.st.round !== firstRound, 180);
    assert.equal(g.inspect.st.L, 0); assert.equal(g.inspect.st.state, 'play');
    assert.equal(g.inspect.st.breaks, 0); assert.equal(g.inspect.st.round.smash, false);
  });
  test('default controls have bounded inertia and opposite input can brake it', () => {
    const g = game(); g.tap('Enter'); assert.equal(g.api.ctl(), 'accel');
    g.key('KeyO'); g.advance(15); const h = g.inspect.player.h;
    g.key('KeyO', false); g.advance(6); const coast = g.inspect.player.h - h;
    assert.ok(coast > 0.001 && coast < 0.075, `small real coasting distance: ${coast}`);
    g.key('KeyP'); g.advance(9); assert.ok(g.inspect.player.vh < 0, 'reverse input brakes and reverses within 150 ms');
  });
  test('bowing disturbs the wrist and active counter-steering improves balance', () => {
    function exercise(balance) {
      const g = game(); g.tap('Enter'); let energy = 0;
      g.key('KeyO');
      for (let f = 0; f < 60; f++) {
        if (f === 30) { g.key('KeyO', false); g.key('KeyP'); }
        if (balance) {
          const p = g.inspect.player, error = p.tilt + 0.15 * p.cupRate + p.w;
          g.key('KeyQ', error > 0.025); g.key('KeyW', error < -0.025);
        }
        g.advance(1); energy += Math.abs(g.inspect.player.tilt + g.inspect.player.w);
      }
      return energy;
    }
    const unattended = exercise(false), coordinated = exercise(true);
    assert.ok(unattended > 2, 'body movement visibly disturbs the drink');
    assert.ok(coordinated < unattended * 0.8, `counter-steering reduces deviation: ${coordinated} vs ${unattended}`);
  });
  test('cup angle stops at 45 degrees in either direction and can reverse', () => {
    for (const ctl of ['accel', 'vel']) for (const [forward, reverse, sign] of [['KeyW', 'KeyQ', 1], ['KeyQ', 'KeyW', -1]]) {
      const g = game(`?tut=0&ctl=${ctl}`); g.tap('Enter'); g.key(forward);
      for (let f = 0; f < 110; f++) { g.advance(1); assert.ok(Math.abs(g.inspect.player.tilt) <= Math.PI / 4 + 1e-9); }
      assert.ok(sign * g.inspect.player.tilt > 0.7);
      g.key(forward, false); g.key(reverse); g.advance(22);
      assert.ok(sign * g.inspect.player.tilt < 0.65, 'reversing releases the angle stop');
    }
  });
  test('reach itself adds no forced forward cup rotation; body motion couples in both directions', () => {
    const g = game(); g.tap('Enter');
    function trial(speed, reach, reachV) {
      const p = { ...g.inspect.player, tilt: 0, vtilt: 0, vet: 0, tdr: 0, swv: 0, vh: speed, veh: 0, cupBodySpeed: 0, w: 0, wv: 0, reach, reachV };
      g.inspect.moveCup(p, {}, 1 / 60, g.inspect.diff()); return p.tilt;
    }
    assert.equal(trial(0, 0, 0), trial(0, 1, 3));
    assert.ok(trial(0.4, 0, 0) > 0); assert.ok(trial(-0.4, 0, 0) < 0);
    assert.ok(Math.abs(trial(0.4, 0, 0) + trial(-0.4, 0, 0)) < 1e-9);
  });
  test('smaller cups cap actual wine, start full, and respect configured capacity and refills', () => {
    let previous = 1;
    for (const layer of [0, 4, 9, 14, 30]) {
      const g = game(`?capture=1&tut=0&bot=none&layer=${layer}`), cap = g.inspect.wineCapacity();
      assert.ok(cap <= previous && cap >= 0.6); previous = cap;
      assert.equal(g.inspect.player.wine, cap);
      g.inspect.player.wine = cap - 0.01; g.inspect.refillWine(0.1); assert.equal(g.inspect.player.wine, cap);
      g.inspect.config.minCapacity = 80; assert.ok(g.inspect.wineCapacity() >= 0.8);
      g.api.restart(); assert.equal(g.inspect.player.wine, g.inspect.wineCapacity());
    }
    const g = game('?tut=0&layer=14'); g.tap('Enter');
    g.inspect.strike(null, null, 'late'); assert.ok(Math.abs(g.inspect.player.wine - 0.4) < 1e-9);
  });
  test('perfect requires precise timing and sustained cup stability and awards points', () => {
    // Isolate judgment boundaries with synthetic contact geometry, not a simulated successful run.
    function contact(timing, unstableHistory = false, fast = false) {
      const g = game(); g.tap('Enter'); const p = g.inspect.player, r = g.inspect.st.round;
      const margin = g.inspect.perfBand() / 2;
      p.P.rim.y = g.inspect.toastRimY() + margin; p.tilt = p.w = 0; p.cupRate = fast ? 2 : 0;
      p.wine = 0.5; r.manual = true; r.t = 0.5 + r.T - timing;
      r.mh = Array.from({ length: 10 }, (_, i) => [g.inspect.st.t - i / 60, margin, unstableHistory && i === 5 ? 1 : 0, 0]);
      g.inspect.judgeClink(); return g;
    }
    const perfect = contact(0), early = contact(0.25), late = contact(-0.25), shaky = contact(0, true), fast = contact(0, false, true);
    assert.equal(perfect.api.state().perfects, 1);
    for (const g of [early, late, shaky, fast]) { assert.equal(g.api.state().toasts, 1); assert.equal(g.api.state().perfects, 0); }
    assert.ok(perfect.api.state().score > shaky.api.state().score);
    assert.equal(perfect.inspect.player.vtilt, 0, 'contact does not force the wrist forwards');
    assert.ok(Math.abs(perfect.inspect.player.wine - 0.485) < 1e-9, 'perfect no longer adds wine by default');
  });
  test('repeat floor smashing keeps the first reveal and shortens later preparation and charge', () => {
    function trial(breaks) {
      const g = game(); g.tap('Enter'); const r = g.inspect.st.round;
      g.inspect.st.breaks = breaks; r.smash = true; r.phase = 'tie'; r.t = 0;
      g.inspect.stepRound(0.5); const phase = r.phase;
      r.phase = 'aim'; g.inspect.player.h = 1; g.key('KeyO');
      g.inspect.pressCheck(0.1, g.inspect.diff());
      return { phase, pressure: g.inspect.st.pressure };
    }
    const first = trial(0), later = trial(1);
    assert.equal(first.phase, 'tie'); assert.equal(later.phase, 'aim');
    assert.ok(later.pressure > first.pressure * 2);
  });
  test('visible zero targets the input beat and tolerance is symmetric for every difficulty and reach duration', () => {
    for (const difficulty of ['easy', 'normal', 'hard']) for (const reachTime of [0.2, 0.42, 0.8]) {
      for (const side of [-0.7, 0, 0.7]) {
        const g = game(`?tut=0&seed=20261022&difficulty=${difficulty}`);
        g.key('KeyD', true, { shiftKey: true }); g.key('KeyD', false);
        const settings = g.inspect.settings;
        settings.onSave({ ...settings, values: { ...settings.values, reachTime } }); settings.onClose();
        g.tap('Enter');
        const r = g.inspect.st.round, tolerance = g.api.dbg().timingWindow, offset = side * tolerance;
        r.t = 0.5 + r.T - reachTime - offset;
        assert.ok(Math.abs(g.api.dbg().inputLeft - offset) < 1e-9);
        assert.equal(g.api.dbg().beatReady, true);
        g.tap('Space'); until(g, () => g.inspect.contacts.length > 0, 80);
        const contact = g.inspect.contacts[0];
        assert.ok(Math.abs(contact.timing - offset) <= 2 / 60 + 1e-9);
        assert.ok(Math.abs(contact.timing) < tolerance, 'both sides of zero remain valid');
        assert.equal(g.inspect.st.why?.early, undefined);
        assert.equal(g.inspect.st.why?.late, undefined);
      }
      const g = game(`?tut=0&difficulty=${difficulty}`); g.tap('Enter');
      for (const side of [-1, 1]) {
        const r = g.inspect.st.round;
        r.t = 0.5 + r.T - g.inspect.config.reachTime - side * (g.api.dbg().timingWindow + 0.02);
        assert.equal(g.api.dbg().beatReady, false);
      }
    }
  });
  test('early, late, and synchronized attempts have distinct timing outcomes', () => {
    const early = game(); early.tap('Enter'); early.advance(24); early.tap('Space');
    until(early, () => early.inspect.st.strikes > 0, 90);
    assert.equal(early.inspect.st.why.early, 1); assert.ok(early.inspect.contacts[0].timing > early.api.dbg().timingWindow);
    const late = game(); late.tap('Enter');
    // Zero is now inside the wider grace period; wait past the last viable
    // start time (contact still takes 0.42 seconds).
    until(late, () => late.api.state().left <= 0.42 - late.api.dbg().timingWindow - 0.08, 600); late.tap('Space');
    until(late, () => late.inspect.st.strikes > 0, 90); assert.equal(late.inspect.st.why.late, 1);
    const timed = game('?capture=1&tut=0&bot=expert&seed=20261022');
    until(timed, () => timed.inspect.contacts.length > 0, 600);
    assert.equal(timed.inspect.contacts[0].result, 'ok');
    assert.ok(Math.abs(timed.inspect.contacts[0].timing) <= timed.api.dbg().timingWindow);
  });
  test('the tutorial teaches the same committed tap and timing mistakes cost no lives', () => {
    for (const input of ['keyboard', 'touch']) {
      const g = game('?tut=1&seed=20261022'); g.tap('Enter');
      // Select the teaching exercise, without skipping its enter/step behavior.
      Object.assign(g.inspect.st.tut, { step: 5, t: 0, sub: 0, enter: true }); g.advance(24);
      if (input === 'keyboard') g.tap('Space'); else g.pressAction();
      g.advance(8); const reach = g.inspect.player.reach;
      assert.ok(reach > 0 && reach < 1); assert.equal(g.inspect.contacts.length, 0);
      until(g, () => g.inspect.contacts.length > 0, 60);
      assert.equal(g.inspect.contacts[0].result, 'strike');
      assert.ok(g.api.tut()); assert.equal(g.inspect.st.strikes, 0); g.render();
    }
  });
  test('the complete tutorial can be learned and finishes into a fresh real game', () => {
    const g = game('?capture=1&tut=1&bot=expert&seed=20261022');
    const visited = new Set();
    for (let frame = 0; frame < 60 * 180 && g.api.tut(); frame++) {
      visited.add(g.api.tut().step); g.advance(1);
    }
    assert.equal(g.api.tut(), null, 'tutorial has no unreachable exercise');
    assert.deepEqual([...visited], [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(g.api.state().state, 'play'); assert.equal(g.api.state().layer, 0);
    assert.equal(g.api.state().strikes, 0); g.render(); finiteState(g);
  });
  test('input shortcuts preserve timing gates and wine-based failure rules', () => {
    for (const strategy of ['spam', 'held-repeat', 'parked-spam', 'timing-only', 'body-only', 'opposing-cup-keys']) {
      for (const seed of [1, 7, 20261022]) {
        const assisted = ['parked-spam', 'body-only', 'opposing-cup-keys'].includes(strategy);
        const g = game(`?tut=0&seed=${seed}${assisted ? '&capture=1&bot=expert' : ''}`);
        if (!assisted) g.tap('Enter');
        if (strategy === 'parked-spam') {
          until(g, () => {
            const margin = g.inspect.player.P.rim.y - g.inspect.toastRimY();
            return margin > 0 && margin < g.inspect.winSpan() && g.inspect.st.round.t > 0.4;
          }, 600);
          g.overrideControls({ Q: 0, W: 0, O: 0, P: 0 });
        }
        if (strategy === 'body-only') g.overrideControls({ Q: 0, W: 0 });
        if (strategy === 'opposing-cup-keys') g.overrideControls({ Q: 1, W: 1 });
        let frames = 0;
        while (frames < 60 * 60 && g.inspect.st.state !== 'over' && g.inspect.st.L < 2) {
          if (strategy === 'spam' && frames % 4 === 0) g.tap('Space');
          if (strategy === 'parked-spam' && frames % 4 === 0) g.pressAction();
          if (strategy === 'held-repeat') {
            if (frames === 24) g.key('Space');
            if (frames > 24) g.key('Space', true, { repeat: true });
          }
          if (strategy === 'timing-only' && g.api.dbg().beatReady && g.inspect.canToast()) g.tap('Space');
          g.advance(1); frames++;
        }
        const s = g.api.state();
        report.exploits.push({ strategy, seed, seconds: frames / 60, layer: s.layer, toasts: s.toasts, why: s.why });
        if (s.state === 'over') assert.equal(s.over.reason, 'beer');
        // Removing tilt strikes intentionally lets body-only play survive longer.
        // Tapping without steering still cannot bypass height and timing.
        if (['spam', 'held-repeat', 'timing-only'].includes(strategy)) assert.ok(s.layer < 2, `${strategy}/${seed} cannot bypass height and timing`);
        finiteState(g);
      }
    }
  });
  test('desktop, portrait, and landscape render all 12 story rooms plus endless', () => {
    for (const view of ['desktop', 'portrait', 'landscape']) for (let layer = 0; layer <= 12; layer++) {
      const g = game(`?capture=1&tut=0&bot=expert&seed=20261022&layer=${layer}&view=${view}`);
      g.advance(180, true); finiteState(g); assert.ok(g.drawCalls > 0);
      assert.equal(g.api.state().lay, view === 'desktop' ? 'desk' : 'land');
    }
  });
  test('real floor-break and standup transitions traverse 12 rooms into endless', () => {
    const g = game('?tut=0&seed=20261022&debug=1'); g.tap('Enter');
    for (let target = 1; target <= 13; target++) {
      g.tap('BracketRight'); assert.equal(g.api.state().state, 'fall');
      for (let frame = 0; frame < 600 && g.api.state().state !== 'play'; frame++) g.advance(1, frame % 30 === 0);
      assert.equal(g.api.state().layer, target); assert.equal(g.api.state().state, 'play');
      finiteState(g); g.render();
    }
    assert.equal(g.api.state().breaks, 13);
  });
  test('game over can restart with fresh score, round, and resources', () => {
    const g = game(); g.tap('Enter');
    g.key('KeyW'); // Real continuous spilling, not missed-toast lives.
    for (let f = 0; f < 60 * 50 && g.api.state().state !== 'over'; f += 30) g.advance(30);
    assert.equal(g.api.state().over?.reason, 'beer');
    assert.equal(g.api.state().state, 'over'); g.render();
    g.tap('KeyR'); const s = g.api.state();
    assert.equal(s.state, 'play'); assert.equal(s.score, 0); assert.equal(s.strikes, 0); assert.equal(s.beer, 1); assert.equal(s.over, null);
    g.advance(60, true); finiteState(g);
  });
}

test('toast countdown has exactly three even beats ending at the input target', () => {
  for (const total of [1, 1.5, 2, 4]) for (const reach of [0.2, 0.42, 0.8]) {
    for (const event of ['steady', 'feint', 'rush']) {
      const g = game(); g.tap('Enter'); g.tap('Escape');
      g.key('KeyD', true, { shiftKey: true });
      const settings = g.inspect.settings;
      settings.onSave({ ...settings, values: { ...settings.values, reachTime: reach } }); settings.onClose();
      const r = g.inspect.st.round;
      Object.assign(r, { phase: 'aim', t: 0, T: total - 0.5, event, eventDone: false, smash: false, attacking: false });
      delete r.cue;
      g.sandbox.__sounds.length = 0;
      const target = total - reach, gap = Math.min(60 / 126, target / 2);
      for (let frame = 0; frame < Math.ceil((target + 0.1) * 60); frame++) g.inspect.stepRound(1 / 60);
      const notes = g.sandbox.__sounds.filter(s => s.type.startsWith('count'));
      assert.deepEqual(Array.from(notes, n => n.type), ['count', 'count', 'countGo']);
      notes.forEach((n, i) => assert.ok(Math.abs(n.t - (target - (2 - i) * gap)) <= 1 / 60 + 1e-8));
      assert.ok(Math.abs(notes[2].inputLeft) <= 1 / 60 + 1e-8);
      assert.equal(g.sandbox.__sounds.filter(s => s.type === 'tick').length, 0, 'no misleading extra ticks');
    }
  }
});

test('three toast cues and visible zero follow actual music beats at every tempo and song phase', () => {
  for (const bpm of [90, 126, 160]) for (const offset of [0, 0.137, 30.2, 307.49]) {
    const g = game(); g.tap('Enter'); g.inspect.config.musicBpm = bpm;
    const beat = 60 / bpm, r = g.inspect.st.round, notes = [];
    g.sandbox.__sounds.length = 0;
    let previous = 0;
    for (let frame = 0; frame < 220; frame++) {
      // An independently advancing media clock, slightly different from simulation dt.
      const time = offset + frame * 0.017;
      g.sandbox.__musicClock = time;
      g.inspect.stepRound(1 / 60);
      const sounds = g.sandbox.__sounds.filter(s => s.type.startsWith('count'));
      if (sounds.length > previous) { notes.push({ time, ...sounds[sounds.length - 1] }); previous = sounds.length; }
      if (notes.length === 3) break;
    }
    assert.equal(notes.length, 3);
    for (const n of notes) {
      const phase = n.time / beat - Math.round(n.time / beat);
      assert.ok(Math.abs(phase * beat) <= 0.017 + 1e-8, `${bpm} BPM cue on song grid`);
    }
    assert.ok(Math.abs(notes[2].inputLeft) <= 0.017 + 1e-8);
    assert.ok(Math.abs(notes[1].time - notes[0].time - beat) < 0.018);
    assert.ok(Math.abs(notes[2].time - notes[1].time - beat) < 0.018);
    assert.ok(r.T + 0.5 - g.inspect.config.reachTime >= 1.58, 'alignment never removes preparation time');
  }
});

test('toast beats pause with play and run in the timing tutorial', () => {
  const g = game(); g.tap('Enter');
  until(g, () => g.sandbox.__sounds.some(s => s.type === 'count'));
  const r = g.inspect.st.round, time = r.t, count = g.sandbox.__sounds.length;
  g.tap('Escape'); g.advance(120);
  assert.equal(r.t, time); assert.equal(g.sandbox.__sounds.length, count);
  g.tap('Escape'); until(g, () => g.sandbox.__sounds.some(s => s.type === 'countGo'));
  assert.equal(g.sandbox.__sounds.filter(s => s.type.startsWith('count')).length, 3);
  g.inspect.st.tut = { step: 5, t: 0, enter: true };
  g.sandbox.__sounds.length = 0;
  for (let i = 0; i < 280; i++) g.inspect.stepTutorial(1 / 60);
  assert.deepEqual(Array.from(g.sandbox.__sounds.filter(s => s.type.startsWith('count')), n => n.type), ['count', 'count', 'countGo']);
});

if (!quick) {
  for (const bot of ['expert', 'human', 'none', 'w', 'o']) {
    const rows = [];
    for (let layer = 0; layer <= 12; layer++) {
      const g = game(`?capture=1&tut=0&bot=${bot}&layer=${layer}&seed=20261022`);
      let frames = 0;
      while (frames < 60 * 90 && g.api.state().state !== 'over' && g.api.state().layer === layer) {
        g.advance(30); frames += 30; finiteState(g);
      }
      g.render(); const s = g.api.state();
      const row = { bot, startLayer: layer, endLayer: s.layer, seconds: frames / 60, gameTime: s.gameT, state: s.state, score: s.score, beer: s.beer, toasts: s.toasts, perfects: s.perfects, strikes: s.strikes, why: s.why, over: s.over?.reason || null };
      report.matrix.push(row); rows.push(`${layer}:${s.layer > layer ? '↑' : s.state === 'over' ? '×' : '…'}${s.toasts}/${Math.round(frames / 60)}s`);
    }
    console.log(`${bot.padEnd(6)} ${rows.join(' ')}`);
  }
  if (!matrixOnly) {
    test('learned coordination can naturally reach endless without requiring mistake-free runs', () => {
      for (const bot of ['expert', 'human', 'novice']) for (const seed of [1, 7, 20261022]) {
        const run = playCampaign(bot, seed);
        report.campaigns.push(run);
        console.log(`campaign ${bot}/${seed}: layer ${run.layer}; ${run.toasts}/${run.manual} toasts; ${run.seconds}s; errors ${JSON.stringify(run.why)}`);
      }
      const experts = report.campaigns.filter(r => r.bot === 'expert');
      const learners = report.campaigns.filter(r => r.bot === 'human');
      assert.ok(experts.filter(r => r.layer >= 12).length >= 2, 'practised coordination can complete the game across seeds');
      assert.ok(learners.some(r => r.layer >= 3), 'a slower controller can learn beyond the opening chapter');
      assert.ok(experts.every(r => r.cupPresses > 20), 'successful play actually works the cup controls');
    });
  }
}

if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const failures = results.filter(r => !r.pass);
console.log(`${results.length - failures.length}/${results.length} checks passed; ${report.matrix.length} bot/room simulations; ${report.campaigns.length} skill campaigns; ${report.exploits.length} exploit attempts.`);
process.exitCode = failures.length ? 1 : 0;
