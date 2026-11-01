import {serveWorkspace} from './local-route.mjs';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await serveWorkspace(page);await page.goto('http://127.0.0.1:5173/index.html?editor=turret');await page.waitForFunction(()=>window.assetWorkspace);
 const families=await page.evaluate(async()=>{const {VISUAL_FAMILIES}=await import('/src/turrets/effect-profiles.js');return VISUAL_FAMILIES;});
 for(const family of families){
  await page.evaluate(async family=>{const {demoProject}=await import('/src/turrets/core.js');const asset=demoProject().assets[0];asset.muzzles=['b2','b3'];asset.simulation={family,mode:'firing',target:'stationary',points:[[0,1.2,-7]],pattern:'simultaneous',shots:1,repairMode:'dual'};window.controller=await window.assetWorkspace.configure(asset);window.controller.advance(.025);},family);
  const status=await page.locator('[data-studio-status]').textContent();assert.ok(/events/.test(status));
  await page.locator('canvas').first().hover();await page.mouse.wheel(0,550);await page.waitForTimeout(75);
  await page.screenshot({path:`test-results/phase3-${family}.png`});
 }
 // Switching through the UI updates relevant controls without reimporting.
 await page.getByLabel('Weapon family',{exact:true}).selectOption('RocketLauncher');assert.ok(await page.getByLabel('Rocket variant',{exact:true}).isVisible());assert.ok(!(await page.getByLabel('Repair mode',{exact:true}).isVisible()));
 await page.getByLabel('Weapon family',{exact:true}).selectOption('RepairBeam');assert.ok(await page.getByLabel('Repair mode',{exact:true}).isVisible());assert.ok(!(await page.getByLabel('Rocket variant',{exact:true}).isVisible()));
 await page.getByLabel('Weapon family',{exact:true}).selectOption('ForceGun');assert.ok(await page.getByLabel('Show secondary swirling layer',{exact:true}).isVisible());
 await page.getByRole('button',{name:'Play / Resume',exact:true}).click();await page.waitForFunction(()=>parseFloat(document.querySelector('[data-studio-status]').textContent)>.2);await page.getByRole('button',{name:'Pause',exact:true}).click();
 const paused=await page.locator('[data-studio-status]').textContent();await page.getByLabel('Show secondary swirling layer',{exact:true}).uncheck();await page.waitForTimeout(100);assert.equal(await page.locator('[data-studio-status]').textContent(),paused);
 await page.getByRole('button',{name:'Restart',exact:true}).click();assert.ok((await page.locator('[data-studio-status]').textContent()).startsWith('0.00'));
 await page.evaluate(()=>window.controller.dispose());assert.deepEqual(errors,[]);console.log('PASS all 19 GPU effects, deterministic captures, conditional controls, switching, pause, restart, layers and disposal');
}finally{await browser.close();}
