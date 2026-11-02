// Block Gallery: the cube of every block type laid out on the ground grid.
// Selecting a gallery block offers its shape variants (Edge, Corner 2, ...).
import { BLOCK_DEFINITIONS, BLOCK_FAMILIES, MATERIALS, getBlockDefinition } from './avorion/lib/avorion/blockDefinitions.js';
import { makeBlock, makeModel } from './block-model.js';
import { getShadingSpec } from './avorion/lib/textures/shadingMap.js';
import { HOLOGRAM_OPACITY } from './block-opacity.js';
/** Holograms start half see-through so the hologram effect reads. */
export const HOLOGRAM_GALLERY_OPACITY=HOLOGRAM_OPACITY;

export const BLOCK_GALLERY_NAME='Block Gallery';
export const GALLERY_BLOCK_SIZE=2, GALLERY_SPACING=2;
const SHAPE_LABELS=['Cube','Edge','Corner 1','Corner 2','Corner 3','Twisted Corner 1','Twisted Corner 2','Flat Corner'];
// Functional blocks that ship as a cube plus a single edge shape.
const EDGE_PAIRS=[[12,23],[20,21],[24,25],[600,601],[650,651]];
const CATEGORY_ORDER=['Structure','Defense','Crew','Propulsion','Systems','Utility','Hardpoints','Weapons','Decorative','Special','Asteroid','Wreckage'];
const GROUPS=[
  ...BLOCK_FAMILIES.map(f=>f.indices.map((typeIndex,i)=>({typeIndex,label:SHAPE_LABELS[i]}))),
  ...EDGE_PAIRS.map(([cube,edge])=>[{typeIndex:cube,label:'Cube'},{typeIndex:edge,label:'Edge'}])
];
const GROUP_OF=new Map(GROUPS.flatMap(group=>group.map(v=>[v.typeIndex,group])));

/** Shape variants of a block type, cube first. Standalone blocks only have their cube. */
export function blockVariants(typeIndex){
  return (GROUP_OF.get(typeIndex)||[{typeIndex,label:'Cube'}]).map(v=>({...v,name:getBlockDefinition(v.typeIndex).displayName}));
}
/** Cube shape of every block type: family cubes plus every standalone box block. */
export function galleryTypes(){
  const rank=c=>{const i=CATEGORY_ORDER.indexOf(c);return i<0?CATEGORY_ORDER.length:i;};
  return BLOCK_DEFINITIONS
    .filter(d=>{const group=GROUP_OF.get(d.typeIndex);return group?group[0].typeIndex===d.typeIndex:d.geometryKind==='box';})
    .sort((a,b)=>rank(a.category)-rank(b.category)||a.typeIndex-b.typeIndex);
}
/** Default paint of a block: its material's in-game paint tint. */
export const materialColor=(materialIndex=0)=>'ff'+(MATERIALS[materialIndex]?.paint||'#a0a0a0').slice(1).toLowerCase();
// Defaults earlier versions painted gallery blocks with: neutral gray, then the vivid material UI colors.
const OLD_DEFAULTS=new Set(['a0a0a0',...MATERIALS.map(m=>m.color.slice(1).toLowerCase())]);
/** True when a color is (or was) a material default, so it may follow material changes. */
export const isDefaultPaint=color=>{const rgb=color?.slice(-6).toLowerCase();return OLD_DEFAULTS.has(rgb)||MATERIALS.some(m=>m.paint.slice(1)===rgb);};
/** 2 × 2 × 2 cubes with a 2-unit gap between neighbours, centered on the origin. */
export function blockGallery(materialIndex=0){
  const color=materialColor(materialIndex);
  const types=galleryTypes(),columns=Math.ceil(Math.sqrt(types.length)),rows=Math.ceil(types.length/columns),pitch=GALLERY_BLOCK_SIZE+GALLERY_SPACING,s=GALLERY_BLOCK_SIZE;
  const blocks=types.map((d,i)=>makeBlock({typeIndex:d.typeIndex,id:`b${i}`,materialIndex,color,size:{x:s,y:s,z:s},
    position:{x:(i%columns-(columns-1)/2)*pitch,y:s/2,z:(Math.floor(i/columns)-(rows-1)/2)*pitch}}));
  for(const b of blocks)if(getShadingSpec(b.typeIndex).surface==='hologram')b.opacity=HOLOGRAM_GALLERY_OPACITY;
  return makeModel(blocks,BLOCK_GALLERY_NAME);
}
/** Galleries saved with older defaults (gray or vivid UI colors): repaint those with the material paint. */
export function upgradeGalleryColors(model){
  if(model?.fileName!==BLOCK_GALLERY_NAME)return model;
  for(const b of model.blocks)if(OLD_DEFAULTS.has(b.color?.slice(-6).toLowerCase()))b.color=b.color.slice(0,2)+materialColor(b.materialIndex).slice(2);
  return model;
}
export const isBlockGallery=scene=>!!scene?.preview&&scene.model?.fileName===BLOCK_GALLERY_NAME;
/** Copy a block's edited look (not its gallery slot) back onto a gallery block. */
export function applyGalleryEdit(target,edited){
  for(const key of ['typeIndex','type','look','up','materialIndex','material','color'])if(edited[key]!==undefined)target[key]=edited[key];
  if(edited.secondaryColor===undefined)delete target.secondaryColor;else target.secondaryColor=edited.secondaryColor;
  if(Number.isFinite(edited.opacity))target.opacity=edited.opacity;else delete target.opacity;
  target.unknownAttrs={...(edited.unknownAttrs||{})};
  return target;
}
