import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferencesStore, FACTORY_PREFERENCES, PREFERENCES_KEY, PREFERENCE_SECTIONS, FIELDS, parsePreferences, validPreference, matchingPanels } from '../src/preferences.js';
import { area, defaults, leaves, minimum, validateState } from '../src/layout.js';
import { alignView, orbit, navigationKey, dragMode, viewLabel } from '../src/navigation.js';

function memoryStorage(initial={}) {
  const values=new Map(Object.entries(initial));
  return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}
test('defaults validate and every exposed preference has a typed value',()=>{
  assert.deepEqual(parsePreferences(JSON.stringify(FACTORY_PREFERENCES)),FACTORY_PREFERENCES);
  for(const [key,field] of Object.entries(FIELDS))assert.equal(validPreference(key,field.default),true,key);
  assert.equal(validPreference('__proto__',true),false);
});
test('auto-save persists edits and a new session restores them',()=>{
  const storage=memoryStorage(),store=createPreferencesStore(storage);
  store.set('theme','graphite');store.set('rotationAngle',30);
  assert.equal(store.dirty,false);
  const reloaded=createPreferencesStore(storage);
  assert.equal(reloaded.value.theme,'graphite');assert.equal(reloaded.value.rotationAngle,30);
});
test('manual saving previews changes without changing the persisted snapshot',()=>{
  const storage=memoryStorage(),store=createPreferencesStore(storage);
  store.set('theme','graphite');store.set('autoSave',false);const saved=storage.getItem(PREFERENCES_KEY);
  store.set('theme','contrast');store.set('orbitSensitivity',2);
  assert.equal(store.value.theme,'contrast');assert.equal(store.dirty,true);
  assert.equal(storage.getItem(PREFERENCES_KEY),saved);
  assert.equal(createPreferencesStore(storage).value.theme,'graphite');
  store.save();assert.equal(createPreferencesStore(storage).value.theme,'contrast');assert.equal(store.dirty,false);
});
test('revert restores settings and save policy without touching layout storage',()=>{
  const storage=memoryStorage({'avorion-viewer.window-system.v1':'existing-layout'}),store=createPreferencesStore(storage);
  store.set('theme','graphite');store.set('autoSave',false);store.set('theme','contrast');store.revert();
  assert.equal(store.value.theme,'graphite');assert.equal(store.value.autoSave,false);assert.equal(store.dirty,false);
  assert.equal(storage.values.get('avorion-viewer.window-system.v1'),'existing-layout');
});
test('factory reset disables auto-save for the session and preserves the saved configuration',()=>{
  const storage=memoryStorage(),store=createPreferencesStore(storage);store.set('theme','graphite');
  const saved=storage.getItem(PREFERENCES_KEY);store.factory();store.set('showStats',true);
  assert.equal(store.value.theme,'blender');assert.equal(store.value.autoSave,false);
  assert.equal(storage.getItem(PREFERENCES_KEY),saved);
  assert.equal(createPreferencesStore(storage).value.theme,'graphite');
  store.revert();assert.equal(store.value.autoSave,true);assert.equal(store.value.theme,'graphite');
});
test('saving factory preferences is explicit and commits manual-save mode',()=>{
  const storage=memoryStorage(),store=createPreferencesStore(storage);store.set('theme','contrast');store.factory();store.save();
  assert.deepEqual(createPreferencesStore(storage).value,{...FACTORY_PREFERENCES,autoSave:false});
});
test('re-enabling auto-save commits pending values',()=>{
  const storage=memoryStorage(),store=createPreferencesStore(storage);store.set('autoSave',false);store.set('theme','contrast');store.set('autoSave',true);
  assert.equal(store.dirty,false);assert.equal(createPreferencesStore(storage).value.theme,'contrast');
});
test('storage write failure preserves the saved snapshot and permits retry',()=>{
  let blocked=false;const storage=memoryStorage();const set=storage.setItem;
  storage.setItem=(key,value)=>{if(blocked)throw new Error('Quota exceeded');set(key,value);};
  const store=createPreferencesStore(storage);store.set('theme','graphite');blocked=true;store.set('theme','contrast');
  assert.ok(store.error);assert.equal(store.dirty,true);assert.equal(store.value.theme,'contrast');
  store.revert();assert.equal(store.value.theme,'graphite');
  store.set('theme','contrast');blocked=false;assert.equal(store.save(),true);assert.equal(store.error,'');assert.equal(store.dirty,false);
});
test('invalid saved settings fall back without silently overwriting storage',()=>{
  for(const raw of ['not-json','null','[]','{"version":2}','{"version":1,"rotationAngle":500}','{"version":1,"theme":"missing"}','{"version":1,"accent":"red;display:none"}']){
    const storage=memoryStorage({[PREFERENCES_KEY]:raw}),store=createPreferencesStore(storage);
    assert.deepEqual(store.value,FACTORY_PREFERENCES);assert.ok(store.error);assert.equal(storage.getItem(PREFERENCES_KEY),raw);
  }
});
test('settings added later get defaults; unknown keys never enter the runtime state',()=>{
  const result=parsePreferences('{"version":1,"theme":"graphite","unexpected":"x"}');
  assert.equal(result.theme,'graphite');assert.equal(result.orbitSensitivity,1);assert.equal(Object.hasOwn(result,'unexpected'),false);
});
test('search matches categories, panels, and setting descriptions',()=>{
  const input=PREFERENCE_SECTIONS.find(s=>s.id==='input');
  assert.deepEqual(matchingPanels(input,'mouse').map(p=>p.label),['Input Style','Mouse']);
  assert.equal(matchingPanels(input,'numpad').length,2);
  assert.equal(matchingPanels(input,'input').length,3);
  assert.equal(matchingPanels(input,'unknown thing').length,0);
});
test('preferences editor survives workspace serialization and reserves usable space',()=>{
  const state=defaults();leaves(state.workspaces[0].root)[0].editor='preferences';
  assert.equal(validateState(JSON.parse(JSON.stringify(state))),true);assert.deepEqual(minimum(area('preferences')),{width:300,height:250});
});
test('input preferences affect emulated mouse and numpad shortcuts',()=>{
  const event={button:0,altKey:true,shiftKey:true};
  assert.equal(dragMode(event,'select',{emulate3Button:false}),null);
  assert.equal(dragMode(event,'select',{emulate3Button:true}),'pan');
  assert.equal(navigationKey({code:'Digit1'},{emulateNumpad:false}),null);
  assert.deepEqual(navigationKey({code:'Digit1'},{emulateNumpad:true}),{action:'align',value:'front'});
});
test('input styles set the bundled mouse, numpad and trackpad options',()=>{
  const store=createPreferencesStore(memoryStorage());
  assert.equal(store.set('inputStyle','trackpad'),true);
  assert.deepEqual([store.value.emulate3Button,store.value.emulateNumpad,store.value.trackpadNavigation],[true,true,true]);
  store.set('inputStyle','laptop');assert.deepEqual([store.value.emulate3Button,store.value.emulateNumpad,store.value.trackpadNavigation],[true,true,false]);
  store.set('emulateNumpad',false);assert.equal(store.value.inputStyle,'laptop');assert.equal(store.value.emulateNumpad,false);
  store.set('inputStyle','blender');assert.deepEqual([store.value.emulate3Button,store.value.emulateNumpad,store.value.trackpadNavigation],[false,false,false]);
  assert.equal(store.set('inputStyle','gamepad'),false);
});
test('navigation settings affect mouse sensitivity, rotation steps, and auto perspective',()=>{
  const view=area().view;alignView(view,'front');orbit(view,10,0,{orbitSensitivity:2,autoPerspective:true});
  assert.ok(Math.abs(view.yaw+.16)<1e-8);assert.equal(viewLabel(view),'User Perspective');
  const command=navigationKey({code:'Numpad6'},{rotationAngle:30});
  alignView(view,'front');orbit(view,command.x,command.y);assert.ok(Math.abs(view.yaw-Math.PI/6)<1e-8);
});
test('subscriptions can be disposed without leaking editor updates',()=>{
  const store=createPreferencesStore(memoryStorage());let updates=0;const unsubscribe=store.subscribe(()=>updates++);
  store.set('showStats',true);unsubscribe();store.set('showStats',false);assert.equal(updates,1);
});

test('typed asset paths are no longer preferences; folders are remembered as handles instead',()=>{
  const storage=memoryStorage(),store=createPreferencesStore(storage);
  assert.equal(store.set('assetTexturePaths','C:/Avorion/textures'),false);
  assert.equal('assetModelPaths' in store.value,false);
});

test('clipping rejects reversed planes and viewport effects persist',()=>{
  const storage=memoryStorage(),store=createPreferencesStore(storage);
  assert.equal(store.set('clipStart',store.value.clipEnd),false);
  assert.equal(store.set('clipEnd',.001),false);
  store.set('clipStart',.1);store.set('clipEnd',5000);store.set('vignetteEnabled',true);store.set('vignetteStrength',.6);
  const restored=createPreferencesStore(storage).value;assert.equal(restored.clipEnd,5000);assert.equal(restored.vignetteStrength,.6);assert.equal(restored.vignetteEnabled,true);
});
