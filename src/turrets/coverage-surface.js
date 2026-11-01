import * as THREE from '../vendor/three.module.js';
import {heatColor,CLASS_COLORS} from './coverage-sampling.js';
import {polarPoint} from './coverage-polar.js';

// Share values at geodesic vertices, then tessellate only the display surface.
// Picking retains the original analyzed target; interpolation never changes counts.
export function globeSurface(result,metric,limit,{overlapOnly=false,showObstructions=true}={}){
 const positions=[],uv=[],sampleMap=[],shared=new Map(),center=new THREE.Vector3(...result.center);
 const key=p=>p.map((n,i)=>Math.round((n-result.center[i])/result.radius*1e7)).join(',');
 // Inside-geometry targets have no count; they must not darken their neighbors.
 for(let i=0;i<result.cells.length;i++)for(const p of result.cells[i].vertices){
  const k=key(p),v=shared.get(k)||{total:0,n:0},s=result.samples[i];if(s.valid){v.total+=s[metric]||0;v.n++;}shared.set(k,v);
 }
 const midpoint=(a,b)=>({p:a.p.clone().add(b.p).multiplyScalar(.5).sub(center).normalize().multiplyScalar(result.radius).add(center),value:(a.value+b.value)/2});
 function triangle(a,b,c,index,depth){
  if(depth){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca,index,depth-1);triangle(ab,b,bc,index,depth-1);triangle(ca,bc,c,index,depth-1);triangle(ab,bc,ca,index,depth-1);return;}
  const sample=result.samples[index],row=!sample.valid?5/6:!sample.clear&&sample.unresolved?.length ? .5 : 1/6;
  for(const v of [a,b,c]){positions.push(...v.p);uv.push(Math.max(0,Math.min(1,v.value/limit)),row);}sampleMap.push(index);
 }
 for(let i=0;i<result.cells.length;i++){
  const s=result.samples[i];if(overlapOnly&&s.clear<2||!showObstructions&&s.classification==='structurally-obstructed')continue;
  const vertices=result.cells[i].vertices.map(p=>{const v=shared.get(key(p));return {p:new THREE.Vector3(...p).sub(center).normalize().multiplyScalar(result.radius).add(center),value:v.n?v.total/v.n:0};});
  triangle(...vertices,i,2);
 }
 return {positions,uv,sampleMap};
}

// Boundary-only outlines: adjacent sectors belonging to the same turret do not
// expose the sampling lattice. Each contributor owns its complete sampled field.
export function fanSurface(result,options){
 if(result.refinement)return refinedFanSurface(result,options);
 const positions=[],turretIndices=[],sampleMap=[],edges=[],edgeTurrets=[];
 const fields=result.samples.map(s=>new Set(s.valid&&!(options.overlapOnly&&s.clear<2)?s.contributors.filter(t=>options.metric==='obstructed'?!t.clear:options.metric==='potential'||t.clear).map(t=>t.id):[]));
 const key=p=>p.map((n,i)=>Math.round((n-result.center[i])/result.extent*1e7)).join(','),nodes=new Map();
 for(let i=0;i<result.cells.length;i++)for(const p of result.cells[i].vertices){const k=key(p),node=nodes.get(k)||{n:0,fields:new Map()};node.n++;for(const id of fields[i])node.fields.set(id,(node.fields.get(id)||0)+1);nodes.set(k,node);}
 for(const [index,turret] of result.turrets.entries()){
  const boundary=new Map();
  const addEdge=(a,b)=>{const ka=key(a),kb=key(b);if(ka===kb)return;const k=[ka,kb].sort().join('|');if(boundary.has(k))boundary.delete(k);else boundary.set(k,[a,b]);};
  for(let i=0;i<result.cells.length;i++){
   const cell=result.cells[i],vertices=cell.vertices.map(p=>{const node=nodes.get(key(p));return {p,value:(node.fields.get(turret.id)||0)/node.n};});
   for(const tri of [[0,1,2],[0,2,3]]){
    const input=tri.map(v=>vertices[v]),polygon=[];
    for(let j=0;j<3;j++){
     const a=input[j],b=input[(j+1)%3],inside=a.value>=.5;
     if(inside)polygon.push(a.p);
     if(inside!==(b.value>=.5)){const f=(.5-a.value)/(b.value-a.value);polygon.push(a.p.map((v,k)=>v+(b.p[k]-v)*f));}
    }
    for(let j=1;j<polygon.length-1;j++){for(const p of [polygon[0],polygon[j],polygon[j+1]]){positions.push(...p);turretIndices.push(index);}sampleMap.push(i);}
    if(polygon.length>=3)for(let j=0;j<polygon.length;j++)addEdge(polygon[j],polygon[(j+1)%polygon.length]);
   }
  }
  for(const [a,b] of boundary.values()){edges.push(...a,...b);edgeTurrets.push(index,index);}
 }
 return {positions,turretIndices,sampleMap,edges,edgeTurrets};
}

// Actual sampled classifications replace averaged vertex votes. Transition
// locations use the last tested inside endpoint, not a smoothed midpoint.
function refinedFanSurface(result,options){
 const positions=[],turretIndices=[],sampleMap=[],edges=[],edgeTurrets=[];
 // Only this turret's own unresolved aiming hides its field; other turrets'
 // unresolved targets never blank it.
 const inside=(s,id)=>s.valid&&!s.unresolved?.includes(id)&&!(options.overlapOnly&&s.clear<2)&&s.contributors.some(t=>t.id===id&&(options.metric==='potential'||(options.metric==='obstructed'?!t.clear:t.clear)));
 const edge=(a,b,index)=>{edges.push(...a,...b);edgeTurrets.push(index,index);};
 for(const [index,t] of result.turrets.entries())for(const [i,cell] of result.cells.entries()){
  // At the refinement limit, do not bridge a detected hole merely because
  // all three corners are clear. Small unresolved features stay conservative.
  if(cell.vertexSamples.every(s=>inside(s,t.id))&&cell.probeSamples.some(s=>!inside(s,t.id)))continue;
  const polygon=[];
  for(let j=0;j<3;j++){
   const probes=cell.edgeSamples[j];
   for(let n=0;n<probes.length-1;n++){
    const a=probes[n],b=probes[n+1],ia=inside(a,t.id),ib=inside(b,t.id);
    if(ia)polygon.push({point:a.point,boundary:false});
    if(ia!==ib)polygon.push({point:ia?a.point:b.point,boundary:true});
    if(cell.outer[j]&&ia&&ib)edge(a.point,b.point,index);
   }
  }
  // Remove coincident points while retaining transition flags.
  const clean=[];for(const v of polygon){const last=clean.at(-1);if(last&&last.point.every((n,k)=>n===v.point[k]))last.boundary||=v.boundary;else clean.push(v);}
  if(clean.length>1&&clean[0].point.every((n,k)=>n===clean.at(-1).point[k])){clean[0].boundary||=clean.at(-1).boundary;clean.pop();}
  for(let j=1;j<clean.length-1;j++){for(const v of [clean[0],clean[j],clean[j+1]]){positions.push(...v.point);turretIndices.push(index);}sampleMap.push(i);}
  for(let j=0;j<clean.length;j++){const a=clean[j],b=clean[(j+1)%clean.length];if(a.boundary&&b.boundary)edge(a.point,b.point,index);}
 }
 return {positions,turretIndices,sampleMap,edges,edgeTurrets};
}

// Polar slice display, from the hull outwards: the dead-zone field, a count
// band for the arcs at infinity, then one ring per turret. Each layer encodes
// one quantity, so nothing depends on blended transparency.
export function polarSurface(result,options,limit,turretColor){
 const positions=[],colors=[],sampleMap=[],edges=[],edgeColors=[],color=new THREE.Color(),extent=result.extent;
 const fill=s=>options.metric==='blind'?CLASS_COLORS[s.classification]:s.classification==='unresolved'?CLASS_COLORS.unresolved:'#'+heatColor(s[options.metric]||0,limit,options.palette).getHexString();
 function sector(from,to,r0,r1,hex,index){
  const n=Math.max(1,Math.ceil((to-from)/(Math.PI/90)));color.set(hex);
  for(let k=0;k<n;k++){
   const a=from+(to-from)*k/n,b=from+(to-from)*(k+1)/n,q=[polarPoint(result,a,r0),polarPoint(result,a,r1),polarPoint(result,b,r1),polarPoint(result,b,r0)];
   for(const tri of [[0,1,2],[0,2,3]]){for(const v of tri){positions.push(...q[v]);colors.push(color.r,color.g,color.b);}sampleMap.push(index);}
  }
 }
 function line(points,hex){color.set(hex);for(let i=0;i+1<points.length;i++){edges.push(...points[i],...points[i+1]);edgeColors.push(color.r,color.g,color.b,color.r,color.g,color.b);}}
 const arc=(from,to,r,hex)=>{const n=Math.max(1,Math.ceil((to-from)/(Math.PI/180)));line([...Array(n+1)].map((_,k)=>polarPoint(result,from+(to-from)*k/n,r)),hex);};
 const shown=s=>s.valid&&!(options.overlapOnly&&s.clear<2)&&!(!options.showObstructions&&s.classification==='structurally-obstructed');
 // Field: radial runs per bearing wedge; the hull (inside geometry) is left open.
 const wedges=new Map();
 result.cells.forEach((c,i)=>{
  if(c.kind==='arc')return;const s=result.samples[i];
  if(!wedges.has(c.bearingIndex))wedges.set(c.bearingIndex,[]);wedges.get(c.bearingIndex).push(i);
  if(shown(s))sector(c.from,c.to,c.r0,c.r1,fill(s),i);
 });
 // Dead-zone contours: where the clear count crosses k between neighbors.
 const levels=options.metric==='blind'?[[1,'#ffffff']]:[[1,'#ffffff'],[2,'#8fa3b8']],keys=[...wedges.keys()].sort((a,b)=>a-b);
 for(const [k,hex] of levels){
  const differs=(a,b)=>a.valid&&b.valid&&(a.clear>=k)!==(b.clear>=k);
  for(const [n,list] of keys.map(key=>[key,wedges.get(key)])){
   for(let j=0;j+1<list.length;j++){const a=list[j],b=list[j+1];if(differs(result.samples[a],result.samples[b]))arc(result.cells[b].from,result.cells[b].to,result.cells[b].r0,hex);}
   const next=wedges.get(keys[(keys.indexOf(n)+1)%keys.length]);if(!next||next===list)continue;
   const angle=result.cells[list[0]].to;
   for(const a of list)for(const b of next){const ca=result.cells[a],cb=result.cells[b],r0=Math.max(ca.r0,cb.r0),r1=Math.min(ca.r1,cb.r1);if(r1>r0&&differs(result.samples[a],result.samples[b]))line([polarPoint(result,angle,r0),polarPoint(result,angle,r1)],hex);}
  }
 }
 // Count band and turret rings for the arcs at infinity.
 const band=[extent*1.02,extent*1.09],step=Math.min(extent*.055,extent*.6/Math.max(1,result.turrets.length));
 result.cells.forEach((c,i)=>{
  if(c.kind!=='arc')return;const s=result.samples[i];
  if(shown(s))sector(c.from,c.to,band[0],band[1],fill(s),i);
  result.turrets.forEach((t,j)=>{
   const r0=extent*1.12+step*j,r1=r0+step*.72,hit=s.contributors.find(x=>x.id===t.id);
   const hex=hit?(hit.clear?turretColor(j):CLASS_COLORS['partially-obstructed']):s.unresolved.includes(t.id)?CLASS_COLORS.unresolved:null;
   if(hex)sector(c.from,c.to,r0,r1,hex,i);
  });
 });
 arc(0,2*Math.PI,band[0],'#90abc3');arc(0,2*Math.PI,band[1],'#90abc3');
 return {positions,colors,sampleMap,edges,edgeColors};
}
