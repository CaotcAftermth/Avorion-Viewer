import {serveWorkspace} from './local-route.mjs';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,channel:'msedge',args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await serveWorkspace(page);await page.goto('http://127.0.0.1:5173/src/');
 await page.evaluate(async()=>{
  const {defaults,area,split}=await import('/src/layout.js');
  const {makeModel,makeBlock}=await import('/src/block-model.js');
  const {openSessionStore,snapshotModel}=await import('/src/session-persistence.js');
  const {demoProject}=await import('/src/turrets/core.js');
  const {emptySetup}=await import('/src/components/core.js');
  const {saveComponents}=await import('/src/components/storage.js');
  const state=defaults(),viewport=area(),properties=area('properties');
  viewport.view.interactionMode='socket';properties.propertyTab='turrets';
  state.active=state.workspaces[0].id;state.workspaces[0].root=split('x',.75,viewport,properties);
  localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state));
  const model=makeModel([makeBlock({id:'mount',typeIndex:24,size:{x:8,y:1,z:8}})],'Socket fixture.xml');
  model.componentSetup={...emptySetup(),blockType:24};
  await openSessionStore().put('model',snapshotModel({loaded:true,model}));
  const asset=demoProject().assets[0];asset.id='quick-turret';asset.name='Quick turret';asset.sourceSize=1;
  await new Promise((resolve,reject)=>{
   const request=indexedDB.open('avorion-viewer.turret-assets.v1',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('assets',{keyPath:'id'});
   request.onsuccess=()=>{const tx=request.result.transaction('assets','readwrite');tx.objectStore('assets').put(asset);for(let i=1;i<6;i++)tx.objectStore('assets').put({...asset,id:'extra-'+i,name:'Extra turret '+i});tx.oncomplete=resolve;tx.onerror=reject;};
   request.onerror=reject;
  });
  await saveComponents(Array.from({length:2},(_,i)=>({id:i?'extra-component-'+i:'quick-component',name:i?'Extra component '+i:'Quick component',blocks:[makeBlock()],attachment:{position:[0,0,0],rotation:[0,0,0]}})));
 });
 await page.goto('http://127.0.0.1:5173/');
 const canvas=page.locator('[data-editor=viewport] canvas').first();
 await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&document.querySelector('[aria-label="Select Sockets"]'));
 assert.deepEqual(await page.getByLabel('Interaction mode',{exact:true}).locator('option').allTextContents(),['Object Mode','Paint Mode']);
 assert.equal(await page.getByLabel('Interaction mode',{exact:true}).inputValue(),'object');
 assert.equal(await page.getByRole('button',{name:'Select Sockets',exact:true}).getAttribute('aria-pressed'),'true');

 // Opening uses the existing libraries and keeps their actual drag handlers.
 await canvas.click({position:{x:25,y:350}});await page.keyboard.press('Space');
 const library=page.getByRole('dialog',{name:'Quick Asset Library',exact:true});
 await library.waitFor();await library.getByRole('button',{name:'Quick turret',exact:true}).waitFor();
 const bounds=await library.boundingBox();
 assert.ok(Math.abs(bounds.x+bounds.width/2-700)<2);
 assert.ok(bounds.height<300&&bounds.y>650);assert.ok(bounds.width>1000);
 const importBounds=await library.getByRole('button',{name:'Import turret XML',exact:true}).boundingBox();
 assert.ok(importBounds.x>=bounds.x&&importBounds.x+importBounds.width<=bounds.x+bounds.width);

 await page.keyboard.press('Escape');await library.waitFor({state:'detached'});
 // Native Space on fields must remain text entry.
 const search=page.getByPlaceholder('Search properties');await search.focus();await page.keyboard.press('Space');
 assert.equal(await library.count(),0);await search.fill('');await canvas.click({position:{x:25,y:350}});
 await page.keyboard.press('Space');await library.waitFor();
 await page.waitForTimeout(250);
 async function target(kind){
  return page.evaluate(async kind=>{
   const {restoreModel,openSessionStore}=await import('/src/session-persistence.js');
   const {sceneSockets}=await import('/src/turrets/sockets.js');
   const {componentSockets}=await import('/src/components/core.js');
   const {socketExposed}=await import('/src/game-renderer.js');
   const {projectPoint}=await import('/src/navigation.js');
   const {nativeToView}=await import('/src/block-model.js');
   const {leaves}=await import('/src/layout.js');
   const {FACTORY_PREFERENCES}=await import('/src/preferences.js');
   const state=JSON.parse(localStorage.getItem('avorion-viewer.window-system.v1'));
   const node=leaves(state.workspaces.find(w=>w.id===state.active).root).find(n=>n.editor==='viewport');
   const scene={...restoreModel(await openSessionStore().get('model')),visible:true,hiddenIds:new Set()};
   const canvas=document.querySelector('[data-editor=viewport] canvas'),{width,height}=canvas.getBoundingClientRect();
   const sockets=kind==='turret'?sceneSockets(scene):componentSockets(scene);
   const occupied=new Set((kind==='turret'?scene.model.turretMounts||[]:scene.model.componentSetup.mounts||[]).map(m=>m.socketId));
   const socket=sockets.find(s=>!occupied.has(s.id)&&(kind!=='turret'||s.fitSize>=1)&&socketExposed(scene,node.view,width,height,s,FACTORY_PREFERENCES));
   if(!socket)throw Error('No visible compatible socket');
   const point=projectPoint(nativeToView(socket.position),node.view,width,height);
   return {x:point[0],y:point[1]};
  },kind);
 }
 await library.getByRole('button',{name:'Quick turret',exact:true}).dragTo(canvas,{targetPosition:{x:25,y:350}});
 assert.equal(await library.isVisible(),true);
 const turretTarget=await target('turret');
 await library.getByRole('button',{name:'Quick turret',exact:true}).dragTo(canvas,{targetPosition:turretTarget});
 await library.waitFor({state:'detached',timeout:10000});
 await page.waitForTimeout(300);
 // Occupied sockets keep the picker open until replacement is confirmed.
 await canvas.focus();await page.keyboard.press('Space');await library.waitFor();
 await library.getByRole('button',{name:'Quick turret',exact:true}).dragTo(canvas,{targetPosition:turretTarget});
 assert.equal(await library.isVisible(),true);
 const placement=page.getByRole('group',{name:'Attachment placement',exact:true});
 await placement.getByRole('button',{name:'Replace',exact:true}).click();
 await library.waitFor({state:'detached'});
 // A component uses the same overlay, with its own attachment system.
 await canvas.focus();await page.keyboard.press('Space');await library.waitFor();
 await library.getByRole('button',{name:'Components',exact:true}).click();
 const component=library.getByRole('button',{name:'Quick component',exact:true});await component.waitFor();
 await page.waitForFunction(()=>{const host=document.querySelector('.quick-asset-library'),card=host?.querySelector('[aria-label="Import component XML"]');if(!card)return false;const h=host.getBoundingClientRect(),c=card.getBoundingClientRect();return c.right<=h.right&&c.left>=h.left;});
 assert.equal((await library.boundingBox()).width,bounds.width);
 const componentTarget=await target('component');
 await component.dragTo(canvas,{targetPosition:componentTarget});
 await library.waitFor({state:'detached',timeout:10000});
 await page.getByLabel('Interaction mode',{exact:true}).selectOption('paint');
 await canvas.focus();await page.keyboard.press('Space');await library.waitFor();
 assert.equal(await page.getByLabel('Interaction mode',{exact:true}).inputValue(),'object');
 await page.keyboard.press('Escape');await library.waitFor({state:'detached'});
 assert.deepEqual(errors,[]);
 console.log('Legacy mode migration, overlay geometry, text input, and native turret/component drag placement passed');
}finally{await browser.close();}
