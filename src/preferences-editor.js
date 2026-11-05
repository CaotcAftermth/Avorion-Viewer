import {enhanceColorCells} from './color-cells.js';
import {mountCursorTargets} from './cursor-preferences.js';
import { setDisabled } from './control-state.js';
import { mountAssetLibrary } from './asset-library.js';
import { wireTabs, wirePanels } from './editor-panels.js';
import { eventBinding, validBinding, shortcutLabel, keymapConflict, matchesBinding } from './keymaps.js';
import { APP_SECTIONS, matchingPanels } from './preferences.js';
import { t, tf, onLanguageChange } from './i18n.js';

const HEX = /^#?([0-9a-f]{6})$/i;
const EDITOR_COLOR = /^(.+)(Background|Header|Text|Accent)$/;

export function mountPreferences(host, store, editorState = {}, assets = {}, options = {}) {
  const sections = options.sections || APP_SECTIONS;
  let category = sections.some(section => section.id === editorState.category) ? editorState.category : sections[0].id, query = options.searchbar===false ? '' : editorState.query || '';
  host.classList.add('preferences-editor');host.classList.toggle('compact', !!options.compact);
  let search, nav, content, status, autoSave, save;
  const controls = new Map(), hexInputs = new Map();
  function shell() {
    // Hosts with their own search (the Properties editor) leave out the search bar.
    host.innerHTML = `${options.searchbar===false?'':`<div class="preferences-searchbar"><span>${t('Preferences')}</span><input type="search" aria-label="${t('Search preferences')}" placeholder="${t('Search preferences')}" maxlength="150"></div>`}
    <div class="preferences-main"><nav class="preferences-categories" aria-label="${t('Preference categories')}"></nav><div class="preferences-content" tabindex="-1"></div></div>
    <footer class="preferences-footer"><details class="preferences-management"><summary aria-label="${t('Preferences options')}" title="${t('Preferences options')}">☰</summary><div class="preferences-actions">
      <label><input type="checkbox" data-auto-save> ${t('Auto-Save Preferences')}</label><hr>
      <button type="button" data-revert>${t('Revert to Saved Preferences')}</button>
      <button type="button" data-factory>${t('Load Factory Preferences')}</button>
    </div></details><button type="button" class="preferences-save" data-save>${t('Save Preferences')}</button><span class="preferences-save-status" role="status"></span></footer>`;
    search = host.querySelector('input[type=search]'); nav = host.querySelector('nav');
    content = host.querySelector('.preferences-content'); status = host.querySelector('[role=status]');
    autoSave = host.querySelector('[data-auto-save]'); save = host.querySelector('[data-save]');
    if(search){search.value = query;
    search.addEventListener('input',()=>{query=search.value;renderContent();});}
    autoSave.onchange=()=>store.set('autoSave',autoSave.checked);
    save.onclick=()=>store.save();
    host.querySelector('[data-revert]').onclick=()=>{store.revert();host.querySelector('details.preferences-management').open=false;};
    host.querySelector('[data-factory]').onclick=()=>{store.factory();host.querySelector('details.preferences-management').open=false;};
  }

  let cursorUpdates=[];
  function sync() {
    for(const update of cursorUpdates)update();
    host.querySelectorAll('[data-preference-tip]').forEach(label=>{if(store.value.showTooltips)label.setAttribute('title',label.dataset.preferenceTip);else label.removeAttribute('title');});
    for (const [key, input] of controls) {
      if(input.dataset.binding){if(input.dataset.recording!=='true')input.textContent=shortcutLabel(store.value[key]);continue;}
      if (input.type === 'checkbox') input.checked = store.value[key];
      else input.value = store.value[key];
    }
    for (const [key, input] of hexInputs) if (document.activeElement !== input) input.value = store.value[key].toUpperCase();
    // Per-editor colors only apply with that editor's Custom Colors enabled.
    for (const [key, input] of controls) {
      const match = EDITOR_COLOR.exec(key);
      if (match && Object.hasOwn(store.value, match[1] + 'CustomColors')) input.closest('.preference-row')?.classList.toggle('is-inactive', !store.value[match[1] + 'CustomColors']);
    }
    host.querySelectorAll('[data-shader-slider]').forEach(slider=>{
      slider.value=store.value[slider.dataset.shaderSlider];
      slider.closest('.shader-value-row').style.setProperty('--value-fill',`${100*(Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min))}%`);
    });
    enhanceColorCells(host);
    autoSave.checked = store.value.autoSave;
    save.hidden = store.value.autoSave && !store.error;
    setDisabled(save,!store.dirty&&!store.error,t('No unsaved preference changes. Change a preference to enable saving.'),t('Save Preferences'));
    status.textContent = t(store.error) || t(store.dirty ? 'Unsaved changes' : 'Preferences saved');
    status.classList.toggle('has-error', !!store.error);
    status.classList.toggle('is-dirty', store.dirty);
    setDisabled(host.querySelector('[data-revert]'),!store.dirty&&!store.error,t('Preferences already match the saved values. Change a preference to enable reverting.'),t('Revert to Saved Preferences'));
  }

  function renderContent() {
    cursorUpdates=[];controls.clear();hexInputs.clear();content.replaceChildren();nav.replaceChildren();
    const searching = !!query.trim();
    for (const section of sections) {
      const panels = matchingPanels(section, query);
      const tab = document.createElement('button');tab.type='button';tab.textContent=t(section.label);
      tab.className = `${section.id === category && !searching ? 'active' : ''} ${searching && panels.length ? 'search-match' : ''}`;
      tab.setAttribute('aria-pressed', String(section.id === category && !searching));
      tab.addEventListener('click', () => { category=section.id;query='';if(search)search.value='';renderContent();nav.querySelector('.active')?.focus(); });
      nav.append(tab);
      if ((!searching && section.id !== category) || !panels.length) continue;
      const heading=document.createElement('h2');heading.textContent=t(section.label);content.append(heading);if(section.id==='keymap'){heading.dataset.preferenceTip=t('Click a binding to record keys, a mouse button, or the wheel. Escape cancels recording. Clear unassigns; Reset restores the default. Text editing and standard control navigation keep their native keys. Input emulation takes priority when enabled.');heading.dataset.uiTooltip=heading.dataset.preferenceTip;}
      for (const panel of panels) {
        const details=document.createElement('details');details.className='preferences-panel';details.open=true;
        const summary=document.createElement('summary');summary.textContent=t(panel.label);details.append(summary);
        // The Asset Library panel is the folder list itself.
        if(section.id==='assets'){const library=document.createElement('div');details.append(library);mountAssetLibrary(library,assets);}
        if(section.id==='world'){
          const actions=document.createElement('div');actions.className='preference-row';
          const next=document.createElement('button');next.type='button';next.textContent=t('New Sky');next.onclick=()=>store.set('worldSeed',Math.floor(Math.random()*2147483648));actions.append(next);
          if(assets.showWorld){const show=document.createElement('button');show.type='button';show.textContent=t('Show World in Viewports');show.onclick=()=>{store.set('worldEnabled',true);assets.showWorld();};actions.append(show);}
          details.append(actions);
        }
        const shader=false;
        if(shader){
          details.classList.add('shader-node');
          summary.textContent=panel.label==='Surface'?'Surface Shader':panel.label==='Lighting'?'Studio Lighting':panel.label;
          const output=document.createElement('div');output.className='shader-node-output';output.textContent=panel.label==='Surface'?'Surface':'Light';output.setAttribute('aria-hidden','true');details.append(output);
        }
        if(panel.cursorTargets){cursorUpdates.push(mountCursorTargets(details,store));content.append(details);continue;}
        for (const field of panel.fields) {
          const row=document.createElement('div');row.className=`preference-row ${field.type==='checkbox'?'boolean-row':''}`;
          const label=document.createElement('span');label.className='preference-label';const fieldLabel=t(field.label),fieldTip=t(field.description);label.textContent=fieldLabel;label.dataset.preferenceTip=fieldTip;label.dataset.uiTooltip=fieldTip;
          if(field.type==='binding'){
            const id=field.key.slice(7),control=document.createElement('span');control.className='preference-control keymap-control';
            const input=document.createElement(field.kind==='modifier'?'select':'button');if(field.kind!=='modifier'){input.type='button';input.dataset.binding=id;}input.setAttribute('aria-label',tf('Change {0}',fieldLabel));input.setAttribute('aria-description',fieldTip);input.className='keymap-binding';
            const message=document.createElement('p');message.className='preference-description keymap-message';message.setAttribute('role','status');
            const assign=value=>{const conflict=keymapConflict(id,value,store.value);if(conflict){message.textContent=tf('Already assigned to {0}. Clear that binding first.',t(conflict.label));return false;}store.set(field.key,value);message.textContent='';return true;};
            if(field.kind==='modifier'){
              for(const value of ['','Ctrl','Shift','Alt','Meta']){const option=document.createElement('option');option.value=value;option.textContent=value||t('None');input.append(option);}input.onchange=()=>assign(input.value);
            }else{
              const stop=()=>{input.dataset.recording='false';input.textContent=shortcutLabel(store.value[field.key]);};
              input.onclick=()=>{if(input.dataset.recording==='true')return;input.dataset.recording='true';input.textContent=t(field.kind==='key'?'Press shortcut…':field.kind==='mouse'?'Press mouse button…':'Scroll wheel…');message.textContent=t('Escape cancels recording.');};
              const capture=(event,code)=>{event.preventDefault();event.stopPropagation();const value=eventBinding(event,code);if(validBinding(value,field.kind)&&assign(value))stop();};
              input.addEventListener('keydown',event=>{event.stopPropagation();if(input.dataset.recording!=='true')return;if(event.code==='Escape'){event.preventDefault();stop();message.textContent='';return;}if(field.kind==='key')capture(event,event.code);});
              input.addEventListener('pointerdown',event=>{if(input.dataset.recording==='true'&&field.kind==='mouse'){capture(event,'Mouse'+event.button);input.dataset.ignoreClick='true';}});
              input.addEventListener('click',event=>{if(input.dataset.ignoreClick==='true'){input.dataset.ignoreClick='false';event.stopImmediatePropagation();}},true);
              input.addEventListener('contextmenu',event=>event.preventDefault());
              input.addEventListener('wheel',event=>{if(input.dataset.recording==='true'&&field.kind==='wheel')capture(event,'Wheel');},{passive:false});
              input.addEventListener('blur',()=>{stop();});
            }
            const clear=document.createElement('button');clear.type='button';clear.textContent=t('Clear');clear.setAttribute('aria-label',tf('Clear {0} binding',fieldLabel));clear.onclick=()=>assign('');
            const reset=document.createElement('button');reset.type='button';reset.textContent=t('Reset');reset.setAttribute('aria-label',tf('Reset {0} binding',fieldLabel));reset.onclick=()=>assign(field.default);
            control.append(input,clear,reset);row.append(label,control);details.append(row,message);controls.set(field.key,input);continue;
          }
          const input=document.createElement(field.type==='paths'?'textarea':field.type==='select'?'select':'input');input.setAttribute('aria-label',fieldLabel);input.setAttribute('aria-description',fieldTip);
          if (field.type==='select') {
            for(const [value,text] of field.options){const option=document.createElement('option');option.value=value;option.textContent=t(text);if(field.key==='inputStyle'&&value==='trackpad')option.disabled=true;input.append(option);}
          } else if(field.type==='paths'){input.rows=3;input.maxLength=16000;input.placeholder=t('One folder path per line');} else input.type=field.type;
          if(field.type==='number'){input.min=field.min;input.max=field.max;input.step=field.step;}
          input.dataset.preference=field.key;
          if(field.key==='trackpadNavigation'){input.disabled=true;input.title='Trackpad support is being fixed.';}
          const update=()=>{
            const value=field.type==='checkbox'?input.checked:field.type==='number'||field.numeric?Number(input.value):input.value;
            if(!store.set(field.key,value))sync();
          };input.addEventListener('change',update);if(field.type==='color')input.addEventListener('input',update);
          const control=document.createElement('span');control.className='preference-control';control.append(input);
          if(shader){
            row.classList.add('shader-input-row');
            row.dataset.socket=field.type==='color'?'color':'value';
            if(field.type==='number'){
              row.classList.add('shader-value-row');
              row.dataset.preferenceTip=field.description;row.dataset.uiTooltip=field.description;
              const slider=document.createElement('input');slider.type='range';slider.min=field.min;slider.max=field.max;slider.step=field.step;
              slider.className='shader-slider';slider.dataset.shaderSlider=field.key;
              slider.setAttribute('aria-label',tf('{0} slider',fieldLabel));slider.setAttribute('aria-description',fieldTip);
              slider.addEventListener('input',()=>store.set(field.key,Number(slider.value)));
              row.append(slider);
            }
          }
          if(field.type==='number'&&Number.isFinite(field.min)&&Number.isFinite(field.max)){
            control.classList.add('shader-value-row','shader-standard-control');
            const slider=document.createElement('input');slider.type='range';slider.min=field.min;slider.max=field.max;slider.step=field.step;slider.className='shader-slider';slider.dataset.shaderSlider=field.key;slider.setAttribute('aria-label',tf('{0} slider',fieldLabel));slider.addEventListener('input',()=>store.set(field.key,Number(slider.value)));control.prepend(slider);
          }
          if(field.type==='color'){
            // Hex readout: dark swatches are hard to tell apart, and typing a value is faster than the picker.
            const hex=document.createElement('input');hex.type='text';hex.className='preference-hex';hex.maxLength=7;hex.spellcheck=false;hex.autocomplete='off';
            hex.setAttribute('aria-label',tf('{0} hex value',fieldLabel));hex.placeholder='#RRGGBB';
            hex.addEventListener('change',()=>{const match=HEX.exec(hex.value.trim());if(!match||!store.set(field.key,'#'+match[1].toLowerCase()))hex.value=store.value[field.key].toUpperCase();});
            hex.addEventListener('keydown',event=>{if(event.key==='Enter')hex.blur();});
            control.classList.add('color-control');control.append(hex);hexInputs.set(field.key,hex);
          }
          if(field.suffix){const suffix=document.createElement('span');suffix.className='preference-suffix';suffix.textContent=t(field.suffix);control.append(suffix);}
          row.append(label,control);details.append(row);
          controls.set(field.key,input);
        }
        content.append(details);
      }

    }
    if(!content.childElementCount){const empty=document.createElement('p');empty.className='preferences-empty';empty.textContent=tf('No preferences match “{0}”.',query)+(options.sections?'':' '+t('World and Shaders settings are in the Properties editor; asset folders are in File > Asset folders.'));content.append(empty);}
    wireTabs(nav,content);wirePanels(content,editorState,category+':',searching);
    editorState.category=category;editorState.query=query;content.scrollTop=0;sync();
  }
  const keys=event=>{
    if(search&&(matchesBinding('searchPreferences',event,store.value)||matchesBinding('clearSearch',event,store.value))){
      event.preventDefault();event.stopPropagation();
      if(matchesBinding('clearSearch',event,store.value)){query='';search.value='';renderContent();}search.focus();search.select();
    }
    if(event.key==='Escape'&&host.querySelector('.preferences-management').open){event.preventDefault();event.stopPropagation();host.querySelector('.preferences-management').open=false;}
  };
  host.addEventListener('keydown',keys);
  const unsubscribe=store.subscribe(sync);
  const unlisten=onLanguageChange(()=>{shell();renderContent();});
  shell();renderContent();
  return { focusSearch(clear=false){if(!search)return;if(clear){query='';search.value='';renderContent();}search.focus();search.select();}, dispose(){unsubscribe();unlisten();host.removeEventListener('keydown',keys);} };
}
