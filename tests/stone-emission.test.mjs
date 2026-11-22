import test from 'node:test';
import assert from 'node:assert/strict';
import {getShadingSpec} from '../src/avorion/lib/textures/shadingMap.js';
import {surfaceKind} from '../src/avorion/lib/geometry/blockSurface.js';
import {STONE_EMISSION_DEFAULTS} from '../src/avorion/lib/geometry/gameShader.js';
test('glow stone has independent routing without changing the existing ore surface IDs',()=>{
 for(const [start,name,id]of [[510,'rich-stone',10],[520,'super-rich-stone',11],[540,'rich-rift',12],[550,'super-rich-rift',13],[560,'glow-stone',39]])for(let i=0;i<8;i++){assert.equal(getShadingSpec(start+i).surface,name);assert.equal(surfaceKind(name,0),id);}
 assert.notEqual(STONE_EMISSION_DEFAULTS[1],STONE_EMISSION_DEFAULTS[4]);
 assert.equal(getShadingSpec(150).emissiveFlat,true);
});

import {makeBlock,makeModel} from '../src/block-model.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
import {MATERIALS} from '../src/avorion/lib/avorion/blockDefinitions.js';
test('all Glow Stone shapes use rift textures and pale material veins without changing ore colors',()=>{
 for(let type=560;type<568;type++){
  const spec=getShadingSpec(type);
  assert.equal(spec.albedo,'melted-rock');assert.equal(spec.normal,'melted-rock_n');
  for(const material of MATERIALS){
   const built=buildTexturedModel(makeModel([makeBlock({typeIndex:type,materialIndex:material.index})]),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
   try {
    const attr=built.group.children.find(m=>m.userData.textured).geometry.getAttribute('aEmission');
    const rgb=[attr.getX(0),attr.getY(0),attr.getZ(0)];
    const expected=material.paint.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
    rgb.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6,material.name+' shape '+type));
   }finally{built.dispose();}
  }
 }
 for(const type of [510,520,540,550,150])assert.notEqual(getShadingSpec(type).emissionTint,'paint');
});
