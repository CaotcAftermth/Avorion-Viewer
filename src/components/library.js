import {revisedAsset} from '../attachments/lifecycle.js';
import {thumbnail} from '../turrets/thumbnail.js';
import {importComponent,validateComponent} from './core.js';
import {subscribeComponents,loadComponents,saveComponents} from './storage.js';
import {openComponentWorkspace} from './workspace.js';

// Shared by the Asset Library grid, the Properties Components tab and the viewport drop target.
export const componentLibrary={assets:[],selectedId:null,dragged:null,loaded:false,error:'',query:'',folder:''};
const listeners=new Set();
const emit=(selectionOnly=false)=>listeners.forEach(fn=>fn(selectionOnly));
subscribeComponents(assets=>{componentLibrary.assets=assets;emit();});
let ready;
export function loadComponentLibrary(){
 return ready??=loadComponents().then(assets=>{componentLibrary.assets=assets;componentLibrary.loaded=true;emit();return assets;}).catch(error=>{ready=null;componentLibrary.error=error.message;emit();throw error;});
}
export const selectedComponent=()=>componentLibrary.assets.find(a=>a.id===componentLibrary.selectedId)||null;
export function selectComponent(id){componentLibrary.selectedId=id;emit(true);}
export async function updateComponentAsset(next){await loadComponentLibrary();next=revisedAsset(next,componentLibrary.assets.find(a=>a.id===next.id));await saveComponents(componentLibrary.assets.map(a=>a.id===next.id?next:a));}
export async function removeComponentAsset(asset){await loadComponentLibrary();await saveComponents(componentLibrary.assets.filter(a=>a.id!==asset.id));if(componentLibrary.selectedId===asset.id)componentLibrary.selectedId=null;emit();}
export async function addComponentAsset(asset,{force=false}={}){
 await loadComponentLibrary();
 const existing=componentLibrary.assets.find(a=>a.sourceXml===asset.sourceXml);if(existing&&!force)return existing;
 asset=revisedAsset(asset);await saveComponents([...componentLibrary.assets,asset]);return asset;
}
export function subscribeComponentLibrary(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
// Packs share a set of components between browsers or people.
export const componentPackFile=assets=>JSON.stringify({format:'avorion-viewer-component-pack',version:1,assets},null,1);
export async function importComponentPack(text){
 const file=JSON.parse(text);if(file?.format!=='avorion-viewer-component-pack'||file.version!==1||!Array.isArray(file.assets))throw Error('Not a component pack file.');
 await loadComponentLibrary();const known=new Set(componentLibrary.assets.map(a=>a.sourceXml)),ids=new Set(componentLibrary.assets.map(a=>a.id)),added=[];
 for(const raw of file.assets){const asset=validateComponent(structuredClone(raw));if(known.has(asset.sourceXml))continue;if(ids.has(asset.id))asset.id=crypto.randomUUID();known.add(asset.sourceXml);ids.add(asset.id);added.push(asset);}
 if(added.length)await saveComponents([...componentLibrary.assets,...added]);return {added:added.length,skipped:file.assets.length-added.length};
}
const fold=text=>String(text||'').toLowerCase();
export function filteredComponents(){
 const terms=fold(componentLibrary.query).split(/\s+/).filter(Boolean),folder=componentLibrary.folder;
 return componentLibrary.assets.filter(a=>(folder===''||(folder==='\0unfiled'?!a.folder:a.folder===folder))&&terms.every(t=>[a.name,a.folder,...(a.tags||[])].some(v=>fold(v).includes(t))));
}

// Same cards as the turret library: gray tile with a preview, editable name, hover ×, and a + tile to import.
export function mountComponentLibrary(host,changed){
 host.classList.add('turret-library','component-library');let error='',busy=false,disposed=false;
 const draw=(selectionOnly=false)=>{
  if(disposed)return;
  if(selectionOnly){for(const tile of host.querySelectorAll('[data-asset-id]'))tile.setAttribute('aria-pressed',String(tile.dataset.assetId===componentLibrary.selectedId));return;}
  const scrollTop=host.scrollTop,scrollLeft=host.scrollLeft,focused=document.activeElement?.dataset?.componentTool;host.replaceChildren();
  // Search, folder filter and pack import/export.
  const tools=document.createElement('div');tools.className='component-library-tools';host.append(tools);
  const search=document.createElement('input');search.type='search';search.placeholder='Search components';search.setAttribute('aria-label','Search components');search.value=componentLibrary.query;search.dataset.componentTool='search';search.oninput=()=>{componentLibrary.query=search.value;draw();};
  const exportPack=document.createElement('button');exportPack.type='button';exportPack.textContent='Export pack';exportPack.title='Save the components shown here as a pack file';exportPack.disabled=!componentLibrary.assets.length;
  exportPack.onclick=()=>{const list=filteredComponents();const url=URL.createObjectURL(new Blob([componentPackFile(list)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='avorion-components.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const importPack=document.createElement('button');importPack.type='button';importPack.textContent='Import pack';importPack.title='Add components from a pack file';
  const packInput=document.createElement('input');packInput.type='file';packInput.accept='.json';packInput.hidden=true;importPack.onclick=()=>packInput.click();
  packInput.onchange=async()=>{const file=packInput.files[0];if(!file)return;busy=true;error='';draw();try{const {added,skipped}=await importComponentPack(await file.text());error=`Imported ${added} component${added===1?'':'s'}${skipped?`, skipped ${skipped} already in the library`:''}.`;changed();}catch(e){error=e.message;}finally{busy=false;draw();}};
  componentLibrary.folder='';
  exportPack.textContent='Export Shown Components (.json)';importPack.textContent='Import Component Pack (.json)';
  const files=document.createElement('details');files.className='component-library-files';const title=document.createElement('summary');title.textContent='Library Files';files.append(title,exportPack,importPack,packInput);
  tools.append(search,files);if(focused==='search'){search.focus();search.setSelectionRange(search.value.length,search.value.length);}
  const shown=filteredComponents(),groups=new Map();for(const asset of shown){const key=asset.folder||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(asset);}
  const keys=[...groups.keys()].sort((a,b)=>a===''?1:b===''?-1:a.localeCompare(b)),grouped=keys.length>1||keys[0]&&keys[0]!=='';
  let grid;const newGrid=label=>{if(label!==undefined){const heading=document.createElement('h3');heading.className='component-folder-heading';heading.textContent=label;host.append(heading);}grid=document.createElement('div');grid.className='turret-asset-grid';host.append(grid);};
  if(!grouped)newGrid();
  for(const key of grouped?keys:[keys[0]??''])for(const [index,asset] of (groups.get(key)||[]).entries()){
   if(grouped&&index===0)newGrid(key||'Unfiled');
   const card=document.createElement('div');card.className='turret-asset-card';
   const tile=document.createElement('button');tile.type='button';tile.className='turret-asset-tile';tile.dataset.assetId=asset.id;tile.setAttribute('aria-label',asset.name);tile.setAttribute('aria-pressed',String(asset.id===componentLibrary.selectedId));tile.draggable=true;
   tile.title=[asset.folder&&'Folder: '+asset.folder,asset.tags?.length&&'Tags: '+asset.tags.join(', '),'Click to edit in Properties › Components · Double-click to open · Drag onto a component socket in the viewport'].filter(Boolean).join('\n');
   const preview=document.createElement('canvas');preview.width=120;preview.height=80;tile.append(preview);
   try{thumbnail(preview,asset);}catch{}
   const dragCanvas=document.createElement('canvas');dragCanvas.width=120;dragCanvas.height=80;dragCanvas.getContext('2d').drawImage(preview,0,0,120,80);
   const dragImage=new Image();dragImage.src=dragCanvas.toDataURL('image/png');
   tile.ondragstart=e=>{componentLibrary.dragged=asset;e.dataTransfer.setData('application/x-avorion-component',asset.id);e.dataTransfer.effectAllowed='copy';if(dragImage.complete&&dragImage.naturalWidth)e.dataTransfer.setDragImage(dragImage,dragImage.naturalWidth/2,dragImage.naturalHeight/2);window.dispatchEvent(new Event('component-drag-start'));};
   tile.ondragend=()=>{componentLibrary.dragged=null;window.dispatchEvent(new Event('component-drag-end'));};
   tile.onclick=()=>{selectComponent(asset.id);changed();};
   tile.ondblclick=()=>openComponentWorkspace(asset,async draft=>{await updateComponentAsset(draft);changed();});
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
     try{await updateComponentAsset({...asset,name:value});changed();}catch(e){error=e.message;draw();}
    };
    input.onkeydown=e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();finish(e.key==='Escape');}};input.onblur=()=>finish();
   };
   name.ondblclick=rename;name.onkeydown=e=>{if(e.key==='F2'||e.key==='Enter'){e.preventDefault();rename();}};
   name.onpointerup=e=>{if(e.pointerType==='touch'){const now=performance.now();if(lastTap&&now-lastTap<400)rename();lastTap=now;}};
   const remove=document.createElement('button');remove.type='button';remove.className='turret-asset-remove';remove.textContent='×';remove.setAttribute('aria-label','Remove '+asset.name+' from library');remove.title='Remove from library; mounted copies remain on ships';
   remove.onclick=async()=>{remove.disabled=true;try{await removeComponentAsset(asset);changed();}catch(e){error=e.message;draw();}};
   card.append(tile,name,remove);grid.append(card);
  }
  if(!grid)newGrid();
  if(!shown.length&&componentLibrary.assets.length){const none=document.createElement('p');none.className='panel-note';none.textContent='No components match.';grid.before(none);}
  const add=document.createElement('button');add.type='button';add.className='turret-asset-tile turret-import';add.textContent='Add XML';add.title='Add Component XML and set its attachment point';add.setAttribute('aria-label','Import component XML');add.disabled=busy;grid.append(add);
  const input=document.createElement('input');input.type='file';input.accept='.xml';input.hidden=true;host.append(input);add.onclick=()=>input.click();
  input.onchange=async()=>{const file=input.files[0];if(!file)return;busy=true;error='';draw();try{const asset=importComponent(await file.text(),file.name.replace(/\.xml$/i,''));const saved=await addComponentAsset(asset);componentLibrary.selectedId=saved.id;if(saved.id!==asset.id)error='Already imported: '+saved.name;changed();if(saved.id===asset.id)openComponentWorkspace(saved,async next=>{await updateComponentAsset(next);changed();});}catch(e){error=e.message;}finally{busy=false;draw();}};
  const status=document.createElement('p');status.className='panel-note';status.setAttribute('role','status');status.textContent=error||componentLibrary.error||(busy?'Importing component…':'Component assets · Saved in this browser');host.append(status);host.scrollTop=scrollTop;host.scrollLeft=scrollLeft;
 };
 listeners.add(draw);draw();loadComponentLibrary().catch(e=>{error=e.message;draw();});
 return {dispose(){disposed=true;listeners.delete(draw);}};
}
