'use strict';
const assert = require('node:assert/strict');
const {createGame} = require('./harness.cjs');
let checks=0;
function test(name, run) { run(); checks++; console.log('PASS '+name); }
function game(layer=0, extra='') { return createGame({search:`?capture=1&tut=0&seed=7&layer=${layer}${extra}`}); }
test('twelve rooms form four distinct chapters followed by endless',()=>{
 for(let i=0;i<=12;i++) {const g=game(i); const s=g.api.state(); assert.equal(s.storyRooms,12);assert.equal(s.ch,Math.floor(i/3)); assert.equal(s.mech,['basic','shake','chain','alien','shake'][Math.floor(i/3)]);}
});
test('tomb phrases share fixed height and one uninterrupted musical timeline',()=>{
 for(const layer of [6,7,8]) for(const bpm of [90,126,160]) {
  const g=game(layer,'&bot=expert');g.inspect.config.musicBpm=bpm;
  const r=g.inspect.st.round; r.chainBeat=60/bpm;
  let lastHeight=null;
  for(let f=0;f<600&&r.phase!=='react';f++) {
   g.sandbox.__musicClock=f/60;g.advance(1);
   const height=g.inspect.toastRimY();if(lastHeight!==null)assert.ok(Math.abs(height-lastHeight)<1e-8);lastHeight=height;
   if(r.chainIndex>0&&r.phase==='aim')assert.equal(g.inspect.st.freeze,0);
  }
  assert.equal(r.chainResults.length,layer-4);assert.equal(r.chainHits,layer-4);
  const notes=g.sandbox.__sounds.filter(x=>x.type==='countGo');
  assert.equal(notes.length,r.chain);
  for(let i=1;i<notes.length;i++)assert.ok(Math.abs(notes[i].t-notes[i-1].t-60/bpm)<1/60+1e-8);
  assert.equal(g.sandbox.__sounds.filter(x=>x.type==='count').length,2,'one preparation for the whole phrase');
 }
});
test('missing a middle note costs wine once, does not reset the phrase or refill it',()=>{
 const g=game(8),r=g.inspect.st.round,p=g.inspect.player;
 r.t=r.T+0.5+0.01; // first note just beyond contact time
 r.cue={target:r.T+0.5-g.inspect.reachTime(),gap:r.chainBeat,next:3};
 r.result='ok';g.inspect.finishToastAttempt();
 const target=r.target,beat=r.chainBeat,T=r.T,wine=p.wine;
 g.inspect.strike(null,null,'late');g.inspect.finishToastAttempt();
 assert.equal(r.chainIndex,2);assert.equal(r.phase,'aim');assert.equal(r.target,target);
 assert.ok(Math.abs(r.T-T-beat)<1e-8);assert.ok(Math.abs(p.wine-(wine-.2))<1e-8);
 r.result='ok';g.inspect.finishToastAttempt();r.result='ok';g.inspect.finishToastAttempt();
 assert.equal(r.phase,'react');assert.equal(r.chainHits,3);assert.equal(p.wine,wine-.2);
 g.inspect.newRound(false);assert.ok(Math.abs(p.wine-(wine-.2+.03))<1e-8);
});
test('alien targets are concealed, revealed one second before zero, then remain fixed',()=>{
 for(const layer of [9,10,11]) for(const bpm of [90,126,160]) for(const choice of [0,1,2]) {
  const g=game(layer),r=g.inspect.st.round,a=g.inspect.st.alien;g.inspect.config.musicBpm=bpm;r.alienChoice=choice;
  const target=r.T+.5-g.inspect.reachTime(),initial=r.target;
  r.t=target-1-.001;g.inspect.revealAlienTarget();
  assert.equal(a.revealed,false);assert.equal(a.cup,1);assert.equal(r.target,initial);assert.equal(g.inspect.canToast(),false);
  r.t+=.002;g.inspect.revealAlienTarget();assert.equal(a.revealed,true);assert.equal(a.cup,choice);
  assert.equal(r.target,r.base+choice*a.step); const picked=r.target;
  r.alienChoice=(choice+1)%3;r.t+=.1;g.inspect.revealAlienTarget();assert.equal(r.target,picked);
 }
});
test('three independent leaders hold distinct heights and only the chosen leader approaches',()=>{
 for(const layer of [9,10,11]) for(const choice of [0,1,2]) {
  const labels=[];
  const g=createGame({search:`?capture=1&tut=0&seed=7&layer=${layer}`,onDraw(key,args){if(key==='fillText')labels.push(args[0]);}}),r=g.inspect.st.round,a=g.inspect.st.alien;
  assert.equal(new Set(a.leaders).size,3);
  assert.equal(a.leaders[0],g.inspect.boss);assert.ok(!a.leaders[0].spec.alien);
  assert.notEqual(a.leaders[1].spec.planet,a.leaders[2].spec.planet);
  for(let f=0;f<120;f++)g.inspect.stepNPCs(1/60);
  const before=a.leaders.map(c=>c.P.rim.x);
  a.leaders.forEach((c,i)=>{
   assert.ok(Math.abs(c.P.rim.y-r.base-i*a.step)<1e-7);
   assert.equal(g.inspect.alienRimX(i),c.P.rim.x);assert.equal(g.inspect.alienRimY(i),c.P.rim.y);
  });
  labels.length=0;g.render();assert.equal(labels.filter(s=>/^\d+\.\d+s$/.test(s)).length,3);
  r.alienChoice=choice;r.t=r.T+.5-g.inspect.reachTime()-.8;g.inspect.revealAlienTarget();
  assert.equal(r.partner,a.leaders[choice]);
  for(let f=0;f<45;f++)g.inspect.stepNPCs(1/60);
  a.leaders.forEach((c,i)=>{if(i===choice)assert.ok(c.P.rim.x<before[i]-30);else assert.ok(Math.abs(c.P.rim.x-before[i])<.1);});
  labels.length=0;g.render();assert.equal(labels.filter(s=>/^\d+\.\d+s$/.test(s)).length,1);
 }
});
test('all revealed heights are reachable using ordinary controls at all supported tempos',()=>{
 for(const layer of [9,10,11]) for(const bpm of [90,126,160]) for(const choice of [0,1,2]) {
  const g=game(layer,'&bot=expert'),r=g.inspect.st.round;g.inspect.config.musicBpm=bpm;r.alienChoice=choice;
  for(let f=0;f<400&&g.inspect.contacts.length===0;f++){g.sandbox.__musicClock=f/60;g.advance(1);}
  const c=g.inspect.contacts[0];assert.ok(c,`${layer}/${bpm}/${choice} attempted`);assert.equal(c.revealed,true);
  assert.equal(c.result,'ok',`${layer}/${bpm}/${choice}: ${c.result}`);
 }
});
console.log(`${checks}/${checks} chapter checks passed`);
