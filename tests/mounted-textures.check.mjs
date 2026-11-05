import {serveWorkspace} from './local-route.mjs';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await serveWorkspace(page);await page.goto('http://127.0.0.1:5173/src/');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const result=await page.evaluate(async()=>{
  const T=await import('/src/vendor/three.module.js');
  const {makeBlock,makeModel}=await import('/src/block-model.js'),{assetFromModel}=await import('/src/turrets/core.js');
  const {blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret}=await import('/src/turrets/mounts.js'),{syncTurrets}=await import('/src/turrets/render.js');
  const {textureLibrary}=await import('/src/avorion/lib/textures/textureLibrary.js');const {gameParams}=await import('/src/game-renderer.js'),{FACTORY_PREFERENCES}=await import('/src/preferences.js');
  const world=new T.Scene(),block=makeBlock({typeIndex:20}),scene={model:makeModel([block]),loaded:true,visible:true,revision:1};
  const asset=assetFromModel(makeModel([makeBlock({color:'ffffffff',size:{x:3,y:3,z:3},position:{x:0,y:1.5,z:0}})]),'fixture');asset.sourceSize=1;asset.parts.b0='body';
  const socket=blockSockets(block).find(s=>s.normal[1]===1);placeTurret(scene,asset,socket,1);
  const view={display:{shading:'MATERIAL',showOverlays:true}},uniforms={uDisplayMode:{value:0},uBlueprint:{value:0},uWireThreshold:{value:.85}},options={params:gameParams(FACTORY_PREFERENCES),uniforms,time:0};
  const sync=()=>syncTurrets(world,scene,view,()=>{},options);
  let group=sync(),first=group.children[0].userData.texturedAttachment.rendered;
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(400,400);renderer.setClearColor('#101820');
  const camera=new T.PerspectiveCamera(40,1,.1,100);camera.position.set(7,7,9);camera.lookAt(0,3,0);
  const pixels=()=>{group.userData.prepare(camera);renderer.render(world,camera);const bytes=new Uint8Array(400*400*4);renderer.getContext().readPixels(0,0,400,400,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,bytes);return bytes;};
  const before=pixels();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,64,64);ctx.fillStyle='black';for(let y=0;y<8;y++)for(let x=0;x<8;x++)if((x+y)%2)ctx.fillRect(x*8,y*8,8,8);
  const blob=await new Promise(r=>canvas.toBlob(r));await textureLibrary.loadFiles([new File([blob],'plates0.png',{type:'image/png'})]);
  group=sync();const textured=group.children[0].userData.texturedAttachment.rendered,after=pixels();
  let delta=0;for(let i=0;i<after.length;i++)delta+=Math.abs(after[i]-before[i]);
  uniforms.uDisplayMode.value=1;view.display.shading='SOLID';sync();const solid=textured.materials.every(m=>m.uniforms.uDisplayMode.value===1);
  uniforms.uBlueprint.value=1;view.display.blueprint=true;sync();pixels();const blueprint=textured.materials.every(m=>m.uniforms.uBlueprint.value===1);
  delete view.display.blueprint;uniforms.uBlueprint.value=0;uniforms.uDisplayMode.value=0;view.display.shading='MATERIAL';sync();
  const mesh=textured.group.children.find(m=>m.userData.textured),rest=[...mesh.geometry.attributes.aSide.array],originalPositions=[...mesh.geometry.attributes.position.array];
  scene.model.turretMounts=scene.model.turretMounts.map(m=>({...m,yaw:45}));group=sync();pixels();
  const posed=group.children[0].userData.texturedAttachment.rendered.group.children.find(m=>m.userData.textured);
  const stable=JSON.stringify(rest)===JSON.stringify([...posed.geometry.attributes.aSide.array]);
  const rotated=JSON.stringify(originalPositions)!==JSON.stringify([...posed.geometry.attributes.position.array]);
  renderer.dispose();return {delta,reloaded:first!==textured,solid,blueprint,stable,rotated};
 });
 assert.ok(result.delta>10000,JSON.stringify(result));assert.ok(result.reloaded&&result.solid&&result.blueprint&&result.stable&&result.rotated);assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
