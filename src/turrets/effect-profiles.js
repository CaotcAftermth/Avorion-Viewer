import {CALIBRATION_DEFAULTS,resolveCalibration} from './calibration.js';
import {WEAPON_PROFILES} from './weapon-profiles.js';
export const VISUAL_FAMILIES=WEAPON_PROFILES.map(p=>p.id);
export const CALIBRATION={...CALIBRATION_DEFAULTS,guidanceTurnRate:90,guidanceAcceleration:0,restartDebt:.05};
export const UNIT_MAPPING={scale:1,status:'Unverified 1:1 native-distance to viewer-coordinate mapping'};
export const nativeDistance=value=>value*UNIT_MAPPING.scale;
export function seeded(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function hsv(h,s,v){const f=n=>{const k=((n+h/60)%6+6)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return [f(5),f(3),f(1)];}
// Explicit source assignments. Null native defaults are intentionally not zero.
const projectiles={
 ChainGun:[[500,700],[.05,.2],[300,450],'streak','physical',614],
 PointDefenseChainGun:[[1000,1100],[.05,.2],[700,750],'streak','physical',665],
 Bolter:[[800,1000],[.15,.25],[650,700],'streak','physical',9],
 PlasmaGun:[[500,700],[.4,.8],[550,800],'plasma','energy',703],
 PulseCannon:[[700,800],[.08,.3],[450,750],'pulse','energy',524],
 Cannon:[[600,800],[.2,.5],[1100,1500],'heavy-round','explosive',797],
 RocketLauncher:[[150,200],[.2,.4],[1300,1800],'rocket','explosive',744],
 AntiFighter:[[300,400],[.3,.3],[300,350],'heavy-round','dust',569]
};
const beams={Laser:[[450,750],'straight',.5,1,4,null,null,337],PointDefenseLaser:[[500,600],'straight',.5,1,4,null,null,300],MiningLaser:[[75,75],'straight',.5,1,4,null,null,57],RawMiningLaser:[[150,150],'straight',.5,1,4,null,null,126],SalvagingLaser:[[75,75],'straight',.5,1,4,null,null,91],RawSalvagingLaser:[[150,150],'straight',.5,1,4,null,null,163],RailGun:[[950,1400],'straight',.5,3,1,-2,null,421],LightningGun:[[950,1400],'lightning',.5,3,0,0,13,200],TeslaGun:[[250,350],'lightning',.5,1,4,null,5,252],RepairBeam:[[200,300],'swirly',.5,1,4,null,2,378],ForceGun:[[450,550],'straight',2,1,4,null,null,475]};
export const MATERIAL_BEAMS=['MiningLaser','RawMiningLaser','SalvagingLaser','RawSalvagingLaser'];
export const TURN_FACTORS={ChainGun:1,PointDefenseChainGun:2,PointDefenseLaser:2,Bolter:.7,PlasmaGun:.7,Laser:.75,MiningLaser:.8,RawMiningLaser:.8,SalvagingLaser:.8,RawSalvagingLaser:.8,RocketLauncher:.6,Cannon:.5,RailGun:.5,LightningGun:.5,TeslaGun:.5,RepairBeam:1,ForceGun:2,PulseCannon:.8,AntiFighter:1.2};
const simultaneous={TeslaGun:.15,LightningGun:.15,PlasmaGun:.25,ChainGun:.25,RailGun:.25,PulseCannon:.25,Cannon:.5,RocketLauncher:.5};
const cooling={Bolter:['heat',7*1.1,5],Cannon:['heat',25,15],RailGun:['heat',27.5,10],RocketLauncher:['heat',20,15],PulseCannon:['heat',15*1.25,5*1.25],Laser:['charge',20,30],PlasmaGun:['charge',15,20],TeslaGun:['charge',15,20],LightningGun:['charge',15,20],RepairBeam:['charge',10,15]};
export function effectProfile(id,seed=1,options={}){
 const registry=WEAPON_PROFILES.find(p=>p.id===id);if(!registry)return null;
 const random=seeded(seed),sample=([lo,hi])=>options.variation==='seeded'?lo+random()*(hi-lo):(lo+hi)/2,rand=(lo,hi)=>lo+random()*(hi-lo);
 const base={calibration:resolveCalibration(options.calibration,id),id,seed,name:registry.name,kind:projectiles[id]?'projectile':'beam',continuous:registry.continuous,interval:sample(registry.delayRange||[registry.interval,registry.interval]),source:registry.source,verification:'Source-confirmed parameters; source-derived scheduling; approximate procedural visuals',fidelity:{parameters:'source-confirmed',firing:'source-derived',appearance:'approximate',calibrated:false},mapping:UNIT_MAPPING.status,turnFactor:TURN_FACTORS[id],nativeDefaults:{shape:null,animationAcceleration:null},simultaneous:random()<(simultaneous[id]||0),shotsFired:1};
 if(['ChainGun','Bolter','RocketLauncher'].includes(id)&&random()<.05)base.shotsFired=[2,2,2,2,2,3,4][Math.floor(random()*7)];
 if(cooling[id]){const [mode,shooting,recovery]=cooling[id];base.resource={mode,shootingTime:shooting,recoveryTime:recovery,restartDebt:CALIBRATION.restartDebt};}
 if(projectiles[id]){
  const [speed,size,reach,shape,impact,line]=projectiles[id],velocity=nativeDistance(sample(speed)),range=nativeDistance(sample(reach));
  Object.assign(base,{velocity,range,size:nativeDistance(sample(size)),lifetime:range/velocity,shape,impact,line,color:hsv(id==='PlasmaGun'?rand(0,360):id==='PulseCannon'?rand(180,290):rand(10,60),.7,1),emissive:shape!=='rocket',explosionRadius:impact==='dust'?nativeDistance(35):base.calibration.explosionRadius,timedDeath:id==='AntiFighter',deathExplosion:id==='AntiFighter'});
  if(id==='RocketLauncher'){base.seeker=random()<1/8;base.delayWeaponCount=random()<.5?1:2;base.generatedPositionCount=random()<.5?1:2;base.guidance={turnRate:CALIBRATION.guidanceTurnRate,acceleration:CALIBRATION.guidanceAcceleration};if(options.guidance&&options.guidance!=='generated')base.seeker=options.guidance==='guided';}
  return base;
 }
 const [reach,shape,width,aura,speed,acceleration,shapeSize,line]=beams[id],hue=rand(0,360);
 Object.assign(base,{range:nativeDistance(sample(reach)),shape,width:nativeDistance(width),aura:nativeDistance(aura),animationSpeed:speed,animationAcceleration:acceleration,shapeSize,line,inner:hsv(hue+rand(-120,120),.3,rand(.7,.8)),outer:hsv(hue,1,rand(.1,.3)),innerAlpha:1,outerAlpha:1,impact:id==='RailGun'?'physical':'energy',visualLifetime:options.beamLifetime??base.calibration.discreteLifetime});
 if(id==='RailGun'||id==='LightningGun'){const warm=id==='RailGun'&&random()<.5,range=warm?[10,60]:[180,260];base.colorBranch=warm?'warm':'blue';base.inner=hsv(rand(...range),rand(.1,.5),1);base.outer=hsv(rand(...range),rand(.5,1),rand(.1,.5));}
 if(MATERIAL_BEAMS.includes(id)){base.materialColor=options.materialColor||[.6,.6,.6];base.inner=base.materialColor.map(v=>v*.5);base.innerAlpha=.5;base.outer=[.1,.1,.1];}
 if(id==='RepairBeam'){base.repairMode=options.repairMode&&options.repairMode!=='generated'?options.repairMode:random()<.125?'dual':random()<.5?'shield':'hull';const modes=base.repairMode==='dual'?['shield','hull']:[base.repairMode];base.layers=modes.map((mode,i)=>({role:mode,shape:'swirly',shapeSize:2,offset:base.repairMode==='dual'?(i===0?.1:-.1):0,inner:mode==='shield'?[.2,.4,.9]:[1,1,1],outer:mode==='shield'?[.1,.2,.4]:[0,.5,0],outerAlpha:mode==='shield'?1:.5}));Object.assign(base,{inner:base.layers[0].inner,outer:base.layers[0].outer});}
 if(id==='ForceGun'){base.inner=hsv(40,.3,.3);base.outer=hsv(40,1,.1);base.layers=[{role:'primary',shape:'straight'},{role:'secondary',shape:'swirly',shapeSize:1.25}];}
 return base;
}
// Resolve once per configuration. Generation flags never reroll on a shot.
export function resolveFiring(profile,muzzleCount,settings={}){
 const count=Math.max(1,muzzleCount),simultaneous=settings.pattern==='simultaneous'||(!settings.pattern||settings.pattern==='generated')&&profile.simultaneous;
 const multiplied=['ChainGun','PointDefenseChainGun','Bolter','PlasmaGun','Cannon','RailGun','PulseCannon','RocketLauncher','PointDefenseLaser'].includes(profile.id);
 const perWeapon=profile.interval*(multiplied?(profile.delayWeaponCount??count):1);
 let interval=perWeapon/(simultaneous||profile.continuous?1:count),resource=profile.resource?{...profile.resource}:null;
 if(settings.specialty==='burst'||settings.pattern==='burst'){
  const aggregate=count/perWeapon,rate=Math.max(aggregate*2.5,6);interval=(simultaneous||profile.continuous?count:1)/rate;resource={mode:profile.resource?.mode||'heat',shootingTime:1,recoveryTime:rate/aggregate,restartDebt:CALIBRATION.restartDebt};
 }
 const emissions=(profile.continuous||simultaneous?count:1)/interval;
 return {interval,continuous:profile.continuous,simultaneous,shotsFired:settings.shots>0?settings.shots:profile.shotsFired,muzzles:Array.from({length:count},(_,i)=>i),resource:resource?{...resource,perEmission:(1/resource.shootingTime+1/resource.recoveryTime)/emissions}:null};
}
