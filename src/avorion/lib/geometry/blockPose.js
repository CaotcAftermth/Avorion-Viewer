import * as THREE from "../../../vendor/three.module.js";
/** Apply viewer-only poses from immutable vertices, so repeated animation cannot drift. */
export class BlockPose {
    geometry;
    ranges;
    base = new Map();
    active = new Set();
    constructor(geometry, ranges) {
        this.geometry = geometry;
        this.ranges = ranges;
    }
    apply(poses) {
        const ids = new Set([...this.active, ...poses.keys()]);
        const point = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
        for (const name of ["position", "normal", "aRoot", "aDir"]) {
            const attribute = this.geometry.getAttribute(name);
            if (!attribute)
                continue;
            if (!this.base.has(name))
                this.base.set(name, Float32Array.from(attribute.array));
            const source = this.base.get(name);
            for (const id of ids) {
                const pose = poses.get(id);
                if (pose)
                    normalMatrix.getNormalMatrix(pose);
                for (const [start, count] of this.ranges.get(id) ?? [])
                    for (let i = start; i < start + count; i++) {
                        point.fromArray(source, i * 3);
                        const kind=this.geometry.getAttribute("aData")?.getX(i)??0;
                        const billboard = name === "position" && kind >= 4 && kind <= 8;
                        if (pose && !billboard) {
                            if(name === "aDir")
                                point.transformDirection(pose);
                            else if (name === "normal")
                                point.applyMatrix3(normalMatrix).normalize();
                            else
                                point.applyMatrix4(pose);
                        }
                        attribute.setXYZ(i, point.x, point.y, point.z);
                    }
            }
            attribute.needsUpdate = true;
        }
        this.active = new Set(poses.keys());
        this.geometry.computeBoundingSphere();
    }
}
