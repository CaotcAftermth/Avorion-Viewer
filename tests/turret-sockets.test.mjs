import test from 'node:test';
import assert from 'node:assert/strict';
import {blockSockets,isTurretBlock,sceneSockets} from '../src/turrets/sockets.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {area,defaults,validateState} from '../src/layout.js';
test('only turret bases expose typed sockets, with six centered box faces',()=>{
  assert.equal(isTurretBlock(makeBlock({typeIndex:12})),false);
  assert.deepEqual(blockSockets(makeBlock()),[]);
  const sockets=blockSockets(makeBlock({typeIndex:20,position:{x:0,y:0,z:0}}));
  assert.equal(sockets.length,6);assert.equal(new Set(sockets.map(s=>s.id)).size,6);
  for(const s of sockets){assert.equal(s.type,'turret');assert.equal(s.blockId,'b0');assert.ok(Math.abs(Math.hypot(...s.normal)-1)<1e-6);assert.ok(Math.abs(s.position.reduce((v,n,i)=>v+n*s.normal[i],0)-1)<1e-6);}
});
test('wedge sockets include an angled surface and track translated geometry',()=>{
  const a=blockSockets(makeBlock({typeIndex:21})),b=blockSockets(makeBlock({typeIndex:21,position:{x:10,y:21,z:30}}));
  assert.equal(a.length,5);assert.ok(a.some(s=>s.normal.filter(n=>Math.abs(n)>.1).length===2));
  a.forEach((s,i)=>s.position.forEach((v,j)=>assert.ok(Math.abs(b[i].position[j]-v-[10,20,30][j])<1e-5)));
});
test('socket cache follows replacement models and deleted blocks',()=>{
  const scene={loaded:true,revision:0,model:makeModel([makeBlock({typeIndex:20})])};assert.equal(sceneSockets(scene).length,6);
  scene.model=makeModel([makeBlock()]);assert.equal(sceneSockets(scene).length,0);
});
test('library editor and Turrets properties survive layout validation',()=>{
  const state=defaults();state.workspaces[0].root=area('assets');assert.equal(validateState(state),true);
  state.workspaces[0].root=area('properties');state.workspaces[0].root.propertyTab='turrets';assert.equal(validateState(state),true);
});
