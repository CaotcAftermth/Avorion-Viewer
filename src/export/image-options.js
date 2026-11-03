import {viewportFrameTime} from '../game-renderer.js';
import {ensureViewportOptions} from '../viewport-options.js';
import {makeModel} from '../block-model.js';
import {liveBlocks} from '../ship-structure.js';
import {secondaryColor} from '../block-colors.js';
import {validateAnnotations} from './blueprint-annotations.js';

export const IMAGE_FORMATS={png:'image/png',webp:'image/webp',jpeg:'image/jpeg'};
export const BLUEPRINT_CAMERAS=['front','back','left','right','top','bottom','isometric','current'];
export function blueprintSettings(o={}){
  return o.blueprintSettings??{columnSplit:.5,rowSplit:.5,single:{rotation:0,scale:1},views:['front','right','top','isometric'].map(camera=>({camera,rotation:0,scale:1}))};
}
export function validateBlueprintSettings(o){
  const settings=blueprintSettings(o);
  for(const key of ['columnSplit','rowSplit'])if(!Number.isFinite(settings[key])||settings[key]<.2||settings[key]>.8)throw Error('Blueprint row and column sizes must be between 20% and 80%.');
  if(!Array.isArray(settings.views)||settings.views.length!==4||!settings.single)throw Error('Blueprint needs one single-view configuration and four multi-view configurations.');
  for(const view of [settings.single,...settings.views]){
    validateAnnotations(view);
    if(!view||!Number.isFinite(view.rotation)||view.rotation<-180||view.rotation>180)throw Error('Blueprint rotation must be between -180 and 180 degrees.');
    if(!Number.isFinite(view.scale)||view.scale<.25||view.scale>2)throw Error('Blueprint model scale must be between 25% and 200%.');
    if(view.orientation&&(!Number.isFinite(view.orientation.yaw)||!Number.isFinite(view.orientation.pitch)||Math.abs(view.orientation.pitch)>Math.PI/2))throw Error('Choose a valid blueprint camera orientation.');
    if(view.pan&&['x','y'].some(axis=>!Number.isFinite(view.pan[axis])||Math.abs(view.pan[axis])>2))throw Error('Blueprint pan must stay within two panel widths or heights.');
  }
  if(settings.views.some(view=>!BLUEPRINT_CAMERAS.includes(view.camera)))throw Error('Choose a valid blueprint view orientation.');
  return settings;
}
export function imageDefaults(view,width=1200,height=800,type='viewport'){
  const d=ensureViewportOptions(structuredClone(view));
  return {type,format:'png',width:Math.max(1,Math.round(width)),height:Math.max(1,Math.round(height)),supersampling:1,quality:.95,
    background:type==='transparent'?'transparent':type==='blueprint'?'solid':'viewport',backgroundColor:type==='blueprint'?'#10283f':'#202020',
    overlays:type==='viewport'&&d.showOverlays,gizmos:type==='viewport'&&d.showGizmo,selection:type==='viewport'&&d.outlineSelected,
    grid:type==='viewport'&&!!view.grid,labels:type==='viewport'&&d.showText,dimensions:type==='viewport'&&d.showModelDimensions,dimensionCage:true,
    projection:type==='blueprint'?'orthographic':'current',camera:type==='blueprint'?'isometric':'current',framing:type==='blueprint'?'fit':'contain',margin:.12,
    blueprintLayout:'single',pageGrid:type==='blueprint',titleBlock:type==='blueprint',shipName:'',budget:768};
}
export function imageFilename(name,type,format){
  const stem=String(name||'ship').replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,100)||'ship';
  return `${stem}-${type}.${format==='jpeg'?'jpg':format}`;
}
export function validateImageOptions(o,limits={maxTextureSize:4096,maxRenderbufferSize:4096},blocks=0){
  if(!['viewport','transparent','blueprint'].includes(o.type)||!IMAGE_FORMATS[o.format])throw Error('Choose a supported image type and format.');
  for(const key of ['width','height'])if(!Number.isSafeInteger(o[key])||o[key]<1||o[key]>32768)throw Error('Image dimensions must be whole pixels from 1 to 32,768.');
  if(![1,2,4].includes(o.supersampling))throw Error('Supersampling must be 1×, 2×, or 4× per axis.');
  if(!['viewport','solid','transparent'].includes(o.background)||!/^#[\da-f]{6}$/i.test(o.backgroundColor))throw Error('Choose a valid background and color.');
  if(o.format==='jpeg'&&o.background==='transparent')throw Error('JPEG cannot preserve transparency. Choose PNG/WebP or select a solid background.');
  if(o.format!=='png'&&(!Number.isFinite(o.quality)||o.quality<.1||o.quality>1))throw Error('Encoding quality must be between 0.1 and 1.');
  if(!Number.isFinite(o.budget)||o.budget<128||o.budget>4096)throw Error('Memory budget must be 128–4096 MiB.');
  if(!Number.isFinite(o.margin)||o.margin<0||o.margin>.4)throw Error('Framing margin must be between 0 and 0.4.');
  if(!['current','perspective','orthographic'].includes(o.projection??'current'))throw Error('Choose a valid camera projection.');
  if(!['contain','crop','fit'].includes(o.framing)||!['current','front','back','left','right','top','bottom','isometric'].includes(o.camera))throw Error('Choose valid camera and framing options.');
  if(!['single','multi'].includes(o.blueprintLayout??'single'))throw Error('Choose a valid blueprint layout.');
  if(o.type==='blueprint'){validateBlueprintSettings(o);if(o.blueprintLayout==='multi')blueprintPanels(o);}
  const maxTarget=Math.min(4096,limits.maxTextureSize,limits.maxRenderbufferSize);
  // Include assembly, encoder copies, model data, MSAA, HDR, depth and effect targets.
  const fixedBytes=o.width*o.height*16+blocks*7000+32*1024**2,budgetBytes=o.budget*1024**2;
  const tileLimit=Math.floor(Math.min(maxTarget,Math.sqrt(Math.max(0,budgetBytes-fixedBytes)/160))/16)*16;
  if(tileLimit<256)throw Error('Estimated image/model memory exceeds the budget. Reduce resolution or supersampling, or increase the budget.');
  return {tileLimit,estimatedBytes:fixedBytes+Math.min(tileLimit,o.width*o.supersampling)*Math.min(tileLimit,o.height*o.supersampling)*160};
}
export function imageTiles(width,height,limit,padding=32){
  const core=Math.floor((limit-padding*2)/16)*16;
  if(core<64)throw Error('Post-processing needs more tile padding than the memory budget allows. Increase budget or reduce effects.');
  const tiles=[];
  for(let y=0;y<height;y+=core)for(let x=0;x<width;x+=core){
    const w=Math.min(core,width-x),h=Math.min(core,height-y),left=Math.max(0,x-padding),top=Math.max(0,y-padding);
    tiles.push({x:left,y:top,width:Math.min(width,x+w+padding)-left,height:Math.min(height,y+h+padding)-top,coreX:x,coreY:y,coreWidth:w,coreHeight:h});
  }
  return tiles;
}
export function captureImage(scene,view,preferences,size){
  if(!scene.loaded||!scene.model)throw Error('Load a ship before exporting an image.');
  const blocks=liveBlocks(scene).map(b=>({...b,el:undefined,itemEl:undefined,position:{...b.position},size:{...b.size},unknownAttrs:{...b.unknownAttrs},secondaryColor:secondaryColor(b)}));
  if(!blocks.length)throw Error('The ship contains no live blocks.');
  const model=makeModel(blocks,scene.model.fileName);model.turretMounts=structuredClone(scene.model.turretMounts||[]);model.componentSetup=structuredClone(scene.model.componentSetup);model.placementOffset=structuredClone(scene.model.placementOffset);model.imageShipName=scene.model.doc?.documentElement.getAttribute('name');
  return {scene:{model,imageSourceModel:scene.model,imageSourceRevision:scene.revision,imageSourceAppearanceRevision:scene.appearanceRevision,imageSourceDirty:!!scene.appearanceDirty?.size,loaded:true,visible:scene.visible,revision:0,appearanceRevision:0,selected:scene.selected,selectedIds:new Set(scene.selectedIds),hiddenIds:new Set(scene.hiddenIds)},
    view:structuredClone(view),preferences:{...preferences},size:{...size},time:viewportFrameTime(view)??performance.now()/1000,
    shipName:scene.model.doc?.documentElement.getAttribute('name')||scene.model.fileName?.replace(/\.xml$/i,'')||'Ship'};
}

// Panels share the output sheet; reserve space for view labels and the title block.
export function blueprintPanels(o){
  const settings=validateBlueprintSettings(o);
  const unit=Math.min(o.width,o.height)/800,pad=Math.max(1,Math.round(20*unit));
  const gap=pad,label=Math.max(1,Math.round(24*unit));
  const availableWidth=o.width-2*pad-gap,availableHeight=Math.floor(o.height-2*pad-gap-(o.titleBlock?82*unit:0));
  const widths=[Math.floor(availableWidth*settings.columnSplit)];widths.push(availableWidth-widths[0]);
  const heights=[Math.floor(availableHeight*settings.rowSplit)];heights.push(availableHeight-heights[0]);
  if(Math.min(...widths)<1||Math.min(...heights)<=label)throw Error('Multi-view blueprint needs a larger image resolution.');
  return settings.views.map((view,i)=>({...view,x:pad+(i%2?widths[0]+gap:0),y:pad+(i>=2?heights[0]+gap:0),width:widths[i%2],height:heights[Math.floor(i/2)]-label,label}));
}
