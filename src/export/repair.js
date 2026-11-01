import {triangleNormal} from './mesh.js';

// Repair float32 collapses with local retriangulation and recorded rounding for
// unrepresentable contact edges. Retain half-edge adjacency between surfaces.
export function repairCollapsedTriangles(mesh){
 const p=mesh.positions,t=mesh.indices.slice(),twins=new Int32Array(t.length).fill(-1),dead=new Uint8Array(t.length/3),edges=new Map(),queue=[];
 const next=h=>Math.floor(h/3)*3+(h%3+1)%3;
 const equal=(a,b)=>p[a*3]===p[b*3]&&p[a*3+1]===p[b*3+1]&&p[a*3+2]===p[b*3+2];
 const degenerate=f=>triangleNormal(p,t[f*3],t[f*3+1],t[f*3+2]).every(v=>v===0);
 const pair=(a,b)=>{twins[a]=b;twins[b]=a;};
 for(let h=0;h<t.length;h++){const a=t[h],b=t[next(h)],key=a<b?a+','+b:b+','+a;const other=edges.get(key);if(other===undefined)edges.set(key,h);else if(other<0)return {...mesh,retriangulated:0};else{pair(h,other);edges.set(key,-1);}}
 // Only a closed input can use this repair. Open/invalid input needs a different operation.
 if(twins.some(h=>h<0))return {...mesh,retriangulated:0};edges.clear();
 for(let f=0;f<t.length/3;f++)if(degenerate(f))queue.push(f);
 if(!queue.length)return {...mesh,retriangulated:0};
 let flips=0;
 for(let cursor=0;cursor<queue.length&&cursor<t.length;cursor++){
  const f=queue[cursor];if(!degenerate(f))continue;
  const ids=[...t.subarray(f*3,f*3+3)],lengths=ids.map((a,j)=>[0,1,2].reduce((s,k)=>s+(p[a*3+k]-p[ids[(j+1)%3]*3+k])**2,0)),edge=lengths.indexOf(Math.max(...lengths));
  const h=f*3+edge,opposite=twins[h],g=Math.floor(opposite/3),a=t[h],b=t[next(h)],c=t[next(next(h))],d=t[next(next(opposite))];
  if(g===f||!equal(t[opposite],b)||!equal(t[next(opposite)],a))continue;
  const nf=[c,a,d],ng=[c,d,b],flatF=triangleNormal(p,...nf).every(v=>v===0),flatG=triangleNormal(p,...ng).every(v=>v===0);
  // A strip of collinear triangles sometimes needs an intermediate flip. The
  // strictly shorter diagonal prevents cycling; no surface is introduced.
  if(flatF||flatG){const diagonal=[0,1,2].reduce((s,k)=>s+(p[c*3+k]-p[d*3+k])**2,0);if(!degenerate(g)||diagonal>=lengths[edge])continue;}
  const boundary=[twins[next(next(h))],twins[next(opposite)],twins[next(next(opposite))],twins[next(h)]];
  t.set(nf,f*3);t.set(ng,g*3);pair(f*3,boundary[0]);pair(f*3+1,boundary[1]);pair(g*3+1,boundary[2]);pair(g*3+2,boundary[3]);pair(f*3+2,g*3);flips++;
  if(flatF)queue.push(f);if(flatG)queue.push(g);
  for(const halfedge of boundary){const neighbor=Math.floor(halfedge/3);if(degenerate(neighbor))queue.push(neighbor);}
 }
 // Opposite coincident faces bound zero volume. Cancel the pair, stitching their
 // adjoining half-edges; never delete a face merely because it is small.
 const faces=new Map(),through=new Map();let cancelled=0,collapsed=0;
 for(let f=0;f<t.length/3;f++){
  const ids=[...t.subarray(f*3,f*3+3)],key=[...ids].sort((a,b)=>a-b).join(','),g=faces.get(key);
  if(g===undefined){faces.set(key,f);continue;}
  const start=[...t.subarray(g*3,g*3+3)].indexOf(ids[0]);if(t[g*3+(start+2)%3]!==ids[1])continue;
  dead[f]=dead[g]=1;cancelled+=2;faces.delete(key);
  for(let j=0;j<3;j++){const h=f*3+j;for(let k=0;k<3;k++){const o=g*3+k;if(t[h]===t[next(o)]&&t[next(h)]===t[o]){through.set(h,o);through.set(o,h);break;}}}
 }
 for(let f=0;f<t.length/3;f++){
  if(dead[f]||!degenerate(f))continue;
  for(let j=0;j<3;j++){const h=f*3+j;if(!equal(t[h],t[next(h)]))continue;dead[f]=1;collapsed++;const a=next(h),b=next(a);through.set(a,b);through.set(b,a);break;}
 }
 for(let h=0;h<t.length;h++){
  if(dead[Math.floor(h/3)])continue;let other=twins[h],steps=0;
  while(dead[Math.floor(other/3)]){const across=through.get(other);if(across===undefined||steps++>through.size)return {...mesh,retriangulated:0};other=twins[across];}
  twins[h]=other;
 }
 // Reconstruct vertices from paired corners, splitting separate vertex fans at
 // zero-area contacts without moving any point or adding any surface.
 const parent=new Int32Array(t.length);for(let h=0;h<t.length;h++)parent[h]=h;
 const root=h=>{while(parent[h]!==h){parent[h]=parent[parent[h]];h=parent[h];}return h;};
 const join=(a,b)=>{parent[root(a)]=root(b);};
 for(let h=0;h<t.length;h++)if(!dead[Math.floor(h/3)]){const o=twins[h];if(twins[o]!==h||!equal(t[h],t[next(o)]))return {...mesh,retriangulated:0};join(h,next(o));}
 const positions=[],indices=[],vertices=new Map(),cornerIndex=new Int32Array(t.length).fill(-1);
 for(let h=0;h<t.length;h++){if(dead[Math.floor(h/3)])continue;const r=root(h);let v=vertices.get(r);if(v===undefined){v=positions.length/3;vertices.set(r,v);positions.push(p[t[h]*3],p[t[h]*3+1],p[t[h]*3+2]);}cornerIndex[h]=indices.length;indices.push(v);}
 // Indexed formats cannot represent parallel topological edges with the same
 // endpoints. Give each paired edge its own midpoint to retain the adjacency.
 const parallel=new Map(),cuts=new Map(),precisionContacts=[];let splitEdges=0,maxRounding=0;
 for(let h=0;h<t.length;h++){if(cornerIndex[h]<0)continue;const a=indices[cornerIndex[h]],b=indices[cornerIndex[next(h)]],key=a<b?a+','+b:b+','+a;let list=parallel.get(key);if(!list)parallel.set(key,list=[]);list.push(h);}
 for(const list of parallel.values())if(list.length>2){
  const done=new Set();for(const h of list){if(done.has(h))continue;const o=twins[h];done.add(h);done.add(o);const a=indices[cornerIndex[h]],b=indices[cornerIndex[next(h)]],mid=positions.length/3,point=[0,1,2].map(k=>(positions[a*3+k]+positions[b*3+k])/2),rounded=point.map(Math.fround);
   if([a,b].some(v=>rounded.every((x,k)=>x===positions[v*3+k]))){precisionContacts.push({a,b,rounded});continue;}
   maxRounding=Math.max(maxRounding,Math.hypot(...rounded.map((x,k)=>x-point[k])));positions.push(...rounded);splitEdges++;
   for(const edge of [h,o]){const f=Math.floor(cornerIndex[edge]/3);let entries=cuts.get(f);if(!entries)cuts.set(f,entries=[]);entries.push([indices[cornerIndex[edge]],indices[cornerIndex[next(edge)]],mid]);}
  }
 }
 // A one-ULP contact edge has no representable float32 midpoint. Round only its
 // participating endpoints to that midpoint, then retry the original closed
 // topology. Never apply a blanket tolerance weld or discard neighboring faces.
 if(precisionContacts.length){
  const rounded=p.slice(),targets=new Map();let displacement=0;
  for(const {a,b,rounded:point}of precisionContacts)for(const v of [a,b])targets.set(v,point);
  for(let h=0;h<t.length;h++)if(cornerIndex[h]>=0){const point=targets.get(indices[cornerIndex[h]]);if(!point)continue;const id=t[h];displacement=Math.max(displacement,Math.hypot(...point.map((x,k)=>x-p[id*3+k])));rounded.set(point,id*3);}
  return {...mesh,positions:rounded,indices:mesh.indices.slice(),retriangulated:0,cancelledFaces:0,splitContactEdges:0,repairRounding:0,precisionCollapsedEdges:precisionContacts.length,repairDisplacement:displacement};
 }
 const output=[];for(let f=0;f<indices.length/3;f++){
  let triangles=[indices.slice(f*3,f*3+3)];for(const [a,b,mid]of cuts.get(f)||[]){const nextTriangles=[];for(const tri of triangles){const j=tri.findIndex((v,k)=>v===a&&tri[(k+1)%3]===b);if(j<0){nextTriangles.push(tri);continue;}const c=tri[(j+2)%3];nextTriangles.push([a,mid,c],[mid,b,c]);}triangles=nextTriangles;}
  for(const tri of triangles)output.push(...tri);
 }
 return {...mesh,positions:new Float32Array(positions),indices:new Uint32Array(output),retriangulated:flips,cancelledFaces:cancelled,collapsedFaces:(mesh.collapsedFaces||0)+collapsed,splitContactEdges:splitEdges,repairRounding:maxRounding,precisionCollapsedEdges:0,repairDisplacement:0};
}
