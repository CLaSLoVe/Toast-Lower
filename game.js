'use strict';
(() => {
// ---------------------------------------------------------------- setup
let W = 1080, H = 1080, LAY = 'desk';
const params = new URLSearchParams(location.search);
const CONFIG = window.ToastConfig;
const CFG = CONFIG.validate(CONFIG.defaults);
try { Object.assign(CFG, CONFIG.load(localStorage)); } catch (e) { /* file defaults work without storage */ }
const AUTO = params.has('auto');
const CAPTURE = params.has('capture');
const START_KEY = 'toastLower.startL';
function loadStartL() {
  const q = params.get('layer');
  if (q != null && q !== '') return Number.isFinite(+q) ? Math.max(0, Math.min(200, Math.floor(+q))) : 0;
  try { const v = localStorage.getItem(START_KEY); if (v != null) return Number.isFinite(+v) ? Math.max(0, Math.min(200, Math.floor(+v))) : 0; } catch (e) {}
  return 0;
}
let START_LAYER = loadStartL();
function saveStartL(L) { START_LAYER = Math.max(0, Math.min(200, L|0)); try { localStorage.setItem(START_KEY, String(START_LAYER)); } catch (e) {} }
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';

const explicitSeed = params.has('seed') && Number.isFinite(Number(params.get('seed'))) ? Number(params.get('seed')) : null;
let runSeed = explicitSeed ?? Math.floor(Math.random() * 4294967296);
let seed = runSeed, physicsSeed = runSeed ^ 0x51ed270b;
function physicsRandom() { physicsSeed |= 0; physicsSeed = physicsSeed + 0x6D2B79F5 | 0; let t = Math.imul(physicsSeed ^ physicsSeed >>> 15, 1 | physicsSeed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const physicsRange = (a, b) => a + (b - a) * physicsRandom();
function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const R = (a, b) => a + (b - a) * rnd();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const PI = Math.PI;

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let scale = 1, rotated = false;
const TOUCH = params.get('view') === 'portrait' || params.get('view') === 'landscape' || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
// Touch always uses landscape; a portrait viewport rotates the canvas in-page.
// Desktop keeps its existing square/tall layouts.
function resize() {
  const view = params.get('view');
  let iw = innerWidth, ih = innerHeight;
  if (CAPTURE || view === 'portrait' || view === 'landscape') { if (view === 'portrait') { iw = 390; ih = 844; } else if (view === 'landscape') { iw = 844; ih = 390; } else { iw = ih = 1080; } }
  rotated = TOUCH && iw < ih && !CAPTURE;
  if (TOUCH && iw < ih) [iw, ih] = [ih, iw];
  const aspect = ih / iw;
  if (TOUCH) { LAY = 'land'; H = 1080; W = Math.round(1080 * Math.max(1.35, Math.min(1 / aspect, 2.4))); }
  else if (aspect > 1.15) { LAY = 'port'; W = 1080; H = Math.round(1080 * Math.min(aspect, 2.4)); }
  else { LAY = 'desk'; W = H = 1080; }
  let cw, ch;
  if (LAY === 'desk') { cw = ch = Math.min(iw, ih); }
  else { const k = Math.min(iw / W, ih / H); cw = W * k; ch = H * k; }
  if (CAPTURE) { cw = W; ch = H; }
  else { const fit = Math.min(1, (rotated ? innerHeight : innerWidth) / cw, (rotated ? innerWidth : innerHeight) / ch); cw *= fit; ch *= fit; }
  const dpr = CAPTURE ? 1 : Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.style.transform = rotated ? 'rotate(90deg)' : 'none';
  if (document.documentElement) document.documentElement.toggleAttribute('data-game-rotated', rotated);
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  scale = cv.width / W;
}
function resizeControls() { clearInputs(); resize(); }
addEventListener('resize', resizeControls); addEventListener('orientationchange', () => { clearInputs(); setTimeout(resizeControls, 120); }); resize();
if (TOUCH && cv.setAttribute) cv.setAttribute('aria-label', '敬酒模拟器手机版。自动横屏。左手摇杆上下调整高度、左右扶杯，右手点击敬酒。保留惯性，红色0秒踩拍。');
// where the floor sits on screen, and where the touch buttons start
function btnTop() { return LAY === 'port' ? H - 30 - 300 : LAY === 'land' ? H - 24 - 200 : 950; }
function floorSY() { return LAY === 'port' ? btnTop() - 200 : TOUCH && LAY === 'land' ? H - 65 : 860; }
function hudBottom() { return LAY === 'port' ? 170 : LAY === 'land' ? 140 : 120; }

// ---------------------------------------------------------------- sound (quiet)
let AC = null, muted = false, gestured = false;
try { muted = localStorage.getItem('toast_mute') === '1'; } catch (e) { /* private mode */ }
function syncMusic() { window.ToastMusic.update(gestured && !CAPTURE && !BOT && !document.hidden && !st.paused && ['play', 'fall', 'standup'].includes(st.state), muted ? 0 : CFG.musicVolume / 100, CFG.musicBpm); }
function setMute(v) { muted = v; syncMusic(); try { localStorage.setItem('toast_mute', v ? '1' : '0'); } catch (e) { /* ignore */ } }
// a short buzz on phones (follows the sound switch); never in bot / capture runs
function buzz(pat) { if (muted || CAPTURE || BOT || !gestured) return; try { if (navigator.vibrate) navigator.vibrate(pat); } catch (e) { /* ignore */ } }
function noiseBuf(len, pow) { const buf = AC.createBuffer(1, Math.floor(AC.sampleRate * len), AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, pow); return buf; }
function tone(g, f, type, t0, dur, f2) { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); o.connect(g); o.start(t0); o.stop(t0 + dur + 0.02); return o; }
function spillSoundSuppressed() {
  const r = st.round;
  if (!r || r.phase !== 'aim' || r.smash) return false;
  const target = r.cue ? r.cue.target : Math.max(0, 0.5 + r.T - reachTime());
  const gap = r.cue ? r.cue.gap : Math.min(60 / CFG.musicBpm, target / 2);
  // Clear even the tail of an existing spill sound before the first cue, and
  // keep the whole three-beat phrase / committed reach free of liquid sounds.
  return r.t >= target - 2 * gap - 0.2;
}
function sfx(type) {
  if ((type === 'drip' || type === 'splash') && (CFG.spillSoundVolume <= 0 || spillSoundSuppressed())) return;
  if (muted || CAPTURE || !gestured) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const now = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
    if (type === 'boing') {
      // A rubbery downward glissando under the collapsing-floor impact.
      const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(170, now);
      o.frequency.exponentialRampToValueAtTime(520, now + 0.065); o.frequency.exponentialRampToValueAtTime(65, now + 0.55);
      o.connect(g); g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.58); o.start(now); o.stop(now + 0.6);
    } else if (type === 'ding' || type === 'perfect') { // a glass: a bright strike plus a few inharmonic partials ringing out
      const pf = type === 'perfect', base = pf ? 2650 : 2200;
      for (const [m, a] of [[1, 1], [2.32, 0.5], [3.9, 0.25], [5.4, 0.12]]) { const gg = AC.createGain(); gg.connect(g); gg.gain.setValueAtTime(a, now); gg.gain.exponentialRampToValueAtTime(0.001, now + (pf ? 0.9 : 0.55) / m); tone(gg, base * m, 'sine', now, (pf ? 0.9 : 0.55) / m); }
      const ns = AC.createBufferSource(); ns.buffer = noiseBuf(0.02, 3); const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; ns.connect(hp); hp.connect(g); ns.start(now);
      g.gain.setValueAtTime(pf ? 0.11 : 0.08, now);
      if (pf) { const g2 = AC.createGain(); g2.connect(AC.destination); g2.gain.setValueAtTime(0.0001, now + 0.08); g2.gain.exponentialRampToValueAtTime(0.05, now + 0.1); g2.gain.exponentialRampToValueAtTime(0.0005, now + 0.7); tone(g2, base * 1.5, 'sine', now + 0.08, 0.65); }
    } else if (type === 'drip' || type === 'splash') {
      // Soft, unpitched liquid rustle: no high "plip" that resembles the cues.
      const sp = type === 'splash', len = sp ? 0.13 : 0.07;
      const ns = AC.createBufferSource(); ns.buffer = noiseBuf(len, 2);
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 550; lp.Q.value = 0.5;
      ns.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime((sp ? 0.08 : 0.045) * CFG.spillSoundVolume / 100, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + len);
      ns.start(now); ns.stop(now + len);
    } else if (type === 'shove') { // a bump: a soft whoomp
      const ns = AC.createBufferSource(); ns.buffer = noiseBuf(0.25, 1.5); const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, now); lp.frequency.exponentialRampToValueAtTime(200, now + 0.25); ns.connect(lp); lp.connect(g); ns.start(now);
      g.gain.value = 0.14; tone(g, 140, 'sine', now, 0.18, 60);
    } else if (type === 'smash') { // the floor giving way: a deep boom under the crash
      tone(g, 90, 'sine', now, 0.5, 28); g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    } else if (type === 'crack' || type === 'break') {
      const len = type === 'break' ? 0.6 : 0.12;
      const buf = AC.createBuffer(1, Math.floor(AC.sampleRate * len), AC.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = AC.createBufferSource(); src.buffer = buf;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = type === 'break' ? 700 : 2500;
      src.connect(lp); lp.connect(g);
      g.gain.value = type === 'break' ? 0.16 : 0.05; src.start(now);
    } else if (type === 'thud') {
      const o = AC.createOscillator(); o.frequency.setValueAtTime(110, now); o.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      o.connect(g); g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.25); o.start(now); o.stop(now + 0.3);
    } else if (type === 'clink') {
      for (const f of [2300, 3170]) { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(now); o.stop(now + 0.45); }
      g.gain.setValueAtTime(0.07, now); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.4);
    } else if (type === 'count' || type === 'countGo') {
      // One unmistakable three-beat family; the third beat marks the input target.
      const go = type === 'countGo';
      tone(g, go ? 1320 : 1046.5, 'sine', now, go ? 0.13 : 0.09);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(go ? 0.14 : 0.11, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, now + (go ? 0.13 : 0.09));
    } else if (type === 'tick') {
      const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = 880; o.connect(g);
      g.gain.setValueAtTime(0.03, now); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.08); o.start(now); o.stop(now + 0.1);
    }
  } catch (e) { /* audio is optional */ }
}

// ---------------------------------------------------------------- world
const LH = 1000, SLAB = 150, F0 = 820, G = 2600;
const floorY = i => F0 + i * LH;
const SC = 1.45; // character scale

const P_SPEC = { kind: 'player', shirt: '#f3f3f0', pants: '#24272e', skin: '#f4c9a1', hair: '#1a1a1a', tie: '#d42a35', scale: SC };
const B_SPEC = { kind: 'boss', shirt: '#2c2f38', pants: '#2c2f38', skin: '#f1b28a', tie: '#d9a82e', belly: true, scale: SC * 1.07 };
const TOMB_BOSS = { ...B_SPEC, skin: '#a4b98a', jiangshi: true, shirt: '#263556', tie: '#c59b40' };
const ALIEN_HOST = { ...B_SPEC, scale: SC * 1.12 };
const ALIEN_DELEGATES = [
  { ...ALIEN_HOST, shirt: '#344e48', skin: '#7dd87a', tie: '#ffc65d', alien: true, planet: 'sprout' },
  { ...ALIEN_HOST, shirt: '#473855', skin: '#ba93ee', tie: '#80e4de', alien: true, planet: 'ring' },
];
const GUEST = (shirt, extra) => Object.assign({ kind: 'guest', shirt, pants: '#2a2a30', skin: '#f1c39a', hair: '#222', scale: SC }, extra || {});

// Four chapters, one distinct skill each; twelve story rooms, then endless.
const CHAPTERS = [
  { id: 0, zh: '职场酒局', en: 'Office Banquet', mech: 'basic', rooms: ['豪华包间', '私人KTV', '地下酒窖'] },
  { id: 1, zh: '地下交通', en: 'Underground Transit', mech: 'shake', rooms: ['地下停车场', '下水道泵房', '地铁站台'] },
  { id: 2, zh: '千年酒局', en: 'Millennium Toast', mech: 'chain', rooms: ['考古现场', '古墓主墓室', '兵马俑坑'] },
  { id: 3, zh: '地心外交', en: 'Core Diplomacy', mech: 'alien', rooms: ['51区外星基地', '岩浆外星观测站', '地心外星总部'] },
];
const STORY_N = 12; // 0..11 story, 12+ endless
const BASE_LAYERS = [
  // Ch1 职场酒局 — basic
  { name: '豪华包间', en: 'Luxury Private Room', depth: 0, ch: 0, room: 0, mech: 'basic', join: [] },
  { name: '私人KTV', en: 'Private KTV', depth: 3.6, ch: 0, room: 1, mech: 'basic', join: [GUEST('#e0389a', { hair: '#111' }), GUEST('#3a78c2', { hair: '#3b2a1a', glasses: true })] },
  { name: '地下酒窖', en: 'Wine Cellar', depth: 9, ch: 0, room: 2, mech: 'basic', join: [GUEST('#5a1f2e', { hair: '#d8d8d8', glasses: true })] },
  // Ch2 地下交通 — ground shake
  { name: '地下停车场', en: 'Parking Garage', depth: 15, ch: 1, room: 0, mech: 'shake', join: [GUEST('#22345e', { cap: '#1a2440', pants: '#1a2440' })] },
  { name: '下水道泵房', en: 'Sewer Pump Room', depth: 22, ch: 1, room: 1, mech: 'shake', join: [GUEST('#6b6b6b', { rat: true, skin: '#a3a3a3', pants: '#555' }), GUEST('#7b6b5b', { rat: true, skin: '#a3a3a3', pants: '#555' })] },
  { name: '地铁站台', en: 'Subway Platform', depth: 38, ch: 1, room: 2, mech: 'shake', join: [GUEST('#ffcc00', { helmet: '#ffcc00', pants: '#333' }), GUEST('#7b5ea7', { hair: '#5a3a22' })] },
  // Ch3 古墓 — fixed-height rhythm phrases
  // Ch4 千年酒局 — shrinking boss cup (visible beat)
  { name: '考古现场', en: 'Dig Site', depth: 200, ch: 2, room: 0, mech: 'chain', chain: 2, cupName: '高脚杯', join: [GUEST('#5a4a2a', { lamp: true, helmet: '#c9a227' }), GUEST('#efe6cf', { skeleton: true })] },
  { name: '古墓主墓室', en: 'Main Tomb Chamber', depth: 450, ch: 2, room: 1, mech: 'chain', chain: 3, cupName: '白酒杯', join: [GUEST('#5a4a2a', { lamp: true, helmet: '#c9a227' }), GUEST('#2a3a6a', { jiangshi: true, skin: '#a9c79a' })] },
  { name: '兵马俑坑', en: 'Terracotta Pit', depth: 800, ch: 2, room: 2, mech: 'chain', chain: 4, cupName: '袖珍杯', join: [GUEST('#a85a3a', { terracotta: true }), GUEST('#a85a3a', { terracotta: true })] },
  // Ch4 地心外交 — human boss and two alien delegates
  { name: '51区外星基地', en: 'Area 51 Alien Base', depth: 9000, ch: 3, room: 0, mech: 'alien', join: [GUEST('#9aa5b5', { alien: true, skin: '#7dd87a' }), GUEST('#9aa5b5', { alien: true, skin: '#7dd87a' })] },
  { name: '岩浆外星观测站', en: 'Magma Alien Observatory', depth: 35000, ch: 3, room: 1, mech: 'alien', join: [GUEST('#2a1410', { lava: true }), GUEST('#9aa5b5', { alien: true, skin: '#7dd87a' })] },
  { name: '地心外星总部', en: "Core Alien HQ", depth: 6371000, ch: 3, room: 2, mech: 'alien', join: [GUEST('#ffb13b', { lava: true }), GUEST('#9aa5b5', { alien: true, skin: '#9d7dff' })] },
];
const layerCache = new Map();
function chapterOf(L) { if (L < 0) return null; if (L >= STORY_N) return { id: CHAPTERS.length, zh: '无尽敬酒', en: 'Endless', mech: 'mix', room: L - STORY_N }; return CHAPTERS[Math.floor(L / 3)]; }
function layerLabel(i) {
  const d = layerDef(i);
  if (d.endless) return `无尽模式 · 第${d.endless}层`;
  const ch = CHAPTERS[d.ch];
  return `${ch.zh} · ${d.name}`;
}
function layerDef(i) {
  if (i < BASE_LAYERS.length) return BASE_LAYERS[i];
  if (layerCache.has(i)) return layerCache.get(i);
  const n = i - BASE_LAYERS.length + 1;
  // endless: slowly growing mix of chapter mechanics
  const pool = ['shake', 'chain', 'alien'];
  const mech = pool[(n - 1) % pool.length];
  const def = { name: '无尽模式', en: 'ENDLESS', endless: n, depth: 6371000 + n * 500000, ch: CHAPTERS.length, mech, chain: mech === 'chain' ? 2 + (Math.floor((n - 1) / 3) % 3) : 0, join: n % 2 ? [GUEST('#ff8a2a', { lava: true })] : [] };
  layerCache.set(i, def); return def;
}
function activeMech(L) { const d = layerDef(L == null ? st.L : L); return (d && d.mech) || 'basic'; }
function chainCount() { return st.tut ? 0 : layerDef(st.L).chain || 0; }
// playtesting: all story layers + first endless selectable
function maxUnlocked() { return STORY_N; } // 0..12 inclusive (12 = endless entry)

const BOSS_LINES = [['不急不急～', 'No rush~'], ['小伙子，杯子有点高啊', 'Your cup is a bit high'], ['年轻人要懂规矩', 'Know the rules, kid'], ['来来来，再低点', 'Come on, lower'], ['哎～差一点', 'Ah~ almost'], ['我先干为敬…才怪', 'Bottoms up… not']];
const PLAYER_LINES = [['领导我敬您！', 'A toast to you, boss!'], ['我干了您随意！', 'I drink, you sip!'], ['再低一点…', 'A bit lower…']];
const JOIN_LINES = [['带我一个！', 'Count me in!'], ['也敬领导！', 'Toast the boss!'], ['我比他低！', "I'm lower!"]];

// ---------------------------------------------------------------- characters
let cid = 0;
function mkChar(spec, face) {
  return { id: cid++, spec, face, x: 0, y: 0, phi: 0, vphi: 0, k: 0, vk: 0, b: 0, vb: 0, arm: 0.25, varm: 0, vy: 0, vx: 0, vrot: 0,
    tilt: 0, vtilt: 0, wine: 1, s: 0, mode: 'play', landed: false, P: null, hv: { x: 0, y: 0 }, hp: null, seedA: R(0, 100), sway: R(0, 6) };
}

function fk(c) {
  const sc = c.spec.scale, f = c.face, ph = c.phi;
  const L = { th: 58 * sc, sh: 56 * sc, to: 90 * sc, hr: 30 * sc, ua: 44 * sc, fa: 42 * sc, ft: 26 * sc };
  const d = (a, len, o) => ({ x: o.x + Math.cos(a) * len * f, y: o.y + Math.sin(a) * len });
  const hip = { x: c.x, y: c.y };
  const thA = PI / 2 - 0.75 * Math.sin(PI * c.k) + ph;
  const knee = d(thA, L.th, hip);
  const shA = PI / 2 + c.k * PI / 2 + ph;
  const ankle = d(shA, L.sh, knee);
  const toe = d(shA - PI / 2, L.ft, ankle);
  const toA = -PI / 2 + c.b + ph;
  const shoulder = d(toA, L.to * 0.86, hip);
  const neck = d(toA, L.to, hip);
  const head = d(toA, L.to + 6 * sc + L.hr, hip);
  const belly = d(toA + 0.55, L.to * 0.45, hip);
  const elbow = d(c.arm, L.ua, shoulder);
  const hand = d(c.arm - 0.5, L.fa, elbow);
  const reach = c.spec.kind === 'player' ? (c.reach || 0) : 0;
  elbow.x += 12 * sc * f * reach; hand.x += 30 * sc * f * reach;
  hand.y -= 5 * sc * reach;
  const a2 = toA + PI * 0.82 + Math.sin(c.sway) * 0.15;
  const elbow2 = d(a2, L.ua, shoulder);
  const hand2 = d(a2 + 0.5, L.fa * 0.9, elbow2);
  const ca = -PI / 2 + c.tilt;
  const g = cupGeom(c);
  const cupB = d(ca, -g.foot * sc, hand);
  const rim = d(ca, g.rimOff * sc, hand);
  return { hip, knee, ankle, toe, shoulder, neck, head, belly, elbow, hand, elbow2, hand2, cupB, rim, toA, ca, hr: L.hr, sc };
}
// ---- cup shapes: the difficulty you can see. Units are the character's scale, measured from the hand along the cup
// (rimOff = rim above the hand, bowlH = bowl depth under the rim, wt/wb = half-width at rim/bowl bottom, free = how far
// the full drink sits under the rim, foot = the cup's foot under the hand).
// k = 0 on layers 1-2 (tiny step on 2), one visible step per layer from layer 3, capped at layer 10; endless adds a hair.
// shape ramp: gentle through ch1-3, Ch4 is the VISIBLE shrink beat (glass→baijiu→tiny), ch5 holds, endless creeps
const SHAPE_K = [0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.52, 0.66, 0.78, 0.86, 0.94, 1.0];
function shapeK(L) {
  if (L < SHAPE_K.length) return SHAPE_K[Math.max(0, L)];
  return Math.min(1.1, 1 + 0.008 * Math.max(0, L - 14));
}
const CUP_STD = { rimOff: 32, bowlH: 46, wt: 17, wb: 13, free: 6, foot: 14, footW: 13 };
const CUP_MOM = { rimOff: 50, bowlH: 64, wt: 16, wb: 13, free: 6, foot: 14, footW: 13 }; // the tutorial: a tall juice glass
const geomCache = new Map();
function cupGeom(c) {
  const sp = c.spec;
  if (sp.mom) return CUP_MOM;
  if (sp.kind !== 'player' && sp.kind !== 'boss') return CUP_STD;
  const k = st.tut ? 0 : shapeK(st.L), key = sp.kind + k + (st.tut ? 't' : st.L < 3 ? '_' + st.L : '');
  if (geomCache.has(key)) return geomCache.get(key);
  let g;
  // you: the stem grows (rim further above your hand: bow lower), the bowl gets small and shallow and is filled closer to the rim
  if (sp.kind === 'player') g = { rimOff: 32 + 14 * k, bowlH: lerp(44, 26, k), wt: lerp(17, 13, k), wb: lerp(13, 5, k), free: lerp(5.2, 2.6, k), foot: 14, footW: lerp(13, 11, k) };
  // the boss: tall glass -> short cup -> tiny cup. His bowl IS the clink window (rim .. bowl bottom)
  else {
    // Ch4 shrink beat: extra bowl cut on room 0/1/2 of shrink chapter; alien uses mid bowl
    let bonus = 0;
    if (c === boss && !st.tut) {
      const m = activeMech();
      if (m === 'shrink' || m === 'mix' && layerDef(st.L).mech === 'shrink') {
        const room = (layerDef(st.L).room != null) ? layerDef(st.L).room : Math.min(2, st.L % 3);
        bonus = [14, 6, 1][room] || 0; // tall glass → baijiu → tiny (visible beat, still fair)
      } else if (st.L < 3) bonus = [15, 13, 6][st.L];
    }
    g = { rimOff: 32, bowlH: Math.max(14, lerp(39, 20, k) + bonus), wt: lerp(17, 10, k), wb: lerp(13, 6.5, k), free: 5, foot: 14, footW: lerp(13, 9, k) };
  }
  g.lim = Math.atan(g.free / g.wt);                                            // spill angle: the drink's surface reaches the rim
  g.cap = (g.bowlH * (g.wt + g.wb)) / (46 * 30);                               // bowl size vs the layer-1 glass
  geomCache.set(key, g); return g;
}
// how strong the drunk instability is (sway, self-tipping cup, beer drain), relative to v18's layer 1:
// very weak on layers 1-2, v18's layer-1 strength by layer 7, v18's cap at layer 10
// v20f_feel: early–mid much gentler so Q/W/O/P land; late still scales but capped (feel first, beer secondary)
const INSTAB = [0.10, 0.13, 0.17, 0.23, 0.30, 0.38, 0.48, 0.64, 0.78, 0.90, 0.98, 1.05];
function instab() { const L = st.L; return L < INSTAB.length ? INSTAB[Math.max(0, L)] : 1.05 + Math.min(0.08, 0.006 * Math.max(0, L - 14)); }
function beerK() {
  if (st.tut) return 0.35;
  // modest soften vs sway; alien rooms: rhythm is the challenge, not emptying the cup
  let k = instab() * 0.82;
  if (st.alien && st.alien.on) k *= 0.72;
  return k;
}
// Absolute wine units: the starting glass holds 1; smaller glasses have a lower ceiling.
function wineCapacity() { return st.tut ? 1 : lerp(1, CFG.minCapacity / 100, clamp(shapeK(st.L), 0, 1)); }
// All resource changes use starting-glass units; totals contain actual changes, never nominal costs.
function wineLedger() { return st.wineLedger || (st.wineLedger = { spill: 0, penalty: 0, refill: 0, capacity: 0 }); }
function winePercent(amount) { return String(Math.round(amount * 1000) / 10); }
function changeWine(kind, amount) {
  if (amount <= 0) return 0;
  const before = player.wine;
  player.wine = kind === 'refill' ? Math.max(before, Math.min(wineCapacity(), before + Math.max(0, amount))) : Math.max(0, before - Math.max(0, amount));
  const actual = Math.abs(player.wine - before);
  if (!actual || st.tut) return actual;
  wineLedger()[kind] += actual;
  if (kind === 'spill' || kind === 'penalty') { st.loss = actual; st.lossT = 0; }
  if (kind !== 'capacity') {
    const notices = st.wineNotices || (st.wineNotices = []);
    const old = notices.find(n => n.kind === kind && (kind !== 'penalty') && st.t - n.at < 1.1);
    if (old) { old.amount += actual; old.at = st.t; }
    else notices.push({ kind, amount: actual, at: st.t });
    st.wineNotices = notices.filter(n => st.t - n.at < 1.8).slice(-3);
  }
  return actual;
}
function refillWine(amount) { return changeWine('refill', amount); }
function roundSucceeded(r) { return r && (r.chain ? r.chainHits > 0 : r.result === 'ok'); }
function chainPenaltyRatio(r, misses) {
  if (!r.chain || misses >= r.chain) return 1;
  return [0, CFG.chainPenaltyFirst, CFG.chainPenaltySecond, CFG.chainPenaltyThird][misses] / 100;
}

function spillLim() { return cupGeom(player).lim; }
function toastChar() { return (st.round && st.round.partner) || boss; }
function toastRimY() {
  const c = toastChar();
  // Every delegate holds a fixed height; pose animation must not shift the hit window.
  if (st.round && st.round.chain && !st.round.smash) return st.round.target;
  if (st.alien && st.alien.on && !st.tut && st.round && !st.round.smash) {
    const r = st.round;
    if (r && !r.smash && r.target != null) return r.target;
    return alienRimY(st.alien.cup);
  }
  return c.P ? c.P.rim.y : 0;
}
function winSpan() { return cupGeom(toastChar()).bowlH * toastChar().spec.scale; } // clink window: target rim .. bowl bottom
function perfBand() { return Math.max(12, 0.36 * winSpan()); }
function contactPts(c, P) {
  const s = P.sc;
  const a = [[P.toe, 7 * s], [P.ankle, 9 * s], [P.knee, 12 * s], [P.hip, 18 * s], [P.shoulder, 16 * s], [P.head, P.hr], [P.elbow, 9 * s], [P.hand, 9 * s], [P.cupB, 3 * s]];
  if (c.spec.belly) a.push([P.belly, 30 * s]);
  return a;
}
function lowest(c, P) { let m = -1e9; for (const [p, r] of contactPts(c, P)) m = Math.max(m, p.y + r); return m; }
// player.h is "how low is my cup" on a straight line: 0 = standing, 0.9 = cup at the floor, 0.9..1 = lying flat.
// The skeleton's bend parameter s is not linear in rim height (a slow plateau mid-bow, a steep drop near the floor),
// so invert it once into a table; then each press moves the cup by the same amount anywhere.
let H2S = null;
function h2s(h) {
  if (!H2S) {
    const c = mkChar(P_SPEC, 1), N = 400, rim = [];
    for (let i = 0; i <= N; i++) { poseFromS(c, i / N); c.tilt = 0; c.x = 300; c.y = 0; settle(c, 1000); rim.push(1000 - c.P.rim.y); }
    for (let i = 1; i <= N; i++) rim[i] = Math.min(rim[i], rim[i - 1]);          // monotone
    const top = rim[0], bot = rim[N]; let iFlat = N; while (iFlat > 0 && rim[iFlat - 1] <= bot + 0.5) iFlat--;
    const M = 200, tab = [];
    for (let j = 0; j <= M; j++) { const want = top - (top - bot) * j / M; let i = 0; while (i < iFlat && rim[i + 1] > want) i++;
      const a = rim[i], b = rim[Math.min(i + 1, N)], f = a > b ? (a - want) / (a - b) : 0; tab.push(Math.min(iFlat, i + Math.max(0, Math.min(1, f))) / N); }
    H2S = { tab, M, sFlat: iFlat / N };
  }
  if (h >= 0.9) return H2S.sFlat + (1 - H2S.sFlat) * (h - 0.9) / 0.1;
  const x = Math.max(0, h) / 0.9 * H2S.M, i = Math.min(H2S.M - 1, Math.floor(x)), f = x - i;
  return H2S.tab[i] * (1 - f) + H2S.tab[i + 1] * f;
}
function settle(c, floor) { c.P = fk(c); c.y += floor - lowest(c, c.P); c.P = fk(c); }
// ---- chapter mechanics helpers ----
function shakeParams(L) {
  const m = activeMech(L); if (m !== 'shake' && !(m === 'mix' && layerDef(L).mech === 'shake')) return null;
  const d = layerDef(L), room = d.room != null ? d.room : Math.min(2, Math.floor(((d.endless || 1) - 1) / 3) % 3);
  // amp (px) and freq (Hz): car rumble → pump throb → subway rumble; endless grows
  const baseA = [8, 14, 22][Math.min(2, room)] * SC / 1.45;
  const baseF = [0.5, 0.75, 1.0][Math.min(2, room)];
  const grow = d.endless ? 1 + 0.04 * Math.min(20, d.endless) : 1;
  return { A: baseA * grow, w: baseF * Math.PI * 2 * grow };
}
function groundOff() {
  const sp = shakeParams(st.L); if (!sp || st.tut) return 0;
  return sp.A * Math.sin(st.t * sp.w);
}
function groundVel() {
  const sp = shakeParams(st.L); if (!sp || st.tut) return 0;
  return sp.A * sp.w * Math.cos(st.t * sp.w);
}
function groundAcc() {
  const sp = shakeParams(st.L); if (!sp || st.tut) return 0;
  return -sp.A * sp.w * sp.w * Math.sin(st.t * sp.w);
}
function playFloor() { return floorY(st.L) + groundOff(); }
// Three possible cups share a clock; only the selected leader keeps a clock for the last second.
function alienRhythm(L) {
  const d = layerDef(L), room = d.room != null ? d.room : Math.floor(((d.endless || 1) - 1) / 3) % 3;
  return { step: [CFG.alienStep1, CFG.alienStep2, CFG.alienStep3][room] * CFG[difficulty().id + 'AlienHeight'], gap: 0, aimBonus: 0, n: 3 };
}
function prepareAlienLeaders() {
  if (st.tut || activeMech() !== 'alien') return;
  for (const spec of ALIEN_DELEGATES) if (!followers.some(c => c.spec === spec)) {
    const c = mkChar(spec, -1); c.x = boss.x + 220; poseFromS(c, 0); settle(c, floorY(st.L));
    followers.push(c);
  }
}
function ensureAlien() {
  if (st.tut || activeMech() !== 'alien') { st.alien = null; return; }
  if (!st.alien || st.alien.L !== st.L) st.alien = { on: true, L: st.L, cup: 1, revealed: false, ...alienRhythm(st.L), flash: 0, leaders: [boss, ...ALIEN_DELEGATES.map(spec => followers.find(c => c.spec === spec))] };
}
function stepAlienRhythm(dt) { if (st.alien) st.alien.flash = Math.max(0, st.alien.flash - dt); }
function revealAlienTarget() {
  const a = st.alien, r = st.round;
  if (!a || !r || r.smash || a.revealed || r.phase !== 'aim') return;
  if (toastInputLeft() <= CFG.alienReveal + 1e-9) {
    a.revealed = true; a.cup = r.alienChoice; a.flash = 0.45;
    bubbles.length = 0;
    r.partner = a.leaders[a.cup];
    r.target = r.base + a.cup * a.step;
    r.move = (a.cup - 1) * a.step;
  }
}
function alienRimY(cup) {
  const i = cup == null ? st.alien.cup : cup;
  return st.alien.leaders[i].P.rim.y;
}
function alienRimX(cup) { return st.alien.leaders[cup == null ? st.alien.cup : cup].P.rim.x; }
function stepAlienLeaders(dt) {
  const a = st.alien, r = st.round, fl = playFloor();
  st.bossJ = st.bossOff = st.bossOffV = 0;
  a.leaders.forEach((c, i) => {
    const y = r.base + i * a.step;
    c.s = r.smash ? 1 : sForRim(c.spec, y - floorY(st.L));
    c.tilt = c.vtilt = 0; poseFromS(c, c.s);
    const selected = !r.smash && a.revealed && i === a.cup && r.phase === 'aim' && toastInputLeft() <= 0;
    const homeX = player.x + 340 + i * 235 - tableAt(c.spec, c.s).cupDX;
    if (selected) {
      // Reveal at one second; move only on zero, arriving with the player's reach.
      if (r.alienApproachX == null) r.alienApproachX = c.x;
      const contactX = Math.max(player.P.cupB.x, player.P.rim.x) + 24 * SC - tableAt(c.spec, c.s).cupDX;
      const duration = Math.max(0.12, reachTime() - Math.min(0.06, timingWindow() * 0.25));
      c.x = lerp(r.alienApproachX, contactX, ease(clamp(-toastInputLeft() / duration, 0, 1)));
    } else c.x += (homeX - c.x) * Math.min(1, 7 * dt);
    settle(c, fl);
    if (!r.smash) { c.y += y - c.P.rim.y; c.P = fk(c); }
    updateCup(c, dt, true);
  });
}
function com(c, P) {
  const w = [[P.hip, 3], [P.knee, 1.5], [P.ankle, 1], [P.shoulder, 3], [P.head, 2], [P.hand, 0.6], [P.belly, c.spec.belly ? 2 : 0.5]];
  let x = 0, y = 0, s = 0; for (const [p, k] of w) { x += p.x * k; y += p.y * k; s += k; } return { x: x / s, y: y / s };
}

// NPC pose keyframes: s, k, b, phi, arm
const KF = [[0, 0, 0.05, 0, 0.3], [0.25, 0.12, 0.8, 0, 0.95], [0.5, 1, 0.55, 0, 1.05], [0.75, 1, 1.45, 0.12, 1.35], [1, 0.15, 0.1, 1.5, 0.95]];
function poseFromS(c, s) {
  s = clamp(s, 0, 1);
  let i = 0; while (i < KF.length - 2 && s > KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1], t = (s - a[0]) / (b[0] - a[0]);
  c.k = lerp(a[1], b[1], t); c.b = lerp(a[2], b[2], t); c.phi = lerp(a[3], b[3], t); c.arm = lerp(a[4], b[4], t);
}
const tables = new Map();
function poseTable(spec) {
  if (tables.has(spec)) return tables.get(spec);
  const c = mkChar(spec, -1), T = [];
  for (let i = 0; i <= 100; i++) { const s = i / 100; poseFromS(c, s); c.x = 0; c.y = 0; settle(c, 0); const P = c.P, sc = P.sc;
    const front = Math.min(P.head.x - P.hr, P.knee.x - 14 * sc, P.shoulder.x - 22 * sc, spec.belly ? P.belly.x - 31 * sc : 1e9, P.hip.x - 22 * sc);
    T.push({ s, rim: P.rim.y, cupDX: P.rim.x - c.x, frontDX: front - c.x }); }
  // monotonic "lowest reachable so far"
  let m = -1e9; for (const e of T) { m = Math.max(m, e.rim); e.low = m; }
  tables.set(spec, T); return T;
}
function sForRim(spec, rimRel) { const T = poseTable(spec); for (const e of T) if (e.low >= rimRel) return e.s; return 1; }
function tableAt(spec, s) { const T = poseTable(spec); return T[Math.round(clamp(s, 0, 1) * 100)]; }

// ---------------------------------------------------------------- state
const keys = { Q: 0, W: 0, O: 0, P: 0, Space: 0 };
// control feel: '惯性' (accel: keys push, with damping) or '直接' (vel: keys set the speed). ?ctl=accel|vel, saved.
const CTL_KEY = 'toastLower.ctl.v22';
let CTL = params.get('ctl'); try { if (CTL !== 'accel' && CTL !== 'vel') CTL = localStorage.getItem(CTL_KEY); } catch (e) { /* no storage */ }
if (CTL !== 'accel' && CTL !== 'vel') CTL = 'accel';
function toggleCtl() { CTL = CTL === 'accel' ? 'vel' : 'accel'; try { localStorage.setItem(CTL_KEY, CTL); } catch (e) { /* ignore */ } sfx('tick'); }
const DIFFICULTIES = [
  { id: 'easy', level: '简单', name: '我爸是局长', hint: '领导等你，手也稳些', get time() { return CFG.easyTime; }, get taper() { return CFG.easyTaper; }, get setup() { return CFG.easySetup; }, get hand() { return CFG.easyHand; } },
  { id: 'normal', level: '中等', name: '00后整顿酒桌', hint: '该扶扶，该碰碰', get time() { return CFG.normalTime; }, get taper() { return CFG.normalTaper; }, get setup() { return CFG.normalSetup; }, get hand() { return CFG.normalHand; } },
  { id: 'hard', level: '高难', name: '35岁，杯杯是房贷', hint: '手要稳，时机要准', get time() { return CFG.hardTime; }, get taper() { return CFG.hardTaper; }, get setup() { return CFG.hardSetup; }, get hand() { return CFG.hardHand; } }
];
let debugMenuOpen = false;
function applySettings(selection) {
  Object.assign(CFG, CONFIG.save(localStorage, selection.values)); REACH_TIME = CFG.reachTime;
  if (selection.ctl !== CTL) toggleCtl();
  saveStartL(selection.layer); setMute(selection.muted);
  if (st.state !== 'title') { st.paused = false; restart(); }
}
function openDebugMenu() {
  debugMenuOpen = true; clearInputs();
  window.ToastSettings.open({ values: CFG, difficulty: difficultyId, difficulties: DIFFICULTIES,
    ctl: CTL, layer: START_LAYER, muted, paused: st.paused, touch: TOUCH,
    layers: Array.from({ length: Math.max(STORY_N + 1, START_LAYER + 1) }, (_, i) => layerLabel(i)),
    onSave: applySettings, onClose: () => { debugMenuOpen = false; }
  });
}
const DIFFICULTY_KEY = 'toastLower.difficulty';
let difficultyId = params.get('difficulty');
try { if (!DIFFICULTIES.some(d => d.id === difficultyId)) difficultyId = localStorage.getItem(DIFFICULTY_KEY); } catch (e) {}
if (!DIFFICULTIES.some(d => d.id === difficultyId)) difficultyId = 'normal';
function difficulty() { return DIFFICULTIES.find(d => d.id === (st.tut ? 'normal' : difficultyId)); }
function selectDifficulty(id) {
  if (!DIFFICULTIES.some(d => d.id === id)) return;
  difficultyId = id;
  try { localStorage.setItem(DIFFICULTY_KEY, id); } catch (e) {}
  sfx('tick');
}

const BOT = params.get('bot') || (AUTO ? 'human' : CAPTURE ? 'smart' : null);
const AUTO_RESTART = AUTO && !CAPTURE && !params.has('once');
const st = { state: (AUTO || CAPTURE) ? 'play' : 'title', L: START_LAYER, t: 0, stT: 0, playT: 0, layerT: 0, flipped: false, cycle: 0, pressure: 0, shake: 0,
  cracks: [], crackX: 540, holes: {}, best: 0, depth: 0, breaks: 0, lastCrackStep: 0, bossSay: 2, sawLow: false,
  score: 0, strikes: 0, toasts: 0, perfects: 0, combo: 0, bestCombo: 0, hype: 0, bursts: 0, manualToasts: 0, round: null, tut: null, judge: null, freeze: 0, gain: null, stand: 0, perfect: false, perfT: 0, notPerfT: 1, hist: [], trick: 0, trickT: 0, over: null, gameT: 0,
  floorPlan: null, hiscore: 0, bestDifficulty: null, newRecord: false, botT: 0, coreBonus: false, warnT: 0, paused: false, bump: null, bossOff: 0, bossJ: 0, bossJT: 0, tdrT: 0 };
// New scoring has its own versioned record; the old score remains in storage, untouched.
const BEST_KEY = 'toastLower.best.v3';
try {
  const best = JSON.parse(localStorage.getItem(BEST_KEY));
  if (best && Number.isFinite(best.score) && best.score >= 0 && DIFFICULTIES.some(d => d.id === best.difficulty)) {
    st.hiscore = best.score; st.bestDifficulty = best.difficulty;
  }
} catch (e) { /* no storage */ }
const cam = { x: 540, y: 500, z: 1 };
let player, boss, followers = [], pending = [];
const parts = [], debris = [], puddles = [], bubbles = [], popups = [];
let bigText = null;

// Music/volume and touch ergonomics do not change score eligibility.
function isCustomRun() {
  const presentation = new Set(['musicVolume', 'spillSoundVolume', 'spillSoundInterval', 'stickDeadzone', 'stickCurve']);
  return START_LAYER !== 0 || CTL !== 'accel' || (BOT && BOT !== 'none') ||
    ['wob', 'slx', 'drf', 'bmp', 'spm', 'feel', 'debug', 'frame'].some(k => params.has(k)) ||
    Object.keys(CONFIG.defaults).some(k => !presentation.has(k) && CFG[k] !== CONFIG.defaults[k]);
}
function saveBest() {
  if (st.tut || st.customRun || isCustomRun() || st.score <= st.hiscore) return;
  st.newRecord = true; st.hiscore = st.score; st.bestDifficulty = difficultyId;
  try { localStorage.setItem(BEST_KEY, JSON.stringify({ score: st.score, difficulty: difficultyId })); } catch (e) { /* private mode */ }
}

// Score-based banquet titles. The banana is reserved for a zero-score run.
const RANKS = [
  [0, '成年香蕉', '手是长了，但没完全长'],
  [1, '卧龙凤雏', '左手卧龙，右手凤雏'],
  [4500, '小孩那桌', '这桌暂时还坐不了'],
  [12000, '夹菜我转桌', '主打一个不懂事'],
  [30000, '乌鸦哥', '敬不好就掀桌'],
  [65000, '端水大师', '杯子端稳，谁也不得罪'],
  [130000, '懂事长', '敬酒敬出了管理岗'],
  [230000, '敬酒悍匪', '开始主动进攻'],
  [360000, '国家一级陪酒员', '仿佛持证上岗'],
  [450000, '先天敬酒圣体', '天生就是吃这桌饭的'],
  [540000, '铁血山东 👍', '人情世故拉满'],
  [600000, 'DeepDrink', '敬酒大模型'],
];
function rankFor(score) {
  let rank = RANKS[0];
  for (const entry of RANKS) if (score >= entry[0]) rank = entry;
  return rank.slice(1);
}
function breakPts(L) { return CFG.floorScore * (L + 1); }
function makeFloorPlan() {
  const rounds = activeMech() === 'alien' ? CFG.alienRounds : chainCount() ? CFG.chainRounds : st.L < 2 ? CFG.openingRounds : CFG.regularRounds;
  const notes = chainCount() || 1, start = st.stand + 40 * SC / 1.45;
  const end = Math.max(start, Math.min(start + (rounds - 1) * diff().drop, floorLimit() - (st.alien ? 2 * st.alien.step : 0) - 12));
  // A separate per-stage sequence: missed inputs and cosmetic particles cannot reroll targets.
  let rng = runSeed ^ Math.imul(st.L + 1, 0x9e3779b1);
  const random = () => { rng = rng + 0x6D2B79F5 | 0; let t = Math.imul(rng ^ rng >>> 15, 1 | rng); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const targets = Array.from({ length: rounds }, (_, i) => {
    const base = lerp(start, end, rounds > 1 ? i / (rounds - 1) : 0);
    const variation = !i || st.alien ? 0 : (i % 2 ? 1 : -1) * (0.45 + 0.55 * random()) * (st.L < 3 ? [12, 22, 34][st.L] : 45 + 25 * Math.min(1, shapeK(st.L))) * SC / 1.45;
    return { base, target: clamp(base + variation, st.stand + 15, floorLimit() - 4), alienChoice: Math.floor(random() * 3) };
  });
  return { layer: st.L, rounds, notes, targets, claimed: Array(rounds * notes).fill(null), floorAwarded: false };
}
function claimScoreOpportunity(result) {
  const r = st.round, plan = st.floorPlan;
  if (st.tut || !r || r.smash || !plan || plan.layer !== st.L) return false;
  const slot = r.progress * plan.notes + (r.chainIndex || 0);
  if (!Number.isInteger(slot) || slot < 0 || slot >= plan.claimed.length || plan.claimed[slot] !== null) return false;
  plan.claimed[slot] = result;
  return true;
}
// difficulty grows with depth, without limit (endless mode keeps going)
const TUNE = new URLSearchParams(location.search);
const WOB = +(TUNE.get('wob') || 0.15), SLX = +(TUNE.get('slx') || 0.1), DRF = +(TUNE.get('drf') || 0.12), BMP = +(TUNE.get('bmp') || 0.1), SPM = +(TUNE.get('spm') || 1.0);
function diff() {
  const L = st.L;
  // T: countdown seconds, drop: how much lower the boss goes after each good clink, reach: how far below his rim he can still clink
  // named layers ramp gently and plateau at layer 10 (index 9), so 地心 is reachable with practice;
  // endless mode (index 13+) keeps ramping slowly from that plateau
  // layers 1-2 stay gentle; from layer 3 every layer is a clear step on BOTH hands, capped at layer 10 (index 9)
  const u = Math.min(L, 9) / 9, e = Math.max(0, L - 12), b0 = Math.min(L, 1) / 9, k = Math.max(0, Math.min(L, 9) - 1);
  // height side: boss sway, drift-up, bump shove (smaller ramp than before: his shrinking cup already narrows the window)
  return { L, k, wob: 1 + b0 + WOB * k + 0.04 * e,
    // the cup side is mostly the cups' shapes now (cupGeom); only small ramps are left here
    slx: 1 + SLX * k + 0.03 * e,                                        // cup side: how hard things slosh the drink
    drift: 1 + b0 + DRF * k + 0.03 * e, driftT: 1 + 0.06 * k,          // cup side: slow lean strength / how often it turns
    bumpT: 1 + BMP * k + 0.02 * e,                                      // cup side: bump kick on the cup + wave
    T: Math.max(1.35, 2.7 + ([0.85, 0.6, 0.35, 0.15][L] || 0) - 0.85 * b0 - 0.13 * k - 0.04 * e),
    drop: (80 + 9 * Math.min(L, 16)) * SC / 1.45 };
}

function say(c, pair, dur) { bubbles.length = 0; // one speech bubble at a time
  bubbles.push({ c, t: 0, dur: dur || 1.8, zh: mobileWords(pair[0]), en: pair[1] }); }
// Chatter is cosmetic: never consume the gameplay RNG or select the next target.
const TOMB_CHAT = ['别拘束，跟自己家一样。', '这几位都是老前辈。', '老员工都在这儿了。', '再喝五百年！'];
const ALIEN_CHAT = ['我是你的碰杯人。', '主敬你一杯。', '执杯人，举杯。', '给文明以酒精。', '我已脱水，急需补液。', '主不在乎。', '不要回答。', '你们这儿敬酒不报销？', '我有三个肝，你随意。'];
function stepChapterChatter() {
  const r = st.round;
  if (st.tut || st.state !== 'play' || !r || (!r.chain && !st.alien)) return;
  // Clear chatter before the first cue of a tomb phrase or the alien reveal.
  if (r.phase === 'aim' && !r.smash && toastInputLeft() <= (st.alien ? CFG.alienReveal : 2 * r.chainBeat)) {
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].chapterChat) bubbles.splice(i, 1);
  }
  if (r.phase !== 'react' || r.smash || r.result !== 'ok' || r.chatChecked || r.t < 0.12) return;
  r.chatChecked = true;
  // Two quiet gaps per room, never on retries or between consecutive notes.
  const plan = st.floorPlan;
  const slots = r.chain && layerDef(st.L).room !== 2 ? [0] : [0, 1];
  if (!slots.includes(r.progress) || (plan.chatSlots || []).includes(r.progress)) return;
  (plan.chatSlots ||= []).push(r.progress);
  const seen = st.chatSeen ||= [];
  let speaker = boss, line;
  if (st.alien) {
    if (!seen.includes('这两位都是上面的。')) line = '这两位都是上面的。';
    else {
      const pool = ALIEN_CHAT.filter(x => !seen.includes(x));
      if (!pool.length) return;
      line = pool[Math.floor(Math.random() * pool.length)];
      speaker = st.alien.leaders[1 + Math.floor(Math.random() * 2)];
    }
  } else {
    let pool = TOMB_CHAT.filter(x => !seen.includes(x));
    // The boast is a rare punchline after the three conversational lines.
    if (pool.length > 1) pool = pool.filter(x => x !== '再喝五百年！');
    if (!pool.length) return;
    line = pool[Math.floor(Math.random() * pool.length)];
  }
  seen.push(line);
  say(speaker, [line], 1.8); bubbles[0].chapterChat = true;
}
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function banner(zh, en, dur, col) { bigText = { zh, en, t: 0, dur: dur || 2.2, col: col || '#ffd34d' }; }
function addScore(n) { n = Math.round(n); if (n <= 0) return; st.score += n; if (!st.gain || st.gain.t > 0.9) st.gain = { n: 0, t: 0 }; st.gain.n += n; st.gain.t = 0; }

function formation(L) {
  prepareAlienLeaders();
  const fl = floorY(L); // formation snaps to rest floor; shake applies live in step
  player.mode = 'play'; player.reach = 0; player.reachV = 0; player.h = 0; player.sw = 0; player.swv = 0; player.vh = 0; player.veh = 0; player.vet = 0; player.tdr = 0; player.w = 0; player.wv = 0; player.lastVh = 0; player.cupBodySpeed = 0; player.tilt = 0; player.vtilt = 0; poseFromS(player, 0); player.vy = 0; player.x = 340; settle(player, fl);
  boss.mode = 'play'; boss.s = 0; poseFromS(boss, 0); boss.x = 640; settle(boss, fl);
  let x = boss.x;
  for (const f of followers) { f.mode = 'play'; f.s = 0; poseFromS(f, 0); x += 150; f.x = x; settle(f, fl); }
  st.stand = player.P.rim.y; st.bump = null; st.bossOff = 0; st.bossJ = 0; st.alien = null; ensureAlien();
  if (st.alien) st.alien.leaders.forEach((c, i) => { c.x = 640 + i * 235; settle(c, fl); });
  if (layerDef(L).cupName && !st.tut) banner(layerDef(L).cupName + '！', '', 1.4, '#ffd34d');
}
function spawnPending(L) {
  pending = [];
  const fl = floorY(L + 1), j = layerDef(L + 1).join;
  j.forEach((spec, i) => { const c = mkChar(spec, i % 2 ? -1 : 1); c.s = 0.05; poseFromS(c, 0.05); c.x = 760 + i * 170; settle(c, fl); pending.push(c); });
  if (pending.length === 1) { pending[0].face = -1; pending[0].x = 840; settle(pending[0], fl); }
}
function reset() {
  player = mkChar(P_SPEC, 1); boss = mkChar(st.tut ? MOM_SPEC : (activeMech(st.L) === 'alien' || (activeMech(st.L) === 'mix' && layerDef(st.L).mech === 'alien') ? ALIEN_HOST : activeMech(st.L) === 'chain' ? TOMB_BOSS : B_SPEC), -1); followers = []; pending = [];
  for (let l = st.L; l >= 1; l--) for (const s of layerDef(l).join) followers.push(mkChar(s, -1)); // newest joiners stand closest to the boss
  formation(st.L); player.wine = wineCapacity(); if (!st.tut) spawnPending(st.L);
  cam.y = floorY(st.L) - 320; st.depth = layerDef(st.L).depth;
}
reset();
function restart() {
  runSeed = explicitSeed ?? Math.floor(Math.random() * 4294967296); seed = runSeed; physicsSeed = runSeed ^ 0x51ed270b;
  window.ToastMusic.reset();
  Object.assign(st, { L: START_LAYER, flipped: false, cycle: 0, holes: {}, score: 0, floorPlan: null, breaks: 0, strikes: 0, toasts: 0, perfects: 0, round: null, over: null, newRecord: false, coreBonus: false,
    t: 0, tdrT: 0, swT: 0, bossJT: 0, why: {}, wineLedger: null, wineNotices: [], customRun: isCustomRun(), chatSeen: [], pressure: 0, cracks: [], lastCrackStep: 0, playT: 0, layerT: 0, gameT: 0, state: 'play', stT: 0, best: 0, sawLow: false, bossSay: 1.5, alien: null,
    combo: 0, bestCombo: 0, hype: 0, bursts: 0, manualToasts: 0, judge: null, freeze: 0, gain: null, paused: false, clinkGrace: 0, spillT: 0, spillOn: false, loss: 0, lossT: 9, punch: null });
  parts.length = debris.length = puddles.length = bubbles.length = popups.length = 0;
  reset(); bigText = null; player.wine = wineCapacity(); syncMusic();
  clearInputs(); fx.length = 0; flash = null;
  const ch = chapterOf(st.L);
  if (ch && !st.tut) banner(layerLabel(st.L), '', 1.6);
  say(player, PLAYER_LINES[0], 1.6);
  newRound(true);
}

function allChars() { return [player, boss, ...followers]; }

// ---------------------------------------------------------------- input
const KEYMAP = { KeyQ: 'Q', KeyW: 'W', KeyO: 'O', KeyP: 'P', ArrowLeft: 'Q', ArrowRight: 'W', ArrowDown: 'O', ArrowUp: 'P' };
const heldKeys = new Set();
function clearInputs() { heldKeys.clear(); pointers.clear(); resetStick(); for (const k in keys) keys[k] = 0; }
function runActive() { return ['play', 'fall', 'standup'].includes(st.state); }
function rearmRoundClock() {
  const r = st.round;
  if (!r || r.smash || r.phase !== 'aim' || st.tut) return;
  // Keep already judged notes and the target; restart only the pending cue sequence.
  r.t = 0; r.T = (st.alien ? CFG.alienCountdown : Math.max(CFG.minWait, 2 * 60 / CFG.musicBpm)) + reachTime() - 0.5;
  r.musicAnchor = null; r.cue = null; r.clockWaiting = false;
  r.attacking = false; r.attackT = 0; r.mh = []; player.reach = player.reachV = 0;
}
function setPaused(value) { if (!value && st.rearmAfterPause) { rearmRoundClock(); st.rearmAfterPause = false; } st.paused = value; debugMenuOpen = false; clearInputs(); syncMusic(); }
function returnToTitle() {
  saveBest();
  clearInputs(); debugMenuOpen = false;
  Object.assign(st, { state: 'title', stT: 0, L: START_LAYER, tut: null, paused: false, round: null, over: null,
    freeze: 0, punch: null, judge: null, gain: null, shake: 0, pressure: 0, flipped: false, holes: {} });
  reset(); bigText = null; flash = null;
  parts.length = debris.length = puddles.length = bubbles.length = popups.length = fx.length = 0;
  window.ToastMusic.reset(); syncMusic();
}
function startFromTitle(forceTut) { debugMenuOpen = false; if (forceTut || st.tut) { startTutorial(); return; } restart(); }
addEventListener('keydown', e => {
  if (window.ToastSettings.isOpen()) return;
  gestured = true; window.ToastMusic.gesture(); syncMusic();
  if (KEYMAP[e.code] || e.code === 'Space') e.preventDefault();
  if (e.repeat && !KEYMAP[e.code]) return;
  if ((st.state === 'title' || st.paused) && e.code === 'KeyD' && e.shiftKey) { if (debugMenuOpen) debugMenuOpen = false; else openDebugMenu(); return; }
  if (debugMenuOpen && e.code === 'Escape') { debugMenuOpen = false; return; }
  if (st.state === 'title' && !debugMenuOpen && /^Digit[123]$/.test(e.code)) { selectDifficulty(DIFFICULTIES[+e.code.slice(-1) - 1].id); return; }
  if (e.code === 'KeyC' && (st.state === 'title' || st.paused)) {  return; }
  if (debugMenuOpen) return;
  if (e.code === 'Escape' && runActive()) { setPaused(!st.paused); return; }
  if (e.code === 'KeyM') { setMute(!muted); if (!muted) sfx('ding'); return; }
  if (st.paused) { if (e.code === 'Space' || e.code === 'Enter') setPaused(false); return; }
  if (st.state === 'title') { if (['Space', 'Enter', 'KeyT'].includes(e.code)) startFromTitle(e.code === 'KeyT'); return; }
  if (e.code === 'KeyS' && st.tut) { endTutorial(); return; }
  if (e.code === 'Space' && !BOT && st.state === 'play') { heldKeys.add(e.code); refreshKeys(); requestToast(); return; }
  if (KEYMAP[e.code] && !BOT && st.state === 'play') { heldKeys.add(e.code); refreshKeys(); }
  if (e.code === 'KeyR' && (st.state === 'over' || st.state === 'play')) { if (st.tut) startTutorial(); else restart(); }
  if (params.has('debug') && e.code === 'BracketRight' && st.state === 'play') breakFloor();
});
addEventListener('keyup', e => { heldKeys.delete(e.code); refreshKeys(); });
addEventListener('blur', () => { clearInputs(); if ((!BOT || BOT === 'none') && runActive()) st.paused = true; syncMusic(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (!BOT || BOT === 'none')) { clearInputs(); if (runActive()) st.paused = true; } syncMusic(); });
// touch / mouse on the key legend
// two clusters: LEFT = 手·杯 (Q tip back / W tip forward: the cup's angle), RIGHT = 身·高低 (O down / P up)
const BTN = [['Q', '后仰', 'tip back'], ['W', '前倾', 'tip forward'], ['O', '弯下', 'go down'], ['P', '起身', 'stand up']];
const GROUPS = [{ zh: '手 · 杯', hand: '左手', col: '#7fd0ff', keys: [0, 1] }, { zh: '身 · 高低', hand: '右手', col: '#ffb36b', keys: [2, 3] }];
function btnRect(i) {
  const g = i < 2 ? 0 : 1, j = i % 2;
  if (LAY === 'port') { const bw = 246, x0 = g ? 560 : 16; return { x: x0 + j * (bw + 12), y: btnTop() + 46, w: bw, h: 254 }; }
  if (LAY === 'land') { const bw = 200, gap = 14; return g === 0 ? { x: 30 + j * (bw + gap), y: btnTop() + 36, w: bw, h: 164 } : { x: W - 30 - (2 - j) * bw - (1 - j) * gap, y: btnTop() + 36, w: bw, h: 164 }; }
  return { x: (g ? 572 : 50) + j * 232, y: 962, w: 220, h: 92 };
}
function groupRect(g) { const a = btnRect(GROUPS[g].keys[0]), b = btnRect(GROUPS[g].keys[1]), top = LAY === 'desk' ? 28 : LAY === 'land' ? 32 : 42; return { x: a.x - 10, y: a.y - top, w: b.x + b.w - a.x + 20, h: a.h + top + 10 }; }
// one icon family: a cup with an arrow for the hand keys, a little figure for the body keys
function btnIcon(k, cx, cy, sz, col) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sz / 100, sz / 100); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (k === 'Q' || k === 'W') { // a cup tipping back / forward, with a curved arrow
    const dir = k === 'Q' ? -1 : 1; ctx.save(); ctx.translate(-10, 6); ctx.rotate(dir * 0.38);
    ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(-18, 34); ctx.lineTo(18, 34); ctx.lineTo(26, -30); ctx.closePath(); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(-10, 6, 50, -PI / 2 - 0.55, -PI / 2 + 0.55); ctx.stroke();
    const ex = -10 + Math.cos(-PI / 2 + dir * 0.55) * 50, ey = 6 + Math.sin(-PI / 2 + dir * 0.55) * 50;
    ctx.beginPath(); ctx.moveTo(ex - dir * 16, ey - 8); ctx.lineTo(ex, ey); ctx.lineTo(ex - dir * 4, ey - 20); ctx.stroke();
  } else if (k === 'O') { // bow down
    circ(6, -10, 13, col); ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-24, 10); ctx.lineTo(-24, 46); ctx.moveTo(-24, 10); ctx.lineTo(-14, 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, -40); ctx.lineTo(40, 30); ctx.moveTo(26, 14); ctx.lineTo(40, 34); ctx.lineTo(54, 14); ctx.stroke();
  } else { // stand up
    circ(-14, -42, 13, col); ctx.beginPath(); ctx.moveTo(-14, -28); ctx.lineTo(-14, 10); ctx.lineTo(-22, 46); ctx.moveTo(-14, 10); ctx.lineTo(-6, 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, 40); ctx.lineTo(30, -30); ctx.moveTo(16, -14); ctx.lineTo(30, -34); ctx.lineTo(44, -14); ctx.stroke();
  }
  ctx.restore();
}
const pointers = new Map();
// A pointer owns its control until release; the toast thumb cannot steal the stick.
const stick = { id: null, x: 0, y: 0, rawX: 0, rawY: 0 };
function stickRect() { return { x: LAY === 'land' ? 240 : 260, y: H - 240, r: 140, hit: 205 }; }
function resetStick() { stick.id = null; stick.x = stick.y = stick.rawX = stick.rawY = 0; }
function updateStick(p) {
  const r = stickRect(), dx = (p.x - r.x) / r.r, dy = (p.y - r.y) / r.r;
  const length = Math.max(1, Math.hypot(dx, dy));
  stick.rawX = dx / length; stick.rawY = dy / length;
  const axis = v => Math.sign(v) * Math.pow(clamp((Math.abs(v) - CFG.stickDeadzone) / (1 - CFG.stickDeadzone), 0, 1), CFG.stickCurve);
  stick.x = axis(stick.rawX); stick.y = axis(stick.rawY);
}
function mobileWords(value) {
  if (!TOUCH || typeof value !== 'string') return value;
  return value.replace('Q 往后仰，W 往前倾，扶平它', '摇杆左右推，把杯子扶平')
    .replace('点按 Q / W，把杯子扶平', '左右轻推摇杆，把杯子扶平')
    .replace('酒往前涌按 Q，往后涌按 W', '酒往前涌向左扶，往后涌向右扶')
    .replace('好！P 是起身', '好！摇杆向上推，起身')
    .replace('慢慢按 O 往下，边走边扶杯', '摇杆斜着轻推，边弯腰边扶杯')
    .replace('Q/W 继续扶杯', '左手继续扶杯')
    .replace('那就按住 O 趴到底，继续按住，砸穿地板！', '摇杆向下推住，趴到底后继续推，砸穿地板！')
    .replace('按住 O：趴下，再继续砸', '摇杆向下推住：趴下，再继续砸')
    .replaceAll('按住 O', '摇杆向下推住').replaceAll('按住 P', '摇杆向上推')
    .replaceAll('按空格', '点「敬酒」');
}
function canvasPt(e) {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  return rotated ? { x: y * W, y: (1 - x) * H } : { x: x * W, y: y * H };
}
// multi-touch: every finger is tracked by pointerId, so Q+W+O+P can all be held at once.
// A finger that slides from one button onto another switches keys (like a real gamepad).
function btnAt(p) { if (st.state === 'play' && (!st.tut || st.tut.step === 5) && hitR(p, toastButtonRect())) return 'Space'; for (let i = 0; i < 4; i++) { const r = btnRect(i), m = 8; if (p.x > r.x - m && p.x < r.x + r.w + m && p.y > r.y - m && p.y < r.y + r.h + m) return BTN[i][0]; } return null; }
function refreshKeys() { if (BOT) return; for (const k in keys) keys[k] = 0; if (st.paused) return; for (const code of heldKeys) { if (KEYMAP[code]) keys[KEYMAP[code]] = 1; else if (code === 'Space') keys.Space = 1; } for (const k of pointers.values()) if (k && k !== 'stick') keys[k] = 1;
  if (TOUCH && stick.id !== null) {
    keys.Q = Math.max(keys.Q, -stick.x); keys.W = Math.max(keys.W, stick.x);
    keys.O = Math.max(keys.O, stick.y); keys.P = Math.max(keys.P, -stick.y);
  }
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); gestured = true; window.ToastMusic.gesture(); syncMusic();
  { const q0 = canvasPt(e), pb = pauseBtnRect();
    if (st.state !== 'title' && hitR(q0, homeBtnRect())) { returnToTitle(); return; }
    if (runActive() && !st.paused && q0.x > pb.x && q0.x < pb.x + pb.w && q0.y > pb.y && q0.y < pb.y + pb.h) { setPaused(true); return; }
    if (st.state === 'title' || st.paused) {
      const q = overlayPt(q0);
      if (debugMenuOpen) return;
      if (hitR(q, debugEntryRect())) { openDebugMenu(); return; }
      if (st.state === 'title') {
        const i = DIFFICULTIES.findIndex((d, i) => hitR(q, difficultyRect(i)));
        if (i >= 0) { selectDifficulty(DIFFICULTIES[i].id); return; }
        if (hitR(q, titleTutRect())) startFromTitle(true);
        else if (hitR(q, titleStartRect())) startFromTitle(false);
        return;
      }
      if (hitR(q, muteRect())) { setMute(!muted); return; }
      setPaused(false); return;
    }
  }
  if (st.tut) { const q = canvasPt(e); if (q.y < hudBottom() && q.x > W * 0.7) { endTutorial(); return; } }
  else if (st.state === 'over') { if (st.stT > 1.2) restart(); return; }
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const pt = canvasPt(e);
  if (TOUCH) {
    if (st.state !== 'play') return;
    const sr = stickRect();
    if (Math.hypot(pt.x - sr.x, pt.y - sr.y) <= sr.hit && stick.id === null) {
      stick.id = e.pointerId; pointers.set(e.pointerId, 'stick'); updateStick(pt);
    } else if ((!st.tut || st.tut.step === 5) && hitR(pt, toastButtonRect())) pointers.set(e.pointerId, 'Space');
  } else pointers.set(e.pointerId, btnAt(pt));
  refreshKeys();
  if (pointers.get(e.pointerId) === 'Space') requestToast();
});
cv.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return; e.preventDefault(); if (TOUCH) { if (stick.id === e.pointerId) { updateStick(canvasPt(e)); refreshKeys(); } return; } const k = btnAt(canvasPt(e)); if (k !== pointers.get(e.pointerId)) { pointers.set(e.pointerId, k); refreshKeys(); } });
const up = e => { if (pointers.has(e.pointerId)) { pointers.delete(e.pointerId); if (stick.id === e.pointerId) resetStick(); refreshKeys(); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
// no long-press menus, no pinch / double-tap zoom, no page scroll
addEventListener('contextmenu', e => e.preventDefault());
for (const ev of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'dblclick']) document.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });

// ---------------------------------------------------------------- bots (?auto=1 / ?bot=smart|w|random|none)
// Bots only press Q/W/O/P. They read the screen the way a player does (rim heights, the cup's angle and how
// fast both are moving) and correct with taps and holds; 'human' reacts slower and keeps fingers down a bit longer.
const BOTS = { smart: { re: [0.07, 0.12], off: 15, dwell: 0, slip: 0.015, wa: 0.7, wb: 0.7 }, human: { re: [0.11, 0.18], off: 22, dwell: 0.06, slip: 0.008, wa: 0.7, wb: 0.7 }, expert: { re: [0.04, 0.07], off: 16, dwell: 0, slip: 0, wa: 0.9, wb: 1.05 },
  // a first-time player: sees things ~0.3 s late, taps coarsely, leans against the wave only a little, sometimes reads the cup wrong
  novice: { re: [0.12, 0.2], off: 20, dwell: 0.24, slip: 0.012, wa: 0.3, wb: 0.12, delay: [0.25, 0.35], misread: 0.05, dz: 0.07, dzh: 8, look: 0.6 /* how much of its own lag it guesses ahead */ } };
function runBot(dt) {
  if (BOT === 'none') return;
  const hold = { w: 'W', q: 'Q', o: 'O', p: 'P' }[BOT];
  if (hold) { for (const k of 'QWOP') keys[k] = k === hold ? 1 : 0; return; }      // exploit tests: hold one key forever
  if (BOT === 'qw') { keys.Q = keys.W = 1; keys.O = keys.P = 0; return; }
  if (BOT === 'novice') { const H_ = st.botHist || (st.botHist = []), p = player;
    H_.push({ t: st.t, tilt: p.tilt, vt: p.cupRate || p.vtilt + p.vet, w: p.w, wv: p.wv, ry: p.P ? p.P.rim.y : 0 });
    while (H_.length > 2 && st.t - H_[0].t > 0.8) H_.shift(); }
  st.botT -= dt; if (st.botT > 0) return;
  if (BOT === 'random') { st.botT = R(0.12, 0.4); for (const k of 'QWOP') keys[k] = rnd() < 0.5 ? 1 : 0; return; }
  const p = player, r = st.round, B = BOTS[BOT === 'park' ? 'expert' : BOT] || BOTS.smart, acc = CTL === 'accel';
  if (BOT === 'park') { // exploit test: get into the window once, cup level, then let go of everything for good
    if (st.parked) { for (const k of 'QWOP') keys[k] = 0; return; }
    if (r && !r.smash && r.phase === 'aim' && boss.P) { const g = p.P.rim.y - toastRimY(); st.parkT = g > 0 && g < winSpan() && Math.abs(p.tilt) < 0.05 ? (st.parkT || 0) + 0.1 : 0; if (st.parkT > 0.4) st.parked = true; } }
  const prev = { ...keys }; st.botT = R(B.re[0], B.re[1]);
  // the cup: keep it level, looking a little ahead, and lean against the wave as it surges (Q while it rushes forward)
  // what the bot "sees": live for the trained bots, ~0.3 s old for the novice
  let o = { tilt: p.tilt, vt: p.cupRate || p.vtilt + p.vet, w: p.w, wv: p.wv, ry: p.P.rim.y, vr: null };
  if (B.delay) { const H_ = st.botHist, tt = st.t - R(B.delay[0], B.delay[1]); let i = 0; while (i < H_.length - 1 && H_[i + 1].t <= tt) i++;
    const j = Math.max(0, i - 6); o = { ...H_[i], lag: st.t - H_[i].t, vr: H_[i].t > H_[j].t ? (H_[i].ry - H_[j].ry) / (H_[i].t - H_[j].t) : 0 }; }
  let tp = o.tilt + ((acc ? 0.2 : 0.08) + (B.look || 0) * (o.lag || 0)) * o.vt + B.wa * o.w + B.wb * o.wv / WAVE.om;
  if (B.misread && rnd() < B.misread) tp = -tp;        // reads the tilt the wrong way round
  const dz = B.dz || 0.04; keys.Q = tp > dz ? 1 : 0; keys.W = tp < -dz ? 1 : 0;
  if (st.tut && st.tut.step === 3 && st.tut.sub === 0 || BOT === 'onehand') { keys.Q = 0; keys.W = 0; }         // tutorial: let the cup drift first
  // the body: rim a little under his (or flat on the floor to smash)
  const smash = r && r.smash, ry = o.ry, vr = o.vr != null ? o.vr : st.botRim != null && st.t > st.botRimT ? (ry - st.botRim) / (st.t - st.botRimT) : 0;
  st.botRim = ry; st.botRimT = st.t;
  if (st.tut && st.tut.step === 2) { keys.O = 0; keys.P = 1; }
  else if (BOT === 'flat' || smash) { keys.O = 1; keys.P = 0; }
  else if (r && boss.P) {
    const br = toastRimY();
    const aimBase = br; // toastRimY is the live clink height (alien ladder included)
    const aimY = aimBase + Math.min(B.off, 0.45 * winSpan()), err = aimY - (ry + vr * ((acc ? 0.14 : 0.08) + (B.look || 0) * (o.lag || 0))); // > 0: go lower
    const e2 = B.misread && rnd() < B.misread * 0.5 ? -err : err, dh = B.dzh || 4;
    keys.O = e2 > dh ? 1 : 0; keys.P = e2 < -dh ? 1 : 0;
  } else { keys.O = keys.P = 0; }
  if (B.slip && rnd() < B.slip) { const k = pick(['Q', 'W', 'O', 'P']); keys[k] = 1 - keys[k]; }
  if (B.dwell) { // a finger stays down (or up) for a moment unless something is urgent
    st.keyT = st.keyT || { Q: 9, W: 9, O: 9, P: 9 }; const el = st.botLast ? st.t - st.botLast : 0;
    for (const k of 'QWOP') { st.keyT[k] += el; const urgent = (k === 'Q' || k === 'W') ? Math.abs(o.tilt + o.w) > 0.2 : smash;
      if (keys[k] !== prev[k] && st.keyT[k] < B.dwell && !urgent && !(prev[k] && (k === 'O' || k === 'P'))) keys[k] = prev[k]; if (keys[k] !== prev[k]) st.keyT[k] = 0; }
    st.botLast = st.t;
  }
  // Read the leader's incoming gesture, then tap once. Keep balancing throughout the reach.
  keys.Space = r && r.attacking && r.phase === 'aim' ? 1 : 0;
  if (r && canToast()) {
    const gap = p.P.rim.y - toastRimY();
    const late = roundLeft() <= reachTime();
    const ready = roundLeft() <= reachTime() + Math.min(0.06, timingWindow() * 0.25);
    if (ready && (late || gap > 0 && gap < winSpan() && Math.abs(p.tilt + p.w) < spillLim())) {
      keys.Space = 1; requestToast();
    }
  }

}

// ---------------------------------------------------------------- particles
// From 到底了！ through the smash, the fall and the stand-up you can't steer the cup, so it can't spill either.
function noSpill() {
  const r = st.round;
  if (st.state === 'fall' || st.state === 'standup') return true;
  if (st.state === 'play' && r && r.smash && (r.phase === 'tie' || r.phase === 'aim')) return true;
  // 空档 between alien cups — setup only, never judged / never drained
  if (r && r.phase === 'gap') return true;
  // brief recovery after a good clink (react juice while you stand back up)
  if (r && r.phase === 'react' && roundSucceeded(r)) return true;
  if (st.clinkGrace && st.t < st.clinkGrace) return true;
  return false;
}
function spill(c, n, vmul) {
  if (c.wine <= 0.02 || (c === player && noSpill())) return;
  const P = c.P; if (!P) return;
  for (let i = 0; i < n; i++) parts.push({ x: P.rim.x + R(-10, 10), y: P.rim.y + R(-4, 4), vx: c.hv.x * 0.5 * (vmul || 1) + R(-160, 160), vy: c.hv.y * 0.5 * (vmul || 1) + R(-260, 40), life: 2.5, r: R(4, 8), col: rnd() < 0.25 ? '#fffbe8' : drinkCol(c), type: 'drop' });
  if (c === player) st.gaugeSplash = 1;
}
function dust(x, y, n, col) { for (let i = 0; i < n; i++) parts.push({ x: x + R(-30, 30), y: y - R(0, 10), vx: R(-260, 260), vy: R(-420, -60), life: R(0.4, 0.9), r: R(4, 10), col: col || '#cdbb9c', type: 'dust' }); }

function updateCup(c, dt, gentle) {
  const P = c.P; if (!c.hp) c.hp = { x: P.hand.x, y: P.hand.y };
  const vx = (P.hand.x - c.hp.x) / dt, vy = (P.hand.y - c.hp.y) / dt;
  const ax = (vx - c.hv.x) / dt;
  c.hv = { x: vx, y: vy }; c.hp = { x: P.hand.x, y: P.hand.y };
  if (c === player && c.mode === 'play' && st.state === 'play') return; // player's cup is simulated in stepBeer
  const a = -60 * c.tilt - 6 * c.vtilt - clamp(ax, -40000, 40000) * 0.0016 * c.face;
  c.vtilt += a * dt; const tiltLimit = c === player ? CFG.cupTiltLimit * PI / 180 : 1.4; c.tilt = clamp(c.tilt + c.vtilt * dt, -tiltLimit, tiltLimit);
  const speed = Math.hypot(vx, vy);
  if (!gentle && (Math.abs(c.tilt) > 0.35 || speed > 650) && rnd() < 0.7) spill(c, 1 + Math.floor(speed / 900));
}

// ---------------------------------------------------------------- floor break
// One impact line for each story floor, ordered by the room we fall into.
const STORY_SMASH_LINES = [
  '说好的上升空间呢？！',
  '我说低调！不是地窖！！',
  '地板也被优化了！',
  '八！十！！',
  '打通底层逻辑！！',
  '下面还有高手？！',
  '我这一杯，二十年功力！！',
  '从天而降的杯法！！',
  '向下兼容！！',
  '面子碎了！！',
  '降层打击！！',
  '还有谁！！',
];
function breakFloor() {
  if (st.state !== 'play' || st.tut) return;
  const L = st.L, fl = floorY(L);
  // score for this floor
  if (st.floorPlan && !st.floorPlan.floorAwarded) {
    st.floorPlan.floorAwarded = true;
    addScore(breakPts(L));
    addScore(player.wine * CFG.floorWineScore * (L + 1));
    if (L === STORY_N - 1 && START_LAYER === 0 && st.breaks === STORY_N - 1) addScore(CFG.clearScore);
  }
  saveBest();
  let x1 = 1e9, x2 = -1e9;
  for (const c of allChars()) { const P = c.P || fk(c); for (const p of [P.hip, P.head, P.toe, P.hand]) { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); } }
  x1 -= 160; x2 += 160;
  const jag = (n) => { const a = []; for (let i = 0; i <= n; i++) a.push(R(-45, 45)); return a; };
  st.holes[L] = { x1, x2, jl: jag(6), jr: jag(6) };
  const col = art(L).slab;
  for (let i = 0; i < 46; i++) debris.push({ x: R(x1, x2), y: fl + R(0, SLAB), vx: R(-250, 250), vy: R(-500, 100), rot: R(0, 6), vr: R(-8, 8), w: R(24, 70), h: R(18, 46), col: rnd() < 0.3 ? art(L).floorTop : col });
  dust(st.crackX, fl, 50);
  st.shake = 36; st.breaks++; sfx('break'); sfx('smash'); sfx('boing'); buzz([50, 40, 140]); juiceFlash('#fff3c4', 0.25);
  const burst = st.round && st.round.burst;
  const smashLine = STORY_SMASH_LINES[L] || (L === 14 ? '地球：你礼貌吗？' : '');
  st.punch = smashLine ? { word: smashLine, t: 0, col: L === 9 ? '#ffdf62' : '#fff3c4' } : null;
  bigText = null; st.judge = null;
  for (const c of allChars()) { c.mode = 'fall'; c.landed = false; c.vy = R(-380, -120); c.vx = R(-70, 70); c.vrot = R(-6, 6); c.bounced = 0; }
  bubbles.length = 0;
  if (burst) say(boss, ['我没让你拆楼啊！！'], 1.4);
  st.state = 'fall';
  if (L === 14) { st.punch.word = '地球：你礼貌吗？'; st.coreBonus = true; }
  st.stT = 0; st.pressure = 0; st.cracks = [];
}

function addCrack() {
  const fl = floorY(st.L);
  const pts = [{ x: st.crackX + R(-20, 20), y: fl }]; let ang = R(0, PI); const n = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) { const p = pts[pts.length - 1]; ang += R(-0.6, 0.6); const dx = Math.cos(ang) * R(25, 55), dy = Math.abs(Math.sin(ang)) * R(10, 30) + 4; pts.push({ x: p.x + dx, y: Math.min(fl + SLAB - 6, p.y + dy) }); }
  st.cracks.push(pts);
}

// ---------------------------------------------------------------- game over
const OVER_TEXT = {
  beer: ['失败', 'FAILED'],
};
function gameOver(reason) {
  if (st.state !== 'play') return;
  st.state = 'over'; st.stT = 0; syncMusic();
  st.over = { reason, difficulty: difficultyId, cleared: START_LAYER === 0 && st.breaks >= STORY_N && st.L >= STORY_N, score: st.score, layer: st.L, depth: st.depth, people: allChars().length, t: st.gameT };
  saveBest();
  st.over.wine = { ...wineLedger() }; st.over.custom = !!(st.customRun || isCustomRun());
  clearInputs();
  bubbles.length = 0; st.shake = 16; sfx('thud');
  const p = player;
  if (reason === 'beer') {
    say(boss, ['酒呢？'], 2.5);
  } else {
    say(boss, ['明天不用来了！'], 3);
  }
}
function stepOver(dt) {
  const p = player, fl = floorY(st.L), t = st.t, r = st.over.reason;
  if (r === 'beer') {
    p.arm += (1.6 - p.arm) * 3 * dt; p.b += (0.3 - p.b) * 2 * dt;
  }
  p.P = fk(p); const low = lowest(p, p.P); p.y += fl - low; p.P = fk(p);
  // boss: stands up and looks down at you
  const sT = r === 'boss' ? 0 : boss.s;
  boss.s += (sT - boss.s) * Math.min(1, 2.5 * dt); poseFromS(boss, boss.s); settle(boss, fl);
  for (const f of followers) { f.s += (Math.min(1, boss.s + 0.1) - f.s) * Math.min(1, 3 * dt); poseFromS(f, f.s); settle(f, fl); }
  if (AUTO_RESTART && st.stT > 5) restart();
}

// ---------------------------------------------------------------- update
// The player: O/P move the body down/up (h: 0 standing .. 1 flat on the floor); Q/W tip the cup back/forward.
// Bowing and reaching rotate the wrist and shift body balance. Both hands stay active through contact.
// Disturbances (same in both control modes) act on separate 'external' velocities veh / vet:
//   bowing is tiring (the body drifts back up), the cup slowly drifts toward tipping, and the odd telegraphed bump.
// Short, predictable inertia; reversing the input gives a positive brake.
const FEEL = { accel: { get hA() { return CFG.bodyAccel; }, get hD() { return CFG.bodyBrake; }, get tA() { return CFG.cupAccel; }, get tD() { return CFG.cupBrake; }, kH: 0.025, kT: 0.035, get rel() { return CFG.releaseCup; }, get relH() { return CFG.releaseBody; } }, vel: { hV: 0.65, tV: 0.92, sm: 28 } };
if (params.get('feel')) {
  const values = params.get('feel').split(',').map(Number);
  if (values.length === 4 && values.every(Number.isFinite)) {
    FEEL.accel.kH = clamp(values[0], 0, 1); FEEL.accel.kT = clamp(values[1], 0, 1);
    CFG.releaseCup = clamp(values[2], 0.1, 1); CFG.releaseBody = clamp(values[3], 0.1, 1);
  }
} // test only

function disturbLive() { const r = st.round; return st.state === 'play' && r && !r.smash && (r.phase === 'aim' || r.phase === 'clink' || r.phase === 'react'); }
function stepDisturb(dt, d) {
  const p = player, live = disturbLive() && !st.tut, allowBump = live && !['chain', 'alien'].includes(activeMech()), tutDrift = st.tut && st.tut.drift;
  // the cup's slow lean: a new direction every few seconds
  st.tdrT -= dt;
  if (st.tdrT <= 0) { st.tdrT = physicsRange(1.6, 3.2) / d.driftT; p.tdrGoal = (physicsRandom() < 0.5 ? -1 : 1) * physicsRange(0.3, 0.55) * d.drift; }
  const goal = live ? (p.tdrGoal || 0) * (['chain', 'alien'].includes(activeMech()) ? CFG[difficulty().id + 'FocusDrift'] : 1) : tutDrift ? 0.35 * Math.sign(p.tdrGoal || 1) : 0;
  p.tdr += (goal - p.tdr) * Math.min(1, 2 * dt);
  // a bump: ~0.8 s warning (! over your head), then a shove on height and/or tilt
  const b = st.bump;
  if (allowBump && !b) st.bump = { at: st.t + physicsRange(6, 10) / Math.sqrt(d.wob), done: false };
  else if (b && !b.done && !allowBump) st.bump = null;                       // smash round / break: call it off
  else if (b && !b.done && st.t > b.at + 0.8) {
    { const m = 0.75 + 0.35 * d.wob; b.done = true; sfx('shove'); buzz(35); st.shake = Math.max(st.shake, 7);
      if (physicsRandom() < 0.7) p.veh += (physicsRandom() < 0.5 ? -1 : 1) * 0.38 * m; const sg = physicsRandom() < 0.5 ? -1 : 1; p.vet += sg * 0.28 * d.bumpT; slosh(sg * physicsRange(0.85, 1.25) * d.bumpT); }
  } else if (b && b.done && st.t > b.at + 1.6) st.bump = null;
}
// Drunk sway (real, not just drawn): your body bobs up and down by itself (~1.7 s), and the bob GROWS while
// nobody fights it, up to about the size of the clink window, so parking and letting go drifts you out of it.
// Pushing against it (O while it rises, P while it sinks) brakes it hard; a random nudge now and then restarts it.
// It also rocks the cup (see moveCup). Off in smash rounds, falls, stand-ups and the first tutorial steps.
const SWAY = { om: 2 * PI / 1.7, grow: 0.10, brace: 11 };
function swayFade(p) { return clamp(p.h / 0.12, 0, 1); }
// v20f_feel: ~1/3 of the clink window — readable bob, easy to brace against
function swayAmp() { return (st.tut ? 16 : (CTL === 'vel' ? 0.18 : 0.42) * winSpan() * Math.min(1, 0.45 + instab()) * difficulty().hand) / 288; }
function swayOn() { const r = st.round; if (st.tut) return !!st.tut.sway && st.state === 'play'; return disturbLive() && !['chain', 'alien'].includes(activeMech()); }
function stepSway(p, dt, d) {
  if (!swayOn()) { const f = Math.exp(-4 * dt); p.sw = (p.sw || 0) * f; p.swv = (p.swv || 0) * f; return; }
  const om = SWAY.om, A = swayAmp(), amp = Math.hypot(p.sw || 0, (p.swv || 0) / om);
  st.swT = (st.swT || 0) - dt; if (st.swT <= 0) { st.swT = physicsRange(1.2, 2.4); p.swv = (p.swv || 0) + (physicsRandom() < 0.5 ? -1 : 1) * physicsRange(0.4, 1) * 0.35 * A * om; }
  let a = -om * om * p.sw + 2 * SWAY.grow * om * p.swv * (amp < A ? 1 : -1.5);   // self-exciting up to A, then held there
  if (p.vh * p.swv < 0) a -= SWAY.brace * Math.abs(p.vh) * p.swv;              // fighting it brakes it
  p.swv += a * dt; p.sw += p.swv * dt;
}
function moveBody(p, K, dt, d) {
  const F = FEEL[CTL], down = (K.O || 0) - (K.P || 0);
  // tiring: the lower you are, the more you drift back up (not while smashing on the floor)
  const smashing = st.round && st.round.smash;
  const tire = smashing || st.tut && st.tut.step < 4 ? 0 : (0.10 + 0.055 * Math.min(1, instab())) * p.h;
  // Body fatigue stays, but reaching no longer applies a one-way forward load.
  const load = smashing || st.tut ? 0 : 0.10 * p.tilt;
  p.veh += (load - tire - (CTL === 'vel' ? 9 : 4.0) * p.veh) * dt;
  if (CTL === 'accel') {
    // 惯性: optional press kick / release brake on height (kH/relH). Cup tilt has its own kick in moveCup.
    // Height press "bite" for players is mostly the visual squash (stepVis); keep physics glide clean when kH is 0.
    if ((F.kH || F.relH < 0.999) && Math.sign(down) !== (p.kH || 0)) {
      const v0 = p.vh;
      // height: gentle reverse (glide); bite lives in hA ramp, not press-kick
      if (down) { if (p.vh * down < 0) p.vh *= 0.55; if (F.kH) p.vh = down * Math.max(p.vh * down, F.kH); }
      else p.vh *= F.relH;
      p.kH = Math.sign(down); p.lastVh = (p.lastVh || 0) + p.vh - v0;
    }
    p.vh += (down * F.hA - F.hD * p.vh) * dt;
  } else {
    // Practice removes coasting, but keeps the same balance and contact rules.
    const precision = 1;
    if (!down) p.vh = 0;
    else p.vh += (down * F.hV * precision - p.vh) * Math.min(1, F.sm * dt);
  }
  p.h += (p.vh + p.veh) * dt;
  if (p.h < 0) { p.h = 0; p.vh = Math.max(0, p.vh); p.veh = Math.max(0, p.veh); }
  if (p.h > 1) { p.h = 1; p.vh = Math.min(0, p.vh); p.veh = Math.min(0, p.veh); }
  stepSway(p, dt, d);
  poseFromS(p, h2s(clamp(p.h + p.sw * swayFade(p) + (p.reach || 0) * 0.018, 0, 1)));
  // pounding the floor with O during a smash: a little bob of the arm and shoulders
  if (smashing && p.h > 0.9 && K.O && st.round.phase === 'aim') { const bob = Math.abs(Math.sin(st.t * 15)); p.arm += 0.3 * bob; p.phi -= 0.08 * bob; }
}
// The drink has its own wave: w = how far the surface leans toward the FRONT of the cup (radians, relative to
// level), a damped spring with a ~0.8 s period. Spill when tilt + w goes past the rim. Fast height changes,
// bumps, the clink and the boss jostling near contact kick it. Turning the cup pushes the wave the SAME way,
// so tipping BACK (Q) while the drink surges forward (w rising) takes energy out; mistimed, it pumps it up.
// v20f_feel: settle faster; micro height taps don't pump a spill; Q/W (kT) still the clear counter
const WAVE = { om: 2 * PI / 0.8, z: 0.20, kT: 3.8, kH: 0.62 };
function slosh(dv) { if (!noSpill()) player.wv += dv; }
function moveCup(p, K, dt, d) {
  const F = FEEL[CTL], fwd = (K.W || 0) - (K.Q || 0);
  // a tipped cup wants to tip further (unstable, like balancing a stick) and the bobbing body rocks it
  // v20f_feel: weaker self-tip + less body-bob → tilt so Q/W corrections stick
  const live = st.tut ? !!st.tut.sway : disturbLive(), kt = !live ? 0 : st.tut ? 1.0 : 1.2 + 1.7 * instab();
  const bob = (p.swv || 0) * swayFade(p);
  p.vet += (0.35 * p.tdr + 0.9 * bob + kt * p.tilt - (CTL === 'vel' ? 7 : 4.8) * p.vet) * dt;
  if (CTL === 'accel') {
    if (Math.sign(fwd) !== (p.kT || 0)) { if (fwd) { if (p.vtilt * fwd < 0) p.vtilt *= 0.38; p.vtilt += fwd * F.kT; } else p.vtilt *= F.rel; p.kT = Math.sign(fwd); }
    p.vtilt += (fwd * F.tA - F.tD * p.vtilt) * dt;
  } else {
    if (!fwd) p.vtilt = 0;
    else p.vtilt += (fwd * F.tV - p.vtilt) * Math.min(1, F.sm * dt);
  }
  // Predictable coupling follows body speed and its change; reaching adds no one-way torque.
  const bodySpeed = p.vh + p.veh, bodyAccel = clamp((bodySpeed - (p.cupBodySpeed || 0)) / dt, -4, 4);
  p.cupBodySpeed = bodySpeed;
  const coupled = st.tut && st.tut.step < 4 ? 0 : (CTL === 'vel' ? 0.76 : 1) *
    (CFG[difficulty().id + 'BodyCupCoupling'] * bodySpeed + CFG.bodyBrakeCoupling * bodyAccel);
  const rate = p.vtilt + p.vet + coupled * difficulty().hand;
  const previousTilt = p.tilt, tiltLimit = CFG.cupTiltLimit * PI / 180;
  p.tilt = clamp(p.tilt + rate * dt, -tiltLimit, tiltLimit);
  p.cupRate = (p.tilt - previousTilt) / dt;
  if (p.tilt >= tiltLimit) { p.vtilt = Math.min(0, p.vtilt); p.vet = Math.min(0, p.vet); }
  if (p.tilt <= -tiltLimit) { p.vtilt = Math.max(0, p.vtilt); p.vet = Math.max(0, p.vet); }
  // Body acceleration and braking also push the liquid in a readable direction.
  const aH = bodyAccel;
  const ex = st.tut ? 0.7 : d.slx * difficulty().hand;
  let f = WAVE.kT * p.cupRate;                                                    // turning the cup drives the wave the same way
  f += WAVE.kH * ex * clamp(aH, -12, 12);                                    // speeding up / braking the bow
  const r = st.round;
  if (r && !st.tut && !r.smash && (r.phase === 'clink' || (r.phase === 'aim' && roundLeft() < 1.2)))
    f += 0.006 * ex * clamp(st.bossOffV || 0, -200, 200) * WAVE.om;          // the boss jostles as he comes close
  const om = WAVE.om, quiet = noSpill() || st.state !== 'play';
  p.wv += (f - om * om * p.w - 2 * (quiet ? 0.6 : WAVE.z) * om * p.wv) * dt;
  p.w = clamp(p.w + p.wv * dt, -0.9, 0.9);
}
function stepPlayer(dt) {
  const p = player, fl = playFloor(), d = diff();
  stepReach(dt);
  stepDisturb(dt, d);
  // ground rumble: a little wave kick (feel) — never during smash/tie when you can't steer the cup
  if (shakeParams(st.L) && !noSpill() && !st.tut) {
    const ga = groundAcc();
    p.wv = (p.wv || 0) - ga * 0.000012;
  }
  moveBody(p, keys, dt, d);
  p.vy += G * dt; p.y += p.vy * dt;
  let P = fk(p), low = lowest(p, P);
  if (low > fl) { p.y -= low - fl; if (p.vy > 500) { st.shake = Math.max(st.shake, 8); sfx('thud'); } p.vy = 0; }
  p.x = clamp(p.x, 200, 700);
  p.P = fk(p);
  updateCup(p, dt);
  stepBeer(dt, d);
  pressCheck(dt, d);
}

function stepBeer(dt, d) {
  const p = player;
  moveCup(p, keys, dt, d);
  // tilt plus the wave against the rim: the limit is the cup's own shape (atan(free / half-width)); a smaller bowl
  // loses a bigger fraction of its smaller reserve. All drain rates use starting-glass units.
  const g = cupGeom(p), over = Math.abs(p.tilt + p.w) - g.lim;
  if (over > 0 && !noSpill()) {
    // longer grace: rim flashes / drops warn first; a brief tip is a few %, never an empty cup
    st.spillT = (st.spillT || 0) + dt;
    const gr = st.tut ? 1 : clamp(1 - st.L / 10, 0.28, 1);
    const ramp = clamp((st.spillT - CFG.spillGrace * gr) / (CFG.spillRamp * (1 / 3 + 2 / 3 * gr)), 0, 1);
    const rate = over * 0.34 * SPM * CFG.spillMultiplier / Math.sqrt(g.cap) * beerK() * ramp;
    const lost = Math.min(p.wine, Math.min(CFG.spillMax / 100, rate) * dt); // hard cap ~11%/s even wide open
    changeWine('spill', lost);
    if (rnd() < 0.22 + over * 0.7) spill(p, 1 + Math.floor(over * 2));
    if (!st.spillOn) { st.spillOn = true; st.dripAt = st.t; sfx('splash'); buzz(15); }
    else if (lost > 0 && st.t - st.dripAt > CFG.spillSoundInterval) { st.dripAt = st.t; sfx('drip'); }
  }
  else { st.spillT = Math.max(0, (st.spillT || 0) - 2.6 * dt); st.spillOn = false; }
  st.lossT = (st.lossT || 0) + dt;
  if (p.wine <= 0) { p.wine = 0; if (st.tut) { p.wine = 0.7; say(boss, ['妈给你满上'], 1.4); } else gameOver('beer'); }
}

function smashOn() { const r = st.round; return !!(r && r.smash && r.phase === 'aim'); }
function pressCheck(dt, d) {
  if (st.state !== 'play') return;
  const p = player, fl = floorY(st.L);
  if (p.h > 0.9 && keys.O && smashOn()) { // flat on the floor, holding O: pound it
    st.crackX = p.P.cupB.x;
    st.pressure += dt / (st.tut ? 0.7 : CFG.smashCharge * (st.breaks > 0 ? CFG.repeatSmashScale : 1));
    st.shake = Math.max(st.shake, 3 + st.pressure * 6);
    if (rnd() < 0.3) dust(p.P.head.x, fl, 1);
  } else st.pressure = Math.max(0, st.pressure - dt * 0.05);
  const steps = Math.floor(st.pressure * 10);
  while (st.lastCrackStep < steps) { st.lastCrackStep++; addCrack(); addCrack(); sfx('crack'); buzz(18); st.shake = Math.max(st.shake, 10); }
  if (steps < st.lastCrackStep) st.lastCrackStep = steps;
  if (st.pressure >= 1) { if (st.tut) st.pressure = 1; else breakFloor(); }
}

// ---------------------------------------------------------------- clinking rounds
// The leader keeps a visible countdown and reaches on his beat. Space commits the player's reach.
// At actual contact, timing, relative height and cup balance are all judged together.
// After a good clink he politely goes lower next time. Once his target is below what a cup can
// reach on this floor, the round becomes a SMASH round: break the floor before the countdown ends.
const POLITE_LINES = [['你的腰，比我前途还灵活'], ['别卷了，我腰有工伤'], ['这份敬意，承重墙收到了'], ['嘴上说随意，膝盖很诚实']];
const RUDE_LINES = [['你敬的是天花板？'], ['杯子挺高，情商挺低'], ['这杯里装的是辞职信？'], ['你小子想坐我这个位置？']];
const ROUND_EVENTS = {
  feint: { title: '假客气', hint: '他说随意，杯子还会再降！', col: '#b8a0ff' },
  rush: { title: '领导赶下一场', hint: '这一杯节奏更快 · 看伸手动作', col: '#ffad72' },
  steady: { title: '全桌都看着你', hint: '卡准那一拍 · 碰杯时也要扶稳', col: '#79dfcd' },
};
function toastButtonRect() {
  if (TOUCH) return { x: W - 380, y: H - 360, w: 280, h: 240 };
  if (LAY === 'port') return { x: W / 2 - 225, y: btnTop() - 136, w: 450, h: 116 };
  if (LAY === 'land') return { x: W / 2 - 190, y: H - 134, w: 380, h: 98 };
  return { x: W / 2 - 174, y: 873, w: 348, h: 58 };
}
let REACH_TIME = CFG.reachTime;
function reachTime() { return st.round && st.round.chain ? Math.min(REACH_TIME, CFG.chainReach, 60 / CFG.musicBpm * 0.38) : REACH_TIME; }
// A readable reaction window; later rooms keep some timing pressure.
function timingWindow() { const d = difficulty(); const w = CTL === 'vel' ? d.time + CFG.practiceBonus : d.time - d.taper * Math.min(1, shapeK(st.L)); return st.round && st.round.chain ? Math.min(w, 60 / CFG.musicBpm * CFG[d.id + 'ChainWindow']) : w; }
// The visible clock targets the input beat, compensating for the reach animation.
function toastInputLeft() { return roundLeft() - reachTime(); }
function toastBeatReady() { return Math.abs(toastInputLeft()) <= timingWindow(); }
function canToast() {
  const r = st.round;
  return !st.paused && st.state === 'play' && (!st.tut || st.tut.step === 5) && st.freeze <= 0 && r && r.phase === 'aim' && !r.smash && !r.attacking && !(st.alien && !st.alien.revealed) && r.t > 0.22;
}
// Space commits to one physical reach. The leader keeps his beat; Q/W/O/P stay live until contact.
function requestToast() {
  if (!canToast()) return false;
  const r = st.round; r.attacking = true; r.attackT = 0; r.manual = true;
  r.attempts = (r.attempts || 0) + 1;
  return true;
}
function stepReach(dt) {
  const p = player, r = st.round, before = p.reach || 0;
  if (!r || st.tut && st.tut.step !== 5 || st.state !== 'play') { p.reach = 0; p.reachV = 0; return; }
  if (r.phase === 'aim' && r.attacking) {
    r.attackT += dt;
    p.reach = clamp(r.attackT / reachTime(), 0, 1);
  } else p.reach = Math.max(0, before - dt / (r.chain ? 0.10 : 0.48));
  p.reachV = (p.reach - before) / dt;
}
function floorLimit() { return floorY(st.L) - 83 * SC; } // lower than this and nobody can clink on their feet: smash time
function roundLeft() { const r = st.round; return r ? 0.5 + r.T - r.t : 9; }
function newRound(fresh) {
  const d = diff(), fl = floorY(st.L), prev = st.round;
  if (!fresh && prev && roundSucceeded(prev) && !prev.refilled && !st.tut && st.state === 'play' && player.wine > 0) {
    refillWine(CFG.roundRefill / 100); prev.refilled = true;
  }
  ensureAlien();
  if (!st.tut && (fresh || !st.floorPlan || st.floorPlan.layer !== st.L)) st.floorPlan = makeFloorPlan();
  const progress = fresh || !prev ? 0 : (prev.progress || 0) + (!prev.smash && roundSucceeded(prev) ? 1 : 0);
  const planned = !st.tut && st.floorPlan.targets[Math.min(progress, st.floorPlan.rounds - 1)];
  if (st.alien) { st.alien.cup = 1; st.alien.revealed = false; }
  const partner = boss;
  const base = planned ? planned.base : fresh || !prev ? st.stand + 40 * SC / 1.45
    : prev.base + (roundSucceeded(prev) ? d.drop : 0);
  const cupBias = (st.alien && st.alien.on && !st.tut) ? st.alien.cup * st.alien.step : 0;
  const heightBias = cupBias;
  const smash = !st.tut ? progress >= st.floorPlan.rounds : (prev && !fresh && prev.smash && prev.result !== 'ok') || (base + (st.alien ? 2 * st.alien.step : heightBias)) > floorLimit();
  let target = base + heightBias;
  if (planned && !st.alien) target = planned.target;
  if (smash) target = fl + poseTable(boss.spec)[100].low;
  const retry = smash && prev && !fresh && prev.smash;
  if (st.alien && st.alien.on && !smash && !st.tut) st.alien.flash = 0.5;
  let T = smash ? d.T * 1.6 + 1.6 : Math.max(CFG.minWait, CFG.roundWait - CFG.depthSpeedup * Math.min(1, shapeK(st.L))) - 0.5 + (prev && !fresh ? clamp(Math.abs(target - (prev.target || target)) / 400, 0, CFG.retargetBonus) : 0);
  if (!smash && !st.tut) T = Math.max(Math.max(CFG.minWait, reachTime() + 0.5) - 0.5, T + difficulty().setup);
  if (st.alien && st.alien.on && !smash && !st.tut) T = CFG.alienCountdown + reachTime() - 0.5; // full input countdown, independent of ordinary setup/depth
  st.round = { progress, phase: smash && !retry ? 'tie' : 'aim', t: 0, T, target, base, off: target - base, move: prev && !fresh && !smash ? target - prev.target : 0, smash, mh: [], result: null, n: (fresh || !prev ? 0 : prev.n) + 1, beep: 4, partner, alienCup: st.alien ? st.alien.cup : 0 };
  if (!smash && chainCount()) {
    st.round.chain = chainCount(); st.round.chainIndex = 0; st.round.chainHits = 0;
    st.round.chainResults = []; st.round.chainBeat = 60 / CFG.musicBpm;
    st.round.comboStart = st.combo; st.round.chainMisses = 0; st.round.chainPerfects = 0; st.round.scoredHits = 0;
  }
  if (st.alien && !smash) st.round.alienChoice = planned ? planned.alienChoice : Math.floor(rnd() * 3);
  st.judge = null;
  // A visible change of rules every few cups, with an opening beat to read it.
  if (!smash && !st.tut && !st.round.chain && !(st.alien && st.alien.on) && progress > 0) {
    st.round.event = ['feint', 'rush', 'steady'][(progress - 1 + st.L) % 3];
    if (st.round.event === 'rush') st.round.T = Math.max(CFG.minWait - 0.5, (st.round.T + 0.5) * CFG.rushScale - 0.5);
  }
  if (smash && !retry) { st.judge = null; if (!bubbles.some(b => b.chapterChat)) { banner('到底了！', '', 1.6, '#ff9a3d'); say(boss, ['…到底了？'], 1.8); } }
  else if (smash) say(boss, ['再来！砸！'], 1.2);
  else if (st.round.chain || st.alien) { /* Chatter belongs to the gaps after successful rounds. */ }
  else if (rnd() < 0.5) { const ln = pick(BOSS_LINES); if (!st.judge) say(boss, ln, 1.4); }
}
// ---- feedback (sound / sparks / flashes): visual + audio only, never the seeded rng, never the rules
const fx = []; let flash = null;
function juiceFlash(col, a) { flash = { col, a, a0: a }; }
function juiceClink(kind, tut) {
  const tc0 = toastChar(), x = (player.P.rim.x + (tc0.P ? tc0.P.rim.x : boss.P.rim.x)) / 2, y = (player.P.rim.y + toastRimY()) / 2;
  if (kind === 'bad') { if (tut) { sfx('thud'); juiceFlash('#ff3030', 0.25); buzz(40); } return; }
  const pf = kind === 'perfect'; sfx(pf ? 'perfect' : 'ding'); buzz(pf ? [18, 40, 28] : 14);
  if (pf) juiceFlash('#ffd34d', 0.42);
  const n = pf ? 16 : 10;
  for (let i = 0; i < n; i++) { const a = (i / n) * 2 * PI + Math.random() * 0.3, v = (pf ? 520 : 380) * (0.6 + Math.random() * 0.6);
    fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.42, l0: 0.42, col: pf ? '#ffe680' : '#ffffff' }); }
  fx.push({ k: 'ring', x, y, life: 0.4, l0: 0.4, r: pf ? 110 : 70, col: pf ? '#ffd34d' : '#ffffff' });
}
function stepFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= dt; if (f.life <= 0) { fx.splice(i, 1); continue; }
    if (f.k === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.exp(-6 * dt); f.vy = f.vy * Math.exp(-6 * dt) + 600 * dt; } }
  if (flash) { flash.a -= flash.a0 * dt / 0.3; if (flash.a <= 0) flash = null; }
}
function drawFx() {
  ctx.lineCap = 'round';
  for (const f of fx) { const a = f.life / f.l0; ctx.globalAlpha = a; ctx.strokeStyle = f.col;
    if (f.k === 'spark') { const e = { x: f.x - f.vx * 0.04, y: f.y - f.vy * 0.04 }; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 9; line(f, e); ctx.strokeStyle = f.col; ctx.lineWidth = 5; line(f, e); }
    else { ctx.lineWidth = 7 * a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.2 - a), 0, 2 * PI); ctx.stroke(); } }
  ctx.globalAlpha = 1;
}
function strike(zh, en, why) {
  if (!st.round || st.round.result === 'strike' || st.state !== 'play') return;
  st.why = st.why || {}; st.why[why || 'high'] = (st.why[why || 'high'] || 0) + 1;
  claimScoreOpportunity('miss');
  st.strikes++; st.combo = 0; if (!st.round.chain || !st.round.chainMisses) st.hype = Math.max(0, st.hype - CFG.hypeMiss); sfx('thud'); st.shake = Math.max(st.shake, 14); juiceFlash('#ff3030', 0.22); buzz(60);
  if (zh) banner(zh, '', 1.1, '#ff4d4d');
  if (st.judge && st.judge.t < 0.2) { if (!st.judge.sub) judgeSay(pick(RUDE_LINES)); }
  else if (!bubbles.length || bubbles[0].c !== boss || bubbles[0].t > 0.5) say(boss, pick(RUDE_LINES), 1.4);
  if (st.alien && st.round.partner && st.round.partner.spec.alien && !st.round.smash) {
    if (st.judge) { st.judge.sub = '酒量不存在了。'; bubbles.length = 0; }
    else { say(st.round.partner, ['酒量不存在了。'], 1.4); bubbles[0].alienIntro = true; }
  }
  st.round.result = 'strike';
  if (!st.tut) {
    const r = st.round, misses = r.chainMisses || 0;
    const fraction = r.chain ? chainPenaltyRatio(r, misses + 1) - (misses ? chainPenaltyRatio(r, misses) : 0) : 1;
    r.chainMisses = misses + 1;
    changeWine('penalty', CFG.missPenalty / 100 * fraction);
    if (player.wine <= 0) { player.wine = 0; gameOver('beer'); }
  }
}
// the boss's reaction rides under the judgment word (one message at a time, no bubble on top of it)
function judgeSay(pair) { if (st.judge) { st.judge.sub = pair[0]; bubbles.length = 0; } else say(boss, pair, 1.6); }
function finishToastAttempt() {
  const r = st.round;
  if (r.chain) {
    if (r.chainIndex >= r.chain) return;
    r.lastNoteResult = r.result;
    r.chainResults.push(r.result === 'ok'); if (r.result === 'ok') r.chainHits++;
    st.freeze = 0; st.shake = Math.min(st.shake, 2); bigText = null; bubbles.length = 0;
    if (st.judge) st.judge.compact = true;
    if (++r.chainIndex < r.chain && st.state === 'play') {
      r.T += r.chainBeat;
      if (r.cue) { r.cue.target += r.chainBeat; r.cue.next = 2; }
      r.result = null; r.attacking = false; r.attackT = 0; r.manual = false;
      player.reach = 0; player.reachV = 0;
      return;
    }
  }
  if (st.state !== 'play') { r.phase = 'react'; r.t = 0; return; }
  if (r.chain) {
    r.groupOutcome = r.chainHits === r.chain ? 'all-hit' : r.chainHits > 0 ? 'partial' : 'miss';
    if (r.scoredHits > 0) {
      st.combo = r.chainHits === r.chain && !r.chainMisses ? r.comboStart + 1 : 0;
      st.bestCombo = Math.max(st.bestCombo, st.combo);
      if (r.chainPerfects === r.chain) refillWine(CFG.perfectRefill / 100);
      awardHype((CFG.hypeHit * r.scoredHits + (CFG.hypePerfect - CFG.hypeHit) * r.chainPerfects) / r.chain);
    }
  }
  r.phase = 'react'; r.t = 0;
}
function awardHype(amount) {
  st.hype = Math.min(100, st.hype + amount);
  if (st.hype < 100) return;
  st.hype = 0; st.bursts++; addScore(CFG.hypeScore * (st.L + 1));
  refillWine(CFG.hypeRefill / 100);
  if (st.judge) { st.judge.word = '全桌服气！！'; st.judge.col = '#ffdf62'; }
  if (!st.round.chain) { st.freeze = Math.max(st.freeze, 0.17); st.shake = Math.max(st.shake, 12); }
}
function judgeClink() {
  const r = st.round, d = diff(), L = d.L;
  if (!r || (!r.tut && r.phase !== 'aim') || r.result) return;
  const by = toastRimY();
  const margin = player.P.rim.y - by;
  r.margin = margin;
  r.timing = roundLeft();
  const timed = !r.tut || st.tut && st.tut.step === 5;
  const offBeat = timed && Math.abs(r.timing) > timingWindow();
  // Perfect requires accurate timing and a steady rim and cup over the last 0.18 s.
  const mh = (r.mh || []).filter(m => st.t - m[0] <= 0.18), avg = (mh.reduce((a, m) => a + m[1], 0) + margin) / (mh.length + 1);
  r.avg = avg;
  const far = margin > winSpan(); // too low: your rim is under his bowl, the cups don't meet
  st.shake = Math.max(st.shake, 6); bigText = null;
  const PERF = perfBand(), level = Math.abs(player.tilt + player.w);
  const ok = margin >= 0 && !far && !offBeat;
  const stable = level < spillLim() * 0.9 && Math.abs(player.cupRate || 0) <= CFG.perfectRate &&
    mh.length >= 5 && mh.every(m => m[2] < spillLim() * 0.9 && m[3] <= CFG.perfectRate);
  const perfect = ok && margin < PERF && avg >= 0 && avg < PERF &&
    Math.abs(r.timing) <= Math.min(CFG.perfectTime, timingWindow()) && (r.tut || stable);
  st.freeze = perfect ? 0.13 : 0.065;
  juiceClink(ok ? (perfect ? 'perfect' : 'ok') : 'bad', r.tut);
  const tc = toastChar();
  let jbx = tc.P ? tc.P.rim.x : boss.P.rim.x;
  if (st.alien && st.alien.on && tc === boss) jbx = alienRimX(st.alien.cup);
  st.judge = { word: offBeat ? r.timing > 0 ? '敬早了！扑空！' : '敬晚了！' : far ? '敬到地府了!' : !ok ? '胆儿肥了!' : perfect ? '完美拿捏!' : r.manual ? '碰上了！' : '礼数到位!', col: far ? '#ff9a3d' : !ok ? '#ff4d4d' : perfect ? '#ffd34d' : '#ffffff', t: 0,
    px: player.P.rim.x, py: player.P.rim.y, bx: jbx, by };
  if (r.tut) { r.result = ok ? 'ok' : 'strike'; r.phase = 'react'; r.t = 0; judgeSay(ok ? pick([['真乖！'], ['对喽！'], ['这才像样']]) : offBeat ? ['看红色 0s 那一拍按空格！'] : far ? ['太低啦，妈够不着！'] : ['杯子比妈还高？']);
    for (let i = 0; i < 14; i++) parts.push({ x: (player.P.rim.x + boss.P.rim.x) / 2 + R(-12, 12), y: (player.P.rim.y + boss.P.rim.y) / 2, vx: R(-220, 220), vy: R(-460, -120), life: 2, r: R(4, 8), col: drinkCol(), type: 'drop' });
    return; }
  const cx = (player.P.rim.x + tc.P.rim.x) / 2, cy = (player.P.rim.y + tc.P.rim.y) / 2;
  if (offBeat) { judgeSay(r.timing > 0 ? ['急什么？我还没伸手呢！'] : ['这杯我举了一个世纪！']); strike(null, null, r.timing > 0 ? 'early' : 'late'); finishToastAttempt(); return; }
  if (far) { judgeSay(['接地气，不是接地府！']); strike(null, null, 'far'); finishToastAttempt(); return; }
  if (!ok) { strike(null); finishToastAttempt(); return; }
  for (let i = 0; i < 18; i++) parts.push({ x: cx + R(-12, 12), y: cy + R(-6, 6), vx: R(-260, 260), vy: R(-520, -120), life: 2, r: R(4, 9), col: rnd() < 0.3 ? '#fffbe8' : '#f2b51d', type: 'drop' });
  if (ok) {
    r.result = 'ok'; st.toasts++;
    const scoring = claimScoreOpportunity('hit');
    st.clinkGrace = st.t + (r.chain ? 0.08 : 0.65);
    if (!scoring) { st.judge.bonus = '补敬成功'; finishToastAttempt(); return; }
    const divisor = r.chain || 1;
    const combo = r.chain ? r.comboStart + 1 : st.combo + 1;
    if (r.chain) { r.scoredHits++; if (perfect) r.chainPerfects++; }
    else { st.combo = combo; st.bestCombo = Math.max(st.bestCombo, st.combo); }
    const close = clamp(1 - margin / 90, 0, 1);
    const quick = r.manual ? CFG.timingScore * clamp(1 - Math.abs(r.timing) / timingWindow(), 0, 1) : 0;
    const quality = perfect ? CFG.perfectScore : close * close * CFG.heightScore;
    const points = (CFG.toastScore + quality + player.wine * CFG.wineScore + quick + CFG.comboScore * Math.min(combo, CFG.comboCap)) * (L + 1) / divisor;
    addScore(points);
    if (perfect) st.perfects++;
    if (!r.chain) { awardHype(perfect ? CFG.hypePerfect : CFG.hypeHit); if (perfect) refillWine(CFG.perfectRefill / 100); }
    st.judge.bonus = `+${Math.round(points)}`;
    const polite = margin > 150 ? ['你这也太客气了…'] : pick(POLITE_LINES);
    if (!r.chain && !st.alien) judgeSay(polite);
  } else strike(null);
  finishToastAttempt();
}
// Snap each new toast to the song's actual playback grid, then drive its
// countdown from that same clock. Hit stops between rounds cannot cause drift.
function syncToastClock() {
  const r = st.round;
  if (!r || r.phase !== 'aim' || r.smash) return;
  const clock = window.ToastMusic.clock();
  if (clock == null) return; // blocked/unavailable audio: keep the silent simulation playable
  if (r.musicAnchor == null) {
    if (r.cue && r.cue.next > 0) return; // never move a beat after its first audible cue
    const beat = 60 / CFG.musicBpm;
    if (st.alien) {
      // Align the full countdown with the song; any partial-beat wait happens
      // between rounds, before the cup clocks appear.
      const absoluteTarget = Math.ceil((clock + CFG.alienCountdown) / beat - 1e-9) * beat;
      r.musicAnchor = absoluteTarget - CFG.alienCountdown;
      r.T = CFG.alienCountdown + reachTime() - 0.5;
      r.t = 0; r.clockWaiting = clock < r.musicAnchor;
      r.cue = { next: 0, target: CFG.alienCountdown, gap: beat };
      return;
    }
    r.musicAnchor = clock - r.t;
    const earliest = Math.max(0.5 + r.T - reachTime(), r.t + 2 * beat);
    const target = Math.ceil((r.musicAnchor + earliest) / beat - 1e-9) * beat - r.musicAnchor;
    r.T = target + reachTime() - 0.5;
    r.cue = { next: 0, target, gap: beat };
  } else { r.t = Math.max(0, clock - r.musicAnchor); r.clockWaiting = clock < r.musicAnchor; }
}
// Use the same clock as the visible 0s and the input judgement.
// No wall-clock timers: pausing or leaving the tab cannot advance the sequence.
function stepToastCue() {
  const r = st.round;
  if (!r || r.phase !== 'aim' || r.smash) return;
  if (!r.cue) {
    const target = Math.max(0, 0.5 + r.T - reachTime());
    r.cue = { next: 0, target, gap: Math.min(60 / CFG.musicBpm, target / 2) };
  }
  const c = r.cue;
  const due = c.target - (2 - c.next) * c.gap;
  if (c.next < 3 && r.t + 1e-9 >= due) {
    sfx(c.next === 2 ? 'countGo' : 'count');
    c.next++;
  }
}
function stepRound(dt) {
  const r = st.round; if (!r || st.state !== 'play') return;
  r.t += dt; syncToastClock(); revealAlienTarget();
  if (r.phase === 'tie') {
    if (r.t > (st.breaks > 0 && !st.tut ? CFG.repeatSmashPause : 1.8)) { r.phase = 'aim'; r.t = 0; r.beep = 4; banner('砸穿地板！', '', 1.1, '#ff9a3d'); st.pressure = Math.max(st.pressure, 0); }
  } else if (r.phase === 'gap') {
    // fixed beat between alien cups — setup only, never judged / never timeout-strike
    const gT = (st.alien && st.alien.gap) || 0.8;
    if (r.t >= gT) {
      r.phase = 'aim'; r.t = 0; r.beep = 4; r.mh = [];
      juiceFlash('#9d7dff', 0.22); buzz(12);
      if (st.alien) st.alien.flash = 0.7;
    }
  } else if (r.phase === 'aim') {
    if (r.event === 'feint' && !r.eventDone && r.t > 0.65) {
      r.eventDone = true;
      const old = r.target; r.target = Math.min(floorLimit() - 8, r.target + 38 + 2 * Math.min(st.L, 9));
      r.move = r.target - old; st.bossJ = 0; say(boss, ['哎呀随意～（偷偷再降）'], 1.1);
    }
    if (!r.smash && r.attacking && player.reach >= 1) {
      r.early = clamp(roundLeft() / r.T, 0, 1); st.manualToasts++;
      judgeClink(); return;
    }
    const left = roundLeft();
    stepToastCue();
    const n = Math.ceil(left); if (r.smash && left <= r.T && n < r.beep && n >= 1) { r.beep = n; sfx('tick'); }
    if (left <= (r.smash ? 0 : -timingWindow())) {
      if (r.smash) { strike('还不够低！', null, 'smash'); r.phase = 'react'; r.t = 0; }
      else { strike(r.chain ? null : '领导等不及了！', null, 'late'); finishToastAttempt(); }
    }
  }
  if ((r.phase === 'aim' || r.phase === 'clink') && !r.smash && player.P && boss.P) {
    r.mh = r.mh || []; r.mh.push([st.t, player.P.rim.y - toastRimY(), Math.abs(player.tilt + player.w), Math.abs(player.cupRate || 0)]);
    while (r.mh.length && st.t - r.mh[0][0] > 0.3) r.mh.shift();
  }
  if (r.phase === 'clink') {
    const tc = toastChar();
    let tx = tc.P ? tc.P.rim.x : boss.P.rim.x;
    if (st.alien && st.alien.on && tc === boss) tx = alienRimX(st.alien.cup);
    if (r.tut && (Math.abs(tx - (player.P.rim.x + 24 * SC)) < 14 || r.t > 0.25)) judgeClink();
  } else if (r.phase === 'react') {
    // keep the 1→2→3 beat tight: short juice then gap/aim for next cup
    if (r.t > (roundSucceeded(r) ? CFG.successPause : CFG.missPause) && st.state === 'play') newRound(false);
  }
}

// ---------------------------------------------------------------- tutorial level: 妈妈教你酒桌规矩
// Mom plays the boss at home with a cup of juice. One mechanic per step; each step waits for the
// player to actually do it. Nothing can fail here: spills get topped up, wobbles are caught.
const TUT_KEY = 'toastLower.tutDone';
let tutDone = false; try { tutDone = localStorage.getItem(TUT_KEY) === '1'; } catch (e) { /* no storage */ }
const MOM_SPEC = { kind: 'guest', mom: true, shirt: '#e2577a', pants: '#5a4a6a', skin: '#f3c7a0', hair: '#3a2418', apron: '#fff3d6', scale: SC * 0.98, drink: '#ff9a2e' };
function wantTutorial() { return params.get('tut') === '1'; }
function tutLevel(dy) { return st.stand + dy * SC / 1.45; } // a target height relative to standing
function tutHold(dy) { st.round = { phase: 'hold', t: 0, T: 99, target: tutLevel(dy), smash: false, n: 0, tut: true }; }
function tutMsg(zh, keysArr) { st.tut.msg = mobileWords(zh); st.tut.keys = keysArr || []; }
function tutNext() { st.tut.step++; st.tut.t = 0; st.tut.sub = 0; st.tut.acc = 0; st.tut.fails = 0; st.tut.enter = true; }
function tutClink() { st.round.phase = 'clink'; st.round.t = 0; }
function startTutorial() {
  st.tut = null; restart();
  st.tut = { step: 0, t: 0, sub: 0, acc: 0, fails: 0, enter: true, msg: '', keys: [], fade: 0, usedQ: false };
  st.L = 0; reset(); tutHold(20); bigText = null;
}
function endTutorial() {
  tutDone = true; try { localStorage.setItem(TUT_KEY, '1'); } catch (e) { /* ignore */ }
  st.tut = null; restart();
}
function tutHoldStep(dy, line, msg, keysArr, again) { // shared: get your rim under Mom's line, she clinks
  return {
    enter() { tutHold(dy); say(boss, line, 3.4); tutMsg(msg, keysArr); },
    step(T, dt) {
      const tu = st.tut, r = st.round;
      if (r.phase === 'hold') { tu.acc = player.P.rim.y > r.target + 4 ? tu.acc + dt : Math.max(0, tu.acc - dt); if (T > 2.6 && tu.acc > 0.45) { tutMsg(''); tutClink(); } }
      else if (r.phase === 'react' && r.t > 1.3) { if (r.result === 'ok') tutNext(); else { tutHold(dy); say(boss, again, 1.8); tutMsg(msg, keysArr); tu.acc = 0; } }
    } };
}
const TUT_STEPS = [
  { // 0: hello
    enter() { tutHold(10); say(boss, ['儿子，过来，妈教你酒桌规矩'], 3.2); tutMsg(''); },
    step(T) { if (T > 3.4) tutNext(); } },
  // 1: O goes down
  tutHoldStep(52, ['碰杯时，杯口要比长辈低！'], '按住 O 弯下去，杯口低过线', ['O'], ['高了高了，再来']),
  { // 2: P comes back up
    enter() { tutHold(-40); say(boss, ['好！P 是起身'], 2.4); tutMsg('按住 P 站直', ['P']); },
    step(T, dt) { const tu = st.tut; tu.acc = player.h < 0.04 ? tu.acc + dt : 0; if (T > 1.5 && tu.acc > 0.5) tutNext(); } },
  { // 3: the cup drifts by itself; Q tips it back, W forward
    enter() { tutHold(-40); st.tut.drift = true; say(boss, ['看你的杯子，它自己会慢慢歪'], 3); tutMsg(''); },
    step(T, dt) {
      const tu = st.tut, p = player;
      if (tu.sub === 0) { if (Math.abs(p.tilt) > 0.2 || T > 5) { tu.sub = 1; tu.t = 0; tu.used = false; say(boss, ['Q 往后仰，W 往前倾，扶平它'], 3); tutMsg('点按 Q / W，把杯子扶平', ['Q', 'W']); } }
      else if (tu.sub === 1) { if (keys.Q || keys.W) tu.used = true; tu.acc = tu.used && Math.abs(p.tilt) < 0.08 ? tu.acc + dt : 0;
        if (tu.acc > 1.0 || tu.t > 14) { tu.sub = 2; tu.t = 0; tu.n = 0; say(boss, ['还有，酒会晃！看好了…'], 2.6); tutMsg(''); } }
      else if (tu.sub === 2) { if (tu.t > 2.4) { tu.sub = 3; tu.t = 0; tu.acc = 0; p.wv = (tu.n % 2 ? -1 : 1) * 1.9;
          say(boss, ['酒会晃，反着扶！'], 2.6); tutMsg('酒往前涌按 Q，往后涌按 W', ['Q', 'W']); } }
      else if (tu.sub === 3) { tu.acc = tu.t > 0.6 && Math.abs(p.w) < 0.08 && Math.abs(p.wv) < 0.6 && Math.abs(p.tilt) < 0.12 ? tu.acc + dt : 0;
        if (tu.acc > 0.6 || tu.t > 12) { tu.n++; tu.t = 0; tutMsg('');
          if (tu.n < 2) { tu.sub = 2; tu.t = 1.0; say(boss, ['好，再来一下'], 1.6); } else { tu.sub = 4; say(boss, ['对喽，手要一直扶着'], 2.8); } } }
      else if (tu.t > 2.8) { tu.drift = false; tutNext(); }
    } },
  // 4: moving fast sloshes the drink
  tutHoldStep(175, ['再低点。动太快，酒会晃出来！'], '慢慢按 O 往下，边走边扶杯', ['O', 'Q', 'W'], ['再低一点点']),
  { // 5: practise the same leader beat as the real game, without losing lives.
    enter() { st.round = { phase: 'aim', t: 0, T: 4.5, target: tutLevel(115), smash: false, n: 1, tut: true }; st.tut.sway = true;
      say(boss, ['看准红色 0s，按空格一起碰！'], 3.5); tutMsg('红色 0s 按空格 · Q/W 继续扶杯', ['Q', 'W', 'O', 'P']); },
    step(T, dt) {
      const tu = st.tut, r = st.round;
      if (r.phase === 'aim' && r.attacking && player.reach >= 1) { judgeClink(); }
      else if (r.phase === 'aim' && roundLeft() < -timingWindow()) { r.result = 'strike'; r.phase = 'react'; r.t = 0; say(boss, ['这拍错过了，再来一次'], 1.6); }
      else if (r.phase === 'react' && r.t > 1.4) {
        if (r.result === 'ok') { player.reach = 0; player.reachV = 0; tutNext(); }
        else { st.round = { phase: 'aim', t: 0, T: 4.5, target: tutLevel(115), smash: false, n: 1, tut: true };
          say(boss, ['没事，再来！看妈的手，跟着碰'], 2.4); }
      }
    } },
  { // 6: below the floor -> smash with O (but not at home!)
    enter() { st.tut.sway = false; st.round = { phase: 'aim', t: 0, T: 999, target: floorY(0) + poseTable(boss.spec)[100].low, smash: true, n: 1, tut: true, beep: 0 }; say(boss, ['以后领导会比地板还低…'], 3.2); tutMsg(''); },
    step(T) {
      const tu = st.tut;
      if (tu.sub === 0 && T > 3.4) { tu.sub = 1; say(boss, ['那就按住 O 趴到底，继续按住，砸穿地板！'], 3.6); tutMsg('按住 O：趴下，再继续砸', ['O']); }
      else if (tu.sub === 1 && st.pressure > 0.55) { tu.sub = 2; tu.t = 0; st.round.smash = false; st.round.target = tutLevel(10); st.pressure = 0; tutMsg(''); say(boss, ['停停停！家里的地板不许砸！'], 2.4); }
      else if (tu.sub === 2 && tu.t > 2.6) { tu.sub = 3; tu.t = 0; say(boss, ['好了，去上班吧！'], 2.2); }
      else if (tu.sub === 3 && tu.t > 2.2) { tu.sub = 4; tu.t = 0; tu.fade = 0.001; }
      else if (tu.sub === 4 && tu.t > 1.0) endTutorial();
    } },
];
function stepTutorial(dt) {
  const tu = st.tut; if (!tu) return;
  tu.t += dt; if (tu.fade) tu.fade += dt;
  const S = TUT_STEPS[tu.step];
  if (tu.enter) { tu.enter = false; tu.t = 0; S.enter(); }
  const r = st.round;
  if (r) { r.t += dt; if (tu.step === 5) { syncToastClock(); stepToastCue(); } if (r.phase === 'clink' && (Math.abs(boss.P.rim.x - (player.P.rim.x + 24 * SC)) < 14 || r.t > 0.45)) judgeClink(); }
  if (st.tut === tu) S.step(tu.t, dt);
  // forgiving: keep a little juice in the cup
  if (player.wine < 0.25) { player.wine = 0.7; say(boss, ['妈给你满上'], 1.4); }
}

function drinkCol(c) { return (c && c.spec.drink) || (st.tut ? '#ff9a2e' : '#f2b51d'); }
function stepNPCs(dt) {
  const fl = playFloor(), d = diff();
  const pc = player.P.cupB;
  const r = st.round;
  if (st.alien && r) { stepAlienLeaders(dt); return; }
  const swayOn = r && !r.chain && !st.alien && !r.smash && !st.tut && (r.phase === 'aim' || r.phase === 'react');
  st.bossJT -= dt; if (st.bossJT <= 0) { st.bossJT = physicsRange(2.2, 4.2); st.bossJ = (physicsRandom() < 0.5 ? -1 : 1) * physicsRange(0.5, 1) * 20 * d.wob * SC / 1.45; }
  // ground shake rides on bossOff so relative height becomes a tracking skill (boss kinematic, rumble telegraphed)
  const rumble = swayOn ? groundOff() : 0;
  const swayGoal = swayOn ? (9 * d.wob * SC / 1.45) * Math.min(1, 0.35 + 0.65 * instab()) * (0.6 * Math.sin(st.t * 0.9) + 0.4 * Math.sin(st.t * 0.37 + 1)) + st.bossJ + rumble : rumble;
  if (r && (r.chain || st.alien)) { st.bossJ = 0; st.bossOff = 0; }
  const bo0 = st.bossOff;
  if (!(r && r.phase === 'clink')) st.bossOff += (swayGoal - st.bossOff) * Math.min(1, 1.8 * dt);
  st.bossOffV = (st.bossOff - bo0) / dt;
  const bossAimY = r && !r.smash ? r.target + st.bossOff : null;
  const sNeed = !r ? 0 : r.smash ? 1 : sForRim(boss.spec, Math.min(bossAimY, floorLimit()) - floorY(st.L));
  if (sNeed > boss.s) boss.s = Math.min(sNeed, boss.s + 2.6 * dt); else boss.s = Math.max(sNeed, boss.s - 1.6 * dt);
  if (r && r.chain && !r.smash) boss.s = sNeed;
  poseFromS(boss, boss.s); if (!(r && r.chain)) boss.arm += Math.sin(st.t * 3 + boss.sway) * 0.03;
  const e = tableAt(boss.spec, boss.s);
  const pr = player.P.rim;
  const touchX = Math.max(pc.x, pr.x) + 24 * SC - e.cupDX;
  const q = player.P, qs = q.sc;
  const pFront = Math.max(q.head.x + q.hr, q.knee.x + 14 * qs, q.shoulder.x + 22 * qs, q.hip.x + 22 * qs, q.toe.x);
  const minX = pFront + 12 + 60 * boss.s - e.frontDX;
  const clinking = r && r.phase === 'clink', approach = r && r.phase === 'aim' && !r.smash ? clamp(1 - roundLeft() / (reachTime() + timingWindow() * 0.88), 0, 1) : 0, away = r && r.phase === 'aim' ? 110 + 40 * Math.sin(st.t * 2) * 0.2 : 140;
  const wantX = clinking ? Math.max(touchX, minX) : Math.max(touchX + away * (1 - approach), minX + 40 * (1 - approach));
  boss.x += (clamp(wantX, player.x + 90, 2000) - boss.x) * Math.min(1, (clinking ? 16 : 6) * dt);
  settle(boss, fl);
  if (r && r.chain && !r.smash) { const dy = r.target - boss.P.rim.y; boss.y += dy; boss.P = fk(boss); }
  updateCup(boss, dt, true);
  let prev = boss, prevS = boss.s;
  followers.forEach((f, i) => {
    const s = Math.min(1, boss.s + 0.16 * (i + 1));
    f.s += (s - f.s) * Math.min(1, 6 * dt);
    poseFromS(f, f.s); f.arm += Math.sin(st.t * 3.3 + f.sway) * 0.06;
    const gap = 125 + 55 * Math.max(prevS, f.s);
    f.x += (prev.x + gap - f.x) * Math.min(1, 5 * dt);
    settle(f, fl); updateCup(f, dt, true);
    prev = f; prevS = f.s;
  });
  for (const c of pending) { c.s = 0.05 + 0.04 * Math.sin(st.t * 2 + c.sway); poseFromS(c, c.s); settle(c, floorY(st.L + 1)); updateCup(c, dt, true); }
}

function stepFall(dt) {
  const t = st.t, nf = floorY(st.L + 1);
  for (const c of allChars()) {
    if (!c.landed) {
      c.vy += G * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.phi += c.vrot * dt;
      c.k = 0.5 + 0.5 * Math.sin(t * 11 + c.seedA); c.b = 0.7 * Math.sin(t * 8 + c.seedA * 2);
      c.arm = -1.2 + 1.6 * Math.sin(t * 13 + c.seedA);
      c.P = fk(c);
      if (rnd() < 0.5) spill(c, 1, 0.3);
      const low = lowest(c, c.P);
      if (c.y > nf - 600 && low > nf) {
        c.y -= low - nf;
        if (c.vy > 500 && c.bounced < 1) { c.vy = -c.vy * 0.22; c.vrot *= 0.4; c.bounced++; dust(c.P.hip.x, nf, 12); if (c === player) { st.shake = 22; sfx('thud'); buzz(40); } }
        else { c.vy = 0; c.landed = true; c.vrot = 0; }
      }
    } else { c.P = fk(c); }
    updateCup(c, dt, true);
  }
  for (const c of pending) { c.P = fk(c); updateCup(c, dt, true); }
  if (st.stT > 0.6 && player.landed && boss.landed || st.stT > 2.2) beginStandup();
}

let su = null;
function beginStandup() {
  st.L++; changeWine('capacity', Math.max(0, player.wine - wineCapacity())); st.state = 'standup'; st.stT = 0;
  const joiners = pending; pending = [];
  for (const j of joiners) j.face = -1;
  followers.unshift(...joiners);
  // swap boss body before formation so standup tween targets the right sprite
  const ld0 = layerDef(st.L);
  const wantAlien = activeMech(st.L) === 'alien' || (activeMech(st.L) === 'mix' && ld0.mech === 'alien');
  const wantTomb = activeMech(st.L) === 'chain';
  const wantedSpec = wantAlien ? ALIEN_HOST : wantTomb ? TOMB_BOSS : B_SPEC;
  if (boss.spec !== wantedSpec) {
    const bx = boss.x, bs = boss.s, bw = boss.wine;
    boss = mkChar(wantedSpec, -1);
    boss.x = bx; boss.s = bs; boss.wine = bw; poseFromS(boss, boss.s);
  }
  prepareAlienLeaders();
  const from = allChars().map(c => ({ c, k: c.k, b: c.b, phi: ((c.phi % (2 * PI)) + 3 * PI) % (2 * PI) - PI, arm: c.arm, x: c.x, y: c.y }));
  const saved = from.map(f => ({ ...f }));
  formation(st.L);
  const to = allChars().map(c => ({ k: c.k, b: c.b, phi: c.phi, arm: c.arm, x: c.x, y: c.y }));
  saved.forEach(f => Object.assign(f.c, { k: f.k, b: f.b, phi: f.phi, arm: f.arm, x: f.x, y: f.y }));
  su = { from: saved, to };
  for (const c of allChars()) { c.mode = 'play'; if (c !== player) c.wine = 1; }
  refillWine(CFG[difficulty().id + 'FloorRefill'] / 100);
  const ld = layerDef(st.L); st.depth = ld.depth;
  if (ld.endless === 1) banner('进入无尽模式！', '', 1.9, '#ff9a3d');
  else banner(layerLabel(st.L), '', 1.7);
  bigText.arrival = true;
  joiners.forEach((j, i) => say(j, JOIN_LINES[(i + st.L) % JOIN_LINES.length], 2));
}
function stepStandup(dt) {
  const tt = clamp(st.stT / (st.breaks > 1 ? CFG.repeatStandup : 0.7), 0, 1), e = ease(tt);
  su.from.forEach((f, i) => {
    const c = f.c, to = su.to[i];
    c.k = lerp(f.k, to.k, e); c.b = lerp(f.b, to.b, e); c.phi = lerp(f.phi, to.phi, e); c.arm = lerp(f.arm, to.arm, e);
    c.x = lerp(f.x, to.x, e); c.y = lerp(f.y, to.y, e) - Math.sin(tt * PI) * 30;
    c.P = fk(c); updateCup(c, dt, true);
  });
  if (tt >= 1) {
    st.state = 'play'; st.playT = 0; st.layerT = 0; st.bossSay = 1.2;
    formation(st.L); spawnPending(st.L); newRound(true);
    say(player, PLAYER_LINES[(st.L) % PLAYER_LINES.length], 2.4);
  }
}
function stepParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i]; q.life -= dt; q.vy += G * (q.type === 'dust' ? 0.25 : 0.7) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.type === 'drop') {
      for (let L = Math.max(0, st.L - 1); L <= st.L + 2; L++) {
        const fl = floorY(L), h = st.holes[L];
        if (q.y > fl && q.y - q.vy * dt <= fl && !(h && q.x > h.x1 && q.x < h.x2)) {
          if (puddles.length < 300) puddles.push({ x: q.x, y: fl, r: R(8, 20), a: 0.7 });
          q.life = 0; break;
        }
      }
    }
    if (q.life <= 0) parts.splice(i, 1);
  }
  if (parts.length > 900) parts.splice(0, parts.length - 900);
  for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; if (d.y > cam.y + 2500) debris.splice(i, 1); }
  for (let i = popups.length - 1; i >= 0; i--) { popups[i].t += dt; if (popups[i].t > 1.6) popups.splice(i, 1); }
}

function step(dt0) {
  if (st.paused) return;
  if (st.punch) { st.punch.t += dt0; if (st.punch.t > 1.2) st.punch = null; }
  if (st.judge) { st.judge.t += dt0; if (st.judge.t > 1.7) st.judge = null; }
  if (st.gain) st.gain.t += dt0;
  stepFx(dt0); // feedback keeps moving through the freeze-frame
  if (st.freeze > 0) { st.freeze = Math.max(0, st.freeze - dt0); return; }
  const dt = (st.state === 'play' && st.round && st.round.phase === 'clink' && !st.round.manual) ? dt0 * 0.7 : dt0;
  st.t += dt; st.stT += dt;
  if (st.state === 'title') { stepNPCs(dt); player.P = fk(player); }
  if (st.state === 'play') {
    st.playT += dt; st.layerT += dt; st.gameT += dt;
    if (BOT) runBot(dt);
    if (!st.tut) { const q = st.qw || (st.qw = { n: 0, sw: 0, held: 0, t: 0, Q: 0, W: 0 }); q.t += dt; if (keys.Q || keys.W) q.held += dt;
      for (const k of ['Q', 'W']) { if (keys[k] && !q[k]) { q.n++; if (q.last && q.last !== k) q.sw++; q.last = k; } q[k] = keys[k]; }
      if (st.state === 'play' && !noSpill()) { const m = player.tilt + (player.w || 0); q.m2 = (q.m2 || 0) + m * m * dt; q.mt = (q.mt || 0) + dt; } }
    const d = diff();
    stepPlayer(dt);
    if (st.state === 'play') { stepAlienRhythm(dt); stepNPCs(dt); if (st.tut) stepTutorial(dt); else stepRound(dt); }
  }
  else if (st.state === 'fall') stepFall(dt);
  else if (st.state === 'standup') stepStandup(dt);
  else if (st.state === 'over') stepOver(dt);
  stepChapterChatter();
  stepVis(dt);
  stepParticles(dt);
  for (let i = bubbles.length - 1; i >= 0; i--) { bubbles[i].t += dt; if (bubbles[i].t > bubbles[i].dur) bubbles.splice(i, 1); }
  if (bigText) { bigText.t += dt; if (bigText.t > bigText.dur) bigText = null; }
  st.shake *= Math.exp(-5 * dt);
  // depth meter
  const L = st.L, d0 = layerDef(L).depth;
  if (st.state === 'fall') {
    const fr = clamp((player.y - floorY(L) + 150) / LH, 0, 1), d1 = layerDef(L + 1).depth;
    st.depth = Math.exp(lerp(Math.log(d0 + 1), Math.log(d1 + 1), fr)) - 1;
  } else if (st.state !== 'over') st.depth = d0;
  st.best = Math.max(st.best, st.depth);
  // camera
  let tx, ty, tz;
  if (st.state === 'fall') { tx = player.x + 150; ty = player.y - 60; tz = 0.85; }
  else {
    const framed = st.alien ? [player, ...st.alien.leaders] : [player, boss];
    let x1 = 1e9, x2 = -1e9; for (const c of framed) { if (!c.P) continue; for (const q of [c.P.head, c.P.toe, c.P.hip]) { x1 = Math.min(x1, q.x - 130); x2 = Math.max(x2, q.x + 130); } }
    if (followers.length && !st.alien && !(TOUCH && LAY === 'land')) x2 += 200;
    tz = LAY === 'port' ? clamp(1250 / (x2 - x1), 1, 1.3) : clamp(1040 / (x2 - x1), st.alien ? 0.6 : 0.8, 1); tx = (x1 + x2) / 2; if (LAY !== 'land') tx = Math.max(tx, W / 2 / tz - 40 / tz);
    if (TOUCH && LAY === 'land') {
      const top = Math.min(...framed.filter(c => c.P).map(c => c.P.head.y - c.P.hr));
      tz = Math.min(1.75, (H - 230) / Math.max(1, floorY(st.L) - top), (W - 500) / Math.max(1, x2 - x1));
    }
    ty = floorY(st.L) - (floorSY() - H / 2) / tz;
  }
  const k = Math.min(1, (st.state === 'fall' ? 9 : 4) * dt);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k;
}

// ---------------------------------------------------------------- drawing helpers
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function line(a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
function poly(pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
function circ(x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * PI); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 4; ctx.stroke(); } }
function text(s, x, y, size, col, align, weight, stroke) {
  s = mobileWords(s); // Apply to every canvas message, including judgment feedback.
  ctx.font = `${weight || 800} ${size}px ${FONT}`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = size * 0.22; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; r = clamp(Math.round(r * f), 0, 255); g = clamp(Math.round(g * f), 0, 255); b = clamp(Math.round(b * f), 0, 255); return `rgb(${r},${g},${b})`; }

// ---------------------------------------------------------------- layer art
function table(cx, fl, cloth, top) {
  ctx.save();
  // Heavy chairs and a soft contact shadow make the banquet feel like a small stage.
  ctx.fillStyle = 'rgba(30,10,8,0.24)'; ctx.beginPath(); ctx.ellipse(cx, fl - 35, 376, 24, 0, 0, 2 * PI); ctx.fill();
  for (const dx of [-330, -190, 190, 330]) {
    ctx.fillStyle = '#5a2a12'; ctx.strokeStyle = '#3b2016'; ctx.lineWidth = 4;
    rr(cx + dx - 34, fl - 300, 68, 240, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#77432a'; rr(cx + dx - 25, fl - 289, 50, 66, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(248,193,113,0.25)'; ctx.lineWidth = 3; line({ x: cx + dx - 16, y: fl - 280 }, { x: cx + dx + 16, y: fl - 280 });
  }
  ctx.fillStyle = shade(cloth, 0.8); rr(cx - 380, fl - 210, 760, 160, 20); ctx.fill();
  // Long, broad cloth folds keep visual detail below the hands and faces.
  ctx.strokeStyle = 'rgba(75,48,33,0.16)'; ctx.lineWidth = 5;
  for (let dx = -330; dx <= 330; dx += 110) {
    ctx.beginPath(); ctx.moveTo(cx + dx * 0.98, fl - 203); ctx.quadraticCurveTo(cx + dx + 13, fl - 122, cx + dx + 4, fl - 62); ctx.stroke();
  }
  ctx.fillStyle = shade(cloth, 0.66); ctx.fillRect(cx - 359, fl - 70, 718, 7);
  ctx.strokeStyle = 'rgba(255,255,241,0.5)'; ctx.lineWidth = 3; line({ x: cx - 360, y: fl - 74 }, { x: cx + 360, y: fl - 74 });
  ctx.fillStyle = cloth; ctx.strokeStyle = shade(cloth, 0.67); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, fl - 210, 400, 56, 0, 0, 2 * PI); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,245,0.58)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, fl - 212, 385, 47, 0, 0.08, PI - 0.08); ctx.stroke();
  ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(cx, fl - 222, 220, 30, 0, 0, 2 * PI); ctx.fill();
  ctx.strokeStyle = 'rgba(117,85,43,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  const dishes = [['#e2572b', -150], ['#4a9b3d', -60], ['#f2c14e', 40], ['#b23a2a', 130], ['#ffffff', 200]];
  for (const [c, dx] of dishes) {
    ctx.fillStyle = 'rgba(67,40,17,0.18)'; ctx.beginPath(); ctx.ellipse(cx + dx + 3, fl - 224, 36, 12, 0, 0, 2 * PI); ctx.fill();
    ctx.fillStyle = '#fff9ea'; ctx.strokeStyle = '#b9a98d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx + dx, fl - 229, 34, 12, 0, 0, 2 * PI); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#bb7661'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx + dx, fl - 230, 28, 8, 0, 0, 2 * PI); ctx.stroke();
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx + dx, fl - 233, 22, 7, 0, 0, 2 * PI); ctx.fill();
    for (let k = 0; k < 3; k++) circ(cx + dx - 11 + k * 10, fl - 234 + (k % 2) * 3, 2.2, '#f7dda0');
  }
  // A pair of abandoned chopsticks and a folded napkin add life without new clutter.
  ctx.strokeStyle = '#794426'; ctx.lineWidth = 3;
  for (let k = 0; k < 2; k++) line({ x: cx - 266 + k * 6, y: fl - 224 }, { x: cx - 229 + k * 6, y: fl - 199 });
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.moveTo(cx + 275, fl - 218); ctx.lineTo(cx + 323, fl - 206); ctx.lineTo(cx + 285, fl - 197); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d6c9ae'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e8e2d2'; ctx.strokeStyle = '#aa9e82'; ctx.lineWidth = 2; rr(cx + 250, fl - 300, 30, 80, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a83136'; ctx.fillRect(cx + 250, fl - 275, 30, 26); ctx.fillStyle = '#d8ae59'; ctx.fillRect(cx + 255, fl - 304, 20, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(cx + 254, fl - 291, 4, 63);
  ctx.restore();
}
function fuDiamond(x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(PI / 4 + Math.sin(t) * 0.03);
  ctx.fillStyle = '#e8262e'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 6; ctx.strokeRect(-s / 2 + 8, -s / 2 + 8, s - 16, s - 16);
  ctx.rotate(-PI / 4 + PI); // 福倒了 = 福到了
  text('福', 0, 4, s * 0.62, '#1a1a1a', 'center', 900);
  ctx.restore();
}
function lantern(x, y, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.3 + x) * 0.06);
  ctx.strokeStyle = '#3a1a0a'; ctx.lineWidth = 3; line({ x: 0, y: -400 }, { x: 0, y: -40 });
  ctx.fillStyle = '#e3262b'; ctx.beginPath(); ctx.ellipse(0, 0, 46, 40, 0, 0, 2 * PI); ctx.fill();
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(-24, -44, 48, 8); ctx.fillRect(-24, 36, 48, 8);
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) line({ x: -10 + i * 7, y: 44 }, { x: -10 + i * 7, y: 76 });
  ctx.restore();
}
function sign(x, y, zh, en, bg, fg) {
  ctx.font = `700 18px ${FONT}`; const we = ctx.measureText(en).width + 40; ctx.font = `900 40px ${FONT}`; const w = Math.max(ctx.measureText(zh).width + 50, 180, we);
  x = Math.max(x, 270 + w / 2); // keep wall signs clear of the side glass (screen left)
  ctx.fillStyle = bg; rr(x - w / 2, y - 40, w, 92, 12); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 5; ctx.stroke();
  text(zh, x, y - 4, 40, fg, 'center', 900); text(en, x, y + 32, 18, fg, 'center', 700);
}
function car(x, y, col) {
  ctx.fillStyle = col; rr(x, y - 110, 300, 80, 30); ctx.fill(); rr(x + 60, y - 160, 170, 70, 26); ctx.fill();
  ctx.fillStyle = '#9fc6e0'; rr(x + 78, y - 148, 62, 46, 10); ctx.fill(); rr(x + 150, y - 148, 62, 46, 10); ctx.fill();
  circ(x + 70, y - 30, 30, '#151515'); circ(x + 230, y - 30, 30, '#151515'); circ(x + 70, y - 30, 12, '#888'); circ(x + 230, y - 30, 12, '#888');
}
function trex(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = '#f2ead6'; ctx.lineCap = 'round'; ctx.lineWidth = 12;
  // spine
  ctx.beginPath(); ctx.moveTo(-260, 40); ctx.quadraticCurveTo(-120, -60, 40, -50); ctx.quadraticCurveTo(120, -50, 170, -90); ctx.stroke();
  for (let i = 0; i < 9; i++) { const px = -200 + i * 26; const py = -10 - Math.sin(i / 9 * PI) * 40; line({ x: px, y: py }, { x: px + 8, y: py + 70 - i * 3 }); }
  // skull
  ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(150, -110); ctx.lineTo(270, -110); ctx.lineTo(290, -80); ctx.lineTo(160, -60); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(170, -55); ctx.lineTo(280, -60); ctx.stroke();
  circ(185, -95, 10, null, '#f2ead6', 8);
  for (let i = 0; i < 6; i++) line({ x: 190 + i * 15, y: -76 }, { x: 194 + i * 15, y: -64 });
  // legs + arm
  ctx.lineWidth = 14; poly([{ x: -20, y: -30 }, { x: -50, y: 80 }, { x: -10, y: 180 }, { x: 30, y: 185 }]); poly([{ x: 20, y: -30 }, { x: 0, y: 80 }, { x: 40, y: 175 }, { x: 80, y: 180 }]);
  ctx.lineWidth = 8; poly([{ x: 110, y: -60 }, { x: 125, y: -20 }, { x: 140, y: -25 }]);
  ctx.restore();
}
function ammonite(x, y, r) { ctx.strokeStyle = '#e9dcc0'; ctx.lineWidth = 5; ctx.beginPath(); for (let a = 0; a < 6 * PI; a += 0.2) { const rr2 = r * a / (6 * PI); const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
function warrior(x, y, s) {
  ctx.fillStyle = '#8c4c32';
  ctx.beginPath(); ctx.arc(x, y - 150 * s, 20 * s, 0, 2 * PI); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4 * s, y - 172 * s, 9 * s, 0, 2 * PI); ctx.fill();
  rr(x - 26 * s, y - 128 * s, 52 * s, 80 * s, 10 * s); ctx.fill();
  ctx.fillRect(x - 20 * s, y - 50 * s, 15 * s, 50 * s); ctx.fillRect(x + 5 * s, y - 50 * s, 15 * s, 50 * s);
  ctx.fillStyle = '#6f3a24'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 26 * s, y - (118 - i * 22) * s, 52 * s, 5 * s);
}

function drawSubwayElder(x, y, t) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.85;
  // A small wordless station poster keeps the cameo behind the playable cast.
  ctx.fillStyle = '#d2d4bd'; ctx.strokeStyle = '#394b52'; ctx.lineWidth = 5;
  rr(-83, -66, 184, 189, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#587078'; rr(-68, 48, 156, 20, 6); ctx.fill();
  ctx.strokeStyle = '#28343b'; ctx.lineWidth = 9;
  line({ x: -48, y: 66 }, { x: -48, y: 112 }); line({ x: 68, y: 66 }, { x: 68, y: 112 });
  // Seated, recoiling from the glass held at arm's length.
  seg({ x: -8, y: 48 }, { x: 23, y: 72 }, 16, '#424d58');
  seg({ x: 23, y: 72 }, { x: 12, y: 110 }, 14, '#424d58');
  seg({ x: -20, y: 0 }, { x: -8, y: 46 }, 33, '#898d7d');
  seg({ x: -13, y: 4 }, { x: 27, y: 18 }, 10, '#a3a48e');
  seg({ x: 27, y: 18 }, { x: 68, y: -6 }, 9, '#e4ba92');
  circ(-32, -30, 25, '#e4ba92', '#24272b', 4);
  ctx.strokeStyle = '#dedbd0'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(-34, -34, 23, PI * 0.9, PI * 1.85); ctx.stroke();
  ctx.strokeStyle = '#24272b'; ctx.lineWidth = 3;
  line({ x: -34, y: -36 }, { x: -23, y: -32 }); line({ x: -16, y: -33 }, { x: -6, y: -38 });
  circ(-25, -27, 2, '#24272b'); circ(-10, -28, 2, '#24272b');
  line({ x: -25, y: -13 }, { x: -10, y: -17 });
  ctx.translate(69, -7); ctx.rotate(Math.sin(t * 2) * 0.04);
  ctx.fillStyle = 'rgba(225,240,255,0.8)'; ctx.strokeStyle = '#24272b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-15, -34); ctx.lineTo(15, -34); ctx.lineTo(10, -7); ctx.lineTo(-10, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d99436'; ctx.fillRect(-8, -22, 16, 12);
  line({ x: 0, y: -6 }, { x: 0, y: 5 }); line({ x: -10, y: 5 }, { x: 10, y: 5 });
  ctx.restore();
}
const LAYER_ART = [
  { floorTop: '#9a6232', slab: '#4c3a2c', draw(top, fl, l, r, t) {
      const g = ctx.createLinearGradient(0, top, 0, fl); g.addColorStop(0, '#7a1019'); g.addColorStop(1, '#a8202a'); ctx.fillStyle = g; ctx.fillRect(l, top, r - l, fl - top);
      ctx.fillStyle = 'rgba(255,205,80,0.07)'; for (let x = Math.floor(l / 90) * 90; x < r; x += 90) for (let y = top + 40; y < fl - 120; y += 90) { ctx.save(); ctx.translate(x + ((y / 90) % 2) * 45, y); ctx.rotate(PI / 4); ctx.fillRect(-14, -14, 28, 28); ctx.restore(); }
      ctx.fillStyle = '#5c0c12'; ctx.fillRect(l, fl - 110, r - l, 110); ctx.fillStyle = '#d9a82e'; ctx.fillRect(l, fl - 116, r - l, 8);
      fuDiamond(130, top + 340, 150, t); lantern(400, top + 330, t); lantern(980, top + 330, t + 1); lantern(-200, top + 330, t + 2); lantern(1500, top + 330, t + 3);
      sign(700, top + 300, '牡丹厅', 'PEONY ROOM · 18F', '#ffd34d', '#7a1019');
      table(720, fl, '#f5f1e6', '#d6cdb8');
    } },
  { floorTop: '#7b1d2c', slab: '#3d3a3a', draw(top, fl, l, r, t) {
      ctx.fillStyle = '#17594b'; ctx.fillRect(l, top, r - l, fl - top);
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = Math.floor(l / 60) * 60; x < r; x += 60) ctx.fillRect(x, top, 26, fl - top);
      ctx.fillStyle = '#0f3b32'; ctx.fillRect(l, fl - 100, r - l, 100);
      // karaoke tv
      ctx.fillStyle = '#111'; rr(80, top + 260, 330, 200, 14); ctx.fill(); const hue = (t * 60) % 360;
      ctx.fillStyle = `hsl(${hue},80%,55%)`; rr(96, top + 276, 298, 168, 8); ctx.fill(); text('♪ 干杯朋友 ♪', 245, top + 360, 36, '#fff', 'center', 900, 'rgba(0,0,0,0.4)');
      sign(760, top + 300, '芙蓉厅', 'HIBISCUS ROOM · 17F', '#f2e3c2', '#17594b');
      table(780, fl, '#f2c14e', '#c49a2c');
    } },
  { floorTop: '#5a5d63', slab: '#3b3d42', draw(top, fl, l, r, t) {
      ctx.fillStyle = '#80848c'; ctx.fillRect(l, top, r - l, fl - top);
      ctx.fillStyle = '#6a6e76'; ctx.fillRect(l, top, r - l, 70);
      ctx.strokeStyle = '#4b4f57'; ctx.lineWidth = 16; line({ x: l, y: top + 100 }, { x: r, y: top + 100 }); ctx.strokeStyle = '#b5862e'; ctx.lineWidth = 10; line({ x: l, y: top + 128 }, { x: r, y: top + 128 });
      for (let x = Math.floor(l / 420) * 420 + 120; x < r; x += 420) { ctx.fillStyle = (Math.floor(t * 7 + x) % 23) ? '#f4fbff' : '#8aa'; rr(x, top + 150, 200, 16, 8); ctx.fill(); }
      car(-420, fl, '#c23b2b'); car(560, fl, '#2f5fa8'); car(1180, fl, '#e5e5e5');
      for (const px of [-60, 1000]) { ctx.fillStyle = '#9da1a8'; ctx.fillRect(px, top + 70, 110, fl - top - 70); for (let y = fl - 160; y < fl; y += 40) { ctx.fillStyle = (y / 40) % 2 ? '#f2c400' : '#1a1a1a'; ctx.fillRect(px, y, 110, 40); } text('B3', px + 55, top + 330, 64, '#f2c400', 'center', 900); }
      ctx.fillStyle = '#4caf50'; rr(420, top + 230, 300, 70, 10); ctx.fill(); text('出口 EXIT →', 570, top + 266, 34, '#fff', 'center', 900);
    } },
  { floorTop: '#5b5048', slab: '#2b2622', draw(top, fl, l, r, t) {
      ctx.fillStyle = '#1b1f2b'; ctx.fillRect(l, top, r - l, fl - top);
      ctx.fillStyle = '#262c3c'; ctx.beginPath(); ctx.ellipse(540, fl, 1200, fl - top - 30, 0, PI, 2 * PI); ctx.fill();
      ctx.strokeStyle = '#11131a'; ctx.lineWidth = 6; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(l, top + 200 + i * 18); ctx.bezierCurveTo(200, top + 240 + i * 18, 800, top + 180 + i * 18, r, top + 220 + i * 18); ctx.stroke(); }
      // passing train (background track)
      const tx = ((t * 2600) % 7000) - 3500;
      ctx.fillStyle = '#c9ced8'; rr(tx, fl - 520, 2600, 300, 30); ctx.fill(); ctx.fillStyle = '#d7262f'; ctx.fillRect(tx, fl - 300, 2600, 26);
      for (let x = tx + 40; x < tx + 2560; x += 150) { ctx.fillStyle = '#ffe9a8'; rr(x, fl - 480, 100, 100, 10); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const y = fl - 500 + i * 36; line({ x: tx - 400 + (i * 97) % 300, y }, { x: tx - 60, y }); }
      drawSubwayElder(860, fl - 465, t);
      sign(200, top + 300, '2号线', 'LINE 2', '#1f7a3a', '#fff');
      circ(940, top + 140, 22, '#e3262b'); circ(990, top + 140, 22, (Math.floor(t * 2) % 2) ? '#34e05a' : '#163');
    } },
  { floorTop: '#b08a55', slab: '#7a5a36', draw(top, fl, l, r, t) {
      const g = ctx.createLinearGradient(0, top, 0, fl); g.addColorStop(0, '#a77d46'); g.addColorStop(1, '#d1ab6e'); ctx.fillStyle = g; ctx.fillRect(l, top, r - l, fl - top);
      ctx.strokeStyle = 'rgba(80,50,20,0.25)'; ctx.lineWidth = 3;
      for (let y = top + 30, row = 0; y < fl; y += 50, row++) { line({ x: l, y }, { x: r, y }); for (let x = Math.floor(l / 120) * 120 + (row % 2) * 60; x < r; x += 120) line({ x, y: y - 50 }, { x, y }); }
      ctx.fillStyle = 'rgba(60,30,10,0.35)'; ctx.fillRect(l, fl - 280, r - l, 200);
      for (let row = 0; row < 2; row++) for (let x = Math.floor(l / 110) * 110; x < r; x += 110) warrior(x + row * 55, fl - 90 - row * 70, 0.9 - row * 0.15);
      for (const tx of [60, 1020]) { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(tx - 8, top + 160, 16, 90); const fh = 40 + Math.sin(t * 13 + tx) * 10; ctx.fillStyle = '#ff9a1f'; ctx.beginPath(); ctx.ellipse(tx, top + 150 - fh / 3, 22, fh / 1.4, 0, 0, 2 * PI); ctx.fill(); ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.ellipse(tx, top + 150 - fh / 4, 10, fh / 2.5, 0, 0, 2 * PI); ctx.fill(); }
      sign(540, top + 300, '秦·饭局遗址', 'QIN DYNASTY BANQUET SITE', '#3a2412', '#f4d58d');
    } },
  { floorTop: '#6b4a2e', slab: '#4a3220', draw(top, fl, l, r, t) {
      const bands = ['#6e4b2e', '#86603c', '#5c3d24', '#9a7347', '#704c2c', '#8a6440'];
      const h = (fl - top) / bands.length; bands.forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(l, top + i * h); for (let x = l; x <= r; x += 60) ctx.lineTo(x, top + i * h + Math.sin(x * 0.01 + i) * 14); ctx.lineTo(r, top + (i + 1) * h + 20); ctx.lineTo(l, top + (i + 1) * h + 20); ctx.fill(); });
      trex(560, top + 330, 1.25); ammonite(130, top + 180, 46); ammonite(980, top + 520, 36); ammonite(-120, top + 480, 40);
      sign(150, top + 300, '白垩纪', 'CRETACEOUS · 66M YEARS', '#2a1a10', '#f2ead6');
    } },
  { floorTop: '#1c1210', slab: '#2a0f08', draw(top, fl, l, r, t) {
      const g = ctx.createLinearGradient(0, top, 0, fl); g.addColorStop(0, '#2a0905'); g.addColorStop(1, '#7a1a06'); ctx.fillStyle = g; ctx.fillRect(l, top, r - l, fl - top);
      ctx.strokeStyle = '#ff6a14'; ctx.lineWidth = 6; ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 20;
      for (let i = 0; i < 9; i++) { const x0 = -300 + i * 240; ctx.beginPath(); ctx.moveTo(x0, top); for (let y = top; y < fl - 150; y += 60) ctx.lineTo(x0 + Math.sin(y * 0.03 + i) * 40, y); ctx.stroke(); }
      // lava fall
      ctx.fillStyle = '#ff8c1a'; ctx.fillRect(880, top, 90, fl - top - 60); ctx.fillStyle = '#ffd34d'; ctx.fillRect(905 + Math.sin(t * 6) * 6, top, 24, fl - top - 60);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff6a14'; ctx.beginPath(); ctx.ellipse(925, fl - 40, 190, 40, 0, 0, 2 * PI); ctx.fill();
      for (let i = 0; i < 8; i++) { const bx = 780 + ((i * 53 + t * 40) % 300), by = fl - 40 - ((t * 60 + i * 37) % 60); circ(bx, by, 6 + (i % 3) * 3, '#ffd34d'); }
      sign(300, top + 320, '地幔', 'MANTLE · 1,300°C', '#1a0703', '#ff9a3d');
      ctx.fillStyle = `rgba(255,90,20,${0.08 + 0.04 * Math.sin(t * 3)})`; ctx.fillRect(l, top, r - l, fl - top);
    } },
  { floorTop: '#fff3c4', slab: '#ffb13b', draw(top, fl, l, r, t) {
      const g = ctx.createRadialGradient(540, fl - 300, 50, 540, fl - 300, 1100); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#fff2a8'); g.addColorStop(0.7, '#ffae2e'); g.addColorStop(1, '#d9480f'); ctx.fillStyle = g; ctx.fillRect(l, top, r - l, fl - top);
      ctx.save(); ctx.translate(540, fl - 330); ctx.rotate(t * 0.2); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 10;
      for (let i = 0; i < 12; i++) { ctx.rotate(PI / 6); line({ x: 160, y: 0 }, { x: 900, y: 0 }); }
      ctx.restore();
      sign(540, top + 310, '地心', "EARTH'S CORE · 5,400°C · 6,371 km", '#7a1a06', '#fff3c4');
    } },
];
function barrel(x, y, r) {
  ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * PI); ctx.fill();
  ctx.strokeStyle = '#3a220e'; ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 6; circ(x, y, r * 0.78, null, '#2a2a2a', 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; for (let k = -2; k <= 2; k++) line({ x: x + k * r * 0.3, y: y - r * 0.9 }, { x: x + k * r * 0.3, y: y + r * 0.9 });
  circ(x, y + r * 0.45, 7, '#c9a227');
}
function tube(x, y, w, h, t, label) {
  ctx.fillStyle = 'rgba(120,255,200,0.25)'; rr(x, y, w, h, w / 2); ctx.fill(); ctx.strokeStyle = '#9ff'; ctx.lineWidth = 5; ctx.stroke();
  for (let i = 0; i < 5; i++) circ(x + w * (0.3 + 0.4 * ((i * 37) % 10) / 10), y + h - ((t * 60 + i * 50) % h), 5, 'rgba(220,255,255,0.7)');
  ctx.fillStyle = '#444'; ctx.fillRect(x - 6, y + h - 4, w + 12, 18); ctx.fillRect(x - 6, y - 14, w + 12, 18);
  text(label, x + w / 2, y + h + 30, 18, '#9ff', 'center', 900);
}
function flames(l, r, base, h, t, n) {
  for (let x = Math.floor(l / 70) * 70; x < r; x += 70) {
    const fh = h * (0.6 + 0.4 * Math.sin(t * 7 + x * 0.05 + n));
    ctx.fillStyle = '#ff5a14'; ctx.beginPath(); ctx.moveTo(x - 38, base); ctx.quadraticCurveTo(x - 20, base - fh * 0.6, x, base - fh); ctx.quadraticCurveTo(x + 20, base - fh * 0.6, x + 38, base); ctx.fill();
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(x - 18, base); ctx.quadraticCurveTo(x - 8, base - fh * 0.35, x, base - fh * 0.55); ctx.quadraticCurveTo(x + 8, base - fh * 0.35, x + 18, base); ctx.fill();
  }
}
const ART_CELLAR = { floorTop: '#5a4030', slab: '#3a2a1e', draw(top, fl, l, r, t) {
  ctx.fillStyle = '#2e2119'; ctx.fillRect(l, top, r - l, fl - top);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
  for (let y = top + 20, row = 0; y < fl; y += 46, row++) { line({ x: l, y }, { x: r, y }); for (let x = Math.floor(l / 100) * 100 + (row % 2) * 50; x < r; x += 100) line({ x, y: y - 46 }, { x, y }); }
  for (let ax = Math.floor(l / 520) * 520 - 100; ax < r; ax += 520) { ctx.fillStyle = '#1c140f'; ctx.beginPath(); ctx.moveTo(ax, fl); ctx.lineTo(ax, top + 330); ctx.arc(ax + 200, top + 330, 200, PI, 2 * PI); ctx.lineTo(ax + 400, fl); ctx.fill(); }
  // bottle rack
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) circ(-260 + i * 34, top + 380 + j * 34, 13, j % 2 ? '#3a0d12' : '#5a1a22', '#111', 3);
  for (let i = 0; i < 5; i++) barrel(560 + i * 150, fl - 76, 74); for (let i = 0; i < 4; i++) barrel(635 + i * 150, fl - 214, 74);
  for (const bx of [150, 900]) { ctx.strokeStyle = '#222'; ctx.lineWidth = 3; line({ x: bx, y: top }, { x: bx, y: top + 200 }); circ(bx, top + 215, 18, `rgba(255,${200 + 30 * Math.sin(t * 9 + bx)},120,1)`); ctx.fillStyle = 'rgba(255,200,120,0.08)'; ctx.beginPath(); ctx.moveTo(bx, top + 215); ctx.lineTo(bx - 260, fl); ctx.lineTo(bx + 260, fl); ctx.fill(); }
  sign(300, top + 300, '地下酒窖', 'LAFITE 1982 (PROBABLY FAKE)', '#3a0d12', '#f2d7a0');
} };
const ART_SEWER = { floorTop: '#3d4a3d', slab: '#26302a', draw(top, fl, l, r, t) {
  ctx.fillStyle = '#22322a'; ctx.fillRect(l, top, r - l, fl - top);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = Math.floor(l / 60) * 60; x < r; x += 60) for (let y = top; y < fl; y += 60) if (((x + y) / 60) % 2 === 0) ctx.fillRect(x, y, 58, 58);
  for (const [px, py] of [[120, top + 330], [880, top + 280]]) {
    circ(px, py, 110, '#0b0f0c', '#5a6a5a', 18);
    ctx.fillStyle = '#7a8a3a'; ctx.fillRect(px - 40, py + 60, 80, fl - py - 60);
    for (let k = 0; k < 3; k++) circ(px - 30 + k * 26, py - 10 + Math.sin(t * 3 + k) * 3, 6, k % 2 ? '#ff3030' : '#ff3030');
  }
  ctx.fillStyle = '#4f6b2f'; ctx.fillRect(l, fl - 46, r - l, 46);
  ctx.strokeStyle = 'rgba(200,230,140,0.5)'; ctx.lineWidth = 4; for (let x = Math.floor(l / 90) * 90; x < r; x += 90) { const o = (t * 80) % 90; ctx.beginPath(); ctx.arc(x + o, fl - 26, 18, PI * 1.1, PI * 1.9); ctx.stroke(); }
  for (let i = 0; i < 6; i++) { const dx = -200 + i * 230, dy = top + ((t * 300 + i * 140) % (fl - top)); circ(dx, dy, 6, 'rgba(160,200,120,0.8)'); }
  sign(520, top + 300, '下水道 · 禁止敬酒', 'SEWER · NO TOASTING', '#e8e2a0', '#22322a');
} };
const ART_SERVER = { floorTop: '#3a4152', slab: '#22262f', draw(top, fl, l, r, t) {
  ctx.fillStyle = '#0f1626'; ctx.fillRect(l, top, r - l, fl - top);
  for (let x = Math.floor(l / 190) * 190; x < r; x += 190) {
    if (x > 300 && x < 760) continue;
    ctx.fillStyle = '#1d2433'; rr(x + 10, top + 180, 170, fl - top - 180, 8); ctx.fill(); ctx.strokeStyle = '#2f3a52'; ctx.lineWidth = 4; ctx.stroke();
    for (let y = top + 200; y < fl - 20; y += 30) { ctx.fillStyle = '#28324a'; ctx.fillRect(x + 22, y, 146, 22); for (let k = 0; k < 4; k++) { const on = Math.sin(t * (3 + k) + x * 0.13 + y * 0.07) > 0.2; circ(x + 120 + k * 12, y + 11, 4, on ? ['#3f6', '#3cf', '#fc3', '#3f6'][k] : '#223'); } }
  }
  ctx.fillStyle = '#111'; rr(360, top + 330, 380, 250, 12); ctx.fill(); ctx.fillStyle = '#0a1a10'; rr(376, top + 346, 348, 218, 6); ctx.fill();
  const lines = ['while (boss.cup < you.cup) {', '  you.bow();  // TODO', '}', 'ERROR: 敬酒超时 TOAST TIMEOUT'];
  lines.forEach((s, i) => text(s, 392, top + 378 + i * 44, i === 3 ? 20 : 22, i === 3 ? '#ff5050' : '#5f5', 'left', 700));
  if (Math.floor(t * 2) % 2) ctx.fillStyle = '#5f5', ctx.fillRect(392, top + 530, 14, 24);
  sign(880, top + 330, '机房 · 禁止饮水', 'SERVER ROOM · NO DRINKS ALLOWED', '#2f6bff', '#fff');
} };
const ART_TOMB = { floorTop: '#4a3f33', slab: '#2e261e', draw(top, fl, l, r, t) {
  ctx.fillStyle = '#1d1a16'; ctx.fillRect(l, top, r - l, fl - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 4; for (let y = top; y < fl; y += 80) for (let x = Math.floor(l / 160) * 160 + ((y / 80) % 2) * 80; x < r; x += 160) ctx.strokeRect(x, y, 160, 80);
  // coffin
  ctx.fillStyle = '#5a1a12'; ctx.beginPath(); ctx.moveTo(560, fl - 40); ctx.lineTo(1000, fl - 40); ctx.lineTo(1040, fl - 200); ctx.lineTo(520, fl - 220); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 6; ctx.stroke();
  text('寿', 780, fl - 130, 70, '#c9a227', 'center', 900);
  // talismans
  for (const [x, y, a] of [[100, top + 260, -0.1], [240, top + 420, 0.15], [1000, top + 330, 0.05]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#f2d23a'; ctx.fillRect(-26, -70, 52, 140); ctx.strokeStyle = '#c0242c'; ctx.lineWidth = 4; poly([{ x: -12, y: -50 }, { x: 10, y: -30 }, { x: -10, y: -5 }, { x: 12, y: 20 }, { x: -8, y: 50 }]); ctx.restore(); }
  // rope from the robbers' hole + candles
  ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 6; line({ x: 430, y: top }, { x: 430 + Math.sin(t) * 10, y: top + 380 });
  for (const cx of [520, 1050]) { ctx.fillStyle = '#eee'; ctx.fillRect(cx - 8, fl - 280, 16, 50); ctx.fillStyle = '#ff9a1f'; ctx.beginPath(); ctx.ellipse(cx, fl - 292 + Math.sin(t * 11 + cx) * 2, 8, 16, 0, 0, 2 * PI); ctx.fill(); }
  sign(260, top + 330, '此墓有酒', 'THIS TOMB HAS BOOZE', '#2a1a10', '#f2d23a');
} };
const ART_ALIEN = { floorTop: '#5a6680', slab: '#2a3040', draw(top, fl, l, r, t) {
  ctx.fillStyle = '#1b2236'; ctx.fillRect(l, top, r - l, fl - top);
  ctx.strokeStyle = '#2c3654'; ctx.lineWidth = 4; for (let x = Math.floor(l / 120) * 120; x < r; x += 120) line({ x, y: top }, { x, y: fl }); for (let y = top; y < fl; y += 120) line({ x: l, y }, { x: r, y });
  ctx.fillStyle = `rgba(0,255,220,${0.5 + 0.3 * Math.sin(t * 4)})`; ctx.fillRect(l, top + 150, r - l, 10); ctx.fillRect(l, fl - 120, r - l, 6);
  tube(40, top + 260, 130, 300, t, '地球人样本 HUMAN');
  // tiny office worker in the tube
  ctx.fillStyle = '#f4c9a1'; circ(105, top + 380, 18, '#f4c9a1', OL, 3); ctx.fillStyle = '#fff'; ctx.fillRect(92, top + 400, 26, 50); ctx.fillStyle = '#d42a35'; ctx.fillRect(103, top + 402, 5, 30); ctx.fillStyle = '#f2b51d'; ctx.fillRect(122, top + 400, 12, 18);
  // ufo
  const uy = top + 420 + Math.sin(t * 2) * 10;
  ctx.fillStyle = 'rgba(160,220,255,0.6)'; ctx.beginPath(); ctx.ellipse(860, uy - 40, 90, 70, 0, PI, 2 * PI); ctx.fill();
  ctx.fillStyle = '#9aa5b5'; ctx.beginPath(); ctx.ellipse(860, uy, 230, 50, 0, 0, 2 * PI); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.stroke();
  for (let i = 0; i < 7; i++) circ(680 + i * 60, uy + 8, 9, Math.floor(t * 4 + i) % 2 ? '#ffd34d' : '#ff4d4d');
  sign(400, top + 330, '51区 · 地下室', 'AREA 51 · BASEMENT', '#2aff9a', '#0a1a10');
} };
function endlessArt(n) { // a deep-core variant: glowing molten walls, getting hotter the deeper you go
  const k = clamp(n / 12, 0, 1);
  return { floorTop: '#4a1a06', slab: '#2a0c03', draw(top, fl, l, r, t) {
    const g = ctx.createLinearGradient(0, top, 0, fl); g.addColorStop(0, shade('#5a1a04', 0.8 + 0.3 * k)); g.addColorStop(1, shade('#ff7a1a', 0.75 + 0.25 * k)); ctx.fillStyle = g; ctx.fillRect(l, top, r - l, fl - top);
    ctx.strokeStyle = 'rgba(255,220,120,0.35)'; ctx.lineWidth = 5;
    for (let x = Math.floor(l / 240) * 240; x < r; x += 240) { ctx.beginPath(); ctx.moveTo(x, top); for (let y = top; y < fl; y += 60) ctx.lineTo(x + 30 * Math.sin(y * 0.02 + t * 1.5 + x), y); ctx.stroke(); }
    flames(l, r, fl, 70 + 60 * k, t, n);
    const i = BASE_LAYERS.length - 1 + n;
    sign(540, top + 300, `无尽模式 · 第${i + 1}层`, `ENDLESS ${n} · 地心以下`, '#1a0602', '#ffb13b');
  } };
}
const OLD_ART = LAYER_ART;
const ART = [OLD_ART[0], OLD_ART[1], ART_CELLAR, OLD_ART[2], ART_SEWER, OLD_ART[3], ART_TOMB, ART_TOMB, OLD_ART[4], ART_ALIEN, OLD_ART[6], OLD_ART[7]];
const ART_HOME = { floorTop: '#b5835a', slab: '#6a4a32', draw(top, fl, l, r, t) {
  // warm living room / kitchen
  ctx.fillStyle = '#f1dfbf'; ctx.fillRect(l, top, r - l, fl - top);
  ctx.fillStyle = 'rgba(200,150,100,0.18)'; for (let x = Math.floor(l / 60) * 60; x < r; x += 60) ctx.fillRect(x, top, 22, fl - top);
  ctx.fillStyle = '#c79a6a'; ctx.fillRect(l, fl - 120, r - l, 120); ctx.fillStyle = '#8a6040'; ctx.fillRect(l, fl - 126, r - l, 8);
  // window with curtains
  ctx.fillStyle = '#9fd3f0'; rr(60, fl - 640, 260, 220, 8); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.strokeRect(60, fl - 640, 260, 220); line({ x: 190, y: fl - 640 }, { x: 190, y: fl - 420 });
  ctx.fillStyle = '#e2577a'; ctx.beginPath(); ctx.moveTo(40, fl - 660); ctx.lineTo(120, fl - 660); ctx.quadraticCurveTo(80, fl - 520, 110, fl - 390); ctx.lineTo(40, fl - 390); ctx.fill();
  ctx.beginPath(); ctx.moveTo(340, fl - 660); ctx.lineTo(260, fl - 660); ctx.quadraticCurveTo(300, fl - 520, 270, fl - 390); ctx.lineTo(340, fl - 390); ctx.fill();
  // calligraphy + family photo + calendar
  ctx.fillStyle = '#fff8e8'; rr(470, fl - 700, 120, 300, 6); ctx.fill(); ctx.strokeStyle = '#8a6040'; ctx.lineWidth = 6; ctx.strokeRect(470, fl - 700, 120, 300);
  ['家', '和', '万', '事', '兴'].forEach((c, i) => text(c, 530, fl - 670 + i * 56, 42, '#222', 'center', 900));
  ctx.fillStyle = '#8a6040'; rr(660, fl - 640, 150, 120, 6); ctx.fill(); ctx.fillStyle = '#cfe8ff'; ctx.fillRect(672, fl - 628, 126, 96);
  circ(705, fl - 585, 16, '#f3c7a0'); circ(760, fl - 590, 18, '#f3c7a0'); ctx.fillStyle = '#e2577a'; ctx.fillRect(742, fl - 572, 36, 40); ctx.fillStyle = '#f3f3f0'; ctx.fillRect(690, fl - 569, 30, 37);
  ctx.fillStyle = '#fff'; rr(880, fl - 660, 110, 130, 6); ctx.fill(); ctx.fillStyle = '#d42a35'; ctx.fillRect(880, fl - 660, 110, 32); text('周日', 935, fl - 644, 20, '#fff', 'center', 900); text('8', 935, fl - 578, 56, '#222', 'center', 900);
  // fridge + sofa
  ctx.fillStyle = '#e8eef2'; rr(1040, fl - 520, 170, 520, 14); ctx.fill(); ctx.strokeStyle = '#9aa'; ctx.lineWidth = 5; ctx.stroke(); line({ x: 1040, y: fl - 330 }, { x: 1210, y: fl - 330 });
  for (const [x, y, c2] of [[1080, fl - 470, '#ff5a5a'], [1150, fl - 440, '#3fbf5a'], [1100, fl - 400, '#ffd34d']]) circ(x, y, 12, c2);
  ctx.fillStyle = '#7a5a9a'; rr(-260, fl - 220, 300, 180, 30); ctx.fill(); rr(-280, fl - 300, 340, 120, 30); ctx.fill();
  // the rug (the 'floor' Mom will go below)
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(560, fl - 4, 420, 22, 0, 0, 2 * PI); ctx.fill();
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(560, fl - 4, 380, 15, 0, 0, 2 * PI); ctx.stroke();
} };
const endlessArtCache = new Map();
function art(i) { if (i === 0 && st.tut) return ART_HOME; if (i < ART.length) return ART[i]; const n = i - BASE_LAYERS.length + 1; if (!endlessArtCache.has(n)) endlessArtCache.set(n, endlessArt(n)); return endlessArtCache.get(n); }

// Floor-relative staging: the first room extends far above the camera, so ceiling-relative
// ornaments disappear. These small warm fixtures live in the quiet band above the actors.
function drawBanquetWall(fl, t) {
  const lampY = fl - 610;
  ctx.save();
  for (const x of [310, 1030]) {
    const glow = ctx.createRadialGradient(x, lampY + 34, 5, x, lampY + 75, 145);
    glow.addColorStop(0, 'rgba(255,218,128,0.19)'); glow.addColorStop(1, 'rgba(255,202,108,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 145, lampY - 20, 290, 190);
    const beam = ctx.createLinearGradient(0, lampY, 0, fl - 430);
    beam.addColorStop(0, 'rgba(255,221,146,0.12)'); beam.addColorStop(1, 'rgba(255,214,133,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x - 12, lampY + 12); ctx.lineTo(x + 12, lampY + 12); ctx.lineTo(x + 95, fl - 430); ctx.lineTo(x - 95, fl - 430); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#432023'; ctx.strokeStyle = '#b18c4d'; ctx.lineWidth = 3; rr(x - 28, lampY - 7, 56, 23, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe3a4'; ctx.beginPath(); ctx.ellipse(x, lampY + 13, 18, 4, 0, 0, PI * 2); ctx.fill();
  }
  // Keep the background joke, with a single readable line.
  const px = 714, py = fl - 539;
  ctx.globalAlpha = st.judge || st.punch ? 0.2 : 0.85;
  ctx.fillStyle = '#81212b'; ctx.strokeStyle = '#c7a25d'; ctx.lineWidth = 3;
  rr(px - 181, py - 30, 362, 60, 9); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(242,209,141,0.27)'; ctx.lineWidth = 1.5;
  rr(px - 174, py - 23, 348, 46, 5); ctx.stroke();
  text('杯口最低责任制', px, py, 30, '#f1d6a0', 'center', 900);
  ctx.restore();
}
function drawRoom(i, l, r, t) {
  const top = i === 0 ? floorY(0) - 1400 : floorY(i - 1) + SLAB, fl = floorY(i);
  ctx.save(); ctx.beginPath(); ctx.rect(l, top, r - l, fl - top); ctx.clip();
  art(i).draw(top, fl, l, r, t);
  // Restrained ambient shading separates the backdrop, furniture and floor.
  const shadeFloor = ctx.createLinearGradient(0, fl - 260, 0, fl);
  shadeFloor.addColorStop(0, 'rgba(14,11,20,0)'); shadeFloor.addColorStop(1, 'rgba(14,11,20,0.18)');
  ctx.fillStyle = shadeFloor; ctx.fillRect(l, fl - 260, r - l, 260);
  if (i === 0 && !st.tut) drawBanquetWall(fl, t);
  // Cast shadows on the room's surviving floor only, never over a smashed opening.
  const hole = st.holes[i];
  for (const c of [...allChars(), ...pending]) {
    const P = c.P; if (!P) continue;
    const lift = fl - P.ankle.y;
    if (lift < -16 || lift > 180) continue;
    const cx = (P.ankle.x + P.toe.x) * 0.5;
    if (hole && cx > hole.x1 - 48 * P.sc && cx < hole.x2 + 48 * P.sc) continue;
    const strength = clamp(1 - Math.max(0, lift) / 180, 0, 1);
    ctx.fillStyle = `rgba(15,12,18,${0.2 * strength})`; ctx.beginPath(); ctx.ellipse(cx, fl - 3, (34 + lift * 0.04) * P.sc, 7 * P.sc, 0, 0, PI * 2); ctx.fill();
  }
  ctx.restore();
}
function drawSlab(i, l, r) {
  const fl = floorY(i), h = st.holes[i], a = art(i), next = art(i + 1);
  const piece = (x1, x2, jag, side) => {
    ctx.beginPath(); ctx.moveTo(x1, fl); ctx.lineTo(x2, fl);
    if (jag) { const n = jag.length - 1; for (let k = 0; k <= n; k++) { const y = fl + SLAB * k / n; const x = (side === 'l' ? x2 : x1) + jag[k]; ctx.lineTo(x, y); } }
    else ctx.lineTo(x2, fl + SLAB);
    ctx.lineTo(x1, fl + SLAB); ctx.closePath();
  };
  const draws = h ? [[l, h.x1, h.jl, 'l'], [h.x2, r, h.jr, 'r']] : [[l, r, null, '']];
  if (h) { const g = ctx.createLinearGradient(0, fl, 0, fl + SLAB); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0.2)'); ctx.fillStyle = g; ctx.fillRect(h.x1, fl, h.x2 - h.x1, SLAB); }
  for (const [x1, x2, jag, side] of draws) {
    if (x2 <= x1) continue;
    if (side === 'r') { ctx.beginPath(); ctx.moveTo(x1 + jag[0], fl); const n = jag.length - 1; for (let k = 0; k <= n; k++) ctx.lineTo(x1 + jag[k], fl + SLAB * k / n); ctx.lineTo(x2, fl + SLAB); ctx.lineTo(x2, fl); ctx.closePath(); }
    else piece(x1, x2, jag, side);
    const g = ctx.createLinearGradient(0, fl, 0, fl + SLAB); g.addColorStop(0, a.slab); g.addColorStop(1, shade(next.slab, 0.9)); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = a.floorTop; ctx.fillRect(l, fl, r - l, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = Math.floor(l / 140) * 140; x < r; x += 140) ctx.fillRect(x, fl, 4, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let k = 0; k < 3; k++) ctx.fillRect(l, fl + 50 + k * 32, r - l, 6);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- characters
const OL = '#17171b';
function seg(a, b, w, col) { ctx.strokeStyle = OL; ctx.lineWidth = w + 8; line(a, b); ctx.strokeStyle = col; ctx.lineWidth = w; line(a, b); }
// the cup is drawn from its geometry (cupGeom), so what you see is what the rules use: the boss's bowl is the
// clink window; your bowl's size, how full it is and the stem length set how easily it spills and how low you bow
function cupPath(g, s, inset) {
  const top = -g.rimOff * s, bb = (-g.rimOff + g.bowlH) * s, i = inset || 0;
  ctx.beginPath(); ctx.moveTo(-g.wb * s + i, bb - i); ctx.lineTo(g.wb * s - i, bb - i); ctx.lineTo(g.wt * s - i, top); ctx.lineTo(-g.wt * s + i, top); ctx.closePath();
}
function drawCup(c) {
  const P = c.P, s = P.sc, g = cupGeom(c), isP = c === player;
  ctx.save(); ctx.translate(P.hand.x, P.hand.y); ctx.scale(c.face, 1); ctx.rotate(c.tilt);
  const top = -g.rimOff * s, bb = (-g.rimOff + g.bowlH) * s, ft = g.foot * s;
  if (bb < ft - 4 * s) { // a stem and a foot under the bowl
    const sw = 2.6 * s;
    ctx.fillStyle = 'rgba(225,240,255,0.75)'; ctx.strokeStyle = OL; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.rect(-sw, bb - 1, 2 * sw, ft - bb - 2 * s); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, ft - 1.5 * s, g.footW * s, 3 * s, 0, 0, 2 * PI); ctx.fill(); ctx.stroke();
  }
  cupPath(g, s); ctx.fillStyle = 'rgba(225,240,255,0.55)'; ctx.fill();
  // drink level: full = 'free' under the rim (the spill line); yours drops as you spill
  const full = top + g.free * s, lvl = lerp(bb - 2 * s, full, isP ? 0.15 + 0.85 * clamp(c.wine / wineCapacity(), 0, 1) : clamp(c.wine, 0, 1));
  if (c.wine > 0.03) {
    ctx.save(); cupPath(g, s, 3); ctx.clip();
    const ww = isP ? clamp(c.w || 0, -0.8, 0.8) : 0;
    // your surface stays level in the world and leans with the wave: when it meets the rim, it spills (same angle as the rule)
    ctx.translate(0, lvl); ctx.rotate(isP ? -(c.tilt + ww) : -c.tilt * c.face * 0.95 + clamp(c.vtilt * 0.05, -0.3, 0.3));
    const amp = isP ? clamp(Math.abs(c.wv || 0) * 0.6, 0, 3) * s : 0, ph = st.t * 9;
    ctx.fillStyle = drinkCol(c); ctx.beginPath(); ctx.moveTo(-60 * s, 90 * s);
    for (let x = -60; x <= 60; x += 6) ctx.lineTo(x * s, -amp * Math.sin(x * 0.12 + ph));
    ctx.lineTo(60 * s, 90 * s); ctx.closePath(); ctx.fill();
    if (!c.spec.drink && !st.tut) { ctx.fillStyle = '#fffbe8'; ctx.fillRect(-60 * s, -Math.min(4, g.free * 0.8) * s, 120 * s, 6 * s); }
    ctx.restore();
  }
  cupPath(g, s); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke();
  if (isP && st.state === 'play' && !noSpill() && c.wine > 0.03) { const q = Math.abs(c.tilt + (c.w || 0)) / g.lim;
    if (q > 0.72) { const over = q >= 1, a = over ? 0.9 : (q - 0.72) / 0.28 * 0.8, sd = Math.sign(c.tilt + (c.w || 0));
      ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = over ? '#ff3b3b' : '#ffb347'; ctx.shadowBlur = 18; ctx.strokeStyle = over ? `rgba(255,70,70,${a})` : `rgba(255,190,80,${a})`; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(sd * g.wt * s * 0.1, top); ctx.lineTo(sd * g.wt * s, top); ctx.lineTo(sd * (g.wt * s - 3), top + 14 * s * 0.4); ctx.stroke(); ctx.restore(); } }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; line({ x: -g.wt * s + 6, y: top + 5 }, { x: -g.wb * s + 5, y: bb - 5 });
  ctx.restore();
}
// All expression cues are derived from play state; decorative animation never moves the cup.
function charMood(c) {
  const j = st.judge, isP = c === player, r = st.round;
  const pulse = j ? clamp(1 - j.t / 1.4, 0, 1) : 0;
  const burstBoss = c === boss && r && r.burst && j;
  const good = !!j && !burstBoss && j.col !== '#ff4d4d' && j.col !== '#ff9a3d';
  const danger = isP && st.state === 'play' && !noSpill() ? clamp((Math.abs(c.tilt + (c.w || 0)) / spillLim() - 0.55) / 0.6, 0, 1) : 0;
  const hurry = r && r.phase === 'aim' && !r.smash ? clamp(1 - roundLeft() / 1.2, 0, 1) : 0;
  return { good: good ? pulse : 0, bad: !good ? pulse : 0, perfect: good && j.col === '#ffd34d' ? pulse : 0,
    fear: burstBoss ? 1 : Math.max(danger, hurry * (isP ? 0.8 : 0)), fall: c.mode === 'fall' ? 1 : 0 };
}
function comicSpark(x, y, r, color) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.28, y - r * 0.28); ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.28, y + r * 0.28); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.28, y + r * 0.28);
  ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.28, y - r * 0.28); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
}
function drawFace(c) {
  const P = c.P, sp = c.spec, s = P.sc, mood = charMood(c), t = st.t;
  const r = P.hr * (sp.kind === 'player' ? 1.08 : sp.kind === 'boss' ? 1.12 : 1.02);
  const react = Math.max(mood.good, mood.bad), squash = Math.sin((st.judge ? st.judge.t : 0) * 19) * react * 0.08;
  ctx.save(); ctx.translate(P.head.x, P.head.y); ctx.scale(c.face, 1); ctx.rotate(P.toA + PI / 2 - clamp(c.mode === 'play' ? c.phi + c.b - 0.6 : 0, 0, 1.1) * 0.8);
  ctx.scale(1 + squash, 1 - squash);
  const skin = sp.imp || sp.alien || sp.rat || sp.jiangshi || sp.yanwang || sp.ox || sp.horse ? sp.skin : sp.terracotta ? '#b36a46' : sp.skeleton ? '#f3ecd8' : sp.lava ? '#2a1410' : sp.skin;
  // Strong silhouettes and an offset ear keep the faces readable at phone size.
  circ(-r * 0.79, r * 0.06, r * 0.24, skin, OL, 4);
  circ(0, 0, r, skin, sp.lava ? '#ff7a1a' : OL, 5);
  if (sp.kind === 'player') {
    const panic = Math.max(mood.bad, mood.fear, mood.fall), happy = mood.good;
    ctx.fillStyle = sp.hair; ctx.beginPath(); ctx.arc(0, 0, r + 1, PI * 0.91, PI * 1.85);
    ctx.lineTo(r * 0.25, -r * 0.48); ctx.lineTo(r * 0.08, -r * 0.82); ctx.lineTo(-r * 0.12, -r * 0.51); ctx.closePath(); ctx.fill();
    // The one ambitious strand of hair refuses to stay down.
    ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.86);
    ctx.quadraticCurveTo(-r * (0.36 + 0.13 * Math.sin(t * 8)), -r * (1.38 + panic * 0.22), r * 0.2, -r * 1.16); ctx.stroke();
    ctx.fillStyle = 'rgba(229,90,95,0.32)'; ctx.beginPath(); ctx.ellipse(r * 0.04, r * 0.3, r * 0.22, r * 0.12, -0.1, 0, 2 * PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.85, r * 0.28, r * 0.17, r * 0.11, 0, 0, 2 * PI); ctx.fill();
    if (happy > 0.15) {
      ctx.strokeStyle = OL; ctx.lineWidth = 4;
      for (const x of [0.27, 0.73]) { ctx.beginPath(); ctx.moveTo(r * (x - 0.16), -r * 0.1); ctx.quadraticCurveTo(r * x, -r * 0.4, r * (x + 0.16), -r * 0.1); ctx.stroke(); }
      ctx.fillStyle = '#fff8df'; ctx.beginPath(); ctx.moveTo(r * 0.16, r * 0.27); ctx.lineTo(r * 0.9, r * 0.2);
      ctx.quadraticCurveTo(r * 0.76, r * 0.91, r * 0.3, r * 0.67); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 2; line({ x: r * 0.24, y: r * 0.45 }, { x: r * 0.78, y: r * 0.4 });
      if (mood.perfect > 0.1) comicSpark(-r * 0.72, -r * 0.72, r * (0.21 + 0.05 * Math.sin(t * 16)), '#fff1a0');
    } else {
      // Tiny pupils, huge whites and an increasingly unconvincing customer-service smile.
      const eye = 1 + panic * 0.22;
      circ(r * 0.24, -r * 0.18, r * 0.25 * eye, '#fff', OL, 3); circ(r * 0.72, -r * 0.18, r * 0.24 * eye, '#fff', OL, 3);
      const pupil = r * (0.085 - panic * 0.048), jitter = Math.sin(t * 37) * panic * r * 0.025;
      circ(r * 0.34 + jitter, -r * 0.1, pupil, OL); circ(r * 0.81 + jitter, -r * 0.1, pupil, OL);
      ctx.strokeStyle = OL; ctx.lineWidth = 4;
      line({ x: -r * 0.01, y: -r * (0.48 + panic * 0.13) }, { x: r * 0.39, y: -r * (0.57 + panic * 0.2) });
      line({ x: r * 0.58, y: -r * (0.59 + panic * 0.2) }, { x: r * 0.94, y: -r * (0.44 + panic * 0.1) });
      ctx.fillStyle = '#681f32'; ctx.beginPath(); ctx.ellipse(r * 0.55, r * (0.43 + panic * 0.09), r * (0.25 + panic * 0.12), r * (0.12 + panic * 0.26), 0, 0, 2 * PI); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fff8df'; ctx.fillRect(r * 0.37, r * (0.32 - panic * 0.04), r * 0.33, r * 0.1);
      if (panic > 0.35) { ctx.fillStyle = '#ff8191'; ctx.beginPath(); ctx.ellipse(r * 0.55, r * (0.5 + panic * 0.18), r * 0.16, r * 0.075, 0, 0, 2 * PI); ctx.fill(); }
      // Sweat always falls away from the cup and aim window.
      for (let i = 0; i < 1 + Math.ceil(panic * 3); i++) {
        const travel = (t * (1.25 + panic) + i * 0.31) % 1, sx = -r * (0.28 + i * 0.32), sy = -r * 0.55 + travel * r * 1.1;
        ctx.globalAlpha = (1 - travel * 0.7) * (i ? panic : 0.85); ctx.fillStyle = '#8de7ff'; ctx.strokeStyle = '#244f72'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.18); ctx.quadraticCurveTo(sx - r * 0.17, sy + r * 0.12, sx, sy + r * 0.16); ctx.quadraticCurveTo(sx + r * 0.17, sy + r * 0.12, sx, sy - r * 0.18); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  } else if (sp.planet) {
    // Two planetary silhouettes, both dressed for an excessively formal toast.
    ctx.strokeStyle = OL; ctx.lineWidth = 4;
    if (sp.planet === 'sprout') {
      for (const ex of [-0.25, 0.63]) {
        line({ x: r * ex, y: -r * 0.6 }, { x: r * ex, y: -r * 1.15 });
        circ(r * ex, -r * 1.2, r * 0.3, skin, OL, 4);
        circ(r * (ex + 0.06), -r * 1.2, r * 0.2, '#fff9dc', OL, 2);
        circ(r * (ex + 0.12), -r * 1.18, r * 0.09, OL);
      }
      ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.26); ctx.quadraticCurveTo(r * 0.3, r * (0.8 + mood.good * 0.2), r * 0.9, r * 0.16); ctx.stroke();
      ctx.fillStyle = '#fff9dc'; ctx.fillRect(r * 0.1, r * 0.41, r * 0.19, r * 0.16);
    } else {
      ctx.save(); ctx.rotate(-0.22); ctx.strokeStyle = '#eac77f'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.ellipse(0, -r * 0.65, r * 1.35, r * 0.25, 0, 0, 2 * PI); ctx.stroke(); ctx.restore();
      circ(r * 0.35, -r * 0.05, r * 0.46, '#fff9dc', OL, 4);
      circ(r * 0.47, -r * 0.01, r * 0.23, '#50b5aa', OL, 3);
      circ(r * 0.52, -r * 0.01, r * 0.11, OL);
      ctx.strokeStyle = OL; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(r * 0.04, r * 0.57); ctx.quadraticCurveTo(r * 0.5, r * (0.78 + mood.good * 0.15), r * 0.83, r * 0.47); ctx.stroke();
    }
  } else if (sp.kind === 'boss') {
    const anger = Math.max(mood.bad, st.state === 'play' && st.round && st.round.result === 'strike' ? 0.2 : 0), grin = mood.good;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.61, r * 0.34, r * 0.13, -0.3, 0, 2 * PI); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.76, -r * 0.38 - i * 5); ctx.quadraticCurveTo(-r * 0.08, -r * 1.11 - i * 2, r * 0.57, -r * 0.63 + i * 3); ctx.stroke(); }
    ctx.globalAlpha = 0.26 + anger * 0.32; circ(r * 0.56, r * 0.24, r * 0.29, '#ef574f'); ctx.globalAlpha = 1;
    // Thick glasses slide up the forehead when the boss is offended.
    const gy = -anger * r * 0.14;
    if (anger > 0.2) {
      circ(r * 0.3, -r * 0.13, r * 0.18, '#fff', OL, 3); circ(r * 0.75, -r * 0.13, r * 0.17, '#fff', OL, 3);
      circ(r * 0.34, -r * 0.1, r * 0.045, OL); circ(r * 0.79, -r * 0.1, r * 0.045, OL);
      ctx.strokeStyle = OL; ctx.lineWidth = 5; line({ x: r * 0.1, y: -r * 0.44 }, { x: r * 0.47, y: -r * 0.29 }); line({ x: r * 0.58, y: -r * 0.29 }, { x: r * 0.94, y: -r * 0.44 });
    } else {
      ctx.strokeStyle = OL; ctx.lineWidth = 4;
      line({ x: r * 0.15, y: -r * 0.14 }, { x: r * 0.46, y: -r * (0.11 + grin * 0.06) }); line({ x: r * 0.59, y: -r * (0.11 + grin * 0.06) }, { x: r * 0.9, y: -r * 0.15 });
      circ(r * 0.35, -r * 0.065, r * 0.06, OL); circ(r * 0.78, -r * 0.065, r * 0.06, OL);
    }
    ctx.strokeStyle = OL; ctx.lineWidth = 3;
    rr(r * 0.08, -r * 0.34 + gy, r * 0.45, r * 0.34, 5); ctx.stroke(); rr(r * 0.57, -r * 0.34 + gy, r * 0.42, r * 0.34, 5); ctx.stroke(); line({ x: r * 0.08, y: -r * 0.2 + gy }, { x: -r * 0.43, y: -r * 0.26 });
    if (grin > 0.15) {
      ctx.fillStyle = '#fff4da'; ctx.beginPath(); ctx.moveTo(r * 0.15, r * 0.27); ctx.quadraticCurveTo(r * 0.65, r * 0.55, r * 0.99, r * 0.2);
      ctx.quadraticCurveTo(r * 0.76, r * 0.91, r * 0.34, r * 0.67); ctx.closePath(); ctx.fill(); ctx.stroke();
      comicSpark(r * 0.82, r * 0.42, r * 0.15 * (0.8 + 0.2 * Math.sin(t * 14)), '#fff');
    } else if (anger > 0.2) {
      ctx.fillStyle = '#631724'; ctx.beginPath(); ctx.ellipse(r * 0.6, r * 0.48, r * 0.32, r * 0.2, -0.1, 0, 2 * PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(r * 0.39, r * 0.3, r * 0.38, r * 0.1);
      ctx.strokeStyle = '#b32634'; ctx.lineWidth = 4;
      const vx = -r * 0.52, vy = -r * 0.36;
      for (const a of [0, PI / 2, PI, PI * 1.5]) { ctx.save(); ctx.translate(vx, vy); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(r * 0.06, r * 0.04); ctx.lineTo(r * 0.2, r * 0.04); ctx.lineTo(r * 0.2, r * 0.17); ctx.stroke(); ctx.restore(); }
    } else {
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.43); ctx.quadraticCurveTo(r * 0.63, r * 0.62, r * 0.94, r * 0.25); ctx.stroke();
    }
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r * 0.28, r * 0.57, r * 0.35, 0.2, 1.4); ctx.stroke();
    if (sp.alien) { ctx.strokeStyle = OL; ctx.lineWidth = 3; line({ x: -r * 0.3, y: -r * 0.87 }, { x: -r * 0.5, y: -r * 1.5 }); circ(-r * 0.5, -r * 1.5, r * 0.17, '#d89dff', OL, 3); }
  } else {
    if (sp.mom) {
      for (let i = 0; i < 7; i++) { const a = PI * (0.95 + i * 0.15); circ(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.36, sp.hair); }
      circ(r * 0.35, -r * 0.1, r * 0.1, OL); circ(r * 0.78, -r * 0.1, r * 0.09, OL);
      ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r * 0.55, r * 0.25, r * 0.28, 0.3, 2.6); ctx.stroke();
      ctx.globalAlpha = 0.45; circ(r * 0.25, r * 0.2, r * 0.15, '#ff6a8a'); circ(r * 0.9, r * 0.2, r * 0.13, '#ff6a8a'); ctx.globalAlpha = 1;
      circ(-r * 0.05, r * 0.35, r * 0.09, '#ffd34d', OL, 2);
    } else if (sp.rat) {
      circ(-r * 0.3, -r * 0.85, r * 0.42, sp.skin, OL, 4); circ(-r * 0.3, -r * 0.85, r * 0.24, '#f2a0b0');
      circ(r * 0.4, -r * 0.15, r * 0.12, OL); circ(r * 0.75, -r * 0.15, r * 0.11, OL);
      circ(r * 1.0, r * 0.15, r * 0.14, '#f27a9a', OL, 3);
      ctx.strokeStyle = OL; ctx.lineWidth = 2; for (const a of [-0.25, 0, 0.25]) line({ x: r * 0.95, y: r * 0.2 }, { x: r * 1.55, y: r * (0.2 + a) });
      ctx.fillStyle = '#fff'; ctx.fillRect(r * 0.7, r * 0.45, r * 0.12, r * 0.18); ctx.fillRect(r * 0.84, r * 0.45, r * 0.12, r * 0.18);
    } else if (sp.alien) {
      ctx.strokeStyle = OL; ctx.lineWidth = 3; line({ x: 0, y: -r }, { x: -r * 0.3, y: -r * 1.6 }); circ(-r * 0.3, -r * 1.65, r * 0.14, '#ff4dd2', OL, 3);
      ctx.fillStyle = OL; ctx.save(); ctx.translate(r * 0.3, -r * 0.1); ctx.rotate(0.5); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.18, r * 0.32, 0, 0, 2 * PI); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(r * 0.8, -r * 0.1); ctx.rotate(-0.5); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.16, r * 0.3, 0, 0, 2 * PI); ctx.fill(); ctx.restore();
      circ(r * 0.33, -r * 0.18, r * 0.06, '#fff'); circ(r * 0.82, -r * 0.18, r * 0.05, '#fff');
      ctx.strokeStyle = OL; ctx.lineWidth = 3; line({ x: r * 0.45, y: r * 0.5 }, { x: r * 0.7, y: r * 0.5 });
    } else if (sp.jiangshi) {
      ctx.fillStyle = '#1a1a2a'; ctx.beginPath(); ctx.ellipse(0, -r * 0.7, r * 1.15, r * 0.28, 0, 0, 2 * PI); ctx.fill(); ctx.beginPath(); ctx.arc(0, -r * 0.75, r * 0.75, PI, 2 * PI); ctx.fill(); circ(0, -r * 1.45, r * 0.14, '#c0242c');
      circ(r * 0.35, -r * 0.15, r * 0.1, OL); circ(r * 0.78, -r * 0.15, r * 0.1, OL);
      ctx.save(); ctx.rotate(0.12 * Math.sin(t * 5)); ctx.fillStyle = '#f2d23a'; ctx.fillRect(r * 0.35, -r * 0.55, r * 0.42, r * 1.25); ctx.strokeStyle = '#c0242c'; ctx.lineWidth = 3; poly([{ x: r * 0.45, y: -r * 0.4 }, { x: r * 0.66, y: -r * 0.2 }, { x: r * 0.45, y: r * 0.05 }, { x: r * 0.66, y: r * 0.3 }, { x: r * 0.5, y: r * 0.55 }]); ctx.restore();
    } else if (sp.yanwang) {
      ctx.fillStyle = '#111'; ctx.fillRect(-r * 0.7, -r * 1.45, r * 1.4, r * 0.65); ctx.fillStyle = '#c9a227'; ctx.fillRect(-r * 1.1, -r * 1.55, r * 2.2, r * 0.14);
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; line({ x: -r * 0.9 + i * r * 0.45, y: -r * 1.45 }, { x: -r * 0.9 + i * r * 0.45, y: -r * 1.15 }); circ(-r * 0.9 + i * r * 0.45, -r * 1.12, 4, '#ff5050'); }
      ctx.strokeStyle = OL; ctx.lineWidth = 5; line({ x: r * 0.15, y: -r * 0.5 }, { x: r * 0.5, y: -r * 0.3 }); line({ x: r * 0.95, y: -r * 0.5 }, { x: r * 0.6, y: -r * 0.3 });
      circ(r * 0.35, -r * 0.12, r * 0.13, '#fff', OL, 3); circ(r * 0.75, -r * 0.12, r * 0.12, '#fff', OL, 3); circ(r * 0.38, -r * 0.1, r * 0.06, OL); circ(r * 0.77, -r * 0.1, r * 0.06, OL);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(r * 0.05, r * 0.3); ctx.quadraticCurveTo(r * 0.55, r * 0.2, r * 1.0, r * 0.3); ctx.lineTo(r * 0.75, r * 1.7); ctx.lineTo(r * 0.55, r * 1.2); ctx.lineTo(r * 0.35, r * 1.75); ctx.closePath(); ctx.fill();
    } else if (sp.ox) {
      ctx.fillStyle = '#efe6cf'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.5, -r * 0.7); ctx.quadraticCurveTo(sx * r * 1.4, -r * 1.0, sx * r * 1.2, -r * 1.7); ctx.quadraticCurveTo(sx * r * 1.0, -r * 1.1, sx * r * 0.2, -r * 0.9); ctx.fill(); ctx.stroke(); }
      circ(r * 0.3, -r * 0.2, r * 0.11, OL); circ(r * 0.75, -r * 0.2, r * 0.1, OL);
      ctx.fillStyle = '#c99a8a'; ctx.beginPath(); ctx.ellipse(r * 0.6, r * 0.35, r * 0.5, r * 0.32, 0, 0, 2 * PI); ctx.fill(); ctx.stroke(); circ(r * 0.45, r * 0.32, 4, OL); circ(r * 0.8, r * 0.32, 4, OL);
      circ(r * 0.62, r * 0.62, r * 0.18, null, '#c9a227', 5);
    } else if (sp.horse) {
      ctx.fillStyle = sp.skin; ctx.strokeStyle = OL; ctx.lineWidth = 4; rr(r * 0.1, -r * 0.2, r * 1.3, r * 0.8, r * 0.35); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.9); ctx.lineTo(r * 0.4, -r * 1.1); ctx.lineTo(-r * 0.9, r * 0.2); ctx.fill();
      ctx.fillStyle = sp.skin; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.8); ctx.lineTo(-r * 0.05, -r * 1.5); ctx.lineTo(r * 0.25, -r * 0.85); ctx.fill(); ctx.stroke();
      circ(r * 0.35, -r * 0.35, r * 0.11, OL); circ(r * 1.15, r * 0.15, 4, OL);
      ctx.fillStyle = '#fff'; ctx.fillRect(r * 0.9, r * 0.42, r * 0.4, r * 0.12);
    } else if (sp.imp) {
      ctx.fillStyle = '#2a0a06'; for (const sx of [-0.5, 0.4]) { ctx.beginPath(); ctx.moveTo(r * sx, -r * 0.8); ctx.lineTo(r * (sx + 0.05), -r * 1.55); ctx.lineTo(r * (sx + 0.35), -r * 0.85); ctx.fill(); }
      ctx.strokeStyle = OL; ctx.lineWidth = 4; line({ x: r * 0.15, y: -r * 0.45 }, { x: r * 0.48, y: -r * 0.25 }); line({ x: r * 0.95, y: -r * 0.45 }, { x: r * 0.62, y: -r * 0.25 });
      circ(r * 0.35, -r * 0.1, r * 0.1, '#ffe36b'); circ(r * 0.75, -r * 0.1, r * 0.1, '#ffe36b');
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.3); ctx.quadraticCurveTo(r * 0.6, r * 0.8, r * 1.0, r * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (sp.hood) {
      ctx.fillStyle = sp.hood; ctx.beginPath(); ctx.arc(0, 0, r * 1.18, PI * 0.55, PI * 1.95); ctx.lineTo(r * 0.2, -r * 0.6); ctx.quadraticCurveTo(-r * 0.2, r * 0.2, r * 0.0, r * 1.15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(90,200,255,0.35)'; ctx.fillRect(r * 0.15, -r * 0.35, r * 0.9, r * 0.45);
      circ(r * 0.4, -r * 0.1, r * 0.1, OL); circ(r * 0.8, -r * 0.1, r * 0.09, OL);
      ctx.strokeStyle = OL; ctx.lineWidth = 3; circ(r * 0.4, -r * 0.1, r * 0.22, null, OL, 3); circ(r * 0.8, -r * 0.1, r * 0.2, null, OL, 3);
      ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 6; line({ x: r * 0.15, y: r * 0.25 }, { x: r * 0.3, y: r * 0.95 }); // dark circles... and bags
      ctx.strokeStyle = OL; ctx.lineWidth = 4; line({ x: r * 0.45, y: r * 0.5 }, { x: r * 0.75, y: r * 0.45 });
    } else if (sp.skeleton) {
      circ(r * 0.32, -r * 0.1, r * 0.2, OL); circ(r * 0.75, -r * 0.1, r * 0.18, OL);
      ctx.strokeStyle = OL; ctx.lineWidth = 3; line({ x: r * 0.3, y: r * 0.5 }, { x: r * 0.9, y: r * 0.5 }); for (let i = 0; i < 5; i++) line({ x: r * (0.35 + i * 0.12), y: r * 0.38 }, { x: r * (0.35 + i * 0.12), y: r * 0.62 });
    } else if (sp.lava) {
      ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 14; circ(r * 0.35, -r * 0.12, r * 0.13, '#ffe36b'); circ(r * 0.75, -r * 0.12, r * 0.12, '#ffe36b');
      ctx.strokeStyle = '#ff9a1f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r * 0.55, r * 0.25, r * 0.3, 0.3, 2.6); ctx.stroke(); ctx.shadowBlur = 0;
    } else {
      if (sp.terracotta) { circ(-r * 0.1, -r * 0.95, r * 0.32, '#8c4c32', OL, 3); }
      else if (sp.helmet) { ctx.fillStyle = sp.helmet; ctx.beginPath(); ctx.arc(0, -r * 0.05, r + 4, PI, 2 * PI); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke(); ctx.fillRect(0, -r * 0.1, r * 1.3, r * 0.16); if (sp.lamp) { circ(r * 0.5, -r * 0.65, r * 0.2, '#fff8c0', OL, 3); ctx.fillStyle = 'rgba(255,248,180,0.22)'; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.65); ctx.lineTo(r * 5, -r * 2.2); ctx.lineTo(r * 5, r * 0.9); ctx.fill(); } }
      else if (sp.cap) { ctx.fillStyle = sp.cap; ctx.beginPath(); ctx.arc(0, -r * 0.1, r + 2, PI * 1.02, PI * 1.98); ctx.fill(); ctx.fillRect(0, -r * 0.3, r * 1.4, r * 0.2); }
      else { ctx.fillStyle = sp.hair; ctx.beginPath(); ctx.arc(0, 0, r + 1, PI * 0.95, PI * 1.9); ctx.closePath(); ctx.fill(); }
      circ(r * 0.35, -r * 0.1, r * 0.11, OL); circ(r * 0.78, -r * 0.1, r * 0.1, OL);
      if (sp.glasses) { ctx.strokeStyle = OL; ctx.lineWidth = 3; circ(r * 0.35, -r * 0.1, r * 0.22, null, OL, 3); circ(r * 0.78, -r * 0.1, r * 0.2, null, OL, 3); }
      ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r * 0.55, r * 0.22, r * 0.3, 0.4, 2.4); ctx.stroke();
      ctx.globalAlpha = 0.35; circ(r * 0.5, r * 0.22, r * 0.16, '#ff5a5a'); ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
// ---------------------------------------------------------------- 魔性 wobble (purely visual)
// Springs that lag and overshoot behind the real pose: torso lean/bend, knees, a floppy back arm and a bobbing head.
// Driven by the real motion (height speed and its change), bumps, clinks, spills and the smash. It never calls rnd()
// and never writes gameplay state; the feet stay planted and the cup hand stays exactly where the game puts it
// (the front arm re-bends to reach it), so the rim you see is the rim that is judged.
const VIS_ON = params.get('wobble') !== '0';
function visOf(c) { return c.vis || (c.vis = { lean: 0, vl: 0, bend: 0, vb: 0, knee: 0, vk: 0, arm: 0, va: 0, head: 0, vhd: 0, ph: (c.id * 1.7) % 6.28, pvh: 0, pz: null, bump: null, judge: null }); }
function spr(v, x, vx, goal, K, D, f, dt) { v[vx] += (K * (goal - v[x]) - D * v[vx] + f) * dt; v[x] += v[vx] * dt; v[x] = clamp(v[x], -1.2, 1.2); }
function stepVis(dt) {
  if (!VIS_ON || dt <= 0) return;
  const r = st.round, live = st.state === 'play';
  for (const c of allChars()) {
    const v = visOf(c), isP = c === player, mine = isP ? 1 : c === boss ? 0.6 : 0.45;
    // how fast the body goes up/down (from the real pose: hand height)
    const hy = c.P ? c.P.hand.y : 0, vy = v.pz == null ? 0 : (hy - v.pz) / dt; v.pz = hy;
    const avy = clamp((vy - v.pvh) / dt, -9000, 9000); v.pvh = vy;
    let fL = 0, fB = 0, fK = 0, fA = 0, fH = 0;
    if (live && c.mode === 'play') {
      // bowing / standing: the top half lags behind and overshoots, the knees give, the loose arm swings
      fB += -avy * 0.005 * mine; fL += -avy * 0.0035 * mine; fK += avy * 0.003 * mine; fA += avy * 0.01 * mine; fH += avy * 0.006 * mine;
      // a drunk idle sway that grows the lower you bow, and the body follows the drink's slosh a little
      v.ph += dt * (2.1 + 0.4 * Math.sin(st.t * 0.31 + c.id));
      const low = isP ? clamp(player.h || 0, 0, 1) : clamp(c.s || 0, 0, 1);
      fL += Math.sin(v.ph) * (2 + 7 * low) * mine; fA += Math.sin(v.ph * 1.37 + 1) * 6 * mine; fH += Math.sin(v.ph * 2) * 2.5 * mine;
      if (isP) { const bv = (player.swv || 0) * 60; fL += (player.wv || 0) * 9 + bv * 0.9; fA += (player.wv || 0) * 18 - bv * 1.6; fK += bv * 0.8; fH += -bv * 0.9; fB += player.tilt * 30; }
      // spilling: flailing
      if (isP && Math.abs(player.tilt + (player.w || 0)) > spillLim() && !noSpill()) { fA += Math.sin(st.t * 31) * 60; fH += Math.sin(st.t * 23) * 22; fL += Math.sin(st.t * 17) * 10; fK += Math.sin(st.t * 13) * 8; }
      // pounding the floor
      if (isP && r && r.smash && keys.O && player.h > 0.9) { fB += Math.sin(st.t * 15) * 18; fA += Math.sin(st.t * 15 + 1) * 30; fH += Math.sin(st.t * 30) * 20; }
    }
    // a bump: stagger the player
    if (isP && st.bump && st.bump.done && v.bump !== st.bump) { v.bump = st.bump; const sg = Math.sin(st.t * 7.3) > 0 ? 1 : -1; v.vl += 9 * sg; v.vb += 5; v.vk += 6; v.va += 22 * sg; v.vhd += 12; }
    // a clink: both jolt; a good one gets a little happy bounce, a bad one a flinch
    if (st.judge && v.judge !== st.judge) { v.judge = st.judge; const good = st.judge.col !== '#ff4d4d' && st.judge.col !== '#ff9a3d';
      v.vl += (good ? 4 : -7) * mine; v.vb += (good ? -3.5 : 5) * mine; v.va += (good ? 22 : -26) * mine; v.vhd += (good ? 14 : -9) * mine; v.vk += (good ? 4 : 1) * mine; }
    // each key press gives the body a small visible jolt (look only)
    if (isP && live) for (const k of 'QWOP') { if (keys[k] && !v['k' + k]) {
      if (k === 'O') { v.vb += 6; v.vk += 5; v.vhd += 7; } else if (k === 'P') { v.vb -= 5; v.vk -= 3; v.vhd -= 7; } else { const sg = k === 'W' ? 1 : -1; v.va += 14 * sg; v.vhd += 4 * sg; v.vl += 2 * sg; } }
      v['k' + k] = keys[k]; }
    spr(v, 'lean', 'vl', 0, 78, 9, fL, dt); spr(v, 'bend', 'vb', 0, 74, 8, fB, dt); spr(v, 'knee', 'vk', 0, 90, 9, fK, dt);
    spr(v, 'arm', 'va', 0, 32, 4.2, fA, dt); spr(v, 'head', 'vhd', 0, 96, 8, fH, dt);
  }
}
// Functional body cues only run during a live toast; falls and verdicts retain the big comic poses.
function balancePoseActive(c) {
  const r = st.round;
  return c === player && c.mode === 'play' && st.state === 'play' && !st.tut && r && !r.smash && (r.phase === 'aim' || r.phase === 'clink');
}
// The drawn pose keeps the real cup and reaching elbow. Decorative springs stay quiet while steering.
function visPose(c) {
  const P = c.P, balancing = balancePoseActive(c);
  if (c.mode !== 'play' || st.state === 'fall' || st.state === 'standup') return P;
  if ((!VIS_ON || !c.vis) && !balancing) return P;
  const v = VIS_ON && c.vis ? c.vis : { lean: 0, bend: 0, knee: 0, arm: 0, head: 0 };
  const k = Math.abs(v.lean) + Math.abs(v.bend) + Math.abs(v.knee) + Math.abs(v.arm) + Math.abs(v.head); if (k < 1e-4 && !balancing) return P;
  const sm = st.state === 'over' ? 0.5 : 1, quiet = balancing ? 0.16 : 1;
  const q = Object.assign({}, c, { phi: c.phi + 0.28 * v.lean * sm * quiet, b: c.b + 0.43 * v.bend * sm * quiet, k: clamp(c.k + 0.38 * v.knee * sm * quiet, -0.05, 1.05) });
  const V = fk(q), dx = P.ankle.x - V.ankle.x, dy = P.ankle.y - V.ankle.y, sh = p => ({ x: p.x + dx, y: p.y + dy });
  const out = { ...V, sc: P.sc, hr: P.hr, toA: V.toA };
  for (const n of ['hip', 'knee', 'ankle', 'toe', 'shoulder', 'neck', 'head', 'belly']) out[n] = sh(V[n]);
  const sc = P.sc, ua = 44 * sc, fa = 42 * sc, f = c.face;
  const hb = 10 * sc * v.head * sm * (balancing ? 0.35 : 1), na = V.toA;
  out.head = { x: out.head.x + Math.cos(na) * f * hb, y: out.head.y + Math.sin(na) * hb };
  const dd = (a, len, o) => ({ x: o.x + Math.cos(a) * len * f, y: o.y + Math.sin(a) * len });
  if (balancing) {
    // The empty hand catches the actual spill direction. Forward reach adds a small backward counterweight.
    const cupLoad = clamp((c.tilt + (c.w || 0)) / Math.max(0.12, spillLim()), -1.3, 1.3);
    const bodyLoad = clamp((c.sw || 0) * 3 + (c.swv || 0) * 0.06, -0.35, 0.35);
    const load = clamp(cupLoad * 0.74 + clamp(c.reach || 0, 0, 1) * 0.3 + bodyLoad, -1, 1);
    const rescue = PI / 2 + load * 1.13;
    out.elbow2 = dd(rescue, ua, out.shoulder);
    out.hand2 = dd(rescue + 0.14 - 0.25 * load, fa * 0.9, out.elbow2);
  } else {
    const a2 = V.toA + PI * 0.82 + Math.sin(c.sway) * 0.15 + 2.1 * v.arm * sm;
    out.elbow2 = dd(a2, ua, out.shoulder); out.hand2 = dd(a2 + 0.5 + 0.7 * v.arm * sm, fa * 0.9, out.elbow2);
    const cheer = charMood(c).good;
    if (cheer > 0) {
      out.elbow2 = { x: lerp(out.elbow2.x, out.shoulder.x - f * 29 * sc, cheer), y: lerp(out.elbow2.y, out.shoulder.y + 14 * sc, cheer) };
      out.hand2 = { x: lerp(out.hand2.x, out.shoulder.x - f * 47 * sc, cheer), y: lerp(out.hand2.y, out.shoulder.y - 28 * sc, cheer) };
    }
  }
  // Decorative poses may re-bend the cup arm, but live reaching keeps the real elbow exactly.
  const S = out.shoulder, Hh = P.hand, hx = Hh.x - S.x, hy = Hh.y - S.y, dist = Math.max(1, Math.hypot(hx, hy));
  const side = Math.sign((P.elbow.x - P.shoulder.x) * (P.hand.y - P.shoulder.y) - (P.elbow.y - P.shoulder.y) * (P.hand.x - P.shoulder.x)) || 1;
  const dc = Math.min(dist, ua + fa - 0.5), a = (ua * ua - fa * fa + dc * dc) / (2 * dc), hgt = Math.sqrt(Math.max(0, ua * ua - a * a));
  const ux = hx / dist, uy = hy / dist;
  out.elbow = balancing ? P.elbow : { x: S.x + ux * a + side * -uy * hgt * -1, y: S.y + uy * a + side * ux * hgt * -1 };
  out.hand = P.hand; out.rim = P.rim; out.cupB = P.cupB; out.ca = P.ca;
  return out;
}
function drawReachStrain(c) {
  if (!balancePoseActive(c)) return;
  const reach = clamp(c.reach || 0, 0, 1), speed = c.reachV || 0;
  if (reach < 0.62 || speed < -0.01) return;
  const P = c.P, s = P.sc, E = P.elbow, dx = P.hand.x - E.x, dy = P.hand.y - E.y, len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len, uy = dy / len, flip = ux < 0 ? -1 : 1, nx = -uy * flip, ny = ux * flip;
  const effort = clamp((reach - 0.62) / 0.38, 0, 1), twitch = Math.sin(st.t * 30) * 1.5 * effort;
  ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = 0.35 + effort * 0.5;
  // Three tiny comic ticks sit below the elbow, away from the cup rim and target lane.
  for (let i = -1; i <= 1; i++) {
    const x = E.x + (nx * (22 + twitch) + ux * i * 11) * s, y = E.y + (ny * (22 + twitch) + uy * i * 11) * s;
    const a = { x, y }, b = { x: x + (nx * (5 + effort * 4) + ux * i * 2) * s, y: y + (ny * (5 + effort * 4) + uy * i * 2) * s };
    ctx.strokeStyle = OL; ctx.lineWidth = 5 * s; line(a, b); ctx.strokeStyle = '#ffe6ad'; ctx.lineWidth = 2.5 * s; line(a, b);
  }
  ctx.restore();
}
function drawChar(c) {
  const P0 = c.P; if (!P0) return; const P = visPose(c); c.P = P;
  try { drawCharAt(c); drawReachStrain(c); } finally { c.P = P0; }
}
// Comic reactions stay behind the head, on the side away from the cups.
function drawCharReaction(c, mood) {
  if (mood.good < 0.04 && mood.bad < 0.04) return;
  const P = c.P, s = P.sc, f = c.face, x = P.head.x - f * 36 * s, y = P.head.y - 20 * s;
  ctx.save(); ctx.lineCap = 'round';
  const pulse = Math.max(mood.good, mood.bad);
  ctx.globalAlpha = pulse * 0.85; ctx.strokeStyle = mood.good ? '#fff1a0' : '#ff7171'; ctx.lineWidth = 4 * s;
  for (let i = 0; i < 4; i++) {
    const a = PI * (0.66 + i * 0.23), reach = (1 - pulse) * 20;
    line({ x: x + Math.cos(a) * f * (30 + reach) * s, y: y + Math.sin(a) * (30 + reach) * s },
      { x: x + Math.cos(a) * f * (43 + reach) * s, y: y + Math.sin(a) * (43 + reach) * s });
  }
  if (c === player && mood.bad > 0.04) {
    // The employee's soul briefly leaves the body after a social catastrophe.
    const rise = (1 - mood.bad) * 56 * s, gx = x - f * 22 * s, gy = y - 35 * s - rise;
    ctx.globalAlpha = mood.bad * 0.72; ctx.fillStyle = '#e4f9ff'; ctx.strokeStyle = '#588091'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(gx - 13 * s, gy + 14 * s); ctx.bezierCurveTo(gx - 25 * s, gy - 30 * s, gx + 25 * s, gy - 30 * s, gx + 13 * s, gy + 14 * s);
    ctx.lineTo(gx + 4 * s, gy + 8 * s); ctx.lineTo(gx - 2 * s, gy + 17 * s); ctx.lineTo(gx - 7 * s, gy + 9 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    circ(gx - 5 * s, gy - 5 * s, 2.4 * s, '#3c5c6a'); circ(gx + 5 * s, gy - 5 * s, 2.4 * s, '#3c5c6a');
    ctx.beginPath(); ctx.ellipse(gx, gy + 4 * s, 3 * s, 4 * s, 0, 0, PI * 2); ctx.stroke();
  } else if (mood.perfect > 0.04 && c === player) {
    comicSpark(x - f * 10 * s, y - 37 * s, 11 * s, '#ffe16b');
    comicSpark(x - f * 35 * s, y - 5 * s, 7 * s, '#fff8c7');
  }
  ctx.restore();
}
function drawCharAt(c) {
  const P = c.P; if (!P) return; const sp = c.spec, s = P.sc, mood = charMood(c);
  drawCharReaction(c, mood);
  const shirt = sp.terracotta ? '#a85a3a' : sp.shirt, pants = sp.terracotta ? '#8c4c32' : sp.skeleton ? '#efe6cf' : sp.lava ? '#3a1a10' : sp.pants;
  const skin = sp.imp || sp.alien || sp.rat || sp.jiangshi || sp.yanwang || sp.ox || sp.horse ? sp.skin : sp.terracotta ? '#b36a46' : sp.skeleton ? '#f3ecd8' : sp.lava ? '#2a1410' : sp.skin;
  const lw = sp.skeleton ? 12 * s : 22 * s;
  if (sp.lava) { ctx.shadowColor = '#ff6a14'; ctx.shadowBlur = 25; }
  // back arm
  seg(P.shoulder, P.elbow2, lw * 0.8, shade(shirt, 0.75)); seg(P.elbow2, P.hand2, lw * 0.75, shade(shirt, 0.75)); circ(P.hand2.x, P.hand2.y, 9 * s, skin, OL, 4);
  if (mood.good > 0.12 && !balancePoseActive(c)) {
    seg({ x: P.hand2.x + c.face * 4 * s, y: P.hand2.y }, { x: P.hand2.x + c.face * 4 * s, y: P.hand2.y - 14 * s }, 7 * s, skin);
    circ(P.hand2.x, P.hand2.y, 9 * s, skin, OL, 3);
  }
  // back leg (offset)
  const off = { x: -9 * s * c.face, y: 0 };
  const o = p => ({ x: p.x + off.x, y: p.y + off.y });
  seg(o(P.hip), o(P.knee), lw * 1.05, shade(pants, 0.7)); seg(o(P.knee), o(P.ankle), lw, shade(pants, 0.7)); seg(o(P.ankle), o(P.toe), 13 * s, '#111');
  // front leg
  seg(P.hip, P.knee, lw * 1.1, pants); seg(P.knee, P.ankle, lw, pants); seg(P.ankle, P.toe, 14 * s, sp.skeleton ? '#efe6cf' : '#0d0d0d');
  // torso
  const tw = sp.skeleton ? 16 * s : 46 * s;
  seg(P.hip, P.neck, tw, shirt);
  if (sp.apron) { const a1 = { x: lerp(P.hip.x, P.neck.x, -0.15), y: lerp(P.hip.y, P.neck.y, -0.15) }, a2 = { x: lerp(P.hip.x, P.neck.x, 0.75), y: lerp(P.hip.y, P.neck.y, 0.75) }; seg(a1, a2, tw * 0.62, sp.apron); }
  if (sp.skeleton) { ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 6; for (let i = 1; i < 5; i++) { const q = { x: lerp(P.hip.x, P.neck.x, 0.35 + i * 0.12), y: lerp(P.hip.y, P.neck.y, 0.35 + i * 0.12) }; const n = { x: Math.cos(P.toA + PI / 2) * 24 * s, y: Math.sin(P.toA + PI / 2) * 24 * s }; ctx.strokeStyle = OL; ctx.lineWidth = 10; line({ x: q.x - n.x, y: q.y - n.y }, { x: q.x + n.x, y: q.y + n.y }); ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 6; line({ x: q.x - n.x, y: q.y - n.y }, { x: q.x + n.x, y: q.y + n.y }); } }
  if (sp.belly) { ctx.beginPath(); ctx.arc(P.belly.x, P.belly.y, 31 * s, 0, 2 * PI); ctx.fillStyle = shirt; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 3; }
  // The collar stays on the torso while a loose tie follows the free arm's spring.
  if (sp.tie) {
    const fx = Math.cos(P.toA + PI / 2) * -c.face, fy = Math.sin(P.toA + PI / 2) * -1;
    const T1 = { x: lerp(P.neck.x, P.hip.x, 0.05) - fx * 12 * s, y: lerp(P.neck.y, P.hip.y, 0.05) - fy * 12 * s };
    const flutter = balancePoseActive(c) ? clamp(-(c.tilt + (c.w || 0)) * 20 - (c.reachV || 0) * 4, -20, 20) : VIS_ON && c.vis ? clamp(c.vis.arm * 16 + c.vis.vb * 1.8, -25, 25) : 0;
    const T2 = { x: lerp(P.neck.x, P.hip.x, 0.67) - fx * (14 + flutter) * s, y: lerp(P.neck.y, P.hip.y, 0.67) - fy * (14 + flutter) * s };
    const tx = T2.x - T1.x, ty = T2.y - T1.y, tl = Math.max(1, Math.hypot(tx, ty)), nx = -ty / tl, ny = tx / tl;
    ctx.fillStyle = '#fff8e9'; ctx.strokeStyle = OL; ctx.lineWidth = 2 * s;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(T1.x + nx * side * 17 * s, T1.y + ny * side * 17 * s);
      ctx.lineTo(T1.x + tx * 0.32 + nx * side * 10 * s, T1.y + ty * 0.32 + ny * side * 10 * s); ctx.lineTo(T1.x, T1.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = sp.tie; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(T1.x - nx * 4 * s, T1.y - ny * 4 * s); ctx.lineTo(T1.x + nx * 4 * s, T1.y + ny * 4 * s);
    ctx.lineTo(T2.x + nx * 7 * s, T2.y + ny * 7 * s); ctx.lineTo(T2.x + tx / tl * 8 * s, T2.y + ty / tl * 8 * s); ctx.lineTo(T2.x - nx * 7 * s, T2.y - ny * 7 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    circ(T1.x, T1.y, 5 * s, sp.tie, OL, 2 * s);
    // An employee badge and an ostentatious gold pin, drawn as shapes for small screens.
    const bx = lerp(P.neck.x, P.hip.x, 0.4) + fx * 9 * s, by = lerp(P.neck.y, P.hip.y, 0.4) + fy * 9 * s;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(P.toA + PI / 2);
    if (sp.kind === 'player') { ctx.fillStyle = '#fff8d9'; ctx.strokeStyle = '#303540'; ctx.lineWidth = 2 * s; rr(-9 * s, -3 * s, 18 * s, 23 * s, 3 * s); ctx.fill(); ctx.stroke(); circ(-2 * s, 4 * s, 3 * s, '#edb48c'); ctx.fillStyle = '#5d91ae'; ctx.fillRect(-5 * s, 8 * s, 6 * s, 5 * s); ctx.fillStyle = '#7c7c76'; ctx.fillRect(3 * s, 4 * s, 3 * s, 2 * s); ctx.fillRect(3 * s, 9 * s, 3 * s, 2 * s); }
    else comicSpark(0, 0, 8 * s, '#ffd76e');
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  drawFace(c);
  if (sp.lava) { ctx.shadowColor = '#ff6a14'; ctx.shadowBlur = 25; }
  // front arm with cup
  seg(P.shoulder, P.elbow, lw * 0.85, shirt); seg(P.elbow, P.hand, lw * 0.8, shirt);
  ctx.shadowBlur = 0;
  drawCup(c);
  circ(P.hand.x, P.hand.y, 10 * s, skin, OL, 4);
}

// ---------------------------------------------------------------- side glass gauge
function gaugeRect() {
  if (LAY === 'port') return { x: 20, y: hudBottom() + 40, w: 170, h: 290 };
  if (LAY === 'land') return { x: 30, y: 200, w: 150, h: 250 };
  return { x: 22, y: 140, w: 118, h: 200 };
}
const gaugeDrops = [];
function drawMobileResult(o) {
  const [rank, remark] = rankFor(o.score), mode = DIFFICULTIES.find(d => d.id === o.difficulty) || difficulty();
  const fit = Math.min(1, (W - 80) / 1920);
  ctx.save(); ctx.translate(540, 540); ctx.scale(fit, fit); ctx.translate(-540, -540);
  const l = o.wine || wineLedger(), left = 70, right = 1000;
  ctx.fillStyle = '#211a24'; rr(-390, 160, 1860, 690, 36); ctx.fill();
  text('失败', 540, 90, 50, '#ff796b', 'center', 900);
  ctx.fillStyle = '#ffd34d'; rr(left - 360, 235, 720, 122, 24); ctx.fill();
  text(rank, left, 296, 72, '#7a1019', 'center', 900);
  text(remark, left, 420, 40, '#e5d2c4', 'center', 800);
  text(Math.round(o.score).toLocaleString('en-US'), left, 555, 142, '#ffd34d', 'center', 900);
  text(`${o.custom ? '自定义 · ' : ''}${mode.level} · ${mode.name}`, left, 710, 38, '#e5d2c4', 'center', 800);
  text(`完美 ${st.perfects} 次    失误 ${st.strikes} 次`, right, 252, 46, '#fff', 'center', 900);
  text(`最高 ${st.bestCombo} 连敬`, right, 330, 34, '#e5d2c4', 'center', 800);
  const rows = [['洒酒', l.spill, '#ffc36f', '−'], ['罚酒', l.penalty, '#ff796b', '−'], ['添酒', l.refill, '#91e0a4', '+']];
  rows.forEach(([name, amount, color, sign], i) => {
    text(name, right - 290, 440 + i * 82, 46, color, 'left', 900);
    text(`${sign}${winePercent(amount)}%`, right + 290, 440 + i * 82, 50, color, 'right', 900);
  });
  text('本局累计 · 按初始杯容量', right, 710, 30, '#bfaeb9', 'center', 700);
  if (l.capacity > .0005) text(`换小杯 −${winePercent(l.capacity)}%`, right, 770, 30, '#bfaeb9', 'center', 700);
  text(`${o.cleared ? '十二关已通关 · ' : ''}第 ${o.layer + 1} 层`, left, 795, 34, '#bfaeb9', 'center', 800);
  text(`最高分 ${Math.round(st.hiscore).toLocaleString('en-US')}${st.bestDifficulty ? ' · ' + DIFFICULTIES.find(d => d.id === st.bestDifficulty).level : ''}${st.newRecord ? ' · 新纪录！' : ''}`, 540, 910, 34, '#7fd0ff', 'center', 800);
  text('点一下重来', 540, 1000, 38, '#fff', 'center', 900);
  ctx.restore();
}
function drawGauge(t) {
  const g = gaugeRect(), p = player, wine = clamp(p.wine / wineCapacity(), 0, 1), col = drinkCol(p);
  const hurt = st.state === 'play' && st.lossT < 0.35 && st.loss > 0.002 ? 1 - st.lossT / 0.35 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(g.x - 10, g.y - 14, g.w + 20, g.h + 28, 22); ctx.fill();
  if (hurt) { ctx.fillStyle = `rgba(255,60,60,${0.35 * hurt})`; rr(g.x - 10, g.y - 14, g.w + 20, g.h + 28, 22); ctx.fill(); }
  const tilt = clamp(p.tilt, -0.9, 0.9) * 0.55, cx = g.x + g.w / 2, by = g.y + g.h;
  const G0 = cupGeom(p), qx = g.w * 0.5 / 17, qy = (g.h - 14) / 60; // one fixed scale for every layer
  const wb = G0.wb * qx, wt = G0.wt * qx, top = by - (G0.rimOff + G0.foot) * qy, bb = by - (G0.foot + G0.rimOff - G0.bowlH) * qy;
  ctx.save();
  ctx.translate(cx + Math.sin(t * 75) * 6 * hurt, by); ctx.rotate(tilt);
  if (bb < by - 8) { // stem + foot
    ctx.fillStyle = 'rgba(220,235,255,0.35)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.rect(-6, bb - by, 12, by - bb - 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -4, G0.footW * qx, 6, 0, 0, 2 * PI); ctx.fill(); ctx.stroke();
  }
  const glass = () => { ctx.beginPath(); ctx.moveTo(-wb, bb - by); ctx.lineTo(wb, bb - by); ctx.lineTo(wt, top - by); ctx.lineTo(-wt, top - by); ctx.closePath(); };
  glass(); ctx.fillStyle = 'rgba(220,235,255,0.22)'; ctx.fill();
  // liquid: the surface stays (almost) level in the world while the glass tilts, and sloshes; full = the spill line
  ctx.save(); glass(); ctx.clip();
  const fullY = top - by + G0.free * qy, lvl = lerp(bb - by - 2, fullY, 0.04 + 0.96 * wine), ww = clamp(p.w || 0, -0.8, 0.8);
  ctx.save(); ctx.translate(0, lvl); ctx.rotate(-tilt * 1.05 - ww * 1.7);
  if (wine > 0.004) {
    const amp = clamp(Math.abs(p.wv || 0) * 2.2, 0, 8), ph = t * 9;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-g.w * 1.5, g.h * 2);
    for (let x = -g.w * 1.5; x <= g.w * 1.5; x += 6) ctx.lineTo(x, -amp * Math.sin(x * 0.07 + ph));
    ctx.lineTo(g.w * 1.5, g.h * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; const bh = Math.max(10, by - bb - 20); for (let i = 0; i < 5; i++) { const yy = ((t * 50 + i * 37) % bh); circ(-wb * 0.6 + (i * 29) % Math.max(4, wb * 1.2), -lvl + (bb - by) - yy, 3, 'rgba(255,255,255,0.45)'); }
    if (!st.tut) { ctx.fillStyle = '#fffbe8'; ctx.fillRect(-g.w * 1.5, -8, g.w * 3, 12); for (let i = -4; i <= 4; i++) circ(i * 15, -7, 7, '#fffbe8'); }
  }
  ctx.restore(); ctx.restore();
  // which way the drink is rushing right now (front = right): fades in with the wave's speed
  const wvA = clamp((Math.abs(p.wv || 0) - 0.4) / 1.2, 0, 1);
  if (wvA > 0 && st.state === 'play' && !noSpill()) { const dir = Math.sign(p.wv), ay = top - by - 22;
    ctx.save(); ctx.rotate(-tilt); ctx.globalAlpha = wvA; ctx.fillStyle = '#7fd0ff'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(dir * 34, ay); ctx.lineTo(dir * 8, ay - 14); ctx.lineTo(dir * 8, ay - 5); ctx.lineTo(-dir * 26, ay - 5); ctx.lineTo(-dir * 26, ay + 5); ctx.lineTo(dir * 8, ay + 5); ctx.lineTo(dir * 8, ay + 14); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore(); }
  const nq = st.state === 'play' && !noSpill() ? Math.abs(p.tilt + (p.w || 0)) / spillLim() : 0;
  glass(); ctx.lineWidth = 5; ctx.strokeStyle = nq > 1 ? (Math.floor(t * 8) % 2 ? '#ff4d4d' : '#fff') : '#fff'; ctx.stroke();
  if (nq > 0.72 && nq <= 1) { ctx.save(); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 16; ctx.strokeStyle = `rgba(255,179,71,${(nq - 0.72) / 0.28})`; ctx.lineWidth = 7; glass(); ctx.stroke(); ctx.restore(); } // nearly over the rim: warm glow first
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4; line({ x: -wt + 10, y: top - by + 10 }, { x: -wb + 6, y: bb - by - 10 });
  // spill: drops leave the low side of the rim
  if (st.gaugeSplash > 0 && st.state === 'play') {
    st.gaugeSplash = 0;
    const sx = (tilt >= 0 ? 1 : -1) * wt, sy = top - by;
    const wx = cx + Math.cos(tilt) * sx - Math.sin(tilt) * sy, wy = by + Math.sin(tilt) * sx + Math.cos(tilt) * sy;
    for (let i = 0; i < 3; i++) gaugeDrops.push({ x: wx, y: wy, vx: (tilt >= 0 ? 1 : -1) * (60 + Math.random() * 140), vy: (-120 + Math.random() * 160), life: 0.9 });
  }
  ctx.restore();
  // Resource feedback has its own lane, outside the cup clocks and beat judgment.
  const notices = (st.state === 'over' ? [] : st.wineNotices || []).filter(n => st.t - n.at < 1.8 && n.amount >= 0.001);
  notices.forEach((n, i) => {
    const label = n.kind === 'penalty' ? '罚酒' : n.kind === 'refill' ? '添酒' : '洒酒';
    const color = n.kind === 'refill' ? '#91e0a4' : n.kind === 'penalty' ? '#ff796b' : '#ffc36f';
    const u = TOUCH ? 1.3 : LAY === 'port' ? 1.2 : 1, w = 218 * u, h = 48 * u;
    const x = Math.max(12, g.x + g.w / 2 - w / 2), y = g.y + g.h + 18 + i * (h + 7);
    ctx.save(); ctx.globalAlpha = clamp((1.8 - (st.t - n.at)) * 3, 0, 1);
    ctx.fillStyle = '#211b22'; rr(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    text(`${label} ${n.kind === 'refill' ? '+' : '−'}${winePercent(n.amount)}%`, x + w / 2, y + h / 2, 30 * u, color, 'center', 900);
    ctx.restore();
  });
  for (let i = gaugeDrops.length - 1; i >= 0; i--) { const d = gaugeDrops[i]; d.life -= 1 / 60; d.vy += 900 / 60; d.x += d.vx / 60; d.y += d.vy / 60; if (d.life <= 0 || d.y > H) { gaugeDrops.splice(i, 1); continue; } ctx.globalAlpha = clamp(d.life * 2, 0, 1); circ(d.x, d.y, 6, col); ctx.globalAlpha = 1; }
}

// ---------------------------------------------------------------- render
function worldToScreen(x, y, shx, shy) {
  let dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z;
  return { x: W / 2 + dx + shx, y: H / 2 + dy + shy };
}
function fmtDepth(m) {
  if (m < 0.05) return '0 米';
  if (m < 1000) return `${m.toFixed(1)} 米`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} 公里`;
  return `${Math.round(m / 1000).toLocaleString('en-US')} 公里`;
}
function pauseBtnRect() {
  if (TOUCH) return { x: W - 160, y: 34, w: 112, h: 116 };
  return { x: W - 78, y: hudBottom() + 14, w: 58, h: 58 };
}
function homeBtnRect() {
  const p = pauseBtnRect(), w = TOUCH ? 174 : 126;
  return { x: p.x - w - (TOUCH ? 22 : 12), y: p.y, w, h: p.h };
}
function drawGameNavigation() {
  if (st.state === 'title' || CAPTURE) return;
  const r = homeBtnRect(), unit = TOUCH ? 1.75 : 1;
  ctx.save();
  ctx.fillStyle = 'rgba(20,14,23,.62)'; rr(r.x, r.y, r.w, r.h, 14 * unit); ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,207,.4)'; ctx.lineWidth = 2; ctx.stroke();
  const cx = r.x + 25 * unit, cy = r.y + r.h / 2;
  ctx.strokeStyle = '#fff0d8'; ctx.lineWidth = 3 * unit; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 11 * unit, cy); ctx.lineTo(cx, cy - 10 * unit); ctx.lineTo(cx + 11 * unit, cy);
  ctx.moveTo(cx - 8 * unit, cy - 2 * unit); ctx.lineTo(cx - 8 * unit, cy + 10 * unit); ctx.lineTo(cx + 8 * unit, cy + 10 * unit); ctx.lineTo(cx + 8 * unit, cy - 2 * unit); ctx.stroke();
  text('主页', r.x + r.w - 15 * unit, cy, TOUCH ? 34 : 27, '#fff0d8', 'right', 800);
  if (runActive() && !st.paused) {
    const p = pauseBtnRect(); ctx.fillStyle = 'rgba(20,14,23,.62)'; rr(p.x, p.y, p.w, p.h, 14 * unit); ctx.fill();
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    ctx.fillStyle = '#fff0d8'; ctx.fillRect(cx - 12 * unit, cy - 14 * unit, 8 * unit, 28 * unit); ctx.fillRect(cx + 4 * unit, cy - 14 * unit, 8 * unit, 28 * unit);
  }
  ctx.restore();
}
const btnPrev = {}, btnPing = {};
function muteRect() { return { x: 540 - 160, y: 760, w: 320, h: 52 }; }
function drawMute() { const r = muteRect();
  ctx.fillStyle = muted ? 'rgba(255,255,255,0.1)' : '#7fd0ff'; rr(r.x, r.y, r.w, r.h, r.h / 2); ctx.fill();
  text(muted ? '声音：关' : '声音：开', 540, r.y + r.h / 2 + 1, 26, muted ? 'rgba(255,255,255,0.7)' : '#111', 'center', 900);
  if (!TOUCH) text('M', r.x + r.w + 26, r.y + r.h / 2 + 1, 22, 'rgba(255,255,255,0.45)', 'left', 700); }
// Local, independently replaceable cover art. Canvas fallback also supports offline tests.
function homeImage(src) {
  if (typeof Image === 'undefined') return null;
  const img = new Image(); img.onload = () => render(); img.src = src; return img;
}
const HOME_ART = { background: homeImage('assets/home/banquet-v46.png'), logo: homeImage('assets/home/logo-v46.png') };
function artReady(img) { return !!(img && img.complete && img.naturalWidth); }
function mobileTitle() { return TOUCH && LAY === 'land' && st.state === 'title'; }
function difficultyRect(i) {
  if (mobileTitle()) { const margin = W * 0.17, gap = 36, w = (W - margin * 2 - gap * 2) / 3; return { x: margin + i * (w + gap), y: 450, w, h: 230 }; }
  return { x: 54 + i * 330, y: 432, w: 312, h: 194 };
}
function drawDifficultyPicker() {
  DIFFICULTIES.forEach((d, i) => {
    const r = difficultyRect(i), on = difficultyId === d.id, mobile = mobileTitle();
    ctx.fillStyle = 'rgba(29,8,14,.55)'; rr(r.x + 3, r.y + 12, r.w, r.h, 20); ctx.fill();
    const paper = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    paper.addColorStop(0, on ? '#ffde86' : '#f8e9cb'); paper.addColorStop(1, on ? '#f1b94f' : '#e5ccb0');
    ctx.fillStyle = paper; rr(r.x, r.y, r.w, r.h, 20); ctx.fill();
    ctx.strokeStyle = on ? '#fff0bb' : '#a56649'; ctx.lineWidth = on ? 5 : 3; ctx.stroke();
    ctx.strokeStyle = on ? '#a34b2f' : '#c5a080'; ctx.lineWidth = 2; rr(r.x + 13, r.y + 13, r.w - 26, r.h - 26, 12); ctx.stroke();
    text(d.level, r.x + 28, r.y + 47, mobile ? 31 : 24, '#955439', 'left', 800);
    if (on) { circ(r.x + r.w - 40, r.y + 43, mobile ? 23 : 19, '#a8322a'); text('✓', r.x + r.w - 40, r.y + 43, mobile ? 29 : 24, '#fff0c5', 'center', 900); }
    text(d.name, r.x + r.w / 2, r.y + r.h * .61, Math.min(mobile ? 48 : 32, r.w / 10.2), '#492421', 'center', 900);
  });
}
function titleStartRect() { if (mobileTitle()) return { x: W / 2 - 360, y: 755, w: 720, h: 155 }; return { x: 260, y: 700, w: 560, h: 126 }; }
function titleTutRect() { if (mobileTitle()) return { x: W / 2 - 270, y: 940, w: 540, h: 112 }; return { x: 310, y: 868, w: 460, h: 96 }; }
function debugEntryRect() { if (mobileTitle()) return { x: W - 180, y: 930, w: 120, h: 120 }; return { x: 950, y: 900, w: 64, h: 50 }; }
function debugCloseRect() { return { x: 850, y: 140, w: 140, h: 60 }; }
function drawDesktopTitle() {
  ctx.save(); overlayBox();
  ctx.fillStyle = '#891d25'; ctx.fillRect(0, 0, 1080, 1080);
  for (let y = 30; y < 600; y += 100) for (let x = 30; x < 1080; x += 120) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(PI / 4); ctx.fillStyle = 'rgba(218,75,55,.12)'; ctx.fillRect(-17,-17,34,34); ctx.restore();
  }
  const bg = HOME_ART.background, logo = HOME_ART.logo;
  if (artReady(bg)) {
    const h = 1080 * bg.naturalHeight / bg.naturalWidth;
    ctx.drawImage(bg, 0, 1080 - h, 1080, h);
    const blend = ctx.createLinearGradient(0, 1080 - h, 0, 1080 - h + 130);
    blend.addColorStop(0, '#891d25'); blend.addColorStop(1, 'rgba(137,29,37,0)');
    ctx.fillStyle = blend; ctx.fillRect(0, 1080 - h, 1080, 131);
  }
  const veil = ctx.createLinearGradient(0, 0, 0, 1080); veil.addColorStop(0, 'rgba(28,8,15,.18)'); veil.addColorStop(.6, 'rgba(28,8,15,0)'); veil.addColorStop(1, 'rgba(28,8,15,.4)');
  ctx.fillStyle = veil; ctx.fillRect(0, 0, 1080, 1080);
  if (artReady(logo)) ctx.drawImage(logo, 40, 70, 1000, 1000 * logo.naturalHeight / logo.naturalWidth);
  else text('敬酒模拟器', 540, 220, 110, '#ffe3a1', 'center', 900, '#521b20');
  drawDifficultyPicker();
  const start = titleStartRect();
  ctx.fillStyle = '#68251e'; rr(start.x, start.y + 11, start.w, start.h, 26); ctx.fill();
  const gold = ctx.createLinearGradient(0, start.y, 0, start.y + start.h); gold.addColorStop(0, '#ffe5a1'); gold.addColorStop(1, '#f4b950');
  ctx.fillStyle = gold; rr(start.x, start.y, start.w, start.h, 26); ctx.fill(); ctx.strokeStyle = '#fff1c7'; ctx.lineWidth = 4; ctx.stroke();
  text('开席！', 540, start.y + start.h / 2, 58, '#63251f', 'center', 900);
  const tut = titleTutRect(); text('妈妈教你玩', 540, tut.y + tut.h / 2, 32, '#ffe4bc', 'center', 800, '#4a2021');
  drawDebugEntry(); ctx.restore();
}
function drawMobileTitle() {
  const cx = W / 2, bg = HOME_ART.background, logo = HOME_ART.logo;
  if (artReady(bg)) {
    const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    const w = bg.naturalWidth * scale, h = bg.naturalHeight * scale;
    ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
  } else { ctx.fillStyle = '#662622'; ctx.fillRect(0, 0, W, H); }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(29,7,16,.12)'); shade.addColorStop(.65, 'rgba(29,7,16,.05)'); shade.addColorStop(1, 'rgba(29,7,16,.52)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
  if (artReady(logo)) {
    const w = Math.min(1420, W * .68), h = w * logo.naturalHeight / logo.naturalWidth;
    ctx.drawImage(logo, cx - w / 2, 13, w, h);
  } else text('敬酒模拟器', cx, 225, 126, '#ffe3a1', 'center', 900, '#521b20');
  drawDifficultyPicker();
  const start = titleStartRect();
  ctx.fillStyle = '#68251e'; rr(start.x, start.y + 13, start.w, start.h, 28); ctx.fill();
  const gold = ctx.createLinearGradient(0, start.y, 0, start.y + start.h); gold.addColorStop(0, '#ffe5a1'); gold.addColorStop(1, '#f4b950');
  ctx.fillStyle = gold; rr(start.x, start.y, start.w, start.h, 28); ctx.fill();
  ctx.strokeStyle = '#fff1c7'; ctx.lineWidth = 4; ctx.stroke();
  text('开席！', cx, start.y + start.h / 2, 68, '#63251f', 'center', 900);
  const tut = titleTutRect();
  text('妈妈教你玩', cx, tut.y + tut.h / 2, 40, '#ffe4bc', 'center', 800, '#4a2021');
  drawDebugEntry();
}
function drawDebugEntry() { const r = debugEntryRect(); text('···', r.x + r.w / 2, r.y + r.h / 2, 32, '#8d7b88', 'center', 900); }
function hitR(q, r) { return q.x > r.x && q.x < r.x + r.w && q.y > r.y && q.y < r.y + r.h; }
function overlayPt(p) { if (mobileTitle()) return p; const k = LAY === 'port' ? 1.12 : 1, cy = LAY === 'port' ? btnTop() * 0.5 + 40 : H / 2; return { x: (p.x - W / 2) / k + 540, y: (p.y - cy) / k + 540 }; }
function overlayBox() {
  // overlays are laid out on a 1080x1080 card; centre it, and enlarge it on phones
  const k = LAY === 'port' ? 1.12 : 1;
  ctx.translate(W / 2, (LAY === 'port' ? btnTop() * 0.5 + 40 : H / 2)); ctx.scale(k, k); ctx.translate(-540, -540);
}

function drawArcadeUI() {
  if (st.tut || st.state === 'title' || st.state === 'over') return;
  const u = LAY === 'port' ? 1.25 : 1, width = Math.min(530 * u, W - 410), x = (W - width) / 2, y = hudBottom() + 8;
  const r = st.round, color = st.hype >= 68 ? '#ffb84d' : '#ffd85d';
  ctx.save();
  ctx.fillStyle = 'rgba(22,17,25,0.92)'; rr(x, y, width, 48 * u, 13); ctx.fill();
  ctx.strokeStyle = '#5b4850'; ctx.lineWidth = 2; ctx.stroke();
  text('气势', x + 18 * u, y + 24 * u, 22 * u, color, 'left', 900);
  const barX = x + 77 * u, barW = width - 195 * u;
  ctx.fillStyle = '#443640'; rr(barX, y + 17 * u, barW, 15 * u, 7); ctx.fill();
  if (st.hype > 0) { ctx.fillStyle = color; rr(barX, y + 17 * u, Math.max(10, barW * st.hype / 100), 15 * u, 7); ctx.fill(); }
  text(st.combo ? `${st.combo} 连敬` : '', x + width - 16 * u, y + 24 * u, 21 * u, st.combo ? '#9af0cc' : '#ddc9bb', 'right', 900);
  if (r && r.event && st.state === 'play' && (r.phase === 'aim' || r.phase === 'clink') && !st.judge) {
    const ev = ROUND_EVENTS[r.event], ey = y + 60 * u;
    ctx.fillStyle = '#211a24'; rr(x, ey, width, 42 * u, 12); ctx.fill();
    ctx.fillStyle = ev.col; ctx.fillRect(x, ey + 10 * u, 5 * u, 22 * u);
    text(r.event === 'feint' ? (r.eventDone ? '变招了！' : '假客气 · 杯子还会降') : r.event === 'rush' ? '赶场 · 节奏加快' : '全桌注目 · 扶稳', x + width / 2, ey + 22 * u, 23 * u, ev.col, 'center', 900);
  }
  ctx.restore();
}

function drawStick() {
  const r = stickRect(), active = stick.id !== null;
  const smashHint = st.state === 'play' && !st.paused && st.round && st.round.smash && ['tie', 'aim'].includes(st.round.phase);
  ctx.save();
  circ(r.x, r.y, r.r + 12, 'rgba(16,20,30,.22)', 'rgba(235,245,255,.5)', 4);
  ctx.strokeStyle = 'rgba(235,245,255,.2)'; ctx.lineWidth = 2;
  line({ x: r.x - 90, y: r.y }, { x: r.x + 90, y: r.y });
  line({ x: r.x, y: r.y - 90 }, { x: r.x, y: r.y + 90 });
  for (const [dx, dy, key] of [[-1,0,'Q'],[1,0,'W'],[0,-1,'P'],[0,1,'O']]) {
    const wanted = smashHint ? key === 'O' : st.hintKeys.includes(key);
    ctx.save(); ctx.translate(r.x + dx * 118, r.y + dy * 118); ctx.rotate(Math.atan2(dy, dx));
    if (smashHint && key === 'O') { ctx.shadowColor = '#ffb34d'; ctx.shadowBlur = 12 + 8 * Math.sin(st.t * 6); }
    ctx.strokeStyle = wanted ? '#ffd778' : 'rgba(240,246,255,.65)'; ctx.lineWidth = wanted ? 8 : 4;
    ctx.beginPath(); ctx.moveTo(-8,-11); ctx.lineTo(3,0); ctx.lineTo(-8,11); ctx.stroke(); ctx.restore();
  }
  circ(r.x + stick.rawX * 92, r.y + stick.rawY * 92, 54, active ? 'rgba(127,208,255,.7)' : 'rgba(230,242,250,.4)', 'rgba(255,255,255,.65)', 3);
  if (smashHint) {
    const caption = st.pressure > 0.05 ? '↓ 继续向下推住' : '↓ 摇杆向下推住';
    const y = r.y - r.r - 58;
    ctx.font = `900 34px ${FONT}`; const width = ctx.measureText(caption).width + 36;
    ctx.fillStyle = 'rgba(28,16,8,.8)'; rr(r.x - width / 2, y - 29, width, 58, 14); ctx.fill();
    text(caption, r.x, y, 34, '#ffd778', 'center', 900);
  }
  ctx.restore();
}

function drawToastButton() {
  if (st.tut && st.tut.step !== 5 || st.state !== 'play' || st.paused) return;
  const r = toastButtonRect(), rd = st.round, slam = smashOn(), enabled = canToast();
  const risk = Math.abs(player.tilt + player.w) / spillLim(), reach = player.reach || 0;
  if (TOUCH) {
    const beat = !slam && rd && rd.phase === 'aim' && Math.abs(toastInputLeft()) < 0.05;
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,24,.24)'; rr(r.x, r.y, r.w, r.h, r.h / 2); ctx.fill();
    ctx.strokeStyle = beat ? '#ff6666' : 'rgba(255,244,220,.55)'; ctx.lineWidth = beat ? 7 : 4; ctx.stroke();
    if (reach > 0) { ctx.fillStyle = 'rgba(150,224,190,.35)'; rr(r.x + 16, r.y + r.h - 28, Math.max(8, (r.w - 32) * reach), 8, 4); ctx.fill(); }
    text('敬酒', r.x + r.w / 2, r.y + r.h / 2, 48, enabled ? '#fff2d5' : 'rgba(255,242,213,.55)', 'center', 900, 'rgba(20,16,24,.5)');
    ctx.restore(); return;
  }
  const col = risk > 0.9 ? '#ff9a78' : '#f4dfb0';
  ctx.save(); ctx.globalAlpha = enabled || slam ? 1 : 0.65;
  ctx.fillStyle = '#0d0b11'; rr(r.x, r.y + 6, r.w, r.h, 16); ctx.fill();
  ctx.fillStyle = col; rr(r.x, r.y, r.w, r.h, 16); ctx.fill();
  ctx.strokeStyle = '#201624'; ctx.lineWidth = 4; ctx.stroke();
  if (reach > 0) { ctx.fillStyle = risk > 1 ? '#ef7657' : '#89cbb2'; rr(r.x + 6, r.y + r.h - 11, Math.max(8, (r.w - 12) * reach), 6, 3); ctx.fill(); }
  const beat = !slam && rd && rd.phase === 'aim' && toastBeatReady();
  if (beat && !rd.attacking) { ctx.strokeStyle = Math.abs(toastInputLeft()) < 0.05 ? '#ff6666' : '#ffd34d'; ctx.lineWidth = 5; rr(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 18); ctx.stroke(); }
  const label = slam ? '按住 O 砸穿地板' : rd && rd.phase === 'react' ? '下一杯' : rd && rd.attacking ? '出手中 · 扶稳！' : toastInputLeft() < -timingWindow() ? '错过这一拍' : beat ? (Math.abs(toastInputLeft()) < 0.05 ? (TOUCH ? '0s · 现在碰！' : '0s · 按空格！') : TOUCH ? '碰杯' : '空格 · 碰杯') : TOUCH ? '0s 点碰杯' : '0s 按空格';
  text(TOUCH ? (slam ? '左杆向下砸楼' : rd && rd.attacking ? '扶稳！' : rd && rd.phase === 'react' ? '下一杯' : '敬酒') : label, r.x + r.w / 2, r.y + r.h / 2 - 1, TOUCH ? 48 : LAY === 'desk' ? 23 : 29, '#241722', 'center', 900);
  if (TOUCH && !slam) text('红色 0s 点一下', r.x + r.w / 2, r.y + r.h / 2 + 57, 25, '#604d4a', 'center', 700);
  ctx.restore();
}

function drawComicImpact() {
  const p = st.punch; if (!p) return;
  const a = clamp(1 - p.t / 1.2, 0, 1), cy = H * 0.48;
  ctx.save(); ctx.globalAlpha = a * 0.65; ctx.strokeStyle = '#fff1bb';
  for (let i = 0; i < 24; i++) {
    const an = i * PI / 12 + 0.08 * Math.sin(i * 4), r0 = Math.min(W, H) * (0.31 + (i % 3) * 0.04), r1 = Math.max(W, H);
    ctx.lineWidth = i % 2 ? 3 : 8; line({ x: W / 2 + Math.cos(an) * r0, y: cy + Math.sin(an) * r0 }, { x: W / 2 + Math.cos(an) * r1, y: cy + Math.sin(an) * r1 });
  }
  ctx.globalAlpha = a; ctx.translate(W / 2, cy); ctx.rotate(-0.07); const s = 1 + Math.max(0, 0.2 - p.t) * 2; ctx.scale(s, s);
  const baseSize = Math.min(82, W / 9);
  ctx.font = `900 ${baseSize}px ${FONT}`;
  // Reserve room for the initial 1.4x pop, rotation and outline on both layouts.
  const size = baseSize * Math.min(1, (W * 0.82 / 1.4 - 16) / Math.max(1, ctx.measureText(p.word).width));
  text(p.word, 5, 8, size, '#9b2839', 'center', 900, '#18121a');
  text(p.word, 0, 0, size, p.col, 'center', 900, '#18121a'); ctx.restore();
}
function render() {
  const t = st.t;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, W, H);
  const shx = (Math.random() - 0.5) * st.shake * 2, shy = (Math.random() - 0.5) * st.shake * 2; // screen shake must not touch the seeded rng
  ctx.save();
  ctx.translate(W / 2 + shx, H / 2 + shy);
  ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const hw = W / 2 / cam.z + 80, hh = H / 2 / cam.z + 80;
  const l = cam.x - hw, r = cam.x + hw, vt = cam.y - hh, vb = cam.y + hh;
  const iA = Math.max(0, Math.floor((vt - F0) / LH)), iB = Math.max(0, Math.ceil((vb - F0) / LH) + 1);
  for (let i = iA; i <= iB; i++) {
    const top = i === 0 ? -1e5 : floorY(i - 1) + SLAB, fl = floorY(i);
    if (fl > vt && top < vb) drawRoom(i, l, r, t);
  }
  if (vt < floorY(0) - 1400) { ctx.fillStyle = '#5c0c12'; ctx.fillRect(l, vt, r - l, floorY(0) - 1400 - vt); }
  // puddles
  for (const p of puddles) { ctx.fillStyle = 'rgba(242,181,29,0.55)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, p.r * 1.6, p.r * 0.35, 0, 0, 2 * PI); ctx.fill(); }
  // pending (next room) + characters, back to front
  for (let i = iA; i <= iB; i++) { const fl = floorY(i); if (fl + SLAB > vt && fl < vb) drawSlab(i, l, r); }
  for (const c of pending) drawChar(c);
  for (let i = followers.length - 1; i >= 0; i--) {
    const f = followers[i];
    if (st.alien && (!st.alien.leaders.includes(f) || (st.alien.revealed && f === toastChar()))) continue;
    drawChar(f);
  }
  drawChar(boss);
  if (st.alien && st.alien.revealed && toastChar() !== boss) drawChar(toastChar());
  drawChar(player);
  // cracks
  if (st.cracks.length) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const cr of st.cracks) { ctx.strokeStyle = '#000'; ctx.lineWidth = 9; poly(cr); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2; poly(cr); }
  }
  // debris & particles
  for (const d of debris) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.fillStyle = d.col; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h); ctx.restore(); }
  for (const q of parts) { ctx.globalAlpha = clamp(q.life * 2, 0, 1) * (q.type === 'dust' ? 0.6 : 1); circ(q.x, q.y, q.r, q.col); }
  ctx.globalAlpha = 1;
  drawFx();
  ctx.restore();
  if (flash) { // a quick colour flash from the screen edges: gold = 完美, red = 失礼 / 够不着
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, flash.col); ctx.globalAlpha = clamp(flash.a, 0, 1); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawComicImpact();

  // ================= screen-space UI (kept deliberately sparse) =================
  const UI = LAY === 'port' ? 1.35 : 1, PORT = LAY === 'port', HB = hudBottom();
  const blink = Math.floor(t * 6) % 2 === 0;
  const S = (x, y) => worldToScreen(x, y, shx, shy);
  const rd = st.round, playing = st.state === 'play' && boss.P && player.P;
  // --- the boss's rim height: dashed line, green while you are below it
  if (playing && rd && rd.phase !== 'react' && !(st.alien && !st.alien.revealed && !rd.smash)) {
    const bry = toastRimY(), by = S(0, bry).y, reach = winSpan(), PERF = perfBand();
    const gap = player.P.rim.y - bry, below = gap >= 0 && (rd.smash || gap <= reach);
    const laneLeft = 0, laneRight = W;
    if (!rd.smash) {
      const by2 = S(0, bry + reach).y, inW = gap >= 0 && gap <= reach;
      ctx.fillStyle = inW ? 'rgba(125,255,138,0.16)' : 'rgba(125,255,138,0.08)'; ctx.fillRect(laneLeft, by, laneRight - laneLeft, by2 - by);
      ctx.strokeStyle = gap > reach ? 'rgba(255,154,61,0.95)' : 'rgba(125,255,138,0.55)'; ctx.lineWidth = 3 * UI; ctx.beginPath(); ctx.moveTo(laneLeft, by2); ctx.lineTo(laneRight, by2); ctx.stroke();
    }
    if (!rd.smash && (rd.phase === 'aim' || rd.phase === 'clink' || rd.phase === 'hold')) {
      const py2 = S(0, bry + PERF).y, inP = gap >= 0 && gap < PERF;
      ctx.save(); if (inP) { ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 5 * UI; }
      ctx.fillStyle = inP ? 'rgba(255,211,77,0.22)' : 'rgba(255,211,77,0.10)'; ctx.fillRect(laneLeft, by, laneRight - laneLeft, Math.max(2, py2 - by)); ctx.restore();
    }
    if (!rd.smash && rd.phase === 'aim' && Math.abs(rd.move || 0) > 20 && rd.t < 1.3) {
      const up = rd.move < 0, ax = W - 70 * UI, ay = (by + S(0, bry + reach).y) / 2, al = clamp((1.3 - rd.t) * 2, 0, 1) * (0.8 + 0.2 * Math.sin(t * 18));
      ctx.save(); ctx.globalAlpha = al; ctx.translate(ax, ay); ctx.scale(1.4, 1.4); ctx.translate(-ax, -ay); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#111'; ctx.lineWidth = 5 * UI; ctx.beginPath();
      const d2 = up ? -1 : 1; ctx.moveTo(ax, ay + d2 * 30 * UI); ctx.lineTo(ax - 26 * UI, ay - d2 * 6 * UI); ctx.lineTo(ax - 10 * UI, ay - d2 * 6 * UI); ctx.lineTo(ax - 10 * UI, ay - d2 * 30 * UI); ctx.lineTo(ax + 10 * UI, ay - d2 * 30 * UI); ctx.lineTo(ax + 10 * UI, ay - d2 * 6 * UI); ctx.lineTo(ax + 26 * UI, ay - d2 * 6 * UI); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 40; ctx.lineWidth = 2 * UI;
    ctx.strokeStyle = rd.smash ? 'rgba(255,154,61,0.9)' : below ? 'rgba(125,255,138,0.9)' : gap < 0 ? 'rgba(255,77,77,0.9)' : 'rgba(255,154,61,0.9)';
    ctx.beginPath(); ctx.moveTo(laneLeft, by); ctx.lineTo(laneRight, by); ctx.stroke(); ctx.restore();
  }
  // Each clock follows its own cup in world space; decoys vanish on reveal.
  if (playing && rd && !rd.smash && st.alien && rd.phase === 'aim' && !rd.clockWaiting) {
    const left = toastInputLeft(), total = Math.max(0.1, rd.T + 0.5 - reachTime());
    const z = cam.z;
    for (let i = 0; i < 3; i++) {
      if (st.alien.revealed && i !== st.alien.cup) continue;
      const leader = st.alien.leaders[i], cup = cupGeom(leader);
      const { x, y } = S(alienRimX(i), alienRimY(i) + cup.bowlH * leader.P.sc / 2);
      const onBeat = Math.abs(left) < 0.05, col = onBeat ? '#ff6666' : toastBeatReady() ? '#ffd34d' : left < 0 ? '#a28b98' : '#ffffff';
      // Same shrinking-to-red-zero grammar as ordinary rounds, scaled to three cups.
      const rad = Math.max(6, 20 + 30 * left / total) * z;
      ctx.strokeStyle = '#ff6666'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(x, y, 20 * z, 0, 2 * PI); ctx.stroke();
      ctx.strokeStyle = 'rgba(28,20,38,.75)'; ctx.lineWidth = 8 * z; ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * PI); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 4 * z; ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * PI); ctx.stroke();
      const labelY = y - 59 * z;
      ctx.fillStyle = 'rgba(28,20,38,.9)'; rr(x - 34 * z, labelY - 16 * z, 68 * z, 32 * z, 8 * z); ctx.fill();
      text(onBeat ? '0s' : `${Math.max(0, left).toFixed(1)}s`, x, labelY, 24 * z, col, 'center', 900);
    }
  }
  if (playing && rd && rd.chain && !rd.smash) {
    const y = HB + 88 * UI, spacing = 62 * UI;
    for (let i = 0; i < rd.chain; i++) {
      const x = W / 2 + (i - (rd.chain - 1) / 2) * spacing;
      const done = i < rd.chainResults.length, current = i === rd.chainIndex;
      const col = done ? rd.chainResults[i] ? '#92dbb2' : '#ec786f' : current ? '#ffd34d' : '#6c5b4e';
      circ(x, y, (current ? 21 : 17) * UI, col, '#292018', 3);
      text(done ? rd.chainResults[i] ? '✓' : '×' : String(i + 1), x, y, 22 * UI, '#211a19', 'center', 900);
    }
  }
  // --- clink path + countdown ring around his cup
  if (playing && rd && (rd.phase === 'aim' || rd.phase === 'clink' || rd.phase === 'hold') && !rd.smash && !st.alien) {
    const tc = toastChar(), tRimY = toastRimY();
    let tcx = tc.P ? tc.P.rim.x : boss.P.rim.x;
    if (st.alien && st.alien.on && tc === boss) tcx = alienRimX(st.alien.cup);
    const bc = S(tcx, tRimY + 16 * SC);
    if (rd.phase === 'aim') {
      const left = toastInputLeft(), total = rd.chain && rd.chainIndex > 0 ? rd.chainBeat : Math.max(0.1, rd.T + 0.5 - reachTime());
      if (rd.T < 50) {
        // One moving circle crosses a red zero target. The shaded annulus is
        // the actual input tolerance on BOTH sides of zero, not a second beat.
        const scale = UI * cam.z, targetRad = 46 * scale;
        const radiusAt = seconds => Math.max(12 * scale, targetRad + 68 * scale * seconds / total);
        const rad = radiusAt(left), earlyRad = radiusAt(timingWindow()), lateRad = radiusAt(-timingWindow());
        const ready = toastBeatReady(), onBeat = Math.abs(left) < 0.05;
        const col = onBeat ? '#ff6666' : ready ? '#ffd34d' : left < 0 ? '#a28b98' : '#ffffff';
        ctx.strokeStyle = 'rgba(255,211,77,0.16)'; ctx.lineWidth = earlyRad - lateRad;
        ctx.beginPath(); ctx.arc(bc.x, bc.y, (earlyRad + lateRad) / 2, 0, 2 * PI); ctx.stroke();
        ctx.strokeStyle = '#ff6666'; ctx.lineWidth = 3 * UI;
        ctx.beginPath(); ctx.arc(bc.x, bc.y, targetRad, 0, 2 * PI); ctx.stroke();
        ctx.lineWidth = 9 * UI; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(bc.x, bc.y, rad, 0, 2 * PI); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 5 * UI; ctx.beginPath(); ctx.arc(bc.x, bc.y, rad, 0, 2 * PI); ctx.stroke();
        const label = rd.attacking ? '出手中' : onBeat ? '0s · 碰！' : `${Math.max(0, left).toFixed(1)}s`;
        const labelY = bc.y - Math.max(rad, earlyRad) - 36 * UI;
        ctx.fillStyle = 'rgba(30,18,28,0.9)'; rr(bc.x - 78 * UI, labelY - 22 * UI, 156 * UI, 44 * UI, 12 * UI); ctx.fill();
        text(label, bc.x, labelY, 27 * UI, col, 'center', 900, '#302028');
      }
    }
  }
  // --- smash phase: its own panel (timer + floor pressure), clearly not the clink ring
  if (playing && rd && rd.smash && !st.tut && (rd.phase === 'aim' || rd.phase === 'tie')) {
    const gR = gaugeRect(), pw = Math.min(560 * UI, W - 2 * (gR.x + gR.w + 14)), px = W / 2 - pw / 2, py = HB + 8 * UI, ph = 104 * UI;
    ctx.fillStyle = 'rgba(20,8,0,0.82)'; rr(px, py, pw, ph, 18 * UI); ctx.fill(); ctx.strokeStyle = '#ff9a3d'; ctx.lineWidth = 4; ctx.stroke();
    const live = rd.phase === 'aim', left = live ? clamp(roundLeft() / (rd.T + 0.5), 0, 1) : 1;
    text(TOUCH ? '摇杆向下推住 · 砸地板' : live ? '按住 O · 趴到底砸穿' : '到底了…准备砸', px + 20 * UI, py + 28 * UI, 23 * UI, '#ffd34d', 'left', 900);
    text(live ? `${Math.max(0, roundLeft()).toFixed(1)} 秒` : '', px + pw - 20 * UI, py + 28 * UI, 26 * UI, left < 0.3 && blink ? '#ff4d4d' : '#fff', 'right', 900);
    // timer bar (drains) and floor bar (cracks fill it)
    const bx = px + 20 * UI, bw = pw - 40 * UI;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(bx, py + 48 * UI, bw, 14 * UI, 7 * UI); ctx.fill();
    ctx.fillStyle = left < 0.3 ? '#ff4d4d' : '#ffffff'; rr(bx, py + 48 * UI, bw * left, 14 * UI, 7 * UI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(bx, py + 72 * UI, bw, 22 * UI, 11 * UI); ctx.fill();
    ctx.fillStyle = '#ff9a3d'; rr(bx, py + 72 * UI, Math.max(22 * UI, bw * clamp(st.pressure, 0, 1)), 22 * UI, 11 * UI); ctx.fill();
    ctx.strokeStyle = '#3a1500'; ctx.lineWidth = 3; for (let i = 1; i < 10; i++) if (i / 10 < st.pressure) { const cx2 = bx + bw * i / 10; ctx.beginPath(); ctx.moveTo(cx2 - 6, py + 74 * UI); ctx.lineTo(cx2 + 4, py + 83 * UI); ctx.lineTo(cx2 - 3, py + 92 * UI); ctx.stroke(); }
    text('地板', bx + 10 * UI, py + 83 * UI, 18 * UI, '#2a0e00', 'left', 900);
  }
  // --- smash meter at your cup
  if (playing && rd && rd.smash && st.pressure > 0.01) {
    const pc = S(player.P.cupB.x, floorY(st.L)), w = 180 * UI;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(pc.x - w / 2, pc.y + 26 * UI, w, 22 * UI, 11 * UI); ctx.fill();
    ctx.fillStyle = '#ff9a3d'; rr(pc.x - w / 2 + 3, pc.y + 29 * UI, (w - 6) * clamp(st.pressure, 0, 1), 16 * UI, 8 * UI); ctx.fill();
  }
  // --- a bump is coming: a ! over your head for ~0.8 s
  if (playing && st.bump && !st.bump.done && st.t > st.bump.at && player.P) {
    const h = S(player.P.head.x, player.P.head.y - 95 * SC), k = 0.75 + 0.25 * Math.sin(t * 20);
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#111'; ctx.lineWidth = 5 * UI;
    ctx.beginPath(); ctx.arc(h.x, h.y, 30 * UI, 0, 2 * PI); ctx.fill(); ctx.stroke(); text('!', h.x, h.y + 2 * UI, 46 * UI, '#111', 'center', 900);
    text('有人挤过来！', h.x + 40 * UI, h.y, 26 * UI, '#ffd34d', 'left', 900, 'rgba(0,0,0,0.85)'); ctx.restore();
  }
  // --- judgment at contact: one big word + both rims highlighted
  if (st.judge && st.judge.compact) {
    const j = st.judge;
    if (j.t < 0.4) text(j.word, W / 2, HB + 155 * UI, 28 * UI, j.col, 'center', 900, '#201820');
  }
  if (st.judge && !st.judge.compact) {
    const j = st.judge, a = clamp(Math.min(j.t * 10, (1.7 - j.t) * 3), 0, 1), pp = S(j.px, j.py), bp = S(j.bx, j.by);
    ctx.save(); ctx.globalAlpha = a;
    const mark = (p, col, zh, side) => { ctx.strokeStyle = '#111'; ctx.lineWidth = 10 * UI; line({ x: p.x - 46 * UI, y: p.y }, { x: p.x + 46 * UI, y: p.y }); ctx.strokeStyle = col; ctx.lineWidth = 6 * UI; line({ x: p.x - 46 * UI, y: p.y }, { x: p.x + 46 * UI, y: p.y }); text(zh, p.x + side * 54 * UI, p.y, 22 * UI, col, side > 0 ? 'left' : 'right', 900, 'rgba(0,0,0,0.85)'); };
    const youLow = j.py >= j.by;
    mark(bp, '#ffd34d', '领导', 1); mark(pp, youLow ? '#7dff8a' : '#ff4d4d', '你', -1);
    const sc3 = 1 + Math.max(0, 0.18 - j.t) * 1.2;
    ctx.translate(W / 2, HB + 156 * UI); ctx.scale(sc3 * UI, sc3 * UI);
    text(j.word, 0, 0, j.word.length > 5 ? 76 : 92, j.col, 'center', 900, 'rgba(0,0,0,0.9)');
    if (j.bonus) text(j.bonus, 0, 67, 24, '#ffe6a4', 'center', 900, '#211521');
    if (j.sub) text((st.tut ? '妈妈：' : '领导：') + j.sub, 0, j.bonus ? 108 : 82, 26, '#ffffff', 'center', 900, 'rgba(0,0,0,0.9)');
    ctx.restore();
    if (j.t < 0.08) { ctx.fillStyle = `rgba(255,255,255,${0.1 * (1 - j.t / 0.08)})`; ctx.fillRect(0, 0, W, H); }
  }
  // --- one speech bubble, short, never over the HUD or the side glass
  for (const b of (TOUCH && !st.tut ? bubbles.filter(b => b.alienIntro || b.chapterChat) : bubbles)) {
    const c = b.c; if (!c.P || bigText || st.punch || (b.chapterChat && st.judge && !st.judge.compact && st.judge.t < 0.5)) continue;
    const p = S(c.P.head.x, c.P.head.y);
    const a = clamp(Math.min(1, (b.dur - b.t) * 4, b.t * 8), 0, 1);
    ctx.globalAlpha = a;
    const fsz = 30 * UI; ctx.font = `900 ${fsz}px ${FONT}`; const w = ctx.measureText(b.zh).width + 36, h = fsz + 30;
    const gx = gaugeRect().x + gaugeRect().w + 12;
    let bx = clamp(p.x - w / 2, gx, W - w - 10), by = clamp(p.y - 150 * cam.z - h, HB + 12, H - 260);
    ctx.fillStyle = '#fff'; rr(bx, by, w, h, 18); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke();
    const tx = clamp(p.x, bx + 20, bx + w - 20);
    ctx.beginPath(); ctx.moveTo(tx - 11, by + h - 2); ctx.lineTo(tx + 11, by + h - 2); ctx.lineTo(tx, by + h + 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(tx - 9, by + h - 7, 18, 6);
    text(b.zh, bx + w / 2, by + h / 2 + 1, fsz, '#111', 'center', 900);
    ctx.globalAlpha = 1;
  }

  // --- HUD: layer + depth (small, left), score (big, centre), strikes (right)
  const shownL = (st.state === 'fall' && player.y > floorY(st.L) + SLAB + 100) ? st.L + 1 : st.L;
  const lay = st.tut ? { name: '家 · 妈妈教你酒桌规矩' } : layerDef(shownL), dm = st.depth;
  const hk = PORT ? 1.45 : LAY === 'land' ? 1.25 : 1, hx = PORT ? 0 : Math.round((W - 1080 * hk) / 2);
  ctx.save(); ctx.translate(Math.max(0, hx), 0); ctx.scale(hk, hk);
  if (st.state === 'over') ctx.globalAlpha = 0; // game-over screen has its own score
  const hudW = PORT ? 1080 / hk : 1080;
  text(st.tut ? lay.name : layerLabel(shownL), 22, 34, 24, '#fff', 'left', 900, 'rgba(0,0,0,0.7)');
  if (!st.tut) text((dm < 0.05 ? '' : '−') + fmtDepth(dm), 22, 66, 22, '#ffd34d', 'left', 900, 'rgba(0,0,0,0.7)');
  if (!st.tut && st.state !== 'title') {
    text(Math.round(st.score).toLocaleString('en-US'), hudW / 2, 52, 64, '#fff', 'center', 900, 'rgba(0,0,0,0.75)');
    if (st.gain && st.gain.t < 1.2) { ctx.globalAlpha = clamp((1.2 - st.gain.t) * 3, 0, 1); text(`+${st.gain.n.toLocaleString('en-US')}`, hudW / 2, 102 - st.gain.t * 10, 26, '#7dff8a', 'center', 900, 'rgba(0,0,0,0.75)'); ctx.globalAlpha = 1; }

  }
  if (st.tut) text(TOUCH ? '跳过 ›' : 'S 跳过 ›', hudW - 22, 34, 24, '#fff', 'right', 900, 'rgba(0,0,0,0.7)');
  ctx.restore();
  // --- the side glass (main beer feedback)
  if (st.state === 'play' || st.state === 'title' || st.state === 'standup' || st.state === 'fall' || st.state === 'over') drawGauge(t);
  if (!(rd && rd.smash)) drawArcadeUI();

  // --- one message at a time: big banner > judgment > contextual hint (with the key to press)
  let hint = null;
  if (playing && !st.judge && !bigText) {
    const p = player;
    if (st.tut && st.tut.msg) hint = [st.tut.msg, st.tut.keys];
    else if (Math.abs(p.tilt + p.w) > spillLim() && !noSpill()) { const f = p.tilt + p.w > 0, wave = Math.abs(p.w) > Math.abs(p.tilt);
      hint = [wave ? (f ? '酒往前涌！往后扶' : '酒往后涌！往前扶') : (f ? '杯子前倾了！' : '杯子后仰了！'), [f ? 'Q' : 'W']]; }
    else if (rd && rd.smash && rd.phase === 'aim' && !st.tut) hint = [st.pressure > 0.05 ? '继续按住 O 砸！' : '按住 O 趴到底，砸地板', ['O']];
    else if (rd && rd.phase === 'gap' && st.alien && st.alien.on) hint = ['空档：对准下一杯', []];
    else if (rd && rd.phase === 'aim' && !st.tut && !(st.alien && !st.alien.revealed) && p.P.rim.y < toastRimY() && roundLeft() < rd.T) hint = ['比领导高！', ['O']];
    else if (rd && rd.phase === 'aim' && !rd.smash && p.P.rim.y - toastRimY() > winSpan()) hint = ['太低了！', ['P']];

  }
  st.hintKeys = hint ? hint[1] : [];
  if (TOUCH && hint && !st.tut) hint = null;
  if (TOUCH && hint) hint = [mobileWords(hint[0]), hint[1].map(k => ({ Q: '←', W: '→', O: '↓', P: '↑', Space: '点' })[k] || k)];
  if (hint) {
    const wy = PORT ? floorSY() + 44 : LAY === 'land' ? floorSY() + 28 : 839, fs2 = (st.tut ? 32 : 25) * UI;
    ctx.font = `900 ${fs2}px ${FONT}`; const tw = ctx.measureText(hint[0]).width, cw = hint[1].length * (fs2 * 1.25 + 8);
    let x0 = W / 2 - (tw + cw + (cw ? 12 : 0)) / 2;
    for (const kk of hint[1]) { const sz = fs2 * 1.25; ctx.fillStyle = blink ? '#ffd34d' : '#fff'; rr(x0, wy - sz / 2, sz, sz, 10); ctx.fill(); text(kk, x0 + sz / 2, wy + 2, fs2 * 0.9, '#111', 'center', 900); x0 += sz + 8; }
    if (cw) x0 += 12;
    text(hint[0], x0, wy, fs2, st.tut ? '#ffffff' : '#ffd34d', 'left', 900, 'rgba(0,0,0,0.8)');
  }
  // --- keys (touch buttons on phones); a needed key glows
  // opaque band below the floor so the next layer never shows through behind the controls
  if (!TOUCH && st.state !== 'fall') { const fy = floorSY() + SLAB * cam.z * 0.9; ctx.fillStyle = '#141419'; ctx.fillRect(0, fy, W, H - fy); }
  if (TOUCH) drawStick();
  else BTN.forEach((b, i) => {
    const r2 = btnRect(i), on = keys[b[0]], want = st.hintKeys.includes(b[0]) && st.state === 'play', gcol = GROUPS[i < 2 ? 0 : 1].col;
    // a key with depth: it sits up on a dark base, sinks in while held, and pings once on the press
    if (on && !btnPrev[b[0]]) btnPing[b[0]] = performance.now(); btnPrev[b[0]] = on;
    const dep = Math.max(4, r2.h * 0.035);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(r2.x, r2.y + dep, r2.w, r2.h, 18); ctx.fill();
    ctx.save(); ctx.translate(0, on ? dep : 0);
    if (want) { ctx.save(); ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 30 + 20 * Math.sin(t * 10); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 8; rr(r2.x - 4, r2.y - 4, r2.w + 8, r2.h + 8, 22); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = on ? gcol : 'rgba(22,22,30,0.95)'; rr(r2.x, r2.y, r2.w, r2.h, 18); ctx.fill(); ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3; ctx.stroke();
    const ink = on ? '#111' : '#fff';
    if (r2.h > 150) {
      const cx = r2.x + r2.w / 2, kk = r2.h / 254;
      ctx.fillStyle = on ? '#111' : '#fff'; rr(r2.x + 14 * kk, r2.y + 14 * kk, 64 * kk, 64 * kk, 14 * kk); ctx.fill();
      text(b[0], r2.x + 46 * kk, r2.y + 48 * kk, 44 * kk, on ? gcol : '#111', 'center', 900);
      btnIcon(b[0], cx + 22 * kk, r2.y + 92 * kk, 96 * kk, ink);
      text(b[1], cx, r2.y + 200 * kk, 50 * kk, ink, 'center', 900);
    } else {
      ctx.fillStyle = on ? '#111' : '#fff'; rr(r2.x + 12, r2.y + 16, 58, 58, 12); ctx.fill();
      text(b[0], r2.x + 41, r2.y + 47, 38, on ? gcol : '#111', 'center', 900);
      btnIcon(b[0], r2.x + 104, r2.y + 46, 52, ink);
      text(b[1], r2.x + 140, r2.y + 48, 30, ink, 'left', 900);
    }
    const pa = (performance.now() - (btnPing[b[0]] || -1e9)) / 220;
    if (pa < 1) { ctx.globalAlpha = 1 - pa; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * (1 - pa); rr(r2.x - 10 * pa, r2.y - 10 * pa, r2.w + 20 * pa, r2.h + 20 * pa, 18 + 6 * pa); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
  });
  drawToastButton();
  // --- big banner (layer arrivals, floor breaks): Chinese only
  if (bigText) {
    const bt = bigText, a = clamp(Math.min(bt.t * 6, (bt.dur - bt.t) * 3), 0, 1), sc2 = 1 + Math.max(0, 0.3 - bt.t) * 1.5;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, PORT ? HB + 150 : 300); ctx.scale(sc2 * UI, sc2 * UI);
    if (bt.arrival) { ctx.font = `900 76px ${FONT}`; const bw2 = ctx.measureText(bt.zh).width + 80; ctx.fillStyle = 'rgba(12,12,16,0.82)'; rr(-bw2 / 2, -62, bw2, 124, 28); ctx.fill(); ctx.strokeStyle = bt.col; ctx.lineWidth = 4; ctx.stroke(); } // a plate, so wall signs never show through
    text(bt.zh, 0, 0, 76, bt.col, 'center', 900, 'rgba(0,0,0,0.85)');
    ctx.restore();
  }
  // --- tutorial fade to the office
  if (st.tut && st.tut.fade) { const a = clamp(st.tut.fade / 0.8, 0, 1); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); if (a > 0.6) text('第二天 · 单位饭局', W / 2, H / 2, 56 * UI, '#fff', 'center', 900); }
  // game over
  if (st.state === 'over' && st.over) {
    const o = st.over, a = clamp((st.stT - 1.0) * 2.5, 0, 1);
    if (a > 0) {
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,8,12,0.86)'; ctx.fillRect(0, 0, W, H);
      ctx.save(); overlayBox();
      if (TOUCH && LAY === 'land') drawMobileResult(o);
      else {
      const [rz, remark] = rankFor(o.score);
      const [tz] = OVER_TEXT[o.reason] || OVER_TEXT.beer;
      text(tz, 540, 120, 48, '#ff796b', 'center', 900);
      const mode = DIFFICULTIES.find(d => d.id === o.difficulty) || difficulty();
      ctx.font = `900 66px ${FONT}`;
      const rankWidth = Math.max(460, ctx.measureText(rz).width + 80);
      ctx.fillStyle = '#ffd34d'; rr(540 - rankWidth / 2, 190, rankWidth, 116, 24); ctx.fill();
      text(rz, 540, 248, 66, '#7a1019', 'center', 900);
      text(remark, 540, 350, 30, '#e5d2c4', 'center', 700);
      text(Math.round(o.score).toLocaleString('en-US'), 540, 450, 112, '#ffd34d', 'center', 900);
      text(`${o.custom ? '自定义 · ' : ''}${mode.level} · ${mode.name}`, 540, 540, 30, '#e5d2c4', 'center', 800);
      text(`完美 ${st.perfects} 次    失误 ${st.strikes} 次    最高 ${st.bestCombo} 连敬`, 540, 594, 30, '#fff', 'center', 800);
      const ledger = o.wine || wineLedger();
      ctx.fillStyle = '#241e28'; rr(130, 638, 820, 132, 22); ctx.fill();
      text(`洒酒 −${winePercent(ledger.spill)}%`, 170, 678, 32, '#ffc36f', 'left', 900);
      text(`罚酒 −${winePercent(ledger.penalty)}%`, 540, 678, 32, '#ff796b', 'center', 900);
      text(`添酒 +${winePercent(ledger.refill)}%`, 910, 678, 32, '#91e0a4', 'right', 900);
      const capacity = ledger.capacity > 0.0005 ? ` · 换小杯 −${winePercent(ledger.capacity)}%` : '';
      text(`本局累计 · 按初始杯容量${capacity}`, 540, 738, 23, '#bfaeb9', 'center', 700);
      text(`${o.cleared ? '十二关已通关 · ' : ''}第 ${o.layer + 1} 层 · ${o.depth < 0.05 ? '0 米' : '−' + fmtDepth(o.depth)}`, 540, 815, 28, '#e5d2c4', 'center', 800);
      text(`最高分 ${Math.round(st.hiscore).toLocaleString('en-US')}${st.bestDifficulty ? ' · ' + DIFFICULTIES.find(d => d.id === st.bestDifficulty).level : ''}${st.newRecord ? ' · 新纪录！' : ''}`, 540, 867, 28, '#7fd0ff', 'center', 900);
      text(TOUCH ? '点一下重来' : '按 R 重来', 540, 930, 34, '#fff', 'center', 900);
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  // pause
  if (st.paused) {
    ctx.fillStyle = 'rgba(8,8,12,0.82)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); overlayBox();
    text('暂停', 540, 170, 72, '#ffd34d', 'center', 900, '#7a1019');
    drawMute(); drawDebugEntry();
    text(TOUCH ? '点空白处继续' : 'Esc / 空格 继续', 540, 860, 28, '#fff', 'center', 900);
    ctx.restore();
  }
  drawGameNavigation();
  if (st.state === 'title') {
    ctx.fillStyle = '#21141e'; ctx.fillRect(0, 0, W, H);
    if (mobileTitle()) drawMobileTitle(); else drawDesktopTitle();
  }
}

// ---------------------------------------------------------------- loop
const DT = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  if (elapsed > CFG.stallPause && runActive() && !st.paused && (!BOT || BOT === 'none')) {
    st.rearmAfterPause = true; setPaused(true); acc = 0;
  }
  syncMusic();
  acc += Math.min(0.1, elapsed); last = now;
  while (acc >= DT) { step(DT); acc -= DT; }
  render();
  requestAnimationFrame(frame);
}
if (wantTutorial()) startTutorial();
if (st.state === 'play' && !st.tut) newRound(true);
if (params.has('frame')) { const n = clamp(Number(params.get('frame')) || 0, 0, 36000); for (let i = 0; i < n; i++) step(DT); render(); }
else if (CAPTURE) { render(); }
else requestAnimationFrame(frame);

// test / capture hooks
window.__toast = {
  advance(n, noRender) { for (let i = 0; i < n; i++) step(DT); if (!noRender) render(); return this.state(); },
  ctl(m) { if (m && m !== CTL) toggleCtl(); return CTL; },
  rimCurve() { const c = mkChar(P_SPEC, 1), out = []; for (let i = 0; i <= 20; i++) { poseFromS(c, h2s(i / 20)); c.tilt = 0; c.x = 300; c.y = 0; settle(c, floorY(st.L)); out.push(Math.round(floorY(st.L) - c.P.rim.y)); } return { rim: out, lim: Math.round(floorY(st.L) - floorLimit()), stand: Math.round(floorY(st.L) - st.stand) }; },
  state() { const ld = layerDef(st.L); return { rank: rankFor(st.score), difficulty: { id: difficultyId, level: difficulty().level, name: difficulty().name }, storyRooms: STORY_N, chain: st.round && st.round.chain ? { index: st.round.chainIndex, total: st.round.chain, hits: st.round.chainHits } : null, keys: { ...keys }, reach: +(player.reach || 0).toFixed(3), combo: st.combo, hype: st.hype, manualToasts: st.manualToasts, lay: LAY, W, H, state: st.state, layer: st.L, ch: ld.ch, mech: ld.mech, depth: +st.depth.toFixed(1), score: Math.round(st.score), beer: +player.wine.toFixed(2), strikes: st.strikes, toasts: st.toasts, perfects: st.perfects, round: st.round ? st.round.n : 0, phase: st.round ? st.round.phase : null, left: st.round && st.round.phase === 'aim' ? +roundLeft().toFixed(2) : null, smash: st.round ? st.round.smash : false, pressure: +st.pressure.toFixed(2), breaks: st.breaks, flipped: st.flipped, gameT: +st.gameT.toFixed(2), why: st.why || {}, over: st.over, tilt: +player.tilt.toFixed(2), startL: START_LAYER, alien: st.alien && st.alien.on ? { revealed: st.alien.revealed, cup: st.alien.cup|0, n: st.alien.n|3, step: +st.alien.step.toFixed(1), gap: +st.alien.gap.toFixed(2), phase: st.round ? st.round.phase : null } : null, qw: st.qw ? { presses: st.qw.n, sw: st.qw.sw || 0, held: +st.qw.held.toFixed(1), t: +st.qw.t.toFixed(1), rms: +Math.sqrt((st.qw.m2 || 0) / Math.max(1e-6, st.qw.mt || 0)).toFixed(3) } : null }; },
  restart() { restart(); },
  tut() { return st.tut ? { step: st.tut.step, sub: st.tut.sub, t: +st.tut.t.toFixed(1) } : null; },
  dbg() { const r = st.round; return { reach: player.reach || 0, reachV: player.reachV || 0, beatReady: toastBeatReady(), inputLeft: toastInputLeft(), attacking: !!(r && r.attacking), timingWindow: timingWindow(), cupRate: player.cupRate || 0, vh: player.vh, margin: r && r.margin, result: r && r.result, smash: r && r.smash, target: r && Math.round(floorY(st.L) - r.target), windowSpan: Math.round(winSpan()), lim: +spillLim().toFixed(3), cap: +cupGeom(player).cap.toFixed(2), wineCapacity: wineCapacity(), rimH: player.P ? Math.round(floorY(st.L) - player.P.rim.y) : 0, bossH: boss.P ? Math.round(floorY(st.L) - boss.P.rim.y) : 0, h: +(player.h || 0).toFixed(2), wine: +player.wine.toFixed(2), tilt: +player.tilt.toFixed(2), ctl: CTL, difficulty: difficultyId, pressure: +st.pressure.toFixed(2) , w: player.w, wv: player.wv, bump: !!(st.bump && !st.bump.done && st.t > st.bump.at), paused: st.paused, judge: !!st.judge, jword: st.judge && st.judge.word, jt: st.judge && st.judge.t, fx: fx.length, loss: st.loss || 0, lossT: st.lossT || 0, move: r && r.move, rt: r && +r.t.toFixed(2), sw: +(player.sw || 0).toFixed(3), vis: player.vis ? { l: +player.vis.lean.toFixed(2), b: +player.vis.bend.toFixed(2), k: +player.vis.knee.toFixed(2), a: +player.vis.arm.toFixed(2), h: +player.vis.head.toFixed(2) } : null }; },
  keys,
};
})();
