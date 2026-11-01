import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');
 await page.getByLabel('Scene properties',{exact:true}).click();
 const scene=page.locator('.scene-properties');assert.equal(await scene.locator('[data-summary=total]').textContent(),'1');assert.equal(await scene.locator('[data-summary=meters]').textContent(),'20 x 20 x 20');
 await page.getByLabel('Scene engine state',{exact:true}).selectOption('2');
 const stored=await page.evaluate(()=>Object.entries(localStorage).some(([k,v])=>v.includes('"shaderEngineState":2')));assert.ok(stored);
 await scene.getByRole('button',{name:'Image Export',exact:true}).click();assert.ok(await page.locator('.image-export').isVisible());assert.equal(await page.getByLabel('Export type',{exact:true}).inputValue(),'viewport');await page.getByLabel('Close export',{exact:true}).click();
 await scene.getByRole('button',{name:'Turntable GIF',exact:true}).click();assert.ok(await page.locator('.image-export').isVisible());assert.equal(await page.getByLabel('Export type',{exact:true}).inputValue(),'turntable');await page.getByLabel('Close export',{exact:true}).click();
 await page.reload();await page.getByLabel('Scene properties',{exact:true}).click();assert.equal(await page.getByLabel('Scene engine state',{exact:true}).inputValue(),'2');assert.deepEqual(errors,[]);
 console.log('Scene summary, engine preference persistence and direct image/GIF capture passed.');
}finally{await browser.close();}
