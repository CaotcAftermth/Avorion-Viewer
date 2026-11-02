import test from 'node:test';
import assert from 'node:assert/strict';
import {blockOpacity} from '../src/block-opacity.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {snapshotModel,restoreModel} from '../src/session-persistence.js';
import {captureExport} from '../src/export/snapshot.js';
import {prepareExport} from '../src/export/pipeline.js';
test('opacity overrides preserve native color and survive session and model exports',async()=>{
 const glass=makeBlock({id:'glass',typeIndex:170}),holo=makeBlock({id:'holo',typeIndex:190,color:'80ffffff',position:{x:4,y:1,z:0}});
 assert.equal(blockOpacity(glass),.7);assert.equal(blockOpacity(holo),.5);
 assert.equal(blockOpacity({...holo,color:'ffffffff'}),.5);
 glass.opacity=.25;holo.opacity=.6;
 const scene={loaded:true,visible:true,model:makeModel([glass,holo]),selectedIds:new Set(),hiddenIds:new Set()};
 const restored=restoreModel(snapshotModel(scene));assert.equal(blockOpacity(restored.model.blocks[0]),.25);assert.equal(holo.color,'80ffffff');
 const data=await prepareExport(captureExport(scene,{}),{format:'glb',mode:'detailed',longest:100,budget:512,includeTransparent:true,cleanup:true});
 assert.deepEqual(data.materials.map(m=>m.alpha),[.25,.6]);
 delete glass.opacity;assert.equal(blockOpacity(glass),.7);
 delete holo.opacity;assert.equal(blockOpacity(holo),.5);
});
