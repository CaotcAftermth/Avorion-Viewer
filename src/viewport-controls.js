import {ensureViewportOptions} from './viewport-options.js';
import {icon} from './icons.js';
import {setDisabled} from './control-state.js';
const disabledReasons={
  axisLength:'Disable Infinite Axes to set a finite length.',
  ambientOnly:'Switch to Solid, Material Preview, or Rendered shading for surface lighting.',
  ambientStrength:'Switch to a surface shading mode and enable Ambient Only to adjust ambient illumination.',
  ambientDetail:'Enable Ambient Only in a surface shading mode to adjust shape contrast.',
  lighting:'Switch to Solid shading to choose solid lighting.',
  studioLight:'Switch to Solid shading and choose Studio lighting.',
  matcap:'Switch to Solid shading and choose MatCap lighting.',
  backgroundColor:'Choose Viewport as the background to edit its color.',
  wireThreshold:'Enable the Wireframe overlay or switch to Wireframe shading.',
  wireOpacity:'Enable the Wireframe overlay to adjust its opacity.',
  xray:'Switch to Solid or Wireframe shading to enable X-Ray.',
  xrayAlpha:'Switch to Solid or Wireframe shading and enable X-Ray.',
  outlineColor:'Enable Object Outline to edit its color.',
  shadows:'Switch to Solid or Rendered shading to enable shadows.',
  shadowIntensity:'Switch to Solid or Rendered shading and enable Shadows.',
  dof:'Switch to Rendered shading to enable Depth of Field.',
  focusDistance:'Switch to Rendered shading and enable Depth of Field.',
  aperture:'Switch to Rendered shading and enable Depth of Field.'
};
function syncXray(group,d){setDisabled(group.querySelector('[aria-label="Toggle X-Ray"]'),!['SOLID','WIREFRAME'].includes(d.shading),disabledReasons.xray,'Toggle X-Ray');}
let opened=null;
export function closeViewportPopover(){opened?.remove();opened=null;}
function control(parent,d,key,label,type,changed,options={}){
  const row=document.createElement('div');row.className='viewport-property';
  const title=document.createElement('span');title.textContent=label;title.title=options.tip||label;row.append(title);
  const input=document.createElement(type==='select'?'select':'input');input.setAttribute('aria-label',label);
  if(type==='select')for(const v of options.values){const op=document.createElement('option');op.value=Array.isArray(v)?v[0]:v;op.textContent=Array.isArray(v)?v[1]:v;input.append(op);}
  else input.type=type;
  if(type==='checkbox')input.checked=d[key];else input.value=d[key];
  if(type==='number'||type==='range'){input.min=options.min??0;input.max=options.max??1;input.step=options.step??.01;input.value=d[key];}
  const updateEnabled=()=>{const disabled=options.enabled?!options.enabled():!!options.disabled;const reason=disabledReasons[key];setDisabled(input,disabled,reason,options.tip||label);row.querySelectorAll('input,select').forEach(el=>setDisabled(el,disabled,reason,options.tip||label));row.title=title.title=disabled?reason:options.tip||label;};
  const root=parent.closest('.viewport-popover');if(root)(root.updateControls??=[]).push(updateEnabled);
  updateEnabled();
  const update=()=>{
    const v=type==='checkbox'?input.checked:['number','range'].includes(type)?Number(input.value):input.value;
    if(typeof v==='number'&&(!Number.isFinite(v)||v<+input.min||v>+input.max))return;
    if(key==='clipStart'&&v>=d.clipEnd||key==='clipEnd'&&v<=d.clipStart){input.value=d[key];return;}
    d[key]=v;
    if(v===true&&['showBlockBounds','showModelDimensions'].includes(key))d.showOverlays=true;
    changed();root?.updateControls?.forEach(fn=>fn());
  };
  input.addEventListener(['range','color','number'].includes(type)?'input':'change',update);row.append(input);
  if(type==='range'){
    const number=document.createElement('input');number.type='number';number.min=input.min;number.max=input.max;number.step=input.step;number.value=d[key];number.setAttribute('aria-label',label+' value');number.disabled=input.disabled;
    number.addEventListener('input',()=>{if(number.value==='')return;input.value=number.value;update();});input.addEventListener('input',()=>number.value=d[key]);row.append(number);
  }
  parent.append(row);updateEnabled();return input;
}
function section(parent,name){const el=document.createElement('details');el.dataset.section=name;el.open=true;const summary=document.createElement('summary');summary.textContent=name;el.append(summary);parent.append(el);return el;}
export function popover(anchor,title,build){
  if(opened?.anchor===anchor){closeViewportPopover();return;}
  closeViewportPopover();const el=document.createElement('div');el.className='viewport-popover';el.tabIndex=-1;el.setAttribute('role','dialog');el.setAttribute('aria-label',title);el.anchor=anchor;
  const heading=document.createElement('div');heading.className='popover-title';heading.textContent=title;el.append(heading);build(el);document.body.append(el);opened=el;
  const r=anchor.getBoundingClientRect(),area=anchor.closest('.area')?.getBoundingClientRect();
  if(area)el.style.maxHeight=Math.max(240,area.bottom-r.bottom-12)+'px';
  el.style.left=Math.max(6,Math.min(innerWidth-el.offsetWidth-6,r.right-el.offsetWidth))+'px';el.style.top=Math.max(6,Math.min(innerHeight-el.offsetHeight-6,r.bottom+5))+'px';
  el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeViewportPopover();anchor.focus();}});el.querySelector('input,select')?.focus();
}
document.addEventListener('pointerdown',e=>{if(opened&&!opened.contains(e.target)&&!opened.anchor.contains(e.target))closeViewportPopover();});
window.addEventListener('resize',closeViewportPopover);
export function viewportHeader(header,view,changed){
  const d=ensureViewportOptions(view),buttons=[];
  const refresh=()=>{view.wire=d.shading==='WIREFRAME';for(const [b,test] of buttons){b.classList.toggle('active',test());b.setAttribute('aria-pressed',String(test()));}const grid=header.querySelector('[aria-label="Toggle grid"]');if(grid){grid.classList.toggle('active',view.grid);grid.setAttribute('aria-pressed',String(view.grid));}syncXray(group,d);changed();};
  const button=(label,content,action,test)=>{const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=content;b.addEventListener('click',action);if(test){buttons.push([b,test]);b.classList.toggle('active',test());b.setAttribute('aria-pressed',String(test()));}return b;};
  const group=document.createElement('div');group.className='viewport-header-controls';header.append(group);
  group.append(button('Show Gizmos',icon('gizmo'),()=>{d.showGizmo=!d.showGizmo;refresh();},()=>d.showGizmo));
  const overlays=document.createElement('div');overlays.className='joined-buttons';group.append(overlays);
  overlays.append(button('Show Overlays',icon('overlays'),()=>{d.showOverlays=!d.showOverlays;refresh();},()=>d.showOverlays));
  const overlayMenu=button('Viewport Overlays','⌄',()=>popover(overlayMenu,'Viewport Overlays',el=>{
    const master=control(el,d,'showOverlays','Show Overlays','checkbox',refresh,{tip:'Master visibility for this viewport. Hides all overlays without clearing their individual settings.'});
    const notice=document.createElement('p');notice.className='panel-note';notice.textContent='Overlays hidden. Enable Show Overlays to display checked items.';el.append(notice);
    (el.updateControls??=[]).push(()=>{master.checked=d.showOverlays;notice.hidden=d.showOverlays;});notice.hidden=d.showOverlays;
    const guides=section(el,'Guides');control(guides,view,'grid','Floor','checkbox',refresh);
    const axes=document.createElement('div');axes.className='viewport-property';axes.innerHTML='<span>Axes</span>';
    for(const axis of ['X','Y','Z'])axes.append(button(axis+' Axis',axis,()=>{d['axis'+axis]=!d['axis'+axis];refresh();},()=>d['axis'+axis]));guides.append(axes);
    control(guides,d,'axisInfinite','Infinite Axes','checkbox',refresh);
    control(guides,d,'axisLength','Axis Length','number',refresh,{min:.001,max:1e12,step:1,enabled:()=>!d.axisInfinite,tip:'Total length centered on origin, in model units. Enable Infinite Axes for unlimited length.'});
    control(guides,d,'axisWidth','Axis Width','range',refresh,{min:.5,max:12,step:.5,tip:'Axis width in screen pixels'});
    control(guides,d,'axisBrightness','Axis Brightness','range',refresh,{min:0,max:4,step:.05});
    control(guides,d,'gridScale','Grid Scale','number',refresh,{min:.001,max:1000,step:.1});
    const text=section(el,'Text');for(const [key,label] of [['showText','General Info'],['showPerformance','Performance'],['showStats','Statistics']])control(text,d,key,label,'checkbox',refresh);
    const objects=section(el,'Objects');
    control(objects,d,'shadeSelected','Shade Selected','checkbox',refresh,{tip:'Tint selected block faces in the Selection Color.'});
    control(objects,d,'outlineSelected','Outline Selected','checkbox',refresh,{tip:'Draw thicker outlines of selected blocks, including edges behind faces and other blocks.'});
    control(objects,d,'showBlockBounds','Block Bounds','checkbox',refresh,{tip:'Show axis-aligned bounding extents of visible blocks. Opaque surfaces occlude rear and internal edges. Respects hidden and thin-block filters. Enabling also turns on Show Overlays for this viewport.'});
    control(objects,d,'showModelDimensions','Model Dimensions','checkbox',refresh,{tip:'Whole-model bounding cage with width (native X), height (native Y), and length (native Z) dimension arrows, including hidden blocks. Values use native model units, not export millimeters. Enabling also turns on Show Overlays for this viewport.'});
    const geometry=section(el,'Geometry');control(geometry,d,'wireOverlay','Wireframe','checkbox',refresh);
    control(geometry,d,'wireThreshold','Wireframe Threshold','range',refresh,{enabled:()=>d.wireOverlay||d.shading==='WIREFRAME',tip:'Edge angle filter. Higher values include shallower creases; triangulation diagonals remain hidden.'});control(geometry,d,'wireOpacity','Wireframe Opacity','range',refresh,{enabled:()=>d.wireOverlay});
  }));overlays.append(overlayMenu);
  group.append(button('Toggle X-Ray',icon('xray'),()=>{d.xray=!d.xray;refresh();},()=>d.xray));
  syncXray(group,d);
  const shading=document.createElement('div');shading.className='joined-buttons';group.append(shading);
  for(const [mode,label,ico] of [['WIREFRAME','Wireframe','wire'],['SOLID','Solid','solid'],['MATERIAL','Material Preview','material'],['RENDERED','Rendered','rendered']])shading.append(button(label+' shading',icon(ico),()=>{d.shading=mode;refresh();},()=>d.shading===mode));
  const shadingMenu=button('Viewport Shading','⌄',()=>popover(shadingMenu,'Viewport Shading',el=>{
    const lighting=section(el,'Lighting');
    control(lighting,d,'ambientOnly','Ambient Only','checkbox',refresh,{enabled:()=>d.shading!=='WIREFRAME',tip:'Bright ambient fill with adjustable shape contrast. Set Shape Contrast to zero for equal illumination.'});
    control(lighting,d,'ambientStrength','Ambient Brightness','range',refresh,{min:0,max:4,step:.05,enabled:()=>d.ambientOnly&&d.shading!=='WIREFRAME'});
    control(lighting,d,'ambientDetail','Shape Contrast','range',refresh,{min:0,max:1,step:.05,enabled:()=>d.ambientOnly&&d.shading!=='WIREFRAME',tip:'Subtle face shading and recess contrast. Zero restores completely flat ambient lighting.'});
    control(lighting,d,'lighting','Solid Lighting','select',refresh,{values:[['STUDIO','Studio'],['MATCAP','MatCap']],disabled:d.shading!=='SOLID'});
    control(lighting,d,'studioLight','Studio Light','select',refresh,{values:['Default'],enabled:()=>d.shading==='SOLID'&&d.lighting==='STUDIO'});
    control(lighting,d,'matcap','MatCap','select',refresh,{values:['Red Wax'],tip:'Procedural red-wax MatCap preview',enabled:()=>d.shading==='SOLID'&&d.lighting==='MATCAP'});
    const color=section(el,'Background');control(color,d,'background','Background','select',refresh,{values:[['THEME','Theme'],['WORLD','World'],['VIEWPORT','Viewport']]});control(color,d,'backgroundColor','Background Color','color',refresh,{enabled:()=>d.background==='VIEWPORT'});
    const opts=section(el,'Options');for(const [key,label] of [['backfaceCulling','Backface Culling'],['objectOutline','Object Outline'],['specular','Specular Highlights'],['xray','X-Ray']])control(opts,d,key,label,'checkbox',refresh,{enabled:()=>key!=='xray'||['SOLID','WIREFRAME'].includes(d.shading)});
    control(opts,d,'outlineColor','Outline Color','color',refresh,{enabled:()=>d.objectOutline});control(opts,d,'xrayAlpha','X-Ray Opacity','range',refresh,{enabled:()=>d.xray&&['SOLID','WIREFRAME'].includes(d.shading)});
    control(opts,d,'shadows','Shadows','checkbox',refresh,{enabled:()=>['SOLID','RENDERED'].includes(d.shading)});control(opts,d,'shadowIntensity','Shadow Intensity','range',refresh,{enabled:()=>d.shadows&&['SOLID','RENDERED'].includes(d.shading)});
    control(opts,d,'dof','Depth of Field','checkbox',refresh,{disabled:d.shading!=='RENDERED'});
    control(opts,d,'focusDistance','Focus Distance','number',refresh,{min:.001,max:1e7,step:.1,tip:'Focus distance in native model units',enabled:()=>d.dof&&d.shading==='RENDERED'});
    control(opts,d,'aperture','Aperture (f-stop)','number',refresh,{min:.1,max:64,step:.1,enabled:()=>d.dof&&d.shading==='RENDERED'});
  }));shading.append(shadingMenu);
}
export function viewportViewPanel(sidebar,view,changed){
  const d=ensureViewportOptions(view),panel=section(sidebar,'View');
  control(panel,d,'focalLength','Focal Length (mm)','number',changed,{min:1,max:300,step:1});
  control(panel,d,'clipStart','Clip Start','number',changed,{min:.0001,max:1e6,step:.01,tip:'Near clipping distance in native model units'});
  control(panel,d,'clipEnd','Clip End','number',changed,{min:.001,max:1e7,step:1,tip:'Far clipping distance in native model units'});
}
