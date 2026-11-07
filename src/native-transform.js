import {propertyPanel,propertyNote} from './property-ui.js';
import {liveBlocks} from './ship-structure.js';
export function mountNativeTransform(host,scene){
 const panel=propertyPanel(host,'Native Transform',true);panel.dataset.nativeTransform='';
 const controls=new Map();
 for(const [key,title] of [['position','Position'],['size','Dimension']]){
  const group=document.createElement('div');group.className='property-vector';group.setAttribute('role','group');group.setAttribute('aria-label',title);panel.append(group);
  const heading=document.createElement('h4');heading.className='sub-label';heading.textContent=title;group.append(heading);
  for(const axis of ['x','y','z']){
   const row=document.createElement('label');row.className='field-row';row.textContent=axis.toUpperCase();
   const input=document.createElement('input');input.type='text';input.readOnly=true;input.setAttribute('aria-label','Native '+title+' '+axis.toUpperCase());input.dataset.nativeValue=key+'.'+axis;
   row.append(input);group.append(row);controls.set(key+'.'+axis,input);
  }
 }
 const orientation=propertyNote(panel,''),empty=propertyNote(host,'No model in the scene.');
 panel.refresh=()=>{
  const blocks=liveBlocks(scene),block=blocks.find(b=>b.id===scene.selectedId)||blocks[0];
  panel.hidden=!block;empty.hidden=!!block;
  if(!block)return;
  for(const [key,input] of controls){const [field,axis]=key.split('.'),value=block[field][axis].toFixed(3);if(input.value!==value)input.value=value;}
  const text=`Look ${block.look} · Up ${block.up} · Native units`;if(orientation.textContent!==text)orientation.textContent=text;
 };panel.refresh();return panel;
}
