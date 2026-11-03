import {openTurretWorkspace} from './workspace.js';
import {thumbnail} from './thumbnail.js';
import {importTurretXml} from './core.js';
import {turretContentKey} from './embedded.js';
const listeners=new Set();
export const turretLibrary={assets:[],selectedId:null};
let database;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('avorion-viewer.turret-assets.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Turret storage is blocked by another tab.'));});}
async function records(asset,remove=false){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('assets',asset?'readwrite':'readonly'),store=tx.objectStore('assets'),r=asset?(remove?store.delete(asset.id):store.put(asset)):store.getAll();tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error||Error('Turret storage failed.'));tx.onerror=()=>{};});}
let ready;
export async function loadTurretLibrary(){
  await (ready??=records().then(assets=>{turretLibrary.assets=assets;emit();}).catch(error=>{ready=null;throw error;}));
  return turretLibrary.assets;
}
let additions=Promise.resolve();
export function addTurretAsset(asset){
  const operation=additions.then(async()=>{
    await loadTurretLibrary();
    const key=turretContentKey(asset),existing=turretLibrary.assets.find(item=>turretContentKey(item)===key);
    if(existing)return existing;
    await records(asset);turretLibrary.assets.push(asset);emit();return asset;
  });
  additions=operation.catch(()=>{});return operation;
}
const emit=(selectionOnly=false)=>listeners.forEach(fn=>fn(selectionOnly));
export function mountTurretLibrary(host,changed){
  host.classList.add('turret-library');let error='',busy=false,disposed=false;
  const draw=(selectionOnly=false)=>{
    if(selectionOnly){for(const tile of host.querySelectorAll('[data-asset-id]'))tile.setAttribute('aria-pressed',String(tile.dataset.assetId===turretLibrary.selectedId));return;}
    if(disposed)return;const scrollTop=host.scrollTop,scrollLeft=host.scrollLeft;host.replaceChildren();const grid=document.createElement('div');grid.className='turret-asset-grid';host.append(grid);
    for(const asset of turretLibrary.assets){
      const card=document.createElement('div');card.className='turret-asset-card';
      const tile=document.createElement('button');tile.className='turret-asset-tile';tile.dataset.assetId=asset.id;tile.setAttribute('aria-label',asset.name);tile.setAttribute('aria-pressed',String(asset.id===turretLibrary.selectedId));tile.draggable=true;
      tile.ondragstart=e=>{if(!dragImage.complete||!dragImage.naturalWidth){e.preventDefault();return;}turretLibrary.dragged=asset;e.dataTransfer.setData('application/x-avorion-turret',asset.id);e.dataTransfer.effectAllowed='copy';e.dataTransfer.setDragImage(dragImage,dragImage.naturalWidth/2,dragImage.naturalHeight/2);window.dispatchEvent(new Event('turret-drag-start'));};
      tile.ondragend=()=>{turretLibrary.dragged=null;window.dispatchEvent(new Event('turret-drag-end'));};
      const preview=document.createElement('canvas');preview.width=120;preview.height=80;tile.append(preview);thumbnail(preview,asset);
      // An image uses its decoded bitmap for native dragging, rather than a
      // DOM snapshot that can include the card's background and sibling controls.
      const dragCanvas=document.createElement('canvas');dragCanvas.width=120;dragCanvas.height=80;
      dragCanvas.getContext('2d').drawImage(preview,0,0,120,80);
      const dragImage=new Image();dragImage.src=dragCanvas.toDataURL('image/png');
      tile.onclick=()=>{turretLibrary.selectedId=asset.id;emit(true);changed();};
      tile.ondblclick=()=>openTurretWorkspace(asset,async draft=>{await records(draft);turretLibrary.assets=turretLibrary.assets.map(a=>a.id===draft.id?draft:a);emit();changed();});
      const name=document.createElement('span');name.className='turret-asset-name';name.textContent=asset.name;name.tabIndex=0;name.title='Double-click or double-tap to rename; F2 also renames';
      let editing=false,lastTap=0;
      const rename=()=>{
        if(editing)return;editing=true;tile.draggable=false;
        const input=document.createElement('input');input.className='turret-asset-name-input';input.value=asset.name;input.maxLength=100;input.setAttribute('aria-label','Rename '+asset.name);name.replaceWith(input);input.focus();input.select();
        let finished=false;
        const finish=async(cancel=false)=>{
          if(finished)return;finished=true;
          const value=input.value.trim();
          if(cancel||!value||value===asset.name){input.replaceWith(name);editing=false;tile.draggable=true;name.focus();return;}
          input.disabled=true;
          try{const next={...asset,name:value};await records(next);turretLibrary.assets=turretLibrary.assets.map(a=>a.id===next.id?next:a);emit();changed();}catch(e){error=e.message;draw();}
        };
        input.onkeydown=e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();finish(e.key==='Escape');}};input.onblur=()=>finish();
      };
      name.ondblclick=rename;name.onkeydown=e=>{if(e.key==='F2'||e.key==='Enter'){e.preventDefault();rename();}};
      name.onpointerup=e=>{if(e.pointerType==='touch'){const now=performance.now();if(lastTap&&now-lastTap<400)rename();lastTap=now;}};
      const remove=document.createElement('button');remove.className='turret-asset-remove';remove.textContent='×';remove.setAttribute('aria-label','Remove '+asset.name+' from library');remove.title='Remove from library; mounted copies remain on ships';
      remove.onclick=async()=>{remove.disabled=true;try{await records(asset,true);turretLibrary.assets=turretLibrary.assets.filter(a=>a.id!==asset.id);if(turretLibrary.selectedId===asset.id)turretLibrary.selectedId=null;emit();changed();}catch(e){error=e.message;draw();}};
      card.append(tile,name,remove);grid.append(card);
    }
    const add=document.createElement('button');add.className='turret-asset-tile turret-import';add.textContent='+';add.title='Import turret XML';add.setAttribute('aria-label','Import turret XML');add.disabled=busy;grid.append(add);
    const input=document.createElement('input');input.type='file';input.accept='.xml';input.hidden=true;host.append(input);add.onclick=()=>input.click();
    input.onchange=async()=>{const file=input.files[0];if(!file)return;busy=true;error='';draw();try{const asset=importTurretXml(await file.text(),file.name,crypto.randomUUID());const saved=await addTurretAsset(asset);turretLibrary.selectedId=saved.id;if(saved.id!==asset.id)error='Already imported: '+saved.name;changed();}catch(e){error=e.message;}finally{busy=false;emit();}};
    const status=document.createElement('p');status.className='panel-note';status.setAttribute('role','status');status.textContent=error||(busy?'Importing turret…':'Turret assets · Saved in this browser');host.append(status);host.scrollTop=scrollTop;host.scrollLeft=scrollLeft;
  };
  listeners.add(draw);draw();loadTurretLibrary().catch(e=>{error=e.message;draw();});
  return {dispose(){disposed=true;listeners.delete(draw);}};
}
