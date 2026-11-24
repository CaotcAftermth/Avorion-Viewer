import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {serveWorkspace} from './local-route.mjs';

const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await serveWorkspace(page);
 await page.goto('http://127.0.0.1:5173/');await page.waitForSelector('[data-editor=info]');
 await page.evaluate(async()=>{
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedLog=text;}}});
  const {clearLog,addLog}=await import('/src/app-log.js');clearLog();addLog('First entry','TEST');addLog('Second entry','TEST','warning');
 });
 const info=page.locator('[data-editor=info]'),filter=info.getByRole('button',{name:'Info filter',exact:true}),settings=info.getByRole('button',{name:'Info settings',exact:true}),menu=page.locator('#menu');
 assert.equal(await info.getByRole('button',{name:'Show Activity',exact:true}).count(),0);
 await settings.click();assert.equal(await settings.getAttribute('aria-expanded'),'true');
 await menu.getByRole('menuitemcheckbox',{name:'Newest on Top',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-editor=info] .log-message')?.textContent==='First entry');
 await settings.click();assert.equal(await menu.getByRole('menuitemcheckbox').getAttribute('aria-checked'),'false');
 await menu.getByRole('menuitemcheckbox',{name:'Newest on Top',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-editor=info] .log-message')?.textContent==='Second entry');
 await settings.click();assert.equal(await menu.getByRole('menuitemcheckbox').getAttribute('aria-checked'),'true');await menu.press('Escape');
 assert.equal(await settings.getAttribute('aria-expanded'),'false');
 await filter.click();assert.deepEqual(await menu.locator('[role=menuitemradio]').allTextContents(),['Activity','Problems','Performance']);
 await menu.getByRole('menuitemradio',{name:'Problems',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-editor=info] .info-row').length===1);
 await settings.click();await menu.getByRole('menuitem',{name:'Copy',exact:true}).click();
 assert.match(await page.evaluate(()=>window.copiedLog),/Second entry/);assert.doesNotMatch(await page.evaluate(()=>window.copiedLog),/First entry/);
 await filter.click();await menu.getByRole('menuitemradio',{name:'Performance',exact:true}).click();
 await settings.click();assert.equal(await menu.getByRole('menuitem',{name:'Clear',exact:true}).isDisabled(),true);await menu.press('Escape');
 await filter.click();await menu.getByRole('menuitemradio',{name:'Activity',exact:true}).click();
 await settings.click();await menu.getByRole('menuitem',{name:'Clear',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-editor=info] .info-row').length===0);
 await page.reload();await page.waitForSelector('[data-editor=info]');await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await settings.click();
 assert.equal(await menu.getByRole('menuitemcheckbox').getAttribute('aria-checked'),'true');
 await settings.click();assert.equal(await menu.isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS Info filter/settings menus, ordering, filtered copy, clear, keyboard dismissal and persistence');
}finally{await browser.close();}
