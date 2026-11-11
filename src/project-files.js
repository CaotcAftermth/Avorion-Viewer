import {leaves, validateState} from './layout.js';
import {parsePreferences, PREFERENCE_SECTIONS} from './preferences.js';
import {restoreModel, snapshotModel} from './session-persistence.js';
import {importTurretXml, validateProject as validateTurrets} from './turrets/core.js';
import {blockSockets, sceneSockets} from './turrets/sockets.js';
import {mountedSocketReference} from './components/socket-ids.js';

export const PROJECT_EXTENSION='.avproject';
export const PROFILE_EXTENSION='.avprofile';
const MAX_FILE_SIZE=128*1024*1024;
const SHADERS=new Set(PREFERENCE_SECTIONS.find(section=>section.id==='shaders').panels.flatMap(panel=>panel.fields.map(field=>field.key)));
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const named=value=>typeof value==='string'&&value.trim()&&value.length<=120;
const color=value=>typeof value==='string'&&/^[\da-f]{8}$/i.test(value);
const boundedList=(value,max)=>Array.isArray(value)&&value.length<=max;
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
const axes=['x','y','z'];

function socketBlock(id){return /^turret:([^:]+):\d+$/.exec(id)?.[1];}

function socketAnchor(block,socket){
  return {blockId:block.id,normal:socket.normal,
    offset:axes.map((axis,i)=>(socket.position[i]-block.position[axis])/(block.size[axis]||1))};
}

function modelSockets(model){
  const blocks=new Map(model.blocks.map(block=>[block.id,block])),cache=new Map();
  return id=>{
    if(!cache.has(id)){
      const block=blocks.get(id);
      cache.set(id,block?blockSockets(block).map(socket=>({id:socket.id,...socketAnchor(block,socket)})):[]);
    }
    return cache.get(id);
  };
}

export function documentFileName(name,extension){
  return (name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'')||'Untitled')+extension;
}

export async function readSaveFile(file){
  if(file.size>MAX_FILE_SIZE)throw Error('Save files must be 128 MiB or smaller.');
  return JSON.parse(await file.text(),(key,value)=>{
    if(['__proto__','prototype','constructor'].includes(key))throw Error('Unexpected property in save file.');
    return value;
  });
}

export function writeSaveFile(record){
  const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
  if(blob.size>MAX_FILE_SIZE)throw Error('Save files must be 128 MiB or smaller.');
  return blob;
}

export function downloadSave(record,name,extension){
  const url=URL.createObjectURL(writeSaveFile(record));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=documentFileName(name,extension);
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export function captureProject(scene,project){
  if(!scene.loaded||!scene.model||!named(project.name))throw Error('Load a model and enter a project name.');
  const {project:_,...model}=snapshotModel(scene,{portable:true});
  if(model.turretMounts?.length){
    const sockets=modelSockets(scene.model);
    const mounted=new Map();
    if(model.turretMounts.some(mount=>mountedSocketReference(mount.socketId)?.kind==='turret')){
      for(const socket of sceneSockets(scene))if(socket.parentMountId)mounted.set(socket.id,socket);
    }
    model.turretMounts=model.turretMounts.map(mount=>{
      const {editorLayout,...asset}=mount.asset;
      if(mounted.has(mount.socketId))return {...mount,asset};
      const {id,...anchor}=sockets(socketBlock(mount.socketId)).find(socket=>socket.id===mount.socketId)||{};
      if(!id)throw Error(`Cannot save ${mount.name}. Its socket is missing.`);
      return {...mount,asset,anchor};
    });
  }
  return {format:'avorion-model-project',version:1,id:project.id,name:project.name,model};
}

function validateMounts(mounts){
  if(!boundedList(mounts,500))throw Error('Invalid mounted turret list.');
  if(!mounts.length)return;
  // Mounted copies can share a library ID while carrying different local edits.
  const assets=[],sockets=[],instances=[];
  for(const [index,mount] of mounts.entries()){
    if(!object(mount?.asset)||!named(mount.socketId))throw Error('Invalid mounted turret.');
    const assetId=String(index);
    assets.push({...mount.asset,id:assetId});
    sockets.push({id:mount.socketId,name:mount.socketId,position:[0,0,0],rotation:[0,0,0]});
    instances.push({...mount,assetId});
  }
  validateTurrets({format:'avorion-turret-lab',version:2,assets,sockets,instances});
}

export function captureTurretProject(asset){
  const {editorLayout,blocks,...settings}=asset;
  const record={format:'avorion-model-project',version:1,kind:'turret',id:asset.id,name:asset.name,asset:settings};
  if(!asset.sourceXml){record.asset.blocks=blocks;return record;}
  const original=new Map(importTurretXml(asset.sourceXml,asset.name,asset.id).blocks.map(block=>[block.id,block]));
  if(original.size!==blocks.length||blocks.some(block=>!original.has(block.id)))throw Error('Turret blocks no longer match their source XML.');
  record.paint=blocks.flatMap(block=>{
    const base=original.get(block.id),edit={id:block.id};
    if(block.color!==base.color)edit.color=block.color;
    if(block.secondaryColor!==base.secondaryColor)edit.secondaryColor=block.secondaryColor??null;
    if(Number.isFinite(block.opacity))edit.opacity=block.opacity;
    return Object.keys(edit).length>1?[edit]:[];
  });
  return record;
}

export function restoreTurretProject(record){
  const data=record?.asset;
  if(record?.format!=='avorion-model-project'||record.version!==1||record.kind!=='turret'||!named(record.id)||!named(record.name)||!object(data))throw Error('Unsupported turret project.');
  const asset={...data,id:record.id,name:record.name};
  delete asset.editorLayout;
  if(typeof data.sourceXml==='string'&&data.sourceXml){
    asset.blocks=importTurretXml(data.sourceXml,asset.name,asset.id).blocks;
    const edits=record.paint??[],byId=new Map(asset.blocks.map(block=>[block.id,block])),seen=new Set();
    if(!boundedList(edits,byId.size))throw Error('Invalid turret paint list.');
    for(const edit of edits){
      if(!object(edit)||!byId.has(edit.id)||seen.has(edit.id)||
        (Object.hasOwn(edit,'color')&&!color(edit.color))||
        (Object.hasOwn(edit,'secondaryColor')&&edit.secondaryColor!==null&&!color(edit.secondaryColor))||
        (Object.hasOwn(edit,'opacity')&&(!Number.isFinite(edit.opacity)||edit.opacity<0||edit.opacity>1)))throw Error('Invalid turret paint edit.');
      seen.add(edit.id);
      const block=byId.get(edit.id);
      if(Object.hasOwn(edit,'color'))block.color=edit.color;
      if(Object.hasOwn(edit,'secondaryColor')){
        block.secondaryColor=edit.secondaryColor??undefined;
        if(edit.secondaryColor===null)delete block.unknownAttrs?.secondaryColor;
        else (block.unknownAttrs??={}).secondaryColor=edit.secondaryColor;
      }
      if(Object.hasOwn(edit,'opacity'))block.opacity=edit.opacity;
    }
  }
  validateTurrets({format:'avorion-turret-lab',version:2,assets:[asset],sockets:[],instances:[]});
  validateRegions(asset.projectRegions??[],new Set(asset.blocks.map(block=>block.id)));
  return asset;
}

function validateRegions(regions,blocks){
  if(!boundedList(regions,10_000))throw Error('Invalid project regions.');
  const regionIds=new Set(),regionNames=new Set();
  for(const region of regions){
    if(!named(region?.id)||!named(region.name)||region.name.length>80||regionIds.has(region.id)||regionNames.has(region.name)||!/^#[\da-f]{6}$/i.test(region.color)||
      !boundedList(region.ids,blocks.size)||!region.ids.length||new Set(region.ids).size!==region.ids.length||region.ids.some(id=>!blocks.has(id)))throw Error('Invalid project region or block reference.');
    regionIds.add(region.id);
    regionNames.add(region.name);
  }
}

export function restoreProject(record){
  if(record?.format!=='avorion-model-project'||record.version!==1)throw Error('Unsupported Model Project file or version.');
  if(!named(record.name)||!named(record.id)||!object(record.model)||record.model.empty||record.model.version!==1)throw Error('Invalid project details.');
  const data=record.model;
  if(!named(data.fileName)&&!(typeof data.fileName==='string'&&data.fileName.length<=255&&data.fileName.trim()))throw Error('Invalid source filename.');
  if(data.sourceXml!==undefined&&typeof data.sourceXml!=='string'||data.xml!==undefined)throw Error('Invalid project XML source.');
  if(data.placement!==undefined&&!['centered','placed','imported'].includes(data.placement))throw Error('Invalid model placement.');
  const {paint=[],regions=[],hiddenIds=[],turretMounts=[],opacityOverrides={},projectViews=[],coverage}=data;
  if(!boundedList(paint,1_000_000)||!boundedList(regions,10_000)||!boundedList(hiddenIds,1_000_000)||!object(opacityOverrides))throw Error('Invalid project edits.');
  if(data.sourceXml===undefined){
    const ids=new Set();
    if(paint.length||!boundedList(data.blocks,1_000_000)||!data.blocks.length)throw Error('Missing project model data.');
    for(const block of data.blocks){
      if(!named(block?.id)||ids.has(block.id)||!Number.isInteger(block.typeIndex)||!color(block.color)||
        ![block.look,block.up].every(value=>Number.isInteger(value)&&value>=0&&value<=5))throw Error('Invalid generated project block.');
      ids.add(block.id);
    }
  }
  const painted=new Set();
  for(const edit of paint){
    if(!object(edit)||!named(edit.id)||painted.has(edit.id)||Object.keys(edit).some(key=>!['id','color','secondaryColor'].includes(key))||
      (!Object.hasOwn(edit,'color')&&!Object.hasOwn(edit,'secondaryColor'))||
      (Object.hasOwn(edit,'color')&&!color(edit.color))||
      (Object.hasOwn(edit,'secondaryColor')&&edit.secondaryColor!==null&&!color(edit.secondaryColor)))throw Error('Invalid block paint edit.');
    painted.add(edit.id);
  }
  if(!boundedList(projectViews,300)||projectViews.some(view=>!object(view)||!Array.isArray(view.target)||view.target.length!==3||!view.target.every(Number.isFinite)||
    !['yaw','pitch','roll','zoom','panX','panY'].every(key=>Number.isFinite(view[key]))||view.zoom<.000001||view.zoom>5||Math.abs(view.pitch)>Math.PI/2||!['perspective','orthographic'].includes(view.projection)||
    (view.orthographicDistance!==undefined&&(!Number.isFinite(view.orthographicDistance)||view.orthographicDistance<=0))))throw Error('Invalid project view.');
  if(coverage!==undefined&&(!object(coverage)||(coverage.options!=null&&!object(coverage.options))||
    (coverage.baseline!=null&&(!object(coverage.baseline)||typeof coverage.baseline.key!=='string'||!object(coverage.baseline.stats)||!object(coverage.baseline.stats.total)||!Array.isArray(coverage.baseline.stats.regions)||
      (coverage.baseline.samples!==null&&!Array.isArray(coverage.baseline.samples))))))throw Error('Invalid project coverage settings.');
  validateMounts(turretMounts);
  const restored=restoreModel({...data,project:undefined,regions:undefined,hiddenIds:undefined});
  const blocks=new Set(restored.model.blocks.map(block=>block.id));
  validateRegions(regions,blocks);
  for(const [id,opacity] of Object.entries(opacityOverrides))if(!blocks.has(id)||!Number.isFinite(opacity)||opacity<0||opacity>1)throw Error('Invalid block opacity.');
  if([...painted,...hiddenIds].some(id=>!blocks.has(id)))throw Error('An edit references a missing block.');
  const sockets=turretMounts.length?modelSockets(restored.model):null,occupied=new Set();
  const mounted=new Set();
  if(turretMounts.some(mount=>mountedSocketReference(mount.socketId)?.kind==='turret')){
    for(const socket of sceneSockets(restored))if(socket.parentMountId)mounted.add(socket.id);
  }
  if(sockets)restored.model.turretMounts=turretMounts.map(mount=>{
    const {anchor,...instance}=mount;
    if(mounted.has(instance.socketId)){
      if(occupied.has(instance.socketId))throw Error('A turret socket is occupied more than once.');
      occupied.add(instance.socketId);
      return instance;
    }
    const blockId=socketBlock(instance.socketId);
    if(!blockId||!blocks.has(blockId))throw Error('A turret references a missing socket block.');
    if(anchor!==undefined&&(!object(anchor)||anchor.blockId!==blockId||!vector(anchor.normal)||!vector(anchor.offset)))throw Error('Invalid turret socket anchor.');
    const same=(a,b)=>a.every((value,i)=>Math.abs(value-b[i])<1e-4);
    const matches=sockets(blockId).filter(socket=>anchor?same(socket.normal,anchor.normal)&&same(socket.offset,anchor.offset):socket.id===instance.socketId);
    if(matches.length!==1||occupied.has(matches[0].id))throw Error('A turret socket could not be resolved.');
    occupied.add(matches[0].id);
    return {...instance,socketId:matches[0].id};
  });
  return {...restored,regions,hiddenIds:new Set(hiddenIds),projectViews,project:{id:record.id,name:record.name}};
}

export function captureProfile(name,layout,preferences){
  if(!named(name)||!validateState(layout))throw Error('Invalid workspace name or layout.');
  const copy=structuredClone(layout),settings={},shaders={};
  for(const [key,value] of Object.entries(preferences)){
    if(key==='version')continue;
    (SHADERS.has(key)?shaders:settings)[key]=value;
  }
  for(const workspace of copy.workspaces)for(const node of leaves(workspace.root)){
    Object.assign(node.view,{target:[0,0,1],zoom:1,panX:0,panY:0});
    delete node.view.orthographicDistance;
    if(node.view.paint?.scope==='region'){
      node.view.paint.scope='all';
      delete node.view.paint.regionId;
    }
  }
  return {format:'avorion-workspace-profile',version:1,name,layout:copy,preferences:settings,shaders};
}

export function restoreProfile(record){
  if(record?.format!=='avorion-workspace-profile'||record.version!==1)throw Error('Unsupported Workspace Profile file or version.');
  if(!named(record.name)||!validateState(record.layout)||!object(record.preferences)||!object(record.shaders))throw Error('Invalid Workspace Profile.');
  const preferences=parsePreferences(JSON.stringify({...record.preferences,...record.shaders,version:1}));
  return {name:record.name,layout:record.layout,preferences};
}
