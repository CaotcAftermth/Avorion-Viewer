import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
import {applyBlockColors} from '../src/block-colors.js';
const make=()=>makeModel(Array.from({length:32},(_,i)=>makeBlock({id:'b'+i,position:{x:i%8,y:Math.floor(i/8),z:0},secondaryColor:'00000000'})));
test('shared geometry batches keep IDs, partial selection and both color channels',()=>{
 const source=make(),model=buildTexturedModel(source,defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
 try{
  const meshes=model.group.children.filter(m=>m.userData.textured);assert.ok(meshes.some(m=>m.userData.instanced));
  for(const mesh of meshes)for(const attr of Object.values(mesh.geometry.attributes))attr.clearUpdateRanges();
  const before=meshes.map(m=>m.geometry.getAttribute('aParams').version);model.setSelection(new Set(['b3']));
  for(const [i,m] of meshes.entries()){const a=m.geometry.getAttribute('aParams');if(m.userData.ranges.has('b3'))assert.equal(a.updateRanges.reduce((n,r)=>n+r.count,0),4);else assert.equal(a.version,before[i]);}
  const scene={model:source},undo=applyBlockColors(scene,[{id:'b3',color:'80112233',secondaryColor:'00445566'}]);model.updateColors(source,new Set(['b3']));
  const mesh=meshes.find(m=>m.userData.ranges.has('b3')),slot=mesh.userData.ranges.get('b3')[0][0];
  assert.equal(mesh.geometry.getAttribute('aSecondary').getW(slot),0);assert.ok(Math.abs(mesh.geometry.getAttribute('aColor').getW(slot)-128/255)<1e-6);
  applyBlockColors(scene,undo.map(p=>p.before));assert.equal(source.blocks[3].secondaryColor,'00000000');assert.equal(source.blocks[3].color,'ffa0a0a0');
  model.setBlockTransforms(new Map([['b3',new THREE.Matrix4().makeTranslation(0,0,2)]]));model.setBlockTransforms(new Map());assert.equal(source.blocks[3].id,'b3');
 }finally{model.dispose()}
});
test('appearance transactions validate atomically and preserve missing secondaryColor',()=>{
 const scene={model:makeModel([makeBlock()])};assert.equal(scene.model.blocks[0].secondaryColor,undefined);
 assert.throws(()=>applyBlockColors(scene,[{id:'b0',color:'ff123456'},{id:'b0',secondaryColor:'oops'}]));assert.equal(scene.model.blocks[0].color,'ffa0a0a0');
 const patches=applyBlockColors(scene,[{id:'b0',secondaryColor:'00000000'}]);assert.equal(scene.model.blocks[0].secondaryColor,'00000000');applyBlockColors(scene,patches.map(p=>p.before));assert.equal(scene.model.blocks[0].secondaryColor,undefined);
});

test('surface preview state preserves selection and visibility in merged and instanced geometry',()=>{
 for(const instancing of [true,false]){
  const source=make(),model=buildTexturedModel(source,defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true,instancing});
  try{
   const meshes=model.group.children.filter(m=>m.userData.textured),geometries=meshes.map(m=>m.geometry);
   const state=id=>{const m=meshes.find(m=>m.userData.ranges.has(id));return m.geometry.getAttribute('aParams').getW(m.userData.ranges.get(id)[0][0]);};
   model.setSelection(new Set(['b3']));model.setPaintPreview(new Set(['b3','b4']));
   assert.equal(state('b3'),3);assert.equal(state('b4'),2);assert.equal(state('b5'),0);
   model.setHidden(new Set(['b3']));assert.equal(state('b3'),-1);model.setSelection(new Set(['b4']));assert.equal(state('b4'),3);
   model.setPaintPreview(new Set());assert.equal(state('b3'),-1);assert.equal(state('b4'),1);
   model.setHidden(new Set());assert.equal(state('b3'),0);
   assert.ok(meshes.every((m,i)=>m.geometry===geometries[i]));assert.ok(source.blocks.every(b=>b.color==='ffa0a0a0'&&b.secondaryColor==='00000000'));
  }finally{model.dispose();}
 }
});
