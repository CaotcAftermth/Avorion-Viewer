import {mountSymmetryControls,symmetryAxesOrder} from '../symmetry-controls.js';
import {propertyPanel,propertyNote,propertyDataRow} from '../property-ui.js';
import {mountLifecycleControls,previewSetupImport} from '../attachments/lifecycle-controls.js';
import {BLOCK_DEFINITIONS} from '../block-model.js';
import {surfaceSockets} from '../turrets/sockets.js';
import {frame} from '../turrets/core.js';
import * as THREE from '../vendor/three.module.js';
import {componentSetup,componentSockets,savedSocket} from './core.js';
import {componentSetupFile,parseComponentSetupFile} from './storage.js';
import {componentLibrary,loadComponentLibrary,selectedComponent,updateComponentAsset,removeComponentAsset} from './library.js';
import {openComponentWorkspace} from './workspace.js';
import {beginComponentEdit,endComponentEdit,changeSetup,componentHistory,canComponentHistory,placeComponent,detachComponent,patchMount,addSockets,symmetryCenter,snapTwist} from './mounting.js';
import {componentClashes,clashText} from './clearance.js';
import {bakeComponentsXml} from './bake.js';

// Properties › Components: everything you set up for a component or a ship's component sockets.
let busy=false,error='',notice='';
const draftNumericHistory=new WeakMap(),libraryNumericHistory=new Map();
function numericHistory(map,key){if(!map.has(key))map.set(key,{undo:[],redo:[]});return map.get(key);}
function rememberNumeric(history,before,after){if(JSON.stringify(before)===JSON.stringify(after))return;history.undo.push({before:structuredClone(before),after:structuredClone(after)});history.redo=[];}
export function mountComponentProperties(host,scene,changed,context=scene.attachmentContext){
 if(!componentLibrary.loaded&&!componentLibrary.error)loadComponentLibrary().then(()=>changed()).catch(()=>changed());
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const note=(parent,text)=>{const p=el('p',text);p.className='panel-note';parent.append(p);return p;};
 const run=async action=>{if(busy)return;busy=true;error='';notice='';host.querySelectorAll('button,input,select').forEach(control=>control.disabled=true);try{await action();}catch(e){error=e.message;}finally{busy=false;changed();}};
 const button=(parent,label,action,disabled=false)=>{const b=el('button',label);b.type='button';b.className='setting-button';b.disabled=disabled||busy;b.onclick=()=>run(action);parent.append(b);return b;};
 const panel=label=>{const d=el('details');d.className='panel';d.open=true;d.append(el('summary',label));host.append(d);return d;};
 const field=(parent,label,value,action,type='number',attrs={})=>{const row=el('label',label);row.className='field-row';const input=el('input');input.type=type;input.value=value;Object.assign(input,attrs);input.setAttribute('aria-label',label);if(type==='number'&&!attrs.step)input.step='any';input.disabled=busy;input.onchange=()=>run(()=>{const value=type==='number'?Number(input.value):input.value.trim();if(type==='number'&&(!input.value.trim()||!Number.isFinite(value)))throw Error('Enter a finite number.');return action(value);});if(type==='number'){
  const libraryField=!!parent.closest('[data-library-asset]');
  if(/scale/i.test(label))input.dataset.sensitivity=.01;if(/rotation|twist/i.test(label))input.dataset.sensitivity=1;
  let latest=Number(value),beforeDraft;
  input.numericTransaction={
   history(redo){const apply=async()=>{const draft=scene.componentAttachmentDraft;if(!draft&&!libraryField)return componentHistory(scene,redo);const id=parent.dataset.assetId,history=draft?numericHistory(draftNumericHistory,draft):numericHistory(libraryNumericHistory,id),from=redo?history.redo:history.undo,to=redo?history.undo:history.redo,entry=from.at(-1);if(!entry)return;const attachment=structuredClone(redo?entry.after:entry.before);if(draft)draft.attachment=attachment;else{const current=componentLibrary.assets.find(a=>a.id===id);if(!current)throw Error('Source component is no longer available.');await updateComponentAsset({...current,attachment});}from.pop();to.push(entry);};apply().catch(e=>{error=e.message;}).finally(changed);},
   begin(){latest=Number(input.value);if(scene.componentAttachmentDraft)beforeDraft=structuredClone(scene.componentAttachmentDraft.attachment);else if(libraryField)beforeDraft=structuredClone(componentLibrary.assets.find(a=>a.id===parent.dataset.assetId)?.attachment);else if(!libraryField)beginComponentEdit(scene);},
   update(number){latest=number;if(scene.componentAttachmentDraft){action(number);changed();}else if(!libraryField){action(number);changed();}},
   end(cancel,edited){if(!edited&&!cancel){if(!scene.componentAttachmentDraft&&!libraryField)endComponentEdit(scene,true);return;}const finish=async()=>{if(scene.componentAttachmentDraft){if(cancel)scene.componentAttachmentDraft.attachment=beforeDraft;else rememberNumeric(numericHistory(draftNumericHistory,scene.componentAttachmentDraft),beforeDraft,scene.componentAttachmentDraft.attachment);}else if(libraryField){if(!cancel){await action(latest);rememberNumeric(numericHistory(libraryNumericHistory,parent.dataset.assetId),beforeDraft,componentLibrary.assets.find(a=>a.id===parent.dataset.assetId)?.attachment);}}else await endComponentEdit(scene,cancel);};input.disabled=true;busy=true;finish().catch(e=>{error=e.message;}).finally(()=>{busy=false;changed();});}
  };
 }row.append(input);parent.append(row);return input;};
 const check=(parent,label,checked,onchange)=>{const row=el('label');row.className='check-row';const input=el('input');input.type='checkbox';input.checked=!!checked;input.setAttribute('aria-label',label);input.onchange=()=>onchange(input.checked);row.append(input,label);parent.append(row);return input;};
 const choose=(parent,label,options,value,onchange)=>{const row=el('label',label);row.className='field-row';const select=el('select');select.setAttribute('aria-label',label);for(const [v,text] of options)select.add(new Option(text,v));select.value=value;select.disabled=busy;select.onchange=()=>onchange(select.value);row.append(select);parent.append(row);return select;};
 const frameFields=(parent,value,apply)=>{for(const key of ['position','rotation'])for(let i=0;i<3;i++)field(parent,`${key==='position'?'Position':'Rotation'} ${'XYZ'[i]}${key==='rotation'?' (degrees)':''}`,+value[key][i].toFixed(6),number=>{const next=structuredClone(value);next[key][i]=number;return apply(next);});};
 const pick=(accept,action)=>{const input=el('input');input.type='file';input.accept=accept;input.onchange=()=>{const file=input.files[0];if(file)run(()=>action(file));};input.click();};
 const download=(text,name,type)=>{const url=URL.createObjectURL(new Blob([text],{type}));const link=el('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const faceRotation=socket=>{const matrix=frame([0,0,0],socket.rotation).multiply(new THREE.Matrix4().makeRotationX(Math.PI));const euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');return [euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg);};

 // Component window: the draft's attachment point, picked on a face in its viewport.
 const draft=scene.componentAttachmentDraft;
 if(draft){
  const attach=panel('Attachment point');
  note(attach,'The attachment point is where this component meets a ship socket. +Y points into the component. Saved with Save asset.');
  const pickButton=el('button',scene.pickAttachment?'Click a face in the viewport…':'Pick face in viewport');pickButton.type='button';pickButton.className='setting-button';pickButton.setAttribute('aria-pressed',String(!!scene.pickAttachment));pickButton.onclick=()=>{scene.pickAttachment=!scene.pickAttachment;changed();};attach.append(pickButton);
  check(attach,'Show attachment marker',scene.showAttachmentMarker!==false,on=>{scene.showAttachmentMarker=on;changed();});
  frameFields(attach,draft.attachment,next=>{draft.attachment=next;});
  status(scene.pickAttachment?'Click a block face in the viewport to make it the attachment face.':'Pick a face, or type the position and rotation.');return;
 }

 // Selected library component
 const asset=context?.kind==='library'&&context.type==='component'?componentLibrary.assets.find(a=>a.id===context.id):selectedComponent(),editor=panel('Library asset');editor.dataset.libraryAsset='true';editor.dataset.assetId=asset?.id||'';
 editor.hidden=context?.kind==='instance'||context?.kind==='socket';
 if(!asset)note(editor,componentLibrary.assets.length?'Click a component in the Asset Library to edit it here.':'Import a component in the Asset Library (Components, then +).');
 else{
  field(editor,'Component name',asset.name,name=>{if(!name)throw Error('Enter a component name.');return updateComponentAsset({...asset,name});},'text');
  const folders=[...new Set(componentLibrary.assets.map(a=>a.folder).filter(Boolean))].sort();
  const folder=field(editor,'Folder',asset.folder||'',value=>updateComponentAsset({...asset,folder:value.slice(0,100)||undefined}),'text');
  const list=el('datalist');list.id='component-folders';for(const f of folders)list.append(new Option(f));editor.append(list);folder.setAttribute('list',list.id);folder.placeholder='Unfiled';
  field(editor,'Tags',(asset.tags||[]).join(', '),value=>updateComponentAsset({...asset,tags:[...new Set(value.split(',').map(t=>t.trim().slice(0,50)).filter(Boolean))].slice(0,50)}),'text').placeholder='engine, small';
  note(editor,'Attachment coordinates are local to this component. +Y points into the component; rotation uses XYZ degrees. To pick the face visually, open the component window.');
  const sockets=asset.blocks.flatMap(surfaceSockets);
  const face=choose(editor,'Attachment face',[['','Choose a block face…'],...sockets.map(s=>[s.id,`${s.blockId} · ${s.name}`])],'',()=>{});
  button(editor,'Use component face',async()=>{const socket=sockets.find(s=>s.id===face.value);if(!socket)throw Error('Choose a component face.');await updateComponentAsset({...asset,attachment:{position:socket.position,rotation:faceRotation(socket)}});});
  frameFields(editor,asset.attachment,attachment=>updateComponentAsset({...componentLibrary.assets.find(a=>a.id===asset.id)||asset,attachment}));
  const open=el('button','Open component window');open.type='button';open.className='setting-button';open.disabled=busy;open.onclick=()=>openComponentWorkspace(asset,async next=>{await updateComponentAsset(next);changed();});editor.append(open);
  button(editor,'Remove from library',()=>removeComponentAsset(asset));
  note(editor,'Mounted copies keep their saved geometry and attachment point.');
 }

 const model=scene.model;
 if(!scene.loaded||!model){note(panel('Component sockets'),'Load a ship to create sockets and attach components.');status();return;}
 const setup=componentSetup(model),sockets=componentSockets(scene),clashes=componentClashes(scene);

 // History
 const history=panel('History');
 button(history,'Undo component change',()=>componentHistory(scene),!canComponentHistory(scene));
 button(history,'Redo component change',()=>componentHistory(scene,true),!canComponentHistory(scene,true));
 note(history,'Ctrl+Z and Ctrl+Shift+Z also work while this tab, a selected component or a component socket is active.');

 // Symmetry
 const symmetry=panel('Symmetry');
 mountSymmetryControls(symmetry,{
  read:()=>({symmetry:scene.componentSymmetry,planeVisible:scene.componentSymmetryPlaneVisible,origin:Object.fromEntries(symmetryAxesOrder.map((axis,i)=>[axis,symmetryCenter(scene)[i]]))}),
  hasModel:()=>!!scene.model,
  update:(key,axis,value)=>{
   if(key==='origin'){const origin=[...symmetryCenter(scene)];origin[symmetryAxesOrder.indexOf(axis)]=value;scene.componentSymmetryOrigin=origin;}
   else{
    const field=key==='symmetry'?'componentSymmetry':'componentSymmetryPlaneVisible';
    scene[field]={...scene[field],[axis]:value};
   }
   changed();
  },
  reset:()=>{delete scene.componentSymmetryOrigin;changed();}
 });
 note(symmetry,'Sockets and attachment edits are mirrored across the enabled planes.');

 // Sockets
 const display=panel('Socket Display');
 const ship=panel('Mounting');
 check(display,'Show component sockets',scene.showComponentSockets,on=>{scene.showComponentSockets=on;changed();});
 choose(ship,'Automatic sockets',[['','No automatic block type'],...BLOCK_DEFINITIONS.map(def=>[String(def.typeIndex),`${def.typeIndex} · ${def.displayName}`])],setup.blockType===null?'':String(setup.blockType),value=>run(()=>{if(setup.mounts.some(m=>m.socketId.startsWith('component:')))throw Error('Detach components from automatic sockets before changing block type.');return changeSetup(scene,{...setup,blockType:value===''?null:Number(value)});})).setAttribute('aria-label','Component socket block type');
 const selectedBlock=model.blocks.find(b=>scene.selectedIds?.has(b.id)&&!b.deleted),faces=selectedBlock?surfaceSockets(selectedBlock):[];
 const faceChoice=choose(ship,'Ship face',faces.length?faces.map(f=>[f.id,`${selectedBlock.id} · ${f.name} · ${f.normal.map(n=>n.toFixed(2)).join(', ')}`]):[['','Select a block first']],faces[0]?.id||'',()=>{});faceChoice.setAttribute('aria-label','Ship socket face');
 button(ship,'Add socket on selected block',()=>{const face=faces.find(f=>f.id===faceChoice.value);const saved=savedSocket(model,face,`Socket ${setup.sockets.length+1}`);scene.selectedComponentSocketId=saved.id;return changeSetup(scene,addSockets(scene,saved,{...face,type:'component'}));},!faces.length);
 button(ship,'Add free socket',()=>{const center=symmetryCenter(scene),offset=model.placementOffset||{};const saved={id:crypto.randomUUID(),name:`Socket ${setup.sockets.length+1}`,position:center.map((v,i)=>v-(offset['xyz'[i]]||0)),rotation:[0,0,0]};scene.selectedComponentSocketId=saved.id;return changeSetup(scene,addSockets(scene,saved,{...saved,position:center,normal:[0,1,0],type:'component'}));});
 const socketId=scene.selectedComponentSocketId||'';
 choose(ship,'Socket',[['',sockets.length?'Choose a component socket…':'No component sockets yet'],...sockets.map(s=>[s.id,`${s.name}${s.blockId?' · '+s.blockId:''}`])],sockets.some(s=>s.id===socketId)?socketId:'',value=>{scene.selectedComponentSocketId=value||null;scene.selectedComponentMountId=setup.mounts.find(m=>m.socketId===value)?.id||null;changed();}).setAttribute('aria-label','Component ship socket');
 const socket=sockets.find(s=>s.id===socketId),manual=setup.sockets.find(s=>s.id===socketId),mounted=setup.mounts.find(m=>m.socketId===socketId);
 const socketDetails=panel('Socket Details');socketDetails.open=false;if(socket){for(const [label,value] of [['ID',socket.id],['Name',socket.name],['Block',socket.blockId||'Free socket'],['Status',mounted?'Occupied':'Available'],['Normal',socket.normal.map(v=>v.toFixed(2)).join(', ')]])propertyDataRow(socketDetails,label,value);}else note(socketDetails,'Choose a component socket.');
 if(manual){
  const apply=next=>changeSetup(scene,{...setup,sockets:setup.sockets.map(s=>s.id===manual.id?next:s)});
  field(ship,'Socket name',manual.name,name=>apply({...manual,name}),'text');
  note(ship,(manual.blockId?'Position is relative to the mounting block center.':'Position uses the ship’s original XML coordinates.')+' In Socket Mode, drag the X/Y/Z handles to move it and the dashed ring to turn it (Ctrl: 0.5 steps, Shift: free).');
  frameFields(ship,manual,apply);
  button(ship,'Turn socket 90°',()=>{const normal=new THREE.Vector3(...socket.normal),matrix=new THREE.Matrix4().makeRotationAxis(normal,Math.PI/2).multiply(frame([0,0,0],manual.rotation)),euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');return apply({...manual,rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)});});
  button(ship,'Remove socket',()=>{scene.selectedComponentSocketId=null;return changeSetup(scene,{...setup,sockets:setup.sockets.filter(s=>s.id!==manual.id)});},!!mounted);
 }
 button(ship,mounted?'Swap in selected component':'Attach selected component',()=>{const next=placeComponent(scene,asset,socket);return changeSetup(scene,next).then(()=>{scene.selectedComponentMountId=componentSetup(model).mounts.find(m=>m.socketId===socket.id)?.id||null;});},!asset||!socket||mounted?.asset.id===asset?.id);

 // Selected mount
 const selected=setup.mounts.find(m=>m.id===scene.selectedComponentMountId)||mounted;
 if(selected){
  const selectedIds=scene.selectedComponentMountIds?.size?[...scene.selectedComponentMountIds]:[selected.id];
  const batch=patch=>{let next=setup;for(const id of selectedIds){const item=next.mounts.find(m=>m.id===id);if(item){const proxy=Object.create(scene);proxy.model={...model,componentSetup:next};next=patchMount(proxy,item,patch);}}return changeSetup(scene,next);};
  const mixed=key=>setup.mounts.filter(m=>selectedIds.includes(m.id)).some(m=>m[key]!==selected[key]);
  const mount=panel('Transform & Pose');
  const attachment=panel('Selected Component');mount.before(attachment);mountLifecycleControls(attachment,scene,'component',selected,changed,{inline:true});
  const clash=clashes.get(selected.id);if(clash){const warn=note(mount,'⚠ '+clashText(scene,clash)+'.');warn.classList.add('component-warning');}
  field(mount,'Mount name',selected.name||'',name=>changeSetup(scene,{...setup,mounts:setup.mounts.map(m=>m.id===selected.id?{...m,name:name.slice(0,100)||undefined}:m)}),'text').placeholder=selected.asset.name;
  field(mount,'Component scale',selected.scale,scale=>{if(scale<=0||scale>1000)throw Error('Scale must be above 0 and at most 1000.');return batch({scale});},'number',{min:Number.MIN_VALUE,max:1000});
  for(let axis=0;axis<3;axis++)field(mount,'Component rotation '+'XYZ'[axis]+' (degrees)',selected.rotation?.[axis]||0,value=>{const rotation=[...selected.rotation||[0,0,0]];rotation[axis]=value;return batch({rotation});});
  const position=panel('Position & Alignment');position.open=false;
  for(let axis=0;axis<3;axis++)field(position,'Local offset '+'XYZ'[axis],selected.offset?.[axis]||0,value=>{const offset=[...selected.offset||[0,0,0]];offset[axis]=value;return batch({offset});});
  button(position,'Reset position offset',()=>batch({offset:[0,0,0]}));button(position,'Align to socket',()=>batch({rotation:[0,0,0],offset:[0,0,0],twist:0}));
  const snap=scene.componentTwistSnap!==false;
  field(mount,'Component twist (degrees)',selected.twist,twist=>batch({twist:snapTwist(twist,snap)}),'number',snap?{step:'90'}:{});
  for(const key of ['scale','twist'])if(mixed(key)){const input=mount.querySelector(`[aria-label="${key==='scale'?'Component scale':'Component twist (degrees)'}"]`);input.placeholder='Mixed';input.dataset.mixed='true';}
  check(mount,'Snap twist to 90°',snap,on=>{scene.componentTwistSnap=on;changed();});
  button(mount,'Twist −90°',()=>changeSetup(scene,patchMount(scene,selected,{twist:snapTwist(selected.twist-90,snap)})));
  button(mount,'Twist +90°',()=>changeSetup(scene,patchMount(scene,selected,{twist:snapTwist(selected.twist+90,snap)})));
  button(panel('Appearance'),selected.hidden?'Show component':'Hide component',()=>changeSetup(scene,{...setup,mounts:setup.mounts.map(m=>m.id===selected.id?{...m,hidden:!selected.hidden}:m)}));
  button(mount,'Detach component',()=>changeSetup(scene,detachComponent(scene,selected)));
  note(mount,'Delete also detaches the selected component when the viewport or outliner is active.');
 }
 // Keep orphaned mounts recoverable if their mounting block was deleted or changed.
 for(const orphan of setup.mounts.filter(m=>!sockets.some(s=>s.id===m.socketId)))button(ship,'Detach missing socket: '+orphan.asset.name,()=>changeSetup(scene,{...setup,mounts:setup.mounts.filter(m=>m.id!==orphan.id)}));

 // Clearance
 if(clashes.size){
  const clear=panel('Clearance');
  for(const m of setup.mounts.filter(m=>clashes.has(m.id))){const row=el('button',`⚠ ${m.name||m.asset.name}: ${clashText(scene,clashes.get(m.id))}`);row.type='button';row.className='setting-button component-warning';row.onclick=()=>{scene.selectedComponentMountId=m.id;scene.selectedComponentSocketId=m.socketId;changed();};clear.append(row);}
  note(clear,'Checked with block bounding boxes, so a component turned by an odd angle can show a near miss as an overlap.');
 }

 // Files
 const files=panel('Component setup');
 button(files,'Export component setup',()=>download(componentSetupFile(model),model.fileName.replace(/\.xml$/i,'')+'-components.json','application/json'));
 button(files,'Import component setup',()=>pick('.json',async file=>previewSetupImport(scene,parseComponentSetupFile(await file.text()),changed)));
 button(files,'Bake into ship XML',async()=>{const {text,count}=bakeComponentsXml(scene);download(text,model.fileName.replace(/\.xml$/i,'')+'-with-components.xml','application/xml');notice=`Saved a copy of the ship with ${count} component block${count===1?'':'s'} added. The open ship is unchanged.`;},!setup.mounts.length);
 note(files,'Setups are saved for this ship in this browser, and come back after the ship is re-saved from the game under the same file name. Bake writes the components into a copy of the ship XML for the game; components must be turned in 90° steps.');
 for(const details of host.querySelectorAll('details'))if(['History','Symmetry','Clearance','Component setup'].includes(details.querySelector('summary')?.textContent))details.open=false;
 const creation=panel('Socket Creation');creation.open=false;
 for(const child of [...ship.children]){if(child.tagName==='SUMMARY')continue;const label=child.querySelector('[aria-label]')?.getAttribute('aria-label')||child.textContent;
 if(['Component socket block type','Ship socket face','Add socket on selected block','Add free socket'].includes(label))creation.append(child);
 else if(label==='Socket name'||/^(Position [XYZ]|Rotation [XYZ])/.test(label)||label.startsWith('Turn socket')||label==='Remove socket'||label.startsWith('Position is relative')||label.startsWith('Position uses'))socketDetails.append(child);
 }
 ship.open=true;
 status();
 function status(hint='Drag a component from the Asset Library onto a socket, or attach it here.'){const p=note(host,error||notice||scene.componentMessage||(busy?'Saving…':hint));p.setAttribute('role','status');}
}
