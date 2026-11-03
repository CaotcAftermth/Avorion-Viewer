import test from 'node:test';
import assert from 'node:assert/strict';
import { area, split, defaults, leaves, find, parentOf, cloneTree, splitArea, joinArea, swapAreas, minimum, ratioBounds, validateState } from '../src/layout.js';

test('default workspaces are valid and contain the four-editor layout', () => {
  const state = defaults();
  assert.equal(validateState(state), true);
  assert.deepEqual(leaves(state.workspaces[0].root).map(n => n.editor), ['viewport','info','outliner','properties']);
});
test('splitting preserves original area and independently clones editor state', () => {
  const original = area(); original.view.yaw = 1.2; original.sidebar = true;
  const root = splitArea(original, original.id, 'x', .4);
  assert.equal(root.first, original);
  assert.notEqual(root.second.id, original.id);
  assert.equal(root.second.sidebar, true);
  root.second.view.yaw = .8;
  assert.equal(original.view.yaw, 1.2);
  assert.equal(root.ratio, .4);
});
test('joining either sibling preserves chosen editor and removes the divider', () => {
  for (const keepFirst of [true, false]) {
    const a = area(), b = area('outliner'), root = split('y', .4, a, b);
    const keep = keepFirst ? a : b, remove = keepFirst ? b : a;
    assert.equal(joinArea(root, keep.id, remove.id), keep);
  }
});
test('joining nested siblings preserves unrelated areas', () => {
  const a = area(), b = area('info'), c = area('properties');
  const root = split('x', .7, split('y', .8, a, b), c);
  assert.deepEqual(leaves(joinArea(root, a.id, b.id)).map(n=>n.id), [a.id, c.id]);
});
test('non-sibling joins never discard neighboring subtrees', () => {
  const a = area(), b = area(), c = area();
  const root = split('x', .5, a, split('y', .5, b, c));
  assert.equal(joinArea(root, a.id, b.id), root);
  assert.equal(leaves(root).length, 3);
});
test('swap transfers editor and region state but keeps geometric identity', () => {
  const a = area(), b = area('info');a.sidebar = true;
  const root = split('x', .3, a, b), ids = [a.id, b.id];
  swapAreas(root, a.id, b.id);
  assert.deepEqual([a.id,b.id],ids);
  assert.equal(a.editor,'info');assert.equal(b.editor,'viewport');assert.equal(b.sidebar,true);
  assert.equal(root.ratio,.3);
});
test('workspace duplication has unique IDs and no shared mutable view state', () => {
  const original = defaults().workspaces[0].root, copy = cloneTree(original);
  const originalIds = new Set(leaves(original).map(n=>n.id));
  assert.ok(leaves(copy).every(n=>!originalIds.has(n.id)));
  const zoom = leaves(original)[0].view.zoom;
  leaves(copy)[0].view.zoom = 2;
  assert.equal(leaves(original)[0].view.zoom,zoom);
});
test('recursive minimum sizes protect children in nested splits', () => {
  const root=split('x',.5,split('x',.5,area(),area()),split('y',.5,area(),area()));
  assert.deepEqual(minimum(root),{width:550,height:181});
  const [low,high]=ratioBounds(root,1000);
  assert.ok(Math.abs(low-.365)<1e-10 && Math.abs(high-.82)<1e-10);
  assert.deepEqual(ratioBounds(root,200),[.5,.5]);
});
test('invalid saved layouts are rejected without trusting editor fields', () => {
  const invalid = [null,{}, {...defaults(),active:'missing'}, {...defaults(),workspaces:[]}];
  for(const mutate of [n=>n.editor='unknown', n=>n.view.zoom=Infinity, n=>n.sidebarWidth=-1, n=>n.search={}, n=>n.propertyTab='unknown', n=>n.panels={Transform:'false'}, n=>n.id='\"><script>']) {
    const state=defaults();mutate(leaves(state.workspaces[0].root)[0]);invalid.push(state);
  }
  for(const state of invalid)assert.equal(!!validateState(state),false);
});
test('duplicate identities and invalid ratios are rejected', () => {
  const state=defaults(),root=state.workspaces[0].root;
  root.ratio=0;assert.equal(validateState(state),false);root.ratio=.5;
  leaves(root)[1].id=leaves(root)[0].id;assert.equal(validateState(state),false);
});
test('64 nested splits can round-trip through persisted JSON', () => {
  let root=area();const originalId=root.id;
  for(let i=1;i<64;i++)root=splitArea(root,originalId,i%2?'x':'y',.5);
  const state={version:1,active:'test',workspaces:[{id:'test',name:'Test',root}]};
  assert.equal(validateState(JSON.parse(JSON.stringify(state))),true);
  assert.equal(leaves(root).length,64);
  for(let i=1;i<64;i++){
    const parent=parentOf(root,originalId);const sibling=parent.first.id===originalId?parent.second:parent.first;
    root=joinArea(root,originalId,sibling.id);
  }
  assert.equal(root.id,originalId);assert.equal(find(root,'missing'),null);
});
