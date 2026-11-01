import {mountPoseEditor,mountFireControls} from './editors.js';
import {placeFromLibrary} from './placement.js';
import {mounts,mountHistory,canMountHistory,removeTurret} from './mounts.js';
import {sceneSockets} from './sockets.js';
import {turretLibrary} from './library.js';
export function mountTurretProperties(host,scene,changed,canAttach=()=>false,showFireView=()=>{}){
  const state=scene.turretSockets??={show:false,scope:'selected',selectedId:null};
  host.innerHTML='<details class="panel" open><summary>Turret sockets</summary><label class="field-row">Show sockets<input type="checkbox" data-show></label><label class="field-row">Show through geometry<input type="checkbox" data-through></label><label class="field-row">Scope<select data-scope aria-label="Socket scope"><option value="selected">Selected blocks</option><option value="all">All turret blocks</option></select></label><label class="field-row">Socket<select data-socket aria-label="Turret socket"></select></label><div data-detail class="panel-note"></div><p class="panel-note">Choose Select Sockets in the viewport mode menu to select sockets without highlighting blocks.</p></details>';
  const show=host.querySelector('[data-show]');show.checked=state.show;show.onchange=()=>{state.show=show.checked;changed();};
  const through=host.querySelector('[data-through]');through.checked=!!state.through;through.onchange=()=>{state.through=through.checked;changed();};
  const scope=host.querySelector('[data-scope]');scope.value=state.scope;scope.onchange=()=>{state.scope=scope.value;changed();};
  const sockets=sceneSockets(scene).filter(s=>s.fitSize!=null&&!scene.hiddenIds?.has(s.blockId)&&(s.id===state.selectedId||state.scope==='all'||scene.selectedIds?.has(s.blockId))),select=host.querySelector('[data-socket]');select.add(new Option(sockets.length?'Choose socket':'No turret blocks in scope',''));
  for(const s of sockets)select.add(new Option(`${s.blockId} · ${s.name}`,s.id));select.value=state.selectedId||'';
  select.onchange=()=>{state.selectedId=select.value||null;changed();};
  const selected=sockets.find(s=>s.id===state.selectedId);host.querySelector('[data-detail]').textContent=selected?`Type: turret · Block: ${selected.blockId} · ${selected.name} · ${mounts(scene).some(m=>m.socketId===selected.id)?'Occupied':'Unoccupied'} · Normal: ${selected.normal.map(n=>n.toFixed(2)).join(', ')}`:`${sockets.length} candidate sockets`;
  const mounted=mounts(scene).find(m=>m.id===scene.selectedTurretId);if(mounted){const info=document.createElement('p');info.className='panel-note';info.textContent='Selected turret: '+mounted.asset.name+' · Size '+mounted.turretSize;host.append(info);}
  mountFireControls(host,scene,changed,showFireView);
  mountPoseEditor(host,scene,changed);
  const asset=turretLibrary.assets.find(a=>a.id===turretLibrary.selectedId),occupied=selected&&mounts(scene).some(m=>m.socketId===selected.id);
  const addButton=(label,disabled,action)=>{const b=document.createElement('button');b.className='setting-button';b.textContent=label;b.disabled=disabled;b.onclick=action;host.append(b);};
  addButton('Attach selected asset',!asset||!selected||occupied||!canAttach(selected),()=>placeFromLibrary(scene,asset,selected,changed));
  if(scene.turretPlacementError){const note=document.createElement('p');note.className='panel-note';note.setAttribute('role','status');note.textContent=scene.turretPlacementError;host.append(note);}
  addButton('Detach turret',!occupied,()=>{removeTurret(scene,selected.id);changed();});
  addButton('Undo attachment',!canMountHistory(scene),()=>{mountHistory(scene);changed();});
  addButton('Redo attachment',!canMountHistory(scene,true),()=>{mountHistory(scene,true);changed();});
}
