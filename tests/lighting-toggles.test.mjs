import test from 'node:test';
import assert from 'node:assert/strict';
import { gameParams,sceneClipRange } from '../src/game-renderer.js';
import { FACTORY_PREFERENCES } from '../src/preferences.js';
import { createGameMaterial, packMaterialFlags, MATERIAL_FLAG_STRIDE } from '../src/avorion/lib/geometry/gameShader.js';

test('Avorion material defaults reach the shader while existing lighting controls can mute them',()=>{
  const material=createGameMaterial(null,null,null,gameParams(FACTORY_PREFERENCES));
  try{
    const palette=material.uniforms.uMaterialShading.value;
    assert.deepEqual(palette[1].toArray(),[.05,.15,.75,150]);
    assert.deepEqual(palette[4].toArray(),[.3,.7,3,1500]);
    assert.deepEqual(material.uniforms.uMaterialGlow.value,[1,1,.85,.7,.83,.75,1,.95]);
    assert.equal(FACTORY_PREFERENCES.shaderAmbient,.13);
    assert.equal(FACTORY_PREFERENCES.shaderLight,1.05);
    assert.equal(FACTORY_PREFERENCES.shaderBloom,0);
    assert.equal(FACTORY_PREFERENCES.shaderBloomThreshold,.65);
    for(let materialIndex=0;materialIndex<7;materialIndex++)for(let flags=0;flags<MATERIAL_FLAG_STRIDE;flags++){
      const packed=packMaterialFlags(flags,materialIndex);
      assert.equal(packed%MATERIAL_FLAG_STRIDE,flags);
      assert.equal(Math.floor(packed/MATERIAL_FLAG_STRIDE),materialIndex+1);
    }
    assert.equal(packMaterialFlags(32,999),32);
  }finally{material.dispose();}
});

test('lighting toggles independently mute contributions without changing strengths',()=>{
  for(const [toggle,uniform,strength] of [['shaderAmbientEnabled','ambientFillIntensity','shaderAmbient'],['shaderDirectionalEnabled','lightIntensity','shaderLight'],['shaderSkyEnabled','ambientIntensity','shaderSkyAmbient']]){
    const p={...FACTORY_PREFERENCES,[toggle]:false};assert.equal(gameParams(p)[uniform],0);
    assert.equal(p[strength],FACTORY_PREFERENCES[strength]);p[toggle]=true;assert.equal(gameParams(p)[uniform],p[strength]);
  }
});

test('adaptive depth range preserves user clipping limits in both projections',()=>{
  const model={bounds:{min:{x:-1,y:-1,z:-1},max:{x:1,y:1,z:1}}};
  for(const projection of ['perspective','orthographic']){
    const view={projection,yaw:0,pitch:0,zoom:.001,target:[0,0,0],grid:false};
    const p={clipStart:.0001,clipEnd:10000000};
    const range=sceneClipRange(model,view,240,240,p);
    assert.ok(range.near>9900&&range.far<10100);
    assert.deepEqual(sceneClipRange(model,view,240,240,{clipStart:9999,clipEnd:10001}),{near:9999,far:10001});
    assert.deepEqual(sceneClipRange(model,view,240,240,{clipStart:1,clipEnd:100}),{near:1,far:100});
  }
});

test('depth range projects model bounds instead of reserving an oversized sphere',()=>{
  const model={bounds:{min:{x:-500,y:-500,z:-.5},max:{x:500,y:500,z:.501}}};
  const view={projection:'perspective',yaw:0,pitch:0,zoom:.003,target:[0,0,0],grid:false};
  const range=sceneClipRange(model,view,240,360,{clipStart:.05,clipEnd:1000000});
  assert.ok(range.far-range.near<6);assert.ok(range.near>3300);
});
