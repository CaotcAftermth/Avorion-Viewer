import * as THREE from '../../../vendor/three.module.js';
export function textureScaleTable(arrays){
 const width=Math.max(1,...arrays.map(a=>a.texture?.userData?.scales?.length/4||a.texture?.image?.depth||1));const data=new Float32Array(width*3*4);
 for(let row=0;row<3;row++)for(let layer=0;layer<width;layer++){
  const scale=arrays[row].texture?.userData?.scales;
  data.set(scale&&layer*4<scale.length?scale.subarray(layer*4,layer*4+4):[1,1,0,0],(row*width+layer)*4);
 }
 const texture=new THREE.DataTexture(data,width,3,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;return texture;
}
