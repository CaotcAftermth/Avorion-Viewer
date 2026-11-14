import {hasCanonicalEndpoints,instanceOrientation,placeWedgeVertex} from './avorion/lib/geometry/wedgeInstances.js';
import {placeBoxVertex} from './avorion/lib/geometry/boxInstances.js';
import {diagnosticRender} from './performance-diagnostics.js';
import * as THREE from './vendor/three.module.js';

const edgeCache=new WeakMap();
// Extract actual block contours, excluding triangle diagonals. Instance offsets
// and posed positions use the same attributes as picking and model rendering.
export function selectedBlockEdges(group,selected,hidden=new Set()){
  const output=[],point=new THREE.Vector3();group.updateMatrixWorld(true);
  for(const mesh of group.children){
    if(!mesh.userData.textured||!mesh.geometry)continue;
    const geometry=mesh.geometry,position=geometry.getAttribute('position'),scales=geometry.getAttribute('aScale');
    const endpoints=hasCanonicalEndpoints(geometry);
    let cached=edgeCache.get(geometry);
    if(!cached||cached.version!==position.version){cached={version:position.version,blocks:new Map()};edgeCache.set(geometry,cached);}
    for(const [id,ranges] of mesh.userData.ranges){
      if(!selected.has(id)||hidden.has(id))continue;
      const key=mesh.userData.instanced?'instance':id;
      const offset=mesh.userData.instanced?new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('aOffset'),ranges[0][0]):new THREE.Vector3();
      const scale=scales&&new THREE.Vector3().fromBufferAttribute(scales,ranges[0][0]);
      let edges=endpoints?null:cached.blocks.get(key);
      if(!edges){
        const rotation=endpoints?instanceOrientation(geometry,ranges[0][0]):null;
        const vertices=[];const spans=mesh.userData.instanced?[[0,position.count]]:ranges;
        for(const [start,count] of spans)for(let i=start;i<start+count;i++){
          point.fromBufferAttribute(position,i);
          if(endpoints)placeWedgeVertex(point,scale,offset,rotation);
          vertices.push(point.x,point.y,point.z);
        }
        const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        const contour=new THREE.EdgesGeometry(shape,1);edges=contour.getAttribute('position').array.slice();shape.dispose();contour.dispose();if(!endpoints)cached.blocks.set(key,edges);
      }
      for(let i=0;i<edges.length;i+=3){
        point.fromArray(edges,i);
        if(!endpoints){
          if(scale)placeBoxVertex(point,scale,offset);
          else point.add(offset);
        }
        point.applyMatrix4(mesh.matrixWorld);
        output.push(point.x,point.y,point.z);
      }
    }
  }
  return new Float32Array(output);
}

export function createSelectionOutline(){
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,-1,0,1,-1,0,1,1,0,0,-1,0,1,1,0,0,1,0],3));geometry.instanceCount=0;
  const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{resolution:{value:new THREE.Vector2()},lineWidth:{value:3},color:{value:new THREE.Color()},nearPlane:{value:.01},depthMap:{value:null},attachmentMap:{value:null},useDepth:{value:false},logFactor:{value:0}},
    vertexShader:`attribute vec3 edgeStart,edgeEnd;uniform vec2 resolution;uniform float lineWidth,nearPlane;varying float edgeW;
      void main(){
        vec4 a=modelViewMatrix*vec4(edgeStart,1.),b=modelViewMatrix*vec4(edgeEnd,1.);
        if(a.z>-nearPlane&&b.z>-nearPlane){gl_Position=vec4(2.,2.,2.,1.);return;}
        if(a.z>-nearPlane)a=mix(a,b,(-nearPlane-a.z)/(b.z-a.z));
        if(b.z>-nearPlane)b=mix(b,a,(-nearPlane-b.z)/(a.z-b.z));
        a=projectionMatrix*a;b=projectionMatrix*b;
        vec2 delta=(b.xy/b.w-a.xy/a.w)*resolution;
        vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),.0001);
        vec4 p=mix(a,b,position.x);p.xy+=normal*position.y*lineWidth/resolution*p.w;edgeW=p.w;gl_Position=p;
      }`,
    fragmentShader:`uniform vec3 color;uniform vec2 resolution;uniform sampler2D depthMap,attachmentMap;
      uniform bool useDepth;uniform float logFactor;varying float edgeW;
      void main(){
        float depth=logFactor>0.?log2(1.+edgeW)*logFactor:gl_FragCoord.z;
        float bias=max(0.000002,fwidth(depth)*1.5);
        vec2 uv=gl_FragCoord.xy/resolution;
        if(useDepth&&texture2D(attachmentMap,uv).b>.5&&depth>texture2D(depthMap,uv).r+bias)discard;
        gl_FragColor=vec4(color,1.);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const object=new THREE.Mesh(geometry,material);object.frustumCulled=false;
  const scene=new THREE.Scene();scene.add(object);
  let last={};
  return {material,update(model,view,rendered,hidden){
    const versions=rendered.group.children.filter(m=>m.userData.textured).map(m=>m.geometry.uuid+':'+m.geometry.getAttribute('position').version).join('|');
    const key=[model.model,model.revision,model.selectedIds,hidden,versions];
    if(last.key&&key.every((v,i)=>v===last.key[i]))return;last.key=key;
    const edges=selectedBlockEdges(rendered.group,model.selectedIds||new Set(),hidden),starts=[],ends=[];
    for(let i=0;i<edges.length;i+=6){starts.push(...edges.slice(i,i+3));ends.push(...edges.slice(i+3,i+6));}
    geometry.dispose();geometry.setAttribute('edgeStart',new THREE.InstancedBufferAttribute(new Float32Array(starts),3));geometry.setAttribute('edgeEnd',new THREE.InstancedBufferAttribute(new Float32Array(ends),3));geometry.instanceCount=starts.length/3;
  },draw(renderer,camera,w,h,cssWidth,color,lineWidth,target,mask=null,useLogDepth=false,sample){
    if(!geometry.instanceCount)return;
    material.uniforms.resolution.value.set(w,h);material.uniforms.lineWidth.value=Math.max(3,lineWidth*2)*w/cssWidth;material.uniforms.nearPlane.value=camera.near;
    material.uniforms.depthMap.value=mask?.depthTexture||null;
    material.uniforms.attachmentMap.value=mask?.texture||null;
    material.uniforms.useDepth.value=!!mask;
    material.uniforms.logFactor.value=useLogDepth&&camera.isPerspectiveCamera?1/Math.log2(1+camera.far):0;
    material.uniforms.color.value.setStyle(color,THREE.LinearSRGBColorSpace);
    const before=renderer.autoClear;renderer.autoClear=false;
    try{renderer.setRenderTarget(target);diagnosticRender(renderer,scene,camera,'selection outline',sample);}finally{renderer.autoClear=before;}
  },dispose(){geometry.dispose();material.dispose();}};
}
