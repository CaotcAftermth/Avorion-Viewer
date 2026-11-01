import {createBeamMesh,updateBeam} from './beam-effects.js';
import {impactDuration} from './effect-simulation.js';
import * as THREE from '../vendor/three.module.js';
import {seeded} from './effect-profiles.js';
// Fixed GPU pool; overflow affects presentation only, never simulation.
export class WeaponEffectsRenderer {
 constructor(configureDepth=()=>{}){
  this.group=new THREE.Group();this.capacity=4096;
  this.geometry=new THREE.SphereGeometry(1,8,6);
  this.material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  this.material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 vEffectNormal; varying vec3 vEffectView;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vEffectNormal=normalize(mat3(modelViewMatrix)*mat3(instanceMatrix)*normal);vEffectView=-mvPosition.xyz;`);
   shader.fragmentShader='varying vec3 vEffectNormal; varying vec3 vEffectView;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`diffuseColor.a*=pow(abs(dot(normalize(vEffectNormal),normalize(vEffectView))),1.5);
    #include <opaque_fragment>`);
  };configureDepth(this.material);
  this.mesh=new THREE.InstancedMesh(this.geometry,this.material,this.capacity);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;this.group.add(this.mesh);
  this.beams=[];this.configureDepth=configureDepth;this.object=new THREE.Object3D();this.color=new THREE.Color();this.axis=new THREE.Vector3(0,0,1);this.direction=new THREE.Vector3();
  this.rocketGeometry=new THREE.ConeGeometry(1,4,8);this.rocketGeometry.rotateX(Math.PI/2);this.rocketMaterial=new THREE.MeshBasicMaterial({color:0xcccccc});configureDepth(this.rocketMaterial);this.rockets=new THREE.InstancedMesh(this.rocketGeometry,this.rocketMaterial,this.capacity);this.rockets.frustumCulled=false;this.rockets.count=0;this.group.add(this.rockets);
 }
 add(position,scale,color,direction=[0,0,1]){if(this.count>=this.capacity){this.overflow++;return;}const o=this.object;o.position.fromArray(position);o.scale.fromArray(scale);o.quaternion.setFromUnitVectors(this.axis,this.direction.fromArray(direction).normalize());o.updateMatrix();this.mesh.setMatrixAt(this.count,o.matrix);this.color.setRGB(...color);this.mesh.setColorAt(this.count++,this.color);}
 beam(index){if(index>=256){this.overflow++;return null;}if(this.beams[index])return this.beams[index];const mesh=createBeamMesh(this.configureDepth);this.group.add(mesh);this.beams.push(mesh);return mesh;}
 update(runtime,visible=true){
  this.count=0;this.rocketCount=0;this.overflow=0;this.beams.forEach(b=>b.visible=false);const e=runtime?.effects,s=runtime?.settings,p=e?.profile;this.group.visible=!!(visible&&p&&s.effects!==false);
  if(this.group.visible){
   const t=e.time,C=p.calibration;
   for(const shot of e.projectiles){const r=p.size*.5,age=t-shot.birth;
    if(p.shape==='rocket'){if(this.rocketCount<this.capacity){const o=this.object;o.position.fromArray(shot.position);o.scale.set(r,r,r);o.quaternion.setFromUnitVectors(this.axis,this.direction.fromArray(shot.direction));o.updateMatrix();this.rockets.setMatrixAt(this.rocketCount++,o.matrix);}else this.overflow++;
     if(s.trails!==false)for(let i=0;i<shot.history.length;i+=Math.ceil(shot.history.length/(s.quality==='low'?4:8))){const fade=(i+1)/shot.history.length,size=r*(1-fade*.65);this.add(shot.history[i],[size,size,size],[fade*.6,fade*.25,fade*.04]);}
    }else if(p.shape==='plasma'){const pulse=1+.08*Math.sin(age*18+shot.id);this.add(shot.position,[r*pulse,r/pulse,r*1.2],p.color,shot.direction);this.add(shot.position,[r*.4,r*.4,r*.55],[.8,.8,.8],shot.direction);
    }else{this.add(shot.position,[r,r,p.shape==='heavy-round'?r:r*3],p.color,shot.direction);if(p.shape==='pulse')this.add(shot.position,[r*.45,r*.45,r*2],p.color.map(v=>v*.5+.5),shot.direction);}
    if(s.trails!==false&&p.shape!=='rocket'){const length=Math.min(C.trailLength,age*p.velocity);this.add(shot.position.map((v,i)=>v-shot.direction[i]*length*.5),[r*.5,r*.5,length*.5],p.color.map(v=>v*C.trailOpacity),shot.direction);}
   }
   if(s.flashes!==false)for(const f of e.flashes){const age=(t-f.birth)/C.flashDuration,m=runtime.muzzles[f.muzzle],size=p.size*(1+age*C.flashExpansion);this.add(m?.position||f.origin,[size,size,size*2],p.color.map(v=>v*(1-age)*C.flashBrightness),m?.direction||f.direction);}
   if(s.impacts!==false)for(const hit of e.impacts){const dust=hit.kind==='dust',energy=hit.kind==='energy',explosive=hit.kind==='explosive',age=t-hit.time,duration=impactDuration(hit.kind,p.calibration),fade=Math.max(0,1-age/duration),random=seeded(hit.seed),radius=dust||explosive?hit.radius:energy?.7:.5,color=energy?hit.color:[1,.6,.1];
    if(dust){const size=Math.max(.01,radius*age/duration);this.add(hit.position,[size,size,size],[fade*.025,fade*.022,fade*.018]);}else this.add(hit.position,Array(3).fill(Math.max(.01,radius*age/duration)),color.map(v=>v*fade));
    for(let i=0;i<(s.quality==='low'?Math.min(8,C.particleCount):C.particleCount);i++){const direction=[random()*2-1,random()*2-1,random()*2-1],speed=(.5+random())*radius,position=hit.position.map((v,k)=>v+direction[k]*age*speed*(dust?.7:3)),size=dust?radius*.04*(.5+age):.035*fade;this.add(position,[size,size,dust?size:.1*fade],dust?[fade*.05,fade*.045,fade*.04]:color.map(v=>v*fade),direction);}
   }
   let beamIndex=0;for(const b of e.beams){if(b.length<=0||b.role==='primary'&&s.forcePrimary===false||b.role==='secondary'&&s.forceSecondary===false)continue;const mesh=this.beam(beamIndex++);if(!mesh)continue;mesh.visible=true;updateBeam(mesh,b,t,s);if(b.contact&&!b.discrete&&s.impacts!==false){const size=C.contactSize*(1+.1*Math.sin(t*b.appearance.animationSpeed));this.add(b.end,[size,size,size],b.appearance.inner);}}

  }
  this.rockets.count=this.rocketCount;this.rockets.instanceMatrix.needsUpdate=true;this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;if(runtime)runtime.visualOverflow=this.overflow;
 }
 dispose(){this.group.removeFromParent();this.geometry.dispose();this.material.dispose();this.mesh.dispose();this.rocketGeometry.dispose();this.rocketMaterial.dispose();this.rockets.dispose();for(const b of this.beams){b.geometry.dispose();b.material.dispose();}this.beams=[];}
}
