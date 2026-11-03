import {textureLibrary} from '../game-renderer.js';
import {reportError} from '../app-log.js';

// Like turrets, a component opens in its own document with a viewport, outliner and properties.
export function openComponentWorkspace(asset,save){
 const dialog=document.createElement('dialog');dialog.className='turret-workspace component-workspace';dialog.setAttribute('aria-label','Component workspace');
 dialog.innerHTML='<header><h2></h2><span>Library asset</span></header><iframe class="turret-app-frame" title="Component editor workspace"></iframe><footer><span role="status">Loading workspace…</span><button data-cancel>Cancel</button><button data-save disabled>Save asset</button></footer>';
 dialog.querySelector('h2').textContent=asset.name;const frame=dialog.querySelector('iframe'),status=dialog.querySelector('[role=status]'),saveButton=dialog.querySelector('[data-save]');
 let editor=null,closed=false,saving=false;
 function close(){if(closed||saving)return;closed=true;editor?.dispose();dialog.close();dialog.remove();}
 dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
 saveButton.onclick=async()=>{if(!editor||saving)return;saving=true;saveButton.disabled=true;try{await save(editor.snapshot());saving=false;close();}catch(error){reportError(error,'COMPONENT');status.textContent=error.message;saving=false;saveButton.disabled=false;}};
 frame.onload=async()=>{try{const files=[...textureLibrary.blobs].map(([name,blob])=>new File([blob],textureLibrary.sourceOf.get(name)?.file||name+'.png',{type:blob.type}));const configured=await frame.contentWindow.componentWorkspace.configure(structuredClone(asset),files,{images:textureLibrary.images,blobs:textureLibrary.blobs,sourceOf:textureLibrary.sourceOf,resolution:textureLibrary.resolution});if(closed){configured.dispose();return;}editor=configured;status.textContent='Edit blocks or the attachment point in Properties, then Save asset.';saveButton.disabled=false;}catch(error){reportError(error,'COMPONENT');if(!closed)status.textContent=error.message;}};
 const url=new URL('./index.html',document.baseURI);url.searchParams.set('editor','component');frame.src=url.href;
 document.body.append(dialog);dialog.showModal();return {close};
}
