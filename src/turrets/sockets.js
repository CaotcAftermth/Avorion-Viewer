import {drawSocketMarker} from '../socket-markers.js';
import {mounts} from './mounts.js';
import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
import {frame,socketAtFace} from './core.js';
import {liveBlocks} from '../ship-structure.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';
import {createSocketClearance} from './socket-clearance.js';
const types=new Set([20,21,24,25]);
export const isTurretBlock=block=>types.has(block.typeIndex);
export function blockSockets(block){return isTurretBlock(block)?surfaceSockets(block):[];}
export function surfaceSockets(block){
  const {positions}=blockSurfaceGeometry(block,defaultOrientationProfile()),groups=new Map();
  for(let i=0;i<positions.length;i+=9){
    const a=new THREE.Vector3().fromArray(positions,i),b=new THREE.Vector3().fromArray(positions,i+3),c=new THREE.Vector3().fromArray(positions,i+6);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)),area=normal.length()/2;if(area<1e-10)continue;normal.normalize();
    const key=[...normal.toArray(),normal.dot(a)].map(v=>v.toFixed(5)).join(',');
    const group=groups.get(key)||{normal,center:new THREE.Vector3(),area:0,vertices:[]};group.vertices.push(a.clone(),b.clone(),c.clone());group.center.addScaledVector(a.add(b).add(c).divideScalar(3),area);group.area+=area;groups.set(key,group);
  }
  return [...groups.values()].map((g,i)=>{const position=g.center.divideScalar(g.area).toArray(),normal=g.normal.toArray();const socket=socketAtFace(position,normal,`turret:${block.id}:${i}`);return {...socket,fitSize:faceFit(g.vertices,socket),type:'turret',blockId:block.id,faceId:i,name:`Face ${i+1}`,normal};});
}
const cache=new WeakMap();
export function sceneSockets(scene){
  const blocks=liveBlocks(scene);let sockets=cache.get(blocks);if(!sockets){const clearance=createSocketClearance(blocks);sockets=blocks.filter(isTurretBlock).flatMap(blockSockets).map(s=>({...s,fitSize:clearance(s)}));cache.set(blocks,sockets);}return sockets;
}
export function drawSockets(ctx,scene,view,width,height,color,visible=()=>true){
  const targeting=view.interactionMode==='socket'||scene.turretDragging;
  if(!targeting||!scene.visible||view.display?.showOverlays===false||view.interactionMode==='paint')return [];
  const hidden=scene.hiddenIds||new Set(),hits=[];
  ctx.save();color='#55ddff';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;
  for(const socket of sceneSockets(scene)){
    if(view.socketFilter==='components')continue;
    const occupied=mounts(scene).some(m=>m.socketId===socket.id),invalid=socket.fitSize==null;
    if(hidden.has(socket.blockId))continue;
    const p=projectPoint(nativeToView(socket.position),view,width,height);if(!p||p[0]<0||p[1]<0||p[0]>width||p[1]>height)continue;
    const exposed=visible(socket,p);if(!exposed&&(!scene.turretSockets?.through||scene.turretDragging))continue;
    const q=projectPoint(nativeToView(socket.position.map((v,i)=>v+socket.normal[i]*.5)),view,width,height);
    if(!occupied)drawSocketMarker(ctx,p,q,{selected:socket.id===scene.turretSockets?.selectedId,occupied,warning:invalid});
    hits.push({...socket,screen:p,exposed,occupied,invalid,reason:invalid?'Turret base too small':occupied?'Occupied · Replace':''});
  }ctx.restore();return hits.sort((a,b)=>a.screen[2]-b.screen[2]);
}

// Largest centered square inside the convex face in the attachment frame.
export function faceFit(vertices,socket){
  const inverse=frame(socket.position,socket.rotation).invert(),unique=new Map();
  for(const v of vertices){const p=v.clone().applyMatrix4(inverse);unique.set(p.x.toFixed(5)+','+p.z.toFixed(5),[p.x,p.z]);}
  const points=[...unique.values()].sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));let half=Infinity;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],nx=b[1]-a[1],nz=a[0]-b[0];half=Math.min(half,Math.abs(nx*a[0]+nz*a[1])/(Math.abs(nx)+Math.abs(nz)));}
  const size=Math.min(10,Math.floor((half*2+1e-5)*2)/2);return size>=.5?size:null;
}
