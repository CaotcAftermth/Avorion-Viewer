import test from 'node:test';
import assert from 'node:assert/strict';
import {drawSocketMarker,pickSocketMarker,selectSocketMarker} from '../src/socket-markers.js';
import {drawComponentSockets} from '../src/components/overlay.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {area} from '../src/layout.js';
const context=()=>({arcs:[],rects:[],rect(...args){this.rects.push(args);},save(){},restore(){},setLineDash(){},beginPath(){},stroke(){},moveTo(){},lineTo(){},arc(...args){this.arcs.push(args);}});
test('turret socket glyph stays a thin cyan ring with an outward normal',()=>{
 const ctx=context();drawSocketMarker(ctx,[20,30],[20,5]);assert.equal(ctx.strokeStyle,'#75ddff');assert.equal(ctx.lineWidth,2);assert.equal(ctx.arcs.length,1);assert.equal(ctx.arcs[0][2],8);
});
test('Select Sockets exposes component sockets without enabling persistent display; filters still apply',()=>{
 const scene={loaded:true,visible:true,revision:1,model:makeModel([makeBlock({typeIndex:2})]),hiddenIds:new Set()};scene.model.componentSetup={version:1,blockType:2,sockets:[],mounts:[]};const view=area().view;view.interactionMode='object';view.tool='sockets';
 assert.ok(drawComponentSockets(context(),scene,view,600,400,()=>true).length>0);
 view.socketFilter='turrets';assert.equal(drawComponentSockets(context(),scene,view,600,400,()=>true).length,0);
 view.socketFilter='both';view.tool='select';assert.equal(drawComponentSockets(context(),scene,view,600,400,()=>true).length,0);
});
test('overlapping socket picking respects distance and depth across attachment types',()=>{
 const near={id:'turret',screen:[10,10,2]},far={id:'component',screen:[10,10,8]};assert.equal(pickSocketMarker([far,near],10,10),near);assert.equal(pickSocketMarker([near,far],100,100),null);
});
test('socket clicks replace stale multi-selection and clear the other attachment system',()=>{
 const scene={model:{componentSetup:{mounts:[{id:'new',socketId:'c'}]},turretMounts:[{id:'t',socketId:'s'}]},selectedComponentMountIds:new Set(['old']),selectedTurretIds:new Set(['t']),selectedTurretId:'t'};
 selectSocketMarker(scene,{id:'c',type:'component'});assert.deepEqual([...scene.selectedComponentMountIds],['new']);assert.equal(scene.selectedTurretId,null);
 selectSocketMarker(scene,{id:'empty',type:'component'});assert.equal(scene.selectedComponentMountIds.size,0);
 selectSocketMarker(scene,{id:'s',type:'turret'});assert.deepEqual([...scene.selectedTurretIds],['t']);assert.equal(scene.selectedComponentSocketId,null);
});

test('component socket glyph is a square and occupied sockets remain distinguishable',()=>{
 const ctx=context();drawSocketMarker(ctx,[20,30],[20,5],{shape:'square',occupied:true,color:'#79e695'});
 assert.equal(ctx.rects.length,1);assert.equal(ctx.arcs.length,0);assert.equal(ctx.strokeStyle,'#79e695');
});
