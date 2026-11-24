import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {viewerHandler} from '../scripts/serve.mjs';
const handler=viewerHandler(process.cwd());const server=http.createServer((req,res)=>{req.headers.host='127.0.0.1:5173';if(req.headers.origin)req.headers.origin='http://127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
const page=await browser.newPage({viewport:{width:900,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/color-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
await page.goto(`http://127.0.0.1:${server.address().port}/color-harness`);
await page.setContent('<link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/color-editor.css"><section class="area" data-editor="assets" style="width:800px;height:800px"><header class="area-header"><span class="header-name">Asset Library</span></header><div id="test" style="width:800px;height:750px"></div></section>');
const xml=n=>`<ship><plan><item index="0"><block lx="0" ly="0" lz="0" ux="${n}" uy="2" uz="2" index="2" material="0" look="1" up="3" color="ff336699"/></item></plan></ship>`;
for(const kind of ['turrets','components']){
 await page.evaluate(async kind=>{window.controller?.dispose();document.querySelector('#test').replaceChildren();const {mountAttachmentLibrary}=await import('/src/attachment-library.js');window.controller=mountAttachmentLibrary(document.querySelector('#test'),{id:'test',assetKind:kind},{},()=>{});},kind);
 const label=kind==='turrets'?'Import turret XML':'Import component XML';
 await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'Import XML files…',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Import folder…',exact:true}).isVisible());await page.keyboard.press('Escape');
 const payload=[{name:'Loose.xml',path:'',xml:xml(2)},{name:'Second.xml',path:'',xml:xml(5)},{name:'Zulu.xml',path:'Zulu/Zulu.xml',xml:xml(3)},{name:'Alpha.xml',path:'Alpha/nested/Alpha.xml',xml:xml(4)}];
 await page.evaluate(payload=>{const input=[...document.querySelectorAll('#test input[type=file]')].find(el=>el.webkitdirectory),dt=new DataTransfer();for(const item of payload){const f=new File([item.xml],item.name,{type:'text/xml'});Object.defineProperty(f,'webkitRelativePath',{value:item.path});dt.items.add(f);}input.files=dt.files;input.dispatchEvent(new Event('change'));},payload);
 await page.waitForFunction(()=>document.querySelector('#test [role=status]')?.textContent.includes('Imported 4'));
 assert.deepEqual(await page.locator('#test>.turret-asset-grid>.asset-folder-card>.turret-asset-name').allTextContents(),['Alpha','Zulu']);
 assert.equal(await page.locator('.asset-folder-count').first().innerText(),'1');
 await page.locator('.asset-folder-tile img').first().evaluate(img=>img.decode());
 await page.screenshot({path:`test-results/folder-cards-${kind}.png`});
 assert.equal(await page.locator('#test>.turret-asset-grid>.turret-asset-card:not(.asset-folder-card)').count(),2);
 await page.getByRole('button',{name:'Open folder Alpha',exact:true}).click();
 await page.getByRole('button',{name:'Open folder nested',exact:true}).click();
 await page.getByRole('button',{name:'Up one level',exact:true}).click();assert.equal(await page.locator('.asset-library-path').innerText(),'/ Alpha');
 await page.getByRole('button',{name:'Open folder nested',exact:true}).click();
 assert.equal(await page.locator('.area-header .asset-library-path').innerText(),'/ Alpha/nested');assert.equal(await page.locator('.asset-library-path').getAttribute('title'),'/ Alpha/nested');assert.equal(await page.locator('#test .asset-folder-nav').count(),0);
 assert.ok(await page.getByRole('button',{name:kind==='turrets'?'Alpha.xml':'Alpha',exact:true}).isVisible());
 assert.equal(await page.locator('#test>.turret-asset-grid').evaluate(el=>el.lastElementChild.getAttribute('aria-label')),label);
 await page.getByRole('button',{name:label,exact:true}).click();
 await page.getByRole('button',{name:'Move from library…',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Move from library',exact:true});await modal.waitFor();
 assert.equal(await modal.locator('canvas').count(),2);
 await modal.getByRole('button',{name:kind==='turrets'?'Loose.xml':'Loose',exact:true}).click();
 assert.equal(await modal.locator('[data-count]').innerText(),'1 selected');
 await modal.getByRole('button',{name:'Select all',exact:true}).click();assert.equal(await modal.locator('[data-count]').innerText(),'2 selected');
 await modal.getByRole('button',{name:'Clear selection',exact:true}).click();assert.ok(await modal.getByRole('button',{name:'Move selected',exact:true}).isDisabled());
 await modal.getByRole('button',{name:'Select all',exact:true}).click();
 await page.screenshot({path:`test-results/move-assets-modal-${kind}.png`});
 await modal.getByRole('button',{name:'Move selected',exact:true}).click();await modal.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.querySelectorAll('#test>.turret-asset-grid>.turret-asset-card').length===3);
 const moved=await page.evaluate(async kind=>{const lib=kind==='turrets'?(await import('/src/turrets/library.js')).turretLibrary:(await import('/src/components/library.js')).componentLibrary;return lib.assets.find(a=>a.name.startsWith('Loose')).folder;},kind);assert.equal(moved,'Alpha/nested');
 const art=page.locator('.asset-folder-tile img');
 await page.screenshot({path:`test-results/import-folders-${kind}.png`});
}
assert.deepEqual(errors,[]);console.log('Passed: both import menus, XML batch import, persisted folder paths, alphabetical folders before loose assets, expandable folder contents.');
}finally{await browser.close();server.close();}
