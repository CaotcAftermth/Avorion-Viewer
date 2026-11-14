import {diagnosticStart,diagnosticClock,diagnosticPhase,diagnosticAllocation,diagnosticEnd} from './performance-diagnostics.js';
import {secondaryColor} from './block-colors.js';
import {textureLibrary} from './avorion/lib/textures/textureLibrary.js';

export function prepareLargeModel(model,blocks,params){
  const operation=diagnosticStart('geometry worker','hull',blocks.length),packing=diagnosticClock();
  const records=new Float64Array(blocks.length*13),ids=[];
  blocks.forEach((b,i)=>{const secondary=secondaryColor(b);ids.push(b.id);records.set([b.position.x,b.position.y,b.position.z,b.size.x,b.size.y,b.size.z,b.typeIndex,b.materialIndex,b.look,b.up,parseInt(b.color,16),secondary===undefined?0:parseInt(secondary,16),secondary===undefined?0:1],i*13);});
  const worker=new Worker(new URL('./model-worker.js',import.meta.url),{type:'module'});
  const inputBytes=records.byteLength;
  diagnosticPhase('geometry worker input packed',operation,packing,{transferredBytes:inputBytes,clonedIds:ids.length});
  const release=operation&&diagnosticAllocation('geometryWorkerPayload',inputBytes,'geometry worker input',operation);
  const dispatched=diagnosticClock();
  const promise=new Promise((resolve,reject)=>{
    worker.onmessage=({data})=>{
      worker.terminate();release?.();
      if(operation&&data.diagnostics)diagnosticPhase('geometry worker response',operation,dispatched,data.diagnostics);
      if(data.error)diagnosticEnd(operation,'failed');else diagnosticEnd(operation);
      data.error?reject(Object.assign(new Error(data.error),{code:data.code,name:data.name||'Error'})):resolve(data.batches);
    };
    const fail=error=>{worker.terminate();release?.();diagnosticEnd(operation,'failed');reject(error);};
    worker.onerror=event=>fail(Object.assign(new Error(event.message||'Geometry worker failed.'),{code:'worker-transport'}));
    worker.onmessageerror=()=>fail(Object.assign(new Error('Geometry worker response could not be decoded.'),{code:'worker-transport'}));
    try{worker.postMessage({records,ids,diagnostics:!!operation,names:[...textureLibrary.images.keys()],fileName:model.fileName,params:{...params,shipName:params.shipName||model.doc?.documentElement.getAttribute('name')}},[records.buffer]);}
    catch(error){fail(error);}
  });
  return {promise,cancel:()=>{worker.terminate();release?.();diagnosticEnd(operation,'cancelled');}};
}
