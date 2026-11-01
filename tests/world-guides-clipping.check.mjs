import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/');
 const result=await page.evaluate(async()=>{
  const T=await import('/src/vendor/three.module.js'),{createWorldGuides}=await import('/src/world-guides.js'),{area}=await import('/src/layout.js');
  const renderer=new T.WebGLRenderer();renderer.setSize(256,256);const target=new T.WebGLRenderTarget(256,256);renderer.setRenderTarget(target);
  const scene=new T.Scene(),guides=createWorldGuides();scene.add(guides.grid);
  const view=area().view;view.grid=true;view.display={gridScale:1,showOverlays:true};
  const theme={grid:'#ffffff',majorGrid:'#ffffff'},results=[];
  for(const ortho of [false,true]){
   const camera=ortho?new T.OrthographicCamera(-70,70,70,-70,.1,300):new T.PerspectiveCamera(70,1,.1,300);
   camera.position.set(0,60,80);camera.lookAt(0,0,0);camera.updateMatrixWorld();
   const render=(near)=>{camera.near=near;camera.updateProjectionMatrix();guides.update(camera,view,256,256,theme,1,false);guides.grid.material.uniforms.spacing.value=10;renderer.render(scene,camera);const pixels=new Uint8Array(256*256*4);renderer.readRenderTargetPixels(target,0,0,256,256,pixels);return pixels;};
   const wide=render(.1),tight=render(80);let differences=0,foreground=0;
   for(let n=0;n<wide.length;n+=4){if(Math.abs(wide[n]-tight[n])>3)differences++;if(n<256*80*4&&tight[n]>10)foreground++;}
   // An opaque object must still hide guides behind it.
   const box=new T.Mesh(new T.BoxGeometry(25,25,25),new T.MeshBasicMaterial({color:0xff0000}));box.position.y=15;scene.add(box);
   const occluded=render(.1),center=(128*256+128)*4;const hidden=occluded[center]>200&&occluded[center+1]===0;scene.remove(box);box.geometry.dispose();box.material.dispose();
   results.push({ortho,differences,foreground,hidden});
  }
  target.dispose();renderer.dispose();return results;
 });
 console.log(result);for(const r of result){assert.ok(r.differences<100,'Grid changes when near plane tightens');assert.ok(r.foreground>100,'Foreground grid absent');assert.ok(r.hidden,'Grid leaks through opaque geometry');}
}finally{await browser.close();}

