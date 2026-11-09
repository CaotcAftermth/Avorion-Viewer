import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock,makeModel} from '../src/block-model.js';
import {socketFaces,socketNormalChoices} from '../src/components/socket-face.js';
import {planSocketBatch,SOCKET_BATCH_LIMIT} from '../src/components/socket-batch.js';
const modelOf=n=>makeModel(Array.from({length:n},(_,i)=>makeBlock({id:'b'+i,position:{x:i*3,y:0,z:0}})));
const plan=model=>{const face=socketFaces(model.blocks[0])[0];return planSocketBatch(model,2,face,socketNormalChoices(face)[0].normal);};
test('batch repeats selected face, preserves dimensions and skips existing sockets',()=>{
 const model=modelOf(3),before=JSON.stringify(model),result=plan(model);assert.equal(result.sockets.length,3);assert.equal(JSON.stringify(model),before);
 for(const socket of result.sockets){const block=model.blocks.find(b=>b.id===socket.blockId),face=socketFaces(block).find(f=>f.faceId===socket.faceId);assert.deepEqual(socket.position,face.position.map((n,i)=>n-block.position['xyz'[i]]));}
 model.componentSetup={version:1,blockType:null,sockets:result.sockets,mounts:[]};assert.equal(plan(model).sockets.length,0);assert.equal(plan(model).duplicates,3);
});
test('common block batches are rejected atomically above cap',()=>{
 const model=modelOf(SOCKET_BATCH_LIMIT+1),before=JSON.stringify(model);assert.throws(()=>plan(model),/More than 100/);assert.equal(JSON.stringify(model),before);assert.equal(plan(modelOf(SOCKET_BATCH_LIMIT)).sockets.length,SOCKET_BATCH_LIMIT);
});
test('batch excludes deleted and other types; rejects setup overflow',()=>{
 const model=modelOf(3);model.blocks[1].deleted=true;model.blocks[2].typeIndex=123;assert.equal(plan(model).sockets.length,1);
 model.componentSetup={version:1,blockType:null,mounts:[],sockets:Array.from({length:1000},(_,i)=>({id:'s'+i,blockId:'other',position:[0,0,0]}))};assert.throws(()=>plan(model),/1,000/);
});
