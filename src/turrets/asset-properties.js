import {wirePanels,wireTabs} from '../editor-panels.js';
import {mountStudio} from './studio.js';
import {icon} from '../icons.js';
import {PARTS,createInstance,partMatrices,pitchLimits,clampElevation} from './core.js';

export function assetPoseTransforms(asset){
 const instance=createInstance(asset.id,'origin','preview');
 Object.assign(instance,asset.editorPose||{});instance.turretSize=asset.sourceSize||1;
 const matrices=partMatrices(asset,{position:[0,0,0],rotation:[0,0,0]},instance);
 return new Map(asset.blocks.map(b=>[b.id,matrices[asset.parts[b.id]||'base']]));
}

const ASSET_CATEGORIES=[['structure','Structure','outliner'],['pose','Pose & Mechanics','gizmo'],['studio','Turret Studio','turret'],['showcase','Showcase & Timeline','world'],['export','Showcase Export','rendered'],['calibration','Calibration & Development','properties']];
export function mountAssetProperties(body,node,asset,scene,changed){
 const previous=body.querySelector('.property-content');node.assetPropertyScroll??={};if(previous?.dataset.propertyCategory)node.assetPropertyScroll[previous.dataset.propertyCategory]=previous.scrollTop;body.propertyCleanup?.();body.propertyCleanup=null;
 body.innerHTML='<div class="property-layout"><nav class="property-tabs" aria-label="Properties categories"></nav><div class="property-content"></div></div>';
 const category=node.assetPropertyTab||'structure',query=(node.propertySearch||'').trim().toLowerCase();
 for(const [id,label,ico] of ASSET_CATEGORIES){
  const tab=document.createElement('button');tab.classList.toggle('active',category===id&&!query);tab.dataset.tab=id;tab.title=label;tab.setAttribute('aria-label',label);tab.innerHTML=icon(ico);tab.onclick=()=>{if(query){body.querySelector(`.property-search-group[data-tab="${id}"]`)?.scrollIntoView({block:'start'});return;}node.assetPropertyTab=id;changed();body.querySelector('.property-tabs .active')?.focus();};body.querySelector('nav').append(tab);
 }
 const content=body.querySelector('.property-content');content.dataset.propertyCategory=category;
 const title=document.createElement('div');title.className='property-breadcrumb';title.textContent=asset.name;content.append(title);
 if(query){
  content.classList.add('property-search-results');const cleanups=[];
  for(const [id,label] of ASSET_CATEGORIES){const group=document.createElement('section');group.className='property-search-group';group.dataset.tab=id;group.dataset.label=label;const heading=document.createElement('h2');heading.className='property-search-heading';heading.textContent=label;const host=document.createElement('div');host.className='property-search-body';const temporary=document.createElement('div');mountAssetProperties(temporary,{...node,assetPropertyTab:id,propertySearch:'',panelOpen:{},assetPropertyScroll:{}},asset,scene,changed);const nested=temporary.querySelector('.property-content');nested.querySelector('.property-breadcrumb')?.remove();host.append(...nested.children);group.append(heading,host);content.append(group);if(temporary.propertyCleanup)cleanups.push(temporary.propertyCleanup);}
  body.propertyCleanup=()=>cleanups.forEach(cleanup=>cleanup());wireTabs(body.querySelector('nav'),content);return;
 }
 function panel(name){const d=document.createElement('details');d.className='panel';d.open=true;const summary=document.createElement('summary');summary.textContent=name;d.append(summary);content.append(d);return d;}
 function field(host,label,type,value,action,attrs={}){const row=document.createElement('label');row.className='field-row';row.append(label);const input=document.createElement('input');Object.assign(input,{type,value,...attrs});input.setAttribute('aria-label',label);if(type==='number')input.dataset.default=0;input.onchange=()=>{if(!input.checkValidity()||!input.value)return;input.onchange=null;action(type==='number'?Number(input.value):input.value);changed();};row.append(input);host.append(row);}
 if(category==='pose'){
 const pose=panel('Turret Pose');asset.editorPose??={yaw:0,pitch:0};
 field(pose,'Body rotation','number',asset.editorPose.yaw,v=>{asset.editorPose.yaw=v;scene.turretStudio?.restart();},{min:-360,max:360,step:1});
 const limits=pitchLimits(asset);field(pose,'Barrel elevation','number',asset.editorPose.pitch,v=>{asset.editorPose.pitch=clampElevation(asset,v);scene.turretStudio?.restart();},{min:limits.min,max:limits.max,step:1});
 const reset=document.createElement('button');reset.className='setting-button';reset.textContent='Neutral pose';reset.onclick=()=>{asset.editorPose={yaw:0,pitch:0};scene.turretStudio?.restart();changed();};pose.append(reset);
 const guides=panel('Viewport Guides');asset.editorGuides??={axes:false,muzzles:false};
 for(const [key,label] of [['axes','Show rotation axes'],['muzzles','Show muzzle positions']]){const row=document.createElement('label');row.className='check-row';const input=document.createElement('input');input.type='checkbox';input.checked=!!asset.editorGuides[key];input.setAttribute('aria-label',label);input.onchange=()=>{asset.editorGuides[key]=input.checked;changed();};row.append(input,label);guides.append(row);}
 const legend=document.createElement('p');legend.className='panel-note';legend.textContent='Violet: body rotation (yaw) axis. Yellow: barrel elevation (pitch) axis. Dashed lines with a ring are rotation axes, not world axes. Cyan: muzzle positions.';guides.append(legend);
 if(!(asset.muzzlePositions?.length||asset.muzzles?.length)){const note=document.createElement('p');note.className='panel-note';note.textContent='No muzzle positions are defined for this asset.';guides.append(note);}
 }
 if(category==='structure'){
 const parts=panel('Turret Components');
 for(const part of PARTS){const b=document.createElement('button');b.className='setting-button';b.textContent='Select '+part;b.onclick=()=>{scene.selectedIds=new Set(asset.blocks.filter(b=>asset.parts[b.id]===part).map(b=>b.id));scene.selectedId=[...scene.selectedIds][0]||null;scene.selected=!!scene.selectedIds.size;changed();};parts.append(b);}
 const selected=asset.blocks.filter(b=>scene.selectedIds.has(b.id));const appearance=panel('Block Appearance');
 const groups=[...new Set(selected.map(b=>asset.parts[b.id]))];const identity=document.createElement('p');identity.className='panel-note';identity.textContent=(groups.length?groups.join(', '):'No component selected')+' · '+selected.length+' selected blocks';parts.append(identity);
 const note=document.createElement('p');note.className='panel-note';note.textContent=selected.length+' selected blocks';appearance.append(note);
 const visibility=panel('Component Visibility');visibility.open=false;
 for(const part of PARTS){const row=document.createElement('label');row.className='check-row';const input=document.createElement('input');input.type='checkbox';const ids=asset.blocks.filter(b=>asset.parts[b.id]===part).map(b=>b.id);input.checked=ids.some(id=>!scene.hiddenIds?.has(id));input.setAttribute('aria-label','Show '+part);input.onchange=()=>{scene.hiddenIds??=new Set();for(const id of ids)input.checked?scene.hiddenIds.delete(id):scene.hiddenIds.add(id);changed();};row.append(input,'Show '+part);visibility.append(row);}
 const isolate=document.createElement('button');isolate.className='setting-button';isolate.textContent='Isolate selected component';isolate.disabled=groups.length!==1;isolate.onclick=()=>{scene.hiddenIds=new Set(asset.blocks.filter(b=>asset.parts[b.id]!==groups[0]).map(b=>b.id));changed();};visibility.append(isolate);
 if(selected.length)field(appearance,'Block color','color','#'+selected[0].color.slice(-6),v=>selected.forEach(b=>b.color=b.color.slice(0,2)+v.slice(1)));
 }
 if(['studio','showcase','export','calibration'].includes(category))body.propertyCleanup=mountStudio(content,scene.turretStudio,category);
 wireTabs(body.querySelector('nav'),content);wirePanels(content,node,'asset:'+category+':',!!query);
 for(const p of content.querySelectorAll('details')){p.hidden=!!query&&!p.textContent.toLowerCase().includes(query);if(query&&!p.hidden)p.open=true;}content.scrollTop=node.assetPropertyScroll[category]||0;
}

