import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';

// Bind only to loopback and serve the app and test assets from this checkout.
const root=resolve('.'),server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)||!/^\/(src|tests)\//.test(pathname)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.goto(base+'/tests/image-export.html');
  // Exercise actual native artwork without copying game assets into the app.
  const textures=[];
  for(const name of ['thruster','thruster_n'])textures.push({name,bytes:[...await readFile(`C:/Program Files (x86)/Steam/steamapps/common/Avorion/AvorionGame/data/textures/blocks/${name}.png`)]});
  const result=await page.evaluate(async textures=>{
    const {makeBlock,makeModel}=await import('/src/block-model.js');
    const {drawGame,textureLibrary,releaseGameModel}=await import('/src/game-renderer.js');
    const {area}=await import('/src/layout.js');
    const {FACTORY_PREFERENCES}=await import('/src/preferences.js');
    await textureLibrary.loadFiles(textures.map(({name,bytes})=>new File([new Uint8Array(bytes)],name+'.png',{type:'image/png'})));
    const canvas=document.querySelector('canvas');canvas.width=900;canvas.height=480;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const view={...area().view,imageTime:.7,grid:false,projection:'orthographic',yaw:Math.PI/2,pitch:.3,zoom:1.2,target:[0,0,0],panX:0,panY:0};
    const scene={model:makeModel([makeBlock({typeIndex:7,size:{x:4,y:2,z:4},color:'ffaaaaaa',secondaryColor:'ffff8800'})]),loaded:true,visible:true,revision:500,hiddenIds:new Set(),selectedIds:new Set()};
    const prefs={...FACTORY_PREFERENCES,shaderThrust:0,shaderBloom:0,shaderAO:0,shaderSpill:0};
    const render=(value,directions={})=>{drawGame(ctx,scene,view,900,480,{...prefs,shaderThrust:value,...directions},1);return new Uint8Array(ctx.getImageData(0,0,900,480).data);};
    const idle=render(0),partial=render(.1),full=render(1);
    let different=0,partialDifference=0;
    for(let i=0;i<idle.length;i++){if(idle[i]!==full[i])different++;if(partial[i]!==full[i])partialDifference++;}
    const {THRUSTER_DIRECTIONS}=await import('/src/thruster-settings.js');
    const off=Object.fromEntries(THRUSTER_DIRECTIONS.map(d=>[d.key,false]));
    const none=render(1,off);
    if(none.some((v,i)=>v!==idle[i]))throw Error('Disabling every direction must match inactive thrusters');
    for(const {key,name} of THRUSTER_DIRECTIONS){
      const angles={Front:[.3,.3],Back:[Math.PI+.3,.3],Left:[-Math.PI/2+.3,.3],Right:[Math.PI/2+.3,.3],Top:[.3,1.2],Bottom:[.3,-1.2]};
      [view.yaw,view.pitch]=angles[name];
      const directionIdle=render(0),directionFull=render(1);
      const single=render(1,{...off,[key]:true});
      if(!single.some((v,i)=>v!==directionIdle[i]))throw Error(name+' direction must emit');
      if(!single.some((v,i)=>v!==directionFull[i]))throw Error(name+' direction must exclude other faces');
    }
    view.yaw=Math.PI/2;view.pitch=.3;
    render(1);
    releaseGameModel();
    return {different,partialDifference,textureCount:textureLibrary.loadedCount};
  },textures);
  assert.ok(result.different>100,'active plumes must render');
  assert.equal(result.partialDifference,0,'legacy partial values must render at full thrust');
  assert.equal(result.textureCount>=2,true);
  await mkdir('test-results/images',{recursive:true});
  await page.locator('canvas').screenshot({path:'test-results/images/thruster-active.png'});
  const ui=await page.evaluate(async()=>{
    const {createPreferencesStore}=await import('/src/preferences.js');
    const {mountPreferences}=await import('/src/preferences-editor.js');
    const {mountThrusterState}=await import('/src/scene-properties.js');
    const {THRUSTER_DIRECTIONS}=await import('/src/thruster-settings.js');
    const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},store=createPreferencesStore(storage);
    const prefs=document.createElement('div'),side=document.createElement('div');document.body.append(prefs,side);
    const editor=mountPreferences(prefs,store,{category:'thrusters'});
    mountThrusterState(side,store);
    const unsubscribe=store.subscribe(()=>{
      side.querySelector('[data-thruster-state]').value=store.value.shaderThrust;
      for(const input of side.querySelectorAll('[data-thruster-direction]')){input.checked=store.value[input.dataset.thrusterDirection];input.disabled=!store.value.shaderThrust;}
    });
    const master=side.querySelector('[aria-label="Scene thruster state"]');
    const check=(value,message)=>{if(!value)throw Error(message);};
    for(const {key} of THRUSTER_DIRECTIONS)check(prefs.querySelector(`[data-preference="${key}"]`).disabled,'Directions disabled initially');
    store.set('shaderEngineState',2);master.value='1';master.dispatchEvent(new Event('change'));
    check(store.value.shaderEngineState===2,'Thrusters must not change engines');
    for(const {key,name} of THRUSTER_DIRECTIONS){
      const input=prefs.querySelector(`[data-preference="${key}"]`);check(!input.disabled,'Preferences direction enabled');
      input.checked=false;input.dispatchEvent(new Event('change'));
      check(!side.querySelector(`[aria-label="Scene thruster ${name.toLowerCase()}"]`).checked,'Sidebar follows Preferences');
    }
    const front=side.querySelector('[aria-label="Scene thruster front"]');front.checked=true;front.dispatchEvent(new Event('change'));
    check(prefs.querySelector('[data-preference="shaderThrustFront"]').checked,'Preferences follows sidebar');
    const saved=createPreferencesStore(storage);check(saved.value.shaderThrust===1&&saved.value.shaderThrustFront&&!saved.value.shaderThrustBack,'Direction settings persist');
    store.set('shaderThrust',0);check(front.disabled&&front.checked,'Off disables controls and preserves selection');
    unsubscribe();editor.dispose();return 'Preferences/sidebar synchronization, persistence, and independent engine state passed';
  });
  console.log(ui);
  const materials=await page.evaluate(async()=>{
    const {makeBlock,makeModel,nativeToView}=await import('/src/block-model.js');
    const {drawGame,releaseGameModel}=await import('/src/game-renderer.js');
    const {area}=await import('/src/layout.js');
    const {FACTORY_PREFERENCES}=await import('/src/preferences.js');
    const {projectPoint}=await import('/src/navigation.js');
    const {getMaterial}=await import('/src/avorion/lib/avorion/blockDefinitions.js');
    const order=[6,5,4,3,2,1,0],blocks=order.map((materialIndex,i)=>makeBlock({id:'material'+i,typeIndex:7,materialIndex,color:'ff696969',secondaryColor:'00000000',position:{x:0,y:0,z:(3-i)*1.6},size:{x:1,y:1,z:1}}));
    const scene={model:makeModel(blocks),loaded:true,visible:true,revision:900,hiddenIds:new Set(),selectedIds:new Set()};
    const canvas=document.querySelector('canvas');canvas.width=1200;canvas.height=330;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const view={...area().view,imageTime:.7,grid:false,projection:'orthographic',yaw:Math.PI/2,pitch:0,zoom:1.8,orthographicDistance:30,target:[0,0,0],panX:0,panY:0,display:{...area().view.display,shading:'RENDERED',focalLength:50}};
    const prefs={...FACTORY_PREFERENCES,shaderEngineState:0,shaderAO:0,shaderSpill:0,shaderBloom:.6,shaderThrustRight:true,shaderThrustLeft:false,shaderThrustFront:false,shaderThrustBack:false,shaderThrustTop:false,shaderThrustBottom:false};
    drawGame(ctx,scene,view,1200,330,{...prefs,shaderThrust:0},1);const idle=ctx.getImageData(0,0,1200,330).data;
    drawGame(ctx,scene,view,1200,330,{...prefs,shaderThrust:1},1);const active=ctx.getImageData(0,0,1200,330).data;
    const colors=blocks.map(b=>{const [x,y]=projectPoint(nativeToView([.5,0,b.position.z]),view,1200,330),rgb=[0,0,0];for(let dy=-16;dy<=16;dy++)for(let dx=-16;dx<=16;dx++){const offset=(Math.round(y+dy)*1200+Math.round(x+dx))*4;for(let c=0;c<3;c++)rgb[c]+=Math.max(0,active[offset+c]-idle[offset+c]);}return {material:getMaterial(b.materialIndex).name,rgb};});
    function label(){ctx.fillStyle='white';ctx.font='14px sans-serif';for(const b of blocks){const [x,y]=projectPoint(nativeToView([.5,0,b.position.z]),view,1200,330);ctx.fillText(getMaterial(b.materialIndex).name,x-25,y+65);}}
    label();const front=canvas.toDataURL();view.yaw=.9;drawGame(ctx,scene,view,1200,330,{...prefs,shaderThrust:1},1);label();const oblique=canvas.toDataURL();releaseGameModel();return {front,oblique,colors};
  });
  for(const [name,value] of Object.entries(materials))if(typeof value==='string')await (await import('node:fs/promises')).writeFile('test-results/images/thruster-materials-'+name+'.png',Buffer.from(value.split(',')[1],'base64'));
  for(const {material,rgb} of materials.colors)assert.ok(rgb.reduce((a,b)=>a+b,0)>100,material+' plume must activate');
  const color=name=>materials.colors.find(c=>c.material===name).rgb;
  assert.ok(color('Avorion')[0]>color('Avorion')[1]);assert.ok(color('Trinium')[2]>color('Trinium')[0]);assert.ok(color('Naonite')[1]>color('Naonite')[0]);
  console.log('Seven material plume colors rendered:',materials.colors);

  assert.deepEqual(errors,[]);console.log('Thruster WebGL checks:',result);
}finally{await browser.close();await new Promise(r=>server.close(r));}
