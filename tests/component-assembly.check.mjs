import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';

// Bind only to loopback and serve the app and test assets from this checkout.
const root=resolve('.'),server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)||!/^\/(src|tests)\//.test(pathname)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});

try{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');await page.addStyleTag({content:await readFile('src/styles.css','utf8')});
 await page.evaluate(async()=>{
  const {assemblyFixture,assemblyAsset}=await import('/tests/component-assembly-fixture.js'),{area}=await import('/src/layout.js'),{mountViewport}=await import('/src/viewport.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js'),{nativeToView}=await import('/src/block-model.js'),{ensureViewportOptions}=await import('/src/viewport-options.js');
  document.body.replaceChildren();const host=document.createElement('div');host.className='viewport';Object.assign(host.style,{position:'relative',width:'900px',height:'700px'});const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Assembly viewport');host.append(canvas);document.body.append(host);
  const scene=assemblyFixture(),node=area();Object.assign(node.view,{tool:'sockets',yaw:.7,pitch:.55,projection:'orthographic',zoom:.6,target:nativeToView([.5,.5,0])});ensureViewportOptions(node.view).showOverlays=true;const preferences={...FACTORY_PREFERENCES,shaderAO:0,shaderBloom:0,shaderSpill:0};const controller=mountViewport(canvas,node,scene,()=>{},()=>{},()=>preferences);window.fixture={scene,node,controller,preferences,child:assemblyAsset()};
 });
 await page.waitForTimeout(600);
 const exposure=await page.evaluate(async()=>{const {componentSockets}=await import('/src/components/core.js'),{socketExposed}=await import('/src/game-renderer.js'),{sceneSockets}=await import('/src/turrets/sockets.js');const f=fixture,port=componentSockets(f.scene).find(s=>s.parentMountId==='parent'),turret=sceneSockets(f.scene).find(s=>s.parentMountId==='parent'&&s.normal[1]>.99);return {component:socketExposed(f.scene,f.node.view,900,700,port,f.preferences),turret:socketExposed(f.scene,f.node.view,900,700,turret,f.preferences),fit:turret.fitSize};});assert.equal(exposure.component,true,'mounted component port is exposed');assert.equal(exposure.turret,true,'turret face on component is exposed');assert.ok(exposure.fit>=1);
 await page.evaluate(async()=>{const {componentLibrary}=await import('/src/components/library.js'),{componentSockets}=await import('/src/components/core.js'),{nativeToView}=await import('/src/block-model.js'),{projectPoint}=await import('/src/navigation.js');componentLibrary.dragged=fixture.child;window.dispatchEvent(new Event('component-drag-start'));fixture.controller.draw();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect(),socket=componentSockets(fixture.scene).find(s=>s.parentMountId==='parent'),point=projectPoint(nativeToView(socket.position),fixture.node.view,r.width,r.height),dataTransfer=new DataTransfer();for(const type of ['dragover','drop'])canvas.dispatchEvent(new DragEvent(type,{bubbles:true,clientX:r.left+point[0],clientY:r.top+point[1],dataTransfer}));});
 await page.waitForFunction(()=>fixture.scene.model.componentSetup.mounts.length===2);await page.evaluate(async()=>{const {componentLibrary}=await import('/src/components/library.js');componentLibrary.dragged=null;window.dispatchEvent(new Event('component-drag-end'));});
 await page.evaluate(async()=>{const {turretLibrary}=await import('/src/turrets/library.js'),{demoProject}=await import('/src/turrets/core.js'),{sceneSockets}=await import('/src/turrets/sockets.js'),{nativeToView}=await import('/src/block-model.js'),{projectPoint}=await import('/src/navigation.js');turretLibrary.dragged=demoProject().assets[0];window.dispatchEvent(new Event('turret-drag-start'));fixture.controller.draw();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect(),socket=sceneSockets(fixture.scene).find(s=>s.parentMountId==='parent'&&s.normal[1]>.99),point=projectPoint(nativeToView(socket.position),fixture.node.view,r.width,r.height),dataTransfer=new DataTransfer();for(const type of ['dragover','drop'])canvas.dispatchEvent(new DragEvent(type,{bubbles:true,clientX:r.left+point[0],clientY:r.top+point[1],dataTransfer}));});
 await page.waitForFunction(()=>fixture.scene.model.turretMounts?.length===1);await page.evaluate(async()=>{const {turretLibrary}=await import('/src/turrets/library.js');turretLibrary.dragged=null;window.dispatchEvent(new Event('turret-drag-end'));fixture.controller.draw();});
 await page.waitForTimeout(150);await page.screenshot({path:'test-results/images/component-assembly-mounts.png'});
 const restored=await page.evaluate(async()=>{const {snapshotModel,restoreModel}=await import('/src/session-persistence.js'),{componentEntries}=await import('/src/components/core.js'),{sceneSockets}=await import('/src/turrets/sockets.js');const snapshot=snapshotModel(fixture.scene),before=componentEntries(fixture.scene).map(e=>e.matrix.toArray());fixture.scene.model=restoreModel(snapshot).model;fixture.scene.revision++;fixture.controller.draw();return {before,after:componentEntries(fixture.scene).map(e=>e.matrix.toArray()),turret:sceneSockets(fixture.scene).some(s=>s.id===fixture.scene.model.turretMounts[0].socketId)};});assert.deepEqual(restored.after,restored.before);assert.equal(restored.turret,true);
 const baked=await page.evaluate(async()=>{
  const {parseAvorionXml}=await import('/src/block-model.js'),{bakeComponentsXml}=await import('/src/components/bake.js');
  const model=parseAvorionXml('<plan><item index="0"><block index="2" material="0" look="1" up="3" color="ff696969" lx="-3" ly="-2" lz="-3" ux="3" uy="0" uz="3"/></item></plan>','Assembly.xml',200),setup=fixture.scene.model.componentSetup;
  model.componentSetup={...setup,sockets:setup.sockets.map(s=>({...s,blockId:model.blocks[0].id}))};model.turretMounts=fixture.scene.model.turretMounts;const result=bakeComponentsXml({model,loaded:true}),doc=new DOMParser().parseFromString(result.text,'application/xml'),items=[...doc.querySelectorAll('plan > item')];return {count:result.count,parent:items.at(-1).getAttribute('parent'),parentIndex:items.at(-2).getAttribute('index')};
 });assert.equal(baked.count,2);assert.equal(baked.parent,baked.parentIndex,'baked child references baked parent component block');
 assert.deepEqual(errors,[]);await page.evaluate(()=>fixture.controller.dispose());console.log('Mounted component sockets and component turret faces pass exposure, actual drag/drop, rendering, and session restoration.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
