import test from 'node:test';
import assert from 'node:assert/strict';
import {modelSummary} from '../src/scene-properties.js';
import {makeBlock,makeModel} from '../src/block-model.js';
test('scene summary respects deleted and filtered blocks while measuring the full live model',()=>{
 const a=makeBlock({id:'a',typeIndex:3,size:{x:2,y:4,z:0}}),b=makeBlock({id:'b',position:{x:5,y:0,z:0}}),deleted=makeBlock({id:'d',position:{x:100,y:0,z:0}});deleted.deleted=true;
 const scene={loaded:true,visible:true,model:makeModel([a,b,deleted],'Ship.xml'),hiddenIds:new Set(),revision:1};
 const s=modelSummary(scene,{showThinBlocks:false});assert.equal(s.total,2);assert.equal(s.visible,1);assert.equal(s.engines,1);assert.equal(s.thin,1);assert.deepEqual(s.dimensions,[7,4,2]);
 scene.visible=false;assert.equal(modelSummary(scene,{}).visible,0);scene.loaded=false;assert.equal(modelSummary(scene).total,0);
});
