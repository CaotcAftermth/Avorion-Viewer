import { liveBlocks, viewportHiddenIds } from './ship-structure.js';
import { blockFramePoints } from './block-model.js';
import { frameBounds } from './navigation.js';
import {visibleTurretBlocks,visibleComponentBlocks} from './turrets/posed-blocks.js';
export function visibleFrameBlocks(scene,view){
 const hidden=viewportHiddenIds(scene,view);
 return [...liveBlocks(scene).filter(b=>!hidden.has(b.id)),...visibleTurretBlocks(scene),...visibleComponentBlocks(scene)];
}
export function frameVisibleModel(scene,view,width,height,preferences){
  if(!scene.visible)return false;
  const blocks=visibleFrameBlocks(scene,view);
  if(!blocks.length)return false;
  frameBounds(view,blockFramePoints(blocks),width,height);return true;
}
