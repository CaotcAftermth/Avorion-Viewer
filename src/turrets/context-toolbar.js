import {componentSetup,componentSockets} from '../components/core.js';
import {componentLibrary,loadComponentLibrary} from '../components/library.js';
import {beginComponentEdit,endComponentEdit,previewSetup,changeSetup,patchMount,placeComponent,detachComponent} from '../components/mounting.js';
import {selectSocketMarker} from '../socket-markers.js';
import {mounts,selectTurrets,editTurrets,removeTurret,copyTurretPose,replaceTurret,beginPropertyEdit,endPropertyEdit} from './mounts.js';
import {sceneSockets} from './sockets.js';
import {turretLibrary,loadTurretLibrary} from './library.js';
import {frame} from './core.js';
import * as THREE from '../vendor/three.module.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';

export function socketSizeLimit(socket){return Math.min(10,Math.floor((socket?.fitSize||0)*2)/2);}
export function fittedSize(value,socket){const max=socketSizeLimit(socket);return max<.5?null:Math.max(.5,Math.min(max,Math.round(value*2)/2));}
export function snappedMountRotation(start,delta){return ((start+Math.round(delta/90)*90+180)%360+360)%360-180;}

export function createTurretToolbar(canvas,scene,view,{changed,selected,invalidate}){
 const body=canvas.parentElement,events=new AbortController(),bar=document.createElement('div');bar.className='turret-context-toolbar';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Turret context tools');body.append(bar);
 let id=null,model=null,mode=null,gesture=null,geometry=null,component=false;
 const listen=(target,type,action,options={})=>target.addEventListener(type,action,{...options,signal:events.signal});
 const current=()=>scene.model===model?(component?componentSetup(model).mounts:mounts(scene)).find(m=>m.id===id):null;
 const socket=()=>(component?componentSockets(scene):sceneSockets(scene)).find(s=>s.id===current()?.socketId);
 const project=p=>projectPoint(nativeToView(p),view,canvas.clientWidth,canvas.clientHeight);
 const status=document.createElement('span');status.className='turret-context-status';status.setAttribute('role','status');
 function finish(cancel){
  if(component){
   const target=scene.model===model?scene:{model};
   return endComponentEdit(target,cancel).catch(error=>status.textContent=error.message);
  }
  endPropertyEdit(scene,cancel);
 }
 function cancel(){if(!gesture)return;gesture=null;finish(true);invalidate();changed();}
 function close(){cancel();bar.hidden=true;id=null;mode=null;geometry=null;}
 function action(label,fn){const button=document.createElement('button');button.type='button';const glyphs={'Copy pose & size':'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9"/><path d="M11 4V2H2v9h2"/></svg>','Paste pose & size':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3H2v11h12V3h-3"/><rect x="5" y="1" width="6" height="4"/></svg>','⚙ Properties':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 12h12M5 2v4M11 10v4M2 8h12M9 6v4"/></svg>'};if(glyphs[label]){button.innerHTML=glyphs[label];button.className='turret-context-icon';}else button.textContent=label;button.title=label;button.setAttribute('aria-label',label);button.onclick=()=>{try{cancel();Promise.resolve(fn()).catch(error=>status.textContent=error.message);}catch(error){status.textContent=error.message;}};bar.append(button);return button;}
 function build(){
  status.textContent='';bar.replaceChildren();
  action('↻ Rotate',()=>{cancel();mode=mode==='rotate'?null:'rotate';scene.attachmentTransform=false;invalidate();});
  const resize=action('↗ Resize',()=>{cancel();mode=mode==='resize'?null:'resize';scene.attachmentTransform=false;invalidate();});resize.disabled=!component&&socketSizeLimit(socket())<.5;
  action('⇄ Replace',async()=>{mode=null;invalidate();const kind=component,requestedId=id,requestedModel=model;
   await (kind?loadComponentLibrary:loadTurretLibrary)();
   if(kind!==component||requestedId!==id||requestedModel!==model||!current())return;
   const assets=(kind?componentLibrary:turretLibrary).assets;
   const picker=document.createElement('div');picker.className='turret-replace-picker';const list=document.createElement('select');list.setAttribute('aria-label',kind?'Replacement component':'Replacement turret');
   for(const asset of assets)if(kind||asset.sourceSize)list.add(new Option(asset.name,asset.id));
   const label=document.createElement('label'),keep=document.createElement('input');keep.type='checkbox';keep.checked=true;label.append(keep,' Keep pose and size');
   const apply=document.createElement('button');apply.textContent='Apply replacement';apply.disabled=!list.options.length;apply.onclick=async()=>{
    const m=current(),s=socket(),asset=assets.find(a=>a.id===list.value);if(!m||!s||!asset)return;
    if(kind){
     apply.disabled=true;
     try{
      let next=placeComponent(scene,asset,s);
      if(!keep.checked){const proxy=Object.create(scene);proxy.model={...model,componentSetup:next};next=patchMount(proxy,m,{twist:0,rotation:[0,0,0],offset:[0,0,0],scale:1});}
      await changeSetup(scene,next);if(current())build();changed();invalidate();
     }catch(error){status.textContent=error.message;apply.disabled=false;}
     return;
    }
    beginPropertyEdit(scene);try{const size=fittedSize(keep.checked?m.turretSize:asset.sourceSize,s);if(size===null)throw Error('Socket has no clearance for a turret.');replaceTurret(scene,asset,s,size);if(!keep.checked)editTurrets(scene,[id],{twist:0,yaw:0,pitch:0});endPropertyEdit(scene);build();changed();invalidate();}catch(error){endPropertyEdit(scene,true);status.textContent=error.message;}
   };bar.querySelector('.turret-replace-picker')?.remove();picker.append(list,label,apply);bar.append(picker);
  });
  action('⨯ Detach',async()=>{const m=current();if(!m)return;
   if(component){await changeSetup(scene,detachComponent(scene,m));if(scene.selectedComponentMountId===m.id){scene.selectedComponentMountId=null;scene.selectedComponentMountIds=new Set();}}
   else {removeTurret(scene,m.socketId);selectTurrets(scene,null);}close();changed();invalidate();});
  action('Copy pose & size',()=>{const m=current();if(!m)return;
   if(component)scene.componentPoseClipboard=structuredClone({twist:m.twist,scale:m.scale,rotation:m.rotation||[0,0,0],offset:m.offset||[0,0,0]});
   else copyTurretPose(scene);build();});
  const paste=action('Paste pose & size',async()=>{const m=current(),s=socket();
   if(component){if(m&&scene.componentPoseClipboard){await changeSetup(scene,patchMount(scene,m,structuredClone(scene.componentPoseClipboard)));changed();invalidate();}return;}if(!m||!scene.turretClipboard)return;const size=fittedSize(scene.turretClipboard.turretSize,s);if(size===null)throw Error('Socket has no clearance for a turret.');editTurrets(scene,[id],{...scene.turretClipboard,turretSize:size});changed();invalidate();});paste.disabled=component?!scene.componentPoseClipboard:!scene.turretClipboard||socketSizeLimit(socket())<.5;
  action('⚙ Properties',()=>{if(!current())return;canvas.dispatchEvent(new CustomEvent('turret-open-properties',{bubbles:true,detail:component?'components':'turrets'}));close();});bar.append(status);
 }
 function open(m,isComponent=false){cancel();id=m.id;model=scene.model;mode=null;component=isComponent;
  bar.setAttribute('aria-label',component?'Component context tools':'Turret context tools');
  selected(selectSocketMarker(scene,{id:m.socketId,type:component?'component':'turret'}));build();bar.hidden=false;canvas.focus({preventScroll:true});invalidate();}
 function draw(ctx){
  const m=current(),s=socket();if(bar.hidden)return;if(!m||!s||(component?scene.selectedComponentMountId:scene.selectedTurretId)!==id||m.hidden||scene.hiddenIds?.has(s.blockId)||!scene.visible||view.interactionMode==='paint'){close();return;}
  const center=project(s.position);if(!center){bar.hidden=true;return;}bar.style.left=Math.max(4,Math.min(canvas.clientWidth-bar.offsetWidth-4,center[0]+15))+'px';bar.style.top=Math.max(4,Math.min(canvas.clientHeight-bar.offsetHeight-4,center[1]+22))+'px';
  geometry={center};if(!mode)return;
  ctx.save();ctx.strokeStyle=ctx.fillStyle=component?'#79e695':'#75ddff';ctx.lineWidth=2;
  if(mode==='rotate'){
   const matrix=frame(s.position,s.rotation),sample=a=>project(new THREE.Vector3(Math.cos(a),0,Math.sin(a)).applyMatrix4(matrix).toArray());
   const samples=Array.from({length:97},(_,i)=>sample(i*Math.PI/48)),span=Math.max(...samples.filter(Boolean).map(p=>Math.hypot(p[0]-center[0],p[1]-center[1])),1);geometry.ring=samples.map(p=>p?[center[0]+(p[0]-center[0])*55/span,center[1]+(p[1]-center[1])*55/span]:null);
   ctx.beginPath();let started=false;for(const p of geometry.ring){if(p){started?ctx.lineTo(...p):ctx.moveTo(...p);started=true;}}ctx.stroke();
   ctx.font='12px sans-serif';ctx.fillText(`${m.twist}° · 90° snap`,center[0]+12,center[1]-65);
  }else{geometry.handle=[center[0]+65,center[1]-45];ctx.beginPath();ctx.moveTo(...center);ctx.lineTo(...geometry.handle);ctx.stroke();ctx.fillRect(geometry.handle[0]-5,geometry.handle[1]-5,10,10);ctx.font='12px sans-serif';ctx.fillText(component?`×${Number(m.scale.toPrecision(5))}`:`${m.turretSize} / ${socketSizeLimit(s)} · ×${(m.turretSize/(m.asset.sourceSize||1)).toFixed(2)}`,center[0]+12,center[1]-60);}
  ctx.restore();
 }
 const position=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
 const angle=p=>{let best=Infinity,index=0;geometry.ring?.forEach((q,i)=>{if(q){const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<best){best=d;index=i;}}});return {distance:best,value:index*Math.PI/48};};
 listen(canvas,'pointerdown',event=>{if(event.button!==0||!mode||!current()||!(mode==='rotate'?geometry?.ring:geometry?.handle))return;const p=position(event),hit=mode==='rotate'?angle(p).distance<=9:Math.hypot(p[0]-geometry.handle[0],p[1]-geometry.handle[1])<=12;if(!hit)return;
  event.preventDefault();event.stopImmediatePropagation();if(component)beginComponentEdit(scene);else beginPropertyEdit(scene);gesture={pointer:event.pointerId,start:p,angle:mode==='rotate'?angle(p).value:0,mount:current()};canvas.setPointerCapture(event.pointerId);
 },{capture:true});
 listen(canvas,'pointermove',event=>{if(!gesture||gesture.pointer!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();if(!current()||scene.model!==model){cancel();return;}const p=position(event);
  if(component){
   const delta=angle(p).value-gesture.angle, movement=((p[0]-gesture.start[0])-(p[1]-gesture.start[1]))/48;
   const patch=mode==='rotate'?{twist:snappedMountRotation(gesture.mount.twist,Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI)}:{scale:Math.max(Number.MIN_VALUE,Math.min(1000,gesture.mount.scale*Math.exp(movement)))};
   previewSetup(scene,patchMount(scene,current(),patch));invalidate();return;
  }
  if(mode==='rotate'){const delta=angle(p).value-gesture.angle;editTurrets(scene,[id],{twist:snappedMountRotation(gesture.mount.twist,Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI)});}else{const value=gesture.mount.turretSize+((p[0]-gesture.start[0])-(p[1]-gesture.start[1]))/48;const size=fittedSize(value,socket());if(size!==null)editTurrets(scene,[id],{turretSize:size});}invalidate();},{capture:true});
 listen(canvas,'pointerup',async event=>{if(!gesture||gesture.pointer!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();gesture=null;canvas.releasePointerCapture(event.pointerId);await finish(false);changed();invalidate();},{capture:true});
 listen(canvas,'pointercancel',()=>cancel(),{capture:true});listen(window,'blur',close);
 listen(window,'keydown',event=>{if(!bar.hidden&&event.key==='Escape'&&(bar.contains(event.target)||event.target===canvas||gesture)){event.preventDefault();event.stopImmediatePropagation();close();invalidate();}},{capture:true});
 listen(document,'pointerdown',event=>{if(!bar.hidden&&!bar.contains(event.target)&&event.target!==canvas)close();},{capture:true});
 return {open,draw,get active(){return !bar.hidden;},close,dispose(){close();events.abort();bar.remove();}};
}
