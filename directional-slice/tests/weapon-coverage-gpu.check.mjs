import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
// GPU hull rays must agree with the CPU BVH, and a full GPU-assisted analysis
// must reproduce the CPU counts. Run with the local server on port 5173.
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/tests/graphics.html');
 const stats=await page.evaluate(async()=>{
  const THREE=await import('/src/vendor/three.module.js'),{makeBlock,makeModel}=await import('/src/block-model.js'),{obstacleTree,rayHit}=await import('/src/turrets/fire-coverage.js'),{createGpuCaster,gpuAvailable}=await import('/src/turrets/coverage-gpu.js');
  if(!gpuAvailable())return {available:false};
  const blocks=[];for(let x=0;x<40;x++)for(let z=0;z<60;z++)blocks.push(makeBlock({id:`h${x}-${z}`,typeIndex:(x+z)%5?2:4,position:{x:x*2-40,y:-2+((x*z)%3?0:1),z:z*2-60}}));
  const tree=obstacleTree(blocks),gpu=createGpuCaster(tree);let seed=11;const random=()=>(seed=(seed*48271)%2147483647)/2147483647;
  const rays=[];for(let i=0;i<20000;i++){const o=new THREE.Vector3(random()*100-50,random()*10,random()*140-70),aim=blocks[Math.floor(random()*blocks.length)].position,d=new THREE.Vector3(aim.x+random()*4-2,aim.y,aim.z+random()*4-2).sub(o).normalize();rays.push({origin:o,direction:d,limit:10+random()*120,epsilon:1e-4});}
  let t=performance.now();const hits=gpu.cast(rays);const gpuMs=performance.now()-t;
  t=performance.now();const cpu=rays.map(r=>rayHit(tree,r.origin,r.direction,r.limit,r.epsilon));const cpuMs=performance.now()-t;
  let mismatch=0,uncertain=0,hitCount=0,worst=0;
  hits.forEach((h,i)=>{if(h?.uncertain){uncertain++;return;}const c=cpu[i];if(!!h!==!!c||h&&h.blockId!==c.blockId&&Math.abs(h.distance-c.distance)>1e-3)mismatch++;if(c)hitCount++;if(h&&c)worst=Math.max(worst,Math.abs(h.distance-c.distance));});
  gpu.dispose();
  // Full worker pass, CPU versus GPU hull rays.
  const {ensureCoverage,currentCoverage}=await import('/src/turrets/coverage-state.js'),{demoProject}=await import('/src/turrets/core.js'),{blockSockets}=await import('/src/turrets/sockets.js'),{placeTurret}=await import('/src/turrets/mounts.js');
  const mounts=Array.from({length:8},(_,i)=>makeBlock({id:'m'+i,typeIndex:20,position:{x:i%4*18-27,y:0,z:Math.floor(i/4)*40-20}}));
  const run=async gpuOn=>{const scene={loaded:true,visible:true,revision:0,model:makeModel([...blocks,...mounts]),showFireCoverage:true,weaponCoverage:{mode:'sphere',quality:'medium',gpu:gpuOn}};
   const asset=demoProject().assets[0];for(const b of mounts)placeTurret(scene,asset,blockSockets(b).find(s=>s.normal[1]>.9),1);
   const started=performance.now();ensureCoverage(scene);
   await new Promise((resolve,reject)=>{const timer=setInterval(()=>{const s=currentCoverage(scene);if(s?.error){clearInterval(timer);reject(Error(s.status));}else if(s?.final){clearInterval(timer);resolve();}},20);});
   const s=currentCoverage(scene),result={ms:performance.now()-started,gpu:s.result.gpu,warnings:s.result.warnings,samples:s.result.samples.map(x=>[x.potential,x.clear,x.obstructed])};scene.showFireCoverage=false;ensureCoverage(scene);return result;};
  const cpuRun=await run(false),gpuRun=await run(true);
  const differing=gpuRun.samples.filter((x,i)=>x.join()!==cpuRun.samples[i].join()).length;
  return {available:true,rays:rays.length,hitCount,mismatch,uncertain,worst,gpuMs:Math.round(gpuMs),cpuMs:Math.round(cpuMs),sphere:{cpuMs:Math.round(cpuRun.ms),gpuMs:Math.round(gpuRun.ms),gpuActive:gpuRun.gpu,warnings:gpuRun.warnings,differing,total:cpuRun.samples.length}};
 });
 if(!stats.available){console.log('SKIP WebGL2 float render targets unavailable');}
 else{
  assert.ok(stats.hitCount>5000,'rays exercise real hull hits');
  assert.ok(stats.mismatch<=stats.rays*.002,`GPU/CPU hit mismatch ${stats.mismatch}`);
  assert.equal(stats.sphere.gpuActive,true);assert.ok(stats.sphere.differing<=Math.ceil(stats.sphere.total*.01),`sphere cells differing ${stats.sphere.differing}`);
  assert.deepEqual(errors,[]);console.log('PASS GPU hull rays '+JSON.stringify(stats));
 }
}finally{await browser.close();}
