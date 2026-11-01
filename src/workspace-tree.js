import {clamp,ratioBounds,leaves} from './layout.js';

// Shared workspace tree rendering and divider lifecycle.
export function renderWorkspaceNode(node, context){
  const {renderArea,renderers,gesture,save,resizeDirection,modifierActive,preferences,areaMenu}=context;
  const renderNode=child=>renderWorkspaceNode(child,context);
  if(node.type==='area')return renderArea(node);
  const el=document.createElement('div');el.className=`split-node axis-${node.axis}`;el.dataset.splitId=node.id;
  const first=document.createElement('div'),second=document.createElement('div');first.className=second.className='split-child';first.append(renderNode(node.first));second.append(renderNode(node.second));
  const divider=document.createElement('div');divider.className='divider';divider.tabIndex=0;divider.role='separator';divider.setAttribute('aria-label','Resize editor areas');divider.setAttribute('aria-orientation',node.axis==='x'?'vertical':'horizontal');
  const sizing=()=>{const total=(node.axis==='x'?el.clientWidth:el.clientHeight)-5;if(total<=0)return;const bounds=ratioBounds(node,total),ratio=clamp(node.ratio,...bounds);first.style.flexBasis=`${total*ratio}px`;second.style.flex='1';divider.setAttribute('aria-valuenow',String(Math.round(ratio*100)));divider.setAttribute('aria-valuemin',String(Math.ceil(bounds[0]*100)));divider.setAttribute('aria-valuemax',String(Math.floor(bounds[1]*100)));};
  const observer=new ResizeObserver(sizing);observer.observe(el);renderers.push({dispose:()=>observer.disconnect()});
  divider.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();const original=node.ratio;const rect=el.getBoundingClientRect();divider.classList.add('dragging');
    gesture(e,move=>{const total=(node.axis==='x'?rect.width:rect.height)-5;let ratio=(node.axis==='x'?move.clientX-rect.left:move.clientY-rect.top)/total;if(modifierActive('snapResize',move,preferences.value))ratio=Math.round(ratio*10)/10;node.ratio=clamp(ratio,...ratioBounds(node,total));sizing();},()=>{divider.classList.remove('dragging');save();},()=>{node.ratio=original;sizing();divider.classList.remove('dragging');});
  });
  divider.addEventListener('keydown',e=>{
    const direction=resizeDirection(e);if(!direction)return;e.preventDefault();e.stopPropagation();const total=(node.axis==='x'?el.clientWidth:el.clientHeight)-5;node.ratio=clamp(node.ratio+direction*(modifierActive('largeResize',e,preferences.value)?.1:.02),...ratioBounds(node,total));sizing();save();
  });
  divider.addEventListener('dblclick',()=>{node.ratio=.5;sizing();save();});
  divider.addEventListener('contextmenu',e=>{e.preventDefault();const firstArea=leaves(node.first).at(-1);areaMenu(e,firstArea);});
  el.append(first,divider,second);return el;
}

