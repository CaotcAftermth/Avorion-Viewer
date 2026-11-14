import {readFile,writeFile,mkdir,open,rm,rename,statfs} from 'node:fs/promises';
import {resolve,extname,sep,dirname,join} from 'node:path';
import {createReadStream} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {tmpdir,freemem,totalmem} from 'node:os';
import {modelFile} from './model-stress-xml.mjs';
import {createHash} from 'node:crypto';
import {deflateSync,crc32} from 'node:zlib';
const [file,reportPath='output/stress/benchmark.json',warm='0']=process.argv.slice(2);
const output=resolve(reportPath);
if(!file||file==='--help'){
 console.log('Usage: node scripts/benchmark-stress-xml.mjs FIXTURE.xml [REPORT.json] [WARM_RELOADS]');
 console.log('Environment: AVORION_PLAYWRIGHT_URL, AVORION_ANGLE (default d3d11), AVORION_MODES (default m5), AVORION_TIMEOUT_MS (default 180000), AVORION_PARSE_ONLY=1');
 process.exit(file==='--help'?0:1);
}
const station=resolve(file);
const manifest=JSON.parse(await readFile(station+'.manifest.json','utf8'));
const requested=(process.env.AVORION_MODES||'m5').split(',');
const clipEnd=1e7;
const parseOnly=process.env.AVORION_PARSE_ONLY==='1';
const minimumFree=Number(process.env.AVORION_MIN_FREE_MIB??4096)*1024**2;
if(!Number.isFinite(minimumFree)||minimumFree<1024**3)throw Error('Avorion benchmark requires a host headroom floor of at least 1024 MiB.');
const reloads=Number(warm), timeout=Number(process.env.AVORION_TIMEOUT_MS??180000);
if(!Number.isSafeInteger(reloads)||reloads<0||reloads>10||!Number.isSafeInteger(timeout)||timeout<1000||timeout>900000)throw Error('Invalid reload count or timeout.');
if(requested.some(mode=>!['legacy','m4','m5'].includes(mode)))throw Error('Unknown benchmark mode.');
if(manifest.actualBlocks>=500000&&requested.some(mode=>mode!=='m5'))throw Error('Large fixture benchmarks require M5.');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const reportDir=dirname(output);
if(output===station||output===station+'.manifest.json')throw Error('Report path must be separate from the fixture and manifest.');
await mkdir(reportDir,{recursive:true});
const disk=await statfs(reportDir);
if(disk.bavail*disk.bsize<64*1024**2)throw Error('Insufficient free space for benchmark evidence.');
const lockPath=join(tmpdir(),'avorion-viewer-stress-benchmark.lock');
const lock=await open(lockPath,'wx').catch(error=>{if(error.code==='EEXIST')throw Error('Stress benchmark already running. Remove a stale lock only after confirming its process exited: '+lockPath);throw error;});
const report={manifest,estimates:{},settings:{parseOnly,dims:[640,480],dpr:1,clipEnd,warm:reloads,camera:'framed then orbit and zoom',shading:'SOLID',shadow:true},runs:[]};
const save=async()=>{await writeFile(output+'.tmp',JSON.stringify(report,null,2));await rename(output+'.tmp',output);};
const {chromium}=await import(process.env.AVORION_PLAYWRIGHT_URL??'playwright').catch(async error=>{await lock.close();await rm(lockPath);throw error;});
let browser,watchdog,server;
let interrupted=false;
function screenshot(rgba,width,height){
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const rows=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++)rgba.copy(rows,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
 function chunk(name,body){
  const data=Buffer.concat([Buffer.from(name),body]),size=Buffer.alloc(4),crc=Buffer.alloc(4);
  size.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(data));
  return Buffer.concat([size,data,crc]);
 }
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
const interrupt=()=>{interrupted=true;report.failure={stage:report.active?.stage,error:'Interrupted'};void browser?.close();};
process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
try{
 await lock.writeFile(String(process.pid));
 for(const mode of requested){
  if(interrupted)throw Error('Interrupted');
  const estimate=await modelFile(station,mode);
  report.estimates[mode]=estimate;
  if(!parseOnly&&estimate.hullBytes>1.5*1024**3)throw Error('Predicted hull exceeds the benchmark 1.5 GiB ceiling.');
 }
 await save();
 if(interrupted)throw Error('Interrupted');
 if(manifest.actualBlocks>=500000&&freemem()<minimumFree)throw Error('Host free memory below benchmark headroom floor.');
server=createServer((request,response)=>{
 if(request.method!=='GET'||request.url!=='/fixture.xml'){response.writeHead(404).end();return;}
 response.writeHead(200,{'Content-Type':'application/xml','Content-Length':manifest.xmlBytes});
 const fileStream=createReadStream(station);
 fileStream.on('error',error=>response.destroy(error));
 response.on('close',()=>fileStream.destroy());
 fileStream.pipe(response);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port;
const dims=[640,480], types={'.js':'text/javascript','.html':'text/html','.png':'image/png','.json':'application/json'};
browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-crash-reporter','--disable-crashpad','--disable-software-rasterizer','--use-angle='+(process.env.AVORION_ANGLE||'d3d11')]});
const cdp=await browser.newBrowserCDPSession();
report.chrome=browser.version();report.system=(await cdp.send('SystemInfo.getInfo')).gpu;
report.hostMemory={totalBytes:totalmem(),freeBytesBefore:freemem(),minimumObservedFreeBytes:freemem()};
if(manifest.actualBlocks>=500000)watchdog=setInterval(()=>{
 const free=freemem();report.hostMemory.minimumObservedFreeBytes=Math.min(report.hostMemory.minimumObservedFreeBytes,free);
 if(free<minimumFree&&!report.failure){report.failure={...report.active,error:'Host free memory fell below benchmark headroom floor.'};void browser.close();}
},500);
for(const mode of requested){
   let stopped;
   const page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'&&m.text().includes('WebGLProgram'))errors.push(m.text());});
   await page.route(origin+'/**',async route=>{
    try{
      const name=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
      if(name==='fixture.xml')return route.continue();
      const file=resolve(root,name);
      if(!file.startsWith(root+sep))return route.abort();
      let body=await readFile(file);
      if(name==='src/performance-diagnostics.js')body=body.toString().replace('gl.beginQuery(extension.TIME_ELAPSED_EXT,query);','globalThis.captureBenchmarkQuery?.(query,label);gl.beginQuery(extension.TIME_ELAPSED_EXT,query);');
      await route.fulfill({body,contentType:types[extname(file)]??'application/octet-stream'});
    }catch{await route.fulfill({status:404});}
   });
   page.on('crash',()=>{stopped='Browser renderer crashed';report.failure={...report.active,error:stopped};});
   await page.exposeFunction('stressStage',async (stage,details={})=>{
    report.active={...report.active,stage,details,hostFreeBytes:freemem()};
    await save();
    console.log(mode,report.active.cycle,stage,JSON.stringify(details));
   });
   await page.goto(origin+'/tests/image-export.html?renderer='+ (mode==='legacy'?'legacy':'')+(mode==='legacy'?'':'&canonicalBoxes=1&canonicalWedges=1')+(mode==='m5'?'&canonicalDiscrete=1':''));

   for(let cycle=0;cycle<=reloads;cycle++){
    report.active={mode,cycle,stage:'starting'};await save();
    let timer;
    const result=await Promise.race([page.evaluate(async ({mode,cycle,dims,parseOnly,expected,workerTimeout,clipEnd})=>{
     if(!window.harness){
      const gpu=[],programs=[],timerSamples=[];
      const proto=WebGL2RenderingContext.prototype;
      const get=proto.getParameter, getQuery=proto.getQueryParameter, link=proto.linkProgram;
      const labels=new WeakMap();
      globalThis.captureBenchmarkQuery=(q,pass)=>labels.set(q,{phase:window.harness?.phase,pass});
      proto.getParameter=function(key){const v=get.call(this,key);if(key===0x8fbb&&v)gpu.push('disjoint');return v;};
      proto.getQueryParameter=function(query,key){
       const value=getQuery.call(this,query,key);
       if(key===this.QUERY_RESULT)timerSamples.push({...labels.get(query),ms:value/1e6});
       return value;
      };
      proto.linkProgram=function(program){
       link.call(this,program);
       if(!this.getProgramParameter(program,this.LINK_STATUS))return;
       const n=this.getProgramParameter(program,this.ACTIVE_ATTRIBUTES);
       programs.push(Array.from({length:n},(_,i)=>this.getActiveAttrib(program,i).name));
      };
      const {drawGame,pickGame,releaseGameModel}=await import('/src/game-renderer.js');
      const {parseAvorionXml,placeImportedModel}=await import('/src/block-model.js');
      const diagnostics=await import('/src/performance-diagnostics.js');
      const {FACTORY_PREFERENCES}=await import('/src/preferences.js');
      const {area}=await import('/src/layout.js'),{ensureViewportOptions}=await import('/src/viewport-options.js');
      const gl=document.createElement('canvas').getContext('webgl2');
      const ext=gl?.getExtension('WEBGL_debug_renderer_info');
      const renderer=ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      if(!renderer||/swiftshader|software|llvmpipe|basic render driver/i.test(renderer))throw Error('Physical renderer required: '+renderer);
      window.harness={gpu,programs,timerSamples,drawGame,pickGame,releaseGameModel,parseAvorionXml,placeImportedModel,diagnostics,FACTORY_PREFERENCES,area,ensureViewportOptions,renderer};
     }
     const h=window.harness,d=h.diagnostics,[width,height]=dims;
     const startGpu=h.timerSamples.length;
     h.phase='load';
     d.configureDiagnostics(true,{interval:100,gpuTiming:true});
     const operation=d.diagnosticStart('import','xml');
     let firstDrawStart;
     await stressStage('reading XML');
     const readStarted=performance.now();
     const response=await fetch('/fixture.xml');if(!response.ok)throw Error('Fixture read failed: '+response.status);
     const xml=await response.text(),readMs=performance.now()-readStarted;
     await stressStage('parsing XML',{readMs,sourceCodeUnits:xml.length});
     const parseStart=performance.now(),model=h.parseAvorionXml(xml,'Stress fixture.xml',Number(response.headers.get('content-length'))||xml.length);
     const parseMs=performance.now()-parseStart;
     if(model.blocks.length!==expected)throw Error('Logical count mismatch: '+model.blocks.length+' vs '+expected);
     const warnings=model.warnings.filter(w=>w.level==='warn');if(warnings.length)throw Error(warnings.map(w=>w.message).join(' '));
     const measuredHeap=performance.memory?.usedJSHeapSize;
     await stressStage('logical blocks extracted',{parseMs,logicalBlocks:model.blocks.length,measuredHeap});
     if(parseOnly)return {renderer:h.renderer,parseMs,readMs,logicalBlocks:model.blocks.length,initial:d.diagnosticReport()};
     const placeStart=performance.now();
     h.placeImportedModel(model);
     const placementMs=performance.now()-placeStart;
     const scene={model,revision:cycle+1,loaded:true,visible:true,selectedIds:new Set(),hiddenIds:new Set()};
     const view=h.area().view;Object.assign(view,{yaw:.6,pitch:.35,zoom:.2,grid:false});
     Object.assign(h.ensureViewportOptions(view),{shading:'SOLID',background:'VIEWPORT',shadows:true,showOverlays:true,objectOutline:true,outlineSelected:true,clipEnd});
     const p={...h.FACTORY_PREFERENCES,worldEnabled:false,vignetteEnabled:false,canonicalBoxes:mode!=='legacy',canonicalWedges:mode!=='legacy',canonicalDiscrete:mode==='m5'};
     const canvas=document.querySelector('canvas');canvas.width=width;canvas.height=height;
     const ctx=canvas.getContext('2d'),draw=()=>h.drawGame(ctx,scene,view,width,height,p,1);
     const {frameVisibleModel}=await import('/src/model-framing.js');
     const frameStart=performance.now();
     frameVisibleModel(scene,view,width,height,p);
     const frameAllMs=performance.now()-frameStart,baseZoom=view.zoom,baseYaw=view.yaw;
     await stressStage('geometry preparation',{placementMs,frameAllMs,deviceMemoryGiB:navigator.deviceMemory,blocks:model.blocks.length});
     d.diagnosticAwaitFirstFrame(operation,scene.revision);
     firstDrawStart=performance.now();
     draw();
     if(scene.renderPreparing)await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('worker timeout')),workerTimeout);
      window.addEventListener('avorion-model-ready',()=>{clearTimeout(timer);resolve();},{once:true});
     });
     if(scene.renderError)throw Error(scene.renderError);
     await stressStage('geometry installed',{diagnostics:d.diagnosticReport().events.filter(e=>e.type==='geometry worker response'||e.type==='hull installed').slice(-2)});
     draw();const firstFrameMs=performance.now()-firstDrawStart;
     if(!d.diagnosticReport().hull)throw Error('No hull installed.');
     if(mode==='m5'&&d.diagnosticReport().hull.discreteInstances===0)throw Error('M5 benchmark has no discrete instances.');
     await stressStage('first frame submitted',{firstFrameMs});
     const submitted=d.diagnosticReport().rendering;
     const sceneTriangles=Object.values(submitted).at(-1)?.passes.scene?.triangles;
     if(sceneTriangles!==undefined&&sceneTriangles<=6)throw Error('No visible hull triangles in the sampled first frame. Check the fixture camera and clip range.');


     const initial=structuredClone(d.diagnosticReport());
     const rgba=cycle===0?Array.from(ctx.getImageData(0,0,width,height).data):null;
     const frame={},passes={},pick=[],paint=[],pickHits=new Set();
     const raf=()=>new Promise(requestAnimationFrame);
     for(let i=0;i<5;i++){await raf();draw();}
     for(const phase of ['stationary','orbit-zoom','select-paint']){
      await stressStage(phase);h.phase=phase;const interval=[],wall=[];
      let prev=await raf(), targetId;
      const block=model.blocks.find(b=>b.typeIndex===100)??model.blocks[0];
      const {nativeToView}=await import('/src/block-model.js');
      const {projectPoint}=await import('/src/navigation.js');
      const paintTarget=projectPoint(nativeToView([block.position.x,block.position.y,block.position.z]),view,width,height);
      for(let i=0;i<28;i++){
       const tick=await raf();interval.push(tick-prev);prev=tick;
       if(phase==='orbit-zoom'){view.yaw=baseYaw+Math.sin(i/27*Math.PI)*.3;view.zoom=baseZoom*(1+i/135);}
       if(phase==='select-paint'){
        const t=performance.now();targetId=h.pickGame(scene,view,width,height,i%2&&paintTarget?paintTarget[0]:width/2+i%5,i%2&&paintTarget?paintTarget[1]:height/2,p);pick.push(performance.now()-t);
        scene.selectedIds=new Set(targetId?[targetId]:[block.id]);if(targetId)pickHits.add(targetId);
        block.color=i%2?'ff4499cc':'ffcc8844';scene.appearanceDirty=new Set([block.id]);scene.appearanceRevision=i+1;
       }
       const t=performance.now();draw();wall.push(performance.now()-t);
       if(phase==='select-paint')paint.push(wall.at(-1));
      }
      frame[phase]={interval,wall};
      passes[phase]=structuredClone(d.diagnosticReport().rendering);
     }
     await new Promise(r=>setTimeout(r,250));
     const final=structuredClone(d.diagnosticReport());
     await stressStage('releasing hull');
     const releaseStart=performance.now();h.releaseGameModel();const releaseMs=performance.now()-releaseStart;
     const cleanup=d.diagnosticReport().memory.trackedBytesByCategory;
     return {renderer:h.renderer,readMs,parseMs,placementMs,frameAllMs,firstFrameMs,releaseMs,frame,passes,pick,paint,pickHits:[...pickHits],cleanup,rgba,programs:h.programs,timers:h.timerSamples.slice(startGpu),disjointObservations:h.gpu.length,initial,final};
    },{mode,cycle,dims,parseOnly,expected:manifest.actualBlocks,workerTimeout:timeout,clipEnd}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Benchmark timed out')),timeout);})]).finally(()=>clearTimeout(timer));

    if(result.rgba){
      const rgba=Buffer.from(result.rgba);
      result.hash=createHash('sha256').update(rgba).digest('hex');
      await writeFile(output+'.'+mode+'.png',screenshot(rgba,...dims));
      delete result.rgba;
    }
    delete result.initial?.hull?.batches;delete result.final?.hull?.batches;
    report.runs.push({mode,cycle,errors:[...errors],...result});
    await save();
    console.log(mode,cycle,'completed',result.firstFrameMs??result.parseMs,result.renderer,result.final?.hull?.attributeBytes,errors.length);
   }
   await page.close();
   if(stopped)throw Error(stopped);
 }
 report.active=null;
}catch(error){report.failure??={...report.active,error:error.message};console.error(error.message);process.exitCode=1;}
finally{
 clearInterval(watchdog);
 process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
 await browser?.close();
 server?.closeAllConnections();server?.close();
 try{await save();}finally{await lock.close();await rm(lockPath,{force:true});}
}

