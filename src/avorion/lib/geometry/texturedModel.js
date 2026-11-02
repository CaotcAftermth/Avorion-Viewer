// ---------------------------------------------------------------------------
// Textured model builder. Shares repeated opaque geometry in bounded spatial
// batches, with merged fallbacks. Attributes carry everything the shader needs:
//   aColor, aSecondary, aLayers (albedo/normal/mask/overlay array layers),
//   aParams (glow layer, flags, reflectivity scale, state: selection bit 1,
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
import { blockSurfaceGeometry, surfaceKind } from "./blockSurface.js";
import { getShadingSpec, textureName } from "../textures/shadingMap.js";
import { textureLibrary } from "../textures/textureLibrary.js";
import { buildBlockEffects } from "./blockEffects.js";
import { collectBlockLights, buildSpillGrid } from "./blockLights.js";
import { BlockPose } from "./blockPose.js";
import { createGameMaterial, applyGameParams, setSpillGrid, FLAG_DOUBLE_SIDED, FLAG_TINT, FLAG_EMISSIVE, FLAG_TRANSLUCENT, FLAG_CUTOUT, FLAG_OVERLAY_SECONDARY, } from "./gameShader.js";
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
    edges = [];
    pos = [];
    nrm = [];
    col = [];
    sec = [];
    lay = [];
    par = [];
    faceUv = [];
    surface = [];
    emission = [];
    side = [];
    windowColor = [];
    materialLayers = [];
    ranges = new Map();
    get vertexCount() { return this.pos.length / 3; }
    add(id, geometry, color, secondary, layers, params, surface, normalOverlay, emission, windowColor, materialLayers, seamSides = [0]) {
        const emissionSeam = [emission[0], emission[1], emission[2], seamSides[0]];
        const { positions, uv, faces } = geometry;
        const angles=edgeAngles(positions);
        const start = this.vertexCount;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
        for (let i = 0; i < positions.length; i += 9) {
            a.fromArray(positions, i);
            b.fromArray(positions, i + 3);
            c.fromArray(positions, i + 6);
            n.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
            for (let k = 0; k < 3; k++) {
                this.edges.push(...angles.subarray(i/3,i/3+3),k);
                const vertex = i / 3 + k;
                this.pos.push(positions[i + k * 3], positions[i + k * 3 + 1], positions[i + k * 3 + 2]);
                this.nrm.push(n.x, n.y, n.z);
                this.col.push(...color);
                this.sec.push(...secondary);
                this.lay.push(...layers);
                this.par.push(...params);
                this.faceUv.push(uv[vertex * 2], uv[vertex * 2 + 1]);
                this.surface.push(faces[vertex * 3], faces[vertex * 3 + 1], surfaceKind(surface, faces[vertex * 3 + 2]), normalOverlay);
                this.emission.push(...emissionSeam);
                this.side.push(faces[vertex * 3 + 2]);
                this.windowColor.push(...windowColor);
                this.materialLayers.push(...materialLayers);
            }
        }
        const list = this.ranges.get(id) ?? [];
        list.push([start, this.vertexCount - start]);
        this.ranges.set(id, list);
    }
    geometry() {
        if (this.pos.length === 0)
            return undefined;
        const g = new THREE.BufferGeometry();
        g.setAttribute('aEdges',new THREE.Float32BufferAttribute(this.edges,4));
        g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
        g.setAttribute("aColor", new THREE.Float32BufferAttribute(this.col, 4));
        g.setAttribute("aSecondary", new THREE.Float32BufferAttribute(this.sec, 4));
        g.setAttribute("aLayers", new THREE.Float32BufferAttribute(this.lay, 4));
        g.setAttribute("aFaceUV", new THREE.Float32BufferAttribute(this.faceUv, 2));
        g.setAttribute("aSurface", new THREE.Float32BufferAttribute(this.surface, 4));
        g.setAttribute("aSide", new THREE.Float32BufferAttribute(this.side.flatMap((side,i)=>[...this.pos.slice(i*3,i*3+3),side]), 4));
        g.setAttribute("aWindow", new THREE.Float32BufferAttribute(this.windowColor, 4));
        g.setAttribute("aEmission", new THREE.Float32BufferAttribute(this.emission, 4));
        g.setAttribute("aMaterialLayers", new THREE.Float32BufferAttribute(this.materialLayers, 2));
        const par = new THREE.Float32BufferAttribute(this.par, 4);
        par.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute("aParams", par);
        g.computeBoundingSphere();
        return g;
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
        const canvas = document.createElement("canvas"), r = textureLibrary.resolution;
        canvas.width = canvas.height = r;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, r, r);
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${Math.min(r * .24, r * .84 / Math.max(1, nameText.length * .65))}px sans-serif`;
        // Texture rows start at face V=0 (the bottom edge), so draw the text flipped
        // vertically to read upright.
        ctx.translate(0, r);
        ctx.scale(1, -1);
        ctx.fillText(nameText, r / 2, r / 2, r * .9);
        generated.set(nameKey, ctx.getImageData(0, 0, r, r));
    }
    const resolved = live.map((b) => {
        const spec = getShadingSpec(b.typeIndex);
        const m = b.materialIndex;
        const names = {
            albedo: textureName(spec.albedo, m), normal: textureName(spec.normal, m),
            mask: textureName(spec.mask, m), overlay: spec.surface === "ship-name" ? nameKey : textureName(spec.overlay, m), glow: textureName(spec.glow, m),
            normalOverlay: textureName(spec.normalOverlay, m),
            materialOverlay: textureName(spec.materialOverlay, m), materialGlow: textureName(spec.materialGlow, m),
        };
        if (names.albedo)
            albedoNames.add(names.albedo);
        if (names.normal)
            normalNames.add(names.normal);
        for (const n of [names.mask, names.overlay, names.glow, names.normalOverlay, names.materialOverlay, names.materialGlow])
            if (n)
                auxNames.add(n);
        return { spec, names };
    });
    const albedo = textureLibrary.getArray("albedo", albedoNames);
    const normal = textureLibrary.getArray("normal", normalNames);
    const aux = textureLibrary.getArray("aux", auxNames, generated);
    const layer = (arr, name) => name ? (arr.layerOf.get(name) ?? 0) : 0;
    const batches=(params.prepared||[]).map(entry=>{
      const g=entry.instanced?new THREE.InstancedBufferGeometry():new THREE.BufferGeometry();
      for(const [name,attr] of Object.entries(entry.attributes))g.setAttribute(name,attr.instanced?new THREE.InstancedBufferAttribute(attr.array,attr.size):new THREE.BufferAttribute(attr.array,attr.size));
      if(entry.index)g.setIndex(new THREE.BufferAttribute(entry.index,1));
      if(entry.instanced)g.instanceCount=entry.count;
      g.boundingBox=new THREE.Box3(new THREE.Vector3(...entry.min),new THREE.Vector3(...entry.max));g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
      return {...entry,g,builder:{ranges:new Map(entry.ranges)}};
    });
    if(!params.prepared){
    const opaque = new Builder(), twoSided=new Builder(), translucent = new Builder(),instanceGroups=new Map();
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
        const pars = [layer(aux, names.glow), flags, spec.reflect ?? 1, 0];
        const emission = parseColor("ff" + getMaterial(b.materialIndex).color.slice(1), [1, 1, 1, 1]).slice(0, 3);
        const blended = spec.translucent && !(spec.surface === "hologram" && color[3] >= 1);
        const args=[color,secondary,layers,pars,spec.surface,layer(aux,names.normalOverlay),emission,secondary,[layer(aux,names.materialOverlay),layer(aux,names.materialGlow)],[b.typeIndex===10?0:seams.get(b.id)]];
        if(blended)translucent.add(b.id,blockSurfaceGeometry(b,profile),...args);
        else{
          const key=[b.typeIndex,b.materialIndex,b.look,b.up,b.size.x,b.size.y,b.size.z,flags,Math.floor(b.position.x/cell),Math.floor(b.position.y/cell),Math.floor(b.position.z/cell)].join('|');
          let entries=instanceGroups.get(key);if(!entries){entries=[];instanceGroups.set(key,entries);}entries.push({b,args});
        }
    });
    // Bound draw calls on heterogeneous ships: spend batches on the largest
    // repeated groups first, and merge the remaining shapes into shared meshes.
    let instanceBudget=Math.max(16,2*Math.ceil(live.length/1024));
    for(const entries of [...instanceGroups.values()].sort((a,b)=>b.length-a.length)){
      const batchCount=Math.ceil(entries.length/1024);
      if(entries.length<16||batchCount>instanceBudget||params.instancing===false){for(const {b,args} of entries)((args[3][1]&FLAG_DOUBLE_SIDED)?twoSided:opaque).add(b.id,blockSurfaceGeometry(b,profile),...args);continue;}
      instanceBudget-=batchCount;
      for(let start=0;start<entries.length;start+=1024){
        const chunk=entries.slice(start,start+1024),first=chunk[0],builder=new Builder();
        builder.add(first.b.id,blockSurfaceGeometry({...first.b,position:{x:0,y:0,z:0}},profile),...first.args);
        const base=builder.geometry(),g=new THREE.InstancedBufferGeometry();g.copy(base);g.instanceCount=chunk.length;base.dispose();
        const attributes={aColor:[0,4],aSecondary:[1,4],aLayers:[2,4],aParams:[3,4],aEmission:[6,4],aWindow:[7,4],aMaterialLayers:[8,2]};
        for(const [name,[argument,size]] of Object.entries(attributes)){
          const data=new Float32Array(chunk.length*size);chunk.forEach((entry,i)=>data.set(name==='aEmission'?[...entry.args[6],entry.args[9][0]]:entry.args[argument],i*size));
          const attr=new THREE.InstancedBufferAttribute(data,size);if(['aParams','aColor','aSecondary','aWindow'].includes(name))attr.setUsage(THREE.DynamicDrawUsage);g.setAttribute(name,attr);
        }
        const offsets=new Float32Array(chunk.length*3);chunk.forEach(({b},i)=>offsets.set([b.position.x,b.position.y,b.position.z],i*3));g.setAttribute('aOffset',new THREE.InstancedBufferAttribute(offsets,3));
        base.computeBoundingBox();const local=base.boundingBox.clone(),bounds=new THREE.Box3(),offset=new THREE.Vector3();
        for(let i=0;i<chunk.length;i++)bounds.union(local.clone().translate(offset.fromArray(offsets,i*3)));
        g.boundingBox=bounds;g.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
        builder.ranges=new Map(chunk.map(({b},i)=>[b.id,[[i,1]]]));
        batches.push({builder,g,isT:false,instanced:true,doubleSided:!!(first.args[3][1]&FLAG_DOUBLE_SIDED)});
      }
    }
    for(const [builder,isT,doubleSided] of [[opaque,false,false],[twoSided,false,true],[translucent,true,true]]){const g=builder.geometry();if(g)batches.push({builder,g,isT,doubleSided});}
    }
    const group = new THREE.Group();
    group.name = "textured";
    const effects = buildBlockEffects(params.simplified?[]:live, profile, params);
    const effectPose = new BlockPose(effects.mesh.geometry, effects.ranges);
    group.add(...effects.meshes);
    const materials = [],materialCache=new Map();
    const meshes = [],owners=new Map();
    const ranges = new Map();
    for (const {builder,g,isT,instanced,doubleSided,pickTree} of batches) {
        const materialKey=[isT,instanced,doubleSided].join(':');
        let mat=materialCache.get(materialKey);
        if(!mat){mat=createGameMaterial(albedo.texture,normal.texture,aux.texture,params,isT);materialCache.set(materialKey,mat);materials.push(mat);}
        mat.userData.hardwareCull=!doubleSided;
        if(!doubleSided)mat.side=THREE.FrontSide;
        if(instanced){mat.defines={...mat.defines,BLOCK_INSTANCED:1};}
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
        installBlockRaycast(mesh,pickTree);
        if(!instanced)mesh.userData.pose = new BlockPose(g, builder.ranges);
        if (isT) {
            const position = g.getAttribute("position"), centers = [];
            for (let i = 0; i < position.count; i += 3)
                centers.push(new THREE.Vector3()
                    .fromBufferAttribute(position, i).add(new THREE.Vector3().fromBufferAttribute(position, i + 1))
                    .add(new THREE.Vector3().fromBufferAttribute(position, i + 2)).multiplyScalar(1 / 3));
            g.setIndex(Array.from({ length: position.count }, (_, i) => i));
            mesh.userData.sortCenters = centers;
            mesh.userData.sortOrder=centers.map((c,i)=>({i,z:0}));
            mesh.userData.sortedView = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
    }
    let selected = new Set(), hidden = new Set(), hovered = new Set(), regioned = new Set();
    const lights = collectBlockLights(live, profile);
    let spill = null, spillRadius = null;
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
    return {
        group, materials, ranges,
        dispose() {
            effects.dispose();
            spill?.dispose();
            albedo.release();
            normal.release();
            aux.release();
            meshes.forEach((m) => { m.geometry.dispose(); });
            materials.forEach((m) => m.dispose());
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
                const attr=mesh.geometry.getAttribute('aColor'),second=mesh.geometry.getAttribute('aSecondary'),windows=mesh.geometry.getAttribute('aWindow'),span=dirty.get(mesh)||[Infinity,0];
                for(const [start,count] of mesh.userData.ranges.get(block.id)){
                    for(let v=start;v<start+count;v++){attr.setXYZW(v,...color);second.setXYZW(v,...secondary);windows.setXYZW(v,...secondary);}
                    span[0]=Math.min(span[0],start);span[1]=Math.max(span[1],start+count);
                }dirty.set(mesh,span);
            }
            for(const [mesh,[start,end]] of dirty)for(const name of ['aColor','aSecondary','aWindow']){const attr=mesh.geometry.getAttribute(name);attr.addUpdateRange(start*4,(end-start)*4);attr.needsUpdate=true;}
        },

        setParams(p) {
            materials.forEach((m) => applyGameParams(m, p)); effects.setParams(p);
            const radius = p.spillRadius ?? 5;
            if (radius !== spillRadius) { spillRadius = radius; rebuildSpill(); }
        },
        setTime(time) { effects.setTime(time); },
        setGlassDepth(texture, logDepth) { effects.setGlassDepth(texture, logDepth); },
        setBlockTransforms(poses) {
            effectPose.apply(poses);
            for (const mesh of meshes) {
                if(mesh.userData.instanced){
                  // Viewer-only poses can change shape/orientation. Expand only this
                  // affected batch; ordinary selection and color edits stay instanced.
                  if(![...poses.keys()].some(id=>mesh.userData.ranges.has(id)))continue;
                  const old=mesh.geometry,count=old.instanceCount,vertices=old.getAttribute('position').count,next=new THREE.BufferGeometry();
                  const offsets=old.getAttribute('aOffset');
                  for(const [name,attribute] of Object.entries(old.attributes)){
                    if(name==='aOffset')continue;const size=attribute.itemSize,data=new Float32Array(count*vertices*size);
                    for(let i=0;i<count;i++)for(let v=0;v<vertices;v++)for(let k=0;k<size;k++)data[(i*vertices+v)*size+k]=attribute.array[(attribute.isInstancedBufferAttribute?i:v)*size+k]+(name==='position'||name==='aSide'&&k<3?offsets.array[i*3+k]:0);
                    next.setAttribute(name,new THREE.BufferAttribute(data,size));
                  }
                  const nextRanges=new Map([...mesh.userData.ranges].map(([id,[[i]]])=>[id,[[i*vertices,vertices]]]));
                  mesh.geometry=next;mesh.userData.ranges=nextRanges;for(const [id,list] of nextRanges)ranges.set(id,list);mesh.userData.instanced=false;mesh.userData.pose=new BlockPose(next,nextRanges);installBlockRaycast(mesh);old.dispose();
                  const compile=mesh.material.onBeforeCompile;mesh.material=mesh.material.clone();mesh.material.onBeforeCompile=compile;delete mesh.material.defines.BLOCK_INSTANCED;mesh.material.needsUpdate=true;materials.push(mesh.material);setSpillGrid(mesh.material,spill);
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
}
