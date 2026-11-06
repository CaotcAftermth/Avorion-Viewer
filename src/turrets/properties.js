import {mountLifecycleControls} from '../attachments/lifecycle-controls.js';
import {mountPoseEditor} from './editors.js';
import {mountAimingControls} from './coverage-ui.js';
import {placeFromLibrary} from './placement.js';
import {mounts,mountHistory,canMountHistory,removeTurret} from './mounts.js';
import {sceneSockets} from './sockets.js';
import {turretLibrary} from './library.js';
import {liveBlocks,nativeItemIndex} from '../ship-structure.js';
import {propertyPanel,propertyNote,propertyAction,propertyDataRow} from '../property-ui.js';
export function mountTurretProperties(host,scene,changed,canAttach=()=>false){
 const state=scene.turretSockets??={};state.scope??='selected';state.selectedId??=null;
 const display=propertyPanel(host,'Socket Display',true);
 display.innerHTML+='<label class="field-row">Show Through Geometry<input type="checkbox" data-through></label><label class="field-row">Socket Scope<select data-scope aria-label="Socket scope"><option value="selected">Selected Turret Blocks</option><option value="all">All Turret Blocks</option></select></label>';
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
 if(mounted){
  const info=propertyPanel(host,'Selected Turret',true);
  mountLifecycleControls(info,scene,'turret',mounted,changed,{inline:true});
  mountPoseEditor(host,scene,changed,candidates);
  mountAimingControls(propertyPanel(host,'Aiming Configuration'),scene,changed);
 }
 const details=propertyPanel(host,'Socket Details');
 const socket=selected||candidates.find(s=>s.id===mounted?.socketId);
 if(socket){
  const block=liveBlocks(scene).find(b=>b.id===socket.blockId);
  const group=(label,rows)=>{
   const section=document.createElement('section');section.className='socket-detail-group';
   const heading=document.createElement('h4');heading.textContent=label;section.append(heading);
   for(const [name,value] of rows)propertyDataRow(section,name,value);
   details.append(section);
  };
  group('Block',[['ID',socket.blockId],['Index',nativeItemIndex(block)??'—'],['Type/Index',block?`${block.type} · ${block.typeIndex}`:'—']]);
  const inUse=mounts(scene).some(m=>m.socketId===socket.id);
  group('Socket',[['ID',socket.id],['Socket Face',socket.faceId+1],['Status',inUse?'Occupied':socket.fitSize==null?'Unavailable':'Available'],['Normal',socket.normal.map(n=>n.toFixed(2)).join(', ')]]);
 }
 else propertyNote(details,`${sockets.length} candidate sockets. Choose Select Sockets in the viewport to select sockets without highlighting blocks.`);
}
