import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {frame} from '../src/turrets/core.js';
import {validateComponent,validateSetup,savedSocket,componentSockets,attachComponent} from '../src/components/core.js';
import {socketFaces,orientSocket,socketNormalChoices} from '../src/components/socket-face.js';
import {assetSocketSetup,assetAttachment,snapshotComponentAsset,withoutSocket} from '../src/components/asset-sockets.js';
import {changeSetup,componentHistory,assignComponent} from '../src/components/mounting.js';
const fixture=()=>{const asset={id:'asset',name:'Part',blocks:[makeBlock({id:'hull'})],attachment:null,attachmentSocketId:null,sockets:[]},model=makeModel(structuredClone(asset.blocks));model.componentSetup=assetSocketSetup(asset);return {model,loaded:true,componentAttachmentDraft:asset};};
const add=(scene,index)=>{const face=socketFaces(scene.model.blocks[0])[index],socket=savedSocket(scene.model,orientSocket(face,socketNormalChoices(face)[0].normal),'Socket '+index);socket.faceId=face.faceId;return socket;};
test('unassigned assets validate and round-trip; mounting requires an explicit attachment',()=>{
 const scene=fixture(),asset=snapshotComponentAsset(scene);assert.equal(validateComponent(asset).attachment,null);assert.deepEqual(assetSocketSetup(JSON.parse(JSON.stringify(asset))).sockets,[]);
 const socket={id:'ship',type:'component',position:[0,0,0],rotation:[0,0,0]};assert.throws(()=>assignComponent(scene,asset,socket),/attachment point/);assert.throws(()=>attachComponent(scene.model.componentSetup,asset,socket),/attachment point/);
});
test('primary and additional asset sockets persist; attachment points inward; edits are draft-local and undoable',async()=>{
 const scene=fixture(),first=add(scene,0),second=add(scene,1),assetBefore=structuredClone(scene.componentAttachmentDraft);
 await changeSetup(scene,{...scene.model.componentSetup,sockets:[first,second]});assert.equal(assetAttachment(scene),null,'adding sockets does not assign an attachment');
 await changeSetup(scene,{...scene.model.componentSetup,attachmentSocketId:first.id});const snapshot=snapshotComponentAsset(scene),live=componentSockets(scene).find(s=>s.id===first.id),normal=new THREE.Vector3(0,1,0).transformDirection(frame([0,0,0],snapshot.attachment.rotation));
 assert.ok(normal.dot(new THREE.Vector3(...live.normal))<-.99999);assert.deepEqual(snapshot.attachment.position,live.position);assert.equal(snapshot.sockets.length,2);assert.equal(snapshot.attachmentSocketId,first.id);assert.deepEqual(scene.componentAttachmentDraft,assetBefore,'library source is untouched before Save asset');
 const restored={...scene,componentAttachmentDraft:JSON.parse(JSON.stringify(snapshot)),model:makeModel(structuredClone(snapshot.blocks))};restored.model.componentSetup=assetSocketSetup(restored.componentAttachmentDraft);assert.deepEqual(JSON.parse(JSON.stringify(snapshotComponentAsset(restored))),JSON.parse(JSON.stringify(snapshot)));
 await changeSetup(scene,withoutSocket(scene.model.componentSetup,first.id));assert.equal(assetAttachment(scene),null);assert.equal(scene.model.componentSetup.sockets.length,1);await componentHistory(scene);assert.equal(scene.model.componentSetup.attachmentSocketId,first.id);assert.equal(scene.model.componentSetup.sockets.length,2);
});
test('legacy attachment frames remain unchanged and invalid primary references are rejected',()=>{
 const scene=fixture(),legacy={id:'legacy',name:'Legacy',blocks:scene.model.blocks,attachment:{position:[1,2,3],rotation:[0,90,0]}};scene.componentAttachmentDraft=legacy;scene.model.componentSetup=assetSocketSetup(legacy);assert.deepEqual(snapshotComponentAsset(scene).attachment,legacy.attachment);
 assert.throws(()=>validateSetup({...scene.model.componentSetup,attachmentSocketId:'missing'}),/missing/);assert.throws(()=>validateComponent({...legacy,attachmentSocketId:'missing'}),/primary/);
});
