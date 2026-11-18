import {createShipNameImage} from './shipName.js';
import {CanonicalRendererError,resourceFailure} from '../../../renderer-layout.js';
import {wedgeTypes,wedgeBoundsWriter,endpointBoundsWriter,isWedgeInstance,hasCanonicalEndpoints,hasDiscreteOrientation,instanceOrientation,encodeOrientationSeams,decodeSeams,placeWedgeVertex,expandWedgeShading,setWedgeCreaseAxes} from './wedgeInstances.js';
import {boxTypes,supportsBoxInstances,isCanonicalBox,setBoxFaceAxes,placeBoxVertex,boxInstanceBounds} from './boxInstances.js';
// ---------------------------------------------------------------------------
// Textured model builder. Shares repeated opaque geometry in bounded spatial
// batches, with merged fallbacks. Attributes carry everything the shader needs:
//   aColor, aSecondary, aLayers (albedo/normal/mask/overlay array layers),
//   aParams (glow layer, flags/material code, reflectivity scale, state: selection bit 1,
//   paint-preview bit 2, region-highlight bit 4, or -1 for hidden).
//   aMaterialLayers (material accent and material glow, separate from artwork).
//   aEmission (material effect color; w packs the seam-side bit mask).
//   aEdges (wire edge angles; w is the triangle corner for barycentrics).
// Packed to stay well under the GPU vertex attribute limit (see gameShader.js).
// Geometry is baked to ship space with flat per-triangle normals.
// ---------------------------------------------------------------------------
import {blockOpacity,supportsOpacity} from '../../../block-opacity.js';
import * as THREE from "../../../vendor/three.module.js";
import {blockIndex,secondaryColor} from '../../../block-colors.js';
import {installBlockRaycast} from './blockRaycast.js';
import { edgeAngles } from './edgeAngles.js';
import { getBlockDefinition, getMaterial } from "../avorion/blockDefinitions.js";
import { blockSurfaceVertexCount, blockSurfaceGeometry, surfaceKind } from "./blockSurface.js";
import { getShadingSpec, resolveTextureNames } from "../textures/shadingMap.js";
import { textureLibrary } from "../textures/textureLibrary.js";
import { thrusterTier } from "./thrusterPorts.js";
import { buildBlockEffects } from "./blockEffects.js";
import { collectBlockLights, buildSpillGrid } from "./blockLights.js";
import { BlockPose } from "./blockPose.js";
import { createGameMaterial, applyGameParams, setSpillGrid, packMaterialFlags, FLAG_DOUBLE_SIDED, FLAG_TINT, FLAG_EMISSIVE, FLAG_TRANSLUCENT, FLAG_CUTOUT, FLAG_OVERLAY_SECONDARY, } from "./gameShader.js";
function parseColor(av, fallback) {
    if (!av)
        return fallback;
    const s = av.replace("#", "").padStart(8, "0");
    if (s.length !== 8)
        return fallback;
    if (!/^[0-9a-f]{8}$/i.test(s))
        return fallback;
    const n = parseInt(s, 16);
    if (!Number.isFinite(n))
        return fallback;
    // Kept in gamma space: the game multiplies plating by this colour directly.
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, ((n >>> 24) & 255) / 255];
}
/**
 * Bit per ship-space side (-X,+X,-Y,+Y,-Z,+Z) whose face is completely covered
 * by touching neighbours. Those faces can never be seen, so they are pushed
 * back in depth and cannot z-fight through the neighbour's outer surface.
 * Partly covered faces stay unbiased: their exposed part is outer hull. Only
 * blocks for which `covers` holds (solid, opaque boxes) can cover a face; a
 * wedge or a window touching a face's plane still leaves part of it visible.
 */
export function seamSides(blocks, covers = () => true) {
    const masks = new Map(blocks.map(b => [b.id, 0]));
    const solid = blocks.filter(b => b.size.x > 0 && b.size.y > 0 && b.size.z > 0), count = solid.length;
    // Per block: lower x,y,z then upper x,y,z.
    const box = new Float64Array(count * 6), covered = new Float64Array(count * 6), bits = new Int32Array(count);
    const solidBox = Uint8Array.from(solid, b => covers(b) ? 1 : 0);
    solid.forEach((b, n) => ["x", "y", "z"].forEach((a, i) => {
        box[n * 6 + i] = b.position[a] - b.size[a] / 2;
        box[n * 6 + 3 + i] = b.position[a] + b.size[a] / 2;
    }));
    const CELL = 2, MAX_CELLS = 256, seen = new Int32Array(count).fill(-1);
    // Grid cells a face covers within its plane, or null when too large to index.
    const cellsOf = (n, u, v) => {
        const u0 = Math.floor(box[n * 6 + u] / CELL), u1 = Math.floor(box[n * 6 + 3 + u] / CELL);
        const v0 = Math.floor(box[n * 6 + v] / CELL), v1 = Math.floor(box[n * 6 + 3 + v] / CELL);
        if ((u1 - u0 + 1) * (v1 - v0 + 1) > MAX_CELLS) return null;
        const cells = [];
        for (let a = u0; a <= u1; a++) for (let c = v0; c <= v1; c++) cells.push(a * 1048576 + c);
        return cells;
    };
    let visit = 0;
    for (let axis = 0; axis < 3; axis++) {
        const u = (axis + 1) % 3, v = (axis + 2) % 3, planes = new Map();
        // Index each block's lower face by plane, then by a coarse grid within it.
        for (let n = 0; n < count; n++) {
            const k = Math.round(box[n * 6 + axis] * 1000);
            let plane = planes.get(k);
            if (!plane) planes.set(k, plane = { all: [], wide: [], cells: new Map() });
            plane.all.push(n);
            const cells = cellsOf(n, u, v);
            if (!cells) { plane.wide.push(n); continue; }
            for (const cell of cells) {
                const list = plane.cells.get(cell);
                if (list) list.push(n); else plane.cells.set(cell, [n]);
            }
        }
        const touch = (n, other) => {
            if (other === n || seen[other] === visit || Math.abs(box[other * 6 + axis] - box[n * 6 + 3 + axis]) > 1e-3) return;
            seen[other] = visit;
            const du = Math.min(box[n * 6 + 3 + u], box[other * 6 + 3 + u]) - Math.max(box[n * 6 + u], box[other * 6 + u]);
            const dv = Math.min(box[n * 6 + 3 + v], box[other * 6 + 3 + v]) - Math.max(box[n * 6 + v], box[other * 6 + v]);
            if (du <= 1e-4 || dv <= 1e-4) return;
            if (solidBox[other]) covered[n * 6 + axis * 2 + 1] += du * dv;
            if (solidBox[n]) covered[other * 6 + axis * 2] += du * dv;
        };
        // Match each upper face against lower faces in the same plane.
        for (let n = 0; n < count; n++) {
            const k = Math.round(box[n * 6 + 3 + axis] * 1000), cells = cellsOf(n, u, v);
            visit++;
            for (let near = k - 1; near <= k + 1; near++) {
                const plane = planes.get(near);
                if (!plane) continue;
                if (!cells) { for (const other of plane.all) touch(n, other); continue; }
                for (const other of plane.wide) touch(n, other);
                for (const cell of cells) for (const other of plane.cells.get(cell) ?? []) touch(n, other);
            }
        }
        // Valid plans never overlap, so summed contact areas measure coverage.
        for (let n = 0; n < count; n++) {
            const area = (box[n * 6 + 3 + u] - box[n * 6 + u]) * (box[n * 6 + 3 + v] - box[n * 6 + v]);
            for (const side of [axis * 2, axis * 2 + 1]) if (covered[n * 6 + side] >= area * 0.999) bits[n] |= 1 << side;
        }
    }
    solid.forEach((b, n) => masks.set(b.id, bits[n]));
    return masks;
}
function rawSecondaryColor(block) {
    return parseColor(secondaryColor(block), [0, 0, 0, 0]);
}
class Builder {
    ranges = new Map();
    written = 0;

    constructor(vertexCount, instanceCount = 0, endpoints = false) {
        const instanced = instanceCount > 0;
        this.vertexCount = vertexCount;
        this.instanced = instanced;
        this.g = instanced ? new THREE.InstancedBufferGeometry() : new THREE.BufferGeometry();
        // Keep the same attribute order and divisors in both layouts.
        for (const [name, size, perBlock] of [
            ['aEdges',4], ['position',3], ['normal',3], ['aColor',4,true],
            ['aSecondary',4,true], ['aLayers',4,true], ['aFaceUV',2],
            ['aSurface',4], ['aSide',4], ['aEmission',4,true],
            ['aMaterialLayers',3,true], ['aParams',4,true]
        ]) {
            const isInstanceAttribute = instanced && perBlock;
            const Attribute = isInstanceAttribute ? THREE.InstancedBufferAttribute : THREE.BufferAttribute;
            const count = isInstanceAttribute ? instanceCount : vertexCount;
            const itemSize = endpoints && name === 'aMaterialLayers' ? 4 : size;
            const attribute = new Attribute(new Float32Array(count * itemSize), itemSize);
            if (name === 'aParams' || isInstanceAttribute && (name === 'aColor' || name === 'aSecondary'))
                attribute.setUsage(THREE.DynamicDrawUsage);
            this.g.setAttribute(name, attribute);
        }
    }

    add(id, geometry, color, secondary, layers, params, surface, normalOverlay, emission, materialLayers, seamSides = [0]) {
        const { positions, uv, faces } = geometry;
        const count = positions.length / 3, start = this.written;
        if (count % 3 || uv.length !== count * 2 || faces.length !== count * 3 || start + count > this.vertexCount)
            throw new Error('Hull geometry emission exceeded its allocation or emitted inconsistent attributes.');
        const angles = edgeAngles(positions);
        const attributes = this.g.attributes;
        attributes.position.array.set(positions, start * 3);
        attributes.aFaceUV.array.set(uv, start * 2);
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
        const emissionSeam = [emission[0], emission[1], emission[2], seamSides[0]];
        const edges = attributes.aEdges.array, side = attributes.aSide.array, surfaceData = attributes.aSurface.array;
        for (let i = 0; i < positions.length; i += 9) {
            a.fromArray(positions, i);
            b.fromArray(positions, i + 3);
            c.fromArray(positions, i + 6);
            n.subVectors(b, a).cross(c.sub(a)).normalize();
            const triangle = i / 3, creases = angles.subarray(triangle, triangle + 3);
            for (let k = 0; k < 3; k++) {
                const source = i + k * 3, vertex = start + triangle + k, offset = vertex * 4;
                edges.set(creases, offset);
                edges[offset + 3] = k;
                n.toArray(attributes.normal.array, vertex * 3);
                side[offset] = positions[source];
                side[offset + 1] = positions[source + 1];
                side[offset + 2] = positions[source + 2];
                side[offset + 3] = faces[source + 2];
                surfaceData[offset] = faces[source];
                surfaceData[offset + 1] = faces[source + 1];
                surfaceData[offset + 2] = surfaceKind(surface, faces[source + 2]);
                surfaceData[offset + 3] = normalOverlay;
                if (!this.instanced) {
                    attributes.aColor.array.set(color, offset);
                    attributes.aSecondary.array.set(secondary, offset);
                    attributes.aLayers.array.set(layers, offset);
                    attributes.aParams.array.set(params, offset);
                    attributes.aEmission.array.set(emissionSeam, offset);
                    attributes.aMaterialLayers.array.set(materialLayers, vertex * 3);
                }
            }
        }
        this.written += count;
        const list = this.ranges.get(id) ?? [];
        list.push([start, count]);
        this.ranges.set(id, list);
    }

    finish() {
        if (this.written !== this.vertexCount)
            throw new Error('Hull geometry emission did not fill its allocation.');
        this.g.computeBoundingSphere();
        return this.g;
    }
}
export function buildTexturedModel(model, profile, params) {
    const live = model.blocks.filter((b) => !b.deleted && (!b.el || b.el.isConnected));
    // Collect the texture names this ship needs, then pack arrays once.
    const albedoNames = new Set(), normalNames = new Set(), auxNames = new Set();
    const generated = new Map();
    const nameText = (params.shipName?.trim() || model.doc?.documentElement.getAttribute("name") || model.fileName.replace(/\.[^.]+$/, "")).slice(0, 80);
    const nameKey = "__shipname:" + nameText;
    if (live.some(b => b.typeIndex === 600 || b.typeIndex === 601)) {
        generated.set(nameKey, createShipNameImage(nameText, textureLibrary.resolution));
    }
    const resolved = live.map((b) => {
        const spec = getShadingSpec(b.typeIndex);
        const names = resolveTextureNames(b.typeIndex, b.materialIndex, params.textureAssignment);
        if (spec.surface === "ship-name" && names.overlay === "shipname")
            names.overlay = nameKey;
        if (names.albedo)
            albedoNames.add(names.albedo);
        if (names.normal)
            normalNames.add(names.normal);
        for (const n of [names.mask, names.overlay, names.glow, names.normalOverlay, names.materialOverlay, names.materialGlow])
            if (n)
                auxNames.add(n);
        return { spec, names };
    });
    const textureStart=params.measure&&performance.now();
    const owned = [];
    let spill = null, spillRadius = null;
    const meshes = [];
    try {
    const albedo = textureLibrary.getArray("albedo", albedoNames);
    owned.push(()=>albedo.release());
    const normal = textureLibrary.getArray("normal", normalNames);
    owned.push(()=>normal.release());
    const aux = textureLibrary.getArray("aux", auxNames, generated);
    owned.push(()=>aux.release());
    params.measure?.("texture arrays prepared",{durationMs:params.measure?performance.now()-textureStart:0});
    const layer = (arr, name) => name ? (arr.layerOf.get(name) ?? 0) : 0;
    const batches=(params.prepared||[]).map(entry=>{
      const g=entry.instanced?new THREE.InstancedBufferGeometry():new THREE.BufferGeometry();
      owned.push(()=>g.dispose());
      for(const [name,attr] of Object.entries(entry.attributes))g.setAttribute(name,attr.instanced?new THREE.InstancedBufferAttribute(attr.array,attr.size):new THREE.BufferAttribute(attr.array,attr.size));
      if(entry.index)g.setIndex(new THREE.BufferAttribute(entry.index,1));
      if(entry.instanced)g.instanceCount=entry.count;
      if(entry.canonicalLayout)g.userData.canonicalLayout=entry.canonicalLayout;
      g.boundingBox=new THREE.Box3(new THREE.Vector3(...entry.min),new THREE.Vector3(...entry.max));g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
      return {...entry,g,builder:{ranges:new Map(entry.ranges)}};
    });
    if(!params.prepared){
    const canonicalSupported = (params.canonicalBoxes || params.canonicalWedges) && supportsBoxInstances(profile);
    const writeWedgeBounds = canonicalSupported && params.canonicalWedges ? wedgeBoundsWriter(profile) : null;
    const writeBoxBounds = canonicalSupported && params.canonicalBoxes && (params.canonicalEndpointBoxes || params.canonicalDiscrete)
        ? endpointBoundsWriter(profile, 'box') : null;
    const wedgePrecision = {}, endpointBoxPrecision = {};
    const classificationStart = params.measure && performance.now();
    const opaque = [], twoSided = [], translucent = [], instanceGroups = new Map(), instancePlans = [];
    const coverIds=new Set(live.filter((b,i)=>{const spec=resolved[i].spec,kind=getBlockDefinition(b.typeIndex).geometryKind;
      return (kind==='box'||kind==='placeholder')&&b.typeIndex!==10&&!spec.translucent&&!spec.cutout&&!(supportsOpacity(b)&&blockOpacity(b)<1);}).map(b=>b.id));
    const seams=seamSides(live,b=>coverIds.has(b.id));
    const span=model.bounds?.size||{x:1,y:1,z:1},cell=Math.max(1,Math.max(span.x,span.y,span.z)/Math.max(1,Math.cbrt(live.length/1024)));

    live.forEach((b, i) => {
        const { spec, names } = resolved[i];
        const color = parseColor(b.color, [0.5, 0.5, 0.5, 1]);if(supportsOpacity(b))color[3]=blockOpacity(b);
        // Native shaders choose their own defaults and mix with the raw alpha.
        const secondary = rawSecondaryColor(b);
        let flags = 0;
        if(spec.translucent||spec.cutout||['x','y','z'].some(axis=>b.size[axis]<=0))flags|=FLAG_DOUBLE_SIDED;
        if (spec.tint)
            flags |= FLAG_TINT;
        if (spec.emissiveFlat)
            flags |= FLAG_EMISSIVE;
        if (spec.translucent)
            flags |= FLAG_TRANSLUCENT;
        if (spec.cutout)
            flags |= FLAG_CUTOUT;
        if (spec.overlayIsSecondary)
            flags |= FLAG_OVERLAY_SECONDARY;
        const layers = [layer(albedo, names.albedo), layer(normal, names.normal), layer(aux, names.mask), layer(aux, names.overlay)];
        const pars = [layer(aux, names.glow), packMaterialFlags(flags, b.materialIndex), spec.reflect ?? 1, 0];
        const emission = parseColor("ff" + getMaterial(b.materialIndex).color.slice(1), [1, 1, 1, 1]).slice(0, 3);
        const blended = spec.translucent && !(spec.surface === "hologram" && color[3] >= 1);
        const args=[color,secondary,layers,pars,spec.surface,layer(aux,names.normalOverlay),emission,[layer(aux,names.materialOverlay),layer(aux,names.materialGlow),[7,13].includes(b.typeIndex)?thrusterTier(b.size.x,b.size.y,b.size.z).size:0],[b.typeIndex===10?0:seams.get(b.id)]];
        if(blended)translucent.push({b,args});
        else{
          let canonical;
          if (writeWedgeBounds && wedgeTypes.has(b.typeIndex) && !(flags & FLAG_DOUBLE_SIDED)) {
            canonical = writeWedgeBounds(b) ? (params.canonicalDiscrete ? 'discreteWedge' : 'wedge') : undefined;
            if (params.measure) {
              const counts = wedgePrecision[b.typeIndex] ??= {passed:0,rejected:0};
              counts[canonical ? 'passed' : 'rejected']++;
            }
          } else if (canonicalSupported && params.canonicalBoxes && !(flags & FLAG_DOUBLE_SIDED)) {
            if (writeBoxBounds && boxTypes.has(b.typeIndex)) {
              if (writeBoxBounds(b)) canonical = params.canonicalDiscrete ? 'discreteBox' : 'endpointBox';
              if (params.measure) {
                const counts = endpointBoxPrecision[b.typeIndex] ??= {passed:0,rejected:0};
                counts[canonical ? 'passed' : 'rejected']++;
              }
            } else if (isCanonicalBox(b, profile)) canonical = 'box';
          }
          const sizeKey = canonical ?? [b.size.x,b.size.y,b.size.z].join('|');
          const orientationKey = canonical?.startsWith('discrete') ? '' : [b.look,b.up].join('|');
          const key=[b.typeIndex,b.materialIndex,orientationKey,sizeKey,flags,Math.floor(b.position.x/cell),Math.floor(b.position.y/cell),Math.floor(b.position.z/cell)].join('|');
          let entries=instanceGroups.get(key);if(!entries){entries=[];instanceGroups.set(key,entries);}entries.push({b,args,canonical});
        }
    });
    // Bound draw calls on heterogeneous ships: spend batches on the largest
    // repeated groups first, and merge the remaining shapes into shared meshes.
    let instanceBudget=Math.max(16,2*Math.ceil(live.length/1024));
    const canonicalCounts = {}, canonicalRejected = {smallGroup:0,budget:0,instancingDisabled:0};
    for(const entries of [...instanceGroups.values()].sort((a,b)=>b.length-a.length)){
      const batchCount=Math.ceil(entries.length/1024);
      const {canonical,b} = entries[0];
      if(params.measure && canonical){
        const counts=canonicalCounts[b.typeIndex]??={candidates:0,accepted:0};
        counts.candidates+=entries.length;
        const reason=entries.length<16?'smallGroup':batchCount>instanceBudget?'budget':params.instancing===false?'instancingDisabled':null;
        if(reason)canonicalRejected[reason]+=entries.length;
        else counts.accepted+=entries.length;
      }
      if(entries.length<16||batchCount>instanceBudget||params.instancing===false){
        for(const entry of entries)((entry.args[3][1]&FLAG_DOUBLE_SIDED)?twoSided:opaque).push(entry);
        continue;
      }
      instanceBudget-=batchCount;
      instancePlans.push(entries);
    }
    instanceGroups.clear();
    const classificationMs = params.measure ? performance.now() - classificationStart : 0;
    const sizingStart = params.measure && performance.now();
    const expandedPlans = [[opaque,false,false],[twoSided,false,true],[translucent,true,true]].map(([entries,isT,doubleSided])=>{
      const vertexCount = entries.reduce((total,{b})=>total+blockSurfaceVertexCount(b.typeIndex),0);
      return {entries,isT,doubleSided,vertexCount};
    });
    const sizingMs = params.measure ? performance.now() - sizingStart : 0;
    const writeStart = params.measure && performance.now();
    for(const entries of instancePlans){
      const templateVertexCount = blockSurfaceVertexCount(entries[0].b.typeIndex);
      for(let start=0;start<entries.length;start+=1024){
        const chunk=entries.slice(start,start+1024),first=chunk[0],layout=first.canonical;
        const wedge=layout==='wedge'||layout==='discreteWedge', discrete=layout?.startsWith('discrete');
        const endpoints=!!layout&&layout!=='box';
        const builder=new Builder(templateVertexCount,chunk.length,endpoints);
        owned.push(()=>builder.g.dispose());
        const template={...first.b,position:{x:0,y:0,z:0}};
        if(layout)template.size={x:1,y:1,z:1};
        if(discrete){template.look=1;template.up=3;}
        builder.add(first.b.id,blockSurfaceGeometry(template,profile),...first.args);
        const g=builder.g;g.instanceCount=chunk.length;
        if(layout)g.userData.canonicalLayout=layout;
        const attributes={aColor:[0,4],aSecondary:[1,4],aLayers:[2,4],aParams:[3,4],aEmission:[6,4],aMaterialLayers:[7,3]};
        for(const [name,[argument]] of Object.entries(attributes)){
          const {array,itemSize}=g.getAttribute(name);
          chunk.forEach(({b,args},i)=>{
            if(name!=='aEmission')array.set(args[argument],i*itemSize);
            else {
              const seams=args[8][0];
              array.set([...args[6],discrete?encodeOrientationSeams(b.look,b.up,seams):seams],i*itemSize);
            }
          });
        }
        const transformSize=endpoints?4:3;
        const offsets=new THREE.InstancedBufferAttribute(new Float32Array(chunk.length*transformSize),transformSize);
        g.setAttribute('aOffset',offsets);
        let scales;
        if(first.canonical){
          scales=new THREE.InstancedBufferAttribute(new Float32Array(chunk.length*transformSize),transformSize);
          g.setAttribute('aScale',scales);
          try{
            setBoxFaceAxes(g,template.look,template.up);
            if(wedge)setWedgeCreaseAxes(g,template.look,template.up);
          }catch(error){
            if(resourceFailure(error))throw error;
            throw new CanonicalRendererError('Canonical template metadata could not be constructed.',{cause:error});
          }
        }
        if(endpoints){
          const writeBounds=wedge?writeWedgeBounds:writeBoxBounds;
          const extents=new THREE.Vector3();
          const materialLayers=g.getAttribute('aMaterialLayers');
          chunk.forEach(({b},i)=>{
            if(!writeBounds(b,(min,max,localScale)=>{
              const lookAxis=b.look>>1,upAxis=b.up>>1;
              extents.setComponent(lookAxis,localScale.x);
              extents.setComponent(upAxis,localScale.y);
              extents.setComponent(3-lookAxis-upAxis,localScale.z);
              offsets.setXYZW(i,min.x,min.y,min.z,extents.x);
              scales.setXYZW(i,max.x,max.y,max.z,extents.y);
              materialLayers.setW(i,extents.z);
            }))throw new CanonicalRendererError('Canonical endpoints changed after classification.');
          });
        }else{
          chunk.forEach(({b},i)=>offsets.setXYZ(i,b.position.x,b.position.y,b.position.z));
          if(scales)chunk.forEach(({b},i)=>scales.setXYZ(i,b.size.x,b.size.y,b.size.z));
        }
        builder.finish();
        g.computeBoundingBox();
        const local=g.boundingBox,bounds=new THREE.Box3(),instanceBounds=new THREE.Box3();
        const offset=new THREE.Vector3(),scale=new THREE.Vector3();
        for(let i=0;i<chunk.length;i++){
          offset.fromBufferAttribute(offsets,i);
          if(endpoints)instanceBounds.set(offset,scale.fromBufferAttribute(scales,i));
          else if(scales)boxInstanceBounds(instanceBounds,local,scale.fromBufferAttribute(scales,i),offset);
          else instanceBounds.copy(local).translate(offset);
          bounds.union(instanceBounds);
        }
        g.boundingBox=bounds;g.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
        builder.ranges=new Map(chunk.map(({b},i)=>[b.id,[[i,1]]]));
        batches.push({builder,g,isT:false,instanced:true,doubleSided:!!(first.args[3][1]&FLAG_DOUBLE_SIDED)});
      }
    }
    for(const {entries,isT,doubleSided,vertexCount} of expandedPlans){
      if(!vertexCount)continue;
      const builder = new Builder(vertexCount);
      owned.push(()=>builder.g.dispose());
      for(const {b,args} of entries)builder.add(b.id,blockSurfaceGeometry(b,profile),...args);
      entries.length = 0;
      batches.push({builder,g:builder.finish(),isT,doubleSided});
    }
    params.measure?.('hull writes completed',{classificationMs,sizingMs,writeAndBoundsMs:performance.now()-writeStart,canonicalCounts,canonicalRejected,wedgePrecision,endpointBoxPrecision});
    }
    const finalizationStart = params.measure && performance.now();
    let pickingMs = 0;
    const group = new THREE.Group();
    group.name = "textured";
    const effects = buildBlockEffects(params.simplified?[]:live, profile, params);
    owned.push(()=>effects.dispose());
    const effectPose = new BlockPose(effects.mesh.geometry, effects.ranges);
    group.add(...effects.meshes);
    const materials = [],materialCache=new Map();
    const owners=new Map();
    const ranges = new Map();
    for (const {builder,g,isT,instanced,doubleSided,pickTree} of batches) {
        const canonical=g.userData.canonicalLayout;
        const materialKey=[isT,instanced,doubleSided,canonical].join(':');
        let mat=materialCache.get(materialKey);
        if(!mat){mat=createGameMaterial(albedo.texture,normal.texture,aux.texture,params,isT);materialCache.set(materialKey,mat);materials.push(mat);owned.push(()=>mat.dispose());}
        mat.userData.hardwareCull=!doubleSided;
        if(!doubleSided)mat.side=THREE.FrontSide;
        if(instanced){mat.defines={...mat.defines,BLOCK_INSTANCED:1};}
        if(canonical==='box')mat.defines.BLOCK_CANONICAL_BOX=1;
        if(hasCanonicalEndpoints(g))mat.defines.BLOCK_CANONICAL_ENDPOINTS=1;
        if(isWedgeInstance(g))mat.defines.BLOCK_CANONICAL_WEDGE=1;
        if(hasDiscreteOrientation(g))mat.defines.BLOCK_CANONICAL_DISCRETE=1;
        if (isT)
            mat.forceSinglePass = true; // triangles are sorted globally, including back faces
        const mesh = new THREE.Mesh(g, mat);
        if (!isT)
            mesh.layers.enable(1);
        mesh.renderOrder = isT ? 10 : 0;
        // Layer 2 isolates translucent surfaces for the effect depth split.
        if (isT) { mesh.layers.enable(2); mesh.userData.translucent = true; }
        mesh.userData.textured = true;mesh.userData.instanced=!!instanced;
        meshes.push(mesh);
        group.add(mesh);
        // keep ranges per mesh so selection can address the right attribute
        for (const [id, list] of builder.ranges) {
            const acc = ranges.get(id) ?? [];
            for (const [s, c] of list)
                acc.push([s, c]);
            ranges.set(id, acc);
        }
        mesh.userData.ranges = builder.ranges;for(const id of builder.ranges.keys())owners.set(id,mesh);
        const pickStart = params.measure && performance.now();
        installBlockRaycast(mesh,pickTree);
        if(params.measure)pickingMs += performance.now()-pickStart;
        if(!instanced)mesh.userData.pose = new BlockPose(g, builder.ranges);
        if (isT) {
            const position = g.getAttribute("position"), centers = [];
            for (let i = 0; i < position.count; i += 3)
                centers.push(new THREE.Vector3()
                    .fromBufferAttribute(position, i).add(new THREE.Vector3().fromBufferAttribute(position, i + 1))
                    .add(new THREE.Vector3().fromBufferAttribute(position, i + 2)).multiplyScalar(1 / 3));
            const IndexArray = position.count > 65535 ? Uint32Array : Uint16Array;
            const existing = g.index?.array;
            const index = existing instanceof IndexArray && existing.length === position.count
                ? existing : new IndexArray(position.count);
            for (let i = 0; i < index.length; i++) index[i] = i;
            if (index !== existing) g.setIndex(new THREE.BufferAttribute(index, 1));
            mesh.userData.sortCenters = centers;
            mesh.userData.sortOrder=centers.map((c,i)=>({i,z:0}));
            mesh.userData.sortedView = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
    }
    if(params.measure){
        let attributeBytes=0,indexBytes=0,largestBatchBytes=0,expandedVertices=0,templateVertices=0,instances=0;
        for(const {g,instanced} of batches){
            const bytes=Object.values(g.attributes).reduce((total,attr)=>total+attr.array.byteLength,0);
            const indices=g.index?.array.byteLength||0,vertices=g.getAttribute('position').count;
            attributeBytes+=bytes;
            indexBytes+=indices;
            largestBatchBytes=Math.max(largestBatchBytes,bytes+indices);
            if(instanced){templateVertices+=vertices;instances+=g.instanceCount;}
            else expandedVertices+=vertices;
        }
        params.measure('hull construction',{prepared:!!params.prepared,expandedVertices,templateVertices,instances,
            attributeBytes,indexBytes,largestBatchBytes,numericStagingArrays:0,numericStagingSlots:0,sideExpansionSlots:0,
            pickingMs,finalizationMs:performance.now()-finalizationStart});
    }
    let selected = new Set(), hidden = new Set(), hovered = new Set(), regioned = new Set();
    const lights = collectBlockLights(live, profile);
    const rebuildSpill = () => {
        spill?.dispose();
        spill = lights.length ? buildSpillGrid(lights, spillRadius, hidden) : null;
        materials.forEach(m => setSpillGrid(m, spill));
    };
    const updateState = (changed) => {
        const dirty=new Map();
        for(const id of changed){
            const mesh=owners.get(id);if(!mesh)continue;const attr=mesh.geometry.getAttribute('aParams');
            const state=hidden.has(id)?-1:Number(selected.has(id))+2*Number(hovered.has(id))+4*Number(regioned.has(id));
            const wasHidden=attr.getW(mesh.userData.ranges.get(id)[0][0])<-.5;mesh.userData.hiddenCount=(mesh.userData.hiddenCount||0)+Number(state<0)-Number(wasHidden);
            mesh.visible=mesh.userData.hiddenCount<mesh.userData.ranges.size;
            const span=dirty.get(mesh)||[Infinity,0];
            for(const [start,count] of mesh.userData.ranges.get(id)){
                for(let v=start;v<start+count;v++)attr.setW(v,state);
                span[0]=Math.min(span[0],start);span[1]=Math.max(span[1],start+count);
            }dirty.set(mesh,span);
        }
        for(const [mesh,[start,end]] of dirty){const attr=mesh.geometry.getAttribute('aParams');attr.addUpdateRange(start*4,(end-start)*4);attr.needsUpdate=true;}
        for(const mesh of meshes)mesh.userData.hidden=hidden;
    };
    owned.length=0;
    return {
        group, materials, ranges,
        dispose() {
            spill?.dispose();
            meshes.forEach((m) => { m.geometry.dispose(); });
            materials.forEach((m) => m.dispose());
            effects.dispose();
            albedo.release();
            normal.release();
            aux.release();
        },
        setSelection(ids) {
            const next=new Set(ids),changed=new Set([...selected].filter(id=>!next.has(id)));for(const id of next)if(!selected.has(id))changed.add(id);
            selected=next;updateState(changed);
        },
        setRegion(ids) {
            const next=new Set(ids),changed=new Set([...regioned].filter(id=>!next.has(id)));for(const id of next)if(!regioned.has(id))changed.add(id);
            regioned=next;updateState(changed);
        },
        setPaintPreview(ids) {
            const next=new Set(ids),changed=new Set([...hovered].filter(id=>!next.has(id)));for(const id of next)if(!hovered.has(id))changed.add(id);
            hovered=next;updateState(changed);
        },
        setEffectHidden(ids) { if(this.effectHidden!==ids){effects.setHidden(ids);this.effectHidden=ids;} },
        setHidden(ids) { const next=new Set(ids),changed=new Set([...hidden].filter(id=>!next.has(id)));for(const id of next)if(!hidden.has(id))changed.add(id);hidden=next;updateState(changed);effects.setHidden(ids);this.effectHidden=null;if(spillRadius!==null&&lights.some(l=>changed.has(l.id)))rebuildSpill(); },
        updateColors(nextModel,changedIds) {
            const index=blockIndex(nextModel),changed=changedIds?[...changedIds].map(id=>index.get(id)).filter(Boolean):nextModel.blocks;
            effects.updateColors(changed);
            const dirty=new Map();
            for(const block of changed){
                const mesh=owners.get(block.id);if(!mesh)continue;
                const color=parseColor(block.color,[.5,.5,.5,1]),secondary=rawSecondaryColor(block);
                if(supportsOpacity(block))color[3]=blockOpacity(block);
                const attr=mesh.geometry.getAttribute('aColor'),second=mesh.geometry.getAttribute('aSecondary'),span=dirty.get(mesh)||[Infinity,0];
                for(const [start,count] of mesh.userData.ranges.get(block.id)){
                    for(let v=start;v<start+count;v++){attr.setXYZW(v,...color);second.setXYZW(v,...secondary);}
                    span[0]=Math.min(span[0],start);span[1]=Math.max(span[1],start+count);
                }dirty.set(mesh,span);
            }
            for(const [mesh,[start,end]] of dirty)for(const name of ['aColor','aSecondary']){const attr=mesh.geometry.getAttribute(name);attr.addUpdateRange(start*4,(end-start)*4);attr.needsUpdate=true;}
        },

        setParams(p) {
            materials.forEach((m) => applyGameParams(m, p)); effects.setParams(p);
            const radius = p.spillRadius ?? 5;
            if (radius !== spillRadius) { spillRadius = radius; rebuildSpill(); }
        },
        setTime(time) { effects.setTime(time); },
        setGlassDepth(texture, logDepth) {
            effects.setGlassDepth(texture, logDepth);
            for (const material of materials) {
                material.uniforms.uNearestTransparentDepth.value = texture;
                material.uniforms.uLimitTransparentDepth.value = texture ? 1 : 0;
            }
        },
        setBlockTransforms(poses) {
            effectPose.apply(poses);
            for (const mesh of meshes) {
                if(mesh.userData.instanced){
                  // Viewer-only poses can change shape/orientation. Expand only this
                  // affected batch; ordinary selection and color edits stay instanced.
                  if(![...poses.keys()].some(id=>mesh.userData.ranges.has(id)))continue;
                  const old=mesh.geometry,count=old.instanceCount,vertices=old.getAttribute('position').count,next=new THREE.BufferGeometry();
                  const offsets=old.getAttribute('aOffset'),scales=old.getAttribute('aScale'),endpoints=hasCanonicalEndpoints(old),discrete=hasDiscreteOrientation(old);
                  const extents=new THREE.Vector3(),inverseRotation=new THREE.Matrix3();
                  const point=new THREE.Vector3(),scale=new THREE.Vector3(),offset=new THREE.Vector3();
                  for(const [name,attribute] of Object.entries(old.attributes)){
                    if(name==='aOffset'||name==='aScale')continue;
                    const size=endpoints&&name==='aMaterialLayers'?3:attribute.itemSize,data=new Float32Array(count*vertices*size);
                    for(let i=0;i<count;i++){
                      const rotation=discrete?instanceOrientation(old,i):null;
                      if(scales){
                        scale.fromBufferAttribute(scales,i);
                        offset.fromBufferAttribute(offsets,i);
                        if(endpoints)extents.set(offsets.getW(i),scales.getW(i),old.getAttribute('aMaterialLayers').getW(i));
                        else extents.copy(scale);
                        if(rotation){
                          extents.applyMatrix3(inverseRotation.copy(rotation).transpose());
                          extents.set(Math.abs(extents.x),Math.abs(extents.y),Math.abs(extents.z));
                        }
                      }
                      for(let v=0;v<vertices;v++){
                        const dst=(i*vertices+v)*size,src=(attribute.isInstancedBufferAttribute?i:v)*attribute.itemSize;
                        for(let k=0;k<size;k++)data[dst+k]=attribute.array[src+k];
                        if(name==='position'||name==='aSide'){
                          if(scales)(endpoints?placeWedgeVertex:placeBoxVertex)(point.fromArray(attribute.array,src),scale,offset,rotation).toArray(data,dst);
                          else for(let k=0;k<3;k++)data[dst+k]=attribute.array[src+k]+offsets.array[i*3+k];
                        }else if(scales&&name==='aSurface'){
                          data[dst]=extents.getComponent(data[dst]);
                          data[dst+1]=extents.getComponent(data[dst+1]);
                        }else if(discrete&&name==='aEmission')data[dst+3]=decodeSeams(data[dst+3]);
                      }
                    }
                    next.setAttribute(name,new THREE.BufferAttribute(data,size));
                  }
                  if(endpoints)expandWedgeShading(next,vertices);
                  if(scales){
                    next.computeBoundingBox();
                    next.computeBoundingSphere();
                    params.measure?.('canonical pose expansion',{instances:count,vertices:count*vertices,
                        attributeBytes:count*vertices*172});
                  }
                  const nextRanges=new Map([...mesh.userData.ranges].map(([id,[[i]]])=>[id,[[i*vertices,vertices]]]));
                  mesh.geometry=next;mesh.userData.ranges=nextRanges;for(const [id,list] of nextRanges)ranges.set(id,list);mesh.userData.instanced=false;mesh.userData.pose=new BlockPose(next,nextRanges);installBlockRaycast(mesh);old.dispose();
                  const compile=mesh.material.onBeforeCompile;mesh.material=mesh.material.clone();mesh.material.onBeforeCompile=compile;delete mesh.material.defines.BLOCK_INSTANCED;delete mesh.material.defines.BLOCK_CANONICAL_BOX;delete mesh.material.defines.BLOCK_CANONICAL_WEDGE;delete mesh.material.defines.BLOCK_CANONICAL_ENDPOINTS;delete mesh.material.defines.BLOCK_CANONICAL_DISCRETE;mesh.material.needsUpdate=true;materials.push(mesh.material);setSpillGrid(mesh.material,spill);
                }
                mesh.userData.pose.apply(poses);
                const centers = mesh.userData.sortCenters;
                if (centers) {
                    const p = mesh.geometry.getAttribute("position"), v = new THREE.Vector3();
                    centers.forEach((c, i) => { c.fromBufferAttribute(p, i * 3).add(v.fromBufferAttribute(p, i * 3 + 1)).add(v.fromBufferAttribute(p, i * 3 + 2)).multiplyScalar(1 / 3); });
                    mesh.userData.sortedView.elements.fill(0);
                }
            }
        },
        prepare(camera) {
            camera.updateMatrixWorld();
            group.updateWorldMatrix(true, true);
            for (const mesh of meshes) {
                const centers = mesh.userData.sortCenters;
                if (!centers)
                    continue;
                const view = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
                if (view.equals(mesh.userData.sortedView))
                    continue;
                mesh.userData.sortedView.copy(view);
                const e = view.elements, order = mesh.userData.sortOrder;
                for(const item of order){const c=centers[item.i];item.z=c.x*e[2]+c.y*e[6]+c.z*e[10]+e[14];}
                order.sort((a, b) => a.z - b.z || a.i - b.i);
                const index = mesh.geometry.index;
                order.forEach((t, i) => { index.setX(i * 3, t.i * 3); index.setX(i * 3 + 1, t.i * 3 + 1); index.setX(i * 3 + 2, t.i * 3 + 2); });
                index.needsUpdate = true;
            }
        },
    };
    } catch(error) {
        for(const release of owned.reverse())release();
        throw error;
    }
}
