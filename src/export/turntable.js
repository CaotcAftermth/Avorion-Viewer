import {visibleFrameBlocks} from '../model-framing.js';
import {GIF_MAX_SIDE,GIF_MAX_FRAME_PIXELS} from './gif-limits.js';
import {exportImage,imageView} from './image-pipeline.js';
import {beginImageRender,endImageRender} from '../game-renderer.js';
import {liveBlocks,viewportHiddenIds} from '../ship-structure.js';
import {nativeToView} from '../block-model.js';
import {metrics,basis} from '../navigation.js';
import {validateImageOptions,imageFilename} from './image-options.js';
import {GifEncoder} from './gif-encoder.js';

export function validateTurntable(o,blocks=0){
  const plan=validateImageOptions({...o,type:'viewport',format:'png'},undefined,blocks);
  if(!Number.isFinite(o.duration)||o.duration<1||o.duration>20)throw Error('GIF duration must be 1–20 seconds.');
  if(!Number.isInteger(o.fps)||o.fps<5||o.fps>30)throw Error('GIF frame rate must be 5–30 fps.');
  if(!['clockwise','counterclockwise'].includes(o.direction))throw Error('Choose a rotation direction.');
  if(o.elevation!==undefined&&(!Number.isFinite(o.elevation)||o.elevation < -90||o.elevation > 90))throw Error('Camera elevation must be between -90 and 90 degrees.');
  const frames=Math.round(o.duration*o.fps);
  if(o.width>GIF_MAX_SIDE||o.height>GIF_MAX_SIDE||o.width*o.height*frames>GIF_MAX_FRAME_PIXELS)throw Error('GIF exceeds the 2,048-pixel / 160-million-frame-pixel limit. Reduce resolution, duration, or frame rate.');
  return {...plan,frames};
}

export function turntableCamera(snapshot,o){
  const {view}=imageView(snapshot,{...o,type:'viewport',format:'png',framing:'contain',projection:o.projection==='current'?snapshot.view.projection:o.projection});
  if(o.elevation!==undefined)view.pitch=o.elevation*Math.PI/180;
  const blocks=visibleFrameBlocks(snapshot.scene,view),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const b of blocks)for(let i=0;i<3;i++){
    const key=['x','y','z'][i];min[i]=Math.min(min[i],b.position[key]-b.size[key]/2);max[i]=Math.max(max[i],b.position[key]+b.size[key]/2);
  }
  if(!snapshot.scene.visible||!Number.isFinite(min[0]))throw Error('No visible ship geometry to rotate.');
  view.target=nativeToView(min.map((v,i)=>(v+max[i])/2));view.panX=view.panY=0;
  const focal=metrics(view,o.width,o.height).focal,camera=basis(view);
  let distance=.00001,depth=.00001;
  // Fit every visible block corner over a continuous revolution. The maximum
  // of a rotating point dotted with a vector is r*hypot(v.x,v.y)+z*v.z.
  // One fixed distance avoids breathing or clipping between animation frames.
  for(const b of blocks)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
    const point=nativeToView([b.position.x+x*b.size.x,b.position.y+y*b.size.y,b.position.z+z*b.size.z]).map((v,i)=>v-view.target[i]);
    const r=Math.hypot(point[0],point[1]),support=v=>r*Math.hypot(v[0],v[1])+point[2]*v[2];
    depth=Math.max(depth,support(camera.back));
    for(const [axis,pixels] of [[camera.right,o.width],[camera.up,o.height]])for(const sign of [-1,1]){
      const k=focal/(pixels*(.5-o.margin));
      distance=Math.max(distance,support(axis.map((v,i)=>sign*k*v+(view.projection==='perspective'?camera.back[i]:0))));
    }
  }
  distance=Math.max(distance,view.projection==='perspective'?depth+.0001:0);
  view.zoom=10/distance;view.orthographicDistance=Math.max(distance,depth+1);
  view.display.clipStart=Math.min(view.display.clipStart,.00001);view.display.clipEnd=Math.max(view.display.clipEnd,view.orthographicDistance+depth*2+2);
  return view;
}

export async function exportTurntable(snapshot,o,{signal,onProgress=()=>{}}={}){
  const {frames}=validateTurntable(o,snapshot.scene.model.blocks.length),owner={};
  const view=turntableCamera(snapshot,o),yaw=view.yaw,encoder=new GifEncoder(o.width,o.height,o.background==='solid'?o.backgroundColor:null,o.background==='transparent');
  const frameSnapshot={...snapshot,preferences:{...snapshot.preferences,...(o.background==='solid'?{vignetteEnabled:false}:{})},view,size:{width:o.width,height:o.height}};
  const frameOptions={...o,type:'viewport',format:'png',camera:'current',projection:'current',framing:'contain',gizmos:false,labels:false};
  let acquired=false,lastCanvas;
  const check=()=>{if(signal?.aborted)throw new DOMException('GIF export cancelled.','AbortError');};
  try{
    check();await beginImageRender(owner,signal);acquired=true;
    for(let i=0;i<frames;i++){
      check();view.yaw=yaw+(o.direction==='clockwise'?1:-1)*2*Math.PI*i/frames;
      const frame=await exportImage(frameSnapshot,frameOptions,{signal,renderOwner:owner,encode:false});lastCanvas=frame.canvas;
      check();const rgba=lastCanvas.getContext('2d').getImageData(0,0,o.width,o.height).data;
      encoder.addFrame(rgba,Math.round((i+1)*100/o.fps)-Math.round(i*100/o.fps));
      if(encoder.bytes>Math.min(128*1024**2,o.budget*1024**2/4))throw Error('GIF output exceeds the memory limit. Reduce resolution or duration.');
      if(i<frames-1){lastCanvas.width=lastCanvas.height=1;lastCanvas=null;}
      onProgress(Math.round((i+1)/frames*100),`Rendering GIF frame ${i+1} / ${frames}...`);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    check();return {blob:encoder.finish(),canvas:lastCanvas,width:o.width,height:o.height,name:imageFilename(snapshot.scene.model.fileName,'turntable','gif')};
  }catch(error){if(lastCanvas)lastCanvas.width=lastCanvas.height=1;throw error;}
  finally{if(acquired)endImageRender(owner,view);}
}
