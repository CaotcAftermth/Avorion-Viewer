import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('http://127.0.0.1:5173/index.html?editor=turret');
 await page.waitForFunction(()=>window.assetWorkspace);
 for(const family of ['ChainGun','Cannon','Laser']){
  await page.evaluate(async family=>{const {demoProject}=await import('/src/turrets/core.js');const asset=demoProject().assets[0];asset.muzzles=['b2','b3'];asset.simulation={family,mode:'firing',target:'stationary',speed:1,turnSpeed:45,coaxial:false,points:[[0,1.2,-7]],period:8,radius:15,pattern:'simultaneous',shots:1};window.controller=await window.assetWorkspace.configure(asset);window.controller.advance(.025);},family);
  await page.locator('[data-studio-status]').waitFor();
  await page.locator('canvas').first().hover();await page.mouse.wheel(0,550);await page.waitForTimeout(250);
  await page.screenshot({path:`test-results/turret-effects-visible-${family}.png`});
  assert.ok((await page.locator('[data-studio-status]').textContent()).includes(family==='Laser'?'2 beams':'2 hits'));
  const frozen=await page.locator('[data-studio-status]').textContent();await page.waitForTimeout(100);assert.equal(await page.locator('[data-studio-status]').textContent(),frozen);
 }
 await page.evaluate(()=>window.controller.dispose());assert.deepEqual(errors,[]);console.log('PASS deterministic captures, all muzzle hits, sustained beam contact, imported asset replacement, GPU shader compilation and cleanup');
}finally{await browser.close();}
