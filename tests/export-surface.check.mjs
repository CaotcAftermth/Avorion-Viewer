// Reproduce a saved export using its immutable metadata, then inspect actual
// serialized coordinates with export-surface.check.py in Blender.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareExport} from '../src/export/pipeline.js';
import {encodeExport} from '../src/export/formats.js';
import {blockSurfaceGeometry} from '../src/avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {unzipSync,strFromU8} from 'fflate';
import {triangleNormal,validateMesh} from '../src/export/mesh.js';
import {validateBytes} from 'gltf-validator';

const metadataFile=process.argv[2]||'C:/Users/joshu/Downloads/TachiExportTest/Tachi-obj/metadata.json';
const saved=readFileSync(metadataFile,'utf8'),metadata=JSON.parse(saved),snapshot={...metadata.source,blocks:metadata.blocks};
const snapshotBefore=JSON.stringify(snapshot);
const directory='test-results/tachi-corrected';mkdirSync(directory,{recursive:true});
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(const b of snapshot.blocks)for(const [i,a]of ['x','y','z'].entries()){min[i]=Math.min(min[i],b.position[a]-b.size[a]/2);max[i]=Math.max(max[i],b.position[a]+b.size[a]/2);}
const center=snapshot.placement==='centered'?min.map((v,i)=>(v+max[i])/2):[0,0,0],factor=metadata.options.longest/Math.max(...max.map((v,i)=>v-min[i]));
const reference=[];for(const b of snapshot.blocks){const geometry=blockSurfaceGeometry(b,defaultOrientationProfile());for(let i=0;i<geometry.positions.length;i++)reference.push((geometry.positions[i]-center[i%3])*factor);}
writeFileSync(directory+'/reference.json',JSON.stringify({positions:reference}));
const results=[];
for(const format of ['stl','3mf','obj','glb','gltf']){
 const start=performance.now(),result=await prepareExport(snapshot,{...metadata.options,format});
 assert.equal(result.downloadable,true,JSON.stringify(result.summary));assert.equal(result.summary['Mesh validation'],'Passed');
 const file=encodeExport(result);writeFileSync(directory+'/'+file.name,file.bytes);
 let positions=[],indices=[];
 if(format==='stl'){
  const view=new DataView(file.bytes.buffer,file.bytes.byteOffset,file.bytes.byteLength),count=view.getUint32(80,true);assert.equal(file.bytes.length,84+count*50);
  for(let f=0;f<count;f++)for(let k=0;k<3;k++){const o=84+f*50+12+k*12;positions.push(view.getFloat32(o,true),view.getFloat32(o+8,true),-view.getFloat32(o+4,true));indices.push(indices.length);}
 }else if(format==='3mf'){
  const xml=strFromU8(unzipSync(file.bytes)['3D/3dmodel.model']);
  for(const m of xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g))positions.push(+m[1],+m[3],-m[2]);
  for(const m of xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g))indices.push(+m[1],+m[2],+m[3]);
  assert.equal(validateMesh({positions,indices}).status,'Passed');
 }else if(format==='obj'){
  const zip=unzipSync(file.bytes);mkdirSync(directory+'/obj',{recursive:true});for(const [name,bytes]of Object.entries(zip))writeFileSync(directory+'/obj/'+name,bytes);
  for(const line of strFromU8(zip['model.obj']).split('\n')){if(line.startsWith('v '))positions.push(...line.slice(2).split(' ').map(Number));if(line.startsWith('f '))indices.push(...line.slice(2).split(' ').map(v=>Number(v.split('/')[0])-1));}
 }else{
  let doc,bin;if(format==='glb'){
   const report=await validateBytes(file.bytes,{maxIssues:20});assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
   const view=new DataView(file.bytes.buffer,file.bytes.byteOffset,file.bytes.byteLength),size=view.getUint32(12,true);doc=JSON.parse(new TextDecoder().decode(file.bytes.subarray(20,20+size)));bin=file.bytes.subarray(28+size);
  }else{const zip=unzipSync(file.bytes);mkdirSync(directory+'/gltf',{recursive:true});for(const [name,bytes]of Object.entries(zip))writeFileSync(directory+'/gltf/'+name,bytes);doc=JSON.parse(strFromU8(zip['model.gltf']));bin=zip['model.bin'];}
  const attr=(id,T,width)=>{const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],start=bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);return new T(bin.buffer.slice(start,start+a.count*width*4));};
  assert.equal(doc.meshes.length,1);const primitive=doc.meshes[0].primitives[0];positions=Array.from(attr(primitive.attributes.POSITION,Float32Array,3),v=>v*1000);indices=Array.from(attr(primitive.indices,Uint32Array,1));
 }
 assert.equal(indices.length/3,result.summary.Triangles);assert.ok(positions.every(Number.isFinite));
 for(let i=0;i<indices.length;i+=3)assert.ok(triangleNormal(positions,...indices.slice(i,i+3)).some(v=>v!==0),'Serialized degenerate triangle');
 writeFileSync(directory+'/'+format+'.json',JSON.stringify({positions,indices}));
 results.push({format,milliseconds:performance.now()-start,summary:result.summary,warnings:result.warnings});console.log(format,result.summary.Triangles,'triangles; validated');
}
assert.equal(readFileSync(metadataFile,'utf8'),saved);assert.equal(JSON.stringify(snapshot),snapshotBefore);
writeFileSync(directory+'/results.json',JSON.stringify(results,null,2));
