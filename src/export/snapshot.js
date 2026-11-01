import {posedTurretBlocks} from '../turrets/posed-blocks.js';
import {liveBlocks,viewportHiddenIds,isThinBlock} from '../ship-structure.js';
import {secondaryColor} from '../block-colors.js';
export const EXPORT_FORMATS={stl:'Binary triangle mesh · millimeters by convention', '3mf':'Print package · explicit millimeters and base materials',glb:'Single editable scene · basic PBR colors',gltf:'ZIP of glTF scene, buffer, and metadata',obj:'ZIP of OBJ, MTL, and metadata'};
export function captureExport(scene,view,{scope='all',regionId='',placement='centered',colors='working',excludeThin=false,excludedIds=[]}={}){
 if(!scene.loaded||!scene.model)throw Error('Load a model first.');
 const region=scope==='region'?scene.regions?.find(r=>r.id===regionId):null;
 if(scope==='region'&&!region)throw Error('Choose a named region.');
 const wanted=scope==='selected'?scene.selectedIds:region?new Set(region.ids):null,hidden=viewportHiddenIds(scene,view||{});
 const members=new Map();for(const r of scene.regions||[])for(const id of r.ids){if(!members.has(id))members.set(id,[]);members.get(id).push(r.name);}
 const excluded=new Set(excludedIds),scoped=liveBlocks(scene).filter(b=>(!wanted||wanted.has(b.id))&&(scope!=='visible'||scene.visible&&!hidden.has(b.id)));
 const thinCount=excludeThin?scoped.filter(isThinBlock).length:0,manualCount=scoped.filter(b=>excluded.has(b.id)&&!(excludeThin&&isThinBlock(b))).length;
 const blocks=scoped.filter(b=>!(excludeThin&&isThinBlock(b))&&!excluded.has(b.id)).map(b=>{
  const numeric=['index','material','look','up','lx','ly','lz','ux','uy','uz','lowerX','lowerY','lowerZ','upperX','upperY','upperZ'];
  if(b.el?.hasAttribute&&numeric.some(k=>b.el.hasAttribute(k)&&(!b.el.getAttribute(k).trim()||!Number.isFinite(Number(b.el.getAttribute(k))))))throw Object.assign(Error(`Block ${b.id} has invalid numeric XML attributes. Correct the source or exclude this block from the export.`),{issueIds:[b.id]});
  const secondary=colors==='imported'&&b.el?b.el.getAttribute('secondaryColor')??undefined:secondaryColor(b);
  const position={...b.position};if(placement==='native')for(const a of ['x','y','z'])position[a]-=scene.model.placementOffset?.[a]||0;
  return {id:b.id,opacity:b.opacity,position,size:{...b.size},typeIndex:b.typeIndex,type:b.type,materialIndex:b.materialIndex,material:b.material,look:b.look,up:b.up,color:colors==='imported'&&b.el?b.el.getAttribute('color')||b.color:b.color,...(secondary===undefined?{}:{secondaryColor:secondary}),originalIndex:b.originalIndex,itemIndex:b.itemEl?.getAttribute('index')??null,parentIndex:b.itemEl?.getAttribute('parent')??null,parentId:b.parentId,regions:members.get(b.id)||[],unknownAttrs:{...b.unknownAttrs}};
 });
 for(const b of posedTurretBlocks(scene,(m,s)=>(!wanted||wanted.has(s.blockId)||scope==='selected'&&scene.selectedTurretIds?.has(m.id))&&!excluded.has(s.blockId)&&(scope!=='visible'||scene.visible&&!m.hidden&&!scene.hiddenIds?.has(s.blockId)))){
  if(placement==='native')for(const a of ['x','y','z'])b.position[a]-=scene.model.placementOffset?.[a]||0;
  blocks.push({...b,regions:members.get(b.parentId)||[]});
 }
 if(!blocks.length)throw Error('The export scope contains no blocks after scope and exclusion filters.');
 return {version:1,fileName:scene.model.fileName,scope,placement,colorSource:colors,excludedThinBlocks:thinCount,excludedProblemBlocks:manualCount,revision:scene.revision||0,appearanceRevision:scene.appearanceRevision||0,blocks,warnings:[...(thinCount?[`Excluded ${thinCount} zero/thin blocks (any dimension below 0.01 native units), matching the viewport filter.`]:[]),...(manualCount?[`Excluded ${manualCount} explicitly chosen problem blocks from this export only.`]:[]),...(scene.model.warnings||[]).filter(w=>w.level!=='info'||/turret/i.test(w.message)).map(w=>w.message.replace('Preserved on export.','Retained in source XML; omitted from 3D export.'))]};
}
