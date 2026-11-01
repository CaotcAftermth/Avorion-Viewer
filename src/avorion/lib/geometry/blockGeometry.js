// ---------------------------------------------------------------------------
// Unit geometries for Avorion's 8 block shapes.
//
// Vertices verified against the community Blender importer
// (jgersti/blender-avorion-importer), which imports real ships correctly.
// Reference shapes live in the unit cube [0,1]^3; we recenter to
// [-0.5,0.5]^3 so meshes rotate about their centroid (the game rotates the
// reference shape about the cube center before scaling/translating).
//
// Faces are stored as polygon fans and triangulated; geometry is non-indexed
// with computed normals for crisp flat shading.
// ---------------------------------------------------------------------------
import * as THREE from "../../../vendor/three.module.js";
const SHAPES = {
    // 6 quads.
    box: {
        vertices: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
        faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]],
    },
    // Edge / wedge: sloped quad from one top edge down to the opposite bottom edge.
    wedge: {
        vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [1, 1, 0], [1, 1, 1]],
        faces: [[0, 1, 2, 3], [0, 3, 5, 4], [1, 4, 5, 2], [2, 5, 3], [0, 4, 1]],
    },
    // Corner 1: tetrahedron.
    corner: {
        vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [1, 1, 0]],
        faces: [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]],
    },
    // Corner 2: 7-vertex polyhedron (cube minus one corner tetra).
    corner2: {
        vertices: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1], [1, 1, 0]],
        faces: [[0, 3, 2, 1], [0, 4, 6, 3], [2, 3, 6, 5], [0, 1, 4], [1, 2, 5], [4, 5, 6], [1, 5, 4]],
    },
    // Corner 3: pyramid with quad base.
    corner3: {
        vertices: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]],
        faces: [[0, 3, 2, 1], [0, 1, 4], [0, 4, 3], [1, 2, 4], [2, 3, 4]],
    },
    // Flat corner: pyramid variant with the apex edge along a diagonal.
    flatcorner: {
        vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 1], [1, 0, 1], [1, 0, 0]],
        faces: [[0, 3, 2, 1], [0, 1, 4], [0, 4, 3], [1, 2, 4], [2, 3, 4]],
    },
    // Twisted corners: mirrored tetrahedra.
    twisted1: {
        vertices: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0]],
        faces: [[0, 1, 3], [0, 2, 1], [0, 3, 2], [1, 2, 3]],
    },
    twisted2: {
        vertices: [[1, 0, 0], [0, 0, 1], [1, 0, 1], [1, 1, 0]],
        faces: [[0, 1, 3], [0, 2, 1], [0, 3, 2], [1, 2, 3]],
    },
};
function buildGeometry(def) {
    const pos = [];
    const push = (i) => {
        const v = def.vertices[i];
        pos.push(v[0] - 0.5, v[1] - 0.5, v[2] - 0.5); // recenter to origin
    };
    for (const f of def.faces) {
        for (let t = 1; t < f.length - 1; t++) { // fan triangulation
            push(f[0]);
            push(f[t]);
            push(f[t + 1]);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}
const cache = new Map();
export function getUnitGeometry(kind) {
    const k = kind === "placeholder" ? "box" : kind;
    let g = cache.get(k);
    if (!g) {
        g = buildGeometry(SHAPES[k]);
        cache.set(k, g);
    }
    return g;
}
