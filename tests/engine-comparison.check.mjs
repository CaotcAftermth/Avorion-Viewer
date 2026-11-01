import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/tests/image-export.html');
 const images=await page.evaluate(async()=>{
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{area}=await import('/src/layout.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const {captureImage,imageDefaults}=await import('/src/export/image-options.js'),{exportImage}=await import('/src/export/image-pipeline.js');
  const blocks=[];const add=(x,z,w,depth)=>blocks.push(makeBlock({id:'e'+blocks.length,typeIndex:3,position:{x,y:0,z},size:{x:w,y:w,z:depth},secondaryColor:'ff70baff'}));
  add(-10,0,1,1);for(let i=0;i<10;i++)add(-6,-.45+i*.1,1,.1);
  for(let i=0;i<10;i++){add(-2,-.45+i*.1,(i+1)/10,.1);add(2,-.45+i*.1,(10-i)/10,.1);}
  add(6,0,1,0);add(10,0,2,1);
  const scene={loaded:true,visible:true,model:makeModel(blocks),revision:1,selectedIds:new Set(),hiddenIds:new Set()},view=area().view;
  Object.assign(view,{projection:'orthographic',yaw:0,pitch:Math.PI/2,roll:0,zoom:.4,target:[0,4,0],panX:0,panY:0,grid:false,showThinBlocks:false});
  view.display={shading:'RENDERED',showOverlays:false};
  const output={};for(const [name,state] of [['cruise',1],['boost',2]]){
   const p={...FACTORY_PREFERENCES,shaderEngineState:state,shaderBloom:0,shaderAO:0,shaderSpill:0,shaderThinEnginePlumes:true};
   const snap=captureImage(scene,view,p,{width:960,height:600});snap.time=.7;
   const result=await exportImage(snap,{...imageDefaults(view,960,600),background:'solid',backgroundColor:'#101418',overlays:false,labels:false,gizmos:false,grid:false,selection:false});
   const ctx=result.canvas.getContext('2d');ctx.fillStyle='white';ctx.font='14px sans-serif';ctx.fillText(name.toUpperCase()+' - bloom off - single / 10 layers / tapered stacks / zero depth / wide',20,25);
   output[name]=result.canvas.toDataURL();
  }return output;
 });
 await mkdir('test-results/images',{recursive:true});for(const [name,data] of Object.entries(images))await writeFile('test-results/images/engine-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);console.log('Engine comparison fixtures rendered without shader errors.');
}finally{await browser.close();}
