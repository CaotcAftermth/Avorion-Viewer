import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientation.js';
import {surfaceSockets} from '../turrets/sockets.js';
import {frame,socketAtFace} from '../turrets/core.js';
const vector=p=>new THREE.Vector3(...p);
export function socketFaces(block){
 const {positions}=blockSurfaceGeometry(block,defaultOrientationProfile());
 return surfaceSockets(block).map(socket=>{
  const normal=vector(socket.normal),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,vector(socket.position));
  const matrix=frame(socket.position,socket.rotation),inverse=matrix.clone().invert(),triangles=[];
  for(let i=0;i<positions.length;i+=9){
   const points=[0,1,2].map(j=>new THREE.Vector3().fromArray(positions,i+j*3));
   const n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
   if(n.dot(normal)>.99999&&points.every(p=>Math.abs(plane.distanceToPoint(p))<1e-4))triangles.push(points.map(p=>p.toArray()));
  }
  const uv=p=>{const q=vector(p).applyMatrix4(inverse);return [q.x,q.z];};
  const world=([x,z])=>new THREE.Vector3(x,0,z).applyMatrix4(matrix).toArray();
  const points=triangles.flat().map(uv),bounds={min:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],max:[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};
  const projection=plane.projectPoint(new THREE.Vector3(block.position.x,block.position.y,block.position.z),new THREE.Vector3()).toArray();
  const face={...socket,type:'component',triangles,plane,bounds,uv,world,projection};
  face.contains=p=>Math.abs(plane.distanceToPoint(vector(p)))<1e-4&&triangles.some(t=>{const bary=new THREE.Triangle(...t.map(vector)).getBarycoord(vector(p),new THREE.Vector3());return bary&&bary.x>=-1e-7&&bary.y>=-1e-7&&bary.z>=-1e-7;});
  face.projectedCenter=face.contains(projection)?projection:null;face.incenter=faceIncenter(face);return face;
 });
}
export function faceForHit(block,hit){
 if(!hit)return null;
 return socketFaces(block).filter(face=>face.contains(hit.point)&&vector(face.normal).dot(vector(hit.direction))<0).sort((a,b)=>Math.abs(a.plane.distanceToPoint(vector(hit.point)))-Math.abs(b.plane.distanceToPoint(vector(hit.point))))[0]||null;
}
// Faces are convex. Solve the largest inscribed circle against boundary edges,
// excluding triangulation diagonals. Average tied optima for symmetric rectangles.
export function faceIncenter(face){
 const unique=new Map();for(const p of face.triangles.flat()){const uv=face.uv(p);unique.set(uv.map(n=>n.toFixed(7)).join(','),uv);}
 const points=[...unique.values()],center=face.uv(face.position);points.sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
 const edges=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);return [-dy/length,dx/length,(dy*a[0]-dx*a[1])/length];});
 let radius=-Infinity,best=[];
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++)for(let k=j+1;k<edges.length;k++){
  const rows=[edges[i],edges[j],edges[k]],matrix=new THREE.Matrix3().set(...rows.flatMap(([x,y])=>[x,y,-1]));if(Math.abs(matrix.determinant())<1e-10)continue;
  const point=new THREE.Vector3(...rows.map(e=>-e[2])).applyMatrix3(matrix.invert()),{x,y,z:r}=point;
  if(r<0||edges.some(([a,b,c])=>a*x+b*y+c<r-1e-7))continue;
  if(r>radius+1e-7){radius=r;best=[[x,y]];}else if(Math.abs(r-radius)<1e-7)best.push([x,y]);
 }
 return best.length?face.world([0,1].map(i=>best.reduce((sum,p)=>sum+p[i],0)/best.length)):null;
}
export const faceCenter=(face,kind='face')=>kind==='block'?face.projectedCenter:kind==='incenter'?face.incenter:face.position;
// The block dimensions are native bounding-box dimensions, independent of shape.
export function boundingSocketFaces(block){return socketFaces({...block,typeIndex:2});}
export function socketNormalChoices(face){return ['x','y','z'].flatMap((axis,i)=>Math.abs(face.normal[i])>1e-6?[{id:(face.normal[i]<0?'-':'+')+axis.toUpperCase(),normal:[0,1,2].map(j=>j===i?Math.sign(face.normal[i]):0)}]:[]);}
export function orientSocket(socket,normal){return {...socket,...socketAtFace(socket.position,normal,socket.id),name:socket.name,normal:[...normal]};}
export function faceBoundary(face,{floor=true}={}){
 const unique=new Map(face.triangles.flat().map(p=>[p.map(n=>n.toFixed(7)).join(','),p]));
 const points=[...unique.values()],center=face.uv(face.position);points.sort((a,b)=>{const p=face.uv(a),q=face.uv(b);return Math.atan2(p[1]-center[1],p[0]-center[0])-Math.atan2(q[1]-center[1],q[0]-center[0]);});
 const edges=points.map((p,i)=>[p,points[(i+1)%points.length]]);if(!floor)return edges;
 // Match the upright, face-aligned editor: native up projected onto the face.
 const normal=vector(face.normal),up=new THREE.Vector3(0,1,0).addScaledVector(normal,-normal.y);
 if(up.lengthSq()<1e-10)up.set(0,0,normal.y>0?-1:1);else up.normalize();
 const height=([a,b])=>vector(a).add(vector(b)).multiplyScalar(.5).dot(up);
 let first=0;for(let i=1;i<edges.length;i++)if(height(edges[i])<height(edges[first])-1e-7)first=i;
 return [...edges.slice(first),...edges.slice(0,first)];
}
// A fixed outward screen offset keeps number plates outside the face polygon.
export function faceEdgeLabels(face,project){
 const center=project(face.position);if(!center)return [];
 return faceBoundary(face).map(([a,b],index)=>{
  const p=project(a),q=project(b);if(!p||!q)return null;const midpoint=[(p[0]+q[0])/2,(p[1]+q[1])/2],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<1e-6)return null;
  let normal=[-dy/length,dx/length];if(normal[0]*(center[0]-midpoint[0])+normal[1]*(center[1]-midpoint[1])>0)normal=normal.map(n=>-n);
  return {index,p,q,midpoint,normal,label:midpoint.map((v,i)=>v+normal[i]*23)};
 }).filter(Boolean);
}
export function gridFrame(face,{edge=0,density='divisions',square=true}={}){
 const boundary=faceBoundary(face),[a,b]=boundary[Number.isInteger(edge)&&boundary[edge]?edge:0],origin=vector(a),base=vector(b).sub(origin),length=base.length(),u=base.clone().normalize(),v=vector(face.normal).cross(u).normalize();
 if(vector(face.position).sub(origin).dot(v)<0)v.negate();
 const points=boundary.map(([p])=>p),height=Math.max(...points.map(p=>vector(p).sub(origin).dot(v)));
 const apex=boundary.length===3?points.find(p=>!p.every((n,i)=>Math.abs(n-a[i])<1e-7)&&!p.every((n,i)=>Math.abs(n-b[i])<1e-7)):null;
 const triangleGrid=!!apex&&density==='divisions'&&!square,skew=triangleGrid?vector(apex).sub(origin).dot(u)/height:0;
 const uv=p=>{const q=vector(p).sub(origin),y=q.dot(v);return [q.dot(u)-y*skew,y];};
 const world=([x,y])=>origin.clone().addScaledVector(u,x+y*skew).addScaledVector(v,y).toArray(),coordinates=points.map(uv);
 return {...face,uv,world,gridLength:length,gridHeight:height,triangleGrid,bounds:{min:[0,1].map(i=>Math.min(...coordinates.map(p=>p[i]))),max:[0,1].map(i=>Math.max(...coordinates.map(p=>p[i])))}};
}
export function gridSteps(face,{density='divisions',divisions=10,spacing=.1,square=true,...settings}={}){
 if(density==='spacing')return Number.isFinite(spacing)&&spacing>0?[spacing,spacing]:null;
 if(!Number.isInteger(divisions)||divisions<1||divisions>1000)return null;
 const basis=face.gridLength===undefined?gridFrame(face,{density,square,...settings}):face;
 return square?[basis.gridLength/divisions,basis.gridLength/divisions]:[basis.gridLength/divisions,basis.gridHeight/divisions];
}
export function snapToFace(face,point,{mode='center',center='face',...grid}={}){
 const anchor=faceCenter(face,center);if(mode==='center')return anchor?[...anchor]:null;
 const projected=face.plane.projectPoint(vector(point),new THREE.Vector3()).toArray();
 if(mode!=='grid')return face.contains(projected)?projected:null;
 const basis=gridFrame(face,grid),steps=gridSteps(basis,grid);if(!steps||steps.some(n=>n<=0))return null;
 const uv=basis.uv(projected),indices=uv.map((v,i)=>Math.round(v/steps[i]));let nearest=null,distance=Infinity;
 // Physical distance matters for the oblique Equal lattice. Check neighboring
 // nodes as well, so points near sloped boundaries still choose valid nodes.
 for(let i=indices[0]-1;i<=indices[0]+1;i++)for(let j=indices[1]-1;j<=indices[1]+1;j++){
  if(basis.triangleGrid&&(i<0||j<0||i+j>(grid.divisions??10)))continue;
  const candidate=basis.world([i*steps[0],j*steps[1]]);if(!face.contains(candidate))continue;
  const d=vector(candidate).distanceToSquared(vector(projected));if(d<distance){distance=d;nearest=candidate;}
 }
 return nearest;
}
export function faceGrid(face,settings){
 const basis=gridFrame(face,settings),steps=gridSteps(basis,settings);if(!steps||steps.some(n=>n<=0))return [];
 const lines=[];
 if(basis.triangleGrid){
  const count=settings.divisions??10;if(count>400)return [];
  const add=(a,b)=>{if(vector(a).distanceToSquared(vector(b))>1e-12)lines.push([a,b]);};
  for(let i=0;i<=count;i++){
   const t=i/count,x=t*basis.gridLength,y=t*basis.gridHeight;
   add(basis.world([0,y]),basis.world([(1-t)*basis.gridLength,y]));
   add(basis.world([x,0]),basis.world([x,(1-t)*basis.gridHeight]));
   add(basis.world([x,0]),basis.world([0,y]));
  }
  return lines;
 }
 for(let axis=0;axis<2;axis++){
  const min=Math.ceil(basis.bounds.min[axis]/steps[axis]-1e-9),max=Math.floor(basis.bounds.max[axis]/steps[axis]+1e-9);
  if(max-min>400)return [];
  for(let i=min;i<=max;i++){const a=[...basis.bounds.min],b=[...basis.bounds.max];a[axis]=b[axis]=i*steps[axis];lines.push([basis.world(a),basis.world(b)]);}
 }
 return lines;
}
