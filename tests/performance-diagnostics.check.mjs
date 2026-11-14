import assert from 'node:assert/strict';
import {serveWorkspace} from './local-route.mjs';
const playwright=process.env.AVORION_PLAYWRIGHT_URL||'playwright';
const {chromium}=await import(playwright);
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-crash-reporter','--disable-crashpad','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const xml='<ship><plan><item index="0" parent="-1"><block lx="0" ly="0" lz="0" ux="2" uy="4" uz="8" index="122" material="0" look="1" up="3" color="ff336699"/></item></plan></ship>';
try{
  const page=await browser.newPage({viewport:{width:1200,height:850}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept(dialog.defaultValue()));
  await serveWorkspace(page);
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'Close welcome'}).click();
  await page.evaluate(async()=>{window.readDiagnostics=(await import('/src/performance-diagnostics.js')).diagnosticReport;});
  const read=()=>page.evaluate(()=>window.readDiagnostics());
  async function menu(group,label){
    await page.getByRole('button',{name:group,exact:true}).click();
    await page.getByRole('menuitem',{name:label,exact:true}).click();
  }
  async function upload(text){
    const chooser=page.waitForEvent('filechooser');
    await menu('File','Import Avorion XML…');
    await (await chooser).setFiles({name:'private-audit-fixture.xml',mimeType:'text/xml',buffer:Buffer.from(text)});
  }
  const panel=page.getByRole('dialog',{name:'Performance Diagnostics'});
  assert.equal((await read()).enabled,false);
  await menu('Help','Performance Diagnostics…');
  await panel.getByLabel('Enable diagnostics').check();
  await panel.getByRole('button',{name:'Close',exact:true}).click();
  await upload(xml);
  const has=type=>page.waitForFunction(type=>window.readDiagnostics().events.some(event=>event.type===type),type);
  await has('import completed');
  await has('first model frame submitted');
  const afterImport=await read();
  assert.equal(afterImport.hull.blocks,1);
  assert.equal(afterImport.hull.attributeBytes/afterImport.hull.vertices,172);
  assert.ok(afterImport.memory.trackedBytesByCategory.cpuGeometryAttributes>=afterImport.hull.attributeBytes);
  assert.ok(Object.values(afterImport.rendering).some(view=>view.passes.scene?.calls>0));
  await menu('File','Advanced Export…');
  const exportPanel=page.getByRole('dialog',{name:'Advanced Export'});
  await exportPanel.getByRole('button',{name:'Prepare & Validate'}).click();
  await has('export preparation completed');
  await has('processed mesh preview opened');
  await page.waitForFunction(()=>window.readDiagnostics().memory.trackedBytesByCategory.preparedExportGeometry>0);
  const prepared=await read();
  assert.ok(prepared.memory.trackedBytesByCategory.preparedExportGeometry>0);
  assert.ok(prepared.memory.trackedBytesByCategory.retainedPreviewGeometry>0);
  const file=page.waitForEvent('download');
  await exportPanel.getByRole('button',{name:'Download',exact:true}).click();
  assert.match((await file).suggestedFilename(),/\.glb$/);
  await has('export completed');
  await exportPanel.getByLabel('Close export').click();
  await has('processed mesh preview closed');
  assert.equal((await read()).memory.trackedBytesByCategory.preparedExportGeometry,0);
  assert.equal((await read()).memory.trackedBytesByCategory.retainedPreviewGeometry,0);
  await menu('File','Advanced Export…');
  await page.evaluate(()=>{document.querySelector('.export-prepare').click();document.querySelector('.export-cancel').click();});
  await has('export preparation cancelled');
  await exportPanel.getByLabel('Close export').click();
  await menu('File','Clear scene');
  await has('model cleared');
  await upload('<bad>');
  await has('import failed');
  await page.locator('#import-error-dialog .icon-button[data-close]').click();
  await upload(xml);
  await page.waitForFunction(()=>window.readDiagnostics().counts['import completed']===2);
  await menu('Help','Performance Diagnostics…');
  await page.evaluate(()=>{
    const create=URL.createObjectURL;
    URL.createObjectURL=function(blob){if(blob.type==='application/json')window.diagnosticDownload=blob.text();return create.call(this,blob);};
  });
  const reportFile=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Download JSON report'}).click();
  assert.equal((await reportFile).suggestedFilename(),'avorion-performance-diagnostics.json');
  const report=await page.evaluate(()=>window.diagnosticDownload);
  assert.equal(JSON.parse(report).schemaVersion,1);
  assert.equal(report.includes('private-audit-fixture'),false);
  assert.equal(report.includes('ff336699'),false);
  await panel.getByRole('button',{name:'Reset session'}).click();
  assert.deepEqual((await read()).counts,{});
  await panel.getByLabel('Enable diagnostics').uncheck();
  assert.equal((await read()).enabled,false);
  const parity=await page.evaluate(async()=>{
    const d=await import('/src/performance-diagnostics.js');
    const {makeBlock,makeModel}=await import('/src/block-model.js'),{area}=await import('/src/layout.js');
    const {FACTORY_PREFERENCES}=await import('/src/preferences.js'),{ensureViewportOptions}=await import('/src/viewport-options.js');
    const {imageDefaults,captureImage}=await import('/src/export/image-options.js'),{exportImage}=await import('/src/export/image-pipeline.js');
    const view=area().view;
    Object.assign(ensureViewportOptions(view),{shading:'SOLID',showOverlays:false,objectOutline:false});
    const preferences={...FACTORY_PREFERENCES,worldEnabled:false,vignetteEnabled:false};
    const scene={model:makeModel([makeBlock()]),loaded:true,visible:true,revision:1,selectedIds:new Set(),hiddenIds:new Set()};
    const options={...imageDefaults(view,160,120),gizmos:false,overlays:false};
    const snapshot=captureImage(scene,view,preferences,{width:160,height:120});
    const baseline=await exportImage(snapshot,options);
    d.configureDiagnostics(true,{gpuTiming:true});
    const enabled=await exportImage(snapshot,options);
    const report=d.diagnosticReport();
    const cancelled=new AbortController();cancelled.abort();
    try{await exportImage(snapshot,options,{signal:cancelled.signal});}catch(error){if(error.name!=='AbortError')throw error;}
    const result={same:baseline.canvas.toDataURL()===enabled.canvas.toDataURL(),blobBytes:enabled.blob.size,
      recorded:report.events.some(event=>event.type==='export completed'&&event.image.tiles>0&&event.blobBytes===enabled.blob.size),
      cancelled:d.diagnosticReport().counts['export cancelled']};
    d.configureDiagnostics(false);
    return result;
  });
  assert.equal(parity.same,true);
  assert.equal(parity.recorded,true);
  assert.equal(parity.cancelled,1);
  const worker=await page.evaluate(async()=>{
    const d=await import('/src/performance-diagnostics.js');
    const {prepareLargeModel}=await import('/src/model-preparation.js');
    const {makeBlock,makeModel}=await import('/src/block-model.js');
    const {DEFAULT_GAME_SHADER}=await import('/src/avorion/types/index.js');
    const count=40339,blocks=Array.from({length:count},(_,i)=>makeBlock({id:'b'+i,
      typeIndex:i%2?151:100,position:{x:i%100*2,y:Math.floor(i/100)*2,z:0},size:{x:1+(i%32)/64,y:2,z:1}}));
    d.configureDiagnostics(true,{lightweight:true});
    const params={...DEFAULT_GAME_SHADER,simplified:true,canonicalWedges:true};
    const model=makeModel(blocks);
    const job=prepareLargeModel(model,blocks,params);
    const batches=await job.promise;
    const {buildTexturedModel}=await import('/src/avorion/lib/geometry/texturedModel.js');
    const {defaultOrientationProfile}=await import('/src/avorion/lib/avorion/orientation.js');
    const installed=buildTexturedModel(model,defaultOrientationProfile(),{...params,prepared:batches});
    let editable=false;
    try{
      const mesh=installed.group.children.find(child=>child.userData.ranges?.has('b0'));
      const secondary=mesh.geometry.getAttribute('aSecondary');
      const slot=mesh.userData.ranges.get('b0')[0][0];
      blocks[0].secondaryColor='804080ff';
      installed.updateColors(model,new Set(['b0']));
      editable=mesh.geometry.getAttribute('aScale')?.getX(slot)===blocks[0].size.x/2&&
        mesh.geometry.getAttribute('aOffset').getW(slot)===blocks[0].size.x&&
        secondary.getW(slot)===Math.fround(128/255)&&secondary.getZ(slot)===1;
    }finally{installed.dispose();}
    const layout=batches.every(batch=>{
      if('aWindow' in batch.attributes)return false;
      const fields=Object.values(batch.attributes);
      const components=instanced=>fields.filter(attr=>attr.instanced===instanced).reduce((n,attr)=>n+attr.size,0);
      return batch.instanced?components(false)===20&&components(true)===(batch.attributes.aScale?.size===4?32:batch.attributes.aScale?29:26):components(false)===43&&components(true)===0;
    });

    prepareLargeModel(model,blocks,params).cancel();
    const report=d.diagnosticReport(),transfer=report.events.find(event=>event.type==='geometry worker response');
    return {input:report.memory.peakTrackedBytesByCategory.geometryWorkerPayload,output:transfer.transferredBytes,
      layout,editable,canonical:batches.filter(batch=>batch.attributes.aScale).reduce((n,batch)=>n+batch.count,0),
      batches:batches.length,payloadAfter:report.memory.trackedBytesByCategory.geometryWorkerPayload,cancelled:report.counts['geometry worker cancelled']};
  });
  assert.equal(worker.input,40339*13*8);
  assert.ok(worker.output>0&&worker.batches>0);
  assert.equal(worker.layout,true);
  assert.equal(worker.editable,true);
  assert.ok(worker.canonical>0);
  assert.equal(worker.payloadAfter,0);
  assert.equal(worker.cancelled,1);
  assert.deepEqual(errors,[]);
  console.log('Diagnostics import, export, cancellation, preview lifecycle, clear/reload and report verified.');
}finally{await browser.close();}

