import test from 'node:test';
import assert from 'node:assert/strict';
import {numericValue,numericFill} from '../src/numeric-field.js';
import {beginPropertyEdit,endPropertyEdit,editTurrets,mountHistory,canMountHistory} from '../src/turrets/mounts.js';
test('numeric bounds, half steps, invalid values and signed fill',()=>{
 assert.equal(numericValue(.76,{min:.5,max:10,step:.5}),1);
 assert.equal(numericValue(-400,{min:-360,max:360,step:1}),-360);
 assert.equal(numericValue(NaN),null);
 assert.deepEqual(numericFill(-90,-180,180),[25,50]);
 assert.deepEqual(numericFill(90,-180,180),[50,75]);
 assert.deepEqual(numericFill(5,-Infinity,Infinity),[0,0]);
 assert.equal(numericValue(1e9),1e9);
 assert.equal(numericValue(1.234567890123456),1.234567890123456);
});
test('undo preserves subsequent viewport navigation unless editing the camera',()=>{
 const scene={model:{turretMounts:[{id:'a',yaw:0}]}},view={yaw:0};
 beginPropertyEdit(scene,undefined,{view});editTurrets(scene,['a'],{yaw:20});endPropertyEdit(scene);view.yaw=2;
 mountHistory(scene);assert.equal(view.yaw,2);
 beginPropertyEdit(scene,undefined,{view,viewEdit:true});view.yaw=3;endPropertyEdit(scene);
 mountHistory(scene);assert.equal(view.yaw,2);mountHistory(scene,true);assert.equal(view.yaw,3);
});
test('passive playback does not turn a simple click into an undo entry',()=>{
 const scene={model:{}},runtime={clock:{time:0}},view={yaw:0};
 beginPropertyEdit(scene,undefined,{runtime,view});runtime.clock.time=1;view.yaw=1;endPropertyEdit(scene,false,false);
 assert.equal(canMountHistory(scene),false);
});
test('drag coalesces mount edits and cancellation preserves history',()=>{
 const scene={model:{turretMounts:[{id:'a',yaw:0}]}};
 beginPropertyEdit(scene);for(let yaw=1;yaw<=20;yaw++)editTurrets(scene,['a'],{yaw});endPropertyEdit(scene);
 assert.equal(scene.model.turretMounts[0].yaw,20);mountHistory(scene);assert.equal(scene.model.turretMounts[0].yaw,0);
 beginPropertyEdit(scene);editTurrets(scene,['a'],{yaw:5});endPropertyEdit(scene,true);assert.equal(scene.model.turretMounts[0].yaw,0);
 mountHistory(scene,true);assert.equal(scene.model.turretMounts[0].yaw,20);
});
test('coverage and asset numeric changes undo without changing serialized keys',()=>{
 const scene={model:{},weaponCoverage:{opacity:.8}},asset={editorPose:{yaw:0},simulation:{speed:1}};
 beginPropertyEdit(scene,asset);scene.weaponCoverage.opacity=.4;asset.editorPose.yaw=45;asset.simulation.speed=2;endPropertyEdit(scene);
 mountHistory(scene);assert.equal(scene.weaponCoverage.opacity,.8);assert.equal(asset.editorPose.yaw,0);assert.equal(asset.simulation.speed,1);
 mountHistory(scene,true);assert.equal(scene.weaponCoverage.opacity,.4);assert.equal(asset.editorPose.yaw,45);
});
test('numeric undo preserves later unrelated settings and newly added camera keys',()=>{
 const scene={model:{},weaponCoverage:{opacity:.8,showGrid:true}},asset={simulation:{speed:1,family:'ChainGun',showcase:{keys:[{id:'one',time:0}]}}};
 beginPropertyEdit(scene,asset);asset.simulation.speed=2;scene.weaponCoverage.opacity=.4;asset.simulation.showcase.keys[0].time=1;endPropertyEdit(scene);
 asset.simulation.family='Laser';scene.weaponCoverage.showGrid=false;asset.simulation.showcase.keys.push({id:'two',time:2});
 mountHistory(scene);assert.equal(asset.simulation.speed,1);assert.equal(asset.simulation.family,'Laser');assert.equal(scene.weaponCoverage.opacity,.8);assert.equal(scene.weaponCoverage.showGrid,false);assert.deepEqual(asset.simulation.showcase.keys,[{id:'one',time:0},{id:'two',time:2}]);
 mountHistory(scene,true);assert.equal(asset.simulation.showcase.keys[0].time,1);assert.equal(asset.simulation.showcase.keys.length,2);
});
