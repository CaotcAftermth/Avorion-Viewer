import {rotateSurfaceComponent,detachSurfaceComponent} from '../components/mounting.js';
import {componentSetup,componentSockets,componentMatrix} from '../components/core.js';
import {componentLibrary,loadComponentLibrary} from '../components/library.js';
import {beginComponentEdit,endComponentEdit,previewSetup,changeSetup,patchMount,placeComponent,detachComponent} from '../components/mounting.js';
import {selectSocketMarker} from '../socket-markers.js';
import {mounts,selectTurrets,editTurrets,removeTurret,copyTurretPose,replaceTurret,beginPropertyEdit,endPropertyEdit} from './mounts.js';
import {sceneSockets} from './sockets.js';
import {turretLibrary,loadTurretLibrary} from './library.js';
import {frame,partMatrices} from './core.js';
import * as THREE from '../vendor/three.module.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';

export function socketSizeLimit(socket){return Math.min(10,Math.floor((socket?.fitSize||0)*2)/2);}
export function fittedSize(value,socket){const max=socketSizeLimit(socket);return max<.5?null:Math.max(.5,Math.min(max,Math.round(value*2)/2));}
export function snappedMountRotation(start,delta){const value=start+delta,nearest=Math.round(value/90)*90,snapped=Math.abs(value-nearest)<=10?nearest:value;return ((snapped+180)%360+360)%360-180;}

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
 function action(label,fn){const button=document.createElement('button');button.type='button';const glyphs={'Copy pose & size':'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9"/><path d="M11 4V2H2v9h2"/></svg>','Paste pose & size':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3H2v11h12V3h-3"/><rect x="5" y="1" width="6" height="4"/></svg>'};if(glyphs[label]){button.innerHTML=glyphs[label];button.className='turret-context-icon';}else button.textContent=label;button.title=label;button.setAttribute('aria-label',label);button.onclick=()=>{try{cancel();Promise.resolve(fn()).catch(error=>status.textContent=error.message);}catch(error){status.textContent=error.message;}};bar.append(button);return button;}
 function build(){
  status.textContent='';bar.replaceChildren();
  if(component){
   action('↻ Rotate',()=>{cancel();mode=mode==='rotate'?null:'rotate';scene.attachmentTransform=false;invalidate();});
   for(const [label,step] of [['−90°',-1],['+90°',1]])action(label,async()=>{const mount=current();if(mount){await changeSetup(scene,rotateSurfaceComponent(scene,mount,step));changed();invalidate();}});
   action('Edit Socket Position',()=>{const s=socket();close();if(s)window.dispatchEvent(new CustomEvent('component-socket-edit',{detail:s.id}));});
   action('Detach Component',async()=>{const mount=current();if(mount)await changeSetup(scene,detachSurfaceComponent(scene,mount));close();changed();invalidate();});
   bar.append(status);return;
  }

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
  bar.append(status);
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
   const posed=component?componentMatrix(m.asset,s,m).multiply(frame(m.asset.attachment.position,m.asset.attachment.rotation)):partMatrices(m.asset,s,m).barrel;
   const forward=new THREE.Vector3(0,0,1).transformDirection(posed).transformDirection(matrix.clone().invert());
   const a=Math.hypot(forward.x,forward.z)>1e-6?Math.atan2(forward.z,forward.x):Math.PI/2-THREE.MathUtils.degToRad(m.twist||0),tip=sample(a);
   if(tip){
    geometry.arrow=[center[0]+(tip[0]-center[0])*55/span,center[1]+(tip[1]-center[1])*55/span];
    const dx=geometry.arrow[0]-center[0],dy=geometry.arrow[1]-center[1],len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
    ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(center[0]+ux*18,center[1]+uy*18);ctx.lineTo(...geometry.arrow);ctx.stroke();
    ctx.beginPath();ctx.moveTo(geometry.arrow[0]+ux*5,geometry.arrow[1]+uy*5);ctx.lineTo(geometry.arrow[0]-ux*10-uy*7,geometry.arrow[1]-uy*10+ux*7);ctx.lineTo(geometry.arrow[0]-ux*10+uy*7,geometry.arrow[1]-uy*10-ux*7);ctx.closePath();ctx.fill();
   }
   ctx.font='12px sans-serif';ctx.fillText(`${Number((m.twist||0).toFixed(1))}° · 90° snap`,center[0]+12,center[1]-65);
  }else{geometry.handle=[center[0]+65,center[1]-45];ctx.beginPath();ctx.moveTo(...center);ctx.lineTo(...geometry.handle);ctx.stroke();ctx.fillRect(geometry.handle[0]-5,geometry.handle[1]-5,10,10);ctx.font='12px sans-serif';ctx.fillText(component?`×${Number(m.scale.toPrecision(5))}`:`${m.turretSize} / ${socketSizeLimit(s)} · ×${(m.turretSize/(m.asset.sourceSize||1)).toFixed(2)}`,center[0]+12,center[1]-60);}
  ctx.restore();
 }
 const position=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
 const angle=p=>{let best=Infinity,value=0;const ring=geometry.ring||[];
  for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1];if(!a||!b)continue;const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(distance<best){best=distance;value=(i+t)*Math.PI/48;}}
  return {distance:best,value};};
 const arrowHit=p=>{if(!geometry?.arrow)return false;const a=geometry.center,b=geometry.arrow,dx=b[0]-a[0],dy=b[1]-a[1],t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1);return t>=.3&&t<=1.2&&Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<=12;};
 listen(canvas,'pointerdown',event=>{if(event.button!==0||!mode||!current()||!(mode==='rotate'?geometry?.ring:geometry?.handle))return;const p=position(event),hit=mode==='rotate'?(angle(p).distance<=9||arrowHit(p)):Math.hypot(p[0]-geometry.handle[0],p[1]-geometry.handle[1])<=12;if(!hit)return;
  event.preventDefault();event.stopImmediatePropagation();if(component)beginComponentEdit(scene);else beginPropertyEdit(scene);gesture={pointer:event.pointerId,start:p,angle:mode==='rotate'?angle(p).value:0,delta:0,mount:{twist:current().twist,scale:current().scale,turretSize:current().turretSize}};canvas.setPointerCapture(event.pointerId);
 },{capture:true});
 listen(canvas,'pointermove',event=>{if(!gesture||gesture.pointer!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();if(!current()||scene.model!==model){cancel();return;}const p=position(event);
  if(mode==='rotate'){const next=angle(p).value;gesture.delta-=Math.atan2(Math.sin(next-gesture.angle),Math.cos(next-gesture.angle))*180/Math.PI;gesture.angle=next;}
  if(component){
   const movement=((p[0]-gesture.start[0])-(p[1]-gesture.start[1]))/48;
   const patch=mode==='rotate'?{twist:snappedMountRotation(gesture.mount.twist,gesture.delta)}:{scale:Math.max(Number.MIN_VALUE,Math.min(1000,gesture.mount.scale*Math.exp(movement)))};
   previewSetup(scene,patchMount(scene,current(),patch));invalidate();return;
  }
  if(mode==='rotate'){editTurrets(scene,[id],{twist:snappedMountRotation(gesture.mount.twist,gesture.delta)});}else{const value=gesture.mount.turretSize+((p[0]-gesture.start[0])-(p[1]-gesture.start[1]))/48;const size=fittedSize(value,socket());if(size!==null)editTurrets(scene,[id],{turretSize:size});}invalidate();},{capture:true});
 listen(canvas,'pointerup',async event=>{if(!gesture||gesture.pointer!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();if(mode==='rotate'&&current()){const twist=Math.round(current().twist/90)*90;if(component)previewSetup(scene,patchMount(scene,current(),{twist}));else editTurrets(scene,[id],{twist});}gesture=null;canvas.releasePointerCapture(event.pointerId);invalidate();await finish(false);changed();invalidate();},{capture:true});
 listen(canvas,'pointercancel',()=>cancel(),{capture:true});listen(window,'blur',close);
 listen(window,'keydown',event=>{if(!bar.hidden&&event.key==='Escape'&&(bar.contains(event.target)||event.target===canvas||gesture)){event.preventDefault();event.stopImmediatePropagation();close();invalidate();}},{capture:true});
 listen(document,'pointerdown',event=>{if(!bar.hidden&&!bar.contains(event.target)&&event.target!==canvas)close();},{capture:true});
 return {open,draw,get active(){return !bar.hidden;},close,dispose(){close();events.abort();bar.remove();}};
}
