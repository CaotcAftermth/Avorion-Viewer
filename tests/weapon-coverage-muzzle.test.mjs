import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock} from '../src/block-model.js';
import {demoProject,partMatrices} from '../src/turrets/core.js';
import {createCoverageEngine} from '../src/turrets/coverage-engine.js';
import * as THREE from '../src/vendor/three.module.js';

// Exact native bounds/muzzle convention of Craft 2_turret_0_2.xml: muzzle z=6.5
// lies inside the final barrel block, whose front surface is z=7.5.
function fixture(){
 const asset=demoProject().assets[0];Object.assign(asset,{sourceSize:10,native:{offsets:{base:[0,0,0],body:[0,0,0],barrel:[0,6,0]},coaxial:'false'},muzzlePositions:[[0,0,6.5]],parts:{base:'base',body:'body',b0:'barrel',b1:'barrel',b2:'barrel'}});
 asset.attachment.position=[0,0,0];asset.yaw.position=[0,0,0];asset.pitch.position=[0,6,0];asset.pitch.elevationSign=-1;
 asset.blocks=[makeBlock({id:'base',position:{x:0,y:1,z:0},size:{x:10,y:2,z:10}}),makeBlock({id:'body',position:{x:0,y:4,z:0},size:{x:4,y:5,z:4}}),makeBlock({id:'b0',position:{x:0,y:6,z:0},size:{x:7,y:2,z:3}}),makeBlock({id:'b1',position:{x:0,y:6,z:3.5},size:{x:2,y:2,z:4}}),makeBlock({id:'b2',position:{x:0,y:6,z:6.5},size:{x:2,y:2,z:2}})];
 return {blocks:[],sockets:[{id:'s',position:[0,0,0],rotation:[0,0,0]}],mounts:[{id:'m',name:'Craft 2',socketId:'s',asset,scale:1,turretSize:2,twist:0,yaw:0,pitch:0}]};
}
test('native muzzle inside its own barrel can fire into empty space',()=>{
 const e=createCoverageEngine(fixture());for(const p of [[0,1.2,10],[0,10,10],[10,5,0],[-10,5,0]]){const r=e.evaluate(p);assert.equal(r.clear,1);assert.equal(r.obstructed,0);assert.deepEqual(r.contributors[0].paths[0].sourceBarrelBlocks,['b2']);}
});
test('muzzle exclusion does not remove nearby hull, other turrets or separate barrel geometry',()=>{
 const f=fixture();f.blocks=[makeBlock({id:'armor',position:{x:0,y:1.2,z:1.4},size:{x:1,y:1,z:.02}})];let r=createCoverageEngine(f).evaluate([0,1.2,10]);assert.equal(r.obstructed,1);assert.equal(r.contributors[0].paths[0].blocker.blockId,'armor');
 f.blocks=[];f.mounts[0].asset.blocks.push(makeBlock({id:'forward-piece',position:{x:0,y:6,z:9},size:{x:2,y:2,z:1}}));f.mounts[0].asset.parts['forward-piece']='barrel';r=createCoverageEngine(f).evaluate([0,1.2,10]);assert.equal(r.obstructed,1);assert.equal(r.contributors[0].paths[0].blocker.blockId,'forward-piece');
 f.mounts[0].asset.parts['forward-piece']='body';assert.equal(createCoverageEngine(f).evaluate([0,1.2,10]).obstructed,1);
 const other=structuredClone(f.mounts[0]);other.id='other';other.socketId='s2';other.asset.blocks=other.asset.blocks.filter(b=>b.id==='forward-piece');f.mounts[0].asset.blocks=f.mounts[0].asset.blocks.filter(b=>b.id!=='forward-piece');f.mounts.push(other);f.sockets.push({...f.sockets[0],id:'s2'});r=createCoverageEngine(f).evaluate([0,1.2,10]);assert.equal(r.contributors[0].paths[0].blocker.turretId,'other');
});
test('source-barrel exclusion follows scaled, angled, yawed and elevated native geometry',()=>{
 const f=fixture();f.sockets[0].position=[4,-2,3];f.sockets[0].rotation=[20,0,-70];const m=f.mounts[0];m.turretSize=.5;m.twist=30;
 const matrix=partMatrices(m.asset,f.sockets[0],{...m,yaw:63,pitch:45}).barrel,target=new THREE.Vector3(0,6,6.5).applyMatrix4(matrix).addScaledVector(new THREE.Vector3(0,0,1).transformDirection(matrix),10);
 assert.equal(createCoverageEngine(f).evaluate(target.toArray()).clear,1);
});
