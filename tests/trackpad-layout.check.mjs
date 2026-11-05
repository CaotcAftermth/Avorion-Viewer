import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {serveWorkspace} from './local-route.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1300,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await serveWorkspace(page);await page.goto('http://127.0.0.1:5173/');
 await page.locator('#welcome-dialog [data-style=trackpad]').click();await page.locator('#welcome-dialog .icon-button').first().click();
 await page.locator('.trackpad-stage').waitFor();
 const box=await page.locator('#screen').boundingBox();await page.mouse.click(box.x+box.width-2,box.y+90);
 await page.locator('.trackpad-drawer.open [data-editor=properties]').waitFor({state:'visible'});
 await page.mouse.click(box.x+box.width*.2,box.y+box.height*.8);assert.equal(await page.locator('.trackpad-drawer.open').count(),0);
 await page.locator('.trackpad-edge[data-side=bottom]').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.trackpad-drawer.open').count(),0);
 await page.reload();await page.locator('.trackpad-stage').waitFor();assert.equal(await page.locator('.trackpad-drawer.open').count(),0);assert.deepEqual(errors,[]);console.log('PASS welcome selection, viewport expansion, edge reveal, dismissal, Escape and persisted Trackpad mode');
}finally{await browser.close();}
