let database;
function open(){
 return database??=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('Cache unavailable'));return;}
  const request=indexedDB.open('avorion-viewer.texture-cache.v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('images').createIndex('used','used');
  request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  request.onerror=()=>reject(request.error);
 });
}
export async function textureCacheKey(buffer,size){
 const hash=await crypto.subtle.digest('SHA-256',buffer);
 return 'rgba2:'+size+':'+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function cachedTexture(key){
 try{const db=await open();return await new Promise((resolve,reject)=>{const r=db.transaction('images').objectStore('images').get(key);r.onsuccess=()=>resolve(r.result?.image);r.onerror=()=>reject(r.error);});}catch{return;}
}
export async function cacheTexture(key,image){
 try{const db=await open();await new Promise((resolve,reject)=>{
  const tx=db.transaction('images','readwrite'),store=tx.objectStore('images');store.put({image,used:Date.now()},key);
  const count=store.count();count.onsuccess=()=>{let excess=count.result-192;if(excess<=0)return;const cursor=store.index('used').openCursor();cursor.onsuccess=()=>{const item=cursor.result;if(item&&excess-->0){item.delete();item.continue();}};};
  tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
 });}catch{/* Cache failure must not prevent texture loading. */}
}
