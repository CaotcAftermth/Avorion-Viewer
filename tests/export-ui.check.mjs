import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],requests=[];try{
const p=await b.newPage({viewport:{width:1300,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));p.setDefaultTimeout(30000);await p.addInitScript(()=>localStorage.setItem('avorion-viewer.input-style-chosen.v1','1'));await p.goto('http://127.0.0.1:5173/');
await p.getByRole('button',{name:'File',exact:true}).click();const chosen=p.waitForEvent('filechooser');await p.getByRole('menuitem',{name:'Import Avorion XML…',exact:true}).click();await (await chosen).setFiles({name:'export-fixture.xml',mimeType:'text/xml',buffer:Buffer.from('<ship><plan><item index="0" parent="-1"><block lx="0" ly="0" lz="0" ux="2" uy="4" uz="8" index="122" material="0" look="1" up="3" color="ff336699" secondaryColor="00000000"/></item><item index="1" parent="0"><block lx="1" ly="0" lz="0" ux="3" uy="4" uz="8" index="170" material="0" look="1" up="3" color="ffabcdef"/></item></plan></ship>')});
await p.waitForFunction(()=>document.querySelector('.ship-root .ship-name')?.textContent.includes('export-fixture'));
await p.getByRole('button',{name:'File',exact:true}).click();await p.getByRole('menuitem',{name:'Advanced Export…'}).click();const d=p.getByRole('dialog',{name:'Advanced Export'});
await d.getByRole('button',{name:'Prepare & Validate'}).click();await p.waitForFunction(()=>document.querySelector('.export-status')?.textContent.includes('Prepared snapshot'));
await d.getByRole('button',{name:'Preview processed mesh'}).click();await p.screenshot({path:'test-results/export-dialog.png'});
await mkdir('test-results/exports',{recursive:true});
for(const format of ['glb','gltf','obj','3mf','stl']){
 await d.locator('input[name="export-format"][value="'+format+'"]').check();if(format==='3mf')await d.getByLabel('Geometry output').selectOption('shell');
 await d.getByRole('button',{name:'Prepare & Validate'}).click();await p.waitForFunction(()=>document.querySelector('.export-status')?.textContent.includes('Prepared snapshot'));
 if(format==='stl')assert.equal(await d.getByLabel('Geometry output').isDisabled(),false);
 const download=p.waitForEvent('download');await d.getByRole('button',{name:'Download',exact:true}).click();const file=await download;await file.saveAs('test-results/exports/'+file.suggestedFilename());console.log('download',file.suggestedFilename());
}
await d.getByLabel('Geometry output').selectOption('grouped');await d.getByRole('button',{name:'Prepare & Validate'}).click();await p.waitForFunction(()=>document.querySelector('.export-status')?.textContent.includes('Prepared snapshot'));assert.match(await d.locator('.export-summary').textContent(),/Visual STL:/);const visualDownload=p.waitForEvent('download');await d.getByRole('button',{name:'Download',exact:true}).click();await (await visualDownload).saveAs('test-results/exports/visual-fixture.stl');
await d.getByLabel('Export scope').selectOption('selected');await d.getByRole('button',{name:'Prepare & Validate'}).click();await p.waitForFunction(()=>document.querySelector('.export-status')?.textContent.includes('no blocks'));
await d.getByLabel('Export scope').selectOption('all');await p.evaluate(()=>{document.querySelector('.export-prepare').click();document.querySelector('.export-cancel').click();});await p.waitForTimeout(200);assert.match(await d.locator(':scope>.dialog-actions>.export-status').textContent(),/Cancelled/);assert.equal(await d.getByRole('button',{name:'Download',exact:true}).isDisabled(),true);
await d.getByLabel('Close export').click();await p.waitForFunction(()=>!document.querySelector('.export-dialog'));
await p.addScriptTag({type:'importmap',content:JSON.stringify({imports:{three:'/node_modules/three/build/three.module.js'}})});
const files=await p.evaluate(async bytes=>{
 const {ThreeMFLoader}=await import('/node_modules/three/examples/jsm/loaders/3MFLoader.js');const THREE=await import('three');const group=new ThreeMFLoader().parse(new Uint8Array(bytes).buffer),size=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());return {objects:group.children.length,size:size.toArray()};
},Array.from(await readFile('test-results/exports/export-fixture.3mf')));
assert.equal(files.objects,1);assert.deepEqual(files.size,[37.5,100,50]);
assert.deepEqual(errors,[]);const external=requests.filter(u=>!u.startsWith('http://127.0.0.1:5173/')&&!u.startsWith('blob:')&&!u.startsWith('data:'));assert.deepEqual(external,[]);console.log(JSON.stringify({uiPassed:true,errors,external,files}));
}finally{await b.close();}
