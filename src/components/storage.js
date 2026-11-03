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
export async function restoreComponentSetup(model){
  try{const saved=await store.get(await modelKey(model));if(saved)model.componentSetup=validateSetup(saved);}
  catch(error){model.warnings.push({level:'warn',message:'Component setup could not be restored: '+error.message});}
}
export async function saveComponentSetup(model,setup){
  validateSetup(setup);await write(await modelKey(model),structuredClone(setup));
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
