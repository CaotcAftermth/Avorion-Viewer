import { EDITORS } from './layout.js';

// Derive drawers from the saved split tree without changing its editor state.
export function trackpadLayout(root) {
  const regions=[];
  function visit(node,x=0,y=0,width=1,height=1){
    if(node.type==='area'){regions.push({node,x,y,width,height});return;}
    const r=node.ratio;
    if(node.axis==='x'){visit(node.first,x,y,width*r,height);visit(node.second,x+width*r,y,width*(1-r),height);}
    else {visit(node.first,x,y,width,height*r);visit(node.second,x,y+height*r,width,height*(1-r));}
  }
  visit(root);
  const primary=regions.filter(r=>r.node.editor==='viewport').sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  if(!primary)return null;
  const groups={left:[],right:[],top:[],bottom:[]};
  for(const r of regions){
    if(r.node.editor==='viewport')continue;
    const dx=(r.x+r.width/2-primary.x-primary.width/2)/(r.width+primary.width);
    const dy=(r.y+r.height/2-primary.y-primary.height/2)/(r.height+primary.height);
    groups[Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'top':'bottom'].push(r);
  }
  function viewports(node){
    if(node.type==='area')return node.editor==='viewport'?node:null;
    const first=viewports(node.first),second=viewports(node.second);
    return first&&second?{...node,first,second}:first||second;
  }
  return {root:viewports(root),groups};
}

export function mountTrackpadLayout(screen,layout,renderArea,renderNode,state){
  const stage=document.createElement('div');stage.className='trackpad-stage';
  stage.append(renderNode(layout.root));
  const drawers=[],tabs=[];
  function reveal(side,focus=false){
    state.side=side;
    for(const drawer of drawers){const open=drawer.dataset.side===side;drawer.classList.toggle('open',open);drawer.inert=!open;drawer.setAttribute('aria-hidden',String(!open));}
    for(const tab of tabs)tab.setAttribute('aria-expanded',String(tab.dataset.side===side));
    if(focus)drawers.find(d=>d.dataset.side===side)?.querySelector('button,input,select,[tabindex="0"]')?.focus();
  }
  for(const [side,regions] of Object.entries(layout.groups)){
    if(!regions.length)continue;
    const drawer=document.createElement('aside');drawer.className='trackpad-drawer';drawer.dataset.side=side;drawer.id='trackpad-drawer-'+side;
    drawer.setAttribute('aria-label',side+' editors');
    const x=Math.min(...regions.map(r=>r.x)),y=Math.min(...regions.map(r=>r.y));
    const w=Math.max(...regions.map(r=>r.x+r.width))-x,h=Math.max(...regions.map(r=>r.y+r.height))-y;
    for(const r of regions){const slot=document.createElement('div');slot.className='trackpad-drawer-slot';Object.assign(slot.style,{left:(r.x-x)/w*100+'%',top:(r.y-y)/h*100+'%',width:r.width/w*100+'%',height:r.height/h*100+'%'});slot.append(renderArea(r.node));drawer.append(slot);}
    const tab=document.createElement('button');tab.className='trackpad-edge';tab.dataset.side=side;
    const handle=document.createElement('span');handle.textContent={left:'›',right:'‹',top:'⌄',bottom:'⌃'}[side];handle.setAttribute('aria-hidden','true');tab.append(handle);
    tab.setAttribute('aria-label',`Show ${side} editors: ${regions.map(r=>EDITORS[r.node.editor]).join(', ')}`);
    tab.title=tab.getAttribute('aria-label');tab.setAttribute('aria-controls',drawer.id);
    tab.addEventListener('click',e=>{e.stopPropagation();reveal(state.side===side?null:side,e.detail===0);});
    drawers.push(drawer);tabs.push(tab);stage.append(drawer,tab);
  }
  // Capture closes drawers without rebuilding the canvas or swallowing selection/paint.
  stage.addEventListener('pointerdown',event=>{if(event.button===0&&event.target.closest('.area[data-editor="viewport"]'))reveal(null);},{capture:true});
  stage.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.side){const tab=tabs.find(t=>t.dataset.side===state.side);reveal(null);tab?.focus();event.preventDefault();event.stopPropagation();}});
  reveal(state.side);screen.append(stage);
}
