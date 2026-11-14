import {APP_VERSION} from './version.js';

const LIMIT=256, RESOURCE_LIMIT=8192, SAMPLE_LIMIT=64;
export let diagnosticsEnabled=false;
let session, epoch=0;
const gpuQueries=[];
let gpuPoll;

function fresh({interval=500,lightweight=false,gpuTiming=false}={}){
  return {epoch:++epoch,start:performance.now(),interval,lightweight,gpuTiming,gpuPasses:{},contexts:new WeakMap(),contextCount:0,events:Array(LIMIT),cursor:0,eventsWritten:0,
    operations:new Map(),nextOperation:0,counts:{},model:{revision:null,blocks:0},memory:{},peak:{},lifecycle:{},
    resources:new WeakMap(),buffers:new WeakMap(),gpuAttributes:new WeakMap(),liveResources:0,skippedResources:0,viewIds:new WeakMap(),
    lastSamples:new WeakMap(),lastFrames:new WeakMap(),attributeVersions:new WeakMap(),nextView:0,render:{},heap:null,lastHeap:-Infinity,firstFrame:null};
}
export function configureDiagnostics(enabled,config={}){
  if(enabled){
    const interval=Math.max(100,Math.min(60000,Number(config.interval)||500));
    if(!session)session=fresh({interval,lightweight:!!config.lightweight,gpuTiming:!!config.gpuTiming});
    else Object.assign(session,{interval,lightweight:!!config.lightweight,gpuTiming:!!config.gpuTiming});
  }else session=undefined;
  diagnosticsEnabled=!!enabled;
  if(!session?.gpuTiming||session.lightweight)clearGpuQueries();
}
export function resetDiagnostics(){
  clearGpuQueries();
  if(session)session=fresh(session);
}
function elapsed(){return Math.round((performance.now()-session.start)*100)/100;}
export function diagnosticEvent(type,data={},operation){
  if(!session||(operation&&operation.epoch!==session.epoch))return;
  const event={ms:elapsed(),type,...(operation?{operation:operation.id}:{}),...data};
  session.events[session.cursor++%LIMIT]=event;
  session.eventsWritten++;
}
const optionKeys=['mode','scope','sizing','longest','placement','colors','budget','cleanup','includeTransparent','fillCavities','tolerance','width','height','supersampling','quality','fps','duration','format','type','background','transparent','blueprintLayout'];
const safeOptions=new Set(['shell','grouped','detailed','all','visible','selected','selection','region','native','size','centered','original','working','stl','glb','gltf','obj','3mf','png','webp','jpeg','gif','webm','sequence','blueprint','viewport','transparent','solid','standard','high','low','single','multi']);
export function diagnosticStart(kind,format,blocks,options){
  if(!session)return;
  const clean={};
  for(const key of optionKeys){
    const value=options?.[key];
    if(typeof value==='boolean'||Number.isFinite(value)||safeOptions.has(value))clean[key]=value;
  }
  const operation={epoch:session.epoch,id:++session.nextOperation,kind,format,started:performance.now(),revision:session.model.revision,frames:0,frameMs:0,peakFrameMs:0,encodeMs:0};
  if(session.operations.size<LIMIT)session.operations.set(operation.id,operation);
  diagnosticEvent(kind+' started',{format,blocks,revision:operation.revision,options:clean},operation);
  return operation;
}
export function diagnosticEnd(operation,status='completed',data={}){
  if(!operation||!session||operation.epoch!==session.epoch||operation.ended)return;
  operation.ended=true;
  session.operations.delete(operation.id);
  const key=operation.kind+' '+status;
  session.counts[key]=(session.counts[key]||0)+1;
  diagnosticEvent(key,{image:operation.image,format:operation.format,durationMs:performance.now()-operation.started,...(operation.frames?{
    frames:operation.frames,averageFrameMs:operation.frameMs/operation.frames,peakFrameMs:operation.peakFrameMs,encodeMs:operation.encodeMs,retainedEncodedBytes:operation.encodedBytes,peakEncoderQueue:operation.peakQueue
  }:{}),...data},operation);
}
export function diagnosticDownload(format,blocks,write){
  const operation=diagnosticStart('export',format,blocks);
  try{
    const blob=write(operation);
    diagnosticEnd(operation,'completed',{blobBytes:blob?.size});
    return blob;
  }catch(error){diagnosticFailure(operation,error);throw error;}
}
export function diagnosticFailure(operation,error){
  diagnosticEnd(operation,error?.name==='AbortError'?'cancelled':'failed',{errorType:error?.name==='AbortError'?'AbortError':'Error'});
}
export function diagnosticPhase(type,operation,started,data={}){
  if(!session)return;
  diagnosticEvent(type,{...data,...(started===undefined?{}:{durationMs:performance.now()-started})},operation);
}
export function diagnosticClock(){return session?performance.now():undefined;}
export function diagnosticImage(operation,width,height,tiles,padding,supersampling){
  if(!session||operation?.epoch!==session.epoch)return;
  const image=operation.image??={panels:0,tiles:0,maxTileWidth:0,maxTileHeight:0,peakReadbackBytes:0,peakEstimatedCanvasBytes:0};
  image.panels++;image.tiles+=tiles.length;image.width=width;image.height=height;image.supersampling=supersampling;image.maxPadding=Math.max(image.maxPadding||0,padding);
  for(const tile of tiles){
    image.maxTileWidth=Math.max(image.maxTileWidth,tile.width);image.maxTileHeight=Math.max(image.maxTileHeight,tile.height);
    const bytes=tile.width*tile.height*4;
    image.peakReadbackBytes=Math.max(image.peakReadbackBytes,bytes);
    image.peakTemporaryImageDataBytes=image.peakReadbackBytes;
    image.peakScratchCanvasBytes=image.peakReadbackBytes;
    image.peakEstimatedCanvasBytes=Math.max(image.peakEstimatedCanvasBytes,width*height*4+bytes);
  }
}
export function diagnosticFrame(operation,ms,encodeMs,bytes,queue){
  if(!session||operation?.epoch!==session.epoch)return;
  operation.frames++;operation.frameMs+=ms;operation.peakFrameMs=Math.max(operation.peakFrameMs,ms);operation.encodeMs+=encodeMs;
  operation.encodedBytes=bytes;operation.peakQueue=Math.max(operation.peakQueue||0,queue||0);
}
export function diagnosticModel(scene){
  if(!session)return;
  const model={revision:scene.model?scene.revision:null,blocks:scene.model?.blocks.length||0};
  if(model.revision===session.model.revision&&model.blocks===session.model.blocks)return;
  diagnosticEvent(model.revision===null?'model cleared':'model installed',{previousRevision:session.model.revision,previousBlocks:session.model.blocks,tracked:{...session.memory},...model});
  session.model=model;
  if(model.revision===null)session.hull=null;
  session.firstFrame=null;
}
export function diagnosticAwaitFirstFrame(operation,revision){
  if(operation&&session?.epoch===operation.epoch)session.pendingFirstFrame={operation,revision};
}
export function diagnosticFirstFrame(scene){
  if(!session||!scene.loaded||scene.renderPreparing||scene.renderError||session.firstFrame===scene.revision)return;
  diagnosticModel(scene);session.firstFrame=scene.revision;
  const pending=session.pendingFirstFrame;
  const operation=pending?.revision===scene.revision?pending.operation:undefined;
  if(pending&&pending.revision<=scene.revision)session.pendingFirstFrame=null;
  diagnosticPhase('first model frame submitted',operation,operation?.started,{revision:scene.revision,tracked:{...session.memory}});
}
function memory(s,category,delta){
  s.memory[category]=(s.memory[category]||0)+delta;
  s.peak[category]=Math.max(s.peak[category]||0,s.memory[category]);
}
function account(s,category,delta,owner){
  memory(s,category,delta);
  if(category==='preparedExportGeometry'||category==='retainedPreviewGeometry'){
    const bytes=(s.memory.preparedExportGeometry||0)+(s.memory.retainedPreviewGeometry||0);
    s.peak.knownMeshWorkerAndPreviewBytes=Math.max(s.peak.knownMeshWorkerAndPreviewBytes||0,bytes);
  }
  const bucket=s.lifecycle[category]??={created:0,released:0,owners:{}};
  const stats=bucket.owners[owner]??={created:0,released:0};
  const key=delta>=0?'created':'released';
  bucket[key]++;stats[key]++;
}
export function diagnosticAllocation(category,bytes,owner,operation,timeline=true){
  if(!session||!bytes||(operation&&operation.epoch!==session.epoch))return;
  const epoch=session.epoch;
  account(session,category,bytes,owner);
  if(timeline)diagnosticEvent('allocation',{category,bytes,owner},operation);
  return ()=>{
    if(session?.epoch!==epoch||!bytes)return;
    account(session,category,-bytes,owner);
    if(timeline)diagnosticEvent('release',{category,bytes,owner},operation);
    bytes=0;
  };
}
function observe(resource,signature,owner,measure){
  if(!session||!resource)return;
  const s=session,old=s.resources.get(resource);
  if(old?.signature===signature)return;
  if(old)releaseResource(resource);
  if(s.liveResources>=RESOURCE_LIMIT){s.skippedResources++;return;}
  const clear=measure(s);
  s.liveResources++;
  if(s.liveResources<=16&&owner!=='image tile')diagnosticEvent('resource observed',{owner,kind:resource.type||resource.constructor.name});
  s.resources.set(resource,{signature,clear,owner});
  resource.addEventListener('dispose',onResourceDispose);
}
function onResourceDispose(event){releaseResource(event.target);}
function releaseResource(resource){
  resource.removeEventListener('dispose',onResourceDispose);
  const record=session?.resources.get(resource);
  if(!record)return;
  session.resources.delete(resource);
  record.clear(session);session.liveResources--;
  if(session.liveResources<16&&record.owner!=='image tile')diagnosticEvent('resource disposed',{owner:record.owner,kind:resource.type||resource.constructor.name});
}
function observeBuffer(s,array,category,owner){
  if(!array?.buffer)return;
  const buffer=array.buffer;
  const counter=s.buffers.get(buffer)??{refs:0,bytes:buffer.byteLength,category};
  s.buffers.set(buffer,counter);
  if(counter.refs++===0)account(s,counter.category,counter.bytes,owner);
  return current=>{
    if(--counter.refs===0)account(current,counter.category,-counter.bytes,owner);
  };
}
export function diagnosticGeometry(geometry,owner){
  if(!session||!geometry)return;
  observe(geometry,0,owner,s=>{
    const releases=[];
    function attributeBytes(attribute,category){
      const storage=attribute?.data||attribute,array=storage?.array;
      if(!array)return;
      releases.push(observeBuffer(s,array,category,owner));
      const gpu=s.gpuAttributes.get(storage)??{refs:0,bytes:array.byteLength,owner};
      s.gpuAttributes.set(storage,gpu);
      if(gpu.refs++===0)account(s,'estimatedGpuGeometry',gpu.bytes,owner);
      releases.push(current=>{if(--gpu.refs===0)account(current,'estimatedGpuGeometry',-gpu.bytes,gpu.owner);});
    }
    for(const attribute of Object.values(geometry.attributes))attributeBytes(attribute,'cpuGeometryAttributes');
    attributeBytes(geometry.index,'cpuGeometryIndices');
    return current=>{for(const release of releases)release?.(current);};
  });
}
function pixelBytes(texture){
  const channels=({1021:1,1022:3,1023:4,1024:1,1025:2,1026:1,1027:1,1028:1,1029:1,1030:2,1031:2,1032:3,1033:4})[texture.format]||4;
  const type=texture.type;
  if(type===1017||type===1018)return 2;
  if(type===1020||type===35902)return 4;
  return channels*([1015,1013,1014].includes(type)?4:[1011,1012,1016].includes(type)?2:1);
}
export function diagnosticTexture(texture,owner){
  if(!session||!texture?.isTexture||texture.isRenderTargetTexture||texture.isDepthTexture)return;
  const images=Array.isArray(texture.image)?texture.image:[texture.image],image=images[0];
  if(!image?.width||!image?.height)return;
  const {width,height,depth=1}=image;
  let pixels=width*height*depth;
  if(texture.generateMipmaps){
    let w=width,h=height,d=depth;
    while(w>1||h>1||(texture.isData3DTexture&&d>1)){w=Math.max(1,w>>1);h=Math.max(1,h>>1);if(texture.isData3DTexture)d=Math.max(1,d>>1);pixels+=w*h*d;}
  }
  const bytes=pixels*images.length*pixelBytes(texture);
  observe(texture,bytes,owner,s=>{
    account(s,'estimatedGpuTextures',bytes,owner);
    return current=>account(current,'estimatedGpuTextures',-bytes,owner);
  });
}
export function diagnosticTarget(target,owner){
  if(!session||!target)return;
  const faces=target.isWebGLCubeRenderTarget?6:1;
  const color=target.textures.reduce((n,t)=>n+pixelBytes(t),0);
  const depth=target.depthBuffer?4:0;
  let mipPixels=0,w=target.width,h=target.height;
  if(target.texture.generateMipmaps)while(w>1||h>1){w=Math.max(1,w>>1);h=Math.max(1,h>>1);mipPixels+=w*h;}
  const bytes=faces*(target.width*target.height*(color+depth)*(1+target.samples)+mipPixels*color);
  observe(target,bytes,owner,s=>{
    account(s,'estimatedGpuTargets',bytes,owner);
    return current=>account(current,'estimatedGpuTargets',-bytes,owner);
  });
}
// Logical field sizes for clone payloads. Object headers, native copies and
// browser string encodings are outside this estimate.
export function diagnosticSnapshotBytes(blocks){
  let bytes=0;
  const stringFields=['id','type','material','color','secondaryColor','itemIndex','parentIndex','parentId'];
  for(const block of blocks){
    bytes+=12*8;
    for(const key of stringFields)bytes+=(block[key]?.length||0)*2;
    for(const name of block.regions||[])bytes+=name.length*2;
    for(const key in block.unknownAttrs)if(Object.hasOwn(block.unknownAttrs,key))bytes+=(key.length+(block.unknownAttrs[key]?.length||0))*2;
    const positions=block.exportPositions;
    if(positions)bytes+=positions.byteLength??positions.length*8;
  }
  return bytes;
}
export function diagnosticTypedBytes(geometries){
  const seen=new Set();let bytes=0;
  for(const geometry of geometries||[])for(const array of [geometry.positions,geometry.indices,geometry.normals]){
    const buffer=array?.buffer;
    if(buffer&&!seen.has(buffer)){seen.add(buffer);bytes+=buffer.byteLength;}
  }
  return bytes;
}
export function diagnosticHullMissing(){return !!session&&!session.hull;}
export function diagnosticHull(group,blocks,renderedBlocks,method,started){
  if(!session)return;
  const attributes={},batches=[];let vertices=0,triangles=0,instancedBlocks=0,canonicalInstances=0,canonicalBatches=0,canonicalWedgeInstances=0,canonicalWedgeBatches=0,endpointBoxInstances=0,discreteInstances=0,expandedBlocks=0,instanceBytes=0,templateBytes=0,indexBytes=0;
  const buffers=new Set();
  for(const mesh of group.children){
    if(!mesh.userData.textured)continue;
    const g=mesh.geometry,count=g.getAttribute('position').count,instances=mesh.userData.instanced?g.instanceCount:1;
    const before=indexBytes;let batchBytes=0;
    if(mesh.userData.instanced)instancedBlocks+=instances;
    const canonical=!!g.getAttribute('aScale');
    if(canonical){canonicalInstances+=instances;canonicalBatches++;
      const layout=g.userData.canonicalLayout;
      if(layout==='wedge'||layout==='discreteWedge'){canonicalWedgeInstances+=instances;canonicalWedgeBatches++;}
      if(layout==='endpointBox'||layout==='discreteBox')endpointBoxInstances+=instances;
      if(layout?.startsWith('discrete'))discreteInstances+=instances;
    }
    const index=g.index?.array;
    if(index&&!buffers.has(index.buffer)){buffers.add(index.buffer);indexBytes+=index.buffer.byteLength;}
    for(const [name,a] of Object.entries(g.attributes)){
      if(buffers.has(a.array.buffer))continue;
      buffers.add(a.array.buffer);
      const bytes=a.array.buffer.byteLength;
      attributes[name]=(attributes[name]||0)+bytes;batchBytes+=bytes;
      if(a.isInstancedBufferAttribute)instanceBytes+=bytes;
      else if(mesh.userData.instanced)templateBytes+=bytes;
    }
    vertices+=count;triangles+=(g.index?.count??count)/3*instances;
    if(batches.length<SAMPLE_LIMIT)batches.push({vertices:count,instances,instanced:!!mesh.userData.instanced,canonical,attributeBytes:batchBytes,indexBytes:indexBytes-before});
  }
  expandedBlocks=Math.max(0,renderedBlocks-instancedBlocks);
  const batchCount=group.children.filter(m=>m.userData.textured).length;
  const instancedBatches=group.children.filter(m=>m.userData.instanced).length;
  const report={blocks,instancedBlocks,canonicalInstances,canonicalBatches,canonicalWedgeInstances,canonicalWedgeBatches,endpointBoxInstances,discreteInstances,legacyInstances:instancedBlocks-canonicalInstances,expandedBlocks,batchCount,instancedBatches,expandedBatches:batchCount-instancedBatches,vertices,triangles,indexBytes,instanceBytes,templateBytes,attributeBytes:Object.values(attributes).reduce((a,b)=>a+b,0),attributes,batches,bufferCount:buffers.size,method};
  session.hull=report;
  diagnosticPhase('hull installed',null,started,{...report,batches:undefined});
}
function viewId(view,owner){
  let id=session.viewIds.get(view);
  if(!id){id=owner+' '+(++session.nextView);session.viewIds.set(view,id);}
  return id;
}
function clearGpuQueries(){
  clearTimeout(gpuPoll);gpuPoll=undefined;
  for(const {gl,query} of gpuQueries)gl.deleteQuery(query);
  gpuQueries.length=0;
}
function pollGpu(){
  gpuPoll=undefined;
  for(let i=gpuQueries.length-1;i>=0;i--){
    const {gl,extension,query,view,label,started}=gpuQueries[i];
    const available=gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE);
    const disjoint=gl.getParameter(extension.GPU_DISJOINT_EXT);
    if(available&&!disjoint){
      const ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
      const bucket=session.gpuPasses[view]??={};
      const pass=bucket[label]??={count:0,totalMs:0,peakMs:0,lastMs:null};
      pass.count++;pass.lastMs=ms;pass.totalMs+=ms;pass.peakMs=Math.max(pass.peakMs,ms);
      const views=Object.keys(session.gpuPasses);if(views.length>SAMPLE_LIMIT)delete session.gpuPasses[views[0]];
    }
    if(available||disjoint||gl.isContextLost()||performance.now()-started>5000){gl.deleteQuery(query);gpuQueries.splice(i,1);}
  }
  if(gpuQueries.length)gpuPoll=setTimeout(pollGpu,100);
}
function startGpuQuery(renderer,sample,label){
  if(!session?.gpuTiming||session.lightweight||gpuQueries.length>=16)return;
  const gl=renderer.getContext(),extension=renderer.extensions.get('EXT_disjoint_timer_query_webgl2');
  sample.gpuTimingSupported=!!extension;
  if(!extension||gl.isContextLost()||gl.getQuery(extension.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return;
  const query=gl.createQuery();if(!query)return;
  gl.beginQuery(extension.TIME_ELAPSED_EXT,query);
  return ()=>{
    gl.endQuery(extension.TIME_ELAPSED_EXT);
    gpuQueries.push({gl,extension,query,view:sample.id,label,started:performance.now()});
    gpuPoll??=setTimeout(pollGpu,100);
  };
}
export function diagnosticDrawStart(view,owner){
  if(!session)return;
  const now=performance.now(),last=session.lastSamples.get(view),lastFrame=session.lastFrames.get(view);
  session.lastFrames.set(view,now);
  if(last!==undefined&&now-last<session.interval*(session.lightweight?4:1))return;
  session.lastSamples.set(view,now);
  return {epoch:session.epoch,id:viewId(view,owner),owner,start:now,frameIntervalMs:lastFrame===undefined?null:now-lastFrame,intervalMs:last===undefined?null:now-last,passes:{}};
}
export function diagnosticRender(renderer,world,camera,label,sample){
  if(!sample){renderer.render(world,camera);return;}
  const target=renderer.getRenderTarget();
  diagnosticTarget(target,label);
  const endGpu=startGpuQuery(renderer,sample,label),start=performance.now();
  try{renderer.render(world,camera);}finally{endGpu?.();}
  const {calls,triangles,lines,points}=renderer.info.render;
  const pass=sample.passes[label]??={count:0,cpuMs:0,calls:0,triangles:0,lines:0,points:0};
  pass.count++;pass.cpuMs+=performance.now()-start;pass.calls+=calls;pass.triangles+=triangles;pass.lines+=lines;pass.points+=points;
}
export function diagnosticDrawEnd(sample,renderer,world,hull,attachments,extras={}){
  if(!session||sample?.epoch!==session.epoch)return;
  const durationMs=performance.now()-sample.start;
  let contextId=session.contexts.get(renderer);
  if(!contextId){contextId=++session.contextCount;session.contexts.set(renderer,contextId);}
  let hullBatches=0,attachmentMeshes=0,updatedAttributes=0,updatedAttributeCapacityBytes=0;
  diagnosticTexture(world.background,sample.owner);
  world.traverseVisible(object=>{
    const geometry=object.geometry;
    let attachment=false;
    if(geometry&&attachments)for(let p=object.parent;p;p=p.parent)if(p===attachments){attachment=true;break;}
    const owner=attachment?'attachment':object.userData.textured?'hull':sample.owner;
    if(geometry){
      diagnosticGeometry(geometry,owner);
      if(object.userData.textured&&object.parent===hull)hullBatches++;
      if(attachment&&object.isMesh)attachmentMeshes++;
      const observeVersion=attribute=>{
        if(!attribute)return;
        const a=attribute.data||attribute,version=session.attributeVersions.get(a);
        if(version!==undefined&&a.version!==version){updatedAttributes++;updatedAttributeCapacityBytes+=a.array?.byteLength||0;}
        session.attributeVersions.set(a,a.version);
      };
      for(const a of Object.values(geometry.attributes))observeVersion(a);
      observeVersion(geometry.index);
    }
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!material)continue;
      diagnosticTexture(material.map,owner);
      for(const uniform of Object.values(material.uniforms||{}))if(uniform.value?.isTexture)diagnosticTexture(uniform.value,owner);
    }
  });
  const {id,owner,passes,intervalMs}=sample;
  if(Object.keys(session.render).length>=SAMPLE_LIMIT&&!session.render[id])delete session.render[Object.keys(session.render)[0]];
  const previous=session.render[id];
  session.render[id]={owner,atMs:elapsed(),durationMs,intervalMs,frameIntervalMs:sample.frameIntervalMs,passes,contextId,gpuTimingSupported:sample.gpuTimingSupported,hullBatches,attachmentMeshes,updatedAttributes,updatedAttributeCapacityBytes,renderer:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,...extras,
    samples:(previous?.samples||0)+1};
}
export function diagnosticReport(){
  if(!session)return {schemaVersion:1,appVersion:APP_VERSION,enabled:false};
  const now=performance.now();
  if(now-session.lastHeap>=5000){
    session.lastHeap=now;
    const heap=performance.memory;
    session.heap=heap?{usedBytes:heap.usedJSHeapSize,totalBytes:heap.totalJSHeapSize,limitBytes:heap.jsHeapSizeLimit}:null;
  }
  const events=session.eventsWritten>LIMIT?[...session.events.slice(session.cursor%LIMIT),...session.events.slice(0,session.cursor%LIMIT)]:session.events.slice(0,session.cursor);
  return {schemaVersion:1,appVersion:APP_VERSION,enabled:true,elapsedMs:elapsed(),browser:globalThis.navigator?.userAgent,
    platform:globalThis.navigator?.platform,configuration:{intervalMs:session.interval,lightweight:session.lightweight,gpuTiming:session.gpuTiming,timelineCapacity:LIMIT},
    model:session.model,activeOperations:[...session.operations.values()].map(({id,kind,format,started})=>({id,kind,format,durationMs:now-started})),counts:session.counts,
    memory:{measuredHeap:session.heap,trackedBytesByCategory:session.memory,peakTrackedBytesByCategory:session.peak,browserProcessBytes:null},
    hull:session.hull??null,rendering:session.render,gpuPasses:session.gpuPasses,contextsObserved:session.contextCount,lifecycle:session.lifecycle,trackedResources:session.liveResources,untrackedResourceObservations:session.skippedResources,
    events,droppedEvents:Math.max(0,session.eventsWritten-LIMIT),
    limitations:[
      'CPU buffer accounting uses backing-store identity for observed Three.js geometries. Other heap and native storage are separate.',
      'GPU values estimate application resources seen in sampled passes. Driver allocations, shared uploads across contexts, and reclamation are unobservable.',
      'Render-target estimates use color formats, 4-byte depth, sample count, and resolved storage. Driver padding and default framebuffers are excluded.',
      'Rendering timings are CPU wall time. Optional GPU queries report asynchronously on supported contexts. Browser-process memory, native XML DOM and allocator live Wasm bytes are unavailable.',
      'Worker payload counts describe known data. Structured-clone overhead and transient native copies are unavailable.',
      'High-water marks reflect observed simultaneous tracked resources per category. Categories can overlap.',
    ]};
}
