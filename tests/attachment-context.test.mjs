import test from 'node:test';
import assert from 'node:assert/strict';
import {syncAttachmentContext,setAttachmentContext,inspectorScene,routeAttachmentInspector,resolveAttachmentContext} from '../src/attachment-context.js';
const scene=()=>({model:{turretMounts:[{id:'t',socketId:'ts'}],componentSetup:{mounts:[{id:'c',socketId:'cs'}]}},selectedTurretIds:new Set()});
test('selection context follows changed attachment without retaining incompatible selection',()=>{
 const s=scene();s.selectedTurretId='t';assert.equal(syncAttachmentContext(s).type,'turret');s.selectedComponentMountId='c';assert.equal(syncAttachmentContext(s).type,'component');assert.equal(s.selectedTurretId,null);
 s.selectedComponentMountId=null;assert.equal(syncAttachmentContext(s),null);
});
test('only designated unpinned inspector follows attachment selection',()=>{
 const nodes=[{id:'a',editor:'properties',propertyTab:'object',attachmentPin:{id:'x'}},{id:'b',editor:'properties',propertyTab:'scene'},{id:'c',editor:'properties',propertyTab:'world'}];
 routeAttachmentInspector(nodes,{type:'turret'},'c');assert.equal(nodes[0].propertyTab,'object');assert.equal(nodes[1].propertyTab,'scene');assert.equal(nodes[2].propertyTab,'turrets');
});
test('pinned inspection edits model without changing live viewport selection',()=>{
 const s=scene();setAttachmentContext(s,{kind:'instance',type:'component',id:'c'});s.selectedComponentMountId='c';
 const pinned=inspectorScene(s,{kind:'instance',type:'turret',id:'t'});assert.equal(pinned.selectedTurretId,'t');assert.equal(pinned.selectedComponentMountId,null);assert.equal(s.selectedComponentMountId,'c');
 pinned.appearanceRevision=10;assert.equal(s.appearanceRevision,10);pinned.selectedTurretId=null;assert.equal(s.selectedComponentMountId,'c');
 assert.equal(resolveAttachmentContext(s,{kind:'instance',type:'turret',id:'gone'}),null);
});
test('model replacement clears stale attachment context',()=>{
 const s=scene();s.selectedTurretId='t';syncAttachmentContext(s);s.model={turretMounts:[]};s.selectedTurretId=null;assert.equal(syncAttachmentContext(s),null);
});

test('Select returns the designated inspector to Object Properties while preserving pins',()=>{
 const nodes=[{id:'pinned',editor:'properties',propertyTab:'turrets',attachmentPin:{id:'t'}},{id:'active',editor:'properties',propertyTab:'components'}];
 routeAttachmentInspector(nodes,{type:'object'},'active');
 assert.equal(nodes[0].propertyTab,'turrets');
 assert.equal(nodes[1].propertyTab,'object');
});
