'use strict';
const assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
let checks=0;
for(const view of ['desktop','landscape']) for(const phase of ['play','paused','fall','standup','over','tutorial']) {
 const g=createGame({search:`?tut=0&seed=7&view=${view}`});g.tap(phase==='tutorial'?'KeyT':'Enter');g.advance(24);
 if(phase==='paused')g.tap('Escape');else if(['fall','standup','over'].includes(phase))g.inspect.st.state=phase;
 g.key('KeyO');if(view==='landscape'&&phase==='play'){const r=g.inspect.stickGeometry;g.point('pointerdown',r.x+40,r.y+80,3);}
 const button=g.inspect.homeButton;g.point('pointerdown',button.x+button.w/2,button.y+button.h/2,9);
 assert.equal(g.api.state().state,'title');assert.equal(g.inspect.st.tut,null);assert.equal(g.api.dbg().paused,false);assert.equal(g.inspect.st.round,null);
 assert.ok(Object.values(g.api.state().keys).every(v=>!v));assert.equal(g.inspect.pointers.size,0);assert.equal(g.sandbox.__music.playing,false);
 const time=g.inspect.st.gameT;g.advance(90,true);assert.equal(g.inspect.st.gameT,time);
 g.point('pointermove',0,0,3);g.point('pointerup',0,0,9);assert.ok(Object.values(g.api.state().keys).every(v=>!v));
 g.tap('Enter');assert.equal(g.api.state().state,'play');assert.equal(g.api.state().score,0);assert.equal(g.api.state().toasts,0);assert.equal(g.inspect.st.tut,null);assert.equal(g.inspect.player.wine,g.inspect.wineCapacity());g.render();checks++;
}
console.log(`${checks}/${checks} desktop/mobile return-home and fresh-start checks passed`);
