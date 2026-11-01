import * as THREE from '../vendor/three.module.js';
import {defaultOrientationProfile,localScaleFor,resolveOrientation} from '../avorion/lib/avorion/orientation.js';
import {getBlockDefinition} from '../avorion/lib/avorion/blockDefinitions.js';
import {getUnitGeometry} from '../avorion/lib/geometry/blockGeometry.js';
import {repairCollapsedTriangles} from './repair.js';
import {triangleNormal,validateMesh} from './mesh.js';
import initManifold from '../vendor/manifold/manifold.js';
let pending;
export function manifoldModule(){return pending??=initManifold().then(m=>{m.setup();return m;});}
export async function unionSolids(parts,progress,tolerance=0,cleanup=true,{scale=1,precisionScale=1,fillCavities=false,maxTriangles=2000000}={}){
 const m=await manifoldModule(),live=new Set();
 try{
  const solids=[];for(let i=0;i<parts.length;i++){
   const {mesh,id,block}=parts[i];let solid;try{
    if(block){
     const owned=[],own=s=>{owned.push(s);if(s.status()!=='NoError')throw Error(s.status());return s;};
     try{const {base,quaternion}=resolveOrientation(defaultOrientationProfile(),block.look,block.up,block.typeIndex),size=localScaleFor(base,block.size);let local;
      if(block.typeIndex===10){const outer=own(m.Manifold.cube([size.x,size.y,size.z],true)),cutter=own(m.Manifold.cube([size.x-2*Math.min(size.x*.15,.3),size.y-2*Math.min(size.y*.15,.3),size.z*1.02],true));local=own(outer.subtract(cutter));}
      else{const p=getUnitGeometry(getBlockDefinition(block.typeIndex).geometryKind).getAttribute('position'),input=new m.Mesh({numProp:3,vertProperties:new Float32Array(p.array),triVerts:Uint32Array.from({length:p.count},(_,j)=>j)});input.merge();local=own(own(new m.Manifold(input)).scale([size.x,size.y,size.z]));}
      const matrix=new THREE.Matrix4().compose(new THREE.Vector3(block.position.x,block.position.y,block.position.z),quaternion,new THREE.Vector3(1,1,1)),transformed=own(local.transform(matrix.elements));solid=new m.Manifold(transformed.getMesh());
     }finally{owned.forEach(s=>s.delete());}
    }else solid=new m.Manifold(new m.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices}));
   }catch(e){throw Object.assign(Error(`Block ${id}: ${e.message}. Input is not a valid closed solid; no speculative repair was applied.`),{issueIds:[id]});}live.add(solid);
   if(solid.status()!=='NoError')throw Object.assign(Error(`Block ${id} is not a valid closed solid (${solid.status()}). No speculative repair was applied.`),{issueIds:[id]});
   solids.push(solid);if(i%64===0)progress(35+15*i/parts.length,'Checking input solids…');
  }
  const keep=solid=>{live.add(solid);if(solid.status()!=='NoError')throw Error('Solid processing failed: '+solid.status());return solid;};
  const drop=solid=>{live.delete(solid);solid.delete();};
  let joined=0;
  const combine=batch=>{
   const union=keep(m.Manifold.union(batch));
   // Retain the union's surface constraints. asOriginal() discards them and can
   // simplify thin hull details away even when the resulting topology is valid.
   batch.forEach(drop);
   progress(Math.min(85,52+33*(joined+=batch.length)/Math.max(1,parts.length*2)),'Joining nearby solids...');return union;
  };
  const centers=parts.map(p=>p.center||[0,1,2].map(a=>{let lo=Infinity,hi=-Infinity;for(let i=a;i<p.mesh.positions.length;i+=3){lo=Math.min(lo,p.mesh.positions[i]);hi=Math.max(hi,p.mesh.positions[i]);}return (lo+hi)/2;}));
  const join=ids=>{
   if(ids.length<=16)return combine(ids.map(i=>solids[i]));
   const spans=[0,1,2].map(a=>{let lo=Infinity,hi=-Infinity;for(const i of ids){lo=Math.min(lo,centers[i][a]);hi=Math.max(hi,centers[i][a]);}return hi-lo;}),axis=spans.indexOf(Math.max(...spans));
   ids.sort((a,b)=>centers[a][axis]-centers[b][axis]);const mid=Math.floor(ids.length/2);return combine([join(ids.slice(0,mid)),join(ids.slice(mid))]);
  };
  let solid=join(parts.map((_,i)=>i));
  if(fillCavities){const boundaries=solid.decompose().map(keep),outer=boundaries.filter(s=>s.volume()>0);if(!outer.length)throw Error('No exterior solid remains.');const exterior=keep(m.Manifold.union(outer));boundaries.forEach(drop);drop(solid);solid=exterior;}
  // Join in native units; scale once inside the kernel before binary output.
  const scaled=keep(solid.scale(scale*precisionScale));drop(solid);solid=scaled;
  if(tolerance>0){const simplified=keep(solid.simplify(tolerance*precisionScale));drop(solid);solid=simplified;}
  // Re-ingesting this rounded output invokes another kernel cleanup and can
  // remove real hull surfaces. Use the targeted precision repair below instead.
  const raw=solid.getMesh();
  const positions=new Float32Array(raw.vertProperties.length/raw.numProp*3);
  for(let i=0;i<positions.length/3;i++)for(let a=0;a<3;a++)positions[i*3+a]=raw.vertProperties[i*raw.numProp+a];
  // Respect the library's topology. Coincident positions can belong to separate
  // shells; welding them indiscriminately creates non-manifold contacts.
  const canonical=new Uint32Array(positions.length/3);for(let i=0;i<canonical.length;i++)canonical[i]=i;
  for(let i=0;i<raw.mergeFromVert.length;i++)canonical[raw.mergeFromVert[i]]=raw.mergeToVert[i];
  const indices=raw.triVerts.map(i=>{while(canonical[i]!==i)i=canonical[i];return i;});
  let mesh={positions,indices,solidVolume:solid.volume(),collapsedFaces:0};
  if(cleanup&&indices.length/3<=maxTriangles){
   let candidate=mesh,repair={retriangulated:0,cancelledFaces:0,splitContactEdges:0,repairRounding:0,precisionCollapsedEdges:0,repairDisplacement:0};
   for(let pass=0;pass<8;pass++){
    let hasCollapsed=false;for(let i=0;i<candidate.indices.length;i+=3)if(triangleNormal(candidate.positions,...candidate.indices.subarray(i,i+3)).every(v=>v===0)){hasCollapsed=true;break;}if(!hasCollapsed)break;
    progress(86,'Repairing collapsed output triangles...');
    const next=repairCollapsedTriangles(candidate);
    repair.retriangulated+=next.retriangulated||0;repair.cancelledFaces+=next.cancelledFaces||0;repair.splitContactEdges+=next.splitContactEdges||0;repair.repairRounding=Math.max(repair.repairRounding,next.repairRounding||0);
    repair.precisionCollapsedEdges+=next.precisionCollapsedEdges||0;repair.repairDisplacement+=next.repairDisplacement||0;
    if(next.indices===candidate.indices)break;candidate=next;
    if(validateMesh(candidate,{maxTriangles}).status==='Passed'){mesh={...candidate,...repair};break;}
   }
  }
  // Repair in the target format's float32 units. Keep an exact double-precision
  // millimeter representation so glTF conversion does not round twice.
  if(precisionScale!==1)mesh={...mesh,positions:Float64Array.from(mesh.positions,v=>v/precisionScale),solidVolume:mesh.solidVolume/precisionScale**3,repairRounding:(mesh.repairRounding||0)/precisionScale,repairDisplacement:(mesh.repairDisplacement||0)/precisionScale};
  return mesh;
 }finally{for(const solid of live)solid.delete();}
}
