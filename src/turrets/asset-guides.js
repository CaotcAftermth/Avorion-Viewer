import * as THREE from '../vendor/three.module.js';
import {createInstance,partMatrices} from './core.js';

// Distinct from the world axis colors (red X, green Y, blue Z) and the cyan muzzles.
export const ROTATION_AXIS_COLORS={yaw:0xd77bff,pitch:0xfff27a};
function rotationRing(name,origin,direction,radius,color){
 const u=new THREE.Vector3().crossVectors(direction,Math.abs(direction.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),v=new THREE.Vector3().crossVectors(direction,u);
 // A 300 degree arc with an arrowhead shows the positive rotation direction.
 const points=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*5/3;points.push(origin.clone().addScaledVector(u,Math.cos(a)*radius).addScaledVector(v,Math.sin(a)*radius));}
 const ring=new THREE.Group();ring.name=name+'-ring';
 ring.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false})));
 const end=points.at(-1),tangent=end.clone().sub(points.at(-2)).normalize(),head=radius*.35,side=new THREE.Vector3().crossVectors(direction,tangent).normalize();
 const tip=end.clone().addScaledVector(tangent,head*.6);
 ring.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([end.clone().addScaledVector(side,head*.45),tip,end.clone().addScaledVector(side,-head*.45)]),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false})));
 return ring;
}

export function createAssetGuides(asset){
 const group=new THREE.Group(),instance=createInstance(asset.id,'origin','guides');
 Object.assign(instance,asset.editorPose||{});instance.turretSize=asset.sourceSize||1;
 const matrices=partMatrices(asset,{position:[0,0,0],rotation:[0,0,0]},instance);
 const size=Math.max(.5,asset.sourceSize||2);
 if(asset.editorGuides?.axes)for(const [name,pivot,matrix,color] of [['yaw',asset.yaw,matrices.base,ROTATION_AXIS_COLORS.yaw],['pitch',asset.pitch,matrices.body,ROTATION_AXIS_COLORS.pitch]]){
  const origin=new THREE.Vector3(...pivot.position).applyMatrix4(matrix),direction=new THREE.Vector3(...pivot.axis).transformDirection(matrix);
  // Dashed shaft plus a ring around it: reads as "rotates about this line",
  // unlike the solid red/green/blue world axes.
  const points=[origin.clone().addScaledVector(direction,-size*.6),origin.clone().addScaledVector(direction,size*.6)];
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color,dashSize:size*.06,gapSize:size*.04,depthTest:false,depthWrite:false}));line.computeLineDistances();line.name=name+'-axis';group.add(line);
  const arrow=new THREE.ArrowHelper(direction,origin,size*.6,color,size*.12,size*.07);arrow.name=name+'-direction';group.add(arrow);
  group.add(rotationRing(name,origin,direction,size*.22,color));
 }
 if(asset.editorGuides?.muzzles){
  const positions=(asset.muzzlePositions||[]).map(p=>p.map((v,i)=>v+(asset.native?.offsets?.barrel?.[i]||0)));
  for(const id of asset.muzzles||[]){const b=asset.blocks.find(b=>b.id===id);if(b)positions.push([b.position.x,b.position.y,b.position.z]);}
  for(const p of positions){const marker=new THREE.Mesh(new THREE.SphereGeometry(size*.025,12,8),new THREE.MeshBasicMaterial({color:0x66ffff,depthTest:false,depthWrite:false}));marker.position.copy(new THREE.Vector3(...p).applyMatrix4(matrices.barrel));marker.name='muzzle-position';group.add(marker);}
 }
 group.traverse(o=>{o.renderOrder=20;if(o.material){o.material.depthTest=false;o.material.depthWrite=false;}});
 group.userData.initial=matrices;for(const child of group.children){child.updateMatrix();child.userData.initialMatrix=child.matrix.clone();}
 return group;
}

let current,key;
export function releaseAssetGuides(){if(current){current.removeFromParent();current.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}current=null;key=null;}
export function syncAssetGuides(world,scene,visible){
 const asset=scene.turretEditorAsset;
 const next=asset?JSON.stringify([asset.editorGuides,asset.yaw,asset.pitch,asset.muzzlePositions,asset.muzzles,asset.sourceSize]):null;
 if(next!==key){releaseAssetGuides();key=next;if(asset){current=createAssetGuides(asset);world.add(current);}}
 if(current&&asset){const pose={...createInstance(asset.id,'origin','guides'),...(scene.turretStudio?.pose||asset.editorPose),turretSize:asset.sourceSize||1};const matrices=partMatrices(asset,{position:[0,0,0],rotation:[0,0,0]},pose);for(const child of current.children){const part=child.name.startsWith('yaw')?'base':child.name.startsWith('pitch')?'body':'barrel';child.matrixAutoUpdate=false;child.matrix.copy(matrices[part]).multiply(current.userData.initial[part].clone().invert()).multiply(child.userData.initialMatrix);}}
 if(current)current.visible=!!visible&&scene.visible&&scene.loaded;
}
