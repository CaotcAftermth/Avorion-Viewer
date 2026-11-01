import * as THREE from "../../../vendor/three.module.js";
import { getBlockDefinition } from "../avorion/blockDefinitions.js";
import { localScaleFor, resolveOrientation } from "../avorion/orientation.js";
import { getUnitGeometry } from "./blockGeometry.js";
import { hangarPositions } from "./blockSurface.js";
const EPS = 1e-7; // Numerical contact tolerance, not an exhaust clearance distance.
/** Local contact query. Distant objects never suppress a plume. A small BVH
 * avoids testing every block for every emitter on large imported ships. */
export function createPortObstruction(blocks, profile) {
    function tree(entries) {
        const bounds = new THREE.Box3();
        entries.forEach(e => bounds.union(e.bounds));
        if (entries.length <= 12)
            return { bounds, entries };
        const size = bounds.getSize(new THREE.Vector3());
        const axis = size.x > size.y && size.x > size.z ? "x" : size.y > size.z ? "y" : "z";
        entries.sort((a, b) => a.bounds.min[axis] + a.bounds.max[axis] - b.bounds.min[axis] - b.bounds.max[axis]);
        const mid = Math.floor(entries.length / 2);
        return { bounds, left: tree(entries.slice(0, mid)), right: tree(entries.slice(mid)) };
    }
    const root = tree(blocks.map(block => {
        const { base, quaternion } = resolveOrientation(profile, block.look, block.up, block.typeIndex);
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(block.position.x, block.position.y, block.position.z), quaternion, localScaleFor(base, block.size));
        const bounds = new THREE.Box3(new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5)).applyMatrix4(matrix).expandByScalar(EPS);
        return { block, bounds, matrix };
    }));
    return (owner, point, direction) => {
        const blockedBy = [];
        const ray = new THREE.Ray(point.clone().addScaledVector(direction, -EPS), direction);
        const hit = new THREE.Vector3(), normal = new THREE.Vector3(), edge = new THREE.Vector3();
        function visit(node) {
            if (!node.bounds.containsPoint(point))
                return;
            if (!node.entries) {
                visit(node.left);
                visit(node.right);
                return;
            }
            for (const entry of node.entries) {
                if (entry.block.id === owner || !entry.bounds.containsPoint(point))
                    continue;
                if (!entry.vertices) {
                    const b = entry.block;
                    const unit = b.typeIndex === 10 ? hangarPositions(new THREE.Vector3().setFromMatrixScale(entry.matrix))
                        : getUnitGeometry(getBlockDefinition(b.typeIndex).geometryKind).getAttribute("position");
                    entry.vertices = Array.from({ length: unit.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(unit, i).applyMatrix4(entry.matrix));
                }
                let nearest = Infinity, exiting = false;
                const vertices = entry.vertices;
                for (let i = 0; i < vertices.length; i += 3) {
                    const a = vertices[i], b = vertices[i + 1], c = vertices[i + 2];
                    if (!ray.intersectTriangle(a, b, c, false, hit))
                        continue;
                    const distance = hit.distanceTo(ray.origin);
                    if (distance < nearest) {
                        nearest = distance;
                        exiting = normal.subVectors(b, a).cross(edge.subVectors(c, a)).dot(direction) > 0;
                    }
                }
                // An exit first means the emitter is inside intersecting geometry.
                if (nearest < Infinity && (exiting || nearest <= 2 * EPS))
                    blockedBy.push(entry.block.id);
            }
        }
        visit(root);
        return blockedBy;
    };
}
