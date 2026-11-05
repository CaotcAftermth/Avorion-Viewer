import {demoProject} from '../src/turrets/core.js';
import {blockSockets} from '../src/turrets/sockets.js';
import {placeTurret} from '../src/turrets/mounts.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { area } from '../src/layout.js';
import { mountViewport } from '../src/viewport.js';
import { FACTORY_PREFERENCES } from '../src/preferences.js';
import {makeBlock,makeModel} from '../src/block-model.js';

// Exercise the real renderer's event handlers without a browser dependency.
test('viewport pointer lifecycle, modifiers, cancellation, and cursor removal', async t => {
  const saved = new Map(['document','Option','window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','devicePixelRatio'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const frames=new Map();let frameId=0;
  const element=()=>Object.assign(new EventTarget(),{style:{},children:[],setAttribute(){},append(...items){this.children.push(...items);},remove(){},add(item){this.children.push(item);},querySelector(){return null;},classList:{add(){},remove(){},toggle(){}}});
  globalThis.document=Object.assign(new EventTarget(),{createElement:element});globalThis.Option=class{constructor(text,value){this.text=text;this.value=value;}};
  globalThis.window=new EventTarget();globalThis.devicePixelRatio=1;
  globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){this.callback([{contentRect:{width:800,height:600}}]);}disconnect(){}};
  t.after(()=>{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});

  function setup(preferences = { ...FACTORY_PREFERENCES }, sceneOverrides = {}) {
    const node=area(),calls=[],classes=new Set(),label={textContent:''};
    const context=new Proxy({}, {get:(_,name)=>(...args)=>calls.push({name,args}),set:()=>true});
    const canvas=new EventTarget();let captured=false,changes=0,selections=0,menus=0;
    Object.assign(canvas,{
      getContext:()=>context,focus:()=>{},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),
      setPointerCapture:()=>{captured=true;},hasPointerCapture:()=>captured,releasePointerCapture:()=>{captured=false;},
      parentElement:Object.assign(element(),{querySelector:selector=>selector==='.view-label'?label:null,querySelectorAll:()=>[],classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}})
    });
    const activeScene={visible:true,loaded:true,selected:true,...sceneOverrides};
    const renderer=mountViewport(canvas,node,activeScene,()=>changes++,()=>selections++,()=>preferences,()=>menus++);
    const flush=()=>{for(const [id,callback] of [...frames]){frames.delete(id);callback();}};
    const pointer=(type,properties={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,button:1,clientX:100,clientY:100,...properties});canvas.dispatchEvent(event);};
    return {node,canvas,renderer,pointer,flush,calls,classes,scene:activeScene,get changes(){return changes;},get selections(){return selections;},get menus(){return menus;}};
  }

  await t.test('coverage does not hide explicitly requested armored-base sockets',()=>{
    const h=setup({...FACTORY_PREFERENCES},{model:makeModel([makeBlock({typeIndex:24})]),showFireCoverage:true,turretSockets:{show:true,through:true,scope:'all'}});
    try{h.node.view.interactionMode='socket';h.flush();assert.ok(h.calls.some(c=>c.name==='arc'),'armored socket markers remain visible while coverage is enabled');}
    finally{h.renderer.dispose();}
  });
  await t.test('thin turret bodies retain sockets and undersized faces remain inspectable',()=>{
    for(const thickness of [0,.4,.5]){
      const h=setup({...FACTORY_PREFERENCES},{model:makeModel([makeBlock({typeIndex:24,size:{x:2,y:thickness,z:2}})]),turretSockets:{show:true,through:true,scope:'all'}});
      try{h.node.view.showThinBlocks=false;h.node.view.interactionMode='socket';h.flush();assert.equal(h.calls.filter(c=>c.name==='arc').length,6);}
      finally{h.renderer.dispose();}
    }
  });
  await t.test('Socket box selection selects multiple turrets and Ctrl subtracts them',()=>{
    const blocks=[makeBlock({id:'a',typeIndex:24,position:{x:-1,y:0,z:0}}),makeBlock({id:'b',typeIndex:24,position:{x:1,y:0,z:0}})];
    const scene={loaded:true,visible:true,model:makeModel(blocks),hiddenIds:new Set()},asset=demoProject().assets[0];asset.sourceSize=1;
    for(const block of blocks)placeTurret(scene,asset,blockSockets(block).find(s=>s.normal[1]>.99),.5);
    const h=setup({...FACTORY_PREFERENCES},scene);
    try{
      h.node.view.interactionMode='socket';h.node.view.tool='select';
      const sweep=ctrlKey=>{h.pointer('pointerdown',{button:0,clientX:0,clientY:0,ctrlKey});h.pointer('pointermove',{button:0,clientX:800,clientY:600,ctrlKey});h.pointer('pointerup',{button:0,clientX:800,clientY:600,ctrlKey});};
      sweep(false);assert.equal(h.scene.selectedTurretIds.size,2);sweep(true);assert.equal(h.scene.selectedTurretIds.size,0);
    }finally{h.renderer.dispose();}
  });
  await t.test('Orbit and Pan toolbar tools drive left-button navigation',()=>{
    for(const interactionMode of ['object','socket'])for(const tool of ['orbit','pan']){
      const h=setup();h.node.view.tool=tool;h.node.view.interactionMode=interactionMode;const before=structuredClone(h.node.view);
      try{
        h.pointer('pointerdown',{button:0});h.pointer('pointermove',{button:0,clientX:160,clientY:130});h.pointer('pointerup',{button:0,clientX:160,clientY:130});
        if(tool==='orbit')assert.notEqual(h.node.view.yaw,before.yaw);
        else {assert.notDeepEqual(h.node.view.target,before.target);assert.equal(h.node.view.yaw,before.yaw);}
        assert.equal(h.selections,0);
      }finally{h.renderer.dispose();}
    }
  });
  await t.test('MMB drag uses corrected orbit direction without selecting',()=>{
    const h=setup(),yaw=h.node.view.yaw;
    h.pointer('pointerdown');h.pointer('pointermove',{clientX:150});h.pointer('pointerup',{clientX:150});h.flush();
    assert.ok(h.node.view.yaw<yaw);assert.equal(h.selections,0);assert.equal(h.changes,1);
    assert.equal(h.calls.some(call=>call.name==='arc'),false,'No 3D cursor or temporary center marker');h.renderer.dispose();
  });
  await t.test('Ctrl MMB zooms without orbiting; Shift MMB pans the pivot',()=>{
    for(const modifier of ['ctrlKey','shiftKey']){
      const h=setup(),before=structuredClone(h.node.view);
      h.pointer('pointerdown',{[modifier]:true});h.pointer('pointermove',{[modifier]:true,clientY:70,clientX:130});h.pointer('pointerup',{[modifier]:true});
      assert.equal(h.node.view.yaw,before.yaw);
      if(modifier==='ctrlKey')assert.ok(h.node.view.zoom>before.zoom);
      else assert.notDeepEqual(h.node.view.target,before.target);
      h.renderer.dispose();
    }
  });
  await t.test('Ctrl Shift MMB dollies and commits perspective mode',()=>{
    const h=setup(),before=structuredClone(h.node.view);
    h.pointer('pointerdown',{ctrlKey:true,shiftKey:true});h.pointer('pointermove',{clientY:60});h.pointer('pointerup');
    assert.equal(h.node.view.projection,'perspective');assert.equal(h.node.view.zoom,before.zoom);assert.notDeepEqual(h.node.view.target,before.target);h.renderer.dispose();
  });
  await t.test('cancel restores the complete pre-drag camera and suppresses late release',()=>{
    const h=setup(),before=structuredClone(h.node.view);
    h.pointer('pointerdown');h.pointer('pointermove',{clientX:160,clientY:130});
    assert.equal(h.renderer.cancel(),true);assert.deepEqual(h.node.view,before);
    h.pointer('pointerup');assert.equal(h.changes,1);assert.equal(h.renderer.navigating,false);h.renderer.dispose();
  });
  await t.test('palette clicks and navigation cancellation retain live overlay settings',()=>{
    for(const palette of [false,true]){
      const h=setup(),display={showModelDimensions:false};h.node.view.display=display;
      if(palette)h.node.view.interactionMode='paint';
      h.pointer('pointerdown');
      if(palette)h.pointer('pointerup');else h.renderer.cancel();
      assert.equal(h.node.view.display,display);
      display.showModelDimensions=true;assert.equal(h.node.view.display.showModelDimensions,true);
      h.renderer.dispose();
    }
  });
  await t.test('right-click and pointer cancellation restore pan and zoom',()=>{
    for(const end of ['contextmenu','pointercancel']){
      const h=setup(),before=structuredClone(h.node.view);
      h.pointer('pointerdown',{ctrlKey:true});h.pointer('pointermove',{clientY:30});h.pointer(end);
      assert.deepEqual(h.node.view,before);h.renderer.dispose();
    }
  });
  await t.test('LMB region zoom changes framing; MMB region zoom goes out',()=>{
    for(const button of [0,1]){
      const h=setup();h.renderer.startRegion();assert.equal(h.classes.has('region-zoom'),true);
      h.pointer('pointerdown',{button,clientX:300,clientY:200});h.pointer('pointermove',{button,clientX:500,clientY:400});h.pointer('pointerup',{button});
      assert.ok(button===0?h.node.view.zoom>1:h.node.view.zoom<1);assert.equal(h.classes.has('region-zoom'),false);assert.equal(h.selections,0);h.renderer.dispose();
    }
  });
  await t.test('remapped right-button orbit commits without opening or canceling via context menu',()=>{
    const h=setup({...FACTORY_PREFERENCES,keymap_orbitDrag:'Mouse2'}),yaw=h.node.view.yaw;
    h.pointer('pointerdown',{button:2});h.pointer('pointermove',{button:2,clientX:140});h.pointer('contextmenu',{button:2});
    assert.equal(h.renderer.navigating,true);h.pointer('pointerup',{button:2});assert.ok(h.node.view.yaw<yaw);assert.equal(h.selections,0);h.renderer.dispose();
  });
  await t.test('region mouse bindings choose zoom direction independently of button number',()=>{
    const h=setup({...FACTORY_PREFERENCES,keymap_regionIn:'Mouse1',keymap_regionOut:'Mouse0'});h.renderer.startRegion();
    h.pointer('pointerdown',{button:0,clientX:300,clientY:200});h.pointer('pointermove',{button:0,clientX:500,clientY:400});h.pointer('pointerup',{button:0});
    assert.ok(h.node.view.zoom<1);h.renderer.dispose();
  });
  await t.test('RMB menu opens when idle but never after a remapped navigation drag',()=>{
    const h=setup();h.pointer('pointerdown',{button:2});h.pointer('pointerup',{button:2});h.pointer('contextmenu',{button:2});assert.equal(h.menus,1);h.renderer.dispose();
    const remapped=setup({...FACTORY_PREFERENCES,keymap_orbitDrag:'Mouse2'});
    remapped.pointer('pointerdown',{button:2});remapped.pointer('pointermove',{button:2,clientX:160});remapped.pointer('pointerup',{button:2});remapped.pointer('contextmenu',{button:2});assert.equal(remapped.menus,0);remapped.renderer.dispose();
  });
  await t.test('cube corner click snaps, while dragging the same region orbits',()=>{
    const h=setup();h.canvas.closest=()=>({dataset:{cubeRegion:'top-front-right'}});
    h.pointer('pointerdown');h.pointer('pointerup');
    assert.ok(Math.abs(h.node.view.yaw-Math.PI/4)<1e-9);
    assert.ok(Math.abs(h.node.view.pitch-Math.atan2(1,Math.sqrt(2)))<1e-9);
    h.pointer('pointerdown');h.pointer('pointermove',{clientX:150});const yaw=h.node.view.yaw;h.pointer('pointerup',{clientX:150});
    assert.equal(h.node.view.yaw,yaw);assert.notEqual(yaw,Math.PI/4);h.renderer.dispose();
  });
  await t.test('dispose removes event handlers and scheduled rendering',()=>{
    const h=setup(),before=structuredClone(h.node.view);h.renderer.dispose();
    h.pointer('pointerdown');h.pointer('pointermove',{clientX:180});h.pointer('pointerup');
    assert.deepEqual(h.node.view,before);assert.equal(frames.size,0);
  });
  await t.test('emulated middle mouse orbits without Alt-release axis snapping',()=>{
    const h=setup({...FACTORY_PREFERENCES,emulate3Button:true,orbitSensitivity:2}),yaw=h.node.view.yaw;
    h.pointer('pointerdown',{button:0,altKey:true});h.pointer('pointermove',{button:0,altKey:true,clientX:117});
    const draggedYaw=h.node.view.yaw;h.pointer('pointerup',{button:0,altKey:true});
    assert.ok(draggedYaw<yaw);assert.equal(h.node.view.yaw,draggedYaw);assert.equal(h.selections,0);h.renderer.dispose();
  });
  await t.test('live preference changes reverse zoom and update canvas resolution',()=>{
    const preferences={...FACTORY_PREFERENCES,pixelRatio:1},h=setup(preferences);
    globalThis.devicePixelRatio=2;h.renderer.draw();h.flush();assert.equal(h.canvas.width,800);
    preferences.pixelRatio=2;h.renderer.draw();h.flush();assert.equal(h.canvas.width,1600);
    for(const invertZoom of [false,true]){
      preferences.invertZoom=invertZoom;const before=h.node.view.zoom;
      const event=new Event('wheel',{cancelable:true});Object.assign(event,{deltaY:100,deltaMode:0});h.canvas.dispatchEvent(event);
      assert.ok(invertZoom?h.node.view.zoom>before:h.node.view.zoom<before);
    }
    h.renderer.dispose();globalThis.devicePixelRatio=1;
  });
});
