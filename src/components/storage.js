import {openSessionStore} from '../session-persistence.js';
import {validateSetup,validateComponent,componentSetup} from './core.js';
const store=openSessionStore(),keys=new WeakMap();
let writes=Promise.resolve();
const write=(key,value)=>{const job=writes.then(()=>store.put(key,value));writes=job.catch(()=>{});return job;};
async function modelKey(model){
  let key=keys.get(model);if(!key){key=(async()=>{
    const source=model.sourceXml||JSON.stringify(model.blocks.map(({el,itemEl,...block})=>block));
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
    return 'component-model:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  })();keys.set(model,key);}return key;
}
// A ship re-saved from the game has different XML, so the exact key misses. The
// setup is also kept under the file name with each socket block's native position,
// and restored by matching those positions to the new blocks.
const nameKey=model=>'component-ship:'+String(model.fileName||'').toLowerCase();
const native=(model,block)=>['x','y','z'].map(a=>Math.round((block.position[a]-(model.placementOffset?.[a]||0))*1000)/1000).join(',')+':'+block.typeIndex;
const autoSocket=/^component:(b\d+):(.*)$/;
function anchors(model,setup){
  const ids=new Set([...setup.sockets.map(s=>s.blockId).filter(Boolean),...setup.mounts.map(m=>autoSocket.exec(m.socketId)?.[1]).filter(Boolean)]);
  return Object.fromEntries(model.blocks.filter(b=>ids.has(b.id)).map(b=>[b.id,native(model,b)]));
}
export function remapSetup(model,saved){
  const byAnchor=new Map(model.blocks.map(b=>[native(model,b),b.id])),map=new Map(Object.entries(saved.anchors||{}).map(([id,anchor])=>[id,byAnchor.get(anchor)]));
  let dropped=0;
  const sockets=saved.setup.sockets.flatMap(s=>{if(!s.blockId)return [s];const id=map.get(s.blockId);if(!id){dropped++;return [];}return [{...s,blockId:id}];});
  const kept=new Set(sockets.map(s=>s.id));
  const mounts=saved.setup.mounts.flatMap(m=>{const auto=autoSocket.exec(m.socketId);if(auto){const id=map.get(auto[1]);if(!id){dropped++;return [];}return [{...m,socketId:`component:${id}:${auto[2]}`}];}if(!kept.has(m.socketId)){dropped++;return [];}return [m];});
  return {setup:validateSetup({...saved.setup,sockets,mounts}),dropped};
}
export async function restoreComponentSetup(model){
  try{
    const saved=await store.get(await modelKey(model));if(saved){model.componentSetup=validateSetup(saved);return;}
    const named=await store.get(nameKey(model));if(!named?.setup)return;
    const {setup,dropped}=remapSetup(model,named);
    if(!setup.sockets.length&&!setup.mounts.length&&setup.blockType===null)return;
    model.componentSetup=setup;
    model.warnings.push({level:'warn',message:`Component setup restored from an earlier version of ${model.fileName}${dropped?`; ${dropped} socket${dropped===1?'':'s'} or mount${dropped===1?'':'s'} no longer match a block and were left out`:''}. Check it in Properties › Components.`});
  }
  catch(error){model.warnings.push({level:'warn',message:'Component setup could not be restored: '+error.message});}
}
export async function saveComponentSetup(model,setup){
  validateSetup(setup);const entries=[[await modelKey(model),structuredClone(setup)]];
  if(model.fileName)entries.push([nameKey(model),{setup:structuredClone(setup),anchors:anchors(model,setup)}]);
  const operation=writes.then(()=>store.putMany(entries));writes=operation.catch(()=>{});await operation;
  model.componentSetup=setup;
}
let libraryReady,libraryAssets;
const listeners=new Set();
export function subscribeComponents(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
export async function loadComponents(){
 await (libraryReady??=store.get('component-library').then(value=>{libraryAssets=(value||[]).map(validateComponent);}).catch(error=>{libraryReady=null;throw error;}));
 return libraryAssets;
}
export async function saveComponents(assets){assets.forEach(validateComponent);await write('component-library',structuredClone(assets));libraryAssets=assets;listeners.forEach(listener=>listener(assets));}
export function componentSetupFile(model){return JSON.stringify({format:'avorion-viewer-components',version:1,ship:model.fileName,setup:componentSetup(model)},null,2);}
export function parseComponentSetupFile(text){const file=JSON.parse(text);if(file.format!=='avorion-viewer-components'||file.version!==1)throw Error('Not a component setup file.');return validateSetup(file.setup);}
