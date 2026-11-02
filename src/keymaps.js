const key = (id,label,scope,binding,extra={}) => ({id,label,scope,binding,...extra});

export const KEYMAPS = [

  key('undoPaint','Undo Paint','Color Editor','Ctrl+KeyZ'),

  key('redoPaint','Redo Paint','Color Editor','Ctrl+Shift+KeyZ'),

  key('preferences','Open Preferences','Window','Ctrl+Comma'),

  key('maximize','Maximize Area','Window','Ctrl+Space'),

  key('focus','Focus Mode','Window','Ctrl+Alt+Space'),

  key('saveLayout','Save Workspace Layout','Window','Ctrl+KeyS'),

  key('previousWorkspace','Previous Workspace','Window','Ctrl+Alt+PageUp'),

  key('nextWorkspace','Next Workspace','Window','Ctrl+Alt+PageDown'),

  key('cancel','Cancel / Restore Area','Window','Escape'),

  key('searchPreferences','Search Preferences','Preferences','Ctrl+KeyF'),

  key('clearSearch','Clear Preference Search','Preferences','Alt+KeyF'),

  key('toggleMode','Cycle Object / Paint / Socket Mode','3D Viewport','Tab'),

  key('toolbar','Toggle Toolbar','3D Viewport','KeyT'),

  key('sidebar','Toggle Sidebar','3D Viewport','KeyN'),

  key('selectAll','Select All','3D Viewport','KeyA'),

  key('deselectAll','Deselect All','3D Viewport','Alt+KeyA'),

  ...[['front','Numpad1'],['back','Ctrl+Numpad1'],['right','Numpad3'],['left','Ctrl+Numpad3'],['top','Numpad7'],['bottom','Ctrl+Numpad7']].map(([name,binding])=>key(name,`${name[0].toUpperCase()+name.slice(1)} View`,'3D Viewport',binding,{command:{action:'align',value:name}})),

  ...[['Left','Numpad4',1,0],['Right','Numpad6',-1,0],['Up','Numpad8',0,1],['Down','Numpad2',0,-1]].flatMap(([name,binding,x,y])=>[

    key(`orbit${name}`,`Orbit ${name}`,'3D Viewport',binding,{command:{action:'orbit',x,y}}),

    key(`pan${name}`,`Pan ${name}`,'3D Viewport',`Ctrl+${binding}`,{command:{action:'pan',x:x*40,y:y*40}})

  ]),

  key('rollLeft','Roll Left','3D Viewport','Shift+Numpad4',{command:{action:'roll',value:-1}}),

  key('rollRight','Roll Right','3D Viewport','Shift+Numpad6',{command:{action:'roll',value:1}}),

  ...[['projection','Toggle Projection','Numpad5'],['opposite','Opposite View','Numpad9'],['frame','Frame All','Home'],['selected','Frame Selected','NumpadDecimal'],['region','Zoom Region','Shift+KeyB']].map(([id,label,binding])=>key(id,label,'3D Viewport',binding,{command:{action:id}})),

  key('zoomIn','Zoom In','3D Viewport','NumpadAdd',{command:{action:'zoom',value:1.2}}),

  key('zoomOut','Zoom Out','3D Viewport','NumpadSubtract',{command:{action:'zoom',value:1/1.2}}),

  ...[['orbitDrag','Orbit Drag','Mouse1'],['panDrag','Pan Drag','Shift+Mouse1'],['zoomDrag','Zoom Drag','Ctrl+Mouse1'],['dollyDrag','Dolly Drag','Ctrl+Shift+Mouse1'],['selectClick','Select / Active Tool','Mouse0']].map(([id,label,binding])=>key(id,label,'Mouse',binding,{kind:'mouse'})),

  key('wheelZoom','Wheel Zoom','Mouse','Wheel',{kind:'wheel'}),

  key('wheelPan','Wheel Pan','Mouse','Shift+Wheel',{kind:'wheel'}),

  key('regionIn','Region Zoom In','Navigation Operation','Mouse0',{kind:'mouse'}),

  key('regionOut','Region Zoom Out','Navigation Operation','Mouse1',{kind:'mouse'}),

  key('cancelMouse','Cancel Navigation','Navigation Operation','Mouse2',{kind:'mouse'}),

  key('snapOrbit','Snap Orbit on Release','Modifiers','Alt',{kind:'modifier'}),

  key('snapResize','Snap Area Resize','Modifiers','Ctrl',{kind:'modifier'}),

  key('swapEditors','Swap Editors on Corner Drag','Modifiers','Ctrl',{kind:'modifier'}),

  key('largeResize','Large Keyboard Resize Step','Modifiers','Shift',{kind:'modifier'}),

  key('splitDirection','Change Split Direction','Layout','Tab'),

  ...[['Left','ArrowLeft'],['Right','ArrowRight'],['Up','ArrowUp'],['Down','ArrowDown']].map(([name,binding])=>key(`resize${name}`,`Resize ${name}`,'Layout',binding))

];

export const KEYMAP_BY_ID=Object.fromEntries(KEYMAPS.map(item=>[item.id,item]));

const codes=/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|NumpadAdd|NumpadSubtract|NumpadDecimal|NumpadMultiply|NumpadDivide|NumpadEnter|F([1-9]|1[0-9]|2[0-4])|Arrow(Left|Right|Up|Down)|PageUp|PageDown|Home|End|Insert|Delete|Backspace|Tab|Enter|Escape|Space|Comma|Period|Slash|Backslash|Semicolon|Quote|BracketLeft|BracketRight|Backquote|Minus|Equal)$/;

export function validBinding(value,kind='key') {

  if(typeof value!=='string')return false;

  if(value==='')return true;

  if(kind==='modifier')return ['Ctrl','Shift','Alt','Meta'].includes(value);

  const parts=value.split('+'),code=parts.pop();

  const mods=['Ctrl','Shift','Alt','Meta'].filter(mod=>parts.includes(mod));

  if(parts.join('+')!==mods.join('+'))return false;

  return kind==='mouse'?/^Mouse[012]$/.test(code):kind==='wheel'?code==='Wheel':codes.test(code);

}

export function bindingFor(id,preferences={}) {return preferences[`keymap_${id}`] ?? KEYMAP_BY_ID[id].binding;}

export function eventBinding(event,code=event.code) {return [...(event.ctrlKey?['Ctrl']:[]),...(event.shiftKey?['Shift']:[]),...(event.altKey?['Alt']:[]),...(event.metaKey?['Meta']:[]),code].join('+');}

export function matchesBinding(id,event,preferences={},code=event.code) {

  if(preferences.emulateNumpad&&KEYMAP_BY_ID[id].scope==='3D Viewport'&&/^Digit[0-9]$/.test(code))code=code.replace('Digit','Numpad');

  return !!bindingFor(id,preferences)&&bindingFor(id,preferences)===eventBinding(event,code);

}

export function modifierActive(id,event,preferences={}) {return !!event[{Ctrl:'ctrlKey',Shift:'shiftKey',Alt:'altKey',Meta:'metaKey'}[bindingFor(id,preferences)]];}

export function shortcutLabel(binding) {return binding?binding.split('+').map(part=>({Mouse0:'LMB',Mouse1:'MMB',Mouse2:'RMB',NumpadAdd:'Numpad +',NumpadSubtract:'Numpad −',NumpadDecimal:'Numpad .',Comma:',',Space:'Space'}[part]||part.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Numpad '))).join(' + '):'Unassigned';}

export function keymapConflict(id,binding,preferences) {

  if(!binding||KEYMAP_BY_ID[id].kind==='modifier')return null;

  const scope=KEYMAP_BY_ID[id].scope;

  return KEYMAPS.find(other=>other.id!==id&&other.kind!=='modifier'&&(other.scope===scope||((scope==='Window'||other.scope==='Window')&&!['Mouse','Modifiers'].includes(scope)&&!['Mouse','Modifiers'].includes(other.scope)))&&bindingFor(other.id,preferences)===binding);

}

export function mappedNavigation(event,preferences={}) {

  const item=KEYMAPS.find(item=>item.command&&matchesBinding(item.id,event,preferences));

  if(!item)return null;

  const command={...item.command},step=(preferences.rotationAngle??15)*Math.PI/180;

  if(command.action==='orbit'){command.x*=step/.008;command.y*=step/.008;}

  if(command.action==='roll')command.value*=step;

  return command;

}

