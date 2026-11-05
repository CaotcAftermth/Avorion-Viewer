import {sceneSockets} from './sockets.js';
import {placeTurret,mounts} from './mounts.js';
export function restorationSummary(report){
 if(!report)return '';
 const missing=report.entries.filter(entry=>entry.state==='unresolved').length;
 return `${report.restored} turrets restored · ${report.added} designs added to library${missing?` · ${missing} need review`:''}`;
}
export function mountRestorationReview(host,scene,{selectBlock=()=>{},changed=()=>{}}={}){
 const report=scene.model?.turretRestoration;if(!report)return;
 const note=document.createElement('p');note.className='panel-note';note.textContent=restorationSummary({...report,entries:report.entries.filter(entry=>!mounts(scene).some(mount=>mount.restorationIndex===entry.index))});host.append(note);
 const unresolved=report.entries.filter(entry=>entry.state==='unresolved'&&!mounts(scene).some(mount=>mount.restorationIndex===entry.index));if(!unresolved.length)return;
 const button=document.createElement('button');button.type='button';button.textContent='Review unresolved turrets';host.append(button);
 button.onclick=()=>{
  const model=scene.model,dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Review restored turrets');
  const title=document.createElement('h2');title.textContent='Unresolved turret mounts';dialog.append(title);
  const hint=document.createElement('p');hint.textContent='Saved designs identify mounting blocks. Face and orientation choices are inferred; inspect the preview before keeping a placement.';dialog.append(hint);
  for(const entry of unresolved){
   const row=document.createElement('section'),name=document.createElement('p');name.textContent=`Block ${entry.index}: ${entry.reason}`;row.append(name);
   const focus=document.createElement('button');focus.type='button';focus.textContent='Select mounting block';focus.disabled=!model.blocks.some(b=>b.id===entry.blockId&&!b.deleted);focus.onclick=()=>{dialog.close();selectBlock(entry.blockId);};row.append(focus);
   if(entry.asset){
    const select=document.createElement('select');select.setAttribute('aria-label',`Repair socket for block ${entry.index}`);
    select.add(new Option('Choose a compatible socket',''));
    for(const socket of sceneSockets(scene).filter(s=>s.fitSize>=entry.size&&!mounts(scene).some(m=>m.socketId===s.id)))select.add(new Option(`${socket.blockId} · ${socket.name}`,socket.id));row.append(select);
    select.onchange=()=>{if(scene.model!==model)return;const socket=sceneSockets(scene).find(s=>s.id===select.value);scene.turretPreview=socket?{asset:entry.asset,socket,size:entry.size}:null;if(socket?.blockId)selectBlock(socket.blockId);changed();};
    const attach=document.createElement('button');attach.type='button';attach.textContent='Attach saved design';attach.onclick=()=>{
     try{if(scene.model!==model)throw Error('The active ship changed. Reopen the review for the current ship.');const socket=sceneSockets(scene).find(s=>s.id===select.value);if(!socket)throw Error('Choose a socket.');placeTurret(scene,entry.asset,socket,entry.size);scene.model.turretMounts.at(-1).restorationIndex=entry.index;dialog.close();changed();}
     catch(error){name.textContent=error.message;}
    };row.append(attach);
   }
   dialog.append(row);
  }
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(close);dialog.addEventListener('close',()=>{if(scene.model===model)scene.turretPreview=null;dialog.remove();changed();},{once:true});document.body.append(dialog);dialog.showModal();
 };
}
