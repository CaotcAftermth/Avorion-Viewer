import * as THREE from '../vendor/three.module.js';
import {partMatrices,pitchLimits,effectiveScale} from './core.js';
import {obstacleTree,muzzleOrigins,rayHit,rayBoxEntry,pointInside,containingBlockIds} from './fire-coverage.js';
import {getBlockDefinition} from '../block-model.js';
import {classifySample} from './coverage-sampling.js';

const v=a=>new THREE.Vector3(...a),degrees=THREE.MathUtils.radToDeg,radians=THREE.MathUtils.degToRad;
export const DEFAULT_FIXED_SPREAD=1;
// All queries use native ship coordinates: +Y up, +X right, +Z front.
// Camera motion is a view transform, not a change to collision geometry.
export function aimingConstraints(mount){
 const p=pitchLimits(mount.asset),c=mount.coverage||{};
 const fixed=c.fixed??['true','1'].includes(String(mount.asset.native?.coaxial));
 // Azimuth is stored as a center and half-width so arcs may cross ±180°.
 // Older yawMin/yawMax pairs are converted on read.
 const legacy=c.yawMin!==undefined||c.yawMax!==undefined,min=c.yawMin??-180,max=c.yawMax??180;
 const yawCenter=wrap(c.yawCenter??(legacy?(min+max)/2:0)),yawHalf=Math.max(0,Math.min(180,c.yawHalf??(legacy?(max-min)/2:180)));
 return {enabled:c.enabled!==false,fixed,yawCenter,yawHalf,yawMin:yawCenter-yawHalf,yawMax:yawCenter+yawHalf,pitchMin:c.pitchMin??p.min,pitchMax:c.pitchMax??p.max,spread:Math.max(0,Math.min(45,c.spread??DEFAULT_FIXED_SPREAD))};
}
export function obstructionIncluded(block,rules={},hiddenIds=new Set()){
 if(block.coverageBlocking===false)return false;
 if(!rules.includeHidden&&(block.hidden||hiddenIds.has(block.id)))return false;
 // Explicit block overrides take priority; material transparency is not proof of
 // physical solidity. Holograms/glass are excluded unless the user opts in.
 if(block.coverageBlocking===true)return true;
 if(!rules.includeDecorative&&getBlockDefinition(block.typeIndex).category==='Decorative'&&!/Glass|Hologram/.test(getBlockDefinition(block.typeIndex).displayName))return false;
 if(!rules.includeTransparent&&((parseInt(block.color?.slice(0,2)||'ff',16)<255)||/Glass|Hologram/.test(getBlockDefinition(block.typeIndex).displayName)))return false;
 return true;
}
export function wrap(a){return ((a+180)%360+360)%360-180;}
export function withinYaw(a,c){return c.yawHalf>=180-1e-9||Math.abs(wrap(a-c.yawCenter))<=c.yawHalf+1e-5;}
function withinLimits(yaw,pitch,c){return withinYaw(yaw,c)&&pitch>=c.pitchMin-1e-4&&pitch<=c.pitchMax+1e-4;}

function pivotMatrix(pivot,angle){
 return new THREE.Matrix4().makeTranslation(...pivot.position).multiply(new THREE.Matrix4().makeRotationAxis(v(pivot.axis).normalize(),radians(angle))).multiply(new THREE.Matrix4().makeTranslation(...pivot.position.map(n=>-n)));
}
// Same composition as core.partMatrices, reusing the turret's fixed mount frame.
function posedMatrices(t,yaw,pitch){
 const a=t.asset,range=pitchLimits(a),clamped=Math.max(range.min,Math.min(range.max,pitch));
 const body=t.base.clone().multiply(pivotMatrix(a.yaw,yaw)),barrel=body.clone().multiply(pivotMatrix(a.pitch,clamped*t.elevationSign));
 return {base:t.base,body,barrel};
}
function poseAt(t,muzzle,yaw,pitch,target){
 const matrices=posedMatrices(t,yaw,pitch),origin=muzzle.clone().applyMatrix4(matrices.barrel);
 const forward=new THREE.Vector3(0,0,t.forwardSign).transformDirection(matrices.barrel),delta=target.clone().sub(origin),distance=delta.length();
 return {matrices,origin,forward,distance,residual:forward.clone().sub(delta.normalize())};
}
// Closed-form aiming for the common vertical-yaw / horizontal-pitch layout,
// including pivot separation and muzzle offset. Every candidate is verified
// against the full pose; callers fall back to the numerical solver otherwise.
function analyticCandidates(t,muzzle,target){
 const a=t.asset,local=target.clone().applyMatrix4(t.baseInverse);
 const py=v(a.yaw.position),pp=v(a.pitch.position),q=local.sub(py),d=pp.clone().sub(py),m=muzzle.clone().sub(pp);
 const rho=Math.hypot(q.x,q.z),c=m.x+d.x,out=[];
 if(rho<1e-12||Math.abs(c)>rho)return out;
 const gamma=Math.atan2(q.z,q.x),spread=Math.acos(Math.max(-1,Math.min(1,c/rho)));
 for(const alpha of new Set([-gamma+spread,-gamma-spread])){
  const wy=q.y-d.y,wz=Math.sin(alpha)*q.x+Math.cos(alpha)*q.z-d.z,r=Math.hypot(wy,wz);
  if(r<1e-12||Math.abs(m.y)>r)continue;
  const delta=Math.atan2(wz,wy),turn=Math.acos(Math.max(-1,Math.min(1,m.y/r)));
  for(const beta of new Set([delta+turn,delta-turn])){
   const along=-Math.sin(beta)*wy+Math.cos(beta)*wz-m.z;
   if(along*t.forwardSign<=0)continue;
   out.push([wrap(degrees(alpha)/t.yawAxisSign),degrees(beta)/(t.pitchAxisSign*t.elevationSign)]);
  }
 }
 return out;
}
function verified(t,muzzle,target,yaw,pitch){
 const range=pitchLimits(t.asset);
 if(pitch<range.min-1e-6||pitch>range.max+1e-6)return null;
 const pose=poseAt(t,muzzle,yaw,pitch,target);
 return pose.distance>t.epsilon&&pose.residual.length()<1e-5?{...pose,yaw,pitch}:null;
}
// Solve actual pivoted muzzle alignment, rather than using a ship-center radial
// direction. Nonconvergent targets are explicitly flagged, never silently blind.
// Fixed weapons cover a cone: their configured spread, widened to the analyzed
// cell footprint so a sampled cell counts when the fixed ray passes through it.
export function aimAtTarget(t,muzzle,target,footprint=0,muzzleIndex=0){
 const c=t.constraints;
 if(c.fixed){
  const pose=poseAt(t,muzzle,t.mount.yaw,t.mount.pitch,target);if(pose.distance<=t.epsilon)return null;
  const angle=degrees(Math.acos(Math.max(-1,Math.min(1,1-pose.residual.lengthSq()/2)))),tolerance=Math.max(c.spread,degrees(2*Math.asin(Math.min(1,footprint/(2*pose.distance)))));
  return angle<=tolerance+1e-6?{...pose,yaw:t.mount.yaw,pitch:t.mount.pitch,offAxis:angle}:null;
 }
 if(t.standard){
  const candidates=analyticCandidates(t,muzzle,target);let any=false;
  for(const [yaw,pitch] of candidates){const pose=verified(t,muzzle,target,yaw,pitch);if(!pose)continue;any=true;if(withinLimits(yaw,pitch,c)){t.warm[muzzleIndex]=[yaw,pitch];return pose;}}
  // Reachable poses were all outside the user's arc, or the target lies inside
  // the muzzle's offset circle / beyond the authored elevation range.
  if(any||candidates.length===0)return null;
 }
 return numericAim(t,muzzle,target,muzzleIndex);
}
// Damped least squares supports arbitrary authored pivot axes. Each seed is
// followed to convergence; an out-of-limit solution does not hide another seed's
// in-limit pose.
function numericAim(t,muzzle,target,muzzleIndex){
 const c=t.constraints,range=pitchLimits(t.asset),local=target.clone().applyMatrix4(t.baseInverse).sub(v(t.asset.pitch.position));
 const sign=t.forwardSign,seed=[degrees(Math.atan2(sign*local.x,sign*local.z)),degrees(Math.atan2(local.y,Math.hypot(local.x,local.z)))];
 const starts=[...(t.warm[muzzleIndex]?[t.warm[muzzleIndex]]:[]),seed,...(t.standard?[]:[[0,0],[90,0],[-90,0],[180,0]])];
 let converged=false;
 for(const start of starts){let [yaw,pitch]=start,lambda=1e-3;
  for(let i=0;i<24;i++){
   const pose=poseAt(t,muzzle,yaw,pitch,target),r=pose.residual;
   if(pose.distance<=t.epsilon)break;
   if(r.length()<1e-5){converged=true;const y=wrap(yaw);if(withinLimits(y,pitch,c)){t.warm[muzzleIndex]=[y,pitch];return {...pose,yaw:y,pitch};}break;}
   const h=.02,dy=poseAt(t,muzzle,yaw+h,pitch,target).residual.sub(r).multiplyScalar(1/h);
   // posedMatrices clamps pitch: stay inside its authored range while differentiating.
   const ph=pitch+h>range.max?-h:h,dp=poseAt(t,muzzle,yaw,pitch+ph,target).residual.sub(r).multiplyScalar(1/ph);
   // Levenberg–Marquardt damping keeps steps bounded near the zenith singularity.
   const a=dy.dot(dy),b=dy.dot(dp),d=dp.dot(dp),scale=lambda*(a+d)+1e-9,aa=a+scale,dd=d+scale,u=dy.dot(r),w=dp.dot(r),det=aa*dd-b*b;
   const stepYaw=THREE.MathUtils.clamp((dd*u-b*w)/det,-45,45),stepPitch=(aa*w-b*u)/det;
   const nextYaw=yaw-stepYaw,nextPitch=THREE.MathUtils.clamp(pitch-stepPitch,range.min,range.max);
   if(poseAt(t,muzzle,nextYaw,nextPitch,target).residual.length()<r.length()){yaw=nextYaw;pitch=nextPitch;lambda=Math.max(1e-6,lambda/3);}else{lambda=Math.min(1e3,lambda*4);if(lambda>=1e3)break;}
  }
 }
 // Standard Y/X pivots constrained at a pitch boundary mean outside the arc.
 return !t.standard&&!converged?{unresolved:true}:null;
}
function assetKey(asset,rules){return JSON.stringify([asset,rules.includeHidden,rules.includeTransparent,rules.includeDecorative]);}
function poseKey(mount,socket,hidden){return JSON.stringify([socket.position,socket.rotation,mount.twist,mount.yaw,mount.pitch,mount.scale,mount.turretSize,hidden]);}
// Turret collision data is cached per mount. A mount edit rebuilds only that
// turret; aiming-constraint edits reuse every tree.
function prepareTurret(mount,socket,rules,hidden,cache){
 const asset=mount.asset,ak=assetKey(asset,rules),pk=poseKey(mount,socket,hidden),previous=cache?.get(mount.id);
 let local=previous?.assetKey===ak?previous.local:null;
 if(!local){
  const geometry=asset.blocks.filter(b=>obstructionIncluded(b,rules));let muzzles=null,error=null,own=null,sourceBlocks=null;
  try{
   muzzles=muzzleOrigins(asset);own=Object.fromEntries(['base','body','barrel'].map(part=>[part,obstacleTree(geometry.filter(b=>asset.parts[b.id]===part))]));
   // Native muzzle markers can be inside their authored barrel block. Exclude
   // only those containing barrel solids from that muzzle's own ray, without
   // skipping the hull, body/base, other barrels or any geometry farther ahead.
   sourceBlocks=muzzles.points.map(p=>containingBlockIds(own.barrel,p));
  }catch(e){error=e.message;}
  local={geometry,muzzles,own,sourceBlocks,error};
 }
 let posed=previous?.assetKey===ak&&previous.poseKey===pk?previous.posed:null;
 if(!posed){
  const matrices=partMatrices(asset,socket,mount),corners=[];
  for(const b of asset.blocks)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])corners.push(new THREE.Vector3(b.position.x+x*b.size.x,b.position.y+y*b.size.y,b.position.z+z*b.size.z).applyMatrix4(matrices[asset.parts[b.id]||'base']));
  posed={tree:obstacleTree(local.geometry,matrices,asset.parts),corners,base:partMatrices(asset,socket,{...mount,yaw:0,pitch:0}).base};
 }
 return {assetKey:ak,poseKey:pk,local,posed,reused:posed===previous?.posed};
}
export function createCoverageEngine(input,previous=null){
 if(input.geometryAvailable===false)throw Error('Hull geometry unavailable; obstruction analysis cannot run.');
 const rules=input.rules||{},hidden=new Set(input.hiddenIds||[]),blocks=input.blocks.filter(b=>obstructionIncluded(b,rules,hidden));
 const ship=previous&&input.shipKey!==undefined&&previous.shipKey===input.shipKey?previous.ship:obstacleTree(blocks),warnings=[],turrets=[];
 const placeholders=input.blocks.filter(b=>getBlockDefinition(b.typeIndex).geometryKind==='placeholder');
 if(placeholders.length)warnings.push(`${placeholders.length} hull blocks use unverified placeholder shapes; obstruction results are approximate`);
 const all=[],displayBounds=new THREE.Box3(),cache=new Map();let rebuilt=0;
 for(const mount of input.mounts){
  const socket=input.sockets.find(s=>s.id===mount.socketId);if(!socket){warnings.push(`${mount.name}: missing socket`);continue;}
  const isHidden=!!(mount.hidden||hidden.has(socket.blockId)),prepared=prepareTurret(mount,socket,rules,isHidden,previous?.prepared);cache.set(mount.id,prepared);
  if(!prepared.reused)rebuilt++;
  for(const p of prepared.posed.corners)displayBounds.expandByPoint(p);
  all.push({id:mount.id,tree:prepared.posed.tree,hidden:isHidden});
  try{
   const {muzzles,own,sourceBlocks,error}=prepared.local;if(error)throw Error(error);
   const asset=mount.asset,constraints=aimingConstraints(mount),scale=effectiveScale(asset,mount);
   if(!(scale>0)||!Number.isFinite(scale))throw Error('invalid scale');
   const yawAxis=v(asset.yaw.axis).normalize(),pitchAxis=v(asset.pitch.axis).normalize();
   const standard=Math.abs(yawAxis.y)>.999999&&Math.abs(pitchAxis.x)>.999999;
   const t={id:mount.id,name:mount.name==='Mounted turret'?asset.name:mount.name,asset,mount,socket,own,sourceBlocks,scale,constraints,muzzles,
    base:prepared.posed.base,baseInverse:prepared.posed.base.clone().invert(),epsilon:Math.max(1e-7,scale*1e-6),standard,
    yawAxisSign:Math.sign(yawAxis.y)||1,pitchAxisSign:Math.sign(pitchAxis.x)||1,elevationSign:asset.pitch.elevationSign??(asset.native?-1:1),forwardSign:asset.native?1:-1,warm:[]};
   turrets.push(t);
  }catch(error){warnings.push(`${mount.name}: ${error.message}`);}
 }
 const solidTurrets=all.filter(t=>rules.includeHidden||!t.hidden);
 const bounds=new THREE.Box3();if(ship)bounds.union(ship.box);for(const t of all)if(t.tree)bounds.union(t.tree.box);
 bounds.union(displayBounds);
 // Display radius encloses excluded/hidden geometry too, independently of the
 // user's collision inclusion rules. Block boxes are conservative for wedges.
 for(const b of input.blocks)for(const sign of [-1,1])bounds.expandByPoint(new THREE.Vector3(...['x','y','z'].map(k=>b.position[k]+sign*b.size[k]/2)));
 if(bounds.isEmpty())for(const socket of input.sockets)bounds.expandByPoint(v(socket.position));
 if(bounds.isEmpty())bounds.set(v([-1,-1,-1]),v([1,1,1]));
 // Padding also encloses the model with the Low globe's planar triangle faces.
 const center=bounds.getCenter(new THREE.Vector3()),minimumRadius=Math.max(.1,bounds.getSize(new THREE.Vector3()).length()/2*1.15);
 const eligible=turrets.filter(t=>t.constraints.enabled);
 // Phase one aims every muzzle; phase two resolves obstruction. Hull hits may
 // be supplied in bulk (for example by the GPU caster) or computed here.
 function plan(point,footprint=0){
  const target=v(point),base={point,potential:0,clear:0,obstructed:0,classification:'uncovered',contributors:[],unresolved:[],valid:true};
  if(pointInside(ship,target)||solidTurrets.some(t=>pointInside(t.tree,target)))return {sample:{...base,valid:false,classification:'inside-geometry'},rays:[],turrets:[]};
  const rays=[],entries=[];
  for(const t of eligible){
   const entry={t,paths:[],unresolved:0};entries.push(entry);
   for(const [muzzleIndex,muzzle] of t.muzzles.points.entries()){
    const pose=aimAtTarget(t,muzzle,target,footprint,muzzleIndex);if(!pose)continue;if(pose.unresolved){entry.unresolved++;continue;}
    const direction=target.clone().sub(pose.origin).normalize(),origin=pose.origin.clone().addScaledVector(direction,t.epsilon),limit=target.distanceTo(origin);
    const ray={entry,t,muzzleIndex,pose,origin,direction,limit,epsilon:t.epsilon};rays.push(ray);entry.paths.push(ray);
   }
  }
  return {sample:base,rays,turrets:entries};
 }
 function resolve(planned,shipHits=null){
  const result=planned.sample;if(!result.valid)return result;
  planned.rays.forEach((ray,i)=>{
   const {t,origin,direction,limit,pose,muzzleIndex}=ray;
   let blocker=shipHits?shipHits[i]:rayHit(ship,origin,direction,limit,t.epsilon);
   for(const other of solidTurrets)if(other.id!==t.id&&other.tree&&rayBoxEntry(other.tree.box,origin,direction)<(blocker?.distance??limit)){const hit=rayHit(other.tree,origin,direction,blocker?.distance??limit,t.epsilon);if(hit)blocker={...hit,turretId:other.id};}
   for(const [part,tree] of Object.entries(t.own)){
    if(!tree)continue;const inverse=part==='base'?t.baseInverse:pose.matrices[part].clone().invert();
    const hit=rayHit(tree,origin.clone().applyMatrix4(inverse),direction.clone().transformDirection(inverse),(blocker?.distance??limit)/t.scale,t.epsilon/t.scale,part==='barrel'?t.sourceBlocks[muzzleIndex]:null);
    if(hit)blocker={...hit,distance:hit.distance*t.scale,point:v(hit.point).applyMatrix4(pose.matrices[part]).toArray(),turretId:t.id,part};
   }
   ray.result={origin:pose.origin.toArray(),yaw:pose.yaw,pitch:pose.pitch,blocker:blocker||null,sourceBarrelBlocks:[...t.sourceBlocks[muzzleIndex]],...(pose.offAxis!==undefined?{offAxis:pose.offAxis}:{})};
  });
  for(const {t,paths,unresolved} of planned.turrets){
   // A turret is unresolved only when no muzzle produced a usable pose.
   if(!paths.length){if(unresolved)result.unresolved.push(t.id);continue;}
   const list=paths.map(p=>p.result),clear=list.some(p=>!p.blocker);result.potential++;result[clear?'clear':'obstructed']++;
   result.contributors.push({id:t.id,name:t.name,clear,partial:clear&&list.some(p=>p.blocker),estimated:t.muzzles.estimated,fixed:t.constraints.fixed,...(unresolved?{unresolvedMuzzles:unresolved}:{}),paths:list});
  }
  result.classification=classifySample(result);
  return result;
 }
 return {ship,shipKey:input.shipKey,prepared:cache,rebuilt,bounds,center:center.toArray(),minimumRadius,warnings,turrets,
  footprintSensitive:eligible.some(t=>t.constraints.fixed),plan,resolve,
  evaluate(point,footprint=0){return resolve(plan(point,footprint));}
 };
}
