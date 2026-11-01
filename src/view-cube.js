import { area } from './layout.js';
import { basis, dot } from './navigation.js';
const faces=[
  ['front',[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]],
  ['back',[0,1,0],[[1,1,-1],[-1,1,-1],[-1,1,1],[1,1,1]]],
  ['right',[1,0,0],[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],
  ['left',[-1,0,0],[[-1,1,-1],[-1,-1,-1],[-1,-1,1],[-1,1,1]]],
  ['top',[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
  ['bottom',[0,0,-1],[[-1,1,-1],[1,1,-1],[1,-1,-1],[-1,-1,-1]]]
];
export function cubeFaces(view) {
  const b=basis(view);
  return faces.map(([name,normal,vertices])=>{
    const points=vertices.map(v=>[50+dot(v,b.right)*23,50-dot(v,b.up)*23]);
    const [bottomLeft,bottomRight,,topLeft]=points;
    // Local text X follows the bottom edge; local text Y points down the face.
    const labelTransform=[(bottomRight[0]-bottomLeft[0])/46,(bottomRight[1]-bottomLeft[1])/46,(bottomLeft[0]-topLeft[0])/46,(bottomLeft[1]-topLeft[1])/46,points.reduce((sum,p)=>sum+p[0],0)/4,points.reduce((sum,p)=>sum+p[1],0)/4];
    return {name,depth:dot(normal,b.back),points,labelTransform};
  }).filter(face=>face.depth>0.001).sort((a,b)=>a.depth-b.depth);
}
export const CUBE_VIEWS = Object.fromEntries([-1,0,1].flatMap(x=>[-1,0,1].flatMap(y=>[-1,0,1].filter(z=>x||y||z).map(z=>{
  const name=[z>0?'top':z<0?'bottom':'',y<0?'front':y>0?'back':'',x<0?'left':x>0?'right':''].filter(Boolean).join('-');
  return [name,[x,y,z]];
}))));
export function alignCubeView(view,name) {
  const direction=CUBE_VIEWS[name];if(!direction)return;
  const [x,y,z]=direction;
  view.yaw=x||y?Math.atan2(x,-y):0;view.pitch=Math.atan2(z,Math.hypot(x,y));view.roll=0;view.projection??='perspective';
}
export function selectCubeView(view,name) {
  const direction=CUBE_VIEWS[name];if(!direction)return;
  const back=basis(view).back;
  const sameAxis=direction.filter(Boolean).length===1&&direction.every((value,i)=>Math.abs(value-back[i])<1e-5);
  if(sameAxis){
    const oppositeName=Object.keys(CUBE_VIEWS).find(key=>CUBE_VIEWS[key].every((value,i)=>value===-direction[i]));
    alignCubeView(view,oppositeName);
  }else alignCubeView(view,name);
}
export function homeCubeView(view) {
  const defaults=area().view;
  for(const key of ['yaw','pitch','zoom','panX','panY','target','roll'])view[key]=defaults[key];
  view.projection??='perspective';
}
export const isPoleView=view=>Math.abs(Math.abs(view.pitch)-Math.PI/2)<1e-5;
export function rotatePoleView(view,clockwise=true){
  if(!isPoleView(view))return false;
  view.roll=Math.atan2(Math.sin((view.roll||0)+(clockwise?1:-1)*Math.PI/2),Math.cos((view.roll||0)+(clockwise?1:-1)*Math.PI/2));return true;
}
// Divide each surface into a center, four edge strips, and four corner patches.
// Patches on adjacent surfaces share one target and one hover/focus highlight.
export function cubeRegions(view) {
  const visible=new Map(cubeFaces(view).map(face=>[face.name,face]));const regions=new Map();
  const cuts=[0,.2,.8,1];
  for(const [name,normal,vertices] of faces){
    const face=visible.get(name);if(!face)continue;
    const [p0,p1,,p3]=face.points;
    const right=vertices[1].map((v,i)=>(v-vertices[0][i])/2),up=vertices[3].map((v,i)=>(v-vertices[0][i])/2);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const direction=normal.map((v,i)=>v+(col-1)*right[i]+(row-1)*up[i]);
      const id=Object.keys(CUBE_VIEWS).find(key=>CUBE_VIEWS[key].every((v,i)=>v===direction[i]));
      if(!regions.has(id))regions.set(id,{name:id,direction,kind:direction.filter(Boolean).length===1?'face':direction.filter(Boolean).length===2?'edge':'corner',patches:[]});
      const point=(u,v)=>p0.map((value,i)=>value+u*(p1[i]-value)+v*(p3[i]-value));
      regions.get(id).patches.push([[cuts[col],cuts[row]],[cuts[col+1],cuts[row]],[cuts[col+1],cuts[row+1]],[cuts[col],cuts[row+1]]].map(([u,v])=>point(u,v)));
    }
  }
  return [...regions.values()];
}
export function cubeCommand(action) {
  const quarter=Math.PI/2;
  return {left:{action:'orbit',x:quarter/.008,y:0},right:{action:'orbit',x:-quarter/.008,y:0},up:{action:'orbit',x:0,y:quarter/.008},down:{action:'orbit',x:0,y:-quarter/.008},home:{action:'home'},clockwise:{action:'pole-roll',value:1},counterclockwise:{action:'pole-roll',value:-1}}[action];
}
export function mountViewCube(host,onAlign,onNavigate) {
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-label','Navigation view cube');host.append(svg);
  const surfaces=document.createElementNS(ns,'g'),targets=document.createElementNS(ns,'g'),labels=document.createElementNS(ns,'g');
  surfaces.classList.add('cube-surfaces');targets.classList.add('cube-targets');labels.classList.add('cube-labels');svg.append(surfaces,targets,labels);
  const elements=new Map(),regions=new Map();
  for(const [name] of faces){
    const polygon=document.createElementNS(ns,'polygon'),label=document.createElementNS(ns,'text');label.textContent=name.toUpperCase();label.setAttribute('x','0');label.setAttribute('y','0');surfaces.append(polygon);labels.append(label);elements.set(name,{polygon,label});
  }
  for(const [name,direction] of Object.entries(CUBE_VIEWS)){
    const group=document.createElementNS(ns,'g'),path=document.createElementNS(ns,'path'),title=document.createElementNS(ns,'title');
    const kind=direction.filter(Boolean).length===1?'face':direction.filter(Boolean).length===2?'edge':'corner';
    const label=name.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');
    group.dataset.cubeRegion=name;group.classList.add('cube-region','cube-region-'+kind);group.setAttribute('role','button');group.setAttribute('aria-label',label+' cube '+kind);title.textContent=label+' view';group.append(title,path);targets.append(group);regions.set(name,{group,path});
    group.addEventListener('click',()=>onAlign(name));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onAlign(name);}});
  }
  for(const [action,label,glyph] of [['left','View left','◀'],['right','View right','▶'],['up','View above','▲'],['down','View below','▼'],['home','Home','⌂'],['counterclockwise','Rotate counterclockwise','↶'],['clockwise','Rotate clockwise','↷']]){
    const button=document.createElement('button');button.type='button';button.className='cube-control cube-'+action;button.dataset.cubeControl=action;button.textContent=glyph;button.setAttribute('aria-label',action==='home'?label:label+' 90°');button.title=action==='home'?'Home · Default perspective view':label+' 90°';
    if(action==='home')button.title='Home · Top Front Right';
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    button.addEventListener('click',event=>{event.stopPropagation();onNavigate(cubeCommand(action));});host.append(button);
  }
  return view=>{
    host.querySelectorAll('.cube-clockwise,.cube-counterclockwise').forEach(button=>{button.hidden=!isPoleView(view);});
    for(const {polygon,label} of elements.values()){polygon.style.display='none';label.style.display='none';}
    for(const face of cubeFaces(view)){
      const {polygon,label}=elements.get(face.name);polygon.style.display='';label.style.display='';
      polygon.setAttribute('points',face.points.map(p=>p.join(',')).join(' '));
      const shade=Math.round(157+face.depth*38);polygon.style.fill=`rgb(${shade} ${shade+5} ${shade+13})`;
      label.setAttribute('transform',`matrix(${face.labelTransform.join(' ')})`);
    }
    for(const {group} of regions.values()){group.style.display='none';group.setAttribute('aria-hidden','true');group.setAttribute('tabindex','-1');}
    for(const region of cubeRegions(view)){
      const {group,path}=regions.get(region.name);group.style.display='';group.setAttribute('aria-hidden','false');group.setAttribute('tabindex','0');
      path.setAttribute('d',region.patches.map(points=>'M'+points.map(point=>point.join(',')).join('L')+'Z').join(' '));
    }
  };
}
