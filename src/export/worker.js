import {prepareExport} from './pipeline.js';
import {encodeExport} from './formats.js';
let prepared;
self.onmessage=async({data})=>{try{
 if(data.type==='prepare'){
  prepared=await prepareExport(data.snapshot,data.options,(percent,message)=>self.postMessage({type:'progress',percent,message}));
  const previewTriangles=prepared.summary.Triangles,preview=previewTriangles<=500000&&prepared.objects.length<=2000?{geometries:prepared.geometries,objects:prepared.objects,materials:prepared.materials,reports:prepared.reports}:null;
  if(!preview)prepared.warnings.push('Processed preview exceeds 500,000 triangles or 2,000 objects. Preview omitted to avoid duplicating export memory; the exported mesh is unchanged.');
  self.postMessage({type:'ready',result:{summary:prepared.summary,warnings:prepared.warnings,issueIds:prepared.issueIds,downloadable:prepared.downloadable,preview}});
 }else if(data.type==='download'){if(!prepared?.downloadable)throw Error('Prepare and validate the export first.');const file=encodeExport(prepared);self.postMessage({type:'file',...file},[file.bytes.buffer]);}
}catch(e){self.postMessage({type:'error',message:e.message||String(e),issueIds:e.issueIds||[],issues:e.issues||[]});}};
