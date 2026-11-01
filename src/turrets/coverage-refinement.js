import {polygonArea} from './coverage-sampling.js';
// Refine only changing coverage regions. Every probe uses the same aiming and
// obstruction evaluator as the original targets; no neighboring-value smoothing.
// Refinement is breadth-first: each level subdivides its most uncertain cells
// first, so an exhausted budget leaves error spread across the slice instead of
// concentrated in whichever rings happened to be visited last.
const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);
const compact=s=>({valid:s.valid,clear:s.clear,unresolved:s.unresolved,contributors:s.contributors.map(t=>({id:t.id,clear:t.clear}))});
const signature=s=>JSON.stringify([s.valid,[...s.unresolved].sort(),[...s.contributors].map(t=>[t.id,t.clear]).sort()]);
const radius=vertices=>{const c=vertices[0].map((_,i)=>vertices.reduce((n,v)=>n+v[i],0)/vertices.length);return Math.max(...vertices.map(v=>Math.hypot(...v.map((n,k)=>n-c[k]))));};
// New probes per subdivided triangle: four centers and twelve edge midpoints.
const CHILD_COST=16;
export async function refineSlice(sampling,evaluate,{depth=3,budget=60000,checkpoint=async()=>{},evaluateMany=null,footprintSensitive=false}={}){
 const cache=new Map(),edges=new Map(),cells=[],samples=[];let count=0,limited=false,last=0;
 const pointKey=p=>p.map((v,i)=>Math.round((v-sampling.center[i])/sampling.extent*1e10)).join(',');
 // Fixed-weapon cones widen to the probe footprint, so a cached value is only
 // reused at a comparable scale when such turrets are present.
 const key=(p,footprint)=>footprintSensitive?pointKey(p)+'@'+Math.round(Math.log2(Math.max(footprint,1e-9))):pointKey(p);
 const store=(p,footprint,sample)=>{const value={point:p,sample,field:compact(sample),signature:signature(sample)};cache.set(key(p,footprint),value);return value;};
 const tick=async()=>{if(count-last>=128){last=count;await checkpoint(count);}};
 async function probe(p,footprint){
  const k=key(p,footprint);if(cache.has(k))return cache.get(k);
  count++;const value=store(p,footprint,evaluate(p,footprint));await tick();return value;
 }
 // Batched probing lets a bulk evaluator (GPU hull rays) handle a whole level.
 async function probeAll(requests){
  const missing=[],seen=new Set();
  for(const [p,footprint] of requests){const k=key(p,footprint);if(!cache.has(k)&&!seen.has(k)){seen.add(k);missing.push([p,footprint]);}}
  if(evaluateMany&&missing.length){
   for(let i=0;i<missing.length;i+=512){const chunk=missing.slice(i,i+512),results=await evaluateMany(chunk.map(r=>r[0]),chunk.map(r=>r[1]));chunk.forEach(([p,f],j)=>store(p,f,results[j]));count+=chunk.length;await tick();}
  }else for(const [p,f] of missing)await probe(p,f);
  return requests.map(([p,f])=>cache.get(key(p,f)));
 }
 const trace=async(a,b,footprint,level=5)=>{
  const ka=pointKey(a.point),kb=pointKey(b.point),reverse=ka>kb,k=[ka,kb].sort().join('|');
  if(edges.has(k)){const points=edges.get(k);return reverse?[...points].reverse():points;}
  const split=async(x,y,n,f)=>{
   if(!n||x.signature===y.signature||count>=budget)return [x,y];
   const m=await probe(midpoint(x.point,y.point),f/2);
   return [...(await split(x,m,n-1,f/2)).slice(0,-1),...await split(m,y,n-1,f/2)];
  };
  const points=await split(a,b,level,footprint);edges.set(k,reverse?[...points].reverse():points);return points;
 };
 async function finalize(e){
  const edgeSamples=[];
  for(let j=0;j<3;j++)edgeSamples.push((await trace(e.values[j],e.values[(j+1)%3],e.footprint)).map(v=>({point:v.point,...v.field})));
  cells.push({point:e.center,vertices:e.vertices,weight:polygonArea(e.vertices),footprint:e.footprint,vertexSamples:e.values.map(v=>v.field),probeSamples:[e.middle,...e.midValues].map(v=>v.field),edgeSamples,outer:e.outer});samples.push(e.middle.sample);
 }
 let level=[];
 for(const cell of sampling.cells){
  // Two triangles cover each sector; only its outer-ring edge is a domain edge.
  const axis=sampling.plane==='front'?2:sampling.plane==='side'?0:1;
  const onRim=p=>Math.abs(Math.hypot(...p.map((v,i)=>v-sampling.center[i]-(i===axis?sampling.offset||0:0)))-sampling.extent)<sampling.extent*1e-8;
  const [a,b,c,d]=cell.vertices;
  level.push({vertices:[a,b,c],outer:[false,onRim(b)&&onRim(c),false]});
  if(pointKey(a)!==pointKey(d))level.push({vertices:[a,c,d],outer:[false,false,false]});
 }
 for(let L=0;level.length;L++){
  const shapes=level.map(tri=>{const [a,b,c]=tri.vertices,center=a.map((_,i)=>(a[i]+b[i]+c[i])/3);return {...tri,center,mids:tri.vertices.map((p,i)=>midpoint(p,tri.vertices[(i+1)%3])),footprint:radius(tri.vertices)};});
  const values=await probeAll(shapes.flatMap(s=>[...s.vertices,s.center,...s.mids].map(p=>[p,s.footprint])));
  const evaluated=shapes.map((s,i)=>{
   const v=values.slice(i*7,i*7+7),middle=v[3],corner=v.slice(0,3),mids=v.slice(4,7);
   const score=[...corner,...mids].filter(x=>x.signature!==middle.signature).length;
   return {...s,values:corner,middle,midValues:mids,score};
  });
  const candidates=L<depth?evaluated.filter(e=>e.score).sort((a,b)=>b.score-a.score):[],next=[],split=new Set();
  let allowance=budget-count;
  for(const e of candidates){
   if(allowance<CHILD_COST){limited=true;break;}
   allowance-=CHILD_COST;split.add(e);const [a,b,c]=e.vertices,[ab,bc,ca]=e.mids,o=e.outer;
   next.push({vertices:[a,ab,ca],outer:[o[0],false,o[2]]},{vertices:[ab,b,bc],outer:[o[0],o[1],false]},{vertices:[ca,bc,c],outer:[false,o[1],o[2]]},{vertices:[ab,bc,ca],outer:[false,false,false]});
  }
  for(const e of evaluated)if(!split.has(e))await finalize(e);
  level=next;
 }
 await checkpoint(count);
 return {...sampling,cells,samples,refinement:{evaluations:count,limited,depth,budget}};
}
