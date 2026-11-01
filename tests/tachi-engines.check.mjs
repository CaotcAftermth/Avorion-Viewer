import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const xml=await readFile(process.env.TACHI_XML||'C:/Users/joshu/Downloads/Avorion Viewer/Test ships/Tachi.xml','utf8');
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('http://127.0.0.1:5173/tests/image-export.html');
 const result=await page.evaluate(async xml=>{
  const {parseAvorionXml}=await import('/src/block-model.js'),{area}=await import('/src/layout.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const {captureImage,imageDefaults}=await import('/src/export/image-options.js'),{exportImage}=await import('/src/export/image-pipeline.js');
  const model=parseAvorionXml(xml,'Tachi.xml',xml.length),before=new XMLSerializer().serializeToString(model.doc),scene={loaded:true,visible:true,model,revision:1,selectedIds:new Set(),hiddenIds:new Set()},view=area().view;
  view.display={shading:'RENDERED',showOverlays:false};view.showThinBlocks=false;
  const outputs={},stats={};
  for(const [label,camera] of [['side','right'],['rear','back'],['perspective','current']])for(const [mode,state] of [['cruise',1],['boost',2]]){
   view.yaw=Math.PI*.70;view.pitch=.18;view.projection='perspective';
   const p={...FACTORY_PREFERENCES,shaderEngineState:state,shaderThinEnginePlumes:true};
   const snap=captureImage(scene,view,p,{width:800,height:600});snap.time=1.2;
   const o={...imageDefaults(view,800,600),camera,framing:'fit',margin:.18,background:'solid',backgroundColor:'#101418',overlays:false,labels:false,gizmos:false,grid:false,selection:false};
   const image=await exportImage(snap,o),pixels=image.canvas.getContext('2d').getImageData(0,0,800,600).data;
   let bright=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>180&&pixels[i+1]>180&&pixels[i+2]>180)bright++;
   outputs[label+'-'+mode]=image.canvas.toDataURL();stats[label+'-'+mode]=bright;image.canvas.width=image.canvas.height=1;
  }
  return {outputs,stats,blocks:model.blocks.length,engines:model.blocks.filter(b=>b.typeIndex===3).length,unchanged:before===new XMLSerializer().serializeToString(model.doc)};
 },xml);
 await mkdir('test-results/images',{recursive:true});for(const [name,data] of Object.entries(result.outputs))await writeFile('test-results/images/tachi-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));delete result.outputs;
 console.log(JSON.stringify({result,errors},null,2));assert.ok(result.unchanged);assert.ok(result.stats['rear-boost']>result.stats['rear-cruise']);assert.deepEqual(errors,[]);
}finally{await browser.close();}
