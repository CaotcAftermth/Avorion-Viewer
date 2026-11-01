import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTargets,COVERAGE_DEFAULTS,heatColor} from '../src/turrets/coverage-sampling.js';
import {fanSurface,globeSurface} from '../src/turrets/coverage-surface.js';

const clear=(ids=[])=>({valid:true,clear:ids.length,potential:ids.length,obstructed:0,unresolved:[],classification:ids.length?'covered':'uncovered',contributors:ids.map(id=>({id,clear:true}))});
test('directional sectors stay in their plane, inside their circular extent and close the seam',()=>{
 for(const [plane,axis] of [['top',1],['side',0],['front',2]]){
  const r=sampleTargets({...COVERAGE_DEFAULTS,plane,offset:3,extent:10,quality:'low'},[2,4,6],1);
  assert.equal(r.cells.length,r.angles*r.rings);
  for(const c of r.cells){assert.equal(c.point[axis],[2,4,6][axis]+3);for(const p of c.vertices)assert.ok(Math.hypot(...p.map((v,i)=>i===axis?0:v-[2,4,6][i]))<=10+1e-10);}
  assert.ok(r.cells[0].vertices[1].every((v,i)=>Math.abs(v-r.cells[r.angles-1].vertices[2][i])<1e-10));
 }
});
test('turret fans share continuous interior edges; overlaps retain every contributor and picking index',()=>{
 const r=sampleTargets({...COVERAGE_DEFAULTS,quality:'low'},[0,0,0],1);r.turrets=[{id:'a'},{id:'b'}];r.samples=r.cells.map(()=>clear(['a','b']));
 const surface=fanSurface(r,COVERAGE_DEFAULTS);
 assert.equal(surface.sampleMap.length,r.cells.length*4);
 assert.ok(surface.sampleMap.every(i=>r.samples[i].clear===2));
 assert.equal(surface.edges.length,r.angles*2*6,'only outer circular boundaries, no angular or ring lattice');
 r.samples=r.cells.map(()=>clear());assert.equal(fanSurface(r,COVERAGE_DEFAULTS).positions.length,0,'empty fields stay empty');
 r.samples=r.cells.map(()=>clear(['a']));assert.equal(fanSurface(r,{...COVERAGE_DEFAULTS,overlapOnly:true}).positions.length,0);
});
test('globe tessellation stays spherical, interpolates counts, and maps back to exact analyzed targets',()=>{
 const r=sampleTargets({...COVERAGE_DEFAULTS,mode:'sphere',quality:'low'},[2,4,6],3);r.samples=r.cells.map((_,i)=>clear(i%2?['a','b']:[]));
 const surface=globeSurface(r,'clear',2);
 assert.equal(surface.sampleMap.length,r.cells.length*16);
 assert.ok(surface.uv.some((v,i)=>i%2===0&&v>0&&v<1));
 for(let i=0;i<surface.positions.length;i+=3)assert.ok(Math.abs(Math.hypot(...surface.positions.slice(i,i+3).map((v,k)=>v-r.center[k]))-r.radius)<1e-8);
 assert.ok(surface.sampleMap.every(i=>i>=0&&i<r.samples.length));
 r.samples[0].unresolved=['custom-axis'];const uncertain=globeSurface(r,'clear',2);assert.equal(uncertain.uv[1],.5,'unresolved targets use the purple row, not a false blind count');
 r.samples=r.cells.map(()=>clear());assert.ok(globeSurface(r,'clear',5).uv.every((v,i)=>i%2===1||v===0),'fully blind regions remain black');
 assert.notEqual(heatColor(1.1).getHexString(),heatColor(1.2).getHexString(),'continuous rather than banded scale');
});
