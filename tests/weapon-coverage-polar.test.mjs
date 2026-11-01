import test from 'node:test';
import assert from 'node:assert/strict';
import {polarSampling,polarSlice,polarSummary,circularRuns,signature,ARC_TOLERANCE,PROBE_LIMIT} from '../src/turrets/coverage-polar.js';
import {classifySample,filterResult,COVERAGE_DEFAULTS} from '../src/turrets/coverage-sampling.js';
import {coverageStats,exportCoverage} from '../src/turrets/coverage-stats.js';
import {polarSurface} from '../src/turrets/coverage-surface.js';

// Synthetic top-plane world: bearing is measured from +X toward +Z.
// Turret a fires 30°..120° (blocked 120°..150°) and cannot reach closer than 4.
// Turret b fires 100°..200° at any distance. The hull fills radius 1.
const deg=Math.PI/180,within=(a,lo,hi)=>a>=lo*deg&&a<=hi*deg;
function world(){
 let calls=0;
 const evaluate=point=>{
  calls++;const angle=((Math.atan2(point[2],point[0])%(2*Math.PI))+2*Math.PI)%(2*Math.PI),r=Math.hypot(point[0],point[2]);
  const s={point,valid:r>=1,contributors:[],unresolved:[]};
  if(s.valid){
   if(within(angle,30,120)&&r>4)s.contributors.push({id:'a',name:'A',clear:true,paths:[]});
   else if(within(angle,120,150)&&r>4)s.contributors.push({id:'a',name:'A',clear:false,paths:[]});
   if(within(angle,100,200))s.contributors.push({id:'b',name:'B',clear:true,paths:[]});
  }
  s.potential=s.contributors.length;s.clear=s.contributors.filter(t=>t.clear).length;s.obstructed=s.potential-s.clear;s.classification=classifySample(s);return s;
 };
 return {evaluate,calls:()=>calls};
}
const turrets=[{id:'a',name:'A',colorIndex:0},{id:'b',name:'B',colorIndex:1}];
async function run(quality='medium',extra={}){
 const w=world(),sampling=polarSampling({...COVERAGE_DEFAULTS,plane:'top',extent:10},[0,0,0],1),partial=[];
 const result=await polarSlice(sampling,{quality,evaluate:w.evaluate,onArcs:async r=>partial.push(r),...extra});
 return {result:{...result,turrets},partial,calls:w.calls()};
}

test('arcs at infinity find each turret edge to within the angular tolerance',async()=>{
 const {result,partial}=await run();const s=polarSummary(result),tol=ARC_TOLERANCE/deg;
 const a=s.turrets.find(t=>t.id==='a'),b=s.turrets.find(t=>t.id==='b');
 assert.ok(Math.abs(a.clear-90)<=tol,`a clear ${a.clear}`);assert.ok(Math.abs(a.obstructed-30)<=tol,`a blocked ${a.obstructed}`);
 assert.ok(Math.abs(b.clear-100)<=tol,`b clear ${b.clear}`);
 assert.ok(Math.abs(s.covered*360-170)<=2*tol);assert.ok(Math.abs(s.overlap*360-20)<=2*tol);
 assert.ok(Math.abs(s.longestBlind.degrees-190)<=2*tol,'blind arc wraps through 0°');assert.ok(Math.abs(s.longestBlind.center-295)<=tol);
 assert.equal(partial.length,1,'arcs are reported before the field');assert.ok(partial[0].cells.every(c=>c.kind==='arc'));
 assert.ok(result.cells.every(c=>c.kind!=='arc'||Math.floor(c.from/(Math.PI/2)+1e-9)===Math.floor((c.to-1e-9)/(Math.PI/2))),'arc pieces never cross a quadrant edge');
});

test('dead-zone field resolves the minimum engagement distance per bearing',async()=>{
 const {result}=await run();const s=polarSummary(result),r=result.extent*.01;
 const at=angle=>result.cells.map((c,i)=>[c,result.samples[i]]).filter(([c])=>c.kind==='field'&&c.from<=angle*deg&&c.to>=angle*deg);
 const edge=at(60).find(([,x])=>x.clear)[0].r0;assert.ok(Math.abs(edge-4)<=r,`a engages from ${edge}`);
 assert.ok(at(150).some(([,x])=>x.clear)&&at(150).find(([,x])=>x.clear)[0].r0<=1+r,'b engages right outside the hull');
 assert.ok(at(300).every(([c,x])=>!x.valid||!x.clear),'uncovered bearing is dead out to the extent');
 assert.ok(s.deadZone.max>=result.extent*(1-1e-9)&&s.deadZone.open>.4&&s.deadZone.open<.6);
});

test('work scales with edges, the safety cap is reported, and statistics are angular',async()=>{
 const {result,calls}=await run();
 assert.ok(calls<20000,`medium used ${calls} evaluations`);assert.equal(result.polar.limited,false);assert.equal(result.polar.evaluations,calls);
 const stats=coverageStats(result);assert.ok(Math.abs(stats.total.covered-170/360)<.002,'field cells carry no statistical weight');
 const only=filterResult(result,['b']);assert.ok(Math.abs(polarSummary(only).covered*360-100)<=2*ARC_TOLERANCE/deg,'filters stay exact because intervals split on per-turret signatures');
 const capped=await run('high',{evaluate:(()=>{const w=world();let n=0;return p=>{n++;return w.evaluate(p);};})()});assert.ok(capped.result.polar.evaluations<=PROBE_LIMIT);
});

test('circular runs merge across 0° and keep a single full-circle run',()=>{
 const p=(angle,id)=>({angle,signature:id,sample:{}});
 assert.deepEqual(circularRuns([p(0,'x'),p(1,'x'),p(2,'x')]).map(r=>[r.from,r.to]),[[0,2*Math.PI]]);
 const runs=circularRuns([p(.1,'x'),p(1,'y'),p(6,'x')]);assert.equal(runs.length,2);
 const x=runs.find(r=>r.probe.signature==='x');assert.ok(Math.abs(x.from-3.5)<1e-9&&Math.abs(x.to-2*Math.PI-.55)<1e-9,'x wraps through 0°');
 assert.equal(signature({valid:true,unresolved:[],contributors:[{id:'b',clear:true},{id:'a',clear:false}]}),signature({valid:true,unresolved:[],contributors:[{id:'a',clear:false},{id:'b',clear:true}]}));
});

test('fixed-weapon boresight seeds find a cone narrower than the coarse step',async()=>{
 // A 0.5° half-angle cone at 77.3°: Low samples every 2°, so only a seed hits it.
 const center=77.3*deg,evaluate=point=>{const angle=Math.atan2(point[2],point[0]),hit=Math.abs(angle-center)<=.5*deg;const s={point,valid:true,unresolved:[],contributors:hit?[{id:'f',clear:true,paths:[]}]:[]};s.potential=s.clear=s.contributors.length;s.obstructed=0;s.classification=classifySample(s);return s;};
 const sampling=polarSampling({...COVERAGE_DEFAULTS,plane:'top',extent:10},[0,0,0],1),fixed=[{id:'f',name:'F'}];
 const unseeded=await polarSlice(sampling,{quality:'low',evaluate});assert.equal(polarSummary({...unseeded,turrets:fixed}).covered,0,'coarse bearings miss the cone');
 const seeded=await polarSlice(sampling,{quality:'low',evaluate,seeds:[[Math.cos(center),.01,Math.sin(center)],[0,1,0]]});
 assert.ok(Math.abs(polarSummary({...seeded,turrets:fixed}).turrets[0].clear-1)<=2*ARC_TOLERANCE/deg,'both cone edges are bisected; the vertical seed is ignored');
});

test('polar display and export keep every cell mapped to its analyzed sample',async()=>{
 const {result}=await run('low'),surface=polarSurface(result,{...COVERAGE_DEFAULTS,metric:'clear'},5,()=>'#ff0000');
 assert.equal(surface.positions.length/9,surface.sampleMap.length);assert.equal(surface.colors.length,surface.positions.length);
 assert.ok(surface.sampleMap.every(i=>result.samples[i].valid),'the hull is left open');
 assert.ok(surface.edges.length>0&&surface.edgeColors.length===surface.edges.length,'dead-zone contours are drawn');
 const csv=exportCoverage(result,'csv').trim().split('\n');assert.match(csv[0],/,kind,bearing_from_deg,bearing_to_deg,r0,r1$/);assert.equal(csv.length,result.samples.length+1);
 const json=JSON.parse(exportCoverage(result,'json'));assert.ok(json.polar.summary.turrets.length===2&&json.samples.some(r=>r.kind==='field'));
});
