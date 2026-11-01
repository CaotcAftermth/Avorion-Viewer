// Directional slices as two 1D questions per bearing in the slice plane.
// Arcs: each turret aims at a target at infinity along the bearing, so only
// traversal limits and structure decide coverage (no parallax). Field: finite
// targets along each bearing, bisected in distance, show how close an enemy
// can get before nothing can hit it. Every edge is bisected to a fixed
// tolerance, so work scales with the number of edges rather than slice area.
// Every probe uses the shared engine evaluator; nothing is interpolated.
export const POLAR_QUALITY={low:{arcs:180,bearings:72,radii:8,depth:1},medium:{arcs:360,bearings:144,radii:12,depth:2},high:{arcs:720,bearings:288,radii:16,depth:3}};
export const ARC_TOLERANCE=.05*Math.PI/180,RADIAL_TOLERANCE=.01,FAR_DISTANCE=1e4;
// Safety cap for pathological ships with thousands of tiny gaps. Normal ships
// finish far below it; reaching it is reported, never silent.
export const PROBE_LIMIT=200000;
const TAU=2*Math.PI,QUADRANT=Math.PI/2;
export const planeAxes=plane=>plane==='front'?[0,1,2]:plane==='side'?[2,1,0]:[0,2,1];
const AXIS_NAMES=['X','Y','Z'];
export const bearingReference=axes=>`from +${AXIS_NAMES[axes[0]]} toward +${AXIS_NAMES[axes[1]]}`;
export function polarSampling(options,center,minimumRadius){
 const extent=Math.max(.1,Number(options.extent)||minimumRadius*1.5),offset=Number(options.offset)||0,axes=planeAxes(options.plane),origin=[...center];
 origin[axes[2]]+=offset;
 return {mode:'slice',polar:true,plane:options.plane,offset,center,origin,extent,axes};
}
export function bearingDirection(axes,angle){const d=[0,0,0];d[axes[0]]=Math.cos(angle);d[axes[1]]=Math.sin(angle);return d;}
export function polarPoint(sampling,angle,distance){const d=bearingDirection(sampling.axes,angle);return sampling.origin.map((n,i)=>n+d[i]*distance);}
// Arc probes sit far enough away that muzzle and pivot offsets are negligible.
export const farPoint=(sampling,angle)=>polarPoint(sampling,angle,sampling.extent*FAR_DISTANCE);
const normalize=a=>((a%TAU)+TAU)%TAU;
// Two probes agree when the same turrets are clear, blocked and unresolved, so
// display filters over any subset of turrets stay exact inside each interval.
export const signature=s=>JSON.stringify([s.valid,[...s.unresolved].sort(),s.contributors.map(t=>[t.id,t.clear]).sort()]);

function prober({evaluate,evaluateMany=null,checkpoint=async()=>{}}){
 const state={count:0,limited:false};let last=0;
 const tick=async()=>{if(state.count-last>=128){last=state.count;await checkpoint(state.count);}};
 state.run=async requests=>{
  const room=Math.max(0,PROBE_LIMIT-state.count);if(requests.length>room){state.limited=true;requests=requests.slice(0,room);}
  const out=[];
  if(evaluateMany)for(let i=0;i<requests.length;i+=512){const chunk=requests.slice(i,i+512);out.push(...await evaluateMany(chunk.map(r=>r.point),chunk.map(r=>r.footprint||0)));state.count+=chunk.length;await tick();}
  else for(const r of requests){out.push(evaluate(r.point,r.footprint||0));state.count++;await tick();}
  return out;
 };
 return state;
}
const probe=(sample,key)=>({...key,sample,signature:signature(sample)});

// Bisect a circular list of {angle} probes wherever neighbors disagree.
async function refineCircle(list,tolerance,evaluateAt,probes){
 for(;;){
  list.sort((a,b)=>a.angle-b.angle);const mids=[];
  for(let i=0;i<list.length;i++){const a=list[i],b=list[(i+1)%list.length],gap=i+1<list.length?b.angle-a.angle:b.angle+TAU-a.angle;if(a.signature!==b.signature&&gap>tolerance)mids.push(normalize(a.angle+gap/2));}
  if(!mids.length||probes.limited)return list;
  const samples=await probes.run(mids.map(evaluateAt));
  samples.forEach((s,i)=>list.push(probe(s,{angle:mids[i]})));
  if(samples.length<mids.length)return list.sort((a,b)=>a.angle-b.angle);
 }
}
// Runs of equal signature around the circle. Edges sit midway between the two
// disagreeing probes, within half the tolerance of the true transition.
export function circularRuns(list){
 const n=list.length;if(!n)return [];
 const start=list.findIndex((p,i)=>p.signature!==list[(i+n-1)%n].signature);
 if(start<0)return [{from:0,to:TAU,probe:list[0]}];
 const edge=i=>{const a=list[(i+n-1)%n],b=list[i];let mid=(a.angle+b.angle)/2;if(b.angle<a.angle)mid=normalize(mid+Math.PI);return mid;};
 const runs=[];
 for(let k=0;k<n;k++){const i=(start+k)%n;if(k===0||list[i].signature!==list[(i+n-1)%n].signature)runs.push({from:edge(i),probe:list[i]});}
 for(let i=0;i<runs.length;i++){const next=runs[(i+1)%runs.length].from;runs[i].to=next>runs[i].from?next:next+TAU;}
 return runs;
}
// Pieces never straddle a quadrant edge, so per-direction statistics are exact.
function splitQuadrants(run){
 const pieces=[];let a=run.from;
 while(a<run.to-1e-12){const edge=Math.min(run.to,(Math.floor(a/QUADRANT+1e-12)+1)*QUADRANT);if(edge-a>1e-12)pieces.push([a,edge]);a=edge;}
 return pieces;
}

async function arcs(sampling,quality,seeds,probes){
 const n=POLAR_QUALITY[quality].arcs,angles=[...Array(n)].map((_,i)=>i*TAU/n);
 // Fixed weapons cover a cone narrower than the coarse step; seeding their
 // boresight bearing guarantees bisection finds both of its edges.
 // Seeds are boresight directions; only those within the widest spread (45°)
 // of the plane can reach it.
 for(const d of seeds){
  const x=d[sampling.axes[0]],y=d[sampling.axes[1]];if(Math.hypot(x,y)<Math.SQRT1_2)continue;
  const a=normalize(Math.atan2(y,x));if(!angles.some(b=>Math.abs(normalize(b-a+Math.PI)-Math.PI)<ARC_TOLERANCE/4))angles.push(a);
 }
 const at=angle=>({point:farPoint(sampling,angle),footprint:0});
 let list=(await probes.run(angles.map(at))).map((s,i)=>probe(s,{angle:angles[i]}));
 list=await refineCircle(list,ARC_TOLERANCE,at,probes);
 const cells=[],samples=[];
 for(const run of circularRuns(list))for(let [from,to] of splitQuadrants(run)){
  // 360° is a quadrant edge, so a piece past it lies wholly past it.
  if(from>=TAU-1e-12){from-=TAU;to-=TAU;}
  const mid=(from+to)/2;
  cells.push({kind:'arc',from,to,point:farPoint(sampling,mid),weight:to-from,footprint:0});
  samples.push({...run.probe.sample,point:farPoint(sampling,mid),polar:{bearing:normalize(mid),infinite:true,reference:bearingReference(sampling.axes)}});
 }
 return {cells,samples,probes:list.length};
}

// Radial runs along one bearing. Coarse distances catch non-monotonic cases
// (a fin that blocks only a middle band); each change is then bisected.
async function profiles(sampling,quality,bearings,probes){
 const m=POLAR_QUALITY[quality].radii,extent=sampling.extent,tolerance=extent*RADIAL_TOLERANCE;
 const at=(angle,r)=>({point:polarPoint(sampling,angle,r),footprint:0});
 const coarse=bearings.flatMap(angle=>[...Array(m)].map((_,j)=>({angle,r:extent*(j+1)/m}))),lists=new Map(bearings.map(a=>[a,[]]));
 (await probes.run(coarse.map(p=>at(p.angle,p.r)))).forEach((s,i)=>lists.get(coarse[i].angle).push(probe(s,{r:coarse[i].r})));
 // Breadth-first over every bearing so one batch serves a whole level.
 for(;;){
  const mids=[];
  for(const [angle,list] of lists){list.sort((a,b)=>a.r-b.r);for(let i=0;i+1<list.length;i++)if(list[i].signature!==list[i+1].signature&&list[i+1].r-list[i].r>tolerance)mids.push({angle,r:(list[i].r+list[i+1].r)/2});}
  if(!mids.length||probes.limited)break;
  const samples=await probes.run(mids.map(p=>at(p.angle,p.r)));
  samples.forEach((s,i)=>lists.get(mids[i].angle).push(probe(s,{r:mids[i].r})));
  if(samples.length<mids.length)break;
 }
 const out=new Map();
 for(const [angle,list] of lists){
  list.sort((a,b)=>a.r-b.r);const runs=[];
  list.forEach((p,i)=>{if(!i||p.signature!==list[i-1].signature)runs.push({r0:i?(list[i-1].r+p.r)/2:0,probe:p});});
  runs.forEach((run,i)=>{run.r1=i+1<runs.length?runs[i+1].r0:extent;});
  out.set(angle,runs);
 }
 return out;
}
const profileKey=runs=>runs.map(r=>r.probe.signature).join('|');
// Neighboring bearings disagree when their runs differ in kind or an edge moved
// by more than a few radial tolerances.
function profilesDiffer(a,b,extent){
 if(a.length!==b.length||profileKey(a)!==profileKey(b))return true;
 return a.some((r,i)=>Math.abs(r.r0-b[i].r0)>extent*RADIAL_TOLERANCE*4);
}

async function field(sampling,quality,probes){
 const q=POLAR_QUALITY[quality],all=new Map();let bearings=[...Array(q.bearings)].map((_,i)=>i*TAU/q.bearings);
 for(let level=0;bearings.length;level++){
  for(const [a,runs] of await profiles(sampling,quality,bearings,probes))all.set(a,runs);
  if(level>=q.depth||probes.limited)break;
  // Insert bearings only between neighbors whose profiles disagree.
  const sorted=[...all.keys()].sort((a,b)=>a-b),next=[];
  for(let i=0;i<sorted.length;i++){const a=sorted[i],b=sorted[(i+1)%sorted.length],gap=i+1<sorted.length?b-a:b+TAU-a;if(gap>ARC_TOLERANCE*2&&profilesDiffer(all.get(a),all.get(b),sampling.extent))next.push(normalize(a+gap/2));}
  bearings=next;
 }
 // Each bearing owns the wedge halfway to its neighbors.
 const sorted=[...all.keys()].sort((a,b)=>a-b),cells=[],samples=[];
 sorted.forEach((a,i)=>{
  const prev=sorted[(i+sorted.length-1)%sorted.length],next=sorted[(i+1)%sorted.length];
  const from=a-(i?a-prev:a+TAU-prev)/2,to=a+(i+1<sorted.length?next-a:next+TAU-a)/2;
  for(const run of all.get(a)){
   const r=(run.r0+run.r1)/2;
   cells.push({kind:'field',bearingIndex:i,from,to,r0:run.r0,r1:run.r1,point:polarPoint(sampling,a,r),weight:0,footprint:0});
   samples.push({...run.probe.sample,polar:{bearing:a,distance:run.probe.r,r0:run.r0,r1:run.r1,reference:bearingReference(sampling.axes)}});
  }
 });
 return {cells,samples,bearings:sorted.length};
}

// Arcs finish first and are reported through onArcs, so the slice is useful
// before the dead-zone field has streamed in.
export async function polarSlice(sampling,{quality='medium',seeds=[],evaluate,evaluateMany=null,checkpoint,onArcs=async()=>{}}={}){
 const probes=prober({evaluate,evaluateMany,checkpoint});
 const arc=await arcs(sampling,quality,seeds,probes);
 const summary=()=>({evaluations:probes.count,limited:probes.limited,arcProbes:arc.probes,arcTolerance:ARC_TOLERANCE,radialTolerance:sampling.extent*RADIAL_TOLERANCE,reference:bearingReference(sampling.axes)});
 await onArcs({...sampling,cells:arc.cells,samples:arc.samples,polar:{...summary(),fieldBearings:0,partial:true}});
 const near=await field(sampling,quality,probes);
 return {...sampling,cells:[...arc.cells,...near.cells],samples:[...arc.samples,...near.samples],polar:{...summary(),fieldBearings:near.bearings,partial:false}};
}

// Angular summaries for a (possibly filtered) polar result.
const degrees=a=>a*180/Math.PI;
export function polarSummary(result){
 if(!result?.polar)return null;
 const arcIndex=[],fieldIndex=[];result.cells.forEach((c,i)=>(c.kind==='arc'?arcIndex:fieldIndex).push(i));
 const width=i=>result.cells[i].to-result.cells[i].from;
 // Longest run of uncovered bearings, merged around the circle.
 const blind=arcIndex.filter(i=>result.samples[i].valid&&!result.samples[i].clear).map(i=>[result.cells[i].from,result.cells[i].to]).sort((a,b)=>a[0]-b[0]),merged=[];
 for(const [a,b] of blind){const last=merged.at(-1);if(last&&a<=last[1]+1e-9)last[1]=Math.max(last[1],b);else merged.push([a,b]);}
 if(merged.length>1&&merged[0][0]<=1e-9&&merged.at(-1)[1]>=TAU-1e-9){const head=merged.shift();merged.at(-1)[1]=head[1]+TAU;}
 const longest=merged.reduce((best,r)=>r[1]-r[0]>(best?best[1]-best[0]:0)?r:best,null);
 const turrets=result.turrets.map(t=>({id:t.id,name:t.name,clear:0,obstructed:0}));
 for(const i of arcIndex)for(const c of result.samples[i].contributors){const t=turrets.find(x=>x.id===c.id);if(t)t[c.clear?'clear':'obstructed']+=width(i);}
 // Dead-zone depth: the farthest uncovered distance on each field bearing.
 const bearings=new Map();
 for(const i of fieldIndex){const c=result.cells[i],s=result.samples[i],b=bearings.get(c.bearingIndex)||{width:c.to-c.from,depth:0,angle:s.polar.bearing,open:false};if(s.valid&&!s.clear){b.depth=Math.max(b.depth,c.r1);if(c.r1>=result.extent*(1-1e-9))b.open=true;}bearings.set(c.bearingIndex,b);}
 const list=[...bearings.values()],total=list.reduce((n,b)=>n+b.width,0)||1,deepest=list.reduce((best,b)=>!best||b.depth>best.depth?b:best,null);
 return {
  covered:arcIndex.reduce((n,i)=>n+(result.samples[i].clear?width(i):0),0)/TAU,
  overlap:arcIndex.reduce((n,i)=>n+(result.samples[i].clear>=2?width(i):0),0)/TAU,
  longestBlind:longest?{degrees:degrees(longest[1]-longest[0]),center:degrees(normalize((longest[0]+longest[1])/2))}:null,
  turrets:turrets.map(t=>({...t,clear:degrees(t.clear),obstructed:degrees(t.obstructed)})),
  deadZone:list.length?{mean:list.reduce((n,b)=>n+b.depth*b.width,0)/total,max:deepest.depth,maxBearing:degrees(deepest.angle),open:list.reduce((n,b)=>n+(b.open?b.width:0),0)/total}:null,
  reference:result.polar.reference,extent:result.extent
 };
}
export function describePolar(summary){
 if(!summary)return [];
 const pct=x=>`${Math.round(x*100)}%`,deg=x=>`${x.toFixed(1)}°`,lines=[`Arcs at infinity: ${pct(summary.covered)} of 360° covered · ${pct(summary.overlap)} by 2+ turrets`];
 lines.push(summary.longestBlind?`Longest blind arc: ${deg(summary.longestBlind.degrees)} centered on bearing ${deg(summary.longestBlind.center)}`:'No blind bearings at infinity');
 for(const t of summary.turrets)lines.push(`${t.name}: ${deg(t.clear)} clear${t.obstructed>.05?` · ${deg(t.obstructed)} in arc but blocked`:''}`);
 if(summary.deadZone)lines.push(`Dead zone (no clear turret): mean depth ${summary.deadZone.mean.toFixed(2)}, max ${summary.deadZone.max.toFixed(2)} at bearing ${deg(summary.deadZone.maxBearing)}${summary.deadZone.open>0?` · ${pct(summary.deadZone.open)} of bearings uncovered out to the slice extent`:''}`);
 lines.push(`Bearings measured ${summary.reference}. Distances in ship units; slice extent ${summary.extent.toFixed(2)}.`);
 return lines;
}
