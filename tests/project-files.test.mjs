import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock, makeModel, placeImportedModel} from '../src/block-model.js';
import {applyBlockColors} from '../src/block-colors.js';
import {defaults, leaves} from '../src/layout.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
import {captureProfile, captureProject, captureTurretProject, restoreProfile, restoreProject, restoreTurretProject} from '../src/project-files.js';
import {applyReplacement, matchReplacementBlocks, previewReplacement} from '../src/project-replacement.js';
import {createSessionPersistence, paintSnapshot} from '../src/session-persistence.js';
import {demoProject} from '../src/turrets/core.js';
import {sceneSockets} from '../src/turrets/sockets.js';
import {placeTurret} from '../src/turrets/mounts.js';
import {emptySetup, componentSockets} from '../src/components/core.js';

const axes=['x','y','z'];
const region=(ids)=>({id:'region-1',name:'Service bays',color:'#000abc',ids});
const fixture=[
  {itemIndex:'7',typeIndex:20,position:{x:-10,y:0,z:3},size:{x:4,y:4,z:4}},
  {itemIndex:'2',typeIndex:2,position:{x:6,y:2,z:0},size:{x:2,y:4,z:4}},
  {itemIndex:'9',typeIndex:2,position:{x:12,y:-3,z:6},size:{x:3,y:2,z:4}},
  {itemIndex:'4',typeIndex:20,position:{x:25,y:9,z:2},size:{x:6,y:4,z:4}},
];
function modelFor(entries,scale=[1,1,1],offset=[0,0,0]){
  return makeModel(entries.map((entry,index)=>{
    const position=Object.fromEntries(axes.map((axis,i)=>[axis,entry.position[axis]*scale[i]+offset[i]]));
    const size=Object.fromEntries(axes.map((axis,i)=>[axis,entry.size[axis]*scale[i]]));
    const block=makeBlock({...entry,id:`b${index}`,color:entry.color??'ff102030',position,size});
    const attributes={color:block.color,secondaryColor:entry.secondaryColor};
    return {...block,itemIndex:entry.itemIndex,parentId:entry.parentId,el:{isConnected:true,getAttribute:key=>attributes[key]??null}};
  }));
}

test('uniform and uneven rescale preserve identities across XML order and viewer placement',()=>{
  const original=modelFor(fixture);
  placeImportedModel(original,'centered');
  for(const scale of [[2,2,2],[2,1,1],[.5,4,1.25]]){
    const replacement=modelFor([...fixture].reverse(),scale,[7,-4,12]);
    placeImportedModel(replacement,'placed');
    const result=matchReplacementBlocks(original,replacement);
    assert.deepEqual(result.fit.scale,scale);
    assert.deepEqual([...result.map],[['b0','b3'],['b1','b2'],['b2','b1'],['b3','b0']]);
  }
});

test('replacement previews a new root, additions, losses, channel conflicts and turret clearance',()=>{
  const original=modelFor(fixture);
  const scene={model:original,loaded:true,regions:[region(['b0','b1','b3'])],hiddenIds:new Set(['b2'])};
  const sockets=sceneSockets(scene);
  for(const id of ['b0','b3']){
    const socket=sockets.find(socket=>socket.blockId===id&&Math.abs(socket.normal[0])>.9&&socket.fitSize>=2);
    assert.ok(socket);
    placeTurret(scene,demoProject().assets[0],socket,2,2);
  }
  applyBlockColors(scene,[{id:'b0',color:'ffaabbcc',secondaryColor:'00000000'},{id:'b3',color:'ff770077'}],{writeXml:false});
  assert.deepEqual(paintSnapshot(original),[{id:'b0',color:'ffaabbcc',secondaryColor:'00000000'},{id:'b3',color:'ff770077'}]);
  const added={itemIndex:'11',typeIndex:2,position:{x:42,y:5,z:-11},size:{x:3,y:4,z:2}};
  const incoming=modelFor([fixture[2],{...fixture[0],parentId:'b0',color:'ff334455'},added,fixture[1]],[2,.25,.25],[10,3,-7]);
  const preview=previewReplacement(scene,incoming);
  assert.deepEqual(preview.regions,[region(['b1','b3'])]);
  assert.deepEqual(preview.regionLosses,[{name:'Service bays',lost:1,empty:false}]);
  assert.equal(preview.missingPaint,1);
  assert.equal(preview.conflicts.length,1);
  assert.equal(preview.mounts.missing.length,1);
  assert.equal(preview.mounts.clearance.length,1);
  assert.equal(incoming.blocks[1].color,'ff334455');
  assert.equal(original.blocks[0].color,'ffaabbcc');
  const updated=applyReplacement(preview,()=>true);
  assert.equal(updated.model.blocks[1].color,'ffaabbcc');
  assert.equal(updated.model.blocks[1].secondaryColor,'00000000');
  assert.equal(updated.model.blocks[1].parentId,'b0');
  assert.equal(updated.model.blocks[2].color,'ff102030');
  assert.deepEqual([...updated.hiddenIds],['b0']);
  assert.match(updated.model.turretMounts[0].socketId,/^turret:b1:/);
  assert.equal(updated.model.turretMounts[0].turretSize,2);
});

test('coincident identical blocks are unresolved after replacing XML',()=>{
  const duplicate={...fixture[0],itemIndex:'other'};
  const result=matchReplacementBlocks(modelFor([fixture[0],duplicate,fixture[1],fixture[2]]),modelFor([duplicate,fixture[0],fixture[1],fixture[2]]));
  assert.equal(result.map.has('b0'),false);
  assert.equal(result.map.has('b1'),false);
  assert.equal(result.map.size,2);
});

test('replacement scales custom component sockets and retains only resolved attachment branches',()=>{
  const scene={model:modelFor(fixture),loaded:true};
  const asset={id:'component-asset',name:'Pod',blocks:[makeBlock()],attachment:{position:[0,0,0],rotation:[0,0,0]}};
  const socket={id:'manual-1',name:'Service socket',blockId:'b0',position:[1,0,0],rotation:[0,0,0]};
  const lost={...socket,id:'manual-2',name:'Removed socket',blockId:'b3'};
  const mount={id:'pod',socketId:socket.id,asset,scale:1,twist:0};
  scene.model.componentSetup={...emptySetup(),sockets:[socket,lost],mounts:[mount,{...mount,id:'lost',socketId:lost.id}]};
  const replacement=modelFor([fixture[1],fixture[0],fixture[2]],[2,1,1]);
  const preview=previewReplacement(scene,replacement);
  assert.deepEqual(preview.components.missingSockets,['Removed socket']);
  assert.equal(preview.components.missingMounts.length,1);
  const next=applyReplacement(preview,()=>false);
  assert.equal(next.model.componentSetup.mounts[0].id,'pod');
  assert.deepEqual(next.model.componentSetup.sockets[0].position,[2,0,0]);
  assert.equal(componentSockets({...next,loaded:true})[0].blockId,'b1');
});

test('profiles keep nested layout and shaders separate from named model projects',()=>{
  const layout=defaults(),viewport=leaves(layout.workspaces[0].root)[0];
  viewport.view.target=[12,44,2];
  viewport.view.paint={scope:'region',regionId:'region-1'};
  const profile=captureProfile('Inspection',layout,{...FACTORY_PREFERENCES,shaderBloom:.7});
  const settings=restoreProfile(JSON.parse(JSON.stringify(profile)));
  assert.equal(profile.shaders.shaderBloom,.7);
  assert.equal(settings.preferences.shaderBloom,.7);
  assert.equal(layout.workspaces[0].root.type,'split');
  assert.deepEqual(viewport.view.target,[12,44,2]);
  assert.equal(leaves(settings.layout.workspaces[0].root)[0].view.paint.scope,'all');
  const scene={loaded:true,model:makeModel([makeBlock()]),regions:[region(['b0'])]};
  const record=captureProject(scene,{id:'project-2',name:'Refit Mk II'});
  const restored=restoreProject(JSON.parse(JSON.stringify(record)));
  assert.equal(restored.project.name,'Refit Mk II');
  assert.deepEqual(restored.regions,scene.regions);
  assert.throws(()=>restoreProject({...record,version:50}),/version/);
  assert.throws(()=>restoreProject({...record,model:{...record.model,regions:[region(['missing'])]}}),/block reference/);
  const asset=demoProject().assets[0];
  const turret=restoreTurretProject(JSON.parse(JSON.stringify(captureTurretProject(asset))));
  assert.deepEqual(turret.blocks,asset.blocks);
});

test('a region-only edit triggers browser recovery and restores on restart',async()=>{
  const scene={loaded:true,model:makeModel([makeBlock()]),regions:[]};
  const records=new Map(),store={get:async key=>records.get(key),put:async(key,value)=>records.set(key,structuredClone(value))};
  const textures={blobs:new Map(),subscribe(){},async loadFiles(){}};
  const persistence=createSessionPersistence({scene,textures,store,restored(){},onError:error=>{throw error;}});
  await persistence.start();
  scene.regions=[region(['b0'])];
  persistence.flush();
  const restored={loaded:false,model:null};
  await createSessionPersistence({scene:restored,textures,store,restored(){},onError:error=>{throw error;}}).start();
  assert.deepEqual(restored.regions,scene.regions);
});
