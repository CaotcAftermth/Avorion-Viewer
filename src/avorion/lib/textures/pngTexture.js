import {unzlibSync} from '../../../vendor/fflate.js';

// Shader textures store independent channels. Canvas compositing destroys RGB
// under alpha zero (rock alpha is specularity, not surface transparency).
function parseTexturePng(bytes) {
    const signature = [137,80,78,71,13,10,26,10];
    if (bytes.length < 33 || !signature.every((v,i) => bytes[i] === v)) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width, height, channels, ended = false;
    const chunks = [];
    let compressedSize = 0;
    for (let offset = 8; offset + 12 <= bytes.length;) {
        const length = view.getUint32(offset), start = offset + 8, end = start + length;
        if (end + 4 > bytes.length) throw Error('Truncated PNG texture');
        const type = String.fromCharCode(...bytes.subarray(offset + 4, start));
        if (type === 'IHDR') {
            if (length !== 13) throw Error('Invalid PNG header');
            width = view.getUint32(start); height = view.getUint32(start + 4);
            const depth = bytes[start + 8], color = bytes[start + 9];
            if (depth !== 8 || ![2,6].includes(color) || bytes[start + 12] !== 0) return;
            if (bytes[start + 10] || bytes[start + 11] || !width || !height || width * height > 16777216) throw Error('Unsupported PNG dimensions or method');
            channels = color === 6 ? 4 : 3;
        } else if (type === 'tRNS') {
            // Let the browser handle RGB color-key transparency and indexed PNGs.
            return;
        } else if (type === 'IDAT') {
            chunks.push(bytes.subarray(start,end)); compressedSize += length;
        } else if (type === 'IEND') { ended = true; break; }
        offset = end + 4;
    }
    if (!channels || !ended || !compressedSize) throw Error('Incomplete PNG texture');
    const packed = new Uint8Array(compressedSize);
    let offset = 0;
    for (const chunk of chunks) { packed.set(chunk,offset); offset += chunk.length; }
    return {width,height,channels,packed};
}

export function decodeTexturePng(bytes) {
    const png=parseTexturePng(bytes);if(!png)return;
    const expected=(png.width*png.channels+1)*png.height;
    return reconstructTexturePng(png,unzlibSync(png.packed,{out:new Uint8Array(expected)}));
}

// Platform zlib decompression is much faster than JavaScript on large maps.
// Only inflate is delegated: RGB/alpha reconstruction stays independent.
export async function decodeTexturePngNative(bytes) {
    const png=parseTexturePng(bytes);if(!png)return;
    if(typeof DecompressionStream!=='function'){
        const expected=(png.width*png.channels+1)*png.height;
        return reconstructTexturePng(png,unzlibSync(png.packed,{out:new Uint8Array(expected)}));
    }
    const expected=(png.width*png.channels+1)*png.height;
    const filtered=new Uint8Array(expected);
    const reader=new Blob([png.packed]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    let offset=0;
    try{
        while(true){
            const {done,value}=await reader.read();if(done)break;
            if(offset+value.length>expected){await reader.cancel();throw Error('Invalid PNG scanline length');}
            filtered.set(value,offset);offset+=value.length;
        }
    }finally{reader.releaseLock();}
    if(offset!==expected)throw Error('Invalid PNG scanline length');
    return reconstructTexturePng(png,filtered);
}

function reconstructTexturePng({width,height,channels},filtered) {
    const stride=width*channels;
    if(filtered.length!==(stride+1)*height)throw Error('Invalid PNG scanline length');
    const raw = new Uint8Array(stride * height);
    const paeth = (a,b,c) => {
        const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
        return pa<=pb && pa<=pc ? a : pb<=pc ? b : c;
    };
    for (let y=0; y<height; y++) {
        const source=y*(stride+1)+1, row=y*stride, filter=filtered[source-1];
        if(filter>4)throw Error('Invalid PNG scanline filter');
        if(filter===0||(y===0&&filter===2)){
            raw.set(filtered.subarray(source,source+stride),row);
        }else if(filter===1||(y===0&&filter===4)){
            for(let x=0;x<channels;x++)raw[row+x]=filtered[source+x];
            for(let x=channels;x<stride;x++)raw[row+x]=filtered[source+x]+raw[row+x-channels];
        }else if(filter===2){
            for(let x=0;x<stride;x++)raw[row+x]=filtered[source+x]+raw[row+x-stride];
        }else if(filter===3){
            for(let x=0;x<stride;x++){
                const a=x>=channels?raw[row+x-channels]:0,b=y?raw[row+x-stride]:0;
                raw[row+x]=filtered[source+x]+((a+b)>>1);
            }
        }else{
            for(let x=0;x<channels;x++)raw[row+x]=filtered[source+x]+raw[row+x-stride];
            for(let x=channels;x<stride;x++)raw[row+x]=filtered[source+x]+paeth(raw[row+x-channels],raw[row+x-stride],raw[row+x-stride-channels]);
        }
    }
    if (channels===4) return {width,height,data:raw};
    const data=new Uint8Array(width*height*4);
    for(let i=0;i<width*height;i++){data[i*4]=raw[i*3];data[i*4+1]=raw[i*3+1];data[i*4+2]=raw[i*3+2];data[i*4+3]=255;}
    return {width,height,data};
}

export function resizeTextureRgba(image,size,targetHeight=size) {
    const {width,height,data:source}=image;
    if(width===size&&height===targetHeight)return image;
    const data=new Uint8ClampedArray(size*targetHeight*4), sx=width/size, sy=height/targetHeight, sums=[0,0,0,0];
    // Native maps are powers of two: avoid per-sample weights/channel loops for
    // their common integer reductions, while preserving straight RGBA averages.
    if(sx>=1&&sy>=1&&Number.isInteger(sx)&&Number.isInteger(sy)){
        const area=sx*sy;
        for(let y=0;y<targetHeight;y++)for(let x=0;x<size;x++){
            let r=0,g=0,b=0,a=0;
            for(let py=y*sy;py<(y+1)*sy;py++){
                let index=(py*width+x*sx)*4;
                for(let px=0;px<sx;px++,index+=4){r+=source[index];g+=source[index+1];b+=source[index+2];a+=source[index+3];}
            }
            const target=(y*size+x)*4;data[target]=r/area;data[target+1]=g/area;data[target+2]=b/area;data[target+3]=a/area;
        }
        return {width:size,height:targetHeight,data};
    }
    for(let y=0;y<targetHeight;y++)for(let x=0;x<size;x++){
        const target=(y*size+x)*4;
        if(sx>=1&&sy>=1){
            const left=x*sx,right=(x+1)*sx,top=y*sy,bottom=(y+1)*sy;
            for(let py=Math.floor(top);py<Math.ceil(bottom);py++)for(let px=Math.floor(left);px<Math.ceil(right);px++){
                const weight=(Math.min(right,px+1)-Math.max(left,px))*(Math.min(bottom,py+1)-Math.max(top,py))/(sx*sy);
                const index=(py*width+px)*4;
                // Accumulate before rounding to retain all four independent channels.
                for(let c=0;c<4;c++)sums[c]+=source[index+c]*weight;
            }
        }else{
            const fx=Math.max(0,Math.min(width-1,(x+.5)*sx-.5)),fy=Math.max(0,Math.min(height-1,(y+.5)*sy-.5));
            const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),dx=fx-x0,dy=fy-y0;
            for(let c=0;c<4;c++)sums[c]=(source[(y0*width+x0)*4+c]*(1-dx)+source[(y0*width+x1)*4+c]*dx)*(1-dy)+(source[(y1*width+x0)*4+c]*(1-dx)+source[(y1*width+x1)*4+c]*dx)*dy;
        }
        for(let c=0;c<4;c++){data[target+c]=sums[c];sums[c]=0;}
    }
    return {width:size,height:targetHeight,data};
}

// Zero requests native pixels; a negative size caps previews without upscaling.
export function prepareTexturePixels(image,size){
 if(size===0)return image;
 if(size>0)return resizeTextureRgba(image,size);
 const scale=Math.min(1,-size/Math.max(image.width,image.height));
 return resizeTextureRgba(image,Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
}
