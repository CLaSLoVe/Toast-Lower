'use strict';
const assert = require('node:assert/strict');
const { createGame } = require('./harness.cjs');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function setup(layer = 0, offset = 0, { perfect = true, miss = false } = {}) {
  const g = createGame({ search: `?tut=0&layer=${layer}&seed=7&difficulty=hard` }); g.tap('Enter');
  const p = g.inspect.player, r = g.inspect.st.round;
  for (let i = 0; i < 120; i++) g.inspect.stepNPCs(1/60);
  r.t = .5 + r.T - g.inspect.reachTime() - offset;
  g.inspect.revealAlienTarget();
  const margin = miss ? -20 : g.inspect.perfBand()/2;
  p.P.rim.y = g.inspect.toastRimY() + margin; p.tilt = p.w = 0; p.cupRate = perfect ? 0 : 3;
  r.mh = Array.from({length:10}, (_,i)=>[g.inspect.st.t-i/60,margin,0,perfect ? 0 : 3]);
  r.cue = { next: 2, target: r.T + .5 - g.inspect.reachTime(), gap: 60/g.inspect.config.musicBpm };
  return g;
}
const serialize = g => JSON.stringify({ p:g.inspect.player.P, b:g.inspect.boss.P,
  a:g.inspect.st.alien?.leaders.map(c=>({x:c.x,P:c.P})),
  wine:g.inspect.player.wine,score:g.inspect.st.score,perfects:g.inspect.st.perfects,strikes:g.inspect.st.strikes });
test('tapping never teleports bodies or mutates the judged cup pose; drawing is isolated',()=>{
  for(const layer of [0,6,8,9,11]) {
    const g=setup(layer),p=g.inspect.player,c=g.inspect.st.round.partner;
    const before=JSON.stringify([p.P,c.P,p.x,c.x]); g.tap('Space');
    assert.equal(JSON.stringify([p.P,c.P,p.x,c.x]),before);
    const state=serialize(g),m=g.inspect.st.toastMotion;
    for(const age of [0,.02,.07,.09,.18,.28,.38]) {
      m.t=age;g.render();assert.equal(serialize(g),state,'rendering must not mutate physical cups or resources');
      const P=g.inspect.toastPose(p,p.P),B=g.inspect.toastPose(c,c.P);
      for(const key of ['hip','ankle','toe']){assert.deepEqual(P[key],p.P[key]);assert.deepEqual(B[key],c.P[key]);}
    }
  }
});
test('70 ms approach is continuous, contact holds locally, and both arms return before the next fast beat',()=>{
  for(const layer of [0,8,11]) {
    const g=setup(layer);g.tap('Space');const m=g.inspect.st.toastMotion,p=g.inspect.player,c=m.partner;
    const startP=p.P.rim.x,startB=c.P.rim.x;
    m.t=0;assert.equal(g.inspect.toastPose(p,p.P).rim.x,startP);
    m.t=.035;const mid=g.inspect.toastPose(p,p.P).rim.x;
    m.t=.07;const hit=g.inspect.toastPose(p,p.P).rim.x;
    assert.ok(mid>Math.min(startP,hit)&&mid<Math.max(startP,hit));
    assert.ok(Math.abs(g.inspect.toastPose(c,c.P).rim.x-hit-24*p.spec.scale)<1e-8);
    m.t=.105;assert.equal(g.inspect.toastPose(p,p.P).rim.x,hit,'perfect contact holds for 40 ms');
    m.t=m.duration;assert.equal(g.inspect.toastPose(p,p.P).rim.x,startP);assert.equal(g.inspect.toastPose(c,c.P).rim.x,startB);
    if(layer===8)assert.ok(m.duration<60/160,'recoil finishes before the next beat at max supported BPM');
  }
});
test('collision sound fires once at visual contact; pause and home cancel stale presentation safely',()=>{
  for(const layer of [0,8,11]) {
    const g=setup(layer);g.tap('Space');
    const count=()=>g.sandbox.__sounds.filter(s=>s.type==='perfect').length;
    assert.equal(count(),0);assert.equal(g.inspect.spillSoundSuppressed(),true);g.advance(4);assert.equal(count(),0);
    g.tap('Escape');const t=g.inspect.st.toastMotion.t;g.advance(30);assert.equal(count(),0);assert.equal(g.inspect.st.toastMotion.t,t);
    g.tap('Escape');g.advance(1);assert.equal(count(),1);g.advance(12);assert.equal(count(),1);
  }
  const g=setup();g.tap('Space');const b=g.inspect.homeButton;g.point('pointerdown',b.x+b.w/2,b.y+b.h/2);g.point('pointerup',b.x+b.w/2,b.y+b.h/2);
  g.advance(20);assert.equal(g.inspect.st.toastMotion,null);assert.ok(!g.sandbox.__sounds.some(s=>s.type==='perfect'));
});
test('perfect hold and hype never stop game time, steering, or the next musical cue',()=>{
  for(const layer of [0,8,11]) {
    const g=setup(layer);g.inspect.st.hype=99;g.tap('Space');assert.equal(g.inspect.st.freeze,0);
    const start=g.inspect.st.gameT,h=g.inspect.player.h;g.key('KeyO');g.advance(8);g.key('KeyO',false);
    assert.ok(Math.abs(g.inspect.st.gameT-start-8/60)<1e-8);assert.ok(g.inspect.player.h>h);
  }
  const g=createGame({search:'?capture=1&tut=0&seed=7&layer=8&bot=expert'});g.inspect.config.musicBpm=160;g.inspect.st.round.chainBeat=60/160;
  const r=g.inspect.st.round;
  for(let i=0;i<600&&r.phase!=='react';i++){g.sandbox.__musicClock=i/60;g.advance(1);}
  const pulses=g.sandbox.__sounds.filter(s=>s.type==='countGo');assert.equal(pulses.length,4);assert.equal(r.chainHits,4);
  for(let i=1;i<pulses.length;i++)assert.ok(Math.abs(pulses[i].t-pulses[i-1].t-.375)<1/60+1e-8);
});
test('only an all-hit group gets the larger finisher; a miss stays a whiff with the same penalty',()=>{
  for(const priorHits of [2,3]) {
    const g=setup(8),r=g.inspect.st.round;r.chainIndex=3;r.chainHits=priorHits;r.chainResults=priorHits===3?[true,true,true]:[true,false,true];
    g.tap('Space');assert.equal(g.inspect.st.toastMotion.finish,priorHits===3);
  }
  const g=setup(0,0,{miss:true});const wine=g.inspect.player.wine;g.tap('Space');
  assert.equal(g.inspect.st.toastMotion.kind,'bad');assert.ok(Math.abs(wine-g.inspect.player.wine-.20)<1e-8);
  const state=serialize(g);g.inspect.stepToastMotion(.08);g.render();assert.equal(serialize(g),state);
  assert.ok(!g.sandbox.__sounds.some(s=>s.type==='perfect'||s.type==='ding'));
});
console.log(`${checks}/${checks} gesture checks passed`);
