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
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/tests/image-export.html');await page.addStyleTag({content:await readFile('src/styles.css','utf8')});
 await page.evaluate(async()=>{
  const {makeBlock,makeModel,nativeToView}=await import('/src/block-model.js'),{socketFaces,orientSocket,socketNormalChoices}=await import('/src/components/socket-face.js'),{savedSocket}=await import('/src/components/core.js'),{createSocketEditor}=await import('/src/components/socket-editor.js'),{projectPoint}=await import('/src/navigation.js');
  document.body.replaceChildren();const host=document.createElement('div');host.className='viewport';Object.assign(host.style,{position:'relative',width:'900px',height:'700px'});const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Socket drafting preview');host.append(canvas);document.body.append(host);
  const block=makeBlock({id:'fixture',typeIndex:100,position:{x:0,y:0,z:0},size:{x:3,y:2,z:2}}),model=makeModel([block]),face=socketFaces(block).find(f=>f.triangles.length===1),socket=savedSocket(model,orientSocket(face,socketNormalChoices(face)[0].normal));socket.faceId=face.faceId;model.componentSetup={version:1,blockType:null,sockets:[socket],mounts:[]};const scene={model,loaded:true,visible:true,revision:1},view={tool:'sockets',yaw:.5,pitch:.3,roll:0,zoom:1,target:[0,0,0],panX:0,panY:0,projection:'orthographic',display:{focalLength:50}};
  const f={scene,view,face,underlay:'#ffffff'};window.fixture=f;
  f.draw=()=>{const r=canvas.getBoundingClientRect();if(canvas.width!==r.width||canvas.height!==r.height){canvas.width=r.width;canvas.height=r.height;}const ctx=canvas.getContext('2d');ctx.fillStyle=f.underlay;ctx.fillRect(0,0,r.width,r.height);f.editor.draw(ctx,r.width,r.height);};
  f.editor=createSocketEditor(canvas,scene,view,{pick:()=>null,invalidate:()=>requestAnimationFrame(f.draw),changed:()=>{}});f.draw();window.dispatchEvent(new CustomEvent('component-socket-edit',{detail:socket.id}));
  f.sample=()=>{
   f.draw();const r=canvas.getBoundingClientRect(),triangle=face.triangles[0].map(p=>projectPoint(nativeToView(p),view,r.width,r.height)),ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const min=[0,1].map(i=>Math.ceil(Math.min(...triangle.map(p=>p[i])))),max=[0,1].map(i=>Math.floor(Math.max(...triangle.map(p=>p[i]))));let hash=2166136261,count=0;
   for(let x=min[0];x<=max[0];x+=2)for(let y=min[1];y<=max[1];y+=2){
    const distances=triangle.map((a,i)=>{const b=triangle[(i+1)%3];return ((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1]);});if(!distances.every(n=>n>4)&&!distances.every(n=>n< -4))continue;
    const offset=(y*canvas.width+x)*4;for(let i=0;i<4;i++)hash=Math.imul(hash^data[offset+i],16777619);count++;
   }
   return {hash:hash>>>0,count};
  };

 });
 async function opacity(label,value){const input=page.getByLabel(label,{exact:true});await input.dblclick();await input.fill(value);await input.press('Enter');assert.equal(await input.getAttribute('readonly'),'');}
 await page.getByLabel('Positioning',{exact:true}).selectOption('grid');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const light=await page.evaluate(()=>{fixture.underlay='#ffffff';return fixture.sample();}),dark=await page.evaluate(()=>{fixture.underlay='#000000';return fixture.sample();});assert.deepEqual(light,dark,'drafting surface and guides are identical under bright and dark scene lighting');
 assert.equal(await page.locator('.socket-appearance-settings').evaluate(el=>el.open),true,'Display defaults expanded');
 for(const [label,value] of [['Grid color','#ff8844'],['Background color','#334466']]){await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).dispatchEvent('input');}
 for(const [label,value] of [['Grid opacity','75'],['Background opacity','40']]){await opacity(label,value);}
 const customized=await page.evaluate(()=>fixture.sample());assert.notDeepEqual(customized,dark,'appearance controls change guide rendering');assert.ok(customized.count>1000,'compare background, lines, and marker pixels across the face');
 await opacity('Grid opacity','0');assert.notDeepEqual(await page.evaluate(()=>fixture.sample()),customized,'grid opacity changes rendered grid pixels');await opacity('Grid opacity','75');
 const slider=page.getByLabel('Grid opacity',{exact:true}),sliderBox=await slider.boundingBox();await page.mouse.move(sliderBox.x+sliderBox.width/2,sliderBox.y+sliderBox.height/2);await page.mouse.down();await page.mouse.move(sliderBox.x+sliderBox.width/2+8,sliderBox.y+sliderBox.height/2);await page.mouse.up();assert.equal(await slider.inputValue(),'83','shared slider drag updates opacity');await opacity('Grid opacity','75');await slider.dblclick();await slider.fill('45');await slider.press('Escape');assert.equal(await slider.inputValue(),'75','Esc restores opacity');assert.equal(await page.locator('.socket-edit-strip').isVisible(),true,'Esc cancels numeric edit without closing socket editor');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('avorion-viewer.socket-appearance.v1')));assert.deepEqual(stored,{gridColor:'#ff8844',gridOpacity:.75,backgroundColor:'#334466',backgroundOpacity:.4});
 await opacity('Background opacity','0');
 const transparentLight=await page.evaluate(()=>{fixture.underlay='#ffffff';return fixture.sample();}),transparentDark=await page.evaluate(()=>{fixture.underlay='#000000';return fixture.sample();});assert.deepEqual(transparentLight,transparentDark,'zero tint opacity retains an unlit face underneath');
 await opacity('Background opacity','40');await page.evaluate(()=>fixture.draw());
 assert.equal(await page.getByLabel('Grid opacity',{exact:true}).evaluate(el=>el.classList.contains('numeric-field')),true);
 const fillMatch=await page.evaluate(()=>{const reference=document.createElement('div');reference.className='shader-value-row';reference.style.setProperty('--value-fill','75%');document.body.append(reference);const standard=getComputedStyle(reference).backgroundImage,opacity=getComputedStyle(document.querySelector('[aria-label="Grid opacity"]')).backgroundImage,fill=standard.match(/rgb\([^)]*\)/)?.[0];reference.remove();return !!fill&&opacity.includes(fill);});assert.equal(fillMatch,true,'socket slider fill matches standard app sliders');
 await page.getByLabel('Cell shape',{exact:true}).selectOption('equal');await page.evaluate(()=>fixture.draw());await page.screenshot({path:'test-results/images/socket-equal-triangle-grid.png'});
 await page.screenshot({path:'test-results/images/socket-unlit-display-settings.png'});
 await page.getByLabel('Positioning',{exact:true}).selectOption('center');assert.equal(await page.getByLabel('Grid opacity',{exact:true}).isVisible(),false);assert.equal(await page.getByLabel('Grid color',{exact:true}).isVisible(),false);assert.equal(await page.getByLabel('Background opacity',{exact:true}).isVisible(),true);await page.getByLabel('Positioning',{exact:true}).selectOption('free');assert.equal(await page.getByLabel('Grid opacity',{exact:true}).isVisible(),false);await page.getByLabel('Positioning',{exact:true}).selectOption('grid');
 await page.evaluate(async()=>{const {createSocketEditor}=await import('/src/components/socket-editor.js');fixture.editor.dispose();fixture.editor=createSocketEditor(document.querySelector('canvas'),fixture.scene,fixture.view,{pick:()=>null,invalidate:()=>requestAnimationFrame(fixture.draw),changed:()=>{}});window.dispatchEvent(new CustomEvent('component-socket-edit',{detail:fixture.scene.model.componentSetup.sockets[0].id}));});
 await page.getByLabel('Positioning',{exact:true}).selectOption('grid');assert.equal(await page.locator('.socket-appearance-settings').evaluate(el=>el.open),true,'Display defaults expanded');assert.equal(await page.getByLabel('Grid color',{exact:true}).inputValue(),'#ff8844');assert.equal(await page.getByLabel('Grid opacity',{exact:true}).inputValue(),'75');assert.equal(await page.getByLabel('Background opacity',{exact:true}).inputValue(),'40');
 assert.deepEqual(errors,[]);await page.evaluate(()=>fixture.editor.dispose());console.log('Lighting-independent drafting pixels, color/opacity controls, zero-opacity stability, and stored appearance preferences passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
