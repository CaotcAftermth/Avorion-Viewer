import * as THREE from '../vendor/three.module.js';

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
