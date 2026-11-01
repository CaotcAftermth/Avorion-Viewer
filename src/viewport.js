import {visibleTurretBlocks} from './turrets/posed-blocks.js';
import {drawCoverageLegend} from './turrets/coverage-render.js';
import {coverageOptions} from './turrets/coverage-sampling.js';
import {turretLibrary} from './turrets/library.js';
import {placeFromLibrary} from './turrets/placement.js';
import {mounts,initialTurretSize,selectTurrets} from './turrets/mounts.js';
import {drawSockets} from './turrets/sockets.js';
import {drawDimensions,drawSymmetryPlanes} from './viewport-annotations.js';
import {paintOptions} from './paint-tools.js';
import {nativeToView,viewToNative} from './block-model.js';
import {modelExtents,dimensionRulers,exteriorRuler} from './model-overlays.js';
import {gridSpacing} from './world-guides.js';
import { frameVisibleModel } from './model-framing.js';
import { shadeFace, REFERENCE_NORMALS } from './shading.js';
import { imageRenderBusy, drawGame, pickGame, pickTurret, pickWeaponCoverage, socketExposed, releaseViewportResources, setPaintPreview } from './game-renderer.js';
import { liveBlocks, simplified, isThinBlock, viewportHiddenIds } from './ship-structure.js';
import { selectCubeView } from './view-cube.js';
import { matchesBinding, modifierActive, bindingFor, shortcutLabel } from './keymaps.js';
import { basis, dot, ensureCamera, cameraPoint, projectCamera, clipNear, orbit, pan, zoom, dolly, alignView, snapAxis, viewLabel, dragMode, zoomRegion, REFERENCE_VERTICES } from './navigation.js';
import { FACTORY_PREFERENCES, THEMES, editorTheme } from './preferences.js';
import { reportError } from './app-log.js';

// Navigation state is independent of this reference geometry and can be reused
// by the eventual Avorion renderer.
export function mountViewport(canvas, area, scene, onChange, onSelect, getPreferences = () => FACTORY_PREFERENCES, onContextMenu = () => {}, onPaint = () => false) {
  const ctx = canvas.getContext('2d');
  const view = ensureCamera(area.view), body = canvas.parentElement;
  const faces = [[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0],[4,7,6,5]];
  canvas.classList?.toggle('paint-mode',view.interactionMode==='paint');
  let suppressContext=false,magnifier=null,paintPointer=null,brushCache=null,paintPreview=null;
  const hoverLabel=globalThis.document?.createElement('div');if(hoverLabel){hoverLabel.className='paint-hover-label';hoverLabel.hidden=true;body.append?.(hoverLabel);}
  let statsKey=[],width = 1, height = 1, frame = 0, drag = null, regionMode = false, projectedFaces = [];
  const dimensionCache={};
  let socketHits=[];
  const events = new AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
  const invalidate = () => { if (!frame) frame = requestAnimationFrame(draw); };
  listen(window,'avorion-sky-ready',invalidate);
  listen(window,'avorion-model-ready',invalidate);
  const socketsChanged=()=>onSelect({socketId:scene.turretSockets?.selectedId||null});
  listen(window,'turret-drag-start',()=>{scene.turretDragging=true;invalidate();});
  listen(window,'turret-drag-end',()=>{scene.turretDragging=false;scene.turretPreview=null;invalidate();});
  function dragSocket(event){const [x,y]=position(event);return socketHits.find(s=>s.exposed&&s.fitSize&&Math.hypot(s.screen[0]-x,s.screen[1]-y)<24&&!mounts(scene).some(m=>m.socketId===s.id));}
  listen(canvas,'dragover',event=>{if(!turretLibrary.dragged||view.interactionMode==='paint')return;event.preventDefault();const socket=dragSocket(event),asset=turretLibrary.dragged;event.dataTransfer.dropEffect=socket?'copy':'none';scene.turretPreview=socket?{asset,socket,size:initialTurretSize(asset,socket)}:null;invalidate();});
  listen(canvas,'dragleave',()=>{scene.turretPreview=null;invalidate();});
  listen(canvas,'drop',event=>{const asset=turretLibrary.dragged;if(!asset||view.interactionMode==='paint')return;event.preventDefault();const socket=dragSocket(event);scene.turretPreview=null;scene.turretDragging=false;if(socket){scene.turretSockets??={};scene.turretSockets.selectedId=socket.id;placeFromLibrary(scene,asset,socket,socketsChanged);}invalidate();});


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
  function draw() {
    const started=performance.now();
    frame = 0;
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
    drawCoverageLegend(ctx,scene,view,width,height);
    drawMagnifier();
    drawPaintPreview();
    // No cursor or origin marker: a future Center of Mass marker owns that role.
    if (drag?.mode === 'region' || drag?.mode==='select'&&drag.moved) {
      const rect = regionRect();
      ctx.fillStyle='#83b6e522';ctx.strokeStyle='#9fc8ed';ctx.lineWidth=1;ctx.setLineDash([5,4]);
      ctx.fillRect(rect.x,rect.y,rect.width,rect.height);ctx.strokeRect(rect.x,rect.y,rect.width,rect.height);ctx.setLineDash([]);
    }
    const footer=body.querySelector('.viewport-footer span:last-child');if(footer)footer.textContent=scene.renderPreparing?'Preparing large model…':scene.renderError||`${scene.model?.blocks.length||0} blocks`;
    const hint=body.querySelector('.region-zoom-hint');if(hint)hint.textContent='Zoom region · '+shortcutLabel(bindingFor('regionIn',preferences))+' in / '+shortcutLabel(bindingFor('regionOut',preferences))+' out · '+shortcutLabel(bindingFor('cancel',preferences))+' cancel';
    const label = body.querySelector('.view-label');
    if (label) label.textContent = viewLabel(view);
    const stats=body.querySelector('.viewport-statistics');
    const statsInputs=[liveBlocks(scene),scene.hiddenIds,scene.selectedIds,scene.visible,view.showThinBlocks,view.grid,gridSpacing(view,width,height)];
    if(stats&&!statsInputs.every((v,i)=>v===statsKey[i])){
      const blocks=statsInputs[0];let visibleCount=0;for(const b of blocks)if(!scene.hiddenIds?.has(b.id)&&(view.showThinBlocks!==false||!isThinBlock(b)))visibleCount++;
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
      button.style.zIndex = String(10 + Math.round(dot(vector,b.back)*5));
      button.style.opacity = dot(vector,b.back) < -0.01 ? '0.55' : '1';
    });
    if(scene.model&&scene.visible&&scene.loaded&&!simplified(scene,preferences)&&liveBlocks(scene).some(b=>!scene.hiddenIds?.has(b.id)&&(view.showThinBlocks!==false||!isThinBlock(b)||(b.typeIndex===3&&preferences.shaderThinEnginePlumes!==false))&&[3,7,10,13,61,62,63,64,65].includes(b.typeIndex)))invalidate();
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
    const lens=document.createElement('canvas');lens.className='paint-magnifier';lens.setAttribute('role','img');lens.setAttribute('aria-label',options.lensZoom+'× paint magnifier: hold right mouse, move into lens, left-drag to paint');
    lens.width=Math.round(size*2);lens.height=Math.round(size*2);Object.assign(lens.style,{left:left+'px',top:top+'px',width:size+'px',height:size+'px'});body.append(lens);
    magnifier={lens,x,y,left,top,size,zoom:options.lensZoom,detail:options.lensQuality==='detail'||!!prefs.paintLensWireframe,wireframe:!!prefs.paintLensWireframe,renderView:structuredClone(view),pointerId:event.pointerId,painting:false,painted:new Set(),last:null};
    canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});invalidate();
  }
  function drawMagnifier(){
    if(!magnifier)return;const m=magnifier,c=m.lens.getContext('2d'),scale=m.zoom;
    c.setTransform(2,0,0,2,0,0);c.fillStyle='#161a1e';c.fillRect(0,0,m.size,m.size);
    c.save();c.beginPath();c.rect(0,0,m.size,m.size);c.clip();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    // Draw from the viewport before its guides; the lens never samples itself.
    if(m.detail){m.renderView.grid=false;m.renderView.interactionMode='object';m.renderView.display={...view.display,showOverlays:m.wireframe,wireOverlay:m.wireframe,axisX:false,axisY:false,axisZ:false,objectOutline:false,outlineSelected:false,dof:false};drawGame(c,scene,m.renderView,width,height,getPreferences(),2,{x:m.x,y:m.y,size:m.size,zoom:m.zoom});}
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
  function release() {
    const pointerId=drag?.pointerId;drag=null;
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }
  function cancel() {
    if (!drag && !regionMode && !magnifier) return false;
    closeMagnifier(true);
    if(drag?.mode==='paint')onPaint('cancel');
    if (drag) Object.assign(view,drag.before,view.display?{display:view.display}:{},view.paint?{paint:view.paint}:{});
    release();regionMode=false;body.classList.remove('region-zoom');invalidate();onChange();return true;
  }
  function down(event, forcedMode) {
    if(!forcedMode&&view.interactionMode==='paint'&&event.button===2&&!drag&&!regionMode){suppressContext=true;startMagnifier(event);return;}
    if(magnifier){event.preventDefault();return;}
    if(event.button===2)suppressContext=!!(drag||regionMode);
    if (matchesBinding('cancelMouse',event,getPreferences(),'Mouse'+event.button) && (drag||regionMode)) {event.preventDefault();cancel();return;}
    if (drag) return;
    const regionIn=matchesBinding('regionIn',event,getPreferences(),'Mouse'+event.button),regionOut=matchesBinding('regionOut',event,getPreferences(),'Mouse'+event.button);
    const additiveSelect=scene.model&&view.tool==='select'&&(event.ctrlKey||event.metaKey)&&matchesBinding('selectClick',{...event,ctrlKey:false,metaKey:false,shiftKey:event.shiftKey,altKey:event.altKey},getPreferences(),'Mouse'+event.button);
    const plainLeft=event.button===0&&!event.altKey&&!event.shiftKey;
    const mode=regionMode?(regionIn||regionOut?'region':null):forcedMode||(plainLeft?(view.interactionMode==='paint'?'paint':event.ctrlKey||event.metaKey?'select':dragMode(event,view.tool,getPreferences())):(additiveSelect?'select':dragMode(event,view.tool,getPreferences())));
    if(!mode)return;
    if(mode==='paint'&&!onPaint('begin'))return;
    if(event.button===2)suppressContext=true;
    event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
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
    if(view.interactionMode==='paint'&&paintPointer&&scene.model&&(!drag||drag.mode==='paint')){
      const point=magnifier?lensPoint(...paintPointer):paintPointer;
      if(point)paintPreview={point,...(onPaint('preview',brushTargets(...point))||{ids:[],text:''})};
    }
    const ids=paintPreview?.outlineIds||paintPreview?.ids||[];
    setPaintPreview(view,ids,!!paintPreview?.locked);
    if(magnifier)setPaintPreview(magnifier.renderView,ids,!!paintPreview?.locked);
    if(hoverLabel){hoverLabel.hidden=!paintPreview;hoverLabel.textContent=paintPreview?.text||'';}
  }
  function drawPaintPreview(){
    if(!paintPreview)return;const {point,locked}=paintPreview;
    const options=paintOptions(view),radius=['brush','restore'].includes(options.tool)?options.radius:0;
    const targets=[{c:ctx,map:p=>p,scale:1}];
    if(magnifier){const m=magnifier;targets.push({c:m.lens.getContext('2d'),map:p=>[(p[0]-m.x)*m.zoom+m.size/2,(p[1]-m.y)*m.zoom+m.size/2],scale:m.zoom,size:m.size});}
    for(const {c,map,scale,size} of targets){c.save();if(size){c.beginPath();c.rect(0,0,size,size-20);c.clip();}c.strokeStyle=locked?'#f1a777':'#aad8ff';c.lineWidth=1.5;
      if(radius>0){const p=map(point);c.beginPath();c.arc(p[0],p[1],radius*scale,0,Math.PI*2);c.stroke();}c.restore();
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
    if(!drag&&scene.showFireCoverage&&coverageOptions(scene).inspect&&!scene.turretDragging&&!['paint','socket'].includes(view.interactionMode)){scene.coverageHover=pickWeaponCoverage(scene,view,width,height,...position(event),getPreferences());invalidate();}
    if(view.interactionMode==='paint'){paintPointer=position(event);invalidate();}
    if(magnifier){lensPaint(...position(event));return;}
    if (!drag || event.pointerId!==drag.pointerId) return;
    const [x,y]=position(event), dx=x-drag.x,dy=y-drag.y;
    drag.moved ||= Math.hypot(x-drag.startX,y-drag.startY)>3;
    const preferences=getPreferences();
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
    if(drag.mode==='paint')onPaint('finish');
    if(drag.mode==='select'&&drag.moved){
      if(view.interactionMode==='socket'){
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
      const coverage=scene.showFireCoverage&&!['paint','socket'].includes(view.interactionMode)?pickWeaponCoverage(scene,view,width,height,x,y,getPreferences()):null;
      if(coverage){scene.coverageInspection=coverage;scene.coverageHover=null;release();invalidate();onSelect({coverage:true});onChange();return;}
      const socket=socketHits.find(s=>Math.hypot(s.screen[0]-x,s.screen[1]-y)<=12);
      const turret=pickTurret(scene,view,width,height,x,y,getPreferences());selectTurrets(scene,turret?.mountId||null,drag.additive);
      if(turret){scene.turretSockets??={};scene.turretSockets.selectedId=turret.socketId;selection={socketId:turret.socketId};}
      else if(view.interactionMode==='socket'){scene.turretSockets??={};scene.turretSockets.selectedId=socket?.id||null;selection={socketId:socket?.id||null};}
      else selection=scene.model?(pickGame(scene,view,width,height,x,y,getPreferences())||false):projectedFaces.some(points=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;});
    }
    const paletteClick=drag.paletteClick&&!drag.moved;
    if(paletteClick)Object.assign(view,drag.before,view.display?{display:view.display}:{},view.paint?{paint:view.paint}:{});
    const additive=drag.additive&&!drag.moved,subtract=drag.subtract;
    release();regionMode=false;body.classList.remove('region-zoom');invalidate();onChange();
    if (selection!==null) onSelect(selection,additive,{subtract});
    if(paletteClick)onPaint('palette',event);
  }
  listen(canvas,'pointerdown',event=>{scene.turretStudio?.manualCamera();down(event);});
  // Mouse events report button chords; pointerdown/up only report first/last buttons.
  listen(canvas,'mousedown',event=>{
    if(!magnifier)return;event.preventDefault();
    if(event.button===0&&lensPoint(...position(event))&&onPaint('begin')){magnifier.painting=true;magnifier.painted.clear();magnifier.last=null;lensPaint(...position(event));}
  });
  listen(canvas,'mouseup',event=>{if(!magnifier)return;event.preventDefault();if(event.button===0)finishLensStroke();if(event.button===2)closeMagnifier();});
  listen(canvas,'pointermove',move);
  listen(canvas,'pointerleave',()=>{if(!drag&&!magnifier){paintPointer=null;scene.coverageHover=null;invalidate();}});
  listen(canvas,'pointerup',up);
  listen(canvas,'pointercancel',cancel);
  listen(canvas,'lostpointercapture',()=>{if(drag||magnifier)cancel();});
  listen(window,'blur',cancel);
  listen(canvas,'contextmenu',event=>{event.preventDefault();if(magnifier)return;if(drag||regionMode){if(drag?.button!==2&&matchesBinding('cancelMouse',event,getPreferences(),'Mouse2'))cancel();return;}if(!suppressContext)onContextMenu(event);});
  listen(canvas,'auxclick',event=>event.preventDefault());
  listen(canvas,'wheel',event=>{scene.turretStudio?.manualCamera();
    event.preventDefault();if(drag||regionMode||magnifier)return;
    const unit=event.deltaMode===1?16:event.deltaMode===2?height:1,p=getPreferences();
    // Trackpads report pinch as Ctrl+wheel and two-finger swipes as plain wheel deltas.
    if(p.trackpadNavigation){
      if(event.ctrlKey)zoom(view,Math.exp(-event.deltaY*unit*.01*p.zoomSensitivity*(p.invertZoom?-1:1)));
      else if(event.shiftKey)pan(view,-(event.deltaX||0)*unit,-event.deltaY*unit,width,height);
      else orbit(view,-(event.deltaX||0)*unit,-event.deltaY*unit,p);
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
    get navigating() { return !!drag || regionMode || !!magnifier; },
    startRegion() {cancel();regionMode=true;body.classList.add('region-zoom');canvas.focus({preventScroll:true});},
    dispose() {releaseViewportResources(view);cancel();events.abort();observer.disconnect();cancelAnimationFrame(frame);hoverLabel?.remove?.();}
  };
}


