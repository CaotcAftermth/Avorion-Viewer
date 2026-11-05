import {CURSOR_NAMES,cursorCSS,drawBrushRing} from './viewport-cursors.js';

export function mountCursorTargets(host,store){
  const heading=document.createElement('p');heading.className='panel-note';heading.textContent='Target offset from artwork center. 0° right; 90° down. Changes apply immediately.';host.append(heading);
  const row=document.createElement('div');row.className='cursor-target-controls';
  const select=document.createElement('select');select.setAttribute('aria-label','Cursor Selection');
  for(const [id,name] of CURSOR_NAMES){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);}
  row.append(select);
  const make=(label,min,max)=>{const wrap=document.createElement('label');wrap.textContent=label+' ';const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=1;input.setAttribute('aria-label',label);const value=document.createElement('output');wrap.append(input,value);row.append(wrap);return {input,value};};
  const angle=make('Azimuth',0,360),distance=make('Distance from Center',0,48);host.append(row);
  const update=()=>{angle.input.value=store.value['cursorAngle_'+select.value];distance.input.value=store.value['cursorDistance_'+select.value];angle.value.textContent=angle.input.value+'°';distance.value.textContent=distance.input.value+' px';};
  angle.input.oninput=()=>store.set('cursorAngle_'+select.value,Number(angle.input.value));
  distance.input.oninput=()=>store.set('cursorDistance_'+select.value,Number(distance.input.value));select.onchange=update;
  update();return update;
}
export function mountCursorPreview(host,store){
  const heading=document.createElement('h3');heading.textContent='Live Preview · Actual Size';host.append(heading);
  const note=document.createElement('p');note.className='panel-note';note.textContent='Shown at actual CSS size. Red dot marks the click target. Brush ring shows a 24 px paint radius.';host.append(note);
  const grid=document.createElement('div');grid.className='cursor-preview-grid';host.append(grid);
  const previews=CURSOR_NAMES.map(([id,name])=>{
    const card=document.createElement('div'),label=document.createElement('div'),stage=document.createElement('div'),image=document.createElement('img'),dot=document.createElement('i');
    card.className='cursor-preview-card';label.textContent=name;stage.className='cursor-preview-stage';image.alt=name+' cursor preview';dot.className='cursor-preview-target';stage.append(image,dot);card.append(label,stage);grid.append(card);
    let canvas;if(id==='brush'||id==='restore'){canvas=document.createElement('canvas');canvas.width=160;canvas.height=150;stage.prepend(canvas);}
    return {id,stage,image,dot,canvas};
  });
  return ()=>{
    for(const {id,stage,image,dot,canvas} of previews){
      const css=cursorCSS(id,24,store.value),match=css.match(/url\("([^"]+)"\)\s+(\d+)\s+(\d+)/);
      image.src=match[1];image.style.left=(64-Number(match[2]))+'px';image.style.top=(55-Number(match[3]))+'px';stage.style.cursor=css;
      dot.style.left='64px';dot.style.top='55px';
      if(canvas){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,160,150);drawBrushRing(ctx,[64,55],24,store.value);}
    }
  };
}
