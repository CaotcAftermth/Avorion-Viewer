import {projectPoint} from '../src/navigation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel,ORIENTATIONS,nativeToView} from '../src/block-model.js';
import {socketFaces,faceCenter,snapToFace,gridSteps,faceGrid,boundingSocketFaces,socketNormalChoices,orientSocket,gridFrame,faceBoundary,faceEdgeLabels} from '../src/components/socket-face.js';
import {savedSocket,componentSetup,componentMatrix} from '../src/components/core.js';
import {assignComponent,rotateSurfaceComponent,detachSurfaceComponent} from '../src/components/mounting.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('whole coplanar faces have triangulation-independent area centers on all shapes and rotations',()=>{
 for(const typeIndex of [2,100,101,102,103,108,109,112])for(const orientation of ORIENTATIONS){
  const block=makeBlock({typeIndex,...orientation,size:{x:2,y:4,z:8},position:{x:10,y:-3,z:7}});
  for(const face of socketFaces(block)){
   assert.ok(face.contains(face.position));let area=0;const centroid=new THREE.Vector3();
   for(const triangle of face.triangles){const t=new THREE.Triangle(...triangle.map(p=>new THREE.Vector3(...p))),a=t.getArea();area+=a;centroid.addScaledVector(t.getMidpoint(new THREE.Vector3()),a);}
   centroid.divideScalar(area);centroid.toArray().forEach((v,i)=>near(v,face.position[i]));
   assert.deepEqual(faceCenter(face,'face'),face.position);
   if(face.projectedCenter)assert.ok(face.contains(face.projectedCenter));else assert.equal(faceCenter(face,'block'),null);
  }
 }
});
test('triangle face centroid differs from bounding-center projection; grid and free remain on the polygon',()=>{
 const face=socketFaces(makeBlock({typeIndex:100,size:{x:2,y:4,z:8}})).find(f=>f.triangles.length===1);
 assert.ok(face);assert.ok(new THREE.Vector3(...face.position).distanceTo(new THREE.Vector3(...face.projection))>.01);
 const center=face.position;
 assert.ok(face.contains(snapToFace(face,center,{mode:'free'})));
 assert.equal(snapToFace(face,face.world([1e3,1e3]),{mode:'free'}),null);
 for(const square of [true,false])assert.ok(face.contains(snapToFace(face,center,{mode:'grid',divisions:10,square})));
 const [a,b]=gridSteps(face,{divisions:10,square:true});near(a,b);
 assert.deepEqual(gridSteps(face,{density:'spacing',spacing:.25}),[.25,.25]);
 assert.equal(gridSteps(face,{density:'spacing',spacing:0}),null);
});
test('new assignment keeps imported dimensions, quarter turns, one socket, and detached sockets survive',()=>{
 const block=makeBlock({id:'hull'}),face=socketFaces(block)[0],model=makeModel([block]),socket=savedSocket(model,face,'Future component');socket.faceId=face.faceId;
 model.componentSetup={version:1,blockType:null,sockets:[socket],mounts:[]};
 const scene={model,componentSymmetry:{x:true}},asset={id:'asset',name:'Component',sourceXml:'fixture',blocks:[makeBlock()],attachment:{position:[0,0,0],rotation:[0,0,0]}};
 const live={...face,id:socket.id,type:'component'};model.componentSetup=assignComponent(scene,asset,live);
 assert.equal(componentSetup(model).mounts.length,1);let mount=componentSetup(model).mounts[0];assert.equal(mount.scale,1);assert.equal(mount.twist,0);
 model.componentSetup=rotateSurfaceComponent(scene,mount,1);mount=componentSetup(model).mounts[0];assert.equal(mount.twist,90);
 model.componentSetup=rotateSurfaceComponent(scene,mount,-1);mount=componentSetup(model).mounts[0];assert.equal(mount.twist,0);
 model.componentSetup=detachSurfaceComponent(scene,mount);assert.equal(componentSetup(model).mounts.length,0);assert.equal(componentSetup(model).sockets.length,1);
});

test('rectangular face division counts produce N cells for even and odd values',()=>{
 const face=socketFaces(makeBlock({size:{x:4,y:2,z:3}}))[0];
 for(const divisions of [1,2,9,10,11]){
  const lines=faceGrid(face,{mode:'grid',center:'face',density:'divisions',divisions,square:false});
  assert.equal(lines.length,(divisions+1)*2);
 }
});


test('incenter uses triangle side weights and stays centered on rectangular faces',()=>{
 const triangle=socketFaces(makeBlock({typeIndex:100,size:{x:2,y:4,z:8}})).find(f=>f.triangles.length===1),vertices=triangle.triangles[0].map(p=>new THREE.Vector3(...p));
 const weights=vertices.map((_,i)=>vertices[(i+1)%3].distanceTo(vertices[(i+2)%3])),expected=new THREE.Vector3();vertices.forEach((p,i)=>expected.addScaledVector(p,weights[i]));expected.divideScalar(weights.reduce((a,b)=>a+b));
 faceCenter(triangle,'incenter').forEach((n,i)=>near(n,expected.toArray()[i]));assert.ok(expected.distanceTo(new THREE.Vector3(...triangle.position))>.01);
 for(const face of socketFaces(makeBlock({size:{x:2,y:4,z:8}})))face.incenter.forEach((n,i)=>near(n,face.position[i]));
 assert.ok(snapToFace({...triangle,projectedCenter:null},triangle.position,{mode:'free',center:'block'}),'free positioning does not depend on a hidden center setting');
});

test('every shape and orientation offers only outward bounding-box axis socket normals',()=>{
 for(const typeIndex of [2,100,101,102,103,108,109,112])for(const orientation of ORIENTATIONS){
  const block=makeBlock({typeIndex,...orientation,size:{x:2,y:4,z:8}}),box=boundingSocketFaces(block);assert.equal(box.length,6);
  for(const face of socketFaces(block)){
   assert.ok(face.contains(face.incenter));const choices=socketNormalChoices(face);assert.ok(choices.length>=1&&choices.length<=3);
   for(const choice of choices){assert.equal(choice.normal.filter(n=>n!==0).length,1);assert.ok(new THREE.Vector3(...choice.normal).dot(new THREE.Vector3(...face.normal))>0);
    const oriented=orientSocket(face,choice.normal),normal=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(...oriented.rotation.map(THREE.MathUtils.degToRad)));normal.toArray().forEach((n,i)=>near(n,choice.normal[i]));
    assert.ok(box.some(f=>f.normal.every((n,i)=>Math.abs(n-choice.normal[i])<1e-5)));
   }
  }
 }
});


test('grid origin ignores center preference and edge orientation controls both preview and snapping',()=>{
 const face=socketFaces(makeBlock({typeIndex:100,size:{x:2,y:4,z:8}})).find(f=>f.triangles.length===1),base={mode:'grid',density:'spacing',spacing:.1};
 assert.deepEqual(faceGrid(face,{...base,center:'block'}),faceGrid(face,{...base,center:'incenter'}));
 for(let edge=0;edge<3;edge++){
  const basis=gridFrame(face,{edge}),[a,b]=faceBoundary(face)[edge],u=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(),axis=new THREE.Vector3(...basis.world([1,0])).sub(new THREE.Vector3(...basis.world([0,0]))).normalize();near(Math.abs(axis.dot(u)),1);
  const snapped=snapToFace(face,face.position,{...base,edge});assert.ok(face.contains(snapped));assert.ok(faceGrid(face,{...base,edge}).length>0);
 }
});


test('floor edge is first and every edge label plate lies outside the aligned face',()=>{
 for(const typeIndex of [100,101,102,103,108,109,112])for(const orientation of ORIENTATIONS){
  for(const face of socketFaces(makeBlock({typeIndex,...orientation,size:{x:2,y:4,z:8}}))){
   const n=nativeToView(face.normal),view={yaw:Math.hypot(n[0],n[1])<1e-7?0:Math.atan2(n[0],-n[1]),pitch:Math.asin(n[2]),roll:0,zoom:.8,projection:'orthographic',target:nativeToView(face.position),panX:0,panY:0},project=p=>projectPoint(nativeToView(p),view,800,600);
   const edges=faceBoundary(face),heights=edges.map(([a,b])=>(project(a)[1]+project(b)[1])/2);near(heights[0],Math.max(...heights));
   const triangles=face.triangles.map(t=>new THREE.Triangle(...t.map(p=>{const q=project(p);return new THREE.Vector3(q[0],q[1],0);}))),inside=([x,y])=>triangles.some(t=>{const b=t.getBarycoord(new THREE.Vector3(x,y,0),new THREE.Vector3());return b&&b.x>1e-7&&b.y>1e-7&&b.z>1e-7;});
   for(const {label:[x,y]} of faceEdgeLabels(face,project))for(const [dx,dy] of [[0,0],[-9,-10],[-9,10],[9,-10],[9,10]])assert.equal(inside([x+dx,y+dy]),false,'label and plate stay outside face');
  }
 }
});


test('selected edge subdivisions, including endpoints, are approved Square and Equal nodes',()=>{
 for(const orientation of ORIENTATIONS){
  for(const face of socketFaces(makeBlock({typeIndex:100,...orientation,size:{x:2,y:4,z:8}})).filter(f=>faceBoundary(f).length===3)){
   const boundary=faceBoundary(face);
   for(let edge=0;edge<3;edge++)for(const divisions of [1,3,7])for(const square of [true,false]){
    const [a,b]=boundary[edge],settings={mode:'grid',density:'divisions',edge,divisions,square},basis=gridFrame(face,settings),steps=gridSteps(basis,settings);
    near(steps[0]*divisions,new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)));if(square)near(steps[0],steps[1]);
    for(let i=0;i<=divisions;i++){const expected=a.map((v,k)=>v+(b[k]-v)*i/divisions),actual=snapToFace(face,expected,settings);assert.ok(actual);actual.forEach((v,k)=>near(v,expected[k]));}
   }
  }
 }
});

test('Equal triangular grid uses the base and apex and contains every barycentric subdivision',()=>{
 const face=socketFaces(makeBlock({typeIndex:100,size:{x:2,y:4,z:8}})).find(f=>faceBoundary(f).length===3),boundary=faceBoundary(face),divisions=5;
 for(let edge=0;edge<3;edge++){
  const [a,b]=boundary[edge],c=boundary.map(([p])=>p).find(p=>p!==a&&p!==b),settings={mode:'grid',density:'divisions',edge,divisions,square:false};
  const lines=faceGrid(face,settings);assert.equal(lines.length,3*divisions);for(const line of lines)for(const point of line)assert.ok(face.contains(point));
  for(let i=0;i<=divisions;i++)for(let j=0;j<=divisions-i;j++){
   const expected=a.map((v,k)=>v+(b[k]-v)*i/divisions+(c[k]-v)*j/divisions),actual=snapToFace(face,expected,settings);assert.ok(actual);actual.forEach((v,k)=>near(v,expected[k]));
  }
 }
});
