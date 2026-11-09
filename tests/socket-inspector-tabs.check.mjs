import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';

// Bind only to loopback and serve the app and test assets from this checkout.
const root=resolve('.'),server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)||!/^\/(src|tests)\/|^\/index.html$/.test(pathname)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.html':'text/html','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});

try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');
 await page.evaluate(async()=>{
  const {defaults,area,split}=await import('/src/layout.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{socketFaces,orientSocket,socketNormalChoices}=await import('/src/components/socket-face.js'),{savedSocket}=await import('/src/components/core.js'),{openSessionStore,snapshotModel}=await import('/src/session-persistence.js');
  const state=defaults(),viewport=area(),properties=area('properties');viewport.view.tool='sockets';state.workspaces[0].root=split('x',.7,viewport,properties);state.active=state.workspaces[0].id;localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(state));localStorage.setItem('avorion-viewer.input-style-chosen.v1','1');
  const block=makeBlock({id:'hull',position:{x:0,y:0,z:0}}),model=makeModel([block]);model.componentSetup={version:1,blockType:null,sockets:socketFaces(block).slice(0,2).map((face,i)=>{const socket=savedSocket(model,orientSocket(face,socketNormalChoices(face)[0].normal),'Socket '+(i+1));socket.faceId=face.faceId;socket.id='socket-'+i;return socket;}),mounts:[]};
  await openSessionStore().put('model',snapshotModel({loaded:true,model}));
 });
 await page.goto(base+'/index.html');await page.getByLabel('3D Avorion viewport',{exact:true}).waitFor();await page.waitForTimeout(1000);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('component-socket-select',{detail:'socket-0'})));await page.getByRole('tab',{name:'Components',exact:true}).waitFor({timeout:5000}).catch(async e=>{console.log('Inspector diagnostics',errors,await page.locator('[data-editor=properties]').count(),await page.locator('.property-tabs').textContent().catch(()=>''),await page.locator('dialog[open]').allTextContents());await page.screenshot({path:'test-results/images/socket-inspector-error.png'});throw e;});assert.equal(await page.getByRole('tab',{name:'Components',exact:true}).getAttribute('aria-selected'),'true');
 for(const name of ['Scene properties','Object properties','Shaders']){
  await page.getByRole('tab',{name,exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.getByRole('tab',{name,exact:true}).getAttribute('aria-selected'),'true','manual tab remains selected while socket is selected');
 }
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('component-socket-select',{detail:'socket-1'})));assert.equal(await page.getByRole('tab',{name:'Components',exact:true}).getAttribute('aria-selected'),'true','a different socket still opens Components');
 await page.getByRole('tab',{name:'Object properties',exact:true}).click();assert.equal(await page.getByRole('tab',{name:'Object properties',exact:true}).getAttribute('aria-selected'),'true');
 assert.deepEqual(errors,[]);console.log('Socket selection routes once; Properties tabs remain user-selectable; a different socket routes again.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
