import test from 'node:test';
import assert from 'node:assert/strict';
import {getShadingSpec} from '../src/avorion/lib/textures/shadingMap.js';
import {surfaceKind} from '../src/avorion/lib/geometry/blockSurface.js';

test('Vivid Colors hull shapes keep plain Hull plating but route to the brighter vivid surface',()=>{
  for(let i=240;i<248;i++){const spec=getShadingSpec(i);assert.equal(spec.surface,'vivid');assert.equal(spec.albedo,getShadingSpec(122).albedo);}
  for(let side=0;side<6;side++)assert.equal(surfaceKind('vivid',side),29);
  assert.equal(getShadingSpec(122).surface,undefined);
});
