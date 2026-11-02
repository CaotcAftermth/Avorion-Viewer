import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock,makeModel} from '../src/block-model.js';
import {engineEffectHiddenIds,viewportHiddenIds} from '../src/ship-structure.js';
import {buildBlockEffects,effectColor} from '../src/avorion/lib/geometry/blockEffects.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
test('thin engine bodies and plumes have independent visibility without overriding manual hiding',()=>{
 const blocks=[makeBlock({id:'engine',typeIndex:3,size:{x:2,y:2,z:0}}),makeBlock({id:'hull',size:{x:2,y:2,z:0}})];
 const scene={model:makeModel(blocks),loaded:true,revision:1,hiddenIds:new Set()},view={showThinBlocks:false};
 assert.ok(viewportHiddenIds(scene,view).has('engine'));
 assert.ok(!engineEffectHiddenIds(scene,view).has('engine'));assert.ok(engineEffectHiddenIds(scene,view).has('hull'));
 assert.ok(engineEffectHiddenIds(scene,view,false).has('engine'));
 scene.hiddenIds=new Set(['engine']);assert.ok(engineEffectHiddenIds(scene,view).has('engine'));
});
test('zero-depth engines retain finite core and particle geometry with state-specific uniforms',()=>{
 const effects=buildBlockEffects([makeBlock({id:'engine',typeIndex:3,size:{x:2,y:2,z:0}})],defaultOrientationProfile(),{plumeLength:4,engineState:1});
 const g=effects.mesh.geometry,state=g.getAttribute('aData');
 assert.ok([...g.getAttribute('position').array].every(Number.isFinite));
 let particles=0;for(let i=0;i<state.count;i++)if(state.getX(i)===9)particles++;
 assert.equal(particles,16*6);assert.equal(effects.mesh.material.uniforms.uEngineState.value,1);
 effects.setParams({engineState:2,plumeLength:8.25});assert.equal(effects.mesh.material.uniforms.uEngineState.value,2);
 effects.setHidden(new Set(['engine']));for(let i=0;i<state.count;i++)assert.equal(state.getY(i),0);
 effects.dispose();
});

test('engine exhaust defaults to material color independently of hull paint and honors secondary color',()=>{
 const engine=makeBlock({typeIndex:3,materialIndex:0,color:'ff1e1e1e',secondaryColor:'00000000'});
 assert.deepEqual(effectColor(engine).toArray(),[1,179/255,128/255]);
 assert.deepEqual(effectColor({...engine,color:'ff00ff00'}).toArray(),[1,179/255,128/255]);
 assert.deepEqual(effectColor({...engine,materialIndex:1}).toArray(),[1,1,1]);
 assert.deepEqual(effectColor({...engine,typeIndex:10}).toArray(),[.02,.42,1]);
 assert.deepEqual(effectColor({...engine,secondaryColor:'ffff0000'}).toArray(),[1,0,0]);
 assert.equal(engine.secondaryColor,'00000000');
});
test('rear plume sections remain part of engine visibility and pose geometry',async()=>{
 const {BlockPose}=await import('../src/avorion/lib/geometry/blockPose.js');
 const THREE=await import('../src/vendor/three.module.js');
 const effects=buildBlockEffects([makeBlock({id:'e',typeIndex:3})],defaultOrientationProfile(),{engineState:2,plumeLength:8.25});
 const geometry=effects.mesh.geometry,state=geometry.getAttribute('aData'),positions=geometry.getAttribute('position');
 let index=-1,count=0;for(let i=0;i<state.count;i++)if(state.getX(i)===10){index=i;count++;}assert.equal(count,8*6);
 const before=positions.getX(index),pose=new BlockPose(geometry,effects.ranges);pose.apply(new Map([['e',new THREE.Matrix4().makeTranslation(5,0,0)]]));assert.ok(Math.abs(positions.getX(index)-before-5)<.00001);
 pose.apply(new Map());assert.ok(Math.abs(positions.getX(index)-before)<.00001);effects.dispose();
});
