import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {demoProject,partMatrices} from '../src/turrets/core.js';
import {createCoverageEngine,aimingConstraints} from '../src/turrets/coverage-engine.js';
import {sampleTargets,COVERAGE_DEFAULTS,classifySample,filterResult,analysisKey} from '../src/turrets/coverage-sampling.js';
import {refineSlice} from '../src/turrets/coverage-refinement.js';
import {fanSurface,globeSurface} from '../src/turrets/coverage-surface.js';
import {coverageStats,exportCoverage,makeBaseline,baselineCompatible,differences} from '../src/turrets/coverage-stats.js';
import {flattenTree} from '../src/turrets/coverage-gpu.js';
import {obstacleTree,rayHit} from '../src/turrets/fire-coverage.js';
import {snapshotModel,restoreModel} from '../src/session-persistence.js';

function fixture(positions=[[0,0,0]]){
 const asset=demoProject().assets[0];Object.assign(asset,{blocks:[],parts:{},native:{offsets:{barrel:[0,0,0]}},muzzlePositions:[[0,0,0]],sourceSize:1});asset.attachment.position=asset.yaw.position=asset.pitch.position=[0,0,0];asset.pitch.elevationSign=-1;
 return {blocks:[],mounts:positions.map((p,i)=>({id:'m'+i,name:'Turret '+i,socketId:'s'+i,asset:structuredClone(asset),twist:0,yaw:0,pitch:0,scale:1,turretSize:1})),sockets:positions.map((position,i)=>({id:'s'+i,position,rotation:[0,0,0]}))};
}
const sample=(contributors,unresolved=[],valid=true)=>{const s={valid,contributors,unresolved,potential:contributors.length,clear:contributors.filter(t=>t.clear).length,point:[0,0,0]};s.obstructed=s.potential-s.clear;s.classification=classifySample(s);return s;};

test('fixed weapons cover a cone: spread, widened to the analyzed cell footprint',()=>{
 const f=fixture();f.mounts[0].coverage={fixed:true,spread:1};const e=createCoverageEngine(f);
 assert.equal(e.footprintSensitive,true);
 assert.equal(e.evaluate([0,0,10]).clear,1,'boresight');
 assert.equal(e.evaluate([.1,0,10]).clear,1,'0.57° is inside a 1° spread');
 assert.equal(e.evaluate([1,0,10]).potential,0,'5.7° is outside the spread for a point target');
 assert.equal(e.evaluate([1,0,10],1.5).clear,1,'a 1.5-unit cell around the target contains the fixed ray');
 const r=e.evaluate([.1,0,10]);assert.ok(r.contributors[0].fixed&&r.contributors[0].paths[0].offAxis>.5&&r.contributors[0].paths[0].offAxis<.6);
 // A sampled sphere now registers a fixed weapon instead of reporting it blind everywhere.
 const sphere=sampleTargets({...COVERAGE_DEFAULTS,mode:'sphere',quality:'low'},e.center,e.minimumRadius);
 assert.ok(sphere.cells.some(c=>e.evaluate(c.point,c.footprint).clear===1),'fixed turret contributes to at least one cell');
 assert.ok(sphere.cells.filter(c=>e.evaluate(c.point,c.footprint).clear===1).length<=6,'but only near its boresight');
});

test('unresolved turrets never hide other turrets; resolved counts survive and IDs are not duplicated',()=>{
 const s=sample([{id:'a',clear:true}],['b']);
 assert.equal(s.classification,'covered');
 assert.equal(sample([],['b']).classification,'unresolved');
 assert.equal(sample([{id:'a',clear:false}],['b']).classification,'unresolved','no clear coverage: aiming uncertainty is reported');
 const r=sampleTargets({...COVERAGE_DEFAULTS,mode:'sphere',quality:'low'},[0,0,0],3);r.samples=r.cells.map(()=>({...s}));
 assert.equal(globeSurface(r,'clear',2).uv[1],1/6,'covered globe cell uses the count row, not purple');
 // Engine: a two-muzzle turret with one muzzle off the custom-axis solution set still counts once.
 const f=fixture(),a=f.mounts[0].asset;a.yaw.axis=[0,.8,.6];a.pitch.axis=[.8,.6,0];
 const matrix=partMatrices(a,f.sockets[0],{...f.mounts[0],yaw:20,pitch:25}).barrel,p=new THREE.Vector3(0,0,10).applyMatrix4(matrix);
 const result=createCoverageEngine(f).evaluate(p.toArray());assert.equal(result.clear,1);assert.equal(new Set(result.unresolved).size,result.unresolved.length);
});

test('selection and groups filter a finished result without changing analyzed counts',()=>{
 const base={turrets:[{id:'a',colorIndex:0},{id:'b',colorIndex:1}],cells:[{weight:1},{weight:1}],samples:[sample([{id:'a',clear:true},{id:'b',clear:false}]),sample([{id:'b',clear:true}],['a'])]};
 const only=filterResult(base,['b']);
 assert.deepEqual(only.samples.map(s=>[s.potential,s.clear,s.obstructed,s.classification]),[[1,0,1,'structurally-obstructed'],[1,1,0,'covered']]);
 assert.deepEqual(only.turrets.map(t=>t.colorIndex),[1],'colors stay attached to the turret');
 assert.equal(filterResult(base,['b']),only,'cached per result and filter');
 assert.equal(filterResult(base,null),base);
 assert.equal(filterResult(base,[]).samples[0].potential,0);
 assert.equal(analysisKey({...COVERAGE_DEFAULTS,selection:'all'}),analysisKey({...COVERAGE_DEFAULTS,selection:'group',group:'x'}),'filters never re-run the analysis');
});

test('closed-form aiming matches the full pose for offset pivots, muzzles and flipped axes',()=>{
 let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(const [yawAxis,pitchAxis,native] of [[[0,1,0],[1,0,0],true],[[0,-1,0],[1,0,0],true],[[0,1,0],[-1,0,0],false],[[0,-1,0],[-1,0,0],false]]){
  const f=fixture(),m=f.mounts[0],a=m.asset;a.yaw.axis=yawAxis;a.pitch.axis=pitchAxis;if(!native){delete a.native;a.muzzles=[];a.blocks=[makeBlock({id:'barrel',position:{x:.3,y:1.1,z:-1},size:{x:.2,y:.2,z:1}})];a.parts={barrel:'barrel'};}
  a.yaw.position=[.2,.4,-.1];a.pitch.position=[.3,1.1,.2];if(native)a.muzzlePositions=[[.5,1.3,2.5]];f.sockets[0].rotation=[15,30,-20];f.sockets[0].position=[3,-1,2];m.turretSize=1.5;
  const e=createCoverageEngine(f),t=e.turrets[0];assert.equal(t.standard,true);
  for(let i=0;i<30;i++){
   const yaw=random()*340-170,pitch=random()*95-10,matrix=partMatrices(a,f.sockets[0],{...m,yaw,pitch}).barrel,muzzle=t.muzzles.points[0];
   const origin=muzzle.clone().applyMatrix4(matrix),direction=new THREE.Vector3(0,0,native?1:-1).transformDirection(matrix),target=origin.clone().addScaledVector(direction,4+random()*20);
   const r=e.evaluate(target.toArray());assert.equal(r.potential,1,`reachable pose ${yaw.toFixed(1)}/${pitch.toFixed(1)} is found`);
   const path=r.contributors[0].paths[0];assert.ok(new THREE.Vector3(...path.origin).distanceTo(origin)<1e-6);
   const solved=partMatrices(a,f.sockets[0],{...m,yaw:path.yaw,pitch:path.pitch}).barrel,aim=new THREE.Vector3(0,0,native?1:-1).transformDirection(solved);
   assert.ok(aim.angleTo(target.clone().sub(new THREE.Vector3(...path.origin)))<1e-4);
  }
 }
});

test('azimuth arcs are stored as center and half-width and may cross ±180°',()=>{
 const f=fixture();f.mounts[0].coverage={yawCenter:180,yawHalf:20};const e=createCoverageEngine(f);
 assert.equal(e.evaluate([0,0,-10]).clear,1,'directly behind');
 for(const yaw of [165,-165]){const a=yaw*Math.PI/180;assert.equal(e.evaluate([10*Math.sin(a),0,10*Math.cos(a)]).clear,1,`yaw ${yaw}`);}
 assert.equal(e.evaluate([0,0,10]).potential,0,'front is outside the rear arc');
 assert.equal(e.evaluate([10,0,0]).potential,0,'90° is outside the rear arc');
 const legacy=aimingConstraints({...f.mounts[0],coverage:{yawMin:-20,yawMax:60}});assert.deepEqual([legacy.yawCenter,legacy.yawHalf,legacy.yawMin,legacy.yawMax],[20,40,-20,60]);
 assert.deepEqual([aimingConstraints({...f.mounts[0],coverage:{}}).yawHalf],[180]);
});

test('mount edits rebuild only the changed turret; aiming edits rebuild nothing',()=>{
 const f=fixture([[-5,0,0],[0,0,0],[5,0,0]]);f.shipKey=1;f.blocks=[makeBlock({position:{x:0,y:-2,z:0}})];
 const a=createCoverageEngine(f);assert.equal(a.rebuilt,3);
 f.mounts[1]={...f.mounts[1],twist:45};const b=createCoverageEngine(f,a);assert.equal(b.rebuilt,1);assert.equal(b.ship,a.ship);
 assert.equal(b.prepared.get('m0').posed,a.prepared.get('m0').posed);assert.notEqual(b.prepared.get('m1').posed,a.prepared.get('m1').posed);
 f.mounts[2]={...f.mounts[2],coverage:{yawCenter:90,yawHalf:10}};const c=createCoverageEngine(f,b);assert.equal(c.rebuilt,0);
 assert.equal(c.prepared.get('m2').local,b.prepared.get('m2').local);
 assert.equal(c.evaluate([15,0,0]).clear,3,'m2 covers +X within its arc; m0 and m1 are unrestricted');
});

test('breadth-first refinement spreads a limited budget across inner and outer rings',async()=>{
 const options={...COVERAGE_DEFAULTS,extent:10,quality:'low'},sampling=sampleTargets(options,[0,0,0],1);
 // A boundary that crosses every ring: x > 0.2·z + 0.37.
 const evaluate=p=>sample([{id:'a',clear:p[0]>.2*p[2]+.37}]).valueOf();
 const inner=c=>Math.hypot(c.point[0],c.point[2])<5;
 const full=await refineSlice(sampling,p=>({...evaluate(p),point:p}),{depth:3});
 const limited=await refineSlice(sampling,p=>({...evaluate(p),point:p}),{depth:3,budget:full.refinement.evaluations*.6});
 assert.ok(limited.refinement.limited);
 const fine=r=>r.cells.filter(c=>c.weight<sampling.step*sampling.step*.05);
 const counts=fine(limited).reduce((n,c)=>(n[inner(c)?0:1]++,n),[0,0]);
 assert.ok(counts[0]>0&&counts[1]>0,`both halves refined: ${counts}`);
 const before=fine(full).reduce((n,c)=>(n[inner(c)?0:1]++,n),[0,0]);
 assert.ok(counts[1]/before[1]>.25,'outer rings are not starved');
 assert.ok(limited.cells.every(c=>c.weight>0));
});

test('statistics weight sphere cells by solid angle and report per-direction coverage',()=>{
 const r=sampleTargets({...COVERAGE_DEFAULTS,mode:'sphere',quality:'medium'},[0,0,0],5);
 const total=r.cells.reduce((n,c)=>n+c.weight,0);assert.ok(Math.abs(total-4*Math.PI)<1e-6,`solid angle ${total}`);
 r.turrets=[{id:'a',name:'Forward'}];r.samples=r.cells.map(c=>({...sample(c.point[2]>0?[{id:'a',clear:true}]:[]),point:c.point}));r.quality='medium';
 const stats=coverageStats(r),region=name=>stats.regions.find(x=>x.name.startsWith(name));
 assert.ok(Math.abs(stats.total.covered-.5)<.03,`total ${stats.total.covered}`);
 assert.equal(region('Front').covered,1);assert.equal(region('Rear').covered,0);assert.ok(Math.abs(region('Top').covered-.5)<.05);
 assert.equal(region('Rear').blind,1);
 const slice=sampleTargets({...COVERAGE_DEFAULTS,plane:'top',quality:'low',extent:10},[0,0,0],1);slice.samples=slice.cells.map(c=>({...sample([]),point:c.point}));
 assert.deepEqual(coverageStats(slice).regions.map(x=>x.name),['Front (+Z)','Rear (−Z)','Right (+X)','Left (−X)'],'slice regions stay in the slice plane');
});

test('baselines compare identical spherical targets cell by cell; exports carry every sample',()=>{
 const r=sampleTargets({...COVERAGE_DEFAULTS,mode:'sphere',quality:'low'},[1,2,3],4);r.quality='low';r.turrets=[{id:'a',name:'Dorsal, "A"'}];
 r.samples=r.cells.map(c=>({...sample([{id:'a',clear:c.point[1]>2}]),point:c.point}));
 const baseline=JSON.parse(JSON.stringify(makeBaseline(r,'Before')));assert.ok(baselineCompatible(baseline,r));
 const next={...r,samples:r.cells.map(c=>({...sample([{id:'a',clear:true}]),point:c.point}))},delta=differences(baseline,next);
 assert.ok(delta.every((d,i)=>d===(r.cells[i].point[1]>2?0:1)));
 assert.equal(baselineCompatible(baseline,{...next,radius:5}),false);
 const csv=exportCoverage(r,'csv').trim().split('\n');assert.equal(csv.length,r.samples.length+1);assert.match(csv[0],/^x,y,z,dir_x/);assert.ok(csv.some(l=>l.includes('"Dorsal, ""A"""')));
 const json=JSON.parse(exportCoverage(r,'json'));assert.equal(json.samples.length,80);assert.equal(json.format,'avorion-weapon-coverage');assert.ok(Math.abs(json.samples.reduce((n,s)=>n+s.weight,0)-4*Math.PI)<1e-6);
});

test('coverage display settings and baseline persist with the ship session',()=>{
 const scene={model:makeModel([makeBlock()]),loaded:true,preview:false,showFireCoverage:true,fireDirection:'left',weaponCoverage:{mode:'sphere',metric:'potential',quality:'high'},coverageBaseline:{label:'Before',key:'k',stats:null,samples:[]}};
 const restored=restoreModel(structuredClone(snapshotModel(scene)));
 assert.deepEqual(restored.weaponCoverage,scene.weaponCoverage);assert.equal(restored.showFireCoverage,true);assert.equal(restored.fireDirection,'left');assert.equal(restored.coverageBaseline.label,'Before');
 const plain=restoreModel(structuredClone(snapshotModel({model:makeModel([makeBlock()]),loaded:true})));assert.equal('weaponCoverage' in plain,false);
});

test('flattened GPU hull layout reproduces the CPU bounded ray hits',()=>{
 const blocks=[];for(let i=0;i<60;i++)blocks.push(makeBlock({id:'h'+i,position:{x:(i%6)*3-7,y:Math.floor(i/6)%3*2.5-2,z:Math.floor(i/18)*4-6},size:{x:2,y:1.5,z:3},typeIndex:i%3?2:4}));
 const tree=obstacleTree(blocks),flat=flattenTree(tree);
 // Reference traversal of the exact texture layout the shader reads.
 function cast(o,d,limit,eps){
  const s=flat.shift,origin=[o.x-s[0],o.y-s[1],o.z-s[2]],dir=[d.x,d.y,d.z],inv=dir.map(n=>1/(Math.abs(n)<1e-12?1e-12:n));
  let nearest=limit,hit=null;const stack=[0],node=i=>flat.nodes.slice(i*8,i*8+8),tri=i=>flat.tris.slice(i*12,i*12+12);
  while(stack.length){
   const n=node(stack.pop());let enter=0,exit=Infinity;
   for(let k=0;k<3;k++){const a=(n[k]-origin[k])*inv[k],b=(n[4+k]-origin[k])*inv[k];enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
   if(enter>exit||enter>nearest)continue;
   if(n[3]>=0){stack.push(n[7],n[3]);continue;}
   for(let k=0;k<n[7];k++){const t=tri(-n[3]-1+k),v0=new THREE.Vector3(t[0],t[1],t[2]),e1=new THREE.Vector3(t[4],t[5],t[6]),e2=new THREE.Vector3(t[8],t[9],t[10]),D=new THREE.Vector3(...dir),O=new THREE.Vector3(...origin);
    const p=D.clone().cross(e2),det=e1.dot(p);if(det===0)continue;const f=1/det,sv=O.clone().sub(v0),u=sv.dot(p)*f;if(u<0||u>1)continue;const q=sv.clone().cross(e1),v=D.dot(q)*f;if(v<0||u+v>1)continue;const dist=e2.dot(q)*f;
    if(dist>eps&&dist<nearest-eps){nearest=dist;hit={blockId:flat.ids[t[3]],distance:dist};}}
  }
  return hit;
 }
 let seed=3,agree=0;const random=()=>(seed=(seed*48271)%2147483647)/2147483647;
 for(let i=0;i<400;i++){
  const o=new THREE.Vector3(random()*40-20,random()*20-10,random()*40-20),aim=blocks[Math.floor(random()*blocks.length)].position,d=new THREE.Vector3(aim.x+random()*3-1.5,aim.y+random()*3-1.5,aim.z+random()*3-1.5).sub(o).normalize(),limit=5+random()*40;
  const a=rayHit(tree,o,d,limit,1e-6),b=cast(o,d,limit,1e-6);
  assert.equal(!!a,!!b,`ray ${i} hit agreement`);if(a){assert.equal(a.blockId,b.blockId);assert.ok(Math.abs(a.distance-b.distance)<1e-4);agree++;}
 }
 assert.ok(agree>40,'test rays exercise real hits');assert.equal(flattenTree(null).nodeCount,0);
});
