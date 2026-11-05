'use strict';
const assert = require('node:assert/strict');
const {createGame} = require('./harness.cjs');
function tutorial(step) {
 const g=createGame({search:'?tut=1&seed=7'});g.tap('Enter');
 if(step!==undefined){Object.assign(g.inspect.st.tut,{step,sub:0,t:0,acc:0,enter:true});g.inspect.stepTutorial(0);}
 return g;
}
function align(g){g.inspect.player.P.rim.y=g.inspect.toastRimY()+g.inspect.perfBand()/2;}
function hit(g){align(g);const r=g.inspect.st.round;r.t=r.T+.5-g.inspect.reachTime();r.cue={next:2,target:r.t,gap:60/g.inspect.config.musicBpm};g.tap('Space');}
{
 const g=tutorial();g.key('KeyO');g.advance(50);g.key('KeyO',false);
 assert.equal(g.api.tut().sub,1);const p=g.inspect.player,b=g.inspect.boss;
 const before=JSON.stringify([p.P,b.P,p.wine,g.inspect.st.score]);g.tap('Space');
 const m=g.inspect.st.toastMotion;assert.ok(m);assert.equal(m.freePractice,true);assert.equal(m.fired,false);
 assert.equal(JSON.stringify([p.P,b.P,p.wine,g.inspect.st.score]),before);
 m.t=m.contact;const pp=g.inspect.toastPose(p,p.P),bp=g.inspect.toastPose(b,b.P);
 assert.ok(Math.abs(pp.rim.y-bp.rim.y)<1e-8,'free practice must visibly meet even after moving down');
 assert.notEqual(pp.rim.x,p.P.rim.x);assert.notEqual(bp.rim.x,b.P.rim.x);
 m.t=0;g.advance(4);assert.equal(m.fired,false);g.advance(1);assert.equal(m.fired,true);
 const rings=g.sandbox.__sounds.filter(s=>s.type==='ding').length;assert.equal(rings,1);
 g.advance(25);assert.equal(g.sandbox.__sounds.filter(s=>s.type==='ding').length,1);
}
console.log('PASS intro toast visibly meets, animates both arms and sounds once without changing physical poses or score');
for(const step of [1,4]){
 const g=tutorial(step);align(g);g.inspect.player.tilt=g.inspect.player.w=0;
 const before=JSON.stringify([g.inspect.player.P,g.inspect.boss.P,g.inspect.boss.x]);
 g.inspect.stepTutorial(.46);assert.equal(g.inspect.st.round.result,'ok');assert.ok(g.inspect.st.toastMotion);
 assert.equal(JSON.stringify([g.inspect.player.P,g.inspect.boss.P,g.inspect.boss.x]),before,'Mom does not physically rush forward');
 g.advance(5);assert.equal(g.inspect.st.toastMotion.fired,true);
 assert.equal(g.inspect.st.score,0);assert.equal(g.inspect.st.strikes,0);
}
console.log('PASS height exercises use the same visible contact without moving Mom forward or awarding gameplay points');
{
 const g=createGame({search:'?tut=1&capture=1&bot=expert&seed=7'}),animated=new Set();
 for(let i=0;i<60*90&&g.api.tut();i++){g.advance(1);if(g.inspect.st.toastMotion&&g.api.tut())animated.add(g.api.tut().step);}
 assert.equal(g.api.tut(),null);for(const step of [0,1,4,5,6])assert.ok(animated.has(step),`missing toast animation in lesson ${step}`);
}
console.log('PASS all tutorial toast exercises animate during a full run using ordinary bot inputs');
{
 const g=tutorial(6);let d=g.inspect.chainIndicator();assert.equal(d.total,2);assert.equal(d.preparing,true);
 g.inspect.beginTutorialBeat(true);const r=g.inspect.st.round;hit(g);d=g.inspect.chainIndicator();assert.equal(d.results[0],true);assert.equal(d.index,1);assert.ok(d.pulse>0);
 r.t=r.T+.5-g.inspect.reachTime()+.3;g.inspect.stepTutorial(0);
 assert.equal(g.inspect.chainIndicator().retry,true);assert.equal(g.inspect.chainIndicator().results[1],false);
 g.inspect.stepTutorial(.51);d=g.inspect.chainIndicator();assert.equal(d.preparing,true);assert.equal(d.retry,true);assert.deepEqual(Array.from(d.results),[true,false]);
 align(g);g.inspect.stepTutorial(.4);assert.equal(g.inspect.st.round.phase,'hold','retry result is readable before restarting');
 g.inspect.st.t+=1;align(g);g.inspect.stepTutorial(.4);d=g.inspect.chainIndicator();assert.equal(d.preparing,false);assert.equal(d.results.length,0);
 hit(g);hit(g);d=g.inspect.chainIndicator();assert.equal(d.finished,true);assert.equal(d.retry,false);assert.equal(d.pulseIndex,1);assert.ok(d.pulse>0,'last beat pulses after the round clock resets');
}
console.log('PASS tutorial phrase stays visible through preparation, both beats, missed-group results and whole-phrase retry');
for(const layout of [{width:1080,height:1080},{touch:true,width:844,height:390},{touch:true,width:600,height:390},{touch:true,width:390,height:844}]){
 for(const [layer,total] of [[6,2],[7,3],[8,4]]){
  const labels=[];const g=createGame({...layout,search:`?tut=0&layer=${layer}&seed=7`,onDraw:(op,args)=>{if(op==='fillText')labels.push(args[0]);}});g.tap('Enter');
  const d=g.inspect.chainIndicator();assert.equal(d.total,total);const rect=g.inspect.chainIndicatorRect();
  assert.ok(rect.x>=0&&rect.x+rect.w<=g.inspect.canvasSize.W);
  const before=JSON.stringify(g.api.state());g.render();assert.equal(JSON.stringify(g.api.state()),before);
  assert.ok(labels.includes(`连碰 ${total} 次`));assert.ok(labels.includes(String(total)));
  if(layout.touch){const c=g.sandbox.document.getElementById('c');assert.ok(86*c.width/g.inspect.canvasSize.W>=28,'phone dots are large enough to read');}
 }
}
console.log('PASS 2/3/4-note groups render large labeled markers on desktop and both phone orientations without changing gameplay');
for(const exit of ['home','skip']){
 const g=tutorial();g.key('KeyO');g.advance(50);g.key('KeyO',false);g.tap('Space');
 const m=g.inspect.st.toastMotion;g.tap('Escape');g.advance(30);assert.equal(m.t,0);assert.equal(m.fired,false);g.tap('Escape');
 if(exit==='skip')g.tap('KeyS');else {const r=g.inspect.homeButton;g.point('pointerdown',r.x+r.w/2,r.y+r.h/2);}
 g.advance(20);assert.equal(g.inspect.st.toastMotion,null);assert.equal(g.sandbox.__sounds.filter(s=>s.type==='ding').length,0);
}
console.log('PASS tutorial pause freezes contact; leaving or skipping cancels pending animation and sound');
