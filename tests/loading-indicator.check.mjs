import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';

// Bind only to loopback and serve the app and test assets from this checkout.
const root=resolve('.'),server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)||!/^\/(src|tests)\//.test(pathname)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');
 await page.addStyleTag({content:await readFile('src/loading-indicator.css','utf8')});
 const result=await page.evaluate(async()=>{
  const {createProgressRing,ringOffset,startLoading}=await import('/src/loading-indicator.js');
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const originalRequest=requestAnimationFrame,originalCancel=cancelAnimationFrame,queue=new Map();let id=0,time=1;
  globalThis.requestAnimationFrame=callback=>{queue.set(++id,callback);return id;};globalThis.cancelAnimationFrame=id=>queue.delete(id);
  const step=(delta=16)=>{time+=delta;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(f=>f(time));};
  const finish=()=>{for(let i=0;i<45;i++)step();};
  try{
   const ring=createProgressRing();document.body.append(ring.element);ring.set(55);step();step();
   let shown=Number(ring.element.getAttribute('aria-valuenow'));assert(shown>0&&shown<55,'large milestone must interpolate');
   const before=shown;step(5000);shown=Number(ring.element.getAttribute('aria-valuenow'));assert(shown-before<=9,'blocked main thread must not skip to target');
   const offset=Number(ring.element.querySelector('.progress-ring-arc').style.strokeDashoffset);assert(Math.abs(offset-ringOffset(shown))<2,'arc and number stay synchronized');finish();assert(ring.element.textContent==='55%','target reached');
   ring.set(null);assert(ring.element.classList.contains('indeterminate')&&!ring.element.hasAttribute('aria-valuenow'),'unknown work uses spinner');
   const task=startLoading('Loading',{delay:0});task.update(22);finish();const overlay=document.querySelector('#loading-indicator'),value=()=>Number(overlay.querySelector('[role=progressbar]').getAttribute('aria-valuenow'));
   assert(value()===22,'first stage');task.update(55);step();step();assert(value()>22&&value()<55,'next stage interpolates');finish();task.update(30);finish();assert(value()===55,'same task never goes backwards');task.update(90);finish();
   task.done();assert(!overlay.hidden,'completion remains visible');finish();assert(value()===100,'completion reaches full ring');
   const next=startLoading('Next task',{percent:5,delay:0});finish();assert(value()===5,'new task resets independently');next.done();finish();
   await new Promise(r=>setTimeout(r,800));assert(overlay.hidden,'overlay closes after completion');
   return 'Milestone interpolation, stalled-frame recovery, synchronized arc/label, monotonic stages, overlap/reset, completion and spinner passed';
  }finally{globalThis.requestAnimationFrame=originalRequest;globalThis.cancelAnimationFrame=originalCancel;}
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(async()=>{const {createProgressRing}=await import('/src/loading-indicator.js');const ring=createProgressRing();ring.set(75);return ring.element.textContent;}),'75%');
 assert.deepEqual(errors,[]);console.log(result,'Reduced motion passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
