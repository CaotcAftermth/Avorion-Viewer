import {thumbnail} from './turrets/thumbnail.js';

export function openAssetMoveDialog({assets,path,move}){
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='asset-move-dialog';dialog.setAttribute('aria-label','Move from library');
 dialog.innerHTML='<header><h2>Move from library</h2><button type="button" class="icon-button" aria-label="Close move dialog">×</button></header><p class="asset-move-destination"></p><div class="asset-move-tools"><button type="button" data-all>Select all</button><button type="button" data-clear>Clear selection</button><span aria-live="polite" data-count></span></div><div class="asset-move-grid"></div><p role="status"></p><footer><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-move disabled>Move selected</button></footer>';
 dialog.querySelector('.asset-move-destination').textContent='Destination: '+path;
 const grid=dialog.querySelector('.asset-move-grid'),confirm=dialog.querySelector('[data-move]'),status=dialog.querySelector('[role=status]'),selected=new Set(),cards=new Map();let busy=false;
 function sync(){for(const [id,card] of cards)card.setAttribute('aria-pressed',String(selected.has(id)));dialog.querySelector('[data-count]').textContent=selected.size+' selected';confirm.disabled=busy||!selected.size;dialog.querySelector('[data-all]').disabled=busy||!cards.size;dialog.querySelector('[data-clear]').disabled=busy||!selected.size;}
 function close(){if(busy)return;dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();}
 for(const asset of assets.filter(a=>!a.folder)){
  const card=document.createElement('button');card.type='button';card.className='asset-move-card';card.setAttribute('aria-label',asset.name);card.setAttribute('aria-pressed','false');
  const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;try{thumbnail(canvas,asset);}catch{}
  const name=document.createElement('span');name.textContent=asset.name;card.append(canvas,name);card.onclick=()=>{if(busy)return;selected.has(asset.id)?selected.delete(asset.id):selected.add(asset.id);sync();};cards.set(asset.id,card);grid.append(card);
 }
 if(!cards.size)status.textContent='No top-level assets to move.';
 dialog.querySelector('[data-all]').onclick=()=>{for(const id of cards.keys())selected.add(id);sync();};dialog.querySelector('[data-clear]').onclick=()=>{selected.clear();sync();};
 confirm.onclick=async()=>{
  if(busy||!selected.size)return;busy=true;sync();let moved=0;const failures=[];
  for(const asset of assets.filter(a=>selected.has(a.id))){try{await move({...asset,folder:path});cards.get(asset.id)?.remove();cards.delete(asset.id);selected.delete(asset.id);moved++;}catch(error){failures.push(asset.name+': '+error.message);}}
  busy=false;sync();if(!failures.length){close();return;}status.textContent=`Moved ${moved}. `+failures.join('; ');
 };
 dialog.querySelector('[data-cancel]').onclick=close;dialog.querySelector('.icon-button').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};
 dialog.onclick=event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))close();};
 document.body.append(dialog);sync();dialog.showModal();return {close};
}
