import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock, makeModel, ORIENTATIONS} from '../src/block-model.js';
import {defaultOrientationProfile, resolveOrientation} from '../src/avorion/lib/avorion/orientation.js';
import {blockSurfaceGeometry, surfaceKind} from '../src/avorion/lib/geometry/blockSurface.js';
import {getShadingSpec, allTextureNames, resolveTextureNames} from '../src/avorion/lib/textures/shadingMap.js';
import {textureLibrary} from '../src/avorion/lib/textures/textureLibrary.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';

test('material accents, material glow and pod glow occupy independent GPU layers', () => {
  const names=['plates6_overlay','plates6_glow','plates6_pods','plates6_pods_glow'];
  for(const name of names) {
    assert.ok(allTextureNames().includes(name));
    textureLibrary.images.set(name,{width:512,height:512,data:new Uint8Array(512*512*4)});
  }
  const model=buildTexturedModel(makeModel([makeBlock({typeIndex:58,materialIndex:6,secondaryColor:'80ff0000'})]),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
  try {
    const geometry=model.group.children.find(m=>m.userData.textured).geometry;
    const layers=geometry.getAttribute('aMaterialLayers'),pod=geometry.getAttribute('aParams').getX(0),decal=geometry.getAttribute('aLayers').getW(0);
    assert.equal(new Set([layers.getX(0),layers.getY(0),pod,decal]).size,4);
    for(const v of [layers.getX(0),layers.getY(0),pod,decal])assert.ok(v>0);
    assert.ok(Math.abs(geometry.getAttribute('aSecondary').getW(0)-128/255)<1e-6);
    model.updateColors(makeModel([makeBlock({typeIndex:58,materialIndex:6})]));
    assert.equal(geometry.getAttribute('aSecondary').getW(0),0);
  } finally {model.dispose();textureLibrary.clear();}
});

test('launcher ports and dock artwork stay on their observed local faces',()=>{
  const profile=defaultOrientationProfile();
  const cases=[
    [18,36,new THREE.Vector3(0,0,1),false],
    [22,37,new THREE.Vector3(1,0,0),false],
    [11,28,new THREE.Vector3(1,0,0),true],
  ];
  for(const [typeIndex,route,axis,opposing] of cases){
    for(const orientation of ORIENTATIONS){
      const block=makeBlock({typeIndex,...orientation,size:{x:2,y:4,z:8}});
      const {positions,faces}=blockSurfaceGeometry(block,profile);
      const forward=axis.clone().applyQuaternion(resolveOrientation(profile,block.look,block.up,typeIndex).quaternion);
      let triangles=0;
      for(let i=0;i<positions.length/3;i+=3){
        const active=surfaceKind(getShadingSpec(typeIndex).surface,faces[i*3+2])===route;
        const a=new THREE.Vector3().fromArray(positions,i*3),b=new THREE.Vector3().fromArray(positions,(i+1)*3),c=new THREE.Vector3().fromArray(positions,(i+2)*3);
        const facing=b.sub(a).cross(c.sub(a)).normalize().dot(forward);
        assert.equal(active,(opposing?Math.abs(facing):facing)>.9999);
        if(active)triangles++;
      }
      assert.equal(triangles,opposing?4:2);
    }
  }
  assert.equal(getShadingSpec(17).overlay,'ventilation');
  assert.equal(getShadingSpec(57).overlay,'academy');
});

test('five-unit texture calibration routes each block to its functional mapping',()=>{
  for(const type of [14,15,56]) assert.equal(surfaceKind(getShadingSpec(type).surface,0),33);
  for(const type of [24,25]) assert.equal(surfaceKind(getShadingSpec(type).surface,0),35);
  for(const type of [50,51,53]) assert.equal(surfaceKind(getShadingSpec(type).surface,0),5);
  assert.equal(surfaceKind(getShadingSpec(54).surface,0),38);
  for(const type of [52,55]) assert.equal(surfaceKind(getShadingSpec(type).surface,0),4);
});

test('windowed hull and cloning pods resolve distinct stock artwork',()=>{
  assert.equal(resolveTextureNames(1,0).overlay,undefined);
  assert.equal(resolveTextureNames(121,0).overlay,undefined);
  for(const type of [2,100,122,123]) assert.equal(resolveTextureNames(type,0).overlay,'plates0_windows');
  assert.equal(resolveTextureNames(6,0).overlay,'plates0_manywindows');
  for(const material of [0,1,2,3,4,5,6]){
    const names=resolveTextureNames(58,material);
    const tier=Math.max(4,material);
    assert.equal(names.overlay,'plates'+tier+'_pods');
    assert.equal(names.glow,'plates'+tier+'_pods_glow');
    assert.equal(names.albedo,'plates'+material);
  }
  assert.equal(resolveTextureNames(58,0,{typeIndex:58,materialIndex:0,textures:{overlay:null}}).overlay,null);
});

test('non-plated surfaces do not inherit material lights',()=>{
  for(const type of [4,9,150,170,180,190,530])assert.equal(getShadingSpec(type).materialGlow,undefined);
  for(const type of [1,2,3,5,6,10,11,18,22,50,52,58,210,250,600,650])assert.equal(getShadingSpec(type).materialGlow,'plates{m}_glow');
});

test('draft texture slots and material shading apply to the preview and reset independently',()=>{
  const name='preview-window-map', size=textureLibrary.resolution;
  textureLibrary.images.set(name,{width:size,height:size,data:new Uint8Array(size*size*4)});
  const materialIndex=1;
  const textureAssignment={typeIndex:6,materialIndex,textures:{overlay:name,albedo:null},scaling:{albedo:'fit',overlay:'fixed'},
    shading:{minReflectivity:.3,maxReflectivity:.65,specularity:2,glossyness:120,glow:.4}};
  const stock={...DEFAULT_GAME_SHADER,simplified:true};
  const preview=buildTexturedModel(makeModel([
    makeBlock({id:'crew',typeIndex:6,materialIndex}),
    makeBlock({id:'hull',typeIndex:2,materialIndex,position:{x:4,y:1,z:0}}),
  ]),defaultOrientationProfile(),{...stock,textureAssignment});
  try {
    const mesh=preview.group.children.find(quad=>quad.userData.textured);
    const layers=mesh.geometry.getAttribute('aLayers');
    const overlays=new Set();
    for(let i=0;i<layers.count;i++)overlays.add(layers.getW(i));
    assert.deepEqual([...overlays].sort(),[0,1]);
    const {uMaterialShading,uMaterialGlow,uTextureScaling}=preview.materials[0].uniforms;
    assert.deepEqual(uMaterialShading.value[2].toArray(),[.3,.65,2,120]);
    assert.equal(uMaterialGlow.value[2],.4);
    assert.deepEqual([...uTextureScaling.value],[1,0,0,2,0,0,0,0]);
    preview.setParams(stock);
    assert.deepEqual(uMaterialShading.value[2].toArray(),[.15,.4,1,500]);
    assert.equal(uMaterialGlow.value[2],.85);
    assert.ok(uTextureScaling.value.every(mode=>mode===0));
  } finally {preview.dispose();textureLibrary.clear();}
});
