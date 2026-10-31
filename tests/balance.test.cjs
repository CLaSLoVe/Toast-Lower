'use strict';
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
let checks = 0;
function test(name, f) { f(); checks++; console.log('PASS ' + name); }
function game(layer = 0, mode = 'normal', extra = '', options = {}) {
 const g = createGame({ search: `?tut=0&seed=7&layer=${layer}&difficulty=${mode}${extra}`, ...options });
 g.tap('Enter'); return g;
}
function hit(g) {
 const {st, player:p} = g.inspect, r=st.round, m=g.inspect.perfBand()/2;
 p.P.rim.y=g.inspect.toastRimY()+m; p.tilt=p.w=p.cupRate=0;
 r.manual=true;r.t=r.T+.5;r.mh=Array.from({length:10},(_,i)=>[st.t-i/60,m,0,0]);
 g.inspect.judgeClink();
}
function miss(g) { g.inspect.strike(null,null,'late'); g.inspect.finishToastAttempt(); }
function near(a,b) { assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`); }

test('every 2/3/4-note success pattern has the exact cumulative group penalty and one conditional refill',()=>{
 const fractions={2:[0,.6,1],3:[0,.6,.8,1],4:[0,.6,.8,.9,1]};
 for(const n of [2,3,4]) for(let mask=0;mask<2**n;mask++) {
  const g=game(n+4), p=g.inspect.player, r=g.inspect.st.round; p.wine=.5;
  let misses=0;
  for(let i=0;i<n;i++) {
   if(mask&(1<<i)) hit(g); else {miss(g);misses++;}
   near(p.wine,.5-.2*fractions[n][misses]);
  }
  assert.equal(r.phase,'react');assert.equal(r.chainHits,n-misses);
  near(g.inspect.st.wineLedger?.penalty||0,.2*fractions[n][misses]);
  g.inspect.newRound(false);near(p.wine,.5-.2*fractions[n][misses]+(misses<n?.03:0));
  g.inspect.stepRound(.01);near(g.inspect.st.wineLedger?.refill||0,misses<n?.03:0);
 }
});
test('failed ordinary rounds never refill and lethal penalties record only available wine',()=>{
 const g=game();g.inspect.player.wine=.5;miss(g);g.inspect.newRound(false);near(g.inspect.player.wine,.3);
 g.inspect.player.wine=.04;miss(g);assert.equal(g.inspect.st.state,'over');
 near(g.inspect.st.over.wine.penalty,.24);assert.equal(g.inspect.st.over.reason,'beer');
 assert.equal(g.inspect.st.round.refilled,undefined);
});
test('lethal mid-chain misses cannot award delayed hype, refill or change the captured result',()=>{
 const g=game(7);g.inspect.player.wine=.5;g.inspect.st.hype=95;g.inspect.config.hypeRefill=20;
 hit(g);const score=g.inspect.st.score;g.inspect.player.wine=.01;miss(g);
 assert.equal(g.inspect.st.state,'over');assert.equal(g.inspect.player.wine,0);
 assert.equal(g.inspect.st.score,score);assert.equal(g.inspect.st.over.score,score);
 assert.equal(g.inspect.st.bursts,0);near(g.inspect.st.wineLedger.refill,0);
});
test('one group earns one budget and one combo/hype increment, independent of note count',()=>{
 const scores=[];
 for(const n of [2,3,4]) {
  const g=game(6),r=g.inspect.st.round; r.chain=n;g.inspect.st.floorPlan.notes=n;g.inspect.st.floorPlan.claimed=Array(2*n).fill(null);g.inspect.player.wine=.5;
  for(let i=0;i<n;i++)hit(g);
  scores.push(g.inspect.st.score);assert.equal(g.inspect.st.combo,1);near(g.inspect.st.hype,38);
  const score=g.inspect.st.score,hype=g.inspect.st.hype;g.inspect.finishToastAttempt();assert.equal(g.inspect.st.score,score);assert.equal(g.inspect.st.hype,hype);
 }
 assert.ok(Math.max(...scores)-Math.min(...scores)<=2,'rounding only; not 2x/3x/4x score');
});
test('retry cannot generate score or combo/hype; mixed groups recover consistently regardless of last note',()=>{
 for(const pattern of [[true,false],[false,true]]) {
  const g=game(6);g.inspect.player.wine=.5;
  pattern.forEach(ok=>ok?hit(g):miss(g));const r=g.inspect.st.round;
  assert.equal(r.groupOutcome,'partial');assert.ok(g.inspect.roundSucceeded(r));
  g.inspect.stepRound(.53);assert.notEqual(g.inspect.st.round,r);
 }
 const g=game(8);g.inspect.player.wine=.5;for(let i=0;i<4;i++)miss(g);g.inspect.newRound(false);
 for(let i=0;i<4;i++)hit(g);assert.equal(g.inspect.st.score,0);assert.equal(g.inspect.st.combo,0);assert.equal(g.inspect.st.hype,0);
});
test('successful contact has no physical wine impulse and accounting uses actual bounded changes',()=>{
 const g=game();g.inspect.player.wine=.99;g.inspect.player.wv=.123;hit(g);near(g.inspect.player.wv,.123);
 g.inspect.refillWine(.1);near(g.inspect.st.wineLedger.refill,.01);
 g.inspect.changeWine('spill',.04);g.inspect.changeWine('penalty',.12);g.inspect.refillWine(.03);
 near(g.inspect.player.wine,1-.04-.12+.03);
 const l=g.inspect.st.wineLedger;near(.99-l.spill-l.penalty+l.refill-l.capacity,g.inspect.player.wine);
 g.inspect.player.wine=.7;g.inspect.st.L=11;g.inspect.changeWine('capacity',.7-g.inspect.wineCapacity());
 near(g.inspect.st.wineLedger.capacity,.7-g.inspect.wineCapacity());
});
test('story clear saves immediately, home saves progress, custom and bot runs cannot replace standard records',()=>{
 const g=game();g.inspect.st.L=11;g.inspect.st.breaks=11;g.inspect.st.score=555000;g.inspect.breakFloor();
 const best=JSON.parse(g.storage.get('toastLower.best.v3'));assert.equal(best.score,g.inspect.st.score);
 const p=game();hit(p);const h=p.inspect.homeButton;p.point('pointerdown',h.x+h.w/2,h.y+h.h/2);assert.equal(JSON.parse(p.storage.get('toastLower.best.v3')).score,p.inspect.st.score);
 for(const extra of ['&bot=expert','&ctl=vel','&debug=1']) {
  const c=game(0,'normal',extra);c.inspect.st.score=999999;c.inspect.saveBest();assert.equal(c.storage.has('toastLower.best.v3'),false);
 }
 const c=game();c.inspect.config.toastScore=1000;hit(c);c.inspect.gameOver('beer');assert.equal(c.inspect.st.over.custom,true);assert.equal(c.storage.has('toastLower.best.v3'),false);
});
test('all active states pause on focus loss, tab hide, Escape and the pause button',()=>{
 for(const state of ['play','fall','standup']) for(const method of ['blur','hidden','escape','button']) {
  const g=game();g.inspect.st.state=state;
  if(method==='blur')g.dispatch('blur');
  if(method==='hidden'){g.sandbox.document.hidden=true;g.sandbox.document.dispatch('visibilitychange');}
  if(method==='escape')g.tap('Escape');
  if(method==='button'){const h=g.inspect.homeButton;g.point('pointerdown',h.x+h.w+25,h.y+25);}
  assert.equal(g.inspect.st.paused,true);const t=g.inspect.st.t;g.advance(300);assert.equal(g.inspect.st.t,t);assert.equal(g.inspect.st.strikes,0);
 }
});
test('a long frame suspends before judging and resumes the pending group without losing earlier hits',()=>{
 const g=game(7);hit(g);const r=g.inspect.st.round;g.sandbox.__musicClock=0;g.frame(17);
 g.sandbox.__musicClock=3;g.frame(3017);assert.equal(g.inspect.st.paused,true);assert.equal(g.inspect.st.strikes,0);
 g.tap('Escape');assert.equal(r.chainIndex,1);assert.equal(r.chainHits,1);assert.equal(r.attacking,false);
 g.frame(3034);assert.equal(g.inspect.st.strikes,0);assert.ok(g.api.dbg().inputLeft>.8);
});
test('alien leaders have identical recovery and chain timing is ordered by difficulty',()=>{
 for(const cup of [0,1,2]) {const g=game(9);g.inspect.st.alien.cup=cup;hit(g);const r=g.inspect.st.round;g.inspect.stepRound(.3);assert.equal(g.inspect.st.round,r);g.inspect.stepRound(.23);assert.notEqual(g.inspect.st.round,r);}
 const times=['easy','normal','hard'].map(mode=>game(8,mode).api.dbg().timingWindow);assert.ok(times[0]>times[1]&&times[1]>times[2]);
});
test('later smash charge stays fixed even deep in endless',()=>{
 const durations=[];
 for(const layer of [1,5,11,25,100]) {
  const g=game(layer);g.inspect.st.breaks=layer;g.inspect.st.round.smash=true;g.inspect.st.round.phase='aim';g.inspect.player.h=1;g.inspect.st.pressure=0;g.key('KeyO');
  let frames=0;while(g.inspect.st.state==='play'&&frames<120){g.inspect.pressCheck(1/60,g.inspect.diff());frames++;}durations.push(frames);
 }
 assert.equal(new Set(durations).size,1);assert.ok(durations[0]<=30);
});
test('endless cycles existing phrase lengths and alien height spans rather than repeating one variant',()=>{
 assert.deepEqual([13,16,19].map(i=>game(i).inspect.st.round.chain),[2,3,4]);
 assert.deepEqual([14,17,20].map(i=>game(i,'easy').inspect.st.alien.step),[36,48,60]);
});
test('cosmetic drawing cannot change seeded physics, and focused chapters have no random shove',()=>{
 const a=game(),b=game();for(let i=0;i<60;i++){b.render();a.advance(1);b.advance(1);}
 near(a.inspect.player.tilt,b.inspect.player.tilt);near(a.inspect.player.h,b.inspect.player.h);
 for(const layer of [6,7,8,9,10,11]){const g=game(layer);for(let i=0;i<1000;i++){g.inspect.st.t+=1/60;g.inspect.stepDisturb(1/60,g.inspect.diff());}assert.equal(g.inspect.st.bump,null);}
});
test('resource notices and result ledger render with useful labels in both layouts',()=>{
 for(const touch of [false,true]) {
  const text=[];const g=game(7,'normal','',{touch,width:touch?844:1080,height:touch?390:1080,onDraw(k,a){if(k==='fillText')text.push(a[0]);}});
  g.inspect.player.wine=.5;miss(g);g.render();assert.ok(text.includes('罚酒 −12%'));
  hit(g);miss(g);g.inspect.newRound(false);g.inspect.changeWine('spill',.04);g.inspect.gameOver('beer');g.inspect.st.stT=2;text.length=0;g.render();
  assert.ok(text.includes('失败'));assert.ok(text.some(x=>x.includes('完美')&&x.includes('失误')));assert.ok(text.some(x=>x.startsWith('洒酒')));assert.ok(text.some(x=>x.startsWith('添酒')));assert.ok(!text.includes('酒洒光了！'));
 }
});
console.log(`${checks}/${checks} balance and lifecycle checks passed`);
