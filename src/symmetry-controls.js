import {icon} from './icons.js';

export const symmetryAxesOrder=['x','y','z'];
export function shipSymmetryOrigin(model){
 const bounds=model?.bounds;
 return Object.fromEntries(symmetryAxesOrder.map(axis=>[axis,bounds?(bounds.min[axis]+bounds.max[axis])/2:0]));
}

export function mountSymmetryControls(host,{read,update,reset,hasModel,track=(_node,sync)=>sync()}){
 const controls=document.createElement('div');controls.className='symmetry-controls';host.append(controls);
 for(const axis of symmetryAxesOrder){
  const name='Mirror '+axis.toUpperCase(),plane=axis.toUpperCase()+' symmetry plane';
  const row=document.createElement('div');row.className='symmetry-control-row';
  const label=document.createElement('label'),check=document.createElement('input');
  label.append(name,check);check.type='checkbox';check.setAttribute('aria-label',name);
  const origin=document.createElement('input');origin.type='number';origin.step='any';origin.dataset.numeric='';
  origin.setAttribute('aria-label',name+' plane');origin.title='Plane coordinate in native ship axes';
  const eye=document.createElement('button');eye.type='button';
  row.append(label,origin,eye);controls.append(row);
  const sync=()=>{
   const state=read(),visible=state.planeVisible?.[axis]!==false;
   check.checked=!!state.symmetry?.[axis];origin.value=state.origin[axis];
   eye.innerHTML=icon(visible?'eye':'eyeClosed');
   eye.title=(visible?'Hide ':'Show ')+plane;eye.setAttribute('aria-label',eye.title);
   eye.setAttribute('aria-pressed',String(visible));
  };
  check.onchange=()=>{update('symmetry',axis,check.checked);sync();};
  origin.onchange=()=>{if(Number.isFinite(origin.valueAsNumber))update('origin',axis,origin.valueAsNumber);sync();};
  eye.onclick=()=>{update('planeVisible',axis,read().planeVisible?.[axis]===false);sync();};
  track(row,sync);
 }
 const center=document.createElement('button');center.type='button';center.textContent='Use Ship Center';
 center.onclick=reset;controls.append(center);
 track(center,()=>{center.disabled=!hasModel();});
}
