// User-authored camera keys for Turret Studio showcases.
// Keys are captured from the viewport and evaluated as a pure function of
// simulation time, so interactive playback, seeking and every export format
// follow the same path.
import {nativeToView} from '../block-model.js';

export const KEYED_CAMERA='keyed';
export const KEY_ANCHORS=['world','turret','target'];
export const KEY_EASES=['smooth','linear','hold'];
export const KEYS_VERSION=1;
export const MAX_KEY_TIME=300;
export const MIN_KEY_GAP=1/120;
const BASE_DISTANCE=10,SENSOR=18;
const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clampPitch=p=>Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,p));

export const fovFromFocal=focal=>2*Math.atan(SENSOR/Math.max(1e-6,focal))*180/Math.PI;
export const focalFromFov=fov=>SENSOR/Math.tan(fov*Math.PI/360);

/** Anchor frame at the runtime's current simulation state: origin in view space and a heading about view Z. */
export function anchorFrame(anchor,runtime){
 if(anchor==='target'&&runtime?.target)return {origin:nativeToView(runtime.target),heading:0};
 if(anchor==='turret'&&runtime?.muzzles?.length){const m=runtime.muzzles[0],d=nativeToView(m.direction);return {origin:nativeToView(m.position),heading:Math.hypot(d[0],d[1])>1e-9?Math.atan2(d[1],d[0]):0};}
 return {origin:[0,0,0],heading:0};
}
const rotate=([x,y,z],a)=>{const c=Math.cos(a),s=Math.sin(a);return [x*c-y*s,x*s+y*c,z];};
const toWorld=(key,frame)=>({...key,target:rotate(key.target,frame.heading).map((v,i)=>v+frame.origin[i]),yaw:key.yaw+frame.heading});
const toLocal=(pose,frame)=>({...pose,target:rotate(pose.target.map((v,i)=>v-frame.origin[i]),-frame.heading),yaw:pose.yaw-frame.heading});

/** Reads a viewport camera into key pose fields (world space). */
export function poseFromView(view){
 const zoom=finite(view.zoom)&&view.zoom>0?view.zoom:1,focal=view.display?.focalLength;
 return {target:[...(view.target||[0,0,1])],yaw:view.yaw||0,pitch:view.pitch||0,roll:view.roll||0,distance:BASE_DISTANCE/zoom,fov:finite(focal)&&focal>0?fovFromFocal(focal):45,panX:view.panX||0,panY:view.panY||0};
}

/** Builds a key from the current viewport at the runtime's current time and pose. */
export function captureKey(view,time,runtime,{anchor='world',ease='smooth',id}={}){
 if(!KEY_ANCHORS.includes(anchor))throw Error('Unknown camera key anchor.');
 const local=toLocal(poseFromView(view),anchorFrame(anchor,runtime));
 return validateKey({id:id||newKeyId(),time,anchor,ease,...local});
}

let counter=0;
export const newKeyId=()=>`k${Date.now().toString(36)}${(counter++).toString(36)}`;

export function validateKey(key){
 if(!key||typeof key!=='object')throw Error('Camera key must be an object.');
 if(!finite(key.time)||key.time<0||key.time>MAX_KEY_TIME)throw Error(`Camera key time must be 0–${MAX_KEY_TIME} seconds.`);
 if(!Array.isArray(key.target)||key.target.length!==3||!key.target.every(finite))throw Error('Camera key target must be three finite numbers.');
 for(const k of ['yaw','pitch','roll','panX','panY'])if(key[k]!==undefined&&!finite(key[k]))throw Error(`Camera key ${k} must be finite.`);
 if(!finite(key.distance)||key.distance<=0)throw Error('Camera key distance must be positive.');
 if(!finite(key.fov)||key.fov<5||key.fov>120)throw Error('Camera key field of view must be 5–120 degrees.');
 return {id:String(key.id||newKeyId()),time:key.time,anchor:KEY_ANCHORS.includes(key.anchor)?key.anchor:'world',ease:KEY_EASES.includes(key.ease)?key.ease:'smooth',target:[...key.target],yaw:key.yaw||0,pitch:clampPitch(key.pitch||0),roll:key.roll||0,distance:key.distance,fov:key.fov,panX:key.panX||0,panY:key.panY||0};
}

/** Sorted copy; keys sharing a time are nudged later by one simulation step. */
export function normalizeKeys(keys=[]){
 const sorted=keys.map(validateKey).sort((a,b)=>a.time-b.time);
 for(let i=1;i<sorted.length;i++)if(sorted[i].time<sorted[i-1].time+MIN_KEY_GAP-1e-9)sorted[i].time=Math.min(MAX_KEY_TIME,sorted[i-1].time+MIN_KEY_GAP);
 return sorted;
}

/** Inserts or replaces (by id) a key and returns the normalized list. */
export function upsertKey(keys,key){return normalizeKeys([...(keys||[]).filter(k=>k.id!==key.id),key]);}

/** Re-expresses a key in another anchor without moving the shot at the given runtime state. */
export function reanchorKey(key,anchor,runtime){const world=toWorld(key,anchorFrame(key.anchor,runtime));return validateKey({...key,...toLocal(world,anchorFrame(anchor,runtime)),anchor});}

// Centripetal Catmull–Rom; passes through p1 at t=0 and p2 at t=1 without overshoot cusps.
function catmullRom(p0,p1,p2,p3,t){
 const d=(a,b)=>Math.max(1e-6,Math.sqrt(Math.hypot(...a.map((v,i)=>v-b[i])))),t1=d(p0,p1),t2=t1+d(p1,p2),t3=t2+d(p2,p3),u=mix(t1,t2,t);
 const lerp=(a,b,ta,tb)=>a.map((v,i)=>tb===ta?v:((tb-u)*v+(u-ta)*b[i])/(tb-ta));
 const a1=lerp(p0,p1,0,t1),a2=lerp(p1,p2,t1,t2),a3=lerp(p2,p3,t2,t3),b1=lerp(a1,a2,0,t2),b2=lerp(a2,a3,t1,t3);
 return lerp(b1,b2,t1,t2);
}

const eased=(ease,u)=>ease==='hold'?0:ease==='linear'?u:smooth(u);

/** Camera at time t in the same shape as cinematicCamera(). Returns null with no keys. */
export function evaluateKeyedCamera(time,keys,runtime){
 if(!keys?.length)return null;
 const list=normalizeKeys(keys),world=list.map(k=>toWorld(k,anchorFrame(k.anchor,runtime)));
 // Unwrap yaw/roll so each step takes the shortest arc.
 for(let i=1;i<world.length;i++){world[i].yaw=world[i-1].yaw+wrap(world[i].yaw-world[i-1].yaw);world[i].roll=world[i-1].roll+wrap(world[i].roll-world[i-1].roll);}
 let pose;
 if(world.length===1||time<=list[0].time)pose=world[0];
 else if(time>=list.at(-1).time)pose=world.at(-1);
 else{
  const i=list.findLastIndex(k=>k.time<=time),a=world[i],b=world[i+1],u=eased(list[i].ease,(time-list[i].time)/(list[i+1].time-list[i].time));
  const p0=world[Math.max(0,i-1)].target,p3=world[Math.min(world.length-1,i+2)].target;
  pose={target:u===0?a.target:catmullRom(p0,a.target,b.target,p3,u),yaw:mix(a.yaw,b.yaw,u),pitch:mix(a.pitch,b.pitch,u),roll:mix(a.roll,b.roll,u),distance:Math.exp(mix(Math.log(a.distance),Math.log(b.distance),u)),fov:mix(a.fov,b.fov,u),panX:mix(a.panX,b.panX,u),panY:mix(a.panY,b.panY,u)};
 }
 return {target:[...pose.target],yaw:wrap(pose.yaw),pitch:clampPitch(pose.pitch),roll:wrap(pose.roll),zoom:BASE_DISTANCE/pose.distance,panX:pose.panX,panY:pose.panY,projection:'perspective',focalLength:focalFromFov(pose.fov)};
}

export const EVENT_FLAGS=['fire','track','target'];
export function normalizeEvents(events=[]){
 return events.filter(e=>e&&finite(e.time)&&e.time>=0&&e.time<=MAX_KEY_TIME).map(e=>{const out={id:String(e.id||newKeyId()),time:e.time};for(const k of EVENT_FLAGS)if(typeof e[k]==='boolean')out[k]=e[k];return out;}).sort((a,b)=>a.time-b.time);
}
/** Step-function flags at time t. Unset flags stay undefined so callers fall back to normal settings. */
export function eventState(time,events=[]){const state={fire:undefined,track:undefined,target:undefined};for(const e of normalizeEvents(events)){if(e.time>time+1e-9)break;for(const k of EVENT_FLAGS)if(k in e)state[k]=e[k];}return state;}

/** Sequence length: keyed sequences end at their last key or event; presets use their duration. */
export function sequenceDuration(showcase){
 if(showcase?.camera===KEYED_CAMERA){const times=[...(showcase.keys||[]),...(showcase.events||[])].map(k=>k.time).filter(finite);return Math.max(1,...times);}
 return showcase?.duration||18;
}
