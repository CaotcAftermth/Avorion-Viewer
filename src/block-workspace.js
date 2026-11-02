import {textureLibrary} from './game-renderer.js';
import {reportError} from './app-log.js';

// Block Gallery close-up. Like the turret workspace, a separate document gives the
// block its own scene, viewport, outliner and properties.
export function openBlockWorkspace(block,apply){
 const dialog=document.createElement('dialog');dialog.className='turret-workspace block-workspace';dialog.setAttribute('aria-label','Block workspace');
 dialog.innerHTML='<header><h2></h2><span>Block Gallery</span></header><iframe class="turret-app-frame" title="Block workspace"></iframe><footer><span role="status">Loading workspace…</span><button data-cancel>Close</button><button data-save disabled title="Copy the shape, orientation, material and colors back to this block in the gallery">Apply to gallery</button></footer>';
 const title=dialog.querySelector('h2'),frame=dialog.querySelector('iframe'),status=dialog.querySelector('[role=status]'),applyButton=dialog.querySelector('[data-save]');
 title.textContent=block.type;
 let editor=null,closed=false;
 function close(){if(closed)return;closed=true;editor?.dispose();dialog.close();dialog.remove();}
 dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
 applyButton.onclick=()=>{if(!editor)return;try{apply(editor.snapshot());close();}catch(error){reportError(error,'BLOCK');status.textContent=error.message;}};
 frame.onload=async()=>{try{const files=[...textureLibrary.blobs].map(([name,blob])=>new File([blob],textureLibrary.sourceOf.get(name)?.file||name+'.png',{type:blob.type}));const configured=await frame.contentWindow.blockWorkspace.configure(structuredClone(strip(block)),files,{images:textureLibrary.images,blobs:textureLibrary.blobs,sourceOf:textureLibrary.sourceOf,resolution:textureLibrary.resolution},name=>{title.textContent=name;});if(closed){configured.dispose();return;}editor=configured;status.textContent='Change the variant, orientation or colors in Properties, then Apply to gallery to keep them.';applyButton.disabled=false;}catch(error){reportError(error,'BLOCK');if(!closed)status.textContent=error.message;}};
 const url=new URL('./index.html',document.baseURI);url.searchParams.set('editor','block');frame.src=url.href;
 document.body.append(dialog);dialog.showModal();return {close};
}
// Generated blocks carry no DOM nodes, but never send one across documents.
function strip({el,itemEl,...block}){return block;}
