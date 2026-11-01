import {blockOpacity,supportsOpacity} from './block-opacity.js';
import {icon} from './icons.js';
import {secondaryColor} from './block-colors.js';
import {recordBlockColors as applyBlockColors} from './color-workshop.js';
import { BLOCK_DEFINITIONS, MATERIALS, ORIENTATIONS, AXES, getBlockDefinition, repaintRGB } from './block-model.js';
import { liveBlocks, blockIds, blockChildIds, blockLabel } from './ship-structure.js';
const LINKED_CHILDREN=8;
const BOUNDS=[['Lower bound',[['lx','lowerX'],['ly','lowerY'],['lz','lowerZ']]],['Upper bound',[['ux','upperX'],['uy','upperY'],['uz','upperZ']]]];
const BLOCK_ATTRS=new Set(['index','material','look','up','color','secondaryColor',...BOUNDS.flatMap(([,axes])=>axes.flat())]);
// Center of a block in native XML coordinates (the viewer may re-center imported models).
function nativeCenter(block){
  const el=block.el;if(!el)return null;
  const value=(cur,legacy)=>Number(el.getAttribute(el.hasAttribute(cur)?cur:legacy));
  const c=BOUNDS[0][1].map(([cur,legacy],i)=>(value(cur,legacy)+value(...BOUNDS[1][1][i]))/2);
  return c.every(Number.isFinite)?c:null;
}
export function blockXml(block){
  const node=block.itemEl||block.el;if(!node)return '';
  return new XMLSerializer().serializeToString(node).replace(/^(<[^>]*?)\s+xmlns(:\w+)?="[^"]*"/,'$1');
}
// Native Data: decoded XML attributes, clickable hierarchy, then the XML itself.
function mountNativeData(panel,b,scene,reveal){
  const el=b.el,item=b.itemEl;
  const sub=text=>{const d=document.createElement('div');d.className='sub-label';d.textContent=text;panel.append(d);};
  const field=(label,value,{title,parent=panel,swatch}={})=>{
    const row=document.createElement('label');row.className='field-row';const caption=document.createElement('span');caption.textContent=label;
    const input=document.createElement('input');input.type='text';input.readOnly=true;input.value=value;input.setAttribute('aria-label','Native '+label);if(title)input.title=title;
    if(swatch)input.style.boxShadow=`inset 5px 0 #${swatch.slice(-6)}`;
    row.append(caption,input);parent.append(row);return row;
  };
  if(!el){
    const note=document.createElement('p');note.className='panel-note';note.textContent='Block previews have no XML source. Values below are the preview settings.';panel.append(note);
    field('index',`${b.typeIndex} · ${b.type}`);field('material',`${b.materialIndex} · ${b.material}`);field('look',`${b.look} · ${AXES[b.look]??'invalid'}`);field('up',`${b.up} · ${AXES[b.up]??'invalid'}`);field('color',b.color.toUpperCase(),{swatch:b.color});
    return;
  }
  const live=blockIds(scene),byId=new Map(liveBlocks(scene).map(x=>[x.id,x]));
  const describe=block=>{const c=nativeCenter(block);return `${blockLabel(block)}\nViewer ID ${block.id}${c?` · center ${c.map(v=>+v.toFixed(3)).join(', ')}`:''}`;};
  const link=(target,host)=>{
    const wrap=document.createElement('div');wrap.className='native-link';
    const name=document.createElement('button');name.type='button';name.className='native-block-link';name.textContent=blockLabel(target);name.title='Select · '+describe(target);name.setAttribute('aria-label','Select '+blockLabel(target));name.onclick=()=>reveal([target.id],{focus:false});
    const frame=document.createElement('button');frame.type='button';frame.className='native-frame';frame.innerHTML=icon('frame');frame.title='Show and frame in the viewport';frame.setAttribute('aria-label','Frame '+blockLabel(target));frame.onclick=()=>reveal([target.id],{focus:true});
    wrap.append(name,frame);host.append(wrap);
  };
  const linkRow=(label,build)=>{const row=document.createElement('div');row.className='field-row native-hierarchy';const caption=document.createElement('span');caption.textContent=label;const links=document.createElement('div');links.className='native-links';build(links);row.append(caption,links);panel.append(row);};
  sub('Item · <item>');
  const itemIndex=item?.getAttribute('index');
  field('index',itemIndex??'—',{title:item?'Native block index. Other items refer to it with parent="…".':'This block is not wrapped in an <item> element.'});
  const parentAttr=item?.getAttribute('parent');
  if(b.parentId&&live.has(b.parentId))linkRow('parent',links=>link(byId.get(b.parentId),links));
  else field('parent',parentAttr==null?'—':parentAttr==='-1'?'-1 · root block':`${parentAttr} · not loaded`,{title:parentAttr==='-1'?'Root of the ship: no parent.':parentAttr==null?'':'The parent item is not a rendered block (turret design or missing index).'});
  const children=blockChildIds(scene,[b.id]);
  if(!children.length)field('children','None',{title:'No items name this block as their parent.'});
  else linkRow(`children · ${children.length}`,links=>{
    for(const id of children.slice(0,LINKED_CHILDREN))link(byId.get(id),links);
    if(children.length>1){const all=document.createElement('button');all.type='button';all.className='native-show-all';all.textContent=children.length>LINKED_CHILDREN?`Show all ${children.length} children (${children.length-LINKED_CHILDREN} more)`:`Show all ${children.length} children`;all.onclick=()=>reveal(children,{focus:true});links.append(all);}
  });
  const otherItem=[...(item?.attributes||[])].filter(a=>a.name!=='index'&&a.name!=='parent');
  for(const a of otherItem)field(a.name,a.value);
  sub('Block · <block>');
  const raw=name=>el.getAttribute(name);
  if(el.hasAttribute('index'))field('index',`${raw('index')} · ${getBlockDefinition(Number(raw('index'))).displayName}`,{title:'Block type index · '+getBlockDefinition(b.typeIndex).geometryKind});
  if(el.hasAttribute('material'))field('material',`${raw('material')} · ${MATERIALS[Number(raw('material'))]?.name??'Unknown'}`);
  for(const name of ['look','up'])field(name,el.hasAttribute(name)?`${raw(name)} · ${AXES[Number(raw(name))]??'invalid'}`:`absent · default ${b[name]} (${AXES[b[name]]})`,{title:name==='look'?'Axis the block faces: 0 −X, 1 +X, 2 −Y, 3 +Y, 4 −Z, 5 +Z.':'Axis the block’s top points to: 0 −X, 1 +X, 2 −Y, 3 +Y, 4 −Z, 5 +Z.'});
  for(const [title,axes] of BOUNDS){
    sub(title);const vector=document.createElement('div');vector.className='property-vector';panel.append(vector);
    for(const [cur,legacy] of axes){const name=el.hasAttribute(cur)||!el.hasAttribute(legacy)?cur:legacy;field(name,raw(name)??'—',{parent:vector,title:'Native XML coordinate, before viewer placement.'});}
  }
  sub('Color');
  if(el.hasAttribute('color'))field('color',raw('color').toUpperCase(),{title:'AARRGGBB · alpha, red, green, blue',swatch:raw('color')});else field('color','absent · default FF808080');
  if(el.hasAttribute('secondaryColor'))field('secondaryColor',raw('secondaryColor').toUpperCase(),{title:'AARRGGBB · alpha, red, green, blue',swatch:raw('secondaryColor')});
  const other=[...el.attributes].filter(a=>!BLOCK_ATTRS.has(a.name));
  if(other.length){sub('Other attributes');for(const a of other)field(a.name,a.value);}
  const head=document.createElement('div');head.className='native-xml-head';const caption=document.createElement('span');caption.className='sub-label';caption.textContent='XML';
  const xml=blockXml(b);
  const copy=document.createElement('button');copy.type='button';copy.className='native-copy';copy.textContent='Copy';copy.title='Copy this XML';
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(xml);copy.textContent='Copied';}catch{copy.textContent='Copy failed';}setTimeout(()=>{copy.textContent='Copy';},1500);};
  head.append(caption,copy);
  const pre=document.createElement('pre');pre.className='native-xml';pre.title='Current XML for this block, including any repaints. Saved as-is by File › Save XML.';const code=document.createElement('code');code.textContent=xml;pre.append(code);
  panel.append(head,pre);
}
export function mountBlockInspector(host,scene,onChange,{reveal=()=>{}}={}) {
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
  mountNativeData(native,b,scene,reveal);
  if(!scene.preview){const note=document.createElement('p');note.className='panel-note';note.textContent='Click geometry to inspect a block. Use Color Editor to repaint imported blocks.';blockPanel.append(note);}
  panel.remove();
  for(const warning of model.warnings||[]){const p=document.createElement('p');p.className='panel-note';p.textContent=warning.message;host.append(p);}
}
