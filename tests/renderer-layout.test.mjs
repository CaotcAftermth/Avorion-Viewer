import test from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalRendererError,layoutKey,legacyLayout,legacyRetryBudget,requestedLayout,resourceFailure} from '../src/renderer-layout.js';

test('canonical flags require an eligible workflow and yield to the legacy override',()=>{
  const query=new URLSearchParams('canonicalBoxes=1&canonicalWedges=1&canonicalDiscrete=1');
  assert.equal(requestedLayout({},new URLSearchParams(),{}),legacyLayout);
  assert.equal(layoutKey(requestedLayout({},query,{})),'1111');
  assert.equal(layoutKey(requestedLayout({canonicalBoxes:false},query,{})),'0101');
  assert.equal(requestedLayout({},query,{blockTransforms:new Map()}),legacyLayout);
  assert.equal(requestedLayout({},query,{turretStudio:{}}),legacyLayout);
  query.set('renderer','legacy');
  assert.equal(requestedLayout({canonicalBoxes:true},query,{}),legacyLayout);
});
test('retry ceiling depends on baked vertex count and available memory class',()=>{
  assert.equal(legacyRetryBudget(Array(279431).fill({typeIndex:2}),8).allowed,false);
  assert.equal(legacyRetryBudget([{typeIndex:2}],undefined).bytes,6336);
  assert.equal(legacyRetryBudget([{typeIndex:2}],undefined).allowed,true);
  assert.equal(resourceFailure(new CanonicalRendererError('Array buffer allocation failed')),true);
  assert.equal(resourceFailure(new CanonicalRendererError('Invalid endpoint metadata')),false);
});

test('the visible renderer preference opts into M5 and respects the legacy override',()=>{
  const query=new URLSearchParams('canonicalBoxes=1');
  assert.equal(layoutKey(requestedLayout({rendererMode:'canonical'},query,{})),'1111');
  assert.equal(layoutKey(requestedLayout({rendererMode:'default'},query,{})),'1000');
  assert.equal(requestedLayout({rendererMode:'legacy'},query,{}),legacyLayout);
  query.set('renderer','legacy');
  assert.equal(requestedLayout({rendererMode:'canonical'},query,{}),legacyLayout);
});
