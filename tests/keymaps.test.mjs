import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYMAPS, KEYMAP_BY_ID, validBinding, matchesBinding, keymapConflict, modifierActive } from '../src/keymaps.js';
import { FACTORY_PREFERENCES, parsePreferences, editorTheme, createPreferencesStore } from '../src/preferences.js';
import { navigationKey, dragMode, alignView } from '../src/navigation.js';
import { cubeFaces } from '../src/view-cube.js';
import { area } from '../src/layout.js';

test('every keymap default validates and exact modifiers prevent accidental actions',()=>{
  for(const item of KEYMAPS)assert.equal(validBinding(item.binding,item.kind),true,item.id);
  for(const invalid of ['Ctrl+Ctrl+KeyA','Shift+Ctrl+KeyA','garbage','Ctrl+','Mouse9'])assert.equal(validBinding(invalid),false);
  assert.equal(matchesBinding('maximize',{code:'Space',ctrlKey:true}),true);
  assert.equal(matchesBinding('maximize',{code:'Space',ctrlKey:true,altKey:true}),false);
});
test('remapped navigation disables old shortcut and retains custom rotation angle',()=>{
  const p={...FACTORY_PREFERENCES,keymap_orbitRight:'Ctrl+KeyJ',rotationAngle:30};
  assert.equal(navigationKey({code:'Numpad6'},p),null);
  const command=navigationKey({code:'KeyJ',ctrlKey:true},p);
  assert.equal(command.action,'orbit');assert.ok(Math.abs(command.x+Math.PI/6/.008)<1e-9);
  assert.equal(navigationKey({code:'KeyJ'},p),null);
  p.keymap_orbitRight='';assert.equal(navigationKey({code:'KeyJ',ctrlKey:true},p),null);
});
test('remapped pointer bindings support right mouse and exact modifier matching',()=>{
  const p={...FACTORY_PREFERENCES,keymap_orbitDrag:'Shift+Mouse2',keymap_panDrag:'Mouse1'};
  assert.equal(dragMode({button:2,shiftKey:true},'select',p),'orbit');
  assert.equal(dragMode({button:1},'select',p),'pan');
  assert.equal(dragMode({button:2},'select',p),null);
  assert.equal(modifierActive('snapOrbit',{ctrlKey:true},{keymap_snapOrbit:'Ctrl'}),true);
});
test('conflicts respect context and global shortcuts',()=>{
  assert.equal(keymapConflict('front','Ctrl+Space',FACTORY_PREFERENCES).id,'maximize');
  assert.equal(keymapConflict('front','Numpad3',FACTORY_PREFERENCES).id,'right');
  assert.equal(keymapConflict('front','Ctrl+KeyF',FACTORY_PREFERENCES),undefined);
  assert.equal(keymapConflict('front','',FACTORY_PREFERENCES),null);
});
test('old saved preferences migrate with defaults; edited bindings and colors round-trip',()=>{
  const migrated=parsePreferences(JSON.stringify({version:1,theme:'graphite'}));
  assert.equal(migrated.navigationWidget,'gizmo');assert.equal(migrated.keymap_front,'Numpad1');
  let raw=null;const storage={getItem:()=>raw,setItem:(_,value)=>raw=value};const store=createPreferencesStore(storage);
  store.set('keymap_front','KeyF');store.set('outlinerCustomColors',true);store.set('outlinerBackground','#123456');store.set('navigationWidget','cube');
  const restored=createPreferencesStore(storage).value;
  assert.equal(restored.keymap_front,'KeyF');assert.equal(restored.navigationWidget,'cube');assert.equal(editorTheme(restored,'outliner').background,'#123456');
});
test('editor overrides do not bleed into other editors or erase preset selection',()=>{
  const p={...FACTORY_PREFERENCES,theme:'graphite',viewportCustomColors:true,viewportBackground:'#112233',viewportAccent:'#abcdef'};
  assert.equal(editorTheme(p,'viewport').background,'#112233');assert.equal(editorTheme(p,'viewport').accent,'#abcdef');
  assert.equal(editorTheme(p,'outliner').background,'#272e38');
  p.viewportCustomColors=false;assert.equal(editorTheme(p,'viewport').background,'#2b3440');
});
test('view cube exposes the correct outward face for all six cardinal views',()=>{
  const view=area().view;
  for(const name of ['front','back','left','right','top','bottom']){
    alignView(view,name);const faces=cubeFaces(view);assert.equal(faces.length,1);assert.equal(faces[0].name,name);
    assert.equal(faces[0].points.every(point=>point.every(Number.isFinite)),true);
  }
  view.yaw=.6;view.pitch=.4;assert.equal(cubeFaces(view).length,3);
});
test('workspace switching avoids browser-reserved tab shortcuts',()=>{
  assert.equal(KEYMAP_BY_ID.previousWorkspace.binding,'Ctrl+Alt+PageUp');
  assert.equal(KEYMAP_BY_ID.nextWorkspace.binding,'Ctrl+Alt+PageDown');
});
