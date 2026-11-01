import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock} from '../src/block-model.js';
import {computeCoverage,obstacleTree,rayBlocked,rayDistance} from '../src/turrets/fire-coverage.js';
import {demoProject} from '../src/turrets/core.js';
test('rays stop at actual block surfaces, including far-away and hidden blocks',()=>{
 const b=makeBlock({position:{x:0,y:0,z:1000},size:{x:2,y:2,z:2}});b.hidden=true;
 assert.equal(rayBlocked(obstacleTree([b]),new THREE.Vector3(),new THREE.Vector3(0,0,1)),true);
 assert.equal(rayBlocked(obstacleTree([b]),new THREE.Vector3(3,0,0),new THREE.Vector3(0,0,1)),false);
});
test('wedge empty space does not obstruct like a bounding box',()=>{
 const b=makeBlock({typeIndex:21,position:{x:0,y:0,z:0}}),tree=obstacleTree([b]);
 let misses=0,hits=0;for(let x=-.9;x<=.9;x+=.3)for(let y=-.9;y<=.9;y+=.3){const hit=rayBlocked(tree,new THREE.Vector3(x,y,-4),new THREE.Vector3(0,0,1));hit?hits++:misses++;}
 assert.ok(hits>0);assert.ok(misses>0);
});
function fixture(){const asset=demoProject().assets[0];asset.blocks=[];asset.parts={};asset.native={offsets:{barrel:[0,0,0]}};asset.muzzlePositions=[[0,0,0]];asset.sourceSize=1;asset.attachment.position=[0,0,0];asset.yaw.position=[0,0,0];asset.pitch.position=[0,0,0];asset.pitch.elevationSign=-1;asset.pitch.limits={min:-15,max:90};return {blocks:[],mounts:[{id:'m',socketId:'s',asset,twist:0,yaw:0,pitch:0,scale:1,turretSize:1}],sockets:[{id:'s',position:[0,0,0],rotation:[0,0,0]}],selectedId:'m',step:30};}
test('full yaw and pitch sweep, mount rotation and multiple muzzle occlusion',()=>{
 const input=fixture(),clear=computeCoverage(input);assert.ok(clear.samples.every(s=>s.state==='clear'));assert.ok(clear.samples.some(s=>s.yaw===330));assert.ok(clear.samples.some(s=>s.pitch===90));assert.ok(clear.samples.some(s=>s.pitch===-15));
 input.mounts[0].asset.muzzlePositions.push([4,0,0]);input.blocks=[makeBlock({position:{x:0,y:0,z:5}})];input.mounts[0].asset.pitch.limits={min:0,max:0};const result=computeCoverage(input);assert.equal(result.samples.find(s=>s.yaw===0).state,'partial');assert.equal(result.samples.find(s=>s.yaw===180).state,'clear');
 input.sockets[0].rotation=[180,0,0];const rotated=computeCoverage(input);assert.ok(rotated.samples[0].direction[2]<-.99);
});
test('self and other mounted geometry obstruct; coaxial has one direction',()=>{
 const input=fixture();input.mounts[0].asset.native.coaxial='true';input.mounts[0].asset.blocks=[makeBlock({position:{x:0,y:0,z:4}})];input.mounts[0].asset.parts={b0:'base'};const result=computeCoverage(input);assert.equal(result.samples.length,1);assert.equal(result.samples[0].state,'blocked');
 const other=structuredClone(input.mounts[0]);other.id='other';other.socketId='s2';input.sockets.push({id:'s2',position:[0,0,0],rotation:[0,0,0]});input.mounts.push(other);input.mounts[0].asset.blocks=[];assert.equal(computeCoverage(input).samples[0].state,'blocked');
});

test('nearest obstruction wins regardless of block order and clips per-muzzle paths',()=>{
 const input=fixture();input.mounts[0].asset.native.coaxial='true';input.blocks=[makeBlock({position:{x:0,y:0,z:20}}),makeBlock({position:{x:0,y:0,z:5}})];
 assert.equal(rayDistance(obstacleTree(input.blocks),new THREE.Vector3(),new THREE.Vector3(0,0,1)),4);
 const ray=computeCoverage(input).samples[0].rays[0];assert.ok(Math.abs(ray.distance-3.999999)<1e-6);assert.deepEqual(ray.origin,[0,0,.000001]);
});
