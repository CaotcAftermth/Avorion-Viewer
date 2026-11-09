import {assetAttachment} from './asset-sockets.js';
import {socketToolActive} from '../interaction-modes.js';
import {mounts,editTurrets} from '../turrets/mounts.js';
import * as THREE from '../vendor/three.module.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';
import {frame} from '../turrets/core.js';
import {sceneSockets,surfaceSockets} from '../turrets/sockets.js';
import {componentSetup,componentSockets} from './core.js';
import {changeSetup,previewSetup} from './mounting.js';

// Attachment-face picking and markers in asset workspaces, plus the existing
// turret transform gizmo. Component sockets use the constrained surface editor.
const AXES=[['x',[1,0,0],'#ff5a5a'],['y',[0,1,0],'#7bd35b'],['z',[0,0,1],'#5a9bff']];
const HANDLE=70,RING=46;
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
export function createComponentTools(scene,view,getPreferences){
 let handles=null,active=null;
 const project=(p,w,h)=>projectPoint(nativeToView(p),view,w,h);
 function selectedFreeSocket(){
  const draft=scene.componentAttachmentDraft||scene.turretEditorAsset;
  if(draft?.attachment&&!scene.componentAttachmentDraft&&scene.editAttachment)return {kind:'asset',asset:draft,manual:structuredClone(draft.attachment),live:{...draft.attachment,normal:new THREE.Vector3(0,1,0).transformDirection(frame([0,0,0],draft.attachment.rotation)).toArray()}};
  if(scene.attachmentTransform&&!scene.selectedComponentMountId){
   const kind=scene.selectedComponentMountId?'component':'turret',setup=componentSetup(scene.model||{}),list=kind==='component'?setup.mounts:mounts(scene),mount=list.find(m=>m.id===(kind==='component'?scene.selectedComponentMountId:scene.selectedTurretId));
   const socket=mount&&(kind==='component'?componentSockets(scene):sceneSockets(scene)).find(s=>s.id===mount.socketId);
   if(socket){const matrix=frame(socket.position,socket.rotation).multiply(frame(mount.offset||[0,0,0],mount.rotation||[0,0,0])),position=new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),euler=new THREE.Euler().setFromRotationMatrix(matrix);return {kind,mount,setup,list,basis:frame([0,0,0],socket.rotation),manual:{position:mount.offset||[0,0,0],rotation:mount.rotation||[0,0,0]},live:{position,rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg),normal:new THREE.Vector3(0,1,0).transformDirection(matrix).toArray()}};}
  }
  return null;
 }
 function drawGizmo(ctx,w,h){
  handles=null;const target=selectedFreeSocket();if(!target)return;
  const origin=project(target.live.position,w,h);if(!origin)return;
  const axes=[];
  for(const [axis,baseVector,color] of AXES){
   const vector=view.attachmentSpace==='ship'?baseVector:new THREE.Vector3(...baseVector).transformDirection(frame([0,0,0],view.attachmentSpace==='socket'?(target.basis?new THREE.Euler().setFromRotationMatrix(target.basis).toArray().slice(0,3).map(THREE.MathUtils.radToDeg):target.live.rotation):target.live.rotation)).toArray();
   const unit=project(add(target.live.position,vector),w,h);if(!unit)continue;
   const perUnit=Math.hypot(unit[0]-origin[0],unit[1]-origin[1]);if(perUnit<1e-3)continue;
   const dir=[(unit[0]-origin[0])/perUnit,(unit[1]-origin[1])/perUnit],tip=[origin[0]+dir[0]*HANDLE,origin[1]+dir[1]*HANDLE];
   axes.push({axis,vector,color,dir,tip,perUnit});
  }
  ctx.save();ctx.lineWidth=2;
  ctx.strokeStyle='rgba(255,255,255,.75)';ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(origin[0],origin[1],RING,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  for(const a of axes){ctx.strokeStyle=ctx.fillStyle=a.color;ctx.beginPath();ctx.moveTo(origin[0],origin[1]);ctx.lineTo(a.tip[0],a.tip[1]);ctx.stroke();ctx.beginPath();ctx.arc(a.tip[0],a.tip[1],6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#000';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(a.axis.toUpperCase(),a.tip[0],a.tip[1]);}
  ctx.fillStyle='#fff';ctx.fillText((view.attachmentSpace||'local')+' axes · rotate '+(view.attachmentAxis||'y').toUpperCase(),origin[0]+12,origin[1]+90);ctx.restore();handles={origin,axes,target};
 }
 function drawAttachment(ctx,w,h){
  const asset=scene.componentAttachmentDraft||scene.turretEditorAsset;if(!asset||scene.showAttachmentMarker===false||!scene.model)return;
  const attachment=scene.componentAttachmentDraft?assetAttachment(scene):asset.attachment;if(!attachment)return;
  const {min,max}=scene.model.bounds,length=Math.max(.5,.35*Math.max(max.x-min.x,max.y-min.y,max.z-min.z));
  const m=frame(attachment.position,attachment.rotation),origin=attachment.position,o=project(origin,w,h);if(!o)return;
  ctx.save();ctx.lineWidth=2.5;ctx.font='11px sans-serif';
  AXES.forEach(([axis,vector,color])=>{const d=new THREE.Vector3(...vector).transformDirection(m).toArray(),tip=project(add(origin,d,length),w,h);if(!tip)return;ctx.strokeStyle=ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(o[0],o[1]);ctx.lineTo(tip[0],tip[1]);ctx.stroke();ctx.fillText(axis==='y'?'+Y into component':axis.toUpperCase(),tip[0]+4,tip[1]-4);});
  ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.beginPath();ctx.arc(o[0],o[1],5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillText('Attachment point',o[0]+8,o[1]+14);
  ctx.restore();
 }
 function hit(x,y){
  if(!handles)return null;
  for(const a of handles.axes)if(Math.hypot(a.tip[0]-x,a.tip[1]-y)<=9||segmentDistance([x,y],handles.origin,a.tip)<=4&&Math.hypot(handles.origin[0]-x,handles.origin[1]-y)>14)return {kind:'move',axis:a};
  if(Math.abs(Math.hypot(handles.origin[0]-x,handles.origin[1]-y)-RING)<=6)return {kind:'rotate'};
  return null;
 }
 function begin(handle,x,y){active={...handles.target,...handle,start:[x,y],origin:handles.origin,model:scene.model,playing:!!scene.turretStudio?.clock.playing};scene.turretStudio?.pause();}
 function drag(x,y,event,w,h){
  if(!active)return;const {manual,setup}=active;let next;
  if(active.kind==='move'){
   const a=active.axis,raw=((x-active.start[0])*a.dir[0]+(y-active.start[1])*a.dir[1])/a.perUnit,step=event.shiftKey?0:event.ctrlKey||event.metaKey?.5:.05,amount=step?Math.round(raw/step)*step:raw;
   const direction=active.basis?new THREE.Vector3(...a.vector).transformDirection(active.basis.clone().invert()).toArray():a.vector;next={...manual,position:add(manual.position,direction,amount)};
  }else{
   const angle=p=>Math.atan2(p[1]-active.origin[1],p[0]-active.origin[0]);let delta=angle([x,y])-angle(active.start);
   // Screen rotation direction depends on whether the socket normal faces the camera.
   const selectedAxis=AXES.find(a=>a[0]===(view.attachmentAxis||'y'))[1],normal=new THREE.Vector3(...selectedAxis);if(view.attachmentSpace!=='ship')normal.transformDirection(frame([0,0,0],active.live.rotation));const probe=new THREE.Vector3(1,0,0);if(Math.abs(probe.dot(normal))>.9)probe.set(0,0,1);probe.addScaledVector(normal,-probe.dot(normal)).normalize();
   const turned=probe.clone().applyAxisAngle(normal,.2),a0=project(add(active.live.position,probe.toArray()),w,h),a1=project(add(active.live.position,turned.toArray()),w,h);
   const sign=a0&&a1&&Math.atan2(a1[1]-active.origin[1],a1[0]-active.origin[0])-Math.atan2(a0[1]-active.origin[1],a0[0]-active.origin[0])<0?-1:1;
   const stepDeg=event.shiftKey?0:(getPreferences().rotationAngle||15),deg=THREE.MathUtils.radToDeg(Math.atan2(Math.sin(delta),Math.cos(delta)))*sign,snapped=stepDeg?Math.round(deg/stepDeg)*stepDeg:deg;
   const localNormal=active.basis?normal.clone().transformDirection(active.basis.clone().invert()):normal;const matrix=new THREE.Matrix4().makeRotationAxis(localNormal,THREE.MathUtils.degToRad(snapped)).multiply(frame([0,0,0],manual.rotation)),euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');
   next={...manual,rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)};
  }
  active.next=next;
  if(active.kind==='asset'){active.asset.attachment=next;}
  else if(active.kind==='socket'){active.current={...setup,sockets:setup.sockets.map(s=>s.id===manual.id?next:s)};previewSetup(scene,active.current);}
  else if(active.kind==='component'){active.current={...setup,mounts:setup.mounts.map(m=>m.id===active.mount.id?{...m,offset:next.position,rotation:next.rotation}:m)};previewSetup(scene,active.current);}
  else{scene.model.turretMounts=active.list.map(m=>m.id===active.mount.id?{...m,offset:next.position,rotation:next.rotation}:m);scene.appearanceRevision=(scene.appearanceRevision||0)+1;}
 }
 async function end(){const done=active;active=null;if(!done||done.model!==scene.model)return;try{if(done.kind==='turret'&&done.next){scene.model.turretMounts=done.list;editTurrets(scene,[done.mount.id],{offset:done.next.position,rotation:done.next.rotation});}else if(done.current)await changeSetup(scene,done.current,{previous:done.setup});}finally{if(done.playing)scene.turretStudio?.play();}}
 function cancel(){if(!active)return false;const done=active;active=null;if(done.model!==scene.model)return true;if(done.kind==='asset')done.asset.attachment=done.manual;else if(done.kind==='turret'){scene.model.turretMounts=done.list;scene.appearanceRevision=(scene.appearanceRevision||0)+1;}else previewSetup(scene,done.setup);if(done.playing)scene.turretStudio?.play();return true;}
 // Component window: click a block face to make it the attachment face.
 function pickAttachment(pick){
  const asset=scene.turretEditorAsset;if(!asset||!scene.pickAttachment||!pick)return false;
  const block=scene.model.blocks.find(b=>b.id===pick.blockId);if(!block)return false;
  const point=new THREE.Vector3(...pick.point),ray=new THREE.Vector3(...pick.direction);
  const faces=surfaceSockets(block).filter(f=>new THREE.Vector3(...f.normal).dot(ray)<0);
  const face=faces.sort((a,b)=>score(a)-score(b))[0];if(!face)return false;
  function score(f){const n=new THREE.Vector3(...f.normal);return Math.abs(point.clone().sub(new THREE.Vector3(...f.position)).dot(n))*100+point.distanceTo(new THREE.Vector3(...f.position))*.01;}
  // +Y of the attachment frame points into the component, opposite the face normal.
  const matrix=frame([0,0,0],face.rotation).multiply(new THREE.Matrix4().makeRotationX(Math.PI)),euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');
  asset.attachment={position:face.position,rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)};scene.pickAttachment=false;return true;
 }
 return {draw(ctx,w,h){drawGizmo(ctx,w,h);drawAttachment(ctx,w,h);},hit,begin,drag,end,cancel,pickAttachment,get active(){return !!active;}};
}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
