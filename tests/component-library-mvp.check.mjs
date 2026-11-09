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
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');await page.addStyleTag({content:await readFile('src/styles.css','utf8')});
 await page.evaluate(async()=>{
  const base=document.createElement('base');base.href='/';document.head.append(base);
  const {mountComponentLibrary}=await import('/src/components/library.js');
  const host=document.createElement('div');host.setAttribute('aria-label','Component library');host.style.height='400px';document.body.append(host);window.library=mountComponentLibrary(host,()=>{});
 });
 const xml='<plan><item index="0"><block index="2" material="3" look="1" up="3" color="ff696969" lx="-.5" ly="0" lz="-.5" ux=".5" uy="1" uz=".5"/></item></plan>';
 await page.locator('[aria-label="Component library"] input[accept=".xml"]').setInputFiles({name:'Test component.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 const workspace=page.getByRole('dialog',{name:'Component workspace'});await workspace.waitFor();await workspace.getByRole('button',{name:'Save asset',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.component-workspace [data-save]')?.disabled,null,{timeout:30000});
 await page.screenshot({path:'test-results/images/component-attachment-workspace.png'});
 const frame=page.frameLocator('iframe[title="Component editor workspace"]');
 await frame.getByRole('button',{name:'Set Attachment Point',exact:true}).click();
 const canvas=frame.locator('canvas[aria-label="3D Avorion viewport"]');await canvas.waitFor();const bounds=await canvas.boundingBox();await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 await workspace.getByRole('button',{name:'Save asset',exact:true}).click();await workspace.waitFor({state:'detached'});
 const saved=await page.evaluate(async()=>{const {componentLibrary}=await import('/src/components/library.js');return componentLibrary.assets[0];});assert.equal(saved.name,'Test component');assert.ok(saved.attachment.position.every(Number.isFinite));
 assert.equal(await page.getByRole('button',{name:'Import Component Pack (.json)',exact:true}).isVisible(),false);
 await page.getByText('Library Files',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Import Component Pack (.json)',exact:true}).isVisible(),true);
 assert.deepEqual(errors,[]);console.log('Add XML opens the attachment workspace, face picking and Save asset work, and pack actions are explicitly separated.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
