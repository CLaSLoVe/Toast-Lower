'use strict';
const assert=require('node:assert/strict'),{createGame}=require('./harness.cjs');
function fresh(options={}){return createGame({search:'?seed=7',storage:{toast_mute:'1'},...options});}
function lesson(g,step){g.tap('Enter');Object.assign(g.inspect.st.tut,{step,sub:0,t:0,acc:0,enter:true});g.inspect.stepTutorial(0);}
function place(g){const r=g.inspect.st.round,p=g.inspect.player;p.P.rim.y=g.inspect.toastRimY()+g.inspect.perfBand()/2;p.w=p.tilt=p.cupRate=0;return r;}
function hit(g){const r=place(g);r.t=r.T+.5-g.inspect.reachTime();g.tap('Space');}
function click(g,r,portrait=false){const cv=g.sandbox.document.getElementById('c'),rect=cv.getBoundingClientRect(),{W,H}=g.inspect.canvasSize,x=r.x+r.w/2,y=r.y+r.h/2;
 if(portrait)g.canvasDispatch('pointerdown',{pointerId:9,clientX:rect.left+(1-y/H)*rect.width,clientY:rect.top+x/W*rect.height});
 else g.point('pointerdown',x,y,9);
}
{
 const g=fresh();assert.equal(g.inspect.st.state,'play');assert.equal(g.api.tut().step,0);assert.equal(g.inspect.boss.spec.mom,true);
 g.advance(600);assert.equal(g.api.tut().step,0);assert.equal(g.api.tut().sub,0);assert.equal(g.sandbox.__sounds.filter(s=>s.type.startsWith('count')).length,0);
 assert.equal(g.storage.has('toastLower.tutorial.v2'),false);assert.equal(g.storage.has('toastLower.guides.seen.v1'),false,'opening Mom cannot consume a real-stage hint');
 g.tap('KeyS');assert.equal(g.api.tut(),null);assert.equal(g.storage.get('toastLower.tutorial.v2'),'skipped');
 assert.equal(fresh({storage:Object.fromEntries(g.storage)}).inspect.st.state,'title');
 assert.equal(fresh({storage:{'toastLower.tutDone':'1'}}).inspect.st.state,'title','legacy completion is respected');
 for(const query of ['?tut=0','?capture=1','?auto=1','?bot=expert','?layer=6'])assert.equal(fresh({search:query}).api.tut(),null,query);
 const abandoned=fresh();const home=abandoned.inspect.homeButton;click(abandoned,home);assert.equal(abandoned.storage.has('toastLower.tutorial.v2'),false);abandoned.tap('Enter');assert.ok(abandoned.api.tut());
}
console.log('PASS fresh users automatically meet Mom; explicit skip/completion and abandoned sessions are distinguished');
for(const portrait of [false,true]){
 const g=fresh({touch:true,width:portrait?390:844,height:portrait?844:390});
 assert.ok(g.inspect.st.tut.msg.includes('左手'));assert.ok(g.inspect.st.tut.msg.includes('左右扶杯'));
 const sr=g.inspect.stickGeometry;
 if(portrait){const cv=g.sandbox.document.getElementById('c'),r=cv.getBoundingClientRect(),{W,H}=g.inspect.canvasSize;g.canvasDispatch('pointerdown',{pointerId:1,clientX:r.left+(1-(sr.y+.5*sr.r)/H)*r.width,clientY:r.top+sr.x/W*r.height});}
 else g.point('pointerdown',sr.x,sr.y+.5*sr.r,1);
 const start=g.inspect.player.h;g.advance(55);assert.notEqual(g.inspect.player.h,start);assert.equal(g.api.tut().sub,1);assert.ok(g.inspect.st.tut.msg.includes('右手点敬酒'));
 g.canvasDispatch('pointerup',{pointerId:1});click(g,g.inspect.activeButton,portrait);assert.equal(g.api.tut().sub,2);assert.equal(g.inspect.st.score,0);
 g.advance(32);assert.equal(g.api.tut().step,1);
 click(g,g.inspect.tutorialSkipButton,portrait);assert.equal(g.api.tut(),null);assert.equal(g.storage.get('toastLower.tutorial.v2'),'skipped');
}
console.log('PASS landscape and rotated portrait: left-hand movement first, right-hand contact second, large working skip target');
{
 const g=fresh();lesson(g,3);let tilt=0,minWine=1;
 for(let i=0;i<3600;i++){g.advance(1);tilt=Math.max(tilt,Math.abs(g.inspect.player.tilt));minWine=Math.min(minWine,g.inspect.player.wine);}
 assert.equal(g.api.tut().step,3);assert.equal(g.inspect.st.tut.countered,false);assert.ok(tilt>.3);assert.ok(minWine<.8);assert.equal(g.inspect.st.state,'play');
 g.key('KeyQ');g.advance(3);g.key('KeyQ',false);assert.equal(g.inspect.st.tut.countered,true);
}
console.log('PASS unattended cup visibly leans and actually spills; Mom replenishes juice but idle time never passes balancing');
for(const mode of ['easy','normal','hard']) {
 const g=createGame({search:`?tut=1&capture=1&bot=expert&seed=7&difficulty=${mode}`}),seen=new Set();
 for(let i=0;i<60*90&&g.api.tut();i++){seen.add(g.api.tut().step);g.advance(1);}
 assert.equal(g.api.tut(),null);assert.deepEqual([...seen],[0,1,2,3,4,5,6,7]);
 assert.equal(g.storage.get('toastLower.tutorial.v2'),'completed');assert.equal(g.api.state().difficulty.id,mode);
 assert.equal(g.inspect.st.L,0);assert.equal(g.inspect.st.score,0);assert.equal(g.inspect.st.strikes,0);assert.equal(g.inspect.player.wine,g.inspect.wineCapacity());
}
console.log('PASS all selected difficulties complete every exercise through ordinary bot inputs and begin with fresh resources');
{
 const g=fresh();lesson(g,5);g.advance(180);assert.equal(g.inspect.st.round.phase,'hold','no countdown until height is ready');
 place(g);for(let i=0;i<23;i++)g.inspect.stepTutorial(1/60);assert.equal(g.inspect.st.round.phase,'aim');assert.ok(g.api.dbg().inputLeft<=2.01);
 const time=g.inspect.st.round.t;g.tap('Escape');g.advance(120);assert.equal(g.inspect.st.round.t,time);g.tap('Escape');
}
{
 const g=fresh();lesson(g,6);g.inspect.beginTutorialBeat(true);const r=g.inspect.st.round,target=r.target,first=r.T;
 r.t=r.T+.5-g.inspect.reachTime()+.23;g.inspect.stepTutorial(0);
 assert.equal(r.chainIndex,1);assert.equal(r.phase,'aim');assert.equal(r.chainResults[0],false);assert.equal(r.target,target);assert.ok(Math.abs(r.T-first-60/126)<1e-9);
 hit(g);assert.equal(r.chainHits,1);assert.equal(r.phase,'react');g.inspect.stepTutorial(.51);
 assert.equal(g.api.tut().step,6);assert.equal(g.inspect.st.round.target,target);assert.equal(g.inspect.st.round.phase,'hold');
 g.inspect.beginTutorialBeat(true);hit(g);assert.equal(g.inspect.st.round.chainIndex,1);hit(g);g.inspect.stepTutorial(.51);
 assert.equal(g.api.tut().step,7);assert.equal(g.inspect.st.score,0);assert.equal(g.inspect.st.strikes,0);assert.equal(g.inspect.st.perfects,0);
}
console.log('PASS height-ready two-second countdown; chain missed beat preserves spacing, full phrase required, no real score/penalty');
{
 const g=fresh();g.sandbox.localStorage.setItem=()=>{throw Error('blocked storage');};g.tap('KeyS');assert.equal(g.api.tut(),null);
 click(g,g.inspect.homeButton);g.tap('Enter');assert.equal(g.api.tut(),null,'same-session skip survives disabled storage');
}
console.log('PASS storage rejection cannot break skip or force the same-session tutorial again');

for (const layout of [{touch:false,width:1080,height:1080},{touch:true,width:844,height:390},{touch:true,width:390,height:844}]) {
 const g=createGame({search:'?tut=0',storage:{'toastLower.tutorial.v2':'completed'},...layout});
 const r=g.inspect.titleTutorialButton, start=g.inspect.titleStartButton;
 assert.ok(r.y>start.y+start.h);assert.ok(r.w>=560);assert.ok(r.h>=120);
 // Desktop title hit areas use the 1080 overlay; these dimensions share its coordinates.
 click(g,r);assert.ok(g.api.tut());assert.equal(g.inspect.boss.spec.mom,true);

}
console.log('PASS prominent home entry replays Mom despite saved completion and tut=0');

function toggleTutorial(g,enabled) {
 g.inspect.openPlayerSettings();const opts=g.inspect.settings;
 opts.onChange(opts.values,opts.muted,enabled);opts.onClose();
}
{
 const g=fresh();g.tap('KeyS');g.inspect.openPlayerSettings();assert.equal(g.inspect.settings.guides,false);g.inspect.settings.onClose();
 toggleTutorial(g,true);click(g,g.inspect.homeButton);g.tap('Enter');assert.ok(g.api.tut());
 g.tap('KeyS');click(g,g.inspect.homeButton);g.tap('Enter');assert.ok(g.api.tut(),'manual on survives completion/skip');
 assert.ok(fresh({storage:Object.fromEntries(g.storage)}).api.tut(),'manual preference persists across reload');
 toggleTutorial(g,false);g.tap('KeyS');click(g,g.inspect.homeButton);g.tap('Enter');assert.equal(g.api.tut(),null);
 assert.equal(fresh({storage:Object.fromEntries(g.storage)}).api.tut(),null);
 const old=fresh({storage:{'toastLower.tutDone':'1'}});old.inspect.openPlayerSettings();assert.equal(old.inspect.settings.guides,false);
 const title=createGame({search:'?tut=0',storage:{'toastLower.tutorial.v2':'completed'}});
 toggleTutorial(title,true);title.tap('Enter');assert.ok(title.api.tut(),'explicit setting wins on a new start even with old tut=0 link');
}
console.log('PASS tutorial toggle: automatic onboarding switches off, explicit on/off persists and controls later starts');
