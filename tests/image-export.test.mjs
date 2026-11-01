import test from 'node:test';
import assert from 'node:assert/strict';
import {imageDefaults,validateImageOptions,imageTiles,captureImage,imageFilename,blueprintPanels,blueprintSettings} from '../src/export/image-options.js';
import {imageView} from '../src/export/image-pipeline.js';
import {area} from '../src/layout.js';
import {makeModel,makeBlock} from '../src/block-model.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
import {blueprintCamera,orbitBlueprint,panBlueprint,frameBlueprint} from '../src/export/blueprint-camera.js';
const fixture=()=>({loaded:true,visible:true,model:makeModel([makeBlock()]),selectedIds:new Set(['b0']),hiddenIds:new Set(),revision:1});
test('image options reject impossible output and preserve real-alpha format requirements',()=>{
 const d=imageDefaults(area().view);assert.ok(validateImageOptions(d).tileLimit>=256);
 for(const patch of [{width:0},{height:1.5},{width:32769},{supersampling:3},{format:'jpeg',background:'transparent'},{quality:NaN,format:'webp'},{budget:100},{width:32768,height:32768}])assert.throws(()=>validateImageOptions({...d,...patch}));
 assert.doesNotThrow(()=>validateImageOptions({...d,format:'webp',background:'transparent'}));
 assert.equal(imageFilename('a/b:ship.xml','transparent','jpeg'),'a-b-ship-transparent.jpg');
});
test('padded image tiles cover every output pixel exactly once within target limits',()=>{
 const w=701,h=509,tiles=imageTiles(w,h,256,32),coverage=new Uint8Array(w*h);
 for(const t of tiles){assert.ok(t.width<=256&&t.height<=256);for(let y=t.coreY;y<t.coreY+t.coreHeight;y++)for(let x=t.coreX;x<t.coreX+t.coreWidth;x++)coverage[y*w+x]++;}
 assert.ok(coverage.every(v=>v===1));assert.throws(()=>imageTiles(1000,1000,256,120));
});
test('image snapshots freeze colors, geometry, visibility and camera without DOM ownership',()=>{
 const scene=fixture(),view=area().view,snapshot=captureImage(scene,view,FACTORY_PREFERENCES,{width:600,height:400});
 scene.model.blocks[0].position.x=99;scene.model.blocks[0].color='ff000000';scene.hiddenIds.add('b0');view.yaw=2;
 assert.equal(snapshot.scene.model.blocks[0].position.x,0);assert.notEqual(snapshot.scene.model.blocks[0].color,'ff000000');assert.equal(snapshot.scene.hiddenIds.size,0);assert.notEqual(snapshot.view.yaw,2);
});
test('image camera scales panning and retains perspective framing at matching aspect',()=>{
 const view=area().view;view.panX=20;view.panY=-12;const snap=captureImage(fixture(),view,FACTORY_PREFERENCES,{width:600,height:400});
 const options=imageDefaults(view,1200,800),configured=imageView(snap,options).view;
 assert.equal(configured.panX,40);assert.equal(configured.panY,-24);assert.equal(configured.zoom,view.zoom);assert.equal(configured.projection,view.projection);
 assert.equal(snap.view.panX,20);
});
test('blueprint render configuration uses technical surfaces and independent presentation settings',()=>{
 const view=area().view,snap=captureImage(fixture(),view,FACTORY_PREFERENCES,{width:600,height:400});
 const o=imageDefaults(view,600,400,'blueprint'),configured=imageView(snap,o);
 assert.equal(configured.view.projection,'orthographic');assert.equal(configured.view.display.blueprint,true);assert.equal(configured.preferences.shaderBloom,0);assert.equal(configured.preferences.shaderAO,0);
 assert.equal(snap.view.display,undefined);
});

test('multi-view panels stay disjoint and reserve labels and title space',()=>{
 for(const [width,height] of [[1000,700],[3840,2160],[601,901]]){
  const panels=blueprintPanels({width,height,titleBlock:true});assert.equal(panels.length,4);
  assert.deepEqual(panels.map(p=>p.camera),['front','right','top','isometric']);
  for(const p of panels){assert.ok(p.width>0&&p.height>0);assert.ok(p.x>=0&&p.x+p.width<=width);assert.ok(p.y+p.height+p.label<height-62*Math.min(width,height)/800);}
  assert.ok(panels[0].x+panels[0].width<panels[1].x);assert.ok(panels[0].y+panels[0].height+panels[0].label<panels[2].y);
 }
 assert.throws(()=>validateImageOptions({...imageDefaults(area().view),blueprintLayout:'unknown'}));
});

test('custom blueprint panels preserve orientation, scale, and non-overlapping unequal sizes',()=>{
 const settings=blueprintSettings();settings.columnSplit=.7;settings.rowSplit=.3;
 settings.views[0]={camera:'bottom',rotation:90,scale:.6};
 for(const [width,height] of [[640,360],[3840,2160]]){
  const panels=blueprintPanels({width,height,titleBlock:true,blueprintSettings:settings});
  assert.equal(panels[0].camera,'bottom');assert.equal(panels[0].rotation,90);assert.equal(panels[0].scale,.6);
  assert.ok(panels[0].width>panels[1].width*2);assert.ok(panels[2].height>panels[0].height*2);
  for(const p of panels)assert.ok(p.width>0&&p.height>0&&p.x+p.width<=width&&p.y+p.height+p.label<height);
  assert.ok(panels[0].x+panels[0].width<panels[1].x);assert.ok(panels[0].y+panels[0].height+panels[0].label<panels[2].y);
 }
 const defaults=imageDefaults(area().view,640,480,'blueprint');
 for(const patch of [{columnSplit:NaN},{rowSplit:.1},{views:[]},{single:{rotation:Infinity,scale:1}},{single:{rotation:0,scale:0}}])assert.throws(()=>validateImageOptions({...defaults,blueprintSettings:{...settings,...patch}}));
 assert.throws(()=>validateImageOptions({...defaults,width:2,height:2,blueprintLayout:'multi'}));
});

test('blueprint rotation and model scale apply after orientation without mutating the viewer',()=>{
 const view=area().view,snap=captureImage(fixture(),view,FACTORY_PREFERENCES,{width:600,height:400});
 const o={...imageDefaults(view,600,400,'blueprint'),camera:'front',titleBlock:false,blueprintSettings:blueprintSettings()};
 const original=JSON.stringify(snap.view),normal=imageView(snap,o).view;
 o.blueprintSettings.single={rotation:90,scale:.5};const rotated=imageView(snap,o).view;
 assert.equal(rotated.roll,Math.PI/2);
 const unscaled=imageView(snap,{...o,blueprintScale:1}).view;
 assert.equal(rotated.display.focalLength,unscaled.display.focalLength*.5);
 assert.equal(imageView(snap,{...o,blueprintRotation:0,blueprintScale:1}).view.display.focalLength,normal.display.focalLength);
 assert.equal(JSON.stringify(snap.view),original);
});

test('dimension cage is an independent export preference gated by dimensions',()=>{
 const view=area().view,snap=captureImage(fixture(),view,{...FACTORY_PREFERENCES,dimensionCage:false},{width:600,height:400});
 const o={...imageDefaults(view),dimensions:true,dimensionCage:true};
 assert.equal(imageView(snap,o).preferences.dimensionCage,true);
 const noCage=imageView(snap,{...o,dimensionCage:false});assert.equal(noCage.preferences.dimensionCage,false);assert.equal(noCage.view.display.showModelDimensions,true);
 assert.equal(imageView(snap,{...o,dimensions:false}).preferences.dimensionCage,false);
 assert.equal(snap.preferences.dimensionCage,false);
});

test('blueprint gestures remain independent and export normalized pan at any resolution',()=>{
 const view=area().view,snap=captureImage(fixture(),view,FACTORY_PREFERENCES,{width:600,height:400});
 const settings=blueprintSettings(),other=JSON.stringify(settings.views),single=settings.single;
 orbitBlueprint(single,'front',view,40,20,{orbitSensitivity:1});
 assert.equal(single.orientation.yaw,-.32);assert.equal(single.orientation.pitch,.16);
 panBlueprint(single,60,-20,600,400);single.scale=.7;
 const o={...imageDefaults(view,600,400,'blueprint'),camera:'front',blueprintSettings:settings};
 const configured=imageView(snap,o).view,centered=imageView(snap,{...o,blueprintView:{...single,pan:{x:0,y:0}}}).view;
 assert.equal(configured.yaw,-.32);assert.equal(configured.pitch,.16);
 assert.equal(configured.panX-centered.panX,60);assert.equal(configured.panY-centered.panY,-20);
 const large=imageView(snap,{...o,width:1200,height:800}).view,largeCenter=imageView(snap,{...o,width:1200,height:800,blueprintView:{...single,pan:{x:0,y:0}}}).view;
 assert.equal(large.panX-largeCenter.panX,120);assert.equal(large.panY-largeCenter.panY,-40);
 frameBlueprint(single);assert.equal(single.scale,1);assert.deepEqual(single.pan,{x:0,y:0});assert.equal(single.orientation.yaw,-.32);
 assert.equal(JSON.stringify(settings.views),other);assert.equal(blueprintCamera('top',{rotation:90,scale:1},view).roll,Math.PI/2);
 for(const patch of [{orientation:{yaw:NaN,pitch:0}},{orientation:{yaw:0,pitch:2}},{pan:{x:0,y:Infinity}}])assert.throws(()=>validateImageOptions({...o,blueprintSettings:{...settings,single:{...single,...patch}}}));
});


test('annotation coordinates and typography scale together, with bounded editable data',async()=>{
 const {annotationGeometry,validateAnnotations}=await import('../src/export/blueprint-annotations.js');
 const a={text:'Engine',fontSize:24,color:'#ffcc55',x:.1,y:.2,target:{x:.7,y:.8},leader:true,arrow:true};
 const small=annotationGeometry(a,600,400,(text,size)=>text.length*size*.5),large=annotationGeometry(a,1200,800,(text,size)=>text.length*size*.5);
 for(const key of ['x','y','size','textWidth'])assert.equal(large[key],small[key]*2);
 for(const key of ['start','end'])for(const axis of ['x','y'])assert.equal(large[key][axis],small[key][axis]*2);
 assert.doesNotThrow(()=>validateAnnotations({name:'Engine study',annotations:[a],dimensions:true,dimensionCage:false}));
 for(const patch of [{x:-1},{fontSize:Infinity},{color:'red'},{target:{x:2,y:0}},{text:'x'.repeat(201)}])assert.throws(()=>validateAnnotations({annotations:[{...a,...patch}]}));
 assert.throws(()=>validateAnnotations({annotations:Array(51).fill(a)}));
 for(const dimensionFontSize of [NaN,Infinity,5,97])assert.throws(()=>validateAnnotations({dimensionFontSize}));
 for(const dimensionFontSize of [6,12,30,96])assert.doesNotThrow(()=>validateAnnotations({dimensionFontSize}));
});
