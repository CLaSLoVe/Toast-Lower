'use strict';
(() => {
  const config = window.ToastConfig;
  const touchTips = {
    bodyAccel: '越大，上下推摇杆时身体加速越快。',
    cupAccel: '越大，左右推摇杆时杯子转动越快。',
    releaseCup: '越小，松开摇杆时杯子刹得越快。',
    releaseBody: '越小，松开摇杆时身体刹得越快。',
    reachTime: '点「敬酒」到杯子接触所需的时间。'
  };
  const groups = {
    common: ['roundWait', 'missPenalty', 'roundRefill', 'spillMultiplier', 'spillMax', 'minCapacity'],
    difficulty: ['Time', 'Taper', 'Setup', 'BodyCupCoupling', 'Hand', 'ChainWindow'],
    feel: ['stickDeadzone', 'stickCurve', 'cupTiltLimit', 'bodyBrakeCoupling', 'bodyAccel', 'bodyBrake', 'cupAccel', 'cupBrake', 'releaseCup', 'releaseBody'],
    advanced: ['openingRounds', 'regularRounds', 'chainRounds', 'toastScore', 'comboScore', 'comboCap', 'hypeScore', 'floorScore', 'clearScore', 'chainReach', 'chainPenaltyFirst', 'chainPenaltySecond', 'chainPenaltyThird', 'successPause', 'missPause', 'smashCharge', 'focusDrift', 'stallPause', 'timingScore', 'heightScore', 'wineScore', 'floorWineScore', 'hypeHit', 'hypePerfect', 'hypeMiss', 'alienRounds', 'alienCountdown', 'alienReveal', 'alienStep1', 'alienStep2', 'alienStep3', 'musicVolume', 'musicBpm', 'spillSoundVolume', 'spillSoundInterval', 'perfectTime', 'perfectScore', 'perfectRate', 'repeatSmashScale', 'repeatSmashPause', 'repeatStandup', 'reachTime', 'minWait', 'depthSpeedup', 'retargetBonus', 'rushScale', 'practiceBonus', 'perfectRefill', 'hypeRefill', 'floorRefill', 'spillGrace', 'spillRamp']
  };
  const tips = {
    openingRounds: '职场前两关各有几次固定敬酒机会；失败补敬不会增加计分机会。',
    regularRounds: '其余普通与晃动关卡的固定敬酒轮数。',
    chainPenaltyFirst: '一组第一次失误罚标准额度的60%；默认即12%初始杯容量。',
    chainPenaltySecond: '三连／四连第二次失误后的累计额度；80%标准罚酒默认即累计16%。',
    chainPenaltyThird: '四连第三次失误后的累计额度；最后一次全错固定达到100%。',
    smashCharge: '首次砸楼所需蓄力，后续乘重复倍率，不再随楼层增加。',
    focusDrift: '古墓和外星保留的扶杯漂移强度；这两章不再随机推搡。',
    stallPause: '超过这个时长未更新画面时暂停；恢复后重新给出当前待碰杯的拍子。',
    chainRounds: '每关连续踩拍的组数；每拍只在第一次尝试时计分。',
    toastScore: '成功一组的基础分，乘以当前关数；连敬按拍数平分，补敬不计分。',
    comboScore: '每组全中延续连敬；连敬加分乘以当前关数。',
    comboCap: '超过此连敬次数后，连敬加分不再增加。',
    hypeScore: '气势满格的奖励，乘以当前关数；补敬不积累气势。',
    floorScore: '每关完成时的基础分，乘以当前关数。',
    clearScore: '从第一关完整打完十二关时，一次性追加的奖励。',
    stickDeadzone: '手机摇杆靠近中心时不输入，避免手指微晃。电脑键盘不受影响。',
    stickCurve: '越大，小幅推杆越细腻；推到底仍保持原来的最大力度。',
    chainReach: '古墓连敬使用的短伸手动作；最多占一拍的 38%，给下一拍留出回收时间。',
    ChainWindow: '连敬每拍的前后误差，以音乐拍长计算；普通单杯不受影响。',
    alienCountdown: '从三杯同时亮圈到红色 0 秒；独立于普通回合、深度和难度的时间调整。',
    alienReveal: '剩余这段时间时，只保留目标圆圈，同时出现辅助高度线。',
    alienRounds: '每关固定几轮敬酒后进入砸楼；失败补敬不增加计分机会。',
    alienStep1: '三个候选杯的相邻高度差，揭晓后按设定的剩余时间调整。',
    alienStep2: '第二关候选杯高度差；越大，需要调整得越快。',
    alienStep3: '第三关候选杯高度差；过大会难以赶到。',
    spillSoundVolume: '只调漏酒声；设为 0 可关闭。敬酒三声期间自动静音漏酒声。',
    spillSoundInterval: '连续漏酒时的声音间隔；越大越安静，不影响实际漏酒速度。',
    musicBpm: '音乐和敬酒三拍共用速度；数值越大越快，第三声始终对齐红色 0s。',
    musicVolume: '酒局循环小曲的音量；设为 0 只关闭音乐，静音开关会关闭所有声音。',
    minCapacity: '后期最小杯子的酒量上限，以初始大杯为 100%。扣酒和补酒仍按初始大杯计算。',
    cupTiltLimit: '限制前后倾斜，最多 45°；到边缘后仍能反向扶正。',
    BodyCupCoupling: '这一档上下移动时带动杯子的强度；也受扶杯干扰倍率影响，越小越容易稳住。',
    bodyBrakeCoupling: '加速和刹车时的短促晃动，方向随身体速度变化。',
    perfectTime: '必须同时合拍并扶稳，才算完美。不会收紧普通碰杯范围。',
    perfectScore: '完美额外得分，随当前层数增加；默认不额外补酒。',
    perfectRate: '接触前杯子转动不能超过此速度，避免甩过正确位置也算完美。',
    repeatSmashScale: '第一次之后的砸楼蓄力时长倍率，越小越快。',
    repeatSmashPause: '第一次之后，砸楼前的停顿时间。',
    repeatStandup: '第二次落地开始，起身动画的时长。',
    roundWait: '越小，领导越快碰杯。难度和特殊回合会在此基础上调整。',
    missPenalty: '没敬上时扣掉多少酒。20% 指初始大杯的五分之一。',
    roundRefill: '成功回合结束后添酒；连敬一组至少碰上一次才添一次，最多到满杯。',
    spillMultiplier: '越大漏得越快；1 是正常速度，0 关闭持续漏酒。',
    spillMax: '大幅倾斜时，每秒最多扣多少酒。',
    Time: '允许碰杯早一点或晚一点。越大越容易。',
    Taper: '后期从容错中减去的时间。越小越宽松。',
    Setup: '加在普通倒计时上；负数表示更快。',
    Hand: '身体运动对杯子和酒液的影响。越小越容易扶稳。',
    bodyAccel: '越大，按住 O/P 时身体加速越快。', bodyBrake: '越大，身体惯性越小。',
    cupAccel: '越大，按住 Q/W 时杯子转动越快。', cupBrake: '越大，杯子惯性越小。',
    releaseCup: '越小，松开 Q/W 时刹得越快。', releaseBody: '越小，松开 O/P 时刹得越快。',
    reachTime: '按下空格到杯子接触所需的时间。', minWait: '后期倒计时的下限，不超过普通倒计时。',
    depthSpeedup: '深入后最多缩短多少秒。', retargetBonus: '杯口高度变化大时，额外给出的调整时间上限。',
    practiceBonus: '练习手感额外增加的碰杯容错。', perfectRefill: '完美碰杯额外补酒。',
    hypeRefill: '气势满格时额外补酒。', floorRefill: '进入下一层时补酒。',
    spillGrace: '开始倾斜后，多久才逐渐扣酒。', spillRamp: '从缓冲结束到正常漏酒速度所需的时间。'
  };
  let dialog, options, draft, tab, difficulty, selectedCtl, selectedLayer, selectedMute, status;
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) node.append(child);
    return node;
  };
  function countChanges() {
    return config.fields.filter(([key]) => Number(draft[key]) !== options.values[key]).length +
      (selectedCtl !== options.ctl) + (selectedLayer !== options.layer) + (selectedMute !== options.muted);
  }
  function updateStatus(message) {
    const count = countChanges();
    status.textContent = message || (count ? `${count} 项未保存` : '数值可直接输入，修改后点击保存');
  }
  function close() { dialog.close(); options.onClose(); }
  function field(key) {
    const [, originalLabel, defaultValue, min, max, step, unit] = config.fields.find(f => f[0] === key);
    const suffix = groups.difficulty.find(s => key === difficulty + s);
    const label = suffix ? originalLabel.split(' · ')[1] : originalLabel;
    const input = el('input', { id: `setting-${key}`, type: 'number', min, max, step: 'any', inputmode: 'decimal', value: draft[key], 'aria-describedby': `help-${key}` });
    const reset = el('button', { type: 'button', class: 'reset-one', text: '恢复', 'aria-label': `恢复${label}默认值`, onclick: () => { draft[key] = defaultValue; input.value = defaultValue; updateStatus(); } });
    input.addEventListener('input', () => { draft[key] = input.value === '' ? '' : Number(input.value); updateStatus(); });
    return el('div', { class: 'setting-row' }, [
      el('div', { class: 'setting-copy' }, [el('label', { for: `setting-${key}`, text: label }), el('p', { id: `help-${key}`, text: (options.touch && touchTips[key]) || tips[key] || tips[suffix] || '' })]),
      el('div', { class: 'setting-value' }, [input, el('span', { class: 'unit', text: unit }), reset])
    ]);
  }
  function render() {
    dialog.replaceChildren();
    const form = el('form', { novalidate: '' });
    form.append(el('header', {}, [el('div', {}, [el('h1', { text: '游戏设置' }), el('p', { text: options.paused ? '保存后重开本局，新参数立即用于这一局。' : '改好后保存，下一局就用新参数。' })]), el('button', { type: 'button', class: 'close-settings', text: '取消', onclick: close })]));
    const nav = el('nav', { 'aria-label': '设置分类' });
    for (const [id, label] of [['common', '常用'], ['difficulty', '难度'], ['feel', '手感'], ['advanced', '高级']]) nav.append(el('button', { type: 'button', text: label, 'aria-pressed': String(tab === id), onclick: () => { tab = id; render(); } }));
    form.append(nav);
    const panel = el('section', { class: 'settings-content', 'aria-label': '参数编辑' });
    if (tab === 'difficulty') {
      const selector = el('div', { class: 'difficulty-selector', 'aria-label': '选择要调整的难度' });
      for (const d of options.difficulties) selector.append(el('button', { type: 'button', text: `${d.level} · ${d.name}`, 'aria-pressed': String(difficulty === d.id), onclick: () => { difficulty = d.id; render(); } }));
      panel.append(selector, el('p', { class: 'section-note', text: '只修改这一档的参数，不会切换当前游戏难度。' }));
    }
    if (tab === 'feel') {
      const select = el('select', { id: 'setting-control', 'aria-label': '操作手感' }, [el('option', { value: 'accel', text: '醉拳 · 有惯性' }), el('option', { value: 'vel', text: '练习 · 易刹车' })]);
      select.value = selectedCtl; select.addEventListener('change', () => { selectedCtl = select.value; render(); });
      panel.append(el('div', { class: 'setting-row' }, [el('label', { for: 'setting-control', text: '操作手感' }), select]));
      panel.append(el('p', { class: 'section-note', text: '身体带动杯子在「难度」中分档调整；加速度和阻尼用于醉拳。想更好刹车，先调高阻尼。' }));
    }
    const keys = tab === 'difficulty' ? groups.difficulty.map(s => difficulty + s) : groups[tab];
    for (const key of keys) panel.append(field(key));
    if (tab === 'advanced') {
      const select = el('select', { id: 'setting-level', 'aria-label': '开始关卡' });
      options.layers.forEach((label, i) => select.append(el('option', { value: i, text: label })));
      select.value = selectedLayer; select.addEventListener('change', () => { selectedLayer = Number(select.value); updateStatus(); });
      const mute = el('input', { type: 'checkbox', id: 'setting-mute' }); mute.checked = selectedMute;
      mute.addEventListener('change', () => { selectedMute = mute.checked; updateStatus(); });
      panel.append(el('div', { class: 'setting-row' }, [el('label', { for: 'setting-level', text: '开始关卡' }), select]), el('div', { class: 'setting-row' }, [el('label', { for: 'setting-mute', text: '静音' }), mute]));
    }
    form.append(panel);
    status = el('p', { class: 'settings-status', role: 'status' });
    form.append(el('footer', {}, [status, el('div', { class: 'settings-actions' }, [el('button', { type: 'button', text: '本页恢复默认', onclick: () => { keys.forEach(key => draft[key] = config.defaults[key]); render(); updateStatus('本页已恢复默认，保存后生效'); } }), el('button', { type: 'submit', class: 'save-settings', text: options.paused ? '保存并重开' : '保存设置' })])]));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const invalid = config.fields.find(([key, , , min, max]) => typeof draft[key] !== 'number' || !Number.isFinite(draft[key]) || draft[key] < min || draft[key] > max);
      if (invalid) { updateStatus(`${invalid[1]}请填写 ${invalid[3]}–${invalid[4]} 之间的数值`); return; }
      if (draft.alienReveal > draft.alienCountdown - 0.5) { updateStatus('外星目标揭晓前至少保留 0.5 秒三杯倒计时'); return; }
      if (draft.chainPenaltyFirst > draft.chainPenaltySecond || draft.chainPenaltySecond > draft.chainPenaltyThird) { updateStatus('连敬累计罚酒比例必须依次递增'); return; }
      if (draft.minWait > draft.roundWait) { updateStatus('后期最短倒计时不能大于普通倒计时（可在高级中修改）'); return; }
      for (const id of ['easy', 'normal', 'hard']) if (draft[id + 'Taper'] > draft[id + 'Time'] - 0.05) { updateStatus('后期收紧后，碰杯容错至少要保留 0.05 秒'); return; }
      try { options.onSave({ values: draft, ctl: selectedCtl, layer: selectedLayer, muted: selectedMute }); close(); }
      catch (e) { updateStatus('保存失败，请检查浏览器存储权限'); }
    });
    dialog.append(form); updateStatus();
  }
  window.ToastSettings = {
    isOpen: () => !!dialog?.open,
    open(value) {
      options = value; draft = { ...value.values }; tab = 'common'; difficulty = value.difficulty;
      selectedCtl = value.ctl; selectedLayer = value.layer; selectedMute = value.muted;
      if (!dialog) {
        dialog = el('dialog', { class: 'game-settings', 'aria-label': '游戏设置' }); document.body.append(dialog);
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        for (const event of ['keydown', 'keyup', 'touchstart', 'touchmove', 'touchend', 'dblclick']) dialog.addEventListener(event, e => e.stopPropagation());
      }
      render(); dialog.showModal(); dialog.querySelector('.close-settings').focus();
    }
  };
})();
