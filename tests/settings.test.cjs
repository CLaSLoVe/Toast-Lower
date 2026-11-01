'use strict';
const assert = require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Minimal eventful DOM: runs the real modal; no browser or graphics context.
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.listeners={};this.open=false;this.classList={toggle:(key,on)=>{this.attrs[key]=on;}};}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='value')this.value=String(v);}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 emit(k){for(const fn of this.listeners[k]||[])fn({preventDefault(){},stopPropagation(){}});}
 querySelector(selector){return this.find(e=>selector.startsWith('.')?(e.attrs.class||'').split(' ').includes(selector.slice(1)):selector.startsWith('#')?e.attrs.id===selector.slice(1):e.tag===selector);}
 find(predicate){if(predicate(this))return this;for(const c of this.children){const found=c.find(predicate);if(found)return found;}}
 all(predicate){return [...(predicate(this)?[this]:[]),...this.children.flatMap(c=>c.all(predicate))];}
 showModal(){this.open=true;} close(){this.open=false;} focus(){}
}
const body=new Element('body'),scope={document:{body,createElement:t=>new Element(t)}};scope.window=scope;
for(const name of ['config.js','settings.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),scope);
const config=scope.ToastConfig,api=scope.ToastSettings;let changes=[],closed=0;
api.open({user:true,values:config.defaults,muted:false,guides:true,onChange:(...args)=>changes.push(args),onClose:()=>closed++});
const dialog=body.children[0];assert.ok(api.isOpen());
assert.deepEqual(dialog.all(e=>e.attrs.type==='range').map(e=>e.attrs.id),['player-musicVolume','player-sfxVolume','player-spillSoundVolume']);
assert.equal(dialog.all(e=>e.attrs.type==='number').length,0);
for(const [id,value] of [['musicVolume',0],['sfxVolume',37],['spillSoundVolume',19]]){
 const input=dialog.querySelector('#player-'+id);input.value=String(value);input.emit('input');assert.equal(changes.at(-1)[0][id],value);
}
const mute=dialog.querySelector('#player-mute');mute.checked=true;mute.emit('change');assert.equal(changes.at(-1)[1],true);
const guides=dialog.querySelector('#player-guides');guides.checked=false;guides.emit('change');assert.equal(changes.at(-1)[2],false);
dialog.querySelector('.close-settings').emit('click');assert.equal(closed,1);assert.equal(api.isOpen(),false);
let saved;
api.open({values:config.defaults,difficulty:'normal',difficulties:[{id:'normal',level:'中等',name:'00后整顿酒桌'}],ctl:'accel',layer:0,muted:true,layers:['职场'],paused:true,onSave:s=>saved=s,onClose:()=>closed++});
assert.ok(dialog.all(e=>e.attrs.type==='number').length>0);assert.equal(dialog.all(e=>e.attrs.type==='range').length,0);
const advanced=dialog.all(e=>e.tag==='button').find(e=>e.textContent==='高级');advanced.emit('click');
for(const id of ['setting-musicVolume','setting-sfxVolume','setting-spillSoundVolume','setting-mute'])assert.equal(dialog.querySelector('#'+id),undefined);
const bpm=dialog.querySelector('#setting-musicBpm');bpm.value='130';bpm.emit('input');dialog.querySelector('form').emit('submit');assert.equal(saved.values.musicBpm,130);assert.equal(closed,2);
api.open({user:true,values:config.defaults,muted:false,guides:true,onChange(){},onClose:()=>closed++});dialog.emit('cancel');assert.equal(closed,3);assert.equal(api.isOpen(),false);
console.log('PASS player settings live sliders, mute, hints, modal lifecycle and separation from test controls');
