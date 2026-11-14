import {DEFAULT_AXIS_MAP} from '../avorion/orientationProfile.js';

// Simple opaque hull and armor boxes, including the plain emissive Glow box.
export const boxTypes = new Set([0, 1, 2, 8, 121, 122, 150, 210, 220, 230, 240]);
const axes = ['x', 'y', 'z'];

export function supportsBoxInstances(profile) {
    return profile.axisMap.length === DEFAULT_AXIS_MAP.length &&
        profile.axisMap.every((axis, i) => axis.length === 3 && axis.every((v, j) => v === DEFAULT_AXIS_MAP[i][j]));
}

export function isCanonicalBox(block, profile) {
    const {typeIndex, look, up, position, size} = block;
    if (!boxTypes.has(typeIndex) || profile.typeOverrides[typeIndex] ||
        ![look, up].every(v => Number.isInteger(v) && v >= 0 && v < 6) ||
        (look >> 1) === (up >> 1)) return false;
    return axes.every(axis => {
        const center = Math.fround(position[axis]), extent = Math.fround(size[axis]);
        if (size[axis] < 1e-4 || !Number.isFinite(center) || !Number.isFinite(extent) || extent <= 0) return false;
        const min = Math.fround(center - extent * .5), max = Math.fround(center + extent * .5);
        return Number.isFinite(min) && Number.isFinite(max) && min < max &&
            min === Math.fround(position[axis] - size[axis] * .5) &&
            max === Math.fround(position[axis] + size[axis] * .5);
    });
}

// The template has the batch's signed-permutation orientation baked in.
// Scaling its ship-space axes is equivalent to scaling locally before rotation.
// aSurface.xy stores 0-based ship axes for physical face U/V in this layout.
export function setBoxFaceAxes(geometry, look, up) {
    const lookAxis = look >> 1, upAxis = up >> 1;
    const worldAxes = [lookAxis, upAxis, 3 - lookAxis - upAxis];
    const sides = geometry.getAttribute('aSide'), surface = geometry.getAttribute('aSurface');
    for (let i = 0; i < surface.count; i++) {
        const axis = sides.getW(i) >> 1;
        surface.setXY(i, worldAxes[axis === 0 ? 2 : 0], worldAxes[axis === 1 ? 2 : 1]);
    }
}

export function placeBoxVertex(point, scale, offset) {
    point.multiply(scale).add(offset);
    return point.set(Math.fround(point.x), Math.fround(point.y), Math.fround(point.z));
}

export function boxInstanceBounds(target, template, scale, offset) {
    placeBoxVertex(target.min.copy(template.min), scale, offset);
    placeBoxVertex(target.max.copy(template.max), scale, offset);
    return target;
}
