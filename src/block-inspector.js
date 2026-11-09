import {thumbnail} from './turrets/thumbnail.js';
import {styleColorCell} from './color-cells.js';
import {blockOpacity,supportsOpacity} from './block-opacity.js';
import {getShadingSpec} from './avorion/lib/textures/shadingMap.js';
import {icon} from './icons.js';
import {secondaryColor} from './block-colors.js';
import {recordBlockColors as applyBlockColors} from './color-workshop.js';
import { BLOCK_DEFINITIONS, MATERIALS, ORIENTATIONS, AXES, getBlockDefinition, repaintRGB } from './block-model.js';
import { liveBlocks, blockIds, blockChildIds, blockLabel } from './ship-structure.js';
import { blockVariants, isBlockGallery, isDefaultPaint } from './block-gallery.js';
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
    if(swatch)styleColorCell(input,swatch);
    row.append(caption,input);parent.append(row);return row;
  };
  if(!el){
    const note=document.createElement('p');note.className='panel-note';note.textContent='Block Gallery blocks have no XML source. Values below are the gallery settings.';panel.append(note);
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
export function mountBlockInspector(host,scene,onChange,{reveal=()=>{},preferences=null,openVariant=()=>{}}={}) {
  const model=scene.model,b=model?.blocks.find(b=>b.id===scene.selectedId)||model?.blocks[0];
  if(!b){host.textContent='No blocks loaded. Use File to load XML, or Help › Developer › Load Block Gallery.';return;}
  const breadcrumb=document.createElement('div');breadcrumb.className='property-breadcrumb';breadcrumb.innerHTML=icon('cube');const name=document.createElement('span');name.textContent=scene.preview?`Block Gallery · ${b.type}`:`${b.type} · ${b.id}`;breadcrumb.append(name);host.append(breadcrumb);
  const identity=document.createElement('div');identity.className='property-datablock';identity.innerHTML=icon('cube');const identityName=document.createElement('span');identityName.textContent=scene.preview?b.type:model.fileName;identity.append(identityName);host.append(identity);
  const native=document.createElement('section');native.className='panel block-inspector object-data';
  const heading=document.createElement('h3');heading.textContent='Object Data';native.append(heading);host.append(native);
  mountNativeData(native,b,scene,reveal);
  if(isBlockGallery(scene)&&scene.selectedId){
    const variants=document.createElement('section');variants.className='panel block-variants';const title=document.createElement('h3');title.textContent='Variants';variants.append(title);const list=document.createElement('div');list.className='block-variant-list';list.setAttribute('aria-label','Block variants');variants.append(list);
    for(const variant of blockVariants(b.typeIndex)){
      const row=document.createElement('button');row.type='button';row.className='block-variant-row';row.title='Double-click to open '+variant.name;row.setAttribute('aria-label',variant.label+' variant');row.setAttribute('aria-pressed',String(variant.typeIndex===b.typeIndex));row.classList.toggle('active',variant.typeIndex===b.typeIndex);
      const canvas=document.createElement('canvas'),label=document.createElement('span');label.textContent=variant.label;row.append(canvas,label);list.append(row);
      const preview={...b,typeIndex:variant.typeIndex,type:variant.name,position:{x:0,y:0,z:0}};thumbnail(canvas,{name:variant.name,blocks:[preview]});
      row.onclick=()=>{for(const item of list.children){item.classList.toggle('active',item===row);item.setAttribute('aria-pressed',String(item===row));}};
      row.ondblclick=()=>openVariant(b,variant);row.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openVariant(b,variant);}};
    }
    host.append(variants);
  }
}
