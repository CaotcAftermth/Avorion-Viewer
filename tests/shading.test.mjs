import test from 'node:test';
import assert from 'node:assert/strict';
import { shadeFace } from '../src/shading.js';
import { FACTORY_PREFERENCES as defaults, parsePreferences, validPreference } from '../src/preferences.js';
test('ambient, material color, exposure, and zero lighting have defined output',()=>{
  const p={...defaults,shaderColor:'#804020',shaderAmbient:1,shaderLight:0};
  assert.equal(shadeFace([0,0,1],[0,0,1],p),'rgb(128, 64, 32)');
  assert.equal(shadeFace([0,0,1],[0,0,1],{...p,shaderExposure:1}),'rgb(255, 128, 64)');
  assert.equal(shadeFace([0,0,1],[0,0,1],{...p,shaderAmbient:0}),'rgb(0, 0, 0)');
});
test('directional light follows direction and roughness changes highlights',()=>{
  const p={...defaults,shaderAmbient:0,shaderElevation:90,shaderSpecular:0};
  assert.notEqual(shadeFace([0,0,1],[0,0,1],p),'rgb(0, 0, 0)');
  assert.equal(shadeFace([0,0,-1],[0,0,1],p),'rgb(0, 0, 0)');
  const spec={...p,shaderColor:'#000000',shaderSpecular:1};
  assert.notEqual(shadeFace([0,0,1],[1,0,0],{...spec,shaderRoughness:.1}),shadeFace([0,0,1],[1,0,0],{...spec,shaderRoughness:1}));
});
test('older preferences gain shader defaults and invalid shader values are rejected',()=>{
  assert.equal(parsePreferences('{"version":1}').shaderRoughness,.5);
  assert.equal(validPreference('shaderRoughness',0),false);
  assert.equal(validPreference('shaderExposure',Infinity),false);
  assert.equal(parsePreferences('{"version":1,"shaderExposure":2}').shaderExposure,2);
});
