import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import {viewerHandler} from './serve.mjs';
const handler=viewerHandler('.');const server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:3});await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#main-menu button').first().waitFor();await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('menuitem',{name:'Welcome',exact:true}).click();await page.locator('#welcome-dialog').screenshot({path:'docs/site/assets/ui-welcome.png'});await page.locator('#welcome-dialog .icon-button').first().click();
await page.evaluate(xml=>{const dt=new DataTransfer();dt.items.add(new File([xml],'Tutorial Courier.xml',{type:'text/xml'}));for(const type of ['dragenter','dragover','drop'])document.querySelector('#screen').dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt}));},await readFile('docs/site/examples/tutorial-ship.xml','utf8'));
await page.waitForFunction(()=>document.querySelector('.ship-name')?.textContent.includes('Tutorial Courier'));await page.waitForTimeout(350);
for(const [selector,name]of [['#topbar','ui-topbar'],['#statusbar','ui-statusbar'],['.area[data-editor="outliner"]','editor-outliner'],['.area[data-editor="properties"]','editor-properties'],['.area[data-editor="info"]','editor-info'],['.area[data-editor="viewport"] .area-header','viewport-header']])await page.locator(selector).first().screenshot({path:`docs/site/assets/${name}.png`});
await page.getByRole('button',{name:'Window',exact:true}).click();await page.getByRole('menuitem',{name:'Open Color Workshop',exact:true}).click();await page.locator('.area[data-editor="color"]').waitFor();await page.locator('.area[data-editor="color"]').first().screenshot({path:'docs/site/assets/editor-color.png'});
const color=page.locator('.area[data-editor="color"]').first();await color.locator('.editor-switch').click();await page.getByRole('menuitem',{name:'Asset Library',exact:true}).click();await page.locator('.area[data-editor="assets"]').first().screenshot({path:'docs/site/assets/editor-assets.png'});
console.log('Captured Welcome, topbar, statusbar and focused editor references.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
