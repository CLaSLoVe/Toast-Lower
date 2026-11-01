'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { createGame } = require('./harness.cjs');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
function game(mode='normal', opts={}) { const g=createGame({ search:`?tut=0&seed=7&difficulty=${mode}`, ...opts }); g.tap('Enter'); return g; }

test('exactly depleted wine ends immediately, with no phantom survival or refill', () => {
 for (const mode of ['easy','normal','hard']) {
  const g=game(mode), count=mode==='hard'?4:5;
  for(let i=0;i<count;i++) { g.inspect.strike(null,null,'late'); if(i<count-1) g.inspect.newRound(false); }
  assert.equal(g.inspect.player.wine,0); assert.equal(g.inspect.st.state,'over');
  near(g.inspect.st.over.wine.penalty,mode==='hard'?.8:1);
  g.inspect.newRound(false);assert.equal(g.inspect.player.wine,0);
 }
 const r=createGame().sandbox.ToastRules;
 assert.equal(r.wineAfter('penalty',5.6e-17,0,1),5.6e-17);
 assert.ok(r.wineAfter('spill',.000001,.0000001,1)>0,'visible/non-residual small quantities survive');
});
test('a frozen or lost music clock cannot freeze the round, rewind it or repeat cues', () => {
 for(const layer of [0,6,9]) {
  const g=createGame({search:`?tut=0&seed=7&layer=${layer}`});g.tap('Enter');
  g.sandbox.__musicClock=5;g.advance(1);const r=g.inspect.st.round;
  g.advance(40);assert.equal(r.musicDetached,true);assert.equal(r.clockWaiting,false);
  const t=r.t;g.sandbox.__musicClock=5.01;g.advance(1);assert.ok(r.t>t);
  for(let i=0;i<250&&g.inspect.st.round===r;i++)g.advance(1);
  assert.ok(g.inspect.st.strikes>0,'misses resolve on the continuing clock');
  const cues=g.sandbox.__sounds.filter(s=>['count','countGo'].includes(s.type));
  assert.ok(cues.some(s=>s.type==='countGo'));
 }
 const g=game();g.sandbox.__musicClock=1;g.advance(1);const r=g.inspect.st.round,t=r.t;
 g.sandbox.__musicClock=null;g.advance(1);assert.equal(r.musicDetached,true);assert.ok(r.t>t);
});
test('player audio settings preserve progress, pause state, wine and score eligibility', () => {
 for(const paused of [false,true]) {
  const g=game();Object.assign(g.inspect.st,{score:12345,strikes:2,paused});
  const round=g.inspect.st.round,wine=g.inspect.player.wine;
  g.inspect.openPlayerSettings();assert.equal(g.inspect.st.paused,true);
  const options=g.inspect.settings;
  assert.equal(options.user,true);options.onChange({...options.values,musicVolume:7,sfxVolume:32},false,true);
  near(g.inspect.config.musicVolume,7);near(g.inspect.config.sfxVolume,32);
  options.onClose();assert.equal(g.inspect.st.paused,paused);
  assert.equal(g.inspect.st.score,12345);assert.equal(g.inspect.st.strikes,2);
  assert.equal(g.inspect.st.round,round);near(g.inspect.player.wine,wine);assert.equal(g.inspect.isCustomRun(),false);
  g.inspect.applySettings({values:{...g.inspect.config,musicVolume:9},ctl:'accel',layer:0,muted:false});
  assert.equal(g.inspect.st.round,round);assert.equal(g.inspect.st.score,12345);
 }
});
test('volume preferences survive default changes without reviving obsolete rule overrides', () => {
 const g=createGame(),config=g.sandbox.ToastConfig,storage=g.sandbox.localStorage;
 storage.setItem('toastLower.parameters.v1',JSON.stringify({signature:'old defaults',values:{musicVolume:4,sfxVolume:42,missPenalty:0}}));
 let loaded=config.load(storage);near(loaded.musicVolume,4);near(loaded.sfxVolume,42);near(loaded.missPenalty,20);
 config.savePreferences(storage,{...loaded,musicVolume:12});loaded=config.load(storage);near(loaded.musicVolume,12);near(loaded.missPenalty,20);
});
test('sway keeps current preset amplitudes and no longer changes with hit-window tuning', () => {
 for(const [mode,ratio] of [['easy',1],['normal',.85],['hard',.65]]) {
  const g=game(mode);g.inspect.st.L=5;
  const c=g.inspect.st.round.partner,span=g.inspect.cupGeom(c).bowlH*c.spec.scale;
  const expected=.42*span*ratio*Math.min(1,.45+.38)*g.inspect.config[mode+'Hand']/288;
  near(g.inspect.swayAmp(),expected);
  const before=g.inspect.swayAmp();g.inspect.config[mode+'HeightWindow']=40;near(g.inspect.swayAmp(),before);
 }
});
test('twelfth floor settles before endless, preserves all statistics and resumes exactly once', () => {
 for(const touch of [false,true]) {
  const labels=[],g=game('hard',{touch,width:touch?844:1080,height:touch?390:1080,onDraw(k,a){if(k==='fillText')labels.push(a[0]);}});
  Object.assign(g.inspect.st,{L:11,breaks:12,score:654321,perfects:22,strikes:3,bestCombo:8,gameT:120,state:'fall'});
  g.inspect.player.wine=.4;g.inspect.beginStandup();
  assert.equal(g.inspect.st.state,'clear');assert.equal(g.inspect.st.L,12);assert.equal(g.inspect.st.over.cleared,true);
  const snapshot=JSON.stringify(g.inspect.st.over);g.advance(300);assert.equal(g.inspect.player.wine,.4);assert.equal(g.inspect.st.gameT,120);assert.equal(JSON.stringify(g.inspect.st.over),snapshot);
  g.render();for(const word of ['十二关通关','继续无尽','回主页','DeepDrink','完美 22 次','失误 3 次'])assert.ok(labels.some(s=>s.includes(word)),word);
  assert.ok(!labels.includes('失败'));
  if(touch){const r=g.inspect.clearButton;g.point('pointerdown',g.inspect.canvasSize.W/2-540+r.x+r.w/2,r.y+r.h/2);}
  else g.tap('Enter');
  assert.equal(g.inspect.st.state,'standup');assert.equal(g.inspect.st.L,12);
  const wine=g.inspect.player.wine;g.inspect.continueEndless();near(g.inspect.player.wine,wine);
  g.advance(30);assert.equal(g.inspect.st.state,'play');assert.equal(g.inspect.st.L,12);assert.equal(g.inspect.st.score,654321);assert.equal(g.inspect.st.strikes,3);
 }
});
test('first-use hints persist once per mechanic, with mobile-specific actions and an off switch', () => {
 const g=game();assert.ok(g.inspect.st.guide.text.includes('按空格'));
 g.inspect.st.guide=null;g.inspect.firstGuide();assert.equal(g.inspect.st.guide,null);
 g.inspect.st.L=6;g.inspect.firstGuide();assert.ok(g.inspect.st.guide.text.includes('连敬'));
 const again=game('normal',{storage:Object.fromEntries(g.storage)});assert.equal(again.inspect.st.guide,null);
 const mobile=game('normal',{touch:true});assert.ok(mobile.inspect.st.guide.text.includes('点敬酒'));
 const off=game('normal',{storage:{'toastLower.guides.enabled':'0'}});assert.equal(off.inspect.st.guide,null);
});
test('homepage notice and fictional wine label appear without changing the existing dialogue', () => {
 for(const touch of [false,true]) {
  const labels=[],g=createGame({touch,onDraw(k,a){if(k==='fillText')labels.push(a[0]);}});g.render();
  assert.ok(labels.includes('设置'));assert.ok(labels.some(s=>s.includes('未成年人禁止饮酒')));
 }
 assert.ok(!fs.readFileSync(path.join(__dirname,'../game.js'),'utf8').includes('LAFITE'));
});
test('audio construction, source creation and synchronous resume failures are optional', () => {
 for(const failAt of ['constructor','source','resume']) {
  let track;
  class Audio { constructor(){track=this;this.paused=true;this.currentTime=0;} pause(){this.paused=true;} play(){this.paused=false;return Promise.resolve();} }
  const gain=()=>({gain:{value:0,cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){}},connect(){}});
  class AudioContext {
   constructor(){if(failAt==='constructor')throw Error('unavailable');this.state='suspended';this.currentTime=0;this.destination={};}
   createGain(){return gain();} createMediaElementSource(){if(failAt==='source')throw Error('source unavailable');return gain();}
   resume(){if(failAt==='resume')throw Error('interrupted');return Promise.resolve();} close(){return Promise.resolve();}
  }
  const scope={Audio,AudioContext,document:{body:{append(){}}},Promise};scope.window=scope;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../music.js'),'utf8'),scope);
  assert.doesNotThrow(()=>{scope.ToastMusic.gesture();scope.ToastMusic.update(true,.18);scope.ToastMusic.reset();});
  assert.equal(track.paused,true);assert.equal(scope.ToastMusic.clock(),null);
 }
});
console.log(`${checks}/${checks} maintenance regressions passed`);
