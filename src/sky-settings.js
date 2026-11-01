// Shared schema keeps generator inputs and preference persistence in sync.
const number=(key,label,value,min,max,step,description,suffix)=>({key:'world'+key,label,type:'number',default:value,min,max,step,description,...(suffix?{suffix}:{})});
export const WORLD_FIELDS=[
  {key:'worldEnabled',label:'Enable Skybox',type:'checkbox',default:true,description:'Display the generated sky when viewport Background is World. Choose World in the viewport shading popover for existing layouts.'},
  number('Seed','Sky Seed',42,0,2147483647,1,'Change this integer to generate another repeatable sky.'),
  number('SectorX','Sector X',150,-500,500,1,'Galaxy coordinate; changes cloud placement and star density.'),
  number('SectorY','Sector Y',100,-500,500,1,'Galaxy coordinate; changes cloud placement and star density.'),
  {key:'worldPalette',label:'Sky Palette',type:'select',default:'blue',options:[['seed','From Seed'],['blue','Blue / Cyan'],['green','Green / Gold'],['red','Red / Violet'],['purple','Purple / Blue'],['custom','Custom']],description:'Choose a nebula palette or use the two custom colors below.'},
  {key:'worldColorA',label:'Nebula Color A',type:'color',default:'#397fc4',description:'First nebula tint when Sky Palette is Custom.'},
  {key:'worldColorB',label:'Nebula Color B',type:'color',default:'#9140b3',description:'Second nebula tint when Sky Palette is Custom.'},
  number('Clouds','Nebula Clouds',32,0,48,1,'Number of colored cloud stamps distributed over the whole sky.'),
  number('CloudScale','Cloud Size',1,.3,2,.05,'Angular size of the nebula clouds.','×'),
  number('Nebula','Nebula Intensity',.65,0,2,.05,'Brightness of the colored cloud layers.','×'),
  number('Highlights','Nebula Highlights',.6,0,2,.05,'Pale highlights inside the clouds, using Avorion’s shader response.','×'),
  number('DarkClouds','Dark Clouds',.6,0,1,.05,'Strength of the dark cloud silhouettes.'),
  number('Dust','Dust Haze',.15,0,1,.05,'Distant fog texture layers; also reduces star visibility.'),
  number('Stars','Star Density',1,0,3,.1,'Density of the small star field, scaled by distance from the galactic center.','×'),
  number('StarBrightness','Star Brightness',1,0,3,.1,'Brightness of small and large stars.','×'),
  number('Sun','Sun Glow',.5,0,2,.05,'Strength of the seeded large stellar glow.','×'),
  number('Brightness','World Brightness',1,0,3,.1,'Overall sky brightness; does not alter the ship’s studio lighting.','×'),
  number('Rotation','World Rotation',0,-180,180,1,'Rotate the sky around the vertical axis without regenerating it.','°'),
  {key:'worldResolution',label:'Sky Resolution',type:'select',numeric:true,default:512,options:[[256,'Preview (256)'],[512,'Standard (512)'],[1024,'High (1024)']],description:'Pixels per cube face. Higher quality costs more generation time and GPU memory.'}
];
export const WORLD_DEFAULTS=Object.freeze(Object.fromEntries(WORLD_FIELDS.map(f=>[f.key,f.default])));
export function skyKey(p){return JSON.stringify(WORLD_FIELDS.filter(f=>!['worldRotation','worldEnabled'].includes(f.key)).map(f=>p[f.key]??f.default));}
export function skySpecification(preferences){
  const p={...WORLD_DEFAULTS,...preferences};
  let state=(Math.trunc(p.worldSeed)^Math.imul(Math.trunc(p.worldSectorX),73856093)^Math.imul(Math.trunc(p.worldSectorY),19349663))>>>0;
  const random=()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
  const direction=()=>{const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);return [r*Math.cos(a),y,r*Math.sin(a)];};
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const palettes={blue:['#397fc4','#53baac'],green:['#49b56a','#b5a94e'],red:['#c44730','#ab3069'],purple:['#8240c4','#3f73c4']};
  const selected=p.worldPalette==='seed'?Object.values(palettes)[Math.floor(random()*4)]:palettes[p.worldPalette];
  const colors=(selected??[p.worldColorA,p.worldColorB]).map(rgb);
  const types=[0,1,2,3,4,5,6,7,8];for(let i=8;i>0;i--){const j=Math.floor(random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}types.length=3;types.push(9);
  const clouds=Array.from({length:Math.round(p.worldClouds)},(_,i)=>({direction:direction(),size:(.35+random()*.55)*p.worldCloudScale,rotation:random()*Math.PI*2,type:types[i%4],color:colors[i%2],alpha:.22+random()*.24}));
  const dark=Array.from({length:16},(_,i)=>({direction:direction(),size:.3+random()*.5,rotation:random()*Math.PI*2,type:i%10}));
  const stars=Array.from({length:40},(_,i)=>({direction:direction(),size:i===0?.075:.003+random()*.006,type:i%3,brightness:.3+random()*.7}));
  return {clouds,dark,stars,colors,offset:random()*1000,density:p.worldStars*(1.5-.7*Math.min(1,Math.hypot(p.worldSectorX,p.worldSectorY)/500))};
}
