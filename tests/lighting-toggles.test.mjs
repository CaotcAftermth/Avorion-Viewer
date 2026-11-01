import test from 'node:test';
import assert from 'node:assert/strict';
import { gameParams,sceneClipRange } from '../src/game-renderer.js';
import { FACTORY_PREFERENCES } from '../src/preferences.js';
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
