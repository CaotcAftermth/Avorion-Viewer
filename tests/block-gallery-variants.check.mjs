import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';

// Bind only to loopback and serve the app and test assets from this checkout.
const root=resolve('.'),server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)||!/^\/(src|tests)\/|^\/index.html$/.test(pathname)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.html':'text/html','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');
 await page.evaluate(async()=>{
  const {defaults,area,split}=await import('/src/layout.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{openSessionStore,snapshotModel}=await import('/src/session-persistence.js'),{BLOCK_GALLERY_NAME}=await import('/src/block-gallery.js');
  const state=defaults();state.workspaces[0].root=split('x',.7,area(),area('properties'));state.active=state.workspaces[0].id;localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state));localStorage.setItem('avorion-viewer.input-style-chosen.v1','1');
  const scene={loaded:true,preview:true,model:makeModel([makeBlock({id:'gallery-hull',position:{x:0,y:0,z:0}})],BLOCK_GALLERY_NAME)};await openSessionStore().put('model',snapshotModel(scene));
 });
 await page.goto(base+'/index.html');const canvas=page.getByLabel('3D Avorion viewport',{exact:true});await canvas.waitFor();await page.waitForTimeout(1200);const box=await canvas.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await page.locator('.block-variants').waitFor();assert.equal(await page.locator('.block-variant-row').count(),8);assert.equal(await page.locator('.block-variant-row canvas').count(),8);
 assert.equal(await page.locator('.object-data + .block-variants').count(),1,'Variants follows Object Data');
 await page.screenshot({path:'test-results/images/block-gallery-variants.png'});
 await page.getByRole('button',{name:'Edge variant',exact:true}).dblclick();const dialog=page.getByRole('dialog',{name:'Block workspace',exact:true});await dialog.waitFor();await dialog.getByRole('button',{name:'Apply to gallery',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.block-workspace [data-save]').disabled);
 assert.equal(await dialog.locator('h2').textContent(),await page.evaluate(async()=>{const {getBlockDefinition}=await import('/src/block-model.js');return getBlockDefinition(100).displayName;}));await page.screenshot({path:'test-results/images/block-gallery-edge-workspace.png'});
 await dialog.getByRole('button',{name:'Apply to gallery',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Edge variant',exact:true}).getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);console.log('Gallery Object Data variants show geometry previews; double-click opens correct variant and Apply updates gallery.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
