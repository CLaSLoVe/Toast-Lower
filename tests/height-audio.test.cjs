'use strict';
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function game(mode,layer=0,extra='',options={}){const g=createGame({search:`?tut=0&seed=7&difficulty=${mode}&layer=${layer}${extra}`,...options});g.tap('Enter');return g;}
function near(a,b){assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);}
function hitAt(mode,layer,fraction) {
 const g=game(mode,layer),r=g.inspect.st.round,p=g.inspect.player;
 r.t=r.T+.5-g.inspect.reachTime();g.inspect.revealAlienTarget();
 const target=r.partner,full=g.inspect.cupGeom(target).bowlH*target.spec.scale;
 p.P.rim.y=g.inspect.toastRimY()+full*fraction;p.w=p.tilt=p.cupRate=0;
 g.tap('Space');return g.inspect.st.toasts===1;
}
test('same height succeeds or fails at exactly the 100/65/45 percent boundaries in every chapter',()=>{
 for(const layer of [0,1,3,6,8,9,11,12,13,14]){
  for(const [mode,ratio] of [['easy',1],['normal',.65],['hard',.45]]) {
   const g=game(mode,layer),c=g.inspect.st.round.partner;
   near(g.inspect.winSpan(),g.inspect.cupGeom(c).bowlH*c.spec.scale*ratio);
   assert.equal(hitAt(mode,layer,ratio-.0001),true,`${mode}/${layer}: inside`);
   assert.equal(hitAt(mode,layer,ratio+.0001),false,`${mode}/${layer}: outside`);
  }
  assert.equal(hitAt('easy',layer,.90),true);assert.equal(hitAt('normal',layer,.90),false);
  assert.equal(hitAt('normal',layer,.55),true);assert.equal(hitAt('hard',layer,.55),false);
 }
});
test('normal starts at 80% and hard at 70%, converges to 60%, and keeps the original spill threshold and rate',()=>{
 let previous=1;
 for(let layer=0;layer<12;layer++) {
  const e=game('easy',layer),n=game('normal',layer),h=game('hard',layer);
  const ec=e.inspect.cupGeom(e.inspect.player),nc=n.inspect.cupGeom(n.inspect.player),hc=h.inspect.cupGeom(h.inspect.player);
  near(ec.lim,nc.lim);near(ec.spillCap,nc.spillCap);
  near(hc.lim,nc.lim);near(hc.spillCap,nc.spillCap);
  const capacity=h.inspect.wineCapacity();assert.ok(capacity<=previous&&capacity>=.6);previous=capacity;
  if(layer<11){assert.ok(hc.bowlH<nc.bowlH);assert.ok(hc.wt<nc.wt);assert.ok(capacity<n.inspect.wineCapacity());}
  if(layer===0){near(capacity,.7);near(h.inspect.player.wine,.7);near(n.inspect.wineCapacity(),.8);}
  if(layer===11)near(capacity,.6);
 }
 const g=game('hard');g.inspect.config.hardStartCapacity=100;near(g.inspect.wineCapacity(),1);
 const base=game('easy');near(g.inspect.cupGeom(g.inspect.player).bowlH,base.inspect.cupGeom(base.inspect.player).bowlH);
});
test('hard-mode wine uses standard-glass units, retaining the same penalties and refills',()=>{
 const g=game('hard'),p=g.inspect.player;
 near(p.wine,.7);g.inspect.strike(null,null,'late');near(p.wine,.5);near(g.inspect.st.wineLedger.penalty,.2);
 g.inspect.refillWine(g.inspect.config.roundRefill/100);near(p.wine,.53);
 g.inspect.refillWine(1);near(p.wine,.7);
 near(g.inspect.config.missPenalty,20);near(g.inspect.config.roundRefill,3);near(g.inspect.config.minCapacity,60);
});
test('tutorial ignores difficulty height and cup changes',()=>{
 for(const mode of ['easy','normal','hard']) {
  const g=createGame({search:`?tut=1&seed=7&difficulty=${mode}`});g.tap('Enter');g.advance(1);const boss=g.inspect.boss;
  near(g.inspect.winSpan(),g.inspect.cupGeom(boss).bowlH*boss.spec.scale);near(g.inspect.wineCapacity(),1);
 }
});
test('music and FX levels are independent, and sound-only tuning keeps normal score eligibility',()=>{
 const g=game('normal',0,'',{storage:{toast_mute:'0','toastLower.tutDone':'1'}}),cfg=g.inspect.config;
 cfg.musicVolume=9;cfg.sfxVolume=35;
 // A frame runs the music sync just as the browser animation loop does.
 g.frame(16);near(g.sandbox.__music.volume,.09);near(g.sandbox.__music.sfxVolume,.35);
 assert.equal(g.inspect.isCustomRun(),false);
 const r=g.inspect.st.round;r.t=r.T+.5-g.inspect.reachTime()-.5;g.frame(32);assert.equal(g.sandbox.__music.duck,true);
 g.tap('KeyM');near(g.sandbox.__music.volume,0);near(g.sandbox.__music.sfxVolume,0);
});
test('every sound, including the perfect overtone, routes through the shared effects bus',()=>{
 const g=game('normal',0,'',{storage:{toast_mute:'0','toastLower.tutDone':'1'}});
 const context=new g.sandbox.AudioContext(),effects=context.createGain(),nodes=[],create=context.createGain.bind(context);
 context.createGain=()=>{const n=create();nodes.push(n);return n;};
 g.sandbox.ToastMusic.audio=()=>({context,effects});
 for(const type of ['count','countGo','ding','perfect','thud','break','smash'])g.inspect.sfx(type);
 assert.ok(nodes.filter(n=>n.connections.includes(effects)).length>=8);
 assert.ok(!nodes.some(n=>n.connections.includes(context.destination)),'no bypass around FX/mute gain');
});
console.log(`${checks}/${checks} height, cup and audio routing checks passed`);
