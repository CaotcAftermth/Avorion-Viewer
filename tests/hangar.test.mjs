import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,ORIENTATIONS} from '../src/block-model.js';
import {obstacleTree,rayHit} from '../src/turrets/fire-coverage.js';
import {defaultOrientationProfile,resolveOrientation} from '../src/avorion/lib/avorion/orientation.js';
import {buildBlockEffects,effectColor} from '../src/avorion/lib/geometry/blockEffects.js';
import {prepareExport} from '../src/export/pipeline.js';

test('hangar passage is open in both directions for every block orientation',()=>{
 const profile=defaultOrientationProfile();
 for(const orientation of ORIENTATIONS){
  const block=makeBlock({typeIndex:10,...orientation,position:{x:0,y:0,z:0},size:{x:4,y:4,z:4}}),tree=obstacleTree([block]);
  const {quaternion}=resolveOrientation(profile,block.look,block.up,10);
  for(const sign of [-1,1]){
   const direction=new THREE.Vector3(0,0,sign).applyQuaternion(quaternion);
   assert.equal(rayHit(tree,direction.clone().multiplyScalar(-10),direction,20),null);
   const edge=new THREE.Vector3(1.9,0,-10*sign).applyQuaternion(quaternion);
   assert.ok(rayHit(tree,edge,direction,20),'frame must still obstruct');
  }
 }
});

test('hangar shell export retains the passage and the expected wall volume',async()=>{
 const block=makeBlock({typeIndex:10,size:{x:4,y:4,z:4},position:{x:0,y:0,z:0}});
 const result=await prepareExport({blocks:[block],warnings:[],placement:'centered',fileName:'hangar.xml'}, {format:'stl',mode:'shell',longest:4,budget:512,includeTransparent:true,cleanup:true});
 assert.ok(Math.abs(result.reports[0].volume-(4*4-3.4*3.4)*4)<1e-4);
 const g=result.geometries[0],ray=new THREE.Ray(new THREE.Vector3(0,0,-10),new THREE.Vector3(0,0,1)),p=new THREE.Vector3();
 for(let i=0;i<g.indices.length;i+=3)assert.equal(ray.intersectTriangle(...Array.from(g.indices.slice(i,i+3),j=>new THREE.Vector3().fromArray(g.positions,j*3)),false,p),null);
});

test('barrier uses alpha blending with shared time, visibility, and bloom exclusion uniforms',()=>{
 const block=makeBlock({typeIndex:10}),effects=buildBlockEffects([block],defaultOrientationProfile(),{barrierStrength:1,glowStrength:0});
 const barrier=effects.meshes.find(m=>m.name==='hangar-barrier');
 assert.equal(barrier.material.blending,THREE.NormalBlending);
 assert.ok(barrier.userData.hangarBarrier);
 effects.setTime(.25);assert.equal(barrier.material.uniforms.uTime.value,.25);
 assert.equal(barrier.material.uniforms.uGlow.value,0);
 effects.setHidden(new Set([block.id]));assert.ok([...effects.mesh.geometry.getAttribute('aData').array].filter((_,i)=>i%4===1).every(v=>v===0));
 assert.deepEqual(effectColor(block).toArray(),[.02,.42,1]);effects.dispose();
});

test('tunnel walls face inward and both openings have barrier geometry',async()=>{
 const {blockSurfaceGeometry}=await import('../src/avorion/lib/geometry/blockSurface.js');
 const block=makeBlock({typeIndex:10,position:{x:0,y:0,z:0},size:{x:4,y:4,z:4}});
 const {positions}=blockSurfaceGeometry(block,defaultOrientationProfile());
 for(let i=72*3;i<positions.length;i+=9){
  const a=new THREE.Vector3().fromArray(positions,i),b=new THREE.Vector3().fromArray(positions,i+3),c=new THREE.Vector3().fromArray(positions,i+6);
  const normal=b.clone().sub(a).cross(c.clone().sub(a)),center=a.clone().add(b).add(c).divideScalar(3);center.z=0;
  assert.ok(normal.dot(center)<0,'interior normal points into passage');
 }
 const effects=buildBlockEffects([block],defaultOrientationProfile(),{}),roots=effects.mesh.geometry.getAttribute('aRoot');
 assert.equal(roots.count,12);assert.equal(roots.getZ(0),-roots.getZ(6));assert.ok(roots.getZ(0)<0);effects.dispose();
});
