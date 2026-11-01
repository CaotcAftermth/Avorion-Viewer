// The lab owns a separate database and never writes the viewer's asset records.
const database=new Promise((resolve,reject)=>{
  const request=indexedDB.open('avorion-viewer.turret-lab.v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('project');
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('Close other Turret Lab tabs to enable storage.'));
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
});
async function transaction(value,write){
  const db=await database;
  return new Promise((resolve,reject)=>{const tx=db.transaction('project',write?'readwrite':'readonly'),store=tx.objectStore('project'),r=write?store.put(value,'current'):store.get('current');tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error||Error('Project storage failed.'));tx.onerror=()=>{};});
}
export const loadLocal=()=>transaction(undefined,false);
export const saveLocal=value=>transaction(value,true);
