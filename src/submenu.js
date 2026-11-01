// Keep a flyout inside its parent menu for outside-click and dismissal handling.
export function attachSubmenu(trigger,parent,items,closeMenu){
 const arrow=document.createElement('span');arrow.className='submenu-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');trigger.append(arrow);
 trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
 let flyout;
 function close(){flyout?.remove();flyout=null;trigger.setAttribute('aria-expanded','false');}
 function open(focus=false){
  if(!flyout){
   flyout=document.createElement('div');flyout.className='popup navigation-submenu';flyout.setAttribute('role','menu');flyout.setAttribute('aria-label','Navigation');
   for(const item of items()){
    if(!item){flyout.append(document.createElement('hr'));continue;}
    const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.disabled=!!item.disabled;
    const label=document.createElement('span');label.textContent=item.label;b.append(label);
    if(item.key){const key=document.createElement('kbd');key.textContent=item.key;b.append(key);}
    b.onclick=()=>{closeMenu();item.action?.();};flyout.append(b);
   }
   parent.append(flyout);trigger.setAttribute('aria-expanded','true');
   const r=trigger.getBoundingClientRect(),w=flyout.offsetWidth,h=flyout.offsetHeight;
   flyout.style.left=Math.max(6,Math.min(r.right+w>innerWidth-6?r.left-w:r.right,innerWidth-w-6))+'px';
   flyout.style.top=Math.max(6,Math.min(r.top,innerHeight-h-6))+'px';
   flyout.onkeydown=e=>{
    if(['Escape','ArrowLeft'].includes(e.key)){e.preventDefault();e.stopPropagation();close();trigger.focus();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const buttons=[...flyout.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
   };
  }
  if(focus)flyout.querySelector('button:not(:disabled)')?.focus();
 }
 trigger.onpointerenter=()=>open();trigger.onclick=()=>open(true);
 trigger.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();open(true);}};
 parent.addEventListener('pointerover',e=>{const sibling=e.target.closest('button');if(sibling?.parentElement===parent&&sibling!==trigger)close();});
 parent.addEventListener('focusin',e=>{if(e.target.parentElement===parent&&e.target!==trigger)close();});
}
