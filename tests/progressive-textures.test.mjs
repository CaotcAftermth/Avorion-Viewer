import test from 'node:test';
import assert from 'node:assert/strict';
import {TextureLibrary} from '../src/avorion/lib/textures/textureLibrary.js';
import {prepareTexturePixels} from '../src/avorion/lib/textures/pngTexture.js';
import {textureLibrary} from '../src/avorion/lib/textures/textureLibrary.js';
import {makeBlock,makeModel} from '../src/block-model.js';
import {buildTexturedModel} from '../src/avorion/lib/geometry/texturedModel.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';
import {DEFAULT_GAME_SHADER} from '../src/avorion/types/index.js';
const image=(width,height)=>({width,height,data:Uint8Array.from({length:width*height*4},(_,i)=>i%251)});
test('preview caps dimensions and preserves aspect without upscaling; native retains original pixels',()=>{
 const original=image(1024,256),preview=prepareTexturePixels(original,-512);
 assert.equal(preview.width,512);assert.equal(preview.height,128);
 assert.equal(prepareTexturePixels(original,0),original);
 const small=image(128,64);assert.equal(prepareTexturePixels(small,-512),small);
});
test('mixed-size GPU layers retain native texels with periodic border and UV scales',()=>{
 const library=new TextureLibrary(),large=image(4,2),small=image(2,1);
 library.nativeImages.set('large',true);library.images.set('large',large);library.images.set('small',small);
 const array=library.getArray('albedo',['small','large']);
 try{
  const {data,width,height}=array.texture.image;assert.equal(width,6);assert.equal(height,4);
  for(const [name,original]of [['large',large],['small',small]]){
   const layer=array.layerOf.get(name);
   for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++){
    const index=(layer*width*height+(y+1)*width+x+1)*4;
    assert.deepEqual([...data.subarray(index,index+4)],[...original.data.subarray((y*original.width+x)*4,(y*original.width+x+1)*4)]);
   }
   assert.ok(Math.abs(array.texture.userData.scales[layer*4]-original.width/width)<1e-6);
  }
 }finally{array.release();}
});
test('native upgrade publishes one complete batch after previews and cancels on unload',async()=>{
 const library=new TextureLibrary(),file=new File(['pixels'],'rock.png'),original=image(1024,256),events=[];
 library.decode=async(blob,size)=>prepareTexturePixels(original,size);
 library.subscribe(event=>{if(event==='quality')events.push([...library.images].map(([name,img])=>[name,img.width,img.height]));});
 await library.loadFiles([file]);assert.equal(library.images.get('rock').width,512);assert.equal(events.length,0);
 library.requestNative(['rock']);await library.upgradeTask;
 assert.equal(library.images.get('rock'),original);assert.deepEqual(events,[[['rock',1024,256]]]);
 library.nativeImages.clear();library.requestNative(['rock']);library.clear();await library.upgradeTask;assert.equal(library.loadedCount,0);
});
test('texture-only replacement preserves geometry and selection attributes, disposing prior texture leases',async()=>{
 textureLibrary.clear();textureLibrary.images.set('plates0',image(4,2));
 const built=buildTexturedModel(makeModel([makeBlock({materialIndex:0})]),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
 try{
  const mesh=built.group.children.find(m=>m.userData.textured),geometry=mesh.geometry,state=geometry.getAttribute('aParams').array.slice(),old=mesh.material.uniforms.uAlbedo.value;
  let released=false;old.addEventListener('dispose',()=>released=true);
  textureLibrary.images.set('plates0',image(8,4));textureLibrary.revision++;textureLibrary.disposeArrays();
  const uploads=[];await built.updateTextures(async texture=>uploads.push(texture));
  assert.equal(mesh.geometry,geometry);assert.deepEqual(geometry.getAttribute('aParams').array,state);
  assert.notEqual(mesh.material.uniforms.uAlbedo.value,old);assert.ok(released);assert.equal(uploads.length,3);
 }finally{built.dispose();textureLibrary.clear();}
});
test('switching native quality back to fixed 512 resamples an already upgraded library',async()=>{
 const library=new TextureLibrary(),file=new File(['pixels'],'rock.png'),original=image(1024,256);
 library.blobs.set('rock',file);library.images.set('rock',original);library.decode=async(blob,size)=>prepareTexturePixels(original,size);
 await library.setResolution(512);assert.equal(library.nativeQuality,false);assert.equal(library.images.get('rock').width,512);assert.equal(library.images.get('rock').height,512);
});

test('disposing a model during upload prevents replacement and releases pending resources',async()=>{
 textureLibrary.clear();textureLibrary.images.set('plates0',image(4,2));
 const built=buildTexturedModel(makeModel([makeBlock({materialIndex:0})]),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
 const before=built.materials[0].uniforms.uAlbedo.value;
 textureLibrary.images.set('plates0',image(8,4));textureLibrary.revision++;textureLibrary.disposeArrays();
 let resume;const gate=new Promise(r=>resume=r),uploads=[];
 const pending=built.updateTextures(async texture=>{uploads.push(texture);if(uploads.length===1)await gate;});
 while(!uploads.length)await new Promise(r=>setTimeout(r,0));built.dispose();let released=0;uploads[0].addEventListener('dispose',()=>released++);resume();await pending;
 assert.equal(built.materials[0].uniforms.uAlbedo.value,before);assert.equal(released,1);textureLibrary.clear();
});
test('a live model upgrades only used maps after its preview is presented',async()=>{
 const library=new TextureLibrary(),original=image(1024,256),decoded=[];
 library.decode=async(blob,size)=>{decoded.push([blob.name,size]);return prepareTexturePixels(original,size);};
 await library.loadFiles([new File(['rock'],'rock.png'),new File(['unused'],'stripes.png')]);decoded.length=0;
 const use=library.retainNative(['rock']);
 library.requestNative(['rock','stripes']);assert.equal(library.upgradeTask,undefined);assert.deepEqual(decoded,[]);
 use.present();await library.upgradeTask;
 assert.deepEqual(decoded,[['rock.png',0]]);assert.deepEqual([...library.nativeImages.keys()],['rock']);
 assert.equal(library.previewImages.get('rock').width,512);use.release();
});

test('closing a presented model discards an in-flight native decode',async()=>{
 const library=new TextureLibrary(),blob=new File(['rock'],'rock.png');let resume;
 library.blobs.set('rock',blob);library.images.set('rock',image(512,512));
 library.decode=()=>new Promise(r=>resume=r);const events=[];library.subscribe(e=>events.push(e));
 const use=library.retainNative(['rock']);use.present();await Promise.resolve();use.release();resume(image(1024,1024));await library.upgradeTask;
 assert.equal(library.nativeImages.size,0);assert.equal(library.images.get('rock').width,512);assert.deepEqual(events,[]);
});

test('native shader preparation keeps the preview bound and commits only after readiness',async()=>{
 textureLibrary.clear();textureLibrary.images.set('plates0',image(4,2));
 const built=buildTexturedModel(makeModel([makeBlock({materialIndex:0})]),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
 try{
  const mesh=built.group.children.find(m=>m.userData.textured),before=mesh.material,geometry=mesh.geometry;
  const updated=await built.updateTextures(async()=>{},async staged=>{
   assert.equal(mesh.material,before);const next=staged.children.find(m=>m.isMesh).material;
   assert.notEqual(next,before);assert.equal(next.defines.NATIVE_SCALE_VERTEX,1);assert.ok(!next.fragmentShader.includes('texelFetch(uTextureScales'));
  },{vertexScales:true});
  assert.equal(updated,true);assert.notEqual(mesh.material,before);assert.equal(mesh.geometry,geometry);
 }finally{built.dispose();textureLibrary.clear();}
});

test('preview cache reads overlap with a bounded pool and duplicate files retain input order',async()=>{
 const library=new TextureLibrary();let active=0,peak=0;
 library.decode=async file=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return image(1,1);};
 const files=Array.from({length:12},(_,i)=>new File(['pixels'],'custom'+i+'.png'));files.push(new File(['new'],'custom0.png'));
 await library.loadFiles(files,{allowUnlisted:true,retainUndecoded:true});
 assert.ok(peak>1);assert.ok(peak<=6);assert.equal(library.blobs.get('custom0'),files.at(-1));
});
test('oversized native maps use a companion array without padding small layers to their size',()=>{
 const library=new TextureLibrary(),small=image(128,128),large=image(2048,32);
 library.images.set('small',small);library.images.set('large',large);library.nativeImages.set('large',true);
 const array=library.getArray('aux',['large','small']);let disposed=0;
 try{
  assert.equal(array.texture.image.width,130);assert.equal(array.texture.image.depth,2);
  assert.equal(array.largeTexture.image.width,2050);assert.equal(array.largeTexture.image.height,34);assert.equal(array.largeTexture.image.depth,2);
  assert.equal(array.layerOf.get('small'),1);assert.equal(array.layerOf.get('large'),2);assert.equal(array.texture.userData.largeStart,2);
  assert.equal(array.texture.userData.scales.length,12);
  array.largeTexture.addEventListener('dispose',()=>disposed++);
 }finally{array.release();assert.equal(disposed,1);}
});

test('failed shader preparation keeps preview resources and material intact',async()=>{
 textureLibrary.clear();textureLibrary.images.set('plates0',image(4,2));
 const built=buildTexturedModel(makeModel([makeBlock({materialIndex:0})]),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true});
 try{
  const mesh=built.group.children.find(m=>m.userData.textured),before=mesh.material;const hook=()=>{};before.onBeforeCompile=hook;
  await assert.rejects(built.updateTextures(async()=>{},async staged=>{assert.equal(staged.children[0].material.onBeforeCompile,hook);throw Error('Preparation failed');}),/Preparation failed/);
  assert.equal(mesh.material,before);
 }finally{built.dispose();textureLibrary.clear();}
});
test('presenting a new model with cached native maps still triggers a texture-only upgrade',async()=>{
 const library=new TextureLibrary(),blob=new File(['rock'],'rock.png'),events=[];
 library.blobs.set('rock',blob);library.previewImages.set('rock',image(512,512));library.images.set('rock',image(1024,1024));library.nativeImages.set('rock',blob);
 library.decode=()=>{throw Error('Cached native pixels must not decode again');};library.subscribe(e=>events.push(e));
 const use=library.retainNative(['rock']);assert.deepEqual(events,[]);use.present();await Promise.resolve();assert.deepEqual(events,['quality']);assert.equal(library.upgradeTask,undefined);use.release();
});
test('a lightweight first frame upgrades to full shading even without imported textures',async()=>{
 textureLibrary.clear();const events=[];const unsubscribe=textureLibrary.subscribe(event=>events.push(event));
 const built=buildTexturedModel(makeModel([makeBlock({materialIndex:0})]),defaultOrientationProfile(),{...DEFAULT_GAME_SHADER,simplified:true,loadingPreview:true});
 try{
  const mesh=built.group.children.find(m=>m.userData.textured),geometry=mesh.geometry;
  assert.equal(mesh.material.userData.loadingPreview,true);assert.equal(built.needsTextureUpdate(),true);
  built.markPreviewPresented();await Promise.resolve();assert.ok(events.includes('quality'));
  await built.updateTextures(async()=>{},async()=>{},{vertexScales:true});
  assert.equal(mesh.material.userData.loadingPreview,false);assert.equal(built.needsTextureUpdate(),false);assert.equal(mesh.geometry,geometry);
 }finally{built.dispose();unsubscribe();textureLibrary.clear();}
});
test('session previews decode only needed maps while preserving lazy originals and layer identities',async()=>{
 const library=new TextureLibrary(),header=new Uint8Array(26),view=new DataView(header.buffer);header.set([137,80,78,71,13,10,26,10]);view.setUint32(16,2048);view.setUint32(20,128);
 const rock=new File(['rock'],'rock.png'),stripes=new File([header],'stripes.png'),calls=[];
 library.decode=async(file,size)=>{calls.push([file.name,size]);return prepareTexturePixels(image(file===stripes?2048:64,128),size);};
 await library.loadFiles([rock,stripes],{retainUndecoded:true,previewNames:new Set(['rock'])});
 assert.deepEqual(calls,[['rock.png',512]]);assert.equal(library.blobs.get('stripes'),stripes);assert.equal(library.images.get('stripes').placeholder,true);
 const before=library.getArray('albedo',['rock','stripes'],undefined,true),id=before.layerOf.get('stripes');before.release();
 const use=library.retainNative(['stripes']);use.present();await library.upgradeTask;
 assert.equal(library.images.get('stripes').width,2048);assert.equal(library.previewImages.get('stripes').width,512);assert.equal(library.previewImages.get('stripes').sourceWidth,2048);
 const after=library.getArray('albedo',['rock','stripes']);assert.equal(after.layerOf.get('stripes'),id);after.release();use.release();
});