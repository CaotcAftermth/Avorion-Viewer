import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {viewerHandler} from './serve.mjs';
await mkdir('test-results/manual-animation',{recursive:true});
const handler=viewerHandler('.');const server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:760}});await page.addInitScript(()=>localStorage.setItem('avorion-viewer.input-style-chosen.v1','1'));await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#main-menu button').first().waitFor();await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 await page.evaluate(xml=>{const dt=new DataTransfer();dt.items.add(new File([xml],'Tutorial Courier.xml',{type:'text/xml'}));for(const type of ['dragenter','dragover','drop'])document.querySelector('#screen').dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt}));},await readFile('docs/site/examples/tutorial-ship.xml','utf8'));
 await page.waitForFunction(()=>document.querySelector('.ship-name')?.textContent.includes('Tutorial Courier'));await page.waitForTimeout(500);
 const divider=page.locator('.divider[aria-orientation="vertical"]').first();const box=await divider.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.screenshot({path:'docs/site/assets/resize-poster.png'});await page.screenshot({path:'test-results/manual-animation/00.png'});
 await page.mouse.down();for(let i=1;i<=10;i++){await page.mouse.move(box.x+box.width/2-220*Math.sin(i/10*Math.PI),box.y+box.height/2);await page.waitForTimeout(70);await page.screenshot({path:`test-results/manual-animation/${String(i).padStart(2,'0')}.png`});}await page.mouse.up();
 const python=process.platform==='win32'?'.venv-docs/Scripts/python.exe':'.venv-docs/bin/python';
 const code="from PIL import Image; from pathlib import Path; frames=[Image.open(p).convert('RGB') for p in sorted(Path('test-results/manual-animation').glob('*.png'))]; frames[0].save('docs/site/assets/resize-areas.gif',save_all=True,append_images=frames[1:],duration=[800]+[140]*(len(frames)-2)+[1000],loop=0,optimize=True)";
 await new Promise((resolve,reject)=>{const child=spawn(python,['-c',code],{stdio:'inherit'});child.on('error',reject);child.on('exit',c=>c===0?resolve():reject(Error('GIF encoding failed')));});
 console.log('Captured divider-resize GIF and static poster.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
