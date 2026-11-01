import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {demoProject} from '../src/turrets/core.js';
import {makeModel,makeBlock} from '../src/block-model.js';
import {blockSockets} from '../src/turrets/sockets.js';
import {placeTurret,mounts,editTurrets,selectTurrets,copyTurretPose,mountHistory} from '../src/turrets/mounts.js';
import {syncTurrets,turretGeometryStats} from '../src/turrets/render.js';
import {snapshotModel,restoreModel} from '../src/session-persistence.js';
test('pose and size edits clamp, copy, undo, and persist independently',()=>{
 const scene={loaded:true,model:makeModel([makeBlock({typeIndex:20})])},asset=demoProject().assets[0];asset.sourceSize=1;const sockets=blockSockets(scene.model.blocks[0]);
 const a=placeTurret(scene,asset,sockets[0],1),b=placeTurret(scene,asset,sockets[1],1);selectTurrets(scene,a.id);editTurrets(scene,[a.id],{pitch:200,yaw:30,twist:40,turretSize:.5});assert.equal(mounts(scene)[0].pitch,90);
 copyTurretPose(scene);selectTurrets(scene,b.id);editTurrets(scene,[b.id],scene.turretClipboard);assert.equal(mounts(scene)[1].yaw,30);mountHistory(scene);assert.equal(mounts(scene)[1].yaw,0);mountHistory(scene,true);
 assert.deepEqual(restoreModel(snapshotModel(scene)).model.turretMounts,scene.model.turretMounts);assert.equal(asset.sourceSize,1);
});
test('100 copies share three component geometries and hide independently',()=>{
 const asset=demoProject().assets[0];asset.sourceSize=1;const blocks=Array.from({length:100},(_,i)=>makeBlock({id:'b'+i,typeIndex:20,position:{x:i*4,y:0,z:0}}));
 const scene={loaded:true,visible:true,revision:0,model:makeModel(blocks),hiddenIds:new Set()};for(const b of blocks)placeTurret(scene,asset,blockSockets(b)[0],1);
 const world=new THREE.Scene();syncTurrets(world,scene,{},()=>{});assert.deepEqual(turretGeometryStats(),{assets:1,geometries:3,instances:100});
 editTurrets(scene,[mounts(scene)[0].id],{hidden:true,pitch:45});const group=syncTurrets(world,scene,{},()=>{});assert.equal(group.children[0].visible,false);assert.equal(turretGeometryStats().geometries,3);
});

test('thin body filtering preserves mounted turrets while manual hiding still hides them',()=>{
 const block=makeBlock({id:'thin',typeIndex:24,size:{x:2,y:0,z:2}}),scene={loaded:true,visible:true,model:makeModel([block]),hiddenIds:new Set()},asset=demoProject().assets[0];
 const socket=blockSockets(block).find(s=>s.fitSize>=.5);assert.ok(socket);placeTurret(scene,asset,socket,1);
 const world=new THREE.Scene(),view={showThinBlocks:false};
 assert.equal(syncTurrets(world,scene,view,()=>{}).children[0].visible,true);
 scene.hiddenIds=new Set([block.id]);assert.equal(syncTurrets(world,scene,view,()=>{}).children[0].visible,false);
});
