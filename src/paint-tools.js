import {blockIndex,secondaryColor} from './block-colors.js';
import {originalBlockColors,recordBlockColors,paintPaletteColor} from './color-workshop.js';
import {liveBlocks} from './ship-structure.js';

export const PAINT_TOOLS=['brush','eyedropper','replace','fill','restore'];
export function paintOptions(view){
 if(!view.paint||typeof view.paint!=='object'||Array.isArray(view.paint))view.paint={};
 const o=view.paint??={};
 if(!PAINT_TOOLS.includes(o.tool))o.tool='brush';
 if(!['all','selection','region'].includes(o.scope))o.scope='all';
 o.radius=Math.max(0,Math.min(64,Number(o.radius)||0));
 o.lensZoom=Math.max(2,Math.min(8,Number(o.lensZoom)||4));
 o.lensSize=Math.max(120,Math.min(360,Number(o.lensSize)||200));
 if(!o.symmetry||typeof o.symmetry!=='object')o.symmetry={};if(!o.origin||typeof o.origin!=='object')o.origin={};
 if(!o.planeVisible||typeof o.planeVisible!=='object'||Array.isArray(o.planeVisible))o.planeVisible={};
 for(const a of ['x','y','z']){o.planeVisible[a]=o.planeVisible[a]!==false;o.symmetry[a]=o.symmetry[a]===true;o.origin[a]=Number.isFinite(Number(o.origin[a]))?Number(o.origin[a]):0;}
 if(!['color','material','type'].includes(o.fillRule))o.fillRule='color';
 if(!['smooth','detail'].includes(o.lensQuality))o.lensQuality='smooth';
 return o;
}
export function paintScope(scene,options,hidden=new Set()){
 const filter=options.scope==='selection'?(scene.selectedIds||new Set()):options.scope==='region'?new Set(scene.regions?.find(r=>r.id===options.regionId)?.ids||[]):null;
 return new Set(liveBlocks(scene).filter(b=>scene.visible&&!hidden.has(b.id)&&(!filter||filter.has(b.id))).map(b=>b.id));
}
export const channelColor=(b,channel)=>channel==='secondaryColor'?secondaryColor(b):b.color;
export function samplePaintColor(palette,block,channel){
 const argb=channelColor(block,channel);
 const matches=argb?palette.colors.filter(c=>c.hex.slice(1).toLowerCase()===argb.slice(2).toLowerCase()):[];
 return {argb,matches,exact:matches[0]||null};
}
const mirrorIndices=new WeakMap();
export function mirroredIds(model,ids,options,allowed,revision=0){
 const axes=['x','y','z'].filter(a=>options.symmetry?.[a]);if(!axes.length)return ids.filter(id=>allowed.has(id));
 const key=(b,p=b.position)=>[b.typeIndex,...['x','y','z'].flatMap(a=>[Math.round(p[a]*1e4),Math.round(b.size[a]*1e4)])].join('/');
 let cache=mirrorIndices.get(model);
 if(!cache||cache.revision!==revision){const map=new Map();for(const b of model.blocks){const k=key(b);if(!map.has(k))map.set(k,[]);map.get(k).push(b.id);}cache={revision,map};mirrorIndices.set(model,cache);}
 const index=blockIndex(model),result=new Set(ids.filter(id=>allowed.has(id)));
 for(const id of result){const b=index.get(id);if(!b)continue;
  for(let mask=1;mask<1<<axes.length;mask++){const p={...b.position};axes.forEach((a,i)=>{if(mask&(1<<i))p[a]=2*options.origin[a]-p[a];});for(const match of cache.map.get(key(b,p))||[])if(allowed.has(match))result.add(match);}
 }return [...result];
}
export function applyPaintTool(scene,palette,brush,ids,options,allowed){
 ids=mirroredIds(scene.model,ids,options,allowed,scene.revision);if(!ids.length)return 0;
 if(options.tool==='restore'){
  const index=blockIndex(scene.model);return recordBlockColors(scene,ids.map(id=>({id,[brush.channel]:originalBlockColors(scene.model,index.get(id))[brush.channel]})),'Restore imported colors');
 }
 return paintPaletteColor(scene,palette,brush.colorId,ids,brush.channel,brush.strength);
}

// Bulk tools run in a worker. Connected fill uses face-touching block bounds;
// edge/corner-only contact does not bridge islands. No quadratic ship scans.
const EPS=1e-5,axes=['x','y','z'];
export function bulkPaintTargets(blocks,seedId,tool,rule='color'){
 const seed=blocks.find(b=>b.id===seedId);if(!seed)return [];
 const match=b=>rule==='material'?b.materialIndex===seed.materialIndex:rule==='type'?b.typeIndex===seed.typeIndex:b.paintColor===seed.paintColor;
 const entries=blocks.filter(match).map(b=>({id:b.id,min:axes.map(a=>b.position[a]-b.size[a]/2),max:axes.map(a=>b.position[a]+b.size[a]/2)}));
 if(tool==='replace')return entries.map(e=>e.id);
 const byId=new Map(entries.map(e=>[e.id,e]));
 function tree(items){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const e of items)for(let a=0;a<3;a++){min[a]=Math.min(min[a],e.min[a]);max[a]=Math.max(max[a],e.max[a]);}
  if(items.length<=12)return {min,max,items};const ext=max.map((n,i)=>n-min[i]),axis=ext.indexOf(Math.max(...ext));items.sort((a,b)=>(a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]));const mid=items.length>>1;
  return {min,max,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};
 }
 const root=tree(entries),seen=new Set([seedId]),queue=[seedId];
 const overlap=(a,b)=>a.min.every((v,i)=>v<=b.max[i]+EPS&&a.max[i]>=b.min[i]-EPS);
 function visit(node,entry){if(!overlap(node,entry))return;if(node.items){for(const other of node.items){if(seen.has(other.id)||!overlap(entry,other))continue;const spans=entry.min.map((v,i)=>Math.min(entry.max[i],other.max[i])-Math.max(v,other.min[i]));if(spans.filter(n=>n>EPS).length>=2){seen.add(other.id);queue.push(other.id);}}}else{visit(node.left,entry);visit(node.right,entry);}}
 for(let i=0;i<queue.length;i++)visit(root,byId.get(queue[i]));return queue;
}
