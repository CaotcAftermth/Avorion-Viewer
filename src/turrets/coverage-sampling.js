import * as THREE from '../vendor/three.module.js';
export const QUALITY={low:{angles:72,rings:8,detail:1},medium:{angles:144,rings:16,detail:3},high:{angles:288,rings:24,detail:7}};
export const COVERAGE_DEFAULTS={mode:'slice',metric:'clear',plane:'top',offset:0,radius:null,extent:null,quality:'medium',opacity:.8,showShip:true,showGrid:false,showObstructions:true,overlapOnly:false,individual:true,sliceStyle:'polar',selection:'all',includeHidden:false,includeTransparent:false,includeDecorative:false,scaleMax:5,autoScale:false,palette:'classic',inspect:false,gpu:false};
export function coverageOptions(scene){return {...COVERAGE_DEFAULTS,...scene.weaponCoverage};}
// Solid angle of a spherical triangle seen from its center (Van Oosterom–Strackee).
export function solidAngle(center,a,b,c){
 const r=[a,b,c].map(p=>new THREE.Vector3(...p).sub(new THREE.Vector3(...center))),l=r.map(x=>x.length());
 const numerator=r[0].dot(r[1].clone().cross(r[2])),denominator=l[0]*l[1]*l[2]+r[0].dot(r[1])*l[2]+r[0].dot(r[2])*l[1]+r[1].dot(r[2])*l[0];
 return Math.abs(2*Math.atan2(numerator,denominator));
}
export function polygonArea(vertices){
 const a=new THREE.Vector3(...vertices[0]),sum=new THREE.Vector3();
 for(let i=1;i<vertices.length-1;i++)sum.add(new THREE.Vector3(...vertices[i]).sub(a).cross(new THREE.Vector3(...vertices[i+1]).sub(a)));
 return sum.length()/2;
}
export function sampleTargets(options,center,minimumRadius){
 const q=QUALITY[options.quality]||QUALITY.medium,c=new THREE.Vector3(...center),cells=[];
 if(options.mode==='sphere'){
  const radius=Math.max(minimumRadius,Number(options.radius)||minimumRadius*1.5),geometry=new THREE.IcosahedronGeometry(radius,q.detail),p=geometry.getAttribute('position');
  // Geodesic triangle cells avoid duplicated polar samples and longitude seams.
  // Each cell carries its exact solid angle, so statistics are direction-weighted.
  for(let i=0;i<p.count;i+=3){const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j)),point=vertices.reduce((n,v)=>n.add(v),new THREE.Vector3()).normalize().multiplyScalar(radius).add(c),corners=vertices.map(v=>v.add(c).toArray());
   cells.push({point:point.toArray(),vertices:corners,footprint:Math.max(...corners.map(v=>Math.hypot(...v.map((n,k)=>n-point.getComponent(k))))),weight:solidAngle(center,...corners)});}
  geometry.dispose();return {cells,radius,center,mode:'sphere'};
 }
 const extent=Math.max(.1,Number(options.extent)||minimumRadius*1.5),step=extent/q.rings,angleStep=2*Math.PI/q.angles;
 const axes=options.plane==='front'?[0,1,2]:options.plane==='side'?[2,1,0]:[0,2,1];
 const point=(a,b)=>{const p=[...center];p[axes[0]]+=a;p[axes[1]]+=b;p[axes[2]]+=Number(options.offset)||0;return p;};
 const polar=(r,a)=>point(r*Math.cos(a),r*Math.sin(a));
 // Concentric sectors preserve a circular slice and continuous firing fans.
 // Each sector still evaluates its own finite target, including near-hull occlusion.
 for(let j=0;j<q.rings;j++)for(let i=0;i<q.angles;i++){
  const inner=j*step,outer=(j+1)*step,a=i*angleStep,b=(i+1)*angleStep,vertices=[polar(inner,a),polar(outer,a),polar(outer,b),polar(inner,b)],mid=polar((inner+outer)/2,(a+b)/2);
  cells.push({point:mid,vertices,footprint:Math.max(...vertices.map(v=>Math.hypot(...v.map((n,k)=>n-mid[k])))),weight:polygonArea(vertices)});
 }
 return {cells,center,extent,step,angles:q.angles,rings:q.rings,mode:'slice',plane:options.plane,offset:options.offset};
}
// Selection no longer requires a recalculation: every enabled turret is analyzed
// and the chosen subset is applied when the result is displayed.
export function analysisKey(options){return JSON.stringify([options.mode,options.plane,options.offset,options.radius,options.extent,options.quality,!!options.gpu,options.mode==='slice'?options.sliceStyle||'polar':null]);}
export function classifySample(s){
 if(!s.valid)return 'inside-geometry';
 if(s.clear)return s.obstructed?'partially-obstructed':'covered';
 // Unknown aiming only matters where no resolved turret already covers the point.
 if(s.unresolved?.length)return 'unresolved';
 return s.potential?'structurally-obstructed':'uncovered';
}
export function filterSample(s,ids){
 if(!ids)return s;const keep=new Set(ids),contributors=s.contributors.filter(t=>keep.has(t.id)),clear=contributors.filter(t=>t.clear).length;
 const next={...s,contributors,unresolved:s.unresolved.filter(id=>keep.has(id)),potential:contributors.length,clear,obstructed:contributors.length-clear};
 next.classification=classifySample(next);return next;
}
const filtered=new WeakMap();
export function filterResult(result,ids){
 if(!result||!ids)return result;
 const key=JSON.stringify(ids),cached=filtered.get(result);if(cached?.key===key)return cached.value;
 const keep=new Set(ids),value={...result,filterIds:[...ids],samples:result.samples.map(s=>filterSample(s,ids)),turrets:result.turrets.filter(t=>keep.has(t.id))};
 filtered.set(result,{key,value});return value;
}
export const COUNT_COLORS=['#03070e','#184bda','#15b6e1','#42ce68','#f7df42','#ef5037'];
export const TURRET_COLORS=['#58bbef','#edae42','#a375db','#56cd8a','#ee685e','#51d4cb'];
export function heatColor(value,limit=5,palette='classic'){
 const stops=palette==='accessible'?['#03070e','#3268b7','#85c2e2','#ecdeae','#de954a','#bc5428']:COUNT_COLORS;
 const t=Math.max(0,Math.min(1,value/Math.max(1,limit)))*(stops.length-1),i=Math.min(stops.length-2,Math.floor(t));
 return new THREE.Color(stops[i]).lerp(new THREE.Color(stops[i+1]),t-i);
}
// Diverging scale for layout comparisons: red lost turrets, green gained.
export function differenceColor(delta,limit=3){
 const t=Math.max(-1,Math.min(1,delta/Math.max(1,limit)));
 return new THREE.Color('#2a3038').lerp(new THREE.Color(t<0?'#e2504a':'#3fcf72'),Math.abs(t));
}
export const CLASS_COLORS={'uncovered':'#151a22','structurally-obstructed':'#e74781','partially-obstructed':'#dfaa48','covered':'#42ca75','unresolved':'#a47bd1','inside-geometry':'#69727c'};
export function sampleColor(sample,options,max=5){
 if(!sample.valid||sample.classification==='unresolved'||options.metric==='blind')return CLASS_COLORS[sample.classification];
 const limit=Math.max(1,options.autoScale?max:options.scaleMax);
 return '#'+heatColor(sample[options.metric]||0,limit,options.palette).getHexString();
}
