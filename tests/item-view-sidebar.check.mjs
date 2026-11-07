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
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');
 await page.addStyleTag({content:await readFile('src/styles.css','utf8')});
 const result=await page.evaluate(async()=>{
  const {mountNativeTransform}=await import('/src/native-transform.js'),{layoutPropertyRows}=await import('/src/property-rows.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{mountEngineState,mountThrusterState}=await import('/src/scene-properties.js'),{viewportViewPanel}=await import('/src/viewport-controls.js'),{createPreferencesStore}=await import('/src/preferences.js'),{area}=await import('/src/layout.js');
  const assert=(v,m)=>{if(!v)throw Error(m);};
  const host=document.createElement('aside');host.className='viewport-sidebar property-content';host.style.width='220px';document.body.append(host);
  const a=makeBlock({id:'a',position:{x:1,y:2,z:3}}),b=makeBlock({id:'b',position:{x:4,y:5,z:6},size:{x:7,y:8,z:9},look:5,up:3});
  const scene={loaded:true,model:makeModel([a,b]),revision:1,selectedId:'a'},store=createPreferencesStore({getItem:()=>null,setItem(){}}),panel=mountNativeTransform(host,scene);
  mountEngineState(host,area().view,store);mountThrusterState(host,store);viewportViewPanel(host,area().view,()=>{});const dispose=layoutPropertyRows(host);
  const x=host.querySelector('[aria-label="Native Position X"]');assert(x.value==='1.000','initial position');
  scene.selectedId='b';panel.refresh();assert(x.value==='4.000','selection updates without remount');
  b.position.x=12.34567;b.size.z=4.75;panel.open=false;host.scrollTop=30;const scroll=host.scrollTop;panel.refresh();
  assert(x.value==='12.346','edited position updates');assert(host.querySelector('[aria-label="Native Dimension Z"]').value==='4.750','dimensions update');assert(!panel.open,'panel collapse preserved');assert(host.scrollTop===scroll,'scroll preserved');assert(host.querySelector('[aria-label="Native Position X"]')===x,'control identity preserved');
  panel.open=true;
  for(const width of [140,180,220,360]){
   host.style.width=width+'px';const bounds=host.getBoundingClientRect();
   for(const input of host.querySelectorAll('input,select')){const r=input.getBoundingClientRect();assert(r.right<=bounds.right+1&&r.left>=bounds.left,'controls fit sidebar width '+width);}
  }
  assert([...host.querySelectorAll('.field-row')].every(row=>row.dataset.layout==='columns'),'all control rows use Properties layout');
  const checkbox=host.querySelector('[data-thruster-direction]');assert(checkbox.closest('.property-control').querySelector('.property-check-text'),'checkbox caption follows checkbox');
  assert(getComputedStyle(host.querySelector('.property-label')).textAlign==='right','labels align right');
  scene.loaded=false;panel.refresh();assert(panel.hidden,'empty model hides stale transform');scene.loaded=true;scene.selectedId='missing';panel.refresh();assert(x.value==='1.000','missing selection falls back to a live block');
  dispose();host.style.width='260px';return 'Live selection/transform updates, retained panel state, Properties formatting, and widths 140–360 passed';
 });
 await mkdir('test-results/images',{recursive:true});await page.locator('.viewport-sidebar').screenshot({path:'test-results/images/item-view-sidebar.png'});
 assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();await new Promise(r=>server.close(r));}
