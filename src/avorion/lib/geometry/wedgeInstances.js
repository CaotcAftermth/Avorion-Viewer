import * as THREE from '../../../vendor/three.module.js';
import {resolveOrientation, localScaleFor} from '../avorion/orientation.js';
import {getUnitGeometry} from './blockGeometry.js';
import {boxTypes} from './boxInstances.js';
import {DEFAULT_AXIS_MAP} from '../avorion/orientationProfile.js';
import {edgeAngles} from './edgeAngles.js';

export const wedgeTypes = new Set([100, 151]);

export function isWedgeInstance(geometry) {
    const layout = geometry.userData.canonicalLayout;
    return layout === 'wedge' || layout === 'discreteWedge';
}

export function hasCanonicalEndpoints(geometry) {
    return geometry.getAttribute('aScale')?.itemSize === 4;
}

export function hasDiscreteOrientation(geometry) {
    return geometry.userData.canonicalLayout?.startsWith('discrete') ?? false;
}

// Default-profile local X = look, local Y = up, local Z = look × up.
// Discrete instance construction owns aEmission.w. Bits 0–5 store the ship-axis
// seam mask (0–63), and the remaining bits store look*6+up (0–35, perpendicular
// axes only). The maximum packed value, 2303, is exact in Float32. Paint and
// display updates leave it intact. Pose expansion restores just the seam mask
// before rendering with the expanded layout.
const seamRange = 64;
export function encodeOrientationSeams(look, up, seams) {
    return (look * 6 + up) * seamRange + seams;
}
export function decodeOrientation(packed) {
    return Math.floor(packed / seamRange);
}
export function decodeSeams(packed) {
    return packed % seamRange;
}

const nativeRotations = DEFAULT_AXIS_MAP.flatMap((look, x) => DEFAULT_AXIS_MAP.map((up, y) => {
    if ((x >> 1) === (y >> 1)) return null;
    const a = new THREE.Vector3(...look), b = new THREE.Vector3(...up);
    return new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeBasis(a, b, a.clone().cross(b)));
}));

export function instanceOrientation(geometry, index) {
    return hasDiscreteOrientation(geometry)
        ? nativeRotations[decodeOrientation(geometry.getAttribute('aEmission').getW(index))]
        : null;
}

export function placeWedgeVertex(point, max, min, rotation = null) {
    if (rotation) point.applyMatrix3(rotation);
    return point.set(point.x < 0 ? min.x : max.x, point.y < 0 ? min.y : max.y, point.z < 0 ? min.z : max.z);
}

// Test the actual unit corners against the same quaternion, scale, matrix
// and Float32 conversion used by blockSurfaceGeometry. Keep authored extents
// independently: the rounded endpoint difference is not the face UV extent.
export function wedgeBoundsWriter(profile) {
    return endpointBoundsWriter(profile, 'wedge');
}

export function endpointBoundsWriter(profile, shape) {
    const families = shape === 'wedge' ? wedgeTypes : boxTypes;
    const unit = getUnitGeometry(shape).getAttribute('position');
    const corners = [];
    for (let i = 0; i < unit.count; i++) {
        const corner = new THREE.Vector3().fromBufferAttribute(unit, i);
        if (!corners.some(p => p.equals(corner))) corners.push(corner);
    }
    const orientations = new Map(), matrix = new THREE.Matrix4();
    const point = new THREE.Vector3(), center = new THREE.Vector3();
    const min = new THREE.Vector3(), max = new THREE.Vector3(), baked = corners.map(() => new THREE.Vector3());
    return (block, write) => {
        const {typeIndex, look, up, position, size} = block;
        if (!families.has(typeIndex) || profile.typeOverrides[typeIndex] ||
            !Number.isInteger(look) || !Number.isInteger(up) || look < 0 || up < 0 ||
            look >= 6 || up >= 6 || (look >> 1) === (up >> 1)) return false;
        const key = look * 6 + up;
        let orientation = orientations.get(key);
        if (!orientation) {
            orientation = resolveOrientation(profile, look, up, typeIndex);
            orientation.signs = corners.map(p => p.clone().applyQuaternion(orientation.quaternion));
            orientations.set(key, orientation);
        }
        const scale = localScaleFor(orientation.base, size);
        matrix.compose(center.copy(position), orientation.quaternion, scale);
        min.setScalar(Infinity);
        max.setScalar(-Infinity);
        for (let i = 0; i < corners.length; i++) {
            point.copy(corners[i]).applyMatrix4(matrix);
            baked[i].set(Math.fround(point.x), Math.fround(point.y), Math.fround(point.z));
            min.min(baked[i]);
            max.max(baked[i]);
        }
        for (const axis of ['x', 'y', 'z']) {
            const span = Math.fround(max[axis] - min[axis]);
            // Keep reciprocal lengths in a range where GLSL normalize can
            // square and sum them without underflow or overflow.
            if (!(size[axis] >= 1e-4) || !Number.isFinite(Math.fround(size[axis])) ||
                !(span >= 1e-4 && span <= 1e12)) return false;
        }
        for (let i = 0; i < corners.length; i++) {
            if (!placeWedgeVertex(point.copy(orientation.signs[i]), max, min).equals(baked[i])) return false;
        }
        if (write) write(min, max, scale);
        return true;
    };
}

export function expandWedgeShading(geometry, verticesPerInstance) {
    const positions = geometry.getAttribute('position').array;
    const normals = geometry.getAttribute('normal').array;
    const edges = geometry.getAttribute('aEdges').array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let start = 0; start < positions.length / 3; start += verticesPerInstance) {
        const block = positions.subarray(start * 3, (start + verticesPerInstance) * 3);
        const angles = edgeAngles(block);
        for (let i = 0; i < verticesPerInstance; i += 3) {
            a.fromArray(block, i * 3);
            b.fromArray(block, i * 3 + 3).sub(a);
            c.fromArray(block, i * 3 + 6).sub(a);
            b.cross(c).normalize();
            for (let k = 0; k < 3; k++) {
                const vertex = start + i + k;
                b.toArray(normals, vertex * 3);
                edges.set(angles.subarray(i, i + 3), vertex * 4);
            }
        }
    }
}
export function setWedgeCreaseAxes(geometry, look, up) {
    const extrusion = 3 - (look >> 1) - (up >> 1);
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    const edges = geometry.getAttribute('aEdges');
    const p = new THREE.Vector3(), q = new THREE.Vector3(), candidate = new THREE.Vector3();
    for (let start = 0; start < positions.count; start += 3) {
        for (let edge = 0; edge < 3; edge++) {
            if (Math.abs(edges.getComponent(start,edge) - .75) > 1e-6) continue;
            p.fromBufferAttribute(positions,start+(edge+1)%3);
            q.fromBufferAttribute(positions,start+(edge+2)%3);
            let axis = -1;
            for (let other = 0; other < positions.count; other += 3) {
                if (other === start) continue;
                let hasP = false, hasQ = false;
                for (let k = 0; k < 3; k++) {
                    candidate.fromBufferAttribute(positions,other+k);
                    hasP ||= candidate.equals(p);
                    hasQ ||= candidate.equals(q);
                }
                if (!hasP || !hasQ) continue;
                for (const triangle of [start,other])
                    for (let k = 0; k < 3; k++)
                        if (Math.abs(normals.getComponent(triangle,k)) > .999) axis = k;
            }
            if (axis < 0) throw Error('Canonical wedge crease has no adjacent axis face.');
            for (let k = 0; k < 3; k++) edges.setComponent(start+k,edge,2+axis+3*extrusion);
        }
    }
}
