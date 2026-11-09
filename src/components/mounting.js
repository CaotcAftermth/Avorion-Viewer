import {assetProvenance} from '../attachments/lifecycle.js';
import * as THREE from '../vendor/three.module.js';
import {frame} from '../turrets/core.js';
import {componentSetup,componentSockets} from './core.js';
import {saveComponentSetup} from './storage.js';

// Every component setup change goes through here so it is saved, undoable and redrawn.
const histories=new WeakMap(),LIMIT=100;
const historyOf=model=>{let h=histories.get(model);if(!h)histories.set(model,h={undo:[],redo:[]});return h;};
const pending=new WeakMap(),numericEdits=new WeakMap();
export function beginComponentEdit(scene){if(scene.model&&!numericEdits.has(scene.model))numericEdits.set(scene.model,componentSetup(scene.model));}
export async function endComponentEdit(scene,cancel=false){const model=scene.model,before=numericEdits.get(model);if(!before)return;const next=componentSetup(model);numericEdits.delete(model);if(cancel){previewSetup(scene,before);return;}if(JSON.stringify(before)===JSON.stringify(next))return;try{await changeSetup(scene,next,{previous:before});}catch(error){previewSetup(scene,before);throw error;}}
function enqueue(model,operation){const next=(pending.get(model)||Promise.resolve()).then(operation);pending.set(model,next.catch(()=>{}));return next;}
export function changeSetup(scene,next,{previous}={}){
 const model=scene.model;if(!model)return Promise.reject(Error('Load a ship first.'));
 if(numericEdits.has(model)){previewSetup(scene,next);return Promise.resolve();}
 const expected=model.componentSetup;
 return enqueue(model,async()=>{
  if(model.componentSetup!==expected&&!previous)throw Error('Another component edit finished first. Retry this edit against the updated setup.');
  const before=previous||componentSetup(model);model.componentSaveState='Saving…';
  try{await saveComponentSetup(model,next);delete model.componentSaveDraft;model.componentSaveState='Saved locally';}
  catch(error){model.componentSaveDraft=next;model.componentSaveState='Save failed: '+error.message;throw error;}
  const h=historyOf(model);h.undo.push(before);if(h.undo.length>LIMIT)h.undo.shift();h.redo=[];settle(scene,model);
 });
}
export function retryComponentSave(scene){const draft=scene.model?.componentSaveDraft;if(!draft)return Promise.resolve();return changeSetup(scene,draft);}
export function componentHistory(scene,redo=false){
 const model=scene.model;if(!model)return Promise.resolve(false);
 return enqueue(model,async()=>{
  const h=historyOf(model),from=redo?h.redo:h.undo,to=redo?h.undo:h.redo;if(!from.length)return false;
  const target=from.at(-1),before=componentSetup(model);model.componentSaveState='Saving…';
  try{await saveComponentSetup(model,target);model.componentSaveState='Saved locally';}
  catch(error){model.componentSaveState='Save failed: '+error.message;throw error;}
  from.pop();to.push(before);settle(scene,model);return true;
 });
}
export const canComponentHistory=(scene,redo=false)=>!!scene.model&&!!histories.get(scene.model)?.[redo?'redo':'undo'].length;
function settle(scene,model){
 if(scene.model!==model)return;
 scene.appearanceRevision=(scene.appearanceRevision||0)+1;
 const setup=componentSetup(model);
 if(scene.selectedComponentMountId&&!setup.mounts.some(m=>m.id===scene.selectedComponentMountId))scene.selectedComponentMountId=null;
}
// Live preview during a gizmo drag: shown at once, saved (with one undo step) on release.
export function previewSetup(scene,next){if(scene.model){scene.model.componentSetup=next;scene.appearanceRevision=(scene.appearanceRevision||0)+1;}}

// --- Symmetry -------------------------------------------------------------
const AXIS_INDEX={x:0,y:1,z:2};
export const symmetryAxes=scene=>['x','y','z'].filter(axis=>scene.componentSymmetry?.[axis]);
// Every non-empty combination of the enabled planes, so X+Z symmetry gives 3 mirrored copies.
function reflectionSets(axes){const sets=[];for(let mask=1;mask<1<<axes.length;mask++)sets.push(axes.filter((_,i)=>mask&1<<i));return sets;}
export function symmetryCenter(scene){
 const custom=scene.componentSymmetryOrigin;if(Array.isArray(custom)&&custom.length===3&&custom.every(Number.isFinite))return custom;
 const {min,max}=scene.model?.bounds||{min:{x:0,y:0,z:0},max:{x:0,y:0,z:0}};return ['x','y','z'].map(a=>(min[a]+max[a])/2);
}
export function mirrorFrame(position,rotation,axes,center){
 const scale=[1,1,1];for(const axis of axes)scale[AXIS_INDEX[axis]]=-1;
 const S=new THREE.Matrix4().makeScale(...scale),R=frame([0,0,0],rotation),mirrored=S.clone().multiply(R).multiply(S);
 const euler=new THREE.Euler().setFromRotationMatrix(mirrored,'XYZ');
 return {position:position.map((v,i)=>scale[i]<0?2*center[i]-v:v),rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg),sign:axes.length%2?-1:1};
}
const near=(a,b,tolerance)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<=tolerance;
// For one socket, where its mirror images are: an existing socket, or a new free socket to create.
export function mirrorTargets(scene,socket){
 const axes=symmetryAxes(scene);if(!axes.length||!socket)return [];
 const center=symmetryCenter(scene),sockets=componentSockets(scene),offset=scene.model?.placementOffset||{},targets=[];
 for(const set of reflectionSets(axes)){
  const mirror=mirrorFrame(socket.position,socket.rotation,set,center),normal=socket.normal.map((v,i)=>set.includes('xyz'[i])?-v:v);
  if(near(mirror.position,socket.position,1e-3))continue;
  const existing=sockets.find(s=>near(s.position,mirror.position,.05)&&s.normal.reduce((sum,v,i)=>sum+v*normal[i],0)>.99);
  if(existing){targets.push({socket:existing,sign:mirror.sign});continue;}
  const created={id:crypto.randomUUID(),name:`${socket.name} (mirror ${set.join('').toUpperCase()})`,position:mirror.position.map((v,i)=>v-(offset['xyz'[i]]||0)),rotation:mirror.rotation};
  targets.push({socket:{...created,position:mirror.position,normal,type:'component'},create:created,sign:mirror.sign});
 }
 // One target per distinct location.
 return targets.filter((t,i)=>targets.findIndex(o=>near(o.socket.position,t.socket.position,1e-3))===i&&!near(t.socket.position,socket.position,1e-3));
}
// Mounts that mirror a given mount: same asset on a mirrored socket.
export function mirroredMounts(scene,mount){
 const sockets=componentSockets(scene),socket=sockets.find(s=>s.id===mount.socketId),setup=componentSetup(scene.model||{});
 return mirrorTargets(scene,socket).filter(t=>!t.create).flatMap(t=>{const other=setup.mounts.find(m=>m.socketId===t.socket.id&&m.asset.id===mount.asset.id&&m.id!==mount.id);return other?[{mount:other,sign:t.sign}]:[];});
}

// --- Attach / swap / detach -----------------------------------------------
function placeOne(setup,asset,socketId,{scale=1,twist=0}={}){
 const occupied=setup.mounts.find(m=>m.socketId===socketId);
 if(occupied)return {...setup,mounts:setup.mounts.map(m=>m===occupied?{...m,asset:structuredClone(asset),source:assetProvenance(asset)}:m)};
 return {...setup,mounts:[...setup.mounts,{id:crypto.randomUUID(),socketId,asset:structuredClone(asset),source:assetProvenance(asset),scale,twist}]};
}
// Attach to a socket, or swap the component already there (scale and twist are kept).
export function placeComponent(scene,asset,socket){
 if(!asset)throw Error('Choose a component in the Asset Library.');if(socket?.type!=='component')throw Error('Choose a component socket.');
 let setup=componentSetup(scene.model);const base=setup.mounts.find(m=>m.socketId===socket.id);
 setup=placeOne(setup,asset,socket.id,base);
 for(const target of mirrorTargets(scene,socket)){
  if(target.create)setup={...setup,sockets:[...setup.sockets,target.create]};
  setup=placeOne(setup,asset,target.socket.id,base?{scale:base.scale,twist:base.twist*target.sign}:{});
 }
 return setup;
}
export function detachComponent(scene,mount){
 const ids=new Set([mount.id,...mirroredMounts(scene,mount).map(m=>m.mount.id)]),setup=componentSetup(scene.model);
 return {...setup,mounts:setup.mounts.filter(m=>!ids.has(m.id))};
}
export function patchMount(scene,mount,values){
 const mirrors=new Map(mirroredMounts(scene,mount).map(m=>[m.mount.id,m.sign])),setup=componentSetup(scene.model);
 return {...setup,mounts:setup.mounts.map(m=>m.id===mount.id?{...m,...values}:mirrors.has(m.id)?{...m,...values,...(values.twist!==undefined?{twist:values.twist*mirrors.get(m.id)}:{})}:m)};
}
// Add a socket and its mirror images (where no matching socket exists yet).
export function addSockets(scene,saved,socket){
 let setup=componentSetup(scene.model);setup={...setup,sockets:[...setup.sockets,saved]};
 for(const target of mirrorTargets(scene,socket))if(target.create)setup={...setup,sockets:[...setup.sockets,target.create]};
 return setup;
}
export const snapTwist=(value,snap)=>snap?Math.round(value/90)*90:value;

// The viewport-first workflow edits one socket at imported size. Legacy setup
// transforms remain readable, but are not offered by the new placement UI.
export function assignComponent(scene,asset,socket){
 if(!asset)throw Error('Choose a component in the Asset Library.');if(socket?.type!=='component')throw Error('Choose a component socket.');
 const setup=componentSetup(scene.model),existing=setup.mounts.find(m=>m.socketId===socket.id);
 const mount={...(existing||{id:crypto.randomUUID(),socketId:socket.id}),asset:structuredClone(asset),source:assetProvenance(asset),scale:1,twist:Math.round((existing?.twist||0)/90)*90,offset:[0,0,0],rotation:[0,0,0]};
 return {...setup,mounts:existing?setup.mounts.map(m=>m.id===existing.id?mount:m):[...setup.mounts,mount]};
}
export function detachSurfaceComponent(scene,mount){const setup=componentSetup(scene.model);return {...setup,mounts:setup.mounts.filter(m=>m.id!==mount.id)};}
export function rotateSurfaceComponent(scene,mount,step){
 const setup=componentSetup(scene.model);return {...setup,mounts:setup.mounts.map(m=>m.id===mount.id?{...m,twist:Math.round((m.twist||0)/90)*90+(step<0?-90:90)}:m)};
}
