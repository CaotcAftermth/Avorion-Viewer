import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeBlock,makeModel} from '../src/block-model.js';
import {parsePalette} from '../src/color-palette.js';
import {paintOptions,paintScope,mirroredIds,bulkPaintTargets,applyPaintTool,samplePaintColor} from '../src/paint-tools.js';
import {paintPaletteColor,undoPaint,beginPaintStroke,finishPaintStroke} from '../src/color-workshop.js';
const palette=parsePalette(readFileSync(new URL('../src/data/avorion-rgb.txt',import.meta.url),'utf8'));
const block=(id,x,color='ff112233',extra={})=>makeBlock({id,position:{x,y:0,z:0},color,...extra});
const scene=blocks=>({loaded:true,visible:true,model:makeModel(blocks),selectedIds:new Set(),regions:[],hiddenIds:new Set()});
test('paint scope locks stay empty without a selection or valid region and exclude hidden blocks',()=>{
 const s=scene([block('a',-1),block('b',1)]),o=paintOptions({});
 assert.deepEqual([...paintScope(s,o)],['a','b']);o.scope='selection';assert.equal(paintScope(s,o).size,0);
 s.selectedIds.add('a');assert.deepEqual([...paintScope(s,o)],['a']);assert.equal(paintScope(s,o,new Set(['a'])).size,0);
 o.scope='region';o.regionId='gone';assert.equal(paintScope(s,o).size,0);s.regions=[{id:'r',ids:['b']}];o.regionId='r';assert.deepEqual([...paintScope(s,o)],['b']);s.visible=false;assert.equal(paintScope(s,o).size,0);
});
test('symmetry matches existing block centers and sizes and honors scope on both sides',()=>{
 const s=scene([block('a',-2),block('b',2),block('wrong',2,'ff112233',{size:{x:1,y:2,z:2}})]),o=paintOptions({});o.symmetry.x=true;
 assert.deepEqual(mirroredIds(s.model,['a'],o,new Set(['a','b','wrong'])),['a','b']);
 assert.deepEqual(mirroredIds(s.model,['a'],o,new Set(['a'])),['a']);assert.deepEqual(mirroredIds(s.model,['a'],o,new Set(['b'])),[]);
 o.origin.x=1;assert.deepEqual(mirroredIds(s.model,['a'],o,new Set(['a','b'])),['a']);
});
test('fill connects face neighbors by chosen rule, excluding corner contacts and disjoint islands',()=>{
 const a=block('a',0),b=block('b',2),c=block('c',4,'ff445566'),island=block('island',10),corner=block('corner',0);corner.position={x:2,y:2,z:2};
 const blocks=[a,b,c,island,corner].map(b=>({...b,paintColor:b.color}));
 assert.deepEqual(bulkPaintTargets(blocks,'a','fill','color').sort(),['a','b']);
 assert.deepEqual(bulkPaintTargets(blocks,'a','fill','material').sort(),['a','b','c']);
 assert.deepEqual(bulkPaintTargets(blocks,'a','replace','color').sort(),['a','b','corner','island']);
 assert.deepEqual(bulkPaintTargets(blocks.filter(b=>b.id!=='b'),'a','fill','type'),['a']);
});
test('eyedropper reports source ARGB exactly and does not invent a palette match',()=>{
 assert.equal(samplePaintColor(palette,block('a',0,'801e90ff'),'color').exact.name,'Dodger Blue');
 const imported=samplePaintColor(palette,block('a',0),'color');assert.equal(imported.argb,'ff112233');assert.equal(imported.exact,null);
 assert.equal(samplePaintColor(palette,block('a',0),'secondaryColor').argb,undefined);
});
test('restore returns original primary and missing secondary values; undo restores the paint',()=>{
 const s=scene([block('a',0)]),o=paintOptions({}),allowed=new Set(['a']),brush={colorId:'Blue',channel:'color',strength:'full'};
 applyPaintTool(s,palette,brush,['a'],o,allowed);o.tool='restore';applyPaintTool(s,palette,brush,['a'],o,allowed);assert.equal(s.model.blocks[0].color,'ff112233');undoPaint(s);assert.equal(s.model.blocks[0].color,'ff0000ff');
 paintPaletteColor(s,palette,'Red',['a'],'secondaryColor','full');brush.channel='secondaryColor';beginPaintStroke(s);applyPaintTool(s,palette,brush,['a'],o,allowed);finishPaintStroke(s);assert.equal(s.model.blocks[0].secondaryColor,undefined);undoPaint(s);assert.equal(s.model.blocks[0].secondaryColor,'ffff0000');
});
test('paint settings clamp radius/lens sizes and survive JSON persistence',()=>{
 const v={paint:{radius:999,lensZoom:99,lensSize:1,tool:'invalid'}};paintOptions(v);assert.equal(v.paint.radius,64);assert.equal(v.paint.lensZoom,8);assert.equal(v.paint.lensSize,120);assert.equal(v.paint.tool,'brush');assert.deepEqual(paintOptions(JSON.parse(JSON.stringify(v))),v.paint);
});

test('malformed optional paint settings recover and missing selection stays locked',()=>{
 const v={paint:'old value'};assert.equal(paintOptions(v).tool,'brush');v.paint.origin='invalid';v.paint.symmetry=false;assert.deepEqual(paintOptions(v).origin,{x:0,y:0,z:0});
 const s=scene([block('a',0)]);delete s.selectedIds;assert.equal(paintScope(s,{scope:'selection'}).size,0);
});
