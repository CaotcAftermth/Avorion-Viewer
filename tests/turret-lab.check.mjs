import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const base=process.env.VIEWER_TEST_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))remote.push(r.url());});
 await page.goto(base+'/prototypes/turret-lab/');await page.waitForSelector('body[data-ready=true]');
 const snapshot=()=>page.evaluate(()=>window.turretLabSnapshot());
 const field=async(name,value)=>{const input=page.getByLabel(name,{exact:true});await input.fill(String(value));await input.dispatchEvent('change');};
 const saved=async()=>{for(let n=0;n<100;n++){if(await page.evaluate(()=>document.body.dataset.saved==='true'))return;await new Promise(r=>setTimeout(r,50));}throw Error('Local save did not finish');};
 assert.equal((await snapshot()).instances.length,4);
 await page.locator('#lower').click();assert.equal((await snapshot()).instances[0].pitch,-15);
 await page.locator('#upper').click();assert.equal((await snapshot()).instances[0].pitch,90);
 await field('Upper pitch limit (deg)',60);assert.equal((await snapshot()).instances[0].pitch,60);
 assert.equal(await page.getByLabel('Barrel elevation (deg)',{exact:true}).getAttribute('max'),'60');
 await saved();await page.reload();await page.waitForSelector('body[data-ready=true]');
 assert.equal((await snapshot()).assets[0].pitch.limits.max,60);
 await page.locator('#neutral').click();assert.equal((await snapshot()).instances[0].pitch,0);
 await field('Upper pitch limit (deg)',90);

 await field('Viewer scale (%)',250);await field('Body rotation (deg)',40);await field('Barrel elevation (deg)',25);
 await page.getByLabel('Override barrel color',{exact:true}).check();await field('barrel color','#ed7755');
 const edited=await snapshot();assert.equal(edited.instances[0].scale,2.5);assert.equal(edited.instances[1].scale,1);assert.equal(edited.instances[0].colors.barrel,'#ed7755');assert.deepEqual(edited.instances[1].colors,{});
 await page.getByRole('button',{name:'Frame all',exact:true}).click();await saved();
 await mkdir('test-results/turret-lab',{recursive:true});await page.screenshot({path:'test-results/turret-lab/mounted.png'});
 const download=async(button,path)=>{const waiting=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();const file=await waiting;await file.saveAs(path);return readFile(path);};
 const projectBytes=await download('Save project','test-results/turret-lab/project.json');assert.deepEqual(JSON.parse(projectBytes.toString()),edited);
 const stl=await download('Export posed STL','test-results/turret-lab/posed.stl');assert.equal((stl.toString().match(/facet normal/g)||[]).length,204);assert.ok(!stl.toString().includes('NaN'));
 const png=await download('Export PNG','test-results/turret-lab/posed.png');assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.length>10000);
 await page.reload();await page.waitForSelector('body[data-ready=true]');assert.deepEqual(await snapshot(),edited);
 const stlReload=await download('Export posed STL','test-results/turret-lab/reloaded.stl');assert.deepEqual(stlReload,stl);
 await page.getByRole('button',{name:'Reset demo',exact:true}).click();
 await page.locator('#open').setInputFiles({name:'project.json',mimeType:'application/json',buffer:projectBytes});await saved();assert.deepEqual(await snapshot(),edited);
 const xml='<turretDesign><plan><block index="2" material="0" lx="-1" ly="0" lz="-1" ux="1" uy="1" uz="1" look="1" up="3" color="ff987654" custom="preserved"/></plan></turretDesign>';
 await page.locator('#import').setInputFiles({name:'Fixture turret.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await page.waitForFunction(()=>window.turretLabSnapshot().assets.length===2);
 assert.ok(await page.getByLabel('Design view',{exact:true}).isChecked());assert.equal((await snapshot()).assets[1].sourceXml,xml);
 await page.getByLabel('Design blocks',{exact:true}).selectOption('b0');await page.getByLabel('Assign part',{exact:true}).selectOption('body');await page.getByRole('button',{name:'Assign selected',exact:true}).click();
 assert.equal((await snapshot()).assets[1].parts.b0,'body');
 await page.getByLabel('Design view',{exact:true}).uncheck();
 await page.getByLabel('Mounted turret',{exact:true}).selectOption('copy-0');await page.getByRole('button',{name:'Detach selected',exact:true}).click();
 const imported=(await snapshot()).assets[1];await page.getByLabel('Turret design',{exact:true}).selectOption(imported.id);await page.getByLabel('Mount socket',{exact:true}).selectOption('top');await page.getByRole('button',{name:'Attach active design',exact:true}).click();
 assert.equal((await snapshot()).instances.find(i=>i.socketId==='top').assetId,imported.id);
 const beforeInvalid=await snapshot();await page.locator('#open').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":999}')});await page.waitForSelector('#status[data-error=true]');assert.deepEqual(await snapshot(),beforeInvalid);
 // A new ship clears old mounts, then a ray-picked face produces an oriented socket.
 const ship='<ship><block index="2" material="0" lx="-5" ly="-2" lz="-3" ux="5" uy="2" uz="3" color="ff668899"/></ship>';
 await page.locator('#ship').setInputFiles({name:'Hull.xml',mimeType:'application/xml',buffer:Buffer.from(ship)});await page.waitForFunction(()=>window.turretLabSnapshot().ship.name==='Hull.xml');
 await page.locator('canvas').click();await page.getByRole('button',{name:'Create socket on selected face',exact:true}).click();await page.getByRole('button',{name:'Attach active design',exact:true}).click();
 const surface=await snapshot();assert.equal(surface.sockets.length,1);assert.equal(surface.instances.length,1);
 await page.screenshot({path:'test-results/turret-lab/surface-mount.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 // Main application storage is never created by the lab.
 const databases=await page.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));assert.deepEqual(databases,['avorion-viewer.turret-lab.v1']);
 console.log('Turret Lab: isolated storage, import, rig assignment, surface snapping, per-copy scale/color/pose, project save/reload, identical STL, PNG and invalid-file recovery passed.');
}finally{await browser.close();}
