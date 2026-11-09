import * as THREE from '../vendor/three.module.js';
import {frame} from '../turrets/core.js';
import {componentSetup,componentSockets,emptySetup,validateComponent} from './core.js';

// An absent reference preserves a legacy attachment frame. Explicit null means
// no attachment was assigned; creating a socket never promotes it implicitly.
export function assetSocketSetup(asset){return {...emptySetup(),sockets:structuredClone(asset.sockets||[]),...(asset.attachmentSocketId!==undefined?{attachmentSocketId:asset.attachmentSocketId}:{})};}
export function assetAttachment(scene){
 const setup=componentSetup(scene.model||{}),asset=scene.componentAttachmentDraft;
 if(setup.attachmentSocketId===undefined)return asset?.attachment||null;
 if(setup.attachmentSocketId===null)return null;
 const socket=componentSockets(scene).find(s=>s.id===setup.attachmentSocketId);if(!socket)return null;
 // A ship socket points outward; the component attachment points inward.
 const matrix=frame([0,0,0],socket.rotation).multiply(new THREE.Matrix4().makeRotationX(Math.PI)),euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');
 return {position:[...socket.position],rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)};
}
export function snapshotComponentAsset(scene){
 const setup=componentSetup(scene.model),asset=scene.componentAttachmentDraft;
 return validateComponent({...asset,blocks:scene.model.blocks.filter(b=>!b.deleted).map(({el,itemEl,...b})=>structuredClone(b)),sockets:structuredClone(setup.sockets),attachmentSocketId:setup.attachmentSocketId,attachment:assetAttachment(scene)});
}
export const withoutSocket=(setup,id)=>({...setup,sockets:setup.sockets.filter(s=>s.id!==id),...(setup.attachmentSocketId===id?{attachmentSocketId:null}:{})});
