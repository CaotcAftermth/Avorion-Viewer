import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.VIEWER_TEST_URL||'http://127.0.0.1:5183';
const xml=await readFile(process.env.IMAGE_STRESS_SHIP||'C:/Users/joshu/AppData/Roaming/Avorion/ships/Ship Stress Test.xml','utf8');
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(base+'/tests/image-export.html');
 const result=await page.evaluate(async xml=>{
  const {parseAvorionXml}=await import('/src/block-model.js'),{area}=await import('/src/layout.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const {captureImage,imageDefaults}=await import('/src/export/image-options.js'),{exportImage}=await import('/src/export/image-pipeline.js');
  const model=parseAvorionXml(xml,'Ship Stress Test.xml',xml.length),scene={loaded:true,visible:true,model,revision:1,selectedIds:new Set(),hiddenIds:new Set()},view=area().view;
  const before=new XMLSerializer().serializeToString(model.doc),snapshot=captureImage(scene,view,FACTORY_PREFERENCES,{width:1200,height:900});
  let ticks=0,maxGap=0,last=performance.now();const heartbeat=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},25);
  const started=performance.now();let output;
  try{output=await exportImage(snapshot,{...imageDefaults(view,1200,900,'blueprint'),blueprintLayout:'multi',dimensions:true,supersampling:2,budget:1024});}finally{clearInterval(heartbeat);}
  return {blocks:model.blocks.length,milliseconds:performance.now()-started,ticks,maxGap,bytes:output.blob.size,unchanged:before===new XMLSerializer().serializeToString(model.doc),png:output.canvas.toDataURL()};
 },xml);
 await writeFile('test-results/images/stress-blueprint.png',Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
 console.log(JSON.stringify({result,errors},null,2));assert.ok(result.unchanged&&result.ticks>0&&result.bytes>10000);assert.deepEqual(errors,[]);
}finally{await browser.close();}
