// Optional WebGL2 hull-ray caster for weapon coverage. The CPU block BVH is
// flattened into float textures and traversed per ray in a fragment shader.
// It answers only "first hull triangle along this bounded ray"; aiming, turret
// geometry and classification stay on the CPU. Rays the shader cannot finish
// (stack or iteration limits) are reported back for an exact CPU retry.
const TEX_WIDTH=4096,RAY_WIDTH=256,MAX_BATCH=RAY_WIDTH*256;

export function flattenTree(tree){
 const nodes=[],tris=[],ids=[],idIndex=new Map();
 const shift=tree?[0,1,2].map(i=>(tree.box.min.getComponent(i)+tree.box.max.getComponent(i))/2):[0,0,0];
 function visit(node){
  const index=nodes.length;nodes.push(null);
  const min=[node.box.min.x-shift[0],node.box.min.y-shift[1],node.box.min.z-shift[2]],max=[node.box.max.x-shift[0],node.box.max.y-shift[1],node.box.max.z-shift[2]];
  if(node.items){
   const start=tris.length/12;
   for(const e of node.items){
    if(!idIndex.has(e.id)){idIndex.set(e.id,ids.length);ids.push(e.id);}
    const id=idIndex.get(e.id);
    for(let i=0;i<e.points.length;i+=3){
     const [a,b,c]=[e.points[i],e.points[i+1],e.points[i+2]];
     tris.push(a.x-shift[0],a.y-shift[1],a.z-shift[2],id,b.x-a.x,b.y-a.y,b.z-a.z,0,c.x-a.x,c.y-a.y,c.z-a.z,0);
    }
   }
   nodes[index]=[...min,-(start+1),...max,tris.length/12-start];
  }else{
   const left=node.left?visit(node.left):-1,right=node.right?visit(node.right):-1;
   nodes[index]=[...min,left,...max,right];
  }
  return index;
 }
 if(tree)visit(tree);
 return {nodes:Float32Array.from(nodes.flat()),tris:Float32Array.from(tris),ids,shift,nodeCount:nodes.length,triCount:tris.length/12};
}

const vertex=`#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
const fragment=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D nodes,tris,rayOrigin,rayDirection;uniform int rayCount,empty;
out vec4 color;
vec4 fetch(sampler2D s,int i){int w=textureSize(s,0).x;return texelFetch(s,ivec2(i%w,i/w),0);}
void main(){
 int r=int(gl_FragCoord.y)*${RAY_WIDTH}+int(gl_FragCoord.x);
 if(r>=rayCount||empty==1){color=vec4(-1.0,-1.0,0.0,1.0);return;}
 vec4 o4=fetch(rayOrigin,r),d4=fetch(rayDirection,r);
 vec3 o=o4.xyz,d=d4.xyz;float nearest=o4.w,eps=d4.w,hitT=-1.0,hitId=-1.0,uncertain=0.0;
 vec3 safe=vec3(abs(d.x)<1e-12?1e-12:d.x,abs(d.y)<1e-12?1e-12:d.y,abs(d.z)<1e-12?1e-12:d.z),inv=1.0/safe;
 int stack[64];int sp=0;stack[sp++]=0;int iter=0;
 while(sp>0){
  if(++iter>65536){uncertain=1.0;break;}
  int n=stack[--sp];vec4 a=fetch(nodes,2*n),b=fetch(nodes,2*n+1);
  vec3 t0=(a.xyz-o)*inv,t1=(b.xyz-o)*inv,lo=min(t0,t1),hi=max(t0,t1);
  float enter=max(max(lo.x,lo.y),max(lo.z,0.0)),exit=min(min(hi.x,hi.y),hi.z);
  if(enter>exit||enter>nearest)continue;
  if(a.w>=0.0){
   if(sp>61){uncertain=1.0;continue;}
   if(b.w>=0.0)stack[sp++]=int(b.w);stack[sp++]=int(a.w);continue;
  }
  int start=int(-a.w)-1,count=int(b.w);
  for(int k=0;k<count;k++){
   int t=start+k;vec4 v0=fetch(tris,3*t),e1=fetch(tris,3*t+1),e2=fetch(tris,3*t+2);
   vec3 p=cross(d,e2.xyz);float det=dot(e1.xyz,p);if(det==0.0)continue;
   float f=1.0/det;vec3 s=o-v0.xyz;float u=dot(s,p)*f;if(u<0.0||u>1.0)continue;
   vec3 q=cross(s,e1.xyz);float v=dot(d,q)*f;if(v<0.0||u+v>1.0)continue;
   float dist=dot(e2.xyz,q)*f;
   if(dist>eps&&dist<nearest-eps){nearest=dist;hitT=dist;hitId=v0.w;}
  }
 }
 color=vec4(hitT,hitId,uncertain,1.0);
}`;

export function gpuAvailable(){
 try{const gl=new OffscreenCanvas(1,1).getContext('webgl2');return !!gl&&!!gl.getExtension('EXT_color_buffer_float');}catch{return false;}
}
export function createGpuCaster(tree){
 const flat=flattenTree(tree),gl=new OffscreenCanvas(1,1).getContext('webgl2',{antialias:false,depth:false,stencil:false});
 if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 float render targets are unavailable.');
 const max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'GPU shader compile failed.');return s;};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'GPU program link failed.');
 function texture(unit,data,texels){
  const width=Math.min(TEX_WIDTH,Math.max(1,texels)),height=Math.max(1,Math.ceil(texels/TEX_WIDTH));
  if(height>max)throw Error('Hull is too large for GPU textures.');
  const padded=new Float32Array(width*height*4);padded.set(data.subarray(0,Math.min(data.length,padded.length)));
  const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
  for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,padded);return t;
 }
 const textures=[texture(0,flat.nodes,flat.nodeCount*2||1),texture(1,flat.tris,flat.triCount*3||1)];
 const output=gl.createTexture();gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,output);
 for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,RAY_WIDTH,MAX_BATCH/RAY_WIDTH,0,gl.RGBA,gl.FLOAT,null);
 const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,output,0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GPU float framebuffer is incomplete.');
 gl.useProgram(program);
 for(const [name,unit] of [['nodes',0],['tris',1],['rayOrigin',2],['rayDirection',3]])gl.uniform1i(gl.getUniformLocation(program,name),unit);
 gl.uniform1i(gl.getUniformLocation(program,'empty'),flat.nodeCount?0:1);
 const countLocation=gl.getUniformLocation(program,'rayCount'),vao=gl.createVertexArray();gl.bindVertexArray(vao);
 let rayTextures=[];
 // rays: [{origin:Vector3,direction:Vector3,limit,epsilon}] in ship coordinates.
 // Returns per ray null, a hit {blockId,distance,point}, or {uncertain:true}.
 function castBatch(rays){
  const origin=new Float32Array(rays.length*4),direction=new Float32Array(rays.length*4),s=flat.shift;
  rays.forEach((r,i)=>{origin.set([r.origin.x-s[0],r.origin.y-s[1],r.origin.z-s[2],r.limit],i*4);direction.set([r.direction.x,r.direction.y,r.direction.z,r.epsilon],i*4);});
  for(const t of rayTextures)gl.deleteTexture(t);
  const width=RAY_WIDTH,height=Math.ceil(rays.length/RAY_WIDTH),upload=(unit,data)=>{const padded=new Float32Array(width*height*4);padded.set(data);const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,padded);return t;};
  rayTextures=[upload(2,origin),upload(3,direction)];
  gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,width,height);gl.uniform1i(countLocation,rays.length);gl.drawArrays(gl.TRIANGLES,0,3);
  const pixels=new Float32Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,pixels);
  return rays.map((r,i)=>{
   const t=pixels[i*4],id=pixels[i*4+1];if(pixels[i*4+2]>0)return {uncertain:true};if(!(t>=0))return null;
   return {blockId:flat.ids[Math.round(id)],distance:t,point:[r.origin.x+r.direction.x*t,r.origin.y+r.direction.y*t,r.origin.z+r.direction.z*t]};
  });
 }
 return {
  triangles:flat.triCount,
  cast(rays){const out=[];for(let i=0;i<rays.length;i+=MAX_BATCH)out.push(...castBatch(rays.slice(i,i+MAX_BATCH)));return out;},
  dispose(){for(const t of [...textures,...rayTextures,output])gl.deleteTexture(t);gl.deleteFramebuffer(framebuffer);gl.deleteProgram(program);gl.deleteVertexArray(vao);gl.getExtension('WEBGL_lose_context')?.loseContext();}
 };
}
