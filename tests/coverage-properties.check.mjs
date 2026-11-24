import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {serveWorkspace} from './local-route.mjs';

const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await serveWorkspace(page);
 await page.goto('http://127.0.0.1:5173/');await page.waitForSelector('.property-tabs button');
 await page.evaluate(async()=>{
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret,selectTurrets}=await import('/src/turrets/mounts.js'),{mountTurretProperties}=await import('/src/turrets/properties.js'),{mountCoverageControls}=await import('/src/turrets/coverage-ui.js');
  const scene={loaded:true,model:makeModel([makeBlock({typeIndex:20})])},asset=demoProject().assets[0];asset.sourceSize=1;
  const sockets=blockSockets(scene.model.blocks[0]);placeTurret(scene,asset,sockets[0],1);placeTurret(scene,asset,sockets[1],1);selectTurrets(scene,scene.model.turretMounts[0].id);
  scene.model.turretMounts[0].coverage={fixed:false};scene.weaponCoverage={autoScale:true};
  const host=document.createElement('div');host.id='coverage-proof';host.style.cssText='position:fixed;inset:0;background:#333;overflow:auto;z-index:999999';document.body.append(host);
  const proof=window.proof={scene,tab:'turrets'};
  const draw=proof.draw=()=>{host.replaceChildren();if(proof.tab==='turrets')mountTurretProperties(host,scene,draw,()=>true,()=>{proof.tab='coverage';draw();});else mountCoverageControls(host,scene,draw);host.querySelectorAll('details').forEach(d=>d.open=true);};draw();
 });
 const host=page.locator('#coverage-proof'),field=name=>host.getByLabel(name,{exact:true});
 assert.equal(await field('Enabled for coverage').count(),0);
 await host.getByRole('button',{name:'Edit coverage assumptions',exact:true}).click();
 assert.equal(await field('Selected turret').inputValue(),await page.evaluate(()=>proof.scene.selectedTurretId));
 const section=async name=>field(name).evaluate(el=>el.closest('details').querySelector('summary').textContent);
 assert.deepEqual(await host.locator(':scope > details > summary').allTextContents(),['Coverage','Turret Settings','Results','Advanced']);
 for(const name of ['Show Ship','Show Grid','Show Structural Obstructions','Show only overlapping clear coverage'])assert.equal(await section(name),'Display Options');
 assert.equal(await section('Enabled for coverage'),'Turret Settings');assert.equal(await section('Turret field color'),'Turret Settings');
 assert.equal(await host.getByRole('button',{name:'Select contributing turrets',exact:true}).count(),0);
 assert.equal(await host.getByRole('button',{name:'Export coverage CSV',exact:true}).isVisible(),false);
 assert.equal(await host.getByRole('button',{name:'Save as comparison baseline',exact:true}).isVisible(),false);
 await field('Coverage Display').selectOption('blind');assert.equal(await field('Show only overlapping clear coverage').count(),0);
 await field('Coverage Display').selectOption('clear');assert.equal(await field('Show only overlapping clear coverage').count(),1);
 assert.equal(await field('Count scale upper bound').count(),0);await field('Automatic count color scale').uncheck();
 await field('Count scale upper bound').fill('12');await field('Count scale upper bound').dispatchEvent('change');
 await field('Automatic count color scale').check();assert.equal(await field('Count scale upper bound').count(),0);await field('Automatic count color scale').uncheck();assert.equal(await field('Count scale upper bound').inputValue(),'12');
 assert.equal(await field('Fixed weapon spread (half-angle °)').count(),0);await field('Fixed aiming (coaxial assumption)').check();
 await field('Fixed weapon spread (half-angle °)').fill('7');await field('Fixed weapon spread (half-angle °)').dispatchEvent('change');
 await field('Fixed aiming (coaxial assumption)').uncheck();assert.equal(await field('Fixed weapon spread (half-angle °)').count(),0);await field('Fixed aiming (coaxial assumption)').check();assert.equal(await field('Fixed weapon spread (half-angle °)').inputValue(),'7');
 await field('Turret field color').fill('#123456');await field('Turret field color').dispatchEvent('change');
 const ids=await page.evaluate(()=>proof.scene.model.turretMounts.map(m=>m.id));await field('Selected turret').selectOption(ids[1]);
 await field('Turret coverage group').fill('Rear');await field('Turret coverage group').dispatchEvent('change');
 const state=await page.evaluate(()=>({mounts:proof.scene.model.turretMounts.map(m=>m.coverage),colors:proof.scene.weaponCoverage.colors}));
 assert.equal(state.mounts[0].spread,7);assert.equal(state.mounts[1].group,'Rear');assert.equal(state.colors[ids[0]],'#123456');
 await field('Selected turret').selectOption('');assert.equal(await field('Enabled for coverage').count(),0);assert.equal(await field('Turret field color').count(),0);
 await field('Slice style').selectOption('legacy');assert.equal(await field('Individual turret colors').count(),1);
 await field('Visualization').selectOption('sphere');assert.equal(await field('Sphere radius').count(),1);assert.equal(await field('Slice style').count(),0);
 await page.evaluate(async()=>{
  const {ensureCoverage,currentCoverage}=await import('/src/turrets/coverage-state.js');proof.currentCoverage=currentCoverage;
  proof.scene.showFireCoverage=true;proof.scene.revision=0;proof.scene.weaponCoverage.quality='low';ensureCoverage(proof.scene);
 });
 await page.waitForFunction(()=>proof.currentCoverage(proof.scene)?.final,{},{timeout:20000});
 assert.equal(await host.getByRole('button',{name:'Save as comparison baseline',exact:true}).isVisible(),true);
 assert.equal(await host.getByRole('button',{name:'Export coverage CSV',exact:true}).isVisible(),true);
 await page.evaluate(()=>{const r=proof.currentCoverage(proof.scene).result;proof.scene.coverageInspection={index:0,sample:r.samples[0],center:r.center};proof.draw();});
 assert.equal(await host.getByRole('button',{name:'Select contributing turrets',exact:true}).isVisible(),true);
 await host.getByRole('button',{name:'Open slice through inspected point',exact:true}).click();assert.equal(await field('Visualization').inputValue(),'slice');
 await page.evaluate(async()=>{
  proof.scene.coverageInspection=null;proof.scene.showFireCoverage=false;proof.scene.weaponCoverage.mode='sphere';proof.draw();
  const {ensureCoverage}=await import('/src/turrets/coverage-state.js');ensureCoverage(proof.scene);
  const host=document.querySelector('#coverage-proof');host.style.width='520px';host.style.left='auto';host.querySelectorAll('details').forEach(d=>d.open=d.querySelector('summary').textContent==='Coverage');
  const {layoutPropertyRows}=await import('/src/property-rows.js');layoutPropertyRows(host);
 });
 await page.screenshot({path:'test-results/coverage-streamlined.png'});
 assert.deepEqual(errors,[]);console.log('PASS coverage sections, shortcut, turret selection, per-turret edits, conditional fields and retained values');
}finally{await browser.close();}
