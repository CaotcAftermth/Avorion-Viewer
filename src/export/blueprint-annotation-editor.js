import {annotationGeometry} from './blueprint-annotations.js';

export function mountAnnotationEditor(stage,{panels,views,selectView,changed}){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('blueprint-annotations');stage.append(svg);
  const measure=document.createElement('canvas').getContext('2d');let selectedView=0,selected=-1,drag;
  const editors=new Map(),clamp=v=>Math.max(0,Math.min(1,v));
  function node(tag,attrs={},text){const n=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);if(text!==undefined)n.textContent=text;return n;}
  function select(index,item){selectView(index);selectedView=index;selected=item;for(const editor of editors.values())editor.sync();editors.get(index)?.reveal();refresh();}
  function refresh(){
    svg.replaceChildren();let boxes;try{boxes=panels();}catch{return;}
    const width=Number(stage.dataset.width),height=Number(stage.dataset.height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    boxes.forEach((p,index)=>{
      const view=views()[index];if(view.annotationsVisible===false)return;
      const clip=node('clipPath',{id:`annotation-clip-${index}`});clip.append(node('rect',{x:p.x,y:p.y,width:p.width,height:p.height}));svg.append(clip);
      const group=node('g',{'clip-path':`url(#annotation-clip-${index})`});svg.append(group);
      (view.annotations||[]).forEach((a,item)=>{
        const g=annotationGeometry(a,p.width,p.height,(text,size)=>{measure.font=`${size}px Arial`;return measure.measureText(text).width;});
        const part=node('g',{transform:`translate(${p.x} ${p.y})`});group.append(part);
        const selectedHere=index===selectedView&&item===selected;
        if(a.leader){part.append(node('line',{x1:g.start.x,y1:g.start.y,x2:g.end.x,y2:g.end.y,stroke:a.color,'stroke-width':g.lineWidth}));
          if(a.arrow)part.append(node('polygon',{points:g.arrow.map(p=>`${p.x},${p.y}`).join(' '),fill:a.color,stroke:'none'}));}
        const text=node('text',{x:g.x,y:g.y,fill:a.color,stroke:'none','font-family':'Arial','font-size':g.size,'dominant-baseline':'text-before-edge'},a.text);part.append(text);
        const hit=node('rect',{x:g.x,y:g.y,width:Math.max(g.textWidth,g.size),height:g.size*1.25,fill:'transparent',stroke:selectedHere?'#f3ca6a':'none','stroke-width':g.lineWidth,'data-annotation':'text','data-view':index,'data-item':item,tabindex:0,role:'button','aria-label':`Move annotation ${item+1} in view ${index+1}`});part.append(hit);
        if(selectedHere&&a.leader)part.append(node('circle',{cx:g.end.x,cy:g.end.y,r:Math.max(g.size*.35,p.height*.025),fill:'#10283f',stroke:a.color,'stroke-width':g.lineWidth,'data-annotation':'target','data-view':index,'data-item':item,tabindex:0,role:'button','aria-label':'Move annotation reference point'}));
      });
    });
  }
  svg.addEventListener('pointerdown',event=>{
    const hit=event.target.closest('[data-annotation]');if(!hit||event.button!==0)return;event.preventDefault();event.stopPropagation();
    const index=Number(hit.dataset.view),item=Number(hit.dataset.item),kind=hit.dataset.annotation;select(index,item);
    const a=views()[index].annotations[item];drag={id:event.pointerId,index,item,kind,x:event.clientX,y:event.clientY,before:structuredClone(a)};svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;event.stopPropagation();
    const p=panels()[drag.index],rect=stage.getBoundingClientRect(),a=views()[drag.index].annotations[drag.item];
    const dx=(event.clientX-drag.x)/rect.width*Number(stage.dataset.width)/p.width,dy=(event.clientY-drag.y)/rect.height*Number(stage.dataset.height)/p.height;
    const target=drag.kind==='target'?a.target:a,before=drag.kind==='target'?drag.before.target:drag.before;
    target.x=clamp(before.x+dx);target.y=clamp(before.y+dy);refresh();
  });
  function finish(event,cancel=false){if(!drag||event.pointerId!==drag.id)return;event.stopPropagation();if(cancel)views()[drag.index].annotations[drag.item]=drag.before;drag=null;if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);changed();refresh();}
  svg.addEventListener('pointerup',event=>finish(event));svg.addEventListener('pointercancel',event=>finish(event,true));
  svg.addEventListener('lostpointercapture',()=>{drag=null;});
  svg.addEventListener('keydown',event=>{
    const hit=event.target.closest('[data-annotation]');if(!hit)return;
    const index=Number(hit.dataset.view),item=Number(hit.dataset.item);if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();select(index,item);}
  });
  function mount(host,view,index,field,el){
    const title=`View ${index+1}`,section=el('details');section.className='blueprint-subsection';section.append(el('summary','Annotations'));host.append(section);
    const list=el('select'),newText=el('input'),add=el('button','Add annotation'),row=el('div');row.className='blueprint-annotation-add';
    view.annotations??=[];view.annotationsVisible??=true;
    field(section,'View Annotations','checkbox',view.annotationsVisible,value=>{view.annotationsVisible=value;refresh();});
    newText.type='text';newText.maxLength=200;newText.placeholder='New annotation';newText.setAttribute('aria-label',`${title} new annotation`);
    add.type='button';row.append(newText,add);section.append(row);
    list.size=3;list.setAttribute('aria-label',`${title} annotations`);section.append(list);
    const style=el('div');style.className='blueprint-annotation-style';section.append(style);let local=-1;
    const item=()=>view.annotations[local];
    const text=field(style,`${title} annotation text`,'text','',value=>{if(item()){item().text=value;list.options[local].text=value||'(empty)';}refresh();});text.maxLength=200;text.previousElementSibling.textContent='Text';
    const size=field(style,'Annotation font size','number',18,value=>{if(item())item().fontSize=value;refresh();},{min:6,max:96});size.previousElementSibling.textContent='Font size';
    size.title='Font size relative to a 400-pixel-high view. Scales with export resolution.';
    const color=field(style,'Annotation color','color','#b8e0ff',value=>{if(item())item().color=value;refresh();});color.previousElementSibling.textContent='Color';
    const leader=field(style,'Leader line','checkbox',true,value=>{if(item())item().leader=value;sync();refresh();});
    const arrow=field(style,'Arrow at reference point','checkbox',true,value=>{if(item())item().arrow=value;refresh();});
    function sync(){
      local=selectedView===index?selected:-1;
      list.replaceChildren();view.annotations.forEach((a,i)=>list.add(new Option(a.text||'(empty)',i)));list.value=local;
      const a=item();style.hidden=!a;add.disabled=!a&&view.annotations.length>=50;
      add.textContent=a?'Delete annotation':'Add annotation';add.setAttribute('aria-label',a?`Delete annotation from ${title}`:`Add annotation to ${title}`);
      if(a){text.value=a.text;size.value=a.fontSize;color.value=a.color;leader.checked=a.leader;arrow.checked=a.arrow;arrow.disabled=!a.leader;}
    }
    newText.onfocus=()=>select(index,-1);
    newText.oninput=()=>{if(item())select(index,-1);};
    newText.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();select(index,-1);add.click();}};
    add.onclick=()=>{if(item()){view.annotations.splice(local,1);select(index,-1);changed();return;}if(!newText.value.trim()||view.annotations.length>=50)return;view.annotations.push({text:newText.value,fontSize:18,color:'#b8e0ff',x:.08,y:.12,target:{x:.5,y:.5},leader:true,arrow:true});newText.value='';select(index,view.annotations.length-1);changed();};
    list.onchange=()=>select(index,Number(list.value));editors.set(index,{sync,reveal(){
      section.open=true;const inspector=host.closest('.blueprint-sidebar');
      if(inspector?.offsetParent){const bounds=inspector.getBoundingClientRect(),rect=section.getBoundingClientRect();if(rect.top<bounds.top||rect.bottom>bounds.bottom)inspector.scrollTop+=rect.top-bounds.top;}
    }});sync();
    section.append(el('p','Drag text to position it. Drag the circular leader handle to a reference point.'));
  }
  return {mount,refresh,reset(){editors.clear();selected=-1;selectedView=0;},selectView(index){selectedView=index;selected=-1;for(const editor of editors.values())editor.sync();refresh();}};
}
