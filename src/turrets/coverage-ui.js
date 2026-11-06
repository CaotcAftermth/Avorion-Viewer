import {propertyPanel,propertyNote,propertyAction} from '../property-ui.js';
import {mounts,editTurrets,selectTurrets} from './mounts.js';
import {aimingConstraints} from './coverage-engine.js';
import {coverageOptions,COVERAGE_DEFAULTS,TURRET_COLORS} from './coverage-sampling.js';
import {currentCoverage} from './coverage-state.js';
import {coverageDescription} from './coverage-render.js';
import {coverageStats,describeStats,makeBaseline,baselineCompatible,compareStats,exportCoverage} from './coverage-stats.js';
import {polarSummary,describePolar} from './coverage-polar.js';

function download(name,text,type){
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// Statistics follow the worker's progressive results without rebuilding the
// whole Properties panel; the listener detaches once the panel is replaced.
function liveNotes(panel,lines,controls=[]){
 const box=document.createElement('div');panel.append(box);
 const draw=()=>{if(!box.isConnected&&box.dataset.mounted){window.removeEventListener('avorion-model-ready',draw);return;}box.dataset.mounted='1';box.replaceChildren(...lines().map(text=>{const p=document.createElement('p');p.className='panel-note';p.textContent=text;return p;}));for(const [control,disabled] of controls)control.disabled=disabled();};
 queueMicrotask(draw);window.addEventListener('avorion-model-ready',draw);return box;
}
export function mountCoverageControls(host,scene,changed,showView=()=>{},openAiming=null){
 const o=coverageOptions(scene),list=mounts(scene);let panel;const panels=new Map();const use=(name,open=false)=>{if(!panels.has(name))panels.set(name,propertyPanel(host,name,open));panel=panels.get(name);return panel;};use('Visualization',true);
 const update=(key,value)=>{scene.weaponCoverage={...coverageOptions(scene),[key]:value};changed();};
 const note=text=>{const p=document.createElement('p');p.className='panel-note';p.textContent=text;panel.append(p);};
 function field(label,type,value,action,values=null,limits={}){
  const row=document.createElement('label');row.className='field-row';row.textContent=label;const input=document.createElement(type==='select'?'select':'input');input.setAttribute('aria-label',label);
  if(type==='select')for(const [v,text] of values)input.add(new Option(text,v));else input.type=type;
  Object.assign(input,limits);if(type==='checkbox')input.checked=value;else input.value=type==='number'&&Number.isFinite(value)?Number(value.toPrecision(6)):value??'';
  input.onchange=()=>{if(input.checkValidity()&&(type!=='number'||input.value!=='')){const value=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;input.onchange=null;action(value);}};row.append(input);panel.append(row);return input;
 }
 const check=(key,label)=>field(label,'checkbox',o[key],v=>update(key,v));
 const select=(key,label,values)=>field(label,'select',o[key],v=>update(key,v),values);
 const number=(key,label,defaultValue,limits={})=>{const input=field(label,'number',o[key]??defaultValue,v=>update(key,v),null,{step:'any',...limits});input.dataset.default=defaultValue;return input;};
 const button=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.className='setting-button';b.disabled=disabled;b.onclick=action;panel.append(b);return b;};
 // Sub-panels remember whether they are open across Properties refreshes.
 const section=(title,build)=>{const details=document.createElement('details');details.className='panel';details.innerHTML=`<summary>${title}</summary>`;panel.append(details);const start=panel.children.length;build();while(panel.children.length>start)details.append(panel.children[start]);return details;};
 field('Show Weapon Coverage','checkbox',!!scene.showFireCoverage,v=>{scene.showFireCoverage=v;changed();if(v){if(o.mode==='slice')showView(scene.fireDirection||(o.plane==='side'?'left':o.plane));frameAnalysis();}});
 if(!list.length)note('Attach a turret from the Asset Library to begin. No arbitrary weapon positions are generated.');
 field('Visualization','select',o.mode,v=>{scene.weaponCoverage={...o,mode:v};scene.showFireCoverage=true;changed();if(v==='slice')showView(scene.fireDirection||(o.plane==='side'?'left':o.plane));frameAnalysis(v);},[['slice','Directional Slices'],['sphere','Spherical Heatmap']]);
 select('metric','Coverage Display',[['clear','Clear Coverage'],['potential','Potential Coverage'],['obstructed','Obstructed Coverage'],['blind','Blind Spots'],['difference','Change vs Baseline']]);
 use('Turret Scope',true);
 note(`${list.filter(m=>o.selection==='all'||o.selection==='selected'&&(scene.selectedTurretIds?.has(m.id)||m.id===scene.selectedTurretId)||o.selection==='group'&&m.coverage?.group===o.group).length} in scope of ${list.length} attached turrets. Scope filters display; the analysis evaluates all enabled turrets.`);
 select('selection','Turret Selection',[['all','All Turrets'],['selected','Selected Turrets'],['group','Turret Group']]);
 if(o.selection==='selected'&&!scene.selectedTurretId)note('Select a turret in the viewport or Outliner.');
 if(o.selection==='group'){
  const groups=[...new Set(list.map(m=>m.coverage?.group).filter(Boolean))];
  field('Coverage group','select',o.group||'',v=>update('group',v),[['','Choose group'],...groups.map(g=>[g,g])]);if(!groups.length)note('Assign a group below with a turret selected.');
 }
 if(o.selection!=='all')note('Selection and groups filter the displayed result; they do not re-run the analysis.');
 const state=currentCoverage(scene),result=state?.result,minimum=result?.minimumRadius||Math.max(1,Math.hypot(...Object.values(scene.model?.bounds?.size||{x:2,y:2,z:2}))/2*1.15),defaultExtent=minimum*1.5;
 function frameAnalysis(mode=o.mode){if(scene.model)showView('coverage',{center:result?.center||['x','y','z'].map(k=>(scene.model.bounds.min[k]+scene.model.bounds.max[k])/2),radius:Math.max(mode==='sphere'?minimum:.1,Number(o[mode==='sphere'?'radius':'extent'])||defaultExtent)});}
 if(o.mode==='slice'){
  use('Slice Settings');
  const directions=document.createElement('div');directions.style.cssText='display:flex;flex-wrap:wrap;gap:4px';panel.append(directions);
  for(const [direction,label,plane] of [['top','Top','top'],['bottom','Bottom','top'],['left','Left / Side','side'],['right','Right','side'],['front','Front','front'],['back','Back','front']]){
   const b=document.createElement('button');b.textContent=label;b.className='setting-button';b.setAttribute('aria-label',direction[0].toUpperCase()+direction.slice(1)+' firing view');b.setAttribute('aria-pressed',String((scene.fireDirection||'top')===direction));b.onclick=()=>{scene.fireDirection=direction;scene.showFireCoverage=true;scene.weaponCoverage={...o,plane};changed();showView(direction);};directions.append(b);
  }
  number('offset',`Slice position (${o.plane==='top'?'Y':o.plane==='side'?'X':'Z'})`,0);
  number('extent',o.sliceStyle==='legacy'?'Slice extent':'Dead-zone analysis radius',defaultExtent,{min:.1});button('Reset slice',()=>update('offset',0));
  select('sliceStyle','Slice style',[['polar','Arcs and dead zone'],['legacy','Legacy field view']]);
  if(o.sliceStyle!=='legacy')note('Rings and the count band show arcs at infinity: direction only, so slice position does not change them. Slice position and radius only affect the dead-zone field.');
 }else {use('Visualization',true);number('radius','Sphere radius',defaultExtent,{min:minimum});}
 use('Analysis',true);
 liveNotes(panel,()=>{const state=currentCoverage(scene);return [state?.final?'Up to date':state?.status||'Enable coverage to run analysis.'];});
 select('quality','Sampling Quality',[['low','Low · preview'],['medium','Medium'],['high','High']]);
 use('Visualization',true);number('opacity','Coverage opacity',.8,{min:.05,max:1,step:.05});use('Analysis',true);
 check('showShip','Show Ship');check('showGrid','Show Grid');check('showObstructions','Show Structural Obstructions');check('overlapOnly','Show only overlapping clear coverage');
 use('Appearance & Colors');if(o.mode==='slice'&&o.sliceStyle==='legacy')check('individual','Individual turret colors');use('Inspection & Statistics');check('inspect','Inspect coverage points');
 button('Frame coverage',()=>frameAnalysis(),!scene.model);use('Analysis',true);
 button('Recalculate Coverage',()=>update('recalculate',(o.recalculate||0)+1));
 button('Reset coverage defaults',()=>{scene.weaponCoverage={...COVERAGE_DEFAULTS};scene.coverageInspection=null;changed();});
 use('Inspection & Statistics');
 {
  const live=[];
  liveNotes(panel,()=>{
   const r=currentCoverage(scene)?.result;if(!r)return [currentCoverage(scene)?.status||'Statistics appear when an analysis result is available.'];
   const lines=r.polar?describePolar(polarSummary(r)):[],b=scene.coverageBaseline;lines.push(...describeStats(coverageStats(r)));
   lines.push(r.mode==='sphere'?'Weighted by solid angle; each cell uses its analyzed center.':r.polar?`Weighted by bearing angle at infinity; ${r.polar.evaluations} evaluations, arc edges within ${(r.polar.arcTolerance*180/Math.PI).toFixed(2)}°.`:'Weighted by slice area; each cell uses its analyzed center.');
   if(b){lines.push(`Baseline “${b.label}” (${b.mode}, ${b.quality})${baselineCompatible(b,r)?' · per-direction change available':' · statistics comparison only (per-cell change needs the same spherical radius and quality)'}`,...compareStats(b,r));}
   if(o.metric==='difference'&&!baselineCompatible(b,r))lines.push('Change vs Baseline needs a compatible spherical baseline; showing Clear Coverage.');
   return lines;
  },live);
  use('Comparison & Export');
  liveNotes(panel,()=>{const b=scene.coverageBaseline;return [b?`Baseline: ${b.label||'Untitled'} · ${b.mode} · ${b.quality}`:'No comparison baseline saved.'];});
  const latest=()=>currentCoverage(scene)?.result;
  liveNotes(panel,()=>[],live);
  live.push([button('Save as comparison baseline',()=>{const r=latest();if(!r)return;scene.coverageBaseline=makeBaseline(r,window.prompt?.('Baseline name','')||'');changed();}),()=>!latest()||!currentCoverage(scene)?.final]);
  button('Clear baseline',()=>{scene.coverageBaseline=null;if(o.metric==='difference')update('metric','clear');else changed();},!scene.coverageBaseline);
  const name=(scene.model?.fileName||'ship').replace(/\.[^.]+$/,'').replace(/[^\w.-]+/g,'_');
  live.push([button('Export coverage CSV',()=>{const r=latest();if(r)download(`${name}-coverage-${r.mode}.csv`,exportCoverage(r,'csv'),'text/csv');}),()=>!latest()]);
  live.push([button('Export coverage JSON',()=>{const r=latest();if(r)download(`${name}-coverage-${r.mode}.json`,exportCoverage(r,'json'),'application/json');}),()=>!latest()]);
 }
 use('Advanced Analysis');
 {
  check('includeHidden','Include hidden blocks and turrets as obstacles');check('includeTransparent','Include transparent blocks, glass and holograms');check('includeDecorative','Include solid decorative blocks');
  check('gpu','GPU hull rays (experimental)');
  if(o.gpu&&result)note(result.gpu?'GPU hull rays active. Turret geometry and aiming remain on the CPU; results can differ from the CPU path at grazing contacts (float precision).':'GPU hull rays requested but unavailable; using the CPU path.');
  use('Appearance & Colors');check('autoScale','Automatic count color scale');number('scaleMax','Count scale upper bound',5,{min:1,max:500,step:1});
  select('palette','Heatmap Color Scheme',[['classic','Classic'],['accessible','Blue / Orange']]);
  use('Advanced Analysis');note('Directional slices: the band just outside the analysis radius colors each bearing by its turret count at infinity; one ring per turret, numbered like the mount markers, shows where it is clear (its color) or in arc but blocked (amber). Inside the radius, the field colors each finite position by its count, and white lines mark where the clear count crosses 1 (dead zone) and 2. Fixed weapons appear in the field only where their spread cone passes through a probe.');
  note('Legacy field view: slices show continuous colored fields for each turret; overlapping fields blend. Numbered mount markers match the legend colors. In Clear Coverage, dark gaps have no clear firing path. Use the spherical heatmap for numerical overlap: red means more turrets, blue means fewer, black means none. Field boundaries and globe colors interpolate nearby samples; inspection reports the exact analyzed target.');
  note('Coverage counts turrets, not barrels or damage. Each muzzle is aimed independently; any clear eligible muzzle makes a turret clear. This does not imply all barrels can hit simultaneously. Partial muzzle obstruction remains visible in inspection.');
  note('Aiming is approximate: imported pivot/muzzle data are used, but traversal limits are user assumptions. Default azimuth ±180° around center 0°, elevation from design (normally −15°/+90°). Coaxial imports default to fixed current pose; fixed weapons cover a cone of their spread, widened to the analyzed cell size. Unknown custom-axis solutions are marked unresolved only where no other turret covers the target. Other turrets obstruct at their current displayed poses.');
  note('Hidden and decorative geometry are excluded by default. Show Ship affects display only. Range is visualization distance, not weapon range. Sampling can miss narrow gaps; increase quality to investigate.');
 }
 use('Turret Scope',true);
 if(scene.selectedTurretId&&openAiming)button('Edit selected turret aiming',openAiming);
 use('Inspection & Statistics');
 if(scene.coverageInspection){
  for(const line of coverageDescription(scene.coverageInspection))note(line);
  button('Select contributing turrets',()=>{const ids=scene.coverageInspection.sample.contributors.map(t=>t.id);selectTurrets(scene,null);for(const id of ids)selectTurrets(scene,id,true);changed();});
  button('Open slice through inspected point',()=>{const p=scene.coverageInspection.sample.point,c=scene.coverageInspection.center;scene.weaponCoverage={...o,mode:'slice',plane:'side',offset:p[0]-c[0]};changed();showView('left');});
 }else{button('Select contributing turrets',()=>{},true);button('Open slice through inspected point',()=>{},true);}
 // Stable navigation order, independent of visualization mode.
 for(const name of ['Visualization','Turret Scope','Analysis','Slice Settings','Appearance & Colors','Inspection & Statistics','Comparison & Export','Advanced Analysis'])if(panels.has(name))host.append(panels.get(name));
}

export function mountAimingControls(host,scene,changed){
 const o=coverageOptions(scene),list=mounts(scene),panel=host;
 const update=(key,value)=>{scene.weaponCoverage={...coverageOptions(scene),[key]:value};changed();};
 function field(label,type,value,action,limits={}){
  const row=document.createElement('label');row.className='field-row';row.textContent=label;const input=document.createElement('input');input.setAttribute('aria-label',label);
  input.type=type;
  Object.assign(input,limits);if(type==='checkbox')input.checked=value;else input.value=type==='number'&&Number.isFinite(value)?Number(value.toPrecision(6)):value??'';
  input.onchange=()=>{if(input.checkValidity()&&(type!=='number'||input.value!=='')){const value=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;input.onchange=null;action(value);}};row.append(input);panel.append(row);return input;
 }
 const selected=list.find(m=>m.id===scene.selectedTurretId);
 if(selected){
  const c=aimingConstraints(selected),edit=patch=>{const {yawMin,yawMax,...rest}=selected.coverage||{};editTurrets(scene,[selected.id],{coverage:{...rest,yawCenter:c.yawCenter,yawHalf:c.yawHalf,...patch}});changed();};
   field('Enabled for coverage','checkbox',c.enabled,v=>edit({enabled:v}));field('Fixed aiming (coaxial assumption)','checkbox',c.fixed,v=>edit({fixed:v}));
   const spread=field('Fixed weapon spread (half-angle °)','number',c.spread,v=>edit({spread:v}),{min:0,max:45,step:.1,disabled:!c.fixed});spread.dataset.default=aimingConstraints({...selected,coverage:{}}).spread;
   field('Turret coverage group','text',selected.coverage?.group||'',v=>edit({group:v.trim().slice(0,60)}));
   field('Turret field color','color',o.colors?.[selected.id]||TURRET_COLORS[list.indexOf(selected)%TURRET_COLORS.length],v=>update('colors',{...o.colors,[selected.id]:v}));

 }
}
