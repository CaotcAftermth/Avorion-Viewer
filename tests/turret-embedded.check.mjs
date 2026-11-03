import {serveWorkspace} from './local-route.mjs';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const page=await browser.newPage();await serveWorkspace(page);
 await page.goto('http://127.0.0.1:5173/src/');
 const block='<item index="0"><block lx="-.5" ly="0" lz="-.5" ux=".5" uy=".2" uz=".5" index="2" material="0" look="1" up="3" color="ff123456"/></item>';
 const design=`<turretDesign blockIndex="42" size="1" coaxial="false" shot_color="0"><base px="0" py="0" pz="0"><plan>${block}</plan></base><body px="0" py=".2" pz="0"><plan>${block}</plan></body><barrel px="0" py=".4" pz="0"><plan>${block}</plan></barrel><muzzlePosition x="0" y="0" z="-1"/></turretDesign>`;
 const fixture=`<ship_design>${design}<plan><item index="1"><block lx="-2" ly="-2" lz="-2" ux="2" uy="2" uz="2" index="2"/></item><item index="42" parent="1"><block lx="-1" ly="2" lz="-1" ux="1" uy="2.1" uz="1" index="20"/></item></plan></ship_design>`;
 const xml=process.argv[2]?await readFile(process.argv[2],'utf8'):fixture;
 const result=await page.evaluate(async xml=>{
  const {parseAvorionXml}=await import('/src/block-model.js');
  const {restoreEmbeddedTurrets}=await import('/src/turrets/embedded.js');
  const {loadTurretLibrary,addTurretAsset}=await import('/src/turrets/library.js');
  const {blockSockets}=await import('/src/turrets/sockets.js');
  const library={load:loadTurretLibrary,add:addTurretAsset};
  const model=parseAvorionXml(xml,'Tachi.xml',xml.length);
  await restoreEmbeddedTurrets(model,library);
  const first=(await loadTurretLibrary()).length;
  await restoreEmbeddedTurrets(model,library);
  const again=parseAvorionXml(xml,'renamed.xml',xml.length);await restoreEmbeddedTurrets(again,library);
  return {expected:model.doc.getElementsByTagName('turretDesign').length,mounts:model.turretMounts?.map(m=>({size:m.turretSize,normal:blockSockets(model.blocks.find(b=>m.socketId.startsWith(`turret:${b.id}:`))).find(s=>s.id===m.socketId).normal})),first,last:(await loadTurretLibrary()).length,second:again.turretMounts?.length,warnings:model.warnings.filter(w=>w.level==='warn'&&w.message.startsWith('Turret'))};
 },xml);
 console.log(JSON.stringify(result));assert.equal(result.mounts.length,result.expected);assert.equal(result.second,result.expected);assert.equal(result.first,result.last);assert.equal(result.warnings.length,0);
 const failures=await page.evaluate(async xml=>{
  const {parseAvorionXml}=await import('/src/block-model.js');
  const {restoreEmbeddedTurrets}=await import('/src/turrets/embedded.js');
  const model=parseAvorionXml(xml,'storage.xml',xml.length);
  await restoreEmbeddedTurrets(model,{load:async()=>{throw Error('blocked');},add:async()=>{throw Error('quota');}});
  const missing=parseAvorionXml(xml.replace('blockIndex="42"','blockIndex="999"'),'missing.xml',xml.length);
  await restoreEmbeddedTurrets(missing,{load:async()=>[],add:()=>{throw Error('unexpected save');}});
  const bad=parseAvorionXml(xml.replace('size="1"','size="invalid"'),'invalid.xml',xml.length);
  await restoreEmbeddedTurrets(bad,{load:async()=>[],add:()=>{throw Error('unexpected save');}});
  return {mounted:model.turretMounts.length,warnings:model.warnings.filter(w=>w.level==='warn').length,
    missing:missing.turretMounts?.length||0,missingWarning:missing.warnings.some(w=>w.message.includes('mounting block is missing')),
    invalid:bad.turretMounts?.length||0,invalidWarning:bad.warnings.some(w=>w.message.includes('Invalid turretDesign size'))};
 },fixture);
 assert.equal(failures.mounted,1);assert.equal(failures.warnings,2);assert.equal(failures.missing,0);assert.ok(failures.missingWarning);assert.equal(failures.invalid,0);assert.ok(failures.invalidWarning);
} finally {await browser.close();}
