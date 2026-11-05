import test from 'node:test';
import assert from 'node:assert/strict';
import {colorCellContrast} from '../src/color-cells.js';
test('cell text maintains at least 4.5:1 contrast across RGB colors',()=>{
 const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
 for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
  const hex=[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''),ink=colorCellContrast(hex),l=.2126*linear(r)+.7152*linear(g)+.0722*linear(b);
  assert.ok((ink==='#000000'?(l+.05)/.05:1.05/(l+.05))>=4.5,hex);
 }
 assert.equal(colorCellContrast('FF006400'),'#ffffff');assert.equal(colorCellContrast('FFBEAFA3'),'#000000');
});

import {CURSOR_NAMES,cursorIcon} from '../src/viewport-cursors.js';
test('tool artwork has finite square bounds and fills its icon box',()=>{
 for(const [id] of CURSOR_NAMES){const box=cursorIcon(id).match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);assert.ok(box.every(Number.isFinite),id);assert.ok(box[2]>0,id);assert.equal(box[2],box[3]);}
});
