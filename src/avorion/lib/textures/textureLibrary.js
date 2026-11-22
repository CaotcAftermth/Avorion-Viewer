// ---------------------------------------------------------------------------
// Texture library.
//
// The app never ships game assets. Textures come from one of two places:
//   1. The app texture folder  ->  public/textures/blocks/   (served at
//      /textures/blocks/NAME.ext). Copy Avorion's data/textures/blocks/*
//      there, or your own files with the same base names.
//   2. A folder the user picks at runtime (persisted locally by the app).
//
// Images first decode as previews, then visible maps upgrade to native pixels.
// Mixed dimensions use albedo / normal / aux arrays with optional oversized
// companions. Per-layer UV scales preserve native pixels, and the whole ship
// renders with one material and per-vertex layer indices. Layer 0 of each
// array is a neutral fallback for anything that is missing.
// ---------------------------------------------------------------------------
import * as THREE from "../../../vendor/three.module.js";
import { allTextureNames } from "./shadingMap.js";
import {decodeTexturePngAsync} from './texturePngDecoder.js';
const EXTENSIONS = ["png", "bmp", "jpg", "jpeg", "webp"];
export const TEXTURE_RESOLUTIONS = Object.freeze([0, 256, 512, 1024, 2048]);
export const DEFAULT_TEXTURE_RESOLUTION = 0;
export const APP_TEXTURE_PATH = new URL('../../../../textures/blocks/', import.meta.url).href;
export class TextureLibrary {
    resolution = 512;
    nativeQuality = true;
    consumers = new Set();
    managedNative = false;
    previewImages = new Map();
    nativeImages = new Map();
    upgradeNames = new Set();
    upgradeTask;
    revision = 0;
    qualityGeneration = 0;
    images = new Map();
    sourceOf = new Map();
    arrays = new Map();
    listeners = new Set();
    blobs = new Map();
    queue = Promise.resolve();
    scanPromise;
    generation = 0;
    pending = 0;
    scanning = false;
    lastScan;
    subscribe(fn) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
    emit(event) { this.listeners.forEach((l) => l(event)); }
    has(name) { return this.images.has(name); }
    get loadedCount() { return this.images.size; }
    status() {
        return allTextureNames().map((name) => {
            const s = this.sourceOf.get(name);
            return { name, found: this.images.has(name), source: s?.source, file: s?.file };
        });
    }
    setResolution(res) {
        if (!TEXTURE_RESOLUTIONS.includes(res))
            return;
        const modeChanged=this.nativeQuality !== (res===0);
        this.qualityGeneration++;
        this.nativeQuality = res === 0;
        res = res || 512;
        this.nativeImages.clear();
        return this.enqueue(async (generation) => {
            if (res === this.resolution && !modeChanged)
                return;
            // Decode from the saved originals so increasing resolution restores detail.
            const images = new Map();
            for (const [name, blob] of this.blobs) {
                if (generation !== this.generation)
                    return;
                const img = await this.decode(blob, this.nativeQuality ? 512 : res);
                if (img)
                    images.set(name, img);
            }
            if (generation !== this.generation)
                return;
            this.resolution = res;
            this.images = images;this.previewImages=new Map(images);
        });
    }
    enqueue(job) {
        const generation = this.generation;
        this.pending++;
        this.scanning = true;
        this.emit();
        const task = this.queue.then(async () => {
            if (generation !== this.generation)
                return;
            try {
                return await job(generation);
            }
            finally {
                if (generation === this.generation) {
                    this.disposeArrays();
                    this.pending--;
                    this.scanning = this.pending > 0;
                    this.lastScan = Date.now();
                    this.emit();
                }
            }
        });
        this.queue = task.catch(() => { });
        return task;
    }
    /** Try every known texture name against the app folder. */
    scanAppFolder() {
        if (this.scanPromise)
            return this.scanPromise;
        const task = this.enqueue(async (generation) => {
            const names = allTextureNames();
            let i = 0;
            const worker = async () => {
                while (i < names.length) {
                    if (generation !== this.generation)
                        return;
                    const name = names[i++];
                    // A manual rescan refreshes app assets, but never replaces picked files.
                    if (this.sourceOf.get(name)?.source === "folder")
                        continue;
                    for (const ext of EXTENSIONS) {
                        const url = `${APP_TEXTURE_PATH}${name}.${ext}`;
                        try {
                            const r = await fetch(url, { cache: "no-cache" });
                            if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/"))
                                continue;
                            const blob = await r.blob();
                            const img = await this.decode(blob, this.nativeQuality ? 512 : this.resolution);
                            if (generation !== this.generation)
                                return;
                            if (!img)
                                continue;
                            this.images.set(name, img);this.previewImages.set(name,img);
                            this.blobs.set(name, blob);
                            this.sourceOf.set(name, { source: "app", file: `${name}.${ext}` });
                            break;
                        }
                        catch { /* not there */ }
                    }
                }
            };
            await Promise.all(Array.from({ length: 6 }, worker));
        });
        const done = task.then(() => { }).finally(() => {
            if (this.scanPromise === done)
                this.scanPromise = undefined;
        });
        this.scanPromise = done;
        return done;
    }
    /** Load from a FileList (folder picker or multi-select). Base name = file name minus extension. */
    async loadFiles(files, {retainUndecoded=false,sources=null,onProgress=null,allowUnlisted=false,previewNames=null}={}) {
        // Snapshot FileList before the input gets reset by its change handler.
        const input = Array.from(files);
        return (await this.enqueue(async (generation) => {
            const wanted = allowUnlisted ? null : new Set(allTextureNames());
            const records=input.map(f=>({file:f,base:f.name.replace(/\.[^.]+$/, '').toLowerCase(),source:sources?.get(f.name)==='app'?'app':'folder'}));
            if(retainUndecoded)for(const {file,base,source}of records){if(base&&(!wanted||wanted.has(base))){this.blobs.set(base,file);this.sourceOf.set(base,{source,file:file.name});}}
            let cursor=0,done=0,n=0;const results=new Array(records.length);
            const worker=async()=>{while(cursor<records.length&&generation===this.generation){
                const index=cursor++,{file,base}=records[index];
                if(base&&(!wanted||wanted.has(base))){
                    if(previewNames&&!previewNames.has(base)){
                        const bytes=new Uint8Array(await file.slice(0,26).arrayBuffer()),view=new DataView(bytes.buffer);let width=512,height=512,known=false;
                        if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){width=view.getUint32(16);height=view.getUint32(20);known=width>0&&height>0;}
                        else if(bytes.length>=26&&bytes[0]===66&&bytes[1]===77){width=Math.abs(view.getInt32(18,true));height=Math.abs(view.getInt32(22,true));known=width>0&&height>0;}
                        else if(bytes[0]===255&&bytes[1]===216||bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")known=true;
                        results[index]=known?{width:1,height:1,data:new Uint8Array([190,190,190,255]),sourceWidth:width||512,sourceHeight:height||512,placeholder:true}:await this.decode(file,this.nativeQuality?512:this.resolution);
                    }else results[index]=await this.decode(file,this.nativeQuality?512:this.resolution);
                }
                onProgress?.(++done,input.length);
            }};
            // Cache reads and worker IPC overlap; decoding stays off the UI thread.
            await Promise.all(Array.from({length:Math.min(6,records.length)},worker));
            if(generation!==this.generation)return 0;
            // Commit in input order, retaining the last successful duplicate as before.
            for(let i=0;i<records.length;i++){
                const img=results[i];if(!img)continue;
                const {file,base,source}=records[i];this.nativeImages.delete(base);
                this.images.set(base,img);this.previewImages.set(base,img);this.blobs.set(base,file);
                this.sourceOf.set(base,{source,file:file.name});n++;
            }
            onProgress?.(input.length,input.length);return n;
        })) ?? 0;
    }
    /**
     * Reuse another library's decoded maps (the turret workspace runs in a
     * same-origin iframe), so textures appear at once without decoding again.
     * Returns the number of maps adopted, or 0 when the resolutions differ.
     */
    adopt(source) {
        if (!source?.images?.size || source.resolution !== this.resolution)
            return 0;
        for (const [name, img] of source.images)
            if (img?.data) {this.images.set(name,img);this.previewImages.set(name,source.previewImages?.get(name)||img);}
        for (const [name, blob] of source.blobs || []) this.blobs.set(name, blob);
        for (const [name, from] of source.sourceOf || []) this.sourceOf.set(name, { ...from });
        this.disposeArrays();
        this.lastScan = Date.now();
        this.emit();
        return this.images.size;
    }
    clear() {
        // In-flight decodes/fetches must not repopulate an unloaded library.
        this.generation++;
        this.pending = 0;
        this.scanning = false;
        this.scanPromise = undefined;
        this.lastScan = Date.now();
        this.nativeImages.clear();
        this.upgradeNames.clear();
        this.revision++;
        this.images.clear();this.previewImages.clear();this.consumers.clear();this.managedNative=false;
        this.blobs.clear();
        this.sourceOf.clear();
        this.disposeArrays();
        this.emit();
    }
    async decode(blob, size = this.resolution) {
        try {
            const png = await decodeTexturePngAsync(blob,size);
            if (png) return png;
            const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
            const canvas = document.createElement("canvas");
            const scale=size<0?Math.min(1,-size/Math.max(bmp.width,bmp.height)):1;
            canvas.width = size<=0?Math.max(1,Math.round(bmp.width*scale)):size;
            canvas.height = size<=0?Math.max(1,Math.round(bmp.height*scale)):size;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
            const sourceWidth=bmp.width,sourceHeight=bmp.height;bmp.close();
            const image=ctx.getImageData(0,0,canvas.width,canvas.height);image.sourceWidth=sourceWidth;image.sourceHeight=sourceHeight;return image;
        }
        catch {
            return undefined;
        }
    }
    retainNative(names){
        this.managedNative=true;
        const consumer={names:new Set(names),presented:false};this.consumers.add(consumer);
        return {present:()=>{if(!this.consumers.has(consumer)||consumer.presented)return;consumer.presented=true;this.requestNative(consumer.names);
            const available=[...consumer.names].filter(n=>this.blobs.has(n)&&this.images.has(n));
            if((!this.nativeQuality||!available.length||available.every(n=>this.nativeImages.get(n)===this.blobs.get(n)))&&!this.qualityNoticePending){
                this.qualityNoticePending=true;queueMicrotask(()=>{this.qualityNoticePending=false;if([...this.consumers].some(c=>c.presented))this.emit('quality');});
            }
        },
            release:()=>{this.consumers.delete(consumer);for(const name of this.upgradeNames)if(!this.wantsNative(name))this.upgradeNames.delete(name);}};
    }
    wantsNative(name){return !this.managedNative||[...this.consumers].some(c=>c.presented&&c.names.has(name));}
    requestNative(names){
        if(!this.nativeQuality)return;
        for(const name of names)if(this.wantsNative(name)&&this.images.has(name)&&this.blobs.has(name)&&this.nativeImages.get(name)!==this.blobs.get(name))this.upgradeNames.add(name);
        if(this.upgradeTask||!this.upgradeNames.size)return;
        const generation=this.generation,qualityGeneration=this.qualityGeneration;
        this.upgradeTask=(async()=>{
            await Promise.resolve(); // Coalesce maps presented by the same frame.
            while(this.upgradeNames.size&&generation===this.generation&&qualityGeneration===this.qualityGeneration&&this.nativeQuality){
                const names=[...this.upgradeNames];this.upgradeNames.clear();const ready=[];
                for(const name of names){
                    if(!this.wantsNative(name))continue;
                    const blob=this.blobs.get(name);if(!blob)continue;
                    const image=await this.decode(blob,0);
                    let preview;if(image&&this.previewImages.get(name)?.placeholder){const dims=this.previewImages.get(name);preview=await this.decode(blob,512);if(preview){preview.sourceWidth=dims.sourceWidth;preview.sourceHeight=dims.sourceHeight;}}
                    if(generation!==this.generation||qualityGeneration!==this.qualityGeneration||!this.nativeQuality)return;
                    if(image&&this.blobs.get(name)===blob&&this.wantsNative(name))ready.push({name,blob,image,preview});
                    await new Promise(r=>setTimeout(r,0));
                }
                const valid=ready.filter(({name,blob})=>this.blobs.get(name)===blob&&this.wantsNative(name));
                if(valid.length){
                    for(const {name,blob,image,preview}of valid){if(preview)this.previewImages.set(name,preview);this.images.set(name,image);this.nativeImages.set(name,blob);}
                    this.revision++;this.disposeArrays();this.emit('quality');
                }
            }
        })().finally(()=>{this.upgradeTask=undefined;if(this.upgradeNames.size)this.requestNative([]);});
    }
    // --- GPU arrays ------------------------------------------------------------
    disposeArrays() {
        // Existing previews retain their arrays until their model is disposed.
        for (const a of this.arrays.values())
            if (!a.users){a.texture.dispose();a.largeTexture?.dispose();}
        this.arrays.clear();
    }
    leaseArray(key, entry) {
        entry.users++;
        let released = false;
        return { texture: entry.texture, largeTexture:entry.largeTexture, layerOf: entry.layerOf, release: () => {
                if (released)
                    return;
                released = true;
                if (--entry.users === 0) {
                    if (this.arrays.get(key) === entry)
                        this.arrays.delete(key);
                    entry.texture.dispose();entry.largeTexture?.dispose();
                }
            } };
    }
    fallbackLayer(kind, size) {
        const px = size * size;
        const out = new Uint8Array(px * 4);
        const [r, g, b, a] = kind === "albedo" ? [190, 190, 190, 255] : kind === "normal" ? [128, 128, 255, 255] : [0, 0, 0, 0];
        for (let i = 0; i < px; i++) {
            out[i * 4] = r;
            out[i * 4 + 1] = g;
            out[i * 4 + 2] = b;
            out[i * 4 + 3] = a;
        }
        return out;
    }
    /**
     * Pack the requested names into one array texture. Missing names map to
     * layer 0 (fallback). Models share arrays while alive and release them on
     * disposal, so repeated imports cannot retain every previous ship's arrays.
     */
    getArray(...args){const steps=this.arraySteps(...args);let next;do{next=steps.next();}while(!next.done);return next.value;}
    async getArrayAsync(kind,names,generated,cancelled=()=>false){
        const steps=this.arraySteps(kind,names,generated);
        for(;;){if(cancelled()){steps.return();return;}const next=steps.next();if(next.done)return next.value;await new Promise(r=>setTimeout(r,0));}
    }
    *arraySteps(kind,names,generated,preview=false){
        const imageOf=name=>{const img=generated?.get(name)??(preview?this.previewImages.get(name):undefined)??this.images.get(name);if(!img?.placeholder)return img;return {...img,data:Uint8Array.from(kind==='normal'?[128,128,255,255]:kind==='aux'?[0,0,0,0]:[190,190,190,255])};};
        const dimensions=name=>{const image=this.previewImages.get(name)||imageOf(name);return [image.sourceWidth||image.width,image.sourceHeight||image.height];};
        const oversized=name=>Math.max(...dimensions(name))>1024;
        const present=[...new Set(names)].filter(n=>imageOf(n)?.data).sort((a,b)=>{
            const x=dimensions(a),y=dimensions(b);return Number(oversized(a))-Number(oversized(b))||x[0]-y[0]||x[1]-y[1]||(a<b?-1:a>b?1:0);
        });
        const native=!preview&&this.nativeQuality&&this.nativeImages.size>0;
        const small=native?present.filter(n=>!oversized(n)):present,large=native?present.filter(oversized):[];
        const width=list=>native?Math.max(1,...list.map(n=>imageOf(n).width))+2:this.resolution;
        const height=list=>native?Math.max(1,...list.map(n=>imageOf(n).height))+2:this.resolution;
        const key=`${kind}|${preview}|${width(small)}x${height(small)}|${width(large)}x${height(large)}|${this.revision}|${present.join(',')}`;
        const cached=generated?.size?undefined:this.arrays.get(key);if(cached)return this.leaseArray(key,cached);
        const neutral=kind==='albedo'?[190,190,190,255]:kind==='normal'?[128,128,255,255]:[0,0,0,0];
        const fill=new Uint32Array(Uint8Array.from(neutral).buffer)[0];
        const scales=new Float32Array((present.length+1)*4);scales.set([1,1,0,0]);
        const layerOf=new Map(),packed=[];let logical=0;
        for(const list of [small,large]){
            if(list===large&&!large.length)continue;
            const w=width(list),h=height(list),depth=list.length+1,data=new Uint8Array(w*h*4*depth);
            new Uint32Array(data.buffer,0,w*h).fill(fill);
            for(const [index,name]of list.entries()){
                const img=imageOf(name),offset=(index+1)*w*h*4,border=native?1:0;
                for(let y=0;y<h;y++){
                    const row=((y-border+img.height)%img.height)*img.width*4;
                    if(border)data.set(img.data.subarray(row+(img.width-1)*4,row+img.width*4),offset+y*w*4);
                    for(let x=border;x<w;x+=img.width){const count=Math.min(img.width,w-x)*4;data.set(img.data.subarray(row,row+count),offset+(y*w+x)*4);}
                }
                logical++;scales.set([img.width/w,img.height/h,border/w,border/h],logical*4);layerOf.set(name,logical);
                yield;
            }
            packed.push({data,width:w,height:h,depth});
        }
        const textures=packed.map(image=>{
            const tex=new THREE.DataArrayTexture(image.data,image.width,image.height,image.depth);
            tex.format=THREE.RGBAFormat;tex.type=THREE.UnsignedByteType;tex.colorSpace=THREE.NoColorSpace;
            tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;
            tex.generateMipmaps=true;tex.anisotropy=8;tex.needsUpdate=true;return tex;
        });
        textures[0].userData.scales=scales;textures[0].userData.largeStart=large.length?small.length+1:0;
        const entry={texture:textures[0],largeTexture:textures[1],layerOf,users:0};
        if(!generated?.size)this.arrays.set(key,entry);return this.leaseArray(key,entry);
    }

}
export const textureLibrary = new TextureLibrary();
