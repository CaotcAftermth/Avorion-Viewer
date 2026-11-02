import test from 'node:test';
import assert from 'node:assert/strict';
import {INTERACTION_MODES,interactionMode,nextInteractionMode} from '../src/interaction-modes.js';
import {PAINT_TOOLS,paintOptions} from '../src/paint-tools.js';

test('Tab cycles Object, Paint and Socket Mode in header order',()=>{
  assert.deepEqual(INTERACTION_MODES.map(([,label])=>label),['Object Mode','Paint Mode','Socket Mode']);
  assert.equal(nextInteractionMode('object'),'paint');
  assert.equal(nextInteractionMode('paint'),'socket');
  assert.equal(nextInteractionMode('socket'),'object');
  assert.equal(nextInteractionMode('socket',-1),'paint');
  assert.equal(interactionMode(undefined),'object');assert.equal(nextInteractionMode('stale'),'paint');
});
test('Paint Mode offers a Select tool that survives option normalization',()=>{
  assert.equal(PAINT_TOOLS[0],'select');
  const view={paint:{tool:'select'}};assert.equal(paintOptions(view).tool,'select');
  assert.equal(paintOptions(JSON.parse(JSON.stringify(view))).tool,'select');
});
