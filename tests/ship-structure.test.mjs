import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBlock,makeModel } from '../src/block-model.js';
import { isThinBlock,viewportHiddenIds,engineEffectHiddenIds,isIsolated,liveBlocks,groupedBlocks,selectBlocks,setBlockVisibility,contextTargets,simplified,reconcileStructure,blockParentIds,blockChildIds,blockLabel } from '../src/ship-structure.js';
const setup=()=>({loaded:true,model:makeModel([
  makeBlock({id:'b123',typeIndex:8,materialIndex:1}),makeBlock({id:'b5',typeIndex:2,materialIndex:0}),makeBlock({id:'b6',typeIndex:8,materialIndex:0}),
  {...makeBlock({id:'b7'}),deleted:true},{...makeBlock({id:'b8'}),el:{isConnected:false}}
]),selectedIds:new Set(),hiddenIds:new Set()});
test('Ship structure groups live blocks alphabetically, independently of XML parents',()=>{
  const s=setup();s.model.blocks[0].parentId='b5';assert.equal(liveBlocks(s).length,3);
  assert.deepEqual(groupedBlocks(s).map(g=>[g.name,g.ids]),[['Armor',['b123','b6']],['Smart Hull',['b5']]]);
  assert.deepEqual(groupedBlocks(s,'material').map(g=>[g.name,g.ids]),[['Iron',['b5','b6']],['Titanium',['b123']]]);
});
test('search matches type, material and viewer ID; group actions use only matches',()=>{
  const s=setup();assert.deepEqual(groupedBlocks(s,'type','TiTANium')[0].ids,['b123']);
  assert.deepEqual(groupedBlocks(s,'type','B123')[0].ids,['b123']);
  assert.equal(groupedBlocks(s,'type','aRmOr')[0].ids.length,2);assert.equal(groupedBlocks(s,'type','no matches').length,0);
  const ids=groupedBlocks(s,'type','Iron').find(g=>g.name==='Armor').ids;selectBlocks(s,ids);setBlockVisibility(s,ids,'hide');
  assert.deepEqual([...s.selectedIds],['b6']);assert.deepEqual([...s.hiddenIds],['b6']);
});
test('replace and additive selection toggle all targeted members, not partial selections',()=>{
  const s=setup();selectBlocks(s,['b123']);selectBlocks(s,['b123','b6'],true);assert.deepEqual([...s.selectedIds],['b123','b6']);
  selectBlocks(s,['b123','b6'],true);assert.equal(s.selectedIds.size,0);
  selectBlocks(s,['b5']);selectBlocks(s,['b6']);assert.deepEqual([...s.selectedIds],['b6']);
  selectBlocks(s,[],true);assert.deepEqual([...s.selectedIds],['b6']);
});
test('partial group visibility hides all, then shows all; isolate ignores selection',()=>{
  const s=setup();selectBlocks(s,['b123']);setBlockVisibility(s,['b6'],'hide');setBlockVisibility(s,['b123','b6'],'toggle');assert.deepEqual([...s.hiddenIds].sort(),['b123','b6']);
  setBlockVisibility(s,['b123','b6'],'toggle');assert.equal(s.hiddenIds.size,0);
  setBlockVisibility(s,['b6'],'isolate');assert.deepEqual([...s.hiddenIds].sort(),['b123','b5']);assert.deepEqual([...s.selectedIds],['b123']);
  setBlockVisibility(s,[],'all');assert.equal(s.hiddenIds.size,0);assert.equal(s.model.blocks[0].color,'ffa0a0a0');
});
test('selected-block context targets full selection; group and unselected context do not',()=>{
  const s=setup();selectBlocks(s,['b123','b5']);assert.deepEqual(contextTargets(s,['b123'],true),['b123','b5']);
  assert.deepEqual(contextTargets(s,['b6'],true),['b6']);assert.deepEqual(contextTargets(s,['b123','b6']),['b123','b6']);
});
test('deleted members are pruned and threshold is strictly above live block count',()=>{
  const s=setup();assert.equal(simplified(s,{simplifyThreshold:3}),false);assert.equal(simplified(s,{simplifyThreshold:2}),true);
  selectBlocks(s,['b123','b7']);setBlockVisibility(s,['b123'],'hide');s.model.blocks[0].deleted=true;reconcileStructure(s);
  assert.equal(s.selectedIds.size,0);assert.equal(s.hiddenIds.size,0);assert.equal(liveBlocks(s).length,2);
});

test('isolate toggle reflects exact live visibility including filtered targets',()=>{
  const s=setup();assert.equal(isIsolated(s,['b123']),false);
  setBlockVisibility(s,['b123'],'isolate');assert.equal(isIsolated(s,['b123']),true);
  assert.equal(isIsolated(s,['b123','b6']),false);
  setBlockVisibility(s,[],'all');assert.equal(isIsolated(s,['b123']),false);
  setBlockVisibility(s,['b123'],'hide');assert.equal(isIsolated(s,['b123']),false);
});

test('thin block filter covers every dimension without changing manual visibility',()=>{
  for(const axis of ['x','y','z'])for(const value of [0,.0001,.00999])assert.equal(isThinBlock({size:{x:1,y:1,z:1,[axis]:value}}),true);
  assert.equal(isThinBlock({size:{x:.01,y:1,z:1}}),false);
  const s=setup();s.model.blocks[0].size.x=.001;s.hiddenIds.add('b5');
  assert.deepEqual([...viewportHiddenIds(s,{showThinBlocks:false})],['b5','b123']);
  assert.deepEqual([...viewportHiddenIds(s,{showThinBlocks:true})],['b5']);
  assert.deepEqual([...s.hiddenIds],['b5']);
});
test('changing the cutoff invalidates viewport and engine visibility without changing manual hides',()=>{
  const s=setup(),[below,edge,legacy]=s.model.blocks,view={showThinBlocks:false};
  s.revision=1;
  below.typeIndex=3;below.size.x=.00499;
  edge.size.y=.005;
  legacy.size.z=.007;
  s.hiddenIds.add('b5');
  assert.deepEqual([...viewportHiddenIds(s,view)],['b5',below.id,legacy.id]);
  s.thinBlockThreshold=.005;
  assert.equal(isThinBlock(edge,.005),false);
  assert.deepEqual([...viewportHiddenIds(s,view)],['b5',below.id]);
  assert.deepEqual([...engineEffectHiddenIds(s,view,false)],['b5',below.id]);
  assert.deepEqual([...engineEffectHiddenIds(s,view,true)],['b5']);
  s.thinBlockThreshold=.01;
  assert.deepEqual([...viewportHiddenIds(s,view)],['b5',below.id,legacy.id]);
  assert.deepEqual([...s.hiddenIds],['b5']);
});

test('native hierarchy resolves live parents and children, and labels blocks readably',()=>{
  const s=setup();const [a,b,c]=s.model.blocks;b.parentId='b123';c.parentId='b123';a.parentId='b7';s.model.blocks[4].parentId='b123';
  assert.deepEqual(blockParentIds(s,['b5','b6']),['b123']);assert.deepEqual(blockParentIds(s,['b123']),[]);
  assert.deepEqual(blockChildIds(s,['b123']),['b5','b6']);assert.deepEqual(blockChildIds(s,['b5']),[]);
  assert.equal(blockLabel(a),'b123 · Armor · Titanium');
  assert.equal(blockLabel({...b,itemEl:{getAttribute:n=>n==='index'?'42':null}}),'#42 · Smart Hull · Iron');
});
