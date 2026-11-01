import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { makeBlock,makeModel,ORIENTATIONS,getBlockDefinition,modelCorners,repaintRGB,viewToNative,nativeToView } from '../src/block-model.js';
import { resolveOrientation,defaultOrientationProfile,localScaleFor } from '../src/avorion/lib/avorion/orientation.js';
import { blockSurfaceGeometry,surfaceKind } from '../src/avorion/lib/geometry/blockSurface.js';
import { resolvedSecondaryColor } from '../src/avorion/lib/avorion/secondaryColor.js';
import { area,defaults,validateState } from '../src/layout.js';
import { frameBounds,projectPoint } from '../src/navigation.js';
const profile=defaultOrientationProfile(),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const types=[2,100,101,102,103,108,109,112],volumes=[1,.5,1/6,5/6,1/3,1/6,1/6,1/3];
test('all 8 shapes × 24 rotations retain world extents, volume, outward winding and face UVs',()=>{
  assert.equal(ORIENTATIONS.length,24);
  for(const [shape,typeIndex] of types.entries())for(const {look,up} of ORIENTATIONS){
    const block=makeBlock({typeIndex,look,up,size:{x:2,y:4,z:8},position:{x:10,y:-7,z:31}});
    const {positions,uv,faces}=blockSurfaceGeometry(block,profile),points=[];
    for(let i=0;i<positions.length;i+=3)points.push(new THREE.Vector3().fromArray(positions,i));
    const bounds=new THREE.Box3().setFromPoints(points),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    [2,4,8].forEach((v,i)=>close(size.getComponent(i),v));[10,-7,31].forEach((v,i)=>close(center.getComponent(i),v));
    const centroid=points.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).divideScalar(points.length);let volume=0;
    for(let i=0;i<points.length;i+=3){
      const [a,b,c]=points.slice(i,i+3),n=b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(n.length()>0);assert.ok(n.dot(a.clone().sub(centroid))>0,`${typeIndex} winding`);
      volume+=a.clone().sub(centroid).dot(b.clone().sub(centroid).cross(c.clone().sub(centroid)))/6;
      assert.equal(faces[i*3+2],faces[(i+1)*3+2]);
    }
    close(volume,64*volumes[shape]);for(const value of uv)assert.ok(value>=-1e-6&&value<=1.000001);
  }
});
test('look maps local X; world-size permutation is independent of shape',()=>{
  const {base,degenerate}=resolveOrientation(profile,5,3);assert.equal(degenerate,false);
  const x=new THREE.Vector3(1,0,0).applyQuaternion(base);close(x.x,0);close(x.y,0);close(x.z,1);
  const scale=localScaleFor(base,{x:2,y:4,z:8});[8,4,2].forEach((v,i)=>close(scale.getComponent(i),v));
  for(const pair of [[1,0],[6,3],[-1,3],[1,1],[1.5,3],[NaN,3]])assert.equal(resolveOrientation(profile,...pair).degenerate,true);
});
test('nonconsecutive catalog IDs and local functional sides are preserved',()=>{
  assert.equal(getBlockDefinition(127).geometryKind,'flatcorner');
  for(const id of [21,23,25,601,651])assert.equal(getBlockDefinition(id).geometryKind,'wedge');
  assert.equal(getBlockDefinition(18).displayName,'Torpedo Launcher');assert.equal(getBlockDefinition(22).displayName,'Frontal Torpedo Launcher');
  assert.equal(getBlockDefinition(9999).geometryKind,'placeholder');
  for(let side=0;side<6;side++){assert.equal(surfaceKind('engine',side),side===4?1:0);assert.equal(surfaceKind('directional-thruster',side),side>=4?2:0);}
});
test('ARGB repaint preserves alpha and secondary alpha blends only once',()=>{
  assert.equal(repaintRGB('80ffffff','#123456'),'80123456');
  const b=makeBlock({color:'80102030',secondaryColor:'80ff0000'}),color=resolvedSecondaryColor(b),weight=128/255;
  close(color[0],16/255*(1-weight)+weight);close(color[1],32/255*(1-weight));assert.equal(color[3],1);
  assert.equal(b.color,'80102030');
});
test('hangar interior carries separate side metadata and local surface routing',()=>{
  const {faces}=blockSurfaceGeometry(makeBlock({typeIndex:10}),profile);
  for(let vertex=0;vertex<96;vertex++){
    const side=faces[vertex*3+2];assert.equal(side>=6,vertex>=72);
    assert.equal(surfaceKind('hangar',side),vertex>=72?27:15);
  }
});
test('large native models frame inside viewport and camera remains persistable',()=>{
  const state=defaults(),view=area().view;const model=makeModel([makeBlock({size:{x:2000,y:4000,z:8000}})]);
  const corners=modelCorners(model);assert.equal(frameBounds(view,corners,800,600),true);assert.ok(view.zoom<.2);
  for(const p of corners){const q=projectPoint(p,view,800,600);assert.ok(q[0]>=0&&q[0]<=800&&q[1]>=0&&q[1]<=600);}
  const visit=n=>{if(n.type==='area')n.view=view;else{visit(n.first);visit(n.second);}};visit(state.workspaces[0].root);assert.ok(validateState(state));
  assert.deepEqual(viewToNative(nativeToView([1,2,3])),[1,2,3]);
});
