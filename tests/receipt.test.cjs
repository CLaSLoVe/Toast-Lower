'use strict';
const assert = require('node:assert/strict');
const {createGame} = require('./harness.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function game(mode='normal',layer=0,options={}) {const g=createGame({search:`?tut=0&seed=7&difficulty=${mode}&layer=${layer}`,...options});g.tap('Enter');return g;}
function hit(g,perfect=true) {
 const {st,player:p}=g.inspect,r=st.round,m=g.inspect.perfBand()/2;
 p.P.rim.y=g.inspect.toastRimY()+m;p.tilt=p.w=p.cupRate=0;
 r.manual=true;r.t=r.T+.5-g.inspect.reachTime();r.mh=perfect?Array.from({length:10},(_,i)=>[st.t-i/60,m,0,0]):[];
 g.inspect.judgeClink();
}
function ledger(g) {const s=g.inspect.st,l=s.wineLedger||{spill:0,penalty:0,refill:0,capacity:0};near(s.initialWine+l.refill-l.spill-l.penalty-l.capacity,g.inspect.player.wine);}
function campaign(mode,perfect) {
 const g=game(mode);
 for(let layer=0;layer<12;layer++) {
  assert.equal(g.inspect.st.L,layer);
  while(!g.inspect.st.round.smash) {const n=g.inspect.st.round.chain||1;for(let i=0;i<n;i++)hit(g,perfect);g.inspect.newRound(false);ledger(g);}
  g.inspect.breakFloor();for(let i=0;i<600&&['fall','standup'].includes(g.inspect.st.state);i++)g.advance(1);ledger(g);
 }
 assert.equal(g.inspect.st.state,'clear');return g;
}
for(const mode of ['easy','normal','hard'])for(const perfect of [false,true]) {
 const g=campaign(mode,perfect),o=g.inspect.st.over;
 assert.equal(o.points.performance,perfect?40000:20000);assert.equal(o.points.progress,50000);
 assert.equal(o.points.overflow,5000);assert.equal(o.points.remaining,5000);
 assert.equal(o.score,perfect?100000:80000);assert.equal(Object.values(o.points).reduce((a,b)=>a+b,0),o.score);
 const score=o.score;g.inspect.continueEndless();g.advance(30);ledger(g);assert.equal(g.inspect.st.score,score,'no duplicated settlement/refill conversion at the cap');
 g.inspect.changeWine('penalty',1);g.inspect.gameOver('beer');assert.equal(g.inspect.st.over.score,score,'endless failure does not award leftover wine twice');ledger(g);
}
console.log('PASS all three difficulties: controlled full perfect = 100000, all ordinary = 80000; wine and score ledgers reconcile');
{
 const g=game();g.inspect.changeWine('spill',.01);g.inspect.refillWine(.03,true);
 near(g.inspect.player.wine,.8);near(g.inspect.st.wineLedger.refill,.01);assert.equal(g.inspect.st.score,100);ledger(g);
 g.inspect.refillWine(2,true);assert.equal(g.inspect.st.score,5000);ledger(g);
 g.inspect.refillWine(2,true);assert.equal(g.inspect.st.score,5000,'conversion cap');
}
{
 const g=game('normal',6),r=g.inspect.st.round;
 g.inspect.strike(null,null,'late');g.inspect.finishToastAttempt();hit(g);g.inspect.newRound(false);
 const score=g.inspect.st.score;g.inspect.refillWine(1);hit(g);hit(g);g.inspect.newRound(false);
 assert.equal(g.inspect.st.score,score,'retry with full glass earns neither contact nor overflow points');assert.equal(g.inspect.st.round.progress,1);ledger(g);
}
console.log('PASS partial overflow, capped conversion and full-glass chain retry cannot farm points');
for(const layout of ['desktop','landscape','portrait']) {
 const labels=[],g=game('hard',0,{touch:layout!=='desktop',width:layout==='portrait'?390:layout==='landscape'?844:1080,height:layout==='portrait'?844:layout==='landscape'?390:1080,onDraw(k,a){if(k==='fillText')labels.push(a[0]);}});
 g.inspect.changeWine('spill',.59);g.inspect.strike(null,null,'late');assert.equal(g.inspect.st.state,'over');g.advance(100);g.render();
 const o=g.inspect.st.over;assert.ok(labels.includes('最后一次罚酒 −11%'));assert.ok(labels.includes('敬酒表现'));assert.ok(!labels.includes('开局'));
 function click(r){const W=g.inspect.canvasSize.W,H=g.inspect.canvasSize.H,x=W/2-540+r.x+r.w/2,y=r.y+r.h/2;
  if(layout==='portrait'){const rect=g.sandbox.document.getElementById('c').getBoundingClientRect();g.canvasDispatch('pointerdown',{pointerId:7,clientX:rect.left+(1-y/H)*rect.width,clientY:rect.top+x/W*rect.height});}
  else g.point('pointerdown',x,y,7);
 }
 click(g.inspect.detailButton);assert.equal(o.detailsOpen,true);g.render();assert.ok(labels.includes('开局'));assert.ok(labels.includes('剩酒 / 容量'));assert.equal(g.inspect.st.state,'over');
 click(g.inspect.detailButton);assert.equal(o.detailsOpen,false);
 click(g.inspect.clearButton);assert.equal(g.inspect.st.state,'play');assert.equal(g.inspect.st.score,0);
}
console.log('PASS desktop, landscape and rotated portrait: concise failure reason, receipt toggle and explicit restart targets');
{
 const g=game();const c=g.sandbox.ToastConfig;assert.deepEqual(Object.keys(c.validate(c.defaults)).sort(),Object.keys(c.defaults).sort());
 assert.equal(g.inspect.config.toastScore,undefined);assert.equal(g.inspect.config.comboCap,undefined);
}
console.log('PASS removed scoring knobs do not survive validation or trigger settings restarts');
