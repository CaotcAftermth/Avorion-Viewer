// ---------------------------------------------------------------------------
// Game shader: a WebGL2 port of Avorion's data/shaders/blocks/block.vert +
// armor.frag / armormask.frag / colorableoverlay.frag lighting model.
//
// What the game does (and what is reproduced here):
//   texWorld = world position projected on the face plane * 0.1
//   texColor = plating(texWorld) * blockColor
//   texColor = mix(texColor, plating * secondaryColor, mask.a)
//   texColor = mix(texColor, overlay.rgb, overlay.a)
//   N        = TBN * (decodedNormalMap.rgb * 2 - 1)
//   light    = max(dot(N, -lightDir), 0) * lightColor
//            + sum over 6 axes of max(dot(N, axis), 0) * ambient[axis]
//   color    = texColor * light
//            + sky(reflect(eye, N)) * fresnel(minRefl, maxRefl)
//            + pow(dot(reflect, -lightDir), gloss) * specularity * plating.r
//   color    = mix(color, glow.rgb * 2, glow.a)
//
// The face-plane projection is done as triplanar mapping (world position
// projected on the three axis planes, blended by the normal), which is
// exactly the game's per-face projection on axis-aligned faces and a
// smooth blend on sloped ones. Textures live in 2D array textures so the
// whole ship draws with one material; per-vertex attributes carry color,
// secondary color, layer indices and flags.
// ---------------------------------------------------------------------------
import * as THREE from "../../../vendor/three.module.js";
import { THRUSTER_PITCH_GLSL } from "./thrusterPorts.js";
import { DEFAULT_GAME_SHADER } from "../../types/index.js";
import { SPILL_GLSL, emptySpillGrid } from "./blockLights.js";
export { DEFAULT_GAME_SHADER };
/** Flag bits packed into aParams.y */
export const FLAG_DOUBLE_SIDED = 32;
export const FLAG_TINT = 1;
export const FLAG_EMISSIVE = 2;
export const FLAG_TRANSLUCENT = 4;
export const FLAG_CUTOUT = 8;
export const FLAG_OVERLAY_SECONDARY = 16;
const VERT = /* glsl */ `
#ifdef BLOCK_INSTANCED
attribute vec3 aOffset;
#endif
attribute vec3 aBary;
attribute vec3 aEdges;
varying vec3 vBary;
flat out vec3 vEdges;
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 aColor;
attribute vec4 aSecondary;
attribute vec4 aLayers;   // albedo, normal, mask, overlay
attribute vec4 aParams;   // glow layer, flags, reflect scale, selected
attribute vec2 aFaceUV;
attribute vec4 aSurface;  // physical face width/height, surface kind, overlay normal layer
attribute vec4 aSide; // rest-space position and face side, packed to preserve attribute budget
flat out float vSide;
attribute vec4 aWindow;
flat out vec4 vWindow;
attribute vec3 aEmission; // material's default effect color
attribute vec2 aMaterialLayers; // plating accent and glow, independent of decals
attribute float aSeamSides; // ship-space sides touching another block (bit per -X,+X,-Y,+Y,-Z,+Z)
flat out float vSeamFace;

varying vec3 vTexturePosition;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vModelPos;
// Block metadata is constant on every triangle. Smooth interpolation can turn
// an integer flag of 1 into 0.99999994, causing floor() to switch tint bits.
flat out vec4 vColor;
flat out vec4 vSecondary;
flat out vec4 vLayers;
flat out vec4 vParams;
varying vec2 vFaceUV;
flat out vec4 vSurface;
flat out vec3 vEmission;
flat out vec2 vMaterialLayers;

void main() {
  vBary=aBary;vEdges=aEdges;
  vec3 blockPosition=position;
  vec3 texturePosition=aSide.xyz;
  #ifdef BLOCK_INSTANCED
  blockPosition+=aOffset;
  texturePosition+=aOffset;
  #endif
  vec4 wp = modelMatrix * vec4(blockPosition, 1.0);
  vWorldPos = wp.xyz;
  vTexturePosition=texturePosition;
  vModelPos = blockPosition;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vColor = aColor;
  vSecondary = aSecondary;
  vLayers = aLayers;
  vParams = aParams;
  vFaceUV = aFaceUV;
  vSurface = aSurface;
  vSide = aSide.w;
  vWindow = aWindow;
  vEmission = aEmission;
  vMaterialLayers = aMaterialLayers;
  // Flag axis-aligned faces pressed against a neighbouring block.
  vec3 axisNormal = abs(normal);
  float seamSide = axisNormal.x > .999 ? (normal.x > 0. ? 1. : 0.) : axisNormal.y > .999 ? (normal.y > 0. ? 3. : 2.) : axisNormal.z > .999 ? (normal.z > 0. ? 5. : 4.) : -1.;
  vSeamFace = seamSide < 0. ? 0. : mod(floor(aSeamSides / exp2(seamSide) + .001), 2.);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;
const FRAG = /* glsl */ `
varying vec3 vBary;
flat in vec3 vEdges;
uniform float uAmbientOnly;
uniform float uAmbientDetail;
uniform float uDisplayMode,uMatcap,uCull,uXray,uWireOverlay,uWireThreshold,uWireOpacity,uMaskPass;
precision highp float;
precision highp sampler2DArray;
#include <logdepthbuf_pars_fragment>
out vec4 outColor;
#define gl_FragColor outColor

uniform sampler2DArray uAlbedo;
uniform sampler2DArray uNormal;
uniform sampler2DArray uAux;
uniform float uTileScale;
uniform float uExposure;
uniform float uBlueprint,uLineScale;
flat in float vSide;
flat in vec4 vWindow;
uniform vec3 uWindowColor;
uniform float uWindowStrength;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient[6];   // +x -x +y -y +z -z
uniform vec3 uAmbientFill;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyBottom;
uniform float uMinRefl;
uniform float uMaxRefl;
uniform float uGloss;
uniform float uSpecular;
uniform float uNormalStrength;
uniform float uSharpness;
uniform float uSecondaryFactor;
uniform float uGlowStrength;
uniform float uHologramGlow;
uniform float uFogStrength;
uniform vec3 uSelectColor;
uniform vec3 uPaintColor;
uniform vec3 uRegionColor;
uniform vec3 uMirrorOrigin;
uniform vec3 uMirrorVisible;
uniform float uDebug;   // 0 off, 1 albedo, 2 mask, 3 normal, 4 weights, 5 lighting
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowStrength;
uniform float uDepthPass;

varying vec3 vTexturePosition;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vModelPos;
${SPILL_GLSL}
flat in vec4 vColor;
flat in vec4 vSecondary;
flat in vec4 vLayers;
flat in vec4 vParams;
varying vec2 vFaceUV;
flat in vec4 vSurface;
flat in vec3 vEmission;
flat in vec2 vMaterialLayers;
flat in float vSeamFace;

bool hasFlag(float flags, float bit) { return mod(floor(flags / bit), 2.0) >= 1.0; }

// Derivatives must be evaluated before branching on per-block texture layers
// or discarding cutout fragments. Implicit derivatives there are undefined.
vec3 dpdx;
vec3 dpdy;
vec2 faceDx;
vec2 faceDy;
vec3 worldDx;
vec3 worldDy;
vec3 shadowCoord;
vec3 shadowDx;
vec3 shadowDy;

vec4 sampleFace(sampler2DArray tex, float layer, float scale) {
  vec4 result = textureLod(tex, vec3(0.0), 0.0);
  // Keep a face decal inside its layer instead of wrapping into the next tile.
  vec2 uv = scale == 1.0 ? clamp(vFaceUV, vec2(0.001), vec2(0.999)) : vFaceUV * scale;
  if (layer >= 0.5) result = textureGrad(tex, vec3(uv, layer), faceDx * scale, faceDy * scale);
  return result;
}

// Native functional bindings use local coordinates with inversion enabled.
vec4 sampleDecal(sampler2DArray tex, float layer) {
  if (layer < 0.5) return textureLod(tex, vec3(0.0), 0.0);
  return textureGrad(tex, vec3(clamp(1.0 - vFaceUV, vec2(0.001), vec2(0.999)), layer), -faceDx, -faceDy);
}

vec3 faceNormal(vec3 decoded, vec3 n) {
  float det = faceDx.x * faceDy.y - faceDx.y * faceDy.x;
  if (abs(det) < 1e-12) return n;
  vec3 tangent = normalize((worldDx * faceDy.y - worldDy * faceDx.y) / det);
  vec3 bitangent = normalize(cross(n, tangent));
  return normalize(n * max(decoded.z, 0.001) + (tangent * decoded.x + bitangent * decoded.y) * uNormalStrength);
}

${THRUSTER_PITCH_GLSL}
// The physical mask and CPU emitters use the same calibrated pitch.
float thrusterPlating(vec2 uv, vec2 size, vec2 dx, vec2 dy) {
  float pitch = thrusterPitch(size);
  vec2 point = (uv - 0.5) * size;
  vec2 cell = fract(point / pitch + 0.5) - 0.5;
  float footprint = max(length(dx * size), length(dy * size)) / pitch;
  float aa = max(0.002, footprint * 0.5);
  float hole = 1.0 - smoothstep(0.24 - aa, 0.32 + aa, length(cell));
  vec2 border = min(vec2(0.3 * (pitch / 0.4)), size * 0.25);
  vec2 edge = min(uv, 1.0 - uv) * size;
  float borderFade = clamp(edge.x / border.x, 0.0, 1.0) * clamp(edge.y / border.y, 0.0, 1.0);
  float resolved = pow(clamp(1.0 - hole * borderFade + 0.1, 0.0, 1.0), 12.0);
  // Average the final coverage, not the input to the nonlinear power curve.
  return mix(resolved, mix(1.0, 0.7537, borderFade), smoothstep(0.5, 1.5, footprint));
}

vec3 triWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(uSharpness));
  return w / (w.x + w.y + w.z);
}

vec4 sampleTriScaled(sampler2DArray tex, float layer, vec3 p, vec3 w, float scale) {
  vec4 result = textureLod(tex, vec3(0.0, 0.0, 0.0), 0.0); // fallback layer, uniform
  if (layer >= 0.5) {
    vec4 x = textureGrad(tex, vec3(p.zy * scale, layer), dpdx.zy * scale, dpdy.zy * scale);
    vec4 y = textureGrad(tex, vec3(p.xz * scale, layer), dpdx.xz * scale, dpdy.xz * scale);
    vec4 z = textureGrad(tex, vec3(p.xy * scale, layer), dpdx.xy * scale, dpdy.xy * scale);
    result = x * w.x + y * w.y + z * w.z;
  }
  return result;
}
vec4 sampleTri(sampler2DArray tex, float layer, vec3 p, vec3 w) {
  return sampleTriScaled(tex, layer, p, w, 1.0);
}

vec3 sampleNormalTri(float layer, vec3 p, vec3 w, vec3 n, float scale) {
  if (layer < 0.5) return n;
  // Browser image decoding already converts BMP's BGR storage to RGB.
  // Swapping again turns a flat (128,128,255) normal into a tangent.
  vec3 tx = textureGrad(uNormal, vec3(p.zy*scale, layer), dpdx.zy*scale, dpdy.zy*scale).rgb * 2.0 - 1.0;
  vec3 ty = textureGrad(uNormal, vec3(p.xz*scale, layer), dpdx.xz*scale, dpdy.xz*scale).rgb * 2.0 - 1.0;
  vec3 tz = textureGrad(uNormal, vec3(p.xy*scale, layer), dpdx.xy*scale, dpdy.xy*scale).rgb * 2.0 - 1.0;
  // UDN blend: perturb the geometric normal in each projection plane.
  // Projection UVs do not flip on negative faces; their tangent derivatives
  // must not flip either. Only the geometric normal changes sign.
  vec3 px = vec3(0.0, tx.y, tx.x);
  vec3 py = vec3(ty.x, 0.0, ty.y);
  vec3 pz = vec3(tz.x, tz.y, 0.0);
  return normalize(n + (px * w.x + py * w.y + pz * w.z) * uNormalStrength);
}

vec3 sky(vec3 d) {
  float t = d.y;
  return t >= 0.0 ? mix(uSkyHorizon, uSkyTop, pow(t, 0.6)) : mix(uSkyHorizon, uSkyBottom, pow(-t, 0.6));
}

float sunlightVisibility(vec3 n) {
  if(uShadowStrength<=0.0)return 1.0;
  vec3 q=shadowCoord;
  if(any(lessThan(q,vec3(0.0)))||any(greaterThan(q,vec3(1.0))))return 1.0;
  // Compare each tap against the receiver plane at that texel, rather than
  // against the center depth. A constant bias produces stripes on angled faces.
  float det=shadowDx.x*shadowDy.y-shadowDx.y*shadowDy.x;
  vec2 slope=abs(det)>1e-12?vec2(shadowDx.z*shadowDy.y-shadowDy.z*shadowDx.y,
    shadowDy.z*shadowDx.x-shadowDx.z*shadowDy.x)/det:vec2(0.0);
  float lit=0.0;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 tap=(floor(q.xy*2048.0)+vec2(x,y)+.5)/2048.0;
    float receiver=q.z+dot(slope,tap-q.xy);
    lit+=step(receiver-.00005,texelFetch(uShadowMap,clamp(ivec2(floor(tap*2048.0)),ivec2(0),ivec2(2047)),0).r);
  }
  return mix(1.0,lit/9.0,uShadowStrength);
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vWorldNormal);
  if (!(n.x == n.x)) n = vec3(0.0, 1.0, 0.0);          // NaN from a degenerate triangle
  if (!gl_FrontFacing) n = -n;
  vec3 textureNormal=normalize(cross(dFdx(vTexturePosition),dFdy(vTexturePosition)));
  textureNormal*=dot(cross(dFdx(vWorldPos),dFdy(vWorldPos)),n)<0.0?-1.0:1.0;
  vec3 w = triWeights(textureNormal);
  vec3 p = vTexturePosition * uTileScale;
  dpdx = dFdx(p);
  dpdy = dFdy(p);
  faceDx = dFdx(vFaceUV);
  faceDy = dFdy(vFaceUV);
  worldDx = dFdx(vWorldPos);
  worldDy = dFdy(vWorldPos);
  vec4 projected=uShadowMatrix*vec4(vWorldPos,1.0);
  shadowCoord=projected.xyz/projected.w;
  shadowDx=dFdx(shadowCoord);shadowDy=dFdy(shadowCoord);
  float flags = vParams.y;
  if (uCull>.5 && !gl_FrontFacing && !hasFlag(flags, 32.0)) discard;
  float surface = vSurface.z;
  bool generator = surface == 4.0 || surface == 5.0;
  bool ore = surface >= 10.0 && surface <= 13.0;
  bool stripes = surface >= 20.0 && surface <= 25.0;
  bool decal = surface == 3.0 || surface == 28.0;
  vec2 edgeDistance = min(vFaceUV, 1.0 - vFaceUV) * vSurface.xy;
  float solar = surface == 7.0 ? step(0.3, min(edgeDistance.x, edgeDistance.y)) : 0.0;
  if (vParams.w < -0.5) discard; // hidden block, independent of selection

  // framework.bmp is RGB. Its red channel is a separate face-local hole mask.
  // Missing masks keep the block visible, matching the other texture fallbacks.
  if (surface == 6.0 && vLayers.z > 0.5 && sampleFace(uAux, vLayers.z, 1.0).r <= 0.2) discard;
  vec4 base = sampleTri(uAlbedo, vLayers.x, p, w);
  if (surface == 4.0) base = sampleFace(uAlbedo, vLayers.x, 1.5);
  if (surface == 27.0) base = sampleFace(uAlbedo, vLayers.x, 2.0);
  if (solar > 0.5) base = sampleTriScaled(uAlbedo, vLayers.x, p, w, 1.5);
  if (ore) {
    float detail = 1.0 - clamp(length(vWorldPos - cameraPosition) / 40.0, 0.5, 1.0);
    base = mix(sampleTriScaled(uAlbedo, vLayers.x, p, w, 0.25), sampleTriScaled(uAlbedo, vLayers.x, p, w, 1.25), detail);
  }
  if (surface != 6.0 && hasFlag(flags, 8.0) && base.a < 0.5) discard;
  // scaffold.bmp has no alpha: its black bars are the holes, like framework.
  if (surface == 30.0 && max(base.r, max(base.g, base.b)) < 0.08) discard;
  if((surface==8.0||surface==9.0)&&vColor.a<=0.0)discard;
  if(uMaskPass>.5){gl_FragColor=vec4(mod(vParams.w,2.0)>.5?1.0:0.0,1.0,0.0,1.0);return;}
  // Pass 1 is the shadow map (holograms cast none); pass 2 is the translucent depth map.
  if(uDepthPass>.5){if(surface==9.0&&uDepthPass<1.5)discard;gl_FragColor=vec4(1.0);return;}

  // Blueprint keeps geometry and cutouts but bypasses material lighting and effects.
  if(uBlueprint>.5){
    vec3 widths=max(fwidth(vBary),vec3(.000001));
    vec3 edges=(vec3(1.)-smoothstep(vec3(0.),widths*1.2*uLineScale,vBary))*step(vec3(max(.0001,(1.-uWireThreshold)*.5)),vEdges);
    float line=max(edges.x,max(edges.y,edges.z));
    float technical=.7+.3*max(dot(n,normalize(vec3(-.4,.65,.6))),0.);
    vec3 color=mix(vec3(.055,.14,.22)*technical,vec3(.72,.88,1.),line);
    color=mix(color,uRegionColor,step(3.5,vParams.w)*.45);
    color=mix(color,uSelectColor,mod(vParams.w,2.)*.65);
    gl_FragColor=vec4(color,1.);return;
  }
  vec4 materialOverlay = sampleTri(uAux, vMaterialLayers.x, p, w);
  if (surface == 4.0) materialOverlay = sampleFace(uAux, vMaterialLayers.x, 1.5);
  if (surface == 27.0) materialOverlay = sampleFace(uAux, vMaterialLayers.x, 2.0);
  float decalCoverage = 0.0;
  vec3 col;
  if (hasFlag(flags, 2.0)) {                                  // emissive flat
    col = vColor.rgb;
  } else {
    col = hasFlag(flags, 1.0) ? base.rgb * vColor.rgb : base.rgb;
    // secondary color through the paint mask
    vec4 mask = sampleTri(uAux, vLayers.z, p, w);
    if (surface == 6.0) mask = vec4(0.0); // framework mask is not secondary paint
    vec3 secondary = mix(vColor.rgb * uSecondaryFactor, vSecondary.rgb, vSecondary.a);
    col = mix(col, base.rgb * secondary, mask.a);
    // Vivid Colors hull: in-game, Trinium Vivid measured ~17% brighter than Blank Hull at the same color.
    if (surface == 29.0) col *= 1.17;
    col = mix(col, materialOverlay.rgb, materialOverlay.a);
    // overlay decal
    vec4 overlay = sampleTri(uAux, vLayers.w, p, w);
    if (decal) overlay = sampleDecal(uAux, vLayers.w);
    if (surface == 16.0 || surface == 17.0) overlay = sampleFace(uAux, vLayers.w, 1.0);
    if (stripes && vLayers.w > 0.5) {
      float variant = mod(surface - 20.0, 3.0);
      // Native BlockType2 distinguishes world, inverted-world and local stripes.
      overlay = variant == 2.0 ? sampleFace(uAux,vLayers.w,1.0)
        : sampleTriScaled(uAux,vLayers.w,p,w,variant == 1.0 ? -1.0 : 1.0);
      vec3 stripeColor = surface >= 23.0 ? vec3(0.12) : vec3(1.0);
      overlay.rgb *= mix(stripeColor, vSecondary.rgb, vSecondary.a);
      overlay.a *= mix(1.0, 0.7, vSecondary.a);
    }
    if (generator || surface == 18.0 || surface == 26.0) overlay = vec4(0.0); // emission is applied later; decal backs remain plated
    if (surface == 14.0) overlay = mix(overlay, vec4(1.0, 1.0, 1.0, overlay.a) * vSecondary, vSecondary.a);
    else if (surface == 16.0) {
      overlay.a = overlay.r;
      overlay.rgb = mix((base.rgb * 0.5 + 0.5) * vEmission, vSecondary.rgb, vSecondary.a);
    } else if (surface == 17.0) overlay.rgb *= base.rgb * 0.5 + 0.5;
    else if (hasFlag(flags, 16.0) && !stripes) {
      overlay = mix(overlay, vec4(1.0, 1.0, 1.0, 0.7 * overlay.a) * vSecondary, vSecondary.a);
    }
    col = mix(col, overlay.rgb, overlay.a);
    decalCoverage = overlay.a;
    if (surface == 28.0) {
      // dock.frag recolors only yellow paint, preserving the gray machinery.
      float yellow = float(col.r - col.b > 0.1) * overlay.a;
      vec3 gray = vec3((col.r + col.g + col.b) * 0.3 * 2.5);
      col = mix(col, mix(col, gray * vSecondary.rgb, vSecondary.a), yellow);
    }
    if (solar > 0.5) col = base.rgb * vec3(0.0, 0.0, 0.1);
    if (surface == 8.0) col = vColor.rgb * 0.5;
    if (surface == 19.0) col *= 0.15;
  }

  vec3 N = sampleNormalTri(vLayers.y, p, w, textureNormal, mix(1.0,1.5,solar));
  if(ore){float detail=1.0-clamp(length(vWorldPos-cameraPosition)/40.0,0.5,1.0);
    N=normalize(mix(sampleNormalTri(vLayers.y,p,w,textureNormal,.25),sampleNormalTri(vLayers.y,p,w,textureNormal,1.25),detail));}
  // Rotate the rest-space texture normal into the posed surface frame.
  vec3 restT=dFdx(vTexturePosition), posedT=worldDx;
  restT-=textureNormal*dot(restT,textureNormal);
  posedT-=n*dot(posedT,n);
  if(length(restT)>1e-8 && length(posedT)>1e-8){
    restT=normalize(restT);posedT=normalize(posedT);
    N=normalize(posedT*dot(N,restT)+cross(n,posedT)*dot(N,cross(textureNormal,restT))+n*dot(N,textureNormal));
  }else N=n;
  if (surface == 4.0 && vLayers.y > 0.5) N = faceNormal(sampleFace(uNormal, vLayers.y, 1.5).rgb * 2.0 - 1.0, n);
  if (surface == 27.0 && vLayers.y > 0.5) N = faceNormal(sampleFace(uNormal, vLayers.y, 2.0).rgb * 2.0 - 1.0, n);
  if ((decal || generator) && vSurface.w > 0.5) {
    vec4 detail = decal ? sampleDecal(uAux, vSurface.w) : sampleFace(uAux, vSurface.w, 1.0);
    vec3 decoded = detail.rgb * 2.0 - 1.0;
    if (decal) decoded.xy = -decoded.xy;
    N = normalize(mix(N, faceNormal(decoded, n), detail.a));
    if (generator) col = mix(col, vColor.rgb, detail.a);
    if (surface == 4.0) base = mix(base, vec4(1.0), detail.a);
  }
  vec3 eyeDir = isOrthographic
    ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])
    : normalize(vWorldPos - cameraPosition);

  // direct + 6-axis ambient (game samples an ambient cubemap on each axis)
  float shadow=sunlightVisibility(n);
  vec3 lighting = max(dot(N, -uLightDir), 0.0) * uLightColor * shadow;
  lighting += uAmbientFill;
  lighting += max( N.x, 0.0) * uAmbient[0] + max(-N.x, 0.0) * uAmbient[1]
            + max( N.y, 0.0) * uAmbient[2] + max(-N.y, 0.0) * uAmbient[3]
            + max( N.z, 0.0) * uAmbient[4] + max(-N.z, 0.0) * uAmbient[5];
  lighting += lightSpill(vModelPos, N);

  vec3 outc = hasFlag(flags, 2.0) ? col * (surface == 9.0 ? (.5 + uHologramGlow * uGlowStrength) * (.8 + .2 * max(dot(N, -uLightDir), 0.0)) : 2.0 * uGlowStrength) : col * lighting;

  // reflections (fresnel between min/max, times per-type scale)
  vec3 R = reflect(eyeDir, N);
  float fres = 1.0 - clamp(dot(-eyeDir, N), 0.0, 1.0);
  float refl = (uMinRefl + (uMaxRefl - uMinRefl) * fres) * vParams.z;
  if (solar > 0.5) refl += 0.5;
  if (hasFlag(flags, 2.0)) refl = 0.0;
  outc += sky(R) * refl;

  // specular
  float spec = pow(clamp(dot(-uLightDir, R), 0.0, 1.0), mix(uGloss, 2500.0, solar)) * mix(uSpecular, 4.0, solar) * mix(base.r, 1.0, solar);
  if (surface == 8.0) spec *= 3.0;
  if (hasFlag(flags, 2.0) || ore) spec = 0.0;
  outc += spec * uLightColor * shadow;
  if (ore) {
    float rich = surface == 11.0 || surface == 13.0 ? 1.0 : 0.5;
    float bias = rich > 0.5 ? -0.15 : 0.0;
    float lightness = 1.0 - min(1.0, length(base.rgb + bias) * 1.65);
    float highlight = pow(clamp(dot(-uLightDir, R), 0.0, 1.0), surface >= 12.0 ? 450.0 : 250.0);
    outc += vEmission * rich * (4.0 * lightness + highlight * base.a);
    outc += pow(fres, 5.0) * sky(eyeDir) * mix(base.a, 1.0, 0.5);
  }

  vec3 effectColor = mix(vEmission, vSecondary.rgb, vSecondary.a);
  if (generator) {
    vec4 highlight = sampleFace(uAux, vLayers.w, 1.0);
    vec3 energy = (effectColor + 0.6) * (highlight.rgb + 0.3) * uGlowStrength;
    outc = mix(outc, energy, highlight.a);
  }

  // Material lights survive independently of a block's artwork and pod lights.
  if (vMaterialLayers.y > 0.5) {
    vec4 glow = sampleTri(uAux, vMaterialLayers.y, p, w);
    if (surface == 4.0) glow = sampleFace(uAux, vMaterialLayers.y, 1.5);
    if (surface == 27.0) glow = sampleFace(uAux, vMaterialLayers.y, 2.0);
    float coverage = (decal || surface == 14.0 || stripes) ? 1.0 - decalCoverage : 1.0;
    if (surface == 5.0) outc += glow.rgb * 2.0 * uGlowStrength;
    else outc = mix(outc, glow.rgb * 2.0 * uGlowStrength, glow.a * coverage);
  }

  // glow map
  if (vParams.x > 0.5) {
    vec4 glow = sampleTri(uAux, vParams.x, p, w);
    if (surface == 4.0) glow = sampleFace(uAux, vParams.x, 1.5);
    if (surface == 14.0) outc += glow.rgb * uGlowStrength;
    else outc = mix(outc, glow.rgb * 2.0 * uGlowStrength, glow.a);
  }

  if (surface == 1.0) {
    // engine.frag: local -Z has a rectangular outer glow and bright inner core.
    vec2 q = vFaceUV * 2.0 - 1.0;
    vec2 outerRamp = clamp((vec2(0.9) - abs(q)) / 0.2, 0.0, 1.0);
    vec2 innerRamp = clamp((vec2(1.0) - abs(q * 1.5)) / 0.3, 0.0, 1.0);
    float outer = outerRamp.x * outerRamp.y;
    float inner = innerRamp.x * innerRamp.y;
    outc = mix(outc, (outer * effectColor + inner * vec3(1.0)) * uGlowStrength, outer);
  } else if (surface == 2.0) {
    outc *= thrusterPlating(vFaceUV, vSurface.xy, faceDx, faceDy);
  }

  // fog (game: exponential on view depth, toward the sky colour)
  if (uFogStrength > 0.0 && !hasFlag(flags, 2.0)) {
    float d = length(vWorldPos - cameraPosition);
    outc = mix(outc, sky(eyeDir), 1.0 - exp(-d * uFogStrength * 0.01));
  }

  // Native housing window pass uses world plating coordinates / 8 and raw secondary alpha.
  if(surface == 26.0 && vLayers.w > 0.5) {
    vec4 windows=sampleTriScaled(uAux,vLayers.w,p,w,0.125);
    vec3 windowColor=mix(uWindowColor,vWindow.rgb*2.5,vWindow.a);
    outc=mix(outc,uWindowStrength*windowColor*windows.rgb,windows.a);
  }
  // Keep a strong fill floor while revealing face angles with a fixed soft key.
  float ambientShape=1.0-uAmbientDetail*.65*(1.0-max(dot(n,normalize(vec3(-.4,.65,.6))),0.0));
  if(uAmbientOnly>.5)outc=col*uAmbientFill*ambientShape;
  // region highlight (state bit 4), then selection tint on top
  outc = mix(outc, uRegionColor, step(3.5, vParams.w) * 0.45);
  outc = mix(outc, uSelectColor, mod(vParams.w,2.0) * 0.65);

  if (uDebug > 0.5) {
    if (uDebug < 1.5) outc = base.rgb;
    else if (uDebug < 2.5) outc = vec3(surface == 6.0 ? sampleFace(uAux, vLayers.z, 1.0).r : sampleTri(uAux, vLayers.z, p, w).a);
    else if (uDebug < 3.5) outc = N * 0.5 + 0.5;
    else if (uDebug < 4.5) outc = w;
    else if (uDebug < 5.5) outc = lighting;
    else if (uDebug < 6.5) outc = fract(p);
    else outc = vec3(vLayers.x / 4.0, vColor.r, textureLod(uAlbedo, vec3(0.3, 0.3, vLayers.x),0.0).r);
  }

  float alpha = surface == 8.0 || surface == 9.0 ? vColor.a : hasFlag(flags, 4.0) ? vColor.a : 1.0;
  // The game lights in gamma space and writes straight to the framebuffer;
  // no linear->sRGB conversion here on purpose, so block colours match in-game.
  if (uDebug > 7.5) {
    outc = vSide < 0.5 ? vec3(.5,.05,.05) : vSide < 1.5 ? vec3(1,.2,.2)
      : vSide < 2.5 ? vec3(.05,.5,.05) : vSide < 3.5 ? vec3(.2,1,.2)
      : vSide < 4.5 ? vec3(.05,.05,.5) : vec3(.2,.4,1);
  }
  if(uDisplayMode==1.0){
    vec3 vn=normalize(mat3(viewMatrix)*n);
    if(uAmbientOnly>.5)outc=vColor.rgb*uAmbientFill*ambientShape;
    else if(uMatcap>.5){
      float wax=.25+.75*max(dot(vn,normalize(vec3(-.4,.6,1.0))),0.0);
      outc=(vec3(.65,.055,.035)*wax+vec3(.5,.22,.16)*pow(max(vn.z,0.0),18.0)*min(uSpecular,1.0))*shadow;
    }else outc=vColor.rgb*(vec3(.3)+max(dot(n,-uLightDir),0.0)*vec3(.7)*shadow)+vec3(pow(max(dot(reflect(eyeDir,n),-uLightDir),0.0),32.0)*uSpecular*shadow);
  }
  vec3 widths=max(fwidth(vBary),vec3(.000001));
  vec3 edge=vec3(1.0)-smoothstep(vec3(0.0),widths*1.2*uLineScale,vBary);
  edge*=step(vec3(max(.0001,(1.0-uWireThreshold)*.5)),vEdges);
  float line=max(edge.x,max(edge.y,edge.z));
  if(uDisplayMode==2.0){if(line<.1)discard;outc=vec3(.65);alpha=line;}
  else if(uWireOverlay>.5)outc=mix(outc,vec3(.025),line*uWireOpacity);
  if(uXray>=0.0)alpha*=uXray;
  // Paint preview uses the real surface and its depth/cutout rules. The second
  // state bit is transient; it never changes selection or either paint color.
  vec3 displayed=outc * (uDebug > .5 ? 1.0 : uExposure);
  displayed=mix(displayed,uPaintColor,mod(floor(vParams.w*.5+.001),2.)*0.45);
  // Derivative-scaled contours mark actual surface/plane intersections, not block bounds.
  vec3 mirrorDistance=abs(vWorldPos-uMirrorOrigin);
  vec3 mirrorWidth=fwidth(vWorldPos);
  vec3 mirrorLine=(vec3(1.0)-smoothstep(mirrorWidth*.6,mirrorWidth*1.6+vec3(0.000001),mirrorDistance))*step(vec3(0.000001),mirrorWidth)*uMirrorVisible;
  displayed=mix(displayed,vec3(.88,.48,.48),mirrorLine.x);
  displayed=mix(displayed,vec3(.57,.74,.48),mirrorLine.y);
  displayed=mix(displayed,vec3(.49,.66,.93),mirrorLine.z);
  gl_FragColor = vec4(displayed, alpha);
}
`;
/** Parse #rrggbb without three's sRGB->linear conversion (we light in gamma space like the game). */
function hex(c) { return new THREE.Color().setStyle(c, THREE.LinearSRGBColorSpace); }
export function lightDirection(p) {
    const az = THREE.MathUtils.degToRad(p.lightAzimuth);
    const el = THREE.MathUtils.degToRad(p.lightElevation);
    // direction the light travels (game: lightDir points from the sun into the scene)
    return new THREE.Vector3(-Math.cos(el) * Math.sin(az), -Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
}
const EMPTY_SPILL = emptySpillGrid();
export function setSpillGrid(m, grid) {
    const u = m.uniforms, g = grid?.count ? grid : EMPTY_SPILL;
    u.uSpillTable.value = g.table; u.uSpillList.value = g.list; u.uSpillCell.value = g.cell; u.uSpillMask.value = g.mask;
}
export function createGameMaterial(albedo, normal, aux, params, transparent = false) {
    const m = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
            uAmbientOnly:{value:0},uAmbientDetail:{value:0},uDisplayMode:{value:0},uMatcap:{value:0},uCull:{value:1},uXray:{value:-1},
            uWireOverlay:{value:0},uWireThreshold:{value:1},uWireOpacity:{value:1},uMaskPass:{value:0},
            uAlbedo: { value: albedo },
            uNormal: { value: normal },
            uAux: { value: aux },
            uTileScale: { value: 0.1 },
            uExposure: { value: 1 },uBlueprint:{value:0},uLineScale:{value:1},
            uWindowColor: { value: new THREE.Color(1,.86,.66) },
            uWindowStrength: { value: 1 },
            uLightDir: { value: new THREE.Vector3() },
            uLightColor: { value: new THREE.Color() },
            uAmbient: { value: Array.from({ length: 6 }, () => new THREE.Color()) },
            uAmbientFill: { value: new THREE.Color() },
            uSkyTop: { value: new THREE.Color() },
            uSkyHorizon: { value: new THREE.Color() },
            uSkyBottom: { value: new THREE.Color() },
            uMinRefl: { value: 0 }, uMaxRefl: { value: 0 },
            uGloss: { value: 1 }, uSpecular: { value: 0 },
            uNormalStrength: { value: 1 }, uSharpness: { value: 8 },
            uSecondaryFactor: { value: 0.6 }, uGlowStrength: { value: 1 }, uHologramGlow: { value: 1.5 }, uFogStrength: { value: 0 },
            uSelectColor: { value: new THREE.Color().setStyle("#4fd8eb", THREE.LinearSRGBColorSpace) },
            uMirrorOrigin: { value: new THREE.Vector3() },
            uMirrorVisible: { value: new THREE.Vector3() },
            uPaintColor: { value: new THREE.Color().setStyle("#80c6ff", THREE.LinearSRGBColorSpace) },
            uRegionColor: { value: new THREE.Color().setStyle("#5ec27a", THREE.LinearSRGBColorSpace) },
            uDebug: { value: 0 },
            uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() },
            uShadowStrength: { value: 0 }, uDepthPass: { value: 0 },
            uSpillTable: { value: EMPTY_SPILL.table }, uSpillList: { value: EMPTY_SPILL.list },
            uSpillCell: { value: 1 }, uSpillMask: { value: 0 }, uSpillStrength: { value: 0 },
        },
        transparent,
        depthWrite: !transparent,
        side: THREE.DoubleSide, // Shader retains back faces only for flagged two-sided blocks.
    });
    // Raw test/preview geometries without functional-face data remain plain hull.
    m.defaultAttributeValues = { ...m.defaultAttributeValues,
        aFaceUV: [0.5, 0.5], aSurface: [1, 1, 0, 0], aEmission: [1, 1, 1], aMaterialLayers: [0, 0], aSeamSides: [0] };
    applyGameParams(m, params);
    return m;
}
export function applyGameParams(m, p) {
    const u = m.uniforms;
    u.uAmbientFill.value.copy(hex(p.ambientFillColor)).multiplyScalar(p.ambientFillIntensity);
    u.uTileScale.value = p.tileScale;
    u.uLightDir.value.copy(lightDirection(p));
    u.uLightColor.value.copy(hex(p.lightColor)).multiplyScalar(p.lightIntensity);
    const top = hex(p.skyTop), hor = hex(p.skyHorizon), bot = hex(p.skyBottom);
    // Game: ambient cubemap sampled on each axis. We approximate with the sky
    // colours lifted by a neutral base so unlit faces are not pitch black.
    const base = new THREE.Color(0.55, 0.58, 0.62);
    const amb = u.uAmbient.value;
    const mk = (c, dst) => dst.copy(base).lerp(c, 0.5).multiplyScalar(p.ambientIntensity);
    mk(hor, amb[0]);
    mk(hor, amb[1]);
    mk(top, amb[2]);
    mk(bot, amb[3]);
    mk(hor, amb[4]);
    mk(hor, amb[5]);
    u.uSkyTop.value.copy(top);
    u.uSkyHorizon.value.copy(hor);
    u.uSkyBottom.value.copy(bot);
    u.uMinRefl.value = p.minReflectivity;
    u.uMaxRefl.value = p.maxReflectivity;
    u.uGloss.value = Math.max(1, p.glossyness);
    u.uSpecular.value = p.specularity;
    u.uNormalStrength.value = p.normalStrength;
    u.uSharpness.value = Math.max(1, p.triplanarSharpness);
    u.uSecondaryFactor.value = p.secondaryFactor;
    u.uGlowStrength.value = p.glowStrength;
    u.uHologramGlow.value = p.hologramGlow ?? 1.5;
    u.uFogStrength.value = p.fogStrength;
    u.uSpillStrength.value = p.spillStrength ?? 0;
}
