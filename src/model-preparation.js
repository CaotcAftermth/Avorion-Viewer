import {secondaryColor} from './block-colors.js';
import {textureLibrary} from './avorion/lib/textures/textureLibrary.js';

export function prepareLargeModel(model,blocks,params){
  const worker=new Worker(new URL('./model-worker.js',import.meta.url),{type:'module'});
  const records=new Float64Array(blocks.length*13),ids=[];
  blocks.forEach((b,i)=>{const secondary=secondaryColor(b);ids.push(b.id);records.set([b.position.x,b.position.y,b.position.z,b.size.x,b.size.y,b.size.z,b.typeIndex,b.materialIndex,b.look,b.up,parseInt(b.color,16),secondary===undefined?0:parseInt(secondary,16),secondary===undefined?0:1],i*13);});
  const promise=new Promise((resolve,reject)=>{
    worker.onmessage=({data})=>{worker.terminate();data.error?reject(new Error(data.error)):resolve(data.batches);};
    worker.onerror=event=>{worker.terminate();reject(new Error(event.message));};
    worker.postMessage({records,ids,names:[...textureLibrary.images.keys()],fileName:model.fileName,params:{...params,shipName:params.shipName||model.doc?.documentElement.getAttribute('name')}},[records.buffer]);
  });
  return {promise,cancel:()=>worker.terminate()};
}
