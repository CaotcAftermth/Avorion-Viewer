import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
import {basis,metrics,orbit,pan,zoom,frameBounds} from '../navigation.js';
import {nativeToView,viewToNative} from '../block-model.js';
import {PARTS,partMatrices,frame,vector,componentEnvelope,componentBounds} from './core.js';
import {ROTATION_AXIS_COLORS} from './asset-guides.js';

export function createLabViewport(canvas,onSelect,onFace){
  const events=new AbortController();
  const listen=(type,handler,options={})=>canvas.addEventListener(type,handler,{...options,signal:events.signal});
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,logarithmicDepthBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const world=new THREE.Scene();world.background=new THREE.Color('#151c25');
  world.add(new THREE.HemisphereLight(0xd9edff,0x4a3c31,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(12,20,8);world.add(light);
  const camera=new THREE.PerspectiveCamera(),content=new THREE.Group(),guides=new THREE.Group();world.add(content,guides);
  const profile=defaultOrientationProfile(),cache=new Map(),ray=new THREE.Raycaster();
  let project,selected,designOnly=false,showGuides=true,tool='orbit',drag;
  const view={yaw:.65,pitch:.45,roll:0,zoom:1,panX:0,panY:0,target:[0,0,0],projection:'perspective'};
  function geometry(key,blocks){
    if(cache.has(key))return cache.get(key);
    const positions=[],colors=[];
    for(const b of blocks){const data=blockSurfaceGeometry(b,profile),color=new THREE.Color('#'+b.color.slice(2));for(const value of data.positions)positions.push(value);for(let i=0;i<data.positions.length/3;i++)colors.push(color.r,color.g,color.b);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();cache.set(key,g);return g;
  }
  function clearObjects(group){group.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}if(o.userData.guide)o.geometry?.dispose();});group.clear();}
  function mesh(g,color,matrix,instanceId){
    if(!g.getAttribute('position').count)return;
    const material=new THREE.MeshStandardMaterial({color:color||'#ffffff',vertexColors:!color,roughness:.65,metalness:.1,side:THREE.DoubleSide});
    const object=new THREE.Mesh(g,material);object.matrixAutoUpdate=false;object.matrix.copy(matrix);object.userData.instanceId=instanceId;
    if(instanceId===selected){material.emissive.set('#1b2c3b');material.emissiveIntensity=.5;}
    content.add(object);
  }
  function axes(matrix,size=2){const helper=new THREE.AxesHelper(size);helper.matrixAutoUpdate=false;helper.matrix.copy(matrix);helper.userData.guide=true;guides.add(helper);}
  function componentGuides(asset,matrices,envelopes){
    if(envelopes&&asset.sourceSize)for(const part of PARTS){
      const bounds=componentBounds(asset,part);if(!bounds)continue;
      const box=new THREE.BoxGeometry(...componentEnvelope(part,asset.sourceSize)),edges=new THREE.EdgesGeometry(box);box.dispose();
      const helper=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:{base:0x76a9e8,body:0x78d795,barrel:0xf3bb68}[part]}));
      const center=['x','y','z'].map(k=>(bounds.min[k]+bounds.max[k])/2);helper.matrixAutoUpdate=false;helper.matrix.copy(matrices[part]).multiply(new THREE.Matrix4().makeTranslation(...center));helper.userData.guide=true;guides.add(helper);
    }
    // Native muzzle points use barrel-local coordinates. Their displayed placement
    // is provisional until checked against an in-game reference.
    for(const point of asset.muzzlePositions||[]){const offset=asset.native.offsets.barrel,position=point.map((v,i)=>v+offset[i]);const marker=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0x66ffff,depthTest:false}));marker.matrixAutoUpdate=false;marker.matrix.copy(matrices.barrel).multiply(new THREE.Matrix4().makeTranslation(...position));marker.userData.guide=true;marker.renderOrder=10;guides.add(marker);}
    for(const id of asset.muzzles){const b=asset.blocks.find(b=>b.id===id),marker=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.03,Math.min(b.size.x,b.size.y,b.size.z)*.4),8,6),new THREE.MeshBasicMaterial({color:0xffdd66,depthTest:false}));marker.matrixAutoUpdate=false;marker.matrix.copy(matrices.barrel).multiply(new THREE.Matrix4().makeTranslation(b.position.x,b.position.y,b.position.z));marker.userData.guide=true;marker.renderOrder=10;guides.add(marker);}
  }
  function sync(next,selection,{assetId,only=false,helpers=true,envelopes=false,invalidate=false}={}){
    project=next;selected=selection;designOnly=only;showGuides=helpers;clearObjects(content);clearObjects(guides);
    if(invalidate){for(const g of cache.values())g.dispose();cache.clear();}
    if(only){
      const a=project.assets.find(a=>a.id===assetId);if(a){
        for(const part of PARTS)mesh(geometry(a.id+'/'+part,a.blocks.filter(b=>a.parts[b.id]===part)),null,new THREE.Matrix4(),null);
        axes(frame(a.attachment.position,a.attachment.rotation));componentGuides(a,Object.fromEntries(PARTS.map(part=>[part,new THREE.Matrix4()])),envelopes);
        for(const [key,color] of [['yaw',ROTATION_AXIS_COLORS.yaw],['pitch',ROTATION_AXIS_COLORS.pitch]]){const helper=new THREE.ArrowHelper(vector(a[key].axis).normalize(),vector(a[key].position),3,color);helper.traverse(o=>o.userData.guide=true);guides.add(helper);}
      }
    }else{
      if(project.ship)mesh(geometry('ship',project.ship.blocks),null,new THREE.Matrix4(),null);
      for(const s of project.sockets)axes(frame(s.position,s.rotation),1.6);
      for(const i of project.instances){
        const a=project.assets.find(a=>a.id===i.assetId),s=project.sockets.find(s=>s.id===i.socketId),matrices=partMatrices(a,s,i);
        for(const part of PARTS)mesh(geometry(a.id+'/'+part,a.blocks.filter(b=>a.parts[b.id]===part)),i.colors[part],matrices[part],i.id);if(i.id===selected)componentGuides(a,matrices,envelopes);
      }
    }
    guides.visible=helpers;draw();
  }
  function draw(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);
    const b=basis(view),m=metrics(view,w,h),right=vector(viewToNative(b.right)),up=vector(viewToNative(b.up)),back=vector(viewToNative(b.back));
    camera.position.copy(vector(viewToNative(view.target))).addScaledVector(back,m.distance);camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));
    camera.near=Math.max(.001,m.distance/10000);camera.far=Math.max(1000,m.distance*100);camera.fov=2*Math.atan(h/(2*m.focal))*180/Math.PI;camera.aspect=w/h;camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.render(world,camera);
  }
  function fit(id){
    content.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const child of content.children)if(!id||child.userData.instanceId===id)bounds.expandByObject(child);
    if(bounds.isEmpty())return;
    const points=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(nativeToView([x,y,z]));
    frameBounds(view,points,canvas.clientWidth,canvas.clientHeight);draw();
  }
  listen('contextmenu',e=>e.preventDefault());
  listen('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,pan:e.shiftKey||e.button===2||tool==='pan'};canvas.setPointerCapture(e.pointerId);});
  listen('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.pan)pan(view,dx,dy,canvas.clientWidth,canvas.clientHeight);else orbit(view,dx,dy);drag.x=e.clientX;drag.y=e.clientY;draw();});
  listen('pointerup',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const click=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<4;drag=null;canvas.releasePointerCapture(e.pointerId);
    if(!click||e.button!==0||designOnly)return;
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=ray.intersectObjects(content.children,false)[0];if(!hit)return;
    if(hit.object.userData.instanceId)onSelect(hit.object.userData.instanceId);else onFace(hit.point.toArray(),hit.face.normal.clone().transformDirection(hit.object.matrixWorld).toArray());
  });
  listen('pointercancel',()=>drag=null);
  listen('wheel',e=>{e.preventDefault();zoom(view,Math.exp(-e.deltaY*.001));draw();},{passive:false});
  const observer=new ResizeObserver(draw);observer.observe(canvas.parentElement);
  function png(){const visible=guides.visible;try{guides.visible=false;draw();return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));}finally{guides.visible=visible;draw();}}
  function stl(){
    if(designOnly)throw Error('Switch off Design view to export the mounted assembly.');
    content.updateMatrixWorld(true);let count=0;for(const m of content.children)count+=m.geometry.getAttribute('position').count;if(count>3000000)throw Error('STL lab limit: one million triangles. Export a smaller assembly.');
    const chunks=['solid turret_lab\n'],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
    for(const mesh of content.children){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,i+2).applyMatrix4(mesh.matrixWorld);normal.subVectors(b,a).cross(c.clone().sub(a)).normalize();if(!normal.lengthSq())continue;chunks.push(`facet normal ${normal.toArray().join(' ')}\nouter loop\n${[a,b,c].map(v=>'vertex '+v.toArray().join(' ')).join('\n')}\nendloop\nendfacet\n`);}}
    chunks.push('endsolid turret_lab\n');return new Blob(chunks,{type:'model/stl'});
  }
  return {dispose(){events.abort();observer.disconnect();clearObjects(content);clearObjects(guides);for(const g of cache.values())g.dispose();cache.clear();renderer.dispose();renderer.forceContextLoss();},sync,fit,draw,png,stl,setTool(value){tool=value;},get view(){return view;}};
}
