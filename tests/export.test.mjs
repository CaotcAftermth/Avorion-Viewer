import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock,makeModel,ORIENTATIONS} from '../src/block-model.js';
import {captureExport} from '../src/export/snapshot.js';
import {prepareExport} from '../src/export/pipeline.js';
import {encodeExport,makeGLTF} from '../src/export/formats.js';
import {indexTriangles,validateMesh,flatNormals} from '../src/export/mesh.js';
import {validateBytes} from 'gltf-validator';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {unzipSync,strFromU8} from 'fflate';

const block=(id='b0',x=0,extra={})=>makeBlock({id,position:{x,y:0,z:0},size:{x:2,y:2,z:2},...extra});
const snapshot=blocks=>({blocks,warnings:[],fileName:'fixture.xml',placement:'centered',scope:'all'});
const options={format:'glb',mode:'grouped',longest:100,budget:512,includeTransparent:true,cleanup:true};
const prepare=(blocks,overrides={})=>prepareExport(snapshot(blocks),{...options,...overrides});
const close=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-5,Math.abs(b)*1e-5),`${a} != ${b}`);

test('export thin filter matches viewport threshold across scopes without deleting blocks',async()=>{
 const blocks=[block('flat',0,{size:{x:0,y:2,z:2}}),block('thin',3,{size:{x:2,y:.00999,z:2}}),block('edge',6,{size:{x:2,y:2,z:.01}}),block('solid',9)];
 const scene={loaded:true,visible:true,model:makeModel(blocks),selectedIds:new Set(blocks.map(b=>b.id)),hiddenIds:new Set(),regions:[{id:'all',name:'All',ids:blocks.map(b=>b.id)}]};const before=JSON.stringify(blocks);
 for(const scope of ['all','visible','selected','region']){const snapshot=captureExport(scene,{showThinBlocks:true},{scope,regionId:'all',excludeThin:true});assert.deepEqual(snapshot.blocks.map(b=>b.id),['edge','solid']);assert.equal(snapshot.excludedThinBlocks,2);const r=await prepareExport(snapshot,options);assert.equal(r.summary['Excluded zero/thin blocks'],2);}
 const snapshot=captureExport(scene,{}, {excludeThin:true,excludedIds:['thin','solid']});assert.equal(snapshot.excludedThinBlocks,2);assert.equal(snapshot.excludedProblemBlocks,1);assert.deepEqual(snapshot.blocks.map(b=>b.id),['edge']);
 await assert.rejects(prepareExport(captureExport(scene,{}, {excludeThin:false}),options),e=>e.issueIds.includes('flat'));
 assert.equal(JSON.stringify(blocks),before);
});

test('all invalid input IDs can be explicitly excluded and valid remainder revalidated',async()=>{
 const blocks=[block('solid'),block('bad-size',3,{size:{x:-2,y:2,z:2}}),block('unknown',6,{typeIndex:99999}),block('bad-orientation',9,{look:1,up:0})];
 const scene={loaded:true,visible:true,model:makeModel(blocks),selectedIds:new Set(),hiddenIds:new Set()};let ids;
 await assert.rejects(prepareExport(captureExport(scene,{}),options),e=>{ids=e.issueIds;return ids.length===3;});
 const r=await prepareExport(captureExport(scene,{}, {excludedIds:ids}),options);assert.equal(r.summary.Blocks,1);assert.equal(r.summary['Excluded problem blocks'],3);assert.equal(r.downloadable,true);assert.equal(scene.model.blocks.length,4);
});

test('export snapshot scopes, placement, colors and metadata never mutate working model/XML',()=>{
 const attrs={color:'80102030',secondaryColor:'00000000'},b=block('b0',20,{color:'ffabcdef',secondaryColor:'80ff0000'});b.el={isConnected:true,getAttribute:k=>attrs[k]??null};
 const scene={loaded:true,visible:true,model:makeModel([b,block('b1',25)]),selectedIds:new Set(['b0']),hiddenIds:new Set(['b0']),regions:[{id:'r',name:'Bow',ids:['b0']}]};scene.model.placementOffset={x:10,y:0,z:0};
 assert.deepEqual(captureExport(scene,{}, {scope:'visible'}).blocks.map(b=>b.id),['b1']);
 for(const scope of ['selected','region']){const s=captureExport(scene,{}, {scope,regionId:'r',colors:'imported',placement:'native'});assert.equal(s.blocks.length,1);assert.equal(s.blocks[0].position.x,10);assert.equal(s.blocks[0].color,'80102030');assert.equal(s.blocks[0].secondaryColor,'00000000');assert.deepEqual(s.blocks[0].regions,['Bow']);s.blocks[0].position.x=99;}
 assert.equal(b.position.x,20);assert.equal(b.color,'ffabcdef');assert.deepEqual(attrs,{color:'80102030',secondaryColor:'00000000'});
 const s=captureExport(scene,{});assert.equal(s.blocks[0].secondaryColor,'80ff0000');assert.equal(s.blocks[1].secondaryColor,undefined);b.color='ff123456';assert.equal(s.blocks[0].color,'ffabcdef');
 scene.selectedIds.clear();assert.throws(()=>captureExport(scene,{}, {scope:'selected'}),/no blocks/);assert.throws(()=>captureExport(scene,{}, {scope:'region',regionId:'missing'}),/named region/);
});

test('single cube: closed output, exact scale, indexed geometry and metadata',async()=>{
 const r=await prepare([block('b0',0,{secondaryColor:'00000000'})]);assert.equal(r.summary.Triangles,12);assert.equal(r.summary.Vertices,8);assert.equal(r.summary['Watertight topology'],'Passed');assert.deepEqual(r.dimensions,[100,100,100]);close(r.reports[0].volume,1e6);assert.equal(r.metadata[0].secondaryColor,'00000000');
 const {doc}=makeGLTF(r);assert.equal(doc.accessors[0].count,24);assert.equal(doc.accessors[2].count,36);assert.equal(doc.meshes[0].primitives[0].indices,2);
});

test('solid unions: adjacent, overlapping, duplicate and disconnected cubes',async()=>{
 for(const [distance,volume,components]of [[2,16,1],[1,12,1],[0,8,1],[4,16,2]]){const r=await prepare([block(),block('b1',distance)],{mode:'shell'});assert.equal(r.downloadable,true);assert.equal(r.summary['Watertight topology'],'Passed');assert.equal(r.summary['Connected shells'],components);close(r.reports[0].volume,volume*r.factor**3);}
});

test('every shape and rotation survives visual and shell export with closed outward geometry',async()=>{
 const types=[2,100,101,102,103,108,109,112];
 for(const mode of ['grouped','shell'])for(const typeIndex of types)for(const {look,up}of ORIENTATIONS){const r=await prepare([block('b0',0,{typeIndex,look,up,size:{x:2,y:4,z:8}})],{mode});assert.equal(r.summary['Watertight topology'],'Passed',`${typeIndex}/${look}/${up}`);assert.ok(r.reports[0].volume>0);}
});

test('angled wedge intersection and through hangar use the shared surface geometry',async()=>{
 const wedge=await prepare([block(),block('wedge',1,{typeIndex:100,look:5,up:1})],{mode:'shell'});assert.equal(wedge.downloadable,true);assert.equal(wedge.summary['Watertight topology'],'Passed');
 const hangar=await prepare([block('hangar',0,{typeIndex:10})],{mode:'shell'});assert.equal(hangar.downloadable,true);assert.ok(hangar.reports[0].volume<1e6);assert.ok(hangar.summary.Triangles>12);
});

test('editable grouping separates translucent geometry; detailed blocks share meshes',async()=>{
 const blocks=[block(),block('b1',3),block('glass',6,{typeIndex:170}),block('hologram',9,{typeIndex:190,color:'80ff0000'})];
 const r=await prepare(blocks);assert.equal(r.objects.length,3);assert.equal(r.materials.filter(m=>m.alpha<1).length,2);assert.equal((await prepare(blocks,{includeTransparent:false})).summary.Blocks,2);
 const d=await prepare(blocks.slice(0,2),{mode:'detailed'});assert.equal(d.objects.length,2);assert.equal(d.geometries.length,1);const {doc}=makeGLTF(d);assert.equal(doc.meshes.length,1);assert.equal(doc.nodes.length,3);
});

test('validator catches open, invalid, degenerate, duplicate, winding and vertex-fan defects',async()=>{
 const {geometries:[cube]}=await prepare([block()]);
 const changed=indices=>validateMesh({...cube,indices:new Uint32Array(indices)});
 assert.equal(changed(cube.indices.slice(3)).boundaryEdges,3);
 assert.equal(changed([...cube.indices,0,0,0]).degenerateTriangles,1);
 assert.equal(changed([...cube.indices,...cube.indices.slice(0,3)]).duplicateFaces,1);
 assert.ok(changed([999999,...cube.indices.slice(1)]).invalidTriangles>0);
 const flipped=[...cube.indices];[flipped[0],flipped[1]]=[flipped[1],flipped[0]];assert.equal(changed(flipped).winding,'Failed');
 const touching=await prepare([block(),block('touch',2,{position:{x:2,y:2,z:2}})]);assert.equal(touching.reports[0].nonManifoldVertices,0);assert.equal(touching.downloadable,true);const welded=indexTriangles(flatNormals(touching.geometries[0]).positions);assert.equal(validateMesh(welded).nonManifoldVertices,1);
 assert.equal(validateMesh(cube,{maxTriangles:1}).status,'Not checked');
 const clean=indexTriangles([0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0],{cleanup:true});assert.equal(clean.removedDuplicate,1);assert.equal(clean.removedDegenerate,1);
});

test('3MF grouping keeps closed block shells without welding their contacts',async()=>{
 const blocks=[block(),block('b1',2)];const grouped=await prepare(blocks,{format:'3mf'});assert.equal(grouped.downloadable,true);assert.equal(grouped.summary['Connected shells'],2);assert.equal(grouped.summary['Non-manifold edges'],0);assert.ok(encodeExport(grouped).bytes.length);
 const shell=await prepare(blocks,{format:'3mf',mode:'shell'});assert.equal(shell.downloadable,true);assert.equal(shell.summary['Connected shells'],1);
 const hangar=await prepare([block('hangar',0,{typeIndex:10})],{format:'3mf',cleanup:false});assert.equal(hangar.downloadable,true);assert.ok(encodeExport(hangar).bytes.length);
});

test('GLB and packaged glTF pass independent Khronos validation without warnings',async()=>{
 const blocks=[block(),block('glass',3,{typeIndex:170})];
 for(const format of ['glb','gltf']){const r=await prepare(blocks,{format,mode:'detailed'}),file=encodeExport(r);let report;
  if(format==='glb')report=await validateBytes(file.bytes);else{const zip=unzipSync(file.bytes);report=await validateBytes(zip['model.gltf'],{externalResourceFunction:uri=>Promise.resolve(zip[uri])});}
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
 }
});

test('STL and OBJ parse with independent Three loaders; axes, size and normals survive',async()=>{
 const blocks=[block('b0',0,{size:{x:2,y:4,z:8}})];
 const stl=encodeExport(await prepare(blocks,{format:'stl',mode:'shell'}));const g=new STLLoader().parse(stl.bytes.buffer);g.computeBoundingBox();const size=g.boundingBox.getSize({subVectors(a,b){return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}});close(size.x,25);close(size.y,100);close(size.z,50);assert.equal(g.attributes.position.count,36);
 const zip=unzipSync(encodeExport(await prepare(blocks,{format:'obj'})).bytes),obj=new OBJLoader().parse(strFromU8(zip['model.obj']));assert.equal(obj.children.length,1);assert.equal(obj.children[0].geometry.attributes.normal.count,36);assert.match(strFromU8(zip['model.mtl']),/newmtl material_0/);assert.equal(JSON.parse(strFromU8(zip['metadata.json'])).blocks[0].id,'b0');
});

test('bad inputs and excessive working-memory estimates fail before export',async()=>{
 await assert.rejects(prepare([block('bad',0,{typeIndex:99999})]),/Unknown block/);
 await assert.rejects(prepare([block('bad',0,{size:{x:0,y:1,z:1}})]),/Invalid bounds/);
 await assert.rejects(prepare([block('bad',0,{look:1,up:0})]),/Invalid orientation/);
 await assert.rejects(prepare([{...block(),color:'bad'}]),/ARGB/);
 await assert.rejects(prepare([block()],{longest:NaN}),/Invalid export size/);
 await assert.rejects(prepare(Array(500000).fill(block()),{mode:'shell'}),/memory/);
});


test('optional solid tolerance is explicit, bounded, and followed by output validation',async()=>{
 const r=await prepare([block(),block('b1',1)],{mode:'shell',tolerance:.0001});assert.equal(r.downloadable,true);assert.equal(r.summary['Watertight topology'],'Passed');assert.ok(r.warnings.some(w=>w.includes('0.0001 mm')));
 await assert.rejects(prepare([block()],{mode:'shell',tolerance:2}),/tolerance/);
 const touching=await prepare([block(),block('touch',2,{position:{x:2,y:2,z:2}})],{mode:'shell'});assert.equal(touching.reports[0].nonManifoldVertices,0);assert.equal(touching.summary['Connected shells'],2);
});


test('Visual STL preserves original block surfaces; printable shell unions them',async()=>{
 const blocks=[block(),block('adjacent',2)],before=JSON.stringify(blocks);
 const visual=await prepare(blocks,{format:'stl',mode:'grouped'});
 assert.equal(visual.summary.Triangles,24);assert.equal(visual.summary['Solid processing'],'Not requested');assert.equal(visual.downloadable,true);assert.equal(visual.summary['Mesh validation'],'Passed');
 const geometry=new STLLoader().parse(encodeExport(visual).bytes.buffer);assert.equal(geometry.attributes.position.count,72);
 assert.ok(visual.warnings.some(w=>w.includes('Visual STL:')));
 const shell=await prepare(blocks,{format:'stl',mode:'shell'});assert.equal(shell.summary['Mesh validation'],'Passed');assert.ok(shell.summary.Triangles<24);assert.equal(JSON.stringify(blocks),before);
});

test('sealed cavity filling is explicit and leaves outside openings intact',async()=>{
 const blocks=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)blocks.push(block(`${x},${y},${z}`,x*2,{position:{x:x*2,y:y*2,z:z*2}}));
 const hollow=await prepare(blocks,{mode:'shell'}),filled=await prepare(blocks,{mode:'shell',fillCavities:true});
 assert.equal(hollow.downloadable,true);assert.equal(filled.downloadable,true);close(hollow.reports[0].volume,26*8*hollow.factor**3);close(filled.reports[0].volume,27*8*filled.factor**3);
 const open=await prepare(blocks.filter(b=>b.id!=='0,0,-1'),{mode:'shell',fillCavities:true});close(open.reports[0].volume,25*8*open.factor**3);
});

test('native unit scale keeps one Avorion unit per metre regardless of longest dimension',async()=>{
 const blocks=[makeBlock({id:'a',size:{x:2,y:4,z:8}})];
 const fitted=await prepare(blocks,{longest:100});
 const native=await prepare(blocks,{longest:100,unitScale:1000});
 assert.equal(fitted.factor,12.5);assert.equal(native.factor,1000);
 // Dimensions are reported in mm; GLB writes them as metres (×0.001), so 8 units → 8 m.
 assert.deepEqual(native.dimensions.map(v=>Math.round(v)).sort((a,b)=>a-b),[2000,4000,8000]);
});
