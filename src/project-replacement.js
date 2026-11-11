import {blockIndex, secondaryColor, applyBlockColors} from './block-colors.js';
import {originalBlockColors} from './color-workshop.js';
import {paintSnapshot} from './session-persistence.js';
import {sceneSockets, surfaceSockets} from './turrets/sockets.js';
import {componentEntries} from './components/core.js';
import {mountedSocketReference} from './components/socket-ids.js';
import {frame} from './turrets/core.js';
import * as THREE from './vendor/three.module.js';

const AXES=['x','y','z'];
const identity={scale:[1,1,1],offset:[0,0,0]};
const signature=block=>`${block.typeIndex}/${block.look}/${block.up}`;
const position=(model,block)=>AXES.map(axis=>block.position[axis]-(model.placementOffset?.[axis]||0));
const size=block=>AXES.map(axis=>block.size[axis]);
const transform=(point,fit)=>point.map((value,i)=>value*fit.scale[i]+fit.offset[i]);
const close=(a,b,tolerance)=>a.every((value,i)=>Math.abs(value-b[i])<=tolerance[i]);

function uniqueBy(blocks,key){
  const values=new Map();
  for(const block of blocks){
    const id=key(block);
    if(id!=null)values.set(id,values.has(id)?null:block);
  }
  return values;
}

function blockFit(before,after,a,b){
  const dimensions=size(a),target=size(b);
  if(dimensions.some((value,i)=>(value===0)!==(target[i]===0)))return null;
  const scale=dimensions.map((value,i)=>value>0?target[i]/value:1);
  if(scale.some(value=>!Number.isFinite(value)||value<=0))return null;
  const origin=position(before,a);
  return {scale,offset:position(after,b).map((value,i)=>value-origin[i]*scale[i])};
}

function boundsFit(before,after){
  const scale=AXES.map(axis=>before.bounds.size[axis]>0?after.bounds.size[axis]/before.bounds.size[axis]:1);
  if(scale.some(value=>!Number.isFinite(value)||value<=0))return null;
  const minimum=(model,axis)=>model.bounds.min[axis]-(model.placementOffset?.[axis]||0);
  return {scale,offset:AXES.map((axis,i)=>minimum(after,axis)-minimum(before,axis)*scale[i])};
}

function candidates(before,after){
  const extent=AXES.map(axis=>Math.max(1,after.bounds.size[axis]));
  const key=fit=>JSON.stringify([...fit.scale.map(v=>Number(v.toPrecision(5))),...fit.offset.map((v,i)=>Math.round(v/extent[i]*1e5))]);
  const votes=new Map();
  function nominate(fit){
    if(!fit)return;
    const id=key(fit),entry=votes.get(id);
    if(entry)entry.count++;
    else votes.set(id,{fit,count:1});
  }
  const native=block=>block.itemEl?.getAttribute('index')??block.itemIndex??null;
  for(const identify of [native,signature]){
    const old=uniqueBy(before.blocks,identify),incoming=uniqueBy(after.blocks,identify);
    for(const [id,a] of old){
      const b=incoming.get(id);
      if(a&&b&&signature(a)===signature(b))nominate(blockFit(before,after,a,b));
    }
  }
  const fits=[identity,boundsFit(before,after),...[...votes.values()].sort((a,b)=>b.count-a.count).slice(0,6).map(entry=>entry.fit)];
  return [...new Map(fits.filter(Boolean).map(fit=>[key(fit),fit])).values()];
}

function geometryMatcher(model){
  const tolerance=AXES.map(axis=>Math.max(2e-5,model.bounds.size[axis]*1e-7));
  const cell=point=>point.map((v,i)=>Math.floor(v/tolerance[i]));
  const index=new Map();
  for(const block of model.blocks){
    const center=position(model,block),key=`${signature(block)}:${cell(center)}`;
    const entry={block,center,dimensions:size(block)};
    if(index.has(key))index.get(key).push(entry);
    else index.set(key,[entry]);
  }
  return (before,block,fit)=>{
    const center=transform(position(before,block),fit),dimensions=size(block).map((v,i)=>v*fit.scale[i]);
    const [x,y,z]=cell(center),shape=signature(block);
    let found;
    for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)for(let k=z-1;k<=z+1;k++){
      for(const entry of index.get(`${shape}:${i},${j},${k}`)||[]){
        if(!close(entry.center,center,tolerance)||!close(entry.dimensions,dimensions,tolerance))continue;
        if(found)return null;
        found=entry.block;
      }
    }
    return found;
  };
}

export function matchReplacementBlocks(before,after){
  if(before.sourceXml&&before.sourceXml===after.sourceXml)return {map:new Map(before.blocks.map(block=>[block.id,block.id])),fit:identity,ambiguous:false};
  const find=geometryMatcher(after),fits=candidates(before,after),ranked=[];
  for(const fit of fits){
    const map=new Map(),owners=new Map();
    for(const block of before.blocks){
      const match=find(before,block,fit);
      if(!match)continue;
      if(owners.has(match.id)){
        map.delete(owners.get(match.id));
        continue;
      }
      map.set(block.id,match.id);
      owners.set(match.id,block.id);
    }
    ranked.push({map,fit});
  }
  ranked.sort((a,b)=>b.map.size-a.map.size);
  const winner=ranked[0],bestCount=winner.map.size;
  const tied=ranked.filter(candidate=>candidate.map.size===bestCount);
  for(const [id,match] of winner.map)if(tied.some(candidate=>candidate.map.get(id)!==match))winner.map.delete(id);
  // One incidental geometric match is insufficient evidence for a transform of a larger hull.
  if(bestCount<2&&Math.min(before.blocks.length,after.blocks.length)>1)winner.map.clear();
  return {...winner,ambiguous:winner.map.size<bestCount};
}

function nativeSocket(model,socket){
  return socket.position.map((value,i)=>value-(model.placementOffset?.[AXES[i]]||0));
}

function transformedNormal(normal,scale){
  const values=normal.map((value,i)=>value/scale[i]),length=Math.hypot(...values);
  return values.map(value=>value/length);
}

function matchingFaces(scene,model,socket,fit,options){
  const center=transform(nativeSocket(scene.model,socket),fit);
  const normal=transformedNormal(socket.normal,fit.scale);
  const tolerance=AXES.map(axis=>Math.max(1e-4,model.bounds.size[axis]*1e-7));
  return options.filter(candidate=>close(candidate.normal,normal,[1e-4,1e-4,1e-4])&&close(nativeSocket(model,candidate),center,tolerance));
}

function socketRotation(rotation,scale){
  if(scale.every(value=>value===scale[0]))return rotation;
  const basis=frame([0,0,0],rotation);
  const tangent=new THREE.Vector3(1,0,0).transformDirection(basis).multiply(new THREE.Vector3(...scale)).normalize();
  const normal=new THREE.Vector3(0,1,0).transformDirection(basis);
  normal.fromArray(transformedNormal(normal.toArray(),scale));
  const third=new THREE.Vector3().crossVectors(tangent,normal).normalize();
  const euler=new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent,normal,third),'XYZ');
  return [euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg);
}

function remapComponents(scene,model,map,fit){
  const setup=scene.model.componentSetup;
  if(!setup)return null;
  const incoming=blockIndex(model),original=blockIndex(scene.model),missingSockets=[],missingMounts=[];
  const sockets=setup.sockets.flatMap(socket=>{
    const id=socket.blockId?map.get(socket.blockId):null;
    if(socket.blockId&&!id||!socket.blockId&&!map.size){missingSockets.push(socket.name);return [];}
    const position=socket.blockId?socket.position.map((value,i)=>value*fit.scale[i]):transform(socket.position,fit);
    return [{...socket,blockId:id??undefined,position,rotation:socketRotation(socket.rotation,fit.scale)}];
  });
  const mounts=setup.mounts.flatMap(mount=>{
    const automatic=/^component:([^:]+):(\d+)$/.exec(mount.socketId);
    if(!automatic)return [mount];
    const block=original.get(automatic[1]),next=incoming.get(map.get(automatic[1]));
    const socket=block&&surfaceSockets(block).find(face=>face.faceId===Number(automatic[2]));
    const matches=socket&&next?matchingFaces(scene,model,socket,fit,surfaceSockets(next)):[];
    if(matches.length!==1){missingMounts.push(mount.name||mount.asset.name);return [];}
    return [{...mount,socketId:matches[0].id.replace('turret:','component:')}];
  });
  const proposed={...setup,sockets,mounts,attachmentSocketId:sockets.some(socket=>socket.id===setup.attachmentSocketId)?setup.attachmentSocketId:null};
  const entries=componentEntries({model:{...model,componentSetup:proposed},loaded:true});
  const resolved=new Set(entries.map(entry=>entry.instance.id));
  for(const mount of mounts)if(!resolved.has(mount.id))missingMounts.push(mount.name||mount.asset.name);
  return {setup:{...proposed,mounts:mounts.filter(mount=>resolved.has(mount.id))},missingSockets,missingMounts};
}

function remapMounts(scene,model,map,fit){
  const mounts=scene.model.turretMounts||[];
  if(!mounts.length)return {mounts:[],missing:[],clearance:[]};
  const old=new Map(sceneSockets(scene).map(socket=>[socket.id,socket]));
  const byBlock=new Map(),mounted=new Map();
  for(const socket of sceneSockets({model,loaded:true})){
    if(socket.parentMountId){mounted.set(socket.id,socket);continue;}
    if(!byBlock.has(socket.blockId))byBlock.set(socket.blockId,[]);
    byBlock.get(socket.blockId).push(socket);
  }
  const kept=[],missing=[],clearance=[],occupied=new Set();
  for(const mount of mounts){
    if(mountedSocketReference(mount.socketId)?.kind==='turret'){
      const target=mounted.get(mount.socketId);
      if(!target){missing.push(mount.name);continue;}
      kept.push(mount);
      if(target.fitSize==null||mount.turretSize>target.fitSize)clearance.push(mount.name);
      continue;
    }
    const socket=old.get(mount.socketId),id=map.get(socket?.blockId);
    if(!id){missing.push(mount.name);continue;}
    const matches=matchingFaces(scene,model,socket,fit,byBlock.get(id)||[]);
    if(matches.length!==1||occupied.has(matches[0].id)){missing.push(mount.name);continue;}
    const target=matches[0];
    occupied.add(target.id);
    kept.push({...mount,socketId:target.id});
    if(target.fitSize==null||mount.turretSize>target.fitSize)clearance.push(mount.name);
  }
  return {mounts:kept,missing,clearance};
}

export function previewReplacement(scene,model){
  const {map,fit,ambiguous}=matchReplacementBlocks(scene.model,model);
  const before=blockIndex(scene.model),incoming=blockIndex(model),conflicts=[],paint=[];
  let missingPaint=0;
  for(const edit of paintSnapshot(scene.model)){
    const id=map.get(edit.id);
    if(!id){missingPaint++;continue;}
    const baseline=originalBlockColors(scene.model,before.get(edit.id));
    for(const channel of ['color','secondaryColor']){
      if(!Object.hasOwn(edit,channel))continue;
      const saved=edit[channel]??undefined;
      const current=channel==='color'?incoming.get(id).color:secondaryColor(incoming.get(id));
      if(current===saved)continue;
      const patch={id,channel,saved,current};
      if(current!==(baseline[channel]??undefined))conflicts.push(patch);
      else paint.push(patch);
    }
  }
  const regions=[],regionLosses=[];
  for(const region of scene.regions||[]){
    const ids=region.ids.map(id=>map.get(id)).filter(Boolean);
    if(ids.length)regions.push({...region,ids});
    if(ids.length!==region.ids.length)regionLosses.push({name:region.name,lost:region.ids.length-ids.length,empty:!ids.length});
  }
  const components=remapComponents(scene,model,map,fit);
  const mounts=remapMounts(scene,components?{...model,componentSetup:components.setup}:model,map,fit);
  const hidden=scene.regionDisplay?.applied===scene.hiddenIds?scene.regionDisplay?.restore:scene.hiddenIds;
  let missingOpacity=0;
  const opacity=[];
  for(const block of scene.model.blocks){
    if(!Number.isFinite(block.opacity))continue;
    const id=map.get(block.id);
    if(id)opacity.push({id,value:block.opacity});
    else missingOpacity++;
  }
  const projectViews=(scene.projectViews||[]).map(view=>{
    if(!map.size)return view;
    const native=[view.target[0],view.target[2],-view.target[1]].map((value,i)=>value-(scene.model.placementOffset?.[AXES[i]]||0));
    const [x,y,z]=transform(native,fit).map((value,i)=>value+(model.placementOffset?.[AXES[i]]||0));
    const scale=Math.max(...fit.scale);
    return {...view,target:[x,-z,y],zoom:Math.max(.000001,Math.min(5,view.zoom/scale)),
      orthographicDistance:view.orthographicDistance===undefined?undefined:view.orthographicDistance*scale};
  });
  return {model,map,fit,ambiguous,conflicts,paint,missingPaint,regions,regionLosses,mounts,components,opacity,missingOpacity,projectViews,
    hiddenIds:new Set([...hidden||[]].map(id=>map.get(id)).filter(Boolean)),beforeCount:scene.model.blocks.length};
}

export function applyReplacement(preview,keepProjectColor){
  const {model,paint,conflicts,map}=preview;
  applyBlockColors({model},[...paint,...conflicts.filter(keepProjectColor)].map(edit=>({id:edit.id,[edit.channel]:edit.saved})),{writeXml:false});
  const blocks=blockIndex(model);
  for(const {id,value} of preview.opacity)blocks.get(id).opacity=value;
  model.turretMounts=preview.mounts.mounts;
  if(preview.components)model.componentSetup=preview.components.setup;
  return {model,regions:preview.regions,hiddenIds:preview.hiddenIds,projectViews:preview.projectViews,matchedCount:map.size};
}
