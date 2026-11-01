import {parseAvorionXml} from '../../src/block-model.js';
import {PARTS,demoProject,importTurretXml,plainBlocks,createInstance,socketAtFace,validateProject,readProject,writeProject,upgradeProject,componentEnvelope,componentBounds,pitchLimits,clampElevation} from './core.js';
import {createLabViewport} from './viewport.js';
import {loadLocal,saveLocal} from './storage.js';
const $=s=>document.querySelector(s),el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
let project,assetId,socketId,instanceId,face,saveTimer;
for(const node of document.querySelectorAll('header,main'))node.inert=true;
const status=(text,error=false)=>{$('#status').textContent=text;$('#status').dataset.error=String(error);};
const activeAsset=()=>project.assets.find(a=>a.id===assetId),activeSocket=()=>project.sockets.find(s=>s.id===socketId),activeCopy=()=>project.instances.find(i=>i.id===instanceId);
const id=()=>crypto.randomUUID();
const viewport=createLabViewport($('canvas'),value=>{instanceId=value;const copy=activeCopy();assetId=copy.assetId;socketId=copy.socketId;refresh();},(position,normal)=>{face={position,normal};$('#face').disabled=false;status('Hull face selected. Create a socket to attach a turret here.');});
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveLocal(project).then(()=>{$('body').dataset.saved='true';}).catch(e=>status('Local save failed. Use Save project to keep a file. '+e.message,true));},180);}
function edit(change,{geometry=false,fit=false,message='Updated. Project saves locally.'}={}){
  try{const draft=structuredClone(project);change(draft);validateProject(draft);project=draft;$('body').dataset.saved='false';refresh(geometry);if(fit)viewport.fit();persist();status(message);}catch(e){status(e.message,true);refresh();}
}
function download(blob,name){if(!blob)throw Error('Image encoding failed.');const link=el('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),10000);}
function options(selector,items,value){const select=$(selector);select.replaceChildren();for(const item of items)select.add(new Option(item.name,item.id));select.value=value||'';}
function field(parent,label,value,change,{type='number',min,max,step='any'}={}){
  const row=el('label'),input=el('input');row.className='field';row.append(el('span',label),input);input.type=type;input.setAttribute('aria-label',label);if(type==='checkbox')input.checked=!!value;else input.value=value??'';
  if(type==='number'){input.step=step;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;}if(type==='text')input.maxLength=200;
  input.onchange=()=>{if(!input.checkValidity()||(type==='number'&&!input.value)){input.reportValidity();return;}change(type==='number'?Number(input.value):type==='checkbox'?input.checked:input.value);};parent.append(row);return input;
}
function vectorFields(parent,label,values,change){
  const group=el('fieldset'),row=el('div');group.append(el('legend',label),row);row.className='vector';
  values.forEach((value,i)=>{const axis=['X','Y','Z'][i],labelNode=el('label',axis),input=el('input');input.type='number';input.step='any';input.value=value;input.setAttribute('aria-label',label+' '+axis);input.onchange=()=>{if(input.value&&input.checkValidity()){const next=[...values];next[i]=Number(input.value);change(next);}};labelNode.append(input);row.append(labelNode);});parent.append(group);
}
function sizeSelect(parent,label,value,change,disabled=false){
  const row=el('label'),select=el('select');row.className='field';row.append(el('span',label),select);select.setAttribute('aria-label',label);select.add(new Option('Unspecified',''));for(let size=.5;size<=10;size+=.5)select.add(new Option(String(size),String(size)));select.value=value??'';select.disabled=disabled;select.onchange=()=>change(select.value?Number(select.value):null);parent.append(row);
}
function refresh(invalidate=false){
  assetId=project.assets.some(a=>a.id===assetId)?assetId:project.assets[0]?.id;socketId=project.sockets.some(s=>s.id===socketId)?socketId:project.sockets[0]?.id;instanceId=project.instances.some(i=>i.id===instanceId)?instanceId:project.instances[0]?.id;
  options('#assets',project.assets,assetId);options('#sockets',project.sockets.map(s=>({...s,name:s.name+(project.instances.some(i=>i.socketId===s.id)?' · occupied':' · empty')})),socketId);options('#instances',project.instances,instanceId);
  const a=activeAsset(),s=activeSocket(),copy=activeCopy();
  for(const selector of ['#asset-fields','#rig-fields','#socket-fields','#instance-fields'])$(selector).replaceChildren();
  const selectedBlocks=new Set([...$('#blocks').selectedOptions].map(o=>o.value));$('#blocks').replaceChildren();
  if(a){
    const changeAsset=fn=>edit(p=>fn(p.assets.find(a=>a.id===assetId)));
    field($('#asset-fields'),'Design name',a.name,value=>changeAsset(a=>a.name=value),{type:'text'});
    sizeSelect($('#asset-fields'),'Source turret size',a.sourceSize,value=>edit(p=>{p.assets.find(a=>a.id===assetId).sourceSize=value;for(const i of p.instances.filter(i=>i.assetId===assetId)){if(value===null)i.turretSize=null;else i.turretSize??=value;}}));
    $('#asset-fields').append(el('p',a.sourceSize?'Source size describes the imported geometry before per-copy scaling.':'Source size is not recorded in this XML. Set it only when known; geometry is currently unscaled.'));
    const report=el('div');report.className='component-report';
    for(const part of PARTS){const bounds=componentBounds(a,part),actual=bounds?['x','y','z'].map(k=>bounds.size[k]):null,limit=a.sourceSize?componentEnvelope(part,a.sourceSize):null;report.append(el('p',`${part[0].toUpperCase()+part.slice(1)}: ${actual?actual.map(v=>v.toFixed(3)).join(' × '):'No blocks'}${limit?' | envelope '+limit.join(' × ')+(actual&&actual.some((v,i)=>v>limit[i]+1e-5)?' · exceeds envelope':''):''}`));}
    $('#asset-fields').append(report);if(a.native)$('#asset-fields').append(el('p',`Native turret: automatic component assignments; ${a.muzzlePositions.length} explicit muzzle points (cyan). Imported offsets seed editable rotation points. Rotation hierarchy confirmed against in-game references. Positive elevation aims upward; default pitch limits are -15° / +90°.`));
    for(const [label,key,property] of [['Attachment position','attachment','position'],['Attachment rotation (deg)','attachment','rotation'],['Body Rotation Point','yaw','position'],['Body rotation axis','yaw','axis'],['Barrel Rotation Point','pitch','position'],['Barrel rotation axis','pitch','axis']])vectorFields($('#rig-fields'),label,a[key][property],value=>changeAsset(a=>a[key][property]=value));
    for(const [label,key,min,max] of [['Lower pitch limit (deg)','min',-90,0],['Upper pitch limit (deg)','max',0,90]])field($('#rig-fields'),label,pitchLimits(a)[key],value=>edit(p=>{
      const design=p.assets.find(a=>a.id===assetId);design.pitch.limits={...pitchLimits(design),[key]:value};
      for(const instance of p.instances.filter(i=>i.assetId===assetId))instance.pitch=clampElevation(design,instance.pitch);
    }),{min,max});
    for(const b of a.blocks){const option=new Option(`${b.id} · ${a.parts[b.id]}${a.muzzles.includes(b.id)?' / muzzle':''} · ${b.type}`,b.id);option.selected=selectedBlocks.has(b.id);$('#blocks').add(option);}
  }
  if(s){
    const changeSocket=fn=>edit(p=>fn(p.sockets.find(s=>s.id===socketId)));
    field($('#socket-fields'),'Socket name',s.name,value=>changeSocket(s=>s.name=value),{type:'text'});
    vectorFields($('#socket-fields'),'Socket position',s.position,value=>changeSocket(s=>s.position=value));vectorFields($('#socket-fields'),'Socket rotation (deg)',s.rotation,value=>changeSocket(s=>s.rotation=value));
  }
  $('#attach').disabled=!a||!s||project.instances.some(i=>i.socketId===socketId);
  $('#lower').disabled=$('#upper').disabled=$('#neutral').disabled=$('#detach').disabled=$('#frame-copy').disabled=!copy;
  if(copy){
    const changeCopy=fn=>edit(p=>fn(p.instances.find(i=>i.id===instanceId)));
    field($('#instance-fields'),'Copy name',copy.name,value=>changeCopy(i=>i.name=value),{type:'text'});
    const source=project.assets.find(a=>a.id===copy.assetId);
    sizeSelect($('#instance-fields'),'Turret Size',copy.turretSize,value=>changeCopy(i=>i.turretSize=value),!source.sourceSize);
    for(const [label,key,value,min,max] of [['Viewer scale (%)','scale',copy.scale*100,1,10000],['Mount twist (deg)','twist',copy.twist,-360,360],['Body rotation (deg)','yaw',copy.yaw,-180,180],['Barrel elevation (deg)','pitch',copy.pitch,pitchLimits(source).min,pitchLimits(source).max]])field($('#instance-fields'),label,value,v=>changeCopy(i=>i[key]=key==='scale'?v/100:v),{min,max});
    for(const part of PARTS){field($('#instance-fields'),'Override '+part+' color',!!copy.colors[part],enabled=>changeCopy(i=>{if(enabled)i.colors[part]='#86bcdf';else delete i.colors[part];}),{type:'checkbox'});if(copy.colors[part])field($('#instance-fields'),part+' color',copy.colors[part],value=>changeCopy(i=>i.colors[part]=value),{type:'color'});}
  }
  viewport.sync(project,instanceId,{assetId,only:$('#design-only').checked,helpers:$('#guides').checked,envelopes:$('#envelopes').checked,invalidate});
}
$('#assets').onchange=e=>{assetId=e.target.value;$('#blocks').selectedIndex=-1;refresh();};
$('#sockets').onchange=e=>{socketId=e.target.value;const existing=project.instances.find(i=>i.socketId===socketId);if(existing){instanceId=existing.id;assetId=existing.assetId;}refresh();};
$('#instances').onchange=e=>{instanceId=e.target.value;const i=activeCopy();if(i){assetId=i.assetId;socketId=i.socketId;}refresh();};
$('#assign').onclick=()=>{const ids=[...$('#blocks').selectedOptions].map(o=>o.value);if(!ids.length){status('Select one or more design blocks first.',true);return;}edit(p=>{const a=p.assets.find(a=>a.id===assetId);for(const id of ids)a.parts[id]=$('#part').value;a.muzzles=a.muzzles.filter(id=>a.parts[id]==='barrel');},{geometry:true,message:'Part assignment updated for all copies of this design.'});};
function selectedBlockIds(){return [...$('#blocks').selectedOptions].map(o=>o.value);}
$('#muzzles').onclick=()=>{const ids=selectedBlockIds();if(!ids.length){status('Select barrel blocks to assign as muzzles.',true);return;}edit(p=>{const a=p.assets.find(a=>a.id===assetId);if(ids.some(id=>a.parts[id]!=='barrel'))throw Error('Assign selected blocks to Barrel before marking them as muzzles.');a.muzzles=[...new Set([...a.muzzles,...ids])];});};
$('#unmark-muzzles').onclick=()=>{const ids=new Set(selectedBlockIds());edit(p=>{const a=p.assets.find(a=>a.id===assetId);a.muzzles=a.muzzles.filter(id=>!ids.has(id));});};
for(const [button,key,part] of [['body-point','yaw','body'],['barrel-point','pitch','barrel']])$('#'+button).onclick=()=>{const ids=new Set(selectedBlockIds()),a=activeAsset(),blocks=a.blocks.filter(b=>ids.has(b.id));if(blocks.length!==1||a.parts[blocks[0].id]!==part){status(`Select exactly one ${part} block to use its center as the rotation point.`,true);return;}const position=['x','y','z'].map(k=>blocks[0].position[k]);edit(p=>{p.assets.find(a=>a.id===assetId)[key].position=position;});};
$('#attach').onclick=()=>edit(p=>{const next=createInstance(assetId,socketId,id());next.turretSize=activeAsset().sourceSize;next.name=activeAsset().name+' '+(p.instances.length+1);p.instances.push(next);instanceId=next.id;});
$('#face').onclick=()=>{if(!face)return;edit(p=>{const next=socketAtFace(face.position,face.normal,id());p.sockets.push(next);socketId=next.id;});face=null;$('#face').disabled=true;};
$('#detach').onclick=()=>edit(p=>p.instances=p.instances.filter(i=>i.id!==instanceId));
for(const [button,key] of [['lower','min'],['upper','max']])$('#'+button).onclick=()=>edit(p=>{const i=p.instances.find(i=>i.id===instanceId);i.pitch=pitchLimits(p.assets.find(a=>a.id===i.assetId))[key];});
$('#neutral').onclick=()=>edit(p=>{const i=p.instances.find(i=>i.id===instanceId);i.yaw=i.pitch=0;});
$('#frame').onclick=()=>viewport.fit();$('#frame-copy').onclick=()=>viewport.fit($('#design-only').checked?undefined:instanceId);
for(const tool of ['orbit','pan'])$('#'+tool).onclick=()=>{viewport.setTool(tool);for(const t of ['orbit','pan'])$('#'+t).setAttribute('aria-pressed',String(t===tool));};
$('#guides').onchange=()=>refresh();$('#envelopes').onchange=()=>refresh();$('#design-only').onchange=()=>{refresh();viewport.fit();};
$('#save').onclick=()=>{try{download(new Blob([writeProject(project)],{type:'application/json'}),'turret-lab-project.json');status('Project saved: source designs, joints, sockets, poses and color overrides.');}catch(e){status(e.message,true);}};
$('#png').onclick=async()=>{try{download(await viewport.png(),'turret-lab.png');status('PNG exported without editing guides.');}catch(e){status(e.message,true);}};
$('#stl').onclick=()=>{try{download(viewport.stl(),'turret-lab-posed.stl');status('Posed mesh exported. STL contains geometry only; colors and joints remain in the project file.');}catch(e){status(e.message,true);}};
function fileInput(selector,accept){$(selector).onchange=async e=>{const file=e.target.files[0];try{if(file){if(file.size>100*1024*1024)throw Error('Lab import limit: 100 MB.');await accept(await file.text(),file.name);}}catch(error){status(error.message,true);}finally{e.target.value='';}};}
fileInput('#import',(text,name)=>{const asset=importTurretXml(text,name,id());edit(p=>{p.assets.push(asset);assetId=asset.id;},{geometry:true,message:asset.native?'Native turret imported: components, size, offsets and muzzle points loaded. Rotation behavior remains provisional.':'Design imported. Use Design view to define its attachment, part assignments and joint pivots.'});$('#design-only').checked=true;refresh();viewport.fit();});
fileInput('#ship',(text,name)=>{const model=parseAvorionXml(text,name,text.length);edit(p=>{p.ship={name,blocks:plainBlocks(model)};p.sockets=[];p.instances=[];},{geometry:true,fit:true,message:'Ship imported. Previous test mounts were cleared; click hull faces to create sockets.'});});
fileInput('#open',text=>{const next=readProject(text);project=next;assetId=socketId=instanceId=null;face=null;$('#face').disabled=true;$('#design-only').checked=false;refresh(true);viewport.fit();persist();status('Project opened.');});
$('#demo').onclick=()=>{project=demoProject();assetId=socketId=instanceId=null;face=null;$('#face').disabled=true;$('#design-only').checked=false;refresh(true);viewport.fit();persist();status('Demo reset: four differently oriented mounts.');};
try{const stored=await loadLocal();project=stored?upgradeProject(stored):demoProject();status(stored?'Local Turret Lab project restored.':'Demo ready. Select a turret or import a design.');}catch(error){project=demoProject();status('Could not restore local lab project. Demo loaded; original saved data was not changed. '+error.message,true);}
refresh(true);viewport.fit();for(const node of document.querySelectorAll('header,main'))node.inert=false;$('body').dataset.ready='true';
// Read-only diagnostic snapshots allow tests to inspect the same model exported by the UI.
window.turretLabSnapshot=()=>structuredClone(project);
