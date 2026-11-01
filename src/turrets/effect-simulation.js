import {effectProfile,CALIBRATION} from './effect-profiles.js';
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const normalized=a=>{const n=Math.hypot(...a);return a.map(v=>v/(n||1));};
export const DEMO_TARGET_RADIUS=.75;
export function sphereHit(origin,direction,maxDistance,center,radius){
 if(!center||!center.every(Number.isFinite))return null;
 const delta=sub(origin,center),b=dot(delta,direction),c=dot(delta,delta)-radius*radius,disc=b*b-c;
 if(disc<0)return null;const distance=c<=0?0:-b-Math.sqrt(disc);if(distance<0||distance>maxDistance)return null;
 const position=add(origin,direction,distance);return {distance,position,normal:normalized(sub(position,center))};
}
export function guidedDirection(direction,desired,maxAngle){
 const a=normalized(direction),b=normalized(desired),angle=Math.acos(Math.max(-1,Math.min(1,dot(a,b))));if(angle<1e-8)return a;if(angle<=maxAngle)return b;
 let perpendicular=sub(b,a.map(v=>v*Math.cos(angle)));
 if(Math.hypot(...perpendicular)<1e-8){const axis=Math.abs(a[0])<.9?[1,0,0]:[0,1,0];perpendicular=sub(axis,a.map(v=>v*dot(axis,a)));}
 perpendicular=normalized(perpendicular);return normalized(a.map((v,i)=>v*Math.cos(maxAngle)+perpendicular[i]*Math.sin(maxAngle)));
}
export const impactDuration=(kind,CALIBRATION_DEFAULT=CALIBRATION)=>kind==='dust'?CALIBRATION_DEFAULT.dustDuration:kind==='explosive'?CALIBRATION_DEFAULT.explosionDuration:kind==='energy'?CALIBRATION_DEFAULT.energyDuration:CALIBRATION_DEFAULT.physicalDuration;
export class WeaponEffectsSimulation {
 constructor(id,seed=1,options={}){this.reset(id,seed,options);}
 reset(id,seed=1,options={}){this.profile=effectProfile(id,seed,options);this.projectiles=[];this.flashes=[];this.impacts=[];this.beams=[];this.discrete=[];this.pending=[];this.channels=new Set();this.serial=0;this.time=0;this.terminations={hit:0,range:0,lifetime:0};this.lastImpact=null;}
 consume(event){
  const p=this.profile;if(!p)return;
  if(event.type==='activate')this.channels.add(event.channel);
  if(event.type==='deactivate'||event.type==='stop'){this.channels.delete(event.channel);if(!this.channels.size)this.beams=this.beams.filter(b=>b.discrete);}
  if(event.type!=='shot'||!event.muzzleFrame)return;
  const id=++this.serial,origin=[...event.muzzleFrame.position],direction=normalized(event.muzzleFrame.direction);
  if(p.kind==='beam'){this.pending.push({id,muzzle:event.muzzle,origin,direction,birth:event.time});return;}
  this.projectiles.push({id,origin,direction,initialDirection:[...direction],position:[...origin],birth:event.time,last:event.time,distance:0,speed:p.velocity,targetAcquired:!!p.seeker,history:[origin]});
  this.flashes.push({id,birth:event.time,muzzle:event.muzzle,origin,direction});
 }
 impact(position,normal,time,id,kind=this.profile.impact){const p=this.profile,impact={position,normal,family:p.id,kind,time,seed:(p.seed+id)>>>0,color:p.color||p.inner,radius:p.explosionRadius??CALIBRATION.explosionRadius};this.impacts.push(impact);this.lastImpact=impact;this.emit?.({type:'projectileImpact',time,...impact});return impact;}
 beam(m,muzzle,time,target,collision,extra={}){
  const p=this.profile,direction=normalized(m.direction),hit=sphereHit(m.position,direction,p.range,target,DEMO_TARGET_RADIUS),obstacle=collision?.(m.position,direction,p.range);
  const closest=obstacle&&obstacle.distance>=0&&obstacle.distance<=p.range&&(!hit||obstacle.distance<hit.distance)?obstacle:hit,length=closest?.distance??p.range,end=add(m.position,direction,length);
  return {muzzle,origin:[...m.position],direction,length,end,birth:time,seed:p.seed+muzzle,appearance:p,contact:closest?{position:end,normal:closest.normal,family:p.id,kind:'contact',time,seed:p.seed+muzzle}:null,...extra};
 }
 update(time,muzzles,target,previousTarget=target,dt=0,collision=null){
  const p=this.profile;this.time=time;if(!p)return;
  this.flashes=this.flashes.filter(f=>time-f.birth<p.calibration.flashDuration);
  this.impacts=this.impacts.filter(i=>time-i.time<impactDuration(i.kind,p.calibration));
  const alive=[];
  for(const shot of this.projectiles){
   const start=Math.max(shot.last,shot.birth),end=Math.min(time,shot.birth+p.lifetime),elapsed=Math.max(0,end-start),origin=[...shot.position];
   if(p.seeker&&shot.targetAcquired){if(!target||!target.every(Number.isFinite)||Math.hypot(...sub(target,origin))>p.range)shot.targetAcquired=false;else shot.direction=guidedDirection(shot.direction,sub(target,origin),p.guidance.turnRate*Math.PI/180*elapsed);}
   if(p.seeker)shot.speed=Math.max(0,shot.speed+p.guidance.acceleration*elapsed);
   const distance=Math.max(0,Math.min(elapsed*shot.speed,p.range-shot.distance)),finish=add(origin,shot.direction,distance),travelTime=shot.speed?distance/shot.speed:elapsed;
   const mix=t=>dt>0?Math.max(0,Math.min(1,(t-(time-dt))/dt)):1;
   const centerAt=t=>target&&previousTarget?previousTarget.map((v,i)=>v+(target[i]-v)*mix(t)):target;
   const targetStart=centerAt(start),targetEnd=centerAt(start+travelTime),relative=targetStart&&targetEnd?sub(sub(finish,origin),sub(targetEnd,targetStart)):sub(finish,origin),relativeLength=Math.hypot(...relative);
   const swept=sphereHit(origin,normalized(relative),relativeLength,targetStart,DEMO_TARGET_RADIUS);
   let hit=swept?{fraction:relativeLength?swept.distance/relativeLength:0}:null;
   const obstacle=collision?.(origin,shot.direction,distance);
   if(obstacle&&obstacle.distance>=0&&obstacle.distance<=distance&&(!hit||(distance?obstacle.distance/distance:0)<hit.fraction))hit={fraction:distance?obstacle.distance/distance:0,normal:obstacle.normal};
   if(hit){const position=add(origin,shot.direction,distance*hit.fraction),at=start+travelTime*hit.fraction;this.impact(position,hit.normal||(centerAt(at)?normalized(sub(position,centerAt(at))):null),at,shot.id);this.terminations.hit++;continue;}
   shot.position=finish;shot.last=end;shot.distance+=distance;
   if(p.shape==='rocket'){shot.history.push([...finish]);if(shot.history.length>16)shot.history.shift();}
   if(time+1e-10>=shot.birth+p.lifetime||shot.distance+1e-8>=p.range){const reason=p.timedDeath||p.lifetime<p.range/p.velocity?'lifetime':'range';this.terminations[reason]++;this.emit?.({type:'projectileExpired',time:start+travelTime,reason,position:finish,id:shot.id});if(p.deathExplosion)this.impact(finish,null,start+travelTime,shot.id,'dust');continue;}
   alive.push(shot);
  }
  this.projectiles=alive;
  for(const shot of this.pending){const b=this.beam({position:shot.origin,direction:shot.direction},shot.muzzle,shot.birth,target,collision,{id:shot.id,seed:p.seed+shot.id,discrete:true,lifetime:p.visualLifetime});this.discrete.push(b);if(b.contact)this.impact(b.end,b.contact.normal,shot.birth,shot.id);}
  this.pending=[];this.discrete=this.discrete.filter(b=>time-b.birth<b.lifetime);this.beams=[...this.discrete];
  if(p.kind==='beam'&&p.continuous&&this.channels.size)for(const [muzzle,m] of muzzles.entries())for(const layer of p.layers||[{}]){
   const offset=(layer.offset||0)*(m.localScale??1),position=add(m.position,m.right||[1,0,0],offset),appearance={...p,...layer};
   this.beams.push(this.beam({...m,position},muzzle,time,target,collision,{appearance,role:layer.role,seed:p.seed+muzzle}));
  }
 }
}
