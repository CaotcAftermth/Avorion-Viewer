import {getShadingSpec} from './avorion/lib/textures/shadingMap.js';
export const HOLOGRAM_OPACITY=.5;
export function supportsOpacity(block){return ['glass','hologram'].includes(getShadingSpec(block.typeIndex).surface);}
export function blockOpacity(block){
 if(Number.isFinite(block.opacity))return Math.max(0,Math.min(1,block.opacity));
 const surface=getShadingSpec(block.typeIndex).surface;
 if(surface==='glass')return .7;
 // Holograms default to half see-through, imported or not; a viewer override still wins.
 if(surface==='hologram')return HOLOGRAM_OPACITY;
 return /^[0-9a-f]{8}$/i.test(block.color||'')?parseInt(block.color.slice(0,2),16)/255:1;
}
