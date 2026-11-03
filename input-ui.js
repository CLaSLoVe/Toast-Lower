'use strict';
// Device input mapping and short UI prompts; physics stays in game.js.
(() => {
function mobileWords(value, touch) {
  if (!touch || typeof value !== 'string') return value;
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

const KEYMAP = { KeyQ: 'Q', KeyW: 'W', KeyO: 'O', KeyP: 'P', ArrowLeft: 'Q', ArrowRight: 'W', ArrowDown: 'O', ArrowUp: 'P' };
function canvasPoint(e, r, W, H, rotated) {
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  return rotated ? { x: y * W, y: (1 - x) * H } : { x: x * W, y: y * H };
}
function stickAxes(dx, dy, deadzone, curve) {
  const length = Math.max(1, Math.hypot(dx, dy));
  const rawX = dx / length, rawY = dy / length;
  const axis = v => Math.sign(v) * Math.pow(Math.max(0, Math.min(1, (Math.abs(v) - deadzone) / (1 - deadzone))), curve);
  return { rawX, rawY, x: axis(rawX), y: axis(rawY) };
}
function guide(mech, touch, count = 2) {
  return { basic: touch ? '圈合拢、第三声响，点敬酒' : '圈合拢、第三声响，按空格',
    shake: '晃动时，边调高度边扶杯', chain: `这一组连碰${({2: '两', 3: '三', 4: '四'})[count] || count}下，全中再往下`, alien: '最后一秒，看亮圈追目标' }[mech];
}
window.ToastUI = { KEYMAP, mobileWords, canvasPoint, stickAxes, guide };
})();
