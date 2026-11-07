import test from 'node:test';
import assert from 'node:assert/strict';
import {INTERACTION_MODES,interactionMode,nextInteractionMode,normalizeInteraction,socketToolActive} from '../src/interaction-modes.js';
import {PAINT_TOOLS,paintOptions} from '../src/paint-tools.js';

test('Tab switches Object and Paint while sockets remain an Object tool',()=>{
 assert.deepEqual(INTERACTION_MODES.map(([,label])=>label),['Object Mode','Paint Mode']);
 assert.equal(nextInteractionMode('object'),'paint');
 assert.equal(nextInteractionMode('paint'),'object');
 const view={interactionMode:'socket',tool:'select',yaw:1};
 normalizeInteraction(view);
 assert.deepEqual(view,{interactionMode:'object',tool:'sockets',yaw:1});
 assert.equal(socketToolActive(view),true);
 view.tool='select';assert.equal(socketToolActive(view),false);
 view.tool='sockets';view.interactionMode='paint';assert.equal(socketToolActive(view),false);
 assert.equal(interactionMode(undefined),'object');assert.equal(nextInteractionMode('stale'),'paint');
});
test('Paint Mode offers a Select tool that survives option normalization',()=>{
  assert.equal(PAINT_TOOLS[0],'select');
  const view={paint:{tool:'select'}};assert.equal(paintOptions(view).tool,'select');
  assert.equal(paintOptions(JSON.parse(JSON.stringify(view))).tool,'select');
});
