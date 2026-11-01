import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
// Statistics, layout baseline comparison, data export and persisted display
// settings in the main app.
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 const layout=await page.evaluate(async()=>{
  const {defaults,area,split}=await import('/src/layout.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret}=await import('/src/turrets/mounts.js'),{openSessionStore,snapshotModel}=await import('/src/session-persistence.js');
  const state=defaults(),p=area('properties'),vp=area();p.propertyTab='turrets';vp.view.zoom=.18;state.workspaces[0].root=split('x',.7,vp,p);
  const blocks=[makeBlock({id:'hull',position:{x:0,y:-1,z:0},size:{x:12,y:2,z:14}}),...[-4,4].map((x,i)=>makeBlock({id:'mount'+i,typeIndex:20,position:{x,y:0,z:0},size:{x:2,y:1,z:2}}))];
  const scene={loaded:true,model:makeModel(blocks)},asset=demoProject().assets[0];for(const b of blocks.slice(1))placeTurret(scene,asset,blockSockets(b).find(s=>s.normal[1]>.9),1);
  await openSessionStore().put('model',snapshotModel(scene));return state;
 });
 await page.addInitScript(state=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state));sessionStorage.setItem('seeded','1');}},layout);await page.reload();
 await page.getByLabel('Show Weapon Coverage',{exact:true}).check();await page.getByLabel('Visualization',{exact:true}).selectOption('sphere');
 await page.getByLabel('Sampling Quality',{exact:true}).selectOption('low');await page.waitForTimeout(1500);
 await page.getByText('Statistics and comparison',{exact:true}).click();
 const stats=page.getByText(/^All directions: \d+% covered/);await stats.waitFor({timeout:20000});
 assert.ok(await page.getByText(/^Top \(\+Y\): \d+% covered/).count(),'per-direction statistics are listed');
 await page.getByRole('button',{name:'Save as comparison baseline',exact:true}).click();
 assert.ok(await page.getByText(/^Baseline “Baseline/).count(),'baseline saved');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export coverage CSV',exact:true}).click();const csv=await download;
 const csvText=await (await csv.createReadStream()).toArray().then(parts=>Buffer.concat(parts).toString());assert.match(csvText,/^x,y,z,dir_x/);assert.equal(csvText.trim().split('\n').length,81,'low globe exports 80 targets plus a header');
 const jsonDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export coverage JSON',exact:true}).click();const json=JSON.parse(await (await (await jsonDownload).createReadStream()).toArray().then(parts=>Buffer.concat(parts).toString()));
 assert.equal(json.format,'avorion-weapon-coverage');assert.equal(json.samples.length,80);
 // Per-direction change against the saved spherical baseline.
 await page.getByLabel('Coverage Display',{exact:true}).selectOption('difference');await page.waitForTimeout(300);
 await page.screenshot({path:'test-results/weapon-coverage-difference.png'});
 assert.deepEqual(errors,[],'no browser exceptions');
 // Display settings persist with the ship session.
 await page.waitForTimeout(800);await page.reload();await page.waitForTimeout(1500);
 assert.equal(await page.getByLabel('Show Weapon Coverage',{exact:true}).isChecked(),true,'coverage visibility restored');
 assert.equal(await page.getByLabel('Visualization',{exact:true}).inputValue(),'sphere');
 assert.equal(await page.getByLabel('Coverage Display',{exact:true}).inputValue(),'difference');
 assert.equal(await page.getByLabel('Sampling Quality',{exact:true}).inputValue(),'low');
 // The Statistics section stays open across the reload (app panel state).
 assert.equal(await page.locator('details',{has:page.getByText('Statistics and comparison',{exact:true})}).last().evaluate(d=>d.open),true,'section open state restored');
 await page.getByText(/^Baseline “Baseline/).waitFor({timeout:20000});
 assert.deepEqual(errors,[]);console.log('PASS coverage statistics, baseline, CSV/JSON export, persisted display settings');
}finally{await browser.close();}
