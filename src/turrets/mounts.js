import {assetProvenance,updatedMount} from '../attachments/lifecycle.js';
import {createInstance,isTurretSize,clampElevation} from './core.js';
const histories=new WeakMap(),transactions=new WeakMap(),empty=[];
export function mounts(scene){return scene.model?.turretMounts||empty;}
function change(scene,next){const model=scene.model;if(!model)return;const h=histories.get(model)||{undo:[],redo:[]};if(!transactions.has(model)){h.undo.push(mounts(scene));h.redo=[];}histories.set(model,h);model.turretMounts=next;scene.appearanceRevision=(scene.appearanceRevision||0)+1;}
export function placeTurret(scene,asset,socket,size,sourceSize=asset.sourceSize){
  if(socket.type!=='turret')throw Error('Choose a turret socket.');
  if(socket.fitSize==null||size>socket.fitSize)throw Error('Insufficient clearance for this turret base.');
  if(mounts(scene).some(m=>m.socketId===socket.id))throw Error('Socket already occupied.');
  if(!isTurretSize(size)||!isTurretSize(sourceSize))throw Error('Choose source and target sizes from 0.5 to 10 in steps of 0.5.');
  const copy=structuredClone(asset);copy.sourceSize=sourceSize;
  const instance={...createInstance(asset.id,socket.id,crypto.randomUUID()),turretSize:size};
  change(scene,[...mounts(scene),{...instance,asset:copy,source:assetProvenance(asset)}]);return instance;
}
export function removeTurret(scene,socketId){change(scene,mounts(scene).filter(m=>m.socketId!==socketId));}
// Numeric transactions share attachment history, so one drag is one undo step.
function restoreMutable(target,value){for(const key of Object.keys(target))if(!(key in value))delete target[key];for(const [key,next] of Object.entries(value)){if(next&&typeof next==='object'&&target[key]&&typeof target[key]==='object'&&Array.isArray(next)===Array.isArray(target[key]))restoreMutable(target[key],next);else target[key]=structuredClone(next);}if(Array.isArray(target))target.length=value.length;}
// Restore only values changed by this transaction. Later unrelated settings,
// camera navigation and newly added camera keys must survive a numeric undo.
function patchChanged(current,from,to){
 if(JSON.stringify(from)===JSON.stringify(to))return current;
 if(Array.isArray(from)&&Array.isArray(to)&&[...from,...to].every(v=>v&&typeof v==='object'&&typeof v.id==='string')){
  let next=structuredClone(current||[]);
  for(const id of new Set([...from,...to].map(v=>v.id))){const a=from.find(v=>v.id===id),b=to.find(v=>v.id===id),index=next.findIndex(v=>v.id===id);if(JSON.stringify(a)===JSON.stringify(b))continue;if(!b)next=next.filter(v=>v.id!==id);else if(index>=0)next[index]=patchChanged(next[index],a,b);else if(!a)next.push(structuredClone(b));}
  if(next.every(v=>Number.isFinite(v.time)))next.sort((a,b)=>a.time-b.time);return next;
 }
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if((object(from)||from===undefined)&&(object(to)||to===undefined)){
  const next=object(current)?structuredClone(current):{};
  for(const key of new Set([...Object.keys(from||{}),...Object.keys(to||{})])){const value=patchChanged(next[key],from?.[key],to?.[key]);if(value===undefined)delete next[key];else next[key]=value;}
  return to===undefined&&!Object.keys(next).length?undefined:next;
 }
 return structuredClone(to);
}
function propertySnapshot(scene,asset,context={}){return {mounts:mounts(scene),coverage:structuredClone(scene.weaponCoverage),asset:asset?structuredClone({editorPose:asset.editorPose,simulation:asset.simulation}):null,view:context.view?structuredClone(context.view):null,exportConfig:structuredClone(context.runtime?.exportConfig),comparisonState:structuredClone(context.runtime?.comparisonState),time:context.runtime?.clock.time,playing:context.runtime?.clock.playing};}
function restoreProperties(scene,asset,snapshot,context={},from=snapshot){
 scene.model.turretMounts=snapshot.mounts;
 scene.weaponCoverage=patchChanged(scene.weaponCoverage,from.coverage,snapshot.coverage);
 let restarted=false;
 if(asset&&snapshot.asset){
  const pose=patchChanged(asset.editorPose,from.asset?.editorPose,snapshot.asset.editorPose),simulation=patchChanged(asset.simulation,from.asset?.simulation,snapshot.asset.simulation);
  if(simulation?.calibration?.families&&Object.keys(simulation.calibration.families).length)simulation.calibration.version=1;
  restarted=JSON.stringify(pose)!==JSON.stringify(asset.editorPose)||JSON.stringify(simulation)!==JSON.stringify(asset.simulation);
  asset.editorPose=pose;if(asset.simulation&&simulation)restoreMutable(asset.simulation,simulation);
  if(restarted)scene.turretStudio?.restart();
 }
 if((restarted||context.timelineEdit)&&context.runtime){context.runtime.seek(snapshot.time||0);if(snapshot.playing)context.runtime.play();}
 if((context.viewEdit||context.timelineEdit)&&context.view&&snapshot.view)restoreMutable(context.view,patchChanged(context.view,from.view,snapshot.view));
 if(context.runtime?.exportConfig&&snapshot.exportConfig)restoreMutable(context.runtime.exportConfig,patchChanged(context.runtime.exportConfig,from.exportConfig,snapshot.exportConfig));
 if(context.runtime?.comparisonState&&snapshot.comparisonState)restoreMutable(context.runtime.comparisonState,patchChanged(context.runtime.comparisonState,from.comparisonState,snapshot.comparisonState));
 scene.appearanceRevision=(scene.appearanceRevision||0)+1;
}
export function beginPropertyEdit(scene,asset,context={}){if(scene.model&&!transactions.has(scene.model))transactions.set(scene.model,{asset,context,before:propertySnapshot(scene,asset,context)});}
export function endPropertyEdit(scene,cancel=false,changed=true){const model=scene.model,t=transactions.get(model);if(!t)return;transactions.delete(model);const after=propertySnapshot(scene,t.asset,t.context);if(cancel){restoreProperties(scene,t.asset,t.before,t.context,after);return;}const comparable=({view,time,playing,...state})=>state;const stateChanged=JSON.stringify(comparable(t.before))!==JSON.stringify(comparable(after)),viewChanged=t.context.viewEdit&&JSON.stringify(t.before.view)!==JSON.stringify(after.view),timeChanged=t.context.timelineEdit&&t.before.time!==after.time;if(!stateChanged&&!(changed&&(viewChanged||timeChanged)))return;const h=histories.get(model)||{undo:[],redo:[]};h.undo.push({asset:t.asset,context:t.context,before:t.before,after});h.redo=[];histories.set(model,h);}
export function mountHistory(scene,redo=false){const h=histories.get(scene.model),from=redo?h?.redo:h?.undo,to=redo?h?.undo:h?.redo;if(!from?.length)return;const entry=from.pop();if(Array.isArray(entry)){to.push(mounts(scene));scene.model.turretMounts=entry;}else{to.push(entry);restoreProperties(scene,entry.asset,redo?entry.after:entry.before,entry.context,redo?entry.before:entry.after);}scene.appearanceRevision=(scene.appearanceRevision||0)+1;}
export function canMountHistory(scene,redo=false){return !!histories.get(scene.model)?.[redo?'redo':'undo'].length;}

export function initialTurretSize(asset,socket){return socket.fitSize||null;}

export function selectTurrets(scene,id,additive=false){const ids=new Set(additive?scene.selectedTurretIds||[]:[]);if(id){if(additive&&ids.has(id))ids.delete(id);else ids.add(id);}scene.selectedTurretIds=ids;scene.selectedTurretId=[...ids].at(-1)||null;const m=mounts(scene).find(m=>m.id===scene.selectedTurretId);if(m){scene.turretSockets??={};scene.turretSockets.selectedId=m.socketId;}}
export function editTurrets(scene,ids,patch){
 for(const key of ['offset','rotation'])if(patch[key]!==undefined&&(!Array.isArray(patch[key])||patch[key].length!==3||!patch[key].every(Number.isFinite)))throw Error('Transform must contain three finite numbers.');
 if(patch.turretSize!==undefined&&!isTurretSize(patch.turretSize))throw Error('Size must be 0.5�10 in half steps.');
 for(const key of ['twist','yaw','pitch'])if(patch[key]!==undefined&&!Number.isFinite(patch[key]))throw Error('Angles must be finite.');
 change(scene,mounts(scene).map(m=>ids.includes(m.id)?{...m,...patch,...(patch.pitch!==undefined?{pitch:clampElevation(m.asset,patch.pitch)}:{})}:m));
}
export function copyTurretPose(scene){const m=mounts(scene).find(m=>m.id===scene.selectedTurretId);if(m)scene.turretClipboard=Object.fromEntries(['twist','yaw','pitch','turretSize'].map(k=>[k,m[k]]));}

export function updateTurretFromLibrary(scene,id,asset){change(scene,mounts(scene).map(m=>m.id===id?updatedMount(m,asset,'turret'):m));}
export function replaceTurret(scene,asset,socket,size,sourceSize=asset.sourceSize){
 const existing=mounts(scene).find(m=>m.socketId===socket.id);
 if(!existing)return placeTurret(scene,asset,socket,size,sourceSize);
 if(socket.type!=='turret'||socket.fitSize==null||size>socket.fitSize||!isTurretSize(size)||!isTurretSize(sourceSize))throw Error('The replacement does not fit this turret socket.');
 const copy=structuredClone(asset);copy.sourceSize=sourceSize;
 change(scene,mounts(scene).map(m=>m.id===existing.id?{...m,assetId:asset.id,asset:copy,source:assetProvenance(asset),turretSize:size,pitch:clampElevation(copy,m.pitch)}:m));
 return mounts(scene).find(m=>m.id===existing.id);
}
