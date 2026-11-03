import {serveWorkspace} from './local-route.mjs';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const xml='<ship><plan><item index="0"><block lx="-1" ly="0" lz="-1" ux="1" uy="2" uz="1" index="2" material="0" look="1" up="3" color="ff336699"/></item></plan></ship>';
try{
 const page=await browser.newPage({viewport:{width:1200,height:1000}});await serveWorkspace(page);await page.goto('http://127.0.0.1:5173/src/');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addStyleTag({content:'.turret-asset-grid{display:flex}canvas{width:150px}label{display:block}button,select{margin:5px}'});
 await page.evaluate(async xml=>{
  const {parseAvorionXml}=await import('/src/block-model.js');const {mountAttachmentLibrary}=await import('/src/attachment-library.js');const {mountComponentProperties}=await import('/src/components/properties.js');
  window.scene={model:parseAvorionXml(xml,'Ship.xml',xml.length),loaded:true,visible:true,selectedIds:new Set(['b0']),hiddenIds:new Set(),revision:1};
  // Asset Library grid and Properties › Components, rendered side by side as in the app.
  const library=document.createElement('div'),properties=document.createElement('div');document.body.replaceChildren(library,properties);
  const changed=()=>{window.controller?.sync();mountComponentProperties(properties.replaceChildren()||properties,scene,changed);};
  window.controller=mountAttachmentLibrary(library,{assetKind:'components'},scene,changed);changed();
 },xml);
 await page.getByRole('button',{name:'Import component XML',exact:true}).waitFor();
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import component XML',exact:true}).click();
 await (await chooser).setFiles({name:'Engine.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await page.getByRole('button',{name:'Engine',exact:true}).click();
 await page.getByLabel('Component name',{exact:true}).waitFor();await page.getByLabel('Component name',{exact:true}).fill('Engine module');await page.getByLabel('Component name',{exact:true}).press('Tab');
 await page.getByRole('button',{name:'Engine module',exact:true}).waitFor();
 await page.getByLabel('Component socket block type').selectOption('2');
 await page.getByLabel('Component ship socket').selectOption('component:b0:1');
 await page.getByRole('button',{name:'Attach selected component',exact:true}).click();
 await page.getByLabel('Component scale',{exact:true}).waitFor();await page.getByLabel('Component scale',{exact:true}).fill('1.5');await page.getByLabel('Component scale',{exact:true}).press('Tab');
 await page.waitForFunction(()=>scene.model.componentSetup?.mounts[0]?.scale===1.5);
 const result=await page.evaluate(async xml=>{
  const {parseAvorionXml}=await import('/src/block-model.js');const {restoreComponentSetup,loadComponents,componentSetupFile,parseComponentSetupFile}=await import('/src/components/storage.js');
  const model=parseAvorionXml(xml,'Renamed.xml',xml.length);await restoreComponentSetup(model);const library=await loadComponents();
  return {saved:model.componentSetup.mounts.length,scale:model.componentSetup.mounts[0].scale,library:library.length,name:library[0].name,portable:parseComponentSetupFile(componentSetupFile(model)).mounts.length,turrets:model.turretMounts?.length||0};
 },xml);
 assert.deepEqual(result,{saved:1,scale:1.5,library:1,name:'Engine module',portable:1,turrets:0});
 await page.getByRole('button',{name:'Detach component',exact:true}).click();
 await page.getByRole('button',{name:'Add socket on selected block',exact:true}).click();
 await page.getByLabel('Socket name',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Attach selected component',exact:true}).click();
 await page.getByLabel('Component scale',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>scene.model.componentSetup.sockets.length),1);
 await page.evaluate(()=>controller.show('turrets'));assert.equal(await page.getByRole('button',{name:'Engine module',exact:true}).count(),0);
 await page.evaluate(()=>controller.show('components'));await page.getByRole('button',{name:'Engine module',exact:true}).waitFor();
 // In the app the Turrets / Components switch sits in the Asset Library header beside Area options.
 await page.goto('http://127.0.0.1:5173/index.html');await page.waitForSelector('#screen canvas');
 await page.keyboard.press('Escape');await page.getByRole('tab',{name:'Armament'}).click();
 await page.locator('[data-editor=assets] .area-header .asset-kind-switch [data-kind=components]').click();
 await page.getByRole('button',{name:'Engine module',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
