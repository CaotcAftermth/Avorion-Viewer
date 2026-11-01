import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
import {partMatrices,pitchLimits,effectiveScale} from './core.js';

const profile=defaultOrientationProfile();
export function obstacleTree(blocks,matrices=null,parts=null){
 const entries=blocks.map(b=>{const p=blockSurfaceGeometry(b,profile).positions,points=[];
  for(let i=0;i<p.length;i+=3){const v=new THREE.Vector3().fromArray(p,i);if(matrices)v.applyMatrix4(matrices[parts[b.id]||'base']);points.push(v);}
  return {id:b.id,points,box:new THREE.Box3().setFromPoints(points)};
 });
 function split(items){if(!items.length)return null;const box=new THREE.Box3();for(const e of items)box.union(e.box);if(items.length<=8)return {box,items};const size=box.getSize(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';items.sort((a,b)=>a.box.min[axis]+a.box.max[axis]-b.box.min[axis]-b.box.max[axis]);const mid=items.length>>1;return {box,left:split(items.slice(0,mid)),right:split(items.slice(mid))};}
 return split(entries);
}
export function rayDistance(tree,origin,direction){
 const ray=new THREE.Ray(origin,direction),point=new THREE.Vector3();let nearest=Infinity;
 function visit(node){if(!node||!ray.intersectsBox(node.box))return;if(!node.items){visit(node.left);visit(node.right);return;}
  for(const e of node.items){if(!ray.intersectsBox(e.box))continue;for(let i=0;i<e.points.length;i+=3)if(ray.intersectTriangle(e.points[i],e.points[i+1],e.points[i+2],false,point)){const d=point.distanceTo(origin);if(d>1e-6)nearest=Math.min(nearest,d);}}}
 visit(tree);return nearest;
}
export const rayBlocked=(tree,origin,direction)=>Number.isFinite(rayDistance(tree,origin,direction));
// Bounded, two-sided triangle query. Bounds accelerate queries; they never stand
// in for the actual block surface. IDs survive into coverage inspection.
// Entry distance of a unit-direction ray into a box, or Infinity when missed.
function boxEntry(box,ox,oy,oz,ix,iy,iz){
 let t0=(box.min.x-ox)*ix,t1=(box.max.x-ox)*ix,enter=Math.min(t0,t1),exit=Math.max(t0,t1);
 t0=(box.min.y-oy)*iy;t1=(box.max.y-oy)*iy;enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));
 t0=(box.min.z-oz)*iz;t1=(box.max.z-oz)*iz;enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));
 enter=Math.max(enter,0);return enter<=exit?enter:Infinity;
}
const safeInverse=n=>1/(Math.abs(n)<1e-12?(n<0?-1e-12:1e-12):n);
// Cheap reject before a full tree query: entry distance of a unit-direction ray.
export const rayBoxEntry=(box,origin,direction)=>boxEntry(box,origin.x,origin.y,origin.z,safeInverse(direction.x),safeInverse(direction.y),safeInverse(direction.z));
export function rayHit(tree,origin,direction,maxDistance=Infinity,epsilon=1e-7,excludedIds=null){
 const ray=new THREE.Ray(origin,direction),point=new THREE.Vector3();let hit=null,nearest=maxDistance;
 const ox=origin.x,oy=origin.y,oz=origin.z,ix=safeInverse(direction.x),iy=safeInverse(direction.y),iz=safeInverse(direction.z),scale=direction.length();
 // Nearest-first traversal: boxes entered beyond the current nearest hit (or the
 // target distance) cannot contain a closer triangle and are skipped.
 const entry=box=>boxEntry(box,ox,oy,oz,ix,iy,iz)*scale;
 function visit(node,enter){if(!node||enter>nearest)return;if(!node.items){const a=entry(node.left?.box??EMPTY),b=entry(node.right?.box??EMPTY);if(a<=b){visit(node.left,a);visit(node.right,b);}else{visit(node.right,b);visit(node.left,a);}return;}
  for(const e of node.items){if(excludedIds?.has(e.id)||entry(e.box)>nearest)continue;for(let i=0;i<e.points.length;i+=3)if(ray.intersectTriangle(e.points[i],e.points[i+1],e.points[i+2],false,point)){const distance=point.distanceTo(origin);if(distance>epsilon&&distance<nearest-epsilon){nearest=distance;hit={blockId:e.id,distance,point:point.toArray()};}}}
 }if(tree)visit(tree,entry(tree.box));return hit;
}
const EMPTY=new THREE.Box3();
export function containingBlockIds(tree,point,epsilon=1e-7,firstOnly=false){
 const direction=new THREE.Vector3(1,.371,.529).normalize(),ray=new THREE.Ray(point,direction),intersection=new THREE.Vector3();
 const ids=new Set();
 function contains(e){if(!e.box.containsPoint(point))return false;const distances=[];for(let i=0;i<e.points.length;i+=3)if(ray.intersectTriangle(e.points[i],e.points[i+1],e.points[i+2],false,intersection)){const d=intersection.distanceTo(point);if(d<=epsilon)return true;if(!distances.some(n=>Math.abs(n-d)<epsilon))distances.push(d);}return distances.length%2===1;}
 function visit(node){if(!node?.box.containsPoint(point)||(firstOnly&&ids.size))return;if(!node.items){visit(node.left);visit(node.right);return;}
  for(const e of node.items)if(contains(e)){ids.add(e.id);if(firstOnly)return;}
 }visit(tree);return ids;
}
export const pointInside=(tree,point,epsilon=1e-7)=>containingBlockIds(tree,point,epsilon,true).size>0;
export function muzzleOrigins(asset){
 if(asset.native&&asset.muzzlePositions?.length)return {estimated:false,points:asset.muzzlePositions.map(p=>new THREE.Vector3(...p).add(new THREE.Vector3(...asset.native.offsets.barrel)))};
 const marked=asset.blocks.filter(b=>asset.muzzles?.includes(b.id));
 if(marked.length)return {estimated:true,points:marked.map(b=>new THREE.Vector3(b.position.x,b.position.y,b.position.z+(asset.native?1:-1)*b.size.z/2))};
 const barrel=asset.blocks.filter(b=>asset.parts[b.id]==='barrel');if(!barrel.length)throw Error('Assign Barrel geometry or native muzzle points before showing angle of fire.');
 const tree=obstacleTree(barrel),center=tree.box.getCenter(new THREE.Vector3());center.z=asset.native?tree.box.max.z:tree.box.min.z;return {estimated:true,points:[center]};
}
export function computeCoverage({blocks,mounts,sockets,selectedId,step=10,prepared=null}){
 const mount=mounts.find(m=>m.id===selectedId),socket=mount&&sockets.find(s=>s.id===mount.socketId);if(!socket)throw Error('Selected turret has no mounting socket.');
 const asset=mount.asset,muzzles=muzzleOrigins(asset),ship=prepared?.ship??obstacleTree(blocks);
 const other=mounts.filter(m=>m.id!==mount.id).flatMap(m=>{const s=sockets.find(s=>s.id===m.socketId);return s?[prepared?.turrets.get(m.id)??obstacleTree(m.asset.blocks,partMatrices(m.asset,s,m),m.asset.parts)]:[];});
 const own=Object.fromEntries(['base','body','barrel'].map(part=>[part,obstacleTree(asset.blocks.filter(b=>asset.parts[b.id]===part))]));
 const limits=pitchLimits(asset),coaxial=asset.native?.coaxial==='true'||asset.native?.coaxial==='1',pitches=[];
 if(coaxial)pitches.push(0);else{for(let p=limits.min;p<limits.max;p+=step)pitches.push(p);pitches.push(limits.max);}
 const samples=[];
 for(let yaw=0;yaw<(coaxial?1:360);yaw+=step)for(const pitch of pitches){
  const matrices=partMatrices(asset,socket,{...mount,yaw,pitch}),inverse=Object.fromEntries(Object.entries(matrices).map(([part,m])=>[part,m.clone().invert()]));
  const direction=new THREE.Vector3(0,0,asset.native?1:-1).transformDirection(matrices.barrel);let blocked=0;const rays=[];
  for(const muzzle of muzzles.points){const origin=muzzle.clone().applyMatrix4(matrices.barrel).addScaledVector(direction,1e-6);
   let distance=rayDistance(ship,origin,direction);for(const tree of other)distance=Math.min(distance,rayDistance(tree,origin,direction));
   for(const [part,tree] of Object.entries(own))distance=Math.min(distance,rayDistance(tree,origin.clone().applyMatrix4(inverse[part]),direction.clone().transformDirection(inverse[part]))*effectiveScale(asset,mount));
   if(Number.isFinite(distance))blocked++;
   rays.push({origin:origin.toArray(),distance});
  }
  samples.push({rays,direction:direction.toArray(),state:blocked===0?'clear':blocked===muzzles.points.length?'blocked':'partial',yaw,pitch});
 }
 return {samples,pitchCount:pitches.length,estimated:muzzles.estimated,muzzles:muzzles.points.length,coaxial,center:socket.position,step};
}

export function computeShipCoverage(input,progress=()=>{}){
 const prepared={ship:obstacleTree(input.blocks),turrets:new Map()},results=[],warnings=[];
 for(const m of input.mounts){const socket=input.sockets.find(s=>s.id===m.socketId);if(socket)prepared.turrets.set(m.id,obstacleTree(m.asset.blocks,partMatrices(m.asset,socket,m),m.asset.parts));}
 for(const [i,m] of input.mounts.entries()){
  try{results.push({...computeCoverage({...input,selectedId:m.id,prepared}),id:m.id,name:m.name==='Mounted turret'?m.asset.name:m.name});}catch(error){warnings.push({id:m.id,name:m.asset.name,message:error.message});}
  progress(i+1,input.mounts.length);
 }return {turrets:results,warnings};
}
