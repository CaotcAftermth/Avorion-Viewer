import {BLUEPRINT_CAMERAS,blueprintSettings,blueprintPanels,validateBlueprintSettings} from './image-options.js';
import {blueprintCamera,orbitBlueprint,panBlueprint,frameBlueprint} from './blueprint-camera.js';
import {mountAnnotationEditor} from './blueprint-annotation-editor.js';
import {dragMode} from '../navigation.js';
import {mountViewCube,selectCubeView,rotatePoleView} from '../view-cube.js';

// Keep edits local until Apply. Both preview and final export use the same options.
export function openBlueprintDialog(options,{renderPreview,sourceView,preferences={},onApply,onClose=()=>{}}){
  const draft=structuredClone(options);draft.blueprintSettings=structuredClone(blueprintSettings(draft));
  const settings=draft.blueprintSettings;
  for(const [i,view] of [settings.single,...settings.views].entries()){view.name??=(i===0?draft.camera:view.camera).replace(/^./,c=>c.toUpperCase());view.dimensions??=!!draft.dimensions;view.dimensionCage??=draft.dimensionCage!==false;}
  const source=structuredClone(sourceView||{yaw:0,pitch:0,roll:0});
  draft.projection='orthographic';draft.framing='fit';
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const dialog=el('dialog');dialog.className='blueprint-dialog';dialog.setAttribute('aria-label','Customize blueprint');
  const heading=el('div');heading.className='export-heading';heading.append(el('h2','Customize blueprint'));
  const form=el('form'),body=el('div'),controls=el('div'),preview=el('div');controls.className='blueprint-sidebar';body.className='blueprint-body';preview.className='blueprint-preview';
  const toolbar=el('div');toolbar.className='blueprint-tools';toolbar.setAttribute('aria-label','Blueprint preview tools');
  const sheetTools=el('div'),modelTools=el('div');
  for(const [group,label] of [[sheetTools,'Sheet tools'],[modelTools,'Model tools']]){group.className='blueprint-tool-group';group.setAttribute('role','group');group.setAttribute('aria-label',label);group.append(el('span',label));toolbar.append(group);}
  const stage=el('div');stage.className='blueprint-stage';stage.tabIndex=0;stage.setAttribute('role','region');stage.setAttribute('aria-label','Interactive blueprint preview');
  const image=el('canvas');image.setAttribute('aria-label','Blueprint customization preview');image.hidden=true;
  const selection=el('div');selection.className='blueprint-panel-selection';
  const cube=el('div');cube.className='view-cube blueprint-cube';stage.append(image,selection,cube);
  const status=el('p','Preparing preview...');status.setAttribute('role','status');
  const stageFrame=el('div');stageFrame.className='blueprint-stage-frame';
  const surface=el('div');surface.className='blueprint-sheet-surface';surface.append(stage);stageFrame.append(surface);
  preview.append(toolbar,stageFrame,status);
  toolbar.title='Scroll zooms the sheet without changing export. Orbit/Pan edits the selected model view; Move sheet pans the workspace.';
  let fullscreen=false,sheetZoom=1;
  const zoomLabel=el('label','Sheet zoom '),zoomInput=el('input'),fitSheet=el('button','Fit sheet');zoomInput.type='number';zoomInput.min=25;zoomInput.max=400;zoomInput.step=1;zoomInput.value=100;zoomInput.setAttribute('aria-label','Sheet zoom (%)');zoomLabel.append(zoomInput,el('span','%'));fitSheet.type='button';sheetTools.append(zoomLabel,fitSheet);
  zoomInput.onchange=()=>{if(zoomInput.checkValidity()&&zoomInput.value)setSheetZoom(Number(zoomInput.value)/100);};fitSheet.onclick=()=>setSheetZoom(1);
  const fullscreenButton=el('button','Full screen');fullscreenButton.type='button';fullscreenButton.setAttribute('aria-pressed','false');sheetTools.append(fullscreenButton);
  function fitStage(){
    const ratio=draft.width/draft.height,w=stageFrame.clientWidth,h=stageFrame.clientHeight;
    const width=Math.max(1,Math.min(w,h*ratio)*sheetZoom),height=width/ratio;
    surface.style.width=`${Math.max(w,width)}px`;surface.style.height=`${Math.max(h,height)}px`;
    Object.assign(stage.style,{width:`${width}px`,height:`${height}px`,left:`${Math.max(0,(w-width)/2)}px`,top:`${Math.max(0,(h-height)/2)}px`});
  }
  function setSheetZoom(value,event){
    const rect=stage.getBoundingClientRect(),frame=stageFrame.getBoundingClientRect();
    const px=event?event.clientX-frame.left:stageFrame.clientWidth/2,py=event?event.clientY-frame.top:stageFrame.clientHeight/2;
    const x=(frame.left+px-rect.left)/rect.width,y=(frame.top+py-rect.top)/rect.height;
    sheetZoom=Math.max(.25,Math.min(4,value));zoomInput.value=Math.round(sheetZoom*100);fitStage();
    stageFrame.scrollLeft=stage.offsetLeft+x*stage.clientWidth-px;stageFrame.scrollTop=stage.offsetTop+y*stage.clientHeight-py;update(true);
  }
  function setFullscreen(value){
    fullscreen=value;dialog.classList.toggle('blueprint-fullscreen',value);
    fullscreenButton.textContent=value?'Exit full screen':'Full screen';fullscreenButton.setAttribute('aria-pressed',String(value));
    fitStage();update();fullscreenButton.focus({preventScroll:true});
  }
  fullscreenButton.onclick=()=>setFullscreen(!fullscreen);
  let lastFrameSize='';
  const resizeObserver=new ResizeObserver(()=>{
    if(closed)return;const size=stageFrame.clientWidth+','+stageFrame.clientHeight;
    if(size!==lastFrameSize){lastFrameSize=size;fitStage();update();}
  });resizeObserver.observe(stageFrame);
  let timer,controller,closed=false,revision=0,renderedRevision=-1,rendering=false,active=0,tool='orbit',drag,viewFields=[];
  const multi=()=>draft.blueprintLayout==='multi';
  const current=()=>multi()?settings.views[active]:settings.single;
  const camera=()=>multi()?current().camera:draft.camera;
  const setCamera=value=>{if(multi())current().camera=value;else draft.camera=value;delete current().orientation;};
  const panels=()=>multi()?blueprintPanels(draft):[{...settings.single,camera:draft.camera,x:0,y:0,width:draft.width,height:draft.height}];
  function field(parent,label,type,value,set,{min,max,step=1,choices}={}){
    const row=el('label'),input=el(type==='select'?'select':'input');row.className='export-field';input.setAttribute('aria-label',label);
    if(type==='select')for(const [key,text] of choices)input.add(new Option(text,key));
    else{input.type=type;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;input.step=step;}
    if(type==='checkbox')input.checked=value;else input.value=value;
    input.addEventListener(['select','checkbox'].includes(type)?'change':'input',()=>{
      if((type!=='number'||input.value!=='')&&input.checkValidity()){set(type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value);update();}
    });
    row.append(el('span',label),input);parent.append(row);return input;
  }
  const sheetControls=el('details');sheetControls.className='panel blueprint-sheet-controls';sheetControls.open=true;sheetControls.append(el('summary','Sheet'));controls.prepend(sheetControls);
  field(sheetControls,'Blueprint views','select',draft.blueprintLayout,value=>{draft.blueprintLayout=value;active=0;rebuildViews();},{choices:[['single','Single view'],['multi','Multi-view (4 views)']]});
  field(sheetControls,'Blueprint page grid','checkbox',draft.pageGrid,value=>draft.pageGrid=value);
  field(sheetControls,'Blueprint title block','checkbox',draft.titleBlock,value=>draft.titleBlock=value);
  field(sheetControls,'Blueprint ship name','text',draft.shipName,value=>draft.shipName=value);
  const splits=el('div');sheetControls.append(splits);
  field(splits,'Left column width (%)','number',settings.columnSplit*100,value=>settings.columnSplit=value/100,{min:20,max:80});
  field(splits,'Top row height (%)','number',settings.rowSplit*100,value=>settings.rowSplit=value/100,{min:20,max:80});
  const groups=el('div');groups.className='property-content blueprint-view-cards';controls.append(groups);
  const annotations=mountAnnotationEditor(stage,{panels,views:()=>multi()?settings.views:[settings.single],selectView:selectActive,changed:()=>update()});
  function rebuildViews(){
    annotations.reset();groups.replaceChildren();viewFields=[];splits.hidden=!multi();
    (multi()?settings.views:[settings.single]).forEach((view,i)=>{
      const group=el('details'),name=multi()?`View ${i+1}`:'View 1';group.className='panel';group.open=i===active;
      group.append(el('summary',multi()?`${name} - ${['top left','top right','bottom left','bottom right'][i]}`:name));
      group.addEventListener('focusin',()=>selectActive(i,false));group.querySelector('summary').addEventListener('click',event=>{event.preventDefault();selectActive(i,false);});
      const label=field(group,`${name} Name`,'text',view.name,value=>view.name=value);label.maxLength=100;label.previousElementSibling.textContent='Name';
      const names=el('datalist');names.id=`blueprint-view-names-${i}`;for(const camera of BLUEPRINT_CAMERAS)names.append(new Option(camera==='current'?'Custom':camera[0].toUpperCase()+camera.slice(1)));label.setAttribute('list',names.id);group.append(names);
      const rotation=field(group,`${name} rotation (degrees)`,'number',view.rotation,value=>view.rotation=value,{min:-180,max:180,step:'any'});
      const scale=field(group,`${name} model scale (%)`,'number',view.scale*100,value=>view.scale=value/100,{min:25,max:200,step:'any'});
      rotation.previousElementSibling.textContent='Rotation (degrees)';scale.previousElementSibling.textContent='Model scale (%)';
      const dimensionsGroup=el('details');dimensionsGroup.className='blueprint-subsection';dimensionsGroup.append(el('summary','Dimensions'));group.append(dimensionsGroup);
      const cage=field(dimensionsGroup,'Dimension Cage','checkbox',view.dimensionCage,value=>view.dimensionCage=value);
      cage.closest('label').classList.add('blueprint-subfield');cage.closest('label').hidden=!view.dimensions;
      const dimensions=field(dimensionsGroup,'Ship dimensions','checkbox',view.dimensions,value=>{view.dimensions=value;cage.closest('label').hidden=!value;fontSize.disabled=!value;});
      const fontSize=field(dimensionsGroup,'Dimensions font size','number',view.dimensionFontSize??12,value=>view.dimensionFontSize=value,{min:6,max:96});fontSize.disabled=!view.dimensions;
      fontSize.title='Font size relative to an 800-pixel view. Scales with export resolution.';
      dimensionsGroup.insertBefore(dimensions.closest('label'),cage.closest('label'));
      annotations.mount(group,view,i,field,el);
      viewFields.push({group,label,rotation,scale});groups.append(group);
    });
    syncNavigation();
  }
  const buttons={};
  for(const name of ['Orbit','Pan','Move sheet','Frame All']){
    const button=el('button',name);button.type='button';(name==='Move sheet'?sheetTools:modelTools).append(button);buttons[name]=button;
    button.onclick=()=>{if(name==='Frame All'){frameBlueprint(current());syncNavigation();update(true);}else{tool=name.toLowerCase();syncNavigation();}};
  }
  function saveCamera(view){current().orientation={yaw:view.yaw,pitch:view.pitch};current().rotation=view.roll*180/Math.PI;syncNavigation();update(true);}
  const updateCube=mountViewCube(cube,name=>{const view=blueprintCamera(camera(),current(),source);selectCubeView(view,name);saveCamera(view);},command=>{
    if(command.action==='home'){setCamera('isometric');current().rotation=0;frameBlueprint(current());}
    else if(command.action==='orbit')orbitBlueprint(current(),camera(),source,command.x,command.y,{orbitSensitivity:1});
    else if(command.action==='pole-roll'){const view=blueprintCamera(camera(),current(),source);rotatePoleView(view,command.value>0);saveCamera(view);return;}
    syncNavigation();update(true);
  });
  function syncNavigation(){
    buttons.Orbit.setAttribute('aria-pressed',String(tool==='orbit'));buttons.Pan.setAttribute('aria-pressed',String(tool==='pan'));
    buttons['Move sheet'].setAttribute('aria-pressed',String(tool==='move sheet'));stage.style.cursor=tool==='pan'||tool==='move sheet'?'move':'grab';
    (multi()?settings.views:[settings.single]).forEach((view,i)=>{
      const fields=viewFields[i];if(!fields)return;
      fields.group.classList.toggle('blueprint-active-view',i===active);
      fields.rotation.value=Number(view.rotation.toFixed(3));fields.scale.value=Number((view.scale*100).toFixed(2));
    });
    updateCube(blueprintCamera(camera(),current(),source));
    try{const p=panels()[active];Object.assign(selection.style,{left:`${p.x/draft.width*100}%`,top:`${p.y/draft.height*100}%`,width:`${p.width/draft.width*100}%`,height:`${p.height/draft.height*100}%`});selection.hidden=!multi();}catch{selection.hidden=true;}
  }
  function selectActive(index,reveal=true){
    if(active!==index)annotations.selectView(index);active=index;
    viewFields.forEach((fields,i)=>{fields.group.classList.toggle('blueprint-active-view',i===index);fields.group.open=i===index;});
    const group=viewFields[index]?.group;
    if(reveal&&group){group.open=true;if(!fullscreen){const top=group.getBoundingClientRect().top-controls.getBoundingClientRect().top+controls.scrollTop;if(top<controls.scrollTop||top+group.offsetHeight>controls.scrollTop+controls.clientHeight)controls.scrollTop=top;}}
    syncNavigation();
  }
  function panelAt(event){
    const rect=stage.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*draft.width,y=(event.clientY-rect.top)/rect.height*draft.height;
    try{return panels().findIndex(p=>x>=p.x&&x<=p.x+p.width&&y>=p.y&&y<=p.y+p.height);}catch{return -1;}
  }
  stage.addEventListener('pointerdown',event=>{
    if(event.target.closest('.view-cube,.blueprint-annotations'))return;
    const mode=dragMode(event,tool,preferences);if(!['orbit','pan','zoom','move sheet'].includes(mode))return;
    const index=panelAt(event);if(index<0)return;event.preventDefault();selectActive(index);stage.focus();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,mode,scrollX:stageFrame.scrollLeft,scrollY:stageFrame.scrollTop,before:structuredClone(current())};stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;
    if(drag.mode==='move sheet'){stageFrame.scrollLeft-=dx;stageFrame.scrollTop-=dy;return;}
    if(drag.mode==='zoom'){setSheetZoom(sheetZoom*Math.exp(-dy*.01),event);return;}
    if(drag.mode==='orbit')orbitBlueprint(current(),camera(),source,dx,dy,preferences);
    else if(drag.mode==='pan'){
      const rect=stage.getBoundingClientRect(),panel=panels()[active];panBlueprint(current(),dx,dy,panel.width/draft.width*rect.width,panel.height/draft.height*rect.height);
    }
    syncNavigation();update(true);
  });
  const endDrag=event=>{if(!drag||drag.id!==event.pointerId)return;drag=null;if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);update(true);};
  stage.addEventListener('pointerup',endDrag);
  stage.addEventListener('pointercancel',event=>{if(!drag)return;stageFrame.scrollLeft=drag.scrollX;stageFrame.scrollTop=drag.scrollY;const state=current();for(const key of Object.keys(state))delete state[key];Object.assign(state,drag.before);endDrag(event);syncNavigation();});
  stage.addEventListener('lostpointercapture',()=>{drag=null;});
  stageFrame.addEventListener('wheel',event=>{
    if(event.target.closest('.view-cube'))return;event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?stageFrame.clientHeight:1;
    setSheetZoom(sheetZoom*Math.exp(-event.deltaY*unit*.001),event);
  },{passive:false});
  stage.addEventListener('keydown',event=>{if(event.target!==stage)return;if(event.key==='Home'){event.preventDefault();buttons['Frame All'].click();}});
  stage.addEventListener('contextmenu',event=>event.preventDefault());
  const actions=el('div');actions.className='dialog-actions';const cancel=el('button','Cancel'),apply=el('button','Apply blueprint');cancel.type='button';apply.type='submit';actions.append(cancel,apply);
  body.append(controls,preview);form.append(body,actions);dialog.append(heading,form);
  const close=()=>{if(closed)return;closed=true;resizeObserver.disconnect();clearTimeout(timer);controller?.abort();dialog.close();dialog.remove();onClose();};
  cancel.onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();if(fullscreen)setFullscreen(false);else close();});dialog.addEventListener('close',close);
  form.onsubmit=event=>{event.preventDefault();try{validateBlueprintSettings(draft);if(multi())blueprintPanels(draft);onApply(structuredClone(draft));close();}catch(error){status.textContent=error.message;}};
  function update(interactive=false){
    if(!interactive){clearTimeout(timer);timer=null;}revision++;
    stage.dataset.width=draft.width;stage.dataset.height=draft.height;
    fitStage();
    try{
      updateCube(blueprintCamera(camera(),current(),source));
      const p=panels()[active];Object.assign(selection.style,{left:`${p.x/draft.width*100}%`,top:`${p.y/draft.height*100}%`,width:`${p.width/draft.width*100}%`,height:`${p.height/draft.height*100}%`});selection.hidden=!multi();
      annotations.refresh();
      status.textContent='Updating preview...';if(timer==null&&!rendering)timer=setTimeout(render,interactive?0:180);
    }catch(error){status.textContent=error.message;}
  }
  async function render(){
    timer=null;if(closed||rendering||renderedRevision===revision)return;
    rendering=true;const version=revision;controller=new AbortController();
    try{
      const density=drag?1:Math.min(2,window.devicePixelRatio||1);
      const previewSize={width:Math.min(drag?900:2048,Math.ceil(stage.clientWidth*density)),height:Math.min(drag?650:1536,Math.ceil(stage.clientHeight*density))};
      const result=await renderPreview({...structuredClone(draft),blueprintEditing:true},controller.signal,previewSize);
      if(!closed&&(version===revision||drag)){image.width=result.canvas.width;image.height=result.canvas.height;image.getContext('2d').drawImage(result.canvas,0,0);image.hidden=false;}
      result.canvas.width=result.canvas.height=1;
      if(closed)return;
      if(version===revision)status.textContent='Preview updated.';
    }catch(error){if(!closed&&version===revision&&error.name!=='AbortError')status.textContent=error.message;}
    finally{rendering=false;renderedRevision=version;if(!closed&&version!==revision){clearTimeout(timer);timer=setTimeout(render,0);}}
  }
  rebuildViews();document.body.append(dialog);dialog.showModal();update();return {close};
}
