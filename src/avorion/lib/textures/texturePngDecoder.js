import {decodeTexturePng,prepareTexturePixels} from './pngTexture.js';

// One module worker is reused across imports, restores and resolution changes.
// Transferring pixels back avoids copying every decoded texture on the UI thread.
export function createTexturePngDecoder(makeWorker = typeof Worker === 'function'
    ? () => new Worker(new URL('./texturePngWorker.js',import.meta.url),{type:'module'}) : null) {
    let worker,disabled=false,nextId=0;
    const pending=new Map();
    function fail(error) {
        disabled=true;worker?.terminate();worker=undefined;
        for(const request of pending.values())request.reject(error);
        pending.clear();
    }
    function request(buffer,size) {
        return new Promise((resolve,reject)=>{
            const id=++nextId;
            try {
                if(!worker){
                    worker=makeWorker();
                    worker.onmessage=({data})=>{
                        const request=pending.get(data.id);if(!request)return;
                        pending.delete(data.id);
                        data.error?request.reject(new Error(data.error)):request.resolve(data.image);
                    };
                    worker.onerror=event=>{event.preventDefault?.();fail(new Error(event.message||'Texture worker failed'));};
                    worker.onmessageerror=()=>fail(new Error('Texture worker response could not be read'));
                }
                pending.set(id,{resolve,reject});
                worker.postMessage({id,buffer,size},[buffer]);
            }catch(error){reject(error);fail(error);}
        });
    }
    return async function decode(blob,size) {
        // Retained files can belong to a closed editor iframe. Give their native
        // blob data a wrapper in this document so async reads use a live realm.
        if (!(blob instanceof Blob)) blob=new Blob([blob],{type:blob.type});
        // Do not send JPEG/BMP/WebP files through the PNG decoder.
        const header=new Uint8Array(await blob.slice(0,8).arrayBuffer());
        if(![137,80,78,71,13,10,26,10].every((v,i)=>header[i]===v))return;
        let buffer=await blob.arrayBuffer();
        if(makeWorker&&!disabled){
            try{return await request(buffer,size);}catch{
                // A transferred buffer is detached; the original blob remains intact.
                buffer=await blob.arrayBuffer();
            }
        }
        // Worker-restricted browsers retain correctness and yield between textures.
        await new Promise(resolve=>setTimeout(resolve,0));
        const png=decodeTexturePng(new Uint8Array(buffer));
        if(!png)return;const image=prepareTexturePixels(png,size);image.sourceWidth=png.width;image.sourceHeight=png.height;return image;
    };
}
export const decodeTexturePngAsync=createTexturePngDecoder();
