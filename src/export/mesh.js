export function indexTriangles(flat,{tolerance=0,cleanup=false}={}){
 const positions=[],indices=[],map=new Map(),faces=new Set();let removedDegenerate=0,removedDuplicate=0;
 for(let i=0;i<flat.length;i+=9){const triangle=[];for(let j=0;j<9;j+=3){const p=[flat[i+j],flat[i+j+1],flat[i+j+2]],key=p.map(v=>tolerance?Math.round(v/tolerance):v===0?0:v).join(',');let id=map.get(key);if(id===undefined){id=positions.length/3;map.set(key,id);positions.push(...p);}triangle.push(id);}
  const [a,b,c]=triangle,normal=triangleNormal(positions,a,b,c),degenerate=new Set(triangle).size<3||normal.every(v=>v===0),key=[...triangle].sort((a,b)=>a-b).join(',');
  if(cleanup&&degenerate){removedDegenerate++;continue;}if(cleanup&&faces.has(key)){removedDuplicate++;continue;}faces.add(key);indices.push(...triangle);
 }
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices),removedDegenerate,removedDuplicate};
}
export function triangleNormal(p,a,b,c){const u=[0,1,2].map(i=>p[b*3+i]-p[a*3+i]),v=[0,1,2].map(i=>p[c*3+i]-p[a*3+i]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];}
// The shared hangar surface has collinear rim vertices inside longer face edges.
// Subdivide at existing vertices only: no hole filling, displacement, or new surface.
export function splitTJunctions(mesh){
 const p=mesh.positions,out=[],pending=[];for(let i=0;i<mesh.indices.length;i+=3)pending.push(Array.from(mesh.indices.subarray(i,i+3)));
 let splits=0;while(pending.length){const ids=pending.pop();let split=false;
  for(let edge=0;edge<3&&!split;edge++){const a=ids[edge],b=ids[(edge+1)%3],c=ids[(edge+2)%3],d=[0,1,2].map(i=>p[b*3+i]-p[a*3+i]),length=d.reduce((s,v)=>s+v*v,0);if(!length)continue;
   for(let v=0;v<p.length/3;v++){if(ids.includes(v))continue;const q=[0,1,2].map(i=>p[v*3+i]-p[a*3+i]),t=q.reduce((s,x,i)=>s+x*d[i],0)/length;if(t<=1e-7||t>=1-1e-7)continue;
    if(q.reduce((s,x,i)=>s+(x-t*d[i])**2,0)>length*1e-14)continue;
    pending.push([a,v,c],[v,b,c]);split=true;splits++;break;
   }
  }if(!split)out.push(...ids);
 }
 return {...mesh,indices:new Uint32Array(out),splitEdges:splits};
}
// For one known solid block only. Shared-edge propagation repairs winding;
// signed volume chooses outward orientation. Never fills holes or merges shells.
export function orientClosedBlock(mesh){
 const t=mesh.indices,p=mesh.positions,edges=new Map(),adj=Array.from({length:t.length/3},()=>[]);
 for(let f=0;f<t.length/3;f++)for(let j=0;j<3;j++){const a=t[f*3+j],b=t[f*3+(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b),entry=edges.get(key)||[];entry.push({f,sign:a<b?1:-1});edges.set(key,entry);}
 if([...edges.values()].some(e=>e.length!==2))return {...mesh,reoriented:0};
 for(const [a,b]of edges.values()){const flip=a.sign===b.sign;adj[a.f].push([b.f,flip]);adj[b.f].push([a.f,flip]);}
 const signs=new Int8Array(adj.length),components=[];
 for(let start=0;start<adj.length;start++){if(signs[start])continue;const component=[start];signs[start]=1;for(let i=0;i<component.length;i++)for(const [next,flip]of adj[component[i]]){const sign=signs[component[i]]*(flip?-1:1);if(signs[next]&&signs[next]!==sign)return {...mesh,reoriented:0};if(!signs[next]){signs[next]=sign;component.push(next);}}components.push(component);}
 for(const component of components){let volume=0;for(const f of component){const a=t[f*3],b=t[f*3+1],c=t[f*3+2],n=triangleNormal(p,a,b,c);volume+=signs[f]*(p[a*3]*n[0]+p[a*3+1]*n[1]+p[a*3+2]*n[2])/6;}if(volume<0)for(const f of component)signs[f]*=-1;}
 const indices=t.slice();let reoriented=0;for(let f=0;f<signs.length;f++)if(signs[f]<0){[indices[f*3+1],indices[f*3+2]]=[indices[f*3+2],indices[f*3+1]];reoriented++;}return {...mesh,indices,reoriented};
}
export function validateMesh(mesh,{maxTriangles=2000000}={}){
 const p=mesh.positions,t=mesh.indices,triangles=t.length/3,vertices=p.length/3;
 if(triangles>maxTriangles)return {status:'Not checked',vertices,triangles,boundaryEdges:null,nonManifoldEdges:null,degenerateTriangles:null,duplicateFaces:null,components:null,winding:'Not checked',watertight:'Not checked',selfIntersections:'Not checked',issueTriangles:[],volume:null};
 const edges=new Map(),faces=new Map(),issues=new Set(),parent=new Int32Array(triangles),fans=new Int32Array(t.length);for(let i=0;i<triangles;i++)parent[i]=i;for(let i=0;i<fans.length;i++)fans[i]=i;
 const fanRoot=i=>{while(fans[i]!==i){fans[i]=fans[fans[i]];i=fans[i];}return i;};const fanJoin=(a,b)=>{fans[fanRoot(a)]=fanRoot(b);};
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};const join=(a,b)=>{parent[root(a)]=root(b);};let degenerate=0,duplicate=0,invalid=0,volume=0;
 for(let f=0;f<triangles;f++){
  const ids=[t[f*3],t[f*3+1],t[f*3+2]];
  if(ids.some(id=>id>=vertices)||ids.some(id=>![p[id*3],p[id*3+1],p[id*3+2]].every(Number.isFinite))){invalid++;issues.add(f);continue;}
  const n=triangleNormal(p,...ids);if(new Set(ids).size<3||n.every(v=>v===0)){degenerate++;issues.add(f);}
  const key=[...ids].sort((a,b)=>a-b).join(',');if(faces.has(key)){duplicate++;issues.add(f);issues.add(faces.get(key));}else faces.set(key,f);
  const [a,b,c]=ids;volume+=(p[a*3]*(p[b*3+1]*p[c*3+2]-p[b*3+2]*p[c*3+1])+p[a*3+1]*(p[b*3+2]*p[c*3]-p[b*3]*p[c*3+2])+p[a*3+2]*(p[b*3]*p[c*3+1]-p[b*3+1]*p[c*3]))/6;
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],ca=f*3+j,cb=f*3+(j+1)%3,key=Math.min(a,b)+','+Math.max(a,b),entry=edges.get(key),sign=a<b?1:-1;if(entry){join(f,entry.face);fanJoin(ca,t[entry.ca]===a?entry.ca:entry.cb);fanJoin(cb,t[entry.ca]===b?entry.ca:entry.cb);entry.count++;entry.direction+=sign;if(entry.count>2)issues.add(f);}else edges.set(key,{count:1,direction:sign,face:f,ca,cb});}
 }
 let boundary=0,nonManifold=0,winding=0;for(const e of edges.values()){if(e.count===1)boundary++;if(e.count>2)nonManifold++;if(e.count===2&&e.direction!==0)winding++;if(e.count!==2||e.direction!==0)issues.add(e.face);}
 const vertexFans=new Map(),badVertices=new Set();for(let i=0;i<t.length;i++){const r=fanRoot(i),previous=vertexFans.get(t[i]);if(previous===undefined)vertexFans.set(t[i],r);else if(previous!==r){badVertices.add(t[i]);issues.add(Math.floor(i/3));}}
 const components=new Set(Array.from(parent,(_,i)=>root(i))).size,closed=triangles>0&&!boundary&&!nonManifold&&!badVertices.size&&!degenerate&&!duplicate&&!invalid&&!winding;
 return {status:closed?'Passed':'Failed',vertices,triangles,boundaryEdges:boundary,nonManifoldEdges:nonManifold,nonManifoldVertices:badVertices.size,degenerateTriangles:degenerate,duplicateFaces:duplicate,invalidTriangles:invalid,components,winding:winding?'Failed':'Passed',watertight:closed?'Passed':'Failed',selfIntersections:'Not checked',volume,issueTriangles:[...issues].slice(0,2000)};
}
// Share vertices only when both position and flat face normal match. Hard edges stay hard.
export function indexedNormals(mesh){const flat=flatNormals(mesh),positions=[],normals=[],indices=[],seen=new Map();for(let i=0;i<flat.positions.length;i+=3){const p=flat.positions.subarray(i,i+3),n=flat.normals.subarray(i,i+3),key=[...p,...n].join(',');let id=seen.get(key);if(id===undefined){id=positions.length/3;seen.set(key,id);positions.push(...p);normals.push(...n);}indices.push(id);}return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint32Array(indices)};}
export function flatNormals(mesh){const flat=new Float32Array(mesh.indices.length*3),normals=new Float32Array(flat.length);for(let i=0;i<mesh.indices.length;i+=3){const ids=[mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]],n=triangleNormal(mesh.positions,...ids),len=Math.hypot(...n)||1;for(let j=0;j<3;j++)for(let a=0;a<3;a++){flat[(i+j)*3+a]=mesh.positions[ids[j]*3+a];normals[(i+j)*3+a]=n[a]/len;}}return {positions:flat,normals};}
