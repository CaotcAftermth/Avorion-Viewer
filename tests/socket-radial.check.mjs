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
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');
 await page.evaluate(async()=>{
  const {defaults,area}=await import('/src/layout.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{openSessionStore,snapshotModel}=await import('/src/session-persistence.js');
  const state=defaults();state.workspaces[0].root=area();state.active=state.workspaces[0].id;localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state));localStorage.setItem('avorion-viewer.input-style-chosen.v1','1');
  const scene={loaded:true,model:makeModel([makeBlock({id:'test',position:{x:0,y:0,z:0}})])};await openSessionStore().put('model',snapshotModel(scene));
 });
 await page.goto(base+'/index.html');const canvas=page.getByLabel('3D Avorion viewport',{exact:true});await canvas.waitFor();await page.waitForTimeout(1200);const box=await canvas.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{button:'right'});
 const add=page.locator('#menu button').filter({hasText:'Add Socket'});await add.click({timeout:5000}).catch(async e=>{console.log('Radial diagnostics',errors,await page.locator('#menu').textContent());await page.screenshot({path:'test-results/images/socket-radial-error.png'});throw e;});await page.waitForFunction(()=>!document.querySelector('.socket-edit-strip').hidden);
 assert.ok((await canvas.evaluate(el=>el.style.cursor)).endsWith('crosshair'));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('avorion-viewer.window-system.v1')).workspaces[0].root.view.tool==='sockets');
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('avorion-viewer.window-system.v1')));assert.equal(state.workspaces[0].root.view.tool,'sockets');
 const available=await canvas.boundingBox(),pane=await page.locator('.socket-edit-strip').boundingBox();assert.ok(available.x+available.width<=pane.x+.5,'socket pane never overlaps canvas');
 await page.mouse.move(available.x+available.width/2,available.y+available.height/2);await page.waitForTimeout(100);await page.screenshot({path:'test-results/images/socket-face-preview-themed.png'});
 await page.mouse.click(available.x+available.width/2,available.y+available.height/2);assert.equal(await page.getByRole('button',{name:'Confirm Direction',exact:true}).isVisible(),false);await page.getByRole('button',{name:'Refine Position',exact:true}).waitFor();assert.equal(await page.locator('.viewport-toolbar').evaluate(el=>el.inert),true);assert.equal(await page.locator('.navigation').evaluate(el=>el.inert),true);const modeBefore=await page.getByLabel('Interaction mode').inputValue();await canvas.press('Tab');assert.equal(await page.getByLabel('Interaction mode').inputValue(),modeBefore);await page.getByRole('button',{name:'Place Socket',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.socket-edit-strip').hidden);
 assert.equal(await page.locator('.viewport-toolbar').evaluate(el=>el.inert),false);assert.equal(await page.locator('.navigation').evaluate(el=>el.inert),false);
 assert.equal((await canvas.boundingBox()).width,box.width,'closing pane restores canvas width');
 assert.deepEqual(errors,[]);console.log('Object Mode radial Add Socket enters socket placement, previews a face and creates a socket.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
