import {createCoverageEngine} from './coverage-engine.js';
import {refineSlice} from './coverage-refinement.js';
import {sampleTargets} from './coverage-sampling.js';
import {createGpuCaster} from './coverage-gpu.js';
let engine,generation=0,gpu=null,gpuShip=null,gpuError='';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
// Hull rays go to the GPU caster when requested and available; turret geometry,
// aiming and any ray the shader could not finish stay on the exact CPU path.
function caster(enabled){
 if(!enabled){gpu?.dispose();gpu=null;gpuShip=null;return null;}
 if(gpu&&gpuShip===engine.ship)return gpu;
 gpu?.dispose();gpu=null;gpuShip=engine.ship;
 try{gpu=createGpuCaster(engine.ship);gpuError='';}catch(error){gpuError=error.message;}
 return gpu;
}
function evaluateMany(points,footprints,useGpu){
 const g=caster(useGpu);
 if(!g)return points.map((p,i)=>engine.evaluate(p,footprints[i]));
 const plans=points.map((p,i)=>engine.plan(p,footprints[i])),rays=plans.flatMap(p=>p.rays),hits=g.cast(rays);let k=0;
 return plans.map(plan=>{const own=hits.slice(k,k+plan.rays.length);k+=plan.rays.length;
  // Uncertain shader rays are repeated exactly on the CPU.
  return engine.resolve(plan,own.some(h=>h?.uncertain)?null:own);});
}
self.onmessage=async({data})=>{
 const token=++generation,id=data.id;
 try{
  const started=performance.now();
  if(data.input)engine=createCoverageEngine(data.input,engine);
  if(!engine)throw Error('No coverage geometry available.');
  if(token!==generation)return;
  const useGpu=!!data.options.gpu;caster(useGpu);
  const metadata={center:engine.center,minimumRadius:engine.minimumRadius,warnings:[...engine.warnings,...(useGpu&&!gpu?[`GPU hull rays unavailable (${gpuError||'no WebGL2'}); using CPU`]:[])],
   gpu:!!(useGpu&&gpu),rebuiltTurrets:engine.rebuilt,
   turrets:engine.turrets.map((t,colorIndex)=>({id:t.id,name:t.name,colorIndex,position:t.socket.position,estimated:t.muzzles.estimated,constraints:t.constraints}))};
  for(const quality of data.options.quality==='low'?['low']:['low',data.options.quality]){
   const sampling=sampleTargets({...data.options,quality},engine.center,engine.minimumRadius),samples=[],passStarted=performance.now();
   // GPU batches are larger: each batch costs one synchronous readback.
   const chunk=useGpu&&gpu?1024:64;
   for(let i=0;sampling.mode!=='slice'&&i<sampling.cells.length;i+=chunk){
    const cells=sampling.cells.slice(i,i+chunk);samples.push(...evaluateMany(cells.map(c=>c.point),cells.map(c=>c.footprint),useGpu));
    self.postMessage({id,progress:{done:Math.min(sampling.cells.length,i+chunk),total:sampling.cells.length,quality}});await pause();if(token!==generation)return;
   }
   if(token!==generation)return;
   let refined=null;
   if(sampling.mode==='slice')refined=await refineSlice(sampling,(p,f)=>engine.evaluate(p,f),{
    depth:quality==='low'?1:quality==='high'?3:2,footprintSensitive:engine.footprintSensitive,
    evaluateMany:useGpu&&gpu?async(points,footprints)=>evaluateMany(points,footprints,true):null,
    checkpoint:async done=>{self.postMessage({id,progress:{done,total:'adaptive',quality}});await pause();if(token!==generation)throw Error('Cancelled');}
   });
   if(token!==generation)return;
   self.postMessage({id,result:{...sampling,samples,...refined,...metadata,warnings:[...metadata.warnings,...(refined?.refinement.limited?['Boundary refinement budget reached; remaining edges are approximate']:[])],quality,elapsed:performance.now()-passStarted,totalElapsed:performance.now()-started},final:quality===data.options.quality});
   await pause();if(token!==generation)return;
  }
 }catch(error){if(token===generation)self.postMessage({id,error:error.message});}
};
