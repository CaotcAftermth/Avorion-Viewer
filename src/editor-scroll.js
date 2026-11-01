// Scroll belongs to an editor area/category, not to the DOM nodes rebuilt by it.
const positions=new Map();
const selectors=['.area-body','.property-content','.preferences-content','.color-editor-main','.color-wheel-pane','.color-list-pane','.viewport-sidebar'];
function key(area){return area.dataset.areaId+':'+area.dataset.scrollContext;}
export function rememberEditorScroll(root){
 for(const area of root.querySelectorAll('.area[data-scroll-context]')){
  if(area.dataset.editor==='info')continue;
  positions.set(key(area),selectors.flatMap(selector=>[...area.querySelectorAll(selector)].map((el,index)=>({selector,index,top:el.scrollTop,left:el.scrollLeft}))));
 }
}
export function restoreEditorScroll(root){
 for(const area of root.querySelectorAll('.area[data-scroll-context]'))for(const entry of positions.get(key(area))||[]){const el=area.querySelectorAll(entry.selector)[entry.index];if(el){el.scrollTop=entry.top;el.scrollLeft=entry.left;}}
}
let cancelPending=()=>{};
export function restoreEditorScrollAfterLayout(root){
 cancelPending();
 const controller=new AbortController();let timer;
 const observer=new ResizeObserver(()=>restoreEditorScroll(root));
 const stop=()=>{observer.disconnect();controller.abort();clearTimeout(timer);};
 cancelPending=stop;
 // Nested split areas acquire their final dimensions over successive layout
 // passes. Reapply while those dimensions settle, but never fight new input.
 for(const area of root.querySelectorAll('.area[data-scroll-context]'))for(const selector of selectors)for(const el of area.querySelectorAll(selector))observer.observe(el);
 for(const event of ['wheel','pointerdown','keydown'])root.addEventListener(event,stop,{capture:true,signal:controller.signal});
 timer=setTimeout(stop,250);restoreEditorScroll(root);
}
