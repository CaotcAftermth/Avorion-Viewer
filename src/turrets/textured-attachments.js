import {buildTexturedModel} from '../avorion/lib/geometry/texturedModel.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
import {textureLibrary} from '../avorion/lib/textures/textureLibrary.js';
import {makeModel} from '../block-model.js';
let textureRevision=0;
textureLibrary.subscribe(()=>textureRevision++);
const displayUniforms=['uXray','uCull','uBlueprint','uLineScale','uDisplayMode','uMatcap','uAmbientOnly','uAmbientDetail','uWireOverlay','uWireThreshold','uWireOpacity','uExposure','uDebug','uWindowColor','uWindowStrength'];
export function disposeAttachmentTextures(holder){
 const entry=holder.userData.texturedAttachment;
 if(entry){entry.rendered.group.removeFromParent();entry.rendered.dispose();delete holder.userData.texturedAttachment;}
}
export function syncAttachmentTextures(group,scene,view,configureDepth,options){
 for(const holder of group.children){
  const entry=holder.userData.renderEntry;if(!entry||entry.ghost)continue;
  let cached=holder.userData.texturedAttachment;
  if(cached?.revision!==textureRevision){
   disposeAttachmentTextures(holder);
   const model=makeModel(entry.asset.blocks,entry.asset.name),rendered=buildTexturedModel(model,defaultOrientationProfile(),options.params);
   rendered.setBlockTransforms(new Map(entry.asset.blocks.map(block=>[block.id,entry.matrices[entry.asset.parts?.[block.id]||'base']])));
   for(const material of rendered.materials)configureDepth(material);
   Object.assign(rendered.group.userData,{mountId:holder.userData.mountId,componentMountId:holder.userData.componentMountId,socketId:holder.userData.socketId,blockId:holder.userData.blockId});
   holder.add(rendered.group);cached={rendered,revision:textureRevision};holder.userData.texturedAttachment=cached;
  }
  const {rendered}=cached;
  for(const child of holder.children)child.visible=child===rendered.group;
  rendered.setParams(options.params);rendered.setTime(options.time);
  const selected=view.display?.showOverlays!==false&&!view.display?.blueprint&&(holder.userData.mountId&&(scene.selectedTurretIds?.has(holder.userData.mountId)||scene.selectedTurretId===holder.userData.mountId)||holder.userData.componentMountId===scene.selectedComponentMountId&&!!scene.selectedComponentMountId);
  rendered.setSelection(selected?entry.asset.blocks.map(b=>b.id):[]);
  for(const material of rendered.materials){
   const uniforms=material.uniforms;
   for(const name of displayUniforms){const source=options.uniforms?.[name];if(!source||!uniforms[name])continue;const target=uniforms[name];if(target.value?.copy)target.value.copy(source.value);else target.value=source.value;}
   uniforms.uSelectColor.value.setRGB(.55,1,.04);
   material.userData.originalTransparent??=material.transparent;
   material.transparent=!view.display?.blueprint&&(material.userData.originalTransparent||uniforms.uXray.value>=0);
   material.depthWrite=!material.transparent;
   const side=material.userData.hardwareCull&&view.display?.backfaceCulling!==false?0:2;
   if(material.side!==side){material.side=side;material.needsUpdate=true;}
   material.wireframe=!view.display&&!!view.wire;
  }
  for(const child of rendered.group.children)if(child.userData.blockEffects)child.visible=view.display?.shading==='RENDERED'&&!view.display?.blueprint;
 }
 group.userData.prepare=camera=>{for(const holder of group.children)holder.userData.texturedAttachment?.rendered.prepare(camera);};
}
