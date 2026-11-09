import {mountSocketName} from './socket-name.js';
import {withoutSocket,assetAttachment} from './asset-sockets.js';
import {propertyPanel,propertyDataRow,propertyNote,propertyAction} from '../property-ui.js';
import {previewSetupImport} from '../attachments/lifecycle-controls.js';
import {componentLibrary,loadComponentLibrary,selectedComponent,updateComponentAsset,removeComponentAsset} from './library.js';
import {openComponentWorkspace} from './workspace.js';
import {componentSetup,componentSockets} from './core.js';
import {changeSetup,assignComponent,detachSurfaceComponent,rotateSurfaceComponent} from './mounting.js';
import {componentSetupFile,parseComponentSetupFile} from './storage.js';
import {bakeComponentsXml} from './bake.js';
export function mountComponentProperties(host,scene,changed,context=scene.attachmentContext){
 let busy=false;
 const status=document.createElement('p');status.className='panel-note';status.setAttribute('role','status');
 const run=async task=>{if(busy)return;busy=true;try{await task();changed();}catch(error){status.textContent=error.message;}finally{busy=false;}};
 const action=(parent,label,task,disabled=false)=>propertyAction(parent,label,()=>run(task),disabled);
 const picker=(parent,label,options,value,task)=>{const row=document.createElement('label');row.className='field-row';row.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);for(const [id,name] of options)select.add(new Option(name,id));select.value=value??'';select.onchange=()=>task(select.value);row.append(select);parent.append(row);return select;};
 const download=(text,name,type)=>{const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 if(!componentLibrary.loaded&&!componentLibrary.error)loadComponentLibrary().then(changed).catch(error=>{status.textContent=error.message;});
 const draft=scene.componentAttachmentDraft;
 if(draft){
  const panel=propertyPanel(host,'Attachment Point',true),setup=componentSetup(scene.model),primary=setup.sockets.find(s=>s.id===setup.attachmentSocketId);
  propertyDataRow(panel,'Status',primary?primary.name:assetAttachment(scene)?'Legacy attachment point':'Not assigned');
  propertyAction(panel,'Set Attachment Point',()=>window.dispatchEvent(new CustomEvent('component-socket-add',{detail:{attachmentPoint:true}})));
  propertyNote(panel,'Add and refine sockets in the viewport. Right-click a socket to make it the attachment point. Save asset keeps all sockets; Cancel discards these edits.');
 }
 const asset=context?.kind==='library'?componentLibrary.assets.find(a=>a.id===context.id):selectedComponent();
 if(!draft&&(context?.kind==='library'||!scene.loaded)){
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
 const creation=propertyPanel(host,'Create Sockets',true);
 propertyAction(creation,'Add Socket',()=>window.dispatchEvent(new CustomEvent('component-socket-add',{detail:{blockId:model.blocks.find(b=>!b.deleted&&b.id===(scene.selectedId||[...(scene.selectedIds||[])].at(-1)))?.id}})));
 const types=[...new Map(model.blocks.filter(b=>!b.deleted).map(b=>[b.typeIndex,b.type||String(b.typeIndex)])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
 const type=picker(creation,'Block type',types,types[0]?.[0],()=>{});
 propertyAction(creation,'Add Sockets to Block Type',()=>window.dispatchEvent(new CustomEvent('component-socket-add',{detail:{blockType:Number(type.value)}})),!types.length);
 propertyNote(creation,'Choose one face to repeat at its center on matching blocks. Preview before placement; duplicates skipped. Maximum 100 new sockets per operation.');
 const panel=propertyPanel(host,'Component Socket',true);
 picker(panel,'Socket',[['','Choose a socket…'],...sockets.map(s=>[s.id,s.name])],socketId,id=>window.dispatchEvent(new CustomEvent('component-socket-select',{detail:{id,focus:true}})));
 if(!socket)propertyNote(panel,'Use Select Sockets, right-click a model face, then choose Add Component Socket.');
 else{
  const manual=setup.sockets.find(s=>s.id===socket.id);mountSocketName(panel,socket,name=>changeSetup(scene,{...setup,sockets:setup.sockets.map(s=>s.id===socket.id?{...s,name}:s)}).then(changed),{editable:!!manual,error:message=>status.textContent=message});
  const statusValue=propertyDataRow(panel,'Status',draft&&setup.attachmentSocketId===socket.id?'Attachment Point':mount?'Occupied':'Empty');statusValue.className='socket-readonly-value';const blockValue=propertyDataRow(panel,'Mounting block',socket.componentBlockId||socket.blockId||'Legacy free socket');blockValue.className='socket-readonly-value';
  action(panel,'Edit Position',()=>window.dispatchEvent(new CustomEvent('component-socket-edit',{detail:socket.id})),!setup.sockets.some(s=>s.id===socket.id));
  action(panel,'Edit Direction',()=>window.dispatchEvent(new CustomEvent('component-socket-direction',{detail:socket.id})),!manual);
  if(draft){action(panel,'Make Attachment Point',()=>changeSetup(scene,{...setup,attachmentSocketId:socket.id}),!manual||setup.attachmentSocketId===socket.id);}
  if(!draft){
  const choice=picker(panel,'Component',[['','Choose a component…'],...componentLibrary.assets.map(a=>[a.id,a.name])],asset?.id||mount?.asset.id,()=>{});
  action(panel,mount?'Replace Component':'Attach Component',()=>{const selected=componentLibrary.assets.find(a=>a.id===choice.value);if(!selected)throw Error('Choose a component first.');return changeSetup(scene,assignComponent(scene,selected,socket));},!componentLibrary.assets.length);
  if(mount){
   propertyDataRow(panel,'Attached component',mount.name||mount.asset.name);propertyDataRow(panel,'Rotation',`${mount.twist||0}°`);
   action(panel,'−90°',()=>changeSetup(scene,rotateSurfaceComponent(scene,mount,-1)));action(panel,'+90°',()=>changeSetup(scene,rotateSurfaceComponent(scene,mount,1)));
   action(panel,'Detach Component',()=>changeSetup(scene,detachSurfaceComponent(scene,mount)));
  }
  }
  action(panel,'Delete Socket',()=>changeSetup(scene,withoutSocket(setup,socket.id)),!!mount||!setup.sockets.some(s=>s.id===socket.id));
  if(mount)propertyNote(panel,'Detach the component before deleting its socket. Imported component dimensions are retained.');
 }
 if(draft){host.append(status);return;}
 const files=propertyPanel(host,'Ship Component Files');
 action(files,'Save Ship XML with Components',()=>{const {text}=bakeComponentsXml(scene);download(text,model.fileName.replace(/\.xml$/i,'')+'-with-components.xml','application/xml');},!setup.mounts.length);
 action(files,'Export Ship Component Setup (.json)',()=>download(componentSetupFile(model),model.fileName.replace(/\.xml$/i,'')+'-components.json','application/json'));
 action(files,'Import Ship Component Setup (.json)',()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=()=>run(async()=>{if(input.files[0])previewSetupImport(scene,parseComponentSetupFile(await input.files[0].text()),changed);});input.click();});
 propertyNote(files,'Sockets and attached components save locally with this ship. Ship XML writes a copy for Avorion; JSON backs up the editable setup.');
 host.append(status);
}
