import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {WeaponEffectsSimulation} from '../src/turrets/effect-simulation.js';
import {WeaponEffectsRenderer} from '../src/turrets/effect-renderer.js';
import {resolveFiring} from '../src/turrets/effect-profiles.js';
import {FiringScheduler} from '../src/turrets/simulation.js';
const results=[];
for(const family of ['PointDefenseChainGun','Cannon','Laser','LightningGun','ForceGun','RocketLauncher']){
 const e=new WeaponEffectsSimulation(family),r=new WeaponEffectsRenderer(),muzzles=Array.from({length:8},(_,i)=>({position:[i,0,0],direction:[0,0,1],right:[1,0,0],localScale:1})),f=resolveFiring(e.profile,8,{pattern:'simultaneous',shots:4}),scheduler=new FiringScheduler([{...f,id:0}],ev=>e.consume({...ev,muzzleFrame:muzzles[ev.muzzle]})),runtime={effects:e,muzzles,settings:{repairMode:'dual'}};
 const samples=[];let peak=0,overflow=0;for(let i=1;i<=1200;i++){const start=performance.now(),time=i/120;scheduler.update(time);e.update(time,muzzles,[1000,0,1000],undefined,1/120);r.update(runtime);samples.push(performance.now()-start);peak=Math.max(peak,e.projectiles.length);overflow=Math.max(overflow,runtime.visualOverflow);}
 samples.sort((a,b)=>a-b);results.push({family,simulatedSeconds:10,muzzles:8,shotsPerMuzzle:4,meanCpuMs:samples.reduce((a,b)=>a+b)/samples.length,p95CpuMs:samples[Math.floor(samples.length*.95)],peakProjectiles:peak,beamMeshes:r.beams.length,overflow});assert.equal(overflow,0);r.dispose();
}
await writeFile('test-results/phase3-performance.json',JSON.stringify({environment:'Node CPU simulation + GPU buffer preparation; no GPU draw timing',results},null,2));console.log(JSON.stringify(results,null,2));
