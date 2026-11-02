import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock, makeModel} from '../src/block-model.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {textureLibrary} from '../src/avorion/lib/textures/textureLibrary.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';

// Some drivers (ANGLE on Windows) reject a program that uses all 16 vertex
// attributes ("Too many attributes"), so the block shader keeps headroom.
const MAX_ATTRIBUTES = 14;

test('block meshes stay under the vertex attribute budget and pack seam sides into aEmission.w', () => {
  // A row of 20 touching cubes is instanced; each inner cube touches both X neighbours.
  const blocks = Array.from({length: 20}, (_, i) => makeBlock({id: 'b' + i, position: {x: i * 2, y: 0, z: 0}, size: {x: 2, y: 2, z: 2}}));
  const model = buildTexturedModel(makeModel(blocks), defaultOrientationProfile(), {...DEFAULT_GAME_SHADER, simplified: true});
  try {
    const meshes = model.group.children.filter(m => m.userData.textured);
    assert.ok(meshes.some(m => m.userData.instanced), 'expected an instanced batch');
    for (const mesh of meshes) {
      const declared = [...mesh.material.vertexShader.matchAll(/^\s*attribute\s+\w+\s+(\w+)/gm)].map(m => m[1]);
      const used = new Set(['position', 'normal', ...declared]);
      assert.ok(used.size <= MAX_ATTRIBUTES, `shader declares ${used.size} attributes: ${[...used]}`);
      assert.ok(Object.keys(mesh.geometry.attributes).length <= MAX_ATTRIBUTES);
      assert.equal(mesh.geometry.getAttribute('aEmission').itemSize, 4);
      assert.equal(mesh.geometry.getAttribute('aEdges').itemSize, 4);
      if (mesh.userData.instanced) {
        const emission = mesh.geometry.getAttribute('aEmission'), index = [...mesh.userData.ranges.keys()].indexOf('b5');
        if (index >= 0) assert.equal(emission.getW(mesh.userData.ranges.get('b5')[0][0]), (1 << 0) | (1 << 1));
      }
    }
  } finally {model.dispose(); textureLibrary.clear();}
});
