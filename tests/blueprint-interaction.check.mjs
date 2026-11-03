import {serveWorkspace} from './local-route.mjs';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});await serveWorkspace(page);await page.goto('http://127.0.0.1:5173/src/');
 await page.addStyleTag({url:'http://127.0.0.1:5173/src/export/export.css'});
 await page.evaluate(async()=>{
  const {openBlueprintDialog}=await import('/src/export/blueprint-dialog.js');
  const {imageDefaults}=await import('/src/export/image-options.js');const {area}=await import('/src/layout.js');
  window.renders=0;window.maxConcurrent=0;let active=0;
  window.dialog=openBlueprintDialog(imageDefaults(area().view,800,600,'blueprint'),{
   sourceView:area().view,onApply:()=>{},renderPreview:async()=>{
    window.maxConcurrent=Math.max(window.maxConcurrent,++active);window.renders++;
    await new Promise(r=>setTimeout(r,15));active--;
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;canvas.getContext('2d').fillRect(0,0,800,600);return {canvas};
   }
  });
 });
 await page.waitForFunction(()=>document.querySelector('.blueprint-stage canvas')?.hidden===false);
 const stage=page.locator('.blueprint-stage'),box=await stage.boundingBox();
 await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down({button:'middle'});
 const before=await page.evaluate(()=>window.renders);
 for(let i=0;i<35;i++){await page.mouse.move(box.x+box.width*.4+i*2,box.y+box.height*.4+i);await new Promise(r=>setTimeout(r,5));}
 const during=await page.evaluate(()=>window.renders);await page.mouse.up({button:'middle'});
 assert.ok(during-before>=3,`continuous drag produced ${during-before} renders`);
 assert.equal(await page.evaluate(()=>window.maxConcurrent),1);
 await page.evaluate(()=>window.dialog.close());
 const pixels=await page.evaluate(async()=>{
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{area}=await import('/src/layout.js');
  const {demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret}=await import('/src/turrets/mounts.js');
  const {FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const {captureImage,imageDefaults}=await import('/src/export/image-options.js'),{exportImage}=await import('/src/export/image-pipeline.js');
  const block=makeBlock({typeIndex:20,size:{x:4,y:1,z:4}}),scene={model:makeModel([block]),loaded:true,visible:true,revision:1,hiddenIds:new Set(),selectedIds:new Set()};
  const asset=demoProject().assets[0];asset.sourceSize=1;asset.blocks.forEach(b=>b.color='ffff0000');
  placeTurret(scene,asset,blockSockets(block).find(s=>s.normal[1]===1),1);
  const view=area().view,options={...imageDefaults(view,500,400,'blueprint'),blueprintLayout:'single',camera:'isometric',dimensions:false,titleBlock:false,pageGrid:false};
  const output=await exportImage(captureImage(scene,view,FACTORY_PREFERENCES,{width:500,height:400}),options,{encode:false});
  const bytes=output.canvas.getContext('2d').getImageData(0,0,500,400).data;let red=0,blue=0;
  for(let i=0;i<bytes.length;i+=4){if(bytes[i]>bytes[i+2]*1.5&&bytes[i]>60)red++;if(bytes[i+2]>bytes[i]+20)blue++;}
  output.canvas.id='gpu-result';document.body.append(output.canvas);return {red,blue};
 });
 assert.equal(pixels.red,0);assert.ok(pixels.blue>1000);
 await page.locator('#gpu-result').screenshot({path:'output/turret-blueprint.png'});
 console.log({rendersDuringDrag:during-before,maxConcurrent:1});
}finally{await browser.close();}
