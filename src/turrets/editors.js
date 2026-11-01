import {mounts,editTurrets,selectTurrets,removeTurret,copyTurretPose} from './mounts.js';
import {pitchLimits} from './core.js';
export function mountPoseEditor(host,scene,changed){
 const m=mounts(scene).find(m=>m.id===scene.selectedTurretId);if(!m)return;
 const panel=document.createElement('details');panel.className='panel';panel.open=true;panel.innerHTML='<summary>Turret pose and size</summary>';host.append(panel);
 const ids=()=>scene.selectedTurretIds?.size?[...scene.selectedTurretIds]:[m.id];
 for(const [key,label,min,max,step] of [['twist','Mount rotation',-360,360,1],['yaw','Body rotation',-360,360,1],['pitch','Barrel elevation',pitchLimits(m.asset).min,pitchLimits(m.asset).max,1],['turretSize','Turret size',.5,10,.5]]){
  const row=document.createElement('label');row.className='field-row';row.textContent=label;const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=m[key];input.setAttribute('aria-label',label);input.onchange=()=>{if(!input.checkValidity()||!input.value){input.value=m[key];return;}editTurrets(scene,ids(),{[key]:Number(input.value)});changed();};row.append(input);panel.append(row);
 }
 for(const [label,action] of [['Lower',()=>editTurrets(scene,ids(),{pitch:-Infinity})],['Neutral',()=>editTurrets(scene,ids(),{yaw:0,pitch:0})],['Upper',()=>{}],['Reset pose',()=>editTurrets(scene,ids(),{twist:0,yaw:0,pitch:0})],['Copy pose and size',()=>copyTurretPose(scene)],['Paste pose and size',()=>{if(scene.turretClipboard)editTurrets(scene,ids(),scene.turretClipboard);} ]]){
  const b=document.createElement('button');b.className='setting-button';b.textContent=label;b.disabled=label==='Paste pose and size'&&!scene.turretClipboard;b.onclick=()=>{if(label==='Lower'||label==='Upper')editTurrets(scene,ids(),{pitch:label==='Lower'?-1e9:1e9});else action();changed();};panel.append(b);
 }
}
export function mountTurretOutliner(host,scene,changed){
 const section=document.createElement('div');host.append(section);
 function sync(){section.replaceChildren();if(!mounts(scene).length)return;const title=document.createElement('p');title.className='panel-note';title.textContent=(scene.model.fileName||'Ship')+' / Turrets';section.append(title);
 for(const m of mounts(scene)){const row=document.createElement('div');row.className='field-row';const choose=document.createElement('button');choose.textContent=m.name==='Mounted turret'?m.asset.name:m.name;choose.title=m.socketId;choose.classList.toggle('active',scene.selectedTurretIds?.has(m.id)||scene.selectedTurretId===m.id);choose.onclick=e=>{selectTurrets(scene,m.id,e.ctrlKey||e.metaKey||e.shiftKey);changed();};row.append(choose);
 const name=document.createElement('input');name.value=m.name;name.setAttribute('aria-label','Rename turret '+m.id);name.onchange=()=>{if(name.value.trim())editTurrets(scene,[m.id],{name:name.value.trim().slice(0,100)});changed();};row.append(name);
 for(const [label,action] of [[m.hidden?'Show':'Hide',()=>editTurrets(scene,[m.id],{hidden:!m.hidden})],['Detach',()=>removeTurret(scene,m.socketId)]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{action();changed();};row.append(b);}section.append(row);}}
 sync();return {sync,dispose(){section.remove();}};
}

export {mountCoverageControls as mountFireControls} from './coverage-ui.js';
