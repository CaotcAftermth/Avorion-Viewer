import * as THREE from './vendor/three.module.js';
// Each viewport retains its targets while all viewports share one GPU context.
// Avorion PostProcessing/brightnesspass.frag: subtract the threshold, then cap
// lightness at 0.35 so bloom never overwhelms the source colour.
const BRIGHT=`varying vec2 vUv;uniform sampler2D source;uniform float threshold;
  void main(){vec4 color=max(vec4(0.),texture2D(source,vUv)-threshold);
    float lightness=color.r*.3+color.g*.59+color.b*.11+.001;
    gl_FragColor=color/lightness*min(.35,lightness);}`;
// Avorion PostProcessing/blur.vert+frag: 11 bilinear taps at odd texel offsets,
// normal-distribution weights over a radius of 10.
const BLUR=`varying vec2 vUv;uniform sampler2D source;uniform vec2 texelStep;
  float weight(float x){return .3989423*exp(-.5*x*x);}
  void main(){vec4 sum=vec4(0.);float total=0.;
    for(int i=0;i<11;i++){float ip=float(i*2-10),w=weight(ip/10.*2.5);
      sum+=texture2D(source,vUv+texelStep*(ip+.5*sign(ip)))*w;total+=w;}
    gl_FragColor=sum/total;}`;
const COPY=`varying vec2 vUv;uniform sampler2D source;void main(){gl_FragColor=texture2D(source,vUv);}`;
const QUAD_VERTEX='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const BLOOM_LEVELS=4;
const DEPTH_GLSL=`uniform sampler2D depthMap;uniform float nearPlane,farPlane,logDepth,perspective;
  float distanceAt(vec2 uv){float z=texture2D(depthMap,uv).r;
    if(logDepth>.5)return exp2(z*log2(1.+farPlane))-1.;
    if(perspective<.5)return mix(nearPlane,farPlane,z);
    return nearPlane*farPlane/(farPlane-z*(farPlane-nearPlane));
  }`;
// Hemisphere kernel, denser near the surface point.
const AO_KERNEL=Array.from({length:16},(_,i)=>{
  const a=i*2.399963,z=.15+.85*((i*7)%16)/15,r=Math.sqrt(1-z*z),scale=.1+.9*((i+1)/16)**2;
  return new THREE.Vector3(Math.cos(a)*r*scale,Math.sin(a)*r*scale,z*scale);
});
// Screen-space ambient occlusion from the resolved depth buffer. View-space
// positions come from depth; normals from neighbouring depth. A 4x4 rotation
// pattern is removed again by the 4x4 blur.
const AO=`varying vec2 vUv;uniform sampler2D selectionMap;uniform mat4 projection,projectionInverse;uniform vec2 pixel;uniform float radius;uniform vec2 tileOrigin;uniform vec3 kernel[16];
  ${DEPTH_GLSL}
  vec3 viewPos(vec2 uv){float d=distanceAt(uv);vec4 p=projectionInverse*vec4(uv*2.-1.,-1.,1.);p/=p.w;
    return perspective>.5?p.xyz*(d/-p.z):vec3(p.xy,-d);}
  void main(){
    if(texture2D(selectionMap,vUv).g<.5||texture2D(depthMap,vUv).r>=.999999){gl_FragColor=vec4(1.);return;}
    vec3 P=viewPos(vUv);
    vec3 l=P-viewPos(vUv-vec2(pixel.x,0.)),r=viewPos(vUv+vec2(pixel.x,0.))-P,b=P-viewPos(vUv-vec2(0.,pixel.y)),t=viewPos(vUv+vec2(0.,pixel.y))-P;
    vec3 N=normalize(cross(abs(l.z)<abs(r.z)?l:r,abs(b.z)<abs(t.z)?b:t));
    if(dot(N,P)>0.)N=-N;
    vec2 cell=mod(floor(gl_FragCoord.xy+tileOrigin),4.);float angle=(cell.x*4.+cell.y)*.3926991;
    vec3 seed=vec3(cos(angle),sin(angle),0.);
    vec3 T=normalize(seed-N*dot(seed,N));if(any(isnan(T)))T=normalize(cross(N,vec3(0.,1.,0.)));
    mat3 basis=mat3(T,cross(N,T),N);
    float occlusion=0.,bias=radius*.03;
    for(int i=0;i<16;i++){
      vec3 S=P+basis*kernel[i]*radius;vec4 c=projection*vec4(S,1.);vec2 uv=c.xy/c.w*.5+.5;
      if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.||texture2D(selectionMap,uv).g<.5)continue;
      float scene=distanceAt(uv);
      occlusion+=step(scene,-S.z-bias)*smoothstep(0.,1.,radius/abs(-P.z-scene));
    }
    gl_FragColor=vec4(vec3(1.-occlusion/16.),1.);
  }`;
const AO_BLUR=`varying vec2 vUv;uniform sampler2D source;uniform vec2 pixel;
  ${DEPTH_GLSL}
  void main(){float center=distanceAt(vUv),sum=0.,total=0.;
    for(int x=-2;x<2;x++)for(int y=-2;y<2;y++){vec2 uv=vUv+vec2(float(x)+.5,float(y)+.5)*pixel;
      float w=abs(distanceAt(uv)-center)<max(.5,center*.02)?1.:0.;sum+=texture2D(source,uv).r*w;total+=w;}
    gl_FragColor=vec4(vec3(total>0.?sum/total:1.),1.);}`;
export function aoActive(d,p){return !!d&&['RENDERED','MATERIAL'].includes(d.shading)&&!d.xray&&!d.ambientOnly&&p.shaderDebug===0&&p.shaderAO>0;}
export function bloomActive(d,p){return !!d&&d.shading==='RENDERED'&&!d.xray&&!d.ambientOnly&&p.shaderDebug===0&&p.shaderBloom>0;}
export function createViewportPost(samples=4,hdr=false){
  const target=new THREE.WebGLRenderTarget(1,1,hdr?{type:THREE.HalfFloatType}:{});target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const mask=new THREE.WebGLRenderTarget(1,1);
  let bloomSourceTarget;
  // Canvas antialiasing does not apply to offscreen targets. Resolve both
  // scene color/depth and selection coverage before the composite pass.
  target.samples=mask.samples=samples;
  const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{
    colorMap:{value:target.texture},depthMap:{value:target.depthTexture},selectionMap:{value:mask.texture},pixel:{value:new THREE.Vector2()},
    nearPlane:{value:1},farPlane:{value:1000},logDepth:{value:0},perspective:{value:1},focus:{value:10},blurStrength:{value:0},
    cavity:{value:0},outline:{value:0},selected:{value:0},outlineColor:{value:new THREE.Color()},selectionColor:{value:new THREE.Color()},
    bloom:{value:0},bloomMap1:{value:null},bloomMap2:{value:null},bloomMap3:{value:null},bloomMap4:{value:null},
    ao:{value:0},aoMap:{value:null},preserveAlpha:{value:0},sampleScale:{value:1}
  },vertexShader:QUAD_VERTEX,fragmentShader:`
    varying vec2 vUv;
    uniform sampler2D colorMap,depthMap,selectionMap,bloomMap1,bloomMap2,bloomMap3,bloomMap4,aoMap;
    uniform float bloom,ao,preserveAlpha,sampleScale;
    uniform vec2 pixel;
    uniform float nearPlane,farPlane,logDepth,perspective,focus,blurStrength,outline,selected,cavity;
    uniform vec3 outlineColor,selectionColor;
    float distanceAt(vec2 uv){float z=texture2D(depthMap,uv).r;
      if(logDepth>.5)return exp2(z*log2(1.+farPlane))-1.;
      if(perspective<.5)return mix(nearPlane,farPlane,z);
      return nearPlane*farPlane/(farPlane-z*(farPlane-nearPlane));
    }
    void main(){
      float z=texture2D(depthMap,vUv).r;vec4 original=texture2D(colorMap,vUv);vec3 color=original.rgb;float alpha=original.a;
      float depth=distanceAt(vUv),radius=min(9.*sampleScale,abs(depth-focus)/max(depth,.001)*blurStrength*sampleScale);
      if(radius>.1&&z<.999999){vec3 sum=color;float alphaSum=alpha;float weight=1.;for(int i=0;i<12;i++){
        float angle=float(i)*6.2831853/12.;vec2 uv=vUv+vec2(cos(angle),sin(angle))*pixel*radius;
        float other=distanceAt(uv);if(abs(other-depth)<max(1.,depth*.2)){sum+=texture2D(colorMap,uv).rgb;alphaSum+=texture2D(colorMap,uv).a;weight+=1.;}
      }color=sum/weight;alpha=alphaSum/weight;}
      if(ao>0.)color*=clamp(1.-ao*(1.-texture2D(aoMap,vUv).r),0.,1.);
      // Avorion PostProcessing/addbloom.frag adds the four blurred levels at 0.9.
      if(bloom>0.){vec3 glow=texture2D(bloomMap1,vUv).rgb+texture2D(bloomMap2,vUv).rgb+texture2D(bloomMap3,vUv).rgb+texture2D(bloomMap4,vUv).rgb;
        color+=max(vec3(0.),glow*bloom*.9);}
      float edge=0.,selEdge=0.;vec2 own=texture2D(selectionMap,vUv).rg;
      for(int i=0;i<4;i++){
        vec2 delta=(i==0?vec2(pixel.x,0.):i==1?vec2(-pixel.x,0.):i==2?vec2(0.,pixel.y):vec2(0.,-pixel.y))*sampleScale;
        float other=texture2D(depthMap,vUv+delta).r;
        vec2 adjacent=texture2D(selectionMap,vUv+delta).rg;
        edge=max(edge,abs(own.g-adjacent.g));
        selEdge=max(selEdge,abs(own.r-adjacent.r));
      }
      // Paired depth samples cancel planar slopes; only nearby concave changes darken.
      // The object mask excludes the background and overlay guides.
      if(cavity>0.&&own.g>.5&&z<.999999){
        float crease=0.;float scale=max(length(vec2(dFdx(depth),dFdy(depth)))*3.,depth*.001);
        for(int i=0;i<4;i++){
          float angle=float(i)*3.14159265/4.;vec2 offset=vec2(cos(angle),sin(angle))*pixel*3.*sampleScale;
          vec2 a=vUv+offset,b=vUv-offset;
          if(texture2D(selectionMap,a).g>.5&&texture2D(selectionMap,b).g>.5){
            float da=distanceAt(a),db=distanceAt(b);
            float bend=max(0.,depth-(da+db)*.5);
            float nearby=1.-smoothstep(scale*4.,scale*12.,max(abs(da-depth),abs(db-depth)));
            crease+=smoothstep(scale*.15,scale*1.5,bend)*nearby;
          }
        }
        color*=1.-cavity*.5*crease/4.;
      }
      color=mix(color,outlineColor,edge*outline);color=mix(color,selectionColor,selEdge*selected);
      if(preserveAlpha>.5){
        // RGB is premultiplied in the scene target. Add coverage for glow and outlines.
        alpha=max(alpha,max(max(color.r,color.g),color.b));
        alpha=max(alpha,max(edge*outline,selEdge*selected));
      }else alpha=1.;
      gl_FragColor=vec4(color,clamp(alpha,0.,1.));
    }`});
  const scene=new THREE.Scene(),camera=new THREE.Camera(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(quad);
  const pass=fragmentShader=>new THREE.ShaderMaterial({depthTest:false,depthWrite:false,vertexShader:QUAD_VERTEX,fragmentShader,
    uniforms:{source:{value:null},threshold:{value:1},texelStep:{value:new THREE.Vector2()}}});
  const bright=pass(BRIGHT),blur=pass(BLUR),copy=pass(COPY);
  const depthUniforms=()=>({depthMap:{value:target.depthTexture},nearPlane:{value:1},farPlane:{value:1000},logDepth:{value:0},perspective:{value:1},pixel:{value:new THREE.Vector2()}});
  const aoPass=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,vertexShader:QUAD_VERTEX,fragmentShader:AO,uniforms:{...depthUniforms(),
    selectionMap:{value:mask.texture},projection:{value:new THREE.Matrix4()},projectionInverse:{value:new THREE.Matrix4()},radius:{value:1},tileOrigin:{value:new THREE.Vector2()},kernel:{value:AO_KERNEL}}});
  const aoBlur=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,vertexShader:QUAD_VERTEX,fragmentShader:AO_BLUR,uniforms:{...depthUniforms(),source:{value:null}}});
  const aoTargets=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{depthBuffer:false}));
  const renderAO=(renderer,sourceCamera,u,radius)=>{
    for(const m of [aoPass,aoBlur])for(const k of ['nearPlane','farPlane','logDepth','perspective','pixel'])m.uniforms[k].value=u[k].value;
    aoPass.uniforms.projection.value.copy(sourceCamera.projectionMatrix);aoPass.uniforms.projectionInverse.value.copy(sourceCamera.projectionMatrixInverse);aoPass.uniforms.radius.value=radius;
    quad.material=aoPass;renderer.setRenderTarget(aoTargets[0]);renderer.render(scene,camera);
    aoBlur.uniforms.source.value=aoTargets[0].texture;quad.material=aoBlur;renderer.setRenderTarget(aoTargets[1]);renderer.render(scene,camera);
    quad.material=material;
  };
  const levelTarget=()=>new THREE.WebGLRenderTarget(1,1,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:false});
  const levels=Array.from({length:BLOOM_LEVELS},()=>({target:levelTarget(),scratch:levelTarget()}));
  const run=(renderer,program,source,output)=>{program.uniforms.source.value=source;quad.material=program;renderer.setRenderTarget(output);renderer.render(scene,camera);};
  // Each level halves the previous one, so the four blurs widen together.
  const renderBloom=(renderer,threshold,scale=1,source=target.texture)=>{
    bright.uniforms.threshold.value=threshold;
    levels.forEach((level,i)=>{
      if(i===0)run(renderer,bright,source,level.target);else run(renderer,copy,levels[i-1].target.texture,level.target);
      blur.uniforms.texelStep.value.set(scale/level.target.width,0);run(renderer,blur,level.target.texture,level.scratch);
      blur.uniforms.texelStep.value.set(0,scale/level.target.height);run(renderer,blur,level.scratch.texture,level.target);
    });
    quad.material=material;
  };
  return {target,mask,dispose(){bloomSourceTarget?.dispose();target.dispose();mask.dispose();material.dispose();quad.geometry.dispose();for(const m of [bright,blur,copy,aoPass,aoBlur])m.dispose();aoTargets.forEach(t=>t.dispose());for(const l of levels){l.target.dispose();l.scratch.dispose();}},draw(renderer,sourceCamera,d,useLog,p,selected,outputTarget=null,output=null,renderBloomSource=null){
    const u=material.uniforms;u.preserveAlpha.value=output?.transparent?1:0;u.sampleScale.value=d.imageSampleScale||1;u.pixel.value.set(1/target.width,1/target.height);u.nearPlane.value=sourceCamera.near;u.farPlane.value=sourceCamera.far;u.logDepth.value=useLog;
    u.perspective.value=sourceCamera.isPerspectiveCamera?1:0;u.focus.value=d.focusDistance;u.blurStrength.value=d.dof&&d.shading==='RENDERED'?20/d.aperture:0;
    u.cavity.value=d.ambientOnly&&d.shading!=='WIREFRAME'&&!d.xray&&p.shaderDebug===0?(d.ambientDetail??.35):0;
    u.outline.value=d.objectOutline?1:0;u.selected.value=selected?1:0;u.outlineColor.value.setStyle(d.outlineColor,THREE.LinearSRGBColorSpace);u.selectionColor.value.setStyle(p.accent,THREE.LinearSRGBColorSpace);
    const ao=aoActive(d,p)?p.shaderAO:0;u.ao.value=ao;
    aoPass.uniforms.tileOrigin.value.set(output?.tile?.x||0,output?.tile?(output.fullHeight-output.tile.y-output.tile.height):0);
    if(ao>0){renderAO(renderer,sourceCamera,u,p.shaderAORadius);u.aoMap.value=aoTargets[1].texture;}
    const bloom=bloomActive(d,p)?p.shaderBloom:0;u.bloom.value=bloom;
    if(bloom>0){
      let source=target.texture;
      if(renderBloomSource){
        bloomSourceTarget??=new THREE.WebGLRenderTarget(1,1,{type:target.texture.type});
        bloomSourceTarget.samples=samples;bloomSourceTarget.setSize(target.width,target.height);
        renderer.setRenderTarget(bloomSourceTarget);renderBloomSource();source=bloomSourceTarget.texture;
      }
      renderBloom(renderer,p.shaderBloomThreshold,d.imageSampleScale||1,source);levels.forEach((level,i)=>{u['bloomMap'+(i+1)].value=level.target.texture;});}
    renderer.setRenderTarget(outputTarget);renderer.render(scene,camera);
  },resize(w,h){if(target.width!==w||target.height!==h){target.setSize(w,h);mask.setSize(w,h);aoTargets.forEach(t=>t.setSize(w,h));
    levels.forEach((level,i)=>{const lw=Math.max(1,w>>(i+1)),lh=Math.max(1,h>>(i+1));level.target.setSize(lw,lh);level.scratch.setSize(lw,lh);});}}};
}
