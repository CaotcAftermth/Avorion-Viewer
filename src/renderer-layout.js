import {blockSurfaceVertexCount} from './avorion/lib/geometry/blockSurface.js';

const flags=['canonicalBoxes','canonicalWedges','canonicalEndpointBoxes','canonicalDiscrete'];
export const legacyLayout=Object.freeze(Object.fromEntries(flags.map(flag=>[flag,false])));

export function requestedLayout(preferences,query,scene){
  if(query.get('renderer')==='legacy'||preferences.renderer==='legacy'||preferences.rendererMode==='legacy'||scene.blockTransforms||scene.turretStudio)return legacyLayout;
  if(preferences.rendererMode==='canonical')return {canonicalBoxes:true,canonicalWedges:true,canonicalEndpointBoxes:true,canonicalDiscrete:true};
  const [boxes,wedges,endpoints,discrete]=flags.map(flag=>preferences[flag]??query.get(flag)==='1');
  if(!boxes&&!wedges)return legacyLayout;
  return {canonicalBoxes:!!boxes,canonicalWedges:!!wedges,canonicalEndpointBoxes:!!(boxes&&(endpoints||discrete)),canonicalDiscrete:!!discrete};
}
export const hasCanonicalLayout=layout=>layout.canonicalBoxes||layout.canonicalWedges;
export const layoutKey=layout=>flags.map(flag=>Number(layout[flag])).join('');

export class CanonicalRendererError extends Error {
  constructor(message,options){
    super(message,options);
    this.code='canonical-renderer';
  }
}

export const resourceFailure=error=>error?.code==='render-resource'||error?.name==='QuotaExceededError'||
  /out of memory|allocation failed|allocat(e|ion).*buffer|invalid typed array length|resource budget|0x0505/i.test(error?.message||'');

// Conservative CPU attribute/index upper bound. Legacy can expand every block.
// This is a retry gate, not an estimate of available memory or GPU capacity.
export function legacyRetryBudget(blocks,deviceMemory){
  let bytes=0;
  for(const block of blocks)bytes+=blockSurfaceVertexCount(block.typeIndex)*(172+4);
  const capacity=Number.isFinite(deviceMemory)&&deviceMemory>0?deviceMemory/4:0.5;
  const limit=Math.min(1.5,capacity)*1024**3;
  return {bytes,limit,allowed:bytes<=limit};
}
