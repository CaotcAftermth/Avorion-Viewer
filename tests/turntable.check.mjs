import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.VIEWER_TEST_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/tests/image-export.html');
 const result=await page.evaluate(async()=>{
  const {GifEncoder}=await import('/src/export/gif-encoder.js');
  const clearEncoder=new GifEncoder(4,1,null,true);
  clearEncoder.addFrame(Uint8ClampedArray.from([255,255,255,255,0,0,0,0,255,0,0,127,0,255,0,128]),20);
  clearEncoder.addFrame(Uint8ClampedArray.from([0,0,0,0,255,255,255,255,0,0,0,0,0,0,0,0]),20);
  const clearDecoder=new ImageDecoder({data:await clearEncoder.finish().arrayBuffer(),type:'image/gif'});await clearDecoder.tracks.ready;
  const disposalAlpha=[];
  for(let i=0;i<2;i++){const f=await clearDecoder.decode({frameIndex:i}),cv=document.createElement('canvas');cv.width=4;cv.height=1;cv.getContext('2d').drawImage(f.image,0,0);disposalAlpha.push(Array.from(cv.getContext('2d').getImageData(0,0,4,1).data).filter((_,j)=>j%4===3));f.image.close();}clearDecoder.close();
  const flat=new Uint8ClampedArray(64*64*4);for(let i=0;i<flat.length;i+=4)flat.set([50,50,50,255],i);
  const flatEncoder=new GifEncoder(64,64,null,true);flatEncoder.addFrame(flat,20);
  const flatDecoder=new ImageDecoder({data:await flatEncoder.finish().arrayBuffer(),type:'image/gif'});await flatDecoder.tracks.ready;
  const flatFrame=await flatDecoder.decode({frameIndex:0}),flatCanvas=document.createElement('canvas');flatCanvas.width=flatCanvas.height=64;flatCanvas.getContext('2d').drawImage(flatFrame.image,0,0);
  const flatPixels=flatCanvas.getContext('2d').getImageData(0,0,64,64).data,flatColors=new Set();for(let i=0;i<flatPixels.length;i+=4)flatColors.add(Array.from(flatPixels.slice(i,i+4)).join(','));flatFrame.image.close();flatDecoder.close();
  const noise=new Uint8ClampedArray(257*129*4);let seed=123;
  for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=i%4===3?255:seed>>>24;}
  const encoder=new GifEncoder(257,129);encoder.addFrame(noise,7);encoder.addFrame(noise,6);
  const decoder=new ImageDecoder({data:await encoder.finish().arrayBuffer(),type:'image/gif'});await decoder.tracks.ready;
  const decoded=await decoder.decode({frameIndex:1}),c=document.createElement('canvas');c.width=257;c.height=129;c.getContext('2d').drawImage(decoded.image,0,0);
  const pixels=c.getContext('2d').getImageData(0,0,257,129).data;let delta=0;for(let i=0;i<pixels.length;i++)delta+=Math.abs(pixels[i]-noise[i]);decoded.image.close();decoder.close();
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{area}=await import('/src/layout.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const {captureImage,imageDefaults}=await import('/src/export/image-options.js'),{exportTurntable}=await import('/src/export/turntable.js');
  const scene={loaded:true,visible:true,model:makeModel([makeBlock({size:{x:3,y:1,z:2},color:'ff80a0ff'})],'Turntable fixture.xml'),revision:1,selectedIds:new Set(),hiddenIds:new Set()},view=area().view;
  const before=JSON.stringify(view),snap=captureImage(scene,view,FACTORY_PREFERENCES,{width:160,height:120});
  const options={...imageDefaults(view,160,120),type:'turntable',format:'gif',background:'solid',duration:1,fps:5,direction:'clockwise',camera:'isometric',overlays:false,gizmos:false,labels:false,grid:false};
  const output=await exportTurntable(snap,options);const gif=new ImageDecoder({data:await output.blob.arrayBuffer(),type:'image/gif'});await gif.tracks.ready;
  let duration=0;const signatures=[],backgrounds=[];
  for(let i=0;i<5;i++){const frame=await gif.decode({frameIndex:i});duration+=frame.image.duration;const cv=document.createElement('canvas');cv.width=160;cv.height=120;cv.getContext('2d').drawImage(frame.image,0,0);signatures.push(cv.toDataURL());const corner=cv.getContext('2d').getImageData(0,0,8,8).data;const colors=new Set();for(let j=0;j<corner.length;j+=4)colors.add(Array.from(corner.slice(j,j+4)).join(','));backgrounds.push([...colors]);frame.image.close();}
  const count=gif.tracks.selectedTrack.frameCount,loop=gif.tracks.selectedTrack.repetitionCount;gif.close();
  const controller=new AbortController();let cancelled=false;
  try{await exportTurntable(snap,options,{signal:controller.signal,onProgress:()=>controller.abort()});}catch(e){cancelled=e.name==='AbortError';}
  const recovered=await exportTurntable(snap,options);
  const transparent=await exportTurntable(snap,{...options,background:'transparent'});
  const alphaDecoder=new ImageDecoder({data:await transparent.blob.arrayBuffer(),type:'image/gif'});await alphaDecoder.tracks.ready;
  const transparentFrames=[];
  for(let i=0;i<5;i++){const f=await alphaDecoder.decode({frameIndex:i}),cv=document.createElement('canvas');cv.width=160;cv.height=120;cv.getContext('2d').drawImage(f.image,0,0);const data=cv.getContext('2d').getImageData(0,0,160,120).data;let clear=0,opaque=0,partial=0;for(let j=3;j<data.length;j+=4){if(data[j]===0)clear++;else if(data[j]===255)opaque++;else partial++;}transparentFrames.push({clear,opaque,partial,corner:data[3]});f.image.close();}alphaDecoder.close();
  return {flatColors:[...flatColors],disposalAlpha,transparentFrames,transparentBytes:Array.from(new Uint8Array(await transparent.blob.arrayBuffer())),backgrounds,noiseError:delta/pixels.length,count,loop:String(loop),duration,distinct:new Set(signatures).size,cancelled,restored:before===JSON.stringify(view),recovered:recovered.blob.size,bytes:Array.from(new Uint8Array(await output.blob.arrayBuffer()))};
 });
 await mkdir('test-results/images',{recursive:true});await writeFile('test-results/images/turntable.gif',Buffer.from(result.bytes));delete result.bytes;await writeFile('test-results/images/turntable-transparent.gif',Buffer.from(result.transparentBytes));delete result.transparentBytes;
 assert.deepEqual(result.flatColors,['50,50,50,255'],'Flat gray must not acquire colored dot patterns');assert.deepEqual(result.disposalAlpha,[[255,0,0,255],[0,255,0,0]]);assert.ok(result.transparentFrames.every(f=>f.clear>0&&f.opaque>0&&f.partial===0&&f.corner===0));
 assert.ok(result.backgrounds.every(colors=>colors.length===1&&colors[0]==='32,32,32,255'),JSON.stringify(result.backgrounds));assert.ok(result.noiseError<20);assert.equal(result.count,5);assert.equal(result.duration,1000000);assert.equal(result.loop,'Infinity');assert.ok(result.distinct>1&&result.cancelled&&result.restored&&result.recovered>0);assert.deepEqual(errors,[]);
 await page.goto(base);await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('menuitem',{name:'Advanced Export…',exact:true}).click();await page.getByRole('button',{name:'Image Export',exact:true}).click();
 const host=page.locator('.image-export');await host.getByLabel('Export type',{exact:true}).selectOption('turntable');await host.getByLabel('Background',{exact:true}).selectOption('transparent');await host.getByLabel('Duration (seconds)',{exact:true}).fill('6');await host.getByLabel('Duration (seconds)',{exact:true}).dispatchEvent('change');
 await host.getByLabel('Resolution preset',{exact:true}).selectOption('4096x4096');
 assert.equal(await host.getByLabel('Width (pixels)',{exact:true}).inputValue(),'1333');assert.equal(await host.getByLabel('Height (pixels)',{exact:true}).inputValue(),'1333');
 await host.getByLabel('Frames per second',{exact:true}).fill('30');await host.getByLabel('Frames per second',{exact:true}).dispatchEvent('change');
 const w=Number(await host.getByLabel('Width (pixels)',{exact:true}).inputValue()),h=Number(await host.getByLabel('Height (pixels)',{exact:true}).inputValue());assert.ok(w*h*180<=160000000);
 await host.getByLabel('Duration (seconds)',{exact:true}).fill('1');await host.getByLabel('Frames per second',{exact:true}).fill('5');await host.getByLabel('Width (pixels)',{exact:true}).fill('160');await host.getByLabel('Width (pixels)',{exact:true}).dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('.image-export .export-status').textContent.startsWith('Preview '),{},{timeout:120000});
 assert.ok(await host.locator('img').isVisible());await host.getByRole('button',{name:'Prepare GIF',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.image-export .export-status').textContent.startsWith('Ready:'),{},{timeout:120000});
 const download=page.waitForEvent('download');await host.getByRole('button',{name:'Download GIF',exact:true}).click();assert.match((await download).suggestedFilename(),/-turntable.gif$/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));console.log('Animated preview, GIF download, decoding, cancellation and recovery passed.');
}finally{await browser.close();}
