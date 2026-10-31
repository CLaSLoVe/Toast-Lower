'use strict';
const assert = require('node:assert/strict');
const {createGame} = require('./harness.cjs');
let checks = 0;
function test(name, run) { run(); checks++; console.log('PASS ' + name); }
function game(mode, layer = 0) {
 return createGame({search:`?capture=1&tut=0&bot=none&seed=7&difficulty=${mode}&layer=${layer}`});
}
function judgeOffset(mode, layer, offset) {
 const g=game(mode,layer),p=g.inspect.player,r=g.inspect.st.round,m=g.inspect.perfBand()/2;
 p.P.rim.y=g.inspect.toastRimY()+m;p.w=p.tilt=p.cupRate=0;
 r.manual=true;r.t=r.T+.5+offset;r.mh=Array.from({length:10},(_,i)=>[g.inspect.st.t-i/60,m,0,0]);
 g.inspect.judgeClink();return g.inspect.st.strikes===0;
}
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
test('easy retains its timing, body coupling, drift, replenishment and alien geometry',()=>{
 const g=game('easy'),c=g.inspect.config;
 assert.equal(c.easyTime,.7);assert.equal(c.easyTaper,.05);assert.equal(c.easySetup,.5);
 assert.equal(c.easyBodyCupCoupling,.5);assert.equal(c.easyHand,.5);assert.equal(c.easyChainWindow,.44);
 assert.equal(c.easyFocusDrift,.35);assert.equal(c.easyFloorRefill,10);assert.equal(c.easyAlienHeight,1);
 for(const [layer,step] of [[9,36],[10,48],[11,60]])near(game('easy',layer).inspect.st.alien.step,step);
});
test('equal early/late errors distinguish modes while accurate taps remain valid',()=>{
 for(const sign of [-1,1]) {
  for(const layer of [0,3,9,11]) {
   assert.equal(judgeOffset('easy',layer,sign*.4),true);
   assert.equal(judgeOffset('normal',layer,sign*.4),false);
   assert.equal(judgeOffset('normal',layer,sign*.26),true);
   assert.equal(judgeOffset('hard',layer,sign*.26),false);
  }
  for(const layer of [6,7,8]) {
   assert.equal(judgeOffset('easy',layer,sign*.19),true);
   assert.equal(judgeOffset('normal',layer,sign*.19),false);
   assert.equal(judgeOffset('normal',layer,sign*.14),true);
   assert.equal(judgeOffset('hard',layer,sign*.14),false);
  }
 }
 for(const mode of ['easy','normal','hard'])for(const layer of [0,3,6,7,8,9,11])assert.equal(judgeOffset(mode,layer,.05),true);
});
test('actual floor transitions refill 10/7/4 percent with no timing or input-speed changes',()=>{
 for(const [mode,refill] of [['easy',.10],['normal',.07],['hard',.04]]) {
  const g=game(mode),c=g.inspect.config;g.inspect.player.wine=.2;g.inspect.breakFloor();
  for(let i=0;i<240&&g.inspect.st.L===0;i++)g.advance(1);
  assert.equal(g.inspect.st.L,1);near(g.inspect.player.wine,.2+refill);near(g.inspect.st.wineLedger.refill,refill);
  assert.equal(c.roundRefill,3);assert.equal(c.missPenalty,20);assert.equal(c.bodyAccel,3.9);assert.equal(c.cupAccel,6.2);
  assert.equal(c.musicBpm,126);assert.equal(c.alienCountdown,2);assert.equal(c.alienReveal,1);
 }
});
test('late chapters scale height and drift instead of adding hidden shoves or changing success rules',()=>{
 for(const [mode,mult,drift] of [['easy',1,.35],['normal',1.1,.5],['hard',1.2,.7]]) {
  for(const [layer,base] of [[9,36],[10,48],[11,60]])near(game(mode,layer).inspect.st.alien.step,base*mult);
  const g=game(mode,8),p=g.inspect.player,c=g.inspect.config;
  assert.equal(c[mode+'FocusDrift'],drift);p.tdr=0;p.tdrGoal=1;g.inspect.st.tdrT=10;
  g.inspect.stepDisturb(.1,g.inspect.diff());near(p.tdr,.2*drift);assert.equal(g.inspect.st.bump,null);
 }
});
test('timing-error probe exercises real taps without changing production code or cup poses',()=>{
 const g=createGame({search:'?capture=1&tut=0&bot=expert&difficulty=hard&seed=7',timingProbe:true});
 g.sandbox.__timingOffset=.3;
 for(let i=0;i<500&&!g.inspect.contacts.length;i++)g.advance(1);
 const c=g.inspect.contacts[0];assert.ok(c);assert.equal(c.result,'strike');assert.ok(g.inspect.st.why.early>0);
});
console.log(`${checks}/${checks} difficulty checks passed`);
