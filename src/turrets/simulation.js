// Pure deterministic scheduling. Rendering consumes events, never drives their cadence.
export class SimulationClock {
 constructor(step=1/120){this.step=step;this.restart();this.speed=1;this.playing=false;}
 restart(){this.tick=0;this.remainder=0;}
 get time(){return this.tick*this.step;}
 advance(seconds,update){if(!this.playing)return;if(!Number.isFinite(seconds)||seconds<0||!Number.isFinite(this.speed)||this.speed<=0)throw Error('Invalid clock input');this.remainder+=seconds*this.speed;while(this.remainder+1e-10>=this.step){this.remainder-=this.step;update(++this.tick*this.step,this.step);}}
}
export class FiringScheduler {
 constructor(channels,emit=()=>{}){this.channels=channels;this.emit=emit;this.reset();}
 reset(){this.states=this.channels.map(()=>({active:false,start:0,index:0}));}
 update(time,firing=true,gate=()=>true){
  this.channels.forEach((c,i)=>{const s=this.states[i],on=firing&&gate(c,time),send=(type,t,extra={})=>this.emit({type,time:t,channel:c.id??i,...extra});
   if(on&&!s.active){s.active=true;s.start=time;s.index=0;send('start',time);if(c.continuous)send('activate',time);}
   if(!on&&s.active){s.active=false;if(c.continuous)send('deactivate',time);send('stop',time);}
   if(!s.active)return;
   const interval=c.interval;if(!(interval>0))throw Error('Firing interval must be positive');
   const burst=c.burst,at=n=>s.start+(burst?Math.floor(n/burst.count)*(burst.count*interval+burst.rest)+(n%burst.count)*interval:n*interval);
   while(at(s.index)<=time+1e-10){const t=at(s.index),muzzles=c.muzzles?.length?c.muzzles:[0],selected=c.simultaneous||c.continuous?muzzles:[muzzles[s.index%muzzles.length]];
    for(const muzzle of selected)for(let shot=0;shot<(c.shotsFired||1);shot++)send(c.continuous?'tick':'shot',t,{muzzle,shot,visualLifetime:c.visualLifetime??null});s.index++;
   }
  });
 }
}
export function targetAt(time,{mode='stationary',points=[[0,5,20],[15,10,20]],period=8,radius=15}={}){
 const phase=time/Math.max(.01,period);
 if(mode==='orbit')return [points[0][0]+Math.sin(phase*Math.PI*2)*radius,points[0][1]+Math.sin(phase*Math.PI*2)*radius*.4,points[0][2]+Math.cos(phase*Math.PI*2)*radius];
 if(mode==='stationary'||points.length<2)return [...points[0]];
 const q=mode==='linear'?(1-Math.abs((phase%2)-1)):(phase%1)*(points.length-1),index=mode==='linear'?0:Math.min(points.length-2,Math.floor(q)),mix=mode==='linear'?q:q-index;
 return points[index].map((v,i)=>v+(points[index+1][i]-v)*mix);
}
