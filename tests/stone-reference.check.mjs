import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {viewerHandler} from '../scripts/serve.mjs';
// A local pre-change snapshot adds comparison rows; fresh checkouts validate current output only.
const before=await readFile('test-results/stone-emission/pre-rift-glow.json','utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const textureRoot=process.env.AVORION_TEXTURE_DIR||'C:/Program Files (x86)/Steam/steamapps/common/Avorion/data/textures/blocks';
const textures=await Promise.all(['rock.png','melted-rock.png'].map(async name=>({name,data:(await readFile(textureRoot+'/'+name)).toString('base64')})));
const handler=viewerHandler('.'),server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const rows=[],samples=[];
 for(const old of before?[true,false]:[false]){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(old)for(const [path,source]of Object.entries(before))await page.route('**/'+path,route=>route.fulfill({contentType:'text/javascript',body:source}));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result=await page.evaluate(async({textures,old})=>{
   const {makeBlock,makeModel}=await import('/src/block-model.js'),{drawGame,textureLibrary,releaseGameModel}=await import('/src/game-renderer.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js'),{area}=await import('/src/layout.js'),{ensureViewportOptions}=await import('/src/viewport-options.js'),{MATERIALS}=await import('/src/avorion/lib/avorion/blockDefinitions.js');
   textureLibrary.clear();await textureLibrary.loadFiles(textures.map(t=>new File([Uint8Array.from(atob(t.data),c=>c.charCodeAt(0))],t.name,{type:'image/png'})));
   const canvas=document.createElement('canvas');canvas.width=canvas.height=240;const ctx=canvas.getContext('2d',{willReadFrequently:true});
   const scene={loaded:true,visible:true,selected:false,selectedIds:new Set(),hiddenIds:new Set(),revision:0};
   const view={...area().view,yaw:0,pitch:0,zoom:.1,projection:'orthographic',grid:false,target:[0,0,0],panX:0,panY:0};
   Object.assign(ensureViewportOptions(view),{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#202020',showOverlays:false,objectOutline:false,dof:false,shadows:false,ambientOnly:false});
   const prefs={...FACTORY_PREFERENCES,shaderAmbient:.12,shaderLight:.3,shaderSkyAmbient:.05,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderGlow:1,shaderBloom:1,shaderAO:0,shaderSpill:0,shaderExposure:0};
   const render=(typeIndex,materialIndex,p=prefs)=>{scene.model=makeModel([makeBlock({typeIndex,materialIndex,size:{x:60,y:60,z:60},position:{x:0,y:0,z:0},color:'ff777777'})]);scene.revision++;drawGame(ctx,scene,view,240,240,p,1);return canvas.toDataURL();};
   const rows=[];
   rows.push({name:`${old?'Before':'After'} — Super Rich Rift Stone, bloom on`,images:[{name:'Iron',data:render(550,0)}]});
   for(const bloom of [0,1])rows.push({name:`${old?'Before':'After'} — Glow Stone, bloom ${bloom?'on':'off'} (identical texture coordinates)`,images:MATERIALS.map(m=>({name:m.name,data:render(560,m.index,{...prefs,shaderBloom:bloom})}))});
   const samples=[];
   if(!old){
    releaseGameModel();textureLibrary.clear();const c=document.createElement('canvas');c.width=c.height=16;const paint=c.getContext('2d');paint.fillStyle='rgb(77,77,77)';paint.fillRect(0,0,16,16);const blob=await new Promise(r=>c.toBlob(r));await textureLibrary.loadFiles(['rock.png','melted-rock.png'].map(name=>new File([blob],name,{type:'image/png'})));
    for(const m of MATERIALS)for(const glow of [0,1]){
     render(560,m.index,{...prefs,shaderAmbient:0,shaderLight:0,shaderSkyAmbient:0,shaderGlow:glow,shaderBloom:0});
     samples.push({material:m.name,glow,rgb:[...ctx.getImageData(120,120,1,1).data].slice(0,3),expected:m.paint.slice(1).match(/../g).map(v=>parseInt(v,16)/255)});
    }
   }
   releaseGameModel();textureLibrary.clear();return {rows,samples};
  },{textures,old});
  assert.deepEqual(errors,[]);rows.push(...result.rows);samples.push(...result.samples);await page.close();
 }
 for(const s of samples){const peak=Math.max(...s.rgb);if(!s.glow)assert.ok(peak<=3,'Glow Strength zero: '+s.material);else {assert.ok(peak>15&&peak<245,'unclipped color sample: '+s.material);const max=Math.max(...s.expected);s.rgb.forEach((v,i)=>assert.ok(Math.abs(v/peak-s.expected[i]/max)<.03,'pale material vein color: '+s.material));}}
 const sheet=await browser.newPage({viewport:{width:1740,height:1900}});await sheet.setContent('<html><body style="margin:0;padding:16px;background:#202020;color:#eee;font:16px system-ui"><div id="sheet"></div></body></html>');
 await sheet.evaluate(rows=>{const host=document.querySelector('#sheet');for(const row of rows){const h=document.createElement('h2');h.textContent=row.name;h.style='font-size:17px;margin:12px 0 4px';host.append(h);const grid=document.createElement('div');grid.style='display:flex;gap:2px';for(const item of row.images){const figure=document.createElement('figure');figure.style='margin:0';const img=document.createElement('img');img.src=item.data;img.width=240;const cap=document.createElement('figcaption');cap.textContent=item.name;figure.append(img,cap);grid.append(figure);}host.append(grid);}},rows);
 await sheet.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));await sheet.screenshot({path:'test-results/stone-emission/rift-glow-reference.png',fullPage:true});await writeFile('test-results/stone-emission/material-colors.json',JSON.stringify(samples,null,2));
 console.log(`Passed ${samples.length} GPU color/strength samples across all seven Glow Stone materials; saved native-texture before/after with bloom off/on.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
