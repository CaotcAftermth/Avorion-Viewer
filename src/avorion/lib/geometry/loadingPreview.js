// Temporary textured surface while full game shaders prepare asynchronously.
export const LOADING_PREVIEW_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
#include <logdepthbuf_pars_fragment>
out vec4 outColor;
uniform sampler2DArray uAlbedo,uAux;
uniform float uTileScale,uExposure,uCull,uDepthPass,uMaskPass,uXray,uDisplayMode,uShadeSelected;
uniform vec3 uLightDir,uLightColor,uAmbientFill,uSelectColor;
varying vec3 vTexturePosition,vWorldNormal;
flat in vec4 vColor,vSecondary,vLayers,vParams,vSurface;
varying vec2 vFaceUV;
flat in float vSeamFace;
vec4 sampleMap(sampler2DArray map,float layer,vec3 p,vec3 w){
 return texture(map,vec3(p.zy,layer))*w.x+texture(map,vec3(p.xz,layer))*w.y+texture(map,vec3(p.xy,layer))*w.z;
}
void main(){
 #include <logdepthbuf_fragment>
 float flags=mod(vParams.y,64.);
 if(vParams.w<-.5)discard;
 if(uCull>.5&&!gl_FrontFacing&&mod(floor(flags/32.),2.)<.5)discard;
 vec3 n=normalize(vWorldNormal);if(!gl_FrontFacing)n=-n;
 vec3 w=pow(abs(n),vec3(8.));w/=max(dot(w,vec3(1.)),.0001);
 vec3 p=vTexturePosition*uTileScale;
 vec4 tex=sampleMap(uAlbedo,vLayers.x,p,w);
 vec3 color=tex.rgb*vColor.rgb;
 if(vLayers.z>.5){vec4 mask=sampleMap(uAux,vLayers.z,p,w);color=mix(color,tex.rgb*vSecondary.rgb,mask.a);}
 float alpha=vColor.a;if(vSurface.z==9.)alpha*=.35;
 if(uXray>=0.)alpha*=uXray;
 if(uDisplayMode==1.)color=vColor.rgb;
 if(vParams.w>.5&&uShadeSelected>.5)color=mix(color,uSelectColor,.25);
 color*=max(vec3(.3),uAmbientFill*.5)+max(dot(n,-uLightDir),0.)*uLightColor;
 if(uDepthPass>.5)color=vec3(1.);
 outColor=vec4(color*uExposure,alpha);
}
`;
