'use strict';
const assert=require('node:assert/strict'), {createGame}=require('./harness.cjs');
function hit(g, perfect=true) {
 const {st,player:p}=g.inspect,r=st.round,m=perfect?g.inspect.perfBand()/2:g.inspect.winSpan()*.8;
 p.P.rim.y=g.inspect.toastRimY()+m;p.tilt=p.w=p.cupRate=0;p.wine=.8;
 r.manual=true;r.t=r.T+.5-g.inspect.reachTime();r.mh=perfect?Array.from({length:10},(_,i)=>[st.t-i/60,m,0,0]):[];
 g.inspect.judgeClink();
}
function miss(g) { g.inspect.player.wine=.8;g.inspect.strike(null,null,'late');g.inspect.finishToastAttempt(); }
function scoreRun(kind) {
 const g=createGame({search:'?capture=1&bot=none&tut=0&seed=7'});let note=0;
 for(let layer=0;layer<12;layer++) {
  assert.equal(g.inspect.st.L,layer);assert.equal(g.inspect.st.state,'play');
  while(!g.inspect.st.round.smash){
   const r=g.inspect.st.round,n=r.chain||1;
   for(let i=0;i<n;i++){const fail=kind==='misses'&&note++%4!==0;if(fail)miss(g);else hit(g,kind==='perfect');}
   const passed=g.inspect.roundSucceeded(r);g.inspect.newRound(false);
   if(!passed){for(let i=0;i<n;i++)hit(g);g.inspect.newRound(false);}
  }
  g.inspect.breakFloor();
  for(let f=0;f<600&&['fall','standup'].includes(g.inspect.st.state);f++)g.advance(1);
 }
 return Math.round(g.inspect.st.score);
}
(async()=>{
 for(const n of [2,3,4]) {
  const g=createGame({search:`?capture=1&bot=none&tut=0&layer=${n+4}`});const original=g.inspect.st.round;
  hit(g);for(let i=1;i<n;i++)miss(g);
  const score=g.inspect.st.score, refills=g.inspect.st.wineLedger?.refill||0, target=original.target;
  assert.equal(g.inspect.roundSucceeded(original),false);g.inspect.player.wine=.4;
  g.inspect.newRound(false);assert.equal(g.inspect.st.round.progress,0);assert.equal(g.inspect.st.round.target,target);
  assert.ok(g.inspect.st.wineLedger.refill>refills,'partial group retains its one refill');
  for(let i=0;i<n;i++)hit(g);
  assert.equal(g.inspect.st.score,score,'retry cannot reclaim scored opportunities');
  g.inspect.newRound(false);assert.equal(g.inspect.st.round.progress,1);
 }
 console.log('PASS partial 2/3/4-note groups retry the same target; only a complete phrase advances');
 const perfect=scoreRun('perfect'),ordinary=scoreRun('ordinary'),misses=scoreRun('misses');
 assert.ok(perfect>ordinary*1.7);assert.ok(misses<perfect*.35);
 const ranks=createGame().sandbox.ToastRules;
 assert.equal(ranks.rankFor(ordinary)[0],'敬酒悍匪');assert.equal(ranks.rankFor(perfect)[0],'DeepDrink');assert.equal(ranks.rankFor(misses)[0],'懂事长');
 console.log(`PASS performance separation (controlled wine): perfect ${perfect}, ordinary ${ordinary}, 75% first-attempt misses ${misses}`);
 let track,plays=0,pauses=0,pending=[];
 class Audio {
  constructor(){track=this;this.paused=true;this.currentTime=0;}
  pause(){pauses++;this.paused=true;}
  play(){plays++;return new Promise((resolve,reject)=>pending.push({resolve:()=>{this.paused=false;resolve();},reject}));}
 }
 const settle=async()=>{await Promise.resolve();await Promise.resolve();};
 const g=createGame({search:'?tut=0&seed=7',storage:{toast_mute:'0'},Audio,realMusic:true});
 g.tap('Enter');pending.shift().resolve();await settle();const startPlays=plays,startPauses=pauses;
 track.currentTime=12;
 Object.assign(g.inspect.st,{L:11,breaks:12,state:'fall'});g.inspect.beginStandup();
 assert.equal(g.inspect.st.state,'clear');assert.equal(track.paused,false);assert.equal(pauses,startPauses);
 g.tap('Enter');g.advance(30);assert.equal(g.inspect.st.state,'play');assert.equal(g.inspect.st.L,12);
 assert.equal(plays,startPlays);assert.equal(track.paused,false);assert.equal(track.currentTime,12);
 g.tap('Escape');assert.equal(track.paused,true);g.tap('Escape');const old=pending.shift();
 g.tap('Escape');g.tap('Escape');const current=pending.shift();assert.ok(current,'new request is not held by aborted old request');
 old.reject(Object.assign(Error('interrupted'),{name:'AbortError'}));await settle();current.resolve();await settle();
 g.frame(16);assert.equal(track.paused,false);assert.notEqual(g.sandbox.ToastMusic.clock(),null);
 console.log('PASS real music + game integration: clear/endless continuity and stale play rejection recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
