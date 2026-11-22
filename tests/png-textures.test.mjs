import test from 'node:test';
import assert from 'node:assert/strict';
import {zlibSync} from '../src/vendor/fflate.js';
import {decodeTexturePng,resizeTextureRgba} from '../src/avorion/lib/textures/pngTexture.js';
function fixture(width,height,pixels,filter=0,channels=4){
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 const stride=width*channels,scan=new Uint8Array((stride+1)*height);
 for(let y=0;y<height;y++){
  const row=y*stride;scan[y*(stride+1)]=filter;
  for(let x=0;x<stride;x++){const a=x>=channels?pixels[row+x-channels]:0,b=y?pixels[row+x-stride]:0,c=y&&x>=channels?pixels[row+x-stride-channels]:0;const predict=filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0;scan[y*(stride+1)+1+x]=(pixels[row+x]-predict)&255;}
 }
 const chunk=(name,data)=>{const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);view.setUint32(0,data.length);out.set([...name].map(c=>c.charCodeAt(0)),4);out.set(data,8);let crc=0xffffffff;for(const b of out.subarray(4,-4)){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}view.setUint32(out.length-4,(crc^0xffffffff)>>>0);return out;};
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,width);view.setUint32(4,height);header[8]=8;header[9]=channels===4?6:2;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(scan)),chunk('IEND',new Uint8Array())];
 const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;
}
const pixels=new Uint8Array([77,76,70,0, 122,84,55,1, 21,33,45,128, 255,240,230,255, 67,67,62,0, 201,33,90,13]);
for(let filter=0;filter<=4;filter++)test('PNG filter '+filter+' preserves RGB under zero and low alpha',()=>{
 const result=decodeTexturePng(fixture(3,2,pixels,filter));assert.equal(result.width,3);assert.equal(result.height,2);assert.deepEqual(result.data,pixels);
});
test('RGB PNG textures expand to opaque RGBA',()=>{
 assert.deepEqual([...decodeTexturePng(fixture(2,1,new Uint8Array([20,40,60,80,100,120]),4,3)).data],[20,40,60,255,80,100,120,255]);
});
test('resizing averages independent channels instead of premultiplying shader data',()=>{
 const image={width:2,height:2,data:new Uint8Array([80,40,20,0,120,80,60,0,160,120,100,0,200,160,140,0])};
 assert.deepEqual([...resizeTextureRgba(image,1).data],[140,100,80,0]);
 assert.deepEqual([...resizeTextureRgba({width:1,height:1,data:new Uint8Array([77,76,70,0])},2).data],Array(4).fill([77,76,70,0]).flat());
 assert.equal(resizeTextureRgba(image,2),image);
});
test('non-PNG images stay on the browser decode path',()=>assert.equal(decodeTexturePng(new Uint8Array(40)),undefined));

import {TextureLibrary} from '../src/avorion/lib/textures/textureLibrary.js';
test('texture imports retain independent RGB and alpha through decode and resize',async()=>{
 const bytes=fixture(2,2,new Uint8Array([80,40,20,0,120,80,60,0,160,120,100,0,200,160,140,0]),4);
 const result=await new TextureLibrary().decode(new Blob([bytes],{type:'image/png'}),1);
 assert.deepEqual([...result.data],[140,100,80,0]);
});

import {createTexturePngDecoder} from '../src/avorion/lib/textures/texturePngDecoder.js';
test('integer reductions retain exact straight-channel averages',()=>{
 const source={width:4,height:4,data:Uint8Array.from({length:64},(_,i)=>(i*17+5)%256)};
 for(const size of [1,2]){
  const expected=new Uint8ClampedArray(size*size*4),step=4/size;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(let c=0;c<4;c++){
   let sum=0;for(let sy=y*step;sy<(y+1)*step;sy++)for(let sx=x*step;sx<(x+1)*step;sx++)sum+=source.data[(sy*4+sx)*4+c];
   expected[(y*size+x)*4+c]=sum/(step*step);
  }
  assert.deepEqual(resizeTextureRgba(source,size).data,expected);
 }
});
test('PNG decoder reuses a worker, transfers input, and matches concurrent replies by ID',async()=>{
 let workers=0;const detached=[];
 const decode=createTexturePngDecoder(()=>{
  workers++;return {postMessage(message,transfer){
   const copy=structuredClone(message,{transfer});detached.push(message.buffer.byteLength===0);
   setTimeout(()=>this.onmessage({data:{id:copy.id,image:resizeTextureRgba(decodeTexturePng(new Uint8Array(copy.buffer)),copy.size)}}),copy.size===1?5:0);
  },terminate(){}};
 });
 const blob=new Blob([fixture(3,2,pixels,4)],{type:'image/png'});
 const results=await Promise.all([decode(blob,1),decode(blob,2)]);
 assert.equal(workers,1);assert.deepEqual(detached,[true,true]);
 results.forEach((result,i)=>assert.deepEqual(result,resizeTextureRgba(decodeTexturePng(fixture(3,2,pixels,4)),i+1)));
});
test('worker transport failure falls back without losing pixels or retrying a broken worker',async()=>{
 let workers=0,terminated=0;
 const decode=createTexturePngDecoder(()=>{
  workers++;return {postMessage(message,transfer){structuredClone(message,{transfer});queueMicrotask(()=>this.onerror({message:'Unavailable',preventDefault(){}}));},terminate(){terminated++;}};
 });
 const blob=new Blob([fixture(3,2,pixels,4)]),expected=resizeTextureRgba(decodeTexturePng(fixture(3,2,pixels,4)),1);
 expected.sourceWidth=3;expected.sourceHeight=2;
 const first=await decode(blob,1),second=await decode(blob,1);
 assert.deepEqual(first,expected);assert.deepEqual(second,expected);assert.equal(workers,1);assert.equal(terminated,1);
});
test('non-PNG files bypass the PNG worker',async()=>{
 const decode=createTexturePngDecoder(()=>{throw Error('Unexpected worker creation');});
 assert.equal(await decode(new Blob(['not a png']),512),undefined);
});

import {decodeTexturePngNative} from '../src/avorion/lib/textures/pngTexture.js';
for(let filter=0;filter<=4;filter++)test('native inflate preserves all PNG channels with filter '+filter,async()=>{
 const result=await decodeTexturePngNative(fixture(3,2,pixels,filter));assert.deepEqual(result.data,pixels);
});
test('native inflate expands RGB textures identically to the synchronous decoder',async()=>{
 const bytes=fixture(2,1,new Uint8Array([20,40,60,80,100,120]),4,3);
 assert.deepEqual(await decodeTexturePngNative(bytes),decodeTexturePng(bytes));
});

import {textureCacheKey} from '../src/avorion/lib/textures/texturePixelCache.js';
test('pixel-cache keys invalidate on source data and resolution changes',async()=>{
 const a=new Uint8Array([1,2,3]).buffer,b=new Uint8Array([1,2,4]).buffer;
 assert.equal(await textureCacheKey(a,512),await textureCacheKey(a,512));
 assert.notEqual(await textureCacheKey(a,512),await textureCacheKey(a,1024));
 assert.notEqual(await textureCacheKey(a,512),await textureCacheKey(b,512));
});
