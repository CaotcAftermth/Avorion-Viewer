import {numericEditing} from '../numeric-field.js';
// "Camera keys" panel: capture viewport poses at timeline times and edit the resulting path.
import {KEYED_CAMERA,KEY_ANCHORS,KEY_EASES,EVENT_FLAGS,captureKey,poseFromView,upsertKey,normalizeKeys,normalizeEvents,reanchorKey,sequenceDuration,newKeyId,fovFromFocal,validateKey,MAX_KEY_TIME} from './camera-keys.js';
import {evaluateCamera,showcaseAt} from './showcase.js';

const fmt=t=>t.toFixed(2)+' s';

/** Bakes the current preset sequence into editable world-anchored keys and events. */
export function keysFromPreset(runtime,show){
 const duration=show.duration||18,kind=runtime.effects.profile?.kind,transition=show.transition||1.2,times=new Set([0,duration]);
 const preset={...show,camera:show.presetCamera&&show.presetCamera!=='manual'&&show.presetCamera!==KEYED_CAMERA?show.presetCamera:'orbit',sequence:true};
 const starts=[];let previous=null;for(let t=0;t<=duration+1e-9;t+=1/30){const p=showcaseAt(t,preset,kind);if(p.name!==previous){starts.push({time:t,phase:p});previous=p.name;}}
 for(const [i,{time}] of starts.entries()){const end=starts[i+1]?.time??duration;times.add(time);times.add(Math.min(end,time+transition));times.add((time+end)/2);}
 // Orbit phases need extra samples or the arc collapses to a chord.
 for(const [i,{time,phase}] of starts.entries())if(phase.camera==='orbit'){const end=starts[i+1]?.time??duration;for(let t=time;t<end;t+=Math.max(.5,(end-time)/8))times.add(t);}
 const keys=[],events=[],saved={camera:show.camera,sequence:show.sequence};
 // Simulate under the preset's own fire/track/target flags so follow cameras see the right projectiles.
 show.camera=preset.camera;show.sequence=true;
 try{for(const time of [...new Set([...times].map(t=>Math.round(t*120)/120))].filter(t=>t>=0&&t<=Math.min(duration,MAX_KEY_TIME)).sort((a,b)=>a-b)){runtime.seek(time);const c=evaluateCamera(time,runtime.asset,runtime,preset);keys.push(validateKey({id:newKeyId(),time,anchor:'world',ease:'linear',target:c.target,yaw:c.yaw,pitch:c.pitch,roll:c.roll||0,distance:10/c.zoom,fov:fovFromFocal(c.focalLength),panX:c.panX||0,panY:c.panY||0}));}}finally{show.camera=saved.camera;show.sequence=saved.sequence;}
 for(const {time,phase} of starts)events.push({id:newKeyId(),time:Math.round(time*120)/120,fire:phase.fire,track:phase.track,target:phase.target});
 return {keys:normalizeKeys(keys),events:normalizeEvents(events)};
}

export function mountCameraKeys(parent,runtime,{onModeChange=()=>{}}={}){
 const show=runtime.settings.showcase;show.keys=normalizeKeys(show.keys||[]);show.events=normalizeEvents(show.events||[]);show.keysVersion=1;
 const d=document.createElement('details');d.className='panel camera-keys';d.innerHTML='<summary>Camera Keyframes</summary><p class="panel-note">Frame the viewport, seek to a time, then add a key. With Camera preset set to camera keys, playback and exports follow the path through your keys. Moving the view while paused does not change keys until you press Update or Add.</p>';parent.append(d);
 const status=document.createElement('p');status.className='panel-note';status.setAttribute('role','status');
 const view=()=>runtime.context?.().view;
 const row=(label,input)=>{const r=document.createElement('label');r.className='field-row';r.append(label,input);return r;};
 const select=(values,value,label)=>{const s=document.createElement('select');s.setAttribute('aria-label',label);for(const v of values)s.add(new Option(v,v));s.value=value;return s;};
 const button=(host,text,action,label)=>{const b=document.createElement('button');b.className='setting-button';b.textContent=text;if(label)b.setAttribute('aria-label',label);b.onclick=()=>{try{action();}catch(e){status.textContent=e.message;}};host.append(b);return b;};
 const anchor=select(KEY_ANCHORS,show.newKeyAnchor||'world','New key anchor');anchor.onchange=()=>show.newKeyAnchor=anchor.value;
 const ease=select(KEY_EASES,show.newKeyEase||'smooth','New key ease');ease.onchange=()=>show.newKeyEase=ease.value;
 d.append(row('New key anchor',anchor),row('New key ease',ease));
 const actions=document.createElement('div');d.append(actions);
 const useKeys=()=>{if(show.camera!==KEYED_CAMERA){show.presetCamera=show.camera;runtime.setCamera(KEYED_CAMERA);onModeChange(KEYED_CAMERA);}};
 const present=()=>{runtime.followKeys?.();render();};
 button(actions,'Add key at current time',()=>{const v=view();if(!v)throw Error('Open a 3D viewport first.');const key=captureKey(v,runtime.clock.time,runtime,{anchor:anchor.value,ease:ease.value});show.keys=upsertKey(show.keys,key);runtime.selectedCameraKeyId=key.id;useKeys();present();status.textContent=`Key added at ${fmt(key.time)}.`;});
 button(actions,'Follow keys',()=>{if(!show.keys.length)throw Error('Add a camera key first.');useKeys();present();},'Return the view to the keyed camera path');
 button(actions,'Fill from preset sequence',()=>{if(show.keys.length&&!confirm('Replace existing camera keys and events with the preset sequence?'))return;const at=runtime.clock.time,baked=keysFromPreset(runtime,show);show.keys=baked.keys;show.events=baked.events;useKeys();runtime.seek(Math.min(at,sequenceDuration(show)));render();status.textContent=`${baked.keys.length} keys and ${baked.events.length} events created from the preset sequence.`;});
 button(actions,'Clear keys',()=>{if(!show.keys.length&&!show.events.length)return;if(!confirm('Delete all camera keys and events?'))return;show.keys=[];show.events=[];if(show.camera===KEYED_CAMERA){runtime.setCamera('manual');onModeChange('manual');}render();});
 const strip=document.createElement('div');strip.className='camera-key-strip';strip.style.cssText='position:relative;height:18px;margin:8px 0;background:#2a2a2a;border:1px solid #1b1b1b;border-radius:3px';strip.setAttribute('aria-label','Camera key timeline');d.append(strip);
 const list=document.createElement('div');list.className='camera-key-list';d.append(list);
 const eventsBox=document.createElement('details');eventsBox.className='panel';eventsBox.dataset.timedEvents='';eventsBox.innerHTML='<summary>Timed Events</summary><p class="panel-note">Switch firing, tracking and the target marker on or off at set times while camera keys are active. Unset values use the normal Studio settings.</p>';d.append(eventsBox);
 const eventList=document.createElement('div');eventsBox.append(eventList);
 button(eventsBox,'Add event at current time',()=>{show.events=normalizeEvents([...show.events,{id:newKeyId(),time:runtime.clock.time,fire:true}]);rebuild();render();});
 d.append(status);
 // Events change the simulation, so rebuild state at the current time without restarting playback position.
 const rebuild=()=>{if(show.camera===KEYED_CAMERA)runtime.seek(runtime.clock.time);};
 function render(){
  if(numericEditing())return;
  if(!show.keys.some(k=>k.id===runtime.selectedCameraKeyId))runtime.selectedCameraKeyId=show.keys[0]?.id;
  const total=sequenceDuration({...show,camera:KEYED_CAMERA});strip.replaceChildren();
  for(const key of show.keys){const m=document.createElement('button');m.title=`Jump to key at ${fmt(key.time)}`;m.setAttribute('aria-label',m.title);m.style.cssText=`position:absolute;top:1px;width:10px;height:14px;padding:0;margin-left:-5px;background:#e9a15b;border-radius:2px;left:${(key.time/total*100).toFixed(3)}%`;m.onclick=()=>{runtime.selectedCameraKeyId=key.id;useKeys();runtime.seek(key.time);render();};strip.append(m);}
  const head=document.createElement('div');head.style.cssText=`position:absolute;top:0;bottom:0;width:2px;background:#82b5e4;pointer-events:none;left:${Math.min(100,runtime.clock.time/total*100).toFixed(3)}%`;strip.append(head);
  list.replaceChildren();if(!show.keys.length){const p=document.createElement('p');p.className='panel-note';p.textContent='No camera keys yet.';list.append(p);}
  show.keys.forEach((key,index)=>{
   const choose=document.createElement('button');choose.className='setting-button';choose.textContent=`Key ${index+1} · ${fmt(key.time)}`;choose.setAttribute('aria-pressed',String(runtime.selectedCameraKeyId===key.id));choose.onclick=()=>{runtime.selectedCameraKeyId=key.id;render();};list.append(choose);
   if(runtime.selectedCameraKeyId!==key.id)return;
   const r=document.createElement('div');r.className='camera-key-row selected-key-details';r.style.cssText='display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:4px 0;border-top:1px solid #2a2a2a';
   const label=document.createElement('span');label.textContent=`Key ${index+1}`;label.style.cssText='font-size:11px;min-width:42px';
   const time=document.createElement('input');Object.assign(time,{type:"number",min:0,max:MAX_KEY_TIME,step:1/30,value:key.time});time.style.width='70px';time.setAttribute('aria-label',`Key ${index+1} time (seconds)`);time.onchange=()=>{const v=Number(time.value);if(!Number.isFinite(v)||v<0||v>MAX_KEY_TIME){time.setCustomValidity(`0–${MAX_KEY_TIME} seconds`);time.reportValidity();return;}show.keys=upsertKey(show.keys,{...key,time:v});present();};
   const a=select(KEY_ANCHORS,key.anchor,`Key ${index+1} anchor`);a.onchange=()=>{const at=runtime.clock.time;runtime.seek(key.time);show.keys=upsertKey(show.keys,reanchorKey(key,a.value,runtime));runtime.seek(at);render();};
   const e=select(KEY_EASES,key.ease,`Key ${index+1} ease to next key`);e.onchange=()=>{show.keys=upsertKey(show.keys,{...key,ease:e.value});present();};
   r.append(label,time,a,e);
   button(r,'Jump',()=>{useKeys();runtime.seek(key.time);render();},`Jump to key ${index+1}`);
   button(r,'Update from view',()=>{const v=view();if(!v)throw Error('Open a 3D viewport first.');const pose=poseFromView(v),framed={...v,target:pose.target,yaw:pose.yaw,pitch:pose.pitch,roll:pose.roll,zoom:10/pose.distance,panX:pose.panX,panY:pose.panY,display:{...v.display}};runtime.seek(key.time);show.keys=upsertKey(show.keys,captureKey(framed,key.time,runtime,{anchor:key.anchor,ease:key.ease,id:key.id}));present();status.textContent=`Key ${index+1} updated.`;},`Update key ${index+1} from current view`);
   button(r,'Delete',()=>{show.keys=show.keys.filter(k=>k.id!==key.id);if(!show.keys.length&&show.camera===KEYED_CAMERA){runtime.setCamera('manual');onModeChange('manual');}present();},`Delete key ${index+1}`);
   list.append(r);
  });
  eventList.replaceChildren();
  show.events.forEach((event,index)=>{
   const r=document.createElement('div');r.style.cssText='display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:4px 0;border-top:1px solid #2a2a2a';
   const time=document.createElement('input');Object.assign(time,{type:"number",min:0,max:MAX_KEY_TIME,step:1/30,value:event.time});time.style.width='70px';time.setAttribute('aria-label',`Event ${index+1} time (seconds)`);time.onchange=()=>{const v=Number(time.value);if(!Number.isFinite(v)||v<0||v>MAX_KEY_TIME)return;show.events=normalizeEvents(show.events.map(x=>x.id===event.id?{...x,time:v}:x));rebuild();render();};r.append(time);
   for(const flag of EVENT_FLAGS){const s=select(['unchanged','on','off'],flag in event?(event[flag]?'on':'off'):'unchanged',`Event ${index+1} ${flag}`);s.onchange=()=>{show.events=normalizeEvents(show.events.map(x=>{if(x.id!==event.id)return x;const y={...x};if(s.value==='unchanged')delete y[flag];else y[flag]=s.value==='on';return y;}));rebuild();render();};const l=document.createElement('label');l.style.fontSize='11px';l.append(flag+' ',s);r.append(l);}
   button(r,'Delete',()=>{show.events=show.events.filter(x=>x.id!==event.id);rebuild();render();},`Delete event ${index+1}`);
   eventList.append(r);
  });
 }
 const unsubscribe=runtime.subscribe(e=>{if(e.type==='timelineSeek'||e.type==='timelineReset')render();});
 d.addEventListener('numeric-commit',()=>render());eventsBox.addEventListener('numeric-commit',()=>render());
 render();return {render,dispose:unsubscribe};
}
