import * as THREE from '../vendor/three.module.js';
import {componentEntries} from './core.js';
import {mountedBlockId} from './socket-ids.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
const cache=new WeakMap();
export function worldComponentBlocks(scene){
 const entries=componentEntries(scene);let result=cache.get(entries);if(result)return result;
 result=[];const profile=defaultOrientationProfile();
 for(const entry of entries)for(const block of entry.asset.blocks){if(block.deleted)continue;const positions=blockSurfaceGeometry(block,profile).positions,points=[];for(let i=0;i<positions.length;i+=3)points.push(new THREE.Vector3().fromArray(positions,i).applyMatrix4(entry.matrix));
  const box=new THREE.Box3().setFromPoints(points),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  result.push({...block,id:mountedBlockId(entry.instance.id,block.id),mountId:entry.instance.id,rootBlockId:entry.socket.blockId,ancestorHidden:!!entry.instance.hidden||!!entry.socket.ancestorHidden,position:{x:center.x,y:center.y,z:center.z},size:{x:size.x,y:size.y,z:size.z},attachmentPositions:Float32Array.from(points.flatMap(p=>p.toArray())),box});
 }
 cache.set(entries,result);return result;
}
const trees=new WeakMap();
export function componentRayHit(scene,ray,ignoreMounts=null){
 if(!scene.model?.componentSetup?.mounts.length)return null;
 const blocks=worldComponentBlocks(scene);let tree=trees.get(blocks);
 const split=items=>{const box=new THREE.Box3();for(const b of items)box.union(b.box);if(items.length<=16)return {box,items};const size=box.getSize(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';items.sort((a,b)=>a.box.min[axis]+a.box.max[axis]-b.box.min[axis]-b.box.max[axis]);const mid=items.length>>1;return {box,left:split(items.slice(0,mid)),right:split(items.slice(mid))};};
 if(!tree){tree=split([...blocks]);trees.set(blocks,tree);}let nearest=null;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),point=new THREE.Vector3();
 const visit=node=>{if(!node||!ray.intersectsBox(node.box))return;if(!node.items){visit(node.left);visit(node.right);return;}for(const block of node.items){if(ignoreMounts?.has(block.mountId)||block.ancestorHidden||scene.hiddenIds?.has(block.rootBlockId)||!ray.intersectsBox(block.box))continue;const p=block.attachmentPositions;for(let i=0;i<p.length;i+=9){a.fromArray(p,i);b.fromArray(p,i+3);c.fromArray(p,i+6);if(!ray.intersectTriangle(a,b,c,false,point))continue;const distance=ray.origin.distanceTo(point);if(!nearest||distance<nearest.distance)nearest={point:point.clone(),distance,blockId:block.id};}}};visit(tree);return nearest;
}
