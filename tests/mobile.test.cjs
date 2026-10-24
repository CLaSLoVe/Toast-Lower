'use strict';
const assert = require('node:assert/strict');
const {createGame} = require('./harness.cjs');
let n=0;
function test(name,fn){fn();console.log('PASS '+name);n++;}
function mobile(view='landscape'){const g=createGame({search:`?tut=0&seed=7&view=${view}`});g.tap('Enter');return g;}
function stick(g,x,y,id=1,type='pointerdown'){const r=g.inspect.stickGeometry;g.point(type,r.x+x*r.r,r.y+y*r.r,id);}
test('analog diagonal controls are independent, bounded and have a center deadzone',()=>{
 for(const view of ['landscape']) {
  const g=mobile(view);stick(g,.05,.05);assert.equal(g.api.state().keys.W,0);assert.equal(g.api.state().keys.O,0);
  stick(g,.5,.5,1,'pointermove');let k=g.api.state().keys;assert.ok(k.W>0&&k.W<.5);assert.equal(k.W,k.O);assert.equal(k.Q+k.P,0);
  stick(g,-4,0,1,'pointermove');k=g.api.state().keys;assert.equal(k.Q,1);assert.equal(k.W+k.O+k.P,0);
  stick(g,0,-1,1,'pointermove');assert.equal(g.api.state().keys.P,1);
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
 for(const view of ['landscape']) {const g=mobile(view),r=g.inspect.stickGeometry,b=g.inspect.activeButton,{W,H}=g.inspect.canvasSize;
 assert.ok(r.x-r.hit>=0&&r.y+r.hit<=H);assert.ok(b.x>r.x+r.hit&&b.x+b.w<=W&&b.y+b.h<=H);g.render();}
});
test('portrait cannot start or advance; rotating during play pauses and clears both thumbs',()=>{
 const g=createGame({touch:true,width:390,height:844,search:'?tut=0&seed=7'});g.tap('Enter');assert.equal(g.api.state().state,'title');g.render();
 g.sandbox.innerWidth=844;g.sandbox.innerHeight=390;g.dispatch('resize');g.tap('Enter');g.advance(24);stick(g,.5,.5);g.actionPointer('pointerdown',2);
 g.sandbox.innerWidth=390;g.sandbox.innerHeight=844;g.dispatch('resize');assert.equal(g.api.dbg().paused,true);assert.ok(Object.values(g.api.state().keys).every(v=>!v));
 const time=g.inspect.st.t;g.advance(300);assert.equal(g.inspect.st.t,time);g.render();
 g.sandbox.innerWidth=844;g.sandbox.innerHeight=390;g.dispatch('resize');assert.equal(g.api.dbg().paused,true);g.tap('Enter');g.advance(1);assert.ok(g.inspect.st.t>time);
});
console.log(`${n}/${n} mobile input checks passed`);
