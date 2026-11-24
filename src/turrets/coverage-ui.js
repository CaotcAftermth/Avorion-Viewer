import {diagnosticDownload} from '../performance-diagnostics.js';
import {propertyPanel} from '../property-ui.js';
import {mounts,editTurrets,selectTurrets} from './mounts.js';
import {aimingConstraints} from './coverage-engine.js';
import {coverageOptions,COVERAGE_DEFAULTS,TURRET_COLORS} from './coverage-sampling.js';
import {currentCoverage} from './coverage-state.js';
import {coverageDescription} from './coverage-render.js';
import {coverageStats,describeStats,makeBaseline,baselineCompatible,compareStats,exportCoverage} from './coverage-stats.js';
import {polarSummary,describePolar} from './coverage-polar.js';

function download(name,text,type){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return blob;
}
// Statistics follow the worker's progressive results without rebuilding the
// whole Properties panel; the listener detaches once the panel is replaced.
function liveNotes(panel,lines,controls=[]){
 const box=document.createElement('div');panel.append(box);
 const draw=()=>{if(!box.isConnected&&box.dataset.mounted){window.removeEventListener('avorion-model-ready',draw);return;}box.dataset.mounted='1';box.replaceChildren(...lines().map(text=>{const p=document.createElement('p');p.className='panel-note';p.textContent=text;return p;}));for(const [control,disabled,hide=false] of controls){const unavailable=disabled();control.disabled=unavailable;if(hide)control.hidden=unavailable;}};
 queueMicrotask(draw);window.addEventListener('avorion-model-ready',draw);return box;
}
export function mountCoverageControls(host,scene,changed,showView=()=>{}){
 const o=coverageOptions(scene),list=mounts(scene);let panel;const panels=new Map();
 const use=(name,open=false,parent=host)=>{if(!panels.has(name))panels.set(name,propertyPanel(parent,name,open));panel=panels.get(name);return panel;};
 const coverage=use('Coverage',true),turrets=use('Turret Settings'),results=use('Results'),advanced=use('Advanced');use('Coverage');
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
 const section=(title,build)=>{const parent=panel;panel=propertyPanel(parent,title);build();panel=parent;};
 field('Show Weapon Coverage','checkbox',!!scene.showFireCoverage,v=>{scene.showFireCoverage=v;changed();if(v){if(o.mode==='slice')showView(scene.fireDirection||(o.plane==='side'?'left':o.plane));frameAnalysis();}});
 if(!list.length)note('Attach a turret from the Asset Library to begin.');
 field('Visualization','select',o.mode,v=>{scene.weaponCoverage={...o,mode:v};scene.showFireCoverage=true;changed();if(v==='slice')showView(scene.fireDirection||(o.plane==='side'?'left':o.plane));frameAnalysis(v);},[['slice','Directional Slices'],['sphere','Spherical Heatmap']]);
 select('metric','Coverage Display',[['clear','Clear Coverage'],['potential','Potential Coverage'],['obstructed','Obstructed Coverage'],['blind','Blind Spots'],['difference','Change vs Baseline']]);
 select('selection','Turret Selection',[['all','All Turrets'],['selected','Selected Turrets'],['group','Turret Group']]);
 note(`${list.filter(m=>o.selection==='all'||o.selection==='selected'&&(scene.selectedTurretIds?.has(m.id)||m.id===scene.selectedTurretId)||o.selection==='group'&&m.coverage?.group===o.group).length} of ${list.length} turrets displayed. All enabled turrets are analyzed.`);
 if(o.selection==='selected'&&!scene.selectedTurretId)note('Select a turret in the viewport or Outliner.');
 if(o.selection==='group'){
  const groups=[...new Set(list.map(m=>m.coverage?.group).filter(Boolean))];
  field('Coverage group','select',o.group||'',v=>update('group',v),[['','Choose group'],...groups.map(g=>[g,g])]);if(!groups.length)note('Assign a group below with a turret selected.');
 }
 use('Turret Settings');
 field('Selected turret','select',scene.selectedTurretId||'',v=>{selectTurrets(scene,v||null);changed();},[['','Choose turret'],...list.map((m,i)=>[m.id,`${i+1} · ${m.name==='Mounted turret'?m.asset.name:m.name}`])]);
 if(list.some(m=>m.id===scene.selectedTurretId))mountAimingControls(panel,scene,changed);
 else note('Choose a mounted turret to edit its coverage assumptions.');
 const state=currentCoverage(scene),result=state?.result,minimum=result?.minimumRadius||Math.max(1,Math.hypot(...Object.values(scene.model?.bounds?.size||{x:2,y:2,z:2}))/2*1.15),defaultExtent=minimum*1.5;
 function frameAnalysis(mode=o.mode){if(scene.model)showView('coverage',{center:result?.center||['x','y','z'].map(k=>(scene.model.bounds.min[k]+scene.model.bounds.max[k])/2),radius:Math.max(mode==='sphere'?minimum:.1,Number(o[mode==='sphere'?'radius':'extent'])||defaultExtent)});}
 if(o.mode==='slice'){
  use('Slice Settings',false,coverage);
  const directions=document.createElement('div');directions.style.cssText='display:flex;flex-wrap:wrap;gap:4px';panel.append(directions);
  for(const [direction,label,plane] of [['top','Top','top'],['bottom','Bottom','top'],['left','Left / Side','side'],['right','Right','side'],['front','Front','front'],['back','Back','front']]){
   const b=document.createElement('button');b.textContent=label;b.className='setting-button';b.setAttribute('aria-label',direction[0].toUpperCase()+direction.slice(1)+' firing view');b.setAttribute('aria-pressed',String((scene.fireDirection||'top')===direction));b.onclick=()=>{scene.fireDirection=direction;scene.showFireCoverage=true;scene.weaponCoverage={...o,plane};changed();showView(direction);};directions.append(b);
  }
  number('offset',`Slice position (${o.plane==='top'?'Y':o.plane==='side'?'X':'Z'})`,0);
  number('extent',o.sliceStyle==='legacy'?'Slice extent':'Dead-zone analysis radius',defaultExtent,{min:.1});button('Reset slice',()=>update('offset',0));
 }else {use('Coverage');number('radius','Sphere radius',defaultExtent,{min:minimum});}
 use('Coverage');
 select('quality','Sampling Quality',[['low','Low · preview'],['medium','Medium'],['high','High']]);
 button('Frame coverage',()=>frameAnalysis(),!scene.model);
 liveNotes(panel,()=>{const state=currentCoverage(scene);return [state?.final?'Up to date':state?.status||'Enable coverage to run analysis.'];});
 use('Display Options',false,coverage);
 number('opacity','Coverage opacity',.8,{min:.05,max:1,step:.05});
 check('showShip','Show Ship');check('showGrid','Show Grid');check('showObstructions','Show Structural Obstructions');
 if(o.metric==='clear')check('overlapOnly','Show only overlapping clear coverage');
 if(o.mode==='slice'&&o.sliceStyle==='legacy')check('individual','Individual turret colors');
 check('autoScale','Automatic count color scale');if(!o.autoScale)number('scaleMax','Count scale upper bound',5,{min:1,max:500,step:1});
 select('palette','Heatmap Color Scheme',[['classic','Classic'],['accessible','Blue / Orange']]);
 use('Turret Settings');
 const selected=list.find(m=>m.id===scene.selectedTurretId);
 if(selected)field('Turret field color','color',o.colors?.[selected.id]||TURRET_COLORS[list.indexOf(selected)%TURRET_COLORS.length],v=>update('colors',{...o.colors,[selected.id]:v}));
 use('Advanced');
 button('Recalculate Coverage',()=>update('recalculate',(o.recalculate||0)+1));
 button('Reset coverage defaults',()=>{scene.weaponCoverage={...COVERAGE_DEFAULTS};scene.coverageInspection=null;changed();});
 use('Results');check('inspect','Inspect coverage points');
 liveNotes(panel,()=>currentCoverage(scene)?.result?[]:['Enable coverage and wait for analysis to see results.']);
 use('Statistics',false,results);
 {
  const live=[];
  liveNotes(panel,()=>{
   const r=currentCoverage(scene)?.result;if(!r)return [];
   const lines=r.polar?describePolar(polarSummary(r)):[],b=scene.coverageBaseline;lines.push(...describeStats(coverageStats(r)));
   lines.push(r.mode==='sphere'?'Weighted by solid angle; each cell uses its analyzed center.':r.polar?`Weighted by bearing angle at infinity; ${r.polar.evaluations} evaluations, arc edges within ${(r.polar.arcTolerance*180/Math.PI).toFixed(2)}°.`:'Weighted by slice area; each cell uses its analyzed center.');
   if(b){lines.push(`Baseline “${b.label}” (${b.mode}, ${b.quality})${baselineCompatible(b,r)?' · per-direction change available':' · statistics comparison only (per-cell change needs the same spherical radius and quality)'}`,...compareStats(b,r));}
   if(o.metric==='difference'&&!baselineCompatible(b,r))lines.push('Change vs Baseline needs a compatible spherical baseline; showing Clear Coverage.');
   return lines;
  },live);
  use('Comparison & Export',false,results);
  liveNotes(panel,()=>{const b=scene.coverageBaseline;return [b?`Baseline: ${b.label||'Untitled'} · ${b.mode} · ${b.quality}`:'No comparison baseline saved.'];});
  const latest=()=>currentCoverage(scene)?.result;
  live.push([panels.get('Statistics'),()=>!latest(),true],[panels.get('Comparison & Export'),()=>!latest()&&!scene.coverageBaseline,true]);
  live.push([button('Save as comparison baseline',()=>{const r=latest();if(!r)return;scene.coverageBaseline=makeBaseline(r,window.prompt?.('Baseline name','')||'');changed();}),()=>!latest()||!currentCoverage(scene)?.final,true]);
  if(scene.coverageBaseline)button('Clear baseline',()=>{scene.coverageBaseline=null;if(o.metric==='difference')update('metric','clear');else changed();});
  const name=(scene.model?.fileName||'ship').replace(/\.[^.]+$/,'').replace(/[^\w.-]+/g,'_');
  live.push([button('Export coverage CSV',()=>{const r=latest();if(r)diagnosticDownload('coverage csv',scene.model?.blocks.length,()=>download(`${name}-coverage-${r.mode}.csv`,exportCoverage(r,'csv'),'text/csv'));}),()=>!latest(),true]);
  live.push([button('Export coverage JSON',()=>{const r=latest();if(r)diagnosticDownload('coverage json',scene.model?.blocks.length,()=>download(`${name}-coverage-${r.mode}.json`,exportCoverage(r,'json'),'application/json'));}),()=>!latest(),true]);
 }
 use('Advanced');
 {
  section('Obstacles',()=>{check('includeHidden','Include hidden blocks and turrets as obstacles');check('includeTransparent','Include transparent blocks, glass and holograms');check('includeDecorative','Include solid decorative blocks');});
  section('Experimental & Legacy',()=>{
   check('gpu','GPU hull rays (experimental)');
   if(o.gpu&&result)note(result.gpu?'GPU hull rays active.':'GPU unavailable; using CPU analysis.');
   if(o.mode==='slice')select('sliceStyle','Slice style',[['polar','Arcs and dead zone'],['legacy','Legacy field view']]);
  });
  note('Approximate geometric coverage, not damage or weapon range. Sampling can miss narrow gaps.');
  const help=document.createElement('a');help.textContent='Coverage guide and assumptions ↗';help.href=new URL('docs/coverage/',document.baseURI).href;help.target='_blank';help.rel='noopener noreferrer';panel.append(help);
 }
 use('Results');
 if(scene.coverageInspection){
  for(const line of coverageDescription(scene.coverageInspection))note(line);
  button('Select contributing turrets',()=>{const ids=scene.coverageInspection.sample.contributors.map(t=>t.id);selectTurrets(scene,null);for(const id of ids)selectTurrets(scene,id,true);changed();});
  button('Open slice through inspected point',()=>{const p=scene.coverageInspection.sample.point,c=scene.coverageInspection.center;scene.weaponCoverage={...o,mode:'slice',plane:'side',offset:p[0]-c[0]};changed();showView('left');});
 }
 // Stable navigation order, independent of visualization mode.
 for(const name of ['Coverage','Turret Settings','Results','Advanced'])host.append(panels.get(name));
}

export function mountAimingControls(host,scene,changed){
 const list=mounts(scene),panel=host;
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
   if(c.fixed){const spread=field('Fixed weapon spread (half-angle °)','number',c.spread,v=>edit({spread:v}),{min:0,max:45,step:.1});spread.dataset.default=aimingConstraints({...selected,coverage:{}}).spread;}
   field('Turret coverage group','text',selected.coverage?.group||'',v=>edit({group:v.trim().slice(0,60)}));

 }
}
