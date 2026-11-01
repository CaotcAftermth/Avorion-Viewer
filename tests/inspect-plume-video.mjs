import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const dir=resolve('test-results/plume-reference');
await writeFile(dir+'/inspect.html','<video muted src="reference.mp4"></video>');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage();await page.goto(pathToFileURL(dir+'/inspect.html').href);
await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
const result=await page.evaluate(async()=>{const v=document.querySelector('video'),duration=v.duration,w=v.videoWidth,h=v.videoHeight;const times=[16,17,18,19,20,21,22,23,40,41,42,43,44,45,46,47],c=document.createElement('canvas');c.width=1280;c.height=4*344;const ctx=c.getContext('2d');
for(let i=0;i<times.length;i++){const t=times[i];await new Promise(r=>{v.onseeked=r;v.currentTime=t;});const x=i%4*320,y=Math.floor(i/4)*344;ctx.drawImage(v,300,300,480,480,x,y,320,320);ctx.fillStyle='#111';ctx.fillRect(x,y+320,320,24);ctx.fillStyle='white';ctx.font='16px sans-serif';ctx.fillText(t.toFixed(1)+'s',x+8,y+338);}
v.remove();document.body.style.margin='0';document.body.append(c);return {duration,width:w,height:h};});await page.locator('canvas').screenshot({path:dir+'/detail.png'});console.log(result);
}finally{await browser.close();}
