'use strict';
// Stage definitions and dialogue; no runtime state or random sampling.
window.ToastChapters = { create(SC) {
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
  { name: '考古现场', en: 'Dig Site', depth: 200, ch: 2, room: 0, mech: 'chain', chain: 2, cupName: '高脚杯', join: [GUEST('#5a4a2a', { lamp: true, helmet: '#c9a227' }), GUEST('#efe6cf', { skeleton: true })] },
  { name: '古墓主墓室', en: 'Main Tomb Chamber', depth: 450, ch: 2, room: 1, mech: 'chain', chain: 3, cupName: '白酒杯', join: [GUEST('#5a4a2a', { lamp: true, helmet: '#c9a227' }), GUEST('#2a3a6a', { jiangshi: true, skin: '#a9c79a' })] },
  { name: '兵马俑坑', en: 'Terracotta Pit', depth: 800, ch: 2, room: 2, mech: 'chain', chain: 4, cupName: '袖珍杯', join: [GUEST('#a85a3a', { terracotta: true }), GUEST('#a85a3a', { terracotta: true })] },
  // Ch4 地心外交 — human boss and two alien delegates
  { name: '51区外星基地', en: 'Area 51 Alien Base', depth: 9000, ch: 3, room: 0, mech: 'alien', join: [GUEST('#9aa5b5', { alien: true, skin: '#7dd87a' }), GUEST('#9aa5b5', { alien: true, skin: '#7dd87a' })] },
  { name: '岩浆外星观测站', en: 'Magma Alien Observatory', depth: 35000, ch: 3, room: 1, mech: 'alien', join: [GUEST('#2a1410', { lava: true }), GUEST('#9aa5b5', { alien: true, skin: '#7dd87a' })] },
  { name: '地心外星总部', en: "Core Alien HQ", depth: 6371000, ch: 3, room: 2, mech: 'alien', join: [GUEST('#ffb13b', { lava: true }), GUEST('#9aa5b5', { alien: true, skin: '#9d7dff' })] },
];

const BOSS_LINES = [['不急不急～', 'No rush~'], ['小伙子，杯子有点高啊', 'Your cup is a bit high'], ['年轻人要懂规矩', 'Know the rules, kid'], ['来来来，再低点', 'Come on, lower'], ['哎～差一点', 'Ah~ almost'], ['我先干为敬…才怪', 'Bottoms up… not']];
const PLAYER_LINES = [['领导我敬您！', 'A toast to you, boss!'], ['我干了您随意！', 'I drink, you sip!'], ['再低一点…', 'A bit lower…']];
const JOIN_LINES = [['带我一个！', 'Count me in!'], ['也敬领导！', 'Toast the boss!'], ['我比他低！', "I'm lower!"]];


const TOMB_CHAT = ['别拘束，跟自己家一样。', '这几位都是老前辈。', '老员工都在这儿了。', '再喝五百年！'];
const ALIEN_CHAT = ['我是你的碰杯人。', '主敬你一杯。', '执杯人，举杯。', '给文明以酒精。', '我已脱水，急需补液。', '主不在乎。', '不要回答。', '你们这儿敬酒不报销？', '我有三个肝，你随意。'];

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

const POLITE_LINES = [['你的腰，比我前途还灵活'], ['别卷了，我腰有工伤'], ['这份敬意，承重墙收到了'], ['嘴上说随意，膝盖很诚实']];
const RUDE_LINES = [['你敬的是天花板？'], ['杯子挺高，情商挺低'], ['这杯里装的是辞职信？'], ['你小子想坐我这个位置？']];
const ROUND_EVENTS = {
  feint: { title: '假客气', hint: '他说随意，杯子还会再降！', col: '#b8a0ff' },
  rush: { title: '领导赶下一场', hint: '这一杯节奏更快 · 听拍子', col: '#ffad72' },
  steady: { title: '全桌都看着你', hint: '卡准那一拍 · 碰杯时也要扶稳', col: '#79dfcd' },
};

return { P_SPEC, B_SPEC, TOMB_BOSS, ALIEN_HOST, ALIEN_DELEGATES, GUEST, CHAPTERS, STORY_N, BASE_LAYERS, BOSS_LINES, PLAYER_LINES, JOIN_LINES, TOMB_CHAT, ALIEN_CHAT, STORY_SMASH_LINES, POLITE_LINES, RUDE_LINES, ROUND_EVENTS };
} };
