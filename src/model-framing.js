import { liveBlocks, viewportHiddenIds } from './ship-structure.js';
import { blockFramePoints } from './block-model.js';
import { frameBounds } from './navigation.js';
import {posedTurretBlocks,posedComponentBlocks} from './turrets/posed-blocks.js';
export function visibleFrameBlocks(scene,view,selectedOnly=false){
 const hidden=viewportHiddenIds(scene,view);
 const blocks=liveBlocks(scene).filter(b=>!hidden.has(b.id)&&(!selectedOnly||scene.selectedIds?.has(b.id)));
 if(view.interactionMode==='paint'&&view.hidePaintAttachments)return blocks;
 const visible=(mount,socket)=>!mount.hidden&&!socket.ancestorHidden&&!scene.hiddenIds?.has(socket.blockId);
 const selected=(mount,primary,ids)=>!selectedOnly||mount.id===primary||ids?.has(mount.id);
 return [...blocks,
   ...posedTurretBlocks(scene,(m,s)=>visible(m,s)&&selected(m,scene.selectedTurretId,scene.selectedTurretIds)),
   ...posedComponentBlocks(scene,(m,s)=>visible(m,s)&&selected(m,scene.selectedComponentMountId,scene.selectedComponentMountIds))];
}
export function frameVisibleModel(scene,view,width,height,preferences){
  if(!scene.visible)return false;
  const blocks=visibleFrameBlocks(scene,view);
  if(!blocks.length)return false;
  return frameBounds(view,blockFramePoints(blocks),width,height,(preferences?.frameAllFill??72)/100);
}

// Each workspace mounts its canvases only when opened. Fit each camera once
// the canvas has real dimensions, then preserve subsequent navigation.
export function createViewportLoadFramer(){
 const framed=new WeakSet();
 return (scene,view,width,height,preferences)=>{
  if(!scene.loaded||width<=1||height<=1||framed.has(view))return false;
  if(!frameVisibleModel(scene,view,width,height,preferences))return false;
  framed.add(view);return true;
 };
}
