import test from 'node:test';
import assert from 'node:assert/strict';
import {refineSlice} from '../src/turrets/coverage-refinement.js';
import {sampleTargets,COVERAGE_DEFAULTS} from '../src/turrets/coverage-sampling.js';
import {fanSurface} from '../src/turrets/coverage-surface.js';
const options={...COVERAGE_DEFAULTS,extent:10,quality:'low'};
const sampling=()=>sampleTargets(options,[0,0,0],1);
const sample=(point,yes)=>({point,valid:true,clear:+yes,potential:1,obstructed:+!yes,classification:yes?'covered':'structurally-obstructed',unresolved:[],contributors:[{id:'a',clear:yes}]});
test('adaptive contours locate an off-center straight transition without averaging it into blocked space',async()=>{
 const evaluate=p=>sample(p,p[0]>=1.137+.31*p[2]),base=sampling();
 const original={...base,turrets:[{id:'a'}],samples:base.cells.map(c=>evaluate(c.point))};
 const r=await refineSlice(base,evaluate,{depth:2});r.turrets=original.turrets;
 const surface=fanSurface(r,options);
 let worst=0,points=0;
 for(let i=0;i<surface.edges.length;i+=3){const [x,,z]=surface.edges.slice(i,i+3);if(Math.hypot(x,z)>9.8)continue;worst=Math.max(worst,Math.abs(x-1.137-.31*z));points++;}
 assert.ok(points>10);assert.ok(worst<.02,`boundary error ${worst}`);
 for(let i=0;i<surface.positions.length;i+=3){const [x,,z]=surface.positions.slice(i,i+3);assert.ok(x>=1.137+.31*z-1e-9,'blocked vertex falsely colored clear');}
 assert.ok(r.refinement.evaluations<30000);assert.ok(r.cells.length<base.cells.length*4*16,'uniform regions were needlessly subdivided');
 assert.ok(surface.sampleMap.every(i=>r.samples[i].point.every((n,k)=>Math.abs(n-r.cells[i].point[k])<1e-8)));
});
test('uniform fields have only the outer outline; unresolved fields cannot become clear',async()=>{
 const r=await refineSlice(sampling(),p=>sample(p,true));r.turrets=[{id:'a'}];
 const surface=fanSurface(r,options);
 for(let i=0;i<surface.edges.length;i+=3)assert.ok(Math.hypot(surface.edges[i],surface.edges[i+2])>9.99);
 const unresolved=await refineSlice(sampling(),p=>({...sample(p,true),unresolved:['a']}));unresolved.turrets=r.turrets;
 assert.equal(fanSurface(unresolved,options).positions.length,0);
});
test('refinement yields for cancellation and reports exhausted refinement budget',async()=>{
 let ticks=0;const r=await refineSlice(sampling(),p=>sample(p,p[0]>.3),{budget:1,checkpoint:async()=>{ticks++;}});
 assert.ok(r.refinement.limited);assert.ok(ticks>0);
 await assert.rejects(refineSlice(sampling(),p=>sample(p,true),{checkpoint:async()=>{throw Error('Cancelled');}}),/Cancelled/);
});
