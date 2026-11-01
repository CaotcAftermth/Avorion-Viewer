import {exportImage} from '../export/image-pipeline.js';
import {imageDefaults} from '../export/image-options.js';
import {GifEncoder} from '../export/gif-encoder.js';
import {Zip,ZipPassThrough,strToU8} from '../vendor/fflate.js';
import {beginImageRender,endImageRender} from '../game-renderer.js';
import {createStudio} from './studio.js';
import {evaluateCamera,applyCamera,presentation} from './showcase.js';
import {webmSupported,webmMux} from './webm.js';
export const EXPORT_PRESETS={preview:{width:1280,height:720,fps:24,duration:4,format:'webm'},showcase:{width:1920,height:1080,fps:30,duration:18,format:'webm'},transparent:{width:1920,height:1080,fps:30,duration:4,format:'sequence',transparent:true},still:{width:3840,height:2160,fps:30,duration:1,format:'png'}};
export function validateShowcaseExport(o){if(!['png','sequence','gif','webm'].includes(o.format))throw Error('Unsupported animation format.');for(const k of ['width','height'])if(!Number.isInteger(o[k])||o[k]<16||o[k]>4096)throw Error('Dimensions must be 16–4096 pixels.');if(![24,30,60].includes(o.fps))throw Error('Frame rate must be 24, 30 or 60.');if(!Number.isFinite(o.duration)||o.duration<=0||o.duration>60)throw Error('Duration must be over zero and at most 60 seconds.');if(!Number.isFinite(o.start??0)||(o.start??0)<0||(o.start??0)+o.duration>300)throw Error('Timeline range must fit within 300 seconds.');if(o.transparent&&o.format==='webm')throw Error('This WebM path has no alpha. Choose PNG sequence for transparency.');const frames=o.format==='png'?1:Math.round(o.duration*o.fps);if(frames<1)throw Error('Choose at least one frame.');if(o.format==='gif'&&(Math.max(o.width,o.height)>1280||o.width*o.height*frames>120e6))throw Error('GIF limit: 1280-pixel side and 120 million frame-pixels. Use WebM or PNG sequence.');return {frames};}
export async function exportShowcase(runtime,options,{signal,onProgress=()=>{}}={}){
 const o={start:0,quality:'standard',...options},{frames}=validateShowcaseExport(o),context=runtime.context();if(!context.view)throw Error('Open a 3D viewport first.');
 if(o.format==='webm'&&!await webmSupported(o.width,o.height,o.fps))throw Error('VP8 WebCodecs unavailable. Choose GIF or PNG sequence.');
 const wasPlaying=runtime.clock.playing;runtime.pause();const owner={},parts=[],chunks=[],budget=256*1024**2;let bytes=0,encoder,error,zip,offline,acquired=false,lastCanvas;
 const check=()=>{if(signal?.aborted)throw new DOMException('Showcase export cancelled.','AbortError');if(error)throw error;};
 const append=part=>{bytes+=part.length;if(bytes>budget)throw Error('Encoded output exceeds 256 MiB. Reduce duration/resolution.');parts.push(part);};
 const scene={...context.scene,selected:false,selectedIds:new Set(),hiddenIds:new Set(context.scene.hiddenIds)},asset=structuredClone(runtime.asset);asset.simulation={...asset.simulation,quality:o.quality,targetVisible:o.targetVisible??asset.simulation.targetVisible};
 const view=structuredClone(context.view),preferences={...context.preferences,vignetteEnabled:false};
 const metadata={version:1,application:'avorion-viewer 0.1.0',designId:String(asset.id).split(/[\\/]/).pop(),weapon:asset.simulation.family,seed:asset.simulation.seed,simulation:asset.simulation,camera:asset.simulation.showcase||{camera:'manual'},width:o.width,height:o.height,fps:o.fps,frames,start:o.start,duration:frames/o.fps,format:o.format,audio:false};
 try{
  check();await beginImageRender(owner,signal);acquired=true;offline=createStudio(asset,scene,()=>{});
  if(o.format==='sequence'){zip=new Zip((err,data)=>{if(err)error=err;else try{append(data);}catch(e){error=e;}});const f=new ZipPassThrough('showcase.json');zip.add(f);f.push(strToU8(JSON.stringify(metadata,null,2)),true);}
  if(o.format==='gif')encoder=new GifEncoder(o.width,o.height,o.transparent?null:o.backgroundColor||'#202020',!!o.transparent,o.loop!==false);
  if(o.format==='webm'){
   encoder=new VideoEncoder({output:chunk=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);bytes+=data.length;if(bytes>budget){error=Error('Encoded output exceeds 256 MiB.');return;}chunks.push({data,timestamp:chunk.timestamp,key:chunk.type==='key'});},error:e=>error=e});encoder.configure({codec:'vp8',width:o.width,height:o.height,framerate:o.fps,bitrate:Math.min(24000000,o.width*o.height*o.fps*.12),latencyMode:'quality'});
  }
  for(let i=0;i<frames;i++){
   check();const time=o.start+i/o.fps;offline.seek(time);if(asset.simulation.showcase?.camera&&asset.simulation.showcase.camera!=='manual')applyCamera(view,evaluateCamera(time,asset,offline,asset.simulation.showcase));const shown=presentation(view,preferences,{...asset.simulation.showcase,...(o.background?{background:o.background,color:o.backgroundColor}:{} )});
   const imageOptions={...imageDefaults(shown.view,o.width,o.height),format:'png',budget:o.budget??(o.width*o.height>4e6?2048:768),overlays:false,gizmos:false,labels:false,grid:false,selection:false,dimensions:false,studioEffects:true,background:o.transparent?'transparent':o.background==='solid'?'solid':'viewport',backgroundColor:o.backgroundColor||'#202020'};
   const frame=await exportImage({scene,view:shown.view,preferences:shown.preferences,size:{width:o.width,height:o.height},time},imageOptions,{signal,renderOwner:owner,encode:false});lastCanvas=frame.canvas;check();
   if(o.format==='gif'){encoder.addFrame(lastCanvas.getContext('2d').getImageData(0,0,o.width,o.height).data,Math.round((i+1)*100/o.fps)-Math.round(i*100/o.fps));if(encoder.bytes>budget)throw Error('GIF exceeds output memory limit.');}
   else if(o.format==='webm'){const frame=new VideoFrame(lastCanvas,{timestamp:Math.round(i*1e6/o.fps),duration:Math.round(1e6/o.fps)});try{encoder.encode(frame,{keyFrame:i%o.fps===0});await encoder.flush();}finally{frame.close();}}
   else{const blob=await new Promise((resolve,reject)=>lastCanvas.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed.')),'image/png'));if(o.format==='png'){return {blob,name:'turret-frame.png',metadata};}const file=new ZipPassThrough(`frame-${String(i).padStart(6,'0')}.png`);zip.add(file);file.push(new Uint8Array(await blob.arrayBuffer()),true);}
   lastCanvas.width=lastCanvas.height=1;lastCanvas=null;onProgress((i+1)/frames,`Frame ${i+1} / ${frames}`);await new Promise(resolve=>setTimeout(resolve,0));
  }
  check();if(zip){zip.end();check();}return {blob:o.format==='gif'?encoder.finish():o.format==='webm'?webmMux(chunks,o.width,o.height,o.fps):new Blob(parts,{type:'application/zip'}),name:`turret-showcase.${o.format==='sequence'?'zip':o.format}`,metadata};
 }finally{if(lastCanvas)lastCanvas.width=lastCanvas.height=1;if(encoder instanceof (globalThis.VideoEncoder||class{} )&&encoder.state!=='closed')encoder.close();zip?.terminate();offline?.dispose();if(acquired)endImageRender(owner,view);runtime.present();if(wasPlaying)runtime.play();}
}
