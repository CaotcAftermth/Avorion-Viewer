import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1300,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 const layout=await page.evaluate(async()=>{
  const {defaults,area,split}=await import('/src/layout.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret}=await import('/src/turrets/mounts.js'),{openSessionStore,snapshotModel}=await import('/src/session-persistence.js');
  const state=defaults(),a=area('properties'),b=area('properties');a.propertyTab=b.propertyTab='turrets';state.workspaces[0].root=split('x',.65,area(),split('y',.5,a,b));
  const scene={loaded:true,model:makeModel([makeBlock({id:'a',typeIndex:20}),makeBlock({id:'b',typeIndex:20,position:{x:5,y:1,z:0}})])},asset=demoProject().assets[0];asset.sourceSize=1;
  for(const block of scene.model.blocks)placeTurret(scene,asset,blockSockets(block).find(s=>s.normal[1]>.9),.5);
  await openSessionStore().put('model',snapshotModel(scene));return state;
 });await page.addInitScript(state=>localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state)),layout);await page.reload();await page.getByLabel('Slice extent',{exact:true}).first().waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.property-content')].length===2&&[...document.querySelectorAll('.property-content')].every(el=>el.clientHeight>0&&el.scrollHeight>el.clientHeight+100));
 const scrolls=page.locator('.property-content');
 const before=await scrolls.evaluateAll(els=>els.map((el,i)=>{el.scrollTop=140+i*70;return el.scrollTop;}));assert.ok(before.every(v=>v>0));
 await page.getByLabel('Slice extent',{exact:true}).first().evaluate(el=>{el.value='8';el.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.deepEqual(await scrolls.evaluateAll(els=>els.map(el=>el.scrollTop)),before,'partial Properties refresh preserves both scroll positions');
 await page.getByLabel('Interaction mode',{exact:true}).selectOption('socket');await page.waitForTimeout(150);
 assert.deepEqual(await scrolls.evaluateAll(els=>els.map(el=>el.scrollTop)),before,'whole editor redraw preserves scroll');
 for(const direction of ['Top','Bottom','Left','Right','Front','Back']){
  await page.getByRole('button',{name:direction+' firing view',exact:true}).first().click();
  await page.waitForTimeout(180);const view=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('avorion-viewer.window-system.v1'));return state.workspaces[0].root.first.view;});assert.equal(view.projection,'orthographic');const expected={Top:[0,Math.PI/2],Bottom:[0,-Math.PI/2],Left:[-Math.PI/2,0],Right:[Math.PI/2,0],Front:[0,0],Back:[Math.PI,0]}[direction];assert.ok(Math.abs(view.yaw-expected[0])<1e-6&&Math.abs(view.pitch-expected[1])<1e-6);
  assert.equal(await page.getByRole('button',{name:direction+' firing view',exact:true}).first().getAttribute('aria-pressed'),'true');
 }
 await page.waitForTimeout(500);await page.screenshot({path:'test-results/directional-fire-scroll.png'});assert.deepEqual(errors,[]);console.log('PASS independent Properties scroll across local/full redraws; six directional buttons, standard orthographic camera, no browser errors');
}finally{await browser.close();}
