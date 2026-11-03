import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel,placeImportedModel} from '../src/block-model.js';
import {emptySetup,componentSockets,savedSocket,attachComponent,componentMatrix,validateSetup} from '../src/components/core.js';
import {surfaceSockets,sceneSockets} from '../src/turrets/sockets.js';
import {snapshotModel,restoreModel} from '../src/session-persistence.js';
import {posedComponentBlocks} from '../src/turrets/posed-blocks.js';
import {syncTurrets} from '../src/turrets/render.js';
import {captureExport} from '../src/export/snapshot.js';
import {captureImage} from '../src/export/image-options.js';
import {area} from '../src/layout.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
const fixture=()=>({loaded:true,visible:true,model:makeModel([makeBlock({typeIndex:2,position:{x:10,y:5,z:0}})]),hiddenIds:new Set(),selectedIds:new Set(),revision:0});
const asset=()=>({id:'component',name:'Engine',blocks:[makeBlock()],attachment:{position:[0,0,0],rotation:[0,0,0]}});

test('component automatic sockets are opt-in and separate from turret sockets',()=>{
 const scene=fixture();assert.equal(componentSockets(scene).length,0);
 scene.model.componentSetup={...emptySetup(),blockType:2};assert.equal(componentSockets(scene).length,6);assert.equal(sceneSockets(scene).length,0);
 assert.ok(componentSockets(scene).every(s=>s.type==='component'&&s.id.startsWith('component:')));
});

test('manual block sockets follow placement and survive session restoration',()=>{
 const scene=fixture(),model=scene.model,face=surfaceSockets(model.blocks[0]).find(s=>s.normal[1]===1),socket=savedSocket(model,face,'Top');
 model.componentSetup={...emptySetup(),sockets:[socket]};
 assert.deepEqual(componentSockets(scene)[0].position,face.position);
 placeImportedModel(model,'centered');
 assert.deepEqual(componentSockets(scene)[0].position,[0,1,0]);
 const restored=restoreModel(snapshotModel(scene));assert.deepEqual(componentSockets(restored)[0].position,[0,1,0]);
});

test('free sockets use original coordinates through centering and persistence',()=>{
 const scene=fixture();scene.model.componentSetup={...emptySetup(),sockets:[{id:'free',name:'Free',position:[10,5,0],rotation:[0,0,0]}]};placeImportedModel(scene.model,'centered');
 assert.deepEqual(componentSockets(scene)[0].position,[0,0,0]);
 const restored=restoreModel(snapshotModel(scene));assert.deepEqual(componentSockets(restored)[0].position,[0,0,0]);
});

test('component anchor alignment, isolated copies, blueprint rendering and mesh exports',()=>{
 const scene=fixture();scene.model.componentSetup={...emptySetup(),blockType:2};const socket=componentSockets(scene).find(s=>s.normal[0]===1),original=asset();original.attachment.position=[0,1,0];
 scene.model.componentSetup=attachComponent(scene.model.componentSetup,original,socket);const mount=scene.model.componentSetup.mounts[0];
 const point=new THREE.Vector3(...original.attachment.position).applyMatrix4(componentMatrix(original,socket,mount));assert.ok(point.distanceTo(new THREE.Vector3(...socket.position))<1e-8);
 original.blocks[0].color='ff000000';assert.notEqual(mount.asset.blocks[0].color,original.blocks[0].color);
 assert.throws(()=>attachComponent(scene.model.componentSetup,original,socket),/occupied/);
 assert.equal(posedComponentBlocks(scene).length,1);assert.equal(captureExport(scene,{}).blocks.length,2);
 const image=captureImage(scene,area().view,FACTORY_PREFERENCES,{width:400,height:300});assert.equal(image.scene.model.componentSetup.mounts.length,1);
 const group=syncTurrets(new THREE.Scene(),scene,{display:{blueprint:true}},()=>{});assert.equal(group.children.length,1);assert.ok(group.children[0].children.some(o=>o.userData.blueprintEdges&&o.visible));
 scene.hiddenIds.add(socket.blockId);assert.throws(()=>captureExport(scene,{}, {scope:'visible'}),/no blocks/);
});

test('component setup rejects invalid frames and transforms',()=>{
 const setup={...emptySetup(),sockets:[{id:'s',name:'Socket',position:[NaN,0,0],rotation:[0,0,0]}]};assert.throws(()=>validateSetup(setup));
 const scene=fixture();scene.model.componentSetup={...emptySetup(),blockType:2};const next=attachComponent(scene.model.componentSetup,asset(),componentSockets(scene)[0]);next.mounts[0].scale=-1;assert.throws(()=>validateSetup(next));
});
