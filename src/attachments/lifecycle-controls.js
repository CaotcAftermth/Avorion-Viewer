import {sourceRevision,libraryUpdateSummary,updatedMount} from './lifecycle.js';
import {turretLibrary,loadTurretLibrary,updateTurretAsset,addTurretAsset} from '../turrets/library.js';
import {componentLibrary,loadComponentLibrary,updateComponentAsset,addComponentAsset} from '../components/library.js';
import {openTurretWorkspace} from '../turrets/workspace.js';
import {openComponentWorkspace} from '../components/workspace.js';
import {updateTurretFromLibrary} from '../turrets/mounts.js';
import {changeSetup} from '../components/mounting.js';
import {componentSetup,componentSockets} from '../components/core.js';
export function confirmAttachmentChange(title,lines,apply){
 const dialog=document.createElement('dialog');dialog.className='attachment-confirm';
 const heading=document.createElement('h2');heading.textContent=title;dialog.append(heading);
 for(const line of lines){const p=document.createElement('p');p.textContent=line;dialog.append(p);}
 const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
 const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();
 const confirm=document.createElement('button');confirm.textContent='Apply';confirm.onclick=async()=>{confirm.disabled=cancel.disabled=true;status.textContent='Saving…';try{await apply();dialog.close();}catch(error){status.textContent=error.message;confirm.disabled=cancel.disabled=false;}};
 dialog.oncancel=event=>{if(confirm.disabled)event.preventDefault();};dialog.onclose=()=>dialog.remove();dialog.append(cancel,confirm);document.body.append(dialog);dialog.showModal();cancel.focus();return dialog;
}
export function previewSetupImport(scene,next,changed){
 const model=scene.model,current=componentSetup(model),probe={...scene,model:{...model,componentSetup:next}},ids=new Set(componentSockets(probe).map(s=>s.id));
 const unresolved=next.mounts.filter(m=>!ids.has(m.socketId)).length;
 return confirmAttachmentChange('Import component setup',[`Replace ${current.mounts.length} mounted components and ${current.sockets.length} manual sockets with ${next.mounts.length} components and ${next.sockets.length} sockets.`,`${unresolved} mounted components have unresolved sockets. A backup can be exported before proceeding.`],async()=>{if(scene.model!==model)throw Error('The active ship changed. Open the import again.');await changeSetup(scene,next);changed();});
}
export function mountLifecycleControls(host,scene,kind,mount,changed){
 const turret=kind==='turret',model=scene.model,section=document.createElement('details');section.className='panel';section.open=true;const title=document.createElement('summary');title.textContent='Library source';section.append(title);host.append(section);
 const status=document.createElement('p');status.setAttribute('role','status');section.append(status);
 const run=async action=>{try{await action();changed();}catch(error){status.textContent=error.message;}};
 const button=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>run(action);section.append(b);};
 const build=()=>{
  const source=(turret?turretLibrary:componentLibrary).assets.find(a=>a.id===(mount.source?.assetId||mount.assetId||mount.asset.id));
  status.textContent=source?`Mounted revision ${mount.source?.revision||sourceRevision(mount.asset)} · Library revision ${sourceRevision(source)}`:'Source unavailable. The mounted copy remains usable.';
  button('Edit library asset',()=>{(turret?openTurretWorkspace:openComponentWorkspace)(source,async draft=>{await(turret?updateTurretAsset:updateComponentAsset)(draft);changed();});},!source);
  button('Save as new asset',async()=>{const copy={...structuredClone(mount.asset),id:crypto.randomUUID(),name:mount.asset.name+' copy',revision:1};await(turret?addTurretAsset:addComponentAsset)(copy,{force:true});});
  button('Update from library',()=>{
   const summary=libraryUpdateSummary(mount,source,kind);
   confirmAttachmentChange('Update mounted '+kind,[`${summary.before} blocks will be replaced by ${summary.after} blocks.`, 'Placement and compatible instance overrides will be retained.',...summary.warnings],async()=>{
    if(scene.model!==model)throw Error('The active ship changed. Select the attachment again.');
    if(turret)updateTurretFromLibrary(scene,mount.id,source);
    else{const setup=componentSetup(model);await changeSetup(scene,{...setup,mounts:setup.mounts.map(m=>m.id===mount.id?updatedMount(m,source,kind):m)});}
    changed();
   });
  },!source);
 };
 (turret?loadTurretLibrary:loadComponentLibrary)().then(()=>{if(section.isConnected)build();}).catch(e=>status.textContent=e.message);
}
