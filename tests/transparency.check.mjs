import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {serveWorkspace} from './local-route.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:650}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/Shader Error|GL_INVALID_OPERATION/.test(m.text()))errors.push(m.text());});
 await serveWorkspace(page);
 let stacked=false;
 await page.route('**/src/fixtures/texture_checks0.xml',async route=>{
  const block=(id,x,z)=>`<item parent="${id===0?-1:0}" index="${id}"><block lx="${x}" ly="-2" lz="${z}" ux="${x+4}" uy="2" uz="${z+1}" index="170" material="1" look="1" up="3" color="ffbfbfbf" secondaryColor="00000000"/></item>`;
  await route.fulfill({contentType:'application/xml',body:'<ship_design><plan>'+block(0,-2,0)+block(1,6,4)+(stacked?block(2,-2,4):'')+'</plan></ship_design>'});
 });
 async function sample(typeIndex, overlap){
  stacked=overlap;
  await page.goto('http://127.0.0.1:5173/?editor=texture-assignments');
  await page.waitForFunction(()=>window.textureAssignments);
  await page.evaluate(typeIndex=>window.textureAssignments.configure([],null,{typeIndex,materialIndex:1},[],()=>{}),typeIndex);
  const canvas=page.locator('[data-editor=viewport] canvas').first();
  const shot=await canvas.screenshot();
  return page.evaluate(async img=>{
    const bitmap=await createImageBitmap(await (await fetch('data:image/png;base64,'+img)).blob());
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');
    ctx.drawImage(bitmap,0,0);
    const data=ctx.getImageData(Math.round(bitmap.width*.68),Math.round(bitmap.height*.5),7,7).data;
    return Array.from(data);
  },shot.toString('base64'));
 }
 for(const id of [170,190]){
  const single=await sample(id,false),double=await sample(id,true);
  assert.deepEqual(double,single,'overlap changes color for '+id);
  console.log(id,'identical');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}

