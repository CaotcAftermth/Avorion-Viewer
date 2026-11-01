import {beginImageRender,endImageRender,imageRenderLimits,createImageTarget,readImageTarget,drawGame,sceneClipRange,releaseViewportResources} from '../game-renderer.js';
import {ensureViewportOptions,viewportPreferences} from '../viewport-options.js';
import {alignView,metrics} from '../navigation.js';
import {frameVisibleModel} from '../model-framing.js';
import {drawDimensions,drawSymmetryPlanes} from '../viewport-annotations.js';
import {aoActive,bloomActive} from '../viewport-post.js';
import {IMAGE_FORMATS,validateImageOptions,imageTiles,imageFilename,blueprintPanels,blueprintSettings} from './image-options.js';
import {drawCapturedOverlays,drawBlueprintPage} from './image-overlays.js';
import {blueprintCamera} from './blueprint-camera.js';
import {drawBlueprintAnnotations} from './blueprint-annotations.js';

const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
const check=signal=>{if(signal?.aborted)throw new DOMException('Image export cancelled.','AbortError');};
export function imageView(snapshot,o){
  if(o.type==='blueprint'){const settings=o.blueprintView??blueprintSettings(o).single;o={...o,dimensions:settings.dimensions??o.dimensions,dimensionCage:settings.dimensionCage??o.dimensionCage};}
  const view=structuredClone(snapshot.view),d=ensureViewportOptions(view),p={...snapshot.preferences};
  const source=snapshot.size,scale=(o.framing==='crop'?Math.max:Math.min)(o.width/source.width,o.height/source.height);
  d.focalLength*=scale*Math.min(source.width,source.height)/Math.min(o.width,o.height);
  view.panX*=scale;view.panY*=scale;view.imageTime=snapshot.time;
  d.showOverlays=o.overlays;d.showGizmo=o.gizmos;d.showText=o.labels;d.outlineSelected=o.selection;
  d.showModelDimensions=o.dimensions;view.grid=o.grid;
  if(o.dimensionCage!==undefined)p.dimensionCage=!!o.dimensions&&o.dimensionCage;
  if(!o.overlays){d.axisX=d.axisY=d.axisZ=false;d.wireOverlay=d.showBlockBounds=false;}
  // Explicit export controls can enable grid, labels, and selection independently.
  if(o.grid||o.selection||o.dimensions)d.showOverlays=true;
  if(!o.selection)d.outlineSelected=false;
  if(!o.overlays)view.interactionMode='object';
  if(o.background!=='viewport'){d.background='VIEWPORT';d.backgroundColor=o.backgroundColor;}
  if(o.projection&&o.projection!=='current')view.projection=o.projection;
  if(o.camera!=='current'){
    view.projection=o.projection==='perspective'?'perspective':'orthographic';view.roll=0;
    if(o.camera==='isometric'){view.yaw=Math.PI/4;view.pitch=Math.atan(1/Math.sqrt(2));}else alignView(view,o.camera);
  }
  if(o.type==='blueprint'){
    const settings=o.blueprintView??blueprintSettings(o).single;
    Object.assign(view,blueprintCamera(o.camera,{...settings,rotation:o.blueprintRotation??settings.rotation},snapshot.view));
    Object.assign(d,{blueprint:true,shading:'SOLID',xray:false,ambientOnly:false,shadows:false,dof:false,objectOutline:true,outlineColor:'#b8e0ff',wireOverlay:false,wireThreshold:.85});
    Object.assign(p,{shaderDebug:0,shaderBloom:0,shaderAO:0,shaderSpill:0,shaderExposure:0});
    view.grid=false;
  }
  if(o.framing==='fit'||o.camera!=='current'){
    if(!frameVisibleModel(snapshot.scene,view,o.width,o.height,p))throw Error('No visible ship geometry to frame.');
    d.focalLength*=(1-2*o.margin)/.72;
    if(o.type==='blueprint'&&o.titleBlock){d.focalLength*=.86;view.panY-=o.height*.05;}
    d.clipStart=Math.min(d.clipStart,.00001);d.clipEnd=Math.max(d.clipEnd,metrics(view,o.width,o.height).distance+Math.hypot(...Object.values(snapshot.scene.model.bounds.size))*2+2);
  }
  if(o.type==='blueprint'){
    const settings=o.blueprintView??blueprintSettings(o).single;
    d.focalLength*=o.blueprintScale??settings.scale;
    view.panX+=(settings.pan?.x||0)*o.width;view.panY+=(settings.pan?.y||0)*o.height;
  }
  return {view,preferences:p};
}
function tilePadding(snapshot,view,p,o,w,h){
  const ss=o.supersampling,d=view.display;let padding=16*ss;
  if(d.dof&&d.shading==='RENDERED')padding=Math.max(padding,16*ss);
  if(bloomActive(d,p))padding=Math.max(padding,352*ss);
  if(aoActive(d,p)){
    const range=sceneClipRange(snapshot.scene.model,{...view,grid:false,display:{...view.display,showOverlays:false}},w,h,p),radius=p.shaderAORadius;
    const projected=view.projection==='orthographic'?metrics(view,w,h).scale*radius:metrics(view,w,h).focal*radius/Math.max(.00001,range.near-radius);
    padding=Math.max(padding,Math.ceil(projected)+8*ss);
  }
  return Math.ceil(padding/16)*16;
}
function pixelsToCanvas(bytes,width,height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height),out=image.data;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const src=((height-1-y)*width+x)*4,dst=(y*width+x)*4,a=bytes[src+3];
    // WebGL blend targets contain premultiplied RGB; ImageData expects straight RGB.
    out[dst]=a?Math.min(255,bytes[src]*255/a):0;out[dst+1]=a?Math.min(255,bytes[src+1]*255/a):0;out[dst+2]=a?Math.min(255,bytes[src+2]*255/a):0;out[dst+3]=a;
  }
  ctx.putImageData(image,0,0);return canvas;
}
export async function exportImage(snapshot,options,{signal,onProgress=()=>{},overlays=[],tileLimit:forcedLimit,renderOwner,encode=true}={}){
  const o={...options},owner=renderOwner||{},limits=imageRenderLimits(),plan=validateImageOptions(o,limits,snapshot.scene.model.blocks.length);
  const canvas=document.createElement('canvas');canvas.width=o.width;canvas.height=o.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx||canvas.width!==o.width||canvas.height!==o.height)throw Error('Browser cannot allocate the requested image size.');
  let target,acquired=false,lastView;const views=[];
  try{
    check(signal);onProgress(0,'Preparing image and local assets…');if(!renderOwner){await beginImageRender(owner,signal);acquired=true;}check(signal);
    if(o.type==='blueprint'){
      if(o.background!=='transparent'){ctx.fillStyle=o.backgroundColor;ctx.fillRect(0,0,o.width,o.height);}
      drawBlueprintPage(ctx,o,snapshot,o.width,o.height);
    }
    const sheet=o,multi=sheet.type==='blueprint'&&sheet.blueprintLayout==='multi';
    const panels=multi?blueprintPanels(sheet):[{x:0,y:0,width:sheet.width,height:sheet.height}];
    for(let panelIndex=0;panelIndex<panels.length;panelIndex++){
      const panel=panels[panelIndex];
      const settings=multi?panel:blueprintSettings(sheet).single;
      const base=multi?{...sheet,width:panel.width,height:panel.height,camera:panel.camera,blueprintView:panel,projection:'orthographic',framing:'fit',titleBlock:false,pageGrid:false}:sheet;
      const o=sheet.type==='blueprint'?{...base,dimensions:settings.dimensions??base.dimensions,dimensionCage:settings.dimensionCage??base.dimensionCage}:base;
      const {view,preferences:p}=imageView(snapshot,o),ss=o.supersampling,w=o.width*ss,h=o.height*ss;
      view.panX*=ss;view.panY*=ss;view.display.imageSampleScale=ss;
      const maximum=Math.min(plan.tileLimit,forcedLimit||Infinity);let limit=Math.min(maximum,forcedLimit||1024),padding=0;
      if(w>limit||h>limit){padding=tilePadding(snapshot,view,viewportPreferences(p,view),o,w,h);limit=Math.min(maximum,Math.max(limit,padding*2+256));}
      const tiled=w>limit||h>limit;
      const tiles=tiled?imageTiles(w,h,limit,padding):[{x:0,y:0,width:w,height:h,coreX:0,coreY:0,coreWidth:w,coreHeight:h}];
      views.push(view);lastView=view;
      ctx.save();ctx.translate(panel.x,panel.y);ctx.beginPath();ctx.rect(0,0,o.width,o.height);ctx.clip();
      for(let i=0;i<tiles.length;i++){
        check(signal);const tile=tiles[i];target=createImageTarget(tile.width,tile.height);
        const output={owner,target,tile,fullHeight:h,studioEffects:!!o.studioEffects,transparent:o.background==='transparent'||o.type==='blueprint'};
        const started=performance.now();
        while(!drawGame(null,snapshot.scene,view,w,h,p,1,null,output)){
          check(signal);if(performance.now()-started>120000)throw Error('Model preparation timed out. Try a smaller ship or reload the viewer.');await yieldUI();
        }
        check(signal);const pixels=readImageTarget(target),scratch=pixelsToCanvas(pixels,tile.width,tile.height);
        ctx.save();ctx.beginPath();ctx.rect(tile.coreX/ss,tile.coreY/ss,tile.coreWidth/ss,tile.coreHeight/ss);ctx.clip();
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
        ctx.drawImage(scratch,tile.x/ss,tile.y/ss,tile.width/ss,tile.height/ss);ctx.restore();
        scratch.width=scratch.height=1;target.dispose();target=null;
        onProgress(Math.round((panelIndex+(i+1)/tiles.length)/panels.length*85),`Rendering image ${i+1} / ${tiles.length}…`);await yieldUI();
      }
      check(signal);view.panX/=ss;view.panY/=ss;view.display.imageSampleScale=1;
      if(o.type!=='blueprint'&&p.vignetteEnabled&&p.vignetteStrength>0){
        const radius=Math.hypot(o.width,o.height)/2,gradient=ctx.createRadialGradient(o.width/2,o.height/2,radius*.25,o.width/2,o.height/2,radius);
        gradient.addColorStop(0,'#0000');gradient.addColorStop(1,`rgba(0,0,0,${p.vignetteStrength})`);ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=gradient;ctx.fillRect(0,0,o.width,o.height);ctx.restore();
      }
      if(o.overlays)drawSymmetryPlanes(ctx,snapshot.scene,view,o.width,o.height);
      if(o.dimensions){
        const scale=o.type==='blueprint'?Math.min(o.width,o.height)/800:Math.min(o.width/snapshot.size.width,o.height/snapshot.size.height);
        const annotationView={...view,panX:view.panX/scale,panY:view.panY/scale};
        ctx.save();ctx.scale(scale,scale);drawDimensions(ctx,snapshot.scene,annotationView,o.width/scale,o.height/scale,{...p,imageExportDimensions:true,imageExportTitle:o.type==='blueprint'&&o.titleBlock,imageDimensionFontSize:o.type==='blueprint'?(settings.dimensionFontSize??12):12});ctx.restore();
      }
      if(o.type!=='blueprint')drawCapturedOverlays(ctx,overlays,o,snapshot.size,o.width,o.height,view,snapshot);
      if(o.type==='blueprint'&&!multi&&settings.name){
        const unit=Math.min(o.width,o.height)/800;ctx.save();ctx.fillStyle='#b8e0ff';ctx.font=`${14*unit}px monospace`;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(settings.name,20*unit,20*unit,o.width-40*unit);ctx.restore();
      }
      if(o.type==='blueprint'&&!o.blueprintEditing)drawBlueprintAnnotations(ctx,settings,o.width,o.height);
      ctx.restore();releaseViewportResources(view);
      if(multi){
        ctx.fillStyle='#b8e0ff';ctx.font=`${Math.max(1,Math.round(panel.label*.55))}px monospace`;ctx.textAlign='center';
        ctx.fillText(panel.name??(panel.orientation?'CUSTOM':panel.camera.toUpperCase()),panel.x+panel.width/2,panel.y+panel.height+panel.label*.75,panel.width);ctx.textAlign='start';
      }
    }
    if(o.type==='blueprint')drawBlueprintPage(ctx,o,snapshot,o.width,o.height,true);
    if(!encode)return {canvas,width:o.width,height:o.height};
    onProgress(90,'Encoding image…');check(signal);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image encoding failed. Reduce resolution or choose PNG.')),IMAGE_FORMATS[o.format],o.quality));
    check(signal);if(blob.type!==IMAGE_FORMATS[o.format])throw Error(`This browser does not support ${o.format.toUpperCase()} encoding. Choose PNG.`);
    onProgress(100,'Image ready.');return {blob,canvas,name:imageFilename(snapshot.scene.model.fileName,o.type,o.format),width:o.width,height:o.height,estimatedBytes:plan.estimatedBytes};
  }finally{target?.dispose();for(const view of views)releaseViewportResources(view);if(acquired)endImageRender(owner,lastView);}
}
