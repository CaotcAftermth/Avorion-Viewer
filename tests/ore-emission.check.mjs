import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
import {viewerHandler} from '../scripts/serve.mjs';
const handler=viewerHandler('.');const server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(async()=>{
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{drawGame,textureLibrary,releaseGameModel}=await import('/src/game-renderer.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js'),{area}=await import('/src/layout.js'),{ensureViewportOptions}=await import('/src/viewport-options.js');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const scene={model:makeModel([]),loaded:true,visible:true,selected:false,selectedIds:new Set(),hiddenIds:new Set(),revision:0};
  const view={...area().view,yaw:0,pitch:0,zoom:.5,grid:false,projection:'orthographic',target:[0,0,0],panX:0,panY:0};Object.assign(ensureViewportOptions(view),{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#000000',showOverlays:false,objectOutline:false,shadows:false,dof:false,ambientOnly:false});
  const p={...FACTORY_PREFERENCES,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderBloom:0,shaderAO:0,shaderSpill:0,shaderThrust:0,shaderBarrier:0,shaderExposure:0,shaderDebug:0};
  const samples=[];const types=[510,520,540,550,...Array.from({length:8},(_,i)=>560+i)];
  for(const gray of [0,.05,.15,.4,.9]){
   releaseGameModel();textureLibrary.clear();const c=document.createElement('canvas');c.width=c.height=16;const paint=c.getContext('2d');paint.fillStyle=`rgb(${gray*255},${gray*255},${gray*255})`;paint.fillRect(0,0,16,16);const blob=await new Promise(r=>c.toBlob(r));await textureLibrary.loadFiles(['rock.png','melted-rock.png'].map(name=>new File([blob],name,{type:'image/png'})));
   for(const type of types)for(const glow of [0,.1,1]){if(gray===0&&type!==510&&type!==540)continue;scene.model=makeModel([makeBlock({typeIndex:type,materialIndex:2,size:{x:4,y:4,z:4},position:{x:0,y:0,z:0}})]);scene.revision++;drawGame(ctx,scene,view,128,128,{...p,shaderGlow:glow},1);// A twisted-corner silhouette crosses the center pixel; choose an interior sample from its neighborhood.
    const pixels=ctx.getImageData(62,62,5,5).data;let rgb=[0,0,0];for(let i=0;i<pixels.length;i+=4){const candidate=[...pixels.slice(i,i+3)];if(Math.max(...candidate)>Math.max(...rgb))rgb=candidate;}samples.push({type,gray,glow,rgb,peak:Math.max(...rgb)});
    if((type===520||type===550)&&gray===.15&&glow===1){
     const source=ctx.getImageData(0,0,128,128).data;
     drawGame(ctx,scene,view,128,128,{...p,shaderGlow:1,shaderBloom:1},1);
     const bloomed=ctx.getImageData(0,0,128,128).data;let haloPixels=0;
     for(let i=0;i<source.length;i+=4)if(Math.max(...source.slice(i,i+3))<=3&&Math.max(...bloomed.slice(i,i+3))>6)haloPixels++;
     samples.at(-1).haloPixels=haloPixels;
    }}
  }
  releaseGameModel();textureLibrary.clear();return samples;
 });
 await mkdir('test-results',{recursive:true});await writeFile('test-results/ore-emission-pixels.json',JSON.stringify(result,null,2));
 for(const type of [510,520,540,550,...Array.from({length:8},(_,i)=>560+i)]){
  const sample=(gray,glow)=>result.find(s=>s.type===type&&s.gray===gray&&s.glow===glow);
  assert.ok(sample(.05,0).peak<=3,'Glow Strength 0 must remove emission: '+JSON.stringify(sample(.05,0)));
  assert.ok(sample(.05,.1).peak>sample(.05,0).peak+3,'low strength emits: '+type);
  assert.ok(sample(.05,1).peak>sample(.05,.1).peak+3,'strength remains adjustable: '+type);
  if(type===520||type===550||type>=560) assert.ok(sample(.15,1).peak>=250,'Super Rich and Glow Stone deposit cores must reach HDR brightness: '+type);
  else {
   assert.ok(sample(0,1).peak>180,'Rich ore cores must be bright: '+type);
   assert.ok(sample(.15,1).peak<sample(.05,1).peak*.5,'Rich ore must suppress broad mid-level tint: '+type);
  }
  assert.ok(sample(.4,1).peak<sample(.05,1).peak*.35+2,'host-rock emission must be localized: '+type);
  assert.ok(sample(.9,1).peak<=3,'bright base texels must not invert the native deposit mask: '+type);
 }
 for(const type of [520,550]) assert.ok(result.find(s=>s.type===type&&s.haloPixels!==undefined)?.haloPixels>10,'Super Rich stone cores must produce a visible bloom halo: '+type);
 assert.deepEqual(errors,[]);console.log(`Passed ${result.length} GPU pixel samples: all ore/glow-stone shapes respect strength, retain bright Super Rich Stone cores, and localize emission.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
