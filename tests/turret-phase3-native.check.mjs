import {serveWorkspace} from './local-route.mjs';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const xml=await readFile('C:/Users/joshu/Downloads/Avorion Viewer/Test ships/turrets/Craft 2_turret2.xml','utf8');
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await serveWorkspace(page);await page.goto('http://127.0.0.1:5173/index.html?editor=turret');await page.waitForFunction(()=>window.assetWorkspace);
 const imported=await page.evaluate(async xml=>{const {importTurretXml}=await import('/src/turrets/core.js');const a=importTurretXml(xml,'Craft 2_turret2.xml','native');window.testAsset=a;return {blocks:a.blocks.length,muzzles:a.muzzlePositions.length};},xml);assert.ok(imported.blocks>=250);assert.ok(imported.muzzles>=3);
 for(const family of ['PlasmaGun','RocketLauncher','LightningGun','RepairBeam','ForceGun','AntiFighter']){
  const snapshot=await page.evaluate(async family=>{const a=structuredClone(window.testAsset);a.simulation={family,mode:'both',target:'orbit',repairMode:'dual',guidance:'guided',pattern:'simultaneous'};window.controller=await window.assetWorkspace.configure(a);window.controller.advance(family==='AntiFighter'?1.1:.1);return window.controller.snapshot();},family);
  assert.equal(snapshot.sourceXml,xml);assert.deepEqual(snapshot.blocks.map(b=>b.position),await page.evaluate(()=>window.testAsset.blocks.map(b=>b.position)));
 }
 await page.screenshot({path:'test-results/phase3-native-custom.png'});
 // Isolated renderer proves real WebGL geometry disposal and stable pool reuse.
 const gpu=await page.evaluate(async()=>{
  const T=await import('/src/vendor/three.module.js'),{WeaponEffectsRenderer}=await import('/src/turrets/effect-renderer.js'),{WeaponEffectsSimulation}=await import('/src/turrets/effect-simulation.js'),{VISUAL_FAMILIES}=await import('/src/turrets/effect-profiles.js');
  const renderer=new T.WebGLRenderer({antialias:false}),scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.1,3000);renderer.setSize(128,128);camera.position.set(8,8,15);camera.lookAt(0,0,0);const pool=new WeaponEffectsRenderer(),e=new WeaponEffectsSimulation('Laser'),m={position:[0,0,0],direction:[0,0,-1],right:[1,0,0],localScale:1},runtime={effects:e,muzzles:[m],settings:{}};scene.add(pool.group);
  const passes=[];for(let round=0;round<3;round++){for(const family of VISUAL_FAMILIES){e.reset(family,1,{repairMode:'dual'});if(e.profile.continuous)e.consume({type:'activate',channel:0});else e.consume({type:'shot',time:0,muzzle:0,muzzleFrame:m});e.update(.02,[m],[0,0,-8]);pool.update(runtime);renderer.render(scene,camera);}passes.push({...renderer.info.memory,programs:renderer.info.programs.length,beamPool:pool.beams.length});}
  pool.dispose();renderer.render(scene,camera);const after={...renderer.info.memory,programs:renderer.info.programs.length};renderer.dispose();return {passes,after};
 });assert.deepEqual(gpu.passes[1],gpu.passes[2]);assert.equal(gpu.after.geometries,0);assert.equal(gpu.after.programs,0);await writeFile('test-results/phase3-gpu-resources.json',JSON.stringify({imported,gpu},null,2));
 await page.evaluate(()=>window.controller.dispose());assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS native XML preservation, complex design, replacement, all-family WebGL resource plateau and disposal',imported,gpu}));
}finally{await browser.close();}
