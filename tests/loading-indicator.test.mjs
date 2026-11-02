import test from 'node:test';
import assert from 'node:assert/strict';
import {ringOffset} from '../src/loading-indicator.js';

test('ring offset maps percent to the arc that stays hidden', () => {
  const full=ringOffset(0);
  assert.ok(full>0);
  assert.equal(ringOffset(100),0);
  assert.ok(Math.abs(ringOffset(50)-full/2)<1e-9);
});

test('ring offset clamps out-of-range and invalid values', () => {
  assert.equal(ringOffset(-20),ringOffset(0));
  assert.equal(ringOffset(250),0);
  assert.equal(ringOffset('nope'),ringOffset(0));
});
