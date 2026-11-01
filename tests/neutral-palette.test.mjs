import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePalette,nearestNeutral,perceptual,isGrayscale} from '../src/color-palette.js';
const palette=parsePalette(readFileSync(new URL('../src/data/avorion-rgb.txt',import.meta.url),'utf8'));
test('neutral slider minimizes perceptual distance using only real grayscale bases',()=>{
 for(let value=0;value<=255;value++){
  const actual=nearestNeutral(palette,value),target=perceptual([value,value,value]);
  const distance=c=>Math.hypot(c.ok.L-target.L,c.ok.a-target.a,c.ok.b-target.b);
  assert.ok(palette.bases.includes(actual)&&isGrayscale(actual));
  assert.ok(palette.bases.filter(isGrayscale).every(c=>distance(actual)<=distance(c)+1e-12));
 }
 assert.equal(nearestNeutral(palette,0).name,'Black');assert.equal(nearestNeutral(palette,255).name,'White');
});
