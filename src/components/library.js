import {BLOCK_DEFINITIONS} from '../block-model.js';
import {surfaceSockets} from '../turrets/sockets.js';
import {thumbnail} from '../turrets/thumbnail.js';
import {importComponent,componentSetup,componentSockets,savedSocket,attachComponent} from './core.js';
import {subscribeComponents,loadComponents,saveComponents,saveComponentSetup,componentSetupFile,parseComponentSetupFile} from './storage.js';
import {frame} from '../turrets/core.js';
import * as THREE from '../vendor/three.module.js';

export function mountComponentLibrary(host,scene,changed){
 let assets=[],selected=null,socketId=null,error='',busy=true,disposed=false,lastKey;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const button=(parent,label,action,disabled=false)=>{const b=el('button',label);b.type='button';b.disabled=disabled||busy;b.onclick=()=>run(action);parent.append(b);return b;};
 const run=async action=>{if(busy)return;busy=true;error='';host.querySelectorAll('button,input,select').forEach(control=>control.disabled=true);try{await action();}catch(e){error=e.message;}finally{busy=false;if(!disposed){draw();changed();}}};
 const updateSetup=async next=>{const model=scene.model;if(!model)throw Error('Load a ship first.');await saveComponentSetup(model,next);if(scene.model===model)scene.appearanceRevision=(scene.appearanceRevision||0)+1;};
 const updateAsset=async next=>{const list=assets.map(a=>a.id===next.id?next:a);await saveComponents(list);assets=list;};
 const section=(label)=>{const d=el('details');d.className='panel';d.open=true;d.append(el('summary',label));host.append(d);return d;};
 const field=(parent,label,value,action,type='number')=>{const row=el('label',label);row.className='field-row';const input=el('input');input.type=type;input.value=value;if(type==='number')input.step='any';input.disabled=busy;input.onchange=()=>run(()=>{const value=type==='number'?Number(input.value):input.value.trim();if(type==='number'&&(!input.value.trim()||!Number.isFinite(value)))throw Error('Enter a finite number.');return action(value);});row.append(input);parent.append(row);return input;};
 const frameFields=(parent,value,apply)=>{for(const key of ['position','rotation'])for(let i=0;i<3;i++)field(parent,`${key==='position'?'Position':'Rotation'} ${'XYZ'[i]}${key==='rotation'?' (degrees)':''}`,value[key][i],number=>{const next=structuredClone(value);next[key][i]=number;return apply(next);});};
 const pick=(accept,action)=>{const input=el('input');input.type='file';input.accept=accept;input.onchange=()=>{const file=input.files[0];if(file)run(()=>action(file));};input.click();};
 function draw(){
  if(disposed)return;socketId=scene.selectedComponentSocketId??socketId;host.replaceChildren();host.classList.add('component-library');
  const library=section('Components');
  button(library,'Import component XML',()=>pick('.xml',async file=>{const asset=importComponent(await file.text(),file.name);const existing=assets.find(a=>a.sourceXml===asset.sourceXml);if(existing){selected=existing.id;return;}const next=[...assets,asset];await saveComponents(next);assets=next;selected=asset.id;}));
  const grid=el('div');grid.className='turret-asset-grid';library.append(grid);
  for(const asset of assets){const tile=button(grid,asset.name,()=>{selected=asset.id;});tile.className='turret-asset-tile';tile.setAttribute('aria-label',asset.name);tile.setAttribute('aria-pressed',String(selected===asset.id));const canvas=el('canvas');thumbnail(canvas,asset);tile.prepend(canvas);}
  const asset=assets.find(a=>a.id===selected);
  if(asset){
   const editor=section('Component attachment');field(editor,'Component name',asset.name,name=>{if(!name)throw Error('Enter a component name.');return updateAsset({...asset,name});},'text');
   editor.append(el('p','Attachment coordinates are local to this component. +Y points into the component; rotation uses XYZ degrees.'));
   const faces=el('select');faces.setAttribute('aria-label','Component attachment face');faces.add(new Option('Choose a block face…',''));
   const sockets=asset.blocks.flatMap(surfaceSockets);for(const socket of sockets)faces.add(new Option(`${socket.blockId} · ${socket.name}`,socket.id));editor.append(faces);
   button(editor,'Use component face',async()=>{const socket=sockets.find(s=>s.id===faces.value);if(!socket)throw Error('Choose a component face.');const matrix=frame([0,0,0],socket.rotation).multiply(new THREE.Matrix4().makeRotationX(Math.PI));const euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');await updateAsset({...asset,attachment:{position:socket.position,rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)}});});
   frameFields(editor,asset.attachment,attachment=>updateAsset({...asset,attachment}));
   button(editor,'Remove component from library',async()=>{const next=assets.filter(a=>a.id!==asset.id);await saveComponents(next);assets=next;selected=null;});
   editor.append(el('p','Mounted copies keep their saved geometry and attachment point.'));
  }
  const model=scene.model,ship=section('Ship component sockets');
  if(!scene.loaded||!model){ship.append(el('p','Load a ship to create sockets and attach components.'));status();return;}
  const show=el('label','Show component sockets');const check=el('input');check.type='checkbox';check.checked=!!scene.showComponentSockets;check.onchange=()=>{scene.showComponentSockets=check.checked;changed();};show.append(check);ship.append(show);
  const setup=componentSetup(model),types=el('select');types.setAttribute('aria-label','Component socket block type');types.add(new Option('No automatic block type',''));
  for(const def of BLOCK_DEFINITIONS)types.add(new Option(`${def.typeIndex} · ${def.displayName}`,String(def.typeIndex)));
  types.value=setup.blockType===null?'':String(setup.blockType);types.onchange=()=>run(()=>{if(setup.mounts.some(m=>m.socketId.startsWith('component:')))throw Error('Detach components from automatic sockets before changing block type.');return updateSetup({...setup,blockType:types.value===''?null:Number(types.value)});});ship.append(types);
  const selectedBlock=model.blocks.find(b=>scene.selectedIds?.has(b.id)&&!b.deleted),faceChoice=el('select');faceChoice.setAttribute('aria-label','Ship socket face');
  const faces=selectedBlock?surfaceSockets(selectedBlock):[];for(const face of faces)faceChoice.add(new Option(`${selectedBlock.id} · ${face.name} · ${face.normal.map(n=>n.toFixed(2)).join(', ')}`,face.id));ship.append(faceChoice);
  button(ship,'Add socket on selected block',()=>{const face=faces.find(f=>f.id===faceChoice.value);const socket=savedSocket(model,face,`Socket ${setup.sockets.length+1}`);socketId=socket.id;scene.selectedComponentSocketId=socketId;return updateSetup({...setup,sockets:[...setup.sockets,socket]});},!faces.length);
  button(ship,'Add free socket',()=>{const socket={id:crypto.randomUUID(),name:`Socket ${setup.sockets.length+1}`,position:[0,0,0],rotation:[0,0,0]};socketId=socket.id;scene.selectedComponentSocketId=socketId;return updateSetup({...setup,sockets:[...setup.sockets,socket]});});
  const sockets=componentSockets(scene),choice=el('select');choice.setAttribute('aria-label','Component ship socket');choice.add(new Option('Choose a component socket…',''));for(const s of sockets)choice.add(new Option(`${s.name}${s.blockId?' · '+s.blockId:''}`,s.id));choice.value=socketId||'';choice.onchange=()=>{socketId=choice.value;scene.selectedComponentSocketId=socketId;draw();changed();};ship.append(choice);
  const socket=sockets.find(s=>s.id===socketId),manual=setup.sockets.find(s=>s.id===socketId),mounted=setup.mounts.find(m=>m.socketId===socketId);
  if(manual){
   const apply=next=>updateSetup({...setup,sockets:setup.sockets.map(s=>s.id===manual.id?next:s)});
   field(ship,'Socket name',manual.name,name=>apply({...manual,name}),'text');
   ship.append(el('p',manual.blockId?'Position is relative to the mounting block center.':'Position uses the ship’s original XML coordinates.'));
   frameFields(ship,manual,apply);
   button(ship,'Remove socket',()=>{socketId=null;scene.selectedComponentSocketId=null;return updateSetup({...setup,sockets:setup.sockets.filter(s=>s.id!==manual.id)});},!!mounted);
  }
  button(ship,'Attach selected component',()=>updateSetup(attachComponent(setup,asset,socket)),!asset||!socket||!!mounted);
  if(mounted){
   ship.append(el('p','Mounted: '+mounted.asset.name));
   const patch=values=>updateSetup({...setup,mounts:setup.mounts.map(m=>m.id===mounted.id?{...m,...values}:m)});
   field(ship,'Component scale',mounted.scale,scale=>patch({scale}));field(ship,'Component twist (degrees)',mounted.twist,twist=>patch({twist}));
   button(ship,'Detach component',()=>updateSetup({...setup,mounts:setup.mounts.filter(m=>m.id!==mounted.id)}));
  }
  // Keep orphaned mounts recoverable if their mounting block was deleted or changed.
  for(const mount of setup.mounts.filter(m=>!sockets.some(s=>s.id===m.socketId)))button(ship,'Detach missing socket: '+mount.asset.name,()=>updateSetup({...setup,mounts:setup.mounts.filter(m=>m.id!==mount.id)}));
  button(ship,'Export component setup',()=>{const url=URL.createObjectURL(new Blob([componentSetupFile(model)],{type:'application/json'}));const link=el('a');link.href=url;link.download=model.fileName.replace(/\.xml$/i,'')+'-components.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  button(ship,'Import component setup',()=>pick('.json',async file=>updateSetup(parseComponentSetupFile(await file.text()))));
  ship.append(el('p','Setups are saved for this ship in this browser. Export a setup to keep a portable backup. Original Avorion XML is unchanged.'));
  status();
 }
 function status(){const p=el('p',error||'Component library saved in this browser.');p.setAttribute('role','status');host.append(p);}
 const unsubscribe=subscribeComponents(value=>{assets=value;if(!busy)draw();});
 loadComponents().then(value=>{assets=value;busy=false;draw();}).catch(e=>{error=e.message;busy=false;draw();});draw();
 return {sync(){const key=[scene.model,scene.appearanceRevision,[...scene.selectedIds||[]].join(','),scene.selectedComponentSocketId];if(!lastKey||key.some((v,i)=>v!==lastKey[i])){lastKey=key;if(!busy)draw();}},dispose(){disposed=true;unsubscribe();}};
}
