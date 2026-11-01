import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
import {partMatrices} from './core.js';
import {sceneSockets} from './sockets.js';
import {mounts} from './mounts.js';

// Bake mounted poses once for framing or export. Local triangle coordinates
// retain arbitrary pitch/yaw; axis-aligned bounds alone cannot represent them.
export function posedTurretBlocks(scene,include=()=>true){
 const result=[],sockets=sceneSockets(scene),profile=defaultOrientationProfile();
 for(const mount of mounts(scene)){
  const socket=sockets.find(s=>s.id===mount.socketId);if(!socket||!include(mount,socket))continue;
  const matrices=partMatrices(mount.asset,socket,mount);
  for(const block of mount.asset.blocks){
   const part=mount.asset.parts[block.id]||'base',positions=blockSurfaceGeometry(block,profile).positions;
   const points=[];for(let i=0;i<positions.length;i+=3)points.push(new THREE.Vector3().fromArray(positions,i).applyMatrix4(matrices[part]));
   const box=new THREE.Box3().setFromPoints(points),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
   const {el,itemEl,...plain}=block;
   result.push({...plain,id:`turret:${mount.id}:${block.id}`,mountId:mount.id,parentId:socket.blockId,position:{x:center.x,y:center.y,z:center.z},size:{x:size.x,y:size.y,z:size.z},exportPositions:Float32Array.from(points.flatMap(p=>p.sub(center).toArray()))});
  }
 }
 return result;
}
export const visibleTurretBlocks=scene=>posedTurretBlocks(scene,(m,s)=>!m.hidden&&!scene.hiddenIds?.has(s.blockId));
