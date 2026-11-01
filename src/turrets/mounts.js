import {createInstance,isTurretSize,clampElevation} from './core.js';
const histories=new WeakMap(),empty=[];
export function mounts(scene){return scene.model?.turretMounts||empty;}
function change(scene,next){const model=scene.model;if(!model)return;const h=histories.get(model)||{undo:[],redo:[]};h.undo.push(mounts(scene));h.redo=[];histories.set(model,h);model.turretMounts=next;scene.appearanceRevision=(scene.appearanceRevision||0)+1;}
export function placeTurret(scene,asset,socket,size,sourceSize=asset.sourceSize){
  if(socket.type!=='turret')throw Error('Choose a turret socket.');
  if(socket.fitSize==null||size>socket.fitSize)throw Error('Insufficient clearance for this turret base.');
  if(mounts(scene).some(m=>m.socketId===socket.id))throw Error('Socket already occupied.');
  if(!isTurretSize(size)||!isTurretSize(sourceSize))throw Error('Choose source and target sizes from 0.5 to 10 in steps of 0.5.');
  const copy=structuredClone(asset);copy.sourceSize=sourceSize;
  const instance={...createInstance(asset.id,socket.id,crypto.randomUUID()),turretSize:size};
  change(scene,[...mounts(scene),{...instance,asset:copy}]);return instance;
}
export function removeTurret(scene,socketId){change(scene,mounts(scene).filter(m=>m.socketId!==socketId));}
export function mountHistory(scene,redo=false){const h=histories.get(scene.model),from=redo?h?.redo:h?.undo,to=redo?h?.undo:h?.redo;if(!from?.length)return;to.push(mounts(scene));scene.model.turretMounts=from.pop();scene.appearanceRevision=(scene.appearanceRevision||0)+1;}
export function canMountHistory(scene,redo=false){return !!histories.get(scene.model)?.[redo?'redo':'undo'].length;}

export function initialTurretSize(asset,socket){return socket.fitSize||null;}

export function selectTurrets(scene,id,additive=false){const ids=new Set(additive?scene.selectedTurretIds||[]:[]);if(id){if(additive&&ids.has(id))ids.delete(id);else ids.add(id);}scene.selectedTurretIds=ids;scene.selectedTurretId=[...ids].at(-1)||null;const m=mounts(scene).find(m=>m.id===scene.selectedTurretId);if(m){scene.turretSockets??={};scene.turretSockets.selectedId=m.socketId;}}
export function editTurrets(scene,ids,patch){
 if(patch.turretSize!==undefined&&!isTurretSize(patch.turretSize))throw Error('Size must be 0.5–10 in half steps.');
 for(const key of ['twist','yaw','pitch'])if(patch[key]!==undefined&&!Number.isFinite(patch[key]))throw Error('Angles must be finite.');
 change(scene,mounts(scene).map(m=>ids.includes(m.id)?{...m,...patch,...(patch.pitch!==undefined?{pitch:clampElevation(m.asset,patch.pitch)}:{})}:m));
}
export function copyTurretPose(scene){const m=mounts(scene).find(m=>m.id===scene.selectedTurretId);if(m)scene.turretClipboard=Object.fromEntries(['twist','yaw','pitch','turretSize'].map(k=>[k,m[k]]));}
