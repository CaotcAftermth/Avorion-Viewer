import test from 'node:test';
import assert from 'node:assert/strict';
import {makeModel,makeBlock} from '../src/block-model.js';
import {createSessionPersistence,openSessionStore,snapshotModel,restoreModel} from '../src/session-persistence.js';
const scene=()=>({model:makeModel([makeBlock()]),loaded:true,preview:true});
const textures=()=>({blobs:new Map(),sourceOf:new Map(),generation:0,scanning:false,subscribe(fn){this.listener=fn;},async loadFiles(){}});
test('generated models and empty scenes round trip without DOM or GPU data',()=>{
 const original=scene(),restored=restoreModel(structuredClone(snapshotModel(original)));assert.deepEqual(restored,original);
 assert.deepEqual(restoreModel(snapshotModel({loaded:false})),{model:null,loaded:false,preview:false});
 assert.throws(()=>restoreModel({version:2}));assert.throws(()=>restoreModel({version:1,blocks:[{}]}));
});
test('unavailable storage reports once without preventing scene use',async()=>{
 const current=scene(),errors=[],assets=createSessionPersistence({scene:current,textures:textures(),restored(){},onError:e=>errors.push(e),store:openSessionStore(null)});
 await assets.start();await new Promise(r=>setTimeout(r,0));assert.equal(errors.length,1);assert.ok(current.loaded);assert.equal(current.model.blocks.length,1);
});
test('slow restore never replaces a newly loaded model or revives cleared textures',async()=>{
 const current=scene(),library=textures(),writes=new Map();let release;
 const pending=new Promise(r=>release=r);
 const assets=createSessionPersistence({scene:current,textures:library,restored(){throw Error('Unexpected restoration');},onError:e=>{throw e;},store:{get:async key=>{await pending;return key==='model'?snapshotModel(scene()):[{file:'old.png'}];},put:async(key,value)=>writes.set(key,value)}});
 const starting=assets.start();current.model=makeModel([makeBlock({id:'new'})],'New ship');library.generation++;release();await starting;
 assert.equal(current.model.fileName,'New ship');assert.equal(writes.get('model').fileName,'New ship');assert.deepEqual(writes.get('textures'),[]);
 current.model=null;current.loaded=false;assets.flush();assert.equal(writes.get('model').empty,true);
});

test('texture originals survive restart, failed decoding, and explicit unload',async()=>{
 const {TextureLibrary}=await import('../src/avorion/lib/textures/textureLibrary.js');
 const {allTextureNames}=await import('../src/avorion/lib/textures/shadingMap.js');
 const name=allTextureNames()[0],file=new File(['texture bytes'],name+'.png',{type:'image/png'}),records=new Map();
 const store={get:async key=>structuredClone(records.get(key)),put:async(key,value)=>{records.set(key,structuredClone(value));}};
 const start=async library=>{const persistence=createSessionPersistence({scene:scene(),textures:library,store,restored(){},onError:e=>{throw e;}});await persistence.start();return persistence;};
 const first=new TextureLibrary();first.decode=async()=>({width:1,height:1});
 const a=await start(first);await first.loadFiles([file]);assert.equal(records.get('textures').length,1);a.stop();
 const second=new TextureLibrary();second.decode=async()=>null;
 const b=await start(second);assert.equal(second.loadedCount,0);assert.equal(records.get('textures').length,1);assert.equal(await records.get('textures')[0].blob.text(),'texture bytes');b.stop();
 const third=new TextureLibrary();third.decode=async()=>({width:1,height:1});
 const c=await start(third);assert.equal(third.loadedCount,1);assert.equal(await third.blobs.get(name).text(),'texture bytes');
 third.clear();assert.deepEqual(records.get('textures'),[]);c.stop();
});

test('app-folder texture originals are cached with their source metadata',async()=>{
 const library=textures(),writes=new Map();library.blobs.set('hull',new Blob(['pixels']));library.sourceOf.set('hull',{source:'app',file:'hull.png'});
 const persistence=createSessionPersistence({scene:scene(),textures:library,restored(){},onError:e=>{throw e;},store:{get:async()=>undefined,put:async(k,v)=>writes.set(k,v)}});
 await persistence.start();assert.equal(writes.get('textures')[0].source,'app');assert.equal(writes.get('textures')[0].file,'hull.png');persistence.stop();
});
