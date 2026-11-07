import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';

// Bind only to loopback and serve the app and test assets from this checkout.
const root=resolve('.'),server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(/^\/__native\/[a-zA-Z0-9_-]+\.(png|bmp|jpg)$/.test(pathname)){
    try{res.setHeader('Content-Type','image/'+extname(pathname).slice(1));res.end(await readFile('C:/Program Files (x86)/Steam/steamapps/common/Avorion/AvorionGame/data/textures/blocks/'+pathname.split('/').pop()));}catch{res.writeHead(404).end();}return;
  }
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)||!/^\/(src|tests)\//.test(pathname)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto(base+'/tests/image-export.html');
 const xml=await readFile('C:/Users/joshu/AppData/Roaming/Avorion/ships/Tagawa Rose.xml','utf8');
 const files=await (await import('node:fs/promises')).readdir('C:/Program Files (x86)/Steam/steamapps/common/Avorion/AvorionGame/data/textures/blocks');
 const result=await page.evaluate(async({xml,files})=>{
  const {parseAvorionXml,makeModel}=await import('/src/block-model.js'),{drawGame,textureLibrary,releaseGameModel}=await import('/src/game-renderer.js'),{area}=await import('/src/layout.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const source=parseAvorionXml(xml,'Tagawa Rose.xml',xml.length),center={x:6.29,y:-23.2,z:13.776};
  const cropped=source.blocks.filter(b=>['x','y','z'].every(a=>Math.abs(b.position[a]-center[a])<=b.size[a]/2+7));
  const {getShadingSpec,textureName}=await import('/src/avorion/lib/textures/shadingMap.js');
  const needed=new Set();for(const b of cropped){const spec=getShadingSpec(b.typeIndex);for(const key of ['albedo','normal','mask','overlay','glow','normalOverlay','materialOverlay','materialGlow'])if(spec[key])needed.add(textureName(spec[key],b.materialIndex));}
  textureLibrary.setResolution(256);
  const textures=[];for(const name of files)if(needed.has(name.replace(/\.[^.]+$/,''))&&/\.(png|bmp|jpg)$/i.test(name)){const response=await fetch('/__native/'+name);if(response.ok)textures.push(new File([await response.blob()],name));}
  await textureLibrary.loadFiles(textures);
  const scene={model:makeModel(cropped,'Tagawa Rose thruster crop'),loaded:true,visible:true,revision:700,hiddenIds:new Set(),selectedIds:new Set()};
  const canvas=document.querySelector('canvas');canvas.width=900;canvas.height=700;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const view={...area().view,imageTime:.7,grid:false,projection:'orthographic',yaw:Math.PI/2,pitch:0,zoom:2,orthographicDistance:30,target:[6.29,-13.776,-23.2],panX:0,panY:0,display:{shading:'RENDERED',showOverlays:false,focalLength:50}};
  const prefs={...FACTORY_PREFERENCES,shaderEngineState:0,shaderAO:0,shaderSpill:0,shaderBloom:.6,shaderThrust:1,shaderThrustRight:true,shaderThrustLeft:false,shaderThrustFront:false,shaderThrustBack:false,shaderThrustTop:false,shaderThrustBottom:false};
  const images={},blue={};for(const active of [0,1]){
   drawGame(ctx,scene,view,900,700,{...prefs,shaderThrust:active},1);const key=active?'active':'inactive';images[key]=canvas.toDataURL();
   const pixels=ctx.getImageData(400,300,100,100).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+2]>pixels[i]+20&&pixels[i+2]>pixels[i+1]+5)count++;blue[key]=count;
  }
  if(blue.active<=blue.inactive+10)throw Error('Reference ship must show blue exhaust at the photographed port');
  view.yaw=1.15;view.pitch=.12;drawGame(ctx,scene,view,900,700,prefs,1);images.oblique=canvas.toDataURL();
  releaseGameModel();return {sourceBlocks:source.blocks.length,blocks:scene.model.blocks.length,textures:textureLibrary.loadedCount,blue,images};
 },{xml,files});
 await mkdir('test-results/images',{recursive:true});for(const [name,data] of Object.entries(result.images))await (await import('node:fs/promises')).writeFile('test-results/images/tagawa-thruster-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);console.log('Tagawa Rose comparison rendered:',result.blocks,'nearby blocks from',result.sourceBlocks,'total,',result.textures,'textures; blue port pixels:',result.blue);
}finally{await browser.close();await new Promise(r=>server.close(r));}
