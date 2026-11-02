import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePalette,addMaterialColors} from '../src/color-palette.js';

test('material defaults extend the palette without changing source colors or the hue wheel',()=>{
  const original=parsePalette(readFileSync(new URL('../src/data/avorion-rgb.txt',import.meta.url),'utf8'));
  const palette=addMaterialColors(original);
  assert.equal(palette.colors.length,original.colors.length+7);
  assert.equal(palette.wheel,original.wheel);
  assert.deepEqual(palette.materials.map(c=>[c.name,c.hex]),[
    ['Iron','#BFAEA3'],['Titanium','#BFBFBF'],['Naonite','#A3BFA3'],['Trinium','#A3AFBF'],
    ['Xanion','#BFBFA3'],['Ogonite','#BFADA3'],['Avorion','#BC9F9F']]);
  for(const color of palette.materials){
    assert.equal(palette.byId.get(color.id),color);
    assert.equal(color.category,'Materials');assert.equal(color.row,null);
    assert.deepEqual(color.variants,[color]);assert.ok(palette.bases.includes(color));
  }
  assert.equal(palette.byId.get('Titanium').sourceArgb,'BFBFBFBF');
  assert.equal(original.byId.has('Iron'),false);
});
