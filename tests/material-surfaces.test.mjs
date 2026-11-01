import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock, makeModel, ORIENTATIONS} from '../src/block-model.js';
import {defaultOrientationProfile, resolveOrientation} from '../src/avorion/lib/avorion/orientation.js';
import {blockSurfaceGeometry, surfaceKind} from '../src/avorion/lib/geometry/blockSurface.js';
import {getShadingSpec, allTextureNames} from '../src/avorion/lib/textures/shadingMap.js';
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
    assert.equal(geometry.getAttribute('aWindow').getW(0),0);
  } finally {model.dispose();textureLibrary.clear();}
});

test('frontal launcher artwork stays on local +Z through every orientation and unequal scale',()=>{
  const profile=defaultOrientationProfile(),spec=getShadingSpec(22);
  for(const orientation of ORIENTATIONS){
    const block=makeBlock({typeIndex:22,...orientation,size:{x:2,y:4,z:8}});
    const {positions,faces}=blockSurfaceGeometry(block,profile);
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(resolveOrientation(profile,block.look,block.up,22).quaternion);
    let triangles=0;
    for(let i=0;i<positions.length/3;i+=3){
      const active=surfaceKind(spec.surface,faces[i*3+2])===3;
      const a=new THREE.Vector3().fromArray(positions,i*3),b=new THREE.Vector3().fromArray(positions,(i+1)*3),c=new THREE.Vector3().fromArray(positions,(i+2)*3);
      const normal=b.sub(a).cross(c.sub(a)).normalize();
      assert.equal(active,normal.dot(forward)>.9999);
      if(active)triangles++;
    }
    assert.equal(triangles,2);
  }
});

test('non-plated surfaces do not inherit material lights',()=>{
  for(const type of [4,9,150,170,180,190,530])assert.equal(getShadingSpec(type).materialGlow,undefined);
  for(const type of [1,2,3,5,6,10,11,18,22,50,52,58,210,250,600,650])assert.equal(getShadingSpec(type).materialGlow,'plates{m}_glow');
});
