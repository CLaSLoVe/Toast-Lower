'use strict';

// Runs the real game in Node. Canvas/audio are inert, so this never opens a
// browser, requests a graphics context from the OS, or uses a GPU.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function eventTarget() {
  const handlers = new Map();
  return {
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    dispatch(type, values = {}) {
      const event = { type, cancelable: true, repeat: false,
        preventDefault() { this.defaultPrevented = true; }, ...values };
      for (const fn of handlers.get(type) || []) fn(event);
      return event;
    },
  };
}

function makeAudio() {
  const param = () => ({ value: 0, setValueAtTime() {},
    exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect() {}, start() {}, stop() {},
    gain: param(), frequency: param(), Q: param() });
  return class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createGain() { return node(); }
    createOscillator() { return node(); }
    createBufferSource() { return node(); }
    createBiquadFilter() { return node(); }
    createBuffer(channels, frames) { return { getChannelData() { return new Float32Array(frames); } }; }
  };
}

function createGame(options = {}) {
  const sourcePath = options.source || path.join(__dirname, '..', 'game.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const canvasEvents = eventTarget(), windowEvents = eventTarget();
  let draws = 0, animationFrame;
  const gradient = { addColorStop() {} };
  const ctx = options.context || new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return value => ({ width: String(value).length * 16 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'getLineDash') return () => [];
      return (...args) => {
        if (options.onDraw) options.onDraw(key, args);
        for (const value of args) {
          if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new Error(`Canvas ${String(key)} received ${value}`);
          }
        }
        if ((key === 'arc' && args[2] < 0) || (key === 'ellipse' && (args[2] < 0 || args[3] < 0))) {
          throw new Error(`Canvas ${String(key)} received a negative radius`);
        }
        draws++;
      };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  const canvas = { ...canvasEvents, style: {}, width: 1080, height: 1080,
    getContext(kind) { if (kind !== '2d') throw new Error('Only the inert 2D stub is allowed'); return ctx; },
    getBoundingClientRect() {
      let width = parseFloat(this.style.width) || 1080, height = parseFloat(this.style.height) || 1080;
      if (this.style.transform === 'rotate(90deg)') [width, height] = [height, width];
      return { left: (sandbox.innerWidth - width) / 2, top: (sandbox.innerHeight - height) / 2, width, height };
    },
    setPointerCapture() {}, releasePointerCapture() {},
  };
  const storage = new Map(Object.entries(options.storage || { 'toastLower.tutDone': '1', toast_mute: '1' }));
  const timers = [];
  const sandbox = {
    console, URLSearchParams, Math, Float32Array,
    location: { search: options.search || '?tut=0&seed=20261022' },
    document: { ...eventTarget(), getElementById(id) { if (id !== 'c') throw new Error(`Unexpected DOM lookup ${id}`); return canvas; }, hidden: false },
    localStorage: { getItem(key) { return storage.has(key) ? storage.get(key) : null; }, setItem(key, value) { storage.set(key, String(value)); } },
    navigator: { maxTouchPoints: options.touch ? 2 : 0, vibrate() {} },
    innerWidth: options.width || 1080, innerHeight: options.height || 1080,
    devicePixelRatio: 1, matchMedia() { return { matches: false }; },
    performance: { now() { return 0; } },
    requestAnimationFrame(fn) { animationFrame = fn; return 1; },
    cancelAnimationFrame() {},
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    AudioContext: makeAudio(), ...windowEvents,
  };
  sandbox.window = sandbox;
  sandbox.ToastMusic = { clock() { return sandbox.__musicClock ?? null; }, reset() {}, gesture() {}, update(playing, volume) { sandbox.__music = { playing, volume }; } };
  sandbox.ToastSettings = { isOpen() { return false; }, open(options) { sandbox.__settings = options; } };
  // Test ports exist only in the VM copy. The shipped game is never modified.
  const marker = 'window.__toast = {';
  if (!source.includes(marker)) throw new Error('Game test hook marker missing');
  const instrumented = source.replace('if (BOT) runBot(dt);', `if (BOT) runBot(dt);
    if (window.__overrideControls) Object.assign(keys, window.__overrideControls);`)
    .replace(marker, `window.__sounds = [];
  const originalSfx = sfx;
  sfx = function(type) { window.__sounds.push({ type, t: st.round?.t, inputLeft: toastInputLeft() }); originalSfx(type); };
  window.__contacts = [];
  const originalContactJudge = judgeClink;
  judgeClink = function() {
    const contact = { chainIndex: st.round.chainIndex, target: st.round.target, inputLeft: toastInputLeft(), revealed: st.alien?.revealed, time: st.t, layer: st.L, round: st.round.n,
      margin: player.P.rim.y - toastRimY(), level: Math.abs(player.tilt + player.w),
      reach: player.reach || 0, keys: { ...keys } };
    originalContactJudge();
    contact.result = st.round.chain ? st.round.lastNoteResult : st.round.result; contact.judgedMargin = st.round.margin; contact.timing = st.round.timing;
    window.__contacts.push(contact);
  };
  window.__test = {
    get bubbles() { return bubbles; }, get st() { return st; }, get player() { return player; }, get boss() { return boss; },
    get pointers() { return pointers; }, get stick() { return { ...stick, ...stickRect() }; }, get stickGeometry() { return stickRect(); }, get buttons() { return BTN.map((b, i) => ({ key: b[0], ...btnRect(i) })); },
    get canvasSize() { return { W, H }; }, render, breakFloor, gameOver, changeWine, saveBest, isCustomRun, roundSucceeded, stepDisturb, stepSway, stepNPCs, toastRimY, alienRimX, alienRimY, stepNPCs, winSpan, strike, judgeClink, perfBand, moveCup, diff, wineCapacity, refillWine, stepRound, stepChapterChatter, finishToastAttempt, newRound, reachTime, revealAlienTarget, spillSoundSuppressed, stepToastCue, stepTutorial, pressCheck, get config() { return CFG; }, applySettings, get settings() { return window.__settings; },
    get canToast() { return typeof canToast === 'function' ? canToast : null; },
    get requestToast() { return typeof requestToast === 'function' ? requestToast : null; },
    get contacts() { return window.__contacts; },
    get homeButton() { return homeBtnRect(); }, get titleStartButton() { return titleStartRect(); },
    get activeButton() { return typeof toastButtonRect === 'function' ? toastButtonRect() : null; },
  };\n${marker}`);
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8'), sandbox);
  vm.runInContext(instrumented, sandbox, { filename: sourcePath, timeout: 10000 });
  return {
    api: sandbox.__toast, inspect: sandbox.__test, storage, sandbox,
    dispatch: windowEvents.dispatch, canvasDispatch: canvasEvents.dispatch,
    key(code, down = true, extra = {}) { return windowEvents.dispatch(down ? 'keydown' : 'keyup', { code, ...extra }); },
    tap(code) { this.key(code); this.key(code, false); },
    point(type, x, y, pointerId = 1) {
      const { W, H } = this.inspect.canvasSize, rect = canvas.getBoundingClientRect();
      const rotated = canvas.style.transform === 'rotate(90deg)';
      return canvasEvents.dispatch(type, { pointerId,
        clientX: rect.left + (rotated ? 1 - y / H : x / W) * rect.width,
        clientY: rect.top + (rotated ? x / W : y / H) * rect.height });
    },
    pointer(type, key, pointerId = 1) {
      const button = this.inspect.buttons.find(b => b.key === key);
      if (!button) throw new Error(`Unknown button ${key}`);
      return this.point(type, button.x + button.w / 2, button.y + button.h / 2, pointerId);
    },
    actionPointer(type, pointerId = 9) {
      const button = this.inspect.activeButton;
      if (!button) throw new Error('Active-toast button not available');
      return this.point(type, button.x + button.w / 2, button.y + button.h / 2, pointerId);
    },
    pressAction(pointerId = 9) { this.actionPointer('pointerdown', pointerId); this.actionPointer('pointerup', pointerId); },
    overrideControls(values) { sandbox.__overrideControls = values; },
    advance(frames, render = false) { return this.api.advance(frames, !render); },
    render() { this.inspect.render(); },
    get drawCalls() { return draws; },
    flushTimers() { while (timers.length) timers.shift()(); },
    frame(now) { if (animationFrame) animationFrame(now); },
  };
}

module.exports = { createGame };
