import {planSocketBatch} from './socket-batch.js';
import {withoutSocket} from './asset-sockets.js';
import {enhanceNumericFields,numericEditing} from '../numeric-field.js';
import {SOCKET_APPEARANCE_KEY,socketAppearance,appearanceColor,draftingBackground} from './socket-appearance.js';
import {layoutPropertyRows} from '../property-rows.js';
import * as THREE from '../vendor/three.module.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';
import {socketToolActive} from '../interaction-modes.js';
import {pickSocketMarker,drawSocketMarker,selectSocketMarker} from '../socket-markers.js';
import {componentSetup,componentSockets,componentEntries,savedSocket} from './core.js';
import {changeSetup,previewSetup,assignComponent,detachSurfaceComponent} from './mounting.js';
import {componentLibrary,loadComponentLibrary} from './library.js';
import {socketFaces,faceForHit,faceCenter,snapToFace,faceGrid,boundingSocketFaces,socketNormalChoices,orientSocket,faceBoundary,faceEdgeLabels} from './socket-face.js';
const preferenceKey='avorion-viewer.component-socket-center.v1';
const cameraKeys=['target','yaw','pitch','roll','zoom','projection','panX','panY','orthographicDistance'];
export function createSocketEditor(canvas,scene,view,{pick,invalidate,changed,active=()=>true,visible=()=>true}){
 const host=canvas.parentElement,events=new AbortController();let state=null,menu=null,busy=false,eatContext=false,width=1,height=1;
 let appearance=socketAppearance();try{appearance=socketAppearance(JSON.parse(localStorage.getItem(SOCKET_APPEARANCE_KEY)||'null'));}catch{}
 let preference='face';try{const saved=localStorage.getItem(preferenceKey);if(['face','block','incenter'].includes(saved))preference=saved;}catch{}
 const panel=document.createElement('div');panel.className='socket-edit-strip property-content';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','Component socket positioning');host.append(panel);const lockState=new Map();
 function syncLock(){
  const locked=!!state&&state.stage!=='pick';host.classList[locked?'add':'remove']('socket-editor-locked');
  for(const control of host.closest?.('.area')?.querySelectorAll('.viewport-toolbar,.navigation,.viewport-mode-control')||host.querySelectorAll?.('.viewport-toolbar,.navigation,.viewport-mode-control')||[]){
   if(locked){if(!lockState.has(control))lockState.set(control,{inert:control.inert,aria:control.getAttribute('aria-disabled')});control.inert=true;control.setAttribute('aria-disabled','true');}
  }
  if(!locked){for(const [control,previous] of lockState){control.inert=previous.inert;if(previous.aria===null)control.removeAttribute('aria-disabled');else control.setAttribute('aria-disabled',previous.aria);}lockState.clear();}
 }
 function showPanel(open){panel.hidden=!open;host.classList[open?'add':'remove']('socket-editor-open');syncLock();}
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const sections=el('div');sections.className='socket-edit-sections';panel.append(sections);
 const positionPanel=el('details');positionPanel.className='panel socket-position-settings';positionPanel.open=true;sections.append(positionPanel);
 const heading=el('summary','Socket Position');positionPanel.append(heading);
 const message=el('span');message.setAttribute('role','status');positionPanel.append(message);
 const fields=el('div');fields.className='socket-edit-fields';positionPanel.append(fields);
 const select=(label,options,change)=>{const row=el('label',label+' '),input=el('select');row.className='field-row';input.setAttribute('aria-label',label);for(const [v,t] of options)input.add(new Option(t,v));input.onchange=()=>change(input.value);row.append(input);fields.append(row);return input;};
 const mode=select('Positioning',[['center','Center'],['grid','Grid'],['free','Free']],v=>{state.settings.mode=v;configure();reposition();});
 const center=select('Center definition',[['face','Face Center'],['block','Block Center Projection'],['incenter','Incenter']],v=>{state.settings.center=v;preference=v;try{localStorage.setItem(preferenceKey,v);}catch{}configure();reposition();});
 const density=select('Grid density',[['divisions','Divisions'],['spacing','Spacing']],v=>{state.settings.density=v;configure();reposition();});
 const edge=select('Grid edge',[],v=>{state.settings.edge=Number(v);state.hover=null;reposition();});
 const cells=select('Cell shape',[['square','Square Cells'],['equal','Equal Divisions']],v=>{state.settings.square=v==='square';reposition();});
 const number=(label,key,min,max,step)=>{const row=el('label',label+' '),input=el('input');row.className='field-row';input.type='number';input.setAttribute('aria-label',label);Object.assign(input,{min,max,step});input.onchange=()=>{const value=input.valueAsNumber;if(!Number.isFinite(value)||value<min||value>max||key==='divisions'&&!Number.isInteger(value)){message.textContent='Enter a valid '+label.toLowerCase()+'.';input.value=state.settings[key];return;}state.settings[key]=value;reposition();};row.append(input);fields.append(row);return input;};
 const divisions=number('Divisions','divisions',1,1000,1),spacing=number('Spacing (native units)','spacing',.000001,1e7,'any');
 const appearancePanel=el('details');appearancePanel.className='panel socket-appearance-settings';appearancePanel.open=true;appearancePanel.append(el('summary','Display'));sections.append(appearancePanel);
 const appearanceControls=[],gridAppearanceRows=[];
 for(const [group,prefix] of [['Grid','grid'],['Shaded Background','background']]){
  const title=el('div',group);title.className='sub-label';appearancePanel.append(title);if(prefix==='grid')gridAppearanceRows.push(title);
  for(const kind of ['Color','Opacity']){
   const key=prefix+kind,label=(prefix==='grid'?'Grid':'Background')+' '+kind.toLowerCase(),row=el('label',kind+' '),input=el('input');row.className='field-row';input.setAttribute('aria-label',label);input.type=kind==='Color'?'color':'number';
   if(kind==='Opacity'){input.min=0;input.max=100;input.step=1;input.value=appearance[key]*100;input.title='Opacity (%)';input.setAttribute('data-unit','%');}else input.value=appearance[key];
   input.oninput=()=>{const value=kind==='Opacity'?input.valueAsNumber/100:input.value;if(kind==='Opacity'&&(!Number.isFinite(value)||value<0||value>1))return;appearance=socketAppearance({...appearance,[key]:value});try{localStorage.setItem(SOCKET_APPEARANCE_KEY,JSON.stringify(appearance));}catch{}invalidate();};
   input.onchange=()=>{input.oninput();input.value=kind==='Opacity'?appearance[key]*100:appearance[key];};row.append(input);appearancePanel.append(row);appearanceControls.push(input);if(prefix==='grid')gridAppearanceRows.push(row);
  }
 }
 const action=(parent,label,run,disabled=false)=>{const b=el('button',label);b.type='button';b.disabled=disabled;b.onclick=async()=>{if(busy)return;try{await run();}catch(e){message.textContent=e.message;showPanel(true);}};parent.append(b);return b;};
 const actionMenu=el('div');actionMenu.className='socket-context-menu socket-direction-actions';actionMenu.setAttribute('role','group');actionMenu.setAttribute('aria-label','Socket direction actions');actionMenu.hidden=true;host.append(actionMenu);
 const buttons=el('div');buttons.className='socket-edit-actions';panel.append(buttons);
 const refine=action(buttons,'Refine Position',()=>{state.directionCamera=Object.fromEntries(cameraKeys.map(k=>[k,structuredClone(view[k])]));state.stage='position';state.hover=null;state.actionAnchor=null;alignFace();configure();invalidate();});
 const back=action(buttons,'Back',()=>{
  if(state.kind==='create'){
   if(state.stage==='review'){if(state.choices?.length===1){state.stage='pick';state.actionAnchor=null;restoreCamera();configure();invalidate();}else beginDirection();return;}
   if(state.directionCamera)for(const key of cameraKeys)view[key]=structuredClone(state.directionCamera[key]);
   state.stage='review';state.hover=null;state.actionAnchor=state.directionAnchor;configure();invalidate();return;
  }
  state.stage='position';state.hover=null;state.actionAnchor=null;alignFace();configure();invalidate();
 });back.hidden=true;
 const apply=action(buttons,'Apply',()=>accept()),makePrimary=action(buttons,'Make Attachment Point',()=>{state.makeAttachmentPoint=true;return commit();}),dismiss=action(buttons,'Cancel',()=>cancel());apply.classList.add('socket-primary-action');
 const disposeRows=typeof MutationObserver==='undefined'?()=>{}:layoutPropertyRows(panel);
 if(typeof HTMLInputElement!=='undefined')enhanceNumericFields(appearancePanel,{refresh:invalidate});
 function closeMenu(){menu?.remove();menu=null;}
 function controlsHidden(input,hidden){input.closest('.field-row').hidden=hidden;input.disabled=hidden||busy;}
 function directionView(){return state?.stage==='direction'||state?.stage==='review'&&!!state.actionAnchor;}
 function configureActions(){
  if(!state){actionMenu.hidden=true;return;}
  const direction=state.stage==='direction',review=state.stage==='review',positioning=state.stage==='position',floating=directionView();
  refine.hidden=!(state.kind==='create'&&review&&state.blockType===undefined);back.hidden=state.kind==='create'?!review&&!positioning:!direction||state.directionOnly;
  apply.hidden=state.stage==='pick';apply.disabled=busy||!state.point||direction&&!state.normal||!!state.batchError;
  apply.textContent=direction?(state.kind==='create'?'Confirm Direction':'Apply'):state.kind==='create'?'Place Socket':state.normal?'Apply':'Next: Direction';
  makePrimary.hidden=!(scene.componentAttachmentDraft&&state.kind==='create'&&review&&state.blockType===undefined);
  buttons.append(back,apply,makePrimary,refine,dismiss);
  if(floating){
   actionMenu.append(buttons);actionMenu.hidden=!state.actionAnchor;buttons.hidden=false;
   if(state.actionAnchor){actionMenu.style.left=state.actionAnchor[0]+'px';actionMenu.style.top=state.actionAnchor[1]+'px';}
  }else{actionMenu.hidden=true;panel.append(buttons);buttons.hidden=false;}
 }
 function openDirectionActions(x,y){
  state.actionAnchor=[Math.max(4,Math.min(width-224,x+12)),Math.max(4,Math.min(height-180,y+12))];state.directionAnchor=[...state.actionAnchor];configureActions();
 }
 function configure(){
  if(!state)return;syncLock();const s=state.settings,direction=directionView(),picking=state.stage==='pick',review=state.stage==='review',positioning=!direction&&!picking&&!review;
  mode.value=s.mode;center.value=s.center;density.value=s.density;cells.value=s.square?'square':'equal';divisions.value=s.divisions;spacing.value=s.spacing;
  center.options[1].disabled=!state.face?.projectedCenter;center.options[2].disabled=!state.face?.incenter;
  controlsHidden(mode,!positioning);controlsHidden(center,!positioning||s.mode!=='center');
  controlsHidden(density,!positioning||s.mode!=='grid');controlsHidden(cells,!positioning||s.mode!=='grid'||s.density!=='divisions');controlsHidden(divisions,!positioning||s.mode!=='grid'||s.density!=='divisions');controlsHidden(spacing,!positioning||s.mode!=='grid'||s.density!=='spacing');
  const boundary=state.face&&faceBoundary(state.face);if(boundary&&edge.dataset.face!==state.block?.id+':'+state.face.faceId){
   edge.replaceChildren(...boundary.map((_,i)=>new Option('Edge '+(i+1),i)));edge.dataset.face=state.block?.id+':'+state.face.faceId;
  }
  edge.value=Number.isInteger(s.edge)?String(s.edge):'0';controlsHidden(edge,!positioning||s.mode!=='grid'||boundary?.length===4);
  if(positioning&&s.mode==='grid'&&boundary?.length!==4&&!Number.isInteger(s.edge))s.edge=0;
  appearancePanel.hidden=direction||!positioning&&!review;for(const row of gridAppearanceRows)row.hidden=s.mode!=='grid';for(const input of appearanceControls)input.disabled=appearancePanel.hidden||busy||s.mode!=='grid'&&input.getAttribute('aria-label').startsWith('Grid');
  updateBatch();configureActions();
  heading.textContent=direction?'Define Direction':picking?'Place Component Socket':'Socket Position';
  message.textContent=state.blockType!==undefined&&!picking&&state.normal?(state.batchError||`Create ${state.batch?.sockets.length||0} sockets on matching faces; ${state.batch?.duplicates||0} duplicates skipped. Confirm placement.`):direction?'Click a highlighted bounding-box face to choose the outward socket direction. Confirm when ready.':picking?(state.blockType!==undefined?'Select a face on the chosen block type.':state.pickBlockId?'Select a face on the selected block.':'Select a block face. Esc or right-click cancels.'):review?'Direction set. Place the socket or refine its position first.':s.mode==='grid'?'Grid starts on the selected edge. Equal divisions follow the triangle apex; Square uses square cells. Click a grid point.':s.mode==='free'?'Click to position on this face.':'Choose a center definition.';
 }
 function saveCamera(){state.camera??=Object.fromEntries(cameraKeys.map(k=>[k,structuredClone(view[k])]));}
 function alignFace(){
  const face=state.face,back=nativeToView(face.normal);view.yaw=Math.hypot(back[0],back[1])<1e-7?0:Math.atan2(back[0],-back[1]);view.pitch=Math.asin(Math.max(-1,Math.min(1,back[2])));view.roll=0;view.projection='orthographic';view.target=nativeToView(face.position);view.panX=view.panY=0;
  fitCamera(Math.max(...face.bounds.max.map((n,i)=>n-face.bounds.min[i])));
 }
 function fitCamera(span){
  const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;view.orthographicDistance=Math.max(30,Math.max(...Object.values(scene.model.bounds?.size||{x:10,y:10,z:10}))*2);
  view.zoom=Math.max(.00001,.6*10/Math.max(span,.00001)/((view.display?.focalLength||50)/36));
 }
 function beginDirection(preserve=false){
  saveCamera();state.stage='direction';state.hover=null;state.actionAnchor=null;if(!preserve)state.normal=null;state.boxFaces=boundingSocketFaces(state.block);state.blockFaces=socketFaces(state.block);state.choices=socketNormalChoices(state.face);
  const n=nativeToView(state.face.normal);view.yaw=Math.atan2(n[0]||.6,-(n[1]||-.6));view.pitch=Math.sign(n[2]||1)*.55;view.roll=0;view.projection='orthographic';view.target=nativeToView(['x','y','z'].map(a=>state.block.position[a]));view.panX=view.panY=0;
  fitCamera(Math.hypot(...Object.values(state.block.size)));configure();invalidate();
 }
 function accept(){
  if(!state?.point||busy||state.stage==='direction'&&!state.actionAnchor)return;
  if(state.stage==='direction'&&state.kind==='create'){if(!state.normal)return;state.stage='review';if(state.blockType===undefined)configureActions();else configure();return;}
  if(!state.normal){beginDirection();return;}
  return commit();
 }
 function updateBatch(){
  if(state.blockType===undefined||!state.normal||!state.face)return;
  try{state.batch=planSocketBatch(scene.model,state.blockType,state.face,state.normal);state.batchError=state.batch.sockets.length?null:'All matching faces already have sockets.';}catch(error){state.batch=null;state.batchError=error.message;}
 }
 function choosePosition(x,y){
  if(!state.face||!state.point)return;saveCamera();const choices=socketNormalChoices(state.face);state.choices=choices;state.normal=choices.length===1?choices[0].normal:null;
  if(choices.length===1){state.stage='review';configure();openDirectionActions(x,y);invalidate();}else beginDirection(true);
 }
 function restoreCamera(){if(!state?.camera)return;for(const key of cameraKeys)if(state.camera[key]===undefined)delete view[key];else view[key]=structuredClone(state.camera[key]);}
 function cancel(){
  if(busy)return;closeMenu();if(state?.kind==='edit'&&scene.model===state.model&&componentSetup(scene.model)===state.preview)previewSetup(scene,state.before);
  if(scene.model===state?.model)restoreCamera();state=null;actionMenu.hidden=true;panel.append(buttons);showPanel(false);invalidate();changed();
 }
 function focusSocket(socket){
  let normal=socket.normal,block=scene.model.blocks.find(b=>b.id===socket.blockId);
  if(socket.parentMountId){
   const entry=componentEntries(scene).find(e=>e.instance.id===socket.parentMountId),saved=entry?.asset.sockets?.find(s=>s.id===socket.sourceSocketId);
   block=entry?.asset.blocks.find(b=>b.id===saved?.blockId);const face=block&&socketFaces(block).find(f=>f.faceId===saved.faceId);
   if(face)normal=new THREE.Vector3(...face.normal).transformDirection(entry.matrix).toArray();
  }else if(block){const face=socketFaces(block).find(f=>f.faceId===socket.faceId&&f.contains(socket.position))||socketFaces(block).find(f=>f.contains(socket.position)&&f.normal.every((n,i)=>Math.abs(n-socket.normal[i])<1e-5));if(face)normal=face.normal;}
  const back=nativeToView(normal);view.yaw=Math.hypot(back[0],back[1])<1e-7?0:Math.atan2(back[0],-back[1]);view.pitch=Math.asin(Math.max(-1,Math.min(1,back[2])));view.roll=0;view.target=nativeToView(socket.position);view.panX=view.panY=0;invalidate();
 }
 function selectSocket(socket){selectSocketMarker(scene,socket);changed();}
 async function commit(){
  if(!state?.point||busy)return;updateBatch();if(state.batchError){configure();return;}const current=state;if(scene.model!==current.model){cancel();return;}
  const socket={...orientSocket({...current.socket,position:[...current.point]},current.normal),faceId:current.face.faceId,placement:{...current.settings}};
  const saved=current.kind==='create'?savedSocket(scene.model,socket,'Socket '+(componentSetup(scene.model).sockets.length+1)):{...current.manual,position:socket.position.map((n,i)=>n-current.block.position['xyz'[i]]),faceId:socket.faceId,placement:socket.placement};
  saved.faceId=socket.faceId;saved.placement=socket.placement;saved.rotation=[...socket.rotation];
  const before=current.kind==='edit'?current.before:componentSetup(scene.model);
  const next={...before,...(current.makeAttachmentPoint?{attachmentSocketId:current.batch?.sockets[0]?.id||saved.id}:{}),sockets:current.kind==='edit'?before.sockets.map(s=>s.id===saved.id?saved:s):[...before.sockets,...(current.batch?.sockets||[saved])]};
  if(current.kind==='edit'&&componentSetup(scene.model)!==current.preview){message.textContent='Socket setup changed; cancel and reopen this edit.';return;}
  busy=true;panel.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);buttons.querySelectorAll('button').forEach(el=>el.disabled=true);
  try{if(current.kind==='edit')previewSetup(scene,before);await changeSetup(scene,next);restoreCamera();state=null;actionMenu.hidden=true;panel.append(buttons);showPanel(false);selectSocket(componentSockets(scene).find(s=>s.id===(current.batch?.sockets[0]?.id||saved.id))||{...socket,id:saved.id,type:'component'});}
  catch(error){if(scene.model===current.model){previewSetup(scene,current.kind==='edit'?current.preview:before);}message.textContent=error.message;throw error;}
  finally{busy=false;panel.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);buttons.querySelectorAll('button').forEach(el=>el.disabled=false);configure();invalidate();}
 }
 function preview(point){
  if(!point||!state)return;state.point=point;
  if(state.kind==='edit'){
   const next={...state.before,sockets:state.before.sockets.map(s=>s.id===state.manual.id?{...s,rotation:orientSocket(state.socket,state.normal||socketNormalChoices(state.face)[0].normal).rotation,position:point.map((n,i)=>n-state.block.position['xyz'[i]]),faceId:state.face.faceId,placement:{...state.settings}}:s)};
   previewSetup(scene,next);state.preview=next;
  }
  invalidate();
 }
 function reposition(){if(!state?.face||state.stage==='direction')return;state.hover=null;const point=snapToFace(state.face,state.point||state.face.position,state.settings);if(point)preview(point);else message.textContent='No valid point at that location on this face.';}
 function startCreate(event){closeMenu();cancel();view.tool='sockets';view.interactionMode='object';state={pickBlockId:event?.detail?.blockId,blockType:event?.detail?.blockType,makeAttachmentPoint:!!scene.componentAttachmentDraft&&!!event?.detail?.attachmentPoint,stage:'pick',kind:'create',model:scene.model,revision:scene.revision,settings:{mode:'center',center:preference,density:'divisions',divisions:10,spacing:.1,square:true,edgeOrder:1},point:null,face:null};showPanel(true);configure();canvas.focus();invalidate();}
 function startEdit(socket,directionOnly=false){
  closeMenu();cancel();view.interactionMode='object';view.tool='sockets';const manual=componentSetup(scene.model).sockets.find(s=>s.id===socket.id),block=scene.model.blocks.find(b=>b.id===manual?.blockId);
  if(!block){message.textContent='This legacy socket has no mounting face. Create a surface socket instead.';showPanel(true);return;}
  const faces=socketFaces(block),face=faces.find(f=>f.faceId===manual.faceId&&f.contains(socket.position))||faces.find(f=>f.contains(socket.position)&&new THREE.Vector3(...f.normal).dot(new THREE.Vector3(...socket.normal))>.99);
  if(!face){message.textContent='The original mounting surface is unavailable.';showPanel(true);return;}
  const settings={mode:'free',center:preference,density:'divisions',divisions:10,spacing:.1,square:true,...manual.placement};if(!faceCenter(face,settings.center))settings.center='face';
  if(Number.isInteger(settings.edge)&&settings.edgeOrder!==1){const old=faceBoundary(face,{floor:false})[settings.edge];if(old)settings.edge=faceBoundary(face).findIndex(e=>e[0].every((n,i)=>Math.abs(n-old[0][i])<1e-7)&&e[1].every((n,i)=>Math.abs(n-old[1][i])<1e-7));}settings.edgeOrder=1;
  const before=componentSetup(scene.model);state={normal:socketNormalChoices(face).find(c=>c.normal.every((n,i)=>Math.abs(n-socket.normal[i])<1e-5))?.normal,stage:'position',directionOnly,kind:'edit',model:scene.model,revision:scene.revision,manual,block,face,socket,point:[...socket.position],settings,before,preview:before,camera:Object.fromEntries(cameraKeys.map(k=>[k,structuredClone(view[k])]))};
  showPanel(true);if(directionOnly)beginDirection(true);else alignFace();configure();selectSocket(socket);canvas.focus();invalidate();
 }
 async function attach(socket){
  await loadComponentLibrary();closeMenu();menu=el('div');menu.className='socket-context-menu';menu.setAttribute('role','menu');host.append(menu);
  const choice=el('select');choice.setAttribute('aria-label','Component to attach');for(const asset of componentLibrary.assets)choice.add(new Option(asset.name,asset.id));menu.append(choice);
  action(menu,'Attach Component',async()=>{const asset=componentLibrary.assets.find(a=>a.id===choice.value);if(!asset)return;await changeSetup(scene,assignComponent(scene,asset,socket));selectSocket(socket);closeMenu();invalidate();},!componentLibrary.assets.length);
  if(!componentLibrary.assets.length)menu.append(el('p','Add a component XML in the Asset Library first.'));action(menu,'Cancel',closeMenu);
 }
 function syncSize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;}
 function context(event,x,y,hits){
  syncSize();
  if(eatContext){eatContext=false;return true;}
  if(state){cancel();return true;}
  if(!socketToolActive(view)||view.interactionMode==='paint'||!scene.model||scene.turretEditorAsset)return false;
  const candidates=componentSockets(scene).filter(s=>!scene.hiddenIds?.has(s.blockId)).map(s=>({...s,screen:projectPoint(nativeToView(s.position),view,width,height)})).filter(s=>s.screen&&Math.hypot(s.screen[0]-x,s.screen[1]-y)<=12&&visible(s));
  const socket=pickSocketMarker(candidates,x,y),hit=socket?null:pick(x,y);if(!socket&&!hit)return false;
  closeMenu();menu=el('div');menu.className='socket-context-menu';menu.setAttribute('role','menu');menu.style.left=Math.max(4,Math.min(width-210,x))+'px';menu.style.top=Math.max(4,Math.min(height-150,y))+'px';host.append(menu);
  if(socket){
   const setup=componentSetup(scene.model),mount=setup.mounts.find(m=>m.socketId===socket.id),manual=setup.sockets.find(s=>s.id===socket.id);selectSocket(socket);
   action(menu,'Edit Position',()=>startEdit(socket),!manual);
   action(menu,'Edit Direction',()=>startEdit(socket,true),!manual);
   if(scene.componentAttachmentDraft)action(menu,'Make Attachment Point',async()=>{await changeSetup(scene,{...setup,attachmentSocketId:socket.id});closeMenu();changed();invalidate();},!manual||setup.attachmentSocketId===socket.id);
   else if(mount)action(menu,'Detach Component',async()=>{await changeSetup(scene,detachSurfaceComponent(scene,mount));closeMenu();changed();invalidate();});else action(menu,'Attach Component',()=>attach(socket));
   action(menu,'Delete Socket',async()=>{await changeSetup(scene,withoutSocket(setup,socket.id));closeMenu();changed();invalidate();},!!mount||!manual);
  }else action(menu,'Add Component Socket',startCreate);
  canvas.focus();return true;
 }
 function boxPolygon(face){return face.triangles.map(t=>t.map(p=>projectPoint(nativeToView(p),view,width,height)));}
 function pickBox(x,y){
  return state.boxFaces.filter(f=>state.choices.some(c=>c.normal.every((n,i)=>Math.abs(n-f.normal[i])<1e-5))).flatMap(face=>boxPolygon(face).filter(t=>t.every(Boolean)).filter(t=>{
   const signs=t.map((a,i)=>{const b=t[(i+1)%3];return (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);});return signs.every(n=>n>=0)||signs.every(n=>n<=0);
  }).map(t=>({face,depth:t.reduce((sum,p)=>sum+p[2],0)/3}))).sort((a,b)=>a.depth-b.depth)[0]?.face||null;
 }
 function move(x,y){
  if(!state||busy)return false;syncSize();
  if(state.stage==='direction'){state.hoverBox=pickBox(x,y);invalidate();return true;}
  if(state.stage==='review')return true;
  if(state.stage==='pick'){
   const hit=pick(x,y),block=scene.model?.blocks.find(b=>b.id===hit?.blockId),face=block&&(!state.pickBlockId||block.id===state.pickBlockId)&&(state.blockType===undefined||block.typeIndex===state.blockType)&&faceForHit(block,hit);if(state.block!==block)state.blockFaces=block?socketFaces(block):[];state.face=face||null;state.block=block;
   state.point=face?faceCenter(face,state.settings.center):null;state.socket=face;configure();if(face&&!state.point)message.textContent='Selected center is unavailable on this face. Choose another center.';invalidate();return true;
  }
  const face=state.face,o=projectPoint(nativeToView(face.world([0,0])),view,width,height),u=projectPoint(nativeToView(face.world([1,0])),view,width,height),v=projectPoint(nativeToView(face.world([0,1])),view,width,height);
  if(!o||!u||!v)return true;const ax=u[0]-o[0],ay=u[1]-o[1],bx=v[0]-o[0],by=v[1]-o[1],det=ax*by-ay*bx;if(Math.abs(det)<1e-9)return true;
  const p=face.world([((x-o[0])*by-(y-o[1])*bx)/det,(ax*(y-o[1])-ay*(x-o[0]))/det]);state.hover=snapToFace(face,p,state.settings);invalidate();return true;
 }
 function down(event,x,y){
  if(menu&&event.button===0){closeMenu();return true;}if(!state)return false;
  if(event.button===2){cancel();eatContext=true;return true;}
  if(event.button===0&&!event.altKey){move(x,y);if(state.stage==='direction'){if(state.hoverBox){state.normal=[...state.hoverBox.normal];if(state.kind==='edit')preview(state.point);configure();openDirectionActions(x,y);invalidate();}return true;}if(state.stage==='pick')choosePosition(x,y);else if(state.stage==='position'&&state.hover)preview(state.hover);return true;}
  return state.stage!=='pick';
 }
 function draw(ctx,w,h){
  width=w;height=h;if(!state)return;
  if(scene.model!==state.model||scene.revision!==state.revision||!socketToolActive(view)){cancel();return;}
  const face=state.face;if(!face)return;
  const project=p=>projectPoint(nativeToView(p),view,w,h);
  if(directionView()&&state.boxFaces){
   ctx.save();ctx.fillStyle='rgba(0,0,0,.8)';ctx.fillRect(0,0,w,h);
   const faces=state.blockFaces.map(face=>({face,triangles:boxPolygon(face)})).sort((a,b)=>b.triangles[0][0][2]-a.triangles[0][0][2]);
   const paint=(face,fill,stroke)=>{
    const vertices=[...new Map(face.triangles.flat().map(p=>[p.map(n=>n.toFixed(5)).join(','),p])).values()];
    vertices.sort((a,b)=>{const p=face.uv(a),q=face.uv(b);return Math.atan2(p[1],p[0])-Math.atan2(q[1],q[0]);});
    const points=vertices.map(project);if(points.some(p=>!p))return;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();
   };
   for(const {face} of faces)paint(face,'#565656','#aaa');
   for(const face of state.boxFaces){
    const choice=state.choices.find(c=>c.normal.every((n,i)=>Math.abs(n-face.normal[i])<1e-5));if(!choice)continue;
    const selected=state.normal?.every((n,i)=>Math.abs(n-face.normal[i])<1e-5),hover=state.hoverBox===face;
    paint(face,selected?'rgba(110,220,150,.5)':hover?'rgba(100,180,255,.5)':'rgba(80,150,220,.14)',selected?'#79e695':'#98cfff');
    const p=project(face.position);if(p){ctx.fillStyle='#fff';ctx.font='bold 15px sans-serif';ctx.fillText(choice.id,p[0]+8,p[1]-8);}
   }
   const p=project(state.point),normal=state.normal||state.hoverBox?.normal;if(p&&normal)drawSocketMarker(ctx,p,project(state.point.map((n,i)=>n+normal[i]*Math.min(...Object.values(state.block.size))*.3)),{color:'#79e695',selected:true,shape:'square'});
   ctx.restore();return;
  }
  const path=()=>{ctx.beginPath();for(const triangle of face.triangles){const p=triangle.map(project);if(p.some(x=>!x))continue;ctx.moveTo(p[0][0],p[0][1]);ctx.lineTo(p[1][0],p[1][1]);ctx.lineTo(p[2][0],p[2][1]);ctx.closePath();}};
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';if(state.stage!=='pick'){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,w,h);path();ctx.fillStyle=draftingBackground(appearance);ctx.fill();}
  if(state.stage==='pick'){
   ctx.fillStyle='rgba(233,161,91,.24)';ctx.strokeStyle='#e9a15b';ctx.lineWidth=1.5;
   for(const blockFace of state.blockFaces||[]){ctx.beginPath();for(const triangle of blockFace.triangles){const p=triangle.map(project);if(p.some(x=>!x))continue;ctx.moveTo(...p[0].slice(0,2));ctx.lineTo(...p[1].slice(0,2));ctx.lineTo(...p[2].slice(0,2));ctx.closePath();}ctx.fill();}
  }
  if(state.stage==='pick'){path();ctx.fillStyle='rgba(80,150,220,.25)';ctx.fill();}
  const edges=new Map();for(const triangle of face.triangles)for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],key=[a.map(n=>n.toFixed(5)).join(','),b.map(n=>n.toFixed(5)).join(',')].sort().join('|');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
  ctx.strokeStyle='#98cfff';ctx.lineWidth=3;ctx.beginPath();for(const [a,b] of edges.values()){const p=project(a),q=project(b);if(p&&q){ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);}}ctx.stroke();
  if(state.stage==='position'&&state.settings.mode==='grid'){
   ctx.save();path();ctx.clip();ctx.strokeStyle=appearanceColor(appearance.gridColor,appearance.gridOpacity);ctx.lineWidth=1.25;
   const lines=faceGrid(face,state.settings);if(!lines.length)message.textContent='Grid too dense: increase spacing or reduce divisions.';
   for(const [a,b] of lines){const p=project(a),q=project(b);if(p&&q){ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();}}ctx.restore();
  }
  if(state.stage==='position'&&state.settings.mode==='center'){
   const labels=[['Face Center',face.position,'#77e6c0'],['Block Center Projection',face.projection,face.projectedCenter?'#ffc768':'#999'],['Incenter',face.incenter,'#98cfff']].map(([name,p,color])=>({name:name+(name==='Block Center Projection'&&!face.projectedCenter?' (outside face)':''),xy:p&&project(p),color})).filter(l=>l.xy);
   ctx.font='11px sans-serif';const gap=24,base=Math.max(24,Math.min(h-labels.length*gap-12,labels.reduce((sum,l)=>sum+l.xy[1],0)/labels.length-gap));
   labels.forEach((l,i)=>{const textWidth=ctx.measureText(l.name).width,x=Math.max(8,Math.min(w-textWidth-12,l.xy[0]+45)),y=base+i*gap;ctx.strokeStyle=l.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(l.xy[0],l.xy[1],6,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(l.xy[0],l.xy[1]);ctx.lineTo(x-5,y-4);ctx.lineTo(x,y-4);ctx.stroke();ctx.fillStyle='#202020e6';ctx.fillRect(x-3,y-14,textWidth+6,18);ctx.fillStyle=l.color;ctx.fillText(l.name,x,y);});
  }
  if(state.stage==='position'&&state.settings.mode==='grid'&&faceBoundary(face).length!==4){
   for(const {index:i,p,q,label:[x,y]} of faceEdgeLabels(face,project)){
    ctx.strokeStyle=i===state.settings.edge?'#ffc768':'#98cfff';ctx.lineWidth=i===state.settings.edge?4:1;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();
    ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#20252b';ctx.fillRect(x-9,y-10,18,20);ctx.fillStyle=ctx.strokeStyle;ctx.fillText(String(i+1),x,y);
   }ctx.textAlign='start';ctx.textBaseline='alphabetic';
  }
  const p=state.hover||state.point;if(p){const xy=project(p),tip=project(p.map((n,i)=>n+(state.normal||socketNormalChoices(face)[0].normal)[i]*Math.min(...Object.values(state.block.size))*.3));if(xy)drawSocketMarker(ctx,xy,tip,{color:'#79e695',selected:true,shape:'square'});}
  ctx.restore();
 }
 canvas.addEventListener('component-socket-place',startCreate,{signal:events.signal});
 window.addEventListener('keydown',e=>{if(!state&&!menu)return;if(e.key==='Escape'&&panel.contains?.(e.target)&&numericEditing())return;if(state&&e.target===canvas&&(['Delete','Backspace'].includes(e.key)||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')){e.preventDefault();e.stopImmediatePropagation();if(e.key.toLowerCase()==='z')cancel();else message.textContent='Apply or cancel socket editing before deleting.';return;}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}else if(e.key==='Enter'&&state&&state.stage!=='pick'&&e.target===canvas){e.preventDefault();Promise.resolve(accept()).catch(e=>{message.textContent=e.message;});}},{capture:true,signal:events.signal});
 window.addEventListener('component-socket-direction',e=>{if(!active())return;const socket=componentSockets(scene).find(s=>s.id===e.detail);if(socket)startEdit(socket,true);},{signal:events.signal});
 window.addEventListener('component-socket-add',e=>{if(active())startCreate(e);},{signal:events.signal});
 window.addEventListener('component-socket-select',e=>{if(!active())return;const id=typeof e.detail==='object'?e.detail?.id:e.detail,socket=componentSockets(scene).find(s=>s.id===id);if(socket){if(e.detail?.focus)focusSocket(socket);selectSocket(socket);}},{signal:events.signal});
 window.addEventListener('component-socket-edit',e=>{if(!active())return;const socket=componentSockets(scene).find(s=>s.id===e.detail);if(socket)startEdit(socket);},{signal:events.signal});
 function wheel(event,unit,preferences){if(!state||state.stage==='pick')return false;const direction=preferences.invertZoom?-1:1;view.zoom=Math.max(.000001,Math.min(1e6,view.zoom*Math.exp(-event.deltaY*unit*.001*preferences.zoomSensitivity*direction)));invalidate();return true;}
 return {draw,move,down,wheel,context,cancel,get locked(){return !!state&&state.stage!=='pick';},get active(){return !!state;},get cursor(){return state?'crosshair':null;},dispose(){cancel();events.abort();disposeRows();closeMenu();actionMenu.remove();panel.remove();}};
}
