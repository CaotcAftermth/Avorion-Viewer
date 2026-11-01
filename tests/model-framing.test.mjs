import test from 'node:test';
import assert from 'node:assert/strict';
import { frameVisibleModel } from '../src/model-framing.js';
import { makeBlock,makeModel } from '../src/block-model.js';
import { area } from '../src/layout.js';
import { selectCubeView } from '../src/view-cube.js';
import { FACTORY_PREFERENCES } from '../src/preferences.js';
test('cube selection frames visible model without changing chosen direction or projection',()=>{
  for(const projection of ['perspective','orthographic']){
    const view=area().view;Object.assign(view,{projection,panX:800,panY:300,target:[900,900,900],zoom:5});
    const scene={loaded:true,visible:true,model:makeModel([makeBlock({id:'a'}),makeBlock({id:'b',position:{x:500,y:0,z:0}})]),hiddenIds:new Set(['b'])};
    selectCubeView(view,'front');const direction=[view.yaw,view.pitch];
    assert.equal(frameVisibleModel(scene,view,800,600,FACTORY_PREFERENCES),true);
    assert.deepEqual([view.yaw,view.pitch],direction);assert.equal(view.projection,projection);
    assert.equal(view.panX,0);assert.equal(view.panY,0);assert.ok(Math.abs(view.target[0])<10);
    scene.hiddenIds.add('a');const before=structuredClone(view);
    assert.equal(frameVisibleModel(scene,view,800,600,FACTORY_PREFERENCES),false);assert.deepEqual(view,before);
  }
});
