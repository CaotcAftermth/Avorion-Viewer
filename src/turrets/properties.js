import {mountLifecycleControls} from '../attachments/lifecycle-controls.js';
import {mountPoseEditor} from './editors.js';
import {mountAimingControls} from './coverage-ui.js';
import {placeFromLibrary} from './placement.js';
import {mounts,mountHistory,canMountHistory,removeTurret} from './mounts.js';
import {sceneSockets} from './sockets.js';
import {turretLibrary} from './library.js';
import {propertyPanel,propertyNote,propertyAction} from '../property-ui.js';
export function mountTurretProperties(host,scene,changed,canAttach=()=>false,showFireView=()=>{},{editSource,selectOutliner}={}){
 const state=scene.turretSockets??={};state.show??=false;state.scope??='selected';state.selectedId??=null;
 const display=propertyPanel(host,'Socket Display',true);
 display.innerHTML+='<label class="field-row">Show Turret Sockets<input type="checkbox" data-show></label><label class="field-row">Show Through Geometry<input type="checkbox" data-through></label><label class="field-row">Socket Scope<select data-scope aria-label="Socket scope"><option value="selected">Selected Turret Blocks</option><option value="all">All Turret Blocks</option></select></label>';
 const show=display.querySelector('[data-show]');show.checked=state.show;show.onchange=()=>{state.show=show.checked;changed();};
 const through=display.querySelector('[data-through]');through.checked=!!state.through;through.onchange=()=>{state.through=through.checked;changed();};
 const scope=display.querySelector('[data-scope]');scope.value=state.scope;scope.onchange=()=>{state.scope=scope.value;changed();};
 const candidates=sceneSockets(scene),sockets=candidates.filter(s=>s.fitSize!=null&&!scene.hiddenIds?.has(s.blockId)&&(s.id===state.selectedId||state.scope==='all'||scene.selectedIds?.has(s.blockId)));
 const mounting=propertyPanel(host,'Mounting',true),row=document.createElement('label');row.className='field-row';row.textContent='Active Socket';const select=document.createElement('select');select.setAttribute('aria-label','Turret socket');row.append(select);mounting.append(row);
 select.add(new Option(sockets.length?'Choose socket':'No turret blocks in scope',''));for(const s of sockets)select.add(new Option(`${s.blockId} · ${s.name}`,s.id));select.value=state.selectedId||'';select.onchange=()=>{state.selectedId=select.value||null;changed();};
 const selected=candidates.find(s=>s.id===state.selectedId),occupied=selected&&mounts(scene).some(m=>m.socketId===selected.id),asset=turretLibrary.assets.find(a=>a.id===turretLibrary.selectedId);
 const reason=!selected?'Choose a turret socket.':occupied?'Socket already occupied.':!canAttach(selected)?'Socket is obscured or unavailable for attachment.':!asset?'Select an asset in the Asset Library.':!asset.sourceSize?'Asset has no authored size metadata.':'';
 propertyAction(mounting,'Attach selected asset',()=>placeFromLibrary(scene,asset,selected,changed),!!reason);
 propertyAction(mounting,'Detach turret',()=>{removeTurret(scene,selected.id);changed();},!occupied);
 propertyAction(mounting,'Undo attachment',()=>{mountHistory(scene);changed();},!canMountHistory(scene));propertyAction(mounting,'Redo attachment',()=>{mountHistory(scene,true);changed();},!canMountHistory(scene,true));
 if(reason)propertyNote(mounting,reason);if(scene.turretPlacementError){const error=propertyNote(mounting,scene.turretPlacementError);error.setAttribute('role','status');}
 const mounted=mounts(scene).find(m=>m.id===scene.selectedTurretId);
 if(mounted){const info=propertyPanel(host,'Selected Turret',true),count=scene.selectedTurretIds?.size||1;
  propertyNote(info,`${mounted.asset.name} · ${count} selected`);propertyNote(info,`Instance: ${mounted.name} (${mounted.id})`);propertyNote(info,`Socket: ${mounted.socketId} · Block: ${candidates.find(s=>s.id===mounted.socketId)?.blockId??'Unavailable'} · Attached`);
  propertyNote(info,'Pose edits affect mounted instances. Edit Source Asset opens a separate library asset.');
  if(selectOutliner)propertyAction(info,'Select in Outliner',selectOutliner);
  if(editSource){const available=turretLibrary.assets.some(a=>a.id===mounted.asset.id),button=propertyAction(info,'Edit Source Asset',()=>editSource(mounted.asset),!available);button.title=available?'Edit the independent library asset':'Source asset is not in the library. Mounted copies remain independent.';}
  mountLifecycleControls(info,scene,'turret',mounted,changed);mountPoseEditor(host,scene,changed);const aiming=propertyPanel(host,'Aiming Configuration');mountAimingControls(aiming,scene,changed);
 }
 const details=propertyPanel(host,'Socket Details');
 if(selected){propertyNote(details,`Socket: ${selected.id} · ${selected.name}`);propertyNote(details,`Owning block: ${selected.blockId} · ${occupied?'Occupied':'Available'}`);propertyNote(details,`Normal: ${selected.normal.map(n=>n.toFixed(2)).join(', ')}`);propertyNote(details,reason||'Eligible for attachment.');}
 else propertyNote(details,`${sockets.length} candidate sockets. Choose Select Sockets in the viewport to select sockets without highlighting blocks.`);
}
