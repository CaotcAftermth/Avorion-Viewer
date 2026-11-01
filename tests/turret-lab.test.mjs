import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {demoProject,partMatrices,frame,socketAtFace,validateProject,readProject,writeProject,componentEnvelope,effectiveScale,upgradeProject} from '../src/turrets/core.js';
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-9,`${a.toArray()} != ${b.toArray()}`);
test('attachment stays on every socket when scaling up/down with a rotated source attachment',()=>{
 const p=demoProject(),a=p.assets[0];a.attachment={position:[3,-2,1],rotation:[15,30,80]};
 for(const socket of p.sockets)for(const scale of [.01,.5,1,4,100]){
  const m=partMatrices(a,socket,{scale,twist:73,yaw:0,pitch:0});
  near(new THREE.Vector3(...a.attachment.position).applyMatrix4(m.base),new THREE.Vector3(...socket.position));
  const up=new THREE.Vector3(0,1,0).transformDirection(frame([0,0,0],a.attachment.rotation)).transformDirection(m.base);
  near(up,new THREE.Vector3(0,1,0).transformDirection(frame([0,0,0],socket.rotation)));
 }
});
test('body rotation leaves base fixed; elevation leaves body fixed and preserves barrel pivot',()=>{
 const p=demoProject(),a=p.assets[0],s=p.sockets[0],i=p.instances[0],neutral=partMatrices(a,s,i);
 const yaw=partMatrices(a,s,{...i,yaw:80}),pitch=partMatrices(a,s,{...i,yaw:80,pitch:40});
 assert.deepEqual(yaw.base.elements,neutral.base.elements);assert.notDeepEqual(yaw.body.elements,neutral.body.elements);assert.deepEqual(pitch.body.elements,yaw.body.elements);
 near(new THREE.Vector3(...a.pitch.position).applyMatrix4(pitch.barrel),new THREE.Vector3(...a.pitch.position).applyMatrix4(yaw.barrel));
 for(let n=0;n<100;n++)assert.deepEqual(partMatrices(a,s,i).barrel.elements,neutral.barrel.elements);
});
test('face sockets align with underside, side and oblique normals without reflection',()=>{
 for(const normal of [[0,-1,0],[1,0,0],[0,0,1],[.4,.5,.8]]){
  const s=socketAtFace([1,2,3],normal,'socket'),m=frame(s.position,s.rotation);
  near(new THREE.Vector3(0,1,0).transformDirection(m),new THREE.Vector3(...normal).normalize());assert.ok(Math.abs(m.determinant()-1)<1e-9);
 }
});
test('project round trip preserves rig, independent overrides and all posed matrices',()=>{
 const p=demoProject(),before=structuredClone(p.assets[0]);Object.assign(p.instances[1],{scale:3,yaw:45,pitch:25,colors:{barrel:'#ff0000'}});
 const result=readProject(writeProject(p));assert.deepEqual(result,p);assert.deepEqual(p.assets[0],before);assert.deepEqual(p.instances[0].colors,{});
 for(let n=0;n<p.instances.length;n++)for(const part of ['base','body','barrel'])assert.deepEqual(partMatrices(result.assets[0],result.sockets[n],result.instances[n])[part].elements,partMatrices(p.assets[0],p.sockets[n],p.instances[n])[part].elements);
});
test('project validation rejects broken references, invalid axes, duplicate mounts and unsafe scales',()=>{
 for(const corrupt of [p=>p.version=3,p=>p.assets[0].yaw.axis=[0,0,0],p=>p.instances[0].scale=-1,p=>p.instances[0].scale=Infinity,p=>p.instances[0].scale=101,p=>p.instances[0].socketId='missing',p=>p.instances[1].socketId=p.instances[0].socketId,p=>p.assets[0].parts.b1='unknown',p=>p.instances[0].colors.base='red',p=>p.sockets[0].position[0]=NaN]){const p=demoProject();corrupt(p);assert.throws(()=>validateProject(p));}
});
test('game sizes use half steps and component envelopes scale proportionally',()=>{
 assert.deepEqual(componentEnvelope('base',.5),[.5,.5,.5]);assert.deepEqual(componentEnvelope('body',.5),[.75,.75,.75]);assert.deepEqual(componentEnvelope('barrel',.5),[.75,.75,2.25]);
 assert.deepEqual(componentEnvelope('barrel',10),[15,15,45]);
 const p=demoProject(),a=p.assets[0],i=p.instances[0];a.sourceSize=.5;i.turretSize=10;i.scale=2;assert.equal(effectiveScale(a,i),40);
 near(new THREE.Vector3(...a.attachment.position).applyMatrix4(partMatrices(a,p.sockets[0],i).base),new THREE.Vector3(...p.sockets[0].position));
 for(const size of [0,.25,.75,10.5,NaN]){i.turretSize=size;assert.throws(()=>validateProject(p));}
 i.turretSize=.5;a.sourceSize=null;assert.throws(()=>validateProject(p));i.turretSize=null;assert.equal(effectiveScale(a,i),2);
});
test('multiple muzzle assignments remain in Barrel and survive serialization',()=>{
 const p=demoProject();p.assets[0].muzzles=['b2','b3'];assert.deepEqual(readProject(writeProject(p)).assets[0].muzzles,['b2','b3']);
 p.assets[0].muzzles.push('b2');assert.throws(()=>validateProject(p));p.assets[0].muzzles=['b1'];assert.throws(()=>validateProject(p));
});
test('version 1 projects retain geometry, poses and colors when Head becomes Body',()=>{
 const old=demoProject();old.version=1;for(const a of old.assets){delete a.sourceSize;delete a.muzzles;for(const id of Object.keys(a.parts))if(a.parts[id]==='body')a.parts[id]='head';}for(const i of old.instances){delete i.turretSize;i.colors={head:'#123456'};}
 old.instances[0].scale=3;old.instances[0].yaw=35;old.instances[0].pitch=17;
 const upgraded=upgradeProject(old);assert.equal(old.version,1);assert.equal(old.assets[0].parts.b1,'head');assert.equal(upgraded.version,2);assert.equal(upgraded.assets[0].parts.b1,'body');assert.deepEqual(upgraded.instances[0].colors,{body:'#123456'});assert.equal(upgraded.instances[0].scale,3);assert.equal(upgraded.instances[0].yaw,35);assert.equal(upgraded.instances[0].pitch,17);assert.equal(effectiveScale(upgraded.assets[0],upgraded.instances[0]),3);
});

test('pitch endpoints clamp transforms and positive elevation lifts native and demo barrels',()=>{
 const p=demoProject(),a=p.assets[0],i=p.instances[0],socket={position:[0,0,0],rotation:[0,0,0]};
 for(const sign of [1,-1]){
  a.pitch.elevationSign=sign;
  const point=new THREE.Vector3(...a.pitch.position).add(new THREE.Vector3(0,0,-sign));
  const neutral=point.clone().applyMatrix4(partMatrices(a,socket,i).barrel);
  const raised=point.clone().applyMatrix4(partMatrices(a,socket,{...i,pitch:90}).barrel);
  assert.ok(raised.y>neutral.y+.99);
  for(const [value,limit] of [[-90,-15],[180,90]])assert.deepEqual(partMatrices(a,socket,{...i,pitch:value}).barrel.elements,partMatrices(a,socket,{...i,pitch:limit}).barrel.elements);
 }
 a.pitch.limits={min:-10,max:60};assert.deepEqual(readProject(writeProject(p)),p);
 a.pitch.limits.min=1;assert.throws(()=>validateProject(p),/Pitch limits/);
});
test('legacy native raw pitch migrates once, preserving direction within limits',()=>{
 const p=demoProject(),a=p.assets[0];a.native={offsets:{base:[0,0,0],body:[0,0,0],barrel:[0,0,0]}};
 delete a.pitch.elevationSign;delete a.pitch.limits;p.instances[0].pitch=-30;p.instances[1].pitch=45;
 const migrated=upgradeProject(p);assert.equal(migrated.instances[0].pitch,30);assert.equal(migrated.instances[1].pitch,-15);
 assert.deepEqual(upgradeProject(migrated),migrated);assert.equal(p.instances[0].pitch,-30);
});
