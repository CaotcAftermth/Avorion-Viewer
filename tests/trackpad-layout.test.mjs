import test from 'node:test';
import assert from 'node:assert/strict';
import {area,split,defaults,leaves} from '../src/layout.js';
import {trackpadLayout} from '../src/trackpad-layout.js';

test('trackpad layout groups default editors by side and preserves the saved layout',()=>{
  const root=defaults().workspaces[0].root,before=JSON.stringify(root),layout=trackpadLayout(root);
  assert.equal(layout.root.editor,'viewport');
  assert.deepEqual(layout.groups.right.map(r=>r.node.editor),['outliner','properties']);
  assert.deepEqual(layout.groups.bottom.map(r=>r.node.editor),['info']);
  assert.equal(JSON.stringify(root),before);
});
test('trackpad layout finds all four edges and retains multiple 3D views',()=>{
  const root=split('x',.2,area('outliner'),split('x',.75,split('y',.2,area('info'),split('y',.8,split('x',.5,area(),area()),area('color'))),area('properties')));
  const layout=trackpadLayout(root);
  assert.deepEqual(leaves(layout.root).map(n=>n.editor),['viewport','viewport']);
  for(const side of ['left','right','top','bottom'])assert.equal(layout.groups[side].length,1,side);
  assert.equal(trackpadLayout(area('preferences')),null);
});
