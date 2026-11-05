import {CURSOR_NAMES,cursorCSS,cursorVisual,drawBrushRing} from './viewport-cursors.js';

// Keep the artwork center fixed while matching the native cursor's scaled hotspot.
export function cursorPreviewLayout(id,preferences,size=192){
 const visual=cursorVisual(id,24,preferences),css=cursorCSS(id,24,preferences),match=css.match(/url\("([^"]+)"\)\s+(\d+)\s+(\d+)/);
 const compact=Math.min(1,128/Math.max(visual.width,visual.height)),width=Math.round(visual.width*compact),height=Math.round(visual.height*compact),ratio=Math.min(width/visual.width,height/visual.height);
 const left=size/2-visual.artworkCenter[0]*ratio-(width-visual.width*ratio)/2,top=size/2-visual.artworkCenter[1]*ratio-(height-visual.height*ratio)/2;
 return {css,src:match[1],left,top,target:[left+Number(match[2]),top+Number(match[3])]};
}
export function mountCursorTargets(host,store){
 const heading=document.createElement('p');heading.className='panel-note';heading.textContent='Target offset from artwork center. 0° right; 90° down. Changes apply immediately.';host.append(heading);
 const row=document.createElement('div');row.className='cursor-target-controls';const fields=document.createElement('div');fields.className='cursor-target-fields';row.append(fields);
 const select=document.createElement('select');select.setAttribute('aria-label','Cursor Selection');
 for(const [id,name] of CURSOR_NAMES)select.add(new Option(name,id));fields.append(select);
 const make=(label,min,max)=>{const wrap=document.createElement('label'),caption=document.createElement('span');caption.textContent=label;const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=1;input.setAttribute('aria-label',label);const value=document.createElement('output');wrap.append(caption,input,value);fields.append(wrap);return {input,value};};
 const angle=make('Azimuth',0,360),distance=make('Distance from Center',0,48);host.append(row);
 const preview=mountCursorPreview(row,store,()=>select.value);
 const update=()=>{angle.input.value=store.value['cursorAngle_'+select.value];distance.input.value=store.value['cursorDistance_'+select.value];angle.value.textContent=angle.input.value+'°';distance.value.textContent=distance.input.value+' px';preview();};
 angle.input.oninput=()=>{store.set('cursorAngle_'+select.value,Number(angle.input.value));update();};distance.input.oninput=()=>{store.set('cursorDistance_'+select.value,Number(distance.input.value));update();};select.onchange=update;update();return update;
}
export function mountCursorPreview(host,store,selected=()=> 'select'){
 const stage=document.createElement('div');stage.className='cursor-preview-stage cursor-target-preview';stage.setAttribute('aria-label','Selected cursor live preview');
 const image=document.createElement('img'),dot=document.createElement('i'),canvas=document.createElement('canvas');canvas.width=canvas.height=192;dot.className='cursor-preview-target';stage.append(canvas,image,dot);host.append(stage);
 return ()=>{const id=selected(),layout=cursorPreviewLayout(id,store.value);image.alt=(CURSOR_NAMES.find(item=>item[0]===id)?.[1]||id)+' cursor preview';image.src=layout.src;image.style.left=layout.left+'px';image.style.top=layout.top+'px';stage.style.cursor=layout.css;dot.style.left=layout.target[0]+'px';dot.style.top=layout.target[1]+'px';const ctx=canvas.getContext('2d');ctx.clearRect(0,0,192,192);if(id==='brush'||id==='restore')drawBrushRing(ctx,layout.target,24,store.value);};
}
