import test from 'node:test';
import assert from 'node:assert/strict';
import {area,cloneTree,defaults,leaves} from '../src/layout.js';
import {ensureViewportOptions,viewportPreferences} from '../src/viewport-options.js';
import {metrics} from '../src/navigation.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
import {edgeAngles} from '../src/avorion/lib/geometry/edgeAngles.js';
test('viewport settings migrate, clone independently, and survive JSON save',()=>{
  const original=area();original.view.wire=true;const d=ensureViewportOptions(original.view);assert.equal(d.shading,'WIREFRAME');
  const other=cloneTree(original);ensureViewportOptions(other.view).gridScale=3;assert.equal(d.gridScale,1);
  assert.deepEqual(ensureViewportOptions(JSON.parse(JSON.stringify(other.view))),other.view.display);
  other.view.display.clipStart=Infinity;other.view.display.focalLength=-1;other.view.display.shading='INVALID';ensureViewportOptions(other.view);
  assert.equal(other.view.display.clipStart,.01);assert.equal(other.view.display.focalLength,50);assert.equal(other.view.display.shading,'MATERIAL');
});
test('factory and new viewports use a million-unit Clip End and preserve valid saved values',()=>{
  assert.equal(ensureViewportOptions(area().view).clipEnd,1000000);
  for(const workspace of defaults().workspaces)for(const node of leaves(workspace.root)){
    if(node.editor==='viewport')assert.equal(ensureViewportOptions(node.view).clipEnd,1000000);
  }
  const view=area().view;
  view.display={clipStart:1,clipEnd:1000};
  assert.equal(ensureViewportOptions(view).clipEnd,1000);
  view.display.clipEnd=.5;
  assert.equal(ensureViewportOptions(view).clipEnd,1000000);
});
test('per-viewport focal length and clipping never mutate preferences or other cameras',()=>{
  const a=area().view,b=area().view;ensureViewportOptions(b);const d=ensureViewportOptions(a);d.focalLength=100;d.clipStart=.25;d.clipEnd=200;
  assert.equal(metrics(a,300,200).focal,metrics(b,300,200).focal*2);
  const p=viewportPreferences(FACTORY_PREFERENCES,a);assert.equal(p.clipStart,.25);assert.equal(p.clipEnd,200);assert.notEqual(FACTORY_PREFERENCES.clipEnd,200);
});
test('wire overlay suppresses triangulation diagonals but keeps open boundaries',()=>{
  const p=[0,0,0,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0];const angles=[...edgeAngles(p)];
  assert.equal(angles.filter(a=>a===0).length,2);assert.equal(angles.filter(a=>a===1).length,4);
});
test('render timing is opt-in and old layouts turn it off once',()=>{
  assert.equal(ensureViewportOptions(area().view).showPerformance,false);
  const legacy=area().view;legacy.display={showPerformance:true};assert.equal(ensureViewportOptions(legacy).showPerformance,false);
  legacy.display.showPerformance=true;assert.equal(ensureViewportOptions(legacy).showPerformance,true);
});
