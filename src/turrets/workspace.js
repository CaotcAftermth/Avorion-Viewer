import {textureLibrary} from '../game-renderer.js';
import {reportError} from '../app-log.js';
import {captureTurretProject, downloadSave, PROJECT_EXTENSION} from '../project-files.js';

// A separate document gives the full app its own scene, menus, shortcuts, and GPU lifecycle.
export function openTurretWorkspace(asset,save){
 const dialog=document.createElement('dialog');dialog.className='turret-workspace';dialog.setAttribute('aria-label','Turret workspace');
 dialog.innerHTML='<header><h2></h2><span>Turret asset</span></header><iframe class="turret-app-frame" title="Turret editor workspace"></iframe><footer><span role="status">Loading workspace…</span><button data-cancel>Cancel</button><button data-export disabled>Export Model Project</button><button data-save disabled>Save asset</button></footer>';
 dialog.querySelector('h2').textContent=asset.name;const frame=dialog.querySelector('iframe'),status=dialog.querySelector('[role=status]'),saveButton=dialog.querySelector('[data-save]'),exportButton=dialog.querySelector('[data-export]');
 let editor=null,closed=false,saving=false,initialSnapshot;
 function close(force=false){if(closed||saving)return;if(!force&&editor&&JSON.stringify(editor.snapshot())!==initialSnapshot&&!window.confirm('Discard unsaved asset changes?'))return;closed=true;editor?.dispose();dialog.close();dialog.remove();}
 dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
 saveButton.onclick=async()=>{if(!editor||saving)return;saving=true;saveButton.disabled=true;status.textContent='Saving asset…';try{await save(editor.snapshot());saving=false;close(true);}catch(error){reportError(error,'TURRET');status.textContent=error.message;saving=false;saveButton.disabled=false;}};
 exportButton.onclick=()=>{try{const record=captureTurretProject(editor.snapshot());downloadSave(record,record.name,PROJECT_EXTENSION);status.textContent='Project download started.';}catch(error){reportError(error,'TURRET');status.textContent=error.message;}};
 frame.onload=async()=>{try{const files=[...textureLibrary.blobs].map(([name,blob])=>new File([blob],textureLibrary.sourceOf.get(name)?.file||name+'.png',{type:blob.type}));const configured=await frame.contentWindow.assetWorkspace.configure(structuredClone(asset),files,{images:textureLibrary.images,blobs:textureLibrary.blobs,sourceOf:textureLibrary.sourceOf,resolution:textureLibrary.resolution});if(closed){configured.dispose();return;}editor=configured;initialSnapshot=JSON.stringify(editor.snapshot());status.textContent='';saveButton.disabled=exportButton.disabled=false;}catch(error){reportError(error,'TURRET');if(!closed)status.textContent=error.message;}};
 const url=new URL('./index.html',document.baseURI);url.searchParams.set('editor','turret');frame.src=url.href;
 document.body.append(dialog);dialog.showModal();return {close};
}
