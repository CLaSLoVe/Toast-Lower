'use strict';
// Pure accounting helpers. Percentages always use one standard full glass.
(() => {
const RANKS = [
  [0, '成年香蕉', '手是长了，但没完全长'],
  [1, '卧龙凤雏', '左手卧龙，右手凤雏'],
  [1000, '小孩那桌', '这桌暂时还坐不了'],
  [3000, '夹菜我转桌', '主打一个不懂事'],
  [6000, '乌鸦哥', '敬不好就掀桌'],
  [12000, '端水大师', '杯子端稳，谁也不得罪'],
  [18000, '懂事长', '敬酒敬出了管理岗'],
  [45000, '敬酒悍匪', '开始主动进攻'],
  [65000, '国家一级陪酒员', '仿佛持证上岗'],
  [85000, '先天敬酒圣体', '天生就是吃这桌饭的'],
  [92000, '铁血山东 👍', '人情世故拉满'],
  [98000, 'DeepDrink', '敬酒大模型'],
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
function toastPoints(config, { perfect, rounds, notes }) {
  return config.performanceScore / 12 / rounds / notes * (perfect ? 1 : config.ordinaryScoreRatio / 100);
}
function overflowPoints(config, excess, earned) {
  return Math.max(0, Math.min(config.overflowScore - earned, excess * 100 * config.overflowRate));
}
function remainingPoints(config, wine, capacity) {
  return config.remainingScore * Math.max(0, Math.min(1, wine / capacity));
}
window.ToastRules = { rankFor, wineAfter, chainPenaltyRatio, claim, toastPoints, overflowPoints, remainingPoints };
})();
