import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {serveWorkspace} from './local-route.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();await serveWorkspace(page);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGL/.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/__empty');
 const result=await page.evaluate(async options=>{
  const {forceFallback,loadingPreview}=options;
  const THREE=await import('/src/vendor/three.module.js');
  const {textureLibrary:t}=await import('/src/avorion/lib/textures/textureLibrary.js');
  const {buildTexturedModel}=await import('/src/avorion/lib/geometry/texturedModel.js');
  const {makeBlock,makeModel}=await import('/src/block-model.js');
  const {defaultOrientationProfile}=await import('/src/avorion/lib/avorion/orientation.js');
  const {DEFAULT_GAME_SHADER}=await import('/src/avorion/types/index.js');
  t.clear();t.nativeQuality=true;
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#b04724';ctx.fillRect(0,0,2048,256);
  const file=new File([await new Promise(r=>canvas.toBlob(r))],'plates0.png');canvas.width=128;canvas.height=64;ctx.fillStyle='#245fb0';ctx.fillRect(0,0,128,64);const small=new File([await new Promise(r=>canvas.toBlob(r))],'plates1.png');await t.loadFiles([file,small]);
  const preview=[t.images.get('plates0').width,t.images.get('plates0').height];
  const model=makeModel([makeBlock({id:1,materialIndex:0,position:{x:-.6,y:0,z:0}}),makeBlock({id:2,materialIndex:1,position:{x:.6,y:0,z:0}})]),built=buildTexturedModel(model,defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true,loadingPreview});
  const mesh=built.group.children.find(x=>x.userData.textured),geometry=mesh.geometry;
  built.setSelection([model.blocks[0].id]);const state=Array.from(geometry.getAttribute('aParams').array);
  const scene=new THREE.Scene();scene.add(built.group);const camera=new THREE.PerspectiveCamera(45,1,.01,100);camera.position.set(3,3,3);camera.lookAt(0,0,0);
  const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(128,128);document.body.append(renderer.domElement);
  renderer.render(scene,camera);const gl=renderer.getContext(),before=new Uint8Array(128*128*4),calls=renderer.info.render.calls;gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,before);const cameraState=camera.matrixWorld.toArray(),old=mesh.material.uniforms.uAlbedo.value;
  built.markPreviewPresented();await t.upgradeTask;await built.updateTextures(async texture=>renderer.initTexture(texture),async staging=>{const scene=new THREE.Scene();scene.add(staging);await renderer.compileAsync(scene,camera);},{vertexScales:!forceFallback&&renderer.capabilities.maxVaryings>=24&&renderer.capabilities.vertexTextures});renderer.render(scene,camera);
  const after=new Uint8Array(before.length);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,after);let maxPixelDifference=0;for(let i=0;i<after.length;i++)maxPixelDifference=Math.max(maxPixelDifference,Math.abs(after[i]-before[i]));
  const result={startedQuick:loadingPreview,fullDetailReady:!mesh.material.userData.loadingPreview,previewVisible:before.some((value,i)=>i%4!==3&&value>0),vertexScales:!!mesh.material.defines.NATIVE_SCALE_VERTEX,maxPixelDifference,sameDrawCalls:renderer.info.render.calls===calls,hasLargeArray:!!mesh.material.uniforms.uAlbedoLarge.value,preview,native:[t.images.get('plates0').width,t.images.get('plates0').height],sameGeometry:mesh.geometry===geometry,sameSelection:JSON.stringify(state)===JSON.stringify(Array.from(geometry.getAttribute('aParams').array)),sameCamera:JSON.stringify(cameraState)===JSON.stringify(camera.matrixWorld.toArray()),swapped:mesh.material.uniforms.uAlbedo.value!==old,glError:renderer.getContext().getError(),programs:renderer.info.programs.map(p=>p.diagnostics?.runnable!==false)};
  built.dispose();renderer.dispose();t.clear();return result;
 },{forceFallback:process.env.NATIVE_SCALE_FALLBACK==="1",loadingPreview:process.env.FAST_TEXTURE_PREVIEW==="1"});
 assert.deepEqual(result.preview,[512,512]);assert.deepEqual(result.native,[2048,256]);
 for(const key of ['sameGeometry','sameSelection','sameCamera','swapped','sameDrawCalls','hasLargeArray'])assert.equal(result[key],true,key);
 if(!result.startedQuick)assert.ok(result.maxPixelDifference<=1);assert.ok(result.previewVisible);assert.ok(result.fullDetailReady);assert.equal(result.glError,0);assert.ok(result.programs.every(Boolean));assert.deepEqual(errors,[]);
 console.log(JSON.stringify(result));
}finally{await browser.close();}
