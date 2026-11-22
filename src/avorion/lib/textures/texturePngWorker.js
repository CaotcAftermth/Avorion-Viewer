import {textureCacheKey,cachedTexture,cacheTexture} from './texturePixelCache.js';
import {decodeTexturePngNative,prepareTexturePixels} from './pngTexture.js';
self.onmessage=async({data:{id,buffer,size}})=>{
    try{
        let key;try{key=await textureCacheKey(buffer,size);}catch{}
        let image=key?await cachedTexture(key):undefined;
        if(!image){
            const png=await decodeTexturePngNative(new Uint8Array(buffer));
            image=png?prepareTexturePixels(png,size):undefined;
            if(image&&key)await cacheTexture(key,image);
        }
        if(image){const header=new DataView(buffer);image.sourceWidth=header.getUint32(16);image.sourceHeight=header.getUint32(20);}
        self.postMessage({id,image},image?[image.data.buffer]:[]);
    }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
