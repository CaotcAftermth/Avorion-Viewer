import {getShadingSpec} from './avorion/lib/textures/shadingMap.js';
export function supportsOpacity(block){return ['glass','hologram'].includes(getShadingSpec(block.typeIndex).surface);}
export function blockOpacity(block){
 if(Number.isFinite(block.opacity))return Math.max(0,Math.min(1,block.opacity));
 if(getShadingSpec(block.typeIndex).surface==='glass')return .7;
 return /^[0-9a-f]{8}$/i.test(block.color||'')?parseInt(block.color.slice(0,2),16)/255:1;
}
