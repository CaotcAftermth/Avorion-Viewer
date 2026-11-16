import {textureLibrary} from './game-renderer.js';
import {reportError} from './app-log.js';

// Block Gallery close-up. Like the turret workspace, a separate document gives the
// block its own scene, viewport, outliner and properties.
export function openBlockWorkspace(block,apply){
 return openBlockEditor({
  title:block.type, label:'Block workspace', subtitle:'Block Gallery', mode:'block',
  configure:(frame,files,shared,onRename)=>frame.blockWorkspace.configure(structuredClone(strip(block)),files,shared,onRename),
  message:'Change the variant, orientation or colors in Properties, then Apply to gallery to keep them.',
  action:{label:'Apply to gallery',title:'Copy the shape, orientation, material and colors back to this block in the gallery',run(editor){apply(editor.snapshot());}},
 });
}

export function openBlockEditor({title:heading,label,subtitle,mode,configure,message,action,onClose}){
 const dialog=document.createElement('dialog');dialog.className=`turret-workspace ${mode}-workspace`;dialog.setAttribute('aria-label',label);
 dialog.innerHTML='<header><h2></h2><span></span></header><iframe class="turret-app-frame"></iframe><footer><span role="status">Loading workspace…</span><button type="button" data-cancel>Close</button></footer>';
 const applyButton=action&&document.createElement('button');
 if(applyButton){
  applyButton.type='button';applyButton.dataset.save='';applyButton.disabled=true;
  applyButton.textContent=action.label;applyButton.title=action.title;dialog.querySelector('footer').append(applyButton);
 }
 const title=dialog.querySelector('h2'),frame=dialog.querySelector('iframe'),status=dialog.querySelector('[role=status]');
 title.textContent=heading;frame.title=label;dialog.querySelector('header span').textContent=subtitle;
 let editor=null,closed=false;
 function close(){
  if(closed)return;closed=true;
  try{if(editor)onClose?.(editor);}
  finally{editor?.dispose();dialog.close();dialog.remove();}
 }
 dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
 if(applyButton)applyButton.onclick=()=>{
  if(!editor)return;
  try{action.run(editor);if(action.close!==false)close();}
  catch(error){reportError(error,label);status.textContent=error.message;}
 };
 frame.onload=async()=>{
  try{
   const files=[...textureLibrary.blobs].map(([name,blob])=>new File([blob],textureLibrary.sourceOf.get(name)?.file||name+'.png',{type:blob.type}));
   const shared={images:textureLibrary.images,blobs:textureLibrary.blobs,sourceOf:textureLibrary.sourceOf,resolution:textureLibrary.resolution};
   const configured=await configure(frame.contentWindow,files,shared,name=>{title.textContent=name;});
   if(closed){configured.dispose();return;}
   editor=configured;status.textContent=message;
   if(applyButton)applyButton.disabled=false;
  }catch(error){if(!closed){reportError(error,label);status.textContent=error.message;}}
 };
 const url=new URL('./index.html',document.baseURI);url.searchParams.set('editor',mode);frame.src=url.href;
 document.body.append(dialog);dialog.showModal();return {close};
}
// Generated blocks carry no DOM nodes, but never send one across documents.
function strip({el,itemEl,...block}){return block;}
