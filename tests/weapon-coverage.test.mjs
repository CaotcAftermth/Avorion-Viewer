import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock} from '../src/block-model.js';
import {demoProject,partMatrices} from '../src/turrets/core.js';
import {createCoverageEngine} from '../src/turrets/coverage-engine.js';
import {sampleTargets,COVERAGE_DEFAULTS,analysisKey} from '../src/turrets/coverage-sampling.js';
function fixture(positions=[[0,0,0]]){
 const asset=demoProject().assets[0];Object.assign(asset,{blocks:[],parts:{},native:{offsets:{barrel:[0,0,0]}},muzzlePositions:[[0,0,0]],sourceSize:1});asset.attachment.position=asset.yaw.position=asset.pitch.position=[0,0,0];asset.pitch.elevationSign=-1;
 return {blocks:[],mounts:positions.map((p,i)=>({id:'m'+i,name:'Turret '+i,socketId:'s'+i,asset:structuredClone(asset),twist:0,yaw:0,pitch:0,scale:1,turretSize:1})),sockets:positions.map((position,i)=>({id:'s'+i,position,rotation:[0,0,0]}))};
}
const counts=r=>[r.potential,r.clear,r.obstructed];
test('A/B/C: clear, blocked, outside mechanical arc and finite distance',()=>{
 const f=fixture();assert.deepEqual(counts(createCoverageEngine(f).evaluate([0,0,10])),[1,1,0]);
 f.blocks=[makeBlock({id:'armor',position:{x:0,y:0,z:5}})];const engine=createCoverageEngine(f),r=engine.evaluate([0,0,10]);assert.deepEqual(counts(r),[1,0,1]);assert.equal(r.classification,'structurally-obstructed');assert.equal(r.contributors[0].paths[0].blocker.blockId,'armor');
 assert.deepEqual(counts(engine.evaluate([0,-10,0])),[0,0,0]);assert.deepEqual(counts(engine.evaluate([0,0,3])),[1,1,0],'obstacle beyond target does not block');
 f.mounts[0].coverage={yawMin:-20,yawMax:20};assert.deepEqual(counts(createCoverageEngine(f).evaluate([10,0,0])),[0,0,0]);
});
test('D/E: overlapping and partially obstructed turrets preserve the invariant',()=>{
 const f=fixture([[-5,0,0],[0,0,0],[5,0,0]]);assert.deepEqual(counts(createCoverageEngine(f).evaluate([0,0,10])),[3,3,0]);
 f.blocks=[makeBlock({id:'armor',position:{x:-2.5,y:0,z:5},size:{x:.5,y:1,z:.5}})];const r=createCoverageEngine(f).evaluate([0,0,10]);assert.deepEqual(counts(r),[3,2,1]);assert.equal(r.classification,'partially-obstructed');assert.equal(r.potential,r.clear+r.obstructed);
});
test('F/G: mounting surface does not self-hit; nearby genuine geometry does',()=>{
 const f=fixture();f.blocks=[makeBlock({position:{x:0,y:-1,z:0}})];assert.deepEqual(counts(createCoverageEngine(f).evaluate([0,5,10])),[1,1,0]);
 f.blocks.push(makeBlock({id:'close',position:{x:0,y:0,z:.02},size:{x:1,y:1,z:.01}}));assert.deepEqual(counts(createCoverageEngine(f).evaluate([0,0,10])),[1,0,1]);
});
test('H: each finite target direction comes from its own muzzle, not ship center',()=>{
 const f=fixture([[-10,0,0],[10,0,0]]),r=createCoverageEngine(f).evaluate([0,0,5]);assert.deepEqual(counts(r),[2,2,0]);
 assert.ok(r.contributors[0].paths[0].yaw>60);assert.ok(r.contributors[1].paths[0].yaw< -60);
});
test('real pivot and muzzle offsets are solved at the aimed pose',()=>{
 const f=fixture(),a=f.mounts[0].asset;a.muzzlePositions=[[.8,1,3]];a.yaw.position=[0,.4,0];a.pitch.position=[0,1,0];
 const pose={...f.mounts[0],yaw:67,pitch:31},matrix=partMatrices(a,f.sockets[0],pose).barrel;
 const origin=new THREE.Vector3(...a.muzzlePositions[0]).applyMatrix4(matrix),direction=new THREE.Vector3(0,0,1).transformDirection(matrix),target=origin.clone().addScaledVector(direction,5);
 const r=createCoverageEngine(f).evaluate(target.toArray());assert.equal(r.clear,1);const p=r.contributors[0].paths[0];assert.ok(Math.abs(p.yaw-67)<.01);assert.ok(Math.abs(p.pitch-31)<.01);
});
test('I: slice and sphere use exactly the same target evaluator',()=>{
 const f=fixture(),e=createCoverageEngine(f),sphere=sampleTargets({...COVERAGE_DEFAULTS,mode:'sphere',quality:'low'},e.center,e.minimumRadius),p=sphere.cells[0].point;
 const first=sampleTargets({...COVERAGE_DEFAULTS,mode:'slice',extent:8,quality:'low'},[0,0,0],1).cells[0].point;
 const slice=sampleTargets({...COVERAGE_DEFAULTS,mode:'slice',extent:8,quality:'low'},p.map((n,i)=>n-first[i]),1);
 const a=e.evaluate(sphere.cells[0].point),b=e.evaluate(slice.cells[0].point);
 assert.ok(a.point.every((n,i)=>Math.abs(n-b.point[i])<1e-12));assert.deepEqual(counts(a),counts(b));assert.equal(a.classification,b.classification);assert.ok(slice.cells.every(c=>c.point[1]===p[1]));assert.equal(sphere.cells.length,80);
});
test('J: rigid ship transforms preserve classification and moving mounting axes',()=>{
 const f=fixture(),before=createCoverageEngine(f).evaluate([0,3,8]);
 f.sockets[0].position=[10,20,30];f.sockets[0].rotation=[0,0,90];const after=createCoverageEngine(f).evaluate([7,20,38]);assert.deepEqual(counts(after),counts(before));
 f.sockets[0].rotation=[180,0,0];assert.equal(createCoverageEngine(f).evaluate([10,17,22]).clear,1);
});
test('K: cached ship BVH is reused for mount changes and invalidated by geometry key',()=>{
 const f=fixture();f.shipKey=1;f.blocks=[makeBlock({position:{x:10,y:0,z:5}})];const a=createCoverageEngine(f);
 f.mounts[0].twist=90;const b=createCoverageEngine(f,a);assert.equal(a.ship,b.ship);
 f.shipKey=2;f.blocks[0].position.x=0;const c=createCoverageEngine(f,b);assert.notEqual(c.ship,b.ship);assert.equal(c.evaluate([0,0,10]).obstructed,1);
 assert.equal(analysisKey(COVERAGE_DEFAULTS),analysisKey({...COVERAGE_DEFAULTS,opacity:.2,palette:'accessible'}));assert.notEqual(analysisKey(COVERAGE_DEFAULTS),analysisKey({...COVERAGE_DEFAULTS,offset:5}));
});
test('hidden, transparent and decorative obstacles follow explicit inclusion rules',()=>{
 const f=fixture();f.blocks=[makeBlock({position:{x:0,y:0,z:5},typeIndex:190})];assert.equal(createCoverageEngine(f).evaluate([0,0,10]).clear,1);
 f.rules={includeTransparent:true};assert.equal(createCoverageEngine(f).evaluate([0,0,10]).obstructed,1);
 f.hiddenIds=['b0'];assert.equal(createCoverageEngine(f).evaluate([0,0,10]).clear,1);f.rules.includeHidden=true;assert.equal(createCoverageEngine(f).evaluate([0,0,10]).obstructed,1);
});
test('inside-hull targets are invalid; sphere radius always encloses the model',()=>{
 const f=fixture();f.blocks=[makeBlock({position:{x:0,y:0,z:5}})];const e=createCoverageEngine(f);assert.equal(e.evaluate([0,0,5]).valid,false);
 const sphere=sampleTargets({...COVERAGE_DEFAULTS,mode:'sphere',radius:.001,quality:'low'},e.center,e.minimumRadius);assert.ok(sphere.radius>=e.minimumRadius);assert.ok(sphere.cells.every(c=>e.evaluate(c.point).valid));
});
test('enabled filter, coaxial current pose and partial muzzle paths',()=>{
 const f=fixture();f.mounts[0].coverage={enabled:false};assert.equal(createCoverageEngine(f).evaluate([0,0,10]).potential,0);
 f.mounts[0].coverage={fixed:true};f.mounts[0].yaw=90;assert.equal(createCoverageEngine(f).evaluate([10,0,0]).clear,1);assert.equal(createCoverageEngine(f).evaluate([0,0,10]).potential,0);
 f.mounts[0].coverage={};f.mounts[0].asset.muzzlePositions.push([4,0,0]);f.blocks=[makeBlock({position:{x:0,y:0,z:5},size:{x:.5,y:.5,z:.5}})];const r=createCoverageEngine(f).evaluate([0,0,10]);assert.equal(r.clear,1);assert.equal(r.contributors[0].partial,true);
});
test('custom axes solve known reachable poses; unavailable hull geometry is explicit',()=>{
 const f=fixture(),a=f.mounts[0].asset;a.yaw.axis=[0,.8,.6];a.pitch.axis=[.8,.6,0];const matrix=partMatrices(a,f.sockets[0],{...f.mounts[0],yaw:20,pitch:25}).barrel;
 const p=new THREE.Vector3(0,0,10).applyMatrix4(matrix);assert.equal(createCoverageEngine(f).evaluate(p.toArray()).clear,1);
 assert.throws(()=>createCoverageEngine({...f,geometryAvailable:false}),/unavailable/);
});
test('native muzzle component offset is applied once through size and angled mounting',()=>{
 const f=fixture([[3,4,5]]),m=f.mounts[0],a=m.asset;a.native.offsets.barrel=[1,2,3];a.muzzlePositions=[[.2,.3,4]];a.pitch.position=[1,2,3];a.yaw.position=[0,1,0];m.turretSize=.5;f.sockets[0].rotation=[25,0,50];
 const matrix=partMatrices(a,f.sockets[0],{...m,yaw:-33,pitch:24}).barrel,origin=new THREE.Vector3(1.2,2.3,7).applyMatrix4(matrix),target=origin.clone().addScaledVector(new THREE.Vector3(0,0,1).transformDirection(matrix),7);
 const r=createCoverageEngine(f).evaluate(target.toArray());assert.equal(r.clear,1);assert.ok(Math.abs(r.contributors[0].paths[0].yaw+33)<.01);assert.ok(new THREE.Vector3(...r.contributors[0].paths[0].origin).distanceTo(origin)<.001);
});

test('adaptive slice keeps the real armor shadow blocked',async()=>{
 const {refineSlice}=await import('../src/turrets/coverage-refinement.js'),{fanSurface}=await import('../src/turrets/coverage-surface.js');
 const f=fixture([[1,0,0]]);f.blocks=[makeBlock({id:'armor',position:{x:1,y:0,z:4},size:{x:2,y:2,z:1}})];
 const engine=createCoverageEngine(f),options={...COVERAGE_DEFAULTS,extent:10,quality:'low'};
 const result=await refineSlice(sampleTargets(options,engine.center,engine.minimumRadius),p=>engine.evaluate(p),{depth:2});result.turrets=[{id:'m0'}];
 const surface=fanSurface(result,options);let tested=0;
 for(let i=0;i<surface.positions.length;i+=9){
  const p=[0,1,2].map(k=>(surface.positions[i+k]+surface.positions[i+3+k]+surface.positions[i+6+k])/3);
  // Check the interior of the known shadow, away from the finite boundary tolerance.
  if(p[2]>5&&Math.abs(p[0]-1)<.6){assert.equal(engine.evaluate(p).clear,1,'clear surface crossed the armor shadow');tested++;}
 }
 assert.equal(tested,0);assert.ok(surface.positions.length>0);
 assert.equal(engine.evaluate([1,0,8]).clear,0);
});
