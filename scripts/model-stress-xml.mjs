import {stat,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readHull,options,createPlan} from './generate-stress-xml.mjs';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {boxTypes,isCanonicalBox} from '../src/avorion/lib/geometry/boxInstances.js';
import {wedgeTypes,endpointBoundsWriter} from '../src/avorion/lib/geometry/wedgeInstances.js';
import {blockSurfaceVertexCount} from '../src/avorion/lib/geometry/blockSurface.js';
import {getShadingSpec} from '../src/avorion/lib/textures/shadingMap.js';
import {blockOpacity} from '../src/block-opacity.js';

const profile=defaultOrientationProfile(),axes=['x','y','z'];
const boxes=endpointBoundsWriter(profile,'box'),wedges=endpointBoundsWriter(profile,'wedge');
export async function analyze(rows,{blocks,bounds},mode='m5'){
  if(!['legacy','m4','m5'].includes(mode))throw Error('Unknown grouping mode: '+mode);
  const offset=bounds.min.map((min,i)=>(min+bounds.max[i])/2);
  const cell=Math.max(1,Math.max(...bounds.min.map((min,i)=>bounds.max[i]-min))/Math.max(1,Math.cbrt(blocks/1024)));
  const groups=new Map(),details=new Map(),expanded=[0,0,0];
  const specFor=type=>{
    let entry=details.get(type);
    if(!entry){entry={spec:getShadingSpec(type),vertices:blockSurfaceVertexCount(type)};details.set(type,entry);}
    return entry;
  };
  let seen=0,candidates=0,qualified=0,precision=0,unsupported=0,worstCase=0,expandedBlocks=0;
  let canonicalInstances=0,legacyInstances=0,smallGroups=0,budgetRejected=0,canonicalSmall=0,canonicalBudget=0;
  let instanceBytes=0,templateBytes=0,chunks=0;
  const expand=(count,vertices,kind)=>{expanded[kind]+=vertices*count;expandedBlocks+=count;};
  for await(const r of rows){
    seen++;
    const {type,material,look,up,color}=r,{spec,vertices}=specFor(type);
    worstCase+=vertices*176;
    const position={},size={};
    axes.forEach((a,i)=>{position[a]=(+r.bounds[i]+ +r.bounds[i+3])/2-offset[i];size[a]=r.bounds[i+3]-r.bounds[i];});
    const block={typeIndex:type,materialIndex:material,look,up,position,size,color};
    const double=!!(spec.translucent||spec.cutout);
    const isBox=boxTypes.has(type),isWedge=wedgeTypes.has(type),candidate=(isBox||isWedge)&&!double;
    candidates+=Number(candidate);
    unsupported+=Number(!candidate);
    const canonical=mode!=='legacy'&&candidate&&(isBox?(mode==='m5'?boxes(block):isCanonicalBox(block,profile)):wedges(block));
    qualified+=Number(canonical);precision+=Number(mode!=='legacy'&&candidate&&!canonical);
    if(spec.translucent&&!(spec.surface==='hologram'&&blockOpacity(block)>=1)){expand(1,vertices,2);continue;}
    const layout=canonical?(isWedge?'wedge':'box'):'legacy';
    // For this fixture dialect, flags are constant per type. Material and spatial
    // keys, exact size keys, and insertion order match the renderer.
    const key=[type,material,canonical&&mode==='m5'?'':look+'/'+up,canonical?layout:axes.map(a=>size[a]).join('|'),...axes.map(a=>Math.floor(position[a]/cell))].join('|');
    let group=groups.get(key);
    if(!group){group={count:0,canonical,vertices,kind:double?1:0,instanceSize:canonical?(mode==='m4'&&isBox?116:128):104};groups.set(key,group);}
    group.count++;
  }
  if(seen!==blocks)throw Error('Expected '+blocks+' blocks, read '+seen+'.');
  const allowance=Math.max(16,2*Math.ceil(blocks/1024));
  for(const g of [...groups.values()].sort((a,b)=>b.count-a.count)){
    const required=Math.ceil(g.count/1024);
    if(g.count<16||chunks+required>allowance){
      if(g.count<16){smallGroups+=g.count;canonicalSmall+=g.canonical?g.count:0;}
      else{budgetRejected+=g.count;canonicalBudget+=g.canonical?g.count:0;}
      expand(g.count,g.vertices,g.kind);
    }else{
      chunks+=required;instanceBytes+=g.count*g.instanceSize;templateBytes+=required*g.vertices*80;
      if(g.canonical)canonicalInstances+=g.count;else legacyInstances+=g.count;
    }
  }
  const indexBytes=expanded[2]*(expanded[2]>65535?4:2);
  const expandedBytes=expanded.reduce((sum,n)=>sum+n*172,0);
  return {mode,blocks,cell,candidates,qualified,precisionRejected:precision,unsupported,canonicalInstances,legacyInstances,expandedBlocks,
    smallGroupBlocks:smallGroups,budgetRejected,canonicalSmallGroupBlocks:canonicalSmall,canonicalBudgetRejected:canonicalBudget,
    groups:groups.size,allowance,chunks,batches:chunks+expanded.filter(Boolean).length,expandedBytes,indexBytes,instanceBytes,templateBytes,
    hullBytes:expandedBytes+indexBytes+instanceBytes+templateBytes,legacyRetryUpperBoundBytes:worstCase};
}

export async function modelFile(path,mode){
  const manifest=JSON.parse(await readFile(path+'.manifest.json','utf8'));
  if((await stat(path)).size!==manifest.xmlBytes)throw Error('Fixture size differs from manifest.');
  const hash=createHash('sha256');
  const report=await analyze(readHull(path,{hash}),{blocks:manifest.actualBlocks,bounds:manifest.bounds},mode);
  const sha256=hash.digest('hex');
  if(manifest.sha256&&sha256!==manifest.sha256)throw Error('Fixture checksum differs from manifest.');
  return {...report,sha256,checksumVerified:!!manifest.sha256};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const [first,mode,...args]=process.argv.slice(2);
    if(first==='--project'){
      const config=options([mode,...args]),plan=await createPlan(config);
      const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
      for(const b of plan.rows())for(let i=0;i<3;i++){
        bounds.min[i]=Math.min(bounds.min[i],+b.bounds[i]);
        bounds.max[i]=Math.max(bounds.max[i],+b.bounds[i+3]);
      }
      console.log(JSON.stringify(await analyze(plan.rows(),{blocks:config.blocks,bounds},'m5'),null,2));
    }else{
      if(!first)throw Error('Usage: node scripts/model-stress-xml.mjs FIXTURE.xml [m5|m4|legacy], or --project GENERATOR_OPTIONS');
      console.log(JSON.stringify(await modelFile(first,mode),null,2));
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
