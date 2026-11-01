import {applyBlockColors,blockIndex,secondaryColor} from './block-colors.js';
import {repaintRGB} from './block-model.js';
import {blockIds,liveBlocks} from './ship-structure.js';
import {syncRegionDisplay,REGION_COLORS} from './region-display.js';

const importedColors=new WeakMap();
export function originalBlockColors(model,block){
 let originals=importedColors.get(model);if(!originals){originals=new Map();importedColors.set(model,originals);}
 if(!originals.has(block.id))originals.set(block.id,{color:block.el?.getAttribute('color')?.toLowerCase()||block.color,secondaryColor:block.el?block.el.getAttribute('secondaryColor')?.toLowerCase():secondaryColor(block)});
 return originals.get(block.id);
}
function history(scene){if(scene.paintHistory?.model!==scene.model)scene.paintHistory={model:scene.model,undo:[],redo:[]};return scene.paintHistory;}
export function paintAvailability(scene){const h=history(scene);return {undo:h.undo.length>0,redo:h.redo.length>0};}
export function recordBlockColors(scene,changes,label='Paint',options={writeXml:false}){
  const index=blockIndex(scene.model);for(const change of changes){const block=index.get(change.id);if(block)originalBlockColors(scene.model,block);}
  const patches=applyBlockColors(scene,changes,options);if(!patches.length)return 0;
  if(scene.paintStroke?.model===scene.model){for(const patch of patches){const old=scene.paintStroke.patches.get(patch.before.id);scene.paintStroke.patches.set(patch.before.id,old?{before:old.before,after:patch.after}:patch);}return patches.length;}
  return pushPaintHistory(scene,patches,label,options);
}
function pushPaintHistory(scene,patches,label,options){
  const h=history(scene);h.undo.push({patches,label,options});h.redo=[];
  let records=h.undo.reduce((n,e)=>n+e.patches.length,0);while(h.undo.length>1&&(h.undo.length>30||records>1000000))records-=h.undo.shift().patches.length;return patches.length;
}
export function beginPaintStroke(scene){if(scene.paintStroke)return false;scene.paintStroke={model:scene.model,patches:new Map()};return true;}
export function finishPaintStroke(scene,cancel=false){
 const stroke=scene.paintStroke;delete scene.paintStroke;if(!stroke||stroke.model!==scene.model)return;
 const patches=[...stroke.patches.values()];if(!patches.length)return;
 if(cancel)applyBlockColors(scene,patches.map(p=>p.before),{writeXml:false});
 else pushPaintHistory(scene,patches,'Paint stroke',{writeXml:false});
}
export function undoPaint(scene,redo=false){
  if(scene.paintStroke)return false;
  const h=history(scene),from=redo?h.redo:h.undo,to=redo?h.undo:h.redo,entry=from.pop();if(!entry)return false;
  applyBlockColors(scene,entry.patches.map(p=>redo?p.after:p.before),entry.options);to.push(entry);return true;
}
export function paintPaletteColor(scene,palette,colorId,ids,channel='color',secondaryStrength='preserve'){
  const color=palette.byId.get(colorId);if(!color)throw Error('Choose a color from the Avorion palette.');
  if(!['color','secondaryColor'].includes(channel))throw Error('Unknown color channel');
  const live=blockIds(scene),index=blockIndex(scene.model),changes=[];
  for(const id of new Set(ids))if(live.has(id)){
    const b=index.get(id),previous=channel==='color'?b.color:secondaryColor(b);
    const argb=channel==='secondaryColor'&&secondaryStrength==='full'?'ff'+color.hex.slice(1):repaintRGB(previous,color.hex);
    changes.push({id,[channel]:argb});
  }
  return recordBlockColors(scene,changes,`Paint ${color.name}`);
}
// Regions are immutable records: every edit swaps in a new array so scope caches see the change and undo can restore the previous array.
function regionName(scene,name,except){
  name=String(name??'').trim();if(!name||name.length>80)throw Error('Region name must contain 1–80 characters.');
  if((scene.regions||[]).some(r=>r.name===name&&r.id!==except))throw Error('A region already has that name.');
  return name;
}
function regionHistory(scene){if(scene.regionHistory?.model!==scene.model)scene.regionHistory={model:scene.model,undo:[]};return scene.regionHistory;}
function commitRegions(scene,regions,label){const h=regionHistory(scene);h.undo.push({regions:scene.regions||[],label});if(h.undo.length>30)h.undo.shift();scene.regions=regions;syncRegionDisplay(scene);}
function findRegion(scene,id){const region=scene.regions?.find(r=>r.id===id);if(!region)throw Error('Choose an existing region.');return region;}
export function regionUndoLabel(scene){return regionHistory(scene).undo.at(-1)?.label||'';}
export function undoRegionChange(scene){const entry=regionHistory(scene).undo.pop();if(!entry)throw Error('No region change to undo.');scene.regions=entry.regions;syncRegionDisplay(scene);return entry.label;}
export function nextRegionName(scene){const names=new Set((scene.regions||[]).map(r=>r.name));let n=(scene.regions?.length||0)+1;while(names.has(`Region ${n}`))n++;return `Region ${n}`;}
export function addRegion(scene,name,ids){
  name=regionName(scene,String(name??'').trim()||nextRegionName(scene));
  const live=blockIds(scene),members=[...new Set(ids)].filter(id=>live.has(id));if(!members.length)throw Error('Select blocks before saving a region.');
  const used=new Set((scene.regions||[]).map(r=>r.color)),color=REGION_COLORS.find(c=>!used.has(c))||REGION_COLORS[(scene.regions?.length||0)%REGION_COLORS.length];
  const region={id:crypto.randomUUID(),name,color,ids:members};commitRegions(scene,[...(scene.regions||[]),region],`Create ${name}`);return region;
}
export function renameRegion(scene,id,name){
  const region=findRegion(scene,id);name=regionName(scene,name,id);if(name===region.name)return region;
  const next={...region,name};commitRegions(scene,scene.regions.map(r=>r===region?next:r),`Rename ${region.name}`);return next;
}
export function recolorRegion(scene,id,color){
  const region=findRegion(scene,id);if(region.color===color)return region;
  const next={...region,color};commitRegions(scene,scene.regions.map(r=>r===region?next:r),`Recolor ${region.name}`);return next;
}
export function deleteRegion(scene,id){
  const region=findRegion(scene,id);commitRegions(scene,scene.regions.filter(r=>r!==region),`Delete ${region.name}`);return region;
}
// mode: add | remove | replace. Returns the number of member changes; a region can never become empty.
export function editRegion(scene,id,ids,mode='add'){
  const region=findRegion(scene,id),live=blockIds(scene),targets=new Set([...ids].filter(id=>live.has(id))),current=new Set(region.ids);
  let members;
  if(mode==='add')members=[...region.ids,...[...targets].filter(id=>!current.has(id))];
  else if(mode==='remove')members=region.ids.filter(id=>!targets.has(id));
  else if(mode==='replace')members=[...targets];
  else throw Error(`Unknown region edit: ${mode}`);
  if(!targets.size&&mode!=='remove')throw Error('Select blocks first.');
  if(!members.length)throw Error('A region needs at least one block. Delete the region instead.');
  const kept=new Set(members),changes=members.filter(id=>!current.has(id)).length+region.ids.filter(id=>!kept.has(id)).length;
  if(!changes)return 0;
  const next={...region,ids:members};commitRegions(scene,scene.regions.map(r=>r===region?next:r),`${mode==='add'?'Add to':mode==='remove'?'Remove from':'Replace'} ${region.name}`);return changes;
}
// Blocks whose axis-aligned bounds touch or overlap any seed block (within gap), excluding the seeds and skipped ids.
export function touchingBlocks(blocks,seedIds,{gap=0.01,skip=new Set()}={}){
  const seeds=new Set(seedIds),bounds=b=>{const p=b.position,s=b.size;return [p.x-Math.abs(s.x)/2,p.y-Math.abs(s.y)/2,p.z-Math.abs(s.z)/2,p.x+Math.abs(s.x)/2,p.y+Math.abs(s.y)/2,p.z+Math.abs(s.z)/2];};
  const candidates=blocks.filter(b=>!seeds.has(b.id)&&!skip.has(b.id)),seedBlocks=blocks.filter(b=>seeds.has(b.id));
  if(!candidates.length||!seedBlocks.length)return [];
  const extents=candidates.map(b=>Math.max(Math.abs(b.size.x),Math.abs(b.size.y),Math.abs(b.size.z))).sort((a,b)=>a-b);
  const cell=Math.max(extents[extents.length>>1]*2,1e-3),grid=new Map(),large=[],key=(x,y,z)=>`${x},${y},${z}`;
  const range=box=>box.map((v,i)=>Math.floor((i<3?v-gap:v+gap)/cell));
  for(const b of candidates){
    const box=bounds(b),[x0,y0,z0,x1,y1,z1]=range(box);
    if((x1-x0+1)*(y1-y0+1)*(z1-z0+1)>512){large.push([b,box]);continue;}
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++){const k=key(x,y,z);let list=grid.get(k);if(!list)grid.set(k,list=[]);list.push([b,box]);}
  }
  const touches=(a,b)=>a[0]<=b[3]+gap&&b[0]<=a[3]+gap&&a[1]<=b[4]+gap&&b[1]<=a[4]+gap&&a[2]<=b[5]+gap&&b[2]<=a[5]+gap;
  const found=new Set();
  for(const seed of seedBlocks){
    const box=bounds(seed),[x0,y0,z0,x1,y1,z1]=range(box),visit=([b,other])=>{if(!found.has(b.id)&&touches(box,other))found.add(b.id);};
    if((x1-x0+1)*(y1-y0+1)*(z1-z0+1)>4096){for(const list of grid.values())list.forEach(visit);}
    else for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)grid.get(key(x,y,z))?.forEach(visit);
    large.forEach(visit);
  }
  return blocks.filter(b=>found.has(b.id)).map(b=>b.id);
}
// Grow a region by one ring of blocks touching any member, hidden or not. The region as a whole is the seed, not the selection.
export function growRegion(scene,id){
  const region=findRegion(scene,id),added=touchingBlocks(liveBlocks(scene),region.ids);
  if(!added.length)throw Error('No other blocks touch this region.');
  return editRegion(scene,id,added,'add');
}
// Serialize a working copy. XML node identity and original coordinates stay intact.
export function exportPaintedXml(model){
  if(!model?.doc)throw Error('Import an XML model before exporting.');
  const copy=model.doc.cloneNode(true),original=[...model.doc.getElementsByTagName('block')],clones=copy.getElementsByTagName('block'),indices=new Map(original.map((el,i)=>[el,i])),blocks=blockIndex(model);
  for(const [id,channels] of model.colorOverrides||[]){
    const block=blocks.get(id),index=indices.get(block?.el);if(index===undefined)continue;
    for(const [key,flag] of [['color',1],['secondaryColor',2]]){if(!(channels&flag))continue;const value=key==='color'?block.color:secondaryColor(block);if(value===undefined)clones[index].removeAttribute(key);else if(clones[index].getAttribute(key)?.toLowerCase()!==value.toLowerCase())clones[index].setAttribute(key,value);}
  }
  return new XMLSerializer().serializeToString(copy);
}

const PALETTES_KEY='avorion-viewer.color-palettes.v1';
export function readPalettes(storage,palette){try{const raw=JSON.parse(storage.getItem(PALETTES_KEY)||'[]');return Array.isArray(raw)?raw.filter(p=>typeof p.name==='string'&&p.name.length<=80&&Array.isArray(p.colors)&&p.colors.length<=32&&p.colors.every(id=>palette.byId.has(id))).slice(0,100):[];}catch{return [];}}
export function savePalette(storage,palette,name,ids){
  name=name.trim();if(!name||name.length>80)throw Error('Palette name must contain 1–80 characters.');
  if(!ids.length||ids.some(id=>!palette.byId.has(id)))throw Error('Palette contains an unknown color.');
  const saved=readPalettes(storage,palette);if(saved.some(p=>p.name===name))throw Error('A saved palette already has that name.');if(saved.length>=100)throw Error('Local palette limit reached (100).');
  saved.push({name,colors:[...new Set(ids)].slice(0,32)});storage.setItem(PALETTES_KEY,JSON.stringify(saved));return saved;
}

const ACTIVE_PALETTE_KEY='avorion-viewer.active-palette.v1';
export function activePalette(storage,palette){
 const name=storage.getItem(ACTIVE_PALETTE_KEY);return readPalettes(storage,palette).find(p=>p.name===name)||null;
}
export function activatePalette(storage,palette,name){
 if(name===null){storage.removeItem(ACTIVE_PALETTE_KEY);return;}
 if(!readPalettes(storage,palette).some(p=>p.name===name))throw Error('Choose a saved palette.');
 storage.setItem(ACTIVE_PALETTE_KEY,name);
}

export function editPalette(storage,palette,oldName,{name=oldName,colors,remove=false}={}){
 const saved=readPalettes(storage,palette),index=saved.findIndex(p=>p.name===oldName);
 if(index<0)throw Error('Palette no longer exists.');
 name=name.trim();colors=colors??saved[index].colors;
 if(!remove){
  if(!name||name.length>80)throw Error('Palette name must contain 1–80 characters.');
  if(saved.some((p,i)=>i!==index&&p.name===name))throw Error('A saved palette already has that name.');
  if(!colors.length||colors.length>32||colors.some(id=>!palette.byId.has(id)))throw Error('Choose 1–32 named Avorion colors.');
  saved[index]={name,colors:[...new Set(colors)]};
 }else saved.splice(index,1);
 storage.setItem(PALETTES_KEY,JSON.stringify(saved));
 if(storage.getItem(ACTIVE_PALETTE_KEY)===oldName){if(remove)storage.removeItem(ACTIVE_PALETTE_KEY);else storage.setItem(ACTIVE_PALETTE_KEY,name);}
}
