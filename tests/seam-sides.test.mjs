import test from 'node:test';
import assert from 'node:assert/strict';
import {seamSides} from '../src/avorion/lib/geometry/texturedModel.js';

const block=(id,[x,y,z],[sx,sy,sz])=>({id,position:{x,y,z},size:{x:sx,y:sy,z:sz}});

test('faces completely covered by neighbours are flagged per ship-space side',()=>{
  // Two blocks fully cover the top of a large one (a T-junction); a small one sits beside it.
  const masks=seamSides([block('big',[0,0,0],[4,1,4]),block('left',[-1,1,0],[2,1,4]),block('right',[1,1,0],[2,1,4]),block('side',[2.6,0,0],[1.2,1,1])]);
  assert.equal(masks.get('big'),1<<3);             // +Y covered by left and right; +X only partly by side
  assert.equal(masks.get('left'),(1<<2)|(1<<1));   // -Y on big, +X against right
  assert.equal(masks.get('right'),(1<<2)|(1<<0));  // -Y on big, -X against left
  assert.equal(masks.get('side'),1<<0);            // -X fully against big
});

test('partly covered outer faces stay unflagged',()=>{
  // A small block on a thin plate must not push the plate's exposed top back.
  const masks=seamSides([block('plate',[0,0,0],[4,.1,4]),block('cap',[0,.55,0],[1,1,1])]);
  assert.equal(masks.get('plate'),0);assert.equal(masks.get('cap'),1<<2);
});

test('gaps, edge contact and flat blocks do not count as seams',()=>{
  const masks=seamSides([block('a',[0,0,0],[1,1,1]),block('gap',[-1.1,0,0],[1,1,1]),block('edge',[1,1,0],[1,1,1]),block('flat',[0,.5,0],[1,0,1])]);
  assert.equal(masks.get('a'),0);assert.equal(masks.get('gap'),0);assert.equal(masks.get('edge'),0);assert.equal(masks.get('flat'),0);
});
