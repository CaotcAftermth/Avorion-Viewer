import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const native=await readFile('C:/Users/joshu/.codex/attachments/0b550090-428b-47cc-b4c4-261c708a8d20/Pasted text.txt','utf8'),ship=await readFile('C:/Users/joshu/AppData/Roaming/Avorion/ships/DX4 AutoCannon.xml','utf8');
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/prototypes/turret-lab/');await page.waitForSelector('body[data-ready=true]');
 const result=await page.evaluate(async({native,ship})=>{
  const {importTurretXml,createInstance,writeProject,readProject,partMatrices}=await import('/prototypes/turret-lab/core.js');const {parseAvorionXml}=await import('/src/block-model.js');
  const a=importTurretXml(native,'DX4 native turret','dx4-native'),original=parseAvorionXml(ship,'ship');
  let delta=0;for(const b of a.blocks){const matches=original.blocks.filter(o=>o.typeIndex===b.typeIndex&&o.color===b.color);delta=Math.max(delta,Math.min(...matches.map(o=>Math.max(...['x','y','z'].flatMap(k=>[Math.abs(b.position[k]-o.position[k]),Math.abs(b.size[k]-o.size[k])])))));}
  const socket={id:'mount',name:'Reference mount',position:[0,0,0],rotation:[0,0,0]},copy=createInstance(a.id,socket.id,'copy');copy.turretSize=10;
  const project={format:'avorion-turret-lab',version:2,assets:[a],sockets:[socket],instances:[copy],ship:null},json=writeProject(project);
  if(writeProject(readProject(json))!==json)throw Error('Round trip changed metadata');
  const fixture='<turret size="0.5" coaxial="true"><base px="1" py="2" pz="3"><plan/></base><body px="0" py="1" pz="0"><plan><item index="0" parent="-1"><block index="2" lx="0" ly="0" lz="0" ux="1" uy="1" uz="1"/></item></plan></body><barrel px="0" py="2" pz="0"><plan><item index="0" parent="-1"><block index="2" lx="0" ly="0" lz="0" ux="1" uy="1" uz="1"/></item></plan></barrel></turret>';
  const f=importTurretXml(fixture,'fixture','fixture');if(new Set(f.blocks.map(b=>b.id)).size!==2||f.native.offsets.base[0]!==1||f.blocks[1].position.y!==2.5)throw Error('Local IDs or offsets lost');
  let rejected=false;try{importTurretXml(fixture.replace('px="1"','px="bad"'),'bad','bad');}catch{rejected=true;}if(!rejected)throw Error('Malformed offset accepted');
  return {json,delta,parts:Object.fromEntries(['base','body','barrel'].map(part=>[part,a.blocks.filter(b=>a.parts[b.id]===part).length])),muzzles:a.muzzlePositions.length,size:a.sourceSize};
 },{native,ship});
 assert.deepEqual(result.parts,{base:0,body:79,barrel:66});assert.equal(result.muzzles,3);assert.equal(result.size,10);assert.ok(result.delta<1e-6);
 await page.locator('#open').setInputFiles({name:'native.json',mimeType:'application/json',buffer:Buffer.from(result.json)});await page.waitForFunction(()=>window.turretLabSnapshot().assets[0].id==='dx4-native');
 const before=await page.evaluate(()=>window.turretLabSnapshot());for(let n=0;n<100;n++){if(await page.evaluate(()=>document.body.dataset.saved==='true'))break;await new Promise(r=>setTimeout(r,50));}
 await page.reload();await page.waitForSelector('body[data-ready=true]');assert.deepEqual(await page.evaluate(()=>window.turretLabSnapshot()),before);
 await mkdir('test-results/turret-lab',{recursive:true});await page.screenshot({path:'test-results/turret-lab/dx4-native.png'});assert.deepEqual(errors,[]);
 await writeFile('test-results/turret-lab/DX4 native verified.json',result.json);
 console.log(JSON.stringify({parts:result.parts,muzzles:result.muzzles,size:result.size,maximumGeometryDifference:result.delta,roundTrip:'passed',reload:'passed'}));
}finally{await browser.close();}
