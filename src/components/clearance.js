import {posedComponentBlocks} from '../turrets/posed-blocks.js';
import {liveBlocks} from '../ship-structure.js';
import {componentSetup} from './core.js';

// Overlap check between mounted components and the hull, and between components.
// Boxes are axis-aligned, so a component turned by a non-90° angle can report a
// near miss as an overlap; the warning says "may overlap" for that reason.
const EPSILON=.02,CELL=4,cache=new WeakMap();
const box=b=>({min:['x','y','z'].map(a=>b.position[a]-b.size[a]/2+EPSILON),max:['x','y','z'].map(a=>b.position[a]+b.size[a]/2-EPSILON)});
const overlaps=(a,b)=>a.min.every((v,i)=>v<b.max[i]&&b.min[i]<a.max[i]);
export function componentClashes(scene){
 const model=scene.model;if(!model?.componentSetup?.mounts.length)return new Map();
 const blocks=liveBlocks(scene),setup=componentSetup(model),cached=cache.get(scene);
 if(cached&&cached.setup===setup&&cached.blocks===blocks&&cached.offset===model.placementOffset)return cached.result;
 const grid=new Map(),large=[];
 const cells=(b,visit)=>{const lo=b.min.map(v=>Math.floor(v/CELL)),hi=b.max.map(v=>Math.floor(v/CELL));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)visit(x+','+y+','+z);};
 for(const block of blocks){const b=box(block);const span=b.max.map((v,i)=>Math.floor(v/CELL)-Math.floor(b.min[i]/CELL)+1);if(span[0]*span[1]*span[2]>512){large.push(b);continue;}cells(b,key=>{let list=grid.get(key);if(!list)grid.set(key,list=[]);list.push(b);});}
 const posed=posedComponentBlocks(scene).map(block=>({...box(block),mountId:block.mountId})),result=new Map();
 const entry=id=>{let e=result.get(id);if(!e)result.set(id,e={hull:0,components:new Set()});return e;};
 for(const part of posed){
  const seen=new Set();let hit=large.some(b=>overlaps(part,b));
  if(!hit)cells(part,key=>{if(hit)return;for(const b of grid.get(key)||[]){if(seen.has(b))continue;seen.add(b);if(overlaps(part,b)){hit=true;return;}}});
  if(hit)entry(part.mountId).hull++;
 }
 for(let i=0;i<posed.length&&i<4000;i++)for(let j=i+1;j<posed.length&&j<4000;j++){
  const a=posed[i],b=posed[j];if(a.mountId!==b.mountId&&overlaps(a,b)){entry(a.mountId).components.add(b.mountId);entry(b.mountId).components.add(a.mountId);}
 }
 cache.set(scene,{setup,blocks,offset:model.placementOffset,result});return result;
}
export function clashText(scene,clash){
 if(!clash)return '';const names=[...clash.components].map(id=>{const m=componentSetup(scene.model).mounts.find(m=>m.id===id);return m?.name||m?.asset.name||'component';});
 return [clash.hull?`may overlap the hull (${clash.hull} of its blocks)`:'',names.length?'may overlap '+names.join(', '):''].filter(Boolean).join('; ');
}
