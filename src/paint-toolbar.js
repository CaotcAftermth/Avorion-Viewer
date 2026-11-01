import {modelPalette} from './model-palette.js';
import {paintOptions} from './paint-tools.js';
import {activePalette,activatePalette,readPalettes,paintAvailability} from './color-workshop.js';
import {setDisabled} from './control-state.js';
import {icon} from './icons.js';
import {popover,closeViewportPopover} from './viewport-controls.js';

const tools=[['brush','Brush','paintBrush'],['eyedropper','Eyedropper','eyedropper'],['replace','Replace Color with Selected','replaceColor'],['fill','Connected Fill','fillPaint'],['restore','Restore','restorePaint']];
export function mountPaintToolbar(body,area,scene,actions){
 const host=document.createElement('div');host.className='paint-tool-settings';host.setAttribute('role','toolbar');host.setAttribute('aria-label','Paint tools');body.append(host);
 const shelf=document.createElement('div');shelf.className='viewport-toolbar paint-tool-shelf';shelf.setAttribute('role','toolbar');shelf.setAttribute('aria-label','Paint tool shelf');shelf.hidden=!area.toolbar;body.append(shelf);
 const status=document.createElement('div');status.className='paint-tool-status';status.setAttribute('role','status');body.append(status);
 const updates=[];let built=false,palette;
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const options=()=>paintOptions(area.view),brush=()=>scene.paintBrush;
 const change=fn=>{actions.cancel();fn();actions.change();sync();};
 function track(node,fn){updates.push({node,fn});fn();}
 function button(parent,label,glyph,run){const b=el('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(glyph);b.onclick=run;parent.append(b);return b;}
 function select(parent,label,values,value,setValue,caption=''){
  const row=el('label',caption);row.className='paint-setting';row.title=label;const s=el('select');s.setAttribute('aria-label',label);row.append(s);parent.append(row);let signature;
  track(row,()=>{const choices=typeof values==='function'?values():values,key=JSON.stringify(choices);if(key!==signature){s.replaceChildren();for(const [id,name]of choices)s.add(new Option(name,id));signature=key;}s.value=value();});
  s.onchange=()=>change(()=>setValue(s.value));return {row,input:s};
 }
 function range(parent,label,key,min,max,step,caption=label){
  const row=el('label',caption+' ');row.className='paint-setting paint-range';const input=el('input'),value=el('output');input.type='range';Object.assign(input,{min,max,step});input.setAttribute('aria-label',label);row.append(input,value);parent.append(row);
  track(row,()=>{input.value=options()[key];value.textContent=options()[key]+(key==='radius'||key==='lensSize'?' px':key==='lensZoom'?'×':'');});
  input.oninput=()=>value.textContent=input.value+(key==='lensZoom'?'×':' px');input.onchange=()=>change(()=>options()[key]=+input.value);return row;
 }
 function panel(parent,title){const d=el('details'),s=el('summary',title);d.open=true;d.append(s);parent.append(d);return d;}
 function popupButton(label,glyph,build){let b; b=button(host,label,glyph,()=>popover(b,label,p=>{p.classList.add('paint-settings-popover');build(p);}));b.setAttribute('aria-haspopup','dialog');return b;}
 function toolButtons(parent){for(const [id,name,glyph]of tools){const b=button(parent,name,glyph,()=>change(()=>options().tool=id));track(b,()=>{b.classList.toggle('active',options().tool===id);b.setAttribute('aria-pressed',String(options().tool===id));});}}
 function build(){
  host.replaceChildren();toolButtons(shelf);
  const toolMenu=popupButton('Paint tool','paintBrush',p=>toolButtons(p));toolMenu.hidden=!!area.toolbar;
  const swatch=el('span');swatch.className='paint-current-swatch';host.append(swatch);track(swatch,()=>{const c=palette.byId.get(brush().colorId);swatch.style.background=c?.hex;swatch.title=c?.name||'';});
  const colorMenu=popupButton('Brush color','color',p=>{
   const search=el('input');search.type='search';search.placeholder='Search colors';search.setAttribute('aria-label','Search brush colors');p.append(search);
   const list=el('div');list.className='paint-color-list';p.append(list);
   const populate=()=>{list.replaceChildren();for(const c of palette.colors.filter(c=>c.name.toLowerCase().includes(search.value.toLowerCase()))){const b=el('button'),chip=el('span');chip.className='paint-current-swatch';chip.style.background=c.hex;b.append(chip,el('span',c.name));b.title=c.hex;b.setAttribute('aria-label','Choose '+c.name);b.onclick=()=>{change(()=>actions.color(c.id));closeViewportPopover();};list.append(b);}};
   search.oninput=populate;populate();
  });colorMenu.classList.add('paint-color-picker');track(colorMenu,()=>{colorMenu.textContent=palette.byId.get(brush().colorId)?.name||'Brush color';});
  select(host,'Paint channel',[['color','Primary'],['secondaryColor','Secondary']],()=>brush().channel,v=>brush().channel=v);
  const alpha=select(host,'Paint alpha',[['preserve','Preserve α'],['full','Full α']],()=>brush().strength,v=>brush().strength=v);track(alpha.row,()=>alpha.row.hidden=brush().channel!=='secondaryColor');
  const radius=range(host,'Brush radius','radius',0,64,1,'Radius');radius.title='Screen-space radius; 0 targets the cursor center.';track(radius,()=>{const enabled=['brush','restore'].includes(options().tool);setDisabled(radius.querySelector('input'),!enabled,'Choose Brush or Restore to use an area radius.','Screen-space radius; 0 targets the cursor center.');});
  select(host,'Paint scope',[['all','Whole Ship'],['selection','Selected Blocks'],['region','Active Region']],()=>options().scope,v=>options().scope=v,'Scope');
  const region=select(host,'Paint region',()=>[['','Choose region'],...(scene.regions||[]).map(r=>[r.id,r.name])],()=>options().regionId||'',v=>options().regionId=v);track(region.row,()=>region.row.hidden=options().scope!=='region');
  const rule=select(host,'Fill match',[['color','Same ARGB'],['material','Same material'],['type','Same block type']],()=>options().fillRule,v=>options().fillRule=v);track(rule.row,()=>rule.row.hidden=options().tool!=='fill');
  popupButton('Paint symmetry','symmetry',p=>{
   p.append(el('p','Mirror planes use native ship axes: X right, Y up, Z back.'));
   for(const axis of ['x','y','z']){
    const row=el('label','Mirror '+axis.toUpperCase()+' '),check=el('input'),origin=el('input');row.className='paint-setting';check.type='checkbox';check.setAttribute('aria-label','Mirror '+axis.toUpperCase());origin.type='number';origin.step='.1';origin.setAttribute('aria-label','Mirror '+axis.toUpperCase()+' plane');origin.title='Plane coordinate in native ship axes';row.append(check,origin);p.append(row);
    const eye=button(row,'Show '+axis.toUpperCase()+' symmetry plane','eye',()=>change(()=>{const o=options();o.planeVisible??={};o.planeVisible[axis]=o.planeVisible[axis]===false;}));track(eye,()=>{const visible=options().planeVisible?.[axis]!==false;eye.innerHTML=icon(visible?'eye':'eyeClosed');eye.setAttribute('aria-pressed',String(visible));eye.title=(visible?'Hide ':'Show ')+axis.toUpperCase()+' symmetry plane';});
    track(row,()=>{check.checked=options().symmetry[axis];origin.value=options().origin[axis];});check.onchange=()=>change(()=>options().symmetry[axis]=check.checked);origin.onchange=()=>change(()=>options().origin[axis]=Number(origin.value)||0);
   }
   const center=el('button','Use Ship Center');center.onclick=()=>change(()=>{if(scene.model)for(const a of ['x','y','z'])options().origin[a]=(scene.model.bounds.min[a]+scene.model.bounds.max[a])/2;});p.append(center);track(center,()=>setDisabled(center,!scene.model,'Import a ship first.'));
  });
  const undo=button(host,'Undo','undo',()=>actions.undo(false)),redo=button(host,'Redo','redo',()=>actions.undo(true));
  track(undo,()=>setDisabled(undo,!paintAvailability(scene).undo||!!scene.paintStroke||scene.paintBusy,'Undo','Undo'));
  track(redo,()=>setDisabled(redo,!paintAvailability(scene).redo||!!scene.paintStroke||scene.paintBusy,'Redo','Redo'));
  const palettesButton=popupButton('Paint palettes','color',p=>{
   const saved=select(p,'Active palette',()=>[['','Choose saved palette'],...readPalettes(localStorage,palette).map(v=>[v.name,v.name])],()=>activePalette(localStorage,palette)?.name||'',v=>activatePalette(localStorage,palette,v),'Active palette');
   track(saved.row,()=>saved.input.options[0].disabled=true);
   const recent=panel(p,'Recent Colors'),strip=el('div');strip.className='paint-recent';strip.setAttribute('aria-label','Recent paint colors');recent.append(strip);let previous='';
   track(strip,()=>{const ids=scene.recentPaintColors||[],key=ids.join('|');if(previous===key&&strip.children.length)return;previous=key;strip.replaceChildren();if(!ids.length){strip.textContent='Choose a color to start a recent palette.';return;}for(const id of ids){const c=palette.byId.get(id);if(!c)continue;const b=el('button');b.title=c.name+' · '+c.hex;b.setAttribute('aria-label','Recent '+c.name);b.style.background=c.hex;b.onclick=()=>change(()=>actions.color(id));strip.append(b);}});
   p.append(el('p','MMB click opens the active palette. MMB drag orbits.'));
  });

  const harmonyStrip=el('div');harmonyStrip.className='paint-attached-palette';harmonyStrip.setAttribute('aria-label','Active paint palette');host.append(harmonyStrip);let harmonyKey;
  track(harmonyStrip,()=>{const saved=activePalette(localStorage,palette),ids=saved?.colors||scene.paintHarmony||[brush().colorId],key=JSON.stringify([saved?.name,ids]);palettesButton.title=saved?'Paint palettes · '+saved.name:'Paint palettes';if(key===harmonyKey)return;harmonyKey=key;harmonyStrip.replaceChildren();for(const id of ids){const c=palette.byId.get(id);if(!c)continue;const b=el('button');b.style.background=c.hex;b.title=c.name;b.setAttribute('aria-label','Palette '+c.name);b.onclick=()=>change(()=>actions.color(id));harmonyStrip.append(b);}});
  function modelColors(parent,all){const strip=el('div');strip.className=all?'paint-model-colors':'paint-attached-palette';parent.append(strip);let previous;
   track(strip,()=>{const colors=modelPalette(scene);if(colors===previous)return;previous=colors;strip.replaceChildren();if(!colors.length&&all)strip.textContent='Import a model to see its colors.';for(const item of all?colors:colors.slice(0,4)){const c=palette.colors.find(c=>c.hex===item.hex),b=el('button'),chip=el('span');chip.className='paint-current-swatch';chip.style.background=item.hex;const label=`${c?.name||item.hex} · ${item.count} blocks`;b.title=label;b.setAttribute('aria-label','Model '+label);if(all)b.append(chip,el('span',label));else b.style.background=item.hex;setDisabled(b,!c,'Imported RGB is not in the named Avorion palette.',label);b.onclick=()=>change(()=>actions.color(c.id));strip.append(b);}});
  }
  palettesButton.classList.add('paint-palette-group-start');
  const modelButton=popupButton('Model Palette','modelPalette',p=>modelColors(p,true));modelButton.classList.add('paint-palette-group-start');modelColors(host,false);

 }
 function sync(){
  palette=actions.palette();if(!palette){host.textContent='Loading paint palette…';return;}
  scene.paintBrush??={colorId:'Dodger Blue',channel:'color',strength:'preserve'};
  if(!built){built=true;build();}
  for(let i=updates.length-1;i>=0;i--){const entry=updates[i];if(entry.node.isConnected||host.contains(entry.node)||shelf.contains(entry.node))entry.fn();else updates.splice(i,1);}
  status.textContent=scene.paintBusy?'Calculating targets… Escape cancels.':scene.paintSample||scene.paintMessage||'LMB paint · MMB palette / drag orbit · hold RMB magnifier';status.title=status.textContent;
 }
 sync();return {sync,dispose(){closeViewportPopover();host.remove();shelf.remove();status.remove();}};
}
