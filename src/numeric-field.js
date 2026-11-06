// Enhance native inputs rather than replacing their validation or domain handlers.
let active=null;
let trackingPointer=false,pointerTarget=null;
const pendingUI=[];
function trackPointerFocus(){
 if(trackingPointer)return;trackingPointer=true;
 document.addEventListener('pointerdown',event=>pointerTarget=event.target,true);
 const flush=()=>{pointerTarget=null;for(const update of pendingUI.splice(0))update();};
 document.addEventListener('pointerup',()=>setTimeout(flush,0),true);
 document.addEventListener('pointercancel',flush,true);
}
export const numericEditing=()=>!!active;
export function cancelNumericEdit(){active?.cancel();}
export function numericValue(value,{min=-Infinity,max=Infinity,step=0,base=Number.isFinite(min)?min:0}={}){
 if(!Number.isFinite(value))return null;
 value=Math.max(min,Math.min(max,value));
 if(step>0)value=Number((base+Math.round((value-base)/step)*step).toPrecision(15));
 return Math.max(min,Math.min(max,value));
}
export function numericFill(value,min,max){
 if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)return [0,0];
 const position=v=>100*Math.max(0,Math.min(1,(v-min)/(max-min)));
 const zero=position(Math.max(min,Math.min(max,0))),end=position(value);return [Math.min(zero,end),Math.max(zero,end)];
}
export function enhanceNumericFields(root,{begin=()=>{},end=()=>{},refresh=()=>{}}={}){
 trackPointerFocus();
 for(const input of root.querySelectorAll('input[type=number]:not([data-numeric]):not([data-stepper])')){
  if(input.readOnly)continue;
  input.dataset.numeric='';input.classList.add('numeric-field');input.readOnly=true;
  const handler=input.onchange,transaction=input.numericTransaction;
  const limits=()=>({min:input.min===''?-Infinity:Number(input.min),max:input.max===''?Infinity:Number(input.max),step:input.step==='any'?0:Number(input.step||1)});
  const initial=Number(input.value),defaultValue=Number(input.dataset.default??initial);
  const name=input.getAttribute('aria-label')||'';
  const unit=input.dataset.unit??(/turning speed/i.test(name)?'°/s':/rotation|elevation|azimuth|Camera yaw|Camera pitch|field of view|half-angle/i.test(name)?'°':/scale|Playback speed|Reference speed|Turret size/i.test(name)?'×':/seconds|duration|Seek time|start time|offset \(s\)|Step seconds/i.test(name)?'s':'');
  const shell=document.createElement('span');shell.className='numeric-shell';shell.dataset.unit=unit;input.before(shell);shell.append(input);
  let before=initial,beforeMixed=input.dataset.mixed,drag=null,editing=false,changed=false;
  const paint=()=>{const {min,max}=limits(),[start,end]=numericFill(Number(input.value),min,max);input.style.setProperty('--fill-start',start+'%');input.style.setProperty('--fill-end',end+'%');input.setAttribute('aria-valuenow',input.value);};
  const start=()=>{if(active&&active.input!==input)active.cancel();before=Number(input.value);beforeMixed=input.dataset.mixed;changed=false;(transaction?transaction.begin():begin(input));active={input,cancel:()=>finish(true)};};
  const apply=value=>{const n=numericValue(value,limits());if(n===null)return false;input.value=input.dataset.precision===undefined?n:n.toFixed(Math.min(12,Math.max(0,Number(input.dataset.precision)||0)));const readonly=input.readOnly;input.readOnly=false;const valid=input.checkValidity();input.readOnly=readonly;if(!valid)return false;input.dataset.mixed='false';changed ||= n!==before||beforeMixed==='true';
   if(transaction)transaction.update(n);else if(handler){handler.call(input,new Event('change'));input.onchange=onChange;}paint();return true;};
  const finish=cancel=>{
   if(!active||active.input!==input)return;
   const wasEditing=editing,shouldRefresh=changed||cancel||editing,leavingByPointer=wasEditing&&pointerTarget&&pointerTarget!==input;
   input.onchange=null;
   if(cancel){apply(before);input.onchange=null;input.value=before;input.dataset.mixed=beforeMixed||'false';}
   drag=null;editing=false;input.readOnly=true;input.classList.remove('numeric-editing');
   // Flush the browser's pending native change while our handler is suppressed.
   if(wasEditing&&!leavingByPointer&&document.activeElement===input){input.blur();input.focus({preventScroll:true});}
   active=null;if(transaction)transaction.end(cancel,changed);else end(cancel,changed);paint();
   const update=()=>{input.dispatchEvent(new CustomEvent('numeric-commit',{bubbles:true,detail:{cancelled:cancel}}));refresh();};
   // Let the destination's click run before rebuilding its Properties region.
   if(shouldRefresh){if(leavingByPointer)pendingUI.push(update);else update();}
   if(input.isConnected)input.onchange=onChange;
  };
  input.title=[input.title,'Drag to adjust · Shift: fine · Ctrl: stepped · Double-click or Enter: type · Esc: cancel · Alt+Backspace: reset'].filter(Boolean).join('\n');
  const onChange=()=>{if(!input.isConnected)return;if(!active)start();if(!apply(Number(input.value)))input.value=before;finish(false);};input.onchange=onChange;
  input.addEventListener('pointerdown',event=>{if(event.button!==0||input.disabled||editing)return;event.preventDefault();event.stopPropagation();input.focus();start();drag={x:event.clientX,value:before,moved:false};input.setPointerCapture(event.pointerId);});
  input.addEventListener('pointermove',event=>{if(!drag)return;event.stopPropagation();const dx=event.clientX-drag.x;if(!drag.moved&&Math.abs(dx)<3)return;drag.moved=true;
   const {step,min,max}=limits(),sensitivity=Number(input.dataset.sensitivity)||(step|| (Number.isFinite(min)&&Number.isFinite(max)?(max-min)/200:.1));
   let value=drag.value+dx*sensitivity*(event.shiftKey?.1:1);if(event.ctrlKey)value=Math.round(value/(step||1))*(step||1);apply(value);
  });
  input.addEventListener('pointerup',event=>{if(!drag)return;event.stopPropagation();input.releasePointerCapture(event.pointerId);finish(false);});
  input.addEventListener('pointercancel',()=>finish(true));
  input.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();start();editing=true;input.dataset.mixed='false';input.readOnly=false;input.classList.add('numeric-editing');input.focus();input.select();});
  input.addEventListener('keydown',event=>{
   if(!editing&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();if(transaction?.history)transaction.history(event.shiftKey);else input.dispatchEvent(new CustomEvent('property-history',{bubbles:true,detail:{redo:event.shiftKey}}));return;}
   if(event.key==='Escape'&&active?.input===input){event.preventDefault();event.stopPropagation();finish(true);return;}
   if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(editing){if(input.value!==''&&apply(Number(input.value)))finish(false);else{input.value=before;input.reportValidity();}}else{start();editing=true;input.dataset.mixed='false';input.readOnly=false;input.classList.add('numeric-editing');input.select();}return;}
   if(!editing&&((event.altKey&&event.key==='Backspace')||['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))){event.preventDefault();event.stopPropagation();start();const {step,min,max}=limits();let v=before+(['ArrowDown','ArrowLeft'].includes(event.key)?-1:1)*(step||.1)*(event.shiftKey?.1:1);
    if(event.altKey)v=defaultValue;if(event.key==='Home')v=Number.isFinite(min)?min:before;if(event.key==='End')v=Number.isFinite(max)?max:before;apply(v);finish(false);
   }
  });
  input.addEventListener('blur',()=>{if(editing){if(input.value===''||!apply(Number(input.value))){finish(true);return;}finish(false);}});
  // Programmatic value writes must update the fill, too.
  const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  Object.defineProperty(input,'value',{get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);paint();},configurable:true});
  paint();
 }
}
