import {propertyDataRow,propertyPanel} from './property-ui.js';
import {liveBlocks,viewportHiddenIds,isThinBlock} from './ship-structure.js';
export function modelSummary(scene,view){
 const blocks=liveBlocks(scene),hidden=viewportHiddenIds(scene,view||{});
 const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const b of blocks)for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],b.position[axis]-Math.abs(b.size[axis])/2);max[axis]=Math.max(max[axis],b.position[axis]+Math.abs(b.size[axis])/2);}
 return {name:scene.loaded?(scene.model?.fileName||scene.model?.doc?.documentElement.getAttribute('name')||'Ship'):'No model loaded',total:blocks.length,visible:scene.visible?blocks.filter(b=>!hidden.has(b.id)).length:0,engines:blocks.filter(b=>b.typeIndex===3).length,thin:blocks.filter(isThinBlock).length,dimensions:['x','y','z'].map(a=>blocks.length?max[a]-min[a]:0)};
}
export function mountEngineState(host,view,preferences){
 const panel=propertyPanel(host,'Engine State',true);
 const row=document.createElement('label');row.className='field-row';row.textContent='Engine State';
 const select=document.createElement('select');select.dataset.engineState='';
 for(const [value,label] of [[0,'Idle'],[1,'Cruise'],[2,'Boost']])select.add(new Option(label,value));
 select.value=preferences.value.shaderEngineState;
 select.onchange=()=>preferences.set('shaderEngineState',Number(select.value));
 row.append(select);panel.append(row);
 if(view.display?.shading!=='RENDERED'){
  const note=document.createElement('p');note.className='panel-note';note.textContent='Plumes require Rendered shading.';panel.append(note);
 }
}
export function mountSceneProperties(host,scene,{getView,capture}){
 host.classList.add('scene-properties');
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const panel=title=>{const p=el('details');p.className='panel';p.open=true;p.append(el('summary',title));host.append(p);return p;};
 const crumb=el('div','Scene');crumb.className='property-breadcrumb';host.append(crumb);
 const summary=panel('Model Summary'),values={};
 for(const [key,label] of [['name','Ship'],['total','Total blocks'],['visible','Visible blocks'],['engines','Engine blocks'],['thin',['Thin /','zero-thickness','blocks']],['blocks',['Dimensions','(blocks)']],['meters',['Dimensions','(meters)']]]){values[key]=propertyDataRow(summary,label,'');values[key].dataset.summary=key;}
 const cap=panel('Capture'),buttons=[];
 for(const [label,type] of [['Image Export','viewport'],['Turntable GIF','turntable']]){const b=el('button',label);b.type='button';b.className='setting-button';b.onclick=()=>capture(type);cap.append(b);buttons.push(b);}
 const explanation=el('p','Capture uses the last active 3D viewport and current scene settings.');explanation.className='panel-note';cap.append(explanation);
 host.refresh=()=>{const view=getView(),s=modelSummary(scene,view),format=v=>Number(v.toFixed(2)).toLocaleString();
 for(const key of ['name','total','visible','engines','thin'])values[key].textContent=s[key];
 values.blocks.textContent=s.dimensions.map(format).join(' x ');values.meters.textContent=s.dimensions.map(v=>format(v*10)).join(' x ');
 for(const b of buttons)b.disabled=!scene.loaded||!s.total||!view;
 };host.refresh();
}
