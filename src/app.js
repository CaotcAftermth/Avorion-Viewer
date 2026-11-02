import {createWelcome} from './welcome.js';
import {createStudio} from './turrets/studio.js';
import {attachSubmenu} from './submenu.js';
import {mountAssetProperties,assetPoseTransforms} from './turrets/asset-properties.js';
import {renderWorkspaceNode} from './workspace-tree.js';
import {rememberEditorScroll,restoreEditorScrollAfterLayout} from './editor-scroll.js';
import {mountTurretOutliner} from './turrets/editors.js';
import {mountHistory} from './turrets/mounts.js';
import {mountTurretLibrary} from './turrets/library.js';
import {mountTurretProperties} from './turrets/properties.js';
import {createSessionPersistence} from './session-persistence.js';
import {mountSceneProperties} from './scene-properties.js';
import {openExportDialog} from './export/dialog.js';
import {renderPaletteRadial} from './palette-radial.js';
import {mountPaintToolbar} from './paint-toolbar.js';
import {INTERACTION_MODES,interactionMode,nextInteractionMode} from './interaction-modes.js';
import {paintOptions,paintScope,samplePaintColor,applyPaintTool,channelColor,mirroredIds} from './paint-tools.js';
import {blockIndex} from './block-colors.js';
import {loadPalette} from './color-palette.js';
import {mountColorEditor} from './color-editor.js';
import {activePalette,beginPaintStroke,finishPaintStroke,paintPaletteColor,addRegion,editRegion,undoPaint,paintAvailability,exportPaintedXml} from './color-workshop.js';
import { setDisabled } from './control-state.js';
import { frameVisibleModel } from './model-framing.js';
import { viewportHeader, viewportViewPanel, closeViewportPopover } from './viewport-controls.js';
import { ensureViewportOptions } from './viewport-options.js';
import { wireTabs, wirePanels } from './editor-panels.js';
import { mountShipStructure, liveBlocks, blockIds, blockLabel, simplified, reconcileStructure, selectBlocks, setBlockVisibility, viewportHiddenIds, isThinBlock } from './ship-structure.js';
import { nativeToView, makeBlock, makeModel, modelCorners, blockFramePoints, orientationGallery, parseAvorionXml, placeImportedModel } from './block-model.js';
import { mountBlockInspector } from './block-inspector.js';
import { blockGallery, isBlockGallery, applyGalleryEdit, BLOCK_GALLERY_NAME } from './block-gallery.js';
import { openBlockWorkspace } from './block-workspace.js';
import { textureLibrary, releaseGameModel, socketExposed } from './game-renderer.js';
import { matchesBinding, modifierActive, bindingFor, shortcutLabel, KEYMAPS } from './keymaps.js';
import { mountViewCube, selectCubeView, homeCubeView, rotatePoleView } from './view-cube.js';
import { EDITORS, uid, clamp, area, split, defaults, leaves, find, parentOf, cloneTree, splitArea, joinArea, swapAreas, minimum, ratioBounds, validateState } from './layout.js';
import { icon } from './icons.js';
import { mountViewport } from './viewport.js';
import { createPreferencesStore, sectionById, THEMES, EDITOR_THEMES, editorTheme } from './preferences.js';
import { mountPreferences } from './preferences-editor.js';
import { setLanguage, onLanguageChange, t, translateDom } from './i18n.js';
import { ensureCamera, orbit, pan, zoom, dolly, alignView, opposite, frameBounds, navigationKey, viewLabel, REFERENCE_VERTICES } from './navigation.js';
import { layoutPropertyRows } from './property-rows.js';
import { applyPropertySearch, searchTerms } from './property-search.js';
import { addLog, reportError, logEntries, onLog, clearLog, errorCount, installGlobalErrorCapture } from './app-log.js';
import { APP_VERSION } from './version.js';
import { openFeedback, openAbout } from './feedback.js';
import { currentLanguage } from './i18n.js';

const $ = selector => document.querySelector(selector);
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editorParam = new URLSearchParams(location.search).get('editor');
const embeddedAsset = editorParam==='turret', embeddedBlock = editorParam==='block', embedded = embeddedAsset||embeddedBlock;
let assetDraft=null;
const STORAGE = 'avorion-viewer.window-system.v1';
const preferences=createPreferencesStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const trackpadFallback=preferences.value.inputStyle==='trackpad';
if(trackpadFallback)preferences.set('inputStyle','laptop');
const preferenceEditors=new Map(),lookEditors=new Map(),preferencesWindowState={};
let preferencesWindow=null;
let state = defaults(), storageAvailable = true;
try { const raw = !embedded&&preferences.value.rememberLayout?localStorage.getItem(STORAGE):null; if(raw){const parsed=JSON.parse(raw);if(validateState(parsed))state=parsed;} } catch { storageAvailable=false; }
let lastViewportId=null;
let hovered = null, maximized = null, focusMode = false, operation = null, renderers = [], toastTimer, saveTimer;
const scene = { loaded: false, visible: true, selected: false, selectedId:null, selectedIds:new Set(), hiddenIds:new Set(), preview:false, revision:0, model:null };
const welcome=embedded?null:createWelcome({preferences,wireInputStyles,openModel:importXml,openTextures:loadTextures,feedback:showFeedback,trackpadFallback});
let textureStatus='Neutral texture fallback · Load a local texture folder from File';
installGlobalErrorCapture(window);
addLog(`Avorion Viewer ${APP_VERSION} ready. Layout changes are saved in this browser.`,'SYSTEM');addLog('No model loaded. Drop an Avorion .xml or use File > Import Avorion XML.','SCENE');
const assetPersistence=embedded?{changed(){},start(){},flush(){},stop(){}}:createSessionPersistence({scene,textures:textureLibrary,restored:kind=>{if(kind==='textures'){scene.revision++;/* rebuild: the restored model was built before its textures finished loading */textureStatus=`${textureLibrary.loadedCount} texture maps - restored locally`;if(textureLibrary.loadedCount)notify(`${textureLibrary.loadedCount} saved texture maps restored.`);}render();log(`${kind==='model'?'Model':'Textures'} restored from this browser.`,'STORAGE');},onError:error=>{notify('Model/texture persistence unavailable. Current session still works.');reportError(error,'STORAGE');}});
const workspace = () => state.workspaces.find(w => w.id === state.active);
const currentArea = () => find(workspace().root, hovered) || leaves(workspace().root)[0];
const areaElement = id => document.querySelector(`[data-area-id="${id}"]`);
const editorIcon = editor => editor === 'viewport' ? 'cube' : editor;
function notify(message) { $('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3200); }
function saveNow() {
  if(embedded)return;
  if(!preferences.value.rememberLayout){updateLayoutSaveStatus();return;}
  try { localStorage.setItem(STORAGE,JSON.stringify(state));storageAvailable=true; } catch { storageAvailable=false; }
  updateLayoutSaveStatus();
}
function updateLayoutSaveStatus(){$('#save-status').textContent=t(!preferences.value.rememberLayout?'Layout saving paused':storageAvailable?'Layout saved locally':'Layout not saved · storage unavailable');}
function save() { clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,160); }
window.addEventListener('pagehide',saveNow);
function log(message,category='LAYOUT',level='info') { addLog(message,category,level); }
const LOG_LEVEL_LABEL={error:'Error',warning:'Warning'};
function updateLogs() {
  const logs=logEntries();
  document.querySelectorAll('.info-body').forEach(el=>{const node=find(workspace().root,el.closest('[data-area-id]').dataset.areaId),newestFirst=node?.infoNewestFirst===true,problems=node?.infoFilter==='problems';
    const shown=problems?logs.filter(e=>e.level!=='info'):logs,entries=newestFirst?[...shown].reverse():shown;
    el.innerHTML=entries.length?entries.map(entry=>`<div class="info-row level-${entry.level||'info'}"${entry.detail?` title="${escape(entry.detail)}"`:''}><time>${entry.time.toLocaleTimeString([], {hour12:false})}</time><span class="log-dot"${LOG_LEVEL_LABEL[entry.level]?` aria-label="${escape(t(LOG_LEVEL_LABEL[entry.level]))}"`:''}></span><span class="log-category">${escape(entry.category)}</span><span class="log-message">${escape(entry.message)}</span>${entry.count>1?`<span class="log-repeat">×${entry.count}</span>`:''}</div>`).join(''):`<div class="info-empty">${escape(t(problems?'No errors or warnings.':'No activity to display.'))}</div>`;el.scrollTop=newestFirst?0:el.scrollHeight;});
  document.querySelectorAll('.info-filter').forEach(b=>{const n=logs.filter(e=>e.level!=='info').length;b.dataset.count=n;b.querySelector('.count').textContent=n?String(n):'';});
  const errors=errorCount(),badge=$('#error-status');if(badge){badge.hidden=!errors;badge.textContent=errors===1?t('1 error'):`${errors} ${t('errors')}`;}
}
let logFrame=0;onLog(()=>{if(!logFrame)logFrame=requestAnimationFrame(()=>{logFrame=0;updateLogs();});});
function commit(message) { save();render();if(message)log(message); }
let activeMainMenu=null;
function closeMenu() { activeMainMenu?.setAttribute('aria-expanded','false');activeMainMenu=null;$('#menu').hidden=true;$('#menu').replaceChildren();$('#menu').classList.remove('pie-menu','palette-pie');$('#menu').style.width='';$('#menu').style.height='';$('#menu').removeAttribute('aria-label'); }
function shortcut(id){return shortcutLabel(bindingFor(id,preferences.value));}
function menu(x,y,title,items) {
  closeMenu(); const el=$('#menu');
  if(title){const heading=document.createElement('div');heading.className='menu-title';heading.textContent=t(title);el.append(heading);}
  for(const item of items){
    if(!item){el.append(document.createElement('hr'));continue;}
    if(item.section){const heading=document.createElement('div');heading.className='menu-title';heading.textContent=t(item.section);el.append(heading);continue;}
    const button=document.createElement('button');button.type='button';button.role='menuitem';setDisabled(button,!!item.disabled,t(item.disabledReason),t(item.label));
    button.innerHTML=`<span>${escape(t(item.label))}</span>${item.key?`<kbd>${escape(item.key)}</kbd>`:''}`;
    if(item.submenu)attachSubmenu(button,el,item.submenu,closeMenu);else button.addEventListener('click',()=>{closeMenu();item.action?.();});el.append(button);
  }
  el.hidden=false;el.style.left=`${clamp(x,6,Math.max(6,innerWidth-el.offsetWidth-6))}px`;el.style.top=`${clamp(y,6,Math.max(6,innerHeight-el.offsetHeight-6))}px`;
  el.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
$('#menu').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();return;}
  const buttons=[...$('#menu').querySelectorAll(':scope > button:not(:disabled)')];const i=buttons.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
  if(e.key==='Tab')closeMenu();
});
document.addEventListener('pointerdown',e=>{if(!$('#menu').contains(e.target)&&!activeMainMenu?.contains(e.target))closeMenu();});
function anchorMenu(button,title,items){const rect=button.getBoundingClientRect();menu(rect.left,rect.bottom+3,title,items);}
function button(label,content,action,className='') {const el=document.createElement('button');el.type='button';el.title=t(label);el.setAttribute('aria-label',t(label));el.dataset.label=label;el.innerHTML=content;el.className=className;el.addEventListener('click',action);return el;}
function totalAreas(){return state.workspaces.reduce((sum,w)=>sum+leaves(w.root).length,0);}
function refreshStructure(){
  assetPersistence.changed();
  reconcileStructure(scene);
  renderers.forEach(r=>{r.sync?.();r.draw?.();});
  for(const node of leaves(workspace().root))if(node.editor==='properties'){
    const body=areaElement(node.id)?.querySelector('.area-body');if(body)renderProperties(body,node);
  }
}
// While a region is in viewport edit mode, clicks and box drags change its members instead of the selection.
function regionPick(selected,meta){
  const edit=scene.regionEdit;if(!edit)return false;
  if(edit.model!==scene.model||!scene.regions?.some(r=>r.id===edit.id)){scene.regionEdit=null;refreshStructure();return false;}
  if(selected&&typeof selected==='object'&&!Array.isArray(selected)||selected===true)return false;
  const ids=typeof selected==='string'?[selected]:Array.isArray(selected)?selected:[];if(!ids.length)return true;
  const region=scene.regions.find(r=>r.id===edit.id),mode=meta?.subtract?'remove':'add';
  try{const n=editRegion(scene,edit.id,ids,mode);notify(n?`${mode==='add'?'Added':'Removed'} ${n} block${n===1?'':'s'} ${mode==='add'?'to':'from'} ${region.name}.`:`No change to ${region.name}.`);}catch(error){notify(error.message);reportError(error,'REGION');}
  refreshStructure();return true;
}
function selectStructure(ids,additive=false,fromViewport=false){selectBlocks(scene,ids,additive);if(fromViewport){scene.outlinerRevealId=ids.findLast(id=>scene.selectedIds.has(id))||null;scene.outlinerRevealRevision=(scene.outlinerRevealRevision||0)+1;}refreshStructure();}
function viewportPie(event,node){
  lastViewportId=node.id;
  const ids=[...scene.selectedIds];if(!ids.length)return;
  menu(event.clientX,event.clientY,'Selection',[
    {label:'Focus',action:()=>focusStructure(ids)},
    {label:'Isolate',action:()=>visibilityStructure(ids,'isolate')},
    {label:'Hide',action:()=>visibilityStructure(ids,'hide')},
    {label:'Show Last',disabled:!scene.visibilityHistory?.length,disabledReason:'Hide or isolate blocks first to restore the previous visibility.',action:()=>visibilityStructure([],'last')},
    {label:'Show All',disabled:!scene.hiddenIds.size&&node.view.showThinBlocks!==false,disabledReason:'All blocks are already visible.',action:()=>visibilityStructure([],'all')}
  ]);
  const el=$('#menu');el.classList.add('pie-menu');
  el.style.left=clamp(event.clientX-el.offsetWidth/2,6,Math.max(6,innerWidth-el.offsetWidth-6))+'px';
  el.style.top=clamp(event.clientY-el.offsetHeight/2,6,Math.max(6,innerHeight-el.offsetHeight-6))+'px';
}
function structureView(){return (leaves(workspace().root).find(n=>n.id===lastViewportId&&n.editor==='viewport')||leaves(workspace().root).find(n=>n.editor==='viewport'))?.view||{};}
function visibilityStructure(ids,action){
  const view=structureView(),hidden=viewportHiddenIds(scene,view);
  if(action==='toggle')action=ids.some(id=>!hidden.has(id))?'hide':'show';
  if(['show','all','isolate'].includes(action)&&view.showThinBlocks===false&&liveBlocks(scene).some(b=>isThinBlock(b)&&(action==='all'||ids.includes(b.id)))){
    // Retain other filtered blocks as manually hidden when showing specific targets.
    scene.hiddenIds=new Set(hidden);
    view.showThinBlocks=true;
  }
  setBlockVisibility(scene,ids,action);refreshStructure();save();
}
function focusStructure(ids){
  
  const targets=new Set(ids),blocks=liveBlocks(scene).filter(b=>targets.has(b.id));if(!blocks.length)return;
  const node=leaves(workspace().root).find(n=>n.id===lastViewportId&&n.editor==='viewport')||leaves(workspace().root).find(n=>n.editor==='viewport');
  if(!node){notify('Open a 3D Viewport to focus blocks.');return;}
  if(maximized&&maximized!==node.id){maximized=null;focusMode=false;render();}
  const canvas=areaElement(node.id)?.querySelector('canvas');if(!canvas)return;
  frameBounds(node.view,blockFramePoints(blocks),canvas.clientWidth,canvas.clientHeight);
  renderers.find(r=>r.id===node.id)?.draw();save();
}

// Bring blocks into view by name: unhide them (even inside an isolation), select, reveal in the outliner, optionally frame.
function revealStructure(ids,{focus=true,kind}={}){
  const live=blockIds(scene);ids=ids.filter(id=>live.has(id));if(!ids.length)return;
  const hidden=viewportHiddenIds(scene,structureView());
  if(ids.some(id=>hidden.has(id)))visibilityStructure(ids,'show');
  selectStructure(ids,false,true);
  if(focus)focusStructure(ids);
  if(kind){const first=liveBlocks(scene).find(b=>b.id===ids[0]);notify(ids.length===1?`${kind==='children'?'Child':'Parent'}: ${blockLabel(first)}`:`${ids.length} ${kind==='children'?'child':'parent'} blocks shown and selected.`);}
}

// Double-clicking a Block Gallery block opens it alone in a workspace window.
function openGalleryBlock(node){
  if(embedded||!isBlockGallery(scene)||interactionMode(node.view.interactionMode)!=='object')return;
  const block=scene.model.blocks.find(b=>b.id===scene.selectedId);if(!block)return;
  openBlockWorkspace(block,edited=>{
    applyGalleryEdit(block,edited);
    scene.model={...makeModel(scene.model.blocks,scene.model.fileName),turretMounts:scene.model.turretMounts};
    scene.revision++;scene.appearanceRevision=(scene.appearanceRevision||0)+1;
    commit(`${block.type} updated in the Block Gallery.`);
  });
}
function loadModel(model,preview=false){
  cancelPaintTask();scopeCache=null;scene.paintSample=null;scene.paintMessage='';
  if(!preview)placeImportedModel(model,preferences.value.importPlacement);
  Object.assign(scene,{regions:[],paintHistory:null,visibilityHistory:[],outlinerRevealId:null,model,preview,loaded:true,visible:true,selected:false,selectedId:null,selectedIds:new Set(),hiddenIds:new Set(),revision:scene.revision+1});
  for(const w of state.workspaces)for(const node of leaves(w.root))if(node.editor==='viewport'){
    const canvas=areaElement(node.id)?.querySelector('canvas');
    frameBounds(node.view,blockFramePoints(model.blocks),canvas?.clientWidth||800,canvas?.clientHeight||600);
  }
  welcome?.close();
  commit(`${model.fileName} · ${model.blocks.length} blocks loaded.`);
  for(const warning of model.warnings||[])if(warning.level==='warn')log(warning.message,'MODEL','warning');
}
function chooseFiles(accept,multiple,callback,folder=false){
  const input=document.createElement('input');input.type='file';input.accept=accept;input.multiple=multiple;input.hidden=true;
  if(folder)input.setAttribute('webkitdirectory','');document.body.append(input);
  input.addEventListener('change',async()=>{try{await callback([...input.files]);}catch(error){notify(error.message);reportError(error,'FILE');}finally{input.remove();}});
  input.addEventListener('cancel',()=>input.remove());input.click();
}
const RECENT_MODELS='avorion-viewer.recent-models.v1';
function recentModels(){try{const list=JSON.parse(localStorage.getItem(RECENT_MODELS)||'[]');return Array.isArray(list)?list.filter(name=>typeof name==='string').slice(0,5):[];}catch{return [];}}
function rememberModel(name){try{localStorage.setItem(RECENT_MODELS,JSON.stringify([name,...recentModels().filter(n=>n!==name)].slice(0,5)));}catch{}}
function showImportError(fileName,error){
  const dialog=$('#import-error-dialog');
  dialog.querySelector('.import-error-file').textContent=fileName;
  dialog.querySelector('.import-error-message').textContent=String(error?.message||error).replace(/This page contains the following errors:\s*/,'').replace(/Below is a rendering of the page[\s\S]*$/,'').trim();
  dialog.querySelector('[data-retry]').onclick=()=>{dialog.close();importXml();};
  log(`${fileName}: ${error?.message||error}`,'IMPORT','error');
  if(!dialog.open)dialog.showModal();
}
// Every model entry point (menu, drop, empty state, asset library) shares this path.
async function openXmlFile(file){
  let model;
  try{model=parseAvorionXml(await file.text(),file.name,file.size);}catch(error){showImportError(file.name,error);return false;}
  loadModel(model);rememberModel(file.name);return true;
}
function importXml(){chooseFiles('.xml',false,async files=>{if(files[0])await openXmlFile(files[0]);});}
function saveXml(){
  if(!scene.model?.doc)return;
  const url=URL.createObjectURL(new Blob([exportPaintedXml(scene.model)],{type:'application/xml'}));
  const a=document.createElement('a');a.href=url;a.download=scene.model.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadAssetTextures(files){
  const count=await textureLibrary.loadFiles(files);textureStatus=`${textureLibrary.loadedCount} local texture maps · stored in this browser`;scene.revision++;render();notify(`${count} texture maps loaded.`);
}
const assetActions={openModel:openXmlFile,loadTextures:loadAssetTextures,showWorld:()=>{
  for(const w of state.workspaces)for(const node of leaves(w.root))if(node.editor==='viewport')ensureViewportOptions(node.view).background='WORLD';
  save();renderers.forEach(r=>r.draw?.());notify('World sky enabled in all viewports.');
}};
function openAssetFolders(){
  const dialog=$('#asset-folders-dialog'),host=dialog.querySelector('.asset-folders-body');
  if(dialog.open)return;
  host.replaceChildren();
  const panel=mountPreferences(host,preferences,{},{...assetActions,openModel:async file=>{dialog.close();await openXmlFile(file);}},{sections:[sectionById('assets')],compact:true});
  dialog.onclose=()=>panel.dispose();dialog.showModal();
}
function feedbackContext(){const m=scene.model;return {language:currentLanguage(),model:scene.loaded&&m?`${m.fileName||'unnamed'} · ${m.blocks.length} blocks${scene.preview?' (preview)':''}`:'none loaded',textures:`${textureLibrary.loadedCount} texture maps loaded`};}
function showFeedback(){closeMenu();openFeedback(feedbackContext(),{notify});}
function showAbout(){closeMenu();openAbout({openFeedback:showFeedback});}
function showProblems(){
  const infos=leaves(workspace().root).filter(n=>n.editor==='info');
  if(!infos.length){notify('Errors are listed in the Info editor. Switch any area to Info to see them.');return;}
  for(const n of infos){n.infoFilter='problems';n.infoNewestFirst=true;}save();render();
}
function copyLog(problemsOnly){
  const lines=logEntries().filter(e=>!problemsOnly||e.level!=='info').map(e=>`${e.time.toLocaleTimeString([], {hour12:false})} ${e.level==='info'?'':e.level.toUpperCase()+' '}${e.category}: ${e.message}${e.count>1?` (×${e.count})`:''}`);
  navigator.clipboard?.writeText(`Avorion Viewer ${APP_VERSION}\n${lines.join('\n')}`).then(()=>notify('Activity log copied.'),()=>notify('Could not copy the activity log.'));
}
$('#version-button').querySelector('b').textContent=APP_VERSION;$('#version-button').title='About Avorion Viewer';$('#version-button').onclick=showAbout;
$('#error-status').onclick=showProblems;$('#error-status').title='Show errors in the Info editor';
function loadTextures(){chooseFiles('.png,.bmp,.jpg,.jpeg,.webp',true,loadAssetTextures,true);}

// Static markup outside the editors; editors translate as they render.
const STATIC_TEXT='#topbar .brand,#help-button,#restore-bar,#statusbar,#drop-overlay,dialog:not(#preferences-dialog),#preferences-dialog .preferences-window-title';
let requestedLanguage;
function translateStatic(){document.querySelectorAll(STATIC_TEXT).forEach(translateDom);}
onLanguageChange(()=>{translateStatic();render();});
function applyPreferences(){
  const p=preferences.value,theme=THEMES[p.theme];
  if(p.language!==requestedLanguage){requestedLanguage=p.language;void setLanguage(p.language);}
  if(scene.preview&&scene.model&&scene.lastPreviewColor!==p.shaderColor){
    if(scene.lastPreviewColor!==undefined&&!embeddedBlock){for(const b of scene.model.blocks)b.color=b.color.slice(0,2)+p.shaderColor.slice(1);scene.revision++;}
    scene.lastPreviewColor=p.shaderColor;
  }
  document.body.dataset.theme=p.theme;
  document.body.dataset.navigationWidget=p.navigationWidget;
  document.documentElement.style.setProperty('--view-cube-size',p.viewCubeSize+'px');
  for(const [id] of EDITOR_THEMES){
    const colors=editorTheme(p,id);
    for(const el of document.querySelectorAll(id==='preferences'?'.area[data-editor="preferences"],#preferences-dialog':'.area[data-editor="'+id+'"]')){
      el.dataset.customColors=String(!!p[id+'CustomColors']);
      for(const [key,value] of Object.entries({panel:colors.background,header:colors.header,text:colors.text,accent:colors.accent}))el.style.setProperty('--'+key,value);
    }
  }
  for(const [key,value] of Object.entries({bg:theme.background,panel:theme.panel,header:theme.header,text:theme.text,muted:theme.muted,accent:p.accent}))document.documentElement.style.setProperty(`--${key}`,value);
  document.body.classList.toggle('hide-statusbar',!p.showStatusBar);
  document.body.classList.toggle('show-corner-handles',p.showCornerHandles);
  document.body.classList.toggle('hide-navigation-gizmos',!p.showGizmo);
  document.body.classList.toggle('hide-view-information',!p.showViewText);
  document.body.classList.toggle('show-viewport-statistics',p.showStats);
  document.querySelectorAll('[title],[data-ui-tooltip]').forEach(el=>{
    if(el.hasAttribute('title'))el.dataset.uiTooltip=el.getAttribute('title');
    if(p.showTooltips)el.setAttribute('title',el.dataset.uiTooltip);else el.removeAttribute('title');
  });
  renderers.forEach(renderer=>{renderer.draw?.();renderer.sync?.();});syncSceneProperties();
  document.querySelectorAll('[data-label="Frame all"]').forEach(button=>setDisabled(button,false,'',t('Frame all')));updateLayoutSaveStatus();
  const help=$('#help-dialog .shortcut-list');
  help.innerHTML=KEYMAPS.filter(item=>item.scope==='Window'||item.scope==='3D Viewport'||item.scope==='Mouse').map(item=>'<span>'+escape(t(item.label))+'</span><kbd>'+escape(shortcut(item.id))+'</kbd>').join('');
}
function openPreferences(){
  closeMenu();cancelOperation();renderers.forEach(renderer=>renderer.cancel?.());
  const dialog=$('#preferences-dialog');
  if(dialog.open){preferencesWindow?.focusSearch();return;}
  preferencesWindow=mountPreferences(dialog.querySelector('.preferences-window-body'),preferences,preferencesWindowState,assetActions);
  dialog.showModal();applyPreferences();
  dialog.querySelector('.preferences-window-title .icon-button').onclick=()=>dialog.close();
  dialog.onclose=()=>{preferencesWindow?.dispose();preferencesWindow=null;};
}

function renderTopbar(){
  document.querySelector('.project-title').textContent=(scene.model?.fileName||t('Untitled'))+' · '+t('Local session');
  const main=$('#main-menu');main.replaceChildren();
  const menus={
    File:()=>[
      {section:'Open'},
      {label:'Import Avorion XML…',action:importXml},
      {label:'Asset folders…',action:openAssetFolders},
      null,{section:'Save & Export'},
      {label:'Save preserved XML…',disabled:!scene.model?.doc,disabledReason:'Import an Avorion XML model first. The Block Gallery has no original XML to save.',action:saveXml},
      {label:'Advanced Export…',disabled:!scene.loaded||!scene.model,disabledReason:'Load a model first.',action:()=>{renderers.forEach(r=>r.cancel?.());cancelPaintTask();const view=currentArea().editor==='viewport'?currentArea().view:leaves(workspace().root).find(n=>n.editor==='viewport')?.view;openExportDialog(scene,view,ids=>selectStructure(ids),{preferences:preferences.value,canvas:[...document.querySelectorAll('.area[data-editor="viewport"]')].find(el=>find(workspace().root,el.dataset.areaId)?.view===view)?.querySelector('canvas')});}},
      null,{section:'Textures'},
      {label:'Load local texture folder…',action:loadTextures},
      {label:'Unload textures',action:()=>{textureLibrary.clear();textureStatus='Neutral texture fallback';scene.revision++;render();notify('Textures unloaded.');}},
      null,
      {label:'Save workspace layout',key:shortcut('saveLayout'),disabled:!preferences.value.rememberLayout,disabledReason:'Enable workspace persistence in Preferences > Save & Load to save layouts.',action:()=>{saveNow();notify(storageAvailable?'Layout saved in this browser.':'Browser storage is unavailable.');}},
      null,
      {label:'Clear scene',action:()=>{releaseGameModel();Object.assign(scene,{loaded:false,selected:false,selectedIds:new Set(),hiddenIds:new Set(),regions:[],paintHistory:null,model:null});commit('Scene cleared.');}}
    ],
    Edit:()=>[
      {label:'Undo Paint',key:shortcut('undoPaint'),disabled:!paintAvailability(scene).undo,disabledReason:'Apply a color to blocks first.',action:()=>changePaintHistory(false)},
      {label:'Redo Paint',key:shortcut('redoPaint'),disabled:!paintAvailability(scene).redo,disabledReason:'Undo a repaint first.',action:()=>changePaintHistory(true)},null,
      {label:'Preferences…',key:shortcut('preferences'),action:openPreferences}],
    Window:()=>[
      {label:'Open Color Workshop',action:openColorWorkshop},null,
      {label:maximized?'Restore area':'Maximize active area',key:shortcut('maximize'),action:()=>toggleMaximize(currentArea().id)},
      {label:'Toggle focus mode',key:shortcut('focus'),action:()=>toggleMaximize(currentArea().id,true)},null,
      {label:'Duplicate workspace',action:duplicateWorkspace},
      {label:'Rename workspace…',action:()=>renameWorkspace(workspace())},
      {label:'Reset current workspace',action:resetWorkspace}
    ],
    Help:()=>[
      {label:'Welcome',action:()=>welcome?.open()},
      {label:'Quick start & shortcuts',action:()=>$('#help-dialog').showModal()},
      {label:'Input style…',action:openInputStyle},
      {label:'Blender window system manual ↗',action:()=>window.open('https://docs.blender.org/manual/en/latest/interface/window_system/introduction.html','_blank','noopener,noreferrer')},
      null,
      {label:'Send feedback…',action:showFeedback},
      {label:'About Avorion Viewer',action:showAbout},
      null,{section:'Developer'},
      {label:'Load Block Gallery',action:()=>loadModel(blockGallery(),true)},
      {label:'Load orientation gallery · 7 × 24',action:()=>loadModel(orientationGallery())}
    ]
  };
  Object.entries(menus).forEach(([name,items])=>{
    const open=()=>{anchorMenu(b,'',items());activeMainMenu=b;b.setAttribute('aria-expanded','true');};
    const b=button(name,escape(t(name)),()=>{if(activeMainMenu===b)closeMenu();else open();});b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');
    b.addEventListener('pointerenter',()=>{if(activeMainMenu&&activeMainMenu!==b)open();});main.append(b);
  });
  const tabs=$('#workspaces');tabs.replaceChildren();
  for(const w of state.workspaces){
    const tab=button(w.name,escape(w.name),()=>switchWorkspace(w.id));tab.role='tab';tab.setAttribute('aria-selected',String(w.id===state.active));tab.tabIndex=w.id===state.active?0:-1;
    tab.addEventListener('dblclick',()=>renameWorkspace(w));
    tab.addEventListener('contextmenu',e=>{e.preventDefault();menu(e.clientX,e.clientY,w.name,[
      {label:'Rename…',action:()=>renameWorkspace(w)},
      {label:'Duplicate',action:()=>duplicateWorkspace(w)},
      {label:'Move to front',action:()=>{state.workspaces=state.workspaces.filter(x=>x!==w);state.workspaces.unshift(w);commit();}},
      {label:'Delete',disabled:state.workspaces.length===1,disabledReason:'At least one workspace must remain. Add another workspace before deleting this one.',action:()=>{state.workspaces=state.workspaces.filter(x=>x!==w);if(state.active===w.id)state.active=state.workspaces[0].id;maximized=null;focusMode=false;commit('Workspace deleted.');}}
    ]);});tabs.append(tab);
  }
  const add=button('Add workspace','+',()=>anchorMenu(add,'Add workspace',[
    {label:'Single viewport',action:()=>addWorkspace('Viewport',area())},
    {label:'Layout',action:()=>addWorkspace('Layout',defaults().workspaces[0].root)},
    {label:'Comparison',action:()=>addWorkspace('Compare',defaults().workspaces[2].root)}
  ]),'add-workspace');tabs.append(add);
}
$('#workspaces').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const index=state.workspaces.findIndex(w=>w.id===state.active);switchWorkspace(state.workspaces[(index+(e.key==='ArrowRight'?1:-1)+state.workspaces.length)%state.workspaces.length].id);$('#workspaces [aria-selected=true]').focus();
});
function switchWorkspace(id){cancelOperation();state.active=id;maximized=null;focusMode=false;hovered=null;commit();document.title=`Avorion Viewer — ${workspace().name}`;}
function addWorkspace(name,root){if(state.workspaces.length>=20||totalAreas()+leaves(root).length>64){notify('Workspace limit reached. Remove an unused workspace first.');return;}const w={id:uid(),name,root};state.workspaces.push(w);switchWorkspace(w.id);log(`Workspace “${name}” added.`);}
function duplicateWorkspace(w=workspace()){addWorkspace(`${w.name.slice(0,25)} copy`,cloneTree(w.root));}
function renameWorkspace(w){
  const dialog=$('#name-dialog'),input=dialog.querySelector('input');input.value=w.name;dialog.showModal();input.select();
  dialog.onclose=()=>{if(dialog.returnValue==='save'&&input.value.trim()){w.name=input.value.trim();commit();document.title=`Avorion Viewer — ${workspace().name}`;}};
}
let brushPalette;
loadPalette().then(p=>{brushPalette=p;try{scene.recentPaintColors=JSON.parse(localStorage.getItem('avorion-viewer.recent-colors.v1')||'[]').filter(id=>p.byId.has(id)).slice(0,12);}catch{scene.recentPaintColors=[];}renderers.forEach(r=>r.sync?.());}).catch(error=>reportError(error,'COLOR'));
function palettePie(event,page=0){
 if(!brushPalette)return;
 const active=activePalette(localStorage,brushPalette);
 if(!active?.colors.length){notify('Activate a saved palette in Color Editor > Palettes.');return;}
 const pages=Math.ceil(active.colors.length/8),colors=active.colors.slice(page*8,page*8+8);
 menu(event.clientX,event.clientY,'',[]);
 const el=$('#menu');el.classList.add('palette-pie');
 renderPaletteRadial(el,{name:active.name,colors:colors.map(id=>brushPalette.byId.get(id)),selected:scene.paintBrush?.colorId,page,pages,
  onChoose:id=>{closeMenu();chooseBrushColor(id);save();},onPage:next=>palettePie(event,next)});
 el.tabIndex=-1;el.focus({preventScroll:true});
 const size=Math.min(preferences.value.paletteMenuSize,innerWidth-12,innerHeight-12);el.style.width=el.style.height=size+'px';
 el.style.left=clamp(event.clientX-size/2,6,Math.max(6,innerWidth-size-6))+'px';el.style.top=clamp(event.clientY-size/2,6,Math.max(6,innerHeight-size-6))+'px';

}
let paintWorker=null,scopeCache=null;
function rememberPaintColor(id){
 scene.recentPaintColors=[id,...(scene.recentPaintColors||[]).filter(c=>c!==id)].slice(0,12);
 try{localStorage.setItem('avorion-viewer.recent-colors.v1',JSON.stringify(scene.recentPaintColors));}catch{}
}
function chooseBrushColor(id){
 if(!brushPalette?.byId.has(id))return;
 const brush=scene.paintBrush||{channel:'color',strength:'preserve'};
 scene.paintBrush={...brush,colorId:id};scene.paintSample=null;rememberPaintColor(id);refreshStructure();
}
function cancelPaintTask(){paintWorker?.terminate();paintWorker=null;scene.paintBusy=false;finishPaintStroke(scene,true);}
function scopedPaintIds(node){
 const o=paintOptions(node.view),hidden=viewportHiddenIds(scene,node.view);
 const key=[scene.model,scene.revision,scene.visible,scene.loaded,scene.selectedIds,scene.regions,scene.regions?.length,scene.hiddenIds,node.view.showThinBlocks,o.scope,o.regionId];
 if(!scopeCache||!key.every((v,i)=>v===scopeCache.key[i]))scopeCache={key,ids:paintScope(scene,o,hidden)};
 return scopeCache.ids;
}
function viewportPaint(phase,data,node){
 const o=paintOptions(node.view),brush=scene.paintBrush||{colorId:'Dodger Blue',channel:'color',strength:'preserve'};
 if(phase==='palette'){palettePie(data);return;}
 if(phase==='preview'){
  if(!scene.model||!brushPalette)return {ids:[],text:'Import a ship to paint.'};
  const allowed=scopedPaintIds(node),ids=mirroredIds(scene.model,data||[],o,allowed,scene.revision),b=blockIndex(scene.model).get(data?.[0]);
  const value=b?channelColor(b,brush.channel):null,color=brushPalette.byId.get(brush.colorId);
  const intent=o.tool==='eyedropper'?'Sample this color':o.tool==='restore'?'Restore imported':color?.name||'Choose color';
  const targets=['replace','fill'].includes(o.tool)?'Click to calculate '+(o.tool==='replace'?'matching colors':'connected blocks'):ids.length+' brush targets';
  return {ids,outlineIds:o.tool==='eyedropper'?data:ids.length?ids:data,locked:o.tool!=='eyedropper'&&!ids.length,text:b?`${b.id} · ${value||'No secondary color'} · ${intent} · ${o.tool==='eyedropper'?'':ids.length?targets:'Locked by scope'}`:'Hover a block to preview.'};
 }
 if(phase==='begin'){
  if(o.tool==='select'||!scene.loaded||!scene.model||!brushPalette||scene.paintBusy)return false;
  const allowed=scopedPaintIds(node);
  if(!allowed.size&&o.tool!=='eyedropper'){scene.paintMessage='Paint scope is empty. Select blocks or choose a populated region.';refreshStructure();return false;}
  if(!beginPaintStroke(scene))return false;
  if(o.tool!=='eyedropper')scene.paintSample=null;
  Object.assign(scene.paintStroke,{brush:{...brush},options:structuredClone(o),allowed,done:false});return true;
 }
 if(phase==='sample'){
  const stroke=scene.paintStroke;if(!stroke||stroke.done)return;
  const ids=Array.isArray(data)?data:[data],seed=ids[0];if(!seed)return;
  if(stroke.options.tool==='eyedropper'){
   stroke.done=true;const block=blockIndex(scene.model).get(seed);if(!block)return;
   const sample=samplePaintColor(brushPalette,block,stroke.brush.channel);
   if(sample.exact){o.tool='brush';chooseBrushColor(sample.exact.id);save();}
   scene.paintSample=sample.exact?`${sample.argb} · Exact palette RGB match: ${sample.exact.name}`:sample.argb?`${sample.argb} · Imported color outside Avorion palette; brush unchanged.`:'No secondary color on this block; brush unchanged.';
   scene.paintMessage='Color sampled.';refreshStructure();return;
  }
  if(['replace','fill'].includes(stroke.options.tool)){
   if(!stroke.allowed.has(seed))return;stroke.done=true;scene.paintBusy=true;scene.paintMessage='Calculating targets… Escape cancels.';
   const worker=paintWorker=new Worker(new URL('./paint-tools.worker.js',import.meta.url),{type:'module'}),model=scene.model,revision=scene.revision,appearanceRevision=scene.appearanceRevision;
   worker.onmessage=({data:result})=>{
    worker.terminate();if(paintWorker!==worker)return;paintWorker=null;scene.paintBusy=false;
    if(!stroke.released&&scene.paintStroke!==stroke||scene.model!==model||scene.revision!==revision||scene.appearanceRevision!==appearanceRevision){scene.paintMessage='Calculation cancelled because the model changed.';cancelPaintTask();refreshStructure();return;}
    if(result.error){scene.paintMessage=result.error;cancelPaintTask();refreshStructure();return;}
    const current=scopedPaintIds(node),allowed=new Set([...stroke.allowed].filter(id=>current.has(id)));
    const count=applyPaintTool(scene,brushPalette,stroke.brush,result.ids,stroke.options,allowed);scene.paintMessage=`${count} blocks updated.`;rememberPaintColor(stroke.brush.colorId);
    refreshStructure();
   };
   worker.onerror=e=>{scene.paintMessage='Paint calculation failed: '+e.message;cancelPaintTask();refreshStructure();};
   worker.postMessage({seedId:seed,tool:stroke.options.tool,rule:stroke.options.tool==='replace'?'color':stroke.options.fillRule,blocks:liveBlocks(scene).filter(b=>stroke.allowed.has(b.id)).map(b=>({id:b.id,position:b.position,size:b.size,typeIndex:b.typeIndex,materialIndex:b.materialIndex,paintColor:channelColor(b,stroke.brush.channel)}))});refreshStructure();return;
  }
  const count=applyPaintTool(scene,brushPalette,stroke.brush,ids,stroke.options,stroke.allowed);if(count)scene.paintMessage=`Painting ${stroke.patches.size} blocks…`;
  renderers.forEach(r=>r.draw?.());return;
 }
 if(phase==='cancel'){cancelPaintTask();scene.paintMessage='Stroke cancelled.';refreshStructure();return;}
 if(scene.paintBusy){if(scene.paintStroke){scene.paintStroke.released=true;finishPaintStroke(scene);}return;}
 const stroke=scene.paintStroke;if(stroke?.patches.size){scene.paintMessage=`${stroke.patches.size} blocks updated.`;if(stroke.options.tool!=='restore')rememberPaintColor(stroke.brush.colorId);}
 finishPaintStroke(scene);refreshStructure();
}
function changePaintHistory(redo=false){if(undoPaint(scene,redo)){refreshStructure();log(redo?'Repaint restored.':'Repaint undone.','COLOR');}}
function openColorWorkshop(){
  let target=state.workspaces.find(w=>w.name==='Colors'&&leaves(w.root).some(n=>n.editor==='color'));
  if(!target){if(state.workspaces.length>=20){notify('Workspace limit reached. Change an existing area to Color Editor.');return;}const viewport=area();const current=leaves(workspace().root).find(n=>n.editor==='viewport');if(current)viewport.view=structuredClone(current.view);target={id:uid(),name:'Colors',root:split('x',.38,split('y',.75,viewport,area('outliner')),area('color'))};state.workspaces.push(target);}
  switchWorkspace(target.id);
}
function resetWorkspace(){const template=defaults().workspaces.find(w=>w.id===workspace().id);workspace().root=template?template.root:area();maximized=null;focusMode=false;commit('Current workspace reset.');}
function toggleMaximize(id,focus=false){if(maximized===id&&focusMode===focus){maximized=null;focusMode=false;}else{maximized=id;focusMode=focus;}render();}
$('#restore-button').onclick=()=>{maximized=null;focusMode=false;render();};
$('#help-button').onclick=()=>$('#help-dialog').showModal();
function navigationHint(){
  const p=preferences.value;
  if(p.trackpadNavigation)return 'Two-finger swipe Orbit · Shift + swipe Pan · Pinch Zoom';
  if(p.emulate3Button)return 'Alt + LMB Orbit · Alt + Shift + LMB Pan · '+shortcut('wheelZoom')+' Zoom';
  return shortcut('orbitDrag')+' Orbit · '+shortcut('panDrag')+' Pan · '+shortcut('wheelZoom')+' Zoom';
}
function wireInputStyles(host){
  for(const choice of host.querySelectorAll('[data-style]')){
    choice.disabled=choice.dataset.style==='trackpad';
    const selected=choice.dataset.style===preferences.value.inputStyle;
    choice.classList.toggle('active',selected);choice.setAttribute('aria-pressed',String(selected));
    choice.onclick=()=>{
      if(choice.disabled)return;
      preferences.set('inputStyle',choice.dataset.style);
      document.querySelectorAll('.input-style-options').forEach(wireInputStyles);
    };
  }
}
function openInputStyle(){
  const dialog=$('#input-style-dialog');wireInputStyles(dialog);
  if(!dialog.open)dialog.showModal();
}
// Drop an .xml to open it; drop texture images or a texture folder to load them.
const TEXTURE_FILE=/\.(png|bmp|jpe?g|webp)$/i;
async function droppedFiles(transfer){
  const entries=[...transfer.items||[]].map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
  if(!entries.some(entry=>entry.isDirectory))return [...transfer.files];
  const files=[];
  const fileOf=entry=>new Promise((resolve,reject)=>entry.file(resolve,reject));
  const children=reader=>new Promise((resolve,reject)=>reader.readEntries(resolve,reject));
  async function walk(entry){
    if(entry.isFile){files.push(await fileOf(entry));return;}
    const reader=entry.createReader();let batch;
    while((batch=await children(reader)).length)for(const child of batch)await walk(child);
  }
  for(const entry of entries)await walk(entry);
  return files;
}
let dragDepth=0;
const carriesFiles=e=>!embedded&&[...e.dataTransfer?.types||[]].includes('Files')&&!document.querySelector('dialog[open]');
document.addEventListener('dragenter',e=>{if(!carriesFiles(e))return;e.preventDefault();dragDepth++;$('#drop-overlay').hidden=false;});
document.addEventListener('dragover',e=>{if(!carriesFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';});
document.addEventListener('dragleave',e=>{if(!carriesFiles(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('#drop-overlay').hidden=true;});
document.addEventListener('drop',async e=>{
  if(!carriesFiles(e))return;
  e.preventDefault();dragDepth=0;$('#drop-overlay').hidden=true;
  try{
    const files=await droppedFiles(e.dataTransfer);
    const xml=files.find(f=>/\.xml$/i.test(f.name)),images=files.filter(f=>TEXTURE_FILE.test(f.name));
    if(images.length){notify('Loading local textures…');await loadAssetTextures(images);}
    if(xml)await openXmlFile(xml);
    if(!xml&&!images.length)notify('Drop an Avorion .xml file or texture images.');
  }catch(error){notify(error.message);reportError(error,'FILE');}
});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

function render(){
  rememberEditorScroll($('#screen'));
  assetPersistence.changed();
  if(scene.paintBusy)cancelPaintTask();
  closeViewportPopover();
  renderers.forEach(r=>r.dispose());renderers=[];
  renderTopbar();const screen=$('#screen');screen.replaceChildren();document.body.classList.toggle('focus-mode',focusMode);$('#restore-bar').hidden=!maximized;
  const root=maximized?find(workspace().root,maximized):workspace().root;
  if(!root){maximized=null;focusMode=false;return render();}
  const tree=renderNode(root);const size=minimum(root);tree.style.minWidth=`${size.width}px`;tree.style.minHeight=`${size.height}px`;screen.append(tree);
  for(const canvas of screen.querySelectorAll('[data-editor=viewport] canvas')){const node=find(workspace().root,canvas.closest('.area').dataset.areaId);renderers.push(mountViewport(canvas,node,scene,save,(selected,additive,meta)=>regionPick(selected,meta)||selected&&typeof selected==='object'&&!Array.isArray(selected)?refreshStructure():selectStructure(Array.isArray(selected)?selected:typeof selected==='string'?[selected]:selected?liveBlocks(scene).map(b=>b.id):[],additive,true),()=>preferences.value,event=>viewportPie(event,node),(phase,data)=>viewportPaint(phase,data,node)));canvas.addEventListener('dblclick',()=>openGalleryBlock(node));}
  updateLogs();applyPreferences();restoreEditorScrollAfterLayout(screen);
}
function renderNode(node){return renderWorkspaceNode(node,{renderArea,renderers,gesture,save,resizeDirection,modifierActive,preferences,areaMenu});}
function headerFor(node){
  const header=document.createElement('header');header.className='area-header';
  const picker=button('Editor type',`${icon(editorIcon(node.editor))}<span class="chevron">⌄</span>`,()=>anchorMenu(picker,'Editor type',Object.entries(EDITORS).map(([id,label])=>({label:`${id===node.editor?'✓  ':''}${label}`,action:()=>{node.editor=id;commit(`Editor changed to ${label}.`);}}))),'editor-switch');header.append(picker);
  if(node.editor==='viewport'){
    const mode=document.createElement('select');mode.className='header-name';mode.setAttribute('aria-label','Interaction mode');for(const [id,label] of INTERACTION_MODES)mode.add(new Option(label,id));mode.value=interactionMode(node.view.interactionMode);mode.title='Tab cycles modes. Object: drag to box select, Ctrl-drag to subtract. Paint: drag to paint blocks with the active Color Editor color; Escape cancels the stroke. Socket: select turret sockets and mounted turrets.';mode.onchange=()=>{renderers.find(r=>r.id===node.id)?.cancel();cancelPaintTask();node.view.interactionMode=mode.value;commit();};header.append(mode);
    const divider=document.createElement('span');divider.className='header-divider';header.append(divider);
    const view=button('View menu','View',()=>anchorMenu(view,'View',[
      {label:'Frame all',key:shortcut('frame'),action:()=>frameArea(node)},
      {label:'Frame selected',key:shortcut('selected'),disabled:!scene.selected||!scene.loaded,disabledReason:'Load a model and select visible blocks before framing the selection.',action:()=>navigate(node,{action:'selected'})},
      {label:'Perspective / Orthographic',key:shortcut('projection'),action:()=>navigate(node,{action:'projection'})},
      {label:'Navigation',submenu:()=>navigationItems(node)},
      {label:'Zoom region…',key:shortcut('region'),action:()=>navigate(node,{action:'region'})},null,
      {label:'Front',key:shortcut('front'),action:()=>setView(node,'front')},
      {label:'Back',key:shortcut('back'),action:()=>setView(node,'back')},
      {label:'Right',key:shortcut('right'),action:()=>setView(node,'right')},
      {label:'Left',key:shortcut('left'),action:()=>setView(node,'left')},
      {label:'Top',key:shortcut('top'),action:()=>setView(node,'top')},
      {label:'Bottom',key:shortcut('bottom'),action:()=>setView(node,'bottom')},null,
      {label:`${node.toolbar?'Hide':'Show'} toolbar`,key:shortcut('toolbar'),action:()=>{node.toolbar=!node.toolbar;commit();}},
      {label:`${node.sidebar?'Hide':'Show'} sidebar`,key:shortcut('sidebar'),action:()=>{node.sidebar=!node.sidebar;commit();}},null,
      {label:'Maximize area',key:shortcut('maximize'),action:()=>toggleMaximize(node.id)}
    ]));header.append(view);
    const select=button('Select menu','Select',()=>anchorMenu(select,'Select',[
      {label:'Select model',key:shortcut('selectAll'),disabled:!scene.loaded,disabledReason:'Load a model or the Block Gallery before selecting it.',action:()=>selectStructure(liveBlocks(scene).map(b=>b.id))},
      {label:'Deselect all',key:shortcut('deselectAll'),action:()=>selectStructure([])}
    ]));select.className='header-optional';header.append(select);
    const spacer=document.createElement('span');spacer.className='spacer';header.append(spacer);
    const grid=button('Toggle grid',icon('grid'),()=>{node.view.grid=!node.view.grid;commit();},node.view.grid?'active':'');grid.setAttribute('aria-pressed',String(node.view.grid));header.append(grid);
    const thin=button('Show/Hide 0 thickness blocks',icon('thinBlocks'),()=>{node.view.showThinBlocks=node.view.showThinBlocks===false;commit();},node.view.showThinBlocks!==false?'active':'');thin.title='Show/Hide 0 thickness blocks (any dimension below 0.01)';thin.setAttribute('aria-pressed',String(node.view.showThinBlocks!==false));header.append(thin);
    viewportHeader(header,node.view,()=>{save();renderers.find(r=>r.id===node.id)?.draw();});
    const sidebar=button('Toggle sidebar',icon('sidebar'),()=>{node.sidebar=!node.sidebar;commit();},node.sidebar?'active':'');sidebar.setAttribute('aria-pressed',String(node.sidebar));header.append(sidebar);
  }else if(node.editor==='outliner'){
    header.insertAdjacentHTML('beforeend','<span class="header-name">Ship structure</span><span class="spacer"></span><input class="outliner-search" type="search" placeholder="Search" aria-label="Search blocks">');
    header.querySelector('input').maxLength=1000;
    header.querySelector('input').addEventListener('input',e=>{node.search=e.target.value;renderers.find(r=>r.outlinerId===node.id)?.search();save();});header.querySelector('input').value=node.search||'';
  }else if(node.editor==='properties'){
    const field=document.createElement('span');field.className='property-search-field';
    const search=document.createElement('input');search.type='search';search.className='property-search';search.placeholder='Search properties';search.setAttribute('aria-label','Search properties, values and settings in every Properties tab');search.title='Find labels and values in every Properties tab. Enter jumps to the next match, Shift+Enter to the previous one, Escape clears.';search.value=node.propertySearch||'';search.maxLength=200;search.spellcheck=false;search.autocomplete='off';
    const count=document.createElement('span');count.className='property-search-count';count.setAttribute('role','status');count.hidden=true;
    const rerender=()=>{const body=areaElement(node.id)?.querySelector('.area-body');if(body)renderProperties(body,node);};
    search.oninput=()=>{node.propertySearch=search.value;save();clearTimeout(propertySearchTimer);propertySearchTimer=setTimeout(rerender,120);};
    search.onkeydown=e=>{
      if(e.key==='Enter'){e.preventDefault();clearTimeout(propertySearchTimer);if(propertySearchResults.get(node.id)?.query!==search.value)rerender();stepPropertySearch(node,e.shiftKey?-1:1);}
      else if(e.key==='Escape'&&search.value){e.preventDefault();e.stopPropagation();search.value='';node.propertySearch='';save();clearTimeout(propertySearchTimer);rerender();}
    };
    field.append(search,count);header.append(field);
    const spacer=document.createElement('span');spacer.className='spacer';header.append(spacer);
  }else{
    header.insertAdjacentHTML('beforeend',`<span class="header-name">${escape(t(EDITORS[node.editor]))}</span><span class="spacer"></span>`);
    if(node.editor==='info'){
      const order=button('Reverse activity order',node.infoNewestFirst?'Newest on Top':'Newest on Bottom',()=>{node.infoNewestFirst=!node.infoNewestFirst;order.textContent=node.infoNewestFirst?'Newest on Top':'Newest on Bottom';order.setAttribute('aria-pressed',String(node.infoNewestFirst));updateLogs();save();});
      order.title='Reverse entry order: newest on top or bottom';order.setAttribute('aria-pressed',String(!!node.infoNewestFirst));
      const filter=button('Show only errors and warnings',`${escape(t('Errors & Warnings'))}<span class="count"></span>`,()=>{node.infoFilter=node.infoFilter==='problems'?'all':'problems';filter.setAttribute('aria-pressed',String(node.infoFilter==='problems'));filter.classList.toggle('active',node.infoFilter==='problems');updateLogs();save();},'info-filter');
      filter.setAttribute('aria-pressed',String(node.infoFilter==='problems'));filter.classList.toggle('active',node.infoFilter==='problems');filter.title='Show only errors and warnings';
      header.append(filter,order,button('Copy activity log','Copy',()=>copyLog(node.infoFilter==='problems')),button('Clear activity log','Clear',()=>clearLog()));
    }
  }
  const options=button('Area options','⋮',e=>areaMenu(e,node),'icon-button');header.append(options);
  header.addEventListener('contextmenu',e=>{e.preventDefault();areaMenu(e,node);});
  return header;
}
function renderArea(node){
  const el=document.createElement('section');el.className=`area${node.headerBottom?' header-bottom':''}`;el.dataset.areaId=node.id;el.dataset.editor=node.editor;el.dataset.scrollContext=node.editor+':'+(node.editor==='properties'?(node.propertyTab||'object'):'');el.setAttribute('aria-label',t(EDITORS[node.editor]));
  el.addEventListener('pointerenter',()=>{hovered=node.id;if(node.editor==='viewport'){lastViewportId=node.id;renderers.forEach(r=>{if(r.outlinerId)r.sync?.();});syncSceneProperties();}$('#status-hint').textContent=node.editor==='viewport'?navigationHint()+' · '+shortcut('maximize')+' Maximize':'Right-click header for area options · '+shortcut('maximize')+' Maximize';});
  el.addEventListener('focusin',()=>{hovered=node.id;if(node.editor==='viewport'){lastViewportId=node.id;renderers.forEach(r=>{if(r.outlinerId)r.sync?.();});syncSceneProperties();}});
  el.append(headerFor(node));
  const body=document.createElement('div');body.className='area-body';
  if(node.editor==='viewport')renderViewport(body,node);
  if(node.editor==='outliner')renderOutliner(body,node);
  if(node.editor==='properties')renderProperties(body,node);
  if(node.editor==='preferences'){
    if(!preferenceEditors.has(node.id))preferenceEditors.set(node.id,{});
    const controller=mountPreferences(body,preferences,preferenceEditors.get(node.id),assetActions);controller.preferenceAreaId=node.id;renderers.push(controller);
  }
  if(node.editor==='color')renderers.push(mountColorEditor(body,node,scene,{save,changed:refreshStructure,brushChanged:()=>{if(scene.paintBrush)rememberPaintColor(scene.paintBrush.colorId);refreshStructure();},select:ids=>selectStructure(ids),focus:ids=>focusStructure(ids),isolate:ids=>visibilityStructure(ids,'isolate'),addRegion:name=>{const region=addRegion(scene,name,[...scene.selectedIds]);refreshStructure();return region;},apply:(...args)=>{const count=paintPaletteColor(scene,...args);refreshStructure();return count;},undo:changePaintHistory}));
  if(node.editor==='assets')renderers.push(mountTurretLibrary(body,refreshStructure));
  if(node.editor==='info')body.classList.add('info-body');
  const paintSettings=body.querySelector('.paint-tool-settings');if(paintSettings)el.append(paintSettings);
  el.append(body);
  if(node.editor!=='preferences')body.querySelectorAll('details').forEach(panel=>{
    const key=`${node.editor}:${node.propertyTab||'object'}:${panel.querySelector('summary').textContent}`;
    if(node.panels&&Object.hasOwn(node.panels,key))panel.open=node.panels[key];
    panel.addEventListener('toggle',()=>{node.panels??={};node.panels[key]=panel.open;save();});
  });
  if(!maximized)for(const corner of ['top-right','bottom-left']){const grip=button('Drag to split or join area','',e=>e.preventDefault(),`corner-grip ${corner}`);grip.tabIndex=-1;grip.addEventListener('pointerdown',e=>cornerDrag(e,node));el.append(grip);}
  if(focusMode)el.append(button('Exit focus mode','↶ Back to Previous',()=>toggleMaximize(node.id,true),'focus-exit'));
  return el;
}
function transformPanel(){const b=scene.model?.blocks.find(b=>b.id===scene.selectedId)||scene.model?.blocks[0];return b?`<details class="panel" open><summary>Native Transform</summary><div class="sub-label">Position · X / Y / Z</div><p class="panel-note">${['x','y','z'].map(a=>b.position[a].toFixed(3)).join(' / ')}</p><div class="sub-label">Dimensions · X / Y / Z</div><p class="panel-note">${['x','y','z'].map(a=>b.size[a].toFixed(3)).join(' / ')}</p><p class="panel-note">Look ${b.look} · Up ${b.up} · Native units</p></details>`:'';}
function emptyState(){
  const card=document.createElement('section');card.className='empty-state';
  card.innerHTML='<p>Drop an Avorion .xml here, or open the welcome screen.</p>';
  card.append(button('Welcome','Open Welcome',()=>welcome?.open(),'primary'));
  return card;
}
function textureBadge(){
  const count=textureLibrary.loadedCount;
  const badge=button(count?`${count} texture maps loaded. Click for texture options.`:'No textures loaded. Click to load the game texture folder.',count?`Textures · ${count}`:'Textures: none · Load…',()=>{
    if(!count){loadTextures();return;}
    anchorMenu(badge,'Textures',[{label:'Load texture folder…',action:loadTextures},{label:'Unload textures',action:()=>{textureLibrary.clear();textureStatus='Neutral texture fallback';scene.revision++;render();notify('Textures unloaded.');}}]);
  },'texture-badge'+(count?'':' missing'));
  return badge;
}
function renderViewport(body,node){
  ensureViewportOptions(node.view);
  body.classList.add('viewport');if(!node.toolbar)body.classList.add('collapse-toolbar');if(node.sidebar)body.classList.add('sidebar-visible');body.style.setProperty('--sidebar-width',`${node.sidebarWidth}px`);
  ensureCamera(node.view);
  body.innerHTML=`<canvas aria-label="3D Avorion viewport" tabindex="0"></canvas><div class="viewport-meta"><div class="view-label">${viewLabel(node.view)}</div><div>${scene.loaded?`(1) Collection | <strong>${escape(scene.model?.fileName||BLOCK_GALLERY_NAME)}</strong>`:'Collection | Empty scene'}</div></div><div class="viewport-statistics"></div><div class="viewport-footer"><span class="demo-badge">AVORION</span><span>${scene.model?.blocks.length||0} blocks · ${textureLibrary.loadedCount} texture maps</span></div><div class="region-zoom-hint">Zoom region · LMB in / MMB out · Esc cancel</div>`;
  if(!scene.loaded)body.append(emptyState());
  else{const badge=textureBadge();body.append(badge);}
  if(node.view.interactionMode==='paint'){body.classList.add('painting-tools');renderers.push(mountPaintToolbar(body,node,scene,{palette:()=>brushPalette,color:chooseBrushColor,undo:changePaintHistory,cancel:()=>{renderers.find(r=>r.id===node.id)?.cancel();if(scene.paintBusy)cancelPaintTask();},change:()=>{save();refreshStructure();}}));}
  if(node.toolbar&&node.view.interactionMode!=='paint'){
    const toolbar=document.createElement('div');toolbar.className='viewport-toolbar';toolbar.role='toolbar';toolbar.setAttribute('aria-label','Viewport tools');
    for(const [tool,label] of [['select','Select'],['orbit','Orbit'],['pan','Pan']]){const b=button(label,icon(tool),()=>{node.view.tool=tool;commit();},node.view.tool===tool?'active':'');b.setAttribute('aria-pressed',String(node.view.tool===tool));toolbar.append(b);}
    toolbar.append(document.createElement('hr'),button('Frame all',icon('frame'),()=>frameArea(node)));body.append(toolbar);
  }
  const nav=document.createElement('div');nav.className='navigation';
  const axes=document.createElement('div');axes.className='axis-widget';axes.dataset.navDrag='orbit';axes.title='Drag to orbit · Click an axis to align';
  for(const [axis,name,vector] of [['z','top',[0,0,1]],['z','bottom',[0,0,-1]],['y','back',[0,1,0]],['y','front',[0,-1,0]],['x','right',[1,0,0]],['x','left',[-1,0,0]]]){
    const negative=vector.some(v=>v<0);
    const b=button(`${name[0].toUpperCase()+name.slice(1)} view`,`${negative?'−':''}${axis.toUpperCase()}`,()=>{
      if(viewLabel(node.view).toLowerCase().startsWith(`${name} `))navigate(node,{action:'opposite'});
      else setView(node,name);
    },`axis-${axis}${negative?' negative-axis':''}`);b.dataset.axis=JSON.stringify(vector);axes.append(b);
    // Half of the axis line, from the center out to this ball; the viewport sorts it by depth.
    const line=document.createElement('span');line.className=`axis-line axis-line-${axis}`;line.dataset.axisLine=b.dataset.axis;axes.prepend(line);
  }
  axes.insertAdjacentHTML('beforeend','<span class="axis-center"></span>');nav.append(axes);
  const cube=document.createElement('div');cube.className='view-cube';cube.dataset.navDrag='orbit';
  const updateCube=mountViewCube(cube,name=>navigate(node,{action:'cube',value:name}),command=>navigate(node,command));updateCube(node.view);cube.updateView=updateCube;nav.append(cube);
  for(const [mode,label,ico] of [['zoom','Drag to zoom','zoom'],['pan','Drag to pan','pan']]){const b=button(label,icon(ico),()=>{},'icon-button');b.dataset.navDrag=mode;nav.append(b);}
  const projection=button('Toggle perspective / orthographic',icon('cube'),()=>navigate(node,{action:'projection'}),'icon-button');projection.dataset.projection='';projection.setAttribute('aria-pressed',String(node.view.projection==='perspective'));nav.append(projection);
  nav.append(button('Frame all',icon('frame'),()=>frameArea(node),'icon-button'));body.append(nav);
  if(node.sidebar){
    const sidebar=document.createElement('aside');sidebar.className='viewport-sidebar';sidebar.style.width=`${node.sidebarWidth}px`;sidebar.setAttribute('aria-label','Viewport sidebar');
    sidebar.innerHTML=`<div class="region-resizer" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" tabindex="0"></div><div class="sidebar-tabs"><span>Item / View</span></div>${scene.loaded?transformPanel():'<p class="panel-note">No model in the scene.</p>'}`;
    viewportViewPanel(sidebar,node.view,()=>{save();renderers.find(r=>r.id===node.id)?.draw();});
    const handle=sidebar.querySelector('.region-resizer');
    const resize=x=>{node.sidebarWidth=clamp(x,140,Math.min(600,Math.max(140,body.clientWidth-60)));sidebar.style.width=`${node.sidebarWidth}px`;body.style.setProperty('--sidebar-width',`${node.sidebarWidth}px`);};
    handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const original=node.sidebarWidth;gesture(e,move=>resize(body.getBoundingClientRect().right-move.clientX),save,()=>resize(original));});
    handle.addEventListener('keydown',e=>{const direction=resizeDirection(e);if(direction){e.preventDefault();e.stopPropagation();resize(node.sidebarWidth-direction*(modifierActive('largeResize',e,preferences.value)?40:10));save();}});
    body.append(sidebar);
  }
}
function frameArea(node){navigate(node,{action:'frame'});}
function setView(node,name){navigate(node,{action:'align',value:name});}
function navigate(node,command){
  if(command.interrupt!==false)scene.turretStudio?.manualCamera();
  const renderer=renderers.find(r=>r.id===node.id),canvas=areaElement(node.id)?.querySelector('canvas');
  if(!renderer||!canvas)return;
  const view=ensureCamera(node.view),{width,height}=canvas.getBoundingClientRect();
  const {action,value,x,y}=command;
  if(action==='region'){renderers.forEach(r=>r.cancel?.());renderer.startRegion();return;}
  if(renderer.navigating)return;
  if(action==='align')alignView(view,value);
  if(action==='cube'){selectCubeView(view,value);frameVisibleModel(scene,view,width,height,preferences.value);}
  if(action==='home'){homeCubeView(view);frameVisibleModel(scene,view,width,height,preferences.value);}
  if(action==='pole-roll')rotatePoleView(view,value>0);
  if(action==='opposite')opposite(view);
  if(action==='projection')view.projection=view.projection==='perspective'?'orthographic':'perspective';
  if(action==='orbit')orbit(view,x,y,{autoPerspective:false});
  if(action==='roll')view.roll=Math.atan2(Math.sin(view.roll+value),Math.cos(view.roll+value));
  if(action==='pan')pan(view,x,y,width,height);
  if(action==='zoom')zoom(view,value);
  if(action==='dolly')dolly(view,value,width,height);
  if(action==='frame'){frameVisibleModel(scene,view,width,height,preferences.value);}
  if(action==='selected'){
    
    const hidden=viewportHiddenIds(scene,view);
    const targets=liveBlocks(scene).filter(b=>!hidden.has(b.id)&&(action==='frame'||scene.selectedIds.has(b.id)));
    if(!targets.length){notify('No visible blocks to frame.');return;}
    frameBounds(view,blockFramePoints(targets),width,height);
  }
  renderer.draw();save();
}
function navigationItems(node){
  const STEP=preferences.value.rotationAngle*Math.PI/180;
  const rect=areaElement(node.id).querySelector('.area-header').getBoundingClientRect();
  const item=(label,key,command)=>({label,key,action:()=>navigate(node,command)});
  return [
    item('Orbit left',shortcut('orbitLeft'),{action:'orbit',x:STEP/.008,y:0}),
    item('Orbit right',shortcut('orbitRight'),{action:'orbit',x:-STEP/.008,y:0}),
    item('Orbit up',shortcut('orbitUp'),{action:'orbit',x:0,y:STEP/.008}),
    item('Orbit down',shortcut('orbitDown'),{action:'orbit',x:0,y:-STEP/.008}),
    item('Opposite view',shortcut('opposite'),{action:'opposite'}),null,
    item('Roll left',shortcut('rollLeft'),{action:'roll',value:-STEP}),
    item('Roll right',shortcut('rollRight'),{action:'roll',value:STEP}),null,
    item('Pan left',shortcut('panLeft'),{action:'pan',x:40,y:0}),
    item('Pan right',shortcut('panRight'),{action:'pan',x:-40,y:0}),
    item('Pan up',shortcut('panUp'),{action:'pan',x:0,y:40}),
    item('Pan down',shortcut('panDown'),{action:'pan',x:0,y:-40}),null,
    item('Zoom in',shortcut('zoomIn'),{action:'zoom',value:1.2}),
    item('Zoom out',shortcut('zoomOut'),{action:'zoom',value:1/1.2}),
    item('Dolly forward',shortcut('dollyDrag'),{action:'dolly',value:-40}),
    item('Dolly backward','',{action:'dolly',value:40}),
    item('Zoom region…',shortcut('region'),{action:'region'})
  ];
}
function renderOutliner(body,node){
  renderers.push(mountShipStructure(body,node,scene,{getPreferences:()=>preferences.value,getView:structureView,select:selectStructure,visibility:visibilityStructure,focus:focusStructure,menu,save,reveal:(ids,kind)=>revealStructure(ids,{kind})}));
  renderers.push(mountTurretOutliner(body,scene,refreshStructure));
}
function captureViewport(){return leaves(workspace().root).find(n=>n.id===lastViewportId&&n.editor==='viewport')||leaves(workspace().root).find(n=>n.editor==='viewport');}
function openCapture(imageType){
 const node=captureViewport();if(!node||!scene.loaded)return;
 renderers.forEach(r=>r.cancel?.());cancelPaintTask();
 openExportDialog(scene,node.view,ids=>selectStructure(ids),{imageType,preferences:preferences.value,canvas:areaElement(node.id)?.querySelector('canvas')});
}
function syncSceneProperties(){document.querySelectorAll('.scene-properties').forEach(el=>el.refresh?.());}
const PROPERTY_TABS=[['object','cube','Object properties'],['scene','scene','Scene properties'],['world','world','World sky'],['shaders','rendered','Shaders'],['turrets','turret','Turrets'],['workspace','properties','Workspace settings']];
function mountPropertyTab(tab,content,node,searching=false){
  if(tab==='object')mountBlockInspector(content,scene,(change)=>{if(change?.appearance){refreshStructure();return;}scene.model={...makeModel(scene.model.blocks,scene.model.fileName),turretMounts:scene.model.turretMounts};scene.revision++;render();},{reveal:revealStructure,preferences});
  if(tab==='turrets')mountTurretProperties(content,scene,refreshStructure,socket=>{const node=leaves(workspace().root).find(n=>n.editor==='viewport');const canvas=node&&areaElement(node.id)?.querySelector('canvas');return !!canvas&&socketExposed(scene,node.view,canvas.clientWidth,canvas.clientHeight,socket,preferences.value);},(direction,bounds)=>{const viewport=captureViewport();if(viewport){if(direction==='coverage'){viewport.view.target=nativeToView(bounds.center);viewport.view.zoom=3/Math.max(.1,bounds.radius);viewport.view.panX=viewport.view.panY=0;save();renderers.find(r=>r.id===viewport.id)?.draw();}else{viewport.view.projection='orthographic';setView(viewport,direction);}}});
  // World and Shaders edit live preferences beside an unobscured viewport. The Properties search covers them, so they have no search bar of their own.
  if(tab==='world'||tab==='shaders'){
    if(!lookEditors.has(node.id+tab))lookEditors.set(node.id+tab,{});
    const panel=mountPreferences(content,preferences,searching?{}:lookEditors.get(node.id+tab),assetActions,{sections:[sectionById(tab)],compact:true,searchbar:false});
    renderers.push({dispose:()=>panel.dispose()});
  }
  if(tab==='scene')mountSceneProperties(content,scene,{getView:()=>captureViewport()?.view,preferences,capture:openCapture,textureStatus});
  if(tab==='workspace'){
    content.innerHTML=`<div class="property-breadcrumb">${icon('properties')}Workspace</div><details class="panel" open><summary>Window system</summary><div class="field-row"><span>Workspace</span><span>${escape(workspace().name)}</span></div><div class="field-row"><span>Editor areas</span><span>${leaves(workspace().root).length}</span></div><div class="field-row"><span>Storage</span><span>This browser</span></div><p class="panel-note">Drag area borders to resize. Right-click a header or border to split, join, swap, or maximize an editor.</p><button class="setting-button" data-reset>Reset workspace layout</button></details><div class="app-title-panel"><span class="eyebrow" data-no-translate>AVORION VIEWER ${APP_VERSION}</span><h3>${escape(scene.model?.fileName||'No model loaded')}</h3><p>${scene.model?`${scene.model.blocks.length} blocks`:'Open an Avorion XML model from the File menu.'}</p></div>`;
    content.querySelector('[data-reset]').onclick=resetWorkspace;
  }
}
// Search mounts every tab as a result group, then filters rows by label, panel title and current value.
function filterProperties(body,node){
  const content=body.querySelector('.property-content');if(!content)return;
  const query=node.propertySearch||'',groups=[...content.querySelectorAll('.property-search-group')];
  const results=[];content.querySelector('.property-search-empty')?.remove();
  if(groups.length){
    for(const group of groups){
      const matches=applyPropertySearch(group.querySelector('.property-search-body'),query,group.dataset.label);
      group.hidden=!matches.length;results.push(...matches);
      const tab=body.querySelector(`.property-tabs [data-tab="${group.dataset.tab}"]`);
      if(tab){tab.classList.toggle('search-match',matches.length>0);tab.classList.toggle('search-empty',!matches.length);tab.dataset.count=matches.length>99?'99+':String(matches.length);tab.title=`${t(group.dataset.label)} · ${matches.length} ${matches.length===1?'match':'matches'}`;}
    }
  }else results.push(...applyPropertySearch(content,query));
  if(searchTerms(query).length&&!results.length){const empty=document.createElement('p');empty.className='panel-note property-search-empty';empty.textContent=`No properties match “${query.trim()}”.`;content.append(empty);}
  propertySearchResults.set(node.id,{results,index:-1,query});
  updatePropertySearchCount(node);
}
const propertySearchResults=new Map();
function updatePropertySearchCount(node){
  const count=areaElement(node.id)?.querySelector('.property-search-count');if(!count)return;
  const state=propertySearchResults.get(node.id),searching=searchTerms(node.propertySearch||'').length>0,total=state?.results.length||0;
  count.hidden=!searching;
  count.textContent=!total?'No results':state.index<0?`${total} ${total===1?'match':'matches'}`:`${state.index+1} / ${total}`;
  count.classList.toggle('is-empty',searching&&!total);
}
// Enter / Shift+Enter in the search field steps through results and scrolls each into view.
function stepPropertySearch(node,direction){
  const state=propertySearchResults.get(node.id);if(!state?.results.length)return;
  const live=state.results.filter(el=>el.isConnected);if(!live.length)return;state.results=live;
  state.results[state.index]?.classList.remove('property-search-current');
  state.index=(state.index+direction+live.length)%live.length;
  const target=live[state.index];target.classList.add('property-search-current');
  target.scrollIntoView({block:'center',behavior:'smooth'});
  updatePropertySearchCount(node);
}
let propertySearchTimer=0;
function renderProperties(body,node){
  if(assetDraft){mountAssetProperties(body,node,assetDraft,scene,()=>{scene.blockTransforms=assetPoseTransforms(assetDraft);scene.appearanceRevision=(scene.appearanceRevision||0)+1;scene.appearanceDirty=new Set(scene.model.blocks.map(b=>b.id));refreshStructure();});layoutPropertyRows(body.querySelector('.property-content'));filterProperties(body,node);return;}
  const previous=body.querySelector('.property-content'),scroll=previous?{top:previous.scrollTop,left:previous.scrollLeft}:null;
  body.innerHTML='<div class="property-layout"><nav class="property-tabs" aria-label="Properties categories"></nav><div class="property-content"></div></div>';
  const tab=node.propertyTab||'object',searching=searchTerms(node.propertySearch||'').length>0;
  const content=body.querySelector('.property-content');
  for(const [name,ico,label] of PROPERTY_TABS){
    const b=button(label,icon(ico),()=>{
      // While searching, a tab jumps to its results; otherwise it opens the tab.
      if(searching){content.querySelector(`.property-search-group[data-tab="${name}"]:not([hidden])`)?.scrollIntoView({block:'start',behavior:'smooth'});return;}
      node.propertyTab=name;commit();areaElement(node.id)?.querySelector('.property-tabs .active')?.focus();
    },tab===name&&!searching?'active':'');
    b.dataset.tab=name;b.setAttribute('aria-pressed',String(tab===name&&!searching));body.querySelector('nav').append(b);
  }
  if(searching){
    content.classList.add('property-search-results');
    for(const [name,ico,label] of PROPERTY_TABS){
      const group=document.createElement('section');group.className='property-search-group';group.dataset.tab=name;group.dataset.label=label;
      const heading=document.createElement('h2');heading.className='property-search-heading';heading.innerHTML=icon(ico);const title=document.createElement('span');title.textContent=t(label);heading.append(title);
      // Opening a result group leaves search on that tab.
      const open=document.createElement('button');open.type='button';open.className='property-search-open';open.textContent='Open tab';open.title=`Clear the search and open ${t(label)}`;open.onclick=()=>{node.propertySearch='';node.propertyTab=name;commit();};heading.append(open);
      const host=document.createElement('div');host.className='property-search-body';group.append(heading,host);content.append(group);
      try{mountPropertyTab(name,host,node,true);}catch(error){reportError(error,'Properties search');host.replaceChildren();}
    }
  }else mountPropertyTab(tab,content,node);
  wireTabs(body.querySelector('.property-tabs'),content);
  layoutPropertyRows(content);
  wirePanels(content,node,tab+':',searching);
  filterProperties(body,node);
  if(scroll&&!searching){content.scrollTop=scroll.top;content.scrollLeft=scroll.left;}
}

function siblingOf(node){const p=parentOf(workspace().root,node.id);if(!p)return null;const sibling=p.first.id===node.id?p.second:p.first;return sibling.type==='area'?sibling:null;}
function areaMenu(event,node){
  hovered=node.id;const sibling=siblingOf(node);const target=event.currentTarget?.getBoundingClientRect();
  menu(event.clientX||target?.left||20,event.clientY||target?.bottom||40,'Area options',[
    {label:'Vertical split',disabled:!!maximized,disabledReason:'Restore the maximized area before splitting the layout.',action:()=>startSplit(node,'x')},
    {label:'Horizontal split',disabled:!!maximized,disabledReason:'Restore the maximized area before splitting the layout.',action:()=>startSplit(node,'y')},
    {label:'Join neighbor · keep this editor',disabled:!sibling||!!maximized,disabledReason:maximized?'Restore the maximized area first.':'This area has no sibling neighbor. Split an area to create a neighbor first.',action:()=>startJoin(node,sibling)},
    {label:'Swap with neighbor',disabled:!sibling||!!maximized,disabledReason:maximized?'Restore the maximized area first.':'This area has no sibling neighbor. Split an area to create a neighbor first.',action:()=>{swapAreas(workspace().root,node.id,sibling.id);commit('Adjacent editors swapped.');}},null,
    {label:maximized?'Restore area':'Maximize area',key:shortcut('maximize'),action:()=>toggleMaximize(node.id)},
    {label:'Toggle focus mode',key:shortcut('focus'),action:()=>toggleMaximize(node.id,true)},null,
    {label:node.headerBottom?'Move header to top':'Move header to bottom',action:()=>{node.headerBottom=!node.headerBottom;commit();}}
  ]);
}
function cancelOperation(){if(operation){const previous=operation;operation=null;previous.cancel?.();previous.controller?.abort();}$('#operation-overlay').hidden=true;$('#status-hint').textContent='Drag borders to resize · Right-click for area options';}
function gesture(event,move,finish,cancel){
  cancelOperation();const controller=new AbortController();operation={controller,cancel};
  window.addEventListener('pointermove',move,{signal:controller.signal});
  window.addEventListener('pointerup',e=>{operation=null;controller.abort();$('#operation-overlay').hidden=true;finish(e);},{signal:controller.signal,once:true});
  window.addEventListener('pointercancel',cancelOperation,{signal:controller.signal,once:true});
  window.addEventListener('blur',cancelOperation,{signal:controller.signal,once:true});
}
function overlay(rect,text=''){
  const el=$('#operation-overlay');el.className='';el.hidden=false;el.style.left=`${rect.left}px`;el.style.top=`${rect.top}px`;el.style.width=`${rect.width}px`;el.style.height=`${rect.height}px`;el.innerHTML=text?`<span>${escape(text)}</span>`:'';
}
function previewSplit(node,axis,x,y){
  const rect=areaElement(node.id).getBoundingClientRect();const total=axis==='x'?rect.width:rect.height;const min=axis==='x'?180:88;
  if(total<min*2+5)return null;
  const ratio=clamp((axis==='x'?x-rect.left:y-rect.top)/total,min/total,1-min/total);
  overlay({left:axis==='x'?rect.left+ratio*rect.width:rect.left,top:axis==='y'?rect.top+ratio*rect.height:rect.top,width:axis==='x'?0:rect.width,height:axis==='y'?0:rect.height});
  $('#operation-overlay').className=`split-preview ${axis==='y'?'horizontal':''}`;return ratio;
}
function applySplit(node,axis,ratio){
  if(ratio===null||ratio===undefined){notify('Area is too small to split in that direction.');return;}
  if(totalAreas()>=64){notify('Area limit reached. Join unused areas first.');return;}
  workspace().root=splitArea(workspace().root,node.id,axis,ratio);commit(`Area split ${axis==='x'?'vertically':'horizontally'}.`);
}
function startSplit(node,axis){
  cancelOperation();const controller=new AbortController();let target=node,ratio=null,last={x:0,y:0};operation={controller,axis};
  $('#status-hint').textContent='Click to place split · '+shortcut('splitDirection')+' changes direction · '+shortcut('cancel')+' cancels';
  const update=e=>{
    last={x:e.clientX,y:e.clientY};const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.area');
    if(el){target=find(workspace().root,el.dataset.areaId);ratio=previewSplit(target,operation.axis,e.clientX,e.clientY);if(ratio===null)$('#operation-overlay').hidden=true;}else{ratio=null;$('#operation-overlay').hidden=true;}
  };
  window.addEventListener('pointermove',update,{signal:controller.signal});
  window.addEventListener('pointerdown',e=>{if(e.button!==0){cancelOperation();return;}e.preventDefault();e.stopImmediatePropagation();update(e);const selectedAxis=operation.axis;cancelOperation();applySplit(target,selectedAxis,ratio);},{signal:controller.signal,capture:true});
  window.addEventListener('keydown',e=>{if(matchesBinding('splitDirection',e,preferences.value)){e.preventDefault();operation.axis=operation.axis==='x'?'y':'x';update({clientX:last.x,clientY:last.y});}},{signal:controller.signal});
}
function startJoin(node,sibling){
  cancelOperation();const controller=new AbortController();operation={controller};const rect=areaElement(sibling.id).getBoundingClientRect();overlay(rect,'Join into active editor · Click to confirm');$('#status-hint').textContent='Click highlighted neighbor to join · '+shortcut('cancel')+' cancels';
  window.addEventListener('pointerdown',e=>{e.preventDefault();e.stopImmediatePropagation();const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.area');cancelOperation();if(e.button===0&&el?.dataset.areaId===sibling.id){workspace().root=joinArea(workspace().root,node.id,sibling.id);commit('Areas joined.');}},{capture:true,signal:controller.signal});
}
function cornerDrag(event,node){
  if(event.button!==0)return;event.preventDefault();const x=event.clientX,y=event.clientY;let result=null;
  gesture(event,e=>{
    const dx=e.clientX-x,dy=e.clientY-y;if(Math.abs(dx)+Math.abs(dy)<16)return;
    const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.area');const target=el?find(workspace().root,el.dataset.areaId):null;
    result=null;$('#operation-overlay').hidden=true;
    if(target&&target.id!==node.id){
      if(modifierActive('swapEditors',e,preferences.value)){result={type:'swap',target};overlay(el.getBoundingClientRect(),'Swap editors');}
      else if(siblingOf(node)?.id===target.id){result={type:'join',target};overlay(el.getBoundingClientRect(),'Join · keep source editor');}
    }else if(target){const axis=Math.abs(dx)>Math.abs(dy)?'x':'y';const ratio=previewSplit(node,axis,e.clientX,e.clientY);if(ratio!==null)result={type:'split',axis,ratio};}
  },()=>{
    if(!result)return;
    if(result.type==='split')applySplit(node,result.axis,result.ratio);
    else if(result.type==='swap'){swapAreas(workspace().root,node.id,result.target.id);commit('Editors swapped.');}
    else{workspace().root=joinArea(workspace().root,node.id,result.target.id);commit('Areas joined.');}
  });
}
document.addEventListener('contextmenu',e=>{if(operation){e.preventDefault();cancelOperation();}});
function resizeDirection(event){
  const modifier=bindingFor('largeResize',preferences.value),clean={code:event.code,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey};
  if(modifier)clean[{Ctrl:'ctrlKey',Shift:'shiftKey',Alt:'altKey',Meta:'metaKey'}[modifier]]=false;
  for(const [id,value] of [['resizeLeft',-1],['resizeRight',1],['resizeUp',-1],['resizeDown',1]])if(matchesBinding(id,clean,preferences.value))return value;
  return 0;
}
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||document.querySelector('dialog[open]'))return;
  const match=id=>matchesBinding(id,e,preferences.value);
  if(match('cancel')){
    e.preventDefault();const navigating=renderers.find(r=>r.navigating);
    if(navigating){navigating.cancel();return;}
    cancelOperation();closeMenu();if(maximized){maximized=null;focusMode=false;render();}return;
  }
  // Ctrl+F (Search Preferences binding) also finds things in a Properties editor, even from one of its fields.
  if(match('searchPreferences')||match('clearSearch')){
    const active=e.target.closest?.('[data-editor=properties]')?find(workspace().root,e.target.closest('[data-editor=properties]').dataset.areaId):currentArea();
    const search=active?.editor==='properties'&&areaElement(active.id)?.querySelector('.property-search');
    if(search){e.preventDefault();if(match('clearSearch')&&search.value){search.value='';active.propertySearch='';save();const body=areaElement(active.id)?.querySelector('.area-body');if(body)renderProperties(body,active);}search.focus();search.select();return;}
  }
  if(e.target.closest('input,textarea,select,[contenteditable=true]'))return;
  if(match('undoPaint')||match('redoPaint')){e.preventDefault();const active=currentArea();if(active.view?.interactionMode==='socket'&&active.editor==='viewport'||active.editor==='properties'&&active.propertyTab==='turrets'||active.editor==='outliner'&&scene.selectedTurretId){mountHistory(scene,match('redoPaint'));refreshStructure();}else changePaintHistory(match('redoPaint'));return;}
  if(match('preferences')){e.preventDefault();openPreferences();return;}
  if(operation)return;
  const node=currentArea();
  if(node.editor==='preferences'&&(match('searchPreferences')||match('clearSearch'))){e.preventDefault();renderers.find(r=>r.preferenceAreaId===node.id)?.focusSearch(match('clearSearch'));return;}
  if(match('maximize')||match('focus')){e.preventDefault();closeMenu();toggleMaximize(node.id,match('focus'));return;}
  if(match('saveLayout')){e.preventDefault();saveNow();notify(!preferences.value.rememberLayout?'Layout saving is paused in Preferences.':storageAvailable?'Layout saved in this browser.':'Browser storage is unavailable.');return;}
  if(match('previousWorkspace')||match('nextWorkspace')){e.preventDefault();const i=state.workspaces.findIndex(w=>w.id===state.active);switchWorkspace(state.workspaces[(i+(match('nextWorkspace')?1:-1)+state.workspaces.length)%state.workspaces.length].id);return;}
  if(!$('#menu').hidden||node.editor!=='viewport')return;
  if(match('toggleMode')&&!e.target.closest('button,[role=dialog]')){e.preventDefault();if(e.repeat)return;renderers.find(r=>r.id===node.id)?.cancel();cancelPaintTask();node.view.interactionMode=nextInteractionMode(node.view.interactionMode);commit();return;}
  const command=navigationKey(e,preferences.value);
  if(command){e.preventDefault();navigate(node,command);return;}
  if(match('sidebar')){e.preventDefault();node.sidebar=!node.sidebar;commit();}
  if(match('toolbar')){e.preventDefault();node.toolbar=!node.toolbar;commit();}
  if(match('selectAll')||match('deselectAll')){e.preventDefault();selectStructure(match('selectAll')?liveBlocks(scene).map(b=>b.id):[]);}
});
preferences.subscribe(applyPreferences);
// Load the interface language before the first paint so English does not flash.
requestedLanguage=preferences.value.language;await setLanguage(requestedLanguage);translateStatic();
render();save();
void Promise.resolve(assetPersistence.start()).then(()=>{if(!embedded&&!scene.loaded)welcome.open();});
window.addEventListener('pagehide',event=>event.persisted?assetPersistence.flush():assetPersistence.stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden)assetPersistence.flush();});


document.addEventListener('keydown',event=>{if(event.key==='Escape'&&scene.paintBusy){cancelPaintTask();scene.paintMessage='Paint calculation cancelled.';refreshStructure();}},{capture:true});

// The embedded editor runs the same app in its own document and scene.
export async function configureAssetWorkspace(asset, textureFiles=[], sharedTextures=null){
 if(!embeddedAsset)throw Error('Asset workspace requires an isolated editor document.');
 scene.turretStudio?.dispose();releaseGameModel();
 // Textures come from the viewer before the first build, so the turret renders
 // textured at once and the workspace never asks to load them again.
 if(!textureLibrary.adopt(sharedTextures)&&textureFiles.length)await textureLibrary.loadFiles(textureFiles,{retainUndecoded:true});
 if(textureLibrary.loadedCount)textureStatus=`${textureLibrary.loadedCount} texture maps · shared from the viewer`;
 assetDraft=structuredClone(asset);scene.turretEditorAsset=assetDraft;
 scene.model=makeModel(assetDraft.blocks,assetDraft.name);scene.preview=false;scene.loaded=true;scene.visible=true;scene.revision++;
 scene.selectedIds=new Set();scene.hiddenIds=new Set();scene.selectedId=null;scene.selected=false;
 scene.blockTransforms=assetPoseTransforms(assetDraft);
 const studio=createStudio(assetDraft,scene,()=>renderers.forEach(r=>r.draw?.()));
 studio.context=()=>({scene,view:leaves(workspace().root).find(n=>n.editor==='viewport')?.view,preferences:preferences.value,size:{width:1280,height:720}});
 state={version:1,active:'turret',workspaces:[{id:'turret',name:'Turret',root:assetDraft.editorLayout||split('x',.77,area(),split('y',.36,area('outliner'),area('properties')))}]};
 maximized=null;hovered=null;document.body.classList.add('embedded-asset-workspace');render();
 if(!assetDraft.editorLayout)for(const node of leaves(workspace().root))if(node.editor==='viewport')navigate(node,{action:'frame',interrupt:false});
 renderers.forEach(r=>r.draw?.());
 return {advance:studio.advance,seek:studio.seek,studio,snapshot(){assetDraft.blocks=scene.model.blocks;assetDraft.editorLayout=workspace().root;return structuredClone(assetDraft);},dispose(){studio.dispose();renderers.forEach(r=>r.dispose());renderers=[];releaseGameModel();}};
}

if(embeddedAsset)window.assetWorkspace={configure:configureAssetWorkspace};

// Block Gallery close-up: one block, its own viewport, outliner and properties.
export async function configureBlockWorkspace(block, textureFiles=[], sharedTextures=null, onRename=()=>{}){
 if(!embeddedBlock)throw Error('Block workspace requires an isolated editor document.');
 releaseGameModel();
 if(!textureLibrary.adopt(sharedTextures)&&textureFiles.length)await textureLibrary.loadFiles(textureFiles,{retainUndecoded:true});
 if(textureLibrary.loadedCount)textureStatus=`${textureLibrary.loadedCount} texture maps · shared from the viewer`;
 const draft={...structuredClone(block),id:'b0'};draft.position={x:0,y:draft.size.y/2,z:0};
 const viewport=area();ensureViewportOptions(viewport.view).shading='RENDERED';
 state={version:1,active:'block',workspaces:[{id:'block',name:'Block',root:split('x',.72,viewport,split('y',.3,area('outliner'),area('properties')))}]};
 maximized=null;hovered=null;document.body.classList.add('embedded-asset-workspace');
 scene.lastPreviewColor=preferences.value.shaderColor;
 loadModel(makeModel([draft],BLOCK_GALLERY_NAME),true);
 for(const node of leaves(workspace().root))if(node.editor==='viewport')navigate(node,{action:'frame',interrupt:false});
 renderers.forEach(r=>r.draw?.());
 let lastType=draft.type;
 const watch=setInterval(()=>{const type=scene.model?.blocks[0]?.type;if(type&&type!==lastType){lastType=type;onRename(type);}},250);
 return {snapshot(){const {el,itemEl,...edited}=scene.model.blocks[0];return structuredClone(edited);},dispose(){clearInterval(watch);renderers.forEach(r=>r.dispose());renderers=[];releaseGameModel();}};
}
if(embeddedBlock)window.blockWorkspace={configure:configureBlockWorkspace};
