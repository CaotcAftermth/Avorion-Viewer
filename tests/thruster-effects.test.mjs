import test from 'node:test';
import assert from 'node:assert/strict';
import {thrusterTier,thrusterCount,thrusterPorts} from '../src/avorion/lib/geometry/thrusterPorts.js';
import {makeBlock,makeModel,ORIENTATIONS} from '../src/block-model.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {buildBlockEffects,effectColor} from '../src/avorion/lib/geometry/blockEffects.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
import {FACTORY_PREFERENCES,parsePreferences,validPreference} from '../src/preferences.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);

test('old fractional thrust settings become Active while preserving saved preferences',()=>{
  for(const [value,expected] of [[0,0],[.35,1],[1,1]]){
    const saved={...FACTORY_PREFERENCES,shaderThrust:value,shaderBoostLength:9};
    const parsed=parsePreferences(JSON.stringify(saved));
    assert.equal(parsed.shaderThrust,expected);assert.equal(parsed.shaderBoostLength,9);
  }
  assert.equal(validPreference('shaderThrust',.35),false);
  assert.throws(()=>parsePreferences(JSON.stringify({...FACTORY_PREFERENCES,shaderThrust:2})),/Invalid preference/);
});

test('every measured interval changes count and size only at its boundary',()=>{
  const rows=[[0,1.2,.1,1],[1.2,2,.1,3],[2,2.8,.1,5],[2.8,4,.2,3],[4,5.2,.2,5],[5.2,8,.4,3],[8,10,.4,5],[10,16,.8,3],[16,19.6,.8,5],[19.6,32,1.6,3],[32,38.8,1.6,5]];
  for(const [lo,hi,size,count] of rows)for(const length of [lo,(lo+hi)/2,hi-1e-6]){
    const tier=thrusterTier(length);
    assert.equal(tier.size,size);assert.equal(thrusterCount(length,tier),count);
    const ports=thrusterPorts(length,length);
    assert.equal(ports.length,count*count);
    assert.ok(ports.every(p=>p.radius===size/2));
    close(ports.reduce((n,p)=>n+p.x,0),0);close(ports.reduce((n,p)=>n+p.y,0),0);
    const x=[...new Set(ports.map(p=>p.x))];
    for(let i=1;i<x.length;i++)close(x[i]-x[i-1]-size,tier.spacing);
  }
  assert.equal(thrusterPorts(100,100).length,25);
});

test('scaling within an interval leaves port positions and plume reach fixed',()=>{
  for(const [a,b] of [[1.2,1.999],[2.8,3.999],[5.2,7.999],[10,15.999],[19.6,31.999]])
    assert.deepEqual(thrusterPorts(a,a),thrusterPorts(b,b));
});

test('all faces and orientations share the largest-face size and exact plume length',()=>{
  const profile=defaultOrientationProfile();
  for(const typeIndex of [7,13])for(const orientation of ORIENTATIONS){
    const block=makeBlock({id:'t',typeIndex,...orientation,size:{x:2,y:6,z:9}});
    const effects=buildBlockEffects([block],profile,{thrustPreview:.2});
    try{
      const g=effects.mesh.geometry,p=g.getAttribute('position'),r=g.getAttribute('aRoot'),d=g.getAttribute('aDir');
      const faces=new Map();
      for(let i=0;i<p.count;i+=6){
        if(g.getAttribute('aData').getX(i)!==2)continue;
        const key=[d.getX(i),d.getY(i),d.getZ(i)].map(n=>Math.round(n)).join(',');
        faces.set(key,(faces.get(key)||0)+1);
        const delta=[p.getX(i)-r.getX(i),p.getY(i)-r.getY(i),p.getZ(i)-r.getZ(i)];
        close(Math.hypot(...delta),.2);
        const tip=i+2;
        close((p.getX(tip)-r.getX(tip))*d.getX(tip)+(p.getY(tip)-r.getY(tip))*d.getY(tip)+(p.getZ(tip)-r.getZ(tip))*d.getZ(tip),2);
      }
      assert.equal(faces.size,typeIndex===7?6:2);
      assert.equal(effects.mesh.material.uniforms.uThrust.value,1);
      for(const [value,expected] of [[0,0],[.01,1],[1,1]]){
        effects.setParams({thrustPreview:value});assert.equal(effects.mesh.material.uniforms.uThrust.value,expected);
      }
    }finally{effects.dispose();}
  }
});

test('merged and instanced surfaces carry the same shared port size',()=>{
  for(const count of [1,16]){
    const blocks=Array.from({length:count},(_,i)=>makeBlock({id:`t${i}`,typeIndex:7,size:{x:2,y:6,z:9},position:{x:0,y:0,z:0}}));
    const model=buildTexturedModel(makeModel(blocks),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
    try{
      const meshes=model.group.children.filter(m=>m.userData.textured);
      assert.equal(meshes.length,1);assert.equal(meshes[0].userData.instanced,count===16);
      const meta=meshes[0].geometry.getAttribute('aMaterialLayers');
      for(let i=0;i<meta.count;i++)close(meta.getZ(i),.4);
    }finally{model.dispose();}
  }
});

test('thrusters use the same material defaults as engines, independent of hull paint',()=>{
 for(const typeIndex of [7,13])for(let materialIndex=0;materialIndex<7;materialIndex++)for(const color of ['ff00ff00','ffaaaaaa','ff696969']){
  const block=makeBlock({typeIndex,materialIndex,color,secondaryColor:'00000000'});
  const expected=effectColor({...block,typeIndex:3}).toArray();
  assert.deepEqual(effectColor(block).toArray(),expected);
  assert.deepEqual(effectColor({...block,secondaryColor:'ffff0000'}).toArray(),[1,0,0]);
  const half=effectColor({...block,secondaryColor:'80ff0000'}).toArray();
  for(let i=0;i<3;i++)close(half[i],expected[i]*(1-128/255)+(i===0?128/255:0));
 }
});

test('directional thruster ports and plumes follow both look-axis faces in all 24 orientations',async()=>{
 const THREE=await import('../src/vendor/three.module.js');
 const {axisVector}=await import('../src/avorion/lib/avorion/orientation.js');
 const {blockSurfaceGeometry,surfaceKind}=await import('../src/avorion/lib/geometry/blockSurface.js');
 const profile=defaultOrientationProfile();
 for(const orientation of ORIENTATIONS){
  const block=makeBlock({id:'d',typeIndex:13,...orientation,size:{x:2,y:4,z:8}});
  const look=axisVector(profile,block.look),{positions,faces}=blockSurfaceGeometry(block,profile);
  let marked=0;
  for(let i=0;i<positions.length/3;i+=3){
   const a=new THREE.Vector3().fromArray(positions,i*3),b=new THREE.Vector3().fromArray(positions,(i+1)*3),c=new THREE.Vector3().fromArray(positions,(i+2)*3);
   const normal=b.sub(a).cross(c.sub(a)).normalize();
   const port=surfaceKind('directional-thruster',faces[i*3+2])===2;
   assert.equal(port,Math.abs(normal.dot(look))>.9999);if(port)marked++;
  }
  assert.equal(marked,4);
  const effects=buildBlockEffects([block],profile,{thrustPreview:1});
  try{
   const g=effects.mesh.geometry,d=g.getAttribute('aDir'),r=g.getAttribute('aRoot');
   const signs=new Set();
   for(let i=0;i<d.count;i++){
    const direction=new THREE.Vector3().fromBufferAttribute(d,i),alignment=direction.dot(look);
    close(Math.abs(alignment),1);signs.add(Math.sign(alignment));
    const axis=['x','y','z'].find(a=>Math.abs(look[a])>.5);
    assert.ok(Math.abs(Math.abs(r.getComponent(i,['x','y','z'].indexOf(axis))-block.position[axis])-block.size[axis]/2)<.001);
   }
   assert.equal(signs.size,2);
  }finally{effects.dispose();}
 }
});
