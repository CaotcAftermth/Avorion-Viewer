import test from 'node:test';
import assert from 'node:assert/strict';
import {modelExtents,dimensionRulers,createBlockBoundsOverlay,exteriorRuler,createDimensionCage} from '../src/model-overlays.js';
import {ensureViewportOptions} from '../src/viewport-options.js';
const block=(id,position,size)=>({id,position,size});
test('whole-model dimensions include off-origin blocks and retain native axis meanings',()=>{
 const bounds=modelExtents([block('a',{x:10,y:20,z:-30},{x:4,y:6,z:8}),block('b',{x:-10,y:0,z:5},{x:2,y:2,z:2})]);
 assert.deepEqual(bounds,{min:[-11,-1,-34],max:[12,23,6],size:[23,24,40]});assert.equal(modelExtents([]),null);
 for(const back of [[1,1,1],[-1,-1,-1]]){const rulers=dimensionRulers(bounds,back);assert.deepEqual(rulers.map(r=>r.label),['Width (X): 23 u','Height (Y): 24 u','Length (Z): 40 u']);for(const r of rulers)assert.equal(r.b[r.axis]-r.a[r.axis],r.size);}
});
test('bounds are instanced, cached, and follow visibility and thin-block filters',()=>{
 const blocks=[block('a',{x:10,y:2,z:3},{x:2,y:4,z:6}),block('b',{x:0,y:0,z:0},{x:0,y:3,z:4})],scene={loaded:true,revision:1,model:{blocks},hiddenIds:new Set()},view={showThinBlocks:true};
 const bounds=createBlockBoundsOverlay();bounds.update(scene,view);const g=bounds.object.geometry;
 assert.equal(g.instanceCount,2);assert.equal(g.getAttribute('position').count,24);assert.deepEqual([...g.getAttribute('boundsCenter').array],[10,2,3,0,0,0]);
 const attribute=g.getAttribute('boundsCenter');bounds.update(scene,view);assert.equal(g.getAttribute('boundsCenter'),attribute);
 view.showThinBlocks=false;bounds.update(scene,view);assert.equal(g.instanceCount,1);
 scene.hiddenIds=new Set(['a']);bounds.update(scene,view);assert.equal(g.instanceCount,0);bounds.dispose();
});
test('overlay settings default off and persist independently per viewport',()=>{
 const a={},b={};ensureViewportOptions(a);ensureViewportOptions(b);assert.equal(a.display.showBlockBounds,false);assert.equal(a.display.showModelDimensions,false);
 a.display.showBlockBounds=a.display.showModelDimensions=true;const restored=JSON.parse(JSON.stringify(a));ensureViewportOptions(restored);assert.equal(restored.display.showModelDimensions,true);assert.equal(b.display.showBlockBounds,false);
});

test('dimension rulers stay outside projected bounds with a fixed pixel gap',()=>{
 const corners=[[10,20],[220,30],[180,130],[0,110]];
 for(const sign of [-1,1]){
  const r=exteriorRuler([20,40],[170,90],corners,sign);
  const dot=p=>p[0]*r.normal[0]+p[1]*r.normal[1];
  assert.ok(Math.abs(dot(r.a)-Math.max(...corners.map(dot))-24)<1e-9);
  assert.ok(Math.abs(dot(r.a)-dot(r.b))<1e-9);
 }
 assert.equal(exteriorRuler([1,1],[1,1],corners),null);
});

test('dimension cage uses full model extents and depth-tested cached geometry',()=>{
 const scene={loaded:true,revision:1,model:{blocks:[block('a',{x:1,y:2,z:3},{x:2,y:4,z:6})]},hiddenIds:new Set(['a'])};
 const cage=createDimensionCage();cage.update(scene);
 assert.equal(cage.object.material.depthTest,true);assert.equal(cage.object.material.depthWrite,false);
 const positions=cage.object.geometry.getAttribute('position');assert.equal(positions.count,24);
 assert.equal(cage.object.geometry.getAttribute('lineDistance').count,24);
 cage.update(scene);assert.equal(cage.object.geometry.getAttribute('position'),positions);cage.dispose();
});
