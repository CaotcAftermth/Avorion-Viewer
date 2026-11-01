import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {BlockPose} from '../src/avorion/lib/geometry/blockPose.js';
test('panel projection coordinates remain attached through turret rotation and reset',()=>{
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([1,0,0,2,0,0,1,1,0],3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));
 const rest=[1,0,0,4,2,0,0,4,1,1,0,4];
 g.setAttribute('aSide',new THREE.Float32BufferAttribute(rest,4));
 const pose=new BlockPose(g,new Map([['barrel',[[0,3]]]]));
 pose.apply(new Map([['barrel',new THREE.Matrix4().makeRotationY(Math.PI/2)]]));
 assert.ok(Math.abs(g.getAttribute('position').getZ(0)+1)<1e-6);
 assert.deepEqual([...g.getAttribute('aSide').array],rest);
 pose.apply(new Map());
 assert.deepEqual([...g.getAttribute('position').array],[1,0,0,2,0,0,1,1,0]);
 assert.deepEqual([...g.getAttribute('aSide').array],rest);
 g.dispose();
});
