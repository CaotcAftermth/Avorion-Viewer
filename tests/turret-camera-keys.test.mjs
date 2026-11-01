import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateKeyedCamera,captureKey,normalizeKeys,upsertKey,reanchorKey,eventState,sequenceDuration,validateKey,poseFromView,KEYED_CAMERA,fovFromFocal,focalFromFov} from '../src/turrets/camera-keys.js';
import {keysFromPreset} from '../src/turrets/camera-keys-ui.js';
import {evaluateCamera,sequenceFlags} from '../src/turrets/showcase.js';
import {createStudio} from '../src/turrets/studio.js';import {demoProject} from '../src/turrets/core.js';
import {nativeToView} from '../src/block-model.js';

const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const nearArray=(a,b,eps=1e-9)=>a.forEach((v,i)=>near(v,b[i],eps));
const key=(time,extra={})=>validateKey({id:'k'+time,time,target:[0,0,0],yaw:0,pitch:0,roll:0,distance:10,fov:45,...extra});
const withRuntime=fn=>{globalThis.document={querySelectorAll:()=>[]};globalThis.cancelAnimationFrame=()=>{};globalThis.requestAnimationFrame=()=>0;try{const a=demoProject().assets[0];a.simulation={family:'ChainGun',mode:'both'};const r=createStudio(a,{},()=>{});try{fn(r,a);}finally{r.dispose();}}finally{delete globalThis.document;delete globalThis.cancelAnimationFrame;delete globalThis.requestAnimationFrame;}};

test('keys reproduce exactly at their times and hold outside the range',()=>{
 const keys=[key(1,{target:[1,2,3],yaw:.5,distance:4,fov:30}),key(3,{target:[5,0,1],yaw:1,distance:16,fov:60})];
 for(const [t,k] of [[0,keys[0]],[1,keys[0]],[3,keys[1]],[9,keys[1]]]){const c=evaluateKeyedCamera(t,keys,{});nearArray(c.target,k.target);near(c.yaw,k.yaw);near(c.zoom,10/k.distance);near(fovFromFocal(c.focalLength),k.fov,1e-9);}
 assert.equal(evaluateKeyedCamera(1,[],{}),null);
});
test('hold ease keeps the first pose until the next key; linear distance is log-space',()=>{
 const hold=[key(0,{ease:'hold',distance:2}),key(2,{distance:8})];near(evaluateKeyedCamera(1.999,hold,{}).zoom,5);near(evaluateKeyedCamera(2,hold,{}).zoom,10/8);
 const linear=[key(0,{ease:'linear',distance:2}),key(2,{distance:8})];near(10/evaluateKeyedCamera(1,linear,{}).zoom,4);
});
test('yaw takes the shortest arc across ±π',()=>{
 const keys=[key(0,{ease:'linear',yaw:Math.PI-.1}),key(1,{yaw:-Math.PI+.1})];const mid=evaluateKeyedCamera(.5,keys,{}).yaw;near(Math.abs(mid),Math.PI,1e-9);
 const quarter=evaluateKeyedCamera(.25,keys,{}).yaw;near(quarter,Math.PI-.05,1e-9);
});
test('target path passes through every key and stays finite between them',()=>{
 const keys=[key(0,{target:[0,0,0]}),key(1,{target:[4,0,0]}),key(2,{target:[4,4,0]}),key(3,{target:[0,4,2]})];
 for(const k of keys)nearArray(evaluateKeyedCamera(k.time,keys,{}).target,k.target);
 for(let t=0;t<=3;t+=.05)assert.ok(evaluateKeyedCamera(t,keys,{}).target.every(Number.isFinite));
 const c=evaluateKeyedCamera(.5,[key(0,{ease:'linear',target:[0,0,0]}),key(1,{target:[2,0,0]})],{});nearArray(c.target,[1,0,0],1e-6);
});
test('normalize sorts keys, nudges duplicate times and upsert replaces by id',()=>{
 const keys=normalizeKeys([key(2),{...key(1),id:'a'},{...key(1),id:'b'}]);assert.deepEqual(keys.map(k=>k.time),[1,1+1/120,2]);
 const updated=upsertKey(keys,{...keys[2],time:.5});assert.equal(updated.length,3);assert.equal(updated[0].id,keys[2].id);
 assert.throws(()=>validateKey({time:400,target:[0,0,0],distance:1,fov:45}));assert.throws(()=>validateKey({time:1,target:[0,NaN,0],distance:1,fov:45}));assert.throws(()=>validateKey({time:1,target:[0,0,0],distance:0,fov:45}));
});
test('capturing from a view and evaluating at that time returns the same view pose',()=>{
 const view={target:[1,2,3],yaw:2.5,pitch:.4,roll:.1,zoom:.8,panX:12,panY:-4,display:{focalLength:focalFromFov(50)}};
 for(const anchor of ['world','turret','target']){const runtime={target:[3,1,2],muzzles:[{position:[1,1,1],direction:[.6,.2,.77]}]};const k=captureKey(view,4,runtime,{anchor});const c=evaluateKeyedCamera(4,[k],runtime);nearArray(c.target,view.target,1e-9);near(c.yaw,view.yaw,1e-9);near(c.pitch,view.pitch);near(c.roll,view.roll);near(c.zoom,view.zoom);near(c.focalLength,view.display.focalLength,1e-9);near(c.panX,12);near(c.panY,-4);}
 assert.deepEqual(poseFromView({}).target,[0,0,1]);
});
test('turret-anchored keys follow the barrel heading; target-anchored keys follow the target',()=>{
 const view={target:[2,0,1],yaw:.3,pitch:.2,zoom:1,display:{focalLength:35}};
 const before={target:[0,0,0],muzzles:[{position:[0,0,0],direction:[1,0,0]}]},k=captureKey(view,0,before,{anchor:'turret'});
 // Native +Z maps to view -Y: turning the barrel from native +X to native -Z is +90° about view Z.
 const after={...before,muzzles:[{position:[0,0,0],direction:[0,0,-1]}]},c=evaluateKeyedCamera(0,[k],after);near(c.yaw,.3+Math.PI/2,1e-9);nearArray(c.target,[0,2,1],1e-9);
 const t=captureKey(view,0,{target:[0,0,0]},{anchor:'target'}),moved=evaluateKeyedCamera(0,[t],{target:[5,0,0]});nearArray(moved.target,[2,0,1].map((v,i)=>v+nativeToView([5,0,0])[i]),1e-9);
 const re=reanchorKey(k,'world',after);nearArray(evaluateKeyedCamera(0,[re],after).target,c.target,1e-9);near(evaluateKeyedCamera(0,[re],after).yaw,c.yaw,1e-9);
});
test('events are step functions and keyed duration ends at the last key or event',()=>{
 const events=[{time:2,fire:true},{time:1,track:true,target:false},{time:4,fire:false}];
 assert.deepEqual(eventState(0,events),{fire:undefined,track:undefined,target:undefined});assert.deepEqual(eventState(2,events),{fire:true,track:true,target:false});assert.equal(eventState(10,events).fire,false);
 assert.equal(sequenceDuration({camera:KEYED_CAMERA,keys:[key(0),key(3)],events}),4);assert.equal(sequenceDuration({camera:KEYED_CAMERA,keys:[key(0)]}),1);assert.equal(sequenceDuration({camera:'orbit',duration:12}),12);
 assert.equal(sequenceFlags(1,{camera:'manual'}),null);assert.equal(sequenceFlags(2.5,{camera:KEYED_CAMERA,events}).fire,true);
});
test('studio applies keyed camera, events gate firing and manual interaction frees the view without leaving keys mode',()=>withRuntime((r,a)=>{
 const view={yaw:0,pitch:0,zoom:1,target:[0,0,0],display:{focalLength:35}};r.context=()=>({view});
 r.settings.showcase={camera:KEYED_CAMERA,keys:[key(0,{yaw:.2}),key(2,{yaw:.8})],events:[{time:0,fire:false}]};r.restart();
 r.seek(2);near(view.yaw,.8);assert.equal(r.count,0,'fire:false event blocks firing');
 r.settings.showcase.events=[{time:0,fire:true}];r.restart();r.seek(2);assert.ok(r.count>0,'fire:true event allows firing');
 r.manualCamera();assert.equal(r.settings.showcase.camera,KEYED_CAMERA);view.yaw=2;r.present();near(view.yaw,2);
 r.seek(1);assert.equal(r.freeView,false);assert.ok(view.yaw>.2&&view.yaw<.8);
 const other=createStudio(a,{},()=>{});try{other.seek(1.5);r.seek(1.5);assert.deepEqual(evaluateCamera(1.5,a,other,r.settings.showcase),evaluateCamera(1.5,a,r,r.settings.showcase));}finally{other.dispose();}
}));
test('baking the preset sequence yields keys that match the preset camera at each key time',()=>withRuntime((r,a)=>{
 const view={yaw:0,pitch:0,zoom:1,target:[0,0,0],display:{focalLength:35}};r.context=()=>({view});
 const show={camera:'orbit',sequence:true,duration:10};r.settings.showcase=show;r.restart();
 const baked=keysFromPreset(r,show);assert.ok(baked.keys.length>=6);assert.equal(baked.events.length,6);assert.equal(show.camera,'orbit','baking restores the camera mode');
 for(const k of baked.keys.filter((_,i)=>i%3===0)){r.seek(k.time);const preset=evaluateCamera(k.time,a,r,show),keyed=evaluateKeyedCamera(k.time,baked.keys,r);nearArray(keyed.target,preset.target,1e-6);near(Math.cos(keyed.yaw),Math.cos(preset.yaw),1e-6);near(keyed.zoom,preset.zoom,1e-6);}
}));
