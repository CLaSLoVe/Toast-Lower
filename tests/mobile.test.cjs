'use strict';
const assert = require('node:assert/strict');
const {createGame} = require('./harness.cjs');
let n=0;
function test(name,fn){fn();console.log('PASS '+name);n++;}
function mobile(view='landscape'){const g=createGame({search:`?tut=0&seed=7&view=${view}`});g.tap('Enter');return g;}
function stick(g,x,y,id=1,type='pointerdown'){const r=g.inspect.stickGeometry;g.point(type,r.x+x*r.r,r.y+y*r.r,id);}
test('analog diagonal controls are independent, bounded and have a center deadzone',()=>{
 for(const view of ['portrait','landscape']) {
  const g=mobile(view);stick(g,.05,.05);assert.equal(g.api.state().keys.W,0);assert.equal(g.api.state().keys.O,0);
  stick(g,.5,.5,1,'pointermove');let k=g.api.state().keys;assert.ok(k.W>0&&k.W<.5);assert.ok(Math.abs(k.W-k.O)<1e-10);assert.equal(k.Q+k.P,0);
  stick(g,-4,0,1,'pointermove');k=g.api.state().keys;assert.equal(k.Q,1);assert.equal(k.W+k.O+k.P,0);
  stick(g,0,-1,1,'pointermove');assert.ok(Math.abs(g.api.state().keys.P-1)<1e-10);
 }
});
test('two thumbs remain independent; holding or sliding the toast finger never repeats a toast',()=>{
 const g=mobile();g.advance(24);stick(g,-.4,.6);const before={...g.api.state().keys};
 g.actionPointer('pointerdown',2);assert.equal(g.inspect.st.round.attempts,1);assert.equal(g.api.state().keys.Q,before.Q);assert.equal(g.api.state().keys.O,before.O);
 stick(g,1,0,2,'pointermove');assert.equal(g.api.state().keys.Q,before.Q,'toast finger cannot steal stick');
 g.advance(8);assert.equal(g.inspect.st.round.attempts,1);g.actionPointer('pointerup',2);assert.equal(g.api.state().keys.Space,0);assert.equal(g.api.state().keys.O,before.O);
 stick(g,0,0,1,'pointerup');assert.ok(Object.values(g.api.state().keys).every(v=>!v));
});
test('stick cancellation, focus loss, pause, restart and rotation release every axis',()=>{
 for(const release of ['pointerup','pointercancel','lostpointercapture','blur','pause','restart','resize','orientationchange']) {
  const g=mobile();stick(g,.6,.6);
  if(release==='pause')g.tap('Escape');else if(release==='restart')g.tap('KeyR');else if(['blur','resize','orientationchange'].includes(release))g.dispatch(release);else stick(g,0,0,1,release);
  assert.equal(g.inspect.stick.id,null,release);assert.ok(Object.values(g.api.state().keys).every(v=>!v),release);
  stick(g,1,1,1,'pointermove');assert.ok(Object.values(g.api.state().keys).every(v=>!v),'stale movement must not restore input');
 }
});
test('light push moves more slowly, release coasts, opposite push brakes',()=>{
 const light=mobile(),full=mobile();stick(light,.45,.45);stick(full,.7,.7);light.advance(12);full.advance(12);
 assert.ok(full.inspect.player.vh>light.inspect.player.vh*1.4);assert.ok(full.inspect.player.vtilt>light.inspect.player.vtilt*1.4);
 const v=full.inspect.player.vh,h=full.inspect.player.h;stick(full,0,0,1,'pointerup');full.advance(1);
 assert.ok(full.inspect.player.vh>0&&full.inspect.player.vh<v);assert.ok(full.inspect.player.h>h);
 stick(full,0,-1);full.advance(4);assert.ok(full.inspect.player.vh<0);
});
test('a second left finger cannot take over; sliding into toast never fires it',()=>{
 const g=mobile();g.advance(24);stick(g,.4,.4);stick(g,-1,-1,3);const a=g.inspect.activeButton;
 g.point('pointermove',a.x+a.w/2,a.y+a.h/2,1);assert.ok(!g.inspect.st.round.attacking);
 g.point('pointerup',a.x,a.y,3);assert.equal(g.inspect.stick.id,1);g.render();
});
test('phone controls fit the landscape canvas',()=>{
 for(const view of ['portrait','landscape']) {const g=mobile(view),r=g.inspect.stickGeometry,b=g.inspect.activeButton,{W,H}=g.inspect.canvasSize;
 assert.ok(r.x-r.hit>=0&&r.y+r.hit<=H);assert.ok(b.x>r.x+r.hit&&b.x+b.w<=W&&b.y+b.h<=H);g.render();}
});
test('portrait lock rotates the game and maps physical two-thumb touches correctly',()=>{
 const g=createGame({touch:true,width:390,height:844,search:'?tut=0&seed=7'}),cv=g.sandbox.document.getElementById('c');
 assert.equal(cv.style.transform,'rotate(90deg)');assert.equal(g.api.state().lay,'land');
 const rect=cv.getBoundingClientRect();assert.ok(rect.width<=390&&rect.height<=844);
 // The visible center of the start button is on the physical left after a clockwise rotation.
 const start=g.inspect.titleStartButton;
 g.canvasDispatch('pointerdown',{pointerId:9,clientX:390*(1-(start.y+start.h/2)/1080),clientY:844/2});
 assert.equal(g.api.state().state,'play');g.advance(24);
 const r=g.inspect.stickGeometry,{W,H}=g.inspect.canvasSize;
 g.canvasDispatch('pointerdown',{pointerId:1,clientX:rect.left+(1-(r.y+.5*r.r)/H)*rect.width,clientY:rect.top+(r.x+.5*r.r)/W*rect.height});
 let k=g.api.state().keys;assert.ok(k.O>0&&k.W>0);assert.ok(Math.abs(k.O-k.W)<1e-10);
 const b=g.inspect.activeButton;
 g.canvasDispatch('pointerdown',{pointerId:2,clientX:rect.left+(1-(b.y+b.h/2)/H)*rect.width,clientY:rect.top+(b.x+b.w/2)/W*rect.height});
 assert.equal(g.inspect.st.round.attempts,1);assert.equal(g.inspect.stick.id,1);
 g.canvasDispatch('pointerup',{pointerId:2});assert.ok(g.api.state().keys.O>0);
 g.canvasDispatch('pointercancel',{pointerId:1});assert.ok(Object.values(g.api.state().keys).every(v=>!v));g.render();
});
test('orientation changes clear touches without pausing play or music',()=>{
 const g=createGame({touch:true,width:390,height:844,search:'?tut=0&seed=7'});g.tap('Enter');g.advance(24);
 for(const [width,height] of [[844,390],[390,844],[320,568],[1024,768]]) {
  stick(g,.5,.5);g.sandbox.innerWidth=width;g.sandbox.innerHeight=height;g.dispatch('resize');
  assert.equal(g.api.dbg().paused,false);assert.ok(Object.values(g.api.state().keys).every(v=>!v));
  const time=g.inspect.st.t;g.advance(1);assert.ok(g.inspect.st.t>time);assert.equal(g.sandbox.__music.playing,true);g.render();
 }
 g.tap('Escape');g.sandbox.innerWidth=390;g.sandbox.innerHeight=844;g.dispatch('resize');assert.equal(g.api.dbg().paused,true);
});
console.log(`${n}/${n} mobile input checks passed`);
