import {cubeFaces} from '../view-cube.js';
import {viewLabel} from '../navigation.js';
// Capture overlay drawing instructions, never pixels from the live viewport.
// SVG styles are inlined so navigation glyphs remain entirely local.
export async function captureViewportOverlays(canvas){
  if(!canvas)return [];
  const base=canvas.getBoundingClientRect(),commands=[];
  const roots=canvas.parentElement.querySelectorAll('.viewport-meta,.viewport-statistics,.viewport-footer,.viewport-performance,.navigation');
  const visit=async(node,group)=>{
    const style=getComputedStyle(node),rect=node.getBoundingClientRect();
    if(style.display==='none'||style.visibility==='hidden'||node.hidden||!rect.width||!rect.height)return;
    const box={x:rect.left-base.left,y:rect.top-base.top,width:rect.width,height:rect.height};
    if(node instanceof SVGElement){
      const clone=node.cloneNode(true),originals=[node,...node.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
      originals.forEach((el,i)=>{const css=getComputedStyle(el);for(const key of ['fill','stroke','stroke-width','opacity','display','font-family','font-size','font-weight','text-anchor','dominant-baseline'])copies[i].style.setProperty(key,css.getPropertyValue(key));});
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',rect.width);clone.setAttribute('height',rect.height);
      const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));await image.decode();
      commands.push({group,type:'image',image,...box});return;
    }
    if(style.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(style.borderTopWidth)>0)commands.push({group,type:'rect',color:style.backgroundColor,border:style.borderTopColor,lineWidth:parseFloat(style.borderTopWidth)||0,radius:style.borderRadius.includes('%')?Math.min(rect.width,rect.height)/2:parseFloat(style.borderRadius)||0,...box});
    for(const child of node.childNodes){
      if(child.nodeType===Node.ELEMENT_NODE)await visit(child,group);
      else if(child.nodeType===Node.TEXT_NODE&&child.textContent.trim()){
        const range=document.createRange();range.selectNodeContents(child);const r=range.getBoundingClientRect();
        commands.push({group,type:'text',text:child.textContent,x:r.left-base.left,y:r.top-base.top,font:style.font,lineHeight:parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.2,color:style.color});
      }
    }
  };
  for(const root of roots)await visit(root,root.classList.contains('navigation')?'gizmos':'labels');
  return commands;
}
export function drawCapturedOverlays(ctx,commands,options,sourceSize,width,height,view,snapshot){
  ctx.save();ctx.scale(width/sourceSize.width,height/sourceSize.height);ctx.textBaseline='top';
  const changed=options.camera!=='current'||options.projection&&options.projection!=='current';
  for(const c of commands){
    if(!options[c.group]||changed)continue;
    if(c.type==='image')ctx.drawImage(c.image,c.x,c.y,c.width,c.height);
    else if(c.type==='rect'){ctx.beginPath();ctx.roundRect(c.x,c.y,c.width,c.height,c.radius);ctx.fillStyle=c.color;ctx.fill();if(c.lineWidth){ctx.lineWidth=c.lineWidth;ctx.strokeStyle=c.border;ctx.stroke();}}
    else{ctx.font=c.font;ctx.fillStyle=c.color;c.text.split('\n').forEach((text,i)=>ctx.fillText(text,c.x,c.y+i*c.lineHeight));}
  }
  if(options.labels&&(changed||!commands.some(c=>c.group==='labels'))){ctx.font='12px sans-serif';ctx.fillStyle='#ddd';ctx.fillText(viewLabel(view),12,12);ctx.fillText(snapshot.shipName,12,30);}
  if(options.gizmos&&(changed||!commands.some(c=>c.group==='gizmos'))){
    ctx.save();ctx.translate(sourceSize.width-110,8);ctx.font='8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    for(const face of cubeFaces(view)){
      ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=`rgb(${157+face.depth*38} ${162+face.depth*38} ${170+face.depth*38})`;ctx.fill();ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.stroke();
      ctx.save();ctx.transform(...face.labelTransform);ctx.fillStyle='#222';ctx.fillText(face.name.toUpperCase(),0,0);ctx.restore();
    }ctx.restore();
  }
  ctx.restore();
}
export function drawBlueprintPage(ctx,options,snapshot,width,height,foreground=false){
  const unit=Math.max(.1,Math.min(width,height)/800);
  ctx.save();ctx.scale(unit,unit);const w=width/unit,h=height/unit;
  if(!foreground&&options.pageGrid){
    ctx.strokeStyle='#6da1c02b';ctx.lineWidth=.6;ctx.beginPath();
    for(let x=0;x<w;x+=25){ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let y=0;y<h;y+=25){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
  }
  if(foreground&&options.titleBlock){
    ctx.fillStyle=options.background==='transparent'?'#10283fe8':options.backgroundColor;ctx.fillRect(20,h-82,w-40,62);
    ctx.strokeStyle='#9bc6e0';ctx.lineWidth=1;ctx.strokeRect(20,h-82,w-40,62);
    ctx.fillStyle='#d2eaff';ctx.font='bold 18px sans-serif';ctx.textBaseline='top';ctx.fillText(options.shipName||snapshot.shipName,32,h-71,w-64);
    ctx.font='11px monospace';ctx.fillText(`AVORION · ${(options.blueprintLayout==='multi'?'MULTI-VIEW':options.blueprintSettings?.single?.name??(options.blueprintSettings?.single?.orientation?'CUSTOM':options.camera.toUpperCase()))} · DIMENSIONS IN MODEL UNITS`,32,h-41,w-64);
  }
  ctx.restore();
}
