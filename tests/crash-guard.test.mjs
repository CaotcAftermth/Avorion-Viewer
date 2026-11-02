import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrashGuard,findCrashRecords,forgetCrashRecords,isMemoryFailure,CRASH_PREFIX} from '../src/crash-guard.js';
import {createSessionPersistence,snapshotModel} from '../src/session-persistence.js';
import {makeModel,makeBlock} from '../src/block-model.js';

const memoryStorage=()=>{const map=new Map();return {get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};};
const fakeLocks=()=>{const held=new Set();return {held,request(name,fn){held.add(name);return Promise.resolve(fn()).finally(()=>held.delete(name));},async query(){return {held:[...held].map(name=>({name}))};}};};
const frames=()=>{const queue=[];return {frame:fn=>queue.push(fn),run(){while(queue.length)queue.shift()();}};};

test('a model on screen leaves a record until the page closes cleanly',async()=>{
 const storage=memoryStorage(),scene={loaded:false,model:null,revision:0},f=frames();
 const guard=createCrashGuard({storage,scene,locks:null,frame:f.frame});
 guard.track();assert.equal(storage.length,0);
 scene.model=makeModel([makeBlock()],'Big ship.xml');scene.loaded=true;guard.track();
 assert.equal(guard.phase,'loading');
 f.run();assert.equal(guard.phase,'shown');
 const [record]=await findCrashRecords({storage,locks:null});
 assert.equal(record.fileName,'Big ship.xml');assert.equal(record.phase,'shown');
 guard.close();assert.equal(storage.length,0);
});

test('a still-preparing model stays in the loading phase',()=>{
 const storage=memoryStorage(),scene={loaded:true,model:makeModel([makeBlock()]),revision:0,renderPreparing:true},f=frames();
 const guard=createCrashGuard({storage,scene,locks:null,frame:fn=>{if(scene.renderPreparing){scene.renderPreparing=false;}f.frame(fn);}});
 guard.track();f.run();assert.equal(guard.phase,'shown');
 scene.revision++;guard.track();assert.equal(guard.phase,'loading');
 scene.loaded=false;guard.track();assert.equal(storage.length,0);
});

test('records of tabs that are still open are not treated as crashes',async()=>{
 const storage=memoryStorage(),locks=fakeLocks(),scene={loaded:true,model:makeModel([makeBlock()]),revision:0};
 const live=createCrashGuard({storage,scene,locks,frame(){}});live.track();
 await new Promise(r=>setTimeout(r,0));
 assert.equal((await findCrashRecords({storage,locks})).length,0);
 storage.setItem(CRASH_PREFIX+'dead',JSON.stringify({tab:'dead',phase:'loading',fileName:'x.xml',at:1}));
 const crashes=await findCrashRecords({storage,locks});
 assert.deepEqual(crashes.map(r=>r.tab),['dead']);
 forgetCrashRecords(storage,crashes);assert.equal(storage.getItem(CRASH_PREFIX+'dead'),null);
 live.dispose();
});

test('failures mark the record and memory errors are recognised',()=>{
 const storage=memoryStorage(),scene={loaded:true,model:makeModel([makeBlock()]),revision:0};
 const guard=createCrashGuard({storage,scene,locks:null,frame(){}});guard.track();guard.fail();
 assert.equal(guard.phase,'failed');scene.revision++;guard.track();assert.equal(guard.phase,'failed');
 assert.ok(isMemoryFailure(new RangeError('Array buffer allocation failed')));
 assert.ok(isMemoryFailure({message:'Invalid typed array length: 4294967296'}));
 assert.ok(!isMemoryFailure(new RangeError('Maximum call stack size exceeded')));
 assert.ok(!isMemoryFailure(new Error('Saved model data is invalid.')));
});

test('the restore gate can hold back the model or only the textures',async()=>{
 const saved=new Map([['model',snapshotModel({loaded:true,model:makeModel([makeBlock()],'Saved'),preview:true})],['textures',[{name:'hull',blob:new Blob(['x']),file:'hull.png'}]]]);
 const run=async plan=>{
  const scene={loaded:false,model:null},writes=new Map(),loads=[];
  const textures={blobs:new Map(),sourceOf:new Map(),generation:0,scanning:false,subscribe(fn){this.listener=fn;},async loadFiles(files){loads.push(files);}};
  let asked=null;
  const persistence=createSessionPersistence({scene,textures,restored(){},onError:e=>{throw e;},gate:async record=>{asked=record.fileName;return plan;},store:{get:async k=>saved.get(k),put:async(k,v)=>writes.set(k,v)}});
  await persistence.start();return {scene,writes,loads,asked};
 };
 const cleared=await run({model:false,textures:true});
 assert.equal(cleared.asked,'Saved');assert.equal(cleared.scene.loaded,false);assert.equal(cleared.writes.get('model').empty,true);assert.equal(cleared.loads.length,1);
 const lite=await run({model:true,textures:false});
 assert.equal(lite.scene.model.fileName,'Saved');assert.equal(lite.loads.length,0);assert.equal(lite.writes.has('textures'),false);
 const retry=await run({});
 assert.equal(retry.scene.loaded,true);assert.equal(retry.loads.length,1);
});
