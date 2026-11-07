import {turretLibrary,loadTurretLibrary} from './turrets/library.js';
import {componentLibrary,loadComponentLibrary} from './components/library.js';
import {mountAttachmentLibrary,ASSET_KINDS} from './attachment-library.js';
import {matchesBinding} from './keymaps.js';

// A non-blocking dialog keeps the viewport available as a native drag target.
export function openQuickAssetLibrary({scene,preferences,kind='turrets',changed,closed}){
 const previous=document.activeElement,events=new AbortController();
 const host=document.createElement('section');host.className='quick-asset-library';
 host.setAttribute('role','dialog');host.setAttribute('aria-label','Quick Asset Library');
 host.setAttribute('aria-modal','false');host.tabIndex=-1;
 const header=document.createElement('header'),title=document.createElement('strong');
 title.textContent='Asset Library';header.append(title);
 const tabs=document.createElement('div');tabs.className='asset-kind-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Asset type');header.append(tabs);
 const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','Close Quick Asset Library');dismiss.title='Close (Esc)';header.append(dismiss);
 const body=document.createElement('div');body.className='quick-asset-library-body';host.append(header,body);document.body.append(host);
 const node={id:'quick-assets',assetKind:kind},library=mountAttachmentLibrary(body,node,scene,changed);
 for(const [value,label] of ASSET_KINDS){
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.setAttribute('aria-pressed',String(value===node.assetKind));button.classList.toggle('active',value===node.assetKind);
  button.onclick=()=>{library.show(value);for(const b of tabs.children){const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}};
  tabs.append(button);
 }
 let disposed=false,resizeFrame=0;
 function fitWidth(){
  resizeFrame=0;if(disposed)return;
  const count=Math.max(turretLibrary.assets.length,componentLibrary.assets.length)+1;
  const rowWidth=count*145+(count-1)*8+18;
  host.style.width=Math.min(window.innerWidth-32,Math.max(340,rowWidth))+'px';
 }
 const scheduleFit=()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(fitWidth);};
 const observer=new MutationObserver(scheduleFit);observer.observe(body,{childList:true,subtree:true});
 window.addEventListener('resize',scheduleFit,{signal:events.signal});scheduleFit();
 void Promise.allSettled([loadTurretLibrary(),loadComponentLibrary()]).then(()=>{if(!disposed)scheduleFit();});
 function close({restoreFocus=true,cancelPlacement=true}={}){
  if(disposed)return;disposed=true;events.abort();observer.disconnect();cancelAnimationFrame(resizeFrame);library.dispose();host.remove();closed(node.assetKind,cancelPlacement);
  if(restoreFocus&&previous?.isConnected)previous.focus({preventScroll:true});
 }
 dismiss.onclick=()=>close();
 window.addEventListener('attachment-placed',()=>requestAnimationFrame(()=>close({restoreFocus:false,cancelPlacement:false})),{signal:events.signal});
 window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&event.target.closest('.turret-asset-name-input'))return;
  if(event.key==='Escape'){
   event.preventDefault();event.stopImmediatePropagation();close();return;
  }
  if(matchesBinding('assetLibrary',event,preferences())&&!event.repeat&&!event.target.closest('input,textarea,select,button,[contenteditable=true]')){
   event.preventDefault();event.stopImmediatePropagation();close();
  }
 },{capture:true,signal:events.signal});
 host.focus({preventScroll:true});
 return {close,get kind(){return node.assetKind;}};
}
