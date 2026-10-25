'use strict';
// 游戏调参入口。每行依次是：键名、显示名、默认值、最小值、最大值、步长、单位。
// 百分比直接写 20 表示 20%（按初始大杯容量计算），时间单位为秒。
// 游戏内「···」使用同一张表。修改本文件后刷新，旧的本机覆盖自动失效。
(() => {
  const fields = [
    ['stickDeadzone', '手机摇杆中心死区', 0.12, 0.04, 0.3, 0.01, '比例'],
    ['stickCurve', '手机摇杆微调曲线', 1.4, 1, 2, 0.1, '指数'],
    ['chainReach', '连敬伸手耗时', 0.18, 0.10, 0.25, 0.01, '秒'],
    ['chainWindow', '连敬拍点容错', 0.32, 0.15, 0.35, 0.01, '拍'],
    ['alienRounds', '外星每关敬酒轮数', 3, 2, 5, 1, '轮'],
    ['alienStep1', '外星第一关杯距', 36, 30, 70, 2, '像素'],
    ['alienStep2', '外星第二关杯距', 48, 30, 80, 2, '像素'],
    ['alienStep3', '外星第三关杯距', 60, 30, 90, 2, '像素'],
    ['musicBpm', '音乐与敬酒速度', 126, 90, 160, 1, 'BPM'],
    ['spillSoundVolume', '漏酒音效音量', 30, 0, 100, 5, '%'],
    ['spillSoundInterval', '漏酒音效间隔', 0.32, 0.15, 1, 0.01, '秒'],
    ['musicVolume', '背景音乐音量', 28, 0, 100, 5, '%'],
    ['roundWait', '普通回合总倒计时', 2.0, 1.2, 6, 0.1, '秒'],
    ['missPenalty', '敬酒失败扣酒', 20, 0, 100, 1, '%'],
    ['roundRefill', '每回合补酒', 3, 0, 30, 1, '%'],
    ['spillMultiplier', '漏酒速度倍率', 0.85, 0, 5, 0.05, '倍'],
    ['spillMax', '每秒漏酒上限', 11, 0, 50, 1, '%'],
    ['minCapacity', '最小酒杯容量', 60, 20, 100, 5, '%'],
    ['perfectTime', '完美节拍范围', 0.12, 0.03, 0.3, 0.01, '秒'],
    ['perfectScore', '完美基础加分', 360, 0, 1000, 20, '分'],
    ['perfectRate', '完美杯子最大转速', 0.9, 0.2, 2, 0.1, '弧度/秒'],
    ['repeatSmashScale', '重复砸楼蓄力倍率', 0.45, 0.2, 1, 0.05, '倍'],
    ['repeatSmashPause', '重复砸楼准备时间', 0.4, 0.1, 1.8, 0.1, '秒'],
    ['repeatStandup', '重复落地起身时间', 0.35, 0.15, 0.7, 0.05, '秒'],
    ['reachTime', '伸手耗时', 0.42, 0.2, 0.8, 0.02, '秒'],
    ['minWait', '后期最短倒计时', 1.5, 1, 6, 0.1, '秒'],
    ['depthSpeedup', '后期倒计时缩短', 0.4, 0, 1, 0.1, '秒'],
    ['retargetBonus', '换高度额外时间上限', 0.25, 0, 1, 0.05, '秒'],
    ['rushScale', '赶场回合时间倍率', 0.85, 0.5, 1, 0.05, '倍'],
    ['practiceBonus', '练习手感额外容错', 0.07, 0, 0.3, 0.01, '秒'],
    ['perfectRefill', '完美碰杯额外回酒', 0, 0, 30, 0.5, '%'],
    ['hypeRefill', '气势满格回酒', 0, 0, 50, 1, '%'],
    ['floorRefill', '过层回酒', 10, 0, 100, 1, '%'],
    ['clinkSpill', '碰杯震动扣酒', 1.5, 0, 10, 0.5, '%'],
    ['spillGrace', '漏酒缓冲时间', 0.3, 0, 1, 0.02, '秒'],
    ['spillRamp', '漏酒加速时间', 0.6, 0.1, 2, 0.02, '秒'],
    ['easyTime', '简单 · 碰杯容错', 0.7, 0.1, 1, 0.05, '秒'],
    ['easyTaper', '简单 · 后期收紧', 0.05, 0, 0.3, 0.01, '秒'],
    ['easySetup', '简单 · 额外准备时间', 0.5, -0.5, 2, 0.1, '秒'],
    ['easyBodyCupCoupling', '简单 · 身体带动杯子', 0.5, 0, 1.2, 0.05, '倍'],
    ['easyHand', '简单 · 扶杯干扰', 0.5, 0.1, 2, 0.1, '倍'],
    ['normalTime', '中等 · 碰杯容错', 0.52, 0.1, 1, 0.05, '秒'],
    ['normalTaper', '中等 · 后期收紧', 0.06, 0, 0.3, 0.01, '秒'],
    ['normalSetup', '中等 · 额外准备时间', 0.15, -0.5, 2, 0.05, '秒'],
    ['normalBodyCupCoupling', '中等 · 身体带动杯子', 0.55, 0, 1.2, 0.05, '倍'],
    ['normalHand', '中等 · 扶杯干扰', 0.8, 0.1, 2, 0.1, '倍'],
    ['hardTime', '高难 · 碰杯容错', 0.34, 0.1, 1, 0.02, '秒'],
    ['hardTaper', '高难 · 后期收紧', 0.04, 0, 0.3, 0.01, '秒'],
    ['hardSetup', '高难 · 额外准备时间', 0, -0.5, 2, 0.1, '秒'],
    ['hardBodyCupCoupling', '高难 · 身体带动杯子', 0.65, 0, 1.2, 0.05, '倍'],
    ['hardHand', '高难 · 扶杯干扰', 1.05, 0.1, 2, 0.05, '倍'],
    ['cupTiltLimit', '杯子最大倾角', 45, 10, 45, 5, '°'],
    ['bodyBrakeCoupling', '身体刹车带动杯子', 0.025, 0, 0.1, 0.005, '倍'],
    ['bodyAccel', '身体加速度', 3.9, 1, 10, 0.1, ''],
    ['bodyBrake', '身体阻尼', 6.1, 1, 15, 0.1, ''],
    ['cupAccel', '扶杯加速度', 6.2, 1, 15, 0.1, ''],
    ['cupBrake', '扶杯阻尼', 6, 1, 15, 0.1, ''],
    ['releaseCup', '松手杯子制动', 0.74, 0.1, 1, 0.02, ''],
    ['releaseBody', '松手身体制动', 0.78, 0.1, 1, 0.02, '']
  ];
  const defaults = Object.fromEntries(fields.map(([key, , value]) => [key, value]));
  const signature = JSON.stringify(defaults), key = 'toastLower.parameters.v1';
  function validate(input) {
    const out = { ...defaults };
    for (const [name, , , min, max] of fields) {
      const value = input && input[name];
      if (typeof value === 'number' && Number.isFinite(value)) out[name] = Math.min(max, Math.max(min, value));
    }
    // Preserve a meaningful positive timing window and enough time for a reach.
    out.minWait = Math.min(out.minWait, out.roundWait);
    for (const id of ['easy', 'normal', 'hard']) out[id + 'Taper'] = Math.min(out[id + 'Taper'], out[id + 'Time'] - 0.05);
    return out;
  }
  function load(storage) {
    try { const saved = JSON.parse(storage.getItem(key)); if (saved && saved.signature === signature) return validate(saved.values); } catch (e) {}
    return validate(defaults);
  }
  function save(storage, values) {
    const clean = validate(values);
    storage.setItem(key, JSON.stringify({ signature, values: clean }));
    return clean;
  }
  window.ToastConfig = { fields, defaults, validate, load, save };
})();
