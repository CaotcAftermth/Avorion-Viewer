import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceRevision,revisedAsset,updatedMount} from '../src/attachments/lifecycle.js';
import {demoProject} from '../src/turrets/core.js';
import {placeTurret,replaceTurret,mountHistory,mounts} from '../src/turrets/mounts.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {blockSockets} from '../src/turrets/sockets.js';
test('legacy source revisions upgrade without modifying mounted snapshots',()=>{
 const old=demoProject().assets[0];old.sourceSize=1;const next=revisedAsset({...old,name:'Changed'},old),mount={asset:structuredClone(old),pitch:0,scale:2,twist:35,offset:[1,2,3]};
 assert.equal(sourceRevision(old),1);assert.equal(next.revision,2);
 const updated=updatedMount(mount,next,'turret');assert.equal(updated.source.revision,2);assert.equal(updated.scale,2);assert.equal(updated.twist,35);assert.deepEqual(updated.offset,[1,2,3]);assert.notEqual(updated.asset,mount.asset);assert.equal(mount.asset.name,old.name);
 assert.throws(()=>updatedMount({...mount,pitch:95},next,'turret'),/elevation/);
});
test('occupied turret replacement is one reversible transaction',()=>{
 const scene={loaded:true,model:makeModel([makeBlock({typeIndex:20})])},socket=blockSockets(scene.model.blocks[0])[0],asset=demoProject().assets[0];asset.sourceSize=1;
 placeTurret(scene,asset,socket,1);const original=mounts(scene)[0];const next={...asset,id:'replacement',revision:3};
 replaceTurret(scene,next,socket,1);assert.equal(mounts(scene).length,1);assert.equal(mounts(scene)[0].id,original.id);assert.equal(mounts(scene)[0].source.revision,3);
 mountHistory(scene);assert.equal(mounts(scene)[0],original);mountHistory(scene,true);assert.equal(mounts(scene)[0].asset.id,'replacement');
});
