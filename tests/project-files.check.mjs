import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const origin='http://localhost:5173';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain','.svg':'image/svg+xml','.png':'image/png','.bmp':'image/bmp','.wasm':'application/wasm'};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-crash-reporter','--disable-crashpad','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];

async function openPage(){
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.type()==='prompt'?dialog.accept(dialog.defaultValue()):dialog.accept());
  await page.route(`${origin}/**`,async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const file=pathname==='/'?'index.html':pathname.slice(1);
    if(file!=='index.html'&&file!=='favicon.svg'&&!file.startsWith('src/'))return route.abort();
    const body=await readFile(resolve(file)).catch(()=>null);
    return body?route.fulfill({body,contentType:types[extname(file)]||'application/octet-stream'}):route.fulfill({status:404});
  });
  await page.goto(origin);
  await page.getByRole('button',{name:'File',exact:true}).waitFor();
  await page.getByRole('button',{name:'Close welcome',exact:true}).click();
  return page;
}

async function menu(page,label){
  await page.getByRole('button',{name:'File',exact:true}).click();
  await page.locator('#menu').getByText(label,{exact:true}).click({timeout:6000});
}
async function upload(page,label,name,content){
  const chooser=page.waitForEvent('filechooser');
  await menu(page,label);
  await (await chooser).setFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(content)});
}
async function download(page,label){
  return downloadWith(page,()=>menu(page,label));
}
async function downloadWith(page,action){
  // Browser download writes can be blocked by the runner. Check the download
  // event and read its Blob before it is handed to the file system.
  await page.evaluate(()=>{
    window.capturedSave=null;
    if(window.captureSaveInstalled)return;
    window.captureSaveInstalled=true;
    const create=URL.createObjectURL;
    URL.createObjectURL=function(blob){
      if(blob.type==='application/json')window.capturedSave=blob.text();
      return create.call(this,blob);
    };
  });
  await Promise.all([page.waitForEvent('download',{timeout:10000}),action()]);
  return page.evaluate(()=>window.capturedSave);
}
async function recovered(page){
  return page.evaluate(async()=>{
    const {openSessionStore}=await import('/src/session-persistence.js');
    return openSessionStore().get('model');
  });
}

const source='<ship><plan><item index="7" parent="-1"><block index="20" lx="0" ly="0" lz="0" ux="4" uy="4" uz="4" color="ff123456" custom="keep"/></item><item index="2" parent="7"><block index="2" lx="8" ly="0" lz="0" ux="10" uy="4" uz="4" color="ff102030"/></item></plan></ship>';
const revised='<ship><plan><item index="2" parent="-1"><block index="2" lx="16" ly="0" lz="0" ux="20" uy="4" uz="4" color="ff102030"/></item><item index="7" parent="2"><block index="20" lx="0" ly="0" lz="0" ux="8" uy="4" uz="4" color="ff887766" custom="keep"/></item></plan></ship>';

try{
  const first=await openPage();
  await first.evaluate(async xml=>{
    const {parseAvorionXml}=await import('/src/block-model.js');
    const {applyBlockColors}=await import('/src/block-colors.js');
    const {snapshotModel,openSessionStore}=await import('/src/session-persistence.js');
    const {sceneSockets}=await import('/src/turrets/sockets.js');
    const {demoProject}=await import('/src/turrets/core.js');
    const {placeTurret}=await import('/src/turrets/mounts.js');
    const model=parseAvorionXml(xml,'Source.xml',xml.length);
    const scene={model,loaded:true,regions:[{id:'engine',name:'Engine',color:'#00bbcc',ids:['b0']},{id:'overlap',name:'Overlap',color:'#aa00cc',ids:['b0','b1']}]};
    applyBlockColors(scene,[{id:'b0',color:'ffaabbcc',secondaryColor:'00000000'}],{writeXml:false});
    const socket=sceneSockets(scene).find(socket=>socket.fitSize>=1);
    placeTurret(scene,demoProject().assets[0],socket,1,1);
    await openSessionStore().put('model',snapshotModel(scene));
  },source);
  await first.reload();
  await first.waitForFunction(()=>document.querySelector('.project-title').textContent.includes('Source.xml'));
  const project=await download(first,'Save Project…');
  const projectData=JSON.parse(project);
  assert.equal(projectData.model.sourceXml,source);
  assert.equal(projectData.model.xml,undefined);
  assert.deepEqual(projectData.model.paint,[{id:'b0',color:'ffaabbcc',secondaryColor:'00000000'}]);
  assert.equal(projectData.model.regions.length,2);
  assert.equal(projectData.model.turretMounts.length,1);
  const workspace=await download(first,'Export Workspace Profile…');
  const profile=JSON.parse(workspace);
  assert.equal(typeof profile.shaders.shaderBloom,'number');
  profile.shaders.shaderBloom=.55;

  const clean=await openPage();
  await upload(clean,'Open Project…','Source.avproject',project);
  await clean.waitForFunction(()=>document.querySelector('.project-title').textContent==='Source · Project');
  const originalPaint=await clean.evaluate(async record=>{
    const {restoreProject}=await import('/src/project-files.js');
    const {originalBlockColors,exportPaintedXml}=await import('/src/color-workshop.js');
    const {model}=restoreProject(record);
    return {original:originalBlockColors(model,model.blocks[0]),working:model.blocks[0].color,export:exportPaintedXml(model)};
  },projectData);
  assert.equal(originalPaint.original.color,'ff123456');
  assert.equal(originalPaint.working,'ffaabbcc');
  assert.match(originalPaint.export,/custom="keep"/);
  assert.match(originalPaint.export,/color="ffaabbcc"/);
  await upload(clean,'Import Workspace Profile…','Layout.avprofile',JSON.stringify(profile));
  await clean.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Workspace Profile applied'));
  assert.equal(await clean.locator('.project-title').textContent(),'Source · Project');

  await upload(clean,'Replace Source XML…','Stretched.xml',revised);
  const preview=clean.getByRole('dialog',{name:'Replace Source XML'});
  await preview.getByText(/2 matched/).waitFor();
  await preview.getByText(/1 paint conflicts/).waitFor();
  await preview.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await clean.locator('.project-title').textContent(),'Source · Project');
  await upload(clean,'Replace Source XML…','Stretched.xml',revised);
  await preview.getByLabel('Default for paint conflicts').selectOption('project');
  await preview.getByRole('button',{name:'Replace Source',exact:true}).click();
  const updated=JSON.parse(await download(clean,'Save Project…'));
  assert.equal(updated.model.sourceXml,revised);
  assert.deepEqual(updated.model.paint,[{id:'b1',color:'ffaabbcc',secondaryColor:'00000000'}]);
  assert.deepEqual(updated.model.regions[0].ids,['b1']);
  assert.match(updated.model.turretMounts[0].socketId,/^turret:b1:/);
  await clean.waitForFunction(async()=>{
    const {openSessionStore}=await import('/src/session-persistence.js');
    return (await openSessionStore().get('model'))?.fileName==='Stretched.xml';
  });
  assert.equal((await recovered(clean)).regions.length,2);
  const turretProject=await clean.evaluate(async xml=>{
    const {importTurretXml}=await import('/src/turrets/core.js');
    const {captureTurretProject}=await import('/src/project-files.js');
    const asset=importTurretXml(xml,'Refit Turret','portable-turret');
    asset.blocks[0].color='ff6789ab';
    return captureTurretProject(asset);
  },source);
  assert.equal(turretProject.asset.sourceXml,source);
  assert.equal(turretProject.asset.blocks,undefined);
  await upload(clean,'Open Project…','Refit Turret.avproject',JSON.stringify(turretProject));
  const studio=clean.getByRole('dialog',{name:'Turret workspace'});
  const exportButton=studio.getByRole('button',{name:'Export Model Project',exact:true});
  await studio.getByText('Refit Turret',{exact:true}).waitFor();
  const exportedTurret=JSON.parse(await downloadWith(clean,()=>exportButton.click()));
  assert.equal(exportedTurret.id,'portable-turret');
  assert.deepEqual(exportedTurret.paint,[{id:'b0',color:'ff6789ab'}]);
  await studio.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await clean.locator('.project-title').textContent(),'Source · Project');
  assert.deepEqual(errors,[]);
  console.log('Ship and turret project downloads, clean-profile open, original paint, profile import, replacement cancel/apply, and browser recovery passed.');
}finally{await browser.close();}
