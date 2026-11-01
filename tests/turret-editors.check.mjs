import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret,selectTurrets}=await import('/src/turrets/mounts.js'),{mountPoseEditor,mountTurretOutliner,mountFireControls}=await import('/src/turrets/editors.js');
  const scene={loaded:true,model:makeModel([makeBlock({typeIndex:20})])},asset=demoProject().assets[0];asset.sourceSize=1;const sockets=blockSockets(scene.model.blocks[0]);placeTurret(scene,asset,sockets[0],1);placeTurret(scene,asset,sockets[1],1);
  const host=document.createElement('div');host.id='edit-proof';host.style.cssText='position:fixed;inset:0;z-index:99999;background:#303030;overflow:auto';document.body.append(host);window.editScene=scene;
  const draw=()=>{host.replaceChildren();mountTurretOutliner(host,scene,draw);mountFireControls(host,scene,draw);mountPoseEditor(host,scene,draw);};selectTurrets(scene,scene.model.turretMounts[0].id);draw();
 });
 const host=page.locator('#edit-proof');await host.getByLabel('Body rotation',{exact:true}).fill('45');await host.getByLabel('Body rotation',{exact:true}).dispatchEvent('change');await host.getByLabel('Turret size',{exact:true}).fill('0.5');await host.getByLabel('Turret size',{exact:true}).dispatchEvent('change');await host.getByRole('button',{name:'Upper',exact:true}).click();await host.getByRole('button',{name:'Copy pose and size',exact:true}).click();
 const ids=await page.evaluate(()=>window.editScene.model.turretMounts.map(m=>m.id));await host.getByLabel('Rename turret '+ids[1],{exact:true}).fill('Second mount');await host.getByLabel('Rename turret '+ids[1],{exact:true}).dispatchEvent('change');await host.getByRole('button',{name:'Second mount',exact:true}).click();await host.getByRole('button',{name:'Paste pose and size',exact:true}).click();
 const result=await page.evaluate(()=>window.editScene.model.turretMounts[1]);assert.equal(result.pitch,90);assert.equal(result.yaw,45);assert.equal(result.turretSize,.5);await host.getByRole('button',{name:'Hide',exact:true}).last().click();assert.equal(await page.evaluate(()=>window.editScene.model.turretMounts[1].hidden),true);await host.getByLabel('Show Weapon Coverage',{exact:true}).check();
 const coverage=await page.evaluate(async()=>{
  const {ensureCoverage,currentCoverage}=await import('/src/turrets/coverage-state.js');const scene=window.editScene;scene.revision=0;scene.weaponCoverage={quality:'low',mode:'sphere'};ensureCoverage(scene);
  await new Promise((resolve,reject)=>{const start=performance.now(),timer=setInterval(()=>{const s=currentCoverage(scene);if(s.final){clearInterval(timer);resolve();}else if(s.error||performance.now()-start>15000){clearInterval(timer);reject(Error(s.status));}},20);});
  const result=currentCoverage(scene).result;scene.showFireCoverage=false;ensureCoverage(scene);return result;
 });assert.equal(coverage.samples.length,80);assert.ok(coverage.samples.every(s=>s.potential===s.clear+s.obstructed));assert.deepEqual(errors,[]);console.log('PASS pose fields, presets, Outliner rename/selection/hide, pose and size copy/paste, coverage worker');
}finally{await browser.close();}

