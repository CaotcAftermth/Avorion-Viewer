import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
import {frame} from './core.js';
import {containingBlockIds} from './fire-coverage.js';

// Visibility is not clearance: hidden hull blocks still occupy physical space.
// Check the base envelope only, not the turret's moving body or barrel.
export function createSocketClearance(blocks){
 const profile=defaultOrientationProfile(),epsilon=1e-4;
 const entries=blocks.map(block=>{
  const center=new THREE.Vector3(block.position.x,block.position.y,block.position.z);
  const half=new THREE.Vector3(block.size.x,block.size.y,block.size.z).multiplyScalar(.5);
  return {block,box:new THREE.Box3(center.clone().sub(half),center.clone().add(half)),points:null};
 });
 return socket=>{
  if(socket.fitSize==null)return null;
  const matrix=frame(socket.position,socket.rotation),inverse=matrix.clone().invert();
  const clear=size=>{
   const box=new THREE.Box3(new THREE.Vector3(-size/2+epsilon,epsilon,-size/2+epsilon),new THREE.Vector3(size/2-epsilon,size-epsilon,size/2-epsilon));
   const worldBox=box.clone().applyMatrix4(matrix),center=box.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
   for(const entry of entries){
    if(entry.block.id===socket.blockId||!entry.box.intersectsBox(worldBox))continue;
    if(!entry.points){const p=blockSurfaceGeometry(entry.block,profile).positions;entry.points=[];for(let i=0;i<p.length;i+=3)entry.points.push(new THREE.Vector3().fromArray(p,i));}
    const triangle=new THREE.Triangle();
    for(let i=0;i<entry.points.length;i+=3){
     triangle.set(...entry.points.slice(i,i+3).map(p=>p.clone().applyMatrix4(inverse)));
     if(box.intersectsTriangle(triangle))return false;
    }
    // A large solid may enclose the entire envelope without crossing its edges.
    if(containingBlockIds({box:entry.box,items:[{id:entry.block.id,box:entry.box,points:entry.points}]},center).size)return false;
   }
   return true;
  };
  let low=0,high=Math.round(socket.fitSize*2);
  while(low<high){const mid=Math.ceil((low+high)/2);if(clear(mid/2))low=mid;else high=mid-1;}
  return low?low/2:null;
 };
}
