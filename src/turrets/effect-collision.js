import * as THREE from '../vendor/three.module.js';
import {obstacleTree,rayHit,containingBlockIds} from './fire-coverage.js';
// Build local BVHs once; articulated parts only update inverse matrices.
export function createEffectCollision(asset){
 const trees=Object.fromEntries(['base','body','barrel'].map(part=>[part,obstacleTree(asset.blocks.filter(b=>(asset.parts[b.id]||'base')===part))]));
 let frames=[];
 return {
  update(matrices){frames=Object.entries(trees).filter(([,tree])=>tree).map(([part,tree])=>({tree,matrix:matrices[part],inverse:matrices[part].clone().invert()}));},
  hit(origin,direction,maxDistance){let nearest=null;const start=new THREE.Vector3(...origin),end=start.clone().addScaledVector(new THREE.Vector3(...direction),maxDistance);
   for(const {tree,matrix,inverse} of frames){const local=start.clone().applyMatrix4(inverse),finish=end.clone().applyMatrix4(inverse),delta=finish.sub(local),length=delta.length();if(length<1e-9)continue;delta.normalize();
    // A muzzle authored inside its source block must be able to leave it.
    const excluded=containingBlockIds(tree,local),hit=rayHit(tree,local,delta,length,1e-6,excluded);
    if(hit){const position=new THREE.Vector3(...hit.point).applyMatrix4(matrix),distance=position.distanceTo(start);if(!nearest||distance<nearest.distance)nearest={distance,position:position.toArray()};}
   }return nearest;
  }
 };
}
