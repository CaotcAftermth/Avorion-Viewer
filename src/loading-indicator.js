// Circular progress ring shared by model loading, texture loading and exports.
// A percentage shows real progress; null shows a spinning arc for work that
// reports no steps (for example a background geometry build).
// The stylesheet travels with the module so every page that uses it is styled.
if(typeof document!=='undefined'&&!document.querySelector('link[data-loading-indicator]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./loading-indicator.css',import.meta.url).href;link.dataset.loadingIndicator='';document.head.append(link);
}
const SVG='http://www.w3.org/2000/svg',RADIUS=42,CIRCUMFERENCE=2*Math.PI*RADIUS;

export function ringOffset(percent){
  const p=Math.min(100,Math.max(0,Number(percent)||0));
  return CIRCUMFERENCE*(1-p/100);
}

export function createProgressRing({size=72}={}){
  const root=document.createElement('div');root.className='progress-ring';root.style.setProperty('--ring-size',`${size}px`);
  root.setAttribute('role','progressbar');root.setAttribute('aria-valuemin','0');root.setAttribute('aria-valuemax','100');
  const svg=document.createElementNS(SVG,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');
  const circle=cls=>{const c=document.createElementNS(SVG,'circle');c.setAttribute('class',cls);c.setAttribute('cx','50');c.setAttribute('cy','50');c.setAttribute('r',String(RADIUS));return c;};
  const track=circle('progress-ring-track'),arc=circle('progress-ring-arc');
  arc.style.strokeDasharray=String(CIRCUMFERENCE);arc.style.strokeDashoffset=String(CIRCUMFERENCE);
  svg.append(track,arc);
  const label=document.createElement('span');label.className='progress-ring-value';
  root.append(svg,label);
  function set(percent){
    const indeterminate=percent===null||percent===undefined||!Number.isFinite(Number(percent));
    root.classList.toggle('indeterminate',indeterminate);
    if(indeterminate){arc.style.strokeDashoffset=String(CIRCUMFERENCE*.72);label.textContent='';root.removeAttribute('aria-valuenow');return;}
    const p=Math.round(Math.min(100,Math.max(0,Number(percent))));
    arc.style.strokeDashoffset=String(ringOffset(p));label.textContent=`${p}%`;root.setAttribute('aria-valuenow',String(p));
  }
  set(0);
  return {element:root,set};
}

// Mirror an existing <progress> element with a ring placed in front of it.
// The dialogs keep driving their <progress> as before; the ring follows its
// value and hidden state, and the native bar is hidden by CSS.
export function ringForProgress(progress,{size=40,anchor=progress}={}){
  if(!progress||progress.dataset.ring)return null;
  const ring=createProgressRing({size});ring.element.classList.add('progress-ring-inline');ring.element.setAttribute('aria-hidden','true');
  progress.dataset.ring='1';anchor.before(ring.element);
  const sync=()=>{ring.element.hidden=progress.hidden;ring.set(progress.hasAttribute('value')?progress.value/(progress.max||100)*100:null);};
  new MutationObserver(sync).observe(progress,{attributes:true,attributeFilter:['value','hidden','max']});
  sync();
  return ring;
}

// One app-wide overlay. Several tasks may overlap (textures and a model from
// the same drop); the newest one is shown and the overlay hides when all end.
let overlay,ring,title,detail,showTimer=0;
const tasks=[];
function ensureOverlay(){
  if(overlay)return;
  overlay=document.createElement('div');overlay.id='loading-indicator';overlay.hidden=true;
  overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
  if('popover' in HTMLElement.prototype)overlay.popover='manual';
  ring=createProgressRing({size:76});
  const text=document.createElement('div');text.className='loading-indicator-text';
  title=document.createElement('b');detail=document.createElement('span');text.append(title,detail);
  overlay.append(ring.element,text);document.body.append(overlay);
}
function present(){
  const task=tasks.at(-1);
  if(!task){clearTimeout(showTimer);showTimer=0;if(overlay&&!overlay.hidden){overlay.hidden=true;try{overlay.hidePopover?.();}catch{}}return;}
  ensureOverlay();ring.set(task.percent);title.textContent=task.label;detail.textContent=task.message||'';detail.hidden=!task.message;
  // Short work finishes before the ring would flash; reveal it after a beat.
  if(overlay.hidden&&!showTimer){if(task.delay>0)showTimer=setTimeout(reveal,task.delay);else reveal();}
}
function reveal(){
  showTimer=0;if(!tasks.length)return;
  overlay.hidden=false;
  // Re-entering the top layer keeps the ring above dialogs opened after it.
  try{if(overlay.popover){if(overlay.matches(':popover-open'))overlay.hidePopover();overlay.showPopover();}}catch{}
}

export function startLoading(label,{percent=0,message='',delay=120}={}){
  const task={label,percent,message,delay};tasks.push(task);present();
  return {
    update(nextPercent,nextMessage){if(!tasks.includes(task))return;task.percent=nextPercent;if(nextMessage!==undefined)task.message=nextMessage;present();},
    done(){const i=tasks.indexOf(task);if(i<0)return;tasks.splice(i,1);present();},
  };
}

// Let the browser paint the ring before synchronous work blocks the thread.
export function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}
