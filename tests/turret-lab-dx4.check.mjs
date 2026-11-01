import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=process.env.DX4_XML||'C:/Users/joshu/AppData/Roaming/Avorion/ships/DX4 AutoCannon.xml',xml=await readFile(source);
const base=process.env.VIEWER_TEST_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/prototypes/turret-lab/');await page.waitForSelector('body[data-ready=true]');
 await page.locator('#import').setInputFiles({name:'DX4 AutoCannon.xml',mimeType:'application/xml',buffer:xml});
 await page.waitForFunction(()=>window.turretLabSnapshot().assets.length===2);
 const current=()=>page.evaluate(()=>window.turretLabSnapshot());
 let p=await current(),asset=p.assets[1];assert.equal(asset.blocks.length,145);assert.equal(asset.sourceSize,null);assert.equal(asset.sourceXml,xml.toString());assert.deepEqual(asset.muzzles,[]);
 assert.ok(asset.blocks.every(b=>asset.parts[b.id]==='base'));
 await mkdir('test-results/turret-lab',{recursive:true});await page.screenshot({path:'test-results/turret-lab/dx4-import.png'});
 // Assign arbitrary fixture blocks only to exercise UI; this is not a claimed DX4 rig.
 await page.getByLabel('Design blocks',{exact:true}).selectOption(['b0','b1']);await page.getByLabel('Assign part',{exact:true}).selectOption('barrel');await page.getByRole('button',{name:'Assign selected',exact:true}).click();
 await page.getByRole('button',{name:'Assign selected as muzzles',exact:true}).click();assert.deepEqual((await current()).assets[1].muzzles,['b0','b1']);
 await page.getByLabel('Design blocks',{exact:true}).selectOption('b0');await page.getByRole('button',{name:'Set Barrel Rotation Point',exact:true}).click();
 p=await current();assert.deepEqual(p.assets[1].pitch.position,['x','y','z'].map(k=>asset.blocks[0].position[k]));
 await page.getByLabel('Design blocks',{exact:true}).selectOption('b2');await page.getByLabel('Assign part',{exact:true}).selectOption('body');await page.getByRole('button',{name:'Assign selected',exact:true}).click();await page.getByRole('button',{name:'Set Body Rotation Point',exact:true}).click();
 await page.getByLabel('Source turret size',{exact:true}).selectOption('0.5');
 await page.getByLabel('Component size guides',{exact:true}).check();
 await page.getByLabel('Design view',{exact:true}).uncheck();await page.getByLabel('Mounted turret',{exact:true}).selectOption('copy-0');await page.getByRole('button',{name:'Detach selected',exact:true}).click();
 await page.getByLabel('Turret design',{exact:true}).selectOption(asset.id);await page.getByLabel('Mount socket',{exact:true}).selectOption('top');await page.getByRole('button',{name:'Attach active design',exact:true}).click();
 await page.getByLabel('Turret Size',{exact:true}).selectOption('1');const scale=page.getByLabel('Viewer scale (%)',{exact:true});await scale.fill('150');await scale.dispatchEvent('change');
 const before=await current(),copy=before.instances.find(i=>i.assetId===asset.id);assert.equal(copy.turretSize,1);assert.equal(copy.scale,1.5);
 await page.waitForSelector('body[data-saved=true]');await page.reload();await page.waitForSelector('body[data-ready=true]');assert.deepEqual(await current(),before);
 assert.deepEqual(errors,[]);console.log('DX4: all 145 blocks and source XML preserved; unspecified size, manual pivots, multiple muzzles, size/scale separation and reload passed. Test assignments are synthetic.');
}finally{await browser.close();}
