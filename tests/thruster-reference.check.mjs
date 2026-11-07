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
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto(base+'/tests/image-export.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendor/three.module.js');
  const {makeBlock}=await import('/src/block-model.js');
  const {buildBlockEffects}=await import('/src/avorion/lib/geometry/blockEffects.js');
  const {defaultOrientationProfile}=await import('/src/avorion/lib/avorion/orientation.js');
  const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true,antialias:true});renderer.setSize(480,480);renderer.setClearColor(0x121212);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const world=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.6,.6,.6,-.6,.01,10),profile=defaultOrientationProfile();
  const owner=makeBlock({id:'owner',typeIndex:7,materialIndex:3,position:{x:0,y:0,z:0},size:{x:1,y:1,z:1},color:'ff696969',secondaryColor:'00000000'});
  const outputs={},measurements={};
  function render(gap,active,side=false){
   const block=(id,x,y,sx,sy)=>makeBlock({id,position:{x,y,z:.6},size:{x:sx,y:sy,z:.2}});
   const covers=[block('l',-(2+gap)/4,0,(2-gap)/2,2),block('r',(2+gap)/4,0,(2-gap)/2,2),block('t',0,(2+gap)/4,gap,(2-gap)/2),block('b',0,-(2+gap)/4,gap,(2-gap)/2)];
   const effects=buildBlockEffects([owner,...covers],profile,{thrustPreview:active,glowStrength:1,barrierStrength:0,thrustDirections:{positive:[0,0,1],negative:[0,0,0]}});effects.setTime(.7);world.add(...effects.meshes);
   const material=new THREE.MeshBasicMaterial({color:0x333333}),meshes=[];
   for(const b of [owner,...covers]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.size.x,b.size.y,b.size.z),material);mesh.position.set(b.position.x,b.position.y,b.position.z);world.add(mesh);meshes.push(mesh);}
   camera.position.set(side?3:0,0,side?1.3:3);camera.lookAt(0,0,.7);camera.updateMatrixWorld();renderer.render(world,camera);
   const pixels=new Uint8Array(480*480*4);renderer.getContext().readPixels(0,0,480,480,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);
   let blue=0;const bounds=[480,480,0,0];
   for(let y=0;y<480;y++)for(let x=0;x<480;x++){const i=(y*480+x)*4;if(pixels[i+2]>pixels[i]+5&&pixels[i+2]>=pixels[i+1]){blue++;bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}}
   const data=renderer.domElement.toDataURL(),center=[...pixels.slice((240*480+240)*4,(240*480+240)*4+3)];
   world.remove(...effects.meshes,...meshes);effects.dispose();for(const m of meshes)m.geometry.dispose();material.dispose();
   return {blue,bounds,center,data};
  }
  for(const [name,gap,active,side] of [['front',.02,1,false],['side',.02,1,true],['inactive',.02,0,false],['blocked',.019,1,false]]){const {data,...stats}=render(gap,active,side);outputs[name]=data;measurements[name]=stats;}
  renderer.dispose();return {outputs,measurements};
 });
 await mkdir('test-results/images',{recursive:true});
 for(const [name,data] of Object.entries(result.outputs))await (await import('node:fs/promises')).writeFile('test-results/images/thruster-reference-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));
 const m=result.measurements;console.log(JSON.stringify(m,null,2));
 assert.ok(m.front.blue>20,'head-on plume must have a blue glow');assert.ok(m.side.blue>20,'side plume must stay blue');assert.equal(m.inactive.blue,0);assert.equal(m.blocked.blue,0);
 const width=m.front.bounds[2]-m.front.bounds[0],height=m.front.bounds[3]-m.front.bounds[1];assert.ok(Math.abs(width-height)<width*.15,'head-on glow must be round, not a streak');assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
