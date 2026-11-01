// Direction-weighted coverage statistics, layout baselines and data export.
// Sphere cells are weighted by exact solid angle; polar slice arcs by bearing
// angle at infinity (field cells carry no weight); legacy slice cells by area.
// Each cell takes its analyzed center's classification: statistics share the
// sampling resolution of the display and are not exact area integrals.
import {polarSummary} from './coverage-polar.js';
const AXES={x:0,y:1,z:2},degrees=a=>a*180/Math.PI;
const REGIONS=[['Front (+Z)','z',1],['Rear (−Z)','z',-1],['Top (+Y)','y',1],['Bottom (−Y)','y',-1],['Right (+X)','x',1],['Left (−X)','x',-1]];
const planeNormal=plane=>plane==='front'?'z':plane==='side'?'x':'y';
function empty(name){return {name,weight:0,invalid:0,covered:0,overlap:0,blind:0,blocked:0,unresolved:0,clearSum:0};}
function add(bucket,s,w){
 if(!s.valid){bucket.invalid+=w;return;}
 bucket.weight+=w;bucket.clearSum+=s.clear*w;
 if(s.clear>=1)bucket.covered+=w;if(s.clear>=2)bucket.overlap+=w;
 if(!s.clear&&s.unresolved?.length)bucket.unresolved+=w;else if(!s.potential)bucket.blind+=w;else if(!s.clear)bucket.blocked+=w;
}
function finish(b){
 const n=b.weight||1;
 return {name:b.name,covered:b.covered/n,overlap:b.overlap/n,blind:b.blind/n,blocked:b.blocked/n,unresolved:b.unresolved/n,meanClear:b.clearSum/n,inside:b.invalid/((b.weight+b.invalid)||1),weight:b.weight};
}
export function coverageStats(result){
 if(!result?.samples?.length)return null;
 const total=empty('All directions'),skip=result.mode==='slice'?planeNormal(result.plane):null;
 const regions=REGIONS.filter(([,axis])=>axis!==skip).map(([name,axis,sign])=>({...empty(name),axis:AXES[axis],sign}));
 result.samples.forEach((s,i)=>{
  const cell=result.cells[i],w=cell?.weight??1,d=s.point.map((n,k)=>n-result.center[k]);
  add(total,s,w);for(const r of regions)if(d[r.axis]*r.sign>1e-9)add(r,s,w);
 });
 return {mode:result.mode,quality:result.quality,total:finish(total),regions:regions.map(finish)};
}
const percent=x=>`${Math.round(x*100)}%`;
export function describeStats(stats){
 return stats?[stats.total,...stats.regions].map(r=>`${r.name}: ${percent(r.covered)} covered · ${percent(r.overlap)} 2+ · mean ${r.meanClear.toFixed(2)} · blind ${percent(r.blind)} · blocked ${percent(r.blocked)}${r.unresolved>0?` · unresolved ${percent(r.unresolved)}`:''}`):[];
}
// Per-cell layout comparison needs identical targets. Sphere cells are
// deterministic for a radius and quality; adaptive slices are not, so slices
// compare statistics only.
export function baselineKey(result){
 return result?.mode==='sphere'?JSON.stringify(['sphere',result.quality,+result.radius.toFixed(6),result.center.map(n=>+n.toFixed(6)),result.samples.length]):null;
}
export function makeBaseline(result,label=''){
 return {label:label||`Baseline ${new Date().toLocaleTimeString()}`,mode:result.mode,quality:result.quality,key:baselineKey(result),filterIds:result.filterIds||null,
  stats:coverageStats(result),samples:result.mode==='sphere'?result.samples.map(s=>({valid:s.valid,clear:s.clear,potential:s.potential,obstructed:s.obstructed})):null};
}
export function baselineCompatible(baseline,result){return !!baseline?.key&&baseline.key===baselineKey(result);}
export function differences(baseline,result){
 if(!baselineCompatible(baseline,result))return null;
 return result.samples.map((s,i)=>{const b=baseline.samples[i];return s.valid&&b.valid?s.clear-b.clear:null;});
}
export function compareStats(baseline,result){
 const now=coverageStats(result),before=baseline?.stats;if(!now||!before)return [];
 const row=(a,b)=>`${a.name}: covered ${percent(b.covered)} → ${percent(a.covered)} · 2+ ${percent(b.overlap)} → ${percent(a.overlap)} · mean ${b.meanClear.toFixed(2)} → ${a.meanClear.toFixed(2)}`;
 return [row(now.total,before.total),...now.regions.map(r=>{const b=before.regions.find(x=>x.name===r.name);return b?row(r,b):null;}).filter(Boolean)];
}
export function exportCoverage(result,format='json'){
 const stats=coverageStats(result),names=new Map(result.turrets.map(t=>[t.id,t.name]));
 const rows=result.samples.map((s,i)=>{
  const d=s.point.map((n,k)=>n-result.center[k]),l=Math.hypot(...d)||1;
  return {point:s.point,direction:d.map(n=>n/l),weight:result.cells[i]?.weight??null,valid:s.valid,classification:s.classification,potential:s.potential,clear:s.clear,obstructed:s.obstructed,
   clearTurrets:s.contributors.filter(t=>t.clear).map(t=>t.id),blockedTurrets:s.contributors.filter(t=>!t.clear).map(t=>t.id),unresolved:[...s.unresolved],
   // Polar slices: arc rows are bearing intervals at infinity, field rows radial runs.
   ...(result.polar?{kind:result.cells[i].kind,bearingFrom:degrees(result.cells[i].from),bearingTo:degrees(result.cells[i].to),r0:result.cells[i].r0??null,r1:result.cells[i].r1??null}:{})};
 });
 if(format==='csv'){
  const quote=v=>/[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v,list=ids=>quote(ids.map(id=>names.get(id)||id).join(';'));
  const polar=!!result.polar,number=n=>n===null||n===undefined?'':n.toFixed(6);
  const header='x,y,z,dir_x,dir_y,dir_z,weight,valid,classification,potential,clear,obstructed,clear_turrets,blocked_turrets,unresolved_turrets'+(polar?',kind,bearing_from_deg,bearing_to_deg,r0,r1':'');
  return header+'\n'+rows.map(r=>[...r.point,...r.direction].map(n=>n.toFixed(6)).concat([r.weight===null?'':r.weight.toPrecision(8),r.valid,r.classification,r.potential,r.clear,r.obstructed,list(r.clearTurrets),list(r.blockedTurrets),list(r.unresolved)],polar?[r.kind,number(r.bearingFrom),number(r.bearingTo),number(r.r0),number(r.r1)]:[]).join(',')).join('\n')+'\n';
 }
 return JSON.stringify({format:'avorion-weapon-coverage',version:1,mode:result.mode,plane:result.plane??null,offset:result.offset??null,quality:result.quality,center:result.center,radius:result.radius??null,extent:result.extent??null,
  filterIds:result.filterIds||null,turrets:result.turrets.map(t=>({id:t.id,name:t.name,constraints:t.constraints})),warnings:result.warnings,stats,
  ...(result.polar?{polar:{reference:result.polar.reference,arcTolerance:degrees(result.polar.arcTolerance),radialTolerance:result.polar.radialTolerance,evaluations:result.polar.evaluations,summary:polarSummary(result)}}:{}),samples:rows},null,1);
}
