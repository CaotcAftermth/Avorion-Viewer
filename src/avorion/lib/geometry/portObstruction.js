import * as THREE from "../../../vendor/three.module.js";
import { getBlockDefinition } from "../avorion/blockDefinitions.js";
import { localScaleFor, resolveOrientation } from "../avorion/orientation.js";
import { getShadingSpec } from "../textures/shadingMap.js";
import { getUnitGeometry } from "./blockGeometry.js";
const EPS = 1e-7; // Numerical contact tolerance, not an exhaust clearance distance.
export const THRUSTER_CENTER_CLEARANCE = .02;
export const THRUSTER_SEPARATION_CLEARANCE = .00541;
// Clip a swept center opening against the solid. Testing the whole interval
// catches thin covers between the port and the measured separation threshold.
function intersectsOpening(opening, planes, direction) {
    const far = opening.map(p => p.clone().addScaledVector(direction, THRUSTER_SEPARATION_CLEARANCE - 2 * EPS));
    let faces = [opening.slice().reverse(), far];
    for(let i=0;i<4;i++)faces.push([opening[i],opening[(i+1)%4],far[(i+1)%4],far[i]]);
    for(const plane of planes){
        const next=[],cap=[];
        for(const polygon of faces){
            const clipped=[];
            for(let i=0;i<polygon.length;i++){
                const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);
                if(da<=0)clipped.push(a);
                if((da<0&&db>0)||(da>0&&db<0)){
                    const hit=a.clone().lerp(b,da/(da-db));clipped.push(hit);
                    if(!cap.some(p=>p.distanceToSquared(hit)<EPS*EPS))cap.push(hit);
                }
            }
            if(clipped.length>=3)next.push(clipped);
        }
        if(cap.length>=3){
            const center=cap.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(cap.length);
            const u=cap[0].clone().sub(center).normalize(),v=new THREE.Vector3().crossVectors(plane.normal,u);
            cap.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));
            next.push(cap);
        }
        faces=next;if(!faces.length)return false;
    }
    const origin=faces[0][0];let volume=0;
    for(const polygon of faces)for(let i=1;i<polygon.length-1;i++)
        volume+=polygon[0].clone().sub(origin).dot(polygon[i].clone().sub(origin).cross(polygon[i+1].clone().sub(origin)));
    return Math.abs(volume)>EPS*EPS*EPS;
}
function solidPlanes(kind, matrix) {
    const unit = getUnitGeometry(kind).getAttribute("position"), planes = [];
    for (let i = 0; i < unit.count; i += 3) {
        const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(unit, i + j).applyMatrix4(matrix));
        const plane = new THREE.Plane().setFromCoplanarPoints(...vertices);
        if (plane.normal.lengthSq() > .5) planes.push(plane);
    }
    return planes;
}
function solids(entry) {
    if (entry.block.typeIndex !== 10)
        return [solidPlanes(getBlockDefinition(entry.block.typeIndex).geometryKind, entry.matrix)];
    // An open hangar is four convex frame bars, not its enclosing box.
    const size = new THREE.Vector3().setFromMatrixScale(entry.matrix);
    const x = Math.min(.15, .3 / size.x), y = Math.min(.15, .3 / size.y);
    return [[-.5 + x / 2, 0, x, 1], [.5 - x / 2, 0, x, 1],
        [0, -.5 + y / 2, 1 - 2 * x, y], [0, .5 - y / 2, 1 - 2 * x, y]].map(([cx, cy, sx, sy]) => {
        const local = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, 0), new THREE.Quaternion(), new THREE.Vector3(sx, sy, 1));
        return solidPlanes("box", entry.matrix.clone().multiply(local));
    });
}
/** Local contact query. Holograms and distant blocks never suppress a plume.
 * A BVH keeps the fixed center-opening test local on large imported ships. */
export function createPortObstruction(blocks, profile) {
    function tree(entries) {
        const bounds = new THREE.Box3();
        entries.forEach(e => bounds.union(e.bounds));
        if (entries.length <= 12) return { bounds, entries };
        const size = bounds.getSize(new THREE.Vector3());
        const axis = size.x > size.y && size.x > size.z ? "x" : size.y > size.z ? "y" : "z";
        entries.sort((a, b) => a.bounds.min[axis] + a.bounds.max[axis] - b.bounds.min[axis] - b.bounds.max[axis]);
        const mid = Math.floor(entries.length / 2);
        return { bounds, left: tree(entries.slice(0, mid)), right: tree(entries.slice(mid)) };
    }
    const root = tree(blocks.filter(block => getShadingSpec(block.typeIndex).surface !== "hologram").map(block => {
        const { base, quaternion } = resolveOrientation(profile, block.look, block.up, block.typeIndex);
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(block.position.x, block.position.y, block.position.z), quaternion, localScaleFor(base, block.size));
        const bounds = new THREE.Box3(new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5)).applyMatrix4(matrix).expandByScalar(EPS);
        return { block, bounds, matrix };
    }));
    return (owner, point, direction, tangent) => {
        const blockedBy = [];
        const u = tangent ?? new THREE.Vector3().setComponent(Math.abs(direction.x) < .9 ? 0 : 1, 1).projectOnPlane(direction).normalize();
        const v = new THREE.Vector3().crossVectors(direction, u).normalize();
        // Probe immediately outside the port so its own backing face and blocks
        // behind that plane do not count. Shrink only by numerical tolerance:
        // an opening exactly .02 wide must pass, including at shared edges.
        const center = point.clone().addScaledVector(direction, EPS);
        const half = THRUSTER_CENTER_CLEARANCE / 2 - EPS;
        const opening = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => center.clone().addScaledVector(u,x*half).addScaledVector(v,y*half));
        const query = new THREE.Box3().setFromPoints([...opening,...opening.map(p=>p.clone().addScaledVector(direction,THRUSTER_SEPARATION_CLEARANCE))]).expandByScalar(EPS);
        function visit(node) {
            if (!node.bounds.intersectsBox(query)) return;
            if (!node.entries) { visit(node.left); visit(node.right); return; }
            for (const entry of node.entries) {
                if (entry.block.id === owner || !entry.bounds.intersectsBox(query)) continue;
                entry.solids ??= solids(entry);
                if (entry.solids.some(planes => intersectsOpening(opening, planes, direction))) blockedBy.push(entry.block.id);
            }
        }
        visit(root);
        return blockedBy;
    };
}
