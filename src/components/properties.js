import {propertyPanel,propertyDataRow,propertyNote,propertyAction} from '../property-ui.js';
import {previewSetupImport} from '../attachments/lifecycle-controls.js';
import {componentLibrary,loadComponentLibrary,selectedComponent,updateComponentAsset,removeComponentAsset} from './library.js';
import {openComponentWorkspace} from './workspace.js';
import {componentSetup,componentSockets} from './core.js';
import {changeSetup,assignComponent,detachSurfaceComponent,rotateSurfaceComponent,componentHistory,canComponentHistory} from './mounting.js';
import {componentSetupFile,parseComponentSetupFile} from './storage.js';
import {bakeComponentsXml} from './bake.js';
export function mountComponentProperties(host,scene,changed,context=scene.attachmentContext){
 let busy=false;
 const status=document.createElement('p');status.className='panel-note';status.setAttribute('role','status');
 const run=async task=>{if(busy)return;busy=true;try{await task();changed();}catch(error){status.textContent=error.message;}finally{busy=false;}};
 const action=(parent,label,task,disabled=false)=>propertyAction(parent,label,()=>run(task),disabled);
 const picker=(parent,label,options,value,task)=>{const row=document.createElement('label');row.className='field-row';row.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);for(const [id,name] of options)select.add(new Option(name,id));select.value=value||'';select.onchange=()=>task(select.value);row.append(select);parent.append(row);return select;};
 const download=(text,name,type)=>{const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 if(!componentLibrary.loaded&&!componentLibrary.error)loadComponentLibrary().then(changed).catch(error=>{status.textContent=error.message;});
 const draft=scene.componentAttachmentDraft;
 if(draft){
  const panel=propertyPanel(host,'Attachment Point',true);
  propertyNote(panel,'Choose the face where this component meets a ship socket. Save asset commits the attachment point; Cancel discards changes.');
  propertyAction(panel,scene.pickAttachment?'Click a face in the viewport…':'Set Attachment Point',()=>{scene.pickAttachment=!scene.pickAttachment;changed();});
  propertyNote(panel,'The preview marks the connection point and direction into the component.');host.append(status);return;
 }
 const asset=context?.kind==='library'?componentLibrary.assets.find(a=>a.id===context.id):selectedComponent();
 if(context?.kind==='library'||!scene.loaded){
  const panel=propertyPanel(host,'Component Asset',true);
  if(!asset)propertyNote(panel,'Add Component XML in the Asset Library, then select a component.');
  else{
   const row=document.createElement('label');row.className='field-row';row.textContent='Name';const input=document.createElement('input');input.value=asset.name;input.setAttribute('aria-label','Component name');input.onchange=()=>run(()=>{if(!input.value.trim())throw Error('Enter a component name.');return updateComponentAsset({...asset,name:input.value.trim()});});row.append(input);panel.append(row);
   action(panel,'Set Attachment Point',()=>openComponentWorkspace(asset,async next=>{await updateComponentAsset(next);changed();}));
   action(panel,'Remove from Library',()=>removeComponentAsset(asset));propertyNote(panel,'Drag this component onto a ship socket. Library edits do not change mounted copies.');
  }
  host.append(status);return;
 }
 const model=scene.model,setup=componentSetup(model),sockets=componentSockets(scene);
 const mounted=context?.kind==='instance'?setup.mounts.find(m=>m.id===context.id):setup.mounts.find(m=>m.id===scene.selectedComponentMountId);
 const socketId=mounted?.socketId||(context?.kind==='socket'?context.id:scene.selectedComponentSocketId),socket=sockets.find(s=>s.id===socketId),mount=mounted||setup.mounts.find(m=>m.socketId===socketId);
 const panel=propertyPanel(host,'Component Socket',true);
 picker(panel,'Socket',[['','Choose a socket…'],...sockets.map(s=>[s.id,s.name])],socketId,id=>window.dispatchEvent(new CustomEvent('component-socket-select',{detail:id})));
 if(!socket)propertyNote(panel,'Use Select Sockets, right-click a model face, then choose Add Component Socket.');
 else{
  propertyDataRow(panel,'Status',mount?'Occupied':'Empty');propertyDataRow(panel,['Mounting','block'],socket.blockId||'Legacy free socket');
  action(panel,'Edit Position',()=>window.dispatchEvent(new CustomEvent('component-socket-edit',{detail:socket.id})),!setup.sockets.some(s=>s.id===socket.id));
  const choice=picker(panel,'Component',[['','Choose a component…'],...componentLibrary.assets.map(a=>[a.id,a.name])],asset?.id||mount?.asset.id,()=>{});
  action(panel,mount?'Replace Component':'Attach Component',()=>{const selected=componentLibrary.assets.find(a=>a.id===choice.value);if(!selected)throw Error('Choose a component first.');return changeSetup(scene,assignComponent(scene,selected,socket));},!componentLibrary.assets.length);
  if(mount){
   propertyDataRow(panel,'Attached component',mount.name||mount.asset.name);propertyDataRow(panel,'Rotation',`${mount.twist||0}°`);
   action(panel,'−90°',()=>changeSetup(scene,rotateSurfaceComponent(scene,mount,-1)));action(panel,'+90°',()=>changeSetup(scene,rotateSurfaceComponent(scene,mount,1)));
   action(panel,'Detach Component',()=>changeSetup(scene,detachSurfaceComponent(scene,mount)));
  }
  action(panel,'Delete Socket',()=>changeSetup(scene,{...setup,sockets:setup.sockets.filter(s=>s.id!==socket.id)}),!!mount||!setup.sockets.some(s=>s.id===socket.id));
  if(mount)propertyNote(panel,'Detach the component before deleting its socket. Imported component dimensions are retained.');
 }
 const history=propertyPanel(host,'History');action(history,'Undo',()=>componentHistory(scene),!canComponentHistory(scene));action(history,'Redo',()=>componentHistory(scene,true),!canComponentHistory(scene,true));
 const files=propertyPanel(host,'Ship Component Files');
 action(files,'Save Ship XML with Components',()=>{const {text}=bakeComponentsXml(scene);download(text,model.fileName.replace(/\.xml$/i,'')+'-with-components.xml','application/xml');},!setup.mounts.length);
 action(files,'Export Ship Component Setup (.json)',()=>download(componentSetupFile(model),model.fileName.replace(/\.xml$/i,'')+'-components.json','application/json'));
 action(files,'Import Ship Component Setup (.json)',()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=()=>run(async()=>{if(input.files[0])previewSetupImport(scene,parseComponentSetupFile(await input.files[0].text()),changed);});input.click();});
 propertyNote(files,'Sockets and attached components save locally with this ship. Ship XML writes a copy for Avorion; JSON backs up the editable setup.');
 host.append(status);
}
