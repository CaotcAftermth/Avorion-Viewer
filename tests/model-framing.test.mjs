import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewportLoadFramer, frameVisibleModel } from '../src/model-framing.js';
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

test('Frame All honors viewport fill in perspective and orthographic views',()=>{
  const scene={loaded:true,visible:true,model:makeModel([makeBlock({size:{x:10,y:10,z:10}})]),hiddenIds:new Set()};
  for(const projection of ['perspective','orthographic']){
    const view=area().view;view.projection=projection;
    assert.ok(frameVisibleModel(scene,view,800,600,{frameAllFill:40}));const padded=view.zoom;
    assert.ok(frameVisibleModel(scene,view,800,600,FACTORY_PREFERENCES));const standard=view.zoom;
    assert.ok(frameVisibleModel(scene,view,800,600,{frameAllFill:90}));
    assert.ok(padded<standard&&standard<view.zoom);
  }
});

test('model load fits each workspace camera once at its actual canvas size',()=>{
 const model=makeModel([makeBlock({size:{x:100,y:10,z:30}})]),scene={model,loaded:true,visible:true};
 const first=area().view,second=structuredClone(first),frame=createViewportLoadFramer();
 assert.equal(frame(scene,first,1,1),false);
 assert.equal(frame(scene,first,800,400),true);
 assert.equal(frame(scene,second,200,400),true);
 assert.notEqual(first.zoom,second.zoom);
 first.panX=45;
 assert.equal(frame(scene,first,800,400),false);
 assert.equal(first.panX,45);
 assert.equal(createViewportLoadFramer()(scene,first,800,400),true);
 assert.notEqual(first.panX,45);
});
