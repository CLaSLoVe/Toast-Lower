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
test('alien targets are concealed, revealed two beats before zero, then remain fixed',()=>{
 for(const layer of [9,10,11]) for(const bpm of [90,126,160]) for(const choice of [0,1,2]) {
  const g=game(layer),r=g.inspect.st.round,a=g.inspect.st.alien;g.inspect.config.musicBpm=bpm;r.alienChoice=choice;
  const target=r.T+.5-g.inspect.reachTime(),initial=r.target;
  r.t=target-2*60/bpm-.001;g.inspect.revealAlienTarget();
  assert.equal(a.revealed,false);assert.equal(a.cup,1);assert.equal(r.target,initial);assert.equal(g.inspect.canToast(),false);
  r.t+=.002;g.inspect.revealAlienTarget();assert.equal(a.revealed,true);assert.equal(a.cup,choice);
  assert.equal(r.target,r.base+choice*a.step); const picked=r.target;
  r.alienChoice=(choice+1)%3;r.t+=.1;g.inspect.revealAlienTarget();assert.equal(r.target,picked);
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
