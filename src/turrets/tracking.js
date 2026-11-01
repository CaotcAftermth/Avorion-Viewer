import * as THREE from '../vendor/three.module.js';
import {partMatrices,clampElevation} from './core.js';
import {muzzleOrigins} from './fire-coverage.js';
const forward=a=>new THREE.Vector3(0,0,a.native?1:-1);
const originsCache=new WeakMap();
export function muzzleFrames(asset,socket,pose){
 let data=originsCache.get(asset);if(!data){try{data=muzzleOrigins(asset);}catch{data={estimated:true,points:[new THREE.Vector3(...asset.pitch.position)]};}originsCache.set(asset,data);}
 const matrix=partMatrices(asset,socket,pose).barrel,direction=forward(asset).transformDirection(matrix);
 return data.points.map(p=>({position:p.clone().applyMatrix4(matrix).toArray(),direction:direction.toArray(),right:new THREE.Vector3(1,0,0).transformDirection(matrix).toArray(),localScale:(asset.sourceSize||1)*matrix.getMaxScaleOnAxis(),estimated:data.estimated}));
}
function angle(from,to,axis){const a=from.clone().addScaledVector(axis,-from.dot(axis)),b=to.clone().addScaledVector(axis,-to.dot(axis));if(a.lengthSq()<1e-14||b.lengthSq()<1e-14)return 0;a.normalize();b.normalize();return Math.atan2(axis.dot(a.clone().cross(b)),a.dot(b))*180/Math.PI;}
const wrap=x=>((x+180)%360+360)%360-180;
export function track(asset,socket,pose,target,dt,speed=45,coaxial=false){
 if(coaxial)return pose;
 const point=new THREE.Vector3(...target),m=partMatrices(asset,socket,pose),axis=new THREE.Vector3(...asset.yaw.axis).normalize().transformDirection(m.base),origin=new THREE.Vector3(...asset.yaw.position).applyMatrix4(m.base);
 const yawDelta=wrap(angle(forward(asset).transformDirection(m.body),point.clone().sub(origin),axis));
 pose.yaw+=Math.max(-speed*dt,Math.min(speed*dt,yawDelta));
 if(asset.yaw.limits)pose.yaw=Math.max(asset.yaw.limits.min,Math.min(asset.yaw.limits.max,pose.yaw));
 const updated=partMatrices(asset,socket,pose),pitchAxis=new THREE.Vector3(...asset.pitch.axis).normalize().transformDirection(updated.body),pivot=new THREE.Vector3(...asset.pitch.position).applyMatrix4(updated.body),sign=asset.pitch.elevationSign??(asset.native?-1:1);
 const desired=clampElevation(asset,angle(forward(asset).transformDirection(updated.body),point.sub(pivot),pitchAxis)/sign);
 pose.pitch=clampElevation(asset,pose.pitch+Math.max(-speed*dt,Math.min(speed*dt,desired-pose.pitch)));return pose;
}
