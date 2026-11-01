// Annotation coordinates are fractions of their view box. Font size uses a
// 400-pixel-high reference view, preserving proportions at every export size.
export function annotationGeometry(a,width,height,measure){
  const size=a.fontSize*height/400,x=a.x*width,y=a.y*height;
  const textWidth=measure(a.text,size),end={x:a.target.x*width,y:a.target.y*height};
  const start={x:Math.max(x,Math.min(x+textWidth,end.x)),y:y+size*.6};
  const angle=Math.atan2(end.y-start.y,end.x-start.x),length=Math.min(size*.55,Math.hypot(end.x-start.x,end.y-start.y)/3);
  const arrow=[end,{x:end.x-length*Math.cos(angle-.45),y:end.y-length*Math.sin(angle-.45)},{x:end.x-length*Math.cos(angle+.45),y:end.y-length*Math.sin(angle+.45)}];
  return {x,y,size,textWidth,start,end,arrow,lineWidth:Math.max(.5,height/400)};
}
export function drawBlueprintAnnotations(ctx,view,width,height){
  if(view.annotationsVisible===false)return;
  ctx.save();ctx.textAlign='left';ctx.textBaseline='top';
  for(const a of view.annotations||[]){
    const g=annotationGeometry(a,width,height,(text,size)=>{ctx.font=`${size}px Arial`;return ctx.measureText(text).width;});
    ctx.fillStyle=ctx.strokeStyle=a.color;ctx.lineWidth=g.lineWidth;
    if(a.leader){ctx.beginPath();ctx.moveTo(g.start.x,g.start.y);ctx.lineTo(g.end.x,g.end.y);ctx.stroke();
      if(a.arrow){ctx.beginPath();g.arrow.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}}
    ctx.font=`${g.size}px Arial`;ctx.fillText(a.text,g.x,g.y);
  }ctx.restore();
}
export function validateAnnotations(view){
  if(view.dimensionFontSize!==undefined&&(!Number.isFinite(view.dimensionFontSize)||view.dimensionFontSize<6||view.dimensionFontSize>96))throw Error('Dimensions font size must be between 6 and 96.');
  if(view.name!==undefined&&(typeof view.name!=='string'||view.name.length>100))throw Error('View names must contain at most 100 characters.');
  for(const key of ['dimensions','dimensionCage','annotationsVisible'])if(view[key]!==undefined&&typeof view[key]!=='boolean')throw Error('Invalid view display setting.');
  if(view.annotations===undefined)return;
  if(!Array.isArray(view.annotations)||view.annotations.length>50)throw Error('Each view supports up to 50 annotations.');
  for(const a of view.annotations){
    if(!a||typeof a.text!=='string'||a.text.length>200||!Number.isFinite(a.fontSize)||a.fontSize<6||a.fontSize>96||!/^#[0-9a-f]{6}$/i.test(a.color)||typeof a.leader!=='boolean'||typeof a.arrow!=='boolean')throw Error('Invalid annotation text or style.');
    if(!a.target||[a.x,a.y,a.target.x,a.target.y].some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('Annotations must stay inside their view box.');
  }
}
