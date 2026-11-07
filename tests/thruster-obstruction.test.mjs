import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,ORIENTATIONS} from '../src/block-model.js';
import {defaultOrientationProfile,resolveOrientation} from '../src/avorion/lib/avorion/orientation.js';
import {createPortObstruction} from '../src/avorion/lib/geometry/portObstruction.js';
import {buildBlockEffects} from '../src/avorion/lib/geometry/blockEffects.js';
const profile=defaultOrientationProfile(),point=new THREE.Vector3(),direction=new THREE.Vector3(0,0,1),tangent=new THREE.Vector3(1,0,0);
const box=(id,x,y,z,sx,sy,sz,typeIndex=2)=>makeBlock({id,typeIndex,position:{x,y,z},size:{x:sx,y:sy,z:sz}});
function frame(gapX,gapY=gapX,typeIndex=2){
 return [box('left',-(2+gapX)/4,0,.25,(2-gapX)/2,2,.5,typeIndex),box('right',(2+gapX)/4,0,.25,(2-gapX)/2,2,.5,typeIndex),
 box('top',0,(2+gapY)/4,.25,gapX,(2-gapY)/2,.5,typeIndex),box('bottom',0,-(2+gapY)/4,.25,gapX,(2-gapY)/2,.5,typeIndex)];
}
const query=blocks=>createPortObstruction(blocks,profile)('owner',point,direction,tangent);
test('solid contact blocks the plume, every hologram shape is ignored, glass still blocks',()=>{
 assert.deepEqual(query([box('cover',0,0,.25,1,1,.5)]),['cover']);
 for(const type of [190,191,192,193,194,199,200,203])assert.deepEqual(query([box('holo',0,0,.25,2,2,.5,type)]),[]);
 assert.deepEqual(query([box('glass',0,0,.25,1,1,.5,170)]),['glass']);
 assert.deepEqual(query([box('owner',0,0,.25,1,1,.5)]),[]);
});
test('center opening must be at least .02 on both axes, with equality allowed',()=>{
 for(const x of [.019,.01999,.02,.02001,.04])for(const y of [.019,.01999,.02,.02001,.04])
  assert.equal(query(frame(x,y)).length===0,x>=.02&&y>=.02,`${x} x ${y}`);
 assert.ok(query(frame(.005)).length>0,'an unobstructed center ray alone is insufficient');
});
test('narrow off-center obstacles inside the opening are detected without sampling gaps',()=>{
 assert.deepEqual(query([box('sliver',.004,0,.25,.0001,.0001,.5)]),['sliver']);
 assert.deepEqual(query([box('outside',.011,0,.25,.001,1,.5)]),[]);
});
test('clearance stays centered and the BVH catches partial overlap away from the center ray',()=>{
 const offset=frame(.02).map(b=>({...b,position:{...b.position,x:b.position.x+.002}}));
 assert.ok(query(offset).length>0,'an offset opening does not expose the whole center square');
 const far=Array.from({length:40},(_,i)=>box('far'+i,100+i,20,20,1,1,1));
 assert.deepEqual(query([...far,box('sliver',.004,0,.25,.0001,.0001,.5)]),['sliver']);
 assert.deepEqual(query([...far,...frame(.02)]),[]);
});
test('only direct contact counts; distant blocks and blocks behind the port do not',()=>{
 assert.deepEqual(query([box('distant',0,0,.26,1,1,.5)]),[]);
 assert.deepEqual(query([box('backing',0,0,-.25,1,1,.5)]),[]);
 assert.deepEqual(query([box('intersecting',0,0,0,1,1,1)]),['intersecting']);
});
test('opening size is unchanged through every block orientation',()=>{
 for(const orientation of ORIENTATIONS){
  const {quaternion}=resolveOrientation(profile,orientation.look,orientation.up);
  for(const gap of [.019,.02,.04]){
   const blocks=frame(gap).map(b=>{
    const position=new THREE.Vector3(b.position.x,b.position.y,b.position.z).applyQuaternion(quaternion);
    const size=new THREE.Vector3(b.size.x,b.size.y,b.size.z).applyQuaternion(quaternion);
    return {...b,...orientation,position,size:{x:Math.abs(size.x),y:Math.abs(size.y),z:Math.abs(size.z)}};
   });
   const result=createPortObstruction(blocks,profile)('owner',point,direction.clone().applyQuaternion(quaternion),tangent.clone().applyQuaternion(quaternion));
   assert.equal(result.length===0,gap>=.02);
  }
 }
});
test('actual wedge geometry and open hangar passages retain their empty space',()=>{
 const wedge=box('wedge',0,0,.25,1,1,.5,100),check=createPortObstruction([wedge],profile);
 assert.deepEqual(check('owner',new THREE.Vector3(-.4,.4,0),direction,tangent),[]);
 assert.deepEqual(check('owner',new THREE.Vector3(.4,-.4,0),direction,tangent),['wedge']);
 assert.deepEqual(query([box('hangar',0,0,.25,2,2,.5,10)]),[]);
 const hangar=createPortObstruction([box('hangar',0,0,.25,2,2,.5,10)],profile);
 assert.deepEqual(hangar('owner',new THREE.Vector3(.9,0,0),direction,tangent),['hangar']);
});
function centerVertices(effects){
 const g=effects.mesh.geometry,r=g.getAttribute('aRoot'),d=g.getAttribute('aDir'),indices=[];
 for(let i=0;i<r.count;i++)if(Math.abs(r.getX(i))<1e-6&&Math.abs(r.getY(i))<1e-6&&d.getZ(i)>.99)indices.push(i);
 assert.equal(indices.length,54);assert.ok(indices.some(i=>g.getAttribute('aData').getX(i)===11));return indices;
}
test('clearance is fixed for S1-S5; aperture never changes plume size, hiding blockers restores it',()=>{
 for(const size of [1,3,6,10,20]){
  const owner=box('owner',0,0,-size/2,size,size,size,7),build=blocks=>buildBlockEffects([owner,...blocks],profile,{thrustPreview:1});
  const clear=build(frame(.02)),wide=build(frame(.2)),blocked=build(frame(.019));
  try{
   assert.deepEqual(clear.mesh.geometry.getAttribute('position').array,wide.mesh.geometry.getAttribute('position').array);
   assert.deepEqual(clear.mesh.geometry.getAttribute('position').array,blocked.mesh.geometry.getAttribute('position').array);
   const indices=centerVertices(clear),state=blocked.mesh.geometry.getAttribute('aData');
   for(const i of indices){assert.equal(clear.mesh.geometry.getAttribute('aData').getY(i),1);assert.equal(state.getY(i),0);}
   blocked.setHidden(new Set(['left','right','top','bottom']));for(const i of indices)assert.equal(state.getY(i),1);
   blocked.setHidden(new Set());for(const i of indices)assert.equal(state.getY(i),0);
  }finally{clear.dispose();wide.dispose();blocked.dispose();}
 }
});

test('measured .00541 separation threshold includes tiny Tachi gaps and thin covers',()=>{
 for(const gap of [.00000095,.00001,.001,.0054,.005409,.00541,.005411,.006]){
  assert.equal(query([box('cover',0,0,gap+.25,1,1,.5)]).length>0,gap<.00541,String(gap));
 }
 assert.deepEqual(query([box('thin',0,0,.002,.02,.02,.0001)]),['thin']);
 assert.deepEqual(query(frame(.02).map(b=>({...b,position:{...b.position,z:b.position.z+.001}}))),[]);
});
