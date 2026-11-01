import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 const layout=await page.evaluate(async()=>{
  const {defaults,area,split}=await import('/src/layout.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret}=await import('/src/turrets/mounts.js'),{openSessionStore,snapshotModel}=await import('/src/session-persistence.js');
  const state=defaults(),p=area('properties'),vp=area();p.propertyTab='turrets';vp.view.zoom=.18;state.workspaces[0].root=split('x',.7,vp,p);
  const blocks=[makeBlock({id:'hull',position:{x:0,y:-1,z:0},size:{x:12,y:2,z:14}}),makeBlock({id:'tower',position:{x:0,y:2,z:0},size:{x:2,y:4,z:3}}),...[-4,4].map((x,i)=>makeBlock({id:'mount'+i,typeIndex:20,position:{x,y:0,z:0},size:{x:2,y:1,z:2}}))];
  const scene={loaded:true,model:makeModel(blocks)},asset=demoProject().assets[0];for(const b of blocks.slice(2))placeTurret(scene,asset,blockSockets(b).find(s=>s.normal[1]>.9),1);
  await openSessionStore().put('model',snapshotModel(scene));return state;
 });
 await page.addInitScript(state=>localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state)),layout);await page.reload();
 await page.getByLabel('Show Weapon Coverage',{exact:true}).check();await page.getByLabel('Visualization',{exact:true}).selectOption('sphere');
 await page.getByLabel('Sampling Quality',{exact:true}).selectOption('medium');await page.getByRole('button',{name:'Frame coverage',exact:true}).click();await page.waitForTimeout(1200);
 await page.getByLabel('Show Grid',{exact:true}).check();await page.getByLabel('Inspect coverage points',{exact:true}).check();
 const canvas=page.locator('[data-editor="viewport"] canvas').first(),box=await canvas.boundingBox();await page.mouse.click(box.x+box.width*.53,box.y+box.height*.47);await page.waitForTimeout(200);
 assert.ok(await page.getByRole('button',{name:'Select contributing turrets',exact:true}).count(),'sphere click exposes contributor inspection');
 await page.screenshot({path:'test-results/weapon-coverage-sphere.png'});
 await page.getByRole('button',{name:'Select contributing turrets',exact:true}).click();
 await page.getByText('Selected turret · user-defined aiming',{exact:true}).click();
 await page.getByLabel('Turret coverage group',{exact:true}).fill('Dorsal');await page.getByLabel('Turret coverage group',{exact:true}).dispatchEvent('change');
 await page.getByLabel('Azimuth half-width',{exact:true}).fill('120');await page.getByLabel('Azimuth half-width',{exact:true}).dispatchEvent('change');
 await page.getByLabel('Turret Selection',{exact:true}).selectOption('group');await page.getByLabel('Coverage group',{exact:true}).selectOption('Dorsal');await page.waitForTimeout(500);
 await page.getByLabel('Turret Selection',{exact:true}).selectOption('all');await page.waitForTimeout(500);
 await page.mouse.click(box.x+box.width*.53,box.y+box.height*.47);await page.waitForTimeout(100);

 await page.getByRole('button',{name:'Open slice through inspected point',exact:true}).click();assert.equal(await page.getByLabel('Visualization',{exact:true}).inputValue(),'slice');
 await page.getByRole('button',{name:'Top firing view',exact:true}).click();await page.getByLabel('Slice position (Y)',{exact:true}).fill('3');await page.getByLabel('Slice position (Y)',{exact:true}).dispatchEvent('change');await page.waitForTimeout(800);
 await page.getByLabel('Coverage Display',{exact:true}).selectOption('blind');await page.screenshot({path:'test-results/weapon-coverage-slice.png'});
 assert.deepEqual(errors,[],'main app has no browser exceptions');
 // Isolated scene uses the same persistent worker service as the main viewport.
 const stats=await page.evaluate(async()=>{
  const {ensureCoverage,currentCoverage}=await import('/src/turrets/coverage-state.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret}=await import('/src/turrets/mounts.js');
  const blocks=[];for(let x=0;x<50;x++)for(let z=0;z<100;z++)blocks.push(makeBlock({id:`h${x}-${z}`,position:{x:x*2-50,y:-2,z:z*2-100}}));
  const mounts=Array.from({length:20},(_,i)=>makeBlock({id:'m'+i,typeIndex:20,position:{x:i%5*18-36,y:0,z:Math.floor(i/5)*40-60}}));blocks.push(...mounts);
  const scene={loaded:true,visible:true,revision:0,model:makeModel(blocks),showFireCoverage:true,weaponCoverage:{mode:'sphere',quality:'medium'}};
  const asset=demoProject().assets[0];for(const b of mounts)placeTurret(scene,asset,blockSockets(b).find(s=>s.normal[1]>.9),1);
  const wait=()=>new Promise((resolve,reject)=>{const started=performance.now(),timer=setInterval(()=>{const s=currentCoverage(scene);if(s?.error){clearInterval(timer);reject(Error(s.status));}else if(s?.final){clearInterval(timer);resolve(s);}else if(performance.now()-started>90000){clearInterval(timer);reject(Error('Worker timeout'));}},20);});
  let ticks=0;const heartbeat=setInterval(()=>ticks++,10),start=performance.now();ensureCoverage(scene);await wait();const elapsed=performance.now()-start,s=currentCoverage(scene),count=s.requests;
  scene.weaponCoverage.opacity=.2;scene.weaponCoverage.metric='potential';scene.weaponCoverage.showShip=false;ensureCoverage(scene);if(s.requests!==count)throw Error('Presentation change recalculated geometry');
  scene.weaponCoverage.mode='slice';scene.weaponCoverage.quality='high';ensureCoverage(scene);scene.weaponCoverage.offset=12;scene.weaponCoverage.quality='low';ensureCoverage(scene);await wait();
  if(s.result.offset!==12||s.result.quality!=='low')throw Error('Stale results overwrote final settings');
  scene.hiddenIds=new Set(['h0-0']);const old=s.requests;ensureCoverage(scene);if(s.requests!==old+1)throw Error('Hidden obstacle rule failed to invalidate');await wait();
  scene.weaponCoverage.offset=0;scene.weaponCoverage.quality='medium';const sliceStart=performance.now();ensureCoverage(scene);await wait();
  if(!s.result.polar||s.result.polar.partial||!s.result.cells.some(c=>c.kind==='arc')||!s.result.cells.some(c=>c.kind==='field'))throw Error('Polar slice missing');
  const sliceMs=Math.round(performance.now()-sliceStart),polar=s.result.polar,polarWarnings=s.result.warnings;
  // Same slice through the legacy 2D field, for a like-for-like timing.
  scene.weaponCoverage.sliceStyle='legacy';const legacyStart=performance.now();ensureCoverage(scene);await wait();
  if(!s.result.refinement||s.result.cells[0].vertices.length!==3)throw Error('Legacy adaptive slice missing');
  const legacySliceMs=Math.round(performance.now()-legacyStart);
  const output={sliceMs,legacySliceMs,polar:{evaluations:polar.evaluations,limited:polar.limited,fieldBearings:polar.fieldBearings},polarWarnings,refinement:s.result.refinement,blocks:blocks.length,turrets:20,mediumSphereMs:Math.round(elapsed),mainThreadTimerTicks:ticks,requests:s.requests,samples:s.result.samples.length,warnings:s.result.warnings};
  clearInterval(heartbeat);scene.showFireCoverage=false;ensureCoverage(scene);if(currentCoverage(scene))throw Error('Coverage worker not disposed');return output;
 });assert.ok(stats.mainThreadTimerTicks>10);assert.deepEqual(stats.warnings,stats.refinement.limited?['Boundary refinement budget reached; remaining edges are approximate']:[]);assert.deepEqual(stats.polarWarnings,stats.polar.limited?['Safety cap on slice evaluations reached; remaining edges are approximate']:[]);assert.deepEqual(errors,[]);console.log('PASS main UI sphere/slices/inspection; cache, cancellation, visibility invalidation; '+JSON.stringify(stats));
}finally{await browser.close();}
