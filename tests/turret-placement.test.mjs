import test from 'node:test';
import assert from 'node:assert/strict';
import {blockSockets} from '../src/turrets/sockets.js';
import {initialTurretSize,placeTurret,mounts,mountHistory,removeTurret} from '../src/turrets/mounts.js';
import {demoProject} from '../src/turrets/core.js';
import {makeBlock,makeModel,ORIENTATIONS} from '../src/block-model.js';
import {snapshotModel,restoreModel} from '../src/session-persistence.js';
test('fit uses half-step square base envelope, not barrel bounds',()=>{
 for(const size of [.5,1,5,10,12]){const s=blockSockets(makeBlock({typeIndex:20,size:{x:size,y:size,z:size}}));assert.ok(s.every(s=>s.fitSize===Math.min(10,size)));}
 assert.ok(blockSockets(makeBlock({typeIndex:20,size:{x:.4,y:.4,z:.4}})).every(s=>s.fitSize===null));
});
test('placement allows smaller turrets, isolates assets, persists and supports undo/redo',()=>{
 const scene={loaded:true,model:makeModel([makeBlock({typeIndex:20})])},socket=blockSockets(scene.model.blocks[0])[0],asset=demoProject().assets[0];
 asset.sourceSize=1;placeTurret(scene,asset,socket,.5);assert.equal(mounts(scene)[0].turretSize,.5);assert.notEqual(mounts(scene)[0].asset,asset);
 assert.throws(()=>placeTurret(scene,asset,socket,1),/occupied/);assert.equal(restoreModel(snapshotModel(scene)).model.turretMounts.length,1);
 mountHistory(scene);assert.equal(mounts(scene).length,0);mountHistory(scene,true);assert.equal(mounts(scene).length,1);removeTurret(scene,socket.id);assert.equal(mounts(scene).length,0);mountHistory(scene);assert.equal(mounts(scene).length,1);
});

test('automatic placement fits the base for both larger and smaller source assets',()=>{assert.equal(initialTurretSize({sourceSize:10},{fitSize:2}),2);assert.equal(initialTurretSize({sourceSize:.5},{fitSize:2}),2);assert.equal(initialTurretSize({sourceSize:1},{fitSize:null}),null);});

test('armored cube and edge bases support every face and orientation, placement and restoration',()=>{
 const asset=demoProject().assets[0];asset.sourceSize=10;
 for(const typeIndex of [24,25])for(const orientation of ORIENTATIONS){
  const block=makeBlock({typeIndex,...orientation,size:{x:2,y:2,z:2}}),scene={loaded:true,model:makeModel([block])},sockets=blockSockets(block);
  assert.equal(sockets.length,typeIndex===24?6:5);
  for(const socket of sockets){assert.ok(socket.fitSize>=.5);placeTurret(scene,asset,socket,initialTurretSize(asset,socket));}
  assert.equal(mounts(scene).length,sockets.length);
  const restored=restoreModel(snapshotModel(scene)).model;
  const ids=new Set(blockSockets(restored.blocks[0]).map(s=>s.id));
  assert.ok(restored.turretMounts.every(m=>ids.has(m.socketId)&&m.turretSize<=2));
 }
});

test('GX4 thin armored top plate fits a 1.5 turret despite its 0.17 thickness',()=>{
 const block=makeBlock({typeIndex:24,position:{x:-.0000047685,y:3.73249936,z:-.992504118},size:{x:1.500001311,y:.17000008,z:1.500001904}});
 const socket=blockSockets(block).find(s=>s.normal[1]>.99),scene={loaded:true,model:makeModel([block])},asset=demoProject().assets[0];asset.sourceSize=10;
 assert.equal(socket.fitSize,1.5);placeTurret(scene,asset,socket,initialTurretSize(asset,socket));assert.equal(mounts(scene)[0].turretSize,1.5);
});
