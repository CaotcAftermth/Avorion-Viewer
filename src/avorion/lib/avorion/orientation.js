// ---------------------------------------------------------------------------
// Orientation resolution - ALL rotation logic lives here.
//
// Avorion stores block orientation as two integers, `look` and `up`, each an
// axis index 0..5. Verified against the community Blender importer
// (jgersti/blender-avorion-importer), the game convention is:
//
//   axis = int // 2  (0=X, 1=Y, 2=Z), sign = int % 2 (0 -> negative, 1 -> positive)
//   => 0:-X  1:+X  2:-Y  3:+Y  4:-Z  5:+Z
//
//   The block's LOCAL X axis maps to the look axis, LOCAL Y to the up axis,
//   and LOCAL Z to look x up (right-handed cross product).
//
//   Scaling by the block's size happens along WORLD axes AFTER rotation, so
//   renderers must permute the size vector into local space (localScaleFor).
//
// The mapping stays editable data (an OrientationProfile) so the Orientation
// Lab can calibrate against in-game behavior without code changes.
// ---------------------------------------------------------------------------
import * as THREE from "../../../vendor/three.module.js";
export { DEFAULT_AXIS_MAP, ORIENTATION_PROFILE_VERSION, defaultOrientationProfile, } from "./orientationProfile.js";
export function axisVector(profile, axisInt) {
    const a = profile.axisMap[axisInt] ?? [1, 0, 0];
    return new THREE.Vector3(a[0], a[1], a[2]);
}
/**
 * Build the rotation from Avorion look/up ints.
 * local X -> look axis, local Y -> up axis, local Z -> look x up.
 */
export function resolveOrientation(profile, look, up, typeIndex) {
    if (!Number.isInteger(look) || !Number.isInteger(up) || look < 0 || look > 5 || up < 0 || up > 5) {
        const id = new THREE.Quaternion();
        return { quaternion: id.clone(), base: id, degenerate: true };
    }
    const lookV = axisVector(profile, look);
    const upV = axisVector(profile, up);
    if (Math.abs(lookV.dot(upV)) > 0.99) {
        const id = new THREE.Quaternion();
        return { quaternion: id.clone(), base: id, degenerate: true };
    }
    const zV = new THREE.Vector3().crossVectors(lookV, upV).normalize();
    const m = new THREE.Matrix4().makeBasis(lookV, upV, zV);
    const base = new THREE.Quaternion().setFromRotationMatrix(m);
    const q = base.clone();
    const ov = typeIndex != null ? profile.typeOverrides[typeIndex] : undefined;
    if (ov && (ov.x || ov.y || ov.z)) {
        q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(ov.x), THREE.MathUtils.degToRad(ov.y), THREE.MathUtils.degToRad(ov.z))));
    }
    return { quaternion: q, base, degenerate: false };
}
/**
 * Avorion scales blocks along WORLD axes after rotating the unit shape, but
 * three.js TRS applies scale in LOCAL space before rotation. For the pure
 * look/up rotation (a signed permutation) the two are reconciled by permuting
 * the world size into local space: rotate by base^-1 and take abs.
 * (Per-type override rotations are applied after, so extreme non-90-degree
 * overrides combined with non-cubic sizes will shear-approximate.)
 */
export function localScaleFor(base, size) {
    const v = new THREE.Vector3(size.x, size.y, size.z)
        .applyQuaternion(base.clone().invert());
    return new THREE.Vector3(Math.max(Math.abs(v.x), 1e-4), Math.max(Math.abs(v.y), 1e-4), Math.max(Math.abs(v.z), 1e-4));
}
export function quaternionToDisplay(q) {
    const e = new THREE.Euler().setFromQuaternion(q);
    const deg = (r) => Math.round(THREE.MathUtils.radToDeg(r) * 100) / 100;
    return {
        quaternion: [q.x, q.y, q.z, q.w].map((v) => Math.round(v * 1000) / 1000),
        eulerDeg: { x: deg(e.x), y: deg(e.y), z: deg(e.z) },
        matrix: new THREE.Matrix4().makeRotationFromQuaternion(q).elements.map((v) => Math.round(v * 100) / 100),
    };
}
export const AXIS_LABELS = ["0", "1", "2", "3", "4", "5"];
export const AXIS_OPTIONS = [
    { label: "+X", vec: [1, 0, 0] }, { label: "-X", vec: [-1, 0, 0] },
    { label: "+Y", vec: [0, 1, 0] }, { label: "-Y", vec: [0, -1, 0] },
    { label: "+Z", vec: [0, 0, 1] }, { label: "-Z", vec: [0, 0, -1] },
];
export function vecLabel(v) {
    return AXIS_OPTIONS.find((o) => o.vec[0] === v[0] && o.vec[1] === v[1] && o.vec[2] === v[2])?.label ?? "?";
}
export function centerOf(min, max) {
    return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
}
