import * as THREE from '../vendor/three.module.js';
import {CALIBRATION as DEFAULT_CALIBRATION,seeded} from './effect-profiles.js';
const C=DEFAULT_CALIBRATION;
// Deterministic bounded paths; shape details remain native-calibration targets.
export function beamPath(origin,end,appearance,time,seed,segments=24,out=new Float32Array((segments+1)*3)){
 const C=appearance.calibration||DEFAULT_CALIBRATION;const a=new THREE.Vector3(...origin),delta=new THREE.Vector3(...end).sub(a),length=delta.length(),direction=delta.clone().normalize(),side=new THREE.Vector3(Math.abs(direction.y)<.9?0:1,Math.abs(direction.y)<.9?1:0,0).cross(direction).normalize(),up=direction.clone().cross(side).normalize();
 const speed=appearance.animationSpeed??0,phase=speed*time+.5*(appearance.animationAcceleration??0)*time*time,random=seeded(seed+Math.floor(Math.max(0,time*speed)*4)),radius=Math.min(length*.1,(appearance.shapeSize??0)*(appearance.shape==='lightning'?C.lightningDisplacement:C.swirlRadius));
 for(let i=0;i<=segments;i++){const f=i/segments,envelope=Math.sin(Math.PI*f),swirl=f*Math.PI*2*C.swirlTurns-phase;
  const x=appearance.shape==='lightning'?(random()*2-1)*radius*envelope:appearance.shape==='swirly'?Math.cos(swirl)*radius*envelope:0,y=appearance.shape==='lightning'?(random()*2-1)*radius*envelope:appearance.shape==='swirly'?Math.sin(swirl)*radius*envelope:0;
  for(let k=0;k<3;k++)out[i*3+k]=origin[k]+delta.getComponent(k)*f+side.getComponent(k)*x+up.getComponent(k)*y;
 }return out;
}
export function createBeamMesh(configureDepth){
 const maxSegments=48,geometry=new THREE.BufferGeometry(),positions=new Float32Array((maxSegments+1)*6),tangents=new Float32Array(positions.length),uv=new Float32Array((maxSegments+1)*4),indices=[];
 for(let i=0;i<maxSegments;i++){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('tangent',new THREE.BufferAttribute(tangents,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{center:{value:new THREE.Vector3()},axis:{value:new THREE.Vector3(0,0,1)},width:{value:1},coreWidth:{value:.5},inner:{value:new THREE.Color()},outer:{value:new THREE.Color()},innerAlpha:{value:1},outerAlpha:{value:1},time:{value:0},opacity:{value:1},coreBrightness:{value:C.beamCore},auraIntensity:{value:C.beamAura},animationSpeed:{value:4},animationAcceleration:{value:0}},vertexShader:`
 attribute vec3 tangent;uniform vec3 center;uniform vec3 axis;uniform float width;varying vec2 vUv;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vUv=uv;vec3 along=axis;vec3 eye=normalize(cameraPosition-center);vec3 side=cross(along,eye);if(length(side)<.001)side=cross(along,vec3(0.,1.,0.));if(length(side)<.001)side=vec3(1.,0.,0.);vec3 p=position+normalize(side)*(uv.x-.5)*width;vec4 mvPosition=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
 #include <logdepthbuf_vertex>
 }`,fragmentShader:`uniform vec3 inner;uniform vec3 outer;uniform float innerAlpha;uniform float outerAlpha;uniform float width;uniform float coreWidth;uniform float time;uniform float opacity;uniform float coreBrightness;uniform float auraIntensity;uniform float animationSpeed;uniform float animationAcceleration;varying vec2 vUv;
 #include <logdepthbuf_pars_fragment>
 void main(){float x=abs(vUv.x*2.-1.);float ratio=max(.001,coreWidth/width);float core=exp(-pow(x/ratio,2.)*8.);float body=exp(-pow(x/ratio,2.)*2.);float aura=pow(max(0.,1.-x),3.);float phase=time*animationSpeed+.5*time*time*animationAcceleration;float pulse=.94+.06*sin(vUv.y*60.-phase);gl_FragColor=vec4((inner*innerAlpha*core*coreBrightness+outer*outerAlpha*(body+aura*auraIntensity))*pulse,opacity*max(core,body*.7+aura*.25));
 #include <logdepthbuf_fragment>
 }`});configureDepth(material);const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.userData.path=new Float32Array((maxSegments+1)*3);return mesh;
}
export function updateBeam(mesh,beam,time,settings){
 const p=beam.appearance,C=p.calibration,segments=p.shape==='straight'?1:(settings.lightningDetail==='low'||settings.quality==='low'?Math.min(8,C.lightningSegments):C.lightningSegments),age=beam.discrete?time-beam.birth:time;
 const key=[segments,age,beam.seed,p.shape,p.shapeSize,...beam.origin,...beam.end].join(',');
 if(mesh.userData.key!==key){mesh.userData.key=key;const path=beamPath(beam.origin,beam.end,p,age,beam.seed,segments,mesh.userData.path),g=mesh.geometry;
  for(let i=0;i<=segments;i++){const prev=Math.max(0,i-1),next=Math.min(segments,i+1);for(let side=0;side<2;side++){const n=i*2+side;for(let k=0;k<3;k++){g.attributes.position.array[n*3+k]=path[i*3+k];g.attributes.tangent.array[n*3+k]=path[next*3+k]-path[prev*3+k];}g.attributes.uv.array[n*2]=side;g.attributes.uv.array[n*2+1]=i/segments;}}
  for(const a of Object.values(g.attributes))a.needsUpdate=true;g.setDrawRange(0,segments*6);
 }
 const u=mesh.material.uniforms;u.center.value.fromArray(beam.origin).add(new THREE.Vector3(...beam.end)).multiplyScalar(.5);u.axis.value.fromArray(beam.direction);u.width.value=p.width+p.aura*2;u.coreWidth.value=p.width;u.inner.value.setRGB(...p.inner);u.outer.value.setRGB(...p.outer);u.innerAlpha.value=p.innerAlpha??1;u.outerAlpha.value=p.outerAlpha??1;u.time.value=age;u.animationSpeed.value=p.animationSpeed;u.animationAcceleration.value=p.animationAcceleration??0;u.coreBrightness.value=C.beamCore;u.auraIntensity.value=C.beamAura;u.opacity.value=beam.discrete?Math.max(0,1-age/beam.lifetime):1;
}
