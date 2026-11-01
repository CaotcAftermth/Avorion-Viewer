import {blockOpacity,supportsOpacity} from './block-opacity.js';
import {icon} from './icons.js';
import {secondaryColor} from './block-colors.js';
import {recordBlockColors as applyBlockColors} from './color-workshop.js';
import { BLOCK_DEFINITIONS, MATERIALS, ORIENTATIONS, AXES, getBlockDefinition, repaintRGB } from './block-model.js';
export function mountBlockInspector(host,scene,onChange) {
  const model=scene.model,b=model?.blocks.find(b=>b.id===scene.selectedId)||model?.blocks[0];
  if(!b){host.textContent='No blocks loaded. Use File to load XML or a block preview.';return;}
  const breadcrumb=document.createElement('div');breadcrumb.className='property-breadcrumb';breadcrumb.innerHTML=icon('cube');const name=document.createElement('span');name.textContent=scene.preview?'Block Preview':`${b.type} · ${b.id}`;breadcrumb.append(name);host.append(breadcrumb);
  const identity=document.createElement('div');identity.className='property-datablock';identity.innerHTML=icon('cube');const identityName=document.createElement('span');identityName.textContent=scene.preview?b.type:model.fileName;identity.append(identityName);host.append(identity);
  const panel=document.createElement('details');panel.className='panel block-inspector';panel.open=true;
  const summary=document.createElement('summary');summary.textContent=scene.preview?'Block Preview':'Block Inspection';panel.append(summary);host.append(panel);
  const row=(title,control)=>{const label=document.createElement('label');label.className='field-row';const text=document.createElement('span');text.textContent=title;if(control.disabled){const reason='Imported values are read-only here. Use Color Editor to repaint selected blocks; load a block preview to edit geometry.';label.title=control.title=reason;control.setAttribute('aria-description',reason);}label.append(text,control);panel.append(label);return control;};
  const select=(title,options,value,change)=>{const el=document.createElement('select');el.setAttribute('aria-label',title);for(const [value,label] of options)el.add(new Option(label,String(value)));el.value=String(value);el.disabled=!scene.preview;el.onchange=()=>{change(el.value);onChange();};return row(title,el);};
  const showArgb=(input,argb)=>{
    const field=document.createElement('div');field.className='property-color-field';
    input.replaceWith(field);field.append(input);
    const value=document.createElement('output');value.className='property-argb';value.textContent=argb.toUpperCase();value.title='ARGB · Alpha, Red, Green, Blue';value.setAttribute('aria-label',input.getAttribute('aria-label')+' ARGB');field.append(value);
  };
  const definitions=[...BLOCK_DEFINITIONS,...(BLOCK_DEFINITIONS.some(d=>d.typeIndex===b.typeIndex)?[]:[getBlockDefinition(b.typeIndex)])].sort((a,b)=>a.typeIndex-b.typeIndex);
  const search=document.createElement('input');search.type='search';search.placeholder='Name or numerical ID';search.setAttribute('aria-label','Search block types');search.disabled=!scene.preview;row('Search Block Types',search);
  const blockType=select('Block Type',definitions.map(d=>[d.typeIndex,`${d.typeIndex} · ${d.displayName}`]),b.typeIndex,value=>{b.typeIndex=Number(value);b.type=getBlockDefinition(b.typeIndex).displayName;});
  search.oninput=()=>{
    const terms=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches=definitions.filter(d=>terms.every(term=>`${d.typeIndex} ${d.displayName}`.toLowerCase().includes(term)));
    blockType.replaceChildren(...matches.map(d=>new Option(`${d.typeIndex} · ${d.displayName}`,String(d.typeIndex))));
    // Filtering never changes the preview; the user must choose a result.
    if(!matches.some(d=>d.typeIndex===b.typeIndex))blockType.insertBefore(new Option(matches.length?'Choose block type':'No matching block types',''),blockType.firstChild);
    blockType.value=matches.some(d=>d.typeIndex===b.typeIndex)?String(b.typeIndex):'';
    if(blockType.options[0]?.value==='')blockType.options[0].disabled=true;
    blockType.disabled=!scene.preview||!matches.length;
  };
  select('Material',MATERIALS.map(m=>[m.index,m.name]),b.materialIndex,value=>{b.materialIndex=Number(value);b.material=MATERIALS[b.materialIndex].name;});
  select('Orientation',ORIENTATIONS.map(o=>[`${o.look},${o.up}`,`Look ${AXES[o.look]} · Up ${AXES[o.up]}`]),`${b.look},${b.up}`,value=>{[b.look,b.up]=value.split(',').map(Number);});
  for(const axis of ['x','y','z']){const el=document.createElement('input');el.type='number';el.min=.01;el.max=1000;el.step=.1;el.value=b.size[axis];el.setAttribute('aria-label',`Block Size ${axis.toUpperCase()}`);el.disabled=!scene.preview;el.onchange=()=>{const value=Number(el.value);if(Number.isFinite(value)&&value>=.01&&value<=1000){b.size[axis]=value;if(axis==='y')b.position.y=value/2;onChange();}else el.value=b.size[axis];};row(`Size ${axis.toUpperCase()}`,el);}
  const color=document.createElement('input');color.type='color';color.value='#'+b.color.slice(-6);color.disabled=!scene.preview;color.setAttribute('aria-label','Block Primary Color');color.onchange=()=>{applyBlockColors(scene,[{id:b.id,color:repaintRGB(b.color,color.value)}]);onChange({appearance:true});};row('Primary Color',color);showArgb(color,b.color);
  if(supportsOpacity(b)){
    const opacity=document.createElement('input');opacity.type='number';opacity.min=0;opacity.max=100;opacity.step=1;opacity.value=Number((blockOpacity(b)*100).toFixed(1));opacity.setAttribute('aria-label','Block Opacity');
    const changeOpacity=value=>{if(value===undefined)delete b.opacity;else b.opacity=value;scene.revision++;scene.appearanceRevision=(scene.appearanceRevision||0)+1;onChange({appearance:true});};
    opacity.onchange=()=>{if(opacity.value!==''&&opacity.checkValidity())changeOpacity(Number(opacity.value)/100);};row('Opacity (%)',opacity);
    const reset=document.createElement('button');reset.type='button';reset.textContent='Reset opacity';reset.disabled=b.opacity===undefined;reset.onclick=()=>changeOpacity(undefined);row('Opacity default',reset);
    opacity.title='Viewer opacity override. Original XML color alpha remains unchanged.';
  }
  const raw=secondaryColor(b);
  const secondaryOn=document.createElement('input');secondaryOn.type='checkbox';secondaryOn.checked=!!raw;secondaryOn.disabled=!scene.preview;secondaryOn.setAttribute('aria-label','Override Secondary Color');
  secondaryOn.onchange=()=>{applyBlockColors(scene,[{id:b.id,secondaryColor:secondaryOn.checked?'ff'+b.color.slice(-6):undefined}]);onChange({appearance:true});};row('Secondary Override',secondaryOn);secondaryOn.title=(scene.preview?'':'Imported models are read-only. ' )+'Viewer control: include an explicit secondaryColor value. Unchecked leaves that XML attribute absent.';
  if(raw){
    const secondary=document.createElement('input');secondary.type='color';secondary.value='#'+raw.slice(-6);secondary.disabled=!scene.preview;secondary.setAttribute('aria-label','Block Secondary Color');secondary.onchange=()=>{applyBlockColors(scene,[{id:b.id,secondaryColor:repaintRGB(raw,secondary.value)}]);onChange({appearance:true});};row('Secondary Color',secondary);showArgb(secondary,raw);
    const mix=document.createElement('input');mix.type='number';mix.min=0;mix.max=255;mix.step=1;mix.value=parseInt(raw.slice(0,2),16);mix.disabled=!scene.preview;mix.setAttribute('aria-label','Secondary Alpha');mix.onchange=()=>{const value=Number(mix.value);if(Number.isInteger(value)&&value>=0&&value<=255){applyBlockColors(scene,[{id:b.id,secondaryColor:value.toString(16).padStart(2,'0')+raw.slice(2)}]);onChange({appearance:true});}};row('Secondary Alpha',mix);mix.title=(scene.preview?'':'Imported models are read-only. ')+'First byte (AA) of secondaryColor in AARRGGBB, shown as 0–255. Not a separate XML attribute.';
  }
  const info=document.createElement('p');info.className='panel-note';info.textContent=`${getBlockDefinition(b.typeIndex).geometryKind} · look=${b.look}, up=${b.up}\nPosition: ${['x','y','z'].map(a=>b.position[a].toFixed(3)).join(', ')}\nARGB: ${b.color}\nItem: ${b.itemEl?.getAttribute('index')??b.id} · Parent: ${b.itemEl?.getAttribute('parent')??'none'}\nNative units · X right, Y up, Z back`;info.style.whiteSpace='pre-line';panel.append(info);
  if(!scene.preview){const note=document.createElement('p');note.className='panel-note';note.textContent='Click geometry to inspect a block. Use Color Editor to repaint imported blocks.';panel.append(note);}
  // Keep the existing controls and callbacks, but group them like Blender panels.
  const makePanel=(title,open=true)=>{const el=document.createElement('details');el.className='panel block-inspector';el.open=open;const heading=document.createElement('summary');heading.textContent=title;el.append(heading);host.append(el);return el;};
  const transform=makePanel('Transform'),blockPanel=makePanel('Block'),appearance=makePanel('Appearance'),native=makePanel('Native Data',false);
  const location=document.createElement('div');location.className='property-vector';
  for(const [i,axis] of ['x','y','z'].entries()){
    const label=document.createElement('label');label.className='field-row';const caption=document.createElement('span');caption.textContent=(i===0?'Location ':'')+axis.toUpperCase();
    const value=document.createElement('input');value.type='text';value.readOnly=true;value.value=b.position[axis].toFixed(3);value.setAttribute('aria-label','Block Location '+axis.toUpperCase());value.title='Native-axis viewer position. Position editing is not available.';label.append(caption,value);location.append(label);
  }
  transform.append(location);
  const size=document.createElement('div');size.className='property-vector';
  for(const field of [...panel.querySelectorAll('.field-row')]){
    const title=field.firstElementChild.textContent;
    if(title.startsWith('Size ')){if(title!=='Size X')field.firstElementChild.textContent=title.slice(-1);size.append(field);}
    else if(title==='Orientation')transform.append(field);
    else if(title==='Search Block Types'||title==='Block Type'||title==='Material')blockPanel.append(field);
    else appearance.append(field);
  }
  transform.append(size);
  for(const note of [...panel.querySelectorAll('.panel-note')])native.append(note);
  panel.remove();
  for(const warning of model.warnings||[]){const p=document.createElement('p');p.className='panel-note';p.textContent=warning.message;host.append(p);}
}
