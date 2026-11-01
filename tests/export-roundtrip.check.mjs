import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
 const file=process.argv.includes('--tachi')?'Tachi.xml':'Ship Stress Test.xml',xml=await readFile('C:/Users/joshu/AppData/Roaming/Avorion/ships/'+file,'utf8');
 const mode=process.argv.includes('--grouped')?'grouped':'shell';
 const formats=process.argv.includes('--tachi')||mode==='grouped'?['3mf','glb']:['stl','3mf','glb','gltf','obj'];
 for(const format of formats){
  const result=await page.evaluate(async({xml,file,format,mode})=>{
   const {parseAvorionXml}=await import('/src/block-model.js'),{captureExport}=await import('/src/export/snapshot.js'),{triangleNormal,validateMesh}=await import('/src/export/mesh.js'),{unzipSync,strFromU8}=await import('/src/vendor/fflate.js');
   const model=parseAvorionXml(xml,file,xml.length),before=new XMLSerializer().serializeToString(model.doc),snapshot=captureExport({loaded:true,visible:true,model,selectedIds:new Set(),hiddenIds:new Set(),regions:[]},{},{excludeThin:true});
   const start=performance.now();let ticks=0;const heartbeat=setInterval(()=>ticks++,25);
   const {ready,file:encoded}=await new Promise((resolve,reject)=>{const w=new Worker('/src/export/worker.js',{type:'module'});let ready;w.onerror=e=>{w.terminate();reject(Error(e.message));};w.onmessage=({data})=>{if(data.type==='error'){w.terminate();reject(Error(data.message));}if(data.type==='ready'){ready=data.result;if(!ready.downloadable){w.terminate();reject(Error(JSON.stringify(ready.summary)));}w.postMessage({type:'download'});}if(data.type==='file'){w.terminate();resolve({ready,file:data});}};w.postMessage({type:'prepare',snapshot,options:{format,mode,longest:100,budget:1024,cleanup:true,includeTransparent:true,tolerance:0}});});clearInterval(heartbeat);
   const bytes=encoded.bytes,meshes=[];
   if(format==='stl'){const view=new DataView(bytes.buffer),count=view.getUint32(80,true),positions=new Float32Array(count*9),indices=Uint32Array.from({length:count*3},(_,i)=>i);if(bytes.length!==84+count*50)throw Error('Wrong STL length');for(let f=0;f<count;f++)for(let k=0;k<9;k++)positions[f*9+k]=view.getFloat32(84+f*50+12+k*4,true);meshes.push({positions,indices});}
   else if(format==='3mf'){
    const text=strFromU8(unzipSync(bytes)['3D/3dmodel.model']);for(const object of text.matchAll(/<object\b[\s\S]*?<\/object>/g)){const positions=[],indices=[];for(const m of object[0].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g))positions.push(+m[1],+m[2],+m[3]);for(const m of object[0].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g))indices.push(+m[1],+m[2],+m[3]);const mesh={positions:new Float64Array(positions),indices:new Uint32Array(indices)},report=validateMesh(mesh);if(report.status!=='Passed')throw Error('Serialized 3MF topology failed');meshes.push(mesh);}
   }else if(format==='glb'||format==='gltf'){
    let doc,bin;if(format==='glb'){const view=new DataView(bytes.buffer),size=view.getUint32(12,true);doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+size)));bin=bytes.subarray(28+size);}else{const zip=unzipSync(bytes);doc=JSON.parse(strFromU8(zip['model.gltf']));bin=zip['model.bin'];}
    const attr=(id,T,size)=>{const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],start=bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);return new T(bin.buffer.slice(start,start+a.count*size*4));};
    for(const mesh of doc.meshes)for(const primitive of mesh.primitives)meshes.push({positions:attr(primitive.attributes.POSITION,Float32Array,3),indices:attr(primitive.indices,Uint32Array,1)});
   }else{
    const text=strFromU8(unzipSync(bytes)['model.obj']),positions=[],indices=[];for(const line of text.split('\n')){if(line.startsWith('v '))positions.push(...line.slice(2).split(' ').map(Number));if(line.startsWith('f '))indices.push(...line.slice(2).split(' ').map(v=>Number(v.split('/')[0])-1));}meshes.push({positions:new Float64Array(positions),indices:new Uint32Array(indices)});
   }
   let triangles=0;for(const mesh of meshes){if(!mesh.positions.every(Number.isFinite))throw Error('Non-finite vertex');triangles+=mesh.indices.length/3;for(let i=0;i<mesh.indices.length;i+=3){const ids=mesh.indices.subarray(i,i+3);if([...ids].some(v=>v*3>=mesh.positions.length)||triangleNormal(mesh.positions,...ids).every(v=>v===0))throw Error('Serialized file contains collapsed/invalid triangle');}}
   if(triangles!==ready.summary.Triangles)throw Error('Triangle count changed in serialization');return {format,file,bytes:bytes.length,triangles,summary:ready.summary,warnings:ready.warnings,milliseconds:performance.now()-start,ticks,xmlUnchanged:before===new XMLSerializer().serializeToString(model.doc)};
  },{xml,file,format,mode});assert.equal(result.summary['Mesh validation'],'Passed');assert.equal(result.xmlUnchanged,true);assert.ok(result.ticks>0);results.push(result);console.log(JSON.stringify({file,format,triangles:result.triangles,bytes:result.bytes,milliseconds:result.milliseconds,passed:true}));
 }
 assert.deepEqual(errors,[]);await writeFile('test-results/export-validated-'+(file.startsWith('Tachi')?'tachi':'stress')+'-'+mode+'.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
