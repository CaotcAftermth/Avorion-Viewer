import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseEmbeddedSocket,turretContentKey,restoreEmbeddedTurrets} from '../src/turrets/embedded.js';
import {makeBlock} from '../src/block-model.js';
import {demoProject} from '../src/turrets/core.js';
import {createSocketClearance} from '../src/turrets/socket-clearance.js';

test('embedded mount faces follow exposed top, bottom and side plates',()=>{
 for(const axis of ['x','y','z'])for(const sign of [-1,1]){
  const hull=makeBlock({id:'hull',position:{x:0,y:0,z:0},size:{x:4,y:4,z:4}});
  const plate=makeBlock({id:'mount',typeIndex:20,parentId:'hull',position:{x:0,y:0,z:0},size:{x:3,y:3,z:3}});
  plate.parentId='hull';plate.position[axis]=sign*2.05;plate.size[axis]=.1;
  const blocks=[hull,plate],socket=chooseEmbeddedSocket(plate,blocks,2.5,createSocketClearance(blocks));
  assert.ok(socket);assert.equal(socket.normal[['x','y','z'].indexOf(axis)],sign);
  assert.equal(chooseEmbeddedSocket(plate,blocks,4,createSocketClearance(blocks)),undefined);
 }
});

test('library matching ignores names and source XML but preserves appearance and articulation',()=>{
 const asset=demoProject().assets[0],copy=structuredClone(asset);
 copy.id='other';copy.name='Renamed';copy.sourceXml='different formatting';
 assert.equal(turretContentKey(asset),turretContentKey(copy));
 copy.blocks[0].color='ff123456';assert.notEqual(turretContentKey(asset),turretContentKey(copy));
 copy.blocks[0].color=asset.blocks[0].color;copy.pitch.position[0]+=1;
 assert.notEqual(turretContentKey(asset),turretContentKey(copy));
});

test('ships without embedded assignments do not open library storage',async()=>{
 await restoreEmbeddedTurrets({blocks:[]},{load:()=>assert.fail('unexpected storage access')});
});
