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
 await page.addInitScript(()=>{let api;Object.defineProperty(window,'componentWorkspace',{configurable:true,get:()=>api,set:value=>{api=value;const configure=api.configure;api.configure=async(...args)=>{const editor=await configure(...args);window.assetEditor=editor;return editor;};}});});
 await page.locator('[aria-label="Component library"] input[accept=".xml"]').setInputFiles({name:'Test component.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 const workspace=page.getByRole('dialog',{name:'Component workspace'});await workspace.waitFor();await page.waitForFunction(()=>!document.querySelector('.component-workspace [data-save]')?.disabled,null,{timeout:30000});
 const imported=await page.evaluate(async()=>{const {componentLibrary}=await import('/src/components/library.js');return componentLibrary.assets[0];});assert.equal(imported.attachment,null,'new XML does not invent an attachment point');assert.equal(await page.locator('.component-attachment-missing').count(),1);
 const frame=page.frameLocator('iframe[title="Component editor workspace"]'),canvas=frame.locator('canvas[aria-label="3D Avorion viewport"]'),editorFrame=()=>page.frames().find(f=>f.url().includes('editor=component'));
 async function createSocket(button,{refine=false,primaryAction=false}={}){
  await frame.getByRole('button',{name:button,exact:true}).click();let bounds=await canvas.boundingBox();await page.waitForTimeout(100);await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await frame.getByRole('button',{name:'Place Socket',exact:true}).waitFor();assert.equal(await frame.getByRole('button',{name:'Confirm Direction',exact:true}).isVisible(),false);
  const cancel=frame.locator('.socket-direction-actions').getByRole('button',{name:'Cancel',exact:true}),before=await cancel.evaluate(el=>getComputedStyle(el).backgroundColor);await cancel.hover();assert.notEqual(await cancel.evaluate(el=>getComputedStyle(el).backgroundColor),before,'Cancel receives hover highlighting');
  assert.deepEqual(await frame.locator('.socket-direction-actions button:visible').allTextContents(),['Back','Place Socket','Make Attachment Point','Refine Position','Cancel']);
  if(refine){await frame.getByRole('button',{name:'Refine Position',exact:true}).click();await frame.getByLabel('Positioning',{exact:true}).selectOption('free');bounds=await canvas.boundingBox();await page.mouse.click(bounds.x+bounds.width/2+20,bounds.y+bounds.height/2);}
  if(primaryAction)await frame.locator('.socket-direction-actions').getByRole('button',{name:'Make Attachment Point',exact:true}).click();else await frame.getByRole('button',{name:'Place Socket',exact:true}).click();await frame.locator('.socket-edit-strip').waitFor({state:'hidden'});
 }
 await createSocket('Set Attachment Point',{primaryAction:true});let draft=await editorFrame().evaluate(()=>window.assetEditor.snapshot());assert.equal(draft.sockets.length,1);assert.equal(draft.attachmentSocketId,draft.sockets[0].id);assert.ok(draft.attachment.position.every(Number.isFinite));
 await frame.getByLabel('Socket name',{exact:true}).dblclick();await frame.getByLabel('Rename socket',{exact:true}).fill('Ship Mount');await frame.getByLabel('Rename socket',{exact:true}).press('Enter');await frame.getByLabel('Socket name',{exact:true}).filter({hasText:'Ship Mount'}).waitFor();
 await createSocket('Add Socket',{refine:true});draft=await editorFrame().evaluate(()=>window.assetEditor.snapshot());assert.equal(draft.sockets.length,2);assert.equal(draft.attachmentSocketId,draft.sockets[0].id,'adding a socket preserves the primary');assert.equal(draft.sockets[0].name,'Ship Mount');
 const untouched=await page.evaluate(async()=>{const {componentLibrary}=await import('/src/components/library.js');return componentLibrary.assets[0];});assert.equal(untouched.attachment,null,'draft edits do not save the library early');assert.equal(untouched.sockets.length,0);
 await frame.getByLabel('Socket',{exact:true}).selectOption(draft.sockets[1].id);await page.waitForTimeout(100);let bounds=await canvas.boundingBox();await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2,{button:'right'});await frame.locator('.socket-context-menu:visible').getByRole('button',{name:'Make Attachment Point',exact:true}).click({timeout:5000}).catch(async e=>{console.log('Asset menu diagnostics',errors,await frame.locator('.socket-context-menu:visible').allTextContents(),await editorFrame().evaluate(()=>window.assetEditor.snapshot()));await page.screenshot({path:'test-results/images/component-asset-menu-error.png'});throw e;});draft=await editorFrame().evaluate(()=>window.assetEditor.snapshot());assert.equal(draft.attachmentSocketId,draft.sockets[1].id,'context menu promotes an existing socket');
 await page.screenshot({path:'test-results/images/component-asset-sockets.png'});
 await workspace.getByRole('button',{name:'Save asset',exact:true}).click();await workspace.waitFor({state:'detached'});
 const saved=await page.evaluate(async()=>{const {componentLibrary}=await import('/src/components/library.js');return componentLibrary.assets[0];});assert.equal(saved.name,'Test component');assert.equal(saved.sockets.length,2);assert.equal(saved.sockets[0].name,'Ship Mount');assert.equal(saved.attachmentSocketId,draft.sockets[1].id);assert.equal(await page.locator('.component-attachment-missing').count(),0);
 await page.getByRole('button',{name:'Test component',exact:true}).dblclick();await workspace.waitFor();await page.waitForFunction(()=>!document.querySelector('.component-workspace [data-save]')?.disabled);const reopened=await editorFrame().evaluate(()=>window.assetEditor.snapshot());assert.deepEqual(reopened.sockets,saved.sockets);assert.deepEqual(reopened.attachment,saved.attachment);await workspace.getByRole('button',{name:'Cancel',exact:true}).click();await workspace.waitFor({state:'detached'});
 assert.equal(await page.getByRole('button',{name:'Import Component Pack (.json)',exact:true}).isVisible(),false);
 await page.getByText('Library Files',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Import Component Pack (.json)',exact:true}).isVisible(),true);
 assert.deepEqual(errors,[]);console.log('Add XML opens the attachment workspace, face picking and Save asset work, and pack actions are explicitly separated.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
