import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock,makeModel} from '../src/block-model.js';
import {sceneSockets} from '../src/turrets/sockets.js';
import {placeTurret} from '../src/turrets/mounts.js';
import {demoProject} from '../src/turrets/core.js';

test('Tachi b8487 Face 4 is blocked by neighboring thin turret plate b8484',()=>{
 const base=makeBlock({id:'b8487',typeIndex:20,position:{x:8.08248997,y:.9390928725,z:2.7343905},size:{x:.00100136,y:2.999999995,z:3.00000048}});
 const neighbor=makeBlock({id:'b8484',typeIndex:20,position:{x:8.083491325,y:.9390928755,z:2.73439038},size:{x:.00100135,y:3.000001909,z:2.99999786}});
 const scene={loaded:true,model:makeModel([base,neighbor]),hiddenIds:new Set([neighbor.id])};
 const socket=sceneSockets(scene).find(s=>s.id==='turret:b8487:3');
 assert.equal(socket.fitSize,null);
 assert.throws(()=>placeTurret(scene,demoProject().assets[0],socket,.5),/clearance/);
});

test('clearance preserves free thin plates, reduces fit near hull, and rejects enclosing solids',()=>{
 const base=makeBlock({id:'base',typeIndex:24,size:{x:3,y:0,z:3},position:{x:0,y:0,z:0}});
 const fit=blocks=>sceneSockets({loaded:true,model:makeModel(blocks)}).find(s=>s.blockId==='base'&&s.normal[1]>.99).fitSize;
 assert.equal(fit([base]),3);
 const wall=makeBlock({id:'wall',position:{x:1,y:2,z:0},size:{x:.5,y:4,z:4}});
 assert.equal(fit([base,wall]),1.5);
 const enclosure=makeBlock({id:'solid',position:{x:0,y:2,z:0},size:{x:10,y:5,z:10}});
 assert.equal(fit([base,enclosure]),null);
});
