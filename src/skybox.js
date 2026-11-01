import * as THREE from './vendor/three.module.js';
import { WORLD_DEFAULTS, skyKey, skySpecification } from './sky-settings.js';

const fragmentShader=`
precision highp sampler2DArray;
uniform sampler2DArray stamps;
uniform vec4 cloud[48], tint[48], cloudLayout[48], darkCloud[16], darkLayout[16], stars[40];
uniform vec3 hazeColor;
uniform float count, nebula, highlights, darkness, dust, density, starBrightness, sun, brightness, seed;
varying vec3 direction;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
float stamp(vec3 d,vec4 c,vec4 l){
  float forward=dot(d,c.xyz);if(forward<=.05)return 0.;
  vec3 right=normalize(cross(abs(c.y)>.95?vec3(1,0,0):vec3(0,1,0),c.xyz));vec3 up=cross(c.xyz,right);
  vec2 uv=vec2(dot(d,right),dot(d,up))/(forward*c.w);
  uv=mat2(cos(l.x),-sin(l.x),sin(l.x),cos(l.x))*uv*.5+.5;
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))return 0.;
  float edge=smoothstep(0.,.09,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
  return texture(stamps,vec3(uv,l.y)).r*edge;
}
void main(){
  vec3 d=normalize(direction);float n=0.,amplitude=.5;vec3 q=d*3.+seed;
  for(int i=0;i<5;i++){n+=noise3(q)*amplitude;q*=2.;amplitude*=.5;}
  vec3 color=hazeColor*n*.012*nebula;
  for(int i=0;i<48;i++){if(float(i)>=count)break;float t=stamp(d,cloud[i],cloudLayout[i]);vec3 h=mix(tint[i].rgb,vec3(1),.75)*highlights;color+=(t*tint[i].rgb+(pow(t,2.)*.75+pow(t,8.)*.75+pow(t,16.)*.5)*h)*tint[i].a*nebula;}
  for(int i=0;i<16;i++){float t=stamp(d,darkCloud[i],darkLayout[i]);color*=max(.08,1.-t*1.5*darkness);float fog=stamp(d,darkCloud[i],vec4(darkLayout[i].x,darkLayout[i].y+10.,0,0));color+=fog*hazeColor*dust*.025;}
  // A continuous 3D direction field avoids independent cube-face randomness.
  vec3 p=d*330.;vec3 cell=floor(p);vec3 f=fract(p)-.5;float h=hash(cell+seed);
  float point=pow(max(0.,1.-length(f)*2.),8.);
  float visible=step(1.-min(.3,density*.045),h);
  vec3 starColor=mix(vec3(.65,.8,1),vec3(1,.83,.62),hash(cell+17.));
  color+=point*visible*starColor*starBrightness*(1.-dust*.65)*(1.+h)*smoothstep(.15,.65,n);
  for(int i=0;i<40;i++){float t=stamp(d,stars[i],vec4(0,20.+mod(float(i),3.),0,0));color+=t*starColor*starBrightness*(i==0?sun:1.)*.8;}
  color=max(vec3(0),1.0196*(color*255.-128.)/255.+128./255.);
  gl_FragColor=vec4(clamp(color*brightness,0.,1.),1);
}`;

export function createSkybox(onReady=()=>{}){
  let atlas,target,flatTarget,key='',failed=false,disposed=false;
  const flatScene=new THREE.Scene(),flatCamera=new THREE.PerspectiveCamera();
  const size=256,names=[...Array.from({length:10},(_,i)=>`bg${i}.png`),...Array.from({length:10},(_,i)=>`fog${i}.bmp`),...Array.from({length:3},(_,i)=>`star${i}.bmp`)];
  const uniforms={stamps:{value:null}};
  for(const [name,length] of [['cloud',48],['tint',48],['cloudLayout',48],['darkCloud',16],['darkLayout',16],['stars',40]])uniforms[name]={value:Array.from({length},()=>new THREE.Vector4())};
  uniforms.hazeColor={value:new THREE.Vector3()};
  for(const name of ['count','nebula','highlights','darkness','dust','density','starBrightness','sun','brightness','seed'])uniforms[name]={value:0};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader,side:THREE.BackSide,depthTest:false,depthWrite:false});
  const geometry=new THREE.BoxGeometry(2,2,2),scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));
  const ready=Promise.all(names.map(async name=>{
    const image=new Image();image.src=new URL('./assets/sky/'+name,import.meta.url).href;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,size,size);return ctx.getImageData(0,0,size,size).data;
  })).then(images=>{
    if(disposed)return;const data=new Uint8Array(size*size*4*images.length);images.forEach((image,i)=>data.set(image,i*size*size*4));
    atlas=new THREE.DataArrayTexture(data,size,size,images.length);atlas.minFilter=atlas.magFilter=THREE.LinearFilter;atlas.needsUpdate=true;uniforms.stamps.value=atlas;onReady();
  }).catch(error=>{failed=true;console.warn('Skybox textures unavailable:',error);onReady();});
  return {
    ready,
    get status(){return failed?'Sky textures unavailable':atlas?'Ready':'Loading sky textures';},
    texture(renderer,preferences){
      const p={...WORLD_DEFAULTS,...preferences};if(!p.worldEnabled||!atlas)return null;
      const next=skyKey(p);if(key===next&&target)return target.texture;
      const specification=skySpecification(p),u=uniforms;
      specification.clouds.forEach((c,i)=>{u.cloud.value[i].set(...c.direction,c.size);u.tint.value[i].set(...c.color,c.alpha);u.cloudLayout.value[i].set(c.rotation,c.type,0,0);});
      specification.dark.forEach((c,i)=>{u.darkCloud.value[i].set(...c.direction,c.size);u.darkLayout.value[i].set(c.rotation,c.type,0,0);});
      specification.stars.forEach((s,i)=>u.stars.value[i].set(...s.direction,s.size));
      u.hazeColor.value.set(...specification.colors[0]);
      for(const [name,value] of Object.entries({count:specification.clouds.length,nebula:p.worldNebula,highlights:p.worldHighlights,darkness:p.worldDarkClouds,dust:p.worldDust,density:specification.density,starBrightness:p.worldStars===0?0:p.worldStarBrightness,sun:p.worldSun,brightness:p.worldBrightness,seed:specification.offset}))u[name].value=value;
      const replacement=new THREE.WebGLCubeRenderTarget(p.worldResolution,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
      const camera=new THREE.CubeCamera(.1,10,replacement),saved=renderer.getRenderTarget();
      try{camera.update(renderer,scene);}catch(error){replacement.dispose();throw error;}finally{renderer.setRenderTarget(saved);}
      target?.dispose();target=replacement;key=next;return target.texture;
    },
    orthographicBackground(renderer,texture,camera,width,height,focal,rotation,tile=null){
      // Cube backgrounds assume a perspective projection. Render the distant sky
      // separately, retaining camera orientation but ignoring position and zoom.
      flatTarget??=new THREE.WebGLRenderTarget(width,height);
      flatTarget.setSize(tile?.width||width,tile?.height||height);flatScene.background=texture;
      flatScene.backgroundRotation.set(0,rotation,0);
      flatCamera.quaternion.copy(camera.quaternion);flatCamera.aspect=width/height;
      flatCamera.clearViewOffset();flatCamera.fov=2*Math.atan(height/(2*focal))*180/Math.PI;flatCamera.updateProjectionMatrix();
      if(tile)flatCamera.setViewOffset(width,height,tile.x,tile.y,tile.width,tile.height);
      const saved=renderer.getRenderTarget();
      try{renderer.setRenderTarget(flatTarget);renderer.render(flatScene,flatCamera);}finally{renderer.setRenderTarget(saved);}
      return flatTarget.texture;
    },
    dispose(){flatTarget?.dispose();disposed=true;target?.dispose();atlas?.dispose();geometry.dispose();material.dispose();}
  };
}

