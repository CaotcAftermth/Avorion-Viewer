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
await page.setContent('<link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/color-editor.css"><div id="test" style="width:450px;height:800px"></div>');
await page.evaluate(async()=>{const {mountColorEditor}=await import('/src/color-editor.js');mountColorEditor(document.querySelector('#test'),{id:'test'},{selectedIds:new Set(),regions:[]},{save(){},changed(){},brushChanged(){}});});
await page.getByRole('tab',{name:'Wheel',exact:true}).waitFor();
for(const width of [450,300]){
await page.locator('#test').evaluate((el,w)=>el.style.width=w+'px',width);
const rail=await page.getByRole('tablist').boundingBox(),panel=await page.getByRole('tabpanel').boundingBox();assert.ok(rail.width<=36);assert.ok(panel.x>=rail.x+rail.width-1);
for(const name of ['Wheel','List','Palettes','Regions']){const tab=page.getByRole('tab',{name,exact:true});await tab.click();assert.equal(await tab.locator('svg').count(),1);assert.equal(await tab.innerText(),'');assert.equal(await tab.getAttribute('aria-selected'),'true');assert.equal(await page.getByRole('button',{name:'Apply…',exact:true}).count(),name==='Regions'?1:0);}
await page.getByRole('tab',{name:'Wheel',exact:true}).click();await page.screenshot({path:`test-results/color-tabs-${width}.png`});
}
await page.getByRole('tab',{name:'Wheel',exact:true}).focus();await page.keyboard.press('ArrowDown');assert.equal(await page.getByRole('tab',{name:'List',exact:true}).getAttribute('aria-selected'),'true');assert.deepEqual(errors,[]);console.log('Passed: left rail at 450/300px, four SVG icons, switching, Regions-only Apply, keyboard navigation, no page errors.');
}finally{await browser.close();server.close();}
