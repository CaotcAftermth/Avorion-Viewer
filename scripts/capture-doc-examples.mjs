// Reproducible documentation fixture and captures. No third-party ship assets.
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import http from 'node:http';
import {viewerHandler} from './serve.mjs';
await mkdir('docs/site/examples',{recursive:true});await mkdir('docs/site/assets',{recursive:true});
let items=[],id=0;
function block(x,y,z,sx,sy,sz,color='ff969da4') {items.push(`<item index="${id}" parent="${id++===0?-1:0}"><block index="2" material="0" look="1" up="3" color="${color}" lx="${x-sx/2}" ly="${y-sy/2}" lz="${z-sz/2}" ux="${x+sx/2}" uy="${y+sy/2}" uz="${z+sz/2}"/></item>`);}
for(let z=-7;z<=7;z+=2){const width=z>4?1:2;for(let x=-width;x<=width;x++)block(x*2,0,z,2,1.4,2);}
for(const x of [-5,5]){for(let z=-5;z<=3;z+=2)block(x,.2,z,1.2,1.2,1.8,'ff626a73');block(x,-.1,-7,1.4,1.5,1.4,'ff263c4b');}
block(0,1.35,-2,4,1.3,5);block(0,2.4,-3,2.7,.8,2,'ff354a59');block(0,2.4,-1.7,2.6,.6,.3,'ff70d9e1');
const xml=`<?xml version="1.0"?><ship name="Tutorial Courier"><plan>${items.join('')}</plan></ship>`;
await writeFile('docs/site/examples/tutorial-ship.xml',xml);
const handler=viewerHandler('.');const server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1440,height:920},deviceScaleFactor:3});const root=`http://127.0.0.1:${server.address().port}`;
await page.addInitScript(()=>localStorage.setItem('avorion-viewer.input-style-chosen.v1','1'));await page.goto(root);
const outputs=await page.evaluate(async xml=>{
 const {parseAvorionXml}=await import('/src/block-model.js');const {area,defaults,split}=await import('/src/layout.js');const {FACTORY_PREFERENCES}=await import('/src/preferences.js');
 const {captureImage,imageDefaults}=await import('/src/export/image-options.js');const {exportImage}=await import('/src/export/image-pipeline.js');const {recordBlockColors}=await import('/src/color-workshop.js');const {openSessionStore,snapshotModel}=await import('/src/session-persistence.js');
 const scene={model:parseAvorionXml(xml,'Tutorial Courier.xml',xml.length),loaded:true,selectedIds:new Set(),hiddenIds:new Set(),visible:true,revision:1};
 const node=area();node.view.zoom=.1;node.view.grid=false;node.view.yaw=.65;node.view.pitch=.48;
 const pref={...FACTORY_PREFERENCES};const imageData={};
 const render=async(name,type='viewport')=>{const opts={...imageDefaults(node.view,1100,650,type),framing:'fit',camera:'isometric',projection:'orthographic',background:type==='transparent'?'transparent':'solid',backgroundColor:type==='blueprint'?'#10283f':'#202a30',overlays:false,gizmos:false,selection:false,grid:false,labels:false,dimensions:false,titleBlock:type==='blueprint',pageGrid:type==='blueprint',shipName:'Tutorial Courier'};const result=await exportImage(captureImage(scene,node.view,pref,{width:1100,height:650}),opts);return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(result.blob);});};
 imageData.before=await render('before');
 const selected=scene.model.blocks.filter(b=>Math.abs(b.position.x)>4.5&&b.position.z>-6);
 recordBlockColors(scene,selected.map(b=>({id:b.id,color:'ff23bdb3'})),'Teal side panels');
 imageData.after=await render('after');imageData.transparent=await render('transparent','transparent');imageData.blueprint=await render('blueprint','blueprint');
 await openSessionStore().put('model',snapshotModel(scene));
 const layout=defaults();const props=area('properties'),out=area('outliner');layout.workspaces[0].root=split('x',.75,node,split('y',.45,out,props));
 localStorage.setItem('avorion-viewer.window-system.v1',JSON.stringify(layout));
 return imageData;
},xml);
for(const [name,data]of Object.entries(outputs))await writeFile(`docs/site/assets/tutorial-${name==='after'?'render':name}.png`,Buffer.from(data.split(',')[1],'base64'));
// Compose actual renderer outputs on a labeled comparison sheet, with transparent output on a checkerboard.
const compose=async(panels,width,height)=>page.evaluate(async({panels,width,height})=>{const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle='#202a30';ctx.fillRect(0,0,width,height);const w=width/panels.length;for(let i=0;i<panels.length;i++){const p=panels[i];for(let x=i*w+12;x<(i+1)*w-12;x+=16)for(let y=12;y<height-57;y+=16){ctx.fillStyle=(Math.round((x-i*w-12)/16)+Math.round((y-12)/16))%2?'#3a444a':'#30393f';ctx.fillRect(x,y,16,16);}const img=new Image();img.src=p.data;await img.decode();ctx.drawImage(img,i*w+12,12,w-24,height-75);ctx.fillStyle='#e8eeeb';ctx.font='600 20px system-ui';ctx.fillText(p.label,i*w+20,height-24);}return c.toDataURL('image/png');},{panels,width,height});
const paint=await compose([{label:'Before · gray side panels',data:outputs.before},{label:'After · teal side panels',data:outputs.after}],1400,500);await writeFile('docs/site/assets/paint-comparison.png',Buffer.from(paint.split(',')[1],'base64'));
const exports=await compose([{label:'Screenshot · solid background',data:outputs.after},{label:'Transparent render · PNG alpha',data:outputs.transparent},{label:'Blueprint · technical shading',data:outputs.blueprint}],1500,425);await writeFile('docs/site/assets/export-comparison.png',Buffer.from(exports.split(',')[1],'base64'));
await page.reload();await page.locator('#main-menu button').first().waitFor();await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await page.waitForTimeout(500);await page.screenshot({path:'docs/site/assets/workspace.png'});
await page.getByLabel('Interaction mode',{exact:true}).first().selectOption('paint');await page.waitForTimeout(300);await page.screenshot({path:'docs/site/assets/paint-workspace.png'});
await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('menuitem',{name:'Advanced Export…',exact:true}).click();const dialog=page.locator('.export-dialog');await dialog.getByRole('button',{name:'Image Export',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.image-export img')?.src?.startsWith('blob:'),{},{timeout:60000});await dialog.screenshot({path:'docs/site/assets/image-export-dialog.png'});
await writeFile('docs/site/assets/capture-notes.json',JSON.stringify({fixture:'../examples/tutorial-ship.xml',method:'Actual application renderer via captureImage/exportImage; comparison sheets contain labeled outputs',paint:'recordBlockColors: side panels at |x| > 4.5 and z > -6 change from ff626a73 to ff23bdb3',camera:'isometric orthographic, fitted, 1100 × 650',sourceVersion:JSON.parse(await readFile('package.json','utf8')).version},null,2));
console.log('Captured tutorial render, before/after, transparent output, blueprint and current workspace.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
