import * as THREE from "../../../vendor/three.module.js";
import { getBlockDefinition } from "../avorion/blockDefinitions.js";
import { localScaleFor, resolveOrientation } from "../avorion/orientation.js";
import { getUnitGeometry } from "./blockGeometry.js";
/** Per-triangle face metadata. IDs mirror the game's -X,+X,-Y,+Y,-Z,+Z convention. */
export const SURFACE_PLAIN = 0, SURFACE_ENGINE = 1, SURFACE_THRUSTER = 2, SURFACE_DECAL = 3, SURFACE_GENERATOR = 4, SURFACE_GENERATOR_WORLD = 5, SURFACE_FRAMEWORK = 6;
export function surfaceKind(surface, side) {
    if (surface === "front-torpedo") return side === 5 ? SURFACE_DECAL : 18;
    if (surface === "dock") return 28;
    if(surface==='housing')return 26;
    if(surface==='hangar'&&side>=6)return 27;
    if (surface === "engine")
        return side === 4 ? SURFACE_ENGINE : SURFACE_PLAIN;
    if (surface === "thruster")
        return SURFACE_THRUSTER;
    if (surface === "directional-thruster")
        return side >= 4 ? SURFACE_THRUSTER : SURFACE_PLAIN;
    if (surface === "decal")
        return SURFACE_DECAL;
    if (surface === "generator")
        return SURFACE_GENERATOR;
    if (surface === "generator-world")
        return SURFACE_GENERATOR_WORLD;
    if (surface === "framework")
        return SURFACE_FRAMEWORK;
    const extra = {
        solar: 7, glass: 8, hologram: 9, "rich-stone": 10, "super-rich-stone": 11,
        "rich-rift": 12, "super-rich-rift": 13, pods: 14, hangar: 15, reflector: 19,
        "stripes-a": 20, "stripes-b": 21, "stripes-c": 22, "dark-a": 23, "dark-b": 24, "dark-c": 25,
    };
    // The name faces away from the block's look axis (local -X): Avorion ships
    // point look inward from the hull, so the name reads from outside.
    if (surface === "ship-name")
        return side === 0 ? 16 : 18;
    if (surface === "emblem")
        return side === 5 ? 17 : 18;
    if (surface && extra[surface])
        return extra[surface];
    return SURFACE_PLAIN;
}
/** Open hangar tunnel along local Z. Rim width remains a viewer approximation. */
export function hangarPositions(size) {
    const x = 0.5 - Math.min(0.15, 0.3 / size.x), y = 0.5 - Math.min(0.15, 0.3 / size.y);
    const z = 0.5, out = [];
    const quad = (a, b, c, d) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
    // Four outer walls; both ends stay open.
    quad([-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]);
    quad([.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]);
    quad([-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]);
    quad([-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]);
    // Four frame strips, with no face over the doorway.
    quad([-.5, -.5, -.5], [-.5, .5, -.5], [-x, .5, -.5], [-x, -.5, -.5]);
    quad([x, -.5, -.5], [x, .5, -.5], [.5, .5, -.5], [.5, -.5, -.5]);
    quad([-x, y, -.5], [-x, .5, -.5], [x, .5, -.5], [x, y, -.5]);
    quad([-x, -.5, -.5], [-x, -y, -.5], [x, -y, -.5], [x, -.5, -.5]);
    // Mirror the four front frame strips onto the rear, reversing their winding.
    const front = out.slice(24 * 3);
    for (let i = 0; i < front.length; i += 9)
        for (const j of [0, 6, 3]) out.push(front[i+j], front[i+j+1], -front[i+j+2]);
    // Four interior walls span the full passage.
    quad([-x, -y, z], [-x, y, z], [-x, y, -.5], [-x, -y, -.5]);
    quad([x, -y, -.5], [x, y, -.5], [x, y, z], [x, -y, z]);
    quad([-x, y, -.5], [-x, y, z], [x, y, z], [x, y, -.5]);
    quad([-x, -y, z], [-x, -y, -.5], [x, -y, -.5], [x, -y, z]);
    // Tunnel surfaces face into the opening, so backface culling retains them.
    for(let i=72*3;i<out.length;i+=9)
        for(let axis=0;axis<3;axis++)[out[i+3+axis],out[i+6+axis]]=[out[i+6+axis],out[i+3+axis]];
    return new THREE.Float32BufferAttribute(out, 3);
}
/** Bake face-local UVs alongside the existing ship-space positions. */
export function blockSurfaceGeometry(block, profile) {
    const { quaternion, base } = resolveOrientation(profile, block.look, block.up, block.typeIndex);
    const scale = localScaleFor(base, block.size);
    const unit = block.typeIndex === 10 ? hangarPositions(scale)
        : getUnitGeometry(getBlockDefinition(block.typeIndex).geometryKind).getAttribute("position");
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(block.position.x, block.position.y, block.position.z), quaternion, scale);
    const positions = new Float32Array(unit.count * 3), uv = new Float32Array(unit.count * 2);
    const faces = new Float32Array(unit.count * 3); // physical face width, height, local side
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), v = new THREE.Vector3();
    for (let start = 0; start < unit.count; start += 3) {
        a.fromBufferAttribute(unit, start);
        b.fromBufferAttribute(unit, start + 1);
        c.fromBufferAttribute(unit, start + 2);
        n.subVectors(b, a).cross(c.sub(a));
        const axis = Math.abs(n.x) >= Math.max(Math.abs(n.y), Math.abs(n.z)) ? 0 : Math.abs(n.y) >= Math.abs(n.z) ? 1 : 2;
        const positive = n.getComponent(axis) >= 0;
        const side = axis * 2 + (positive ? 1 : 0);
        // Each U/V pair is right-handed with its outward face normal.
        const uAxis = axis === 0 ? 2 : 0, vAxis = axis === 1 ? 2 : 1;
        const uSign = axis === 0 ? (positive ? -1 : 1) : axis === 2 ? (positive ? 1 : -1) : 1;
        const vSign = axis === 1 && positive ? -1 : 1;
        for (let i = start; i < start + 3; i++) {
            v.fromBufferAttribute(unit, i);
            uv.set([v.getComponent(uAxis) * uSign + 0.5, v.getComponent(vAxis) * vSign + 0.5], i * 2);
            faces.set([scale.getComponent(uAxis), scale.getComponent(vAxis), side+(block.typeIndex===10&&start>=72?6:0)], i * 3);
            v.applyMatrix4(matrix).toArray(positions, i * 3);
        }
    }
    return { positions, uv, faces };
}
