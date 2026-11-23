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
await page.route('**/index.html?editor=*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Asset workspace</body></html>'}));
for(const [module,method,label] of [['components','openComponentWorkspace','Component workspace'],['turrets','openTurretWorkspace','Turret workspace']]){
 await page.evaluate(async({module,method})=>{const api=await import('/src/'+module+'/workspace.js');api[method]({name:'Backdrop test'},()=>{});},{module,method});
 const modal=page.getByRole('dialog',{name:label,exact:true});await modal.waitFor();
 await modal.locator('h2').click();assert.ok(await modal.isVisible());
 await page.mouse.click(2,450);await modal.waitFor({state:'detached'});
}
console.log('Passed: Library and Turret asset dialogs stay open on interior clicks and close on exterior clicks.');
}finally{await browser.close();server.close();}
