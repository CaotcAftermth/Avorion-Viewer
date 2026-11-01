import {secondaryColor} from './block-colors.js';
const cache=new WeakMap();
// Count a color once per block, even if both channels use it. Ignore disabled secondary overrides.
export function modelPalette(scene){
  if(!scene.loaded||!scene.model)return [];
  const {model}=scene,revision=scene.appearanceRevision||0,previous=cache.get(scene);
  if(previous?.model===model&&previous.revision===revision&&previous.blocks===model.blocks&&previous.count===model.blocks.length)return previous.colors;
  const counts=new Map();
  for(const block of model.blocks){
    const values=[block.color],secondary=secondaryColor(block);
    if(secondary&&parseInt(secondary.slice(0,2),16)>0)values.push(secondary);
    for(const hex of new Set(values.filter(v=>/^[0-9a-f]{8}$/i.test(v)).map(v=>'#'+v.slice(2).toUpperCase())))counts.set(hex,(counts.get(hex)||0)+1);
  }
  const colors=[...counts].map(([hex,count])=>({hex,count})).sort((a,b)=>b.count-a.count||a.hex.localeCompare(b.hex));
  cache.set(scene,{model,revision,blocks:model.blocks,count:model.blocks.length,colors});return colors;
}
