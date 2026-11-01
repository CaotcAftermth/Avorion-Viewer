// Appearance edits preserve block identity and XML, without invalidating geometry.
import {getShadingSpec} from './avorion/lib/textures/shadingMap.js';
const indices=new WeakMap();
export function blockIndex(model){
  let entry=indices.get(model);
  if(!entry||entry.blocks!==model.blocks||entry.count!==model.blocks.length){entry={blocks:model.blocks,count:model.blocks.length,byId:new Map(model.blocks.map(b=>[b.id,b]))};indices.set(model,entry);}
  return entry.byId;
}
export function secondaryColor(block){return Object.hasOwn(block,'secondaryColor')?block.secondaryColor:block.el?.getAttribute('secondaryColor')??block.unknownAttrs?.secondaryColor;}
export function applyBlockColors(scene,changes,{writeXml=true}={}){
  const index=blockIndex(scene.model),patches=[];
  // Validate the entire transaction before modifying any block.
  for(const change of changes)for(const channel of ['color','secondaryColor'])if(Object.hasOwn(change,channel)&&!(channel==='secondaryColor'&&change[channel]===undefined)&&!/^([a-f0-9]{8})$/i.test(change[channel]))throw new Error('Colors must be eight ARGB hexadecimal digits.');
  for(const change of changes){
    const b=index.get(change.id);if(!b)continue;const before={id:b.id},after={id:b.id};let modified=false;
    for(const channel of ['color','secondaryColor']){
      if(!Object.hasOwn(change,channel))continue;
      const old=channel==='color'?b.color:secondaryColor(b),value=change[channel]?.toLowerCase();if(old===value)continue;
      // Crossing opaque/translucent hologram alpha requires batch reclassification.
      if(channel==='color'&&getShadingSpec(b.typeIndex).surface==='hologram'&&old?.startsWith('ff')!==value?.startsWith('ff'))scene.revision=(scene.revision||0)+1;
      before[channel]=old;after[channel]=value;modified=true;
      if(value===undefined){if(writeXml)delete b[channel];else b[channel]=undefined;if(writeXml)b.el?.removeAttribute(channel);}else{b[channel]=value;if(writeXml)b.el?.setAttribute(channel,value);}
      if(!writeXml){scene.model.colorOverrides??=new Map();scene.model.colorOverrides.set(b.id,(scene.model.colorOverrides.get(b.id)||0)|(channel==='color'?1:2));}
      if(channel==='secondaryColor'){b.unknownAttrs??={};if(value===undefined)delete b.unknownAttrs.secondaryColor;else b.unknownAttrs.secondaryColor=value;}
    }
    if(modified){patches.push({before,after});(scene.appearanceDirty??=new Set()).add(b.id);}
  }
  if(patches.length)scene.appearanceRevision=(scene.appearanceRevision||0)+1;
  return patches;
}
