import {componentSetup,componentSockets} from './core.js';
import {changeSetup,detachComponent} from './mounting.js';
import {componentClashes,clashText} from './clearance.js';
import {reportError} from '../app-log.js';

// Ship structure: one row per mounted component, under the turret rows.
export function mountComponentOutliner(host,scene,changed){
 const section=document.createElement('div');section.className='component-outliner';host.append(section);
 const run=action=>action().then(changed).catch(error=>{scene.componentMessage=error.message;reportError(error,'COMPONENT');changed();});
 function sync(){
  section.replaceChildren();const model=scene.model,mounts=model?componentSetup(model).mounts:[];if(!mounts.length)return;
  const title=document.createElement('p');title.className='panel-note';title.textContent=(model.fileName||'Ship')+' / Components';section.append(title);
  const sockets=componentSockets(scene),clashes=componentClashes(scene);
  for(const m of mounts){
   const row=document.createElement('div');row.className='field-row component-outliner-row';
   const socket=sockets.find(s=>s.id===m.socketId),clash=clashes.get(m.id);
   const choose=document.createElement('button');choose.type='button';choose.textContent=(clash?'⚠ ':'')+(m.name||m.asset.name);choose.title=(socket?socket.name:'Missing socket')+(clash?' · '+clashText(scene,clash):'');
   choose.classList.toggle('active',scene.selectedComponentMountId===m.id);choose.setAttribute('aria-pressed',String(scene.selectedComponentMountId===m.id));
   choose.onclick=()=>{scene.selectedComponentMountId=m.id;scene.selectedComponentSocketId=m.socketId;changed();};row.append(choose);
   const name=document.createElement('input');name.value=m.name||'';name.placeholder=m.asset.name;name.maxLength=100;name.setAttribute('aria-label','Rename component '+(m.name||m.asset.name));
   name.onchange=()=>{const value=name.value.trim().slice(0,100);const setup=componentSetup(model);run(()=>changeSetup(scene,{...setup,mounts:setup.mounts.map(x=>x.id===m.id?{...x,name:value||undefined}:x)}));};row.append(name);
   for(const [label,action] of [[m.hidden?'Show':'Hide',()=>{const setup=componentSetup(model);return changeSetup(scene,{...setup,mounts:setup.mounts.map(x=>x.id===m.id?{...x,hidden:!m.hidden}:x)});}],['Detach',()=>changeSetup(scene,detachComponent(scene,m))]]){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>run(action);row.append(b);
   }
   section.append(row);
  }
 }
 sync();return {sync,dispose(){section.remove();}};
}
