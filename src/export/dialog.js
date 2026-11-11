import {mountImageExport} from './image-dialog.js';
import {EXPORT_FORMATS,captureExport} from './snapshot.js';
import {thinBlockThreshold} from '../ship-structure.js';

import {mountExportPreview} from './preview.js';
import {reportError} from '../app-log.js';
import {ringForProgress} from '../loading-indicator.js';

export function openExportDialog(scene,view,onHighlight,context={}){

 const d=document.createElement('dialog');d.className='export-dialog';d.setAttribute('aria-label','Advanced Export');

 d.innerHTML=`<form method="dialog" class="export-heading"><h2>3D Model Export</h2><button aria-label="Close export">×</button></form><div class="export-body"><div class="export-controls"></div><div class="export-results"><h3>Export configuration</h3><p class="export-description"></p><div class="export-preview" hidden></div><div class="export-summary" aria-live="polite">Prepare an export to inspect the processed mesh.</div><details><summary>Validation criteria</summary><p>Closed edges, consistent winding, nondegenerate triangles, and connected components are checked on output geometry. Watertight topology checks edge closure and vertex connectivity; Mesh validation also rejects degenerate and duplicate triangles. Self-intersections, wall thickness, supports, and printer suitability are reported separately.</p></details></div></div><progress hidden max="100"></progress><div class="dialog-actions"><p class="export-status" role="status"></p><button type="button" class="export-cancel" hidden>Cancel Processing</button><button type="button" class="export-prepare">Prepare &amp; Validate</button><button type="button" class="export-download" disabled>Download</button></div>`;

 const imageHost=document.createElement('section');imageHost.hidden=true;d.append(imageHost);
 const imageExport=mountImageExport(imageHost,scene,view,context);
 const tabs=document.createElement('nav');tabs.className='export-tabs';tabs.setAttribute('aria-label','Export category');
 const meshSections=[...d.children].filter(n=>n!==imageHost&&!n.classList.contains('export-heading'));
 for(const [label,isImage] of [['3D Model Export',false],['Image Export',true]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(!isImage));button.onclick=()=>{if(imageExport.busy||d.querySelector('.export-cancel')?.hidden===false)return;meshSections.forEach(n=>n.hidden=isImage);imageHost.hidden=!isImage;imageExport.setActive(isImage);tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));d.querySelector('h2').textContent=isImage?'Image Export':'3D Model Export';if(!isImage){d.querySelector('.export-cancel').hidden=true;d.querySelector('progress').hidden=true;if(!result)schedule();}};tabs.append(button);}
 d.querySelector('.export-heading').after(tabs);

 const controls=d.querySelector('.export-controls'),status=d.querySelector('.export-status'),summary=d.querySelector('.export-summary'),download=d.querySelector('.export-download'),prepare=d.querySelector('.export-prepare'),cancel=d.querySelector('.export-cancel'),progress=d.querySelector('progress');ringForProgress(progress,{anchor:status});

 const STORE='avorion-viewer.export-settings.v1',SAVED_KEYS=['format','mode','scope','placement','colors','sizing','longest','cleanup','includeTransparent','budget','tolerance','excludeThin','fillCavities'];
 // Goal presets fill the form. A goal stays highlighted only while every value it sets still matches.
 const GOALS={
  blender:{label:'Blender / game asset',hint:'GLB, editable grouped mesh, real scale (1 unit = 1 m).',values:{format:'glb',mode:'grouped',scope:'all',sizing:'native',placement:'centered',cleanup:true,excludeThin:true,includeTransparent:true}},
  print:{label:'3D print',hint:'3MF printable shell sized in millimetres, sealed cavities filled.',values:{format:'3mf',mode:'shell',scope:'all',sizing:'size',longest:100,cleanup:true,excludeThin:true,fillCavities:true}},
  share:{label:'Quick share',hint:'GLB of the blocks visible in the viewport, real scale.',values:{format:'glb',mode:'grouped',scope:'visible',sizing:'native',cleanup:true,excludeThin:true}}
 };
 // Print formats are sized in millimetres; scene formats default to real scale.
 const FORMAT_DEFAULTS={stl:{sizing:'size'},'3mf':{sizing:'size'},glb:{sizing:'native'},gltf:{sizing:'native'},obj:{sizing:'native'}};
 const loadStore=()=>{try{const v=JSON.parse(localStorage.getItem(STORE)||'null');return v&&typeof v==='object'&&v.byFormat?v:null;}catch{return null;}};
 const pick=o=>Object.fromEntries(SAVED_KEYS.filter(k=>k in o).map(k=>[k,o[k]]));
 let stored=loadStore()||{byFormat:{},advanced:false};
 const fields={},rows={},options={format:'glb',mode:'grouped',scope:'all',regionId:scene.regions?.[0]?.id||'',placement:'centered',colors:'working',sizing:'native',longest:100,cleanup:true,includeTransparent:true,budget:1024,tolerance:0,excludeThin:true,fillCavities:false,excludedIds:[]};let worker,result,preview,busy=false,snapshot,autoTimer;
 if(stored.lastFormat&&EXPORT_FORMATS[stored.lastFormat])Object.assign(options,{format:stored.lastFormat},pick(stored.byFormat[stored.lastFormat]||{}));else Object.assign(options,GOALS.blender.values);
 if(!EXPORT_FORMATS[options.format])options.format='glb';
 function save(){stored={...stored,lastFormat:options.format,byFormat:{...stored.byFormat,[options.format]:pick(options)}};try{localStorage.setItem(STORE,JSON.stringify(stored));}catch{}}

 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const goalFor=()=>Object.keys(GOALS).find(id=>Object.entries(GOALS[id].values).every(([k,v])=>options[k]===v))||'custom';

 const goals=el('fieldset');goals.className='export-goals';goals.append(el('legend','Export for'));const goalHint=el('p');goalHint.className='export-goal-hint';
 for(const [id,goal]of [...Object.entries(GOALS),['custom',{label:'Custom',hint:'Your own combination. Adjust any setting below and under Advanced.'}]]){const button=el('button',goal.label);button.type='button';button.dataset.goal=id;button.title=goal.hint;button.onclick=()=>{if(id==='custom'){advanced.open=true;return;}Object.assign(options,goal.values);options.excludedIds=[];resetExcluded.hidden=true;sync();changed();};goals.append(button);}
 controls.append(goals,goalHint);

 function field(key,label,choices,type='select',parent=controls){
  const row=el('label');row.className='export-field';row.append(el('span',label));const input=el(type==='select'?'select':'input');input.setAttribute('aria-label',label);
  if(type==='select')for(const [id,text]of choices)input.add(new Option(text,id));else{input.type=type;if(type==='number'){input.min=key==='budget'?64:key==='tolerance'?0:.001;input.max=key==='budget'?4096:1000000;input.step=key==='budget'?64:key==='tolerance'?.00001:'any';}}
  input.onchange=()=>{options[key]=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;changed();};fields[key]=input;rows[key]=row;row.append(input);parent.append(row);return input;
 }

 const formats=el('fieldset');formats.append(el('legend','File format'));for(const format of Object.keys(EXPORT_FORMATS)){const label=el('label'),input=el('input');input.type='radio';input.name='export-format';input.value=format;input.onchange=()=>{options.format=format;Object.assign(options,stored.byFormat[format]?pick(stored.byFormat[format]):FORMAT_DEFAULTS[format]);options.format=format;sync();changed();};label.append(input,el('span',format.toUpperCase()));formats.append(label);}controls.append(formats);

 field('mode','Geometry output',[['shell','Printable exterior shell'],['grouped','Editable grouped mesh'],['detailed','Individual blocks']]);
 field('scope','Export scope',[['all','Entire ship'],['visible','Visible blocks'],['selected','Selected blocks'],['region','Named region']]);field('regionId','Region',(scene.regions||[]).map(r=>[r.id,r.name]));
 field('sizing','Size',[['native','Real scale (1 unit = 1 m)'],['size','Fit longest dimension']]);field('longest','Longest dimension (mm)',null,'number');

 const advanced=el('details');advanced.className='export-advanced';advanced.append(el('summary','Advanced'));advanced.open=!!stored.advanced;advanced.ontoggle=()=>{stored.advanced=advanced.open;try{localStorage.setItem(STORE,JSON.stringify(stored));}catch{}};controls.append(advanced);
 field('placement','Placement',[['centered','Centered on origin'],['native','Native imported position'],['displayed','Displayed position']],'select',advanced);field('colors','Color source',[['working','Current working colors'],['imported','Imported colors']],'select',advanced);
 field('cleanup','Repair winding / clean faces',null,'checkbox',advanced).title='Correct per-block winding and remove degenerate or duplicate faces. Repair collapsed output triangles while preserving surfaces, then validate the result.';field('includeTransparent','Include transparent components',null,'checkbox',advanced);
 field('fillCavities','Fill sealed cavities',null,'checkbox',advanced).title='Shell only. Fill enclosed air pockets; preserve openings to outside air.';
 field('excludeThin','Exclude zero / thin blocks',null,'checkbox',advanced).title=`Skip blocks with any dimension below ${thinBlockThreshold(scene)} native units, matching the viewport toggle. Does not change the model.`;
 field('tolerance','Solid tolerance (mm)',null,'number',advanced);fields.tolerance.title='Shell only. 0 disables extra simplification. Positive values allow this maximum surface deviation before float32 output (up to 1% of longest dimension).';
 field('budget','Working memory budget (MiB)',null,'number',advanced);
 const note=el('p','Shell mode unions closed solids to remove internal surfaces and overlaps. Separate disconnected solids stay separate. Sealed cavities can optionally be filled; openings are preserved; no invented supports or thickness.');note.className='export-note';advanced.append(note);
 advanced.append(el('p','Basic visual export preserves geometry and primary colors. Shader textures, secondary-color blending, glow sprites, and animated effects are not baked. Both color channels remain in source metadata.'));
 const resetExcluded=el('button','Restore excluded problem blocks');resetExcluded.type='button';resetExcluded.hidden=true;resetExcluded.onclick=()=>{options.excludedIds=[];resetExcluded.hidden=true;changed();};controls.append(resetExcluded);

 // Write options back into every input, then show only the controls that apply.
 function sync(){for(const [key,input]of Object.entries(fields)){if(input.type==='checkbox')input.checked=!!options[key];else input.value=options[key];}formats.querySelectorAll('input').forEach(n=>n.checked=n.value===options.format);resetExcluded.hidden=!options.excludedIds.length;applies();}
 function applies(){const shell=options.mode==='shell';rows.regionId.hidden=options.scope!=='region';rows.longest.hidden=options.sizing!=='size';rows.fillCavities.hidden=!shell;rows.tolerance.hidden=!shell;note.hidden=!shell;rows.colors.hidden=options.format==='stl';
  const goal=goalFor();goals.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.goal===goal)));goalHint.textContent=goal==='custom'?'Custom settings. Pick a goal above to reset them.':GOALS[goal].hint;}
 const autoPrepare=()=>!['stl','3mf'].includes(options.format)&&options.mode!=='shell';
 function schedule(){clearTimeout(autoTimer);if(autoPrepare()&&imageHost.hidden&&d.open)autoTimer=setTimeout(()=>{if(!busy&&!result&&imageHost.hidden)prepare.click();},400);}
 function changed(){invalidate();save();schedule();}

 function disabledReasons(){fields.tolerance.max=options.longest*.01;fields.mode.title=options.format==='stl'?'Visual STL preserves block surfaces and overlaps; printable shell unions and validates solids.':'';fields.fillCavities.disabled=busy||options.mode!=='shell';fields.regionId.title=scene.regions?.length?'':'Create a region before exporting a named region.';download.title=download.disabled?(autoPrepare()?'Preparing the mesh. Download unlocks when it is ready.':'Prepare an export and pass required validation to download.'):'';}

 function setBusy(value){busy=value;controls.querySelectorAll('input,select,button').forEach(n=>n.disabled=value);prepare.disabled=value;prepare.title=value?'Wait for processing, or cancel it first.':'';cancel.hidden=!value;progress.hidden=!value;if(!value){fields.regionId.disabled=options.scope!=='region';fields.tolerance.disabled=options.mode!=='shell';fields.mode.disabled=false;}disabledReasons();}

 function invalidate(){if(busy)return;worker?.terminate();worker=null;result=null;preview?.dispose();preview=null;d.querySelector('.export-preview').hidden=true;download.disabled=true;summary.textContent=autoPrepare()?'Preparing automatically when settings change.':'Press Prepare & Validate to build and check the printable mesh before download.';status.textContent='';for(const choice of fields.mode.options){choice.textContent=choice.value==='grouped'?(options.format==='stl'?'Visual STL (block surfaces)':'Editable grouped mesh'):choice.value==='detailed'?(options.format==='stl'?'Visual STL (individual blocks)':'Individual blocks'):'Printable exterior shell';}fields.mode.disabled=false;fields.regionId.disabled=options.scope!=='region';fields.tolerance.disabled=options.mode!=='shell';d.querySelector('.export-description').textContent=`${options.format.toUpperCase()} · ${EXPORT_FORMATS[options.format]} · ${options.sizing==='native'?'real scale, 1 unit = 1 m':options.longest+' mm longest dimension'}`;applies();disabledReasons();}

 function recovery(data){
  const panel=el('section');panel.className='export-recovery';panel.append(el('h4','Resolve export issues'));const area=el('div');area.className='export-result-buttons';panel.append(area);
  const action=(label,tip,changes)=>{const button=el('button',label);button.type='button';button.title=tip;button.onclick=()=>{Object.assign(options,changes);sync();invalidate();save();prepare.click();};area.append(button);};
  if(!options.excludeThin)action('Exclude zero/thin blocks & retry',`Uses the viewport threshold: any dimension below ${thinBlockThreshold(scene)} native units.`,{excludeThin:true});
  if(!options.cleanup)action('Repair & revalidate','Enable safe winding and face cleanup on a fresh export copy.',{cleanup:true});
  if(data.summary&&options.mode==='grouped'){
   action('Resolve overlaps as shell','Unions solids and removes internal faces. Material boundaries are lost in shell mode.',{mode:'shell',cleanup:true});
   action('Keep blocks separate & retry','Preserves individual closed blocks and colors; overlaps between blocks remain.',{mode:'detailed',cleanup:true});
  }
  if(data.issueIds?.length){
   const ids=[...new Set([...options.excludedIds,...data.issueIds])];
   panel.append(el('p',`Excluding issues removes ${data.issueIds.length} whole source blocks from this export, not just damaged faces. The working model and XML stay unchanged.`));
   action(`Exclude ${data.issueIds.length} problem blocks & retry`,'Removes these whole blocks from the export only. Restore them with Restore excluded problem blocks.',{excludedIds:ids});
   const select=el('button','Select problem blocks in model');select.type='button';select.onclick=()=>{onHighlight(data.issueIds);d.close();};area.append(select);
  }
  if(options.mode==='shell'&&data.summary&&!data.downloadable&&options.tolerance===0){const tolerance=Number((options.longest*1e-6).toPrecision(4));action(`Try ${tolerance} mm tolerance & revalidate`,'Simplify within this surface deviation, then rerun validation. Inspect thin details in the preview.',{tolerance,cleanup:true});}
  if(options.mode==='shell'&&!data.downloadable){action('Export Visual STL instead','Export original block surfaces without Boolean union. Overlaps remain; not a printable-shell repair.',{format:'stl',mode:'grouped'});}
  if(options.mode==='shell'&&data.summary&&!data.downloadable)panel.append(el('p','Shell errors without source attribution cannot be safely fixed by deleting arbitrary faces. Try the zero/thin filter, adjust Solid tolerance, or narrow Export scope, then Prepare & Validate again. Download remains blocked until validation passes.'));
  summary.prepend(panel);
 }
 function showError(data){reportError(data.message,'EXPORT');worker?.terminate();worker=null;result=null;setBusy(false);download.disabled=true;summary.replaceChildren(el('p',data.message));status.textContent=data.message;recovery(data);disabledReasons();}
 function showResult(data){result=data;summary.replaceChildren();
  const failed=!data.downloadable||data.summary['Mesh validation']==='Failed',s=data.summary;
  // Preview first, then a one-line verdict. Full diagnostics sit behind Details.
  const host=d.querySelector('.export-preview'),mount=()=>{host.hidden=false;preview?.dispose();preview=mountExportPreview(host,data.preview);};
  try{mount();}catch(e){host.hidden=true;}
  const verdict=el('div');verdict.className='export-verdict '+(failed?'is-failed':'is-passed');
  const counts=[s.Triangles!==undefined&&`${Number(s.Triangles).toLocaleString()} triangles`,s.Objects!==undefined&&`${s.Objects} object${s.Objects===1?'':'s'}`,data.warnings.length&&`${data.warnings.length} note${data.warnings.length===1?'':'s'}`].filter(Boolean).join(' · ');
  const problems=failed?['Boundary edges','Non-manifold edges','Non-manifold vertices','Degenerate triangles'].filter(k=>Number(s[k])>0).map(k=>`${s[k]} ${k.toLowerCase()}`).join(', '):'';
  verdict.append(el('strong',failed?'✕ Validation failed':'✓ Ready to download'),el('span',failed?(problems||'See details below.'):counts));
  const buttons=el('div');buttons.className='export-result-buttons';const show=el('button','Preview processed mesh');show.type='button';show.title='Reload the preview and reset its camera.';show.onclick=mount;buttons.append(show);verdict.append(buttons);
  summary.append(verdict);
  const details=el('details');details.className='export-details';details.append(el('summary','Details'));const table=el('dl');for(const [name,value]of Object.entries(s)){table.append(el('dt',name),el('dd',String(value)));}details.append(table);for(const warning of data.warnings)details.append(el('p',warning));summary.append(details);
  if(failed)recovery(data);download.disabled=!data.downloadable;disabledReasons();status.textContent=data.downloadable?'Prepared snapshot is ready. Later model edits do not change this export.':'Validation failed. Review the diagnostics before exporting.';
 }

 prepare.onclick=()=>{try{

  if(!Number.isFinite(options.longest)||options.longest<.001||options.longest>1e6)throw Error('Longest dimension must be 0.001 to 1,000,000 mm.');

  if(!Number.isFinite(options.budget)||options.budget<64||options.budget>4096)throw Error('Memory budget must be 64–4096 MiB.');

  if(options.mode==='shell'&&(!Number.isFinite(options.tolerance)||options.tolerance<0||options.tolerance>options.longest*.01))throw Error('Solid tolerance must be 0 to 1% of the longest dimension.');

  clearTimeout(autoTimer);save();snapshot=captureExport(scene,view,options);worker?.terminate();preview?.dispose();preview=null;d.querySelector('.export-preview').hidden=true;summary.textContent='Processing export snapshot...';result=null;download.disabled=true;setBusy(true);progress.value=0;status.textContent='Capturing model snapshot…';

  const job=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker=job;worker.onerror=e=>{if(worker!==job)return;showError({message:e.message});};

  worker.onmessage=({data})=>{if(worker!==job)return;if(data.type==='progress'){progress.value=data.percent;status.textContent=data.message;}else if(data.type==='error'){showError(data);}else if(data.type==='ready'){setBusy(false);showResult(data.result);}else if(data.type==='file'){const url=URL.createObjectURL(new Blob([data.bytes],{type:data.mime})),a=el('a');a.href=url;a.download=data.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setBusy(false);download.disabled=false;status.textContent='Export downloaded.';}};

  worker.postMessage({type:'prepare',snapshot,options:{...options,unitScale:options.sizing==='native'?1000:0}});

 }catch(e){showError({message:e.message,issueIds:e.issueIds});}};

 download.onclick=()=>{if(!result||!worker)return;setBusy(true);download.disabled=true;status.textContent='Writing file…';worker.postMessage({type:'download'});};

 cancel.onclick=()=>{worker?.terminate();worker=null;result=null;setBusy(false);download.disabled=true;status.textContent='Cancelled. The working model was not changed.';};

 d.addEventListener('close',()=>{clearTimeout(autoTimer);imageExport.dispose();worker?.terminate();worker=null;preview?.dispose();d.remove();},{once:true});document.body.append(d);sync();invalidate();d.showModal();if(context.imageType)tabs.querySelectorAll('button')[1].click();else schedule();

}

