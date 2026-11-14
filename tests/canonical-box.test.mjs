import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel,ORIENTATIONS} from '../src/block-model.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {blockSurfaceGeometry} from '../src/avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
import {placeBoxVertex,isCanonicalBox} from '../src/avorion/lib/geometry/boxInstances.js';
import {selectedBlockEdges} from '../src/selection-outline.js';

const profile=defaultOrientationProfile();
const build=(blocks,canonicalBoxes,measure)=>buildTexturedModel(makeModel(blocks),profile,
  {...DEFAULT_GAME_SHADER,simplified:true,canonicalBoxes,measure});
const boxes=(orientation={look:1,up:3},typeIndex=2)=>Array.from({length:20},(_,i)=>
  makeBlock({...orientation,typeIndex,id:'b'+i,position:{x:i/16,y:0,z:0},
    size:{x:1+i/32,y:.5,z:2-i/32},secondaryColor:'804080ff'}));

test('canonical boxes reconstruct baked vertices, physical UV dimensions and side metadata for every orientation',()=>{
  const p=new THREE.Vector3(),scale=new THREE.Vector3(),offset=new THREE.Vector3();
  for(const orientation of ORIENTATIONS){
    const blocks=boxes(orientation),rendered=build(blocks,true);
    try{
      const mesh=rendered.group.children.find(m=>m.userData.textured),g=mesh.geometry;
      assert.equal(g.instanceCount,20);
      assert.equal(Object.keys(g.attributes).length,14);
      const scales=g.getAttribute('aScale');
      assert.ok(scales.isInstancedBufferAttribute);
      assert.equal(scales.itemSize,3);
      assert.equal(scales.meshPerAttribute,1);
      assert.ok(scales.array instanceof Float32Array);
      assert.equal(Object.values(g.attributes).filter(a=>a.isInstancedBufferAttribute)
        .reduce((n,a)=>n+a.itemSize*a.array.BYTES_PER_ELEMENT,0),116);
      const bounds=new THREE.Box3();
      for(const [i,b] of blocks.entries()){
        const baked=blockSurfaceGeometry(b,profile);
        scale.fromBufferAttribute(scales,i);offset.fromBufferAttribute(g.getAttribute('aOffset'),i);
        for(let v=0;v<baked.positions.length/3;v++){
          placeBoxVertex(p.fromBufferAttribute(g.getAttribute('position'),v),scale,offset);
          assert.ok(p.distanceTo(new THREE.Vector3().fromArray(baked.positions,v*3))<1e-6);
          bounds.expandByPoint(p);
          assert.equal(g.getAttribute('aFaceUV').getX(v),baked.uv[v*2]);
          assert.equal(g.getAttribute('aFaceUV').getY(v),baked.uv[v*2+1]);
          assert.equal(g.getAttribute('aSide').getW(v),baked.faces[v*3+2]);
          const surface=g.getAttribute('aSurface');
          assert.equal(scale.getComponent(surface.getX(v)),baked.faces[v*3]);
          assert.equal(scale.getComponent(surface.getY(v)),baked.faces[v*3+1]);
        }
      }
      assert.deepEqual(g.boundingBox,bounds);
    }finally{rendered.dispose();}
  }
});

test('canonical picking, contours, partial paint, hide and pose use actual instance geometry',()=>{
  const blocks=boxes().map((b,i)=>({...b,position:{x:2+i/16,y:2,z:2+i/8}}));
  const canonical=build(blocks,true),legacy=build(blocks,false);
  const batch=canonical.group.children.find(m=>m.userData.textured);
  const ids=new Set(['b0']),ray=new THREE.Raycaster(new THREE.Vector3(2,2,20),new THREE.Vector3(0,0,-1));
  const hit=m=>ray.intersectObjects(m.group.children.filter(c=>c.userData.textured))[0];
  const compareHit=()=>{
    const a=hit(canonical),b=hit(legacy);
    assert.ok(a&&b);
    assert.equal(a.blockId,b.blockId);
    assert.deepEqual(a.point,b.point);
    assert.deepEqual(a.face.normal,b.face.normal);
    assert.equal(a.distance,b.distance);
  };
  try{
    assert.ok(batch.geometry.getAttribute('aScale'));
    compareHit();
    assert.deepEqual(selectedBlockEdges(canonical.group,ids),selectedBlockEdges(legacy.group,ids));
    const color=batch.geometry.getAttribute('aSecondary'),other=color.getW(1);
    blocks[0].secondaryColor='400080ff';
    canonical.updateColors(makeModel(blocks),ids);
    assert.equal(color.getW(0),Math.fround(64/255));
    assert.equal(color.getW(1),other);
    assert.deepEqual(color.updateRanges,[{start:0,count:4}]);
    for(const m of [canonical,legacy])m.setHidden(ids);
    compareHit();
    const pose=new Map([['b0',new THREE.Matrix4().makeTranslation(0,1,0)]]);
    for(const m of [canonical,legacy]){m.setHidden(new Set());m.setBlockTransforms(pose);}
    assert.equal(batch.geometry.getAttribute('aScale'),undefined);
    assert.equal(batch.material.defines.BLOCK_CANONICAL_BOX,undefined);
    assert.deepEqual(selectedBlockEdges(canonical.group,ids),selectedBlockEdges(legacy.group,ids));
    const rest=batch.geometry.getAttribute('aSide'),baked=blockSurfaceGeometry(blocks[0],profile);
    assert.deepEqual([rest.getX(0),rest.getY(0),rest.getZ(0)],Array.from(baked.positions.subarray(0,3)));
    compareHit();
  }finally{canonical.dispose();legacy.dispose();}
});

test('canonical boxes reject unsafe precision, specialized shapes and overrides',()=>{
  const block=boxes()[0];
  assert.ok(isCanonicalBox(block,profile));
  assert.equal(isCanonicalBox({...block,typeIndex:100},profile),false);
  assert.equal(isCanonicalBox({...block,typeIndex:6},profile),false);
  assert.equal(isCanonicalBox({...block,size:{...block.size,x:1e-8}},profile),false);
  assert.equal(isCanonicalBox({...block,position:{...block.position,x:1e8}},profile),false);
  assert.equal(isCanonicalBox(block,{...profile,typeOverrides:{2:{x:5}}}),false);
  const rejected=build(boxes().slice(0,15),true);
  try{assert.equal(rejected.group.children.filter(m=>m.userData.textured&&m.userData.instanced).length,0);}
  finally{rejected.dispose();}
});

test('canonical chunks share the existing budget and can displace legacy wedge groups',()=>{
  const blocks=Array.from({length:1025},(_,i)=>makeBlock({id:'box'+i,
    position:{x:i%32/128,y:0,z:0},size:{x:1+i/4096,y:1,z:1}}));
  for(let group=0;group<16;group++)
    for(let i=0;i<16;i++)blocks.push(makeBlock({id:'w'+group+'-'+i,typeIndex:100,
      position:{x:i/128,y:0,z:0},size:{x:1+group/32,y:1,z:1}}));
  let metrics;
  const before=build(blocks,false),after=build(blocks,true,(type,data)=>{if(type==='hull writes completed')metrics=data;});
  try{
    const instanced=m=>m.group.children.filter(c=>c.userData.textured&&c.userData.instanced);
    assert.equal(instanced(before).length,16);
    assert.equal(instanced(after).length,16);
    assert.deepEqual(instanced(after).filter(c=>c.geometry.getAttribute('aScale')).map(c=>c.geometry.instanceCount),[1024,1]);
    assert.equal(metrics.canonicalCounts[2].accepted,1025);
    assert.equal(instanced(after).filter(c=>!c.geometry.getAttribute('aScale')).length,14);
    assert.equal(after.ranges.size,blocks.length);
  }finally{before.dispose();after.dispose();}
});
