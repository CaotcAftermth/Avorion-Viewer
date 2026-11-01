// Live region display. One region at a time can be highlighted (tinted in the
// viewport) or isolated (every other block hidden). Isolation is re-applied
// after each region edit so removed blocks disappear and grown blocks appear
// at once. If visibility is changed elsewhere (Show All, Hide), isolation
// gives way to a plain highlight instead of overriding the user.
import {liveBlocks} from './ship-structure.js';

export const REGION_COLORS=['#5ec27a','#d36ad6','#4f9fea','#e2d14c','#46cfc0','#e8665e','#a98af0','#c9c9c9'];
const empty=new Set(),highlightCache=new WeakMap();

export function activeRegion(scene){const d=scene.regionDisplay;return d&&d.model===scene.model?scene.regions?.find(r=>r.id===d.id)||null:null;}
export function regionDisplayMode(scene,id){const d=scene.regionDisplay;return d&&d.id===id&&activeRegion(scene)?d.mode:'off';}

function restoreHidden(scene,d){if(d?.mode==='isolate'&&d.applied&&scene.hiddenIds===d.applied)scene.hiddenIds=d.restore||new Set();}

// mode: off | highlight | isolate
export function setRegionDisplay(scene,id,mode){
  const prev=scene.regionDisplay&&scene.regionDisplay.model===scene.model?scene.regionDisplay:null;
  const keepRestore=prev?.mode==='isolate'&&prev.applied&&scene.hiddenIds===prev.applied;
  if(mode!=='isolate')restoreHidden(scene,prev);
  if(!id||mode==='off'||!scene.regions?.some(r=>r.id===id)){scene.regionDisplay=null;return null;}
  scene.regionDisplay={id,mode,model:scene.model,restore:keepRestore&&mode==='isolate'?prev.restore:scene.hiddenIds,applied:null};
  syncRegionDisplay(scene);return scene.regionDisplay;
}

export function syncRegionDisplay(scene){
  const d=scene.regionDisplay;if(!d)return;
  const region=activeRegion(scene);
  if(!region){restoreHidden(scene,d);scene.regionDisplay=null;return;}
  if(d.mode!=='isolate')return;
  if(d.applied&&scene.hiddenIds!==d.applied){d.mode='highlight';d.applied=null;return;}
  const members=new Set(region.ids);
  scene.hiddenIds=new Set(liveBlocks(scene).filter(b=>!members.has(b.id)).map(b=>b.id));d.applied=scene.hiddenIds;
}

// Ids to tint in the viewport. Isolation already shows only the region, so it is not tinted.
export function regionHighlightIds(scene){
  const region=activeRegion(scene);if(!region||scene.regionDisplay.mode!=='highlight')return empty;
  let ids=highlightCache.get(region);if(!ids){ids=new Set(region.ids);highlightCache.set(region,ids);}return ids;
}
export function regionHighlightColor(scene){return activeRegion(scene)?.color||REGION_COLORS[0];}
