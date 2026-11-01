import {mountStudio} from './studio.js';
import {icon} from '../icons.js';
import {PARTS,createInstance,partMatrices,pitchLimits,clampElevation} from './core.js';

export function assetPoseTransforms(asset){
 const instance=createInstance(asset.id,'origin','preview');
 Object.assign(instance,asset.editorPose||{});instance.turretSize=asset.sourceSize||1;
 const matrices=partMatrices(asset,{position:[0,0,0],rotation:[0,0,0]},instance);
 return new Map(asset.blocks.map(b=>[b.id,matrices[asset.parts[b.id]||'base']]));
}

export function mountAssetProperties(body,node,asset,scene,changed){
 body.innerHTML='<div class="property-layout"><nav class="property-tabs" aria-label="Properties categories"></nav><div class="property-content"></div></div>';
 const tab=document.createElement('button');tab.className='active';tab.title='Turret properties';tab.setAttribute('aria-label','Turret properties');tab.innerHTML=icon('turret');body.querySelector('nav').append(tab);
 const content=body.querySelector('.property-content');
 const title=document.createElement('div');title.className='property-breadcrumb';title.textContent=asset.name;content.append(title);
 function panel(name){const d=document.createElement('details');d.className='panel';d.open=true;const summary=document.createElement('summary');summary.textContent=name;d.append(summary);content.append(d);return d;}
 function field(host,label,type,value,action,attrs={}){const row=document.createElement('label');row.className='field-row';row.append(label);const input=document.createElement('input');Object.assign(input,{type,value,...attrs});input.setAttribute('aria-label',label);input.onchange=()=>{if(!input.checkValidity()||!input.value)return;input.onchange=null;action(type==='number'?Number(input.value):input.value);changed();};row.append(input);host.append(row);}
 const pose=panel('Turret pose');asset.editorPose??={yaw:0,pitch:0};
 field(pose,'Body rotation','number',asset.editorPose.yaw,v=>{asset.editorPose.yaw=v;scene.turretStudio?.restart();},{min:-360,max:360,step:1});
 const limits=pitchLimits(asset);field(pose,'Barrel elevation','number',asset.editorPose.pitch,v=>{asset.editorPose.pitch=clampElevation(asset,v);scene.turretStudio?.restart();},{min:limits.min,max:limits.max,step:1});
 const reset=document.createElement('button');reset.className='setting-button';reset.textContent='Neutral pose';reset.onclick=()=>{asset.editorPose={yaw:0,pitch:0};scene.turretStudio?.restart();changed();};pose.append(reset);
 const guides=panel('Guides');asset.editorGuides??={axes:false,muzzles:false};
 for(const [key,label] of [['axes','Show rotation axes'],['muzzles','Show muzzle positions']]){const row=document.createElement('label');row.className='check-row';const input=document.createElement('input');input.type='checkbox';input.checked=!!asset.editorGuides[key];input.setAttribute('aria-label',label);input.onchange=()=>{asset.editorGuides[key]=input.checked;changed();};row.append(input,label);guides.append(row);}
 const legend=document.createElement('p');legend.className='panel-note';legend.textContent='Violet: body rotation (yaw) axis. Yellow: barrel elevation (pitch) axis. Dashed lines with a ring are rotation axes, not world axes. Cyan: muzzle positions.';guides.append(legend);
 if(!(asset.muzzlePositions?.length||asset.muzzles?.length)){const note=document.createElement('p');note.className='panel-note';note.textContent='No muzzle positions are defined for this asset.';guides.append(note);}
 const parts=panel('Components');
 for(const part of PARTS){const b=document.createElement('button');b.className='setting-button';b.textContent='Select '+part;b.onclick=()=>{scene.selectedIds=new Set(asset.blocks.filter(b=>asset.parts[b.id]===part).map(b=>b.id));scene.selectedId=[...scene.selectedIds][0]||null;scene.selected=!!scene.selectedIds.size;changed();};parts.append(b);}
 const selected=asset.blocks.filter(b=>scene.selectedIds.has(b.id));const appearance=panel('Block appearance');
 const note=document.createElement('p');note.className='panel-note';note.textContent=selected.length+' selected blocks';appearance.append(note);
 if(selected.length)field(appearance,'Block color','color','#'+selected[0].color.slice(-6),v=>selected.forEach(b=>b.color=b.color.slice(0,2)+v.slice(1)));
 mountStudio(content,scene.turretStudio);
 const query=(node.propertySearch||'').trim().toLowerCase();for(const p of content.querySelectorAll('details'))p.hidden=!!query&&!p.textContent.toLowerCase().includes(query);
}

