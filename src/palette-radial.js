const NS='http://www.w3.org/2000/svg';
const svg=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;};
const point=(r,angle)=>[200+r*Math.sin(angle*Math.PI/180),200-r*Math.cos(angle*Math.PI/180)];
function arc(inner,outer,start,end,sideInset=0){
 const radius=5,outerTrim=radius/outer*180/Math.PI,innerTrim=radius/inner*180/Math.PI;
 // Offset each straight side by a fixed distance, not a fixed angle: padding
 // then matches the outer radial inset throughout the full band thickness.
 const angle=(r,endSide)=>endSide?end-Math.asin(sideInset/r)*180/Math.PI:start+Math.asin(sideInset/r)*180/Math.PI;
 const edge=(r,endSide)=>point(r,angle(r,endSide));
 const os=angle(outer,false),oe=angle(outer,true),is=angle(inner,false),ie=angle(inner,true);
 return `M${point(outer,os+outerTrim)}A${outer} ${outer} 0 0 1 ${point(outer,oe-outerTrim)}Q${edge(outer,true)} ${edge(outer-radius,true)}L${edge(inner+radius,true)}Q${edge(inner,true)} ${point(inner,ie-innerTrim)}A${inner} ${inner} 0 0 0 ${point(inner,is+innerTrim)}Q${edge(inner,false)} ${edge(inner+radius,false)}L${edge(outer-radius,false)}Q${edge(outer,false)} ${point(outer,os+outerTrim)}Z`;
}
function clip(inner,outer,start,end){const pts=[];for(let i=0;i<=32;i++)pts.push(point(outer,start+(end-start)*i/32));for(let i=32;i>=0;i--)pts.push(point(inner,start+(end-start)*i/32));return 'polygon('+pts.map(p=>p.map(v=>v/4+'%').join(' ')).join(',')+')';}
export function renderPaletteRadial(host,{name,colors,selected,page,pages,onChoose,onPage}){
 host.replaceChildren();host.setAttribute('aria-label',name+' paint palette');
 const slots=Math.max(8,colors.length);
 colors.forEach((color,i)=>{
  const angle=i*360/slots,start=angle-180/slots+1.4,end=angle+180/slots-1.4;
  const button=document.createElement('button');button.type='button';button.className='radial-segment';button.setAttribute('role','menuitemradio');button.setAttribute('aria-label',color.name);button.setAttribute('aria-checked',String(selected===color.id));button.title=`${color.name} · ${color.hex}`;button.style.clipPath=clip(76,197,start,end);button.onclick=()=>onChoose(color.id);
  const graphic=svg('svg',{viewBox:'0 0 400 400','aria-hidden':'true'});
  graphic.append(svg('path',{d:arc(79,194,start,end),class:'radial-segment-body'}),svg('path',{d:arc(151,188,start,end,194-188),fill:color.hex,class:'radial-color-band'}));
  const [x,y]=point(119,angle),text=svg('text',{x,y,'text-anchor':'middle','dominant-baseline':'middle'});
  const words=color.name.split(' '),lines=[];let line='';for(const word of words){if(line&&(line+' '+word).length>12){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
  lines.forEach((line,j)=>{const span=svg('tspan',{x,dy:j===0?-(lines.length-1)*6:12});span.textContent=line;text.append(span);});graphic.append(text);button.append(graphic);host.append(button);
 });
 const hub=document.createElement('div');hub.className='radial-hub';const title=document.createElement('div');title.className='radial-palette-name';title.textContent=name;title.title=name;hub.append(title);
 const nav=document.createElement('div');nav.className='radial-pagination';
 const previous=document.createElement('button'),next=document.createElement('button'),counter=document.createElement('span');
 previous.type=next.type='button';previous.className='radial-page-half radial-page-previous';next.className='radial-page-half radial-page-next';previous.setAttribute('aria-label','Previous palette page');next.setAttribute('aria-label','Next palette page');previous.title='Previous page';next.title='Next page';previous.disabled=next.disabled=pages<=1;counter.textContent=`${page+1} / ${pages}`;
 previous.onclick=()=>onPage((page+pages-1)%pages);next.onclick=()=>onPage((page+1)%pages);const left=document.createElement('span'),right=document.createElement('span');left.textContent='‹';right.textContent='›';left.setAttribute('aria-hidden','true');right.setAttribute('aria-hidden','true');nav.append(left,counter,right);hub.append(previous,next,nav);host.append(hub);
}
