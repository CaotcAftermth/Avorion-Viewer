import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.VIEWER_TEST_URL||'http://127.0.0.1:5183';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'/tests/image-export.html');
 const results=await page.evaluate(async()=>{
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{area}=await import('/src/layout.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const {drawGame}=await import('/src/game-renderer.js'),{ensureViewportOptions}=await import('/src/viewport-options.js');
  const {imageDefaults,captureImage,blueprintSettings,blueprintPanels}=await import('/src/export/image-options.js'),{exportImage}=await import('/src/export/image-pipeline.js');
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  const view=area().view;Object.assign(view,{projection:'orthographic',yaw:.55,pitch:.35,zoom:1,grid:false});
  Object.assign(ensureViewportOptions(view),{shading:'SOLID',showOverlays:false,objectOutline:false,ambientOnly:true,ambientDetail:.35});
  const p={...FACTORY_PREFERENCES,shaderAO:0,shaderBloom:0,vignetteEnabled:false,worldEnabled:false};
  const scene={model:makeModel([makeBlock({color:'ff708090'}),makeBlock({id:'b1',position:{x:1.7,y:1,z:0},typeIndex:100,color:'ff90a0b0'})],'Image fixture.xml'),loaded:true,visible:true,revision:1,selectedIds:new Set(),hiddenIds:new Set()};
  const source=JSON.stringify({view,blocks:scene.model.blocks,revision:scene.revision});
  const options={...imageDefaults(view,320,240),labels:false,gizmos:false,selection:false,overlays:false};
  drawGame(ctx,scene,view,320,240,p,1);const before=ctx.getImageData(0,0,320,240).data;
  const snap=captureImage(scene,view,p,{width:320,height:240});
  const render=(o=options,extra={})=>exportImage(snap,o,extra);
  const output=await render(),pixels=output.canvas.getContext('2d').getImageData(0,0,320,240).data;
  let delta=0;for(let i=0;i<pixels.length;i++)delta+=Math.abs(pixels[i]-before[i]);
  const transparent=await render({...options,type:'transparent',background:'transparent'}),rgba=transparent.canvas.getContext('2d').getImageData(0,0,320,240).data;
  const alpha={clear:0,opaque:0,partial:0};for(let i=3;i<rgba.length;i+=4)alpha[rgba[i]===0?'clear':rgba[i]===255?'opaque':'partial']++;
  const decoded=await createImageBitmap(transparent.blob),decodeCanvas=document.createElement('canvas');decodeCanvas.width=decoded.width;decodeCanvas.height=decoded.height;decodeCanvas.getContext('2d').drawImage(decoded,0,0);decoded.close();
  const decodedAlpha=decodeCanvas.getContext('2d').getImageData(0,0,1,1).data[3];
  const tiled=await render(options,{tileLimit:192}),tilePixels=tiled.canvas.getContext('2d').getImageData(0,0,320,240).data;
  let tileDelta=0;for(let i=0;i<pixels.length;i++)tileDelta+=Math.abs(pixels[i]-tilePixels[i]);
  const blueprint=await render({...options,type:'blueprint',camera:'isometric',framing:'fit',background:'solid',backgroundColor:'#10283f',pageGrid:true,titleBlock:true,shipName:'Image fixture',dimensions:true});
  const custom={...imageDefaults(view,640,480,'blueprint'),blueprintLayout:'multi',pageGrid:false,blueprintSettings:blueprintSettings()};
  custom.blueprintSettings.columnSplit=.65;custom.blueprintSettings.rowSplit=.4;
  custom.blueprintSettings.single={rotation:-35,scale:1.7}; // Single settings must not leak into multi-view panels.
  custom.blueprintSettings.views=[{camera:'bottom',rotation:90,scale:.7},{camera:'back',rotation:-45,scale:.9},{camera:'left',rotation:180,scale:.5},{camera:'isometric',rotation:25,scale:1}];
  custom.blueprintSettings.views[1].orientation={yaw:.7,pitch:.25};custom.blueprintSettings.views[1].pan={x:.08,y:-.1};
  Object.assign(custom.blueprintSettings.views[1],{name:'Engine detail',dimensions:true,dimensionCage:false,dimensionFontSize:30,annotations:[{text:'Main engine',fontSize:28,color:'#ffcc55',x:.12,y:.1,target:{x:.6,y:.55},leader:true,arrow:true}]});
  const customOutput=await render(custom);let customPanelDifference=0;
  const smallFont=structuredClone(custom);smallFont.blueprintSettings.views[1].dimensionFontSize=12;
  const smallOutput=await render(smallFont);
  const largeText=customOutput.canvas.getContext('2d').getImageData(0,0,640,480).data,smallText=smallOutput.canvas.getContext('2d').getImageData(0,0,640,480).data;
  let dimensionFontDifference=0;for(let i=0;i<largeText.length;i++)dimensionFontDifference+=Math.abs(largeText[i]-smallText[i]);
  const hiddenAnnotations=structuredClone(custom);hiddenAnnotations.blueprintSettings.views[1].annotationsVisible=false;
  const withoutAnnotations=await render(hiddenAnnotations);
  const annotated=customOutput.canvas.getContext('2d').getImageData(0,0,640,480).data,unannotated=withoutAnnotations.canvas.getContext('2d').getImageData(0,0,640,480).data;
  let annotationDifference=0;for(let i=0;i<annotated.length;i++)annotationDifference+=Math.abs(annotated[i]-unannotated[i]);
  for(const panel of blueprintPanels(custom)){
    const standalone=await render({...custom,blueprintLayout:'single',width:panel.width,height:panel.height,camera:panel.camera,titleBlock:false,blueprintSettings:{...custom.blueprintSettings,single:{...panel,name:''}}});
    const actual=customOutput.canvas.getContext('2d').getImageData(panel.x,panel.y,panel.width,panel.height).data,expected=standalone.canvas.getContext('2d').getImageData(0,0,panel.width,panel.height).data;
    for(let i=0;i<actual.length;i++)customPanelDifference+=Math.abs(actual[i]-expected[i]);
  }
  const dimensions={...options,camera:'isometric',framing:'fit',dimensions:true,dimensionCage:false};
  const noCage=await render(dimensions),withCage=await render({...dimensions,dimensionCage:true});
  const plain=noCage.canvas.getContext('2d').getImageData(0,0,320,240).data,cage=withCage.canvas.getContext('2d').getImageData(0,0,320,240).data;
  let cageDifference=0;for(let i=0;i<plain.length;i++)cageDifference+=Math.abs(plain[i]-cage[i]);
  const webp=await render({...options,type:'transparent',format:'webp',background:'transparent'});
  const jpeg=await render({...options,format:'jpeg',background:'solid',backgroundColor:'#ffffff'});
  const ss=await render({...options,supersampling:2});
  const abort=new AbortController();let cancelled=false;try{await render(options,{tileLimit:192,signal:abort.signal,onProgress:n=>{if(n>0)abort.abort();}});}catch(e){cancelled=e.name==='AbortError';}
  const restored=JSON.stringify({view,blocks:scene.model.blocks,revision:scene.revision})===source;
  drawGame(ctx,scene,view,320,240,p,1);const after=ctx.getImageData(0,0,320,240).data;
  let restoreDelta=0;for(let i=0;i<after.length;i++)restoreDelta+=Math.abs(after[i]-before[i]);
  return {dimensionFontDifference,annotationDifference,cageDifference,customPanelDifference,meanDifference:delta/pixels.length,tileMeanDifference:tileDelta/pixels.length,restoreMeanDifference:restoreDelta/pixels.length,alpha,decodedAlpha,cancelled,restored,webp:webp.blob.type,jpeg:jpeg.blob.type,ss:[ss.width,ss.height],png:transparent.canvas.toDataURL(),blueprint:blueprint.canvas.toDataURL()};
 });
 await mkdir('test-results/images',{recursive:true});
 for(const [key,name] of [['png','transparent'],['blueprint','blueprint']]){await writeFile(`test-results/images/${name}.png`,Buffer.from(results[key].split(',')[1],'base64'));delete results[key];}
 console.log(JSON.stringify({results,errors},null,2));
 assert.ok(results.meanDifference<1,'viewport parity');assert.ok(results.tileMeanDifference<1,'tile parity');assert.ok(results.restoreMeanDifference<1,'restored viewport');
 assert.equal(results.customPanelDifference,0,'custom multi-view panels match independently rendered orientations, rotations, and scales');
 assert.ok(results.dimensionFontDifference>0,'dimension font size changes the rendered export');
 assert.ok(results.cageDifference>0,'dimension cage toggle changes the rendered export');
 assert.ok(results.annotationDifference>0,'annotations are included in the final export');
 assert.ok(results.alpha.clear>0&&results.alpha.opaque>0&&results.alpha.partial>0);assert.equal(results.decodedAlpha,0);assert.ok(results.cancelled&&results.restored);assert.equal(results.webp,'image/webp');assert.equal(results.jpeg,'image/jpeg');assert.deepEqual(errors,[]);
}finally{await browser.close();}
