import {createSocketEditor} from './components/socket-editor.js';
import {socketToolActive} from './interaction-modes.js';
import {createTurretToolbar} from './turrets/context-toolbar.js';
import {pickSocketMarker,selectSocketMarker} from './socket-markers.js';
import {choosePlacementTarget,createPlacementStrip} from './attachments/placement.js';
import {drawComponentSockets} from './components/overlay.js';
import {componentLibrary} from './components/library.js';
import {componentSetup} from './components/core.js';
import {changeSetup,assignComponent} from './components/mounting.js';
import {createComponentTools} from './components/viewport-tools.js';
import {visibleTurretBlocks} from './turrets/posed-blocks.js';
import {drawCoverageLegend} from './turrets/coverage-render.js';
import {coverageOptions} from './turrets/coverage-sampling.js';
import {turretLibrary} from './turrets/library.js';
import {placeFromLibrary} from './turrets/placement.js';
import {mounts,initialTurretSize,selectTurrets,placeTurret,replaceTurret} from './turrets/mounts.js';
import {drawSockets} from './turrets/sockets.js';
import {drawDimensions,drawSymmetryPlanes} from './viewport-annotations.js';
import {paintOptions} from './paint-tools.js';
import {cursorCSS,viewportCursor,drawBrushRing} from './viewport-cursors.js';
import {nativeToView,viewToNative} from './block-model.js';
import {modelExtents,dimensionRulers,exteriorRuler} from './model-overlays.js';
import {gridSpacing} from './world-guides.js';
import { frameVisibleModel } from './model-framing.js';
import { shadeFace, REFERENCE_NORMALS } from './shading.js';
import { imageRenderBusy, drawGame, pickGame, pickGamePoint, pickComponent, pickTurret, pickWeaponCoverage, socketExposed, releaseViewportResources, setPaintPreview } from './game-renderer.js';
import { liveBlocks, simplified, viewportHiddenIds, engineEffectHiddenIds } from './ship-structure.js';
import { selectCubeView } from './view-cube.js';
import { matchesBinding, modifierActive, bindingFor, shortcutLabel } from './keymaps.js';
import { basis, dot, ensureCamera, cameraPoint, projectCamera, clipNear, orbit, pan, zoom, dolly, alignView, snapAxis, viewLabel, dragMode, zoomRegion, REFERENCE_VERTICES } from './navigation.js';
import { FACTORY_PREFERENCES, THEMES, editorTheme } from './preferences.js';
import { reportError } from './app-log.js';

let activePlacementViewport=null;
// Navigation state is independent of this reference geometry and can be reused
// by the eventual Avorion renderer.
export function mountViewport(canvas, area, scene, onChange, onSelect, getPreferences = () => FACTORY_PREFERENCES, onContextMenu = () => {}, onPaint = () => false, frameOnLoad = () => false, onStatusChanged = () => {}) {
  const ctx = canvas.getContext('2d');
  const view = ensureCamera(area.view), body = canvas.parentElement;
  const faces = [[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0],[4,7,6,5]];
  canvas.classList?.toggle('paint-mode',view.interactionMode==='paint');
  let suppressContext=false,magnifier=null,paintPointer=null,brushCache=null,paintPreview=null;
  let rightHeld=false;
  const originalCursor=canvas.style?.cursor||'';
  const hoverLabel=globalThis.document?.createElement('div');if(hoverLabel){hoverLabel.className='paint-hover-label';hoverLabel.hidden=true;body.append?.(hoverLabel);}
  let statsKey=[],width = 1, height = 1, frame = 0, drag = null, regionMode = false, projectedFaces = [];
  const dimensionCache={};
  let socketHits=[],componentSocketHits=[];
  const componentTools=createComponentTools(scene,view,getPreferences);
  const turretToolbar=createTurretToolbar(canvas,scene,view,{changed:()=>{onSelect({socketId:scene.turretSockets?.selectedId||null});onChange();},selected:onSelect,invalidate:()=>invalidate()});
  activePlacementViewport??=area.id;
  const socketEditor=createSocketEditor(canvas,scene,view,{pick:(x,y)=>pickGamePoint(scene,view,width,height,x,y,getPreferences()),invalidate:()=>invalidate(),changed:()=>{onSelect({componentSocketId:scene.selectedComponentSocketId});onChange();},active:()=>activePlacementViewport===area.id,visible:s=>socketExposed(scene,view,width,height,s,getPreferences())});
  const events = new AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
  const invalidate = () => { if (!frame) frame = requestAnimationFrame(draw); };
  listen(window,'avorion-sky-ready',invalidate);
  listen(window,'avorion-model-ready',invalidate);
  listen(body,'pointerenter',()=>{activePlacementViewport=area.id;});listen(body,'focusin',()=>{activePlacementViewport=area.id;});
  const socketsChanged=()=>onSelect({socketId:scene.turretSockets?.selectedId||null});
  listen(window,'turret-drag-start',()=>{scene.turretDragging=true;invalidate();});
  listen(window,'turret-drag-end',()=>{if(!placement.state){scene.turretDragging=false;scene.turretPreview=null;}invalidate();});
  function dragSocket(event){const [x,y]=position(event);return choosePlacementTarget(socketHits.filter(s=>s.fitSize),x,y,scene.turretPreview?.socket.id);}
  listen(canvas,'dragover',event=>{if(!turretLibrary.dragged||view.interactionMode==='paint')return;event.preventDefault();const socket=dragSocket(event),asset=turretLibrary.dragged;event.dataTransfer.dropEffect=socket?'copy':'none';scene.turretPreview=socket?{asset,socket,size:initialTurretSize(asset,socket)}:null;invalidate();});
  listen(canvas,'dragleave',()=>{scene.turretPreview=null;scene.componentDropTarget=null;invalidate();});
  // Components drop onto an empty component socket, the way turrets drop onto turret sockets.
  listen(window,'component-drag-start',()=>{scene.componentDragging=true;invalidate();});
  listen(window,'component-drag-end',()=>{if(!placement.state){scene.componentDragging=false;scene.componentDropTarget=null;}invalidate();});
  // Any component socket accepts a drop; an occupied one swaps in the new component.
  function componentDropSocket(event){const [x,y]=position(event);return choosePlacementTarget(componentSocketHits,x,y,scene.componentDropTarget);}
  listen(window,'component-drag-end',()=>{if(!placement.state)scene.componentPreview=null;invalidate();});
  listen(canvas,'dragover',event=>{
    if(!componentLibrary.dragged?.attachment||view.interactionMode==='paint')return;event.preventDefault();
    const socket=componentDropSocket(event),asset=componentLibrary.dragged;event.dataTransfer.dropEffect=socket?'copy':'none';
    if(scene.componentDropTarget!==(socket?.id||null)){
      const current=socket&&componentSetup(scene.model||{}).mounts.find(m=>m.socketId===socket.id);
      scene.componentDropTarget=socket?.id||null;scene.componentPreview=socket?{asset,socket,scale:1,twist:Math.round((current?.twist||0)/90)*90}:null;invalidate();
    }
  });
  listen(canvas,'dragleave',()=>{scene.componentPreview=null;invalidate();});
  const clearPlacement=()=>{scene.turretPreview=null;scene.componentPreview=null;scene.turretDragging=false;scene.componentDragging=false;invalidate();};
  const placement=createPlacementStrip(body,{
    preview(state){scene.turretDragging=state.kind==='turret';scene.componentDragging=state.kind==='component';if(state.kind==='turret')scene.turretPreview=state.socket?{asset:state.asset,socket:state.socket,size:state.size,twist:state.twist}:null;else scene.componentPreview=state.socket?{asset:state.asset,socket:state.socket,scale:state.size,twist:state.twist}:null;invalidate();},
    cancelled:clearPlacement,
    async commit(state){
      if(scene.model!==state.model)throw Error('The ship changed. Cancel placement and choose a socket again.');
      if(state.kind==='component'){
        const next=assignComponent(scene,state.asset,state.socket);const mount=next.mounts.find(m=>m.socketId===state.socket.id);mount.scale=1;mount.twist=Math.round(state.twist/90)*90;
        await changeSetup(scene,next);scene.selectedComponentSocketId=state.socket.id;scene.selectedComponentMountId=mount.id;onSelect({componentSocketId:state.socket.id});
      }else{
        const instance=(state.occupied?replaceTurret:placeTurret)(scene,state.asset,state.socket,state.size);const mount=mounts(scene).find(m=>m.id===instance.id);mount.twist=state.twist;selectTurrets(scene,instance.id);scene.turretSockets??={};scene.turretSockets.selectedId=state.socket.id;socketsChanged();
      }
      clearPlacement();onChange();
      window.dispatchEvent(new CustomEvent('attachment-placed',{detail:{kind:state.kind,assetId:state.asset.id}}));
    }
  });
  const occupied=(kind,socket)=>!!socket&&(kind==='turret'?mounts(scene):componentSetup(scene.model||{}).mounts).some(m=>m.socketId===socket.id);
  function startPlacement(kind,asset,socket){if(!scene.model||kind==='component'&&!asset.attachment)return false;placement.start({kind,asset,socket,model:scene.model,size:kind==='turret'?(socket?.fitSize||asset.sourceSize||1):1,occupied:occupied(kind,socket)});return true;}
  listen(canvas,'drop',event=>{const kind=componentLibrary.dragged?'component':'turret',asset=componentLibrary.dragged||turretLibrary.dragged;if(!asset||view.interactionMode==='paint')return;event.preventDefault();const socket=kind==='component'?componentDropSocket(event):dragSocket(event);if(!socket||!startPlacement(kind,asset,socket))return;if(!occupied(kind,socket))placement.accept();});
  listen(window,'attachment-place',event=>{if(activePlacementViewport&&activePlacementViewport!==area.id)return;activePlacementViewport=area.id;const {kind,asset}=event.detail||{};if(asset&&['turret','component'].includes(kind)){startPlacement(kind,asset,null);canvas.focus();}});
  listen(window,'blur',()=>{placement.cancel();socketEditor.cancel();});
  listen(canvas,'pointermove',event=>{if(!placement.state)return;const state=placement.state,[x,y]=position(event),socket=choosePlacementTarget(state.kind==='turret'?socketHits.filter(s=>s.fitSize):componentSocketHits,x,y,state.socket?.id);placement.target(socket,occupied(state.kind,socket));});
  listen(canvas,'pointerdown',event=>{if(!placement.state||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();if(placement.state.socket&&!placement.state.occupied)placement.accept();});
  listen(window,'keydown',event=>{if(!placement.state||!body.contains(document.activeElement))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();placement.cancel();}else if(event.key==='Enter'&&event.target===canvas){event.preventDefault();placement.accept();}});



  function project(points, closed = true) {
    let cameraPoints = points.map(point => cameraPoint(point, view));
    if (view.projection === 'perspective') cameraPoints = clipNear(cameraPoints, closed);
    return cameraPoints.map(point => projectCamera(point, view, width, height));
  }
  function line(a, b, color) {
    const points = project([a, b], false);
    if (points.length !== 2) return;
    ctx.beginPath();ctx.moveTo(points[0][0], points[0][1]);ctx.lineTo(points[1][0], points[1][1]);
    ctx.strokeStyle = color;ctx.lineWidth = 1;ctx.stroke();
  }
  const statusActivity=()=>magnifier?'magnifier':placement.state?'placement':turretToolbar.active?'attachment':regionMode?'region':drag?.mode;
  let lastStatus;
  function draw() {
    body.querySelector('[data-native-transform]')?.refresh?.();
    const activity=statusActivity();if(activity!==lastStatus){lastStatus=activity;onStatusChanged();}
    if(frameOnLoad(width,height))onChange();
    updateCursor();
    const started=performance.now();
    frame = 0;
    if(placement.state&&placement.state.model!==scene.model)placement.cancel();
    if(imageRenderBusy())return;
    const preferences=getPreferences(),theme=THEMES[preferences.theme];
    const display=view.display;
    if(display){
      const visible=(selector,on)=>{const el=body.querySelector(selector);if(el)el.style.setProperty('display',on?(selector==='.navigation'?'flex':'block'):'none','important');};
      visible('.navigation',display.showGizmo);
      visible('.viewport-meta',display.showOverlays&&display.showText);
      visible('.viewport-footer',!scene.showFireCoverage&&view.interactionMode!=='paint'&&display.showOverlays&&display.showText);
      visible('.viewport-statistics',!scene.showFireCoverage&&display.showOverlays&&display.showStats);
    }
    const dpr=Math.min(devicePixelRatio||1,preferences.pixelRatio);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    ctx.clearRect(0,0,width,height);ctx.fillStyle = editorTheme(preferences,'viewport').background;ctx.fillRect(0,0,width,height);
    projectedFaces = [];
    updatePaintPreview();
    if (view.display || scene.model || preferences.worldEnabled && view.display?.background==='WORLD') {
      try { drawGame(ctx,scene,view,width,height,preferences,dpr); }
      catch(error){reportError(error,'RENDER');ctx.fillStyle='#e9a07e';ctx.font='12px sans-serif';ctx.fillText(error.message.slice(0,120),20,height-25);}
    } else if (scene.visible && scene.loaded) {
      const ordered = faces.map((face, index) => ({ points: project(face.map(i => REFERENCE_VERTICES[i])), index }))
        .filter(face => face.points.length >= 3)
        .sort((a,b) => b.points.reduce((sum,p) => sum+p[2],0)/b.points.length - a.points.reduce((sum,p) => sum+p[2],0)/a.points.length);
      const cameraDirection=basis(view).back;
      for (const face of ordered) {
        ctx.beginPath();face.points.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]));ctx.closePath();
        if (!view.wire) {ctx.fillStyle=shadeFace(REFERENCE_NORMALS[face.index],cameraDirection,preferences);ctx.fill();}
        ctx.strokeStyle=scene.selected?editorTheme(preferences,'viewport').accent:'#b4b4b4';ctx.lineWidth=scene.selected?preferences.outlineWidth:1;ctx.stroke();
        projectedFaces.push(face.points);
      }
    }
    if(preferences.vignetteEnabled&&preferences.vignetteStrength>0){
      const radius=Math.hypot(width,height)/2,gradient=ctx.createRadialGradient(width/2,height/2,radius*.25,width/2,height/2,radius);
      gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(1,`rgba(0,0,0,${preferences.vignetteStrength})`);
      ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    }
    drawSymmetryPlanes(ctx,scene,view,width,height);
    drawDimensions(ctx,scene,view,width,height,preferences,dimensionCache);
    socketHits=drawSockets(ctx,scene,view,width,height,editorTheme(preferences,'viewport').accent,s=>socketExposed(scene,view,width,height,s,preferences));
    componentSocketHits=drawComponentSockets(ctx,scene,view,width,height,s=>socketExposed(scene,view,width,height,s,preferences));
    componentTools.draw(ctx,width,height);turretToolbar.draw(ctx);socketEditor.draw(ctx,width,height);
    drawCoverageLegend(ctx,scene,view,width,height);
    drawMagnifier();
    drawPaintPreview();
    // No cursor or origin marker: a future Center of Mass marker owns that role.
    if (drag?.mode === 'region' || drag?.mode==='select'&&drag.moved) {
      const rect = regionRect();
      ctx.fillStyle='#83b6e522';ctx.strokeStyle='#9fc8ed';ctx.lineWidth=1;ctx.setLineDash([5,4]);
      ctx.fillRect(rect.x,rect.y,rect.width,rect.height);ctx.strokeRect(rect.x,rect.y,rect.width,rect.height);ctx.setLineDash([]);
    }
    const footer=body.querySelector('[data-render-status]');if(footer){footer.textContent=scene.renderPreparing?'Preparing large model…':scene.renderError||'';footer.hidden=!footer.textContent;}
    const hint=body.querySelector('.region-zoom-hint');if(hint)hint.textContent='Zoom region · '+shortcutLabel(bindingFor('regionIn',preferences))+' in / '+shortcutLabel(bindingFor('regionOut',preferences))+' out · '+shortcutLabel(bindingFor('cancel',preferences))+' cancel';
    const label = body.querySelector('.view-label');
    if (label) label.textContent = viewLabel(view);
    const stats=body.querySelector('.viewport-statistics');
    const hidden=viewportHiddenIds(scene,view);
    const statsInputs=[liveBlocks(scene),hidden,scene.selectedIds,scene.visible,view.showThinBlocks,view.grid,gridSpacing(view,width,height)];
    if(stats&&!statsInputs.every((v,i)=>v===statsKey[i])){
      const blocks=statsInputs[0];let visibleCount=0;for(const b of blocks)if(!hidden.has(b.id))visibleCount++;
      stats.textContent=scene.loaded&&scene.visible?`Blocks ${visibleCount} visible / ${blocks.length} · ${scene.selectedIds?.size||0} selected`:'Objects 0';
      if(view.grid)stats.textContent+=`\nGrid ${Number(statsInputs[6].toPrecision(6))} units / cell`;statsKey=statsInputs;
    }
    const projection = body.querySelector('[data-projection]');
    if(display){
      let timing=body.querySelector('.viewport-performance');
      if(!timing&&typeof document!=='undefined'){timing=document.createElement('div');timing.className='viewport-performance';body.append(timing);}
      if(timing){timing.hidden=!(display.showOverlays&&display.showPerformance);timing.textContent=`Render ${(performance.now()-started).toFixed(1)} ms`;}
    }
    if (projection) projection.setAttribute('aria-pressed', String(view.projection === 'perspective'));
    body.querySelector('.view-cube')?.updateView(view);
    const b = basis(view);
    body.querySelectorAll('[data-axis]').forEach(button => {
      const vector = JSON.parse(button.dataset.axis);
      button.style.left = `${38 + dot(vector,b.right)*27 - 10}px`;
      button.style.top = `${38 - dot(vector,b.up)*27 - 10}px`;
      button.style.zIndex = String(100 + Math.round(dot(vector,b.back)*50));
      button.style.opacity = dot(vector,b.back) < -0.01 ? '0.55' : '1';
    });
    // Each half-line runs from the center to its ball's edge and is depth sorted by its midpoint,
    // so front balls cover lines behind them and back lines sit under everything nearer.
    body.querySelectorAll('[data-axis-line]').forEach(line => {
      const vector = JSON.parse(line.dataset.axisLine), depth = dot(vector,b.back);
      const dx = dot(vector,b.right)*27, dy = -dot(vector,b.up)*27, length = Math.max(0, Math.hypot(dx,dy) - 10.5);
      line.style.width = `${length}px`;
      line.style.transform = `rotate(${Math.atan2(dy,dx)}rad)`;
      line.style.zIndex = String(100 + Math.round(depth*25));
      line.style.opacity = depth < -0.01 ? '0.55' : '1';
    });
    if(scene.model&&scene.visible&&scene.loaded&&!simplified(scene,preferences)){
      const hidden=engineEffectHiddenIds(scene,view,preferences.shaderThinEnginePlumes!==false);
      if(liveBlocks(scene).some(b=>!hidden.has(b.id)&&[3,7,10,13,61,62,63,64,65].includes(b.typeIndex)))invalidate();
    }
  }
  const observer = new ResizeObserver(entries => {
    const rect = entries[0].contentRect; width=rect.width;height=rect.height;
    const dpr=Math.min(devicePixelRatio||1,getPreferences().pixelRatio);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);invalidate();
  });
  observer.observe(canvas);

  // The source point stays anchored while the user moves into the offset lens.
  // Lens coordinates map back to fractional viewport coordinates for ray picking.
  function startMagnifier(event){
    const prefs=getPreferences(),options={lensSize:prefs.paintLensSize??200,lensZoom:prefs.paintLensZoom??4,lensQuality:prefs.paintLensQuality??'smooth'},[x,y]=position(event),size=Math.max(64,Math.min(options.lensSize,width-8,height-8));
    const left=Math.max(4,Math.min(width-size-4,x+32+size<=width?x+32:x-size-32));
    const top=Math.max(4,Math.min(height-size-4,y-size/2));
    const lens=document.createElement('canvas');lens.className='paint-magnifier';lens.setAttribute('role','img');lens.setAttribute('aria-label',options.lensZoom+'× paint magnifier: hold right mouse, move into lens, scroll to resize brush, left-drag to paint');
    lens.width=Math.round(size*2);lens.height=Math.round(size*2);Object.assign(lens.style,{left:left+'px',top:top+'px',width:size+'px',height:size+'px'});body.append(lens);
    magnifier={lens,x,y,left,top,size,zoom:options.lensZoom,detail:options.lensQuality==='detail'||!!prefs.paintLensWireframe,wireframe:!!prefs.paintLensWireframe,renderView:structuredClone(view),pointerId:event.pointerId,brushWheel:0,painting:false,painted:new Set(),last:null};
    canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});invalidate();
  }
  function drawMagnifier(){
    if(!magnifier)return;const m=magnifier,c=m.lens.getContext('2d'),scale=m.zoom;
    c.setTransform(2,0,0,2,0,0);c.fillStyle='#161a1e';c.fillRect(0,0,m.size,m.size);
    c.save();c.beginPath();c.rect(0,0,m.size,m.size);c.clip();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    // Draw from the viewport before its guides; the lens never samples itself.
    if(m.detail){m.renderView.grid=false;m.renderView.hidePaintAttachments=view.hidePaintAttachments;m.renderView.display={...view.display,showOverlays:m.wireframe,wireOverlay:m.wireframe,axisX:false,axisY:false,axisZ:false,objectOutline:false,outlineSelected:false,dof:false};drawGame(c,scene,m.renderView,width,height,getPreferences(),2,{x:m.x,y:m.y,size:m.size,zoom:m.zoom});}
    else c.drawImage(canvas,(m.x-m.size/scale/2)*canvas.width/width,(m.y-m.size/scale/2)*canvas.height/height,m.size/scale*canvas.width/width,m.size/scale*canvas.height/height,0,0,m.size,m.size);c.restore();
    c.fillStyle='#15191ee6';c.fillRect(0,m.size-20,m.size,20);c.fillStyle='#fff';c.font='11px sans-serif';c.fillText(scale+'× · '+(m.detail?'Detail':'Smooth')+' · hold RMB',7,m.size-6);
  }
  function lensPoint(x,y){
    const m=magnifier;if(!m||x<m.left||x>m.left+m.size||y<m.top||y>m.top+m.size-20)return null;
    return [m.x+(x-m.left-m.size/2)/m.zoom,m.y+(y-m.top-m.size/2)/m.zoom];
  }
  function lensPaint(x,y){
    const m=magnifier,point=lensPoint(x,y);if(!m?.painting)return;
    if(!point){m.last=null;return;}
    const from=m.last||point,steps=Math.max(1,Math.min(256,Math.ceil(Math.hypot(point[0]-from[0],point[1]-from[1])/Math.max(.5,paintOptions(view).radius/2)))),batch=new Set();
    for(let i=1;i<=steps;i++){
      const px=from[0]+(point[0]-from[0])*i/steps,py=from[1]+(point[1]-from[1])*i/steps;
      if(px<0||py<0||px>=width||py>=height)continue;
      sampleBrush(px,py,m.painted,batch);
    }if(batch.size)onPaint('sample',[...batch]);m.last=point;invalidate();
  }
  function finishLensStroke(cancelled=false){
    if(!magnifier?.painting)return;magnifier.painting=false;magnifier.last=null;onPaint(cancelled?'cancel':'finish');
  }
  function closeMagnifier(cancelled=false){
    if(!magnifier)return;finishLensStroke(cancelled);const m=magnifier;magnifier=null;m.lens.remove();releaseViewportResources(m.renderView);
    if(canvas.hasPointerCapture(m.pointerId))canvas.releasePointerCapture(m.pointerId);invalidate();
  }
  function regionRect() {
    return { x: Math.min(drag.startX,drag.x), y: Math.min(drag.startY,drag.y), width: Math.abs(drag.x-drag.startX), height: Math.abs(drag.y-drag.startY) };
  }
  function position(event) { const rect=canvas.getBoundingClientRect();return [event.clientX-rect.left,event.clientY-rect.top]; }
  function updateCursor(){if(canvas.style)canvas.style.cursor=socketEditor.cursor||cursorCSS(viewportCursor(view,drag?.mode,rightHeld,regionMode),view.paint?.radius,getPreferences());}
  function trackButtons(event){rightHeld=!!(event.buttons&2);updateCursor();}
  function release() {
    const pointerId=drag?.pointerId;drag=null;updateCursor();
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }
  function cancel() {
    resetTouch();
    rightHeld=false;updateCursor();
    if (!drag && !regionMode && !magnifier) return false;
    closeMagnifier(true);
    if(drag?.mode==='componentGizmo')componentTools.cancel();
    if(drag?.mode==='paint')onPaint('cancel');
    if (drag) Object.assign(view,drag.before,view.display?{display:view.display}:{},view.paint?{paint:view.paint}:{});
    release();regionMode=false;body.classList.remove('region-zoom');invalidate();onChange();return true;
  }
  function down(event, forcedMode, capture=true) {
    if(forcedMode&&socketEditor.locked){event.preventDefault();return;}
    if(!forcedMode&&socketEditor.down(event,...position(event))){event.preventDefault();return;}
    if(!forcedMode&&view.interactionMode==='paint'&&event.button===2&&!drag&&!regionMode){suppressContext=true;startMagnifier(event);return;}
    if(magnifier){event.preventDefault();return;}
    if(event.button===2)suppressContext=!!(drag||regionMode);
    if (matchesBinding('cancelMouse',event,getPreferences(),'Mouse'+event.button) && (drag||regionMode)) {event.preventDefault();cancel();return;}
    if (drag) return;
    if(event.button===0&&!event.altKey&&!regionMode&&!forcedMode){
      // Socket gizmo handles take the click before navigation or selection.
      const [hx,hy]=position(event),handle=componentTools.hit(hx,hy);
      if(handle){event.preventDefault();if(capture)canvas.setPointerCapture(event.pointerId);componentTools.begin(handle,hx,hy);drag={x:hx,y:hy,startX:hx,startY:hy,button:0,pointerId:event.pointerId,mode:'componentGizmo'};return;}
    }
    const regionIn=matchesBinding('regionIn',event,getPreferences(),'Mouse'+event.button),regionOut=matchesBinding('regionOut',event,getPreferences(),'Mouse'+event.button);
    // Paint Mode's Select tool box-selects like Object Mode, so paint scope can target the selection.
    const paintSelect=view.interactionMode==='paint'&&paintOptions(view).tool==='select';
    const additiveSelect=scene.model&&(view.tool==='select'||socketToolActive(view)||paintSelect)&&(event.ctrlKey||event.metaKey)&&matchesBinding('selectClick',{...event,ctrlKey:false,metaKey:false,shiftKey:event.shiftKey,altKey:event.altKey},getPreferences(),'Mouse'+event.button);
    const plainLeft=event.button===0&&!event.altKey&&!event.shiftKey;
    const mode=regionMode?(regionIn||regionOut?'region':null):forcedMode||(plainLeft?(view.interactionMode==='paint'?(paintSelect?'select':'paint'):event.ctrlKey||event.metaKey?'select':dragMode(event,socketToolActive(view)?'select':view.tool,getPreferences())):(additiveSelect?'select':dragMode(event,socketToolActive(view)?'select':view.tool,getPreferences())));
    if(!mode)return;
    if(mode==='paint'&&!onPaint('begin'))return;
    if(event.button===2)suppressContext=true;
    event.preventDefault();canvas.focus({preventScroll:true});if(capture)canvas.setPointerCapture(event.pointerId);
    const [x,y]=position(event);
    const preferences=getPreferences();
    drag={x,y,startX:x,startY:y,button:event.button,pointerId:event.pointerId,mode,paletteClick:!forcedMode&&!regionMode&&view.interactionMode==='paint'&&event.button===1&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!event.metaKey,subtract:!!(event.ctrlKey||event.metaKey),painted:new Set(),additive:!!additiveSelect,regionOut,cubeRegion:event.target?.closest?.('[data-cube-region]')?.dataset.cubeRegion,emulated:preferences.emulate3Button&&event.altKey&&event.button===0,before:structuredClone(view),moved:false};
    if(mode==='paint')paintAt(x,y);
  }
  function brushTargets(x,y){
    const options=paintOptions(view),radius=['brush','restore'].includes(options.tool)?options.radius:0,ids=new Set();
    const d=view.display,key=[x,y,radius,width,height,scene.model,scene.revision,scene.loaded,scene.visible,scene.hiddenIds,scene.renderPreparing,view.showThinBlocks,view.yaw,view.pitch,view.roll,view.zoom,view.panX,view.panY,view.projection,...view.target,d?.focalLength,d?.clipStart,d?.clipEnd,d?.backfaceCulling];
    if(brushCache&&key.every((v,i)=>v===brushCache.key[i]))return brushCache.ids;
    const hit=(px,py)=>{if(px<0||py<0||px>=width||py>=height)return;const id=pickGame(scene,view,width,height,px,py,getPreferences());if(id)ids.add(id);};hit(x,y);
    if(radius>0){const step=Math.max(2,radius/6);for(let dy=-radius;dy<=radius;dy+=step)for(let dx=-radius;dx<=radius;dx+=step)if(dx*dx+dy*dy<=radius*radius)hit(x+dx,y+dy);}
    brushCache={key,ids:[...ids]};return brushCache.ids;
  }
  function sampleBrush(x,y,painted,batch){
    const ids=brushTargets(x,y).filter(id=>!painted.has(id));for(const id of ids){painted.add(id);batch?.add(id);}if(ids.length&&!batch)onPaint('sample',ids);
  }
  function paintAt(x,y,batch){if(x<0||y<0||x>width||y>height)return;sampleBrush(x,y,drag.painted,batch);}
  function updatePaintPreview(){
    paintPreview=null;
    if(view.interactionMode==='paint'&&paintOptions(view).tool!=='select'&&paintPointer&&scene.model&&(!drag||drag.mode==='paint')){
      const point=magnifier?lensPoint(...paintPointer):paintPointer;
      if(point)paintPreview={point,...(onPaint('preview',brushTargets(...point))||{ids:[],text:''})};
    }
    const ids=paintPreview?.outlineIds||paintPreview?.ids||[];
    setPaintPreview(view,ids,!!paintPreview?.locked);
    if(magnifier)setPaintPreview(magnifier.renderView,ids,!!paintPreview?.locked);
    if(hoverLabel){hoverLabel.hidden=!paintPreview;hoverLabel.textContent=paintPreview?.text||'';}
  }
  function drawPaintPreview(){
    if(view.interactionMode!=='paint'||paintOptions(view).tool==='select'||!paintPointer||drag&&drag.mode!=='paint')return;
    const point=paintPreview?.point||(magnifier?lensPoint(...paintPointer):paintPointer);if(!point)return;
    const options=paintOptions(view),radius=['brush','restore'].includes(options.tool)?options.radius:0;
    const targets=[{c:ctx,map:p=>p,scale:1}];
    if(magnifier){const m=magnifier;targets.push({c:m.lens.getContext('2d'),map:p=>[(p[0]-m.x)*m.zoom+m.size/2,(p[1]-m.y)*m.zoom+m.size/2],scale:m.zoom,size:m.size});}
    for(const {c,map,scale,size} of targets){c.save();if(size){c.beginPath();c.rect(0,0,size,size-20);c.clip();}
      drawBrushRing(c,map(point),radius*scale,getPreferences());c.restore();
    }
  }
  function boxSelection(){
    const rect=regionRect(),hidden=viewportHiddenIds(scene,view),ids=[],cameraBasis=basis(view);
    if(!scene.visible||!scene.loaded)return ids;
    for(const block of liveBlocks(scene)){
      if(hidden.has(block.id))continue;
      const p=projectCamera(cameraPoint(nativeToView([block.position.x,block.position.y,block.position.z]),view,cameraBasis),view,width,height);
      if(p&&p[2]>0&&p[0]>=rect.x&&p[0]<=rect.x+rect.width&&p[1]>=rect.y&&p[1]<=rect.y+rect.height)ids.push(block.id);
    }
    if(drag.subtract&&!scene.regionEdit){const remove=new Set(ids);return [...scene.selectedIds||[]].filter(id=>!remove.has(id));}return ids;
  }
  function move(event) {
    if(!drag&&socketEditor.move(...position(event)))return;
    if(!drag&&scene.showFireCoverage&&coverageOptions(scene).inspect&&!scene.turretDragging&&view.interactionMode!=='paint'&&!socketToolActive(view)){scene.coverageHover=pickWeaponCoverage(scene,view,width,height,...position(event),getPreferences());invalidate();}
    if(view.interactionMode==='paint'){paintPointer=position(event);invalidate();}
    if(magnifier){lensPaint(...position(event));return;}
    if (!drag || event.pointerId!==drag.pointerId) return;
    const [x,y]=position(event), dx=x-drag.x,dy=y-drag.y;
    drag.moved ||= Math.hypot(x-drag.startX,y-drag.startY)>3;
    const preferences=getPreferences();
    if(drag.mode==='componentGizmo'){componentTools.drag(x,y,event,width,height);drag.x=x;drag.y=y;invalidate();return;}
    if(drag.mode==='paint'){const steps=Math.min(256,Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(4,paintOptions(view).radius/2)))),batch=new Set();for(let i=1;i<=steps;i++)paintAt(drag.x+dx*i/steps,drag.y+dy*i/steps,batch);if(batch.size)onPaint('sample',[...batch]);}
    if (drag.mode==='orbit') orbit(view,dx,dy,preferences);
    if (drag.mode==='pan') pan(view,dx,dy,width,height);
    if (drag.mode==='zoom') zoom(view,Math.exp(-dy*.01*preferences.zoomSensitivity*(preferences.invertZoom?-1:1)));
    if (drag.mode==='dolly') dolly(view,dy,width,height);
    drag.x=x;drag.y=y;invalidate();
  }
  function up(event) {
    if(magnifier&&event.button===2){event.preventDefault();closeMagnifier();return;}
    if (!drag || event.pointerId!==drag.pointerId || event.button!==drag.button) return;
    let selection = null;
    if(drag.mode==='componentGizmo'){release();invalidate();componentTools.end().then(()=>{onSelect({componentSocketId:scene.selectedComponentSocketId});onChange();}).catch(error=>{scene.componentMessage=error.message;reportError(error,'COMPONENT');onSelect({componentSocketId:scene.selectedComponentSocketId});});return;}
    if(drag.mode==='paint')onPaint('finish');
    if(drag.mode==='select'&&drag.moved){
      if(socketToolActive(view)){
        const rect=regionRect(),ids=new Set();
        if(scene.visible&&scene.loaded)for(const block of visibleTurretBlocks(scene)){
          const p=projectCamera(cameraPoint(nativeToView([block.position.x,block.position.y,block.position.z]),view,basis(view)),view,width,height);
          if(p&&p[2]>0&&p[0]>=rect.x&&p[0]<=rect.x+rect.width&&p[1]>=rect.y&&p[1]<=rect.y+rect.height)ids.add(block.mountId);
        }
        scene.selectedTurretIds=drag.subtract?new Set([...scene.selectedTurretIds||[]].filter(id=>!ids.has(id))):ids;
        scene.selectedTurretId=[...scene.selectedTurretIds].at(-1)||null;
        scene.turretSockets??={};scene.turretSockets.selectedId=mounts(scene).find(m=>m.id===scene.selectedTurretId)?.socketId||null;
        selection={socketId:scene.turretSockets.selectedId};
      }else selection=boxSelection();
    }
    if(!drag.moved&&drag.cubeRegion){selectCubeView(view,drag.cubeRegion);frameVisibleModel(scene,view,width,height,getPreferences());}
    if (drag.mode==='region') zoomRegion(view,regionRect(),width,height,drag.regionOut);
    if (drag.mode==='orbit' && modifierActive('snapOrbit',event,getPreferences()) && drag.moved && !drag.emulated) snapAxis(view);
    if (!drag.moved && drag.mode==='select') {
      const [x,y]=position(event);
      const coverage=scene.showFireCoverage&&view.interactionMode!=='paint'&&!socketToolActive(view)?pickWeaponCoverage(scene,view,width,height,x,y,getPreferences()):null;
      if(coverage){scene.coverageInspection=coverage;scene.coverageHover=null;release();invalidate();onSelect({coverage:true});onChange();return;}
      if(scene.pickAttachment&&componentTools.pickAttachment(pickGamePoint(scene,view,width,height,x,y,getPreferences()))){release();invalidate();onSelect({componentSocketId:null});onChange();return;}
      const marker=socketToolActive(view)?pickSocketMarker([...socketHits,...componentSocketHits],x,y):null;
      if(marker){const result=selectSocketMarker(scene,marker);release();invalidate();onSelect(result);onChange();return;}
      // A mounted component under the cursor is selected for Properties › Components and the outliner.
      const component=pickComponent(scene,view,width,height,x,y,getPreferences());
      if(component){const ids=new Set(drag.additive?scene.selectedComponentMountIds||[]:[]);if(drag.additive&&ids.has(component.componentMountId))ids.delete(component.componentMountId);else ids.add(component.componentMountId);scene.selectedComponentMountIds=ids;scene.selectedComponentMountId=[...ids].at(-1)||null;scene.selectedComponentSocketId=component.socketId;selectTurrets(scene,null);release();invalidate();onSelect({componentSocketId:component.socketId});onChange();return;}
      if(scene.selectedComponentMountId){scene.selectedComponentMountId=null;scene.selectedComponentMountIds=new Set();}
      const socket=socketHits.find(s=>Math.hypot(s.screen[0]-x,s.screen[1]-y)<=12);
      const turret=pickTurret(scene,view,width,height,x,y,getPreferences());selectTurrets(scene,turret?.mountId||null,drag.additive);
      if(turret){scene.turretSockets??={};scene.turretSockets.selectedId=turret.socketId;selection={socketId:turret.socketId};}
      else if(socketToolActive(view)){scene.turretSockets??={};scene.turretSockets.selectedId=socket?.id||null;selection={socketId:socket?.id||null};}
      else selection=scene.model?(pickGame(scene,view,width,height,x,y,getPreferences())||false):projectedFaces.some(points=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;});
    }
    const paletteClick=drag.paletteClick&&!drag.moved;
    if(paletteClick)Object.assign(view,drag.before,view.display?{display:view.display}:{},view.paint?{paint:view.paint}:{});
    const additive=drag.additive&&!drag.moved,subtract=drag.subtract;
    release();regionMode=false;body.classList.remove('region-zoom');invalidate();onChange();
    if (selection!==null) onSelect(selection,additive,{subtract});
    if(paletteClick)onPaint('palette',event);
  }
  const touches=new Map();
  let touchStart=null, lastTap=null, holdTimer, multiTouch=false;
  function clearHold(){clearTimeout(holdTimer);}
  function resetTouch(){
    clearHold();
    touches.clear();
    touchStart=lastTap=null;
    multiTouch=false;
  }
  function handlesTouch(event){
    return event.pointerType==='touch' && (touches.has(event.pointerId) ||
      (getPreferences().trackpadNavigation&&!regionMode&&
       (view.interactionMode!=='paint'||paintOptions(view).tool==='select')));
  }
  function touchDown(event){
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    if(!touches.size&&turretToolbar.active)turretToolbar.close();
    touches.set(event.pointerId,event);
    if(touches.size>1){
      clearHold();
      lastTap=touchStart=null;
      multiTouch=true;
      // Keep capture until each finger lifts, but abandon any selection rectangle.
      if(drag?.mode==='componentGizmo')componentTools.cancel();
      drag=null;
      invalidate();
      return;
    }
    const doubleTap=lastTap&&event.timeStamp-lastTap.time<=300&&
      Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<=32;
    touchStart={event,doubleTap};
    lastTap=null;
    holdTimer=setTimeout(()=>{
      if(!touchStart||touches.size!==1)return;
      touchStart=null;
      openViewportContext(event);
    },500);
  }
  function touchMove(event){
    const previous=touches.get(event.pointerId);
    if(!previous)return;
    touches.set(event.pointerId,event);
    if(multiTouch){
      if(touches.size!==2)return;
      const other=[...touches.values()].find(t=>t.pointerId!==event.pointerId);
      const before=Math.hypot(previous.clientX-other.clientX,previous.clientY-other.clientY);
      const after=Math.hypot(event.clientX-other.clientX,event.clientY-other.clientY);
      pan(view,(event.clientX-previous.clientX)/2,(event.clientY-previous.clientY)/2,width,height);
      if(before>4&&after>4)zoom(view,after/before);
      invalidate();
      onChange();
      return;
    }
    if(touchStart){
      const start=touchStart.event;
      if(Math.hypot(event.clientX-start.clientX,event.clientY-start.clientY)<6)return;
      clearHold();
      down(start,touchStart.doubleTap?'select':'orbit');
      touchStart=null;
    }
    move(event);
  }
  function touchUp(event){
    if(!touches.delete(event.pointerId))return;
    clearHold();
    if(!multiTouch){
      if(touchStart){
        down(event,'select',false);
        lastTap={time:event.timeStamp,x:event.clientX,y:event.clientY};
      }
      up(event);
    }
    touchStart=null;
    if(!touches.size)multiTouch=false;
    updateCursor();
  }
  listen(canvas,'pointerdown',event=>{trackButtons(event);scene.turretStudio?.manualCamera();if(socketEditor.locked&&handlesTouch(event)){down(event);return;}if(handlesTouch(event))touchDown(event);else down(event);updateCursor();});
  // Mouse events report button chords; pointerdown/up only report first/last buttons.
  listen(canvas,'mousedown',event=>{
    trackButtons(event);
    if(!magnifier)return;event.preventDefault();
    if(event.button===0&&lensPoint(...position(event))&&onPaint('begin')){magnifier.painting=true;magnifier.painted.clear();magnifier.last=null;lensPaint(...position(event));}
  });
  listen(canvas,'mouseup',event=>{if(!magnifier)return;event.preventDefault();if(event.button===0)finishLensStroke();if(event.button===2)closeMagnifier();});
  listen(window,'mouseup',trackButtons);
  listen(canvas,'pointerenter',trackButtons);
  listen(canvas,'pointermove',event=>{trackButtons(event);if(handlesTouch(event))touchMove(event);else move(event);});
  listen(canvas,'pointerleave',()=>{if(!drag&&!magnifier){paintPointer=null;scene.coverageHover=null;invalidate();}});
  listen(canvas,'pointerup',event=>{trackButtons(event);if(handlesTouch(event))touchUp(event);else up(event);updateCursor();});
  listen(canvas,'pointercancel',cancel);
  listen(canvas,'lostpointercapture',event=>{if(drag||magnifier||touches.has(event.pointerId))cancel();});
  listen(window,'blur',cancel);
  listen(canvas,'contextmenu',event=>{event.preventDefault();if(handlesTouch(event)||touches.size)return;if(magnifier)return;if(drag||regionMode){if(drag?.button!==2&&matchesBinding('cancelMouse',event,getPreferences(),'Mouse2'))cancel();return;}if(!suppressContext)openViewportContext(event);});
  function openViewportContext(event){
   const [x,y]=position(event);
   if(socketEditor.context(event,x,y,componentSocketHits)){event.preventDefault();return;}
   if(view.interactionMode!=='paint'){
    const hit=pickComponent(scene,view,width,height,x,y,getPreferences()),marker=pickSocketMarker(componentSocketHits,x,y);
    const component=componentSetup(scene.model||{}).mounts.find(m=>m.id===hit?.componentMountId||marker&&m.socketId===marker.id);
    if(component){turretToolbar.open(component,true);return;}
   }
   const marker=pickSocketMarker(socketHits,x,y),hit=pickTurret(scene,view,width,height,x,y,getPreferences()),mount=mounts(scene).find(m=>m.id===hit?.mountId||marker&&m.socketId===marker.id);if(mount){turretToolbar.open(mount);return;}onContextMenu(event);
  }
  listen(canvas,'auxclick',event=>event.preventDefault());
  // Safari exposes magnification and rotation as GestureEvents; Chromium/Firefox
  // expose trackpad magnification as Ctrl+wheel. Scope both to this canvas.
  let nativeGesture=null;
  listen(canvas,'gesturestart',event=>{
    if(socketEditor.locked){event.preventDefault();return;}
    if(!getPreferences().trackpadNavigation||touches.size||drag||regionMode||magnifier)return;
    event.preventDefault();scene.turretStudio?.manualCamera();
    nativeGesture={scale:1,rotation:0};
  },{passive:false});
  listen(canvas,'gesturechange',event=>{
    if(!nativeGesture)return;
    event.preventDefault();
    if(!getPreferences().trackpadNavigation||drag||regionMode||magnifier){nativeGesture=null;return;}
    const p=getPreferences(),scale=Number(event.scale),rotation=Number(event.rotation);
    if(socketEditor.locked){if(Number.isFinite(scale)&&scale>0)socketEditor.wheel({deltaY:-Math.log(scale/nativeGesture.scale)*1000},1,p);nativeGesture.scale=scale;return;}
    if(Number.isFinite(scale)&&scale>0){zoom(view,Math.pow(scale/nativeGesture.scale,p.zoomSensitivity*(p.invertZoom?-1:1)));nativeGesture.scale=scale;}
    if(Number.isFinite(rotation)){view.roll=(view.roll||0)+(rotation-nativeGesture.rotation)*Math.PI/180;nativeGesture.rotation=rotation;}
    invalidate();onChange();
  },{passive:false});
  listen(canvas,'gestureend',event=>{if(nativeGesture)event.preventDefault();nativeGesture=null;},{passive:false});
  listen(window,'blur',()=>{nativeGesture=null;});
  listen(canvas,'wheel',event=>{
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?height:1,p=getPreferences();
    if(socketEditor.wheel(event,unit,p))return;
    if(magnifier){
      const options=paintOptions(view);
      if(event.ctrlKey||!['brush','restore'].includes(options.tool))return;
      magnifier.brushWheel-=event.deltaY*unit;
      const step=Math.trunc(magnifier.brushWheel/40);
      magnifier.brushWheel-=step*40;
      const radius=Math.max(0,Math.min(64,options.radius+step));
      if(radius!==options.radius){options.radius=radius;onPaint('radius');invalidate();onChange();}
      return;
    }
    if(drag||regionMode)return;
    scene.turretStudio?.manualCamera();
    // Trackpads report pinch as Ctrl+wheel and two-finger swipes as plain wheel deltas.
    if(p.trackpadNavigation){
      if(nativeGesture)return;
      if(event.ctrlKey)zoom(view,Math.exp(-event.deltaY*unit*.01*p.zoomSensitivity*(p.invertZoom?-1:1)));
      else if(event.shiftKey)orbit(view,-(event.deltaX||0)*unit,-event.deltaY*unit,p);
      else pan(view,-(event.deltaX||0)*unit,-event.deltaY*unit,width,height);
    }
    else if(matchesBinding('wheelPan',event,getPreferences(),'Wheel'))pan(view,-(event.deltaX||0)*unit,-event.deltaY*unit,width,height);
    else if(matchesBinding('wheelZoom',event,getPreferences(),'Wheel')) {const p=getPreferences();zoom(view,Math.exp(-event.deltaY*unit*.001*p.zoomSensitivity*(p.invertZoom?-1:1)));}
    invalidate();onChange();
  },{passive:false});
  for (const control of body.querySelectorAll('[data-nav-drag]')) {
    listen(control,'pointerdown',event=>{
      scene.turretStudio?.manualCamera();
      if(!control.classList.contains('view-cube')&&event.target.closest('button,[role=button]')!==control&&event.target.closest('button,[role=button]'))return;
      down(event,control.dataset.navDrag);
    });
    listen(control,'click',event=>event.preventDefault());
    listen(control,'keydown',event=>{if(event.target===control&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(control.dataset.navDrag==='zoom')zoom(view,1.2);else pan(view,0,40,width,height);invalidate();onChange();}});
  }
  return {
    id: area.id, draw: invalidate, cancel,
    get socketEditing(){return socketEditor.locked;},
    get statusActivity() { return statusActivity(); },
    get navigating() { return !!drag || regionMode || !!magnifier; },
    startRegion() {cancel();regionMode=true;body.classList.add('region-zoom');canvas.focus({preventScroll:true});invalidate();},
    dispose() {socketEditor.dispose();turretToolbar.dispose();if(activePlacementViewport===area.id)activePlacementViewport=null;placement.cancel();placement.dispose();releaseViewportResources(view);cancel();events.abort();observer.disconnect();cancelAnimationFrame(frame);hoverLabel?.remove?.();if(canvas.style)canvas.style.cursor=originalCursor;}
  };
}


