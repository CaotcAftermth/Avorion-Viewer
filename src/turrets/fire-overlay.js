import {inFireDirection} from './fire-directions.js';
import {liveBlocks} from '../ship-structure.js';
import {mounts} from './mounts.js';
import {sceneSockets} from './sockets.js';
import {projectPoint} from '../navigation.js';
import {nativeToView} from '../block-model.js';
const states=new WeakMap();
function coverage(scene){
 const blocks=liveBlocks(scene),list=mounts(scene);let state=states.get(scene);
 if(!scene.showFireCoverage||!list.length){state?.worker?.terminate();states.delete(scene);return null;}
 if(state&&state.model===scene.model&&state.revision===scene.revision&&state.length===scene.model?.blocks.length&&state.loaded===scene.loaded&&state.list===list)return state;
 state?.worker?.terminate();state={model:scene.model,revision:scene.revision,length:scene.model?.blocks.length,loaded:scene.loaded,list,status:'Calculating angle of fire…'};states.set(scene,state);
 const worker=new Worker(new URL('./fire-coverage.worker.js',import.meta.url),{type:'module'});state.worker=worker;
 const finish=()=>{worker.terminate();state.worker=null;window.dispatchEvent(new Event('avorion-model-ready'));};
 worker.onmessage=({data})=>{if(data.progress){state.status=`Calculating fields of fire: ${data.progress.done}/${data.progress.total}`;window.dispatchEvent(new Event('avorion-model-ready'));return;}state.result=data.result;state.status=data.error||'';finish();};worker.onerror=e=>{state.status=e.message||'Angle of fire calculation failed.';finish();};
 worker.postMessage({blocks:blocks.map(({el,itemEl,...b})=>b),mounts:list,sockets:sceneSockets(scene),step:10});return state;
}
// Build per-muzzle swept surfaces; never bridge a clear/obstructed boundary.
export function firingArcFaces(result,distance,direction=null){
 const faces=[],n=result.pitchCount,rows=result.samples.length/n;
 const endpoint=(sample,m)=>{const ray=sample.rays[m],length=Math.min(distance,ray.distance);return ray.origin.map((v,i)=>v+sample.direction[i]*length);};
 const add=(samples,m,cap=false)=>{if(!samples.every(s=>inFireDirection(s.direction,direction)))return;const blocked=samples.map(s=>s.rays[m].distance<=distance);if(blocked.some(Boolean)&&!blocked.every(Boolean))return;
  const points=cap?[samples[0].rays[m].origin,endpoint(samples[0],m),endpoint(samples[1],m),samples[1].rays[m].origin]:samples.map(s=>endpoint(s,m));faces.push({points,blocked:blocked.every(Boolean)});};
 if(rows>1)for(let row=0;row<rows;row++){const next=(row+1)%rows;for(let m=0;m<result.muzzles;m++){
  for(let p=0;p<n-1;p++)add([result.samples[row*n+p],result.samples[next*n+p],result.samples[next*n+p+1],result.samples[row*n+p+1]],m);
  for(const p of new Set([0,n-1]))add([result.samples[row*n+p],result.samples[next*n+p]],m,true);
 }}return faces;
}
const colors=['#61e3ad','#68bcff','#e3a0ff','#f4d16b','#70dddd','#eba588'];
export function drawFireCoverage(ctx,scene,view,width,height){
 const state=coverage(scene);if(!state||!scene.visible||view.display?.showOverlays===false)return;
 ctx.save();ctx.font='12px sans-serif';const result=state.result,direction=scene.fireDirection||'top',distance=scene.fireDisplayDistance||10;
 const screen=p=>projectPoint(nativeToView(p),view,width,height),fields=[];let active=0,estimated=false;
 if(result){
  const faces=[],rays=[];
  for(const [index,r] of result.turrets.entries()){
   const samples=r.samples.filter(s=>inFireDirection(s.direction,direction));if(!samples.length)continue;active++;estimated||=r.estimated;
   const color=colors[index%colors.length];fields.push({name:`${index+1}. ${r.name}`,color});
   for(const f of firingArcFaces(r,distance,direction)){const points=f.points.map(screen);if(points.every(Boolean))faces.push({...f,points,color});}
   for(const sample of samples)for(const ray of sample.rays){const blocked=ray.distance<=distance,end=ray.origin.map((v,i)=>v+sample.direction[i]*Math.min(distance,ray.distance)),a=screen(ray.origin),b=screen(end);if(a&&b)rays.push({a,b,blocked,color,coaxial:r.coaxial});}
  }
  faces.sort((a,b)=>b.points.reduce((n,p)=>n+p[2],0)-a.points.reduce((n,p)=>n+p[2],0));
  for(const f of faces){ctx.fillStyle=f.blocked?'#ff667b':f.color;ctx.globalAlpha=.10;ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();}
  for(const {a,b,blocked,color,coaxial} of rays){ctx.strokeStyle=blocked?'#ff667b':color;ctx.globalAlpha=coaxial?.9:.14;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();if(blocked){ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(b[0]-2,b[1]-2);ctx.lineTo(b[0]+2,b[1]+2);ctx.moveTo(b[0]+2,b[1]-2);ctx.lineTo(b[0]-2,b[1]+2);ctx.stroke();}}
 }
 ctx.globalAlpha=1;ctx.fillStyle='#ffffff';const lines=[state.status||`${direction.toUpperCase()} firing fields · ${active} turrets · sampled 10°`,...(result?['Colors: turret fields · Red: first obstruction','Hidden blocks still obstruct · projected overlap only',estimated?'Estimated tips · gaps may be blind or unsampled':'Native tips · gaps may be blind or unsampled',...(result.warnings.length?[`${result.warnings.length} turrets omitted: missing valid socket or muzzle data`]:[])]:[])];
 let y=height-45;for(const line of [...lines].reverse()){const words=line.split(' '),rows=[];let row='';for(const word of words){if(row&&ctx.measureText(row+' '+word).width>Math.max(80,width-28)){rows.push(row);row=word;}else row+=(row?' ':'')+word;}rows.push(row);for(const text of rows.reverse()){ctx.fillText(text,14,y);y-=17;}}
 // Compact per-turret legend; field colors repeat after six entries.
 let legendY=170;const legendX=Math.max(65,width-260);if(height>340&&width>300)for(const field of fields.slice(0,6)){let label=field.name;while(label.length&&ctx.measureText(label).width>width-legendX-45)label=label.slice(0,-1);ctx.fillStyle='#182027cc';ctx.fillRect(legendX-4,legendY-12,Math.min(230,width-legendX-15),16);ctx.fillStyle=field.color;ctx.fillRect(legendX,legendY-9,8,8);ctx.fillStyle='#ffffff';ctx.fillText(label,legendX+14,legendY);legendY+=18;}
 ctx.restore();
}
