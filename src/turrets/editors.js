import {mounts,editTurrets,selectTurrets,removeTurret,copyTurretPose} from './mounts.js';
import {pitchLimits} from './core.js';
export function mountPoseEditor(host,scene,changed,sockets=[]){
 const m=mounts(scene).find(m=>m.id===scene.selectedTurretId);if(!m)return;
 const panel=document.createElement('details');panel.className='panel';panel.open=true;panel.innerHTML='<summary>Transform &amp; Pose</summary>';host.append(panel);
 const ids=()=>scene.selectedTurretIds?.size?[...scene.selectedTurretIds]:[m.id];
 const limits=pitchLimits(m.asset),yaw=m.yaw>=-180&&m.yaw<=180?m.yaw:((m.yaw+180)%360+360)%360-180;
 for(const [key,label,min,max,value] of [['yaw','Body rotation',-180,180,yaw],['pitch','Barrel elevation',limits.min,limits.max,m.pitch]]){
  const row=document.createElement('label');row.className='field-row';row.textContent=label;
  const input=document.createElement('input');Object.assign(input,{type:'number',min,max,step:'any',value});
  Object.assign(input.dataset,{default:'0',precision:'2',sensitivity:'.5',mixed:String(mounts(scene).some(t=>ids().includes(t.id)&&t[key]!==m[key]))});
  input.setAttribute('aria-label',label);
  input.onchange=()=>{if(!input.checkValidity()||input.value===''){input.value=value;return;}editTurrets(scene,ids(),{[key]:Number(input.value)});changed();};
  row.append(input);panel.append(row);
 }
 const row=document.createElement('div');row.className='field-row';
 const label=document.createElement('span');label.textContent='Turret size';
 const stepper=document.createElement('div');stepper.className='turret-size-stepper';
 const input=document.createElement('input');
 const socketLimits=new Map(sockets.map(s=>[s.id,s.fitSize]));
 const max=mounts(scene).filter(t=>ids().includes(t.id)).reduce((limit,t)=>{
  const fit=socketLimits.get(t.socketId);return fit==null?limit:Math.min(limit,Math.floor(fit*2)/2);
 },10);
 Object.assign(input,{type:'number',min:.5,max,step:.5,value:m.turretSize});
 input.dataset.stepper='';input.setAttribute('aria-label','Turret size');
 const apply=value=>{
  if(!Number.isFinite(value)||value<.5||value>max||value*2%1){input.value=m.turretSize;return;}
  editTurrets(scene,ids(),{turretSize:value});changed();
 };
 input.onchange=()=>apply(input.valueAsNumber);
 const arrow=(text,name,direction)=>{
  const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',name);
  button.disabled=direction<0?m.turretSize<=.5:m.turretSize>=max;
  button.onclick=()=>apply(Math.min(max,m.turretSize+direction*.5));return button;
 };
 stepper.append(arrow('‹','Decrease turret size',-1),input,arrow('›','Increase turret size',1));
 row.append(label,stepper);panel.append(row);
 const presets=document.createElement('div');presets.className='property-actions';panel.append(presets);const clipboard=document.createElement('div');clipboard.className='property-actions';
 for(const [label,action] of [['Lower',()=>editTurrets(scene,ids(),{pitch:-Infinity})],['Neutral',()=>editTurrets(scene,ids(),{yaw:0,pitch:0})],['Upper',()=>{}],['Reset pose',()=>editTurrets(scene,ids(),{twist:0,yaw:0,pitch:0})],['Copy pose and size',()=>copyTurretPose(scene)],['Paste pose and size',()=>{if(scene.turretClipboard)editTurrets(scene,ids(),scene.turretClipboard);} ]]){
  const b=document.createElement('button');b.className='setting-button';b.textContent=label;b.disabled=label==='Paste pose and size'&&!scene.turretClipboard;b.onclick=()=>{if(label==='Lower'||label==='Upper')editTurrets(scene,ids(),{pitch:label==='Lower'?-1e9:1e9});else action();changed();};if(['Lower','Neutral','Upper'].includes(label))presets.append(b);else if(label.includes('pose and size'))clipboard.append(b);else panel.append(b);
 }
 panel.append(clipboard);
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
