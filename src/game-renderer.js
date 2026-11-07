import { thrusterDirectionVectors } from './thruster-settings.js';
import {socketToolActive} from './interaction-modes.js';
import {createSelectionOutline} from './selection-outline.js';
import {presentation} from './turrets/showcase.js';
import {WeaponEffectsRenderer} from './turrets/effect-renderer.js';
import {syncAssetGuides,releaseAssetGuides} from './turrets/asset-guides.js';
import {syncTurrets,pickMountedTurret,pickMountedComponent} from './turrets/render.js';
import {syncCoverage,pickCoverage,releaseCoverage} from './turrets/coverage-render.js';
import {coverageOptions} from './turrets/coverage-sampling.js';
import * as THREE from './vendor/three.module.js';
import { buildTexturedModel } from './avorion/lib/geometry/texturedModel.js';
import { defaultOrientationProfile } from './avorion/lib/avorion/orientation.js';
import { DEFAULT_GAME_SHADER } from './avorion/lib/geometry/gameShader.js';
import { textureLibrary } from './avorion/lib/textures/textureLibrary.js';
import { basis, metrics } from './navigation.js';
import { viewToNative } from './block-model.js';
import { editorTheme, THEMES, FACTORY_PREFERENCES } from './preferences.js';
import { liveBlocks, simplified, viewportHiddenIds, engineEffectHiddenIds } from './ship-structure.js';
import { regionHighlightIds, regionHighlightColor } from './region-display.js';
import { viewportPreferences } from './viewport-options.js';
import { createViewportPost, bloomActive, aoActive } from './viewport-post.js';
import {prepareLargeModel} from './model-preparation.js';
import {createWorldGuides} from './world-guides.js';
import { createSkybox } from './skybox.js';
import {createBlockBoundsOverlay,createDimensionCage} from './model-overlays.js';
import { reportError } from './app-log.js';
export { textureLibrary };

// One GPU context/model shared by all tiled viewports. Each viewport copies its
// completed frame into its interaction canvas, so splitting cannot exhaust contexts.
let renderer, world, grid, rendered, source, depthModel, revision=-1, error, simpleMode=false, liveCount=-1;
let turretBounds,studioTarget,studioEffects;
let axes=[],guides,shadowTarget,glassTarget,skybox,pendingBuild;
const viewportPosts=new Map();
let selectionOutline;

const boundsOverlays=new Map();let activeBounds=null;let dimensionCage;
const paintPreviews=new WeakMap();
export function setPaintPreview(view,ids=[],locked=false){
  const previous=paintPreviews.get(view),next=new Set(ids);
  if(previous&&previous.locked===locked&&previous.ids.size===next.size&&[...next].every(id=>previous.ids.has(id)))return;
  paintPreviews.set(view,{ids:next,locked});
}
export function releaseViewportResources(view){viewportPosts.get(view)?.dispose();viewportPosts.delete(view);paintPreviews.delete(view);const bounds=boundsOverlays.get(view);if(bounds){world?.remove(bounds.object);if(activeBounds===bounds.object)activeBounds=null;bounds.dispose();boundsOverlays.delete(view);}}
const sunCamera=new THREE.OrthographicCamera(),shadowMatrix=new THREE.Matrix4();
const perspective=new THREE.PerspectiveCamera(),orthographic=new THREE.OrthographicCamera();
const raycaster=new THREE.Raycaster();
const useLogDepth={value:0};
const emptySelection=new Set();
const frameTimes=new WeakMap();
export const viewportFrameTime=view=>frameTimes.get(view);
let exportOwner=null,exportReusable=null;
export const imageRenderBusy=()=>!!exportOwner;
export function imageRenderLimits(){initialize();return {maxTextureSize:renderer.capabilities.maxTextureSize,maxRenderbufferSize:renderer.getContext().getParameter(renderer.getContext().MAX_RENDERBUFFER_SIZE)};}
export async function beginImageRender(owner,signal){
  if(exportOwner)throw Error("Another image export is running.");
  initialize();exportOwner=owner;
  let abort;
  try{await Promise.race([Promise.all([textureLibrary.queue,textureLibrary.scanPromise,skybox.ready]),new Promise((resolve,reject)=>{abort=()=>reject(new DOMException('Image export cancelled.','AbortError'));if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});})]);}
  catch(error){exportOwner=null;throw error;}finally{if(abort)signal?.removeEventListener('abort',abort);}
}
export function endImageRender(owner,view){
  if(exportOwner!==owner)return;
  try{
    releaseViewportResources(view);
    if(exportReusable){
      source=exportReusable.source;revision=exportReusable.revision;depthModel=exportReusable.depthModel;
      rendered.appearanceRevision=exportReusable.appearanceRevision;
      for(const m of rendered.materials){m.uniforms.uMaskPass.value=0;m.uniforms.uDepthPass.value=0;m.colorWrite=true;m.depthWrite=!m.transparent;}
    }else releaseGameModel();
    glassTarget?.dispose();glassTarget=null;renderer.setRenderTarget(null);renderer.setClearAlpha(1);
  }finally{exportReusable=null;exportOwner=null;window.dispatchEvent(new Event("avorion-model-ready"));}
}
export function createImageTarget(w,h){initialize();const target=new THREE.WebGLRenderTarget(w,h);target.samples=Math.min(4,renderer.capabilities.maxSamples||0);return target;}
export function readImageTarget(target){if(renderer.getContext().isContextLost())throw Error("Graphics context lost during export. Reload the viewer and try a smaller image.");renderer.setRenderTarget(null);const pixels=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);const gl=renderer.getContext(),error=gl.getError();if(error!==gl.NO_ERROR)throw Error("GPU image readback failed ("+error+"). Reduce resolution, supersampling, or effects.");return pixels;}
const depthConfigured=new WeakSet();
function configureDepth(material,slopeBias=false){
  // Instanced batches share materials; wrapping twice redeclares shader uniforms.
  if(depthConfigured.has(material))return;depthConfigured.add(material);
  const beforeCompile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    beforeCompile.call(material,shader);
    shader.uniforms.uUseLogDepth=useLogDepth;
    // Every block is its own box, so the faces where two blocks touch end a
    // fraction of a pixel under the neighbouring outer surface and z-fight
    // through it along every seam while rotating. A slope-scaled bias on faces
    // fully covered by neighbours keeps them behind; outer surfaces are not biased.
    shader.fragmentShader='uniform float uUseLogDepth;\n'+shader.fragmentShader.replace('#include <logdepthbuf_fragment>',`
      float fragmentDepth=gl_FragCoord.z;
      if(uUseLogDepth>.5){
        ${THREE.ShaderChunk.logdepthbuf_fragment.replace('gl_FragDepth =','fragmentDepth =')}
      }
      ${slopeBias?'fragmentDepth+=vSeamFace*8.*fwidth(fragmentDepth);':''}
      gl_FragDepth=fragmentDepth;
    `);
  };
}
const attachmentMasks=[0,1].map(selected=>{
  const material=new THREE.MeshBasicMaterial({toneMapped:false,side:THREE.DoubleSide});
  material.color.setRGB(selected,1,1);configureDepth(material);return material;
});
export function gameParams(p) {
  return {...DEFAULT_GAME_SHADER,lightAzimuth:p.shaderAzimuth,lightElevation:p.shaderElevation,
    lightIntensity:p.shaderDirectionalEnabled===false?0:p.shaderLight,ambientFillIntensity:p.shaderAmbientEnabled===false?0:p.shaderAmbient,specularity:p.shaderSpecular,
    glossyness:2/(p.shaderRoughness*p.shaderRoughness),lightColor:p.shaderLightColor,
    ambientFillColor:p.shaderAmbientColor,ambientIntensity:p.shaderSkyEnabled===false?0:p.shaderSkyAmbient,
    minReflectivity:p.shaderMinReflection,maxReflectivity:Math.max(p.shaderMinReflection,p.shaderMaxReflection),
    normalStrength:p.shaderNormal,glowStrength:p.shaderGlow,hologramGlow:p.shaderHologramGlow??1.5,tileScale:p.shaderTileScale,
    engineState:p.shaderEngineState??0,thrustPreview:p.shaderThrust,thrustDirections:thrusterDirectionVectors(p),plumeLength:[0,p.shaderCruiseLength??4,p.shaderBoostLength??8.25][p.shaderEngineState??0]??0,barrierStrength:p.shaderBarrier,shadowStrength:0,bloomStrength:0,
    spillStrength:p.shaderSpill??0,spillRadius:p.shaderSpillRadius??5};
}
function initialize() {
  if(renderer)return;
  if(error)throw error;
  try{
    // Near-plane tightening cannot help when the camera is inside ship bounds.
    // Preserve thin surface separation at close range without moving Clip Start.
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,logarithmicDepthBuffer:true});
    renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
    // three.js handles restoring; the app offers crash recovery (crash-guard.js).
    renderer.domElement.addEventListener('webglcontextlost',()=>window.dispatchEvent(new Event('avorion-context-lost')));
    world=new THREE.Scene();guides=createWorldGuides();grid=guides.grid;axes=guides.axes;world.add(grid,...axes);
    skybox=createSkybox(()=>window.dispatchEvent(new Event('avorion-sky-ready')));
    shadowTarget=new THREE.WebGLRenderTarget(2048,2048);shadowTarget.depthTexture=new THREE.DepthTexture(2048,2048,THREE.UnsignedIntType);
  }catch(cause){error=new Error('WebGL2 unavailable. '+cause.message);throw error;}
}
function installModel(next){
  rendered=next;world.add(rendered.group);
      for(const mesh of rendered.group.children)if(mesh.material)configureDepth(mesh.material,!!mesh.userData.textured);
      const bounds=new THREE.Box3();
      for(const mesh of rendered.group.children){
        const geometry=mesh.geometry;if(!geometry?.getAttribute('position')?.count)continue;
        if(!mesh.userData.instanced)geometry.computeBoundingBox();bounds.union(geometry.boundingBox);
        // Light sprites use aRoot plus camera-facing vertex offsets.
        const roots=geometry.getAttribute('aRoot');if(roots?.count)bounds.union(new THREE.Box3().setFromBufferAttribute(roots).expandByScalar(1));
      }
      depthModel=bounds.isEmpty()?source:{bounds:{min:bounds.min,max:bounds.max}};
}
function prepare(scene,p,view) {
  initialize();
  const simple=simplified(scene,p),count=liveBlocks(scene).length;
  // Reuse the visible GPU model only when the captured model and appearance revisions match.
  if(exportOwner&&!exportReusable&&rendered&&!pendingBuild&&source===scene.imageSourceModel&&revision===scene.imageSourceRevision&&rendered.appearanceRevision===scene.imageSourceAppearanceRevision&&!scene.imageSourceDirty&&simpleMode===simple&&liveCount===count){
    exportReusable={source,revision,depthModel,appearanceRevision:rendered.appearanceRevision};source=scene.model;revision=scene.revision;
  }
  if(source!==scene.model||revision!==scene.revision||simpleMode!==simple||liveCount!==count){
    if(rendered){world.remove(rendered.group);rendered.dispose();rendered=null;}
    source=scene.model;revision=scene.revision;simpleMode=simple;liveCount=count;
    pendingBuild?.cancel();pendingBuild=null;depthModel=source;scene.renderPreparing=false;scene.renderError=null;
    if(source){
      const params={...gameParams(p),simplified:simple,...(source.imageShipName?{shipName:source.imageShipName}:{})};
      if((simple||exportOwner)&&count>=10000&&typeof Worker!=='undefined'){
        const model=source,job=prepareLargeModel(model,liveBlocks(scene),params);pendingBuild=job;scene.renderPreparing=true;
        job.promise.then(prepared=>{
          if(pendingBuild!==job)return;
          installModel(buildTexturedModel(model,defaultOrientationProfile(),{...params,prepared}));
          pendingBuild=null;scene.renderPreparing=false;window.dispatchEvent(new Event('avorion-model-ready'));
        }).catch(cause=>{
          if(pendingBuild!==job)return;
          console.warn('Background model preparation failed; using synchronous fallback.',cause);
          pendingBuild=null;scene.renderPreparing=false;
          try{installModel(buildTexturedModel(model,defaultOrientationProfile(),params));}catch(error){scene.renderError=error.message;reportError(error,'RENDER');}
          window.dispatchEvent(new Event('avorion-model-ready'));
        });
      }else installModel(buildTexturedModel(source,defaultOrientationProfile(),params));
    }
  }

  if(!rendered)return;
  if(scene.blockTransforms&&rendered.blockTransforms!==scene.blockTransforms){rendered.setBlockTransforms(scene.blockTransforms);rendered.blockTransforms=scene.blockTransforms;rendered.shadowKey=null;}
  if(rendered.appearanceRevision!==scene.appearanceRevision){
    if(scene.appearanceDirty?.size)rendered.updateColors(scene.model,scene.appearanceDirty);
    rendered.appearanceRevision=scene.appearanceRevision;scene.appearanceDirty?.clear();
  }
  rendered.group.visible=scene.loaded&&scene.visible;
  rendered.setParams(gameParams(p));
  const selectedIds=socketToolActive(view)||scene.turretDragging?emptySelection:view.display?.showOverlays===false||(view.display?.shadeSelected===false&&view.display?.outlineSelected!==true)?emptySelection:scene.selectedIds||emptySelection;
  if(rendered.selection!==selectedIds){rendered.setSelection(selectedIds);rendered.selection=selectedIds;}
  const regionIds=socketToolActive(view)||scene.turretDragging||view.display?.showOverlays===false||view.display?.shadeSelected===false?emptySelection:regionHighlightIds(scene);
  if(rendered.regionHighlight!==regionIds){rendered.setRegion(regionIds);rendered.regionHighlight=regionIds;}
  const preview=paintPreviews.get(view),hovered=preview?.ids||emptySelection;
  if(rendered.paintPreview!==hovered){rendered.setPaintPreview(hovered);rendered.paintPreview=hovered;}
  const hiddenIds=viewportHiddenIds(scene,view);
  if(rendered.hidden!==hiddenIds){rendered.setHidden(hiddenIds);rendered.hidden=hiddenIds;rendered.shadowKey=null;}
  rendered.setEffectHidden(engineEffectHiddenIds(scene,view,p.shaderThinEnginePlumes!==false));
  for(const material of rendered.materials){
    const d=view.display,u=material.uniforms;
    u.uShadeSelected.value=d?.shadeSelected===false?0:1;
    const side=material.userData.hardwareCull&&view.display?.backfaceCulling!==false?THREE.FrontSide:THREE.DoubleSide;
    if(material.side!==side){material.side=side;material.needsUpdate=true;}
    material.userData.originalTransparent??=material.transparent;
    const xray=d?.xray&&['SOLID','WIREFRAME'].includes(d.shading);
    material.transparent=!d?.blueprint&&(material.userData.originalTransparent||!!xray);
    material.depthWrite=!material.transparent;
    u.uXray.value=xray?d.xrayAlpha:-1;u.uCull.value=d?.backfaceCulling===false?0:1;
    u.uBlueprint.value=d?.blueprint?1:0;u.uLineScale.value=d?.imageSampleScale||1;
    u.uDisplayMode.value=d?.shading==='SOLID'?1:(d?.shading==='WIREFRAME'?2:0);
    u.uMatcap.value=d?.lighting==='MATCAP'?1:0;u.uAmbientOnly.value=d?.ambientOnly?1:0;u.uAmbientDetail.value=d?.ambientDetail??.35;
    u.uWireOverlay.value=d?.showOverlays&&d.wireOverlay?1:0;u.uWireThreshold.value=d?.wireThreshold??1;u.uWireOpacity.value=d?.wireOpacity??1;
    material.uniforms.uSelectColor.value.setStyle(editorTheme(p,'viewport').accent,THREE.LinearSRGBColorSpace);
    const mirror=view.paint,showMirror=view.interactionMode==='paint'&&view.display?.showOverlays!==false;
    u.uMirrorOrigin.value.set(...['x','y','z'].map(a=>mirror?.origin?.[a]||0));
    u.uMirrorVisible.value.set(...['x','y','z'].map(a=>showMirror&&mirror?.symmetry?.[a]&&mirror?.planeVisible?.[a]!==false?1:0));
    material.uniforms.uRegionColor?.value.setStyle(regionHighlightColor(scene),THREE.LinearSRGBColorSpace);
    material.uniforms.uPaintColor.value.setStyle(preview?.locked?'#f1a777':'#80c6ff',THREE.LinearSRGBColorSpace);
    material.uniforms.uExposure.value=2**p.shaderExposure;
    material.uniforms.uDebug.value=p.shaderDebug;
    material.uniforms.uWindowColor.value.setStyle(p.shaderWindowColor,THREE.LinearSRGBColorSpace);
    material.uniforms.uWindowStrength.value=p.shaderWindows;
  }
  const time=view.imageTime??performance.now()/1000;rendered.setTime(time);if(!exportOwner)frameTimes.set(view,time);
}
export function sceneClipRange(model,view,width,height,p){
  const requested={near:p.clipStart??.05,far:p.clipEnd??1000000};
  if(!model?.bounds)return requested;
  const {min,max}=model.bounds;
  const center=['x','y','z'].map(a=>(min[a]+max[a])/2);

  const back=viewToNative(basis(view).back),target=viewToNative(view.target);
  const radius=['x','y','z'].reduce((sum,a,i)=>sum+Math.abs(back[i])*(max[a]-min[a])/2,0)+2;
  const distance=metrics(view,width,height).distance;
  const depth=distance-center.reduce((sum,v,i)=>sum+(v-target[i])*back[i],0);
  let low=depth-radius,high=depth+radius;
  if(view.display?.showOverlays!==false&&(view.grid||view.display?.axisX||view.display?.axisY||view.display?.axisZ)){const gridDepth=distance+target.reduce((sum,v,i)=>sum+v*back[i],0),extent=50*(view.display?.gridScale??1);low=Math.min(low,gridDepth-extent);high=Math.max(high,gridDepth+extent);}
  const near=Math.max(requested.near,low),far=Math.min(requested.far,high);
  return Number.isFinite(near)&&Number.isFinite(far)&&near<far?{near,far}:requested;
}
function cameraFor(view,width,height,p=FACTORY_PREFERENCES){
  p=viewportPreferences(p,view);
  const b=basis(view),m=metrics(view,width,height),camera=view.projection==='perspective'?perspective:orthographic;
  const back=new THREE.Vector3(...viewToNative(b.back)),up=new THREE.Vector3(...viewToNative(b.up)),right=new THREE.Vector3(...viewToNative(b.right));
  if(camera.view?.enabled)camera.clearViewOffset();
  camera.position.set(...viewToNative(view.target)).addScaledVector(back,m.distance);
  camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));
  let clipModel=depthModel;if(depthModel?.bounds&&turretBounds&&!turretBounds.isEmpty()){const bounds={min:{},max:{}};for(const axis of ['x','y','z']){bounds.min[axis]=Math.min(depthModel.bounds.min[axis],turretBounds.min[axis]);bounds.max[axis]=Math.max(depthModel.bounds.max[axis],turretBounds.max[axis]);}clipModel={bounds};}
  const clipping=sceneClipRange(clipModel,view,width,height,p);camera.near=clipping.near;camera.far=clipping.far;
  if(camera===perspective){camera.fov=2*Math.atan(height/(2*m.focal))*180/Math.PI;camera.aspect=width/height;}
  else{camera.left=-width/(2*m.scale);camera.right=-camera.left;camera.top=height/(2*m.scale);camera.bottom=-camera.top;}
  camera.updateProjectionMatrix();
  if(camera===perspective){camera.projectionMatrix.elements[8]=-2*view.panX/width;camera.projectionMatrix.elements[9]=2*view.panY/height;}
  else{camera.projectionMatrix.elements[12]=2*view.panX/width;camera.projectionMatrix.elements[13]=-2*view.panY/height;}
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld();return camera;
}
let themeGradient;
function themeGradientBackground(top,bottom){
  if(themeGradient?.top===top&&themeGradient.bottom===bottom)return themeGradient.texture;
  themeGradient?.texture.dispose();
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=256;
  const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,canvas.height);
  gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
  // The game renderer writes display-ready colors without an sRGB output conversion.
  // Keep the canvas gradient bytes in the same space as solid theme backgrounds.
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.NoColorSpace;
  themeGradient={top,bottom,texture};return texture;
}
export function drawGame(ctx,scene,view,width,height,p,dpr,crop=null,output=null) {
  if(exportOwner&&output?.owner!==exportOwner)return false;
  if(scene.turretStudio?.settings.showcase?.camera&&scene.turretStudio.settings.showcase.camera!=='manual')p=presentation(view,p,scene.turretStudio.settings.showcase).preferences;
  p=viewportPreferences(p,view);
  prepare(scene,p,view);
  if(output&&(!rendered||scene.renderPreparing)){if(scene.renderError)throw Error(scene.renderError);return false;}
  if(scene.turretStudio&&!studioTarget){studioTarget=new THREE.Mesh(new THREE.SphereGeometry(.75,16,12),new THREE.MeshBasicMaterial({color:0xff55cc,wireframe:true}));world.add(studioTarget);}
  if(studioTarget){studioTarget.visible=!!scene.turretStudio&&scene.turretStudio.settings.targetVisible!==false&&scene.turretStudio.sequenceTargetVisible!==false&&(!output||output.studioEffects)&&!crop&&scene.visible; if(scene.turretStudio)studioTarget.position.fromArray(scene.turretStudio.target);}
  if(scene.turretStudio&&!studioEffects){studioEffects=new WeaponEffectsRenderer(configureDepth);world.add(studioEffects.group);}
  studioEffects?.update(scene.turretStudio,(!output||output.studioEffects)&&!crop&&scene.visible&&!view.display?.blueprint);
  syncAssetGuides(world,scene,!output&&!crop&&view.display?.showOverlays!==false);
  const turretGroup=syncTurrets(world,scene,view,configureDepth,{params:gameParams(p),uniforms:rendered?.materials[0]?.uniforms,time:view.imageTime??performance.now()/1000});turretBounds=turretGroup.userData.bounds;
  const coverageGroup=syncCoverage(world,scene,view,configureDepth,!!output||!!crop);
  if(coverageGroup.visible&&coverageGroup.userData.bounds)turretBounds=turretBounds.clone().union(coverageGroup.userData.bounds);
  const camera=cameraFor(view,width,height,p),theme=THEMES[p.theme];turretGroup.userData.prepare?.(camera);
  if(studioEffects?.group.visible){const offsets=[8,9,12,13].map(i=>camera.projectionMatrix.elements[i]);camera.far=Math.max(camera.far,camera.position.length()+(scene.turretStudio.effects.profile?.range||0)+100);camera.updateProjectionMatrix();[8,9,12,13].forEach((n,i)=>camera.projectionMatrix.elements[n]=offsets[i]);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
  if(output?.tile){
    const t=output.tile,transform=new THREE.Matrix4().set(width/t.width,0,0,(width-2*t.x-t.width)/t.width,0,height/t.height,0,(2*t.y+t.height-height)/t.height,0,0,1,0,0,0,0,1);
    camera.projectionMatrix.premultiply(transform);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  if(crop){camera.setViewOffset(width,height,crop.x-crop.size/(2*crop.zoom)-view.panX,crop.y-crop.size/(2*crop.zoom)-view.panY,crop.size/crop.zoom,crop.size/crop.zoom);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
  // Tight clip ranges resolve even closer surfaces with conventional depth.
  // Switch every material together for each viewport, including grid/effects.
  useLogDepth.value=camera.isPerspectiveCamera&&camera.far/camera.near>100?1:0;
  const d=view.display;
  if(!dimensionCage){dimensionCage=createDimensionCage();configureDepth(dimensionCage.object.material);world.add(dimensionCage.object);}
  dimensionCage.object.visible=!!(!crop&&scene.loaded&&scene.visible&&d?.showOverlays&&d.showModelDimensions&&p.dimensionCage!==false);
  if(dimensionCage.object.visible)dimensionCage.update(scene);
  if(activeBounds){world.remove(activeBounds);activeBounds=null;}
  if(!crop&&scene.loaded&&scene.visible&&d?.showOverlays&&d.showBlockBounds){let bounds=boundsOverlays.get(view);if(!bounds){bounds=createBlockBoundsOverlay();configureDepth(bounds.object.material);boundsOverlays.set(view,bounds);}bounds.update(scene,view);activeBounds=bounds.object;world.add(activeBounds);}
  world.background=new THREE.Color().setStyle(d?.background==='VIEWPORT'?d.backgroundColor:d?.background==='WORLD'?DEFAULT_GAME_SHADER.skyHorizon:editorTheme(p,'viewport').background,THREE.LinearSRGBColorSpace);
  if((!d||d.background==='THEME')&&p.viewportGradient)world.background=themeGradientBackground(p.viewportGradientTop,editorTheme(p,'viewport').background);
  if(d?.background==='WORLD'&&p.worldEnabled){world.background=skybox.texture(renderer,p)||world.background;world.backgroundRotation.set(0,p.worldRotation*Math.PI/180,0);
    if(camera.isOrthographicCamera&&world.background.isCubeTexture)world.background=skybox.orthographicBackground(renderer,world.background,camera,Math.max(1,Math.round(width*dpr)),Math.max(1,Math.round(height*dpr)),metrics(view,width,height).focal*dpr,p.worldRotation*Math.PI/180,output?.tile);
  }
  if(output?.transparent)world.background=null;
  renderer.setClearAlpha(output?.transparent?0:1);
  guides.update(camera,view,output?.tile?.width||width,output?.tile?.height||height,theme,dpr*(d?.imageSampleScale||1),useLogDepth.value,output?{width:width/(d.imageSampleScale||1),height:height/(d.imageSampleScale||1)}:null);
  if(coverageGroup.visible){
    world.background=new THREE.Color().setStyle('#080f1b',THREE.LinearSRGBColorSpace);
    grid.visible=false;for(const axis of axes)axis.visible=false;
    dimensionCage.object.visible=false;if(activeBounds)activeBounds.visible=false;
  }
  if(rendered){for(const mat of rendered.materials)mat.wireframe=!d&&view.wire;rendered.group.children.filter(c=>c.userData.blockEffects).forEach(c=>c.visible=d?d.shading==='RENDERED'&&!d.blueprint:!view.wire);rendered.prepare(camera);}
  const shipVisible=rendered?.group.visible,turretsVisible=turretGroup.visible;
  if(scene.showFireCoverage&&!output&&!crop&&!coverageOptions(scene).showShip){if(rendered)rendered.group.visible=false;turretGroup.visible=false;}
  const outputWidth=output?.tile?.width||crop?.size||width,outputHeight=output?.tile?.height||crop?.size||height;
  const w=Math.max(1,Math.round(outputWidth*dpr)),h=Math.max(1,Math.round(outputHeight*dpr));
  if(!output&&(renderer.domElement.width<w||renderer.domElement.height<h))renderer.setSize(Math.max(w,renderer.domElement.width),Math.max(h,renderer.domElement.height),false);
  renderer.setViewport(0,0,w,h);
  if(d&&rendered&&d.shadows&&['SOLID','RENDERED'].includes(d.shading)&&depthModel?.bounds){
    const bounds=new THREE.Box3(new THREE.Vector3(...['x','y','z'].map(k=>depthModel.bounds.min[k])),new THREE.Vector3(...['x','y','z'].map(k=>depthModel.bounds.max[k])));
    const center=bounds.getCenter(new THREE.Vector3()),radius=Math.max(1,bounds.getSize(new THREE.Vector3()).length()/2);
    const direction=rendered.materials[0].uniforms.uLightDir.value;
    sunCamera.position.copy(center).addScaledVector(direction,-radius*2);sunCamera.up.set(0,Math.abs(direction.y)>.99?0:1,Math.abs(direction.y)>.99?1:0);sunCamera.lookAt(center);
    sunCamera.left=sunCamera.bottom=-radius;sunCamera.right=sunCamera.top=radius;sunCamera.near=.01;sunCamera.far=radius*4;sunCamera.updateProjectionMatrix();sunCamera.updateMatrixWorld();
    shadowMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(sunCamera.projectionMatrix).multiply(sunCamera.matrixWorldInverse);
    const shadowKey='shadow|'+direction.toArray().join(',')+'|'+d.backfaceCulling+'|'+rendered.group.visible;
    if(rendered.shadowKey!==shadowKey){
    const objects=[...(studioEffects?[studioEffects.group]:[]),...(studioTarget?[studioTarget]:[]),coverageGroup,turretGroup,grid,...axes,dimensionCage.object,...(activeBounds?[activeBounds]:[]),...rendered.group.children.filter(c=>c.userData.blockEffects)],visibility=objects.map(o=>o.visible);objects.forEach(o=>o.visible=false);
    const saved=useLogDepth.value;useLogDepth.value=0;
    for(const m of rendered.materials){m.uniforms.uShadowMap.value=null;m.uniforms.uDepthPass.value=1;m.depthWrite=true;}
    renderer.setRenderTarget(shadowTarget);renderer.render(world,sunCamera);renderer.setRenderTarget(null);
    for(const m of rendered.materials){m.uniforms.uDepthPass.value=0;m.depthWrite=!m.transparent;m.uniforms.uShadowMap.value=shadowTarget.depthTexture;m.uniforms.uShadowMatrix.value.copy(shadowMatrix);m.uniforms.uShadowStrength.value=d.shadowIntensity;}
    objects.forEach((o,i)=>o.visible=visibility[i]);useLogDepth.value=saved;
    rendered.shadowKey=shadowKey;
    }
    for(const m of rendered.materials){m.uniforms.uShadowMap.value=shadowTarget.depthTexture;m.uniforms.uShadowMatrix.value.copy(shadowMatrix);m.uniforms.uShadowStrength.value=d.shadowIntensity;}
  }
  renderGlassDepth(camera,w,h);
  const attachmentSelected=holder=>{const {mountId,componentMountId}=holder.userData;
    return !!(mountId&&(mountId===scene.selectedTurretId||scene.selectedTurretIds?.has(mountId))||
      componentMountId&&(componentMountId===scene.selectedComponentMountId||scene.selectedComponentMountIds?.has(componentMountId)));
  };
  const showAttachmentSelection=turretGroup.visible&&turretGroup.children.some(holder=>holder.visible&&attachmentSelected(holder));
  let outlineMask=null;
  const selected=!socketToolActive(view)&&!scene.turretDragging&&!!d&&d.showOverlays&&d.outlineSelected&&(scene.selectedIds?.size||scene.selected||showAttachmentSelection);
  const ambientCavity=!!d&&d.ambientOnly&&(d.ambientDetail??.35)>0&&d.shading!=='WIREFRAME'&&!d.xray&&p.shaderDebug===0;
  if(d&&!coverageGroup.visible&&(ambientCavity||d.objectOutline||selected||d.dof&&d.shading==='RENDERED'||bloomActive(d,p)||aoActive(d,p))){
    // Half-float scene color keeps emission above 1.0 for bloom.
    let post=viewportPosts.get(view);if(!post){post=createViewportPost(Math.min(4,renderer.capabilities.maxSamples||0),renderer.extensions.has('EXT_color_buffer_float'));viewportPosts.set(view,post);}
    post.resize(w,h);renderer.setRenderTarget(post.target);renderCoverageScene(camera,coverageGroup);
    if(selected||d.objectOutline||ambientCavity||aoActive(d,p)){
      const objects=[...(studioEffects?[studioEffects.group]:[]),...(studioTarget?[studioTarget]:[]),coverageGroup,grid,...axes,dimensionCage.object,...(activeBounds?[activeBounds]:[]),...(rendered?.group.children||[]).filter(c=>c.userData.blockEffects)],visibility=objects.map(o=>o.visible);objects.forEach(o=>o.visible=false);
      const background=world.background;world.background=new THREE.Color(0);
      for(const m of rendered?.materials||[]){m.uniforms.uMaskPass.value=1;m.transparent=false;m.depthWrite=true;}
      const attachmentMaterials=new Map();
      const attachmentOverlays=[];
      turretGroup.traverseVisible(object=>{
        if(object.isLine||object.userData.renderEntry?.ghost){attachmentOverlays.push(object);object.visible=false;return;}
        if(!object.isMesh)return;
        attachmentMaterials.set(object,object.material);
        object.material=attachmentMasks[Number(attachmentSelected(object.parent))];
      });
      try{renderer.setRenderTarget(post.mask);renderer.render(world,camera);outlineMask=post.mask;}
      finally{
        for(const [mesh,material] of attachmentMaterials)mesh.material=material;
        attachmentOverlays.forEach(object=>object.visible=true);
      }
      for(const m of rendered?.materials||[]){m.uniforms.uMaskPass.value=0;m.transparent=!d.blueprint&&(m.userData.originalTransparent||!!(d.xray&&['SOLID','WIREFRAME'].includes(d.shading)));m.depthWrite=!m.transparent;}
      world.background=background;objects.forEach((o,i)=>o.visible=visibility[i]);
    }
    const barriers=rendered?.group.children.filter(o=>o.visible&&o.userData.hangarBarrier)||[];
    const withoutBarrier=barriers.length?()=>{
      for(const o of barriers)o.material.uniforms.uBloomPass.value=1;
      try{renderCoverageScene(camera,coverageGroup);}finally{for(const o of barriers)o.material.uniforms.uBloomPass.value=0;}
    }:null;
    post.draw(renderer,camera,d,useLogDepth.value,p,selected&&showAttachmentSelection,output?.target||null,output,withoutBarrier);
  }else{renderer.setRenderTarget(output?.target||null);renderCoverageScene(camera,coverageGroup);}
  if(selected&&rendered&&scene.loaded&&scene.visible){
    selectionOutline??=createSelectionOutline();selectionOutline.update(scene,view,rendered,viewportHiddenIds(scene,view));
    selectionOutline.draw(renderer,camera,w,h,outputWidth,p.accent,p.outlineWidth,output?.target||null,outlineMask,useLogDepth.value);
  }
  if(!output)ctx.drawImage(renderer.domElement,0,renderer.domElement.height-h,w,h,0,0,outputWidth,outputHeight);
  if(rendered)rendered.group.visible=shipVisible;turretGroup.visible=turretsVisible;
  return true;
}
// Analysis is a diagram: draw its surface first and the ship over it, keeping
// the silhouette readable without modifying ship materials or obstacle tests.
function renderCoverageScene(camera,coverageGroup){
  if(!coverageGroup.visible){renderer.render(world,camera);return;}
  const visibility=world.children.map(o=>[o,o.visible]),background=world.background,autoClear=renderer.autoClear;
  try{
    for(const [o] of visibility)o.visible=o===coverageGroup;
    renderer.render(world,camera);
    for(const [o,visible] of visibility)o.visible=visible;
    coverageGroup.visible=false;world.background=null;renderer.autoClear=false;
    renderer.clearDepth();renderer.render(world,camera);
  }finally{
    for(const [o,visible] of visibility)o.visible=visible;
    world.background=background;renderer.autoClear=autoClear;
  }
}
// Glass is blended without writing depth, so a nearest-translucent depth map lets
// effects behind it draw before the glass (and be attenuated by it) while
// effects in front draw after it.
function renderGlassDepth(camera,w,h){
  if(!rendered)return;
  const effectsVisible=rendered.group.visible&&rendered.group.children.some(c=>c.userData.blockEffects&&c.visible);
  const translucent=effectsVisible?rendered.group.children.filter(c=>c.userData.translucent&&c.visible):[];
  if(!translucent.length){rendered.setGlassDepth(null,false);return;}
  if(!glassTarget){glassTarget=new THREE.WebGLRenderTarget(w,h);glassTarget.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType);}
  if(glassTarget.width!==w||glassTarget.height!==h)glassTarget.setSize(w,h);
  const materials=[...new Set(translucent.map(m=>m.material))],background=world.background,layers=camera.layers.mask;
  world.background=null;camera.layers.set(2);
  for(const m of materials){m.uniforms.uDepthPass.value=2;m.depthWrite=true;m.colorWrite=false;}
  renderer.setRenderTarget(glassTarget);renderer.render(world,camera);renderer.setRenderTarget(null);
  for(const m of materials){m.uniforms.uDepthPass.value=0;m.depthWrite=!m.transparent;m.colorWrite=true;}
  world.background=background;camera.layers.mask=layers;
  rendered.setGlassDepth(glassTarget.depthTexture,useLogDepth.value>.5);
}
export function pickGame(scene,view,width,height,x,y,p=FACTORY_PREFERENCES) {
  if(exportOwner||!rendered||!scene.visible||!scene.loaded )return null;
  const camera=cameraFor(view,width,height,p);
  const hiddenIds=viewportHiddenIds(scene,view);
  // A ray exactly on a shared vertex can miss every outward triangle after
  // float rounding. Match raster coverage with a subpixel fallback.
  for(const [dx,dy] of [[0,0],[.25,.25],[-.25,-.25]]){
  raycaster.setFromCamera(new THREE.Vector2((x+dx)/width*2-1,1-(y+dy)/height*2),camera);
  for(const hit of raycaster.intersectObjects(rendered.group.children.filter(c=>c.userData.textured),false)){
    const depth=-hit.point.clone().applyMatrix4(camera.matrixWorldInverse).z;
    if(depth<camera.near||depth>camera.far)continue;
    const vertex=hit.face.a;
    const flags=hit.object.geometry.getAttribute('aParams').getY(hit.instanceId??vertex);
    if(view.display?.backfaceCulling!==false&&!(Math.floor(flags)&32)&&hit.face.normal.dot(raycaster.ray.direction)>=0)continue;
    if(hit.blockId&&!hiddenIds.has(hit.blockId))return hit.blockId;
  }
  }
  return null;
}
export function releaseGameModel(){selectionOutline?.dispose();selectionOutline=null;studioEffects?.dispose();studioEffects=null;if(studioTarget){studioTarget.removeFromParent();studioTarget.geometry.dispose();studioTarget.material.dispose();studioTarget=null;}releaseAssetGuides();releaseCoverage();pendingBuild?.cancel();pendingBuild=null;if(rendered){world.remove(rendered.group);rendered.dispose();rendered=null;}for(const bounds of boundsOverlays.values()){world?.remove(bounds.object);bounds.dispose();}boundsOverlays.clear();activeBounds=null;if(dimensionCage){world?.remove(dimensionCage.object);dimensionCage.dispose();dimensionCage=null;}source=null;depthModel=null;revision=-1;}

export function socketExposed(scene,view,width,height,socket,p=FACTORY_PREFERENCES){
  if(!rendered||!scene.loaded||!scene.visible)return false;
  const camera=cameraFor(view,width,height,p),point=new THREE.Vector3(...socket.position),screen=point.clone().project(camera);
  raycaster.setFromCamera(new THREE.Vector2(screen.x,screen.y),camera);
  if(new THREE.Vector3(...socket.normal).dot(raycaster.ray.direction)>=-1e-6)return false;
  const hidden=viewportHiddenIds(scene,view);
  const hit=raycaster.intersectObjects(rendered.group.children.filter(c=>c.userData.textured),false).find(h=>!hidden.has(h.blockId));
  const tolerance=Math.max(1e-4,point.length()*1e-6);
  if(socket.type==='component')return !hit||hit.distance>=raycaster.ray.origin.distanceTo(point)-tolerance;
  // Thin-block filtering hides the body, not its attachment surface. Other visible
  // hull geometry must still occlude the socket; manual hiding remains authoritative.
  if(hidden.has(socket.blockId)&&!scene.hiddenIds?.has(socket.blockId))return !hit||hit.distance>=raycaster.ray.origin.distanceTo(point)-tolerance;
  return !!hit&&hit.blockId===socket.blockId&&hit.point.distanceTo(point)<tolerance;
}

// A mounted component under the cursor, unless the hull is in front of it.
export function pickComponent(scene,view,width,height,x,y,p){
 if(!scene.visible||!scene.loaded)return null;
 const camera=cameraFor(view,width,height,p);raycaster.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);
 const hit=pickMountedComponent(raycaster);if(!hit)return null;
 const hidden=viewportHiddenIds(scene,view),ship=rendered&&raycaster.intersectObjects(rendered.group.children.filter(c=>c.userData.textured),false).find(h=>!hidden.has(h.blockId));
 if(ship&&ship.distance<hit.distance-1e-4)return null;
 return hit.object.parent.userData;
}
// The block and world-space point under the cursor (for picking a face).
export function pickGamePoint(scene,view,width,height,x,y,p=FACTORY_PREFERENCES){
 if(exportOwner||!rendered||!scene.visible||!scene.loaded)return null;
 const camera=cameraFor(view,width,height,p),hiddenIds=viewportHiddenIds(scene,view);
 raycaster.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);
 for(const hit of raycaster.intersectObjects(rendered.group.children.filter(c=>c.userData.textured),false)){
  const depth=-hit.point.clone().applyMatrix4(camera.matrixWorldInverse).z;if(depth<camera.near||depth>camera.far)continue;
  if(hit.blockId&&!hiddenIds.has(hit.blockId))return {blockId:hit.blockId,point:hit.point.toArray(),direction:raycaster.ray.direction.toArray()};
 }
 return null;
}
export function pickTurret(scene,view,width,height,x,y,p){
 if(!scene.visible||!scene.loaded)return null;
 const camera=cameraFor(view,width,height,p);raycaster.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);
 const hit=pickMountedTurret(raycaster);if(!hit)return null;
 const hidden=viewportHiddenIds(scene,view),ship=rendered&&raycaster.intersectObjects(rendered.group.children.filter(c=>c.userData.textured),false).find(h=>!hidden.has(h.blockId));
 if(ship&&ship.distance<hit.distance-1e-4)return null;
 return hit.object.parent.userData;
}

export function pickWeaponCoverage(scene,view,width,height,x,y,p){
 const camera=cameraFor(view,width,height,p);raycaster.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);
 return pickCoverage(raycaster,scene);
}
