import test from 'node:test';
import assert from 'node:assert/strict';
import { blockGallery, materialColor, blockVariants, galleryTypes, isBlockGallery, applyGalleryEdit, BLOCK_GALLERY_NAME } from '../src/block-gallery.js';
import { orientationGallery, ORIENTATIONS, ORIENTATION_GALLERY_TYPES, getBlockDefinition, makeBlock } from '../src/block-model.js';

const gaps=(blocks,axis)=>[...new Set(blocks.map(b=>b.position[axis]))].sort((a,b)=>a-b).map((v,i,all)=>i?v-all[i-1]:null).slice(1);

test('Block Gallery holds the cube of every block type as 2 × 2 × 2 blocks with 2-unit gaps',()=>{
  const model=blockGallery();
  assert.equal(model.fileName,BLOCK_GALLERY_NAME);
  assert.ok(model.blocks.length>=60);
  for(const b of model.blocks){assert.deepEqual(b.size,{x:2,y:2,z:2});assert.equal(b.position.y,1);assert.equal(getBlockDefinition(b.typeIndex).geometryKind,'box');}
  for(const axis of ['x','z'])for(const step of gaps(model.blocks,axis))assert.equal(step,4);
  const types=new Set(model.blocks.map(b=>b.typeIndex));
  for(const cube of [2,8,6,122,150,170,3,7,10,20,24,600,650])assert.ok(types.has(cube),`missing ${cube}`);
  for(const shape of [100,123,21,25,601])assert.ok(!types.has(shape),`${shape} is a variant, not a cube`);
  assert.equal(types.size,galleryTypes().length);
  for(const b of model.blocks)assert.equal(b.color,'ffffe9de','gallery blocks start in the Iron paint tint');
  assert.equal(blockGallery(6).blocks[0].color,materialColor(6));
});

test('variants list a block family\'s shapes, cube first',()=>{
  assert.deepEqual(blockVariants(122).map(v=>v.label),['Cube','Edge','Corner 1','Corner 2','Corner 3','Twisted Corner 1','Twisted Corner 2','Flat Corner']);
  assert.deepEqual(blockVariants(125).map(v=>v.typeIndex),[122,123,124,125,126,128,129,127]);
  assert.deepEqual(blockVariants(20).map(v=>v.typeIndex),[20,21]);
  assert.deepEqual(blockVariants(3).map(v=>v.typeIndex),[3]);
});

test('gallery edits keep the block in its slot',()=>{
  const target=makeBlock({typeIndex:122,position:{x:8,y:1,z:-4}}),edited=makeBlock({typeIndex:125,look:4,up:3,materialIndex:6,color:'ff112233',secondaryColor:'80ff0000',position:{x:0,y:5,z:0},size:{x:1,y:1,z:1}});
  applyGalleryEdit(target,edited);
  assert.equal(target.typeIndex,125);assert.equal(target.look,4);assert.equal(target.materialIndex,6);assert.equal(target.secondaryColor,'80ff0000');
  assert.deepEqual(target.position,{x:8,y:1,z:-4});assert.deepEqual(target.size,{x:2,y:2,z:2});
  assert.ok(isBlockGallery({preview:true,model:{fileName:BLOCK_GALLERY_NAME}}));
  assert.ok(!isBlockGallery({preview:false,model:{fileName:BLOCK_GALLERY_NAME}}));
});

test('orientation gallery uses plain non-cube hull shapes, 2 × 2 × 2 with 1-unit gaps',()=>{
  const model=orientationGallery();
  assert.equal(model.blocks.length,ORIENTATION_GALLERY_TYPES.length*ORIENTATIONS.length);
  for(const b of model.blocks){
    const def=getBlockDefinition(b.typeIndex);
    assert.ok(!def.displayName.startsWith('Smart'),def.displayName);assert.notEqual(def.geometryKind,'box');
    assert.deepEqual(b.size,{x:2,y:2,z:2});
  }
  assert.equal(new Set(model.blocks.map(b=>b.typeIndex)).size,7);
  for(const axis of ['x','z'])for(const step of gaps(model.blocks,axis))assert.equal(step,3);
});

test('gallery holograms start at 50% opacity and old gray galleries take material colors',async()=>{
  const { getShadingSpec } = await import('../src/avorion/lib/textures/shadingMap.js');
  const { upgradeGalleryColors } = await import('../src/block-gallery.js');
  for(const b of blockGallery().blocks)if(getShadingSpec(b.typeIndex).surface==='hologram')assert.equal(b.opacity,.5);
  const old=blockGallery();for(const b of old.blocks)b.color='ffa0a0a0';old.blocks[1].materialIndex=6;
  old.blocks[2].color='ffffb380';old.blocks[3].color='ff123456';
  upgradeGalleryColors(old);assert.equal(old.blocks[0].color,'ffffe9de');assert.equal(old.blocks[1].color,materialColor(6));
  assert.equal(old.blocks[2].color,'ffffe9de','old vivid Iron default follows the new paint');assert.equal(old.blocks[3].color,'ff123456','custom paint is kept');
});

test('engine plumes default to the engine material color; secondary color overrides',async()=>{
  const { effectColor } = await import('../src/avorion/lib/geometry/blockEffects.js');
  const avorion=effectColor(makeBlock({typeIndex:3,materialIndex:6}));
  assert.deepEqual([avorion.r,avorion.g,avorion.b].map(v=>Math.round(v*255)),[255,38,38]);
  const painted=effectColor(makeBlock({typeIndex:3,materialIndex:6,secondaryColor:'ff00ff00'}));
  assert.deepEqual([painted.r,painted.g,painted.b],[0,1,0]);
});

test('imported holograms default to 50% opacity and glow 1.5; saved old glow default migrates',async()=>{
  const { blockOpacity } = await import('../src/block-opacity.js');
  const { FACTORY_PREFERENCES, parsePreferences } = await import('../src/preferences.js');
  const hologram=galleryTypes().find(d=>d.typeIndex&&blockOpacity(makeBlock({typeIndex:d.typeIndex}))===.5);
  assert.ok(hologram,'a hologram block type exists');
  const imported=makeBlock({typeIndex:hologram.typeIndex,color:'ffffffff'});
  assert.equal(blockOpacity(imported),.5);imported.opacity=.8;assert.equal(blockOpacity(imported),.8);
  assert.equal(FACTORY_PREFERENCES.shaderHologramGlow,1.5);
  assert.equal(parsePreferences(JSON.stringify({version:1,shaderHologramGlow:.1})).shaderHologramGlow,1.5);
  assert.equal(parsePreferences(JSON.stringify({version:1,shaderHologramGlow:.6})).shaderHologramGlow,.6);
});
