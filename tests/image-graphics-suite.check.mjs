import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.VIEWER_TEST_URL||'http://127.0.0.1:5183')+'/tests/graphics.html');
 await page.waitForFunction(()=>document.body.dataset.result,{},{timeout:180000});
 const status=await page.locator('#status').textContent(),failures=await page.locator('.fail').allTextContents();console.log(JSON.stringify({status,failures,errors},null,2));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
}finally{await browser.close();}
