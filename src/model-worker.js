import {buildTexturedModel} from './avorion/lib/geometry/texturedModel.js';
import {textureLibrary} from './avorion/lib/textures/textureLibrary.js';
import {defaultOrientationProfile} from './avorion/lib/avorion/orientation.js';
import {makeBlock,makeModel} from './block-model.js';

globalThis.document={createElement:()=>new OffscreenCanvas(1,1)};
self.onmessage=({data})=>{
  try{
    const {records,ids,names,params,fileName}=data,present=new Set(names);
    // Texture pixels remain on the main thread. Only layer numbering is needed
    // while preparing geometry; sorting matches TextureLibrary.getArray.
    textureLibrary.getArray=(kind,requested,generated)=>({texture:null,release(){},layerOf:new Map([...new Set(requested)].filter(n=>present.has(n)||generated?.has(n)).sort().map((n,i)=>[n,i+1]))});
    const blocks=ids.map((id,i)=>{const j=i*13;return makeBlock({id,position:{x:records[j],y:records[j+1],z:records[j+2]},size:{x:records[j+3],y:records[j+4],z:records[j+5]},typeIndex:records[j+6],materialIndex:records[j+7],look:records[j+8],up:records[j+9],color:records[j+10].toString(16).padStart(8,'0'),secondaryColor:records[j+12]?records[j+11].toString(16).padStart(8,'0'):undefined});});
    const model=buildTexturedModel(makeModel(blocks,fileName),defaultOrientationProfile(),params),buffers=[];
    const batches=model.group.children.filter(m=>m.userData.textured).map(mesh=>{
      const g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();const attributes={};
      for(const [name,a] of Object.entries(g.attributes)){attributes[name]={array:a.array,size:a.itemSize,instanced:!!a.isInstancedBufferAttribute};buffers.push(a.array.buffer);}
      if(g.index)buffers.push(g.index.array.buffer);
      return {attributes,index:g.index?.array,count:g.instanceCount,instanced:mesh.userData.instanced,isT:mesh.material.transparent,doubleSided:!mesh.material.userData.hardwareCull,ranges:[...mesh.userData.ranges],min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray(),pickTree:mesh.userData.pickTree};
    });
    self.postMessage({batches},[...new Set(buffers)]);model.dispose();
  }catch(error){self.postMessage({error:error.message});}
};
