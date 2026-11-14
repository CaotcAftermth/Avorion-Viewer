import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock,makeModel,ORIENTATIONS} from '../src/block-model.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import * as THREE from '../src/vendor/three.module.js';
const block=(typeIndex,i,extra={})=>makeBlock({id:'b'+i,typeIndex,position:{x:i%150*2+.25,y:Math.floor(i/150)*2+.25,z:.25},secondaryColor:i%2?'804080ff':undefined,...extra});
const fixtures={
 empty:[],
 mixed:[...[2,6,7,9,10,13,100,101,102,103,123,124,125,126,127,128,129,151,170,190].flatMap((t,j)=>ORIENTATIONS.map((o,i)=>block(t,j*24+i,{...o,materialIndex:i%7,size:{x:i===0?1e-8:.3+i/5,y:i===1?0:2,z:i===2?9000:1.5},...(i===2?{position:{x:1000000,y:4,z:3}}:{})}))),...Array.from({length:20},(_,i)=>block(6,480+i,{position:{x:i/25,y:.25,z:.25}}))],
 glass16:Array.from({length:1820},(_,i)=>block(170,i)),
 glass32:Array.from({length:1821},(_,i)=>block(170,i)),
};

const reference={
 empty:'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
 mixed:'abe5f44ffdce3da7c6da545f64ef1d1adebfefa3f6ec4d9ad52cd6d5ce750b72',
 glass16:'f0495ea32c6dd6ee4cdc73b11f3948790a1ac6959413a5fc90282db2354ee209',
 glass32:'68e0b8c5b2f8940d14db54099f02b1357579366aa1e68ba61c4ebfcfbba96137',
};

for(const [name,blocks] of Object.entries(fixtures)){
 test(`counted hull matches Milestone 1 buffers and picking for ${name}`,()=>{
  const camera=new THREE.PerspectiveCamera();
  camera.position.set(10,20,30);camera.lookAt(0,0,0);
  const phases=new Map(),model=makeModel(blocks);
  const rendered=buildTexturedModel(model,defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true,
   measure:(kind,data)=>phases.set(kind,data)});
  try{
   const hash=createHash('sha256');let bytes=0;
   const array=a=>{hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));bytes+=a.byteLength;};
   const json=o=>hash.update(JSON.stringify(o));
   const meshes=rendered.group.children.filter(m=>m.userData.textured);
   for(const m of meshes){
    const g=m.geometry;g.computeBoundingBox();
    json([m.userData.instanced,g.instanceCount,g.boundingBox,g.boundingSphere,[...m.userData.ranges],m.userData.pickTree,m.material.transparent,m.material.userData.hardwareCull]);
    for(const [key,a] of Object.entries(g.attributes)){json([key,a.itemSize,a.usage]);array(a.array);}
    if(g.index)array(g.index.array);
   }
   if(name==='glass16'||name==='glass32')assert.equal(meshes[0].geometry.index.array.constructor.name,name==='glass16'?'Uint16Array':'Uint32Array');
   rendered.prepare(camera);
   for(const m of meshes)if(m.geometry.index)hash.update(Buffer.from(m.geometry.index.array.buffer));
   const ray=new THREE.Raycaster(new THREE.Vector3(.25,.25,20),new THREE.Vector3(0,0,-1));
   json(ray.intersectObjects(meshes,false).slice(0,10).map(hit=>[hit.blockId,hit.instanceId,hit.point.toArray(),hit.faceIndex]));
   assert.equal(hash.digest('hex'),reference[name]);
   const accounting=phases.get('hull construction');
   assert.equal(accounting.attributeBytes+accounting.indexBytes,bytes);
   assert.equal(accounting.numericStagingSlots,0);
   assert.equal(accounting.sideExpansionSlots,0);
  }finally{rendered.dispose();}
 });
}
