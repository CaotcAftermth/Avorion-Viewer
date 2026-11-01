import {liveBlocks} from '../ship-structure.js';
import {mounts} from './mounts.js';
import {sceneSockets} from './sockets.js';
import {coverageOptions,analysisKey,filterResult} from './coverage-sampling.js';
const states=new WeakMap();let geometryVersion=0;
const notify=()=>window.dispatchEvent(new Event('avorion-model-ready'));
export const currentCoverage=scene=>states.get(scene);
// Identity comparison alone restarts analysis every frame when the block list is
// rebuilt on each call (for example before a model revision is assigned).
const sameBlocks=(a,b)=>a===b||!!a&&!!b&&a.length===b.length&&a.every((x,i)=>x===b[i]);
export function coverageFilter(scene,options=coverageOptions(scene),list=mounts(scene)){
 if(options.selection==='selected')return scene.selectedTurretIds?.size?[...scene.selectedTurretIds]:scene.selectedTurretId?[scene.selectedTurretId]:[];
 if(options.selection==='group')return list.filter(m=>options.group&&m.coverage?.group===options.group).map(m=>m.id);
 return null;
}
// Keep a pinned inspection on the same analyzed position when a refined pass
// replaces the preview, instead of discarding it.
function repin(inspection,result){
 if(!inspection||!result)return null;
 let best=-1,distance=Infinity;
 result.samples.forEach((s,i)=>{const d=Math.hypot(...s.point.map((n,k)=>n-inspection.sample.point[k]));if(d<distance){distance=d;best=i;}});
 const limit=result.mode==='sphere'?(result.radius||1)*.25:(result.step||result.extent||1);
 return best>=0&&distance<=limit?{index:best,sample:result.samples[best],center:result.center}:null;
}
function present(scene,s){
 s.result=filterResult(s.raw,s.filterIds);
 if(s.result!==s.presented){s.presented=s.result;scene.coverageHover=null;scene.coverageInspection=repin(scene.coverageInspection,s.result);}
}
export function ensureCoverage(scene){
 let s=states.get(scene);
 if(!scene.showFireCoverage||!scene.loaded){s?.worker?.terminate();states.delete(scene);return null;}
 if(!mounts(scene).length){s?.worker?.terminate();states.delete(scene);return null;}
 if(!s){s={id:0,requests:0};states.set(scene,s);}
 const blocks=liveBlocks(scene),list=mounts(scene),options=coverageOptions(scene),hidden=JSON.stringify([...scene.hiddenIds||[]].sort()),rules=JSON.stringify([options.includeHidden,options.includeTransparent,options.includeDecorative]);
 const blocksChanged=!sameBlocks(s.blocks,blocks);
 const geometryChanged=blocksChanged||(s.appearance!==scene.appearanceRevision&&s.mounts===list)||s.hidden!==hidden||s.rules!==rules;
 const engineChanged=geometryChanged||s.mounts!==list;
 const key=analysisKey(options),filterIds=coverageFilter(scene,options,list),filterKey=JSON.stringify(filterIds);
 if(!s.worker){s.worker=new Worker(new URL('./coverage.worker.js',import.meta.url),{type:'module'});
  s.worker.onmessage=({data})=>{if(data.id!==s.id)return;if(data.progress)s.status=`${data.progress.quality} · ${data.progress.done}/${data.progress.total} targets`;if(data.result){s.raw=data.result;present(scene,s);s.status=data.final?'':`${data.result.quality} preview · refining`;s.final=data.final;}if(data.error){s.status=data.error;s.error=true;}notify();};
  s.worker.onerror=e=>{s.status=e.message||'Coverage worker failed';s.error=true;notify();};
 }
 // Turret selection and groups are display filters over a result that already
 // contains every enabled turret, so changing them never re-runs the analysis.
 if(s.filterKey!==filterKey){s.filterKey=filterKey;s.filterIds=filterIds;if(s.raw)present(scene,s);}
 if(engineChanged||s.key!==key||s.recalculate!==options.recalculate){
  if(geometryChanged)s.shipKey=++geometryVersion;
  s.blocks=blocks;s.appearance=scene.appearanceRevision;s.hidden=hidden;s.rules=rules;s.mounts=list;s.key=key;s.recalculate=options.recalculate;
  s.id++;s.requests++;s.raw=null;s.result=null;s.final=false;s.error=false;s.status='Preparing weapon coverage…';scene.coverageHover=null;
  const input=engineChanged?{geometryAvailable:blocks.length>0,blocks:blocks.map(({el,itemEl,...b})=>b),mounts:list,sockets:sceneSockets(scene),shipKey:s.shipKey,hiddenIds:[...scene.hiddenIds||[]],rules:{includeHidden:options.includeHidden,includeTransparent:options.includeTransparent,includeDecorative:options.includeDecorative}}:undefined;
  s.worker.postMessage({id:s.id,input,options});
 }return s;
}
