import { BLOCK_DEFINITIONS, MATERIALS, getBlockDefinition } from './avorion/lib/avorion/blockDefinitions.js';
import { parseAvorionXml } from './avorion/lib/avorion/parseAvorionXml.js';
export { BLOCK_DEFINITIONS, MATERIALS, getBlockDefinition, parseAvorionXml };
export const ORIENTATIONS=Array.from({length:6},(_,look)=>Array.from({length:6},(_,up)=>({look,up}))).flat().filter(p=>Math.floor(p.look/2)!==Math.floor(p.up/2));
export const AXES=['−X','+X','−Y','+Y','−Z','+Z'];
export const nativeToView=([x,y,z])=>[x,-z,y];
export const viewToNative=([x,y,z])=>[x,z,-y];
export function makeBlock({typeIndex=2,look=1,up=3,size={x:2,y:2,z:2},position={x:0,y:1,z:0},materialIndex=0,color='ffa0a0a0',secondaryColor,id='b0'}={}) {
  return {id,typeIndex,type:getBlockDefinition(typeIndex).displayName,look,up,size,position,materialIndex,...(secondaryColor!==undefined?{secondaryColor}:{}),material:MATERIALS[materialIndex]?.name||'Unknown',color,unknownAttrs:secondaryColor?{secondaryColor}:{}};
}
export function makeModel(blocks,fileName='Block preview') {
  const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
  for(const b of blocks)for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],b.position[axis]-b.size[axis]/2);max[axis]=Math.max(max[axis],b.position[axis]+b.size[axis]/2);}
  return {blocks,fileName,bounds:{min,max,size:Object.fromEntries(['x','y','z'].map(a=>[a,max[a]-min[a]]))},warnings:[],unknownTypeIndices:[]};
}
export function modelCorners(model) {
  const {min,max}=model.bounds;
  return [min.x,max.x].flatMap(x=>[min.y,max.y].flatMap(y=>[min.z,max.z].map(z=>nativeToView([x,y,z]))));
}
export function orientationGallery() {
  const types=[2,100,101,102,103,108,109,112];
  return makeModel(ORIENTATIONS.flatMap((o,row)=>types.map((typeIndex,column)=>makeBlock({...o,typeIndex,id:`b${row*8+column}`,size:{x:2,y:4,z:8},position:{x:(column-3.5)*4+(Math.floor(row/6)-1.5)*36,y:2,z:(row%6-2.5)*10},color:['ffb4c4d4','ffcf997b','ff82b09c'][row%3]}))),'8 shapes × 24 orientations');
}
export function repaintRGB(argb,rgb) {
  return (/^[0-9a-f]{8}$/i.test(argb)?argb.slice(0,2):'ff')+rgb.replace(/^#/,'').toLowerCase();
}

// Viewer placement is independent of the native XML coordinates retained for export.
export function placeImportedModel(model,mode='centered') {
  if(!model.blocks.length)return model;
  const previous=model.placementOffset||{x:0,y:0,z:0},bounds=model.bounds;
  const offset=Object.fromEntries(['x','y','z'].map(a=>[a,mode==='imported'?0:mode==='placed'&&a==='y'?previous[a]-bounds.min[a]:previous[a]-(bounds.min[a]+bounds.max[a])/2]));
  for(const axis of ['x','y','z']){
    const delta=offset[axis]-previous[axis];
    for(const block of model.blocks)block.position[axis]+=delta;
    bounds.min[axis]+=delta;bounds.max[axis]+=delta;
  }
  model.placement=mode;model.placementOffset=offset;
  return model;
}

// Frame occupied block bounds rather than the empty corners of the ship-wide box.
export function blockFramePoints(blocks){
 const points=[];for(const b of blocks)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])points.push(nativeToView([b.position.x+x*b.size.x,b.position.y+y*b.size.y,b.position.z+z*b.size.z]));return points;
}
