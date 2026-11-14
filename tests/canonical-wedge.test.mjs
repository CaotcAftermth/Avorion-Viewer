import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel,ORIENTATIONS} from '../src/block-model.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {blockSurfaceGeometry} from '../src/avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
import {isWedgeInstance,placeWedgeVertex,wedgeBoundsWriter} from '../src/avorion/lib/geometry/wedgeInstances.js';
import {selectedBlockEdges} from '../src/selection-outline.js';

const profile=defaultOrientationProfile();
const meshOf=model=>model.group.children.find(child=>child.userData.textured);
const blocksFor=(typeIndex,orientation)=>Array.from({length:16},(_,i)=>makeBlock({
  id:'w'+i,typeIndex,...orientation,size:{x:.25+i/32,y:1-i/32,z:2},position:{x:i/128,y:0,z:0},
  secondaryColor:'80345678'
}));
const build=(blocks,canonicalWedges)=>buildTexturedModel(makeModel(blocks),profile,
  {...DEFAULT_GAME_SHADER,simplified:true,canonicalWedges,instancing:canonicalWedges});

for(const type of [100,151])test('canonical wedge '+type+' matches baked topology and physical face data in all orientations',()=>{
  const point=new THREE.Vector3(),min=new THREE.Vector3(),max=new THREE.Vector3(),normal=new THREE.Vector3();
  const slope=new THREE.Vector3(),span=new THREE.Vector3();
  for(const orientation of ORIENTATIONS){
    const blocks=blocksFor(type,orientation);
    const reference=build(blocks,false),canonical=build(blocks,true);
    try{
      const mesh=meshOf(canonical),g=mesh.geometry,rg=meshOf(reference).geometry;
      assert.ok(isWedgeInstance(g));
      assert.equal(Object.keys(g.attributes).length,14);
      assert.equal(Object.values(g.attributes).filter(a=>a.isInstancedBufferAttribute)
        .reduce((sum,a)=>sum+a.itemSize*4,0),128);
      const bounds=new THREE.Box3();
      for(const [i,block] of blocks.entries()){
        const baked=blockSurfaceGeometry(block,profile);
        const low=g.getAttribute('aOffset'),high=g.getAttribute('aScale');
        min.fromBufferAttribute(low,i);max.fromBufferAttribute(high,i);span.subVectors(max,min);
        const extent=[low.getW(i),high.getW(i),g.getAttribute('aMaterialLayers').getW(i)];
        for(let v=0;v<24;v++){
          placeWedgeVertex(point.fromBufferAttribute(g.getAttribute('position'),v),max,min);
          assert.deepEqual(point.toArray(),Array.from(baked.positions.subarray(v*3,v*3+3)).map(x=>x||0));
          bounds.expandByPoint(point);
          const surface=g.getAttribute('aSurface'),uv=g.getAttribute('aFaceUV');
          assert.equal(extent[surface.getX(v)],baked.faces[v*3]);
          assert.equal(extent[surface.getY(v)],baked.faces[v*3+1]);
          assert.equal(g.getAttribute('aSide').getW(v),baked.faces[v*3+2]);
          assert.equal(uv.getX(v),baked.uv[v*2]);
          assert.equal(uv.getY(v),baked.uv[v*2+1]);
          normal.fromBufferAttribute(g.getAttribute('normal'),v).divide(span).normalize();
          assert.ok(normal.distanceTo(point.fromBufferAttribute(rg.getAttribute('normal'),i*24+v))<1e-7);
          for(let k=0;k<4;k++){
            const code=g.getAttribute('aEdges').getComponent(v,k);
            let angle=code;
            if(k<3&&code>=2){
              slope.set(1/span.x,1/span.y,1/span.z).setComponent(Math.floor((code-2)/3),0).normalize();
              angle=Math.acos(-slope.getComponent((code-2)%3))/Math.PI;
            }
            assert.ok(Math.abs(angle-rg.getAttribute('aEdges').getComponent(i*24+v,k))<1e-7);
          }
        }
      }
      assert.deepEqual(g.boundingBox,bounds);
    }finally{canonical.dispose();reference.dispose();}
  }
});

test('canonical wedge keeps exact triangle hits, empty wedge misses, contours, paint and posed attributes',()=>{
  const blocks=blocksFor(100,{look:1,up:3});
  blocks.forEach((b,i)=>{b.position={x:i*3,y:0,z:0};b.size={x:2+i/32,y:2,z:2};});
  const canonical=buildTexturedModel(makeModel(blocks),profile,{...DEFAULT_GAME_SHADER,simplified:true,canonicalWedges:true});
  const baked=build(blocks,false);
  try{
    const mesh=meshOf(canonical),reference=meshOf(baked);
    assert.ok(isWedgeInstance(mesh.geometry));
    const hit=(m,x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,5),new THREE.Vector3(0,0,-1)).intersectObject(m)[0];
    assert.equal(hit(mesh,-.75,.75),undefined);
    assert.equal(hit(reference,-.75,.75),undefined);
    const a=hit(mesh,.75,.25),b=hit(reference,.75,.25);
    assert.equal(a.blockId,b.blockId);
    assert.deepEqual(a.point,b.point);
    assert.deepEqual(a.face.normal,b.face.normal);
    const ids=new Set(['w0','w1']);
    assert.deepEqual(selectedBlockEdges(canonical.group,ids),selectedBlockEdges(baked.group,ids));
    for(const m of [canonical,baked]){
      blocks[0].secondaryColor='40aabbcc';
      m.updateColors(makeModel(blocks),new Set(['w0']));
      m.setHidden(new Set(['w0']));
    }
    assert.equal(hit(mesh,.75,.25),undefined);
    const pose=new Map([['w0',new THREE.Matrix4().makeTranslation(0,2,0)]]);
    for(const m of [canonical,baked])m.setBlockTransforms(pose);
    assert.equal(mesh.geometry.getAttribute('aScale'),undefined);
    for(const [name,attribute] of Object.entries(reference.geometry.attributes))
      assert.deepEqual(mesh.geometry.getAttribute(name).array,attribute.array,name);
  }finally{canonical.dispose();baked.dispose();}
});

test('wedge endpoint qualification keeps exact renderer bounds and rejects collapsed extents and overrides',()=>{
  const [block]=blocksFor(151,{look:1,up:3});
  const write=wedgeBoundsWriter(profile);
  assert.equal(write({...block,position:{x:127.9837498,y:-5.3231,z:.75}}),true);
  assert.equal(write({...block,position:{x:1e9,y:0,z:0}}),false);
  assert.equal(write({...block,size:{...block.size,x:1e-8}}),false);
  assert.equal(wedgeBoundsWriter({...profile,typeOverrides:{151:{x:10}}})(block),false);
});
