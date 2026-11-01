import * as THREE from './vendor/three.module.js';
import {liveBlocks,viewportHiddenIds} from './ship-structure.js';

export function modelExtents(blocks){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const b of blocks)for(const [i,a]of ['x','y','z'].entries()){const half=Math.abs(b.size[a])/2;min[i]=Math.min(min[i],b.position[a]-half);max[i]=Math.max(max[i],b.position[a]+half);}
 return blocks.length?{min,max,size:max.map((v,i)=>v-min[i])}:null;
}

export function dimensionRulers(bounds,back){
 const gap=Math.max(...bounds.size,.01)*.07;
 return bounds.size.map((size,axis)=>{
  const start=bounds.min.map((v,i)=>i===axis?v:back[i]>=0?bounds.max[i]:v),end=[...start];end[axis]=bounds.max[axis];
  const a=start.map((v,i)=>v+(i===axis?0:(back[i]>=0?gap:-gap))),b=end.map((v,i)=>v+(i===axis?0:(back[i]>=0?gap:-gap)));
  return {axis,size,a,b,start,end,label:['Width (X)','Height (Y)','Length (Z)'][axis]+': '+Number(size.toPrecision(6))+' u',color:['#e99292','#91b9f2','#a5ce88'][axis]};
 });
}

// Parallel screen-space ruler outside every projected bound corner.
export function exteriorRuler(a,b,corners,sign=1,gap=24){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<1||!corners.length)return null; // Axis points into the camera.
 const normal=[-dy/length*sign,dx/length*sign];
 const dot=p=>p[0]*normal[0]+p[1]*normal[1];
 const offset=Math.max(...corners.map(dot))+gap-dot(a);
 const shift=p=>[p[0]+normal[0]*offset,p[1]+normal[1]*offset];
 return {a:shift(a),b:shift(b),normal};
}

// One shared wire cube, six floats per visible block, and one instanced draw.
export function createBlockBoundsOverlay(){
 const box=new THREE.BoxGeometry(1,1,1),edges=new THREE.EdgesGeometry(box),geometry=new THREE.InstancedBufferGeometry();box.dispose();
 geometry.setAttribute('position',edges.getAttribute('position').clone());edges.dispose();geometry.instanceCount=0;
 const material=new THREE.LineBasicMaterial({color:0x95c6ed,transparent:true,opacity:.65,depthWrite:false,depthTest:true,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 boundsCenter;\nattribute vec3 boundsSize;\n'+shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed = position * boundsSize + boundsCenter;');
 };
 const object=new THREE.LineSegments(geometry,material);object.frustumCulled=false;object.renderOrder=100;
 let cachedBlocks,cachedHidden;
 return {object,update(scene,view){
  const blocks=liveBlocks(scene),hidden=viewportHiddenIds(scene,view);
  if(blocks===cachedBlocks&&hidden===cachedHidden)return;
  cachedBlocks=blocks;cachedHidden=hidden;
  const count=blocks.reduce((n,b)=>n+!hidden.has(b.id),0),centers=new Float32Array(count*3),sizes=new Float32Array(count*3);let i=0;
  for(const b of blocks){if(hidden.has(b.id))continue;for(const a of ['x','y','z']){centers[i]=b.position[a];sizes[i]=Math.abs(b.size[a]);i++;}}
  // Dispose the previous GPU attributes before replacing them.
  geometry.dispose();geometry.setAttribute('boundsCenter',new THREE.InstancedBufferAttribute(centers,3));geometry.setAttribute('boundsSize',new THREE.InstancedBufferAttribute(sizes,3));geometry.instanceCount=count;
 },dispose(){geometry.dispose();material.dispose();}};
}

export function createDimensionCage(){
 const geometry=new THREE.BufferGeometry(),material=new THREE.LineDashedMaterial({color:0x91cde5,transparent:true,opacity:.65,depthTest:true,depthWrite:false,toneMapped:false});
 const object=new THREE.LineSegments(geometry,material);object.frustumCulled=false;object.renderOrder=100;let cached;
 return {object,update(scene){
  const blocks=liveBlocks(scene);if(blocks===cached)return;cached=blocks;
  const bounds=modelExtents(blocks),positions=[];
  if(bounds){const corners=[];for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])corners.push([x,y,z]);
   for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))positions.push(...corners[i],...corners[i|bit]);
   material.dashSize=Math.max(...bounds.size,.01)/100;material.gapSize=material.dashSize*.7;
  }
  geometry.dispose();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));object.computeLineDistances();
 },dispose(){geometry.dispose();material.dispose();}};
}
