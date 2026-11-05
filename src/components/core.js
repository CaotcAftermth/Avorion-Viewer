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
  validateFrame(asset.attachment);
  // Library organisation: optional folder and tags.
  if(asset.folder!==undefined&&(typeof asset.folder!=='string'||asset.folder.length>100))throw Error('Invalid component folder.');
  if(asset.tags!==undefined&&(!Array.isArray(asset.tags)||asset.tags.length>50||asset.tags.some(tag=>typeof tag!=='string'||tag.length>50)))throw Error('Invalid component tags.');
  for(const block of asset.blocks)if(!['x','y','z'].every(axis=>Number.isFinite(block.position?.[axis])&&Number.isFinite(block.size?.[axis])&&block.size[axis]>0)||!Number.isInteger(block.typeIndex)||![block.look,block.up].every(n=>Number.isInteger(n)&&n>=0&&n<=5)||Math.floor(block.look/2)===Math.floor(block.up/2)||!Number.isInteger(block.materialIndex)||!/^([0-9a-f]{8})$/i.test(block.color))throw Error('Invalid component block.');
  return asset;
}
export function importComponent(text,name,id=crypto.randomUUID()){
  const model=parseAvorionXml(text,name,text.length),{min,max}=model.bounds;
  return validateComponent({id,name,sourceXml:text,blocks:plainBlocks(model),attachment:{position:[(min.x+max.x)/2,min.y,(min.z+max.z)/2],rotation:[0,0,0]}});
}
export function validateSetup(setup){
  if(setup?.version!==1||!(setup.blockType===null||Number.isInteger(setup.blockType))||!Array.isArray(setup.sockets)||!Array.isArray(setup.mounts)||setup.sockets.length>1000||setup.mounts.length>1000)throw Error('Invalid component setup.');
  const ids=new Set();
  for(const socket of setup.sockets){validateFrame(socket);if(typeof socket.id!=='string'||ids.has(socket.id)||typeof socket.name!=='string'||(socket.blockId!==undefined&&typeof socket.blockId!=='string'))throw Error('Invalid or duplicate component socket.');ids.add(socket.id);}
  const occupied=new Set();
  for(const mount of setup.mounts){validateComponent(mount.asset);for(const key of ['offset','rotation'])if(mount[key]!==undefined&&!vector(mount[key]))throw Error('Invalid component transform.');if(typeof mount.id!=='string'||typeof mount.socketId!=='string'||occupied.has(mount.socketId)||(mount.name!==undefined&&(typeof mount.name!=='string'||mount.name.length>100))||(mount.hidden!==undefined&&typeof mount.hidden!=='boolean')||!Number.isFinite(mount.scale)||mount.scale<=0||mount.scale>1000||!Number.isFinite(mount.twist))throw Error('Invalid component mount.');occupied.add(mount.socketId);}
  return setup;
}
const socketCache=new WeakMap();
export function componentSockets(scene){
  if(!scene.model)return [];
  if(!scene.model.componentSetup)return [];
  const setup=componentSetup(scene.model),blocks=liveBlocks(scene),offset=scene.model.placementOffset;
  const cached=socketCache.get(scene);
  if(cached?.setup===setup&&cached.blocks===blocks&&cached.offset===offset&&cached.revision===scene.revision)return cached.sockets;
  const automatic=setup.blockType===null?[]:blocks.filter(b=>b.typeIndex===setup.blockType).flatMap(block=>surfaceSockets(block).map(s=>({...s,id:s.id.replace('turret:','component:'),type:'component'})));
  const manual=setup.sockets.flatMap(socket=>{
    const block=socket.blockId?blocks.find(b=>b.id===socket.blockId):null;
    if(socket.blockId&&!block)return [];
    const position=socket.position.map((v,i)=>v+(block?block.position[['x','y','z'][i]]:offset?.[['x','y','z'][i]]||0));
    const normal=new THREE.Vector3(0,1,0).transformDirection(frame([0,0,0],socket.rotation)).toArray();
    return [{...socket,position,normal,type:'component'}];
  });
  const sockets=[...automatic,...manual];socketCache.set(scene,{setup,blocks,offset,revision:scene.revision,sockets});return sockets;
}
export function savedSocket(model,socket,name=socket.name){
  const block=model.blocks.find(b=>b.id===socket.blockId),offset=model.placementOffset||{};
  return {id:crypto.randomUUID(),name,blockId:block?.id,position:socket.position.map((v,i)=>v-(block?block.position[['x','y','z'][i]]:offset?.[['x','y','z'][i]]||0)),rotation:[...socket.rotation]};
}
export function componentMatrix(asset,socket,mount){
  return frame(socket.position,socket.rotation).multiply(frame(mount.offset||[0,0,0],mount.rotation||[0,0,0])).multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(mount.twist||0)))
    .scale(new THREE.Vector3().setScalar(mount.scale??1)).multiply(frame(asset.attachment.position,asset.attachment.rotation).invert());
}
export function attachComponent(setup,asset,socket){
  validateComponent(asset);if(socket?.type!=='component')throw Error('Choose a component socket.');
  if(setup.mounts.some(m=>m.socketId===socket.id))throw Error('Component socket already occupied.');
  return {...setup,mounts:[...setup.mounts,{id:crypto.randomUUID(),socketId:socket.id,asset:structuredClone(asset),scale:1,twist:0}]};
}
export function componentEntries(scene){
  const sockets=componentSockets(scene);
  return componentSetup(scene.model||{}).mounts.flatMap(instance=>{
    const socket=sockets.find(s=>s.id===instance.socketId);if(!socket)return [];
    return [{asset:instance.asset,socket,instance,component:true,matrix:componentMatrix(instance.asset,socket,instance)}];
  });
}
