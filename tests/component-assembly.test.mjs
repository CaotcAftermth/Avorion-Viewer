import {remapSetup} from '../src/components/storage.js';
import {makeModel} from '../src/block-model.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {assemblyFixture,assemblyAsset} from './component-assembly-fixture.js';
import {componentEntries,componentSockets,componentMatrix,validateSetup} from '../src/components/core.js';
import {mountedComponentSocketId,mountedBlockId} from '../src/components/socket-ids.js';
import {assignComponent,detachSurfaceComponent,changeSetup,componentHistory} from '../src/components/mounting.js';
import {sceneSockets} from '../src/turrets/sockets.js';
import {placeTurret} from '../src/turrets/mounts.js';
import {demoProject,partMatrices} from '../src/turrets/core.js';
import {snapshotModel,restoreModel} from '../src/session-persistence.js';
import {posedComponentBlocks,posedTurretBlocks} from '../src/turrets/posed-blocks.js';
import {componentRayHit} from '../src/components/world-blocks.js';
import {bakedBlocks} from '../src/components/bake.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const addChild=scene=>{const socket=componentSockets(scene).find(s=>s.id===mountedComponentSocketId('parent','right'));assert.ok(socket);scene.model.componentSetup=assignComponent(scene,assemblyAsset(),socket);scene.model.componentSetup.mounts.at(-1).id='child';};
const topTurret=scene=>sceneSockets(scene).find(s=>s.parentMountId==='parent'&&s.normal[1]>.99);
test('mounted asset sockets expose usable child/grandchild targets and follow parent rotation',()=>{
 const scene=assemblyFixture();assert.equal(componentSockets(scene).some(s=>s.sourceSocketId==='primary'),false);addChild(scene);
 const childSocket=componentSockets(scene).find(s=>s.id===mountedComponentSocketId('child','right'));assert.ok(childSocket);scene.model.componentSetup=assignComponent(scene,assemblyAsset('grandchild'),childSocket);
 const entries=componentEntries(scene),child=entries.find(e=>e.instance.id==='child');assert.equal(entries.length,3);assert.equal(posedComponentBlocks(scene).length,3);child.matrix.elements.forEach((v,i)=>near(v,componentMatrix(child.asset,child.socket,child.instance).elements[i]));
 const before=child.matrix.toArray();scene.model.componentSetup={...scene.model.componentSetup,mounts:scene.model.componentSetup.mounts.map(m=>m.id==='parent'?{...m,twist:90}:m)};assert.notDeepEqual(componentEntries(scene).find(e=>e.instance.id==='child').matrix.toArray(),before);assert.equal(componentEntries(scene).length,3);
 const baked=bakedBlocks(scene);assert.equal(baked.problems.length,0);assert.equal(baked.blocks.find(b=>b.worldBlockId===mountedBlockId('child','part')).parentBlockId,mountedBlockId('parent','part'));
 const restored=restoreModel(snapshotModel(scene));assert.equal(componentEntries(restored).length,3);assert.equal(componentSockets(restored).some(s=>s.id===childSocket.id),true);
});
test('turret blocks on components produce fitted turret sockets, poses, exposure geometry and stable session references',()=>{
 const scene=assemblyFixture(),socket=topTurret(scene);assert.ok(socket);assert.ok(socket.fitSize>=1);const turret=demoProject().assets[0],instance=placeTurret(scene,turret,socket,1);assert.ok(posedTurretBlocks(scene).length>0);
 const before=partMatrices(turret,socket,scene.model.turretMounts[0]).base.toArray();scene.model.componentSetup={...scene.model.componentSetup,mounts:scene.model.componentSetup.mounts.map(m=>({...m,twist:90}))};const rotated=sceneSockets(scene).find(s=>s.id===socket.id);assert.ok(rotated);assert.notDeepEqual(partMatrices(turret,rotated,scene.model.turretMounts[0]).base.toArray(),before);
 const restored=restoreModel(snapshotModel(scene));assert.equal(restored.model.turretMounts[0].id,instance.id);assert.ok(sceneSockets(restored).some(s=>s.id===socket.id));
 const hit=componentRayHit(scene,new THREE.Ray(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0)));assert.equal(hit.blockId,mountedBlockId('parent','part'));near(hit.point.y,rotated.position[1]);
 scene.model.componentSetup={...scene.model.componentSetup,mounts:scene.model.componentSetup.mounts.map(m=>({...m,hidden:true}))};assert.equal(topTurret(scene).ancestorHidden,true);assert.equal(componentRayHit(scene,new THREE.Ray(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0))),null);
});
test('assembly detach/undo restores dependent components and turrets while preserving unrelated turret edits',async()=>{
 const scene=assemblyFixture();addChild(scene);placeTurret(scene,demoProject().assets[0],topTurret(scene),1);const turretId=scene.model.turretMounts[0].id;scene.componentAttachmentDraft={};
 const parent=scene.model.componentSetup.mounts.find(m=>m.id==='parent');await changeSetup(scene,detachSurfaceComponent(scene,parent));assert.equal(scene.model.componentSetup.mounts.length,0);assert.equal(scene.model.turretMounts.length,0);
 scene.model.turretMounts=[{id:'unrelated',socketId:'ship-other'}];await componentHistory(scene);assert.equal(componentEntries(scene).length,2);assert.ok(scene.model.turretMounts.some(m=>m.id===turretId));assert.ok(scene.model.turretMounts.some(m=>m.id==='unrelated'));await componentHistory(scene,true);assert.equal(scene.model.componentSetup.mounts.length,0);assert.deepEqual(scene.model.turretMounts.map(m=>m.id),['unrelated']);
});
test('cyclic and unavailable component targets cannot be saved',()=>{
 const scene=assemblyFixture();addChild(scene);const setup=scene.model.componentSetup,cyclic={...setup,mounts:setup.mounts.map(m=>m.id==='parent'?{...m,socketId:mountedComponentSocketId('child','right')}:m)};assert.throws(()=>validateSetup(cyclic),/cycle/);const missing={...setup,mounts:setup.mounts.map(m=>m.id==='child'?{...m,socketId:mountedComponentSocketId('parent','missing')}:m)};assert.throws(()=>validateSetup(missing),/unavailable/);
});


test('named ship restoration keeps nested references when the root block ID changes',()=>{
 const scene=assemblyFixture();addChild(scene);const model=makeModel(scene.model.blocks.map(b=>({...b,id:'renamed'}))),saved={setup:scene.model.componentSetup,anchors:{hull:'0,-1,0:2'}},restored=remapSetup(model,saved);assert.equal(restored.dropped,0);assert.equal(restored.setup.sockets[0].blockId,'renamed');model.componentSetup=restored.setup;assert.equal(componentEntries({model,loaded:true}).length,2);assert.ok(componentSockets({model,loaded:true}).some(s=>s.id===mountedComponentSocketId('parent','right')));
});
