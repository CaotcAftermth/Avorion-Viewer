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
import { THRUSTER_PORTS_GLSL } from "./thrusterPorts.js";
import { DEFAULT_GAME_SHADER } from "../../types/index.js";
import { SPILL_GLSL, emptySpillGrid } from "./blockLights.js";
import { TEXTURE_SLOTS } from "../textures/shadingMap.js";
import { materialShadingDefaults } from "../../types/client-render-defaults.js";
export { DEFAULT_GAME_SHADER };
// Six low bits remain draw/picking flags. Higher bits hold material index + 1.
// Code zero is the fallback for unknown materials and untagged preview geometry.
export const MATERIAL_FLAG_STRIDE = 64;
export function packMaterialFlags(flags, materialIndex) {
    const knownMaterial = Number.isInteger(materialIndex) && materialIndex >= 0 && materialIndex < materialShadingDefaults.length;
    return flags + (knownMaterial ? materialIndex + 1 : 0) * MATERIAL_FLAG_STRIDE;
}
/** Flag bits packed into aParams.y */
export const FLAG_DOUBLE_SIDED = 32;
export const FLAG_TINT = 1;
export const FLAG_EMISSIVE = 2;
export const FLAG_TRANSLUCENT = 4;
export const FLAG_CUTOUT = 8;
export const FLAG_OVERLAY_SECONDARY = 16;
const VERT = /* glsl */ `
#ifdef BLOCK_CANONICAL_ENDPOINTS
attribute vec4 aOffset;
attribute vec4 aScale;
attribute vec4 aMaterialLayers;
#elif defined(BLOCK_INSTANCED)
attribute vec3 aOffset;
#ifdef BLOCK_CANONICAL_BOX
attribute vec3 aScale;
#endif
#endif
// Vertex attributes are capped at 16 by WebGL, and some GPU drivers (ANGLE on
// Windows) refuse a program that uses all 16. Keep this shader at 14 or fewer
// in the instanced path (position, normal and aOffset count too): pack new
// per-block data into the spare components below instead of adding attributes.
attribute vec4 aEdges; // xyz: wire edge angles; w: triangle corner (0, 1, 2) for barycentrics
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
attribute vec4 aEmission; // rgb: material's default effect color; w: seam sides touching another block (bit per -X,+X,-Y,+Y,-Z,+Z)
#ifndef BLOCK_CANONICAL_ENDPOINTS
attribute vec3 aMaterialLayers;
#endif
// plating accent and glow, independent of decals
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
flat out vec3 vMaterialLayers;

#ifdef BLOCK_CANONICAL_ENDPOINTS
vec3 endpointPoint(vec3 p) {
  return mix(aScale.xyz, aOffset.xyz, lessThan(p, vec3(0.0)));
}
#endif
#ifdef BLOCK_CANONICAL_DISCRETE
vec3 nativeAxis(int code) {
  vec3 axis=vec3(0.0);
  axis[code/2]=(code%2==0)?-1.0:1.0;
  return axis;
}
#endif
#ifdef BLOCK_CANONICAL_WEDGE
float wedgeCrease(float code, vec3 span) {
  if (code < 2.0) return code;
  int descriptor=int(code)-2;
  vec3 slope=1.0/span;
  slope[descriptor/3]=0.0;
  return acos(-normalize(slope)[descriptor%3]) / 3.141592653589793;
}
#endif
void main() {
  vBary=vec3(equal(vec3(floor(aEdges.w+.5)),vec3(0.,1.,2.)));vEdges=aEdges.xyz;
  vec3 blockPosition=position;
  vec3 texturePosition=aSide.xyz;
  vec3 physicalNormal=normal;
  float seamMask=aEmission.w;
  #ifdef BLOCK_CANONICAL_DISCRETE
  // Six ship-axis seam bits, followed by the integer look/up code.
  int packedMetadata=int(seamMask);
  int code=packedMetadata/64;
  seamMask=float(packedMetadata%64);
  vec3 look=nativeAxis(code/6), up=nativeAxis(code%6);
  mat3 rotation=mat3(look,up,cross(look,up));
  blockPosition=rotation*blockPosition;
  texturePosition=rotation*texturePosition;
  physicalNormal=rotation*physicalNormal;
  #endif
  #ifdef BLOCK_CANONICAL_ENDPOINTS
  blockPosition=endpointPoint(blockPosition);
  texturePosition=endpointPoint(texturePosition);
  #ifdef BLOCK_CANONICAL_WEDGE
  vec3 span=aScale.xyz-aOffset.xyz;
  physicalNormal=normalize(physicalNormal/span);
  #ifdef BLOCK_CANONICAL_DISCRETE
  span=abs(transpose(rotation)*span);
  #endif
  vEdges=vec3(wedgeCrease(aEdges.x,span),wedgeCrease(aEdges.y,span),wedgeCrease(aEdges.z,span));
  #endif
  #elif defined(BLOCK_CANONICAL_BOX)
  blockPosition*=aScale;
  texturePosition*=aScale;
  #endif
  #if defined(BLOCK_INSTANCED) && !defined(BLOCK_CANONICAL_ENDPOINTS)
  blockPosition+=aOffset;
  texturePosition+=aOffset;
  #endif
  vec4 wp = modelMatrix * vec4(blockPosition, 1.0);
  vWorldPos = wp.xyz;
  vTexturePosition=texturePosition;
  vModelPos = blockPosition;
  vWorldNormal = normalize(mat3(modelMatrix) * physicalNormal);
  vColor = aColor;
  vSecondary = aSecondary;
  vLayers = aLayers;
  vParams = aParams;
  vFaceUV = aFaceUV;
  vSurface = aSurface;
  #ifdef BLOCK_CANONICAL_BOX
  vSurface.xy = vec2(aScale[int(aSurface.x)], aScale[int(aSurface.y)]);
  #elif defined(BLOCK_CANONICAL_ENDPOINTS)
  vec3 extents=vec3(aOffset.w,aScale.w,aMaterialLayers.w);
  #ifdef BLOCK_CANONICAL_DISCRETE
  extents=abs(transpose(rotation)*extents);
  #endif
  vSurface.xy=vec2(extents[int(aSurface.x)],extents[int(aSurface.y)]);
  #endif
  vSide = aSide.w;
  vEmission = aEmission.rgb;
  vMaterialLayers = aMaterialLayers.xyz;
  // Flag axis-aligned faces pressed against a neighbouring block.
  vec3 axisNormal = abs(physicalNormal);
  float seamSide = axisNormal.x > .999 ? (physicalNormal.x > 0. ? 1. : 0.) : axisNormal.y > .999 ? (physicalNormal.y > 0. ? 3. : 2.) : axisNormal.z > .999 ? (physicalNormal.z > 0. ? 5. : 4.) : -1.;
  vSeamFace = seamSide < 0. ? 0. : mod(floor(seamMask / exp2(seamSide) + .001), 2.);
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
uniform vec3 uWindowColor;
uniform float uWindowStrength;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient[6];   // +x -x +y -y +z -z
uniform vec3 uAmbientFill;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyBottom;
uniform vec4 uMaterialShading[8]; // facing, grazing, specular, gloss
uniform float uMaterialGlow[8];
uniform int uTextureScaling[${TEXTURE_SLOTS.length}];
${TEXTURE_SLOTS.map(([slot], index) => `const int MAP_${slot.toUpperCase()} = ${index};`).join("\n")}
uniform float uSpecular;
uniform float uNormalStrength;
uniform float uSharpness;
uniform float uSecondaryFactor;
uniform float uGlowStrength;
uniform float uHologramGlow;
uniform float uFogStrength;
uniform vec3 uSelectColor;
uniform float uShadeSelected;
uniform vec3 uPaintColor;
uniform vec3 uRegionColor;
uniform vec3 uMirrorOrigin;
uniform vec3 uMirrorVisible;
uniform highp sampler2D uNearestTransparentDepth;
uniform float uLimitTransparentDepth;
uniform float uColorMask;
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
flat in vec3 vMaterialLayers;
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

vec4 sampleBlockUV(sampler2DArray tex, float layer, int mode, float tileFactor) {
  if (layer < 0.5) return textureLod(tex, vec3(0.0), 0.0);
  vec2 scale = mode == 2 ? vSurface.xy * (uTileScale * tileFactor) : vec2(1.0);
  vec2 uv = mode == 2 ? vFaceUV * scale : clamp(vFaceUV, vec2(0.001), vec2(0.999));
  return textureGrad(tex, vec3(uv, layer), faceDx * scale, faceDy * scale);
}

vec4 sampleBlockUV(sampler2DArray tex, float layer, int mode) {
  return sampleBlockUV(tex, layer, mode, 1.0);
}

vec4 sampleFrameworkMask(sampler2DArray tex, float layer, int slot) {
  int mode = uTextureScaling[slot];
  // Build up from the face base, clipping the last cell on a fractional face.
  return mode == 0 ? sampleBlockUV(tex, layer, 2, 20.0) : sampleBlockUV(tex, layer, mode);
}

vec4 sampleFace(sampler2DArray tex, float layer, float scale, int slot) {
  if (uTextureScaling[slot] != 0) return sampleBlockUV(tex, layer, uTextureScaling[slot]);
  vec4 result = textureLod(tex, vec3(0.0), 0.0);
  // Keep a face decal inside its layer instead of wrapping into the next tile.
  vec2 uv = scale == 1.0 ? clamp(vFaceUV, vec2(0.001), vec2(0.999)) : vFaceUV * scale;
  if (layer >= 0.5) result = textureGrad(tex, vec3(uv, layer), faceDx * scale, faceDy * scale);
  return result;
}

// Keep the middle of a tile at the face center as its physical dimensions change.
// A negative factor keeps the native inverted UV orientation for functional decals.
vec4 sampleCenteredFace(sampler2DArray tex, float layer, float factor, float center, int slot) {
  if (uTextureScaling[slot] != 0) return sampleBlockUV(tex, layer, uTextureScaling[slot]);
  if (layer < 0.5) return textureLod(tex, vec3(0.0), 0.0);
  vec2 scale = vSurface.xy * (uTileScale * factor);
  vec2 uv = center + (vFaceUV - 0.5) * scale;
  return textureGrad(tex, vec3(uv, layer), faceDx * scale, faceDy * scale);
}

vec4 sampleCenteredFace(sampler2DArray tex, float layer, float factor, int slot) {
  return sampleCenteredFace(tex, layer, factor, 0.5, slot);
}

// Dock artwork uses an inverted face fit.
vec4 sampleFunctional(sampler2DArray tex, float layer, float surface, int slot) {
  if (uTextureScaling[slot] != 0) return sampleBlockUV(tex, layer, uTextureScaling[slot]);
  if (layer < 0.5) return textureLod(tex, vec3(0.0), 0.0);
  if (surface == 28.0 || surface >= 36.0) {
    // The frontal opening occupies about one third of each face axis.
    vec2 scale = surface == 37.0 ? vec2(-2.34, -.78) : vec2(-1.0);
    vec2 uv = clamp(0.5 + (vFaceUV - 0.5) * scale, vec2(0.001), vec2(0.999));
    return textureGrad(tex, vec3(uv, layer), faceDx * scale, faceDy * scale);
  }
  // Relative to the normal plating repeat rate. Rotation lock and turret base
  // contain multiple motifs per source tile.
  float factor = 1.0;
  if (surface == 31.0) factor = 5.0;
  if (surface == 32.0) factor = 6.0;
  if (surface == 34.0) factor = 10.0;
  if (surface == 33.0 || surface == 35.0) factor = 2.0;
  return sampleCenteredFace(tex, layer, -factor, surface == 31.0 ? 0.0 : 0.5, slot);
}

vec4 sampleGeneratorDetail(sampler2DArray tex, float layer, float surface, int slot) {
  // One full highlight and matching normal tile per five native units at stock scale.
  return sampleCenteredFace(tex, layer, 2.0, surface == 38.0 ? 0.0 : 0.5, slot);
}

vec4 sampleShipName(float layer) {
  if (uTextureScaling[MAP_OVERLAY] != 0) return sampleBlockUV(uAux, layer, uTextureScaling[MAP_OVERLAY]);
  if (layer < 0.5) return vec4(0.0);
  // Fit the 4:1 name region uniformly. Only face width and height matter.
  float aspect = vSurface.x / max(vSurface.y, .0001);
  vec2 scale = vec2(max(1.0, aspect / 4.0), max(1.0, 4.0 / max(aspect, .0001)));
  vec2 uv = 0.5 + (vFaceUV - 0.5) * scale;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  vec2 dx = faceDx * scale, dy = faceDy * scale;
  float glyph = textureGrad(uAux, vec3(uv, layer), dx, dy).r;
  float outline = 0.0;
  for (int y = -1; y <= 1; ++y)
    for (int x = -1; x <= 1; ++x)
      outline += textureGrad(uAux, vec3(uv + vec2(float(x) * .004, float(y) * .016), layer), dx, dy).r;
  return vec4(vec3(glyph), max(glyph, min(outline, 1.0)));
}

vec3 faceNormal(vec3 decoded, vec3 n) {
  float det = faceDx.x * faceDy.y - faceDx.y * faceDy.x;
  if (abs(det) < 1e-12) return n;
  vec3 tangent = normalize((worldDx * faceDy.y - worldDy * faceDx.y) / det);
  vec3 bitangent = normalize(cross(n, tangent));
  return normalize(n * max(decoded.z, 0.001) + (tangent * decoded.x + bitangent * decoded.y) * uNormalStrength);
}

${THRUSTER_PORTS_GLSL}
// Square port footprint, shared with the CPU's centered, finite emitter grid.
float thrusterCoverage(vec2 point, float portSize) {
  float aa = max(0.00001, max(length(faceDx * vSurface.xy), length(faceDy * vSurface.xy)) * 0.5);
  return 1.0 - smoothstep(portSize * 0.5 - aa, portSize * 0.5 + aa, max(abs(point.x), abs(point.y)));
}
vec4 sampleThruster(float layer, vec2 point, float portSize, int slot) {
  if (uTextureScaling[slot] != 0) return sampleBlockUV(uAux, layer, uTextureScaling[slot]);
  if (layer < 0.5) return vec4(0.0);
  // Native port artwork wraps across the four texture corners.
  float scale = portSize * 3.2;
  return textureGrad(uAux, vec3(fract(point / scale), layer), faceDx * vSurface.xy / scale, faceDy * vSurface.xy / scale);
}

vec3 triWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(uSharpness));
  return w / (w.x + w.y + w.z);
}

vec4 sampleTriScaled(sampler2DArray tex, float layer, vec3 p, vec3 w, float scale, int slot) {
  if (uTextureScaling[slot] != 0) return sampleBlockUV(tex, layer, uTextureScaling[slot]);
  vec4 result = textureLod(tex, vec3(0.0, 0.0, 0.0), 0.0); // fallback layer, uniform
  if (layer >= 0.5) {
    vec4 x = textureGrad(tex, vec3(p.zy * scale, layer), dpdx.zy * scale, dpdy.zy * scale);
    vec4 y = textureGrad(tex, vec3(p.xz * scale, layer), dpdx.xz * scale, dpdy.xz * scale);
    vec4 z = textureGrad(tex, vec3(p.xy * scale, layer), dpdx.xy * scale, dpdy.xy * scale);
    result = x * w.x + y * w.y + z * w.z;
  }
  return result;
}
vec4 sampleTri(sampler2DArray tex, float layer, vec3 p, vec3 w, int slot) {
  return sampleTriScaled(tex, layer, p, w, 1.0, slot);
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
  float flags = mod(vParams.y, ${MATERIAL_FLAG_STRIDE}.0);
  int materialCode = int(floor(vParams.y / ${MATERIAL_FLAG_STRIDE}.0));
  if (uCull>.5 && !gl_FrontFacing && !hasFlag(flags, 32.0)) discard;
  float surface = vSurface.z;
  bool generator = surface == 4.0 || surface == 5.0 || surface == 38.0;
  bool ore = surface >= 10.0 && surface <= 13.0;
  bool stripes = surface >= 20.0 && surface <= 25.0;
  bool decal = surface == 3.0 || surface == 28.0 || (surface >= 31.0 && surface <= 37.0);
  float portSize = max(vMaterialLayers.z, 0.1);
  vec2 portPoint = thrusterPortPoint(vFaceUV, vSurface.xy, portSize);
  float portCoverage = surface == 2.0 ? thrusterCoverage(portPoint, portSize) : 0.0;
  vec2 edgeDistance = min(vFaceUV, 1.0 - vFaceUV) * vSurface.xy;
  float solar = surface == 7.0 ? step(0.3, min(edgeDistance.x, edgeDistance.y)) : 0.0;
  if (vParams.w < -0.5) discard; // hidden block, independent of selection

  // framework.bmp is RGB. Its red channel is a separate face-local hole mask.
  // Missing masks keep the block visible, matching the other texture fallbacks.
  if (surface == 6.0 && vLayers.z > 0.5 && sampleFrameworkMask(uAux, vLayers.z, MAP_MASK).r <= 0.2) discard;
  vec4 base = sampleTri(uAlbedo, vLayers.x, p, w, MAP_ALBEDO);
  if (surface == 4.0) base = sampleCenteredFace(uAlbedo, vLayers.x, 1.5, MAP_ALBEDO);
  if (surface == 30.0) base = sampleTriScaled(uAlbedo, vLayers.x, p, w, 2.0, MAP_ALBEDO);
  if (surface == 27.0) base = sampleFace(uAlbedo, vLayers.x, 2.0, MAP_ALBEDO);
  if (solar > 0.5) base = sampleTriScaled(uAlbedo, vLayers.x, p, w, 1.5, MAP_ALBEDO);
  if (ore) {
    float detail = 1.0 - clamp(length(vWorldPos - cameraPosition) / 40.0, 0.5, 1.0);
    base = mix(sampleTriScaled(uAlbedo, vLayers.x, p, w, 0.25, MAP_ALBEDO), sampleTriScaled(uAlbedo, vLayers.x, p, w, 1.25, MAP_ALBEDO), detail);
  }
  if (surface != 6.0 && hasFlag(flags, 8.0) && base.a < 0.5) discard;
  // scaffold.bmp has no alpha: its black bars are the holes, like framework.
  if (surface == 30.0 && max(base.r, max(base.g, base.b)) < 0.08) discard;
  if((surface==8.0||surface==9.0)&&vColor.a<=0.0)discard;
  if(uMaskPass>.5){gl_FragColor=vec4(mod(vParams.w,2.0)>.5?1.0:0.0,1.0,0.0,1.0);return;}
  // Pass 1 is the shadow map (holograms cast none); pass 2 is the translucent depth map.
  if(uDepthPass>.5){if(surface==9.0&&uDepthPass<1.5)discard;gl_FragColor=vec4(1.0);return;}
  if (uLimitTransparentDepth > .5 && (surface == 8.0 || surface == 9.0) && vColor.a < 1.0) {
    float depth = gl_FragCoord.z;
    #ifdef USE_LOGDEPTHBUF
      depth = gl_FragDepth;
    #endif
    float nearest = texelFetch(uNearestTransparentDepth, ivec2(gl_FragCoord.xy), 0).r;
    if (depth > nearest + .0000002) discard;
  }

  // Blueprint keeps geometry and cutouts but bypasses material lighting and effects.
  if(uBlueprint>.5 && uColorMask<.5){
    vec3 widths=max(fwidth(vBary),vec3(.000001));
    vec3 edges=(vec3(1.)-smoothstep(vec3(0.),widths*1.2*uLineScale,vBary))*step(vec3(max(.0001,(1.-uWireThreshold)*.5)),vEdges);
    float line=max(edges.x,max(edges.y,edges.z));
    float technical=.7+.3*max(dot(n,normalize(vec3(-.4,.65,.6))),0.);
    vec3 color=mix(vec3(.055,.14,.22)*technical,vec3(.72,.88,1.),line);
    color=mix(color,uRegionColor,step(3.5,vParams.w)*.45);
    color=mix(color,uSelectColor,mod(vParams.w,2.)*.65*uShadeSelected);
    gl_FragColor=vec4(color,1.);return;
  }
  vec4 materialOverlay = sampleTri(uAux, vMaterialLayers.x, p, w, MAP_MATERIALOVERLAY);
  if (surface == 4.0) materialOverlay = sampleCenteredFace(uAux, vMaterialLayers.x, 1.5, MAP_MATERIALOVERLAY);
  if (surface == 27.0) materialOverlay = sampleFace(uAux, vMaterialLayers.x, 2.0, MAP_MATERIALOVERLAY);
  float decalCoverage = 0.0;
  // Encode coverage independently of the actual assigned paint colors.
  const vec3 primaryMask = vec3(1.0, 0.0, 0.0);
  const vec3 secondaryMask = vec3(0.0, 0.0, 1.0);
  const vec3 neutralMask = vec3(0.22);
  vec3 paintLocation = hasFlag(flags, 1.0) || hasFlag(flags, 2.0) ? primaryMask : neutralMask;
  vec3 col;
  if (hasFlag(flags, 2.0)) {                                  // emissive flat
    col = vColor.rgb;
  } else {
    col = hasFlag(flags, 1.0) ? base.rgb * vColor.rgb : base.rgb;
    // secondary color through the paint mask
    vec4 mask = sampleTri(uAux, vLayers.z, p, w, MAP_MASK);
    if (surface == 6.0) mask = vec4(0.0); // framework mask is not secondary paint
    vec3 secondary = mix(vColor.rgb * uSecondaryFactor, vSecondary.rgb, vSecondary.a);
    col = mix(col, base.rgb * secondary, mask.a);
    // Vivid paint gains brightness without shifting hue.
    if (surface == 29.0) col *= 1.20;
    col = mix(col, materialOverlay.rgb, materialOverlay.a);
    paintLocation = mix(mix(paintLocation, secondaryMask, mask.a), neutralMask, materialOverlay.a);
    // overlay decal
    vec4 overlay = sampleTri(uAux, vLayers.w, p, w, MAP_OVERLAY);
    if (decal) overlay = sampleFunctional(uAux, vLayers.w, surface, MAP_OVERLAY);
    if (surface == 2.0) {
      overlay = sampleThruster(vLayers.w, portPoint, portSize, MAP_OVERLAY);
      // Limit each soot sample to its port neighborhood so the outside
      // of the finite emitter grid cannot acquire repeating ghost ports.
      float artwork = step(max(abs(portPoint.x), abs(portPoint.y)), portSize * 1.6);
      if (uTextureScaling[MAP_OVERLAY] == 0) overlay.a *= artwork;
      overlay.rgb = mix(overlay.rgb, vec3(0.0), portCoverage);
      overlay.a = max(overlay.a, portCoverage);
    }
    // Directional thruster artwork only belongs to its two thrust faces.
    if (surface == 0.0 && vMaterialLayers.z > 0.0) overlay = vec4(0.0);
    if (surface == 16.0) overlay = sampleShipName(vLayers.w);
    if (surface == 17.0) overlay = sampleFace(uAux, vLayers.w, 1.0, MAP_OVERLAY);
    if (stripes && vLayers.w > 0.5) {
      float variant = mod(surface - 20.0, 3.0);
      // Preserve world, inverted-world and face-centered stripe variants.
      overlay = variant == 2.0 ? sampleCenteredFace(uAux,vLayers.w,1.0, MAP_OVERLAY)
        : sampleTriScaled(uAux,vLayers.w,p,w,variant == 1.0 ? -1.0 : 1.0, MAP_OVERLAY);
      paintLocation = mix(paintLocation, secondaryMask, overlay.a);
      vec3 stripeColor = surface >= 23.0 ? vec3(0.12) : vec3(1.0);
      overlay.rgb *= mix(stripeColor, vSecondary.rgb, vSecondary.a);
      overlay.a *= mix(1.0, 0.7, vSecondary.a);
    }
    if (generator || surface == 18.0 || surface == 26.0) overlay = vec4(0.0); // emission is applied later; decal backs remain plated
    if (surface == 14.0) overlay = mix(overlay, vec4(1.0, 1.0, 1.0, overlay.a) * vSecondary, vSecondary.a);
    else if (surface == 16.0) {
      if (uTextureScaling[MAP_OVERLAY] != 0) overlay.a = overlay.r;
      overlay.rgb = overlay.rrr * mix((base.rgb * 0.5 + 0.5) * vEmission, vSecondary.rgb, vSecondary.a);
    } else if (surface == 17.0) overlay.rgb *= base.rgb * 0.5 + 0.5;
    else if (hasFlag(flags, 16.0) && !stripes) {
      overlay = mix(overlay, vec4(1.0, 1.0, 1.0, 0.7 * overlay.a) * vSecondary, vSecondary.a);
    }
    col = mix(col, overlay.rgb, overlay.a);
    decalCoverage = overlay.a;
    if (hasFlag(flags, 16.0) && !stripes || surface == 16.0 || surface == 2.0)
      paintLocation = mix(paintLocation, secondaryMask, surface == 2.0 ? portCoverage : decalCoverage);
    else if (!stripes && surface != 28.0)
      paintLocation = mix(paintLocation, neutralMask, decalCoverage);
    if (surface == 28.0) {
      // dock.frag recolors only yellow paint, preserving the gray machinery.
      float yellow = float(col.r - col.b > 0.1) * overlay.a;
      vec3 gray = vec3((col.r + col.g + col.b) * 0.3 * 2.5);
      col = mix(col, mix(col, gray * vSecondary.rgb, vSecondary.a), yellow);
      paintLocation = mix(mix(paintLocation, neutralMask, decalCoverage), secondaryMask, yellow);
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
  if (surface == 4.0 && vLayers.y > 0.5) N = faceNormal(sampleCenteredFace(uNormal, vLayers.y, 1.5, MAP_NORMAL).rgb * 2.0 - 1.0, n);
  if (surface == 27.0 && vLayers.y > 0.5) N = faceNormal(sampleFace(uNormal, vLayers.y, 2.0, MAP_NORMAL).rgb * 2.0 - 1.0, n);
  if (uTextureScaling[MAP_NORMAL] != 0 && vLayers.y > 0.5)
    N = faceNormal(sampleBlockUV(uNormal, vLayers.y, uTextureScaling[MAP_NORMAL]).rgb * 2.0 - 1.0, n);
  if ((decal || generator) && vSurface.w > 0.5) {
    vec4 detail = decal ? sampleFunctional(uAux, vSurface.w, surface, MAP_NORMALOVERLAY)
      : sampleGeneratorDetail(uAux, vSurface.w, surface, MAP_NORMALOVERLAY);
    vec3 decoded = detail.rgb * 2.0 - 1.0;
    if (decal && uTextureScaling[MAP_NORMALOVERLAY] == 0) decoded.xy = -decoded.xy;
    N = normalize(mix(N, faceNormal(decoded, n), detail.a));
    if (generator) col = mix(col, vColor.rgb, detail.a);
    if (surface == 4.0) base = mix(base, vec4(1.0), detail.a);
  }
  if (surface == 2.0 && vSurface.w > 0.5) {
    vec4 detail = sampleThruster(vSurface.w, portPoint, portSize, MAP_NORMALOVERLAY);
    N = normalize(mix(N, faceNormal(detail.rgb * 2.0 - 1.0, n), detail.a * portCoverage));
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
  vec4 materialShading = uMaterialShading[materialCode];
  float refl = mix(materialShading.x, materialShading.y, fres) * vParams.z;
  if (solar > 0.5) refl += 0.5;
  if (hasFlag(flags, 2.0)) refl = 0.0;
  outc += sky(R) * refl;

  // specular
  float spec = pow(clamp(dot(-uLightDir, R), 0.0, 1.0), mix(materialShading.w, 2500.0, solar)) * mix(materialShading.z, 4.0, solar) * mix(base.r, 1.0, solar);
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
  float materialGlow = uMaterialGlow[materialCode] * uGlowStrength;
  if (generator) {
    vec4 highlight = sampleGeneratorDetail(uAux, vLayers.w, surface, MAP_OVERLAY);
    vec3 energy = (effectColor + 0.6) * (highlight.rgb + 0.3) * materialGlow;
    outc = mix(outc, energy, highlight.a);
    paintLocation = mix(paintLocation, secondaryMask, highlight.a);
  }

  // Material lights survive independently of a block's artwork and pod lights.
  if (vMaterialLayers.y > 0.5) {
    vec4 glow = sampleTri(uAux, vMaterialLayers.y, p, w, MAP_MATERIALGLOW);
    if (surface == 4.0) glow = sampleCenteredFace(uAux, vMaterialLayers.y, 1.5, MAP_MATERIALGLOW);
    if (surface == 27.0) glow = sampleFace(uAux, vMaterialLayers.y, 2.0, MAP_MATERIALGLOW);
    float coverage = (decal || surface == 14.0 || stripes) ? 1.0 - decalCoverage : 1.0;
    if (surface == 5.0 || surface == 38.0) outc += glow.rgb * 2.0 * materialGlow;
    else outc = mix(outc, glow.rgb * 2.0 * materialGlow, glow.a * coverage);
  }

  // glow map
  if (vParams.x > 0.5) {
    vec4 glow = sampleTri(uAux, vParams.x, p, w, MAP_GLOW);
    if (surface == 4.0) glow = sampleCenteredFace(uAux, vParams.x, 1.5, MAP_GLOW);
    if (surface == 14.0) outc += glow.rgb * materialGlow;
    else outc = mix(outc, glow.rgb * 2.0 * materialGlow, glow.a);
  }

  if (surface == 1.0) {
    // engine.frag: local -Z has a rectangular outer glow and bright inner core.
    vec2 q = vFaceUV * 2.0 - 1.0;
    vec2 outerRamp = clamp((vec2(0.9) - abs(q)) / 0.2, 0.0, 1.0);
    vec2 innerRamp = clamp((vec2(1.0) - abs(q * 1.5)) / 0.3, 0.0, 1.0);
    float outer = outerRamp.x * outerRamp.y;
    float inner = innerRamp.x * innerRamp.y;
    outc = mix(outc, (outer * effectColor + inner * vec3(1.0)) * materialGlow, outer);
    paintLocation = mix(paintLocation, secondaryMask, outer);
  }

  // fog (game: exponential on view depth, toward the sky colour)
  if (uFogStrength > 0.0 && !hasFlag(flags, 2.0)) {
    float d = length(vWorldPos - cameraPosition);
    outc = mix(outc, sky(eyeDir), 1.0 - exp(-d * uFogStrength * 0.01));
  }

  // Native housing window pass uses world plating coordinates / 8 and raw secondary alpha.
  if(surface == 26.0 && vLayers.w > 0.5) {
    vec4 windows=sampleTriScaled(uAux,vLayers.w,p,w,0.125, MAP_OVERLAY);
    vec3 windowColor=mix(uWindowColor,vSecondary.rgb*2.5,vSecondary.a);
    outc=mix(outc,uWindowStrength*windowColor*windows.rgb,windows.a);
    paintLocation = mix(paintLocation, secondaryMask, windows.a);
  }
  if (uColorMask > .5) {
    gl_FragColor = vec4(paintLocation, 1.0);
    return;
  }
  // Keep a strong fill floor while revealing face angles with a fixed soft key.
  float ambientShape=1.0-uAmbientDetail*.65*(1.0-max(dot(n,normalize(vec3(-.4,.65,.6))),0.0));
  if(uAmbientOnly>.5)outc=col*uAmbientFill*ambientShape;
  // region highlight (state bit 4), then selection tint on top
  outc = mix(outc, uRegionColor, step(3.5, vParams.w) * 0.45);
  outc = mix(outc, uSelectColor, mod(vParams.w,2.0) * 0.65*uShadeSelected);

  if (uDebug > 0.5) {
    if (uDebug < 1.5) outc = base.rgb;
    else if (uDebug < 2.5) outc = vec3(surface == 6.0 ? sampleFrameworkMask(uAux, vLayers.z, MAP_MASK).r : sampleTri(uAux, vLayers.z, p, w, MAP_MASK).a);
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
export function materialShadingFor(materialIndex, params) {
    const material = materialShadingDefaults[materialIndex];
    const { facingReflection = 1, grazingReflection = 1, specular = 1, gloss = 1 } = params.materialShadingScale ?? {};
    const overrides = params.textureAssignment?.materialIndex === materialIndex ? params.textureAssignment.shading : undefined;
    const minReflectivity = overrides?.minReflectivity ?? Math.min(1, material.minReflectivity * facingReflection);
    return {
        minReflectivity,
        maxReflectivity: Math.max(minReflectivity, overrides?.maxReflectivity ?? Math.min(1, material.maxReflectivity * grazingReflection)),
        specularity: overrides?.specularity ?? material.specularity * specular,
        glossyness: Math.max(1, overrides?.glossyness ?? material.glossyness * gloss),
        glow: overrides?.glow ?? material.glow,
    };
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
            uMaterialShading: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
            uTextureScaling: { value: new Int32Array(TEXTURE_SLOTS.length) },
            uMaterialGlow: { value: [1, ...materialShadingDefaults.map(material => material.glow)] },
            uSpecular: { value: 0 },
            uNormalStrength: { value: 1 }, uSharpness: { value: 8 },
            uSecondaryFactor: { value: 0.6 }, uGlowStrength: { value: 1 }, uHologramGlow: { value: 1.5 }, uFogStrength: { value: 0 },
            uShadeSelected: { value: 1 },
            uSelectColor: { value: new THREE.Color().setStyle("#4fd8eb", THREE.LinearSRGBColorSpace) },
            uMirrorOrigin: { value: new THREE.Vector3() },
            uMirrorVisible: { value: new THREE.Vector3() },
            uPaintColor: { value: new THREE.Color().setStyle("#80c6ff", THREE.LinearSRGBColorSpace) },
            uRegionColor: { value: new THREE.Color().setStyle("#5ec27a", THREE.LinearSRGBColorSpace) },
            uDebug: { value: 0 },
            uColorMask: { value: 0 },
            uNearestTransparentDepth: { value: null }, uLimitTransparentDepth: { value: 0 },
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
        aFaceUV: [0.5, 0.5], aSurface: [1, 1, 0, 0], aEmission: [1, 1, 1, 0], aMaterialLayers: [0, 0, 0] };
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
    const materialShading = u.uMaterialShading.value;
    materialShading[0].set(p.minReflectivity, p.maxReflectivity, p.specularity, Math.max(1, p.glossyness));
    materialShadingDefaults.forEach((_, materialIndex) => {
        const material = materialShadingFor(materialIndex, p);
        materialShading[materialIndex + 1].set(material.minReflectivity, material.maxReflectivity, material.specularity, material.glossyness);
        u.uMaterialGlow.value[materialIndex + 1] = material.glow;
    });
    const scaling = p.textureAssignment?.scaling;
    TEXTURE_SLOTS.forEach(([slot], index) => {
        const mode = scaling?.[slot];
        u.uTextureScaling.value[index] = mode === "fit" ? 1 : mode === "fixed" ? 2 : 0;
    });
    u.uSpecular.value = p.specularity;
    u.uNormalStrength.value = p.normalStrength;
    u.uSharpness.value = Math.max(1, p.triplanarSharpness);
    u.uSecondaryFactor.value = p.secondaryFactor;
    u.uGlowStrength.value = p.glowStrength;
    u.uHologramGlow.value = p.hologramGlow ?? 1.5;
    u.uFogStrength.value = p.fogStrength;
    u.uSpillStrength.value = p.spillStrength ?? 0;
}
