import {makeModel,parseAvorionXml,placeImportedModel} from './block-model.js';
import {exportPaintedXml} from './color-workshop.js';

// Keep large models and original texture blobs out of synchronous localStorage.
export function openSessionStore(factory=globalThis.indexedDB){
  let database;
  function open(){
    return database??=new Promise((resolve,reject)=>{
      if(!factory){reject(new Error('Browser storage is unavailable.'));return;}
      const request=factory.open('avorion-viewer.assets.v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('assets');
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Close other viewer tabs to enable local asset storage.'));
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
    });
  }
  async function transaction(key,value,write){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('assets',write?'readwrite':'readonly'),store=tx.objectStore('assets');
      const request=write?store.put(value,key):store.get(key);
      tx.oncomplete=()=>resolve(request.result);
      tx.onabort=()=>reject(tx.error||new Error('Local asset storage failed.'));
      tx.onerror=()=>{};
    });
  }
  return {get:key=>transaction(key,undefined,false),put:(key,value)=>transaction(key,value,true)};
}

// Weapon Coverage display settings and the comparison baseline travel with the
// ship session, like the per-turret aiming assumptions stored on each mount.
export function coverageSnapshot(scene){
  return {options:scene.weaponCoverage?structuredClone(scene.weaponCoverage):null,show:!!scene.showFireCoverage,direction:scene.fireDirection||null,baseline:scene.coverageBaseline||null};
}
export function snapshotModel(scene){
  if(!scene.loaded||!scene.model)return {version:1,empty:true};
  const model=scene.model;
  return {version:1,preview:!!scene.preview,fileName:model.fileName,fileSize:model.fileSize,
    turretMounts:model.turretMounts,placement:model.placement,xml:model.doc?exportPaintedXml(model):undefined,
    blocks:model.doc?undefined:model.blocks.map(({el,itemEl,...block})=>block),coverage:coverageSnapshot(scene)};
}
function restoreCoverage(saved){
  if(!saved||typeof saved!=='object')return {};
  const options=saved.options&&typeof saved.options==='object'&&!Array.isArray(saved.options)?saved.options:undefined;
  return {...(options?{weaponCoverage:options}:{}),...(saved.show?{showFireCoverage:true}:{}),...(saved.direction?{fireDirection:String(saved.direction)}:{}),...(saved.baseline&&typeof saved.baseline==='object'?{coverageBaseline:saved.baseline}:{})};
}
export function restoreModel(record){
  if(record?.version!==1)throw new Error('Saved model version is not supported.');
  if(record.empty)return {model:null,loaded:false,preview:false};
  let model;
  if(typeof record.xml==='string'){
    model=parseAvorionXml(record.xml,record.fileName,record.fileSize);
    placeImportedModel(model,record.placement||'imported');
  }else{
    if(!Array.isArray(record.blocks)||!record.blocks.length||record.blocks.some(b=>!['x','y','z'].every(a=>Number.isFinite(b.position?.[a])&&Number.isFinite(b.size?.[a]))))throw new Error('Saved model data is invalid.');
    model=makeModel(record.blocks,record.fileName);
  }
  if(Array.isArray(record.turretMounts))model.turretMounts=record.turretMounts;
  return {model,loaded:true,preview:!!record.preview,...restoreCoverage(record.coverage)};
}

export function createSessionPersistence({scene,textures,restored,onError,store=openSessionStore()}){
  let ready=false,stopped=false,timer,lastModel,lastAppearance,lastLoaded,lastCoverage,lastTextures=null,failed=false;
  const coverageKey=()=>{try{return JSON.stringify(coverageSnapshot(scene));}catch{return null;}};
  const report=error=>{if(!failed)onError(error);failed=true;};
  const save=(key,value)=>store.put(key,value).catch(report);
  const picked=()=>[...textures.blobs].filter(([name])=>textures.sourceOf.get(name)?.source==='folder').map(([name,blob])=>({name,blob,file:textures.sourceOf.get(name).file}));
  function saveTextures(){
    if(!ready||textures.scanning)return;
    const files=picked();
    if(lastTextures&&files.length===lastTextures.length&&files.every((f,i)=>f.name===lastTextures[i].name&&f.blob===lastTextures[i].blob))return;
    lastTextures=files;void save('textures',files);
  }
  function flush(){
    clearTimeout(timer);if(!ready)return;
    const coverage=coverageKey();
    if(scene.model===lastModel&&scene.loaded===lastLoaded&&scene.appearanceRevision===lastAppearance&&coverage===lastCoverage)return;
    try{const record=snapshotModel(scene);lastModel=scene.model;lastLoaded=scene.loaded;lastAppearance=scene.appearanceRevision;lastCoverage=coverage;void save('model',record);}catch(error){report(error);}
  }
  function changed(){if(ready){clearTimeout(timer);timer=setTimeout(flush,250);}}
  async function start(){
    const initialModel=scene.model,initialGeneration=textures.generation;
    const [modelResult,textureResult]=await Promise.allSettled([store.get('model'),store.get('textures')]);
    if(stopped)return;
    if(modelResult.status==='fulfilled'){
      if(modelResult.value!==undefined&&scene.model===initialModel){try{Object.assign(scene,restoreModel(modelResult.value));lastModel=scene.model;lastLoaded=scene.loaded;lastAppearance=scene.appearanceRevision;lastCoverage=coverageKey();scene.revision++;restored('model');}catch(error){report(error);}}
    }else report(modelResult.reason);
    ready=true;textures.subscribe(saveTextures);flush();
    if(textureResult.status==='fulfilled'){
      if(Array.isArray(textureResult.value)&&textures.generation===initialGeneration&&!picked().length){
        try{await textures.loadFiles(textureResult.value.map(f=>new File([f.blob],f.file,{type:f.blob.type})));restored('textures');}catch(error){report(error);}
      }
    }else report(textureResult.reason);
    // Observe clear/unload and all import entry points through the shared library.
    if(stopped)return;
    saveTextures();flush();
  }
  return {start,changed,flush,stop(){flush();stopped=true;ready=false;clearTimeout(timer);}};
}
