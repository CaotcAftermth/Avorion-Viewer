import {fitGifSize,gifLimits,gifDimensionMax} from './gif-limits.js';
import {exportTurntable,validateTurntable} from './turntable.js';
import {imageDefaults,captureImage,validateImageOptions,imageFilename} from './image-options.js';
import {exportImage} from './image-pipeline.js';
import {captureViewportOverlays} from './image-overlays.js';
import {FACTORY_PREFERENCES} from '../preferences.js';
import {area} from '../layout.js';
import {openBlueprintDialog} from './blueprint-dialog.js';
import { reportError } from '../app-log.js';
import {ringForProgress} from '../loading-indicator.js';

export function mountImageExport(host,scene,sourceView,context={}){
  const view=sourceView||area().view,canvas=context.canvas;
  const size={width:canvas?.clientWidth||1200,height:canvas?.clientHeight||800};
  let options={...imageDefaults(view,canvas?.width||size.width,canvas?.height||size.height),dimensionCage:(context.preferences||FACTORY_PREFERENCES).dimensionCage!==false},controller,result,url,busy=false,disposed=false,active=false,previewing=false,timer,pending=null,revision=0,blueprintDialog;
  const validate=(o,limits,blocks)=>o.type==='turntable'?validateTurntable(o,blocks):validateImageOptions(o,limits,blocks);
  const fields={},el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  // Remember the last settings for each export type, and offer one-click goals.
  const STORE='avorion-viewer.image-export-settings.v1',EXTRA_KEYS=['duration','fps','direction','elevation','blueprintSettings','blueprintLayout'];
  const GOALS={
    screenshot:{label:'Screenshot',hint:'PNG of the current viewport at viewport size.',values:{type:'viewport',format:'png',supersampling:1}},
    transparent:{label:'Transparent render',hint:'PNG with alpha background, ship framed to fit, 2× supersampling.',values:{type:'transparent',format:'png',background:'transparent',framing:'fit',supersampling:2}},
    turntable:{label:'Turntable GIF',hint:'Animated GIF of the ship rotating a full turn.',values:{type:'turntable'}},
    blueprint:{label:'Blueprint',hint:'Technical sheet with orthographic views and a title block.',values:{type:'blueprint'}}
  };
  let stored={byType:{},advanced:false},applyingGoal=false,initializing=false;
  try{const v=JSON.parse(localStorage.getItem(STORE)||'null');if(v&&typeof v==='object'&&v.byType&&typeof v.byType==='object')stored=v;}catch{}
  const sanitize=(saved,base)=>Object.fromEntries(Object.entries(saved||{}).filter(([k,v])=>k!=='type'&&k!=='shipName'&&(k in base?typeof v===typeof base[k]:EXTRA_KEYS.includes(k))));
  const writeStore=()=>{try{localStorage.setItem(STORE,JSON.stringify(stored));}catch{}};
  function save(){const {shipName,...kept}=options;stored={...stored,lastType:options.type,byType:{...stored.byType,[options.type]:kept}};writeStore();}
  function restore(){
    const saved=stored.byType?.[options.type];if(!saved||applyingGoal)return;
    const next={...options,...sanitize(saved,options)};
    try{validate(next,undefined,scene.model?.blocks.length||0);options=next;}catch{}
  }
  const goalFor=()=>Object.keys(GOALS).find(id=>Object.entries(GOALS[id].values).every(([k,v])=>options[k]===v))||'custom';
  host.className='image-export';host.setAttribute('aria-label','Image Export');
  const controls=el('div'),preview=el('div'),layout=el('div');layout.className='export-body';preview.className='image-export-preview';
  preview.append(el('h3','Image preview'),el('p','Preview updates automatically. All processing stays on this device.'));
  const image=el('img');image.alt='Prepared image export';image.hidden=true;const placeholder=el('p','Preparing preview...');preview.append(image,placeholder);layout.append(controls,preview);host.append(layout);
  const status=el('p');status.className='export-status';status.setAttribute('role','status');
  const progress=el('progress');progress.max=100;progress.hidden=true;
  const actions=el('div');actions.className='dialog-actions';
  const previewButton=el('button','Preview'),renderButton=el('button','Prepare Image'),download=el('button','Download Image'),cancel=el('button','Cancel');
  for(const button of [previewButton,renderButton,download,cancel])button.type='button';
  download.disabled=true;cancel.hidden=true;actions.append(previewButton,renderButton,download,cancel);host.append(status,progress,actions);ringForProgress(progress,{anchor:previewButton});
  const invalidate=()=>{result=null;download.disabled=true;revision++;save();schedulePreview();};
  function schedulePreview(){
    clearTimeout(timer);pending=null;if(previewing)controller?.abort();
    if(active&&!disposed)timer=setTimeout(()=>request(true),300);
  }
  function request(previewOnly){
    clearTimeout(timer);if(disposed||!active)return;
    if(busy){if(previewing){pending=previewOnly;controller.abort();}return;}
    void run(previewOnly);
  }
  function field(key,label,type,choices){
    const row=el('label');row.className='export-field';const input=el(type==='select'?'select':'input');input.setAttribute('aria-label',label);
    if(type==='select')for(const [value,text] of choices)input.add(new Option(text,value));else input.type=type;
    fields[key]=input;input.onchange=()=>{
      const previous=options[key];options[key]=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;
      if(options.type==='turntable'&&['duration','fps'].includes(key))options[key]=key==='fps'?Math.max(5,Math.min(30,Math.round(options[key]||5))):Math.max(1,Math.min(20,options[key]||1));
      if(key==='supersampling')options[key]=Number(input.value);
      if(key==='type'){const keep={width:options.width,height:options.height,format:options.format,supersampling:options.supersampling,quality:options.quality,budget:options.budget,dimensionCage:options.dimensionCage};options={...imageDefaults(view,size.width,size.height,options.type),...keep};if(options.type==='turntable'){const factor=Math.min(1,720/options.width,720/options.height);options.width=Math.round(options.width*factor);options.height=Math.round(options.height*factor);options.format='gif';options.background='solid';options.duration=4;options.fps=15;options.direction='clockwise';options.camera='current';options.elevation=view.pitch*180/Math.PI;options.margin=.06;options.framing='fit';presets.value='';}else if(options.format==='gif')options.format='png';restore();}
      if(key==='camera'&&options.type==='turntable')options.elevation=options.camera==='current'?view.pitch*180/Math.PI:options.camera==='isometric'?Math.atan(1/Math.sqrt(2))*180/Math.PI:options.camera==='top'?90:options.camera==='bottom'?-90:0;
      if(['width','height'].includes(key)&&aspect.checked&&previous>0){const other=key==='width'?'height':'width';options[other]=Math.max(1,Math.round(options[other]*options[key]/previous));}
      if(['width','height'].includes(key))presets.value='';
      constrain(key);invalidate();sync();
      if(options.type==='blueprint'&&key==='type'&&!initializing)customizeBlueprint();
    };
    if(['number','text','color'].includes(type))input.oninput=()=>{if(options.type!=='turntable'||!['width','height','duration','fps'].includes(key))input.onchange();};
    row.append(el('span',label),input);controls.append(row);return input;
  }
  const goals=el('fieldset');goals.className='export-goals image-goals';goals.append(el('legend','Export for'));const goalHint=el('p');goalHint.className='export-goal-hint';
  for(const [id,goal] of [...Object.entries(GOALS),['custom',{label:'Custom',hint:'Your own combination. Adjust any setting below and under Advanced.'}]]){
    const button=el('button',goal.label);button.type='button';button.dataset.goal=id;button.title=goal.hint;
    button.onclick=()=>{
      if(id==='custom'){advanced.open=true;return;}
      if(busy&&!previewing)return;
      applyingGoal=true;try{fields.type.value=goal.values.type;fields.type.onchange();}finally{applyingGoal=false;}
      Object.assign(options,goal.values);if(id==='screenshot'){options.width=size.width;options.height=size.height;presets.value='viewport';}
      constrain();invalidate();sync();
    };
    goals.append(button);
  }
  controls.append(goals,goalHint);
  field('type','Export type','select',[['viewport','Current viewport'],['transparent','Transparent ship'],['blueprint','Blueprint'],['turntable','Turntable GIF']]);
  const customize=el('button','Customize blueprint...');customize.type='button';customize.onclick=customizeBlueprint;controls.append(customize);
  function customizeBlueprint(){
    if(disposed||blueprintDialog||options.type!=='blueprint'||busy&&!previewing)return;
    clearTimeout(timer);pending=null;if(previewing)controller?.abort();
    let blueprintSnapshot;
    blueprintDialog=openBlueprintDialog(options,{
      sourceView:view,preferences:context.preferences||FACTORY_PREFERENCES,
      renderPreview:async(draft,signal,previewSize)=>{
        const factor=Math.min(previewSize?Infinity:1,(previewSize?.width||900)/draft.width,(previewSize?.height||650)/draft.height);
        blueprintSnapshot??=captureImage(scene,view,context.preferences||FACTORY_PREFERENCES,size);
        return exportImage(blueprintSnapshot,{...draft,width:Math.max(1,Math.round(draft.width*factor)),height:Math.max(1,Math.round(draft.height*factor)),supersampling:1,format:'png'},{signal,encode:false});
      },
      onApply:draft=>{options=draft;invalidate();sync();},
      onClose:()=>{blueprintDialog=null;if(!disposed)schedulePreview();}
    });
  }
  field('format','Image format','select',[['png','PNG'],['webp','WebP'],['jpeg','JPEG'],['gif','GIF (turntable)']]);
  const duration=field('duration','Duration (seconds)','number');duration.min=1;duration.max=20;duration.step=.5;
  const fps=field('fps','Frames per second','number');fps.min=5;fps.max=30;fps.step=1;
  field('direction','Rotation direction','select',[['clockwise','Clockwise'],['counterclockwise','Counterclockwise']]);
  const presets=el('select');presets.setAttribute('aria-label','Resolution preset');for(const [v,t] of [['','Resolution preset...'],['viewport','Viewport size'],['1920x1080','Full HD - 1920 x 1080'],['2560x1440','2K / QHD - 2560 x 1440'],['2048x1080','2K / DCI - 2048 x 1080'],['3840x2160','4K / UHD - 3840 x 2160'],['4096x4096','4096 x 4096']])presets.add(new Option(t,v));
  presets.onchange=()=>{if(!presets.value)return;[options.width,options.height]=presets.value==='viewport'?[size.width,size.height]:presets.value.split('x').map(Number);constrain();invalidate();sync();};controls.append(presets);
  for(const key of ['width','height']){const input=field(key,key==='width'?'Width (pixels)':'Height (pixels)','number');input.min=1;input.max=32768;input.step=1;}
  const aspect=el('input');aspect.type='checkbox';aspect.checked=true;const aspectLabel=el('label',' Lock aspect ratio ');aspectLabel.prepend(aspect);controls.append(aspectLabel);
  field('supersampling','Supersampling','select',[[1,'1×'],[2,'2× per axis'],[4,'4× per axis']]);
  const quality=field('quality','WebP / JPEG quality','number');quality.min=.1;quality.max=1;quality.step=.05;
  field('background','Background','select',[['viewport','Viewport background'],['solid','Solid color'],['transparent','Transparent (alpha)']]);
  field('backgroundColor','Background color','color');
  field('camera','Camera','select',[['current','Current camera'],['isometric','Isometric'],['front','Front'],['back','Back'],['left','Left'],['right','Right'],['top','Top'],['bottom','Bottom']]);
  const elevation=field('elevation','Camera elevation (degrees)','number');elevation.min=-90;elevation.max=90;elevation.step=5;
  field('projection','Projection','select',[['current','Current projection'],['perspective','Perspective'],['orthographic','Orthographic']]);
  field('framing','Framing','select',[['contain','Preserve view / contain'],['crop','Preserve view / crop'],['fit','Fit visible ship']]);
  const margin=field('margin','Framing margin','number');margin.min=0;margin.max=.4;margin.step=.02;
  for(const [key,label] of [['overlays','Viewport overlays / axes'],['gizmos','Navigation gizmos'],['selection','Selection outlines / tint'],['grid','World grid'],['labels','Viewport labels'],['dimensions','Ship dimensions'],['dimensionCage','Dimension Cage']])field(key,label,'checkbox');
  const budget=field('budget','Memory budget (MiB)','number');budget.min=128;budget.max=4096;budget.step=128;
  const advanced=el('details');advanced.className='export-advanced';advanced.append(el('summary','Advanced'));advanced.open=!!stored.advanced;
  advanced.ontoggle=()=>{stored.advanced=advanced.open;writeStore();};
  for(const key of ['supersampling','projection','margin','budget'])advanced.append(fields[key].closest('label'));
  controls.append(advanced);
  const gifNote=el('p','GIF: Frame All fits the complete rotation at a fixed scale. Camera and elevation set the viewing angle. Choose Transparent for a fully clear background. GIF uses binary transparency (no partial alpha). Up to 256 colors. Maximum 2048 pixels per side; reduce resolution or frame rate for smaller files. Preview uses reduced resolution and frame rate.');
  const filename=el('p'),estimate=el('p');controls.append(gifNote,filename);advanced.append(estimate);
  function constrain(key){
    if(options.type!=='turntable')return;
    const before=options.width+'x'+options.height;
    Object.assign(options,fitGifSize(options.width,options.height,options.duration,options.fps,!aspect.checked&&['width','height'].includes(key)?key:null));
    if(before!==options.width+'x'+options.height)presets.value='';
  }
  aspect.onchange=()=>sync();
  function sync(){
    const turntable=options.type==='turntable',locked=busy&&!previewing;
    for(const [key,input] of Object.entries(fields)){if(input.type==='checkbox')input.checked=options[key];else input.value=options[key];input.disabled=locked;}
    fields.dimensions.closest('label').hidden=options.type==='blueprint';fields.dimensionCage.closest('label').hidden=!options.dimensions||options.type==='blueprint';fields.dimensionCage.disabled=locked||!options.dimensions;
    customize.hidden=options.type!=='blueprint';customize.disabled=locked;
    for(const key of ['gizmos','labels','grid'])fields[key].disabled=locked||options.type==='blueprint';
    margin.disabled=locked||options.framing!=='fit'&&options.camera==='current';
    fields.backgroundColor.disabled=locked||options.background==='viewport';
    quality.disabled=locked||options.format==='png';presets.disabled=aspect.disabled=locked;
    previewButton.disabled=renderButton.disabled=locked;cancel.hidden=!busy;progress.hidden=!busy;
    for(const key of ['camera','projection','framing']){fields[key].disabled=locked||options.type==='blueprint';fields[key].closest('label').hidden=options.type==='blueprint';}
    for(const key of ['duration','fps','direction','elevation']){fields[key].closest('label').hidden=!turntable;fields[key].disabled=locked||!turntable;}
    fields.framing.querySelector('option[value=fit]').textContent=turntable?'Frame All (complete rotation)':'Fit visible ship';
    gifNote.hidden=!turntable;
    const row=key=>fields[key].closest('label');
    row('format').hidden=turntable;row('quality').hidden=!['webp','jpeg'].includes(options.format);row('backgroundColor').hidden=options.background!=='solid';
    row('margin').hidden=options.framing!=='fit'&&options.camera==='current';
    for(const key of ['gizmos','labels','grid'])row(key).hidden=options.type==='blueprint'||turntable&&key!=='grid';
    const goal=goalFor();goals.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.goal===goal));b.disabled=locked;});
    goalHint.textContent=goal==='custom'?'Custom settings. Pick a goal above to reset them.':GOALS[goal].hint;
    const maximum=turntable?gifDimensionMax(options.width,options.height,options.duration,options.fps,aspect.checked):{width:32768,height:32768};
    fields.width.max=maximum.width;fields.height.max=maximum.height;
    if(turntable)gifNote.textContent=`${gifLimits(options.duration,options.fps).frames} frames. Current dimension limits: ${maximum.width} x ${maximum.height} pixels. Oversized dimensions and presets automatically shrink to fit duration/FPS limits. GIF uses binary transparency. Preview uses reduced resolution and frame rate.`;
    fields.format.disabled=locked||turntable;fields.format.querySelector('option[value=gif]').disabled=!turntable;
    fields.backgroundColor.disabled=locked||options.background!=='solid';
    if(turntable){fields.framing.disabled=true;fields.gizmos.disabled=fields.labels.disabled=true;}
    renderButton.textContent=turntable?'Prepare GIF':'Prepare Image';download.textContent=turntable?'Download GIF':'Download Image';
    filename.textContent='Filename: '+imageFilename(scene.model?.fileName,options.type,options.format);
    try{const plan=validate(options,undefined,scene.model?.blocks.length||0);estimate.textContent=`Estimated working memory: ${Math.ceil(plan.estimatedBytes/1024**2)} MiB. Supersampling multiplies working pixels by ${options.supersampling**2}.`;}
    catch(error){estimate.textContent=error.message;}
  }
  async function run(previewOnly){
    if(busy)return;result=null;download.disabled=true;controller=new AbortController();busy=true;previewing=previewOnly;const version=revision;sync();
    try{
      validate(options,undefined,scene.model?.blocks.length||0);
      const snapshot=captureImage(scene,view,context.preferences||FACTORY_PREFERENCES,size),overlays=await captureViewportOverlays(canvas);
      const renderOptions={...options};if(previewOnly){const factor=Math.min(1,1000/options.width,700/options.height);renderOptions.width=Math.max(1,Math.round(options.width*factor));renderOptions.height=Math.max(1,Math.round(options.height*factor));renderOptions.supersampling=1;}
      if(options.type==='turntable'&&previewOnly){const factor=Math.min(1,360/renderOptions.width,360/renderOptions.height);renderOptions.width=Math.max(1,Math.round(renderOptions.width*factor));renderOptions.height=Math.max(1,Math.round(renderOptions.height*factor));renderOptions.fps=Math.min(10,options.fps);}
      const prepared=await (options.type==='turntable'?exportTurntable:exportImage)(snapshot,renderOptions,{signal:controller.signal,overlays,onProgress:(value,message)=>{progress.value=value;status.textContent=message;}});
      if(disposed||version!==revision||controller.signal.aborted){prepared.canvas.width=prepared.canvas.height=1;return;}if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(prepared.blob);image.src=url;image.hidden=false;placeholder.hidden=true;
      prepared.canvas.width=prepared.canvas.height=1;
      if(previewOnly)status.textContent=`Preview ${prepared.width} × ${prepared.height}. Prepare ${options.type==='turntable'?'GIF':'Image'} to encode full resolution.`;
      else{result=prepared;download.disabled=false;status.textContent=`Ready: ${prepared.width} × ${prepared.height} · ${(prepared.blob.size/1024**2).toFixed(2)} MiB`;}
    }catch(error){reportError(error,'EXPORT');if(!disposed&&version===revision)status.textContent=error.name==='AbortError'?'Cancelled. Viewer state preserved.':error.message;}
    finally{busy=false;previewing=false;if(!disposed){sync();if(pending!==null){const next=pending;pending=null;request(next);}}}
  }
  previewButton.onclick=()=>request(true);renderButton.onclick=()=>request(false);cancel.onclick=()=>{clearTimeout(timer);pending=null;controller?.abort();};
  download.onclick=()=>{if(!result||!url)return;const link=el('a');link.href=url;link.download=result.name;link.click();};
  sync();{const initial=context.imageType||(['viewport','transparent','blueprint','turntable'].includes(stored.lastType)?stored.lastType:'viewport');fields.type.value=initial;initializing=!context.imageType;try{fields.type.onchange();}finally{initializing=false;}}
  return {setActive(value){active=value;if(value)schedulePreview();else{clearTimeout(timer);pending=null;if(previewing)controller?.abort();}},dispose(){disposed=true;blueprintDialog?.close();clearTimeout(timer);pending=null;controller?.abort();if(url)URL.revokeObjectURL(url);},get busy(){return busy&&!previewing;}};
}
