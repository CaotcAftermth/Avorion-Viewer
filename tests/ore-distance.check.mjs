import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
import {viewerHandler} from '../scripts/serve.mjs';
const root=process.env.AVORION_TEXTURE_DIR||'C:/Program Files (x86)/Steam/steamapps/common/Avorion/data/textures/blocks';
const textures=await Promise.all(['rock.png','melted-rock.png','rock_n.bmp','melted-rock_n.bmp'].map(async name=>({name,data:(await readFile(root+'/'+name)).toString('base64')})));
const handler=viewerHandler('.'),server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(async textures=>{
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{drawGame,textureLibrary,releaseGameModel}=await import('/src/game-renderer.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js'),{area}=await import('/src/layout.js'),{ensureViewportOptions}=await import('/src/viewport-options.js');
  textureLibrary.clear();await textureLibrary.loadFiles(textures.map(t=>new File([Uint8Array.from(atob(t.data),c=>c.charCodeAt(0))],t.name,{type:t.name.endsWith('.bmp')?'image/bmp':'image/png'})));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const scene={loaded:true,visible:true,selected:false,selectedIds:new Set(),hiddenIds:new Set(),revision:0};
  const view={...area().view,yaw:0,pitch:0,zoom:.7,projection:'orthographic',grid:false,target:[0,0,0],panX:0,panY:0};Object.assign(ensureViewportOptions(view),{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#000000',showOverlays:false,objectOutline:false,dof:false,shadows:false,ambientOnly:false});
  const prefs={...FACTORY_PREFERENCES,shaderAmbient:0,shaderLight:0,shaderSkyAmbient:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderGlow:1,shaderBloom:0,shaderAO:0,shaderSpill:0,shaderExposure:0};
  const samples=[],rows=[];
  for(const [type,name]of [[510,'Rich Stone'],[520,'Super Rich Stone'],[540,'Rich Rift Stone'],[550,'Super Rich Rift Stone'],[560,'Glow Stone']]){
   scene.model=makeModel([makeBlock({typeIndex:type,materialIndex:0,size:{x:10,y:10,z:10},position:{x:0,y:0,z:0},color:'ff777777'})]);scene.revision++;
   for(const mode of ['emission','normal']){
    let reference;
    for(const distance of [16,24,32,40,64]){
     view.zoom=.7;view.orthographicDistance=distance;
     drawGame(ctx,scene,view,192,192,{...prefs,shaderGlow:mode==='emission'?1:0,shaderLight:mode==='normal'?.7:0,shaderAmbient:mode==='normal'?.1:0},1);
     const pixels=ctx.getImageData(0,0,192,192).data;
     if(!reference)reference=new Uint8ClampedArray(pixels);
     let sum=0,max=0,lit=0;
     for(let i=0;i<pixels.length;i++)if(i%4!==3){const difference=Math.abs(pixels[i]-reference[i]);sum+=difference;max=Math.max(max,difference);if(pixels[i]>8)lit++;}
     samples.push({type,mode,distance,meanDifference:sum/(192*192*3),maxDifference:max,lit});
    }
   }
   const images=[];
   for(const zoom of [.35,.5,.7,1]){
    view.zoom=zoom;view.orthographicDistance=0;drawGame(ctx,scene,view,192,192,{...prefs,shaderAmbient:.15,shaderLight:.3},1);images.push({name:'Zoom '+zoom,data:canvas.toDataURL()});
   }
   rows.push({name,images});
  }
  releaseGameModel();textureLibrary.clear();return {samples,rows};
 },textures);
 await mkdir('test-results/stone-emission',{recursive:true});await writeFile('test-results/stone-emission/distance-samples.json',JSON.stringify(result.samples,null,2));
 const sheet=await browser.newPage({viewport:{width:810,height:1350}});await sheet.setContent('<body style="margin:0;padding:12px;background:#181c20;color:#eee;font:14px system-ui"><main></main>');await sheet.evaluate(rows=>{const host=document.querySelector('main');for(const row of rows){const h=document.createElement('h2');h.textContent=row.name;h.style='font-size:16px;margin:8px 0';host.append(h);const grid=document.createElement('div');grid.style='display:flex;gap:4px';for(const item of row.images){const f=document.createElement('figure');f.style='margin:0';const img=document.createElement('img');img.src=item.data;img.width=192;const cap=document.createElement('figcaption');cap.textContent=item.name;f.append(img,cap);grid.append(f);}host.append(grid);}},result.rows);await sheet.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));await sheet.screenshot({path:'test-results/stone-emission/distance-comparison.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const failures=result.samples.filter(s=>s.meanDifference>.05||s.maxDifference>3);
 assert.equal(failures.length,0,'Camera distance must not change ore albedo/emission or normal detail at fixed projected size: '+JSON.stringify(failures));
 for(const type of [510,520,540,550,560])assert.ok(result.samples.find(s=>s.type===type&&s.mode==='emission').lit>5,'Visible deposits: '+type);
 console.log(`Passed ${result.samples.length} native-texture GPU comparisons across five stone families, emission/normal passes, and camera distances 16–64.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
