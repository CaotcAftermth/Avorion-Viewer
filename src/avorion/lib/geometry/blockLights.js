import * as THREE from "../../../vendor/three.module.js";
import { localScaleFor, resolveOrientation } from "../avorion/orientation.js";
import { effectColor, lightEmitterDistance } from "./blockEffects.js";
// Light spill: light blocks and engine exhausts illuminate nearby hull. Native
// light radii and intensities are not recovered; these are viewer defaults.
const LIGHT_TYPES = new Set([61, 62, 63, 64, 65]);
const ENGINE = 3;
const TABLE_WIDTH = 2048;
const EMPTY = -1;
export function collectBlockLights(blocks, profile) {
    const lights = [];
    for (const b of blocks) {
        if (!LIGHT_TYPES.has(b.typeIndex) && b.typeIndex !== ENGINE)
            continue;
        const { quaternion, base } = resolveOrientation(profile, b.look, b.up, b.typeIndex);
        const size = localScaleFor(base, b.size);
        const center = new THREE.Vector3(b.position.x, b.position.y, b.position.z);
        const color = effectColor(b);
        if (b.typeIndex === ENGINE) {
            // Placed a little behind the rear face so the glow reaches surrounding hull.
            const reach = Math.max(.25, Math.sqrt(size.x * size.y) * .5);
            const position = new THREE.Vector3(0, 0, -size.z * .5 - reach).applyQuaternion(quaternion).add(center);
            lights.push({ id: b.id, position, color, intensity: .4 * Math.min(1, Math.sqrt(size.x * size.y) / 2) });
        }
        else {
            const position = new THREE.Vector3(0, lightEmitterDistance(size.y), 0).applyQuaternion(quaternion).add(center);
            lights.push({ id: b.id, position, color, intensity: 1 });
        }
    }
    return lights;
}
function hashCell(x, y, z, mask) {
    return ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0) & mask;
}
function texture(data, width, height, format, type, internalFormat) {
    const t = new THREE.DataTexture(data, width, height, format, type);
    t.internalFormat = internalFormat;
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
}
export function emptySpillGrid() {
    return {
        table: texture(new Int32Array([0, 0, 0, EMPTY]), 1, 1, THREE.RGBAIntegerFormat, THREE.IntType, "RGBA32I"),
        list: texture(new Float32Array(8), 2, 1, THREE.RGBAFormat, THREE.FloatType, "RGBA32F"),
        cell: 1, mask: 0, count: 0,
        dispose() { this.table.dispose(); this.list.dispose(); },
    };
}
// Sparse hash grid with one cell per light radius. Each light is copied into
// every cell its sphere overlaps, so a fragment reads only its own cell.
export function buildSpillGrid(lights, radius, hidden = new Set()) {
    const visible = lights.filter(l => !hidden.has(l.id));
    if (!visible.length || !(radius > 0))
        return emptySpillGrid();
    const cells = new Map();
    for (const light of visible) {
        const p = light.position;
        const lo = [p.x, p.y, p.z].map(v => Math.floor((v - radius) / radius)), hi = [p.x, p.y, p.z].map(v => Math.floor((v + radius) / radius));
        for (let x = lo[0]; x <= hi[0]; x++)
            for (let y = lo[1]; y <= hi[1]; y++)
                for (let z = lo[2]; z <= hi[2]; z++) {
                    const key = x + "," + y + "," + z;
                    let cell = cells.get(key);
                    if (!cell) { cell = { x, y, z, lights: [] }; cells.set(key, cell); }
                    cell.lights.push(light);
                }
    }
    let size = 1;
    while (size < cells.size * 2) size *= 2;
    const mask = size - 1, rows = Math.ceil(size / TABLE_WIDTH), width = Math.min(size, TABLE_WIDTH);
    const table = new Int32Array(width * rows * 4);
    for (let i = 0; i < width * rows; i++) table[i * 4 + 3] = EMPTY;
    const entries = [];
    for (const cell of cells.values()) {
        // Brightest first; the shader reads at most 32 lights per cell.
        const list = cell.lights.sort((a, b) => b.intensity - a.intensity).slice(0, 32);
        let slot = hashCell(cell.x, cell.y, cell.z, mask);
        while (table[slot * 4 + 3] !== EMPTY) slot = (slot + 1) & mask;
        table.set([cell.x, cell.y, cell.z, entries.length / 2 * 64 + list.length], slot * 4);
        for (const l of list) entries.push([l.position.x, l.position.y, l.position.z, l.intensity], [l.color.r, l.color.g, l.color.b, 0]);
    }
    const listRows = Math.ceil(entries.length / TABLE_WIDTH), listWidth = Math.min(entries.length, TABLE_WIDTH);
    const list = new Float32Array(listWidth * listRows * 4);
    entries.forEach((e, i) => list.set(e, i * 4));
    return {
        table: texture(table, width, rows, THREE.RGBAIntegerFormat, THREE.IntType, "RGBA32I"),
        list: texture(list, listWidth, listRows, THREE.RGBAFormat, THREE.FloatType, "RGBA32F"),
        cell: radius, mask, count: visible.length,
        dispose() { this.table.dispose(); this.list.dispose(); },
    };
}
export const SPILL_GLSL = /* glsl */ `
uniform highp isampler2D uSpillTable;
uniform highp sampler2D uSpillList;
uniform float uSpillCell, uSpillStrength;
uniform int uSpillMask;
uniform mat4 modelMatrix;
ivec2 spillTexel(int i){return ivec2(i % ${TABLE_WIDTH}, i / ${TABLE_WIDTH});}
// Model-space position keeps lights attached to the ship under any model transform.
vec3 lightSpill(vec3 modelPos, vec3 worldNormal){
  if(uSpillStrength<=0.0)return vec3(0.0);
  ivec3 c=ivec3(floor(modelPos/uSpillCell));
  uint h=(uint(c.x)*73856093u^uint(c.y)*19349663u^uint(c.z)*83492791u)&uint(uSpillMask);
  int slot=int(h);
  vec3 sum=vec3(0.0);
  for(int probe=0;probe<64;probe++){
    ivec4 e=texelFetch(uSpillTable,spillTexel(slot),0);
    if(e.w==${EMPTY})break;
    if(e.xyz==c){
      int start=(e.w/64)*2,count=e.w-(e.w/64)*64;
      for(int i=0;i<32;i++){
        if(i>=count)break;
        vec4 a=texelFetch(uSpillList,spillTexel(start+i*2),0),b=texelFetch(uSpillList,spillTexel(start+i*2+1),0);
        vec3 toLight=a.xyz-modelPos;float d=length(toLight);
        if(d>=uSpillCell)continue;
        float falloff=1.0-d/uSpillCell;falloff*=falloff;
        vec3 L=normalize(mat3(modelMatrix)*toLight);
        sum+=b.rgb*a.w*falloff*max(dot(worldNormal,L),0.0);
      }
      break;
    }
    slot=(slot+1)&uSpillMask;
  }
  return sum*uSpillStrength;
}
`;
