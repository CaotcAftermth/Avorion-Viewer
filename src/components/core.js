import {mountedComponentSocketId,mountedBlockId,mountedSocketReference} from './socket-ids.js';
import * as THREE from '../vendor/three.module.js';
import {parseAvorionXml} from '../block-model.js';
import {plainBlocks,frame} from '../turrets/core.js';
import {surfaceSockets} from '../turrets/sockets.js';
import {liveBlocks} from '../ship-structure.js';

export const emptySetup=()=>({version:1,blockType:null,sockets:[],mounts:[]});
export const componentSetup=model=>model.componentSetup||emptySetup();
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
export function validateFrame(value){
  if(!vector(value?.position)||!vector(value?.rotation))throw Error('Attachment position and rotation must contain three finite numbers.');
}
export function validateComponent(asset){
  if(typeof asset?.id!=='string'||typeof asset.name!=='string'||!Array.isArray(asset.blocks)||!asset.blocks.length||asset.blocks.length>100000)throw Error('Invalid component asset.');
  if(asset.attachment!=null)validateFrame(asset.attachment);
  if(asset.sockets!==undefined){
    if(!Array.isArray(asset.sockets)||asset.sockets.length>1000)throw Error('Invalid component asset sockets.');
    const ids=new Set();for(const socket of asset.sockets){validateFrame(socket);if(typeof socket.id!=='string'||ids.has(socket.id)||typeof socket.name!=='string'||socket.name.length>100||(socket.blockId!==undefined&&!asset.blocks.some(b=>b.id===socket.blockId)))throw Error('Invalid component asset socket.');ids.add(socket.id);}
  }
  if(asset.attachmentSocketId!=null&&(!asset.sockets?.some(s=>s.id===asset.attachmentSocketId)||!asset.attachment))throw Error('Invalid primary attachment socket.');
  // Library organisation: optional folder and tags.
  if(asset.folder!==undefined&&(typeof asset.folder!=='string'||asset.folder.length>100))throw Error('Invalid component folder.');
  if(asset.tags!==undefined&&(!Array.isArray(asset.tags)||asset.tags.length>50||asset.tags.some(tag=>typeof tag!=='string'||tag.length>50)))throw Error('Invalid component tags.');
  for(const block of asset.blocks)if(!['x','y','z'].every(axis=>Number.isFinite(block.position?.[axis])&&Number.isFinite(block.size?.[axis])&&block.size[axis]>0)||!Number.isInteger(block.typeIndex)||![block.look,block.up].every(n=>Number.isInteger(n)&&n>=0&&n<=5)||Math.floor(block.look/2)===Math.floor(block.up/2)||!Number.isInteger(block.materialIndex)||!/^([0-9a-f]{8})$/i.test(block.color))throw Error('Invalid component block.');
  return asset;
}
export function importComponent(text,name,id=crypto.randomUUID()){
  const model=parseAvorionXml(text,name,text.length);
  return validateComponent({id,name,sourceXml:text,blocks:plainBlocks(model),attachment:null,attachmentSocketId:null,sockets:[]});
}
export function validateSetup(setup){
  if(setup?.version!==1||!(setup.blockType===null||Number.isInteger(setup.blockType))||!Array.isArray(setup.sockets)||!Array.isArray(setup.mounts)||setup.sockets.length>1000||setup.mounts.length>1000)throw Error('Invalid component setup.');
  const ids=new Set();
  for(const socket of setup.sockets){validateFrame(socket);if(typeof socket.id!=='string'||ids.has(socket.id)||typeof socket.name!=='string'||(socket.blockId!==undefined&&typeof socket.blockId!=='string'))throw Error('Invalid or duplicate component socket.');ids.add(socket.id);}
  if(setup.attachmentSocketId!=null&&!ids.has(setup.attachmentSocketId))throw Error('Primary attachment socket is missing.');
  const occupied=new Set();
  for(const mount of setup.mounts){validateComponent(mount.asset);if(!mount.asset.attachment)throw Error('Assign an attachment point to the component before mounting it.');for(const key of ['offset','rotation'])if(mount[key]!==undefined&&!vector(mount[key]))throw Error('Invalid component transform.');if(typeof mount.id!=='string'||typeof mount.socketId!=='string'||occupied.has(mount.socketId)||(mount.name!==undefined&&(typeof mount.name!=='string'||mount.name.length>100))||(mount.hidden!==undefined&&typeof mount.hidden!=='boolean')||!Number.isFinite(mount.scale)||mount.scale<=0||mount.scale>1000||!Number.isFinite(mount.twist))throw Error('Invalid component mount.');occupied.add(mount.socketId);}
  const mounts=new Map(setup.mounts.map(m=>[m.id,m]));if(mounts.size!==setup.mounts.length)throw Error('Duplicate component mount.');
  for(const mount of setup.mounts){const seen=new Set([mount.id]);let current=mount;
    while(current){const reference=mountedSocketReference(current.socketId);if(!reference)break;if(seen.has(reference.mountId))throw Error('Component attachment cycle.');seen.add(reference.mountId);const parent=mounts.get(reference.mountId);if(parent&&(!parent.asset.sockets?.some(s=>s.id===reference.socketId)||parent.asset.attachmentSocketId===reference.socketId))throw Error('Parent component socket is unavailable.');current=parent;}
  }
  return setup;
}
const socketCache=new WeakMap();
function resolvedComponents(scene){
  if(!scene.model?.componentSetup)return {sockets:[],entries:[]};
  const setup=componentSetup(scene.model),blocks=liveBlocks(scene),offset=scene.model.placementOffset;
  const cached=socketCache.get(scene);
  if(cached?.setup===setup&&cached.blocks===blocks&&cached.offset===offset&&cached.revision===scene.revision)return cached;
  const automatic=setup.blockType===null?[]:blocks.filter(b=>b.typeIndex===setup.blockType).flatMap(block=>surfaceSockets(block).map(s=>({...s,id:s.id.replace('turret:','component:'),type:'component'})));
  const manual=setup.sockets.flatMap(socket=>{
    const block=socket.blockId?blocks.find(b=>b.id===socket.blockId):null;
    if(socket.blockId&&!block)return [];
    const position=socket.position.map((v,i)=>v+(block?block.position[['x','y','z'][i]]:offset?.[['x','y','z'][i]]||0));
    const normal=new THREE.Vector3(0,1,0).transformDirection(frame([0,0,0],socket.rotation)).toArray();
    return [{...socket,position,normal,type:'component'}];
  });
  const sockets=[...automatic,...manual],entries=[],byId=new Map(sockets.map(s=>[s.id,s])),pending=[...setup.mounts];
  // Resolve parents first, independent of storage order. Unresolved legacy
  // references remain in setup data, but never recurse or create geometry.
  while(pending.length){let progressed=false;
    for(let i=pending.length-1;i>=0;i--){const instance=pending[i],socket=byId.get(instance.socketId);if(!socket)continue;
      const matrix=componentMatrix(instance.asset,socket,instance),entry={asset:instance.asset,socket,instance,component:true,matrix};entries.push(entry);pending.splice(i,1);progressed=true;
      for(const saved of instance.asset.sockets||[]){if(saved.id===instance.asset.attachmentSocketId)continue;const block=saved.blockId?instance.asset.blocks.find(b=>b.id===saved.blockId&&!b.deleted):null;if(saved.blockId&&!block)continue;
        const position=saved.position.map((n,k)=>n+(block?.position['xyz'[k]]||0)),posed=matrix.clone().multiply(frame(position,saved.rotation)),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();posed.decompose(p,q,scale);const euler=new THREE.Euler().setFromQuaternion(q,'XYZ');
        const live={...saved,id:mountedComponentSocketId(instance.id,saved.id),sourceSocketId:saved.id,parentMountId:instance.id,componentBlockId:block?mountedBlockId(instance.id,block.id):null,blockId:socket.blockId,position:p.toArray(),rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg),normal:new THREE.Vector3(0,1,0).applyQuaternion(q).toArray(),type:'component',ancestorHidden:!!instance.hidden||!!socket.ancestorHidden,name:(instance.name||instance.asset.name)+' / '+saved.name};
        sockets.push(live);byId.set(live.id,live);
      }
    }
    if(!progressed)break;
  }
  const result={setup,blocks,offset,revision:scene.revision,sockets,entries};socketCache.set(scene,result);return result;
}
export function savedSocket(model,socket,name=socket.name){
  const block=model.blocks.find(b=>b.id===socket.blockId),offset=model.placementOffset||{};
  return {id:crypto.randomUUID(),name,blockId:block?.id,position:socket.position.map((v,i)=>v-(block?block.position[['x','y','z'][i]]:offset?.[['x','y','z'][i]]||0)),rotation:[...socket.rotation]};
}
export function componentMatrix(asset,socket,mount){
  if(!asset.attachment)throw Error('Assign an attachment point to the component before mounting it.');
  return frame(socket.position,socket.rotation).multiply(frame(mount.offset||[0,0,0],mount.rotation||[0,0,0])).multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(mount.twist||0)))
    .scale(new THREE.Vector3().setScalar(mount.scale??1)).multiply(frame(asset.attachment.position,asset.attachment.rotation).invert());
}
export function attachComponent(setup,asset,socket){
  validateComponent(asset);if(!asset.attachment)throw Error('Assign an attachment point to the component before mounting it.');if(socket?.type!=='component')throw Error('Choose a component socket.');
  if(setup.mounts.some(m=>m.socketId===socket.id))throw Error('Component socket already occupied.');
  return {...setup,mounts:[...setup.mounts,{id:crypto.randomUUID(),socketId:socket.id,asset:structuredClone(asset),scale:1,twist:0}]};
}
export function componentSockets(scene){return resolvedComponents(scene).sockets;}
export function componentEntries(scene){return resolvedComponents(scene).entries;}
