import {nativeToView} from '../block-model.js';
import {KEYED_CAMERA,evaluateKeyedCamera,eventState} from './camera-keys.js';
export const CAMERA_PRESETS=['manual','orbit','close-up','barrel-focus','tracking-view','firing-profile','projectile-follow','beam-showcase','hero-shot'];
const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
export function showcaseAt(time,options={},kind='projectile'){
 const duration=options.duration||18,u=Math.max(0,Math.min(1,time/duration));
 const phases=[{at:0,name:'Inspection',camera:'orbit',track:false,fire:false,target:false},{at:.15,name:'Acquisition',camera:'tracking-view',track:true,fire:false,target:true},{at:.3,name:'Tracking',camera:'tracking-view',track:true,fire:false,target:true},{at:.42,name:'Firing',camera:'firing-profile',track:true,fire:true,target:true},{at:.65,name:'Detail',camera:kind==='beam'?'beam-showcase':'projectile-follow',track:true,fire:true,target:true},{at:.86,name:'Closing',camera:'hero-shot',track:false,fire:false,target:false}];
 for(const phase of phases){const override=options.phases?.[phase.name];if(!override)continue;if(CAMERA_PRESETS.includes(override.camera)&&override.camera!=='manual')phase.camera=override.camera;for(const key of ['fire','track','target'])if(typeof override[key]==='boolean')phase[key]=override[key];if(Number.isFinite(override.at)&&override.at>=0&&override.at<1&&phase.name!=='Inspection')phase.at=override.at;}phases.sort((a,b)=>a.at-b.at);
 const index=Math.max(0,phases.findLastIndex(p=>u>=p.at)),phase=phases[index];return {...phase,camera:options.sequence===false?options.camera||'orbit':phase.camera,previous:phases[Math.max(0,index-1)].camera,blend:smooth(Math.min(1,(u-phase.at)*duration/(options.transition||1.2))),progress:u};
}
export function modelEnvelope(asset){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of asset.blocks)for(const [i,key] of ['x','y','z'].entries()){min[i]=Math.min(min[i],b.position[key]-b.size[key]/2);max[i]=Math.max(max[i],b.position[key]+b.size[key]/2);}const center=min.map((v,i)=>(v+max[i])/2);return {center,radius:Math.max(.1,Math.hypot(...max.map((v,i)=>(v-min[i])/2)))};}
export function cinematicCamera(preset,time,asset,runtime,options={}){
 const bounds=modelEnvelope(asset),duration=options.duration||18,fov=options.fov||45;let target=nativeToView(bounds.center),radius=bounds.radius,distance=radius/Math.sin(fov*Math.PI/360)*1.5,yaw=.7,pitch=.35;
 const aim=point=>{target=nativeToView(point);};
 if(preset==='orbit'){yaw=.7+time/duration*Math.PI*2;}
 if(preset==='close-up'){distance*=mix(1.5,1,smooth(Math.min(1,time/duration)));pitch=.2;}
 if(preset==='barrel-focus'&&runtime.muzzles.length){aim(runtime.muzzles[0].position);distance*=1.1;yaw=1.2;}
 if(preset==='tracking-view'){yaw=1.1;pitch=.5;distance*=1.2;}
 if(preset==='firing-profile'){yaw=.9;pitch=.3;}
 if(preset==='hero-shot'){yaw=.45+.15*Math.sin(time/duration*Math.PI);pitch=.15;distance*=1.1;}
 if(preset==='projectile-follow'&&runtime.effects.projectiles.length){const shot=runtime.effects.projectiles[0];aim(shot.position);distance=Math.max(distance*.8,3);}
 if(preset==='beam-showcase'&&runtime.effects.beams.length){const beam=runtime.effects.beams[0],length=Math.min(beam.length,radius*12),end=beam.origin.map((v,i)=>v+beam.direction[i]*length);aim(beam.origin.map((v,i)=>(v+end[i])/2));distance=Math.max(distance,length/Math.sin(fov*Math.PI/360));yaw=1.2;pitch=.4;}
 return {target,yaw,pitch,roll:0,zoom:10/(distance*(options.distance||1)),panX:0,panY:0,projection:'perspective',focalLength:18/Math.tan(fov*Math.PI/360)};
}
export function evaluateCamera(time,asset,runtime,options={}){if(options.camera===KEYED_CAMERA){const keyed=evaluateKeyedCamera(time,options.keys,runtime);if(keyed)return keyed;}const phase=showcaseAt(time,options,runtime.effects.profile?.kind),camera=cinematicCamera(phase.camera,time,asset,runtime,options);if(options.sequence!==false&&phase.blend<1){const from=cinematicCamera(phase.previous,time,asset,runtime,options),t=phase.blend;for(const key of ['yaw','pitch','zoom'])camera[key]=mix(from[key],camera[key],t);camera.target=camera.target.map((v,i)=>mix(from.target[i],v,t));}return camera;}
export function applyCamera(view,camera){const {focalLength,...pose}=camera;Object.assign(view,pose);if(view.display)view.display.focalLength=focalLength;}
export function presentation(view,preferences,options={}){const v=structuredClone(view),p={...preferences};if(options.background&&options.background!=='viewer'){v.display.background='VIEWPORT';v.display.backgroundColor=options.background==='neutral'?'#686868':options.background==='solid'?(options.color||'#202020'):'#080d16';}if(options.lighting&&options.lighting!=='existing'){v.display.shading='RENDERED';const values={neutral:[.7,.6,35],contrast:[1.3,.15,65],cinematic:[1,.3,110]}[options.lighting]||[.7,.6,35];Object.assign(p,{shaderLight:values[0],shaderAmbient:values[1],shaderAzimuth:values[2]});}return {view:v,preferences:p};}
/** Fire/track/target flags for the active sequence at time t, or null when no sequence drives them. */
export function sequenceFlags(time,showcase,kind){if(!showcase?.camera||showcase.camera==='manual')return null;if(showcase.camera===KEYED_CAMERA)return eventState(time,showcase.events);return showcase.sequence?showcaseAt(time,showcase,kind):null;}
