import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePalette,harmony,HARMONIES,hueDistance,wheelCells,perceptual,similarityOrder} from '../src/color-palette.js';
import {activePalette,activatePalette,beginPaintStroke,finishPaintStroke,paintPaletteColor,undoPaint,paintAvailability,addRegion,savePalette,readPalettes} from '../src/color-workshop.js';
import {makeBlock,makeModel} from '../src/block-model.js';
const palette=parsePalette(readFileSync(new URL('../src/data/avorion-rgb.txt',import.meta.url),'utf8'));
test('palette preserves exact source rows and only existing base/variant relationships',()=>{
 assert.equal(palette.colors.length,407);assert.equal(palette.bases.length,132);
 assert.deepEqual(palette.byId.get('Dodger Blue').rgb,[30,144,255]);assert.equal(palette.byId.get('Black').hex,'#141414');
 assert.deepEqual(palette.byId.get('Snow').variants.map(c=>c.variant),['Base','Eternal','Infinity','Solar']);
 assert.ok(palette.wheel.every(c=>c.variant==='Base'));for(const name of ['White','Gray','Beige','Snow'])assert.ok(!palette.byId.get(name).wheel);
 for(const c of palette.colors)assert.ok(palette.byId.get(c.baseName).variants.includes(c));
 assert.throws(()=>parsePalette('256 0 0 Invalid'));assert.throws(()=>parsePalette('1 2 3 Star Unknown'));
});
test('all five harmonies balance appearance within a bounded hue neighborhood',()=>{
 const base=palette.byId.get('Dodger Blue');assert.equal(harmony(palette,base,'Complementary')[0].base.name,'Dark Orange');
 for(const mode of Object.keys(HARMONIES))for(const suggestion of harmony(palette,base,mode)){
  assert.equal(suggestion.base.variant,'Base');assert.ok(suggestion.error<=8+Math.min(...palette.wheel.filter(c=>c!==base).map(c=>hueDistance(c.h,suggestion.target))));
 }
 assert.equal(hueDistance(359,1),2);assert.deepEqual(harmony(palette,palette.byId.get('White'),'Triadic'),[]);
});

test('Family Fan has twelve separated hue families and four outward tones using only real bases',()=>{
 const cells=wheelCells(palette);assert.equal(cells.length,144);
 assert.equal(new Set(cells.map(c=>c.family)).size,12);
 for(let sector=0;sector<36;sector++){
  const bands=cells.slice(sector*4,sector*4+4);
  assert.deepEqual(bands.map(c=>c.band),[0,1,2,3]);
  for(let i=1;i<4;i++)assert.ok(bands[i-1].color.l<=bands[i].color.l);
  for(const cell of bands){
   assert.equal(cell.family,Math.floor(sector/3));assert.equal(cell.end-cell.start,9);
   assert.equal(cell.hue,(cell.start+cell.end)/2);
   assert.equal(cell.color.variant,'Base');assert.ok(palette.wheel.includes(cell.color));
   assert.equal(cell.color,palette.byId.get(cell.color.id));
   // The source has a 30-degree gap between yellow-green and green.
   assert.ok(hueDistance(cell.color.h,cell.hue)<=15);
  }
 }
 // Three columns per family; 3-degree gutters, including across zero degrees.
 assert.equal(cells[0].start+360-cells.at(-1).end,3);
 for(let i=4;i<cells.length;i+=4)assert.equal(cells[i].start-cells[i-4].end,cells[i].family===cells[i-4].family?0:3);
 assert.deepEqual(wheelCells(palette).map(c=>c.color.id),cells.map(c=>c.color.id));
});

test('selection and region repaint preserve alpha and undo both channels without changing source nodes',()=>{
 const source={getAttribute:k=>k==='secondaryColor'?'00000000':null,setAttribute:()=>assert.fail('source XML mutated'),removeAttribute:()=>assert.fail('source XML mutated'),isConnected:true};
 const a=makeBlock({id:'a',color:'80123456',secondaryColor:'00000000'});a.el=source;
 const scene={loaded:true,model:makeModel([a,makeBlock({id:'b'}),makeBlock({id:'c'})]),selectedIds:new Set(['a','b'])};
 const region=addRegion(scene,'Deck',['a','b']);
 assert.equal(paintPaletteColor(scene,palette,'Solar Royal Blue',region.ids),2);assert.equal(a.color.slice(0,2),'80');assert.equal(scene.model.blocks[2].color,'ffa0a0a0');
 undoPaint(scene);assert.equal(a.color,'80123456');undoPaint(scene,true);assert.equal(a.color,'80'+palette.byId.get('Solar Royal Blue').hex.slice(1).toLowerCase());
 paintPaletteColor(scene,palette,'Eternal Dark Orange',['a','b'],'secondaryColor','full');assert.ok(a.secondaryColor.startsWith('ff'));
 undoPaint(scene);assert.equal(a.secondaryColor,'00000000');assert.equal(scene.model.blocks[1].secondaryColor,undefined);
 assert.equal(paintAvailability(scene).redo,true);paintPaletteColor(scene,palette,'Blue',['a']);assert.equal(paintAvailability(scene).redo,false);
 assert.throws(()=>paintPaletteColor(scene,palette,'Invented Color',['a']));assert.throws(()=>addRegion(scene,'Deck',['c']));
 scene.model=makeModel([makeBlock()]);assert.deepEqual(paintAvailability(scene),{undo:false,redo:false});
});
test('saved palettes contain independently chosen verified variants, with local persistence only',()=>{
 let value=null;const storage={getItem:()=>value,setItem:(_,v)=>value=v};
 savePalette(storage,palette,'Contrast',['Solar Royal Blue','Eternal Dark Orange']);
 assert.deepEqual(readPalettes(storage,palette)[0].colors,['Solar Royal Blue','Eternal Dark Orange']);
 assert.throws(()=>savePalette(storage,palette,'Bad',['not in dataset']));
 value='not json';assert.deepEqual(readPalettes(storage,palette),[]);
});

test('perceptual conversion and near-white separation preserve every source color',()=>{
 const red=perceptual([255,0,0]);assert.ok(Math.abs(red.L-.62795536)<1e-7);assert.ok(Math.abs(red.a-.22486306)<1e-7);assert.ok(Math.abs(red.b-.12584630)<1e-7);
 assert.ok(perceptual([255,255,255]).C<1e-7);assert.equal(perceptual([0,0,0]).L,0);
 for(const name of ['Light Goldenrod Yellow','Mint Cream','Lavender']){const c=palette.byId.get(name);assert.equal(c.category,'Pale / Near-white');assert.equal(c.wheel,false);assert.ok(!wheelCells(palette).some(cell=>cell.color===c));assert.deepEqual(harmony(palette,c,'Triadic'),[]);}
 const offWheel=palette.bases.filter(c=>!c.wheel),ordered=similarityOrder(offWheel);assert.equal(new Set(ordered).size,offWheel.length);assert.ok(ordered.every(c=>offWheel.includes(c)));
 for(const base of palette.wheel)for(const mode of Object.keys(HARMONIES))for(const result of harmony(palette,base,mode)){
  assert.ok(Number.isFinite(result.score));assert.ok(result.base.wheel);assert.notEqual(result.base.id,base.id);
  const nearest=Math.min(...palette.wheel.filter(c=>c!==base).map(c=>hueDistance(c.h,result.target)));assert.ok(result.error<=nearest+8);
 }
});

test('paint strokes group updates, cancel cleanly, and preserve redo on cancellation',()=>{
 const scene={loaded:true,model:makeModel([makeBlock({id:'a'}),makeBlock({id:'b'})])};
 const original=scene.model.blocks.map(b=>b.color);
 beginPaintStroke(scene);paintPaletteColor(scene,palette,'Red',['a']);paintPaletteColor(scene,palette,'Blue',['b']);paintPaletteColor(scene,palette,'Green',['a']);
 assert.equal(undoPaint(scene),false);finishPaintStroke(scene);
 assert.equal(scene.paintHistory.undo.length,1);undoPaint(scene);assert.deepEqual(scene.model.blocks.map(b=>b.color),original);
 beginPaintStroke(scene);paintPaletteColor(scene,palette,'Red',['a']);finishPaintStroke(scene,true);
 assert.deepEqual(scene.model.blocks.map(b=>b.color),original);assert.equal(paintAvailability(scene).redo,true);
 undoPaint(scene,true);assert.deepEqual(scene.model.blocks.map(b=>b.color),['ff00ff00','ff0000ff']);
});

test('active palette persists independently of palette contents and rejects stale names',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(activePalette(storage,palette),null);savePalette(storage,palette,'Brush',['Blue','Dark Orange']);activatePalette(storage,palette,'Brush');
 assert.deepEqual(activePalette(storage,palette),{name:'Brush',colors:['Blue','Dark Orange']});
 assert.throws(()=>activatePalette(storage,palette,'Missing'));assert.equal(activePalette(storage,palette).name,'Brush');
});

test('regions can be renamed, edited, grown, deleted and undone without leaving empty regions',async()=>{
 const {renameRegion,deleteRegion,editRegion,growRegion,touchingBlocks,undoRegionChange,regionUndoLabel}=await import('../src/color-workshop.js');
 const at=(id,x)=>makeBlock({id,position:{x,y:0,z:0},size:{x:2,y:2,z:2}});
 const scene={loaded:true,revision:0,hiddenIds:new Set(),model:makeModel([at('a',0),at('b',2),at('c',4),at('d',10)])};
 const region=addRegion(scene,'Spine',['a']),before=scene.regions;
 assert.equal(editRegion(scene,region.id,['b','ghost'],'add'),1);assert.notEqual(scene.regions,before);assert.deepEqual(scene.regions[0].ids,['a','b']);
 assert.equal(editRegion(scene,region.id,['b'],'add'),0);
 assert.throws(()=>editRegion(scene,region.id,['a','b'],'remove'),/at least one block/);
 assert.equal(editRegion(scene,region.id,['a'],'remove'),1);assert.deepEqual(scene.regions[0].ids,['b']);
 assert.deepEqual(touchingBlocks(scene.model.blocks,['b']),['a','c']);
 assert.equal(growRegion(scene,region.id),2);assert.deepEqual(scene.regions[0].ids,['b','a','c']);
 assert.throws(()=>growRegion(scene,region.id),/No other blocks/);
 scene.hiddenIds=new Set(['c']);undoRegionChange(scene);assert.equal(growRegion(scene,region.id),2,'hidden blocks still grow the region');scene.hiddenIds=new Set();
 assert.equal(editRegion(scene,region.id,['d'],'replace'),4);assert.deepEqual(scene.regions[0].ids,['d']);
 addRegion(scene,'Wing',['a']);assert.throws(()=>renameRegion(scene,region.id,'Wing'));
 assert.equal(renameRegion(scene,region.id,'Keel').name,'Keel');assert.equal(regionUndoLabel(scene),'Rename Spine');
 deleteRegion(scene,region.id);assert.deepEqual(scene.regions.map(r=>r.name),['Wing']);
 assert.equal(undoRegionChange(scene),'Delete Keel');assert.deepEqual(scene.regions.map(r=>r.name),['Keel','Wing']);
 assert.throws(()=>deleteRegion(scene,'missing'));
 scene.model=makeModel([at('z',0)]);assert.equal(regionUndoLabel(scene),'');
});

test('region display isolates live, follows edits, and yields to outside visibility changes',async()=>{
 const {editRegion,growRegion,deleteRegion,undoRegionChange}=await import('../src/color-workshop.js');
 const {setRegionDisplay,regionHighlightIds,regionDisplayMode}=await import('../src/region-display.js');
 const at=(id,x)=>makeBlock({id,position:{x,y:0,z:0},size:{x:2,y:2,z:2}});
 const manual=new Set(['d']),scene={loaded:true,revision:0,hiddenIds:manual,model:makeModel([at('a',0),at('b',2),at('c',4),at('d',10)])};
 const r=addRegion(scene,'',['a','b']);assert.equal(r.name,'Region 1');assert.ok(r.color);
 setRegionDisplay(scene,r.id,'highlight');assert.deepEqual([...regionHighlightIds(scene)],['a','b']);assert.equal(scene.hiddenIds,manual);
 setRegionDisplay(scene,r.id,'isolate');assert.deepEqual([...scene.hiddenIds].sort(),['c','d']);assert.equal(regionHighlightIds(scene).size,0);
 editRegion(scene,r.id,['b'],'remove');assert.deepEqual([...scene.hiddenIds].sort(),['b','c','d'],'removed block hides at once');
 growRegion(scene,r.id);assert.deepEqual([...scene.hiddenIds].sort(),['c','d'],'grown block shows at once');
 setRegionDisplay(scene,r.id,'highlight');assert.equal(scene.hiddenIds,manual,'leaving isolation restores earlier visibility');
 setRegionDisplay(scene,r.id,'isolate');scene.hiddenIds=new Set();editRegion(scene,r.id,['c'],'add');
 assert.equal(regionDisplayMode(scene,r.id),'highlight','outside Show All turns isolation into highlight');assert.equal(scene.hiddenIds.size,0);
 setRegionDisplay(scene,r.id,'isolate');deleteRegion(scene,r.id);assert.equal(scene.regionDisplay,null);assert.equal(scene.hiddenIds.size,0);
 undoRegionChange(scene);assert.equal(scene.regions.length,1);
});
