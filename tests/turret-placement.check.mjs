import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 const seeded=await page.evaluate(async()=>{
  const {defaults,area,split}=await import('/src/layout.js'),{makeModel,makeBlock}=await import('/src/block-model.js'),{openSessionStore,snapshotModel}=await import('/src/session-persistence.js'),{demoProject}=await import('/src/turrets/core.js');
  const state=defaults(),v=area();v.view.interactionMode='socket';const p=area('properties');p.propertyTab='turrets';state.workspaces[0].root=split('x',.7,split('y',.75,v,area('assets')),p);localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state));
  await openSessionStore().put('model',snapshotModel({loaded:true,model:makeModel([makeBlock({typeIndex:20})])}));
  const asset=demoProject().assets[0];asset.name='Placement fixture';asset.sourceSize=1;
  await new Promise((resolve,reject)=>{const r=indexedDB.open('avorion-viewer.turret-assets.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets',{keyPath:'id'});r.onsuccess=()=>{const t=r.result.transaction('assets','readwrite');t.objectStore('assets').put(asset);t.oncomplete=resolve;t.onerror=reject;};});
 return state;});
 await page.addInitScript(state=>localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state)),seeded);
 await page.reload();const tile=page.getByRole('button',{name:'Placement fixture',exact:true});await tile.waitFor();await tile.click();await page.getByLabel('Socket scope',{exact:true}).selectOption('all');
 await page.getByLabel('Turret socket',{exact:true}).selectOption({index:1});
 // Use a face exposed to the current camera for the keyboard attachment path.
 const select=page.getByLabel('Turret socket',{exact:true});const count=await select.locator('option').count();let attached=false;
 for(let i=1;i<count;i++){await select.selectOption({index:i});if(await page.getByRole('button',{name:'Attach selected asset',exact:true}).isEnabled()){await page.getByRole('button',{name:'Attach selected asset',exact:true}).click();attached=true;break;}}
 assert.ok(attached,'at least one exposed face accepts a turret');assert.equal(await page.getByRole('dialog',{name:'Place turret'}).count(),0);
 await page.getByRole('button',{name:'Detach turret',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Detach turret',exact:true}).isEnabled());
 await page.getByRole('button',{name:'Undo attachment',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Detach turret',exact:true}).isEnabled(),false);await page.getByRole('button',{name:'Redo attachment',exact:true}).click();
 await page.getByRole('button',{name:'Detach turret',exact:true}).click();
 const dragged=await page.evaluate(async()=>{
  const {restoreModel,openSessionStore}=await import('/src/session-persistence.js'),{sceneSockets}=await import('/src/turrets/sockets.js'),{socketExposed}=await import('/src/game-renderer.js'),{projectPoint}=await import('/src/navigation.js'),{nativeToView}=await import('/src/block-model.js'),{leaves}=await import('/src/layout.js');
  const state=JSON.parse(localStorage.getItem('avorion-viewer.window-system.v1')),view=leaves(state.workspaces[0].root).find(n=>n.editor==='viewport').view;
  const scene={...restoreModel(await openSessionStore().get('model')),visible:true,hiddenIds:new Set()},canvas=document.querySelector('[data-editor=viewport] canvas'),rect=canvas.getBoundingClientRect();
  const socket=sceneSockets(scene).find(s=>socketExposed(scene,view,rect.width,rect.height,s));if(!socket)return false;
  const p=projectPoint(nativeToView(socket.position),view,rect.width,rect.height),data=new DataTransfer();document.querySelector('.turret-asset-tile').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  for(const type of ['dragover','drop'])canvas.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,clientX:rect.left+p[0],clientY:rect.top+p[1],dataTransfer:data}));
  document.querySelector('.turret-asset-tile').dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:data}));return true;
 });assert.ok(dragged);assert.equal(await page.getByRole('dialog',{name:'Place turret'}).count(),0);
 await page.waitForTimeout(500);await page.screenshot({path:'test-results/turret-placement.png'});
 const saved=await page.evaluate(async()=>{const {openSessionStore}=await import('/src/session-persistence.js');return (await openSessionStore().get('model')).turretMounts;});assert.equal(saved.length,1);assert.equal(saved[0].turretSize,2);
 await page.reload();await tile.waitFor();const stored=await page.evaluate(async()=>{const {openSessionStore}=await import('/src/session-persistence.js');return (await openSessionStore().get('model')).turretMounts.length;});assert.equal(stored,1);
 assert.equal(await page.getByText('Library asset',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Rename asset',exact:true}).count(),0);
 const name=page.locator('.turret-asset-name').filter({hasText:'Placement fixture'});
 await name.dblclick();let rename=page.getByRole('textbox',{name:'Rename Placement fixture',exact:true});await rename.fill('Cancelled name');await rename.press('Escape');assert.equal(await name.textContent(),'Placement fixture');
 await name.dblclick();rename=page.getByRole('textbox',{name:'Rename Placement fixture',exact:true});await rename.fill('Renamed fixture');await rename.press('Enter');
 await page.getByRole('button',{name:'Renamed fixture',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Renamed fixture',exact:true}).waitFor();

 const renamedTile=page.getByRole('button',{name:'Renamed fixture',exact:true});
 await renamedTile.dblclick();let workspace=page.getByRole('dialog',{name:'Turret workspace'});await workspace.waitFor();
 assert.equal(await workspace.getByRole('heading',{name:'Outliner',exact:true}).count(),1);assert.equal(await workspace.getByRole('heading',{name:'Properties',exact:true}).count(),1);
 await workspace.getByLabel('Body rotation',{exact:true}).fill('45');await workspace.getByLabel('Body rotation',{exact:true}).dispatchEvent('change');
 await workspace.getByLabel('Block color',{exact:true}).fill('#ff2244');await workspace.getByLabel('Block color',{exact:true}).dispatchEvent('change');
 await workspace.getByRole('button',{name:'Cancel',exact:true}).click();await renamedTile.dblclick();await workspace.waitFor();assert.equal(await workspace.getByLabel('Body rotation',{exact:true}).inputValue(),'0');
 await workspace.getByLabel('Body rotation',{exact:true}).fill('35');await workspace.getByLabel('Body rotation',{exact:true}).dispatchEvent('change');
 await workspace.getByLabel('Block color',{exact:true}).fill('#ff2244');await workspace.getByLabel('Block color',{exact:true}).dispatchEvent('change');
 await workspace.getByLabel('Show barrel',{exact:true}).uncheck();await workspace.getByLabel('Show barrel',{exact:true}).check();await workspace.getByRole('button',{name:'Frame All',exact:true}).click();
 const area=workspace.locator('[data-editor=viewport]');const before=await area.boundingBox();
 const divider=workspace.getByRole('separator',{name:'Resize 3D Editor',exact:true});await divider.focus();await divider.press('ArrowLeft');const after=await area.boundingBox();assert.ok(after.width<before.width);
 const rowDivider=workspace.getByRole('separator',{name:'Resize Outliner and Properties',exact:true});await rowDivider.focus();await rowDivider.press('ArrowDown');
 assert.equal(await area.locator('.viewport-toolbar').getByRole('button',{name:'Orbit',exact:true}).count(),1);
 assert.equal(await area.locator('.area-header').getByRole('button',{name:'Orbit',exact:true}).count(),0);
 await workspace.getByRole('button',{name:'Pan',exact:true}).click();assert.equal(await workspace.getByRole('button',{name:'Pan',exact:true}).getAttribute('aria-pressed'),'true');
 await workspace.getByRole('button',{name:'Maximize 3D Editor',exact:true}).click();assert.ok((await area.boundingBox()).width>before.width);await workspace.getByRole('button',{name:'Restore 3D Editor',exact:true}).click();
 await page.screenshot({path:'test-results/turret-workspace.png'});
 await workspace.getByRole('button',{name:'Save asset',exact:true}).click();await workspace.waitFor({state:'detached'});
 await page.reload();await renamedTile.waitFor();await renamedTile.dblclick();await workspace.waitFor();assert.equal(await workspace.getByLabel('Body rotation',{exact:true}).inputValue(),'35');assert.equal(await workspace.getByLabel('Block color',{exact:true}).inputValue(),'#ff2244');await page.keyboard.press('Escape');await workspace.waitFor({state:'detached'});
 await page.locator('.turret-asset-card').first().hover();await page.getByRole('button',{name:'Remove Renamed fixture from library',exact:true}).click();
 await page.getByRole('button',{name:'Renamed fixture',exact:true}).waitFor({state:'detached'});
 await page.reload();await page.getByRole('button',{name:'Import turret XML',exact:true}).waitFor();
 assert.equal(await page.locator('.turret-asset-name').count(),0);
 const mountedAfterDelete=await page.evaluate(async()=>{const {openSessionStore}=await import('/src/session-persistence.js');return (await openSessionStore().get('model')).turretMounts.length;});assert.equal(mountedAfterDelete,1);
 assert.deepEqual(errors,[]);console.log('PASS placement, automatic fit-to-base size without a modal, undo/redo, persistence, rendering without errors');
}finally{await browser.close();}
