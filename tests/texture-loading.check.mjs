import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {viewerHandler} from '../scripts/serve.mjs';
import {allTextureNames} from '../src/avorion/lib/textures/shadingMap.js';
const root=process.env.AVORION_TEXTURE_DIR||'C:/Program Files (x86)/Steam/steamapps/common/Avorion/data/textures/blocks';
const available=await readdir(root),names=allTextureNames().map(n=>['png','bmp','jpg','jpeg','webp'].map(ext=>available.find(f=>f.toLowerCase()===n+'.'+ext)).find(Boolean)).filter(Boolean),allowed=new Set(names);
const handler=viewerHandler('.'),server=http.createServer(async(req,res)=>{
 if(req.url==='/__texture-bench'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><button id="respond">Respond</button>');return;}
 if(req.url.startsWith('/__texture-bench/')){const name=decodeURIComponent(req.url.slice('/__texture-bench/'.length));if(!allowed.has(name)){res.writeHead(404);res.end();return;}try{res.end(await readFile(root+'/'+name));}catch{res.writeHead(404);res.end();}return;}
 if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/__texture-bench`);
 const result=await page.evaluate(async names=>{
  const {TextureLibrary}=await import('/src/avorion/lib/textures/textureLibrary.js');
  const files=await Promise.all(names.map(async name=>new File([await(await fetch('/__texture-bench/'+encodeURIComponent(name))).blob()],name)));
  window.__textureBenchFiles=files;
  const library=new TextureLibrary(),tasks=[],decode=[];let last=performance.now(),maxGap=0,ticks=0;
  const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(t=>({start:t.startTime,duration:t.duration}))));observer.observe({type:'longtask',buffered:true});
  const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},8);
  const original=library.decode.bind(library);library.decode=async(blob,size)=>{const t=performance.now(),image=await original(blob,size);decode.push({file:blob.name,ms:performance.now()-t});return image;};
  await new Promise(r=>setTimeout(r,40));last=performance.now();maxGap=0;ticks=0;
  let clickAt=0;document.querySelector('button').onclick=()=>clickAt=performance.now();
  const start=performance.now();setTimeout(()=>document.querySelector('button').click(),100);
  const loaded=await library.loadFiles(files);const end=performance.now();await new Promise(r=>setTimeout(r,80));clearInterval(timer);observer.disconnect();
  const blocked=tasks.filter(t=>t.start>=start&&t.start<=end);
  let preserved=0;const rock=library.images.get('rock');if(rock)for(let i=0;i<rock.data.length;i+=4)if(rock.data[i+3]===0&&Math.max(...rock.data.subarray(i,i+3))>0)preserved++;
  return {files:files.length,loaded,elapsedMs:end-start,maxHeartbeatGapMs:maxGap,heartbeats:ticks,clickDelayMs:Math.max(0,clickAt-start-100),longTasks:blocked.length,maxLongTaskMs:Math.max(0,...blocked.map(t=>t.duration)),totalLongTaskMs:blocked.reduce((n,t)=>n+t.duration,0),preservedRockPixels:preserved,slowestDecodes:decode.sort((a,b)=>b.ms-a.ms).slice(0,6)};
 },names);
 if(!process.env.TEXTURE_BENCH_BASELINE){
  await page.evaluate(async()=>{
   const {openSessionStore}=await import('/src/session-persistence.js');const store=openSessionStore();
   await store.put('model',{version:1,empty:true});
   await store.put('textures',window.__textureBenchFiles.map(blob=>({name:blob.name.replace(/\.[^.]+$/,''),file:blob.name,source:'folder',blob})));
  });
  const workers=[];page.on('worker',worker=>workers.push(worker.url()));
  const start=performance.now();await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(async count=>{const {textureLibrary}=await import('/src/avorion/lib/textures/textureLibrary.js');return textureLibrary.scanning&&textureLibrary.loadedCount<count;},names.length);
  const click=performance.now();await page.getByRole('button',{name:'File',exact:true}).click();const inputMs=performance.now()-click;await page.keyboard.press('Escape');
  await page.waitForFunction(async count=>{const {textureLibrary}=await import('/src/avorion/lib/textures/textureLibrary.js');return textureLibrary.loadedCount===count&&!textureLibrary.scanning;},names.length,{timeout:30000});
  result.reload={elapsedMs:performance.now()-start,fileMenuInputMs:inputMs,decoderWorkers:workers.filter(url=>url.includes('/texturePngWorker.js')).length};
  assert.equal(result.reload.decoderWorkers,1,'Restore must reuse one decoder worker');
  assert.ok(inputMs<1500,'File menu must respond while saved textures restore');
 }
 await mkdir('test-results/texture-loading',{recursive:true});const label=process.env.TEXTURE_BENCH_LABEL||'after';await writeFile('test-results/texture-loading/'+label+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 assert.equal(result.loaded,names.length);assert.ok(result.preservedRockPixels>1000,'RGB hidden by alpha must survive import');
 if(!process.env.TEXTURE_BENCH_BASELINE){assert.ok(result.maxHeartbeatGapMs<300,'Texture loading must leave the UI responsive');assert.ok(result.clickDelayMs<250,'UI input must be serviced during loading');}
}finally{await browser.close();await new Promise(r=>server.close(r));}
