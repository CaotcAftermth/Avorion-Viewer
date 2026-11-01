import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto((process.env.VIEWER_TEST_URL||'http://127.0.0.1:5183')+'/tests/image-export.html');
 const results=await page.evaluate(async()=>{
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{area}=await import('/src/layout.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const {ensureViewportOptions}=await import('/src/viewport-options.js'),{captureImage,imageDefaults}=await import('/src/export/image-options.js'),{exportImage}=await import('/src/export/image-pipeline.js'),{imageRenderBusy}=await import('/src/game-renderer.js');
  const view=area().view;Object.assign(view,{projection:'perspective',yaw:.7,pitch:.4,zoom:1,panX:17,panY:-11,grid:true});
  Object.assign(ensureViewportOptions(view),{shading:'RENDERED',ambientOnly:false,shadows:true,objectOutline:true,showOverlays:true,dof:false});
  const scene={loaded:true,visible:true,revision:1,selectedIds:new Set(['wall']),hiddenIds:new Set(),model:makeModel([makeBlock({id:'floor',size:{x:8,y:1,z:8},position:{x:0,y:-.5,z:0}}),makeBlock({id:'wall',size:{x:1,y:4,z:8},position:{x:-3.5,y:2,z:0}})])};
  const p={...FACTORY_PREFERENCES,shaderAO:1,shaderAORadius:.25,shaderBloom:0,worldEnabled:false,vignetteEnabled:false};
  const snap=captureImage(scene,view,p,{width:511,height:389}),o={...imageDefaults(view,511,389),gizmos:false,labels:false};
  const pixels=r=>r.canvas.getContext('2d').getImageData(0,0,r.width,r.height).data;
  const full=await exportImage(snap,o),tiled=await exportImage(snap,o,{tileLimit:384});let delta=0;const a=pixels(full),b=pixels(tiled);for(let i=0;i<a.length;i++)delta+=Math.abs(a[i]-b[i]);
  const glassView=structuredClone(view);Object.assign(glassView,{projection:'orthographic',yaw:0,pitch:0,grid:false});Object.assign(glassView.display,{objectOutline:false,shadows:false,showOverlays:false});
  const glassScene={...scene,model:makeModel([makeBlock({typeIndex:170,color:'ffffffff'})]),selectedIds:new Set()};
  const glass=await exportImage(captureImage(glassScene,glassView,{...p,shaderAO:0},{width:320,height:240}),{...imageDefaults(glassView,320,240,'transparent'),gizmos:false,labels:false});
  const center=pixels(glass)[(120*320+160)*4+3];
  const engineView=structuredClone(glassView);Object.assign(engineView,{yaw:Math.PI,target:[0,0,0]});
  const engineScene={...scene,model:makeModel([makeBlock({typeIndex:3,position:{x:0,y:0,z:0}})]),selectedIds:new Set()};
  const engineSnap=captureImage(engineScene,engineView,{...p,shaderAO:0,shaderBloom:1.5,shaderThrust:0},{width:320,height:240});
  const glow=await exportImage(engineSnap,{...imageDefaults(engineView,320,240,'transparent'),gizmos:false,labels:false});let glowCoverage=0;const c=pixels(glow);for(let i=3;i<c.length;i+=4)if(c[i]>0&&c[i]<255)glowCoverage++;
  const bloomOptions={...imageDefaults(engineView,1025,769,'transparent'),gizmos:false,labels:false};
  const bloomFull=await exportImage(engineSnap,bloomOptions,{tileLimit:2048}),bloomTiled=await exportImage(engineSnap,bloomOptions,{tileLimit:1024});
  const bf=pixels(bloomFull),bt=pixels(bloomTiled);let bloomDelta=0;for(let i=0;i<bf.length;i++)bloomDelta+=Math.abs(bf[i]-bt[i]);
  let failed=false;try{await exportImage(snap,o,{onProgress:n=>{if(n>0)throw Error('Injected export failure');}});}catch(e){failed=e.message==='Injected export failure';}
  const recovered=await exportImage(snap,{...o,grid:false,overlays:false,selection:false});
  return {bloomTileMeanDifference:bloomDelta/bf.length,tileMeanDifference:delta/a.length,glassAlpha:center,glowCoverage,failed,unlocked:!imageRenderBusy(),recovered:recovered.blob.size};
 });
 console.log(JSON.stringify(results,null,2));assert.ok(results.tileMeanDifference<2);assert.ok(results.bloomTileMeanDifference<2);assert.ok(results.glassAlpha>0&&results.glassAlpha<255);assert.ok(results.glowCoverage>100);assert.ok(results.failed&&results.unlocked&&results.recovered>0);
}finally{await browser.close();}

