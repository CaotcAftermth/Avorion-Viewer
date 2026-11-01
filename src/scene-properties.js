import {liveBlocks,viewportHiddenIds,isThinBlock} from './ship-structure.js';
export function modelSummary(scene,view){
 const blocks=liveBlocks(scene),hidden=viewportHiddenIds(scene,view||{});
 const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const b of blocks)for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],b.position[axis]-Math.abs(b.size[axis])/2);max[axis]=Math.max(max[axis],b.position[axis]+Math.abs(b.size[axis])/2);}
 return {name:scene.loaded?(scene.model?.doc?.documentElement.getAttribute('name')||scene.model?.fileName||'Ship'):'No model loaded',total:blocks.length,visible:scene.visible?blocks.filter(b=>!hidden.has(b.id)).length:0,engines:blocks.filter(b=>b.typeIndex===3).length,thin:blocks.filter(isThinBlock).length,dimensions:['x','y','z'].map(a=>blocks.length?max[a]-min[a]:0)};
}
export function mountSceneProperties(host,scene,{getView,preferences,capture,textureStatus}){
 host.classList.add('scene-properties');
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const panel=title=>{const p=el('details');p.className='panel';p.open=true;p.append(el('summary',title));host.append(p);return p;};
 const row=(p,label,value)=>{const r=el('div');r.className='field-row';r.append(el('span',label),value);p.append(r);};
 const crumb=el('div','Scene');crumb.className='property-breadcrumb';host.append(crumb);const engine=panel('Engine State'),select=el('select');select.setAttribute('aria-label','Scene engine state');
 for(const [value,label] of [[0,'Idle'],[1,'Cruise'],[2,'Boost']])select.add(new Option(label,value));
 select.onchange=()=>preferences.set('shaderEngineState',Number(select.value));row(engine,'Engine State',select);
 const note=el('p');note.className='panel-note';engine.append(note);
 const summary=panel('Model Summary'),values={};
 for(const [key,label] of [['name','Ship'],['total','Total blocks'],['visible','Visible blocks'],['engines','Engine blocks'],['thin','Thin / zero-thickness blocks'],['blocks','Dimensions (blocks)'],['meters','Dimensions (meters)']]){values[key]=el('span');values[key].dataset.summary=key;row(summary,label,values[key]);}
 const units=el('p','Dimensions cover the full live model: X width, Y height, Z length. 1 block = 10 m. Visible count follows the last active viewport.');units.className='panel-note';summary.append(units);
 const texture=el('p',textureStatus);texture.className='panel-note';summary.append(texture);
 const cap=panel('Capture'),buttons=[];
 for(const [label,type] of [['Image Export','viewport'],['Turntable GIF','turntable']]){const b=el('button',label);b.type='button';b.className='setting-button';b.onclick=()=>capture(type);cap.append(b);buttons.push(b);}
 const explanation=el('p','Capture uses the last active 3D viewport and current scene settings.');explanation.className='panel-note';cap.append(explanation);
 host.refresh=()=>{const view=getView(),s=modelSummary(scene,view),format=v=>Number(v.toFixed(2)).toLocaleString();
 select.value=preferences.value.shaderEngineState;note.textContent=view?.display?.shading==='RENDERED'?'Shared with Preferences > Shader.':'Plumes require Rendered shading. Shared with Preferences > Shader.';
 for(const key of ['name','total','visible','engines','thin'])values[key].textContent=s[key];
 values.blocks.textContent=s.dimensions.map(format).join(' x ');values.meters.textContent=s.dimensions.map(v=>format(v*10)).join(' x ');
 for(const b of buttons)b.disabled=!scene.loaded||!s.total||!view;
 };host.refresh();
}
