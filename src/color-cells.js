// Shared color-cell presentation; existing picker and hex handlers stay intact.
export function colorCellContrast(hex){
  const rgb=hex.replace('#','').slice(-6).match(/../g).map(v=>parseInt(v,16)/255);
  const linear=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  return luminance>.179?'#000000':'#ffffff';
}
export function styleColorCell(input,hex){
  const value=hex.replace('#','');if(!/^(?:[\da-f]{6}|[\da-f]{8})$/i.test(value))return;
  input.classList.add('color-cell-readout');input.style.setProperty('--cell-color','#'+value.slice(-6));input.style.setProperty('--cell-ink',colorCellContrast(value));
}
export function enhanceColorCells(root){
  for(const input of root.querySelectorAll('input[type=color]')){
    let cell=input.closest('.color-cell');
    if(!cell){
      const parent=input.parentElement,hex=parent.querySelector('.preference-hex'),argb=parent.querySelector('.property-argb');
      cell=document.createElement('span');cell.className='color-cell';input.before(cell);cell.append(input);
      if(hex){hex.classList.add('color-cell-code');cell.append(hex);}
      else{const code=document.createElement('span');code.className='color-cell-code';cell.append(code);if(argb){cell.colorReadout=argb;argb.hidden=true;}}
    }
    const value=input.value.toUpperCase(),color=cell.style.getPropertyValue('--cell-color');
    if(color!==input.value){cell.style.setProperty('--cell-color',input.value);cell.style.setProperty('--cell-ink',colorCellContrast(value));}
    const code=cell.querySelector('.color-cell-code');
    if(code.tagName!=='INPUT'){const text=cell.colorReadout?.textContent.trim()||value;if(code.textContent!==text)code.textContent=text;}
  }
}
let watching=false;
export function installColorCells(){
  enhanceColorCells(document);
  if(watching)return;watching=true;
  let pending=false;const update=()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;enhanceColorCells(document);});};
  new MutationObserver(update).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('input',update);document.addEventListener('change',update);
}
