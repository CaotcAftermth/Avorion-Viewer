import test from 'node:test';
import assert from 'node:assert/strict';
import {gifPalette} from '../src/export/gif-palette.js';
test('adaptive GIF palette preserves neutral surfaces without spatial color patterns',()=>{
  const rgba=new Uint8Array(256*4);
  for(let i=0;i<256;i++)rgba.set([48,48,48,255],i*4);
  const {pixels,palette}=gifPalette(rgba,null,true);
  assert.equal(new Set(pixels).size,1);
  assert.deepEqual([...palette.slice(pixels[0]*3,pixels[0]*3+3)],[48,48,48]);
});
test('transparent index is never used for opaque white and clear frames remain clear',()=>{
  const {pixels,palette}=gifPalette(Uint8Array.from([255,255,255,255,255,255,255,0]),null,true);
  assert.notEqual(pixels[0],255);assert.equal(pixels[1],255);
  assert.deepEqual([...palette.slice(pixels[0]*3,pixels[0]*3+3)],[255,255,255]);
  assert.ok(gifPalette(new Uint8Array(64),null,true).pixels.every(i=>i===255));
});
