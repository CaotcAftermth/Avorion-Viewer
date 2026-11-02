import {loadPalette,HARMONIES,wheelCells,WHEEL_BANDS,nearestNeutral} from './color-palette.js';

import {paintAvailability,readPalettes,savePalette,activePalette,activatePalette,editPalette,addRegion,renameRegion,deleteRegion,editRegion,growRegion,recolorRegion,undoRegionChange,regionUndoLabel} from './color-workshop.js';
import {setRegionDisplay,regionDisplayMode,activeRegion,REGION_COLORS} from './region-display.js';
import {icon} from './icons.js';

import {harmony} from './color-palette.js';

import {popover,closeViewportPopover} from './viewport-controls.js';

import {setDisabled} from './control-state.js';



const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};

const button=(text,action,cls='')=>{const b=node('button',cls,text);b.type='button';b.onclick=action;return b;};

const select=(label,values,value,change)=>{const s=node('select');s.setAttribute('aria-label',label);for(const [id,text] of values)s.add(new Option(text,id));s.value=value;s.onchange=()=>change(s.value);return s;};

const swatch=color=>{const s=node('span','color-swatch');s.style.background=color.hex;s.setAttribute('aria-hidden','true');return s;};

export function mountColorEditor(host,area,scene,actions){

  host.classList.add('color-editor');

  const state=area.colorEditor??={};

  state.tab=['wheel','list','palettes','regions'].includes(state.tab)?state.tab:'wheel';

  state.search=typeof state.search==='string'?state.search.slice(0,150):'';state.category=typeof state.category==='string'?state.category:'';state.link=state.link===true;state.familyOpen=state.familyOpen&&typeof state.familyOpen==='object'?state.familyOpen:{};state.openPanels=state.openPanels&&typeof state.openPanels==='object'?state.openPanels:{};

  state.mode=Object.hasOwn(HARMONIES,state.mode)?state.mode:'Complementary';

  state.variants=state.variants&&typeof state.variants==='object'?state.variants:{};state.draft=Array.isArray(state.draft)?state.draft:[];

  state.channel=state.channel==='secondaryColor'?'secondaryColor':'color';state.strength=state.strength==='full'?'full':'preserve';

  let palette,disposed=false,footer,statusText='',browserHost,liveModel,liveRegions,liveSelection;

  const save=()=>actions.save();
  const escapeRegionEdit=e=>{if(e.key==='Escape'&&scene.regionEdit&&!e.target.closest?.('input,textarea,select')){scene.regionEdit=null;syncEditBadge();render();actions.changed?.();}};document.addEventListener('keydown',escapeRegionEdit);

  function publishBrush(){scene.paintHarmony=[chosen(base()).id,...suggestions().map(s=>chosen(s.base).id)];scene.paintBrush={colorId:state.activeId,channel:state.channel,strength:state.strength};actions.brushChanged?.();save();}

  function attempt(fn){try{fn();}catch(error){statusText=error.message;}render();actions.changed?.();}

  function readSharedBrush(){

    const brush=scene.paintBrush,c=palette.byId.get(brush?.colorId),changed=c&&state.activeId!==c.id;

    if(c){state.activeId=c.id;state.channel=brush.channel;state.strength=brush.strength;if(changed){state.baseId=c.baseName;state.variants[c.baseName]=c.variant;}}

    return changed;

  }

  function panel(parent,title,open=true){const d=node('details','color-panel');d.open=state.openPanels[title]??open;d.append(node('summary','',title));d.ontoggle=()=>{state.openPanels[title]=d.open;save();};parent.append(d);return d;}

  function base(){return palette.byId.get(state.baseId);}

  function chosen(b){return b.variants.find(c=>c.variant===state.variants[b.id])||b;}

  function suggestions(){return harmony(palette,base(),state.mode);}

  function pick(color,primary=true){

    const focused=document.activeElement?.getAttribute('aria-label');

    if(primary)state.baseId=color.baseName;

    state.variants[color.baseName]=color.variant;state.activeId=color.id;

    if(primary&&state.link)for(const {base:b} of suggestions())if(b.variants.some(v=>v.variant===color.variant))state.variants[b.id]=color.variant;

    publishBrush();render();if(focused)[...host.querySelectorAll('[aria-label]')].find(el=>el.getAttribute('aria-label')===focused)?.focus({preventScroll:true});

  }

  const ns='http://www.w3.org/2000/svg';

  function svgNode(tag,attrs={}){const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;}

  function changeHarmony(mode){state.mode=mode;if(state.link)pick(chosen(base()));else{save();render();actions.changed?.();}}

  function paletteRow(parent){

    const strip=node('div','wheel-palette');strip.setAttribute('aria-label','Current harmony palette');

    for(const b of [base(),...suggestions().map(s=>s.base)]){

      const color=chosen(b),item=node('div','wheel-palette-color'),use=button('',()=>pick(color,b.id===base().id),'wheel-palette-swatch');

      use.style.background=color.hex;use.setAttribute('aria-label','Use '+color.name);use.setAttribute('aria-pressed',String(state.activeId===color.id));

      use.title=`${color.name} · ${color.hex} · RGB ${color.rgb.join(', ')}`;

      const suggestion=suggestions().find(s=>s.base.id===b.id);if(suggestion)use.title+=` · Target ${suggestion.target.toFixed(1)}° · nearest balanced base ${b.name}`;

      const variant=select(b.name+' variant',b.variants.map(c=>[c.variant,c.variant]),color.variant,v=>pick(b.variants.find(c=>c.variant===v),b.id===base().id));

      item.append(use,variant,node('span','wheel-palette-name',b.name));strip.append(item);

    }

    parent.append(strip);

  }

  function neutralSlider(parent){

    const row=node('div','neutral-shade'),slider=node('input'),label=node('output');slider.type='range';slider.min=0;slider.max=255;slider.step=1;

    slider.value=state.neutralLevel??128;slider.setAttribute('aria-label','Neutral shade');

    const preview=()=>{const c=nearestNeutral(palette,Number(slider.value));label.textContent=c.name+' · '+c.hex;slider.setAttribute('aria-valuetext',c.name+' '+c.hex);};

    slider.oninput=preview;slider.onchange=()=>{state.neutralLevel=Number(slider.value);pick(nearestNeutral(palette,state.neutralLevel));};preview();

    row.title='Black to white target; snaps to the nearest grayscale Avorion base color in OKLab. Release to choose the paint color.';

    row.append(slider,label);parent.append(row);

  }

  function harmonySymbol(mode){

    const svg=svgNode('svg',{viewBox:'0 0 32 32','aria-hidden':'true',focusable:'false'});

    svg.append(svgNode('circle',{cx:16,cy:16,r:12,fill:'none',stroke:'currentColor','stroke-width':3,opacity:.2}));

    const rotation=mode==='Tetradic'?-30:0;

    const points=[0,...HARMONIES[mode]].map(deg=>{const a=(deg+rotation)*Math.PI/180;return [16+12*Math.sin(a),16-12*Math.cos(a)];});

    const segments=mode==='Analogous'||mode==='Split Complementary'

      ?points.map(p=>`M16 16L${p.join(' ')}`).join(' ')

      :`M${points.map(p=>p.join(' ')).join('L')}${points.length>2?'Z':''}`;

    svg.append(svgNode('path',{d:segments,fill:'none',stroke:'currentColor','stroke-width':1.4,'stroke-linejoin':'round','stroke-linecap':'round'}));

    for(const [cx,cy] of points)svg.append(svgNode('circle',{cx,cy,r:2.5,fill:'currentColor'}));

    return svg;

  }

  function wheel(parent){

    const buttons=node('div','harmony-modes');buttons.setAttribute('role','group');buttons.setAttribute('aria-label','Color Harmony');

    for(const mode of Object.keys(HARMONIES)){const b=button('',()=>changeHarmony(mode));b.title=`${mode} · ${HARMONIES[mode].map(angle=>`${angle}°`).join(' / ')} from the base hue`;b.setAttribute('aria-label',mode+' harmony');b.setAttribute('aria-pressed',String(state.mode===mode));b.append(harmonySymbol(mode));buttons.append(b);}parent.append(buttons);

    const svg=svgNode('svg',{viewBox:'0 0 400 400','aria-label':'Avorion Family Fan: twelve hue families, dark to light outward'});svg.classList.add('base-color-wheel');

    const point=(r,deg)=>[200+r*Math.sin(deg*Math.PI/180),200-r*Math.cos(deg*Math.PI/180)],cells=wheelCells(palette),paths=[];

    for(const cell of cells){

      const {color,band,start,end,sector}=cell,inner=88+band*25.5,outer=inner+25.5,p1=point(outer,start),p2=point(outer,end),p3=point(inner,end),p4=point(inner,start);

      const path=svgNode('path',{d:`M${p1}A${outer} ${outer} 0 0 1 ${p2}L${p3}A${inner} ${inner} 0 0 0 ${p4}Z`,fill:color.hex,role:'button',tabindex:'-1','aria-label':`${color.name} base color · hue ${cell.hue}° · ${['dark','mid-dark','mid-light','light'][band]} band`});

      path.dataset.base=color.id;path.dataset.band=band;path.dataset.sector=sector;path.dataset.family=cell.family;path.setAttribute('aria-pressed',String(color.id===state.baseId));

      const title=svgNode('title');title.textContent=`${color.name} · ${color.hex} · Base color`;path.append(title);

      path.onclick=()=>pick(chosen(color));paths.push(path);svg.append(path);

    }

    const activeCell=cells.findIndex(c=>c.color.id===state.baseId);paths[Math.max(0,activeCell)].setAttribute('tabindex','0');

    paths.forEach((path,i)=>path.onkeydown=e=>{

      if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(chosen(cells[i].color));}

      const delta={ArrowLeft:-WHEEL_BANDS,ArrowRight:WHEEL_BANDS,ArrowUp:1,ArrowDown:-1}[e.key];

      if(delta!==undefined){e.preventDefault();let next=['ArrowUp','ArrowDown'].includes(e.key)?i-cells[i].band+Math.max(0,Math.min(WHEEL_BANDS-1,cells[i].band+delta)):(i+delta+paths.length)%paths.length;paths.forEach(p=>p.setAttribute('tabindex','-1'));paths[next].setAttribute('tabindex','0');paths[next].focus();}

    });

    const selected=[base(),...suggestions().map(s=>s.base)];

    for(const [i,color] of selected.entries())if(color.wheel){const [cx,cy]=point(181,color.h),marker=svgNode('g',{'aria-hidden':'true',class:'color-wheel-marker'});marker.append(svgNode('circle',{cx,cy,r:9.5,fill:'#151a20'}),svgNode('circle',{cx,cy,r:7.5,fill:color.hex,stroke:i?'#e1e7ed':'#ffffff','stroke-width':2}));svg.append(marker);}

    const wrap=node('div','color-wheel-wrap');wrap.append(svg);const center=node('div','color-wheel-center'),preview=svgNode('svg',{viewBox:'0 0 100 100','aria-label':'Chosen color comparison'});preview.classList.add('color-pair');

    const colors=selected.map(chosen);

    if(colors.length===1)preview.append(svgNode('circle',{cx:50,cy:50,r:48,fill:colors[0].hex}));

    else colors.forEach((c,i)=>{const angle=j=>j/colors.length*Math.PI*2+Math.PI/2,p=j=>[50+48*Math.cos(angle(j)),50+48*Math.sin(angle(j))];preview.append(svgNode('path',{d:`M50 50L${p(i)}A48 48 0 0 1 ${p(i+1)}Z`,fill:c.hex}));});

    preview.append(svgNode('circle',{cx:50,cy:50,r:48,fill:'none',stroke:'#bbc9d8','stroke-width':1.3}));center.append(preview);wrap.append(center);

    parent.append(wrap);const caption=node('div','color-wheel-caption');caption.append(node('strong','',base().wheel?state.mode:base().name),node('span','',base().wheel?HARMONIES[state.mode].map(x=>`${x}°`).join(' / '):'Neutral · list color'));parent.append(caption);

    const legend=node('div','color-wheel-legend');legend.append(node('span','','Base colors · dark → light outward'));legend.title='Twelve hue families separated by gutters. Each fan samples existing base colors in four tonal bands; sparse ranges repeat colors. No variants or generated RGB values. Every color remains available in List.';

    const link=node('label','color-link'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=!!state.link;checkbox.onchange=()=>{state.link=checkbox.checked;if(state.link)pick(chosen(base()));else{save();render();}};link.append(checkbox,node('span','','Link Variants'));link.title='Follow the primary variant where available. Other families retain their current choice.';legend.append(link);parent.append(legend);

    neutralSlider(parent);
    const materials=node('div','material-color-swatches');materials.setAttribute('role','group');materials.setAttribute('aria-label','Material colors');
    for(const color of palette.materials){
      const choice=button('',()=>pick(color),'material-color-swatch');choice.style.background=color.hex;
      choice.title=color.name;choice.setAttribute('aria-label',color.name);choice.setAttribute('aria-pressed',String(state.activeId===color.id));materials.append(choice);
    }
    parent.append(materials);paletteRow(parent);
    if(!base().wheel)parent.append(node('p','color-note','Neutral and material swatches have no generated hue harmony. Combine them with other palette colors.'));

  }



  function browser(parent){

    const controls=node('div','color-browser-controls'),search=node('input');search.type='search';search.placeholder='Search colors…';search.setAttribute('aria-label','Search Avorion colors');search.value=state.search||'';search.maxLength=150;

    search.oninput=()=>{state.search=search.value;save();renderList();};controls.append(search,select('Color category',[['','All categories'],...palette.categories.map(c=>[c,c])],state.category||'',value=>{state.category=value;save();renderList();}));

    const label=node('label','color-link'),check=node('input');check.type='checkbox';check.checked=!!state.showVariants;check.onchange=()=>{state.showVariants=check.checked;save();renderList();};label.append(check,node('span','','Include variants'));controls.append(label);parent.append(controls);

    parent.append(node('p','color-note','Named colors come from Avorion rgb.txt; material defaults come from Avorion_Material_Colors.xml. Row refers only to rgb.txt. Categories are viewer groupings.'));

    browserHost=node('div','color-browser-list');parent.append(browserHost);renderList();

  }

  function renderList(){

    if(!browserHost)return;browserHost.replaceChildren();const query=(state.search||'').toLowerCase().trim();

    const rows=palette.colors.filter(c=>(state.showVariants||query||c.variant==='Base')&&(!state.category||c.category===state.category)&&(!query||[c.name,c.hex,c.rgb.join(' '),String(c.row)].some(v=>v.toLowerCase().includes(query))));

    if(!rows.length){browserHost.append(node('p','color-note','No matching Avorion colors.'));return;}

    for(const category of palette.categories){const members=rows.filter(c=>c.category===category).sort((a,b)=>a.ok.L-b.ok.L||a.row-b.row);if(!members.length)continue;

      const d=panel(browserHost,`${category} (${members.length})`,query?true:state.familyOpen?.[category]??true);d.ontoggle=()=>{if(!query){(state.familyOpen??={})[category]=d.open;save();}};

      const header=node('div','color-list-row color-list-heading');for(const text of ['Name','RGB','Hex','Row'])header.append(node('span','',text));d.append(header);

      for(const color of members){const b=button('',()=>pick(color),'color-list-row');b.setAttribute('aria-label',color.name+' · '+color.hex);b.title=`${color.name} · RGB ${color.rgb.join(' ')} · ${color.hex} · ${color.source||`source row ${color.row}`}`;b.setAttribute('aria-pressed',String(state.activeId===color.id));

        const name=node('span','color-list-name');name.append(swatch(color),node('span','',color.name));b.append(name,node('span','',color.rgb.join(' ')),node('span','',color.hex),node('span','',color.row===null?'—':String(color.row)));d.append(b);}

    }

  }

  function palettes(parent){

    const creator=panel(parent,'New Palette'),form=node('form','palette-create-form'),name=node('input');
    name.placeholder='Palette name';name.maxLength=80;name.required=true;name.value=state.newPaletteName||'';name.setAttribute('aria-label','Palette name');name.oninput=()=>{state.newPaletteName=name.value;save();};
    const nameRow=node('label','palette-create-field');nameRow.append(node('span','','Name'),name);form.append(nameRow);
    const sources=[['harmony','Current harmony'],['active','Current brush color']];if(state.draft.length)sources.push(['draft','Custom draft']);
    if(!sources.some(([id])=>id===state.paletteSource))state.paletteSource=state.draft.length?'draft':'harmony';
    const ids=()=>[...new Set(state.paletteSource==='active'?[state.activeId]:state.paletteSource==='draft'?state.draft:[chosen(base()).id,...suggestions().map(s=>chosen(s.base).id)])].filter(id=>palette.byId.has(id));
    const preview=node('div','palette-create-preview'),count=node('span','palette-create-count'),error=node('p','color-status');error.setAttribute('role','alert');error.hidden=true;
    const refresh=()=>{preview.replaceChildren();for(const id of ids()){const c=palette.byId.get(id),chip=swatch(c);chip.title=`${c.name} · ${c.variant} · RGB ${c.rgb.join(', ')} · ${c.hex}`;chip.setAttribute('aria-label',c.name);chip.removeAttribute('aria-hidden');preview.append(chip);}count.textContent=`${ids().length} color${ids().length===1?'':'s'}`;};
    const source=select('Palette color source',sources,state.paletteSource,v=>{state.paletteSource=v;save();refresh();});const sourceRow=node('label','palette-create-field');sourceRow.append(node('span','','Colors'),source);form.append(sourceRow);
    const bottom=node('div','palette-create-bottom'),create=button('Create Palette',()=>{});create.type='submit';create.title='Save this palette in this browser';bottom.append(preview,count,create);form.append(bottom,error);creator.append(form);refresh();
    form.onsubmit=e=>{e.preventDefault();try{savePalette(localStorage,palette,name.value,ids());state.draft=[];state.newPaletteName='';save();render();actions.changed?.();}catch(e){error.hidden=false;error.textContent=e.message;}};
    const d=panel(parent,'Saved Palettes');d.title='Saved in this browser only';if(!readPalettes(localStorage,palette).length)d.append(node('p','color-note','No saved palettes yet.'));

    for(const saved of readPalettes(localStorage,palette)){
      const active=activePalette(localStorage,palette)?.name===saved.name,group=node('section','saved-palette');group.classList.toggle('active',active);group.setAttribute('aria-label',saved.name+' palette');group.append(node('h3','',saved.name));
      const row=node('div','saved-palette-row'),toggle=node('input');toggle.type='checkbox';toggle.checked=active;toggle.setAttribute('aria-label','Activate palette '+saved.name);toggle.title=active?'Deactivate palette':'Activate palette';toggle.onchange=()=>attempt(()=>activatePalette(localStorage,palette,toggle.checked?saved.name:null));row.append(toggle);
      const strip=node('div','saved-palette-colors');for(const [i,id] of saved.colors.entries()){
        const c=palette.byId.get(id),b=button('',()=>pick(c),'saved-palette-color');b.style.background=c.hex;b.setAttribute('aria-label',`Use ${c.name} from ${saved.name}`);
        b.title=`${i===0?'Primary':'Harmony '+i}: ${c.name} · ${c.variant} · RGB ${c.rgb.join(', ')} · ${c.hex} · source row ${c.row}`;strip.append(b);
      }row.append(strip);
      const menu=button('⋮',()=>popover(menu,'Edit '+saved.name,p=>{
        p.classList.add('palette-action-menu');
        function openEditor(kind){
          if(kind==='add'||kind==='remove'){
            closeViewportPopover();popover(menu,kind==='add'?'Add Color':'Remove Color',window=>{
              window.classList.add('paint-settings-popover');const search=node('input'),list=node('div','paint-color-list'),error=node('p','color-status');search.type='search';search.placeholder='Search colors';search.setAttribute('aria-label','Search palette colors');error.setAttribute('role','alert');window.append(search,list,error);
              const colors=kind==='add'?palette.colors.filter(c=>!saved.colors.includes(c.id)):saved.colors.map(id=>palette.byId.get(id));
              const populate=()=>{list.replaceChildren();for(const c of colors.filter(c=>c.name.toLowerCase().includes(search.value.toLowerCase()))){
                const item=button('',()=>{try{editPalette(localStorage,palette,saved.name,{colors:kind==='add'?[...saved.colors,c.id]:saved.colors.filter(id=>id!==c.id)});closeViewportPopover();render();actions.changed?.();}catch(e){error.textContent=e.message;}});
                const chip=node('span','paint-current-swatch');chip.style.background=c.hex;item.append(chip,node('span','',c.name));item.title=c.hex;item.setAttribute('aria-label',(kind==='add'?'Add ':'Remove ')+c.name);list.append(item);
              }if(!list.children.length)list.append(node('p','color-note','No matching colors.'));};search.oninput=populate;populate();
            });return;
          }
          closeViewportPopover();const dialog=node('dialog','palette-edit-dialog'),title={name:'Edit Name',add:'Add Color',remove:'Remove Color',delete:'Delete Palette'}[kind];dialog.setAttribute('aria-label',title);
          const form=node('form'),heading=node('h3','',title),error=node('p','color-status');error.setAttribute('role','alert');form.append(heading);let input;
          if(kind==='name'){input=node('input');input.value=saved.name;input.maxLength=80;input.required=true;input.setAttribute('aria-label','Edit palette name');form.append(input);}
          else form.append(node('p','',`Delete “${saved.name}”? This removes the saved palette from this browser.`));
          const controls=node('div','dialog-actions'),cancel=button('Cancel',()=>dialog.close()),confirm=button(kind==='delete'?'Delete Palette':'Save',()=>{});confirm.type='submit';controls.append(cancel,confirm);form.append(error,controls);dialog.append(form);
          form.onsubmit=e=>{e.preventDefault();try{
            const change=kind==='name'?{name:input.value}:{remove:true};
            editPalette(localStorage,palette,saved.name,change);dialog.close();render();actions.changed?.();
          }catch(e){error.textContent=e.message;}};
          dialog.addEventListener('close',()=>{dialog.remove();host.querySelector('.saved-palette-menu')?.focus();},{once:true});document.body.append(dialog);dialog.showModal();(kind==='delete'?cancel:input).focus();if(kind==='name')input.select();
        }
        const rename=button('Edit Name',()=>openEditor('name')),add=button('+ Color',()=>openEditor('add')),remove=button('- Color',()=>openEditor('remove')),del=button('Delete Palette',()=>openEditor('delete'));
        add.title='Add color';remove.title='Remove color';setDisabled(add,saved.colors.length>=32,'Palette limit reached (32 colors).','Add color');setDisabled(remove,saved.colors.length===1,'Keep at least one color, or delete the palette.','Remove color');p.append(rename,add,remove,del);
      }),'saved-palette-menu');menu.setAttribute('aria-label','Edit palette '+saved.name);menu.setAttribute('aria-haspopup','dialog');row.append(menu);group.append(row);d.append(group);
    }


  }

  // Regions tab: a compact list of named block sets plus a card for the active one.
  function activateRegion(id){
    const current=scene.regionDisplay?.model===scene.model?scene.regionDisplay.mode:'off';
    state.regionId=id;state.confirmDelete='';setRegionDisplay(scene,id,current==='off'?'highlight':current);
    if(scene.regionEdit)scene.regionEdit={id,model:scene.model};save();
  }
  function setRegionEdit(on){scene.regionEdit=on&&state.regionId?{id:state.regionId,model:scene.model}:null;syncEditBadge();}
  function syncEditBadge(){
    const edit=scene.regionEdit,live=edit&&edit.model===scene.model&&(scene.regions||[]).some(r=>r.id===edit.id);
    if(edit&&!live)scene.regionEdit=null;
    if(live)document.body.dataset.regionEdit=(scene.regions.find(r=>r.id===edit.id)).name;else delete document.body.dataset.regionEdit;
  }
  function regions(parent){
    const rs=scene.regions||[],selected=scene.selectedIds||new Set();
    if(!rs.some(r=>r.id===state.regionId))state.regionId=activeRegion(scene)?.id||rs.at(-1)?.id||'';
    syncEditBadge();
    const root=node('div','region-panel');parent.append(root);
    const head=node('div','region-head');head.append(node('span','region-title',rs.length?`Regions · ${rs.length}`:'Regions'));
    const create=button(`+ New from Selection${selected.size?` (${selected.size})`:''}`,()=>attempt(()=>{const r=addRegion(scene,'',[...selected]);activateRegion(r.id);state.focusName=true;statusText=`Created ${r.name}. Type to rename it.`;}),'region-primary');
    setDisabled(create,!selected.size,'Select blocks in the viewport or outliner first.');head.append(create);root.append(head);
    if(!rs.length){root.append(node('p','region-empty','No regions yet. Select blocks in the viewport or outliner, then press New from Selection. Regions belong to this loaded model, may overlap, and are not written into ship XML.'));}
    const list=node('div','region-list');list.setAttribute('role','listbox');list.setAttribute('aria-label','Regions');
    for(const r of rs){
      const mode=regionDisplayMode(scene,r.id),active=r.id===state.regionId,inSel=r.ids.reduce((n,id)=>n+(selected.has(id)?1:0),0);
      const row=node('div','region-row'+(active?' active':''));row.setAttribute('role','option');row.setAttribute('aria-selected',String(active));row.tabIndex=0;row.style.setProperty('--region',r.color||'#888');
      row.onclick=()=>{if(!active){activateRegion(r.id);render();actions.changed?.();}};
      row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.onclick();}};
      const sw=node('span','region-swatch');const name=node('span','region-name',r.name);name.title=r.name;
      const count=node('span','region-count',inSel?`${inSel}/${r.ids.length}`:String(r.ids.length));count.title=inSel?`${inSel} of ${r.ids.length} blocks selected`:`${r.ids.length} block${r.ids.length===1?'':'s'}`;
      const toggle=(name,label,on,fn)=>{const b=node('button','region-icon');b.type='button';b.innerHTML=icon(name);b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(on));b.onclick=e=>{e.stopPropagation();attempt(fn);};return b;};
      const eye=toggle('eye',mode==='off'?'Highlight in viewport':'Stop showing in viewport',mode!=='off',()=>{state.regionId=r.id;setRegionDisplay(scene,r.id,mode==='off'?'highlight':'off');save();});
      const iso=toggle('isolate',mode==='isolate'?'Show the rest of the ship':'Isolate in viewport',mode==='isolate',()=>{state.regionId=r.id;setRegionDisplay(scene,r.id,mode==='isolate'?'highlight':'isolate');save();});
      row.append(sw,name,count,eye,iso);list.append(row);
    }
    if(rs.length)root.append(list);
    const r=rs.find(x=>x.id===state.regionId);if(r)root.append(regionCard(r,selected));
    if(statusText){const status=node('p','color-status region-status',statusText);status.setAttribute('role','status');root.append(status);}
  }
  function regionCard(r,selected){
    const card=node('div','region-card');card.style.setProperty('--region',r.color||'#888');
    const mode=regionDisplayMode(scene,r.id),editing=scene.regionEdit?.id===r.id;
    const inSel=r.ids.reduce((n,id)=>n+(selected.has(id)?1:0),0),outside=selected.size-inSel;
    // Header: color, editable name, size
    const head=node('div','region-card-head');
    const sw=button('',()=>attempt(()=>{const i=REGION_COLORS.indexOf(r.color);recolorRegion(scene,r.id,REGION_COLORS[(i+1)%REGION_COLORS.length]);}),'region-swatch big');sw.title='Change highlight color';sw.setAttribute('aria-label','Change region color');
    const name=node('input','region-name-input');name.value=r.name;name.maxLength=80;name.setAttribute('aria-label','Region name');
    const commitName=()=>{if(name.value.trim()!==r.name)attempt(()=>{renameRegion(scene,r.id,name.value);statusText='Region renamed.';save();});};
    name.onchange=commitName;name.onkeydown=e=>{if(e.key==='Enter')name.blur();if(e.key==='Escape'){name.value=r.name;name.blur();}};
    if(state.focusName){state.focusName=false;queueMicrotask(()=>{name.focus();name.select();});}
    head.append(sw,name,node('span','region-size',`${r.ids.length} block${r.ids.length===1?'':'s'}`));card.append(head);
    // Display
    const show=node('div','region-segment');show.setAttribute('role','group');show.setAttribute('aria-label','Viewport display');
    for(const [id,text,tip] of [['off','Off','Do not show this region in the viewport'],['highlight','Highlight','Tint region blocks in the viewport'],['isolate','Isolate','Hide everything except this region']]){const b=button(text,()=>attempt(()=>{setRegionDisplay(scene,r.id,id);save();}));b.title=tip;b.setAttribute('aria-pressed',String(mode===id));show.append(b);}
    const look=node('div','region-row-tools');look.append(button('Select',()=>actions.select(r.ids)),button('Frame',()=>actions.focus?.(r.ids)));
    section(card,'Show',show,look);
    // Viewport editing
    const edit=button(editing?'Done Editing':'Edit in Viewport',()=>{setRegionEdit(!editing);if(!editing&&mode==='off')setRegionDisplay(scene,r.id,'highlight');render();actions.changed?.();},editing?'region-primary active':'region-primary');
    edit.setAttribute('aria-pressed',String(editing));
    const editHint=node('p','region-hint',editing?'Click or box-drag blocks in the viewport to add them. Hold Ctrl to remove. Press Esc when done.':'Click blocks in the viewport to add or remove them without touching your selection.');
    section(card,'Edit',edit,editHint);
    // Selection and growth
    const add=button(`+ Add Selected (${outside})`,()=>attempt(()=>{statusText=`Added ${editRegion(scene,r.id,[...selected],'add')} block(s).`;}));
    setDisabled(add,!outside,selected.size?'Every selected block is already in this region.':'Select blocks to add.');
    const remove=button(`− Remove Selected (${inSel})`,()=>attempt(()=>{statusText=`Removed ${editRegion(scene,r.id,[...selected],'remove')} block(s).`;}));
    setDisabled(remove,!inSel||inSel===r.ids.length,inSel?'A region needs at least one block. Delete the region instead.':'Select blocks in this region to remove them.');
    const replace=button('Replace with Selection',()=>attempt(()=>{const n=editRegion(scene,r.id,[...selected],'replace');statusText=n?`${r.name} now holds the ${selected.size} selected block(s).`:`${r.name} already matches the selection.`;}));
    setDisabled(replace,!selected.size,'Select blocks first.');
    const grow=button('Grow',()=>attempt(()=>{statusText=`Grew ${r.name} by ${growRegion(scene,r.id)} touching block(s).`;}));grow.title='Add every block that touches the region, hidden or not. Press again to keep growing.';
    const tools=node('div','region-row-tools');tools.append(add,remove,replace,grow);section(card,'Members',tools);
    // Footer
    const foot=node('div','region-card-foot'),undoLabel=regionUndoLabel(scene);
    const undo=button(undoLabel?`Undo ${undoLabel}`:'Undo',()=>attempt(()=>{statusText=`Undid ${undoRegionChange(scene)}.`;if(!(scene.regions||[]).some(x=>x.id===state.regionId))state.regionId=scene.regions?.at(-1)?.id||'';save();}));
    setDisabled(undo,!undoLabel,'Region changes on this model can be undone here.');foot.append(undo);
    if(state.confirmDelete===r.id)foot.append(node('span','region-confirm',`Delete ${r.name}?`),button('Delete',()=>attempt(()=>{deleteRegion(scene,r.id);state.confirmDelete='';state.regionId='';statusText=`Deleted ${r.name}. Undo is available.`;save();}),'region-danger'),button('Cancel',()=>{state.confirmDelete='';render();}));
    else foot.append(button('Delete Region',()=>{state.confirmDelete=r.id;render();},'region-danger subtle'));
    card.append(foot);return card;
  }
  function section(parent,title,...items){const s=node('div','region-section');s.append(node('span','region-label',title),...items);parent.append(s);return s;}
  function updateFooter(){

    if(!footer||!palette)return;footer.replaceChildren();const color=palette.byId.get(state.activeId)||chosen(base());state.activeId=color.id;

    const chosenLabel=node('div','color-active');chosenLabel.append(swatch(color),node('strong','',color.name),node('span','',color.hex));footer.append(chosenLabel);

    scene.paintHarmony=[chosen(base()).id,...suggestions().map(s=>chosen(s.base).id)];
    scene.paintBrush??={colorId:state.activeId,channel:state.channel,strength:state.strength};

    const channels=select('Paint channel',[['color','Primary Color'],['secondaryColor','Secondary Color']],state.channel,v=>{state.channel=v;publishBrush();updateFooter();});footer.append(channels);

    if(state.channel==='secondaryColor')footer.append(select('Secondary paint strength',[['preserve','Preserve existing alpha'],['full','Full strength (FF)']],state.strength,v=>{state.strength=v;publishBrush();}));

    const ids=scene.loaded?[...scene.selectedIds||[]]:[],apply=button(`Apply to Selected (${ids.length})`,()=>attempt(()=>{const count=actions.apply(palette,state.activeId,ids,state.channel,state.strength);statusText=`Updated ${count} block(s).`; }),'color-apply');setDisabled(apply,!ids.length,'Select one or more blocks in the viewport or Outliner first.','Paint selected blocks with '+color.name);footer.append(apply);

    const rs=scene.regions||[];if(!rs.some(r=>r.id===state.regionId))state.regionId=rs[0]?.id||'';

    const region=select('Target region',[['','Choose region'],...rs.map(r=>[r.id,r.name])],state.regionId,v=>{state.regionId=v;save();updateFooter();});footer.append(region);

    const applyRegion=button('Apply to Region',()=>attempt(()=>{const r=rs.find(r=>r.id===state.regionId);const count=actions.apply(palette,state.activeId,r.ids,state.channel,state.strength);statusText=`Updated ${count} region block(s).`;}));setDisabled(applyRegion,!rs.some(r=>r.id===state.regionId),'Save a named region from the Regions tab, then choose it.');footer.append(applyRegion);

    const history=paintAvailability(scene);for(const redo of [false,true]){const b=button(redo?'Redo Paint':'Undo Paint',()=>actions.undo(redo));setDisabled(b,!history[redo?'redo':'undo'],redo?'Undo a repaint first.':'Apply a color to blocks first.');footer.append(b);}

    chosenLabel.title='Browsing does not repaint. Apply changes the working copy. Primary alpha is preserved; missing secondary alpha starts at FF.';

    const status=node('p','color-status',statusText);status.setAttribute('role','status');status.hidden=!statusText;footer.append(status);liveModel=scene.model;liveRegions=scene.regions;liveSelection=scene.selectedIds;

  }

  function render(){

    if(disposed||!palette)return;const scrolls=['color-editor-main','color-wheel-pane','color-list-pane'].map(cls=>[cls,host.querySelector('.'+cls)?.scrollTop||0]);host.replaceChildren();browserHost=null;

    const tabs=node('div','color-editor-tabs');for(const [id,text] of [['wheel','Wheel'],['list','List'],['palettes','Palettes'],['regions','Regions']]){const b=button(text,()=>{state.tab=id;save();render();});b.setAttribute('aria-pressed',String(state.tab===id));tabs.append(b);}host.append(tabs);

    const main=node('div','color-editor-main');host.append(main);

    if(state.tab==='wheel'){const content=node('div','color-wheel-pane');main.append(content);wheel(content);}

    else if(state.tab==='list')browser(main);else if(state.tab==='palettes')palettes(main);else regions(main);

    scene.paintHarmony=[chosen(base()).id,...suggestions().map(s=>chosen(s.base).id)];
    scene.paintBrush??={colorId:state.activeId,channel:state.channel,strength:state.strength};liveModel=scene.model;liveRegions=scene.regions;liveSelection=scene.selectedIds;

    const applyMenu=button('Apply…',()=>popover(applyMenu,'Apply Color',el=>{footer=node('div','color-apply-controls');el.append(footer);updateFooter();}));applyMenu.className='color-apply-menu';tabs.append(applyMenu);

    updateFooter();for(const [cls,top] of scrolls){const el=host.querySelector('.'+cls);if(el)el.scrollTop=top;}

  }

  host.append(node('p','color-note','Loading local Avorion palette…'));

  loadPalette().then(data=>{if(disposed)return;palette=data;if(!palette.bases.some(c=>c.id===state.baseId))state.baseId=palette.wheel[0].id;if(!palette.byId.has(state.activeId))state.activeId=chosen(base()).id;state.draft=state.draft.filter(id=>palette.byId.has(id)).slice(0,32);if(!palette.categories.includes(state.category))state.category='';readSharedBrush();render();}).catch(error=>{if(!disposed){host.replaceChildren(node('p','color-note',error.message));}});

  return {colorAreaId:area.id,choosePaintColor(id){const c=palette?.byId.get(id);if(c)pick(c,!scene.paintHarmony?.includes(c.id));},sync(){

    if(disposed||!palette)return;const changed=readSharedBrush();

    if(scene.model!==liveModel){state.regionId='';render();}else if(changed||state.tab==='regions'&&(liveRegions!==scene.regions||liveSelection!==scene.selectedIds)){if(liveRegions!==scene.regions)statusText='';render();}else updateFooter();

  },dispose(){disposed=true;document.removeEventListener('keydown',escapeRegionEdit);footer?.closest(".viewport-popover")?.remove();}};

}

