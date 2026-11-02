// ---------------------------------------------------------------------------
// Texture library.
//
// The app never ships game assets. Textures come from one of two places:
//   1. The app texture folder  ->  public/textures/blocks/   (served at
//      /textures/blocks/NAME.ext). Copy Avorion's data/textures/blocks/*
//      there, or your own files with the same base names.
//   2. A folder the user picks at runtime (persisted locally by the app).
//
// Every image is decoded, resized to a common square resolution and packed
// into three DataArrayTextures (albedo / normal / aux) so the whole ship
// renders with one material and per-vertex layer indices. Layer 0 of each
// array is a neutral fallback for anything that is missing.
// ---------------------------------------------------------------------------
import * as THREE from "../../../vendor/three.module.js";
import { allTextureNames } from "./shadingMap.js";
const EXTENSIONS = ["png", "bmp", "jpg", "jpeg", "webp"];
export const APP_TEXTURE_PATH = new URL('../../../../textures/blocks/', import.meta.url).href;
export class TextureLibrary {
    resolution = 512;
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
    emit() { this.listeners.forEach((l) => l()); }
    has(name) { return this.images.has(name); }
    get loadedCount() { return this.images.size; }
    status() {
        return allTextureNames().map((name) => {
            const s = this.sourceOf.get(name);
            return { name, found: this.images.has(name), source: s?.source, file: s?.file };
        });
    }
    setResolution(res) {
        if (![256, 512, 1024].includes(res))
            return;
        if (res === this.resolution)
            return;
        this.resolution = res;
        // Keep the original blobs, including picked files, for lossless resizing.
        this.images.clear();
        this.disposeArrays();
        void this.enqueue(async (generation) => {
            for (const [name, blob] of this.blobs) {
                if (generation !== this.generation)
                    return;
                const img = await this.decode(blob);
                if (img && generation === this.generation)
                    this.images.set(name, img);
            }
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
                            const img = await this.decode(blob);
                            if (generation !== this.generation)
                                return;
                            if (!img)
                                continue;
                            this.images.set(name, img);
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
    async loadFiles(files, {retainUndecoded=false,sources=null,onProgress=null}={}) {
        // Snapshot FileList before the input gets reset by its change handler.
        const input = Array.from(files);
        return (await this.enqueue(async (generation) => {
            const wanted = new Set(allTextureNames());
            let n = 0, seen = 0;
            for (const f of input) {
                if (generation !== this.generation)
                    return n;
                onProgress?.(seen++, input.length);
                const base = f.name.replace(/\.[^.]+$/, "").toLowerCase();
                if (!wanted.has(base))
                    continue;
                const source=sources?.get(f.name)==='app'?'app':'folder';
                // Restoring must not erase the only saved original if decoding fails.
                if(retainUndecoded){this.blobs.set(base,f);this.sourceOf.set(base,{source,file:f.name});}
                const img = await this.decode(f);
                if (generation !== this.generation)
                    return n;
                if (!img)
                    continue;
                this.images.set(base, img);
                this.blobs.set(base, f);
                this.sourceOf.set(base, { source, file: f.name });
                n++;
            }
            onProgress?.(input.length, input.length);
            return n;
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
            if (img?.width === this.resolution) this.images.set(name, img);
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
        this.images.clear();
        this.blobs.clear();
        this.sourceOf.clear();
        this.disposeArrays();
        this.emit();
    }
    async decode(blob) {
        try {
            const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
            const size = this.resolution;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(bmp, 0, 0, size, size);
            bmp.close();
            return ctx.getImageData(0, 0, size, size);
        }
        catch {
            return undefined;
        }
    }
    // --- GPU arrays ------------------------------------------------------------
    disposeArrays() {
        // Existing previews retain their arrays until their model is disposed.
        for (const a of this.arrays.values())
            if (!a.users)
                a.texture.dispose();
        this.arrays.clear();
    }
    leaseArray(key, entry) {
        entry.users++;
        let released = false;
        return { texture: entry.texture, layerOf: entry.layerOf, release: () => {
                if (released)
                    return;
                released = true;
                if (--entry.users === 0) {
                    if (this.arrays.get(key) === entry)
                        this.arrays.delete(key);
                    entry.texture.dispose();
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
    getArray(kind, names, generated) {
        const imageOf = (name) => generated?.get(name) ?? this.images.get(name);
        const present = [...new Set(names)].filter((n) => imageOf(n)?.width === this.resolution).sort();
        const key = `${kind}|${this.resolution}|${present.join(",")}`;
        // Generated images belong to the model: editing a name must not grow this cache.
        const cached = generated?.size ? undefined : this.arrays.get(key);
        if (cached)
            return this.leaseArray(key, cached);
        const size = this.resolution;
        const depth = present.length + 1;
        const data = new Uint8Array(size * size * 4 * depth);
        data.set(this.fallbackLayer(kind, size), 0);
        const layerOf = new Map();
        present.forEach((name, i) => {
            const img = imageOf(name);
            data.set(img.data, (i + 1) * size * size * 4);
            layerOf.set(name, i + 1);
        });
        const tex = new THREE.DataArrayTexture(data, size, size, depth);
        tex.format = THREE.RGBAFormat;
        tex.type = THREE.UnsignedByteType;
        // Everything stays in gamma space, like the game (see gameShader.ts).
        tex.colorSpace = THREE.NoColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        const entry = { texture: tex, layerOf, users: 0 };
        if (!generated?.size)
            this.arrays.set(key, entry);
        return this.leaseArray(key, entry);
    }
}
export const textureLibrary = new TextureLibrary();
