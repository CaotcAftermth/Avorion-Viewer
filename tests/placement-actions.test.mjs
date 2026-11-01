import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock,makeModel,placeImportedModel,nativeToView} from '../src/block-model.js';
import {setBlockVisibility} from '../src/ship-structure.js';

test('import placement centers all axes or rests on the workspace floor and can restore import position',()=>{
  const model=makeModel([makeBlock({position:{x:11,y:21,z:31}}),makeBlock({id:'b1',position:{x:15,y:23,z:35}})]);
  const positions=structuredClone(model.blocks.map(b=>b.position));
  placeImportedModel(model);
  for(const axis of ['x','y','z'])assert.equal(model.bounds.min[axis]+model.bounds.max[axis],0);
  placeImportedModel(model,'placed');
  assert.equal(nativeToView([0,model.bounds.min.y,0])[2],0);
  for(const axis of ['x','z'])assert.equal(model.bounds.min[axis]+model.bounds.max[axis],0);
  placeImportedModel(model,'imported');assert.deepEqual(model.blocks.map(b=>b.position),positions);
  placeImportedModel(model,'imported');assert.deepEqual(model.blocks.map(b=>b.position),positions);
});

test('Show Last restores successive hides and isolation; Show All clears history',()=>{
  const scene={loaded:true,model:makeModel([makeBlock(),makeBlock({id:'b1'}),makeBlock({id:'b2'})])};
  setBlockVisibility(scene,['b0'],'hide');setBlockVisibility(scene,['b1'],'hide');
  setBlockVisibility(scene,[],'last');assert.deepEqual([...scene.hiddenIds],['b0']);
  setBlockVisibility(scene,['b0'],'isolate');assert.deepEqual([...scene.hiddenIds],['b1','b2']);
  setBlockVisibility(scene,[],'last');assert.deepEqual([...scene.hiddenIds],['b0']);
  setBlockVisibility(scene,[],'last');assert.equal(scene.hiddenIds.size,0);
  setBlockVisibility(scene,['b2'],'hide');setBlockVisibility(scene,[],'all');
  setBlockVisibility(scene,[],'last');assert.equal(scene.hiddenIds.size,0);assert.equal(scene.visibilityHistory.length,0);
});
