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
 assert.ok(Math.abs(r.T-T-beat)<1e-8);assert.ok(Math.abs(p.wine-(wine-.12))<1e-8);
 r.result='ok';g.inspect.finishToastAttempt();r.result='ok';g.inspect.finishToastAttempt();
 assert.equal(r.phase,'react');assert.equal(r.chainHits,3);assert.equal(p.wine,wine-.12);
 g.inspect.newRound(false);assert.ok(Math.abs(p.wine-(wine-.12+.03))<1e-8);
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
  a.leaders.forEach((c,i)=>assert.ok(Math.abs(c.P.rim.x-before[i])<.1,'announcement does not move a leader'));
  r.t=r.T+.5-g.inspect.reachTime();g.inspect.stepNPCs(1/60);
  a.leaders.forEach((c,i)=>assert.ok(Math.abs(c.P.rim.x-before[i])<.1,'movement begins at zero'));
  r.t+=.3;g.inspect.stepNPCs(1/60);
  a.leaders.forEach((c,i)=>{if(i===choice)assert.ok(c.P.rim.x<before[i]-30);else assert.ok(Math.abs(c.P.rim.x-before[i])<.1);assert.ok(Math.abs(c.P.rim.y-r.base-i*a.step)<1e-7);});
  labels.length=0;g.render();assert.equal(labels.filter(s=>/^\d+\.\d+s$/.test(s)).length,1);
 }
});
test('alien countdown keeps two full seconds; silent target and guide reveal together',()=>{
 for(const mode of ['easy','normal','hard']) for(const layer of [9,10,11]) for(const bpm of [90,126,160]) {
  const calls=[];
  const g=createGame({search:`?capture=1&tut=0&seed=7&layer=${layer}&difficulty=${mode}`,
    onDraw(key,args){calls.push([key,args]);}});
  g.inspect.config.musicBpm=bpm;
  const r=g.inspect.st.round,a=g.inspect.st.alien;
  assert.ok(Math.abs(g.api.dbg().inputLeft-2)<1e-8);
  assert.ok(!g.inspect.bubbles.some(b=>b.chapterChat),'no chatter on a new countdown');
  g.sandbox.__musicClock=.173;g.advance(1);
  assert.ok(Math.abs(r.T+.5-g.inspect.reachTime()-2)<1e-8);
  const zero=r.musicAnchor+2,beat=60/bpm;
  assert.ok(Math.abs(zero/beat-Math.round(zero/beat))<1e-8);
  const check=(left,count,guide)=>{
   g.sandbox.__musicClock=zero-left;g.inspect.stepRound(1/60);calls.length=0;g.render();
   assert.equal(a.revealed,guide);
   assert.equal(calls.filter(([k,v])=>k==='fillText'&&/^\d+\.\d+s$/.test(v[0])).length,count);
   assert.equal(calls.some(([k,v])=>k==='setLineDash'&&String(v[0])==='18,12'),guide);
  };
  if(r.clockWaiting){calls.length=0;g.render();assert.equal(calls.filter(([k,v])=>k==='fillText'&&/^\d+\.\d+s$/.test(v[0])).length,0,'no frozen clock before the countdown');}
  check(1.9,3,false);check(1.01,3,false);check(1,1,true);
  assert.equal(g.inspect.bubbles.length,0,'target reveal never speaks');
  g.sandbox.__musicClock=zero+.001;g.inspect.stepRound(1/60);assert.equal(g.inspect.bubbles.length,0);
 }
});
test('settlement retains difficulty, perfects and misses on desktop and mobile',()=>{
 for(const touch of [false,true]) {
  const labels=[];const g=createGame({touch,width:touch?844:1080,height:touch?390:1080,
   search:'?capture=1&tut=0&difficulty=hard',onDraw(k,a){if(k==='fillText')labels.push(a[0]);}});
  Object.assign(g.inspect.st,{perfects:7,strikes:3,bestCombo:8});g.inspect.gameOver('beer');g.advance(150);g.render();
  assert.ok(labels.some(s=>s.endsWith('高难 · 35岁，杯杯是房贷')));
  for (const stat of ['最高 8 连敬', '完美 7 次', '失误 3 次']) assert.ok(labels.some(s=>s.includes(stat)));
 }
});
test('all revealed heights are reachable using ordinary controls at all supported tempos',()=>{
 for(const mode of ['easy','normal','hard']) for(const layer of [9,10,11]) for(const bpm of [90,126,160]) for(const choice of [0,1,2]) {
  const g=game(layer,`&bot=expert&difficulty=${mode}`),r=g.inspect.st.round;g.inspect.config.musicBpm=bpm;r.alienChoice=choice;
  for(let f=0;f<400&&g.inspect.contacts.length===0;f++){g.sandbox.__musicClock=f/60;g.advance(1);}
  const c=g.inspect.contacts[0];assert.ok(c,`${mode}/${layer}/${bpm}/${choice} attempted`);assert.equal(c.revealed,true);
  assert.equal(c.result,'ok',`${mode}/${layer}/${bpm}/${choice}: ${c.result}`);
 }
});
test('explicit seeds repeat, ordinary restarts vary, repeated leaders and retry targets are allowed',()=>{
 const choices=g=>Array.from(g.inspect.st.floorPlan.targets,t=>t.alienChoice).join(',');
 assert.equal(choices(game(9)),choices(game(9)));
 const g=createGame({search:'?capture=1&tut=0&layer=9'}), sequences=new Set();
 for(let n=0;n<12;n++){g.tap('KeyR');sequences.add(choices(g));}
 assert.ok(sequences.size>1,'ordinary restarts create new target plans');
 let repeat=false;
 for(let seed=0;seed<30;seed++) {
  const g=createGame({search:`?capture=1&tut=0&seed=${seed}&layer=9`});
  const c=Array.from(g.inspect.st.floorPlan.targets,t=>t.alienChoice);
  repeat ||= c.some((v,i)=>i>0&&v===c[i-1]);
  const target=g.inspect.st.round.alienChoice;g.inspect.st.round.result='strike';g.inspect.newRound(false);
  assert.equal(g.inspect.st.round.alienChoice,target);
 }
 assert.ok(repeat,'independent choices allow adjacent duplicates');
});
test('chapter chatter is sparse, distinct, visible on both devices, and silent during cues',()=>{
 for(const touch of [false,true]) {
  const spoken=[],drawn=[];
  const g=createGame({touch,width:touch?844:1080,height:touch?390:1080,
   search:'?capture=1&tut=0&seed=20261022&bot=expert&difficulty=hard',
   onDraw(k,a){if(k==='fillText')drawn.push(a[0]);}});
  const smashes=[];let previous=null;
  for(let f=0;f<16000&&g.inspect.st.L<12;f++) {
   g.advance(1);const st=g.inspect.st,r=st.round;
   if(st.punch&&st.punch!==previous){
    smashes.push(st.punch.word);previous=st.punch;g.render();
    assert.ok(!g.inspect.bubbles.some(b=>b.zh===st.punch.word),'impact text is not duplicated in a speech bubble');
   }
   const b=g.inspect.bubbles.find(b=>b.chapterChat);
   if(b&&!spoken.some(x=>x.b===b))spoken.push({b,layer:st.L,phase:r.phase,chainIndex:r.chainIndex});
   if(r&&r.phase==='aim'&&!r.smash&&(st.alien||r.chain)) {
    const left=g.api.dbg().inputLeft;
    if(left<=(st.alien?1:2*r.chainBeat)-.001)assert.ok(!b,'no chatter during the cue sequence');
   }
   if(b)g.render();
  }
  assert.equal(g.inspect.st.L,12,'hard campaign still clears');
  const texts=spoken.map(x=>x.b.zh);assert.equal(new Set(texts).size,texts.length,'no repeated chapter chatter');
  assert.equal(texts.filter(x=>x==='再喝五百年！').length,1);
  for(let layer=6;layer<12;layer++){const count=spoken.filter(x=>x.layer===layer).length;assert.ok(count>=1&&count<=2,'one or two lines in every chapter room');}
  assert.ok(spoken.every(x=>x.phase==='react'),'chatter starts after completed attempts');
  for(const x of spoken)assert.ok(drawn.includes(x.b.zh),`visible ${touch?'mobile':'desktop'}: ${x.b.zh}`);
  assert.equal(smashes.filter(x=>x==='下面还有高手？！').length,1);
  assert.equal(smashes.filter(x=>x==='面子碎了！！').length,1);
  assert.equal(smashes.length,12,'every story floor has an impact line');
  assert.equal(new Set(smashes).size,12,'no repeated impact lines');
  assert.equal(smashes[1],'我说低调！不是地窖！！','cellar joke belongs at the cellar entrance');
  assert.equal(smashes[11],'还有谁！！','final smash is the closing challenge');
  for(const line of smashes)assert.ok(drawn.includes(line),`impact rendered on ${touch?'mobile':'desktop'}: ${line}`);
 }
});
test('alien chatter does not depend on the selected leader and is cleared on reveal',()=>{
 const original=Math.random;Math.random=()=>.42;
 try {
  const results=[];
  for(const choice of [0,1,2]) {
   const g=game(9),st=g.inspect.st,r=st.round;
   st.chatSeen=['这两位都是上面的。'];r.alienChoice=choice;
   r.phase='react';r.result='ok';r.t=.2;g.inspect.stepChapterChatter();
   results.push([g.inspect.bubbles[0].zh,st.alien.leaders.indexOf(g.inspect.bubbles[0].c)]);
   r.phase='aim';r.t=r.T+.5-g.inspect.reachTime()-1;g.inspect.revealAlienTarget();
   assert.equal(g.inspect.bubbles.length,0);
  }
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
 } finally { Math.random=original; }
});
console.log(`${checks}/${checks} chapter checks passed`);
