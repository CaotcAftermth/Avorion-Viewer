import * as THREE from '../vendor/three.module.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';
import {frame} from '../turrets/core.js';
import {surfaceSockets} from '../turrets/sockets.js';
import {componentSetup,componentSockets} from './core.js';
import {changeSetup,previewSetup} from './mounting.js';

// Viewport helpers for components: the move/rotate gizmo on a selected free socket,
// and (in the component window) the attachment point marker and face picking.
const AXES=[['x',[1,0,0],'#ff5a5a'],['y',[0,1,0],'#7bd35b'],['z',[0,0,1],'#5a9bff']];
const HANDLE=70,RING=46;
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
export function createComponentTools(scene,view,getPreferences){
 let handles=null,active=null;
 const project=(p,w,h)=>projectPoint(nativeToView(p),view,w,h);
 function selectedFreeSocket(){
  if(view.interactionMode!=='socket'||!scene.showComponentSockets||!scene.model?.componentSetup)return null;
  const setup=componentSetup(scene.model),manual=setup.sockets.find(s=>s.id===scene.selectedComponentSocketId);if(!manual)return null;
  const live=componentSockets(scene).find(s=>s.id===manual.id);return live?{manual,live,setup}:null;
 }
 function drawGizmo(ctx,w,h){
  handles=null;const target=selectedFreeSocket();if(!target)return;
  const origin=project(target.live.position,w,h);if(!origin)return;
  const axes=[];
  for(const [axis,vector,color] of AXES){
   const unit=project(add(target.live.position,vector),w,h);if(!unit)continue;
   const perUnit=Math.hypot(unit[0]-origin[0],unit[1]-origin[1]);if(perUnit<1e-3)continue;
   const dir=[(unit[0]-origin[0])/perUnit,(unit[1]-origin[1])/perUnit],tip=[origin[0]+dir[0]*HANDLE,origin[1]+dir[1]*HANDLE];
   axes.push({axis,vector,color,dir,tip,perUnit});
  }
  ctx.save();ctx.lineWidth=2;
  ctx.strokeStyle='rgba(255,255,255,.75)';ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(origin[0],origin[1],RING,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  for(const a of axes){ctx.strokeStyle=ctx.fillStyle=a.color;ctx.beginPath();ctx.moveTo(origin[0],origin[1]);ctx.lineTo(a.tip[0],a.tip[1]);ctx.stroke();ctx.beginPath();ctx.arc(a.tip[0],a.tip[1],6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#000';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(a.axis.toUpperCase(),a.tip[0],a.tip[1]);}
  ctx.restore();handles={origin,axes,target};
 }
 function drawAttachment(ctx,w,h){
  const asset=scene.componentAttachmentDraft;if(!asset||scene.showAttachmentMarker===false||!scene.model)return;
  const {min,max}=scene.model.bounds,length=Math.max(.5,.35*Math.max(max.x-min.x,max.y-min.y,max.z-min.z));
  const m=frame(asset.attachment.position,asset.attachment.rotation),origin=asset.attachment.position,o=project(origin,w,h);if(!o)return;
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
 function begin(handle,x,y){const {manual,setup,live}=handles.target;active={...handle,start:[x,y],origin:handles.origin,manual,live,setup};}
 function drag(x,y,event,w,h){
  if(!active)return;const {manual,setup}=active;let next;
  if(active.kind==='move'){
   const a=active.axis,raw=((x-active.start[0])*a.dir[0]+(y-active.start[1])*a.dir[1])/a.perUnit,step=event.shiftKey?0:event.ctrlKey||event.metaKey?.5:.05,amount=step?Math.round(raw/step)*step:raw;
   next={...manual,position:add(manual.position,a.vector,amount)};
  }else{
   const angle=p=>Math.atan2(p[1]-active.origin[1],p[0]-active.origin[0]);let delta=angle([x,y])-angle(active.start);
   // Screen rotation direction depends on whether the socket normal faces the camera.
   const normal=new THREE.Vector3(...active.live.normal),probe=new THREE.Vector3(1,0,0);if(Math.abs(probe.dot(normal))>.9)probe.set(0,0,1);probe.addScaledVector(normal,-probe.dot(normal)).normalize();
   const turned=probe.clone().applyAxisAngle(normal,.2),a0=project(add(active.live.position,probe.toArray()),w,h),a1=project(add(active.live.position,turned.toArray()),w,h);
   const sign=a0&&a1&&Math.atan2(a1[1]-active.origin[1],a1[0]-active.origin[0])-Math.atan2(a0[1]-active.origin[1],a0[0]-active.origin[0])<0?-1:1;
   const stepDeg=event.shiftKey?0:(getPreferences().rotationAngle||15),deg=THREE.MathUtils.radToDeg(Math.atan2(Math.sin(delta),Math.cos(delta)))*sign,snapped=stepDeg?Math.round(deg/stepDeg)*stepDeg:deg;
   const matrix=new THREE.Matrix4().makeRotationAxis(normal,THREE.MathUtils.degToRad(snapped)).multiply(frame([0,0,0],manual.rotation)),euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');
   next={...manual,rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)};
  }
  active.current={...setup,sockets:setup.sockets.map(s=>s.id===manual.id?next:s)};previewSetup(scene,active.current);
 }
 async function end(){const done=active;active=null;if(!done?.current)return;await changeSetup(scene,done.current,{previous:done.setup});}
 function cancel(){if(!active)return false;previewSetup(scene,active.setup);active=null;return true;}
 // Component window: click a block face to make it the attachment face.
 function pickAttachment(pick){
  const asset=scene.componentAttachmentDraft;if(!asset||!scene.pickAttachment||!pick)return false;
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
