import { setDisabled } from './control-state.js';
import { icon } from './icons.js';
const liveCache=new WeakMap(),idCache=new WeakMap();
export function blockIds(scene){const live=liveBlocks(scene);let ids=idCache.get(live);if(!ids){ids=new Set(live.map(b=>b.id));idCache.set(live,ids);}return ids;}
export function liveBlocks(scene){
  const cached=liveCache.get(scene);
  if(scene.revision!==undefined&&cached?.model===scene.model&&cached.revision===scene.revision&&cached.loaded===scene.loaded&&cached.length===scene.model?.blocks.length)return cached.blocks;
  const blocks=uncachedLiveBlocks(scene);liveCache.set(scene,{model:scene.model,revision:scene.revision,loaded:scene.loaded,length:scene.model?.blocks.length,blocks});return blocks;
}
function uncachedLiveBlocks(scene){return scene.loaded?(scene.model?.blocks||[]).filter(b=>!b.deleted&&(!b.el||b.el.isConnected)):[];}
export function simplified(scene,p){return liveBlocks(scene).length>p.simplifyThreshold;}
export function groupedBlocks(scene,grouping='type',query=''){
  const text=query.trim().toLowerCase(),groups=new Map();
  for(const block of liveBlocks(scene)){
    if(text&&![block.type,block.material,block.id].some(v=>String(v).toLowerCase().includes(text)))continue;
    const name=String(grouping==='material'?block.material:block.type);
    if(!groups.has(name))groups.set(name,[]);groups.get(name).push(block);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([name,blocks])=>({name,blocks,ids:blocks.map(b=>b.id)}));
}
export function reconcileStructure(scene){
  const ids=blockIds(scene);
  for(const key of ['selectedIds','hiddenIds']){const old=scene[key]||new Set(),next=new Set([...old].filter(id=>ids.has(id)));if(!scene[key]||old.size!==next.size)scene[key]=next;}
  scene.selected=scene.selectedIds.size>0;scene.selectedId=[...scene.selectedIds].at(-1)||null;
}
export function selectBlocks(scene,ids,additive=false){
  reconcileStructure(scene);const live=blockIds(scene),targets=ids.filter(id=>live.has(id));
  if(!additive)scene.selectedIds=new Set(targets);
  else{scene.selectedIds=new Set(scene.selectedIds);const remove=targets.every(id=>scene.selectedIds.has(id));for(const id of targets)remove?scene.selectedIds.delete(id):scene.selectedIds.add(id);}
  reconcileStructure(scene);
}
export function setBlockVisibility(scene,ids,action){
  reconcileStructure(scene);const all=liveBlocks(scene).map(b=>b.id),live=blockIds(scene),targets=ids.filter(id=>live.has(id));
  const before=scene.hiddenIds;
  if(action==='last'){const previous=scene.visibilityHistory?.pop();if(previous){scene.hiddenIds=new Set(scene.hiddenIds);for(const id of previous.added)scene.hiddenIds.delete(id);for(const id of previous.removed)if(live.has(id))scene.hiddenIds.add(id);}return;}
  scene.hiddenIds=new Set(scene.hiddenIds);
  if(action==='all'){scene.hiddenIds.clear();scene.visibilityHistory=[];}
  else if(action==='isolate'){const visible=new Set(targets);scene.hiddenIds=new Set(all.filter(id=>!visible.has(id)));}
  else{
    const hide=action==='hide'||(action==='toggle'&&targets.some(id=>!scene.hiddenIds.has(id)));
    for(const id of targets)hide?scene.hiddenIds.add(id):scene.hiddenIds.delete(id);
  }
  if((action==='hide'||action==='isolate'||action==='toggle')&&(before.size!==scene.hiddenIds.size||[...before].some(id=>!scene.hiddenIds.has(id)))){scene.visibilityHistory??=[];scene.visibilityHistory.push({added:[...scene.hiddenIds].filter(id=>!before.has(id)),removed:[...before].filter(id=>!scene.hiddenIds.has(id))});if(scene.visibilityHistory.length>20)scene.visibilityHistory.shift();}
}
export function isIsolated(scene,ids){
  const targets=new Set(ids),live=liveBlocks(scene);
  return targets.size>0&&live.some(b=>scene.hiddenIds?.has(b.id))&&live.every(b=>scene.hiddenIds?.has(b.id)!==targets.has(b.id));
}
// Native XML hierarchy: <item index="N" parent="M">. parentId is resolved at import; children are derived here.
const familyCache=new WeakMap();
function family(scene){
  const live=liveBlocks(scene),cached=familyCache.get(live);if(cached)return cached;
  const byId=new Map(live.map(b=>[b.id,b])),children=new Map();
  for(const b of live)if(b.parentId&&byId.has(b.parentId)){if(!children.has(b.parentId))children.set(b.parentId,[]);children.get(b.parentId).push(b.id);}
  const result={byId,children};familyCache.set(live,result);return result;
}
export function blockParentIds(scene,ids){const {byId}=family(scene),out=new Set();for(const id of ids){const p=byId.get(id)?.parentId;if(p&&byId.has(p))out.add(p);}return [...out];}
export function blockChildIds(scene,ids){const {children}=family(scene),out=new Set();for(const id of ids)for(const c of children.get(id)||[])out.add(c);return [...out];}
export function nativeItemIndex(block){return block?.itemEl?.getAttribute('index')??null;}
// Readable name for a block: native item index first (viewer id when there is none), then type and material.
export function blockLabel(block){const index=nativeItemIndex(block);return `${index!=null?'#'+index:block.id} · ${block.type} · ${block.material}`;}

export function contextTargets(scene,ids,individual=false){
  return individual&&ids.length===1&&scene.selectedIds?.has(ids[0])?[...scene.selectedIds]:ids;
}

export function mountShipStructure(host,node,scene,{getPreferences,getView=()=>({}),select,visibility,focus,menu,save,reveal=()=>{}}){
  node.shipGrouping??='type';node.shipExpanded??=[];
  const toolbar=document.createElement('div');toolbar.className='ship-toolbar';
  const grouping=document.createElement('select');grouping.setAttribute('aria-label','Group blocks by');grouping.add(new Option('Block type','type'));grouping.add(new Option('Material','material'));grouping.value=node.shipGrouping;
  const unhide=document.createElement('button');unhide.type='button';unhide.textContent='Unhide all';unhide.onclick=()=>visibility([],'all');toolbar.append(grouping,unhide);
  const notice=document.createElement('p');notice.className='ship-notice';
  const tree=document.createElement('div');tree.className='ship-tree';host.append(toolbar,notice,tree);
  let rows=[],rootIds=[];
  function popup(event,ids,individual=false){
    event.preventDefault();event.stopPropagation();
    const targets=contextTargets(scene,ids,individual),allSelected=targets.length>0&&targets.every(id=>scene.selectedIds.has(id));
    const parents=blockParentIds(scene,targets),children=blockChildIds(scene,targets);
    const rect=event.currentTarget.getBoundingClientRect();
    menu(event.clientX||rect.left,event.clientY||rect.bottom,'Ship structure',[
      {label:'Select',action:()=>select(targets,false)},
      {label:allSelected?'Remove selection':'Add selection',action:()=>select(targets,true)},
      {label:'Focus',action:()=>focus(targets)},null,
      {label:isIsolated(scene,targets)?'Show all':'Isolate',action:()=>visibility(targets,isIsolated(scene,targets)?'all':'isolate')},
      {label:'Hide',action:()=>visibility(targets,'hide')},
      {label:'Show',action:()=>visibility(targets,'show')},
      {label:'Show Last',disabled:!scene.visibilityHistory?.length,disabledReason:'Hide or isolate blocks first to restore the previous visibility.',action:()=>visibility([],'last')},
      {label:'Show all',action:()=>visibility([],'all')},null,
      {label:'Show Parent',disabled:!parents.length,disabledReason:'No parent block. Root blocks have parent="-1" in the XML.',action:()=>reveal(parents,'parent')},
      {label:'Show Children',disabled:!children.length,disabledReason:'No blocks name this block as their parent.',action:()=>reveal(children,'children')}
    ]);
  }
  function row(label,ids,{kind='group',expanded=false,toggle}={}){
    const el=document.createElement('div');el.className='ship-row ship-'+kind;el.dataset.rowIndex=String(renderingIndex);
    if(toggle){const arrow=document.createElement('button');arrow.type='button';arrow.className='ship-expand';arrow.textContent=expanded?'▾':'▸';arrow.setAttribute('aria-label','Expand '+label);arrow.setAttribute('aria-expanded',String(expanded));arrow.onclick=toggle;el.append(arrow);}
    const name=document.createElement('button');name.type='button';name.className='ship-name';name.textContent=label;name.title=kind==='block'?'Viewer-generated ID; not the native XML item index':label;
    name.onclick=e=>select(ids,e.ctrlKey||e.metaKey);name.ondblclick=()=>focus(ids);el.append(name);
    const eye=document.createElement('button');eye.type='button';eye.className='ship-eye';eye.onclick=()=>visibility(ids,'toggle');el.append(eye);
    const isolate=document.createElement('button');isolate.type='button';isolate.className='ship-isolate';isolate.textContent='⊙';isolate.setAttribute('aria-label','Isolate '+label);isolate.title='Isolate';isolate.onclick=()=>visibility(ids,isIsolated(scene,ids)?'all':'isolate');el.append(isolate);
    el.oncontextmenu=e=>popup(e,ids,kind==='block');rows.push({el,name,eye,isolate,ids,label});tree.append(el);
  }
  const ROW_HEIGHT=28,OVERSCAN=8;
  let pinned=null,revealRevision=-1,blocksById=new Map();
  let segments=[],totalRows=0,groups=[],rootSummary,groupSummaries=new Map(),renderingIndex=0,lastSignature=[],lastWindow='';
  tree.style.position='relative';tree.setAttribute('role','tree');
  function summary(ids,hidden){
    let selected=0,visible=0,manualVisible=0;
    for(const id of ids){if(scene.selectedIds?.has(id))selected++;if(!hidden.has(id))visible++;if(!scene.hiddenIds?.has(id))manualVisible++;}
    return {selected,visible,isolated:scene.hiddenIds?.size>0&&manualVisible===ids.length&&ids.length===rootIds.length-scene.hiddenIds.size};
  }
  function descriptor(index){
    if(pinned&&index===0)return {label:`Selected · ${pinned.type} · ${pinned.id}`,ids:[pinned.id],kind:'block'};
    if(index===(pinned?1:0))return {label:`${scene.model?.fileName||'No ship loaded'} · ${rootIds.length}`,ids:rootIds,kind:'root',state:rootSummary};
    // Only group boundaries are searched; individual rows are addressed directly.
    for(const seg of segments){
      if(index===seg.start)return {label:`${seg.group.name} · ${seg.group.ids.length}`,ids:seg.group.ids,state:groupSummaries.get(seg.group),expanded:seg.expanded,toggle:()=>{
        if(node.search?.trim())return;
        node.shipExpanded=node.shipExpanded.includes(seg.key)?node.shipExpanded.filter(k=>k!==seg.key):[...node.shipExpanded,seg.key];save();render();
      }};
      if(index>seg.start&&index<seg.end){const block=seg.group.blocks[index-seg.start-1];return {label:`${block.type} · ${block.id}`,ids:[block.id],kind:'block'};}
    }
  }
  function paintWindow(force=false){
    const top=Math.max(0,host.scrollTop-tree.offsetTop),start=Math.max(0,Math.floor(top/ROW_HEIGHT)-OVERSCAN);
    const end=Math.min(totalRows,start+Math.ceil((host.clientHeight||400)/ROW_HEIGHT)+OVERSCAN*2);
    const key=start+':'+end;if(!force&&key===lastWindow)return;lastWindow=key;
    const focused=tree.contains(document.activeElement)?{index:document.activeElement.closest('.ship-row')?.dataset.rowIndex,kind:document.activeElement.className}:null;
    rows=[];tree.replaceChildren();tree.style.height=totalRows*ROW_HEIGHT+'px';
    for(let i=start;i<end;i++){
      const desc=descriptor(i);if(!desc)continue;renderingIndex=i;row(desc.label,desc.ids,desc);
      const r=rows.at(-1),state=desc.state||summary(desc.ids,effectiveHidden);
      r.el.style.cssText=`position:absolute;top:${i*ROW_HEIGHT}px;left:0;right:0;height:${ROW_HEIGHT}px;box-sizing:border-box`;
      r.el.setAttribute('role','treeitem');r.el.setAttribute('aria-level',desc.kind==='root'?'1':desc.kind==='block'?'3':'2');
      r.el.classList.toggle('selected',state.selected===desc.ids.length&&!!desc.ids.length);r.el.classList.toggle('hidden-blocks',!state.visible);
      r.el.classList.toggle('contains-selection',state.selected>0);r.name.setAttribute('aria-pressed',String(state.selected===desc.ids.length&&!!desc.ids.length));
      setDisabled(r.name,!desc.ids.length,'Load a model or block preview to select blocks.',desc.label);
      r.eye.innerHTML=icon(state.visible?'eye':'eyeClosed');r.eye.classList.toggle('mixed-visibility',state.visible>0&&state.visible<desc.ids.length);
      r.eye.setAttribute('aria-label',(state.visible?'Hide ':'Show ')+desc.label);r.eye.title=state.visible?'Hide':'Show';
      r.isolate.innerHTML=icon(state.isolated?'showAll':'isolate');r.isolate.title=state.isolated?'Show all':'Isolate';r.isolate.setAttribute('aria-pressed',String(state.isolated));
    }
    if(focused){const r=rows.find(r=>r.el.dataset.rowIndex===focused.index);if(r)Array.from(r.el.children).find(c=>c.className===focused.kind)?.focus({preventScroll:true});}
  }
  let lastManualHidden=null,effectiveHidden=new Set(),previousSelected=new Set(),previousHidden=new Set(),membership=new Map();
  function render(){
    blocksById=new Map(liveBlocks(scene).map(b=>[b.id,b]));rootIds=liveBlocks(scene).map(b=>b.id);groups=groupedBlocks(scene,node.shipGrouping,node.search);segments=[];pinned=scene.selectedIds?.has(scene.outlinerRevealId)?blocksById.get(scene.outlinerRevealId):null;totalRows=pinned?2:1;
    for(const group of groups){const key=node.shipGrouping+':'+group.name,expanded=!!node.search?.trim()||node.shipExpanded.includes(key);const start=totalRows;totalRows+=1+(expanded?group.blocks.length:0);segments.push({group,key,expanded,start,end:totalRows});}
    tree.style.height=totalRows*ROW_HEIGHT+'px';host.scrollTop=Math.min(host.scrollTop,Math.max(0,tree.offsetTop+totalRows*ROW_HEIGHT-host.clientHeight));
    membership=new Map();for(const g of groups)for(const id of g.ids)membership.set(id,g);lastSignature=[];sync(true);
  }
  function sync(force=false){
    const live=liveBlocks(scene),signature=[live,scene.selectedIds,scene.hiddenIds,getView().showThinBlocks,getPreferences().simplifyThreshold,scene.outlinerRevealRevision];
    if(!force&&signature.every((v,i)=>v===lastSignature[i]))return;
    if(!force&&live!==lastSignature[0]&&(live.length!==rootIds.length||live.some((b,i)=>b.id!==rootIds[i]))){render();return;}
    const nextPinned=scene.selectedIds?.has(scene.outlinerRevealId)?blocksById.get(scene.outlinerRevealId):null;
    const shift=Number(!!nextPinned)-Number(!!pinned);pinned=nextPinned;
    if(shift){for(const segment of segments){segment.start+=shift;segment.end+=shift;}totalRows+=shift;}
    if(revealRevision!==scene.outlinerRevealRevision){revealRevision=scene.outlinerRevealRevision;if(pinned)host.scrollTop=0;}
    lastSignature=signature;effectiveHidden=viewportHiddenIds(scene,getView());
    if(force||!rootSummary){rootSummary=summary(rootIds,effectiveHidden);groupSummaries=new Map(groups.map(g=>[g,summary(g.ids,effectiveHidden)]));}
    else {
      const changed=new Set();
      for(const [old,next] of [[previousSelected,scene.selectedIds],[previousHidden,effectiveHidden]]){for(const id of old)if(!next.has(id))changed.add(id);for(const id of next)if(!old.has(id))changed.add(id);}
      for(const id of changed){const selected=Number(scene.selectedIds.has(id))-Number(previousSelected.has(id)),visible=Number(!effectiveHidden.has(id))-Number(!previousHidden.has(id));rootSummary.selected+=selected;rootSummary.visible+=visible;const group=membership.get(id),state=groupSummaries.get(group);if(state){state.selected+=selected;state.visible+=visible;}}
      // Isolation uses manual visibility; derive it once per group after a visibility change.
      if(lastManualHidden!==scene.hiddenIds){rootSummary=summary(rootIds,effectiveHidden);groupSummaries=new Map(groups.map(g=>[g,summary(g.ids,effectiveHidden)]));}
    }
    previousSelected=scene.selectedIds;previousHidden=effectiveHidden;lastManualHidden=scene.hiddenIds;

    notice.hidden=!simplified(scene,getPreferences());notice.textContent='Large model: animated effects reduced. Block selection and focus remain available.';
    paintWindow(true);
  }
  const scroll=()=>paintWindow();host.addEventListener('scroll',scroll,{passive:true});
  const observer=new ResizeObserver(()=>paintWindow(true));observer.observe(host);
  tree.addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(event.key))return;
    const current=Number(event.target.closest('.ship-row')?.dataset.rowIndex??0),page=Math.max(1,Math.floor(host.clientHeight/ROW_HEIGHT));
    const index=Math.max(0,Math.min(totalRows-1,event.key==='Home'?0:event.key==='End'?totalRows-1:current+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:event.key==='PageDown'?page:-page)));
    event.preventDefault();host.scrollTop=tree.offsetTop+index*ROW_HEIGHT;paintWindow(true);rows.find(r=>Number(r.el.dataset.rowIndex)===index)?.name.focus({preventScroll:true});
  });

  grouping.onchange=()=>{node.shipGrouping=grouping.value;save();render();};render();
  return {outlinerId:node.id,search:render,sync,dispose(){observer.disconnect();host.removeEventListener('scroll',scroll);}};
}

export function isThinBlock(block){return ['x','y','z'].some(axis=>Math.abs(block.size?.[axis])<0.01);}
const hiddenCache=new WeakMap();
export function viewportHiddenIds(scene,view){
  if(view.showThinBlocks!==false)return scene.hiddenIds||new Set();
  const live=liveBlocks(scene),old=hiddenCache.get(scene);
  if(scene.revision!==undefined&&old?.live===live&&old.hidden===scene.hiddenIds)return old.result;
  const hidden=new Set(scene.hiddenIds||[]);
  if(view.showThinBlocks===false)for(const block of liveBlocks(scene))if(isThinBlock(block))hidden.add(block.id);
  hiddenCache.set(scene,{live,hidden:scene.hiddenIds,result:hidden});return hidden;
}

const effectHiddenCache=new WeakMap();
export function engineEffectHiddenIds(scene,view,keepThin=true){
  const hidden=viewportHiddenIds(scene,view);
  if(!keepThin||view.showThinBlocks!==false)return hidden;
  const cached=effectHiddenCache.get(scene);if(cached?.hidden===hidden)return cached.result;
  const result=new Set(hidden);
  for(const b of liveBlocks(scene))if(b.typeIndex===3&&isThinBlock(b)&&!scene.hiddenIds?.has(b.id))result.delete(b.id);
  effectHiddenCache.set(scene,{hidden,result});return result;
}
