'use strict';
// Pure accounting helpers. Percentages always use one standard full glass.
(() => {
const RANKS = [
  [0, '成年香蕉', '手是长了，但没完全长'],
  [1, '卧龙凤雏', '左手卧龙，右手凤雏'],
  [2500, '小孩那桌', '这桌暂时还坐不了'],
  [6500, '夹菜我转桌', '主打一个不懂事'],
  [14000, '乌鸦哥', '敬不好就掀桌'],
  [30000, '端水大师', '杯子端稳，谁也不得罪'],
  [70000, '懂事长', '敬酒敬出了管理岗'],
  [140000, '敬酒悍匪', '开始主动进攻'],
  [230000, '国家一级陪酒员', '仿佛持证上岗'],
  [290000, '先天敬酒圣体', '天生就是吃这桌饭的'],
  [340000, '铁血山东 👍', '人情世故拉满'],
  [380000, 'DeepDrink', '敬酒大模型'],
];
function rankFor(score) {
  let rank = RANKS[0];
  for (const entry of RANKS) if (score >= entry[0]) rank = entry;
  return rank.slice(1);
}

function wineAfter(kind, before, amount, capacity) {
  if (!Number.isFinite(amount) || amount <= 0) return before;
  const after = kind === 'refill' ? Math.max(before, Math.min(capacity, before + amount)) : Math.max(0, before - amount);
  // Only normalize floating-point residue, not a visible amount of wine.
  return after < 1e-12 ? 0 : after;
}
function chainPenaltyRatio(config, count, misses) {
  return !count || misses >= count ? 1 : [0, config.chainPenaltyFirst, config.chainPenaltySecond, config.chainPenaltyThird][misses] / 100;
}
function claim(plan, layer, round, result) {
  if (!round || round.smash || !plan || plan.layer !== layer) return false;
  const slot = round.progress * plan.notes + (round.chainIndex || 0);
  if (!Number.isInteger(slot) || slot < 0 || slot >= plan.claimed.length || plan.claimed[slot] !== null) return false;
  plan.claimed[slot] = result;
  return true;
}
function toastPoints(config, { perfect, close, quick, wine, combo, layer, notes }) {
  const quality = perfect ? config.perfectScore : close * close * config.heightScore;
  return (config.toastScore + quality + wine * config.wineScore + quick + config.comboScore * Math.min(combo, config.comboCap)) * (layer + 1) / notes;
}
window.ToastRules = { rankFor, wineAfter, chainPenaltyRatio, claim, toastPoints };
})();
