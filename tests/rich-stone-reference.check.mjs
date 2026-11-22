import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
import {viewerHandler} from '../scripts/serve.mjs';
const before=await readFile(process.env.STONE_REFERENCE_BEFORE||'test-results/stone-emission/pre-rich-shader.glsl','utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const beforeLoader=process.env.STONE_REFERENCE_BEFORE?null:await readFile('test-results/stone-emission/pre-rich-textureLibrary.js','utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const root=process.env.AVORION_TEXTURE_DIR||'C:/Program Files (x86)/Steam/steamapps/common/Avorion/data/textures/blocks';
const textures=await Promise.all(['rock.png','melted-rock.png','rock_n.bmp','melted-rock_n.bmp'].map(async name=>({name,data:(await readFile(root+'/'+name)).toString('base64')})));
const handler=viewerHandler('.'),server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const rows=[];
 for(const old of before?[true,false]:[false]){
  const page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(old)await page.route('**/src/avorion/lib/geometry/gameShader.js',route=>route.fulfill({contentType:'text/javascript',body:before}));
  if(old&&beforeLoader)await page.route('**/src/avorion/lib/textures/textureLibrary.js',route=>route.fulfill({contentType:'text/javascript',body:beforeLoader}));
  await page.goto(`http://127.0.0.1:${server.address().port}/?editor=texture-assignments`);await page.waitForFunction(()=>window.textureAssignments);
  const images=[];
  for(const typeIndex of [510,540]){
   await page.evaluate(async({textures,typeIndex})=>{const files=textures.map(t=>new File([Uint8Array.from(atob(t.data),c=>c.charCodeAt(0))],t.name,{type:t.name.endsWith('.bmp')?'image/bmp':'image/png'}));await window.textureAssignments.configure(files,null,{typeIndex,materialIndex:0},[],()=>{});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},{textures,typeIndex});
   const screenshot=await page.locator('[data-editor=viewport] canvas').first().screenshot();images.push({name:typeIndex===510?'Rich Stone':'Rich Rift Stone',data:'data:image/png;base64,'+screenshot.toString('base64')});
  }
  rows.push({name:old?'Before':'After',images});assert.deepEqual(errors,[]);await page.close();
 }
 const sheet=await browser.newPage({viewport:{width:1800,height:1500}});await sheet.setContent('<body style="margin:0;padding:16px;background:#222;color:#eee;font:16px system-ui"><main></main>');await sheet.evaluate(rows=>{const host=document.querySelector('main');for(const row of rows){const h=document.createElement('h2');h.textContent=row.name+' — actual texture-assignment fixture';host.append(h);const grid=document.createElement('div');grid.style='display:flex;gap:8px';for(const item of row.images){const f=document.createElement('figure');f.style='margin:0';const img=document.createElement('img');img.src=item.data;img.width=875;const cap=document.createElement('figcaption');cap.textContent=item.name;f.append(img,cap);grid.append(f);}host.append(grid);}},rows);await sheet.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));await mkdir('test-results/stone-emission',{recursive:true});await sheet.screenshot({path:'test-results/stone-emission/rich-stone-reference.png',fullPage:true});console.log('Rendered Rich Stone and Rich Rift Stone in the actual texture-assignment fixture with native albedo/normal maps.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
