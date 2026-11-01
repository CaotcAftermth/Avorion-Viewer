import { makeBlock,makeModel,parseAvorionXml } from '../src/block-model.js';
import { drawGame,pickGame,textureLibrary,releaseGameModel } from '../src/game-renderer.js';
import { FACTORY_PREFERENCES } from '../src/preferences.js';
import { area } from '../src/layout.js';
import { ensureViewportOptions } from '../src/viewport-options.js';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),results=document.querySelector('#results');
let passed=0,failed=0;
const assert=(value,message)=>{if(!value)throw Error(message);};
async function check(name,fn){const li=document.createElement('li');try{await fn();li.textContent='PASS · '+name;li.className='pass';passed++;}catch(e){li.textContent='FAIL · '+name+' · '+e.message;li.className='fail';failed++;}results.append(li);}
const settings={...FACTORY_PREFERENCES,shaderDebug:0,shaderThrust:0,shaderBarrier:0};
const scene={model:makeModel([makeBlock()]),loaded:true,visible:true,selected:false,revision:0};
const view={...area().view,grid:false,projection:'orthographic'};
function render(block=makeBlock(),p=settings){scene.model=makeModel([block]);scene.revision++;drawGame(ctx,scene,view,240,240,p,1);return [...ctx.getImageData(120,120,1,1).data];}
await check('XML identity, ship-space bounds, legacy attributes, unknown data and turret preservation',()=>{
  const xml='<plan custom="keep"><meta value="yes"/><item index="42" parent="-1"><block index="100" material="2" look="5" up="3" color="80ffffff" secondaryColor="40112233" lx="10" ly="20" lz="30" ux="12" uy="24" uz="38"/></item><item index="99" parent="42"><block index="9999" lowerX="12" lowerY="20" lowerZ="30" upperX="14" upperY="24" upperZ="38" extra="keep"/></item><turretDesign><plan><item><block index="3" lx="0" ly="0" lz="0" ux="1" uy="1" uz="1"/></item></plan></turretDesign></plan>';
  const m=parseAvorionXml(xml,'fixture.xml',xml.length);assert(m.blocks.length===2,'turret must not render at origin');assert(m.blocks[1].parentId==='b0','parent map uses item IDs');assert(m.blocks[1].position.x===13,'no parent transform');assert(m.blocks[0].color==='80ffffff','alpha');
  const saved=new XMLSerializer().serializeToString(m.doc),again=parseAvorionXml(saved,'roundtrip.xml',saved.length);
  assert(saved.includes('extra="keep"')&&saved.includes('<turretDesign>')&&saved.includes('secondaryColor="40112233"')&&saved.includes('value="yes"'),'unknown XML must survive');assert(again.blocks[0].size.z===8,'world bounds');
});
await check('invalid XML rejects and malformed orientation produces diagnostics',()=>{
  let rejected=false;try{parseAvorionXml('<plan>','bad.xml',6);}catch{rejected=true;}assert(rejected,'invalid XML');
  const m=parseAvorionXml('<plan><item><block index="2" look="7" up="3" lx="0" ly="0" lz="0" ux="2" uy="4" uz="8"/></item></plan>','bad-axis.xml',1);assert(m.warnings.some(w=>w.message.includes('look/up')),'invalid orientation diagnostic');
});
await check('game shader renders, ray picking resolves block, hiding clears geometry',()=>{
  const pixel=render();assert(pixel[0]!==57||pixel[1]!==57,'visible geometry');assert(pickGame(scene,view,240,240,120,120)==='b0','ray pick');scene.visible=false;drawGame(ctx,scene,view,240,240,settings,1);assert(pickGame(scene,view,240,240,120,120)===null,'hidden pick');scene.visible=true;
});
await check('36-angle local face-ID pass remains constant per face',()=>{
  const colors=[[128,13,13],[255,51,51],[13,128,13],[51,255,51],[13,13,128],[51,102,255]];
  for(let i=0;i<36;i++){view.yaw=i*Math.PI/18+.031;view.pitch=.28;const pixel=render(makeBlock(),{...settings,shaderDebug:8});assert(colors.some(c=>c.every((v,k)=>Math.abs(pixel[k]-v)<=1)),`angle ${i}: ${pixel}`);}
});
await check('engine emission belongs to local -Z and rotates with the block',()=>{
  const p={...settings,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0};view.pitch=0;view.yaw=Math.PI;
  const rear=render(makeBlock({typeIndex:3}),p);view.yaw=0;const front=render(makeBlock({typeIndex:3}),p);assert(rear[0]>100&&front[0]<5,'rear emission must be independent of lighting');
  view.yaw=Math.PI/2;const rotated=render(makeBlock({typeIndex:3,look:5,up:3}),p);assert(rotated[0]>100,'emitter must follow orientation');
});
await check('flat decoded normal texture keeps normal direction and texture arrays release on rebuild',async()=>{
  const image=document.createElement('canvas');image.width=image.height=4;const c=image.getContext('2d');c.fillStyle='rgb(128,128,255)';c.fillRect(0,0,4,4);
  const blob=await new Promise(resolve=>image.toBlob(resolve));await textureLibrary.loadFiles([new File([blob],'plates0_n.png',{type:'image/png'})]);assert(textureLibrary.loadedCount===1,'map loaded');
  view.yaw=0;view.pitch=0;const pixel=render(makeBlock(),{...settings,shaderDebug:3});assert(pixel[0]>120&&pixel[0]<135&&pixel[1]>120&&pixel[1]<135&&pixel[2]>250,'flat normal stays +Z, no BGR swap');
  for(let i=0;i<10;i++)render(makeBlock({typeIndex:i%2?100:2}));releaseGameModel();
  assert(textureLibrary.arrays.size===0,'released models must release texture array cache');
});
await check('crew windows emit after lighting and retain raw secondary alpha',async()=>{
  const image=document.createElement('canvas');image.width=image.height=4;const c=image.getContext('2d');c.fillStyle='white';c.fillRect(0,0,4,4);
  const blob=await new Promise(resolve=>image.toBlob(resolve));await textureLibrary.loadFiles([new File([blob],'plates0_windows.png',{type:'image/png'})]);
  const p={...settings,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderWindowColor:'#0000ff',shaderWindows:1};
  const base=render(makeBlock({typeIndex:6,secondaryColor:'00ff0000'}),p),red=render(makeBlock({typeIndex:6,secondaryColor:'ffff0000'}),p);
  assert(base[2]>250&&base[0]<5,'zero-alpha secondary uses default window color');assert(red[0]>250&&red[2]<5,'opaque secondary controls unlit window emission');
});
await check('per-block visibility skips hidden geometry when picking; simplified rendering keeps visibility',()=>{
  scene.model=makeModel([makeBlock({id:'near',position:{x:0,y:1,z:2},color:'ffff3333'}),makeBlock({id:'far',position:{x:0,y:1,z:-2},color:'ff3333ff'})]);scene.revision++;
  scene.hiddenIds=new Set();scene.selectedIds=new Set(['near']);view.yaw=0;view.pitch=0;
  drawGame(ctx,scene,view,240,240,settings,1);assert(pickGame(scene,view,240,240,120,120)==='near','near visible block');
  scene.hiddenIds=new Set([...scene.hiddenIds,'near']);drawGame(ctx,scene,view,240,240,settings,1);assert(pickGame(scene,view,240,240,120,120)==='far','hidden block must not intercept picking');assert(scene.selectedIds.has('near'),'hiding must preserve selection');
  const p={...settings,simplifyThreshold:1};drawGame(ctx,scene,view,240,240,p,1);
  assert(pickGame(scene,view,240,240,120,120)==='far','picking remains available above threshold');const visible=[...ctx.getImageData(120,120,1,1).data];assert(visible[2]>visible[0],'visible blue block in simplified shader');
  scene.hiddenIds=new Set([...scene.hiddenIds,'far']);drawGame(ctx,scene,view,240,240,p,1);const hidden=[...ctx.getImageData(120,120,1,1).data];assert(hidden[0]===hidden[2],'simplified hidden blocks disappear');
  scene.hiddenIds=new Set();drawGame(ctx,scene,view,240,240,settings,1);assert(pickGame(scene,view,240,240,120,120)==='near','normal picking restores below threshold');
});
await check('distant closely spaced faces keep front color in both projections',()=>{
  scene.hiddenIds=new Set();scene.selectedIds=new Set();scene.visible=true;
  const p={...settings,clipStart:.0001,clipEnd:10000000,shaderDebug:0,shaderAmbient:1,shaderLight:0,shaderSkyAmbient:0,shaderMinReflection:0,shaderMaxReflection:0};
  for(const projection of ['perspective','orthographic']){
    Object.assign(view,{projection,yaw:0,pitch:0,roll:0,zoom:.001,target:[0,0,0],panX:0,panY:0});
    scene.model=makeModel([makeBlock({id:'front',size:{x:1000,y:1000,z:1},position:{x:0,y:0,z:.01},color:'ffff0000'}),makeBlock({id:'back',size:{x:1000,y:1000,z:1},position:{x:0,y:0,z:0},color:'ff0000ff'})]);scene.revision++;
    drawGame(ctx,scene,view,240,240,p,1);const pixel=ctx.getImageData(120,120,1,1).data;
    assert(pixel[0]>pixel[2],projection+' must show nearer red face, got '+[...pixel]);
  }
});

await check('Compare perspective orbit preserves thin surface depth after another viewport renders',()=>{
  scene.hiddenIds=new Set();scene.selectedIds=new Set();scene.visible=true;
  const p={...settings,clipStart:.05,clipEnd:1000000,shaderDebug:0,shaderAmbient:1,shaderLight:0,shaderSkyAmbient:0,shaderMinReflection:0,shaderMaxReflection:0};
  scene.model=makeModel([makeBlock({id:'front',size:{x:1000,y:1000,z:1},position:{x:0,y:0,z:.001},color:'ffff0000'}),makeBlock({id:'back',size:{x:1000,y:1000,z:1},position:{x:0,y:0,z:0},color:'ff0000ff'})]);scene.revision++;
  const other={...view,projection:'orthographic',yaw:1,pitch:.2,zoom:.004,target:[0,0,0],grid:false};
  for(let i=0;i<24;i++){
    other.projection=i%2?'perspective':'orthographic';
    drawGame(ctx,scene,other,360,240,p,1);
    Object.assign(view,{projection:'perspective',yaw:(i-12)*.015,pitch:.03,roll:0,zoom:.003,target:[0,0,0],panX:0,panY:0,grid:false});
    drawGame(ctx,scene,view,240,360,p,1);const pixel=ctx.getImageData(120,180,1,1).data;
    assert(pixel[0]>pixel[2],'orbit step '+i+' lost nearer surface: '+[...pixel]);
  }
});

await check('solid back faces cannot show or intercept picking; glass stays two-sided',()=>{
  Object.assign(view,{projection:'perspective',yaw:0,pitch:0,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.hiddenIds=new Set();scene.selectedIds=new Set();
  scene.model=makeModel([makeBlock({id:'shell',size:{x:40,y:40,z:40},position:{x:0,y:0,z:0}})]);scene.revision++;
  drawGame(ctx,scene,view,240,240,settings,1);assert(pickGame(scene,view,240,240,120,120)===null,'inside solid must not pick back wall');
  const pixel=ctx.getImageData(120,120,1,1).data;assert(pixel[0]===57&&pixel[1]===57,'solid interior must be background');
  scene.model=makeModel([makeBlock({id:'glass',typeIndex:170,size:{x:40,y:40,z:40},position:{x:0,y:0,z:0}})]);scene.revision++;
  drawGame(ctx,scene,view,240,240,settings,1);assert(pickGame(scene,view,240,240,120,120)==='glass','glass back wall remains pickable');
});

await check('close perspective orbit retains thin surfaces when ship bounds cross the camera',()=>{
  scene.hiddenIds=new Set();scene.selectedIds=new Set();scene.visible=true;
  const p={...settings,clipStart:.05,clipEnd:1000000,shaderAmbient:1,shaderLight:0,shaderSkyAmbient:0,shaderMinReflection:0,shaderMaxReflection:0};
  scene.model=makeModel([
    makeBlock({id:'front',size:{x:1000,y:1000,z:1},position:{x:0,y:0,z:.01},color:'ffff0000'}),
    makeBlock({id:'back',size:{x:1000,y:1000,z:1},position:{x:0,y:0,z:0},color:'ff0000ff'}),
    makeBlock({id:'offscreen',position:{x:2000,y:0,z:2000}})
  ]);scene.revision++;
  for(let i=0;i<16;i++){
    const other={...view,projection:i%2?'orthographic':'perspective',yaw:0,pitch:.1,roll:0,zoom:.0001,target:[0,0,0],panX:0,panY:0,grid:true};
    drawGame(ctx,scene,other,360,240,p,1);
    Object.assign(view,{projection:'perspective',yaw:(i-8)*.02,pitch:.1,roll:0,zoom:.01,target:[0,0,0],panX:0,panY:0,grid:false});
    drawGame(ctx,scene,view,240,240,p,1);
    const data=ctx.getImageData(105,105,30,30).data;
    for(let k=0;k<data.length;k+=4)assert(data[k]>data[k+2],`orbit ${i}, pixel ${k/4}: rear surface leaked`);
  }
});

await check('loaded textures remain sampled above simplified threshold and after reload',async()=>{
  const image=document.createElement('canvas');image.width=image.height=4;const c=image.getContext('2d');
  const load=async color=>{c.fillStyle=color;c.fillRect(0,0,4,4);const blob=await new Promise(resolve=>image.toBlob(resolve));await textureLibrary.loadFiles([new File([blob],'plates0.png',{type:'image/png'})]);scene.revision++;};
  Object.assign(view,{projection:'perspective',yaw:0,pitch:0,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.model=makeModel([makeBlock({id:'one',position:{x:0,y:0,z:0}}),makeBlock({id:'two',position:{x:4,y:0,z:0}})]);scene.hiddenIds=new Set();scene.selectedIds=new Set();scene.visible=true;scene.revision++;
  const p={...settings,simplifyThreshold:1,shaderDebug:1};
  await load('#ff0000');drawGame(ctx,scene,view,240,240,p,1);let pixel=ctx.getImageData(120,120,1,1).data;
  assert(pixel[0]>200&&pixel[1]<10,'simplified model must sample loaded red albedo: '+[...pixel]);
  assert(pickGame(scene,view,240,240,120,120,p)==='one','selection remains enabled above threshold');
  await load('#00ff00');drawGame(ctx,scene,view,240,240,p,1);pixel=ctx.getImageData(120,120,1,1).data;
  assert(pixel[1]>200&&pixel[0]<10,'reloaded texture must update simplified model: '+[...pixel]);
});

async function fixtureTexture(name, paint) {
  const c=document.createElement('canvas');c.width=c.height=64;paint(c.getContext('2d'));
  const blob=await new Promise(resolve=>c.toBlob(resolve));
  await textureLibrary.loadFiles([new File([blob],name+'.png',{type:'image/png'})]);
}
function resetMaterialView(){
  textureLibrary.clear();releaseGameModel();scene.hiddenIds=new Set();scene.selectedIds=new Set();
  Object.assign(view,{projection:'orthographic',yaw:0,pitch:0,roll:0,zoom:1,target:[0,0,1],panX:0,panY:0,grid:false});
}
const unlit={...settings,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderGlow:1};
await check('Naonite and Avorion hull lights survive darkness; unlit materials stay dark',async()=>{
  resetMaterialView();
  for(const [name,color] of [['plates2_glow','#00ff00'],['plates6_glow','#ff0000']])
    await fixtureTexture(name,c=>{c.fillStyle=color;c.fillRect(0,0,64,64);});
  for(const materialIndex of [0,1,2,3,4,5,6]){
    const pixel=render(makeBlock({typeIndex:1,materialIndex}),unlit);
    if(materialIndex===2)assert(pixel[1]>240&&pixel[0]<5,'Naonite green light: '+pixel);
    else if(materialIndex===6)assert(pixel[0]>240&&pixel[1]<5,'Avorion red light: '+pixel);
    else assert(Math.max(...pixel.slice(0,3))<5,'no fabricated glow for material '+materialIndex+': '+pixel);
  }
});
await check('material accent coexists with face decal; frontal launcher has five plated faces',async()=>{
  resetMaterialView();
  await fixtureTexture('plates6_overlay',c=>{c.fillStyle='#ff0000';c.fillRect(0,0,64,64);});
  await fixtureTexture('torpedotube',c=>{c.fillStyle='#0000ff';c.fillRect(0,0,64,64);});
  const p={...unlit,shaderAmbient:1,shaderAmbientColor:'#ffffff'};
  const block=makeBlock({typeIndex:22,materialIndex:6});
  const front=render(block,p);assert(front[2]>240&&front[0]<5,'front decal must cover accent: '+front);
  for(const yaw of [Math.PI/2,Math.PI,Math.PI*1.5]){
    view.yaw=yaw;const pixel=render(block,p);assert(pixel[0]>240&&pixel[2]<5,'side/back retains material accent: '+pixel);
  }
  view.yaw=0;await fixtureTexture('plates6_glow',c=>{c.fillStyle='#00ff00';c.fillRect(0,0,64,64);});
  const covered=render(block,unlit);assert(Math.max(...covered.slice(0,3))<5,'opaque launcher artwork suppresses plating glow: '+covered);
  view.yaw=Math.PI;const rear=render(block,unlit);assert(rear[1]>240,'plain rear retains material glow: '+rear);
});
await check('functional decal color and normal use the same inverted local UVs',async()=>{
  resetMaterialView();
  await fixtureTexture('torpedotube',c=>{c.fillStyle='#ff0000';c.fillRect(0,0,32,64);c.fillStyle='#0000ff';c.fillRect(32,0,32,64);});
  await fixtureTexture('torpedotube_n',c=>{c.fillStyle='rgb(204,128,230)';c.fillRect(0,0,32,64);c.fillStyle='rgb(51,128,230)';c.fillRect(32,0,32,64);});
  const block=makeBlock({typeIndex:22,size:{x:8,y:8,z:2}});
  render(block,{...unlit,shaderAmbient:1,shaderAmbientColor:'#ffffff'});
  const left=ctx.getImageData(95,120,1,1).data,right=ctx.getImageData(145,120,1,1).data;
  assert(left[2]>left[0]&&right[0]>right[2],'inverted decal artwork');
  render(block,{...settings,shaderDebug:3});
  const nl=ctx.getImageData(95,120,1,1).data,nr=ctx.getImageData(145,120,1,1).data;
  assert(nl[0]>150&&nr[0]<110,'normal perturbation follows inverted artwork: '+[...nl]+' / '+[...nr]);
});
await check('raw secondary alpha reaches hull paint without inherited double blending',async()=>{
  resetMaterialView();
  await fixtureTexture('plates0',c=>{c.fillStyle='white';c.fillRect(0,0,64,64);});
  await fixtureTexture('plates0_a_mask',c=>{c.fillStyle='white';c.fillRect(0,0,64,64);});
  const p={...unlit,shaderAmbient:1,shaderAmbientColor:'#ffffff'};
  const inherited=render(makeBlock({typeIndex:210,color:'ffffffff'}),p);
  assert(inherited[0]>140&&inherited[0]<165,'default factor must reach mask: '+inherited);
  const explicit=render(makeBlock({typeIndex:210,color:'ffffffff',secondaryColor:'800000ff'}),p);
  assert(explicit[2]>explicit[0]+100&&explicit[0]>65&&explicit[0]<90,'raw half-alpha mixes once: '+explicit);
  const blank=render(makeBlock({typeIndex:1,color:'ffffffff',secondaryColor:'ff000000'}),p);
  assert(blank[0]>250,'blank hull must not acquire the alternate-pattern paint mask');
});
await check('world-projected normal map keeps the same U tangent on opposite faces',async()=>{
  resetMaterialView();
  await fixtureTexture('plates0_n',c=>{c.fillStyle='rgb(204,128,230)';c.fillRect(0,0,64,64);});
  const front=render(makeBlock(),{...settings,shaderDebug:3});view.yaw=Math.PI;
  const rear=render(makeBlock(),{...settings,shaderDebug:3});
  assert(front[0]>180&&rear[0]>180,'both faces use increasing world X for texture U: '+front+' / '+rear);
  assert(front[2]>180&&rear[2]<80,'outward normals still point in opposite Z directions');
});

await check('viewport shading, X-Ray, post effects and Compare isolation',()=>{
  Object.assign(view,{projection:'perspective',yaw:.4,pitch:.3,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.model=makeModel([makeBlock({id:'options',position:{x:0,y:0,z:0}})]);scene.revision++;scene.hiddenIds=new Set();scene.selectedIds=new Set(['options']);
  const d=ensureViewportOptions(view);Object.assign(d,{axisX:false,axisY:false,axisZ:false,background:'VIEWPORT',backgroundColor:'#204060',objectOutline:true});
  const sample=()=>{drawGame(ctx,scene,view,240,240,settings,1);return [...ctx.getImageData(120,120,1,1).data];};
  d.shading='SOLID';const solid=sample();assert(solid[0]>20,'solid surface');
  d.lighting='MATCAP';const wax=sample();assert(wax[0]>wax[1]*2,'red wax differs from studio');d.lighting='STUDIO';
  d.shading='MATERIAL';const material=sample();assert(material.some((v,i)=>v!==solid[i]),'material samples textures');
  d.shading='RENDERED';d.dof=true;sample();d.dof=false;const rendered=sample();assert(rendered[3]===255,'rendered plus shadows compiles');
  d.shading='SOLID';d.xray=true;d.xrayAlpha=0;const transparent=sample();assert(transparent[2]>transparent[0],'xray zero opacity shows background');
  d.xray=false;d.shading='WIREFRAME';const wire=sample();assert(wire[2]>wire[0],'wireframe leaves face interior open');
  const other=structuredClone(view);other.display.shading='SOLID';other.display.backgroundColor='#ff0000';drawGame(ctx,scene,other,360,240,settings,1);
  d.shading='SOLID';sample();const background=ctx.getImageData(5,5,1,1).data;assert(background[0]===32&&background[1]===64&&background[2]===96,'other viewport background cannot leak');
  delete view.display;
});

await check('Outline Selected toggles visible highlighting without changing selection',()=>{
  Object.assign(view,{projection:'perspective',yaw:.4,pitch:.3,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.model=makeModel([makeBlock({id:'outlined',position:{x:0,y:0,z:0}})]);scene.revision++;scene.hiddenIds=new Set();scene.selectedIds=new Set(['outlined']);
  const d=ensureViewportOptions(view);Object.assign(d,{axisX:false,axisY:false,axisZ:false,showOverlays:true,outlineSelected:true,objectOutline:false,shading:'SOLID',xray:false,shadows:false,dof:false});
  const pixels=()=>{drawGame(ctx,scene,view,240,240,settings,1);return ctx.getImageData(0,0,240,240).data;};
  const on=pixels();d.outlineSelected=false;const off=pixels();
  assert(on.some((v,i)=>Math.abs(v-off[i])>8),'selection overlay must change pixels');
  assert(scene.selectedIds.has('outlined'),'overlay toggle must retain selection');
  d.outlineSelected=true;d.showOverlays=false;const hidden=pixels();
  assert(off.every((v,i)=>Math.abs(v-hidden[i])<2),'master overlay toggle suppresses selection overlay');
  delete view.display;
});

await check('Rendered shadows and depth of field change pixels and turn off cleanly',()=>{
  Object.assign(view,{projection:'perspective',yaw:.5,pitch:.65,zoom:.65,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.model=makeModel([makeBlock({id:'floor',size:{x:8,y:.3,z:8},position:{x:0,y:-1.5,z:0}}),makeBlock({id:'box',position:{x:0,y:0,z:0}})]);scene.revision++;scene.selectedIds=new Set();
  const d=ensureViewportOptions(view);Object.assign(d,{shading:'RENDERED',showOverlays:false,objectOutline:false,shadowIntensity:1});
  const p={...settings,shaderAzimuth:35,shaderElevation:50,shaderAmbient:.2,shaderLight:1};
  const frame=()=>{drawGame(ctx,scene,view,240,240,p,1);return ctx.getImageData(0,0,240,240).data;};
  d.shadows=false;const flat=frame();d.shadows=true;const shadow=frame();
  let darker=0;for(let i=0;i<flat.length;i+=4)if(shadow[i]+shadow[i+1]+shadow[i+2]<flat[i]+flat[i+1]+flat[i+2]-5)darker++;
  assert(darker>20,'directional shadows must darken receiver pixels: '+darker);
  d.dof=true;d.focusDistance=1;d.aperture=.1;const blur=frame();let changed=0;for(let i=0;i<blur.length;i++)if(Math.abs(blur[i]-shadow[i])>3)changed++;
  assert(changed>20,'depth of field must visibly blur out-of-focus surfaces');
  d.dof=false;const restored=frame();assert(restored.every((v,i)=>v===shadow[i]),'disabling DOF restores the sharp render');
  delete view.display;
});

await check('ambient-only illuminates all face directions equally in Solid, Material and Rendered',()=>{
  Object.assign(view,{projection:'orthographic',pitch:0,zoom:1,target:[0,0,1],panX:0,panY:0,roll:0,grid:false});
  const d=ensureViewportOptions(view);Object.assign(d,{ambientOnly:true,ambientStrength:1,ambientDetail:0,showOverlays:false,objectOutline:false,dof:false,shadows:false});
  for(const shading of ['SOLID','MATERIAL','RENDERED']){
    d.shading=shading;const colors=[];
    for(const yaw of [0,Math.PI/2,Math.PI]){view.yaw=yaw;colors.push(render(makeBlock(),{...settings,shaderDebug:shading==='SOLID'?0:5}));}
    assert(colors.every(c=>c.slice(0,3).every((v,i)=>Math.abs(v-colors[0][i])<=1)),shading+' changes brightness with face direction');
  }
  d.shading='SOLID';d.ambientStrength=.5;const dim=render();d.ambientStrength=1;const bright=render();assert(bright[0]>dim[0]*1.9,'ambient brightness control');
});
await check('ambient shape contrast reveals faces while retaining a bright fill',()=>{
  Object.assign(view,{projection:'orthographic',pitch:0,zoom:1,target:[0,0,1],panX:0,panY:0,roll:0,grid:false});
  const d=ensureViewportOptions(view);Object.assign(d,{ambientOnly:true,ambientStrength:1,ambientDetail:.35,showOverlays:false,objectOutline:false,dof:false,shadows:false});
  for(const shading of ['SOLID','MATERIAL','RENDERED']){
    d.shading=shading;const colors=[];
    for(const yaw of [0,Math.PI/2,Math.PI]){view.yaw=yaw;colors.push(render(makeBlock({color:'ff888888'}))[0]);}
    assert(Math.max(...colors)-Math.min(...colors)>5,shading+' must reveal face angles');
    assert(Math.min(...colors)>Math.max(...colors)*.7,shading+' must retain bright fill');
  }
  d.shading='SOLID';d.ambientStrength=.5;const dim=render();d.ambientStrength=1;const bright=render();
  assert(bright[0]>dim[0]*1.9,'shape contrast preserves brightness control');
  d.ambientDetail=0;
});
await check('infinite grid survives distant panning; axes honor width, brightness and finite length',async()=>{
  const THREE=await import('../src/vendor/three.module.js'),{createWorldGuides}=await import('../src/world-guides.js');
  const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(240,240);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const world=new THREE.Scene(),guides=createWorldGuides();world.add(guides.grid,...guides.axes);
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.01,1000),v=area().view,d=ensureViewportOptions(v);
  const pixels=()=>{camera.updateMatrixWorld();guides.update(camera,v,240,240,{grid:'#888888',majorGrid:'#ffffff'},1,0);renderer.render(world,camera);const a=new Uint8Array(240*240*4);renderer.getContext().readPixels(0,0,240,240,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,a);return a;};
  const count=a=>a.filter((c,i)=>i%4===0&&c>10).length;
  Object.assign(d,{axisX:false,axisY:false,axisZ:false});camera.position.set(0,10,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
  const origin=count(pixels());camera.position.set(100000,10,100000);camera.lookAt(100000,0,100000);assert(count(pixels())>origin*.7&&origin>100,'grid disappeared far from origin');
  v.grid=false;d.axisX=true;camera.position.set(0,10,0);camera.lookAt(0,0,0);
  d.axisWidth=1;const thin=count(pixels());d.axisWidth=6;const thick=count(pixels());assert(thick>thin*2.5,'axis width: '+thin+' / '+thick);
  d.axisInfinite=false;d.axisLength=2;assert(count(pixels())<thick*.3,'finite axis length');
  d.axisBrightness=0;assert(count(pixels())===0,'zero axis brightness');
  renderer.dispose();for(const m of [guides.grid,...guides.axes])m.material.dispose();guides.grid.geometry.dispose();
});

await check('instanced batches match merged pixels, picking, and color/selection edits',async()=>{
  const THREE=await import('../src/vendor/three.module.js'),{buildTexturedModel}=await import('../src/avorion/lib/geometry/texturedModel.js'),{defaultOrientationProfile}=await import('../src/avorion/lib/avorion/orientation.js'),{DEFAULT_GAME_SHADER}=await import('../src/avorion/types/index.js');
  const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(240,240);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const world=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(9,10,20);camera.lookAt(3,3,0);camera.updateMatrixWorld();
  const pixels=()=>{renderer.render(world,camera);const a=new Uint8Array(240*240*4);renderer.getContext().readPixels(0,0,240,240,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,a);return a;};
  for(const typeIndex of [2,100,101,10,22,58]){
    const blocks=Array.from({length:16},(_,i)=>makeBlock({id:'instance'+i,typeIndex,color:i%2?'ff2266aa':'ff993355',secondaryColor:i%3?'00000000':'8080ff00',position:{x:(i%4)*2,y:Math.floor(i/4)*2,z:0},size:{x:1.4,y:1.6,z:1.2}}));
    const model=makeModel(blocks),params={...DEFAULT_GAME_SHADER,simplified:true};
    const instanced=buildTexturedModel(model,defaultOrientationProfile(),params),merged=buildTexturedModel(model,defaultOrientationProfile(),{...params,instancing:false});
    assert(instanced.group.children.some(m=>m.userData.instanced),'instancing path '+typeIndex);
    const frame=m=>{world.add(m.group);m.prepare(camera);const data=pixels();world.remove(m.group);return data;};
    const a=frame(instanced),b=frame(merged);let changed=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>3)changed++;assert(changed<200,'pixel parity '+typeIndex+': '+changed);
    for(const m of [instanced,merged])m.setSelection(new Set(['instance5']));
    const selectedA=frame(instanced),selectedB=frame(merged);changed=0;for(let i=0;i<a.length;i++)if(Math.abs(selectedA[i]-selectedB[i])>3)changed++;assert(changed<200,'selection parity');
    blocks[5].secondaryColor='00ffffff';blocks[5].color='ff11ff22';for(const m of [instanced,merged])m.updateColors(model,new Set(['instance5']));
    const colorA=frame(instanced),colorB=frame(merged);changed=0;for(let i=0;i<a.length;i++)if(Math.abs(colorA[i]-colorB[i])>3)changed++;assert(changed<200,'color parity');
    world.add(instanced.group);world.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(2,2,20),new THREE.Vector3(0,0,-1));const hits=ray.intersectObjects(instanced.group.children.filter(m=>m.userData.textured));assert(hits[0]?.blockId==='instance5','instance picking '+typeIndex);world.remove(instanced.group);
    instanced.dispose();merged.dispose();
  }
  renderer.dispose();
});
await check('secondaryColor distinguishes absent and zero and survives XML edits and undo',async()=>{
  const {applyBlockColors}=await import('../src/block-colors.js');
  const text='<plan><item parent="-1" index="0"><block lx="-0.25" ly="-0.5" lz="-1.00000024" ux="0.75" uy="0.5" uz="-2.38418579e-007" index="122" material="0" look="1" up="3" color="ffbfaea3" secondaryColor="00000000" custom="keep"/></item></plan>';
  const model=parseAvorionXml(text,'colors.xml',text.length),s={model};assert(model.blocks[0].secondaryColor==='00000000','explicit zero');
  const patches=applyBlockColors(s,[{id:'b0',color:'80abcdef',secondaryColor:'40112233'}]);
  let saved=new XMLSerializer().serializeToString(model.doc);assert(saved.includes('secondaryColor="40112233"')&&saved.includes('custom="keep"'),'XML edited without data loss');
  applyBlockColors(s,patches.map(p=>p.before));saved=new XMLSerializer().serializeToString(model.doc);assert(saved.includes('secondaryColor="00000000"')&&saved.includes('color="ffbfaea3"'),'undo both channels');
  const removal=applyBlockColors(s,[{id:'b0',secondaryColor:undefined}]);assert(!model.blocks[0].el.hasAttribute('secondaryColor'),'absence distinct from zero');applyBlockColors(s,removal.map(p=>p.before));assert(model.blocks[0].el.getAttribute('secondaryColor')==='00000000','restore explicit zero');
});

await check('palette Apply and Undo update the rendered pixels without rebuilding geometry',async()=>{
  const {loadPalette}=await import('../src/color-palette.js'),{paintPaletteColor,undoPaint}=await import('../src/color-workshop.js');
  Object.assign(view,{projection:'perspective',yaw:0,pitch:0,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.model=makeModel([makeBlock({id:'paint',position:{x:0,y:0,z:0}})]);scene.revision++;scene.hiddenIds=new Set();scene.selectedIds=new Set();
  const d=ensureViewportOptions(view);Object.assign(d,{shading:'RENDERED',ambientOnly:true,ambientStrength:1,ambientDetail:0,showOverlays:false,objectOutline:false,shadows:false,dof:false});
  const sample=()=>{drawGame(ctx,scene,view,240,240,settings,1);return [...ctx.getImageData(120,120,1,1).data];};
  const before=sample(),revision=scene.revision;paintPaletteColor(scene,await loadPalette(),'Red',['paint']);const after=sample();
  assert(after[0]>after[1]+30,'viewport reflects red palette edit: '+after);assert(scene.revision===revision,'RGB edits must not invalidate geometry');
  undoPaint(scene);const restored=sample();assert(restored.every((v,i)=>Math.abs(v-before[i])<=1),'undo restores original pixels');delete view.display;
});

await check('detail magnifier crop agrees with viewport colors and preserves picking after panning in both projections',async()=>{
  const {projectPoint}=await import('../src/navigation.js');
  const lens=document.createElement('canvas');lens.width=lens.height=400;const lc=lens.getContext('2d',{willReadFrequently:true});lc.setTransform(2,0,0,2,0,0);
  scene.model=makeModel([makeBlock({id:'left',position:{x:-.2,y:0,z:0},size:{x:.4,y:1,z:.01},color:'ffff0000'}),makeBlock({id:'right',position:{x:.2,y:0,z:0},size:{x:.4,y:1,z:.01},color:'ff0000ff'})]);scene.revision++;scene.selectedIds=new Set();scene.hiddenIds=new Set();
  for(const projection of ['perspective','orthographic']){
    Object.assign(view,{projection,yaw:0,pitch:0,roll:0,zoom:1,target:[.03,0,0],panX:27,panY:-19,grid:false});
    Object.assign(ensureViewportOptions(view),{shading:'RENDERED',ambientOnly:true,ambientStrength:1,ambientDetail:0,showOverlays:false,objectOutline:false,shadows:false,dof:false});
    const crop={x:147,y:101,size:200,zoom:6};drawGame(ctx,scene,view,240,240,settings,1);const main=ctx.getImageData(0,0,240,240);
    drawGame(lc,scene,view,240,240,settings,2,crop);
    for(const [x,id] of [[-.2,'left'],[.2,'right']]){
      const p=projectPoint([x,0,0],view,240,240),offset=(Math.floor(p[1])*240+Math.floor(p[0]))*4;
      const actual=[...lc.getImageData(Math.floor(((p[0]-crop.x)*crop.zoom+100)*2),Math.floor(((p[1]-crop.y)*crop.zoom+100)*2),1,1).data];
      assert(actual.every((v,i)=>Math.abs(v-main.data[offset+i])<=2),projection+' crop sample '+id+': '+actual+' vs '+[...main.data.slice(offset,offset+4)]);
      assert(pickGame(scene,view,240,240,p[0],p[1],settings)===id,projection+' picking after cropped render');
    }
  }
  delete view.display;
});

await check('paint hover tints actual wedge surfaces, respects occlusion, and remains separate from selection and other views',async()=>{
  const {setPaintPreview}=await import('../src/game-renderer.js');
  const hoverView={...area().view,projection:'orthographic',yaw:0,pitch:0,roll:0,zoom:1,target:[0,0,0],panX:0,panY:0,grid:false};
  Object.assign(ensureViewportOptions(hoverView),{shading:'SOLID',ambientOnly:true,ambientStrength:1,ambientDetail:0,showOverlays:false,objectOutline:false,shadows:false,dof:false,background:'VIEWPORT',backgroundColor:'#111111'});
  const wedge=makeBlock({id:'wedge',typeIndex:100,position:{x:0,y:0,z:0},color:'ff993322'}),blocker=makeBlock({id:'blocker',position:{x:0,y:0,z:2},size:{x:.4,y:.4,z:.4},color:'ff22aa33'});
  const s={model:makeModel([wedge,blocker]),revision:1,loaded:true,visible:true,hiddenIds:new Set(),selectedIds:new Set(['blocker'])};
  const image=v=>{drawGame(ctx,s,v,240,240,settings,1);return ctx.getImageData(0,0,240,240).data;};
  const baseline=image(hoverView);setPaintPreview(hoverView,['wedge']);const highlighted=image(hoverView);let changed=0,background=0;
  for(let i=0;i<baseline.length;i+=4){const empty=[0,1,2].every(k=>Math.abs(baseline[i+k]-17)<2),delta=Math.max(...[0,1,2].map(k=>Math.abs(baseline[i+k]-highlighted[i+k])));if(empty){background++;assert(delta<3,'highlight must not fill empty space in wedge bounds');}if(delta>5)changed++;}
  assert(changed>200&&background>20000,'surface tint and surrounding background both exercised');
  const center=(120*240+120)*4;assert([0,1,2].every(k=>baseline[center+k]===highlighted[center+k]),'front block occludes preview');
  assert(s.selectedIds.size===1&&s.selectedIds.has('blocker')&&wedge.color==='ff993322','hover does not select or paint');
  const other=image(structuredClone(hoverView));assert(other.every((v,i)=>v===baseline[i]),'hover cannot leak into another viewport');
  setPaintPreview(hoverView,[]);assert(image(hoverView).every((v,i)=>v===baseline[i]),'clearing hover restores rendered pixels');
  s.hiddenIds=new Set(['wedge']);const hidden=image(hoverView);setPaintPreview(hoverView,['wedge']);assert(image(hoverView).every((v,i)=>v===hidden[i]),'hidden block remains hidden');
});

await check('glass attenuates exhaust behind it and leaves exhaust in front of it unattenuated',()=>{
  const p={...settings,shaderEngineState:1,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0};
  Object.assign(view,{projection:'orthographic',yaw:Math.PI/2,pitch:0,zoom:1.5,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.hiddenIds=new Set();scene.selectedIds=new Set();
  const d=ensureViewportOptions(view);Object.assign(d,{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#000000',showOverlays:false,objectOutline:false,shadows:false,dof:false,ambientOnly:false});
  // Black glass adds nothing itself, so any light left is exhaust seen through or in front of it.
  const engine=makeBlock({id:'engine',typeIndex:3,position:{x:0,y:0,z:0}}),glass=x=>makeBlock({id:'glass',typeIndex:170,color:'ff000000',size:{x:.5,y:6,z:14},position:{x,y:0,z:0}});
  const light=blocks=>{scene.model=makeModel(blocks);scene.revision++;drawGame(ctx,scene,view,240,240,p,1);const data=ctx.getImageData(0,0,240,240).data;let t=0;for(let i=0;i<data.length;i+=4)t+=data[i]+data[i+1]+data[i+2];return t;};
  const open=light([engine]),near=light([engine,glass(3)]),far=light([engine,glass(-3)]);
  assert(open>10000,'exhaust visible without glass: '+open);
  assert(near<open*.2,'two 70% glass faces in front must dim exhaust: '+near+' of '+open);
  assert(far>open*.9,'glass behind exhaust must not dim it: '+far+' of '+open);
  delete view.display;
});

await check('engine plumes follow engine state with fixed lengths and ignore covering blocks',()=>{
  const p={...settings,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderBloom:0,shaderAO:0,shaderSpill:0};
  // Side view: native Z runs across the image, so a plume's reach is its lit column span.
  Object.assign(view,{projection:'orthographic',yaw:Math.PI/2,pitch:0,zoom:.25,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.hiddenIds=new Set();scene.selectedIds=new Set();
  const d=ensureViewportOptions(view);Object.assign(d,{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#000000',showOverlays:false,objectOutline:false,shadows:false,dof:false,ambientOnly:false});
  const reach=(blocks,state)=>{scene.model=makeModel(blocks);scene.revision++;drawGame(ctx,scene,view,240,240,{...p,shaderEngineState:state},1);
    const data=ctx.getImageData(0,0,240,240).data;let lo=240,hi=-1,lit=0;
    for(let y=0;y<240;y++)for(let x=0;x<240;x++){const i=(y*240+x)*4;if(data[i]+data[i+1]+data[i+2]>24){lit++;lo=Math.min(lo,x);hi=Math.max(hi,x);}}
    return {lit,span:hi-lo+1,tip:Math.max(120-lo,hi-120)};};
  const small=[makeBlock({id:'engine',typeIndex:3,position:{x:0,y:0,z:0}})];
  const large=[makeBlock({id:'engine',typeIndex:3,size:{x:3,y:3,z:1},position:{x:0,y:0,z:0}})];
  const covered=[...small,makeBlock({id:'cover',size:{x:2,y:2,z:1},position:{x:0,y:0,z:-1},color:'ff000000'})];
  assert(reach(small,0).lit<200,'idle engines show no plume');
  const cruise=reach(small,1),boost=reach(small,2),big=reach(large,1),blocked=reach(covered,1);
  const ratio=(boost.span-cruise.span)/cruise.span;
  assert(boost.span>cruise.span*1.6,'boost plume is about twice the cruise plume: '+cruise.span+' -> '+boost.span);
  assert(Math.abs(big.span-cruise.span)<=cruise.span*.12,'plume length does not scale with engine size: '+cruise.span+' vs '+big.span+' ('+ratio.toFixed(2)+')');
  // The cover hides the plume's first unit from the side; the far tip must still reach as far.
  assert(blocked.lit>cruise.lit*.5&&Math.abs(blocked.tip-cruise.tip)<=2,'a block covering the engine does not hide its plume: tip '+blocked.tip+' vs '+cruise.tip);
  const thin=[makeBlock({id:'engine',typeIndex:3,size:{x:2,y:2,z:0}})];
  view.showThinBlocks=false;
  const thinReach=reach(thin,1);assert(thinReach.lit>20,'zero-depth engine still emits when its body is filtered: '+JSON.stringify(thinReach));
  p.shaderThinEnginePlumes=false;assert(reach(thin,1).lit<20,'plume toggle hides filtered engine effects');
  p.shaderThinEnginePlumes=true;scene.hiddenIds=new Set(['engine']);assert(reach(thin,1).lit<20,'manual engine hiding also hides effects');
  scene.hiddenIds=new Set();delete view.showThinBlocks;
  delete view.display;
});

await check('Rendered bloom spreads bright emission and turns off cleanly',()=>{
  const p={...settings,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0};
  Object.assign(view,{projection:'orthographic',yaw:Math.PI,pitch:0,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.hiddenIds=new Set();scene.selectedIds=new Set();
  const d=ensureViewportOptions(view);Object.assign(d,{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#000000',showOverlays:false,objectOutline:false,shadows:false,dof:false,ambientOnly:false});
  scene.model=makeModel([makeBlock({id:'engine',typeIndex:3,position:{x:0,y:0,z:0}})]);scene.revision++;
  const frame=bloom=>{drawGame(ctx,scene,view,240,240,{...p,shaderBloom:bloom},1);return ctx.getImageData(0,0,240,240).data;};
  const lit=data=>{let n=0;for(let i=0;i<data.length;i+=4)n+=data[i]+data[i+1]+data[i+2]>30;return n;};
  const off=frame(0),on=frame(1.5),again=frame(0);
  assert(lit(on)>lit(off)*1.1,'bloom must spread light past the emitter: '+lit(off)+' -> '+lit(on));
  assert(again.every((v,i)=>v===off[i]),'bloom 0 restores the unbloomed frame');
  d.objectOutline=true;const outlined=frame(0);assert(lit(outlined)<=lit(off)+400,'post path without bloom adds no glow');
  delete view.display;
});

await check('ambient occlusion darkens an inside corner and turns off cleanly',()=>{
  Object.assign(view,{projection:'perspective',yaw:Math.PI*.25,pitch:.5,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.hiddenIds=new Set();scene.selectedIds=new Set();
  const d=ensureViewportOptions(view);Object.assign(d,{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#000000',showOverlays:false,objectOutline:false,shadows:false,dof:false,ambientOnly:false});
  // An L-shaped pair: a floor slab with a wall standing on it.
  scene.model=makeModel([makeBlock({id:'floor',size:{x:8,y:1,z:8},position:{x:0,y:-.5,z:0}}),makeBlock({id:'wall',size:{x:1,y:4,z:8},position:{x:-3.5,y:2,z:0}})]);scene.revision++;
  const frame=ao=>{drawGame(ctx,scene,view,240,240,{...settings,shaderAO:ao,shaderAORadius:1.5,shaderSpill:0,shaderBloom:0},1);return ctx.getImageData(0,0,240,240).data;};
  const off=frame(0),on=frame(2),again=frame(0);
  let darker=0,lighter=0;for(let i=0;i<off.length;i+=4){const delta=on[i]+on[i+1]+on[i+2]-off[i]-off[i+1]-off[i+2];if(delta<-15)darker++;if(delta>3)lighter++;}
  assert(darker>100,'corner pixels must darken: '+darker);assert(lighter===0,'AO never brightens: '+lighter);
  assert(again.every((v,i)=>v===off[i]),'AO 0 restores the original frame');
  delete view.display;
});
await check('light spill lights hull near a light block and respects hiding and radius',()=>{
  const p={...settings,shaderAmbient:0,shaderSkyAmbient:0,shaderLight:0,shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderAO:0,shaderBloom:0};
  Object.assign(view,{projection:'orthographic',yaw:0,pitch:Math.PI/2,zoom:1,target:[0,0,0],panX:0,panY:0,roll:0,grid:false});
  scene.selectedIds=new Set();
  const d=ensureViewportOptions(view);Object.assign(d,{shading:'RENDERED',background:'VIEWPORT',backgroundColor:'#000000',showOverlays:false,objectOutline:false,shadows:false,dof:false,ambientOnly:false});
  // Light block standing on a wide plate, its light facing up and away from the plate.
  scene.model=makeModel([makeBlock({id:'plate',size:{x:20,y:1,z:20},position:{x:0,y:-.5,z:0}}),makeBlock({id:'lamp',typeIndex:61,look:1,up:5,size:{x:.5,y:.5,z:.5},position:{x:0,y:.25,z:0},secondaryColor:'ffffffff'})]);scene.revision++;
  const lit=(q,hidden=new Set())=>{scene.hiddenIds=hidden;drawGame(ctx,scene,view,240,240,{...p,...q},1);const data=ctx.getImageData(0,0,240,240).data;let t=0;for(let i=0;i<data.length;i+=4)t+=data[i]+data[i+1]+data[i+2];return t;};
  const dark=lit({shaderSpill:0}),spill=lit({shaderSpill:1,shaderSpillRadius:5}),wide=lit({shaderSpill:1,shaderSpillRadius:8}),hidden=lit({shaderSpill:1,shaderSpillRadius:5},new Set(['lamp']));
  assert(spill>dark*1.5+20000,'spill must light the plate: '+dark+' -> '+spill);
  assert(wide>spill,'larger radius reaches more hull: '+spill+' -> '+wide);
  assert(hidden<dark+5000,'hidden light casts no spill: '+hidden+' vs '+dark);
  scene.hiddenIds=new Set();delete view.display;
});

document.querySelector('#status').textContent=`${passed} passed · ${failed} failed`;
document.body.dataset.result=failed?'fail':'pass';

