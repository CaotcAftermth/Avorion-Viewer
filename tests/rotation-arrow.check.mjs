import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {viewerHandler} from '../scripts/serve.mjs';
const handler=viewerHandler(process.cwd());const server=http.createServer((req,res)=>{req.headers.host='127.0.0.1:5173';if(req.headers.origin)req.headers.origin='http://127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
const page=await browser.newPage({viewport:{width:900,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/color-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
await page.goto(`http://127.0.0.1:${server.address().port}/color-harness`);
await page.setContent('<link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/color-editor.css"><div id="test" style="width:450px;height:800px"></div>');
await page.evaluate(async()=>{
 const {createTurretToolbar}=await import('/src/turrets/context-toolbar.js'),{area}=await import('/src/layout.js'),{makeBlock,makeModel,nativeToView}=await import('/src/block-model.js'),{sceneSockets}=await import('/src/turrets/sockets.js'),{demoProject,frame}=await import('/src/turrets/core.js'),mounts=await import('/src/turrets/mounts.js'),THREE=await import('/src/vendor/three.module.js'),{projectPoint}=await import('/src/navigation.js'),{frameVisibleModel}=await import('/src/model-framing.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
 const host=document.querySelector('#test');host.style.width='800px';host.style.position='relative';const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;canvas.style.cssText='width:800px;height:600px';host.replaceChildren(canvas);
 const scene={loaded:true,visible:true,model:makeModel([makeBlock({id:'base',typeIndex:20,size:{x:4,y:1,z:4}})]),hiddenIds:new Set(),selectedIds:new Set(),turretSockets:{show:true,scope:'all'}},node=area(),socket=sceneSockets(scene).find(s=>s.normal[1]>.99),asset=demoProject().assets[0];asset.sourceSize=1;mounts.placeTurret(scene,asset,socket,1);node.view.interactionMode='object';node.view.tool='sockets';frameVisibleModel(scene,node.view,800,600,FACTORY_PREFERENCES);
 const ctx=canvas.getContext('2d');let toolbar;const draw=()=>{ctx.clearRect(0,0,800,600);toolbar?.draw(ctx);};toolbar=createTurretToolbar(canvas,scene,node.view,{changed(){},selected(){},invalidate:draw});toolbar.open(scene.model.turretMounts[0]);window.proof={scene,toolbar,draw,socket,asset};
 window.ring=()=>{const project=p=>projectPoint(nativeToView(p),node.view,800,600),center=project(socket.position),matrix=frame(socket.position,socket.rotation),points=Array.from({length:97},(_,i)=>project(new THREE.Vector3(Math.cos(i*Math.PI/48),0,Math.sin(i*Math.PI/48)).applyMatrix4(matrix).toArray())),span=Math.max(...points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1])),1),r=canvas.getBoundingClientRect();return points.map(p=>[r.left+center[0]+(p[0]-center[0])*55/span,r.top+center[1]+(p[1]-center[1])*55/span]);};
});
await page.getByRole('button',{name:/Rotate/}).click();const ring=await page.evaluate(()=>window.ring());
await page.mouse.move(...ring[48]);await page.mouse.down();await page.mouse.move(...ring[60],{steps:12});
assert.ok(Math.abs(await page.evaluate(()=>proof.scene.model.turretMounts[0].twist)+45)<1);await page.mouse.up();assert.ok([0,-90].includes(await page.evaluate(()=>proof.scene.model.turretMounts[0].twist)));
await page.evaluate(()=>{proof.scene.model.turretMounts[0].twist=-45;proof.draw();});await page.mouse.move(...ring[60]);await page.mouse.down();await page.mouse.move(...ring[71],{steps:12});await page.mouse.up();assert.equal(await page.evaluate(()=>proof.scene.model.turretMounts[0].twist),-90);
await page.screenshot({path:'test-results/rotation-direction-arrow.png'});
await page.evaluate(async()=>{
 const {syncTurrets}=await import('/src/turrets/render.js'),{Group}=await import('/src/vendor/three.module.js'),{editTurrets,beginPropertyEdit,endPropertyEdit}=await import('/src/turrets/mounts.js');
 const world=new Group(),options={params:{},time:0,uniforms:{}},view={interactionMode:'object',display:{}};
 const group=syncTurrets(world,proof.scene,view,()=>{},options),holder=group.children[0],rendered=holder.userData.texturedAttachment.rendered,material=rendered.materials[0];
 let disposals=0;const dispose=rendered.dispose.bind(rendered);rendered.dispose=()=>{disposals++;dispose();};
 beginPropertyEdit(proof.scene);for(let i=0;i<30;i++){editTurrets(proof.scene,[proof.scene.model.turretMounts[0].id],{twist:i});const next=syncTurrets(world,proof.scene,view,()=>{},options);if(next!==group||next.children[0]!==holder||holder.userData.texturedAttachment.rendered!==rendered||rendered.materials[0]!==material)throw Error('Rotation rebuilt attachment resources');}endPropertyEdit(proof.scene);
 if(disposals)throw Error('Rotation disposed textured assets');
});

await page.evaluate(()=>{proof.toolbar.close();const asset={id:'component',name:'Component',blocks:proof.asset.blocks,attachment:proof.asset.attachment};proof.scene.model.componentSetup={version:1,blockType:null,sockets:[{id:'cs',name:'Component socket',position:proof.socket.position,rotation:proof.socket.rotation}],mounts:[{id:'cm',socketId:'cs',asset,scale:1,twist:0}]};proof.toolbar.open(proof.scene.model.componentSetup.mounts[0],true);});
await page.getByRole('toolbar',{name:'Component context tools'}).getByRole('button',{name:/Rotate/}).click();
await page.mouse.move(...ring[48]);await page.mouse.down();await page.mouse.move(...ring[60],{steps:12});assert.ok(Math.abs(await page.evaluate(()=>proof.scene.model.componentSetup.mounts[0].twist)+45)<1);await page.mouse.up();assert.ok([0,-90].includes(await page.evaluate(()=>proof.scene.model.componentSetup.mounts[0].twist)));
assert.deepEqual(errors,[]);console.log('Passed: smooth 45 degree rotation and snapping near 90 degrees, direction arrow rendered, no browser errors.');
}finally{await browser.close();server.close();}
