import {icon} from './icons.js';
export const folderCompare=(a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});
export function groupAssetCards(grid,{path='',navigate=()=>{},assets=[]}={}){
 // Neutralize cool pixels while retaining the original warm stripe and white edge.
 if(!document.getElementById('asset-folder-charcoal')){
  const filters=document.createElementNS('http://www.w3.org/2000/svg','svg');
  filters.setAttribute('aria-hidden','true');filters.style.cssText='position:absolute;width:0;height:0;pointer-events:none';
  filters.innerHTML='<defs><filter id="asset-folder-charcoal" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 -1 -1 .9 0"/><feComponentTransfer result="interior"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feFlood flood-color="#2a2a2a"/><feComposite in2="interior" operator="in"/><feComposite in2="SourceGraphic" operator="atop"/></filter></defs>';
  document.body.append(filters);
 }

 const prefix=path?path+'/':'',groups=new Set();
 for(const asset of assets){const folder=asset.folder||'';if(folder.startsWith(prefix)&&folder!==path){const child=folder.slice(prefix.length).split('/')[0];if(child)groups.add(child);}}
 for(const card of [...grid.children])if(card.classList.contains('turret-asset-card')&&(card.dataset.folder||'')!==path)card.remove();
 for(const name of [...groups].sort(folderCompare).reverse()){
  const folder=prefix+name,card=document.createElement('div');card.className='turret-asset-card asset-folder-card';card.dataset.folder=folder;
  const tile=document.createElement('button');tile.type='button';tile.className='turret-asset-tile asset-folder-tile';tile.setAttribute('aria-label','Open folder '+name);tile.onclick=()=>navigate(folder);
  const art=document.createElement('img');art.src=new URL('./assets/asset-folder.png',import.meta.url).href;art.alt='';
  const count=document.createElement('span');count.className='asset-folder-count';count.textContent=assets.filter(a=>a.folder===folder||a.folder?.startsWith(folder+'/')).length;count.setAttribute('aria-label',count.textContent+' files');
  tile.append(art,count);const label=document.createElement('span');label.className='turret-asset-name';label.textContent=name;card.append(tile,label);grid.prepend(card);
 }
 const header=grid.closest('.area')?.querySelector(':scope>.area-header')||grid.closest('.quick-asset-library')?.querySelector(':scope>header');
 if(header){
  header.querySelector('.asset-library-path')?.remove();header.querySelector('.asset-folder-up')?.remove();
  if(path){
   const nav=document.createElement('button');nav.type='button';nav.className='asset-library-path';nav.textContent='/ '+path;nav.title='/ '+path;nav.setAttribute('aria-label','Folder path: '+path);
   nav.onclick=async()=>{const {popover,closeViewportPopover}=await import('./viewport-controls.js');popover(nav,'Go to folder',menu=>{let current='';for(const part of ['',...path.split('/')]){current=part?(current?current+'/'+part:part):'';const target=current,b=document.createElement('button');b.type='button';b.textContent=current||'Asset Library';b.onclick=()=>{closeViewportPopover();navigate(target);};menu.append(b);}menu.classList.add('asset-import-menu');});};
   const up=document.createElement('button');up.type='button';up.className='asset-folder-up';up.innerHTML=icon('folderUp');up.title='Up one level';up.setAttribute('aria-label','Up one level');up.onclick=()=>navigate(path.split('/').slice(0,-1).join('/'));
   const title=header.querySelector('.header-name')||header.querySelector('strong');title?.after(up,nav);
  }
 }

}
export async function droppedXml(transfer){
 const entries=[...(transfer.items||[])].map(item=>item.webkitGetAsEntry?.()).filter(Boolean),out=[];
 async function walk(entry,prefix=''){
  if(entry.isFile){if(/\.xml$/i.test(entry.name))out.push({file:await new Promise((resolve,reject)=>entry.file(resolve,reject)),folder:prefix});return;}
  if(entry.isDirectory){const reader=entry.createReader();let batch;do{batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));for(const child of batch)await walk(child,prefix?prefix+'/'+entry.name:entry.name);}while(batch.length);}
 }
 if(entries.length)for(const entry of entries)await walk(entry);else for(const file of transfer.files||[])if(/\.xml$/i.test(file.name))out.push({file,folder:''});
 return out;
}
export function assetImportTile(add,host,importItems,{path='',assets=[],move}={}){
 const run=items=>importItems(items.map(item=>({...item,folder:[path,item.folder].filter(Boolean).join('/')})));
 const files=document.createElement('input'),folder=document.createElement('input');
 for(const input of [files,folder]){input.type='file';input.accept='.xml';input.multiple=true;input.hidden=true;host.append(input);input.onchange=()=>{const items=[...input.files].filter(f=>/\.xml$/i.test(f.name)).map(file=>({file,folder:file.webkitRelativePath?.split('/').slice(0,-1).join('/')||''}));if(items.length)run(items);};}
 folder.webkitdirectory=true;
 add.onclick=async()=>{const {popover,closeViewportPopover}=await import('./viewport-controls.js');popover(add,'Import assets',el=>{el.classList.add('asset-import-menu');el.querySelector('.popover-title')?.remove();for(const [label,input,glyph] of [['Import XML files…',files,'assetXml'],['Import folder…',folder,'folder']]){const b=document.createElement('button');b.type='button';b.innerHTML=icon(glyph);const text=document.createElement('span');text.textContent=label;b.append(text);b.onclick=()=>{closeViewportPopover();input.click();};el.append(b);}if(path&&move){const b=document.createElement('button');b.type='button';b.innerHTML=icon('assetMove');const text=document.createElement('span');text.textContent='Move from library…';b.append(text);b.onclick=async()=>{closeViewportPopover();const {openAssetMoveDialog}=await import('./asset-move-dialog.js');openAssetMoveDialog({assets,path,move});};el.append(b);}});};
 add.ondragover=event=>{if([...event.dataTransfer.types].includes('Files')){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';}};
 add.ondrop=async event=>{event.preventDefault();event.stopPropagation();try{const items=await droppedXml(event.dataTransfer);if(items.length)await run(items);}catch(error){console.error('Asset folder import failed',error);}};
}
