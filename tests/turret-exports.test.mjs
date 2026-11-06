import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock,makeModel,blockFramePoints} from '../src/block-model.js';
import {demoProject} from '../src/turrets/core.js';
import {blockSockets} from '../src/turrets/sockets.js';
import {placeTurret} from '../src/turrets/mounts.js';
import {visibleFrameBlocks,frameVisibleModel} from '../src/model-framing.js';
import {captureExport} from '../src/export/snapshot.js';
import {prepareExport} from '../src/export/pipeline.js';
import {encodeExport} from '../src/export/formats.js';
import {captureImage,imageDefaults} from '../src/export/image-options.js';
import {turntableCamera} from '../src/export/turntable.js';
import {area} from '../src/layout.js';
import {projectPoint} from '../src/navigation.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
function fixture(){
 const block=makeBlock({typeIndex:24,size:{x:4,y:.001,z:4}}),scene={loaded:true,visible:true,model:makeModel([block]),hiddenIds:new Set(),selectedIds:new Set()};
 const asset=demoProject().assets[0];asset.sourceSize=1;
 const socket=blockSockets(block).find(s=>s.normal[1]>.99);placeTurret(scene,asset,socket,3);
 Object.assign(scene.model.turretMounts[0],{yaw:35,pitch:50,twist:20});return scene;
}
test('frame and GIF cameras contain posed turrets even when their thin support is hidden',()=>{
 const scene=fixture(),view=area().view;view.showThinBlocks=false;
 const blocks=visibleFrameBlocks(scene,view);assert.equal(blocks.length,4);
 assert.ok(frameVisibleModel(scene,view,640,480));
 for(const p of blockFramePoints(blocks)){const q=projectPoint(p,view,640,480);assert.ok(q&&q[0]>0&&q[0]<640&&q[1]>0&&q[1]<480);}
 const snapshot=captureImage(scene,view,FACTORY_PREFERENCES,{width:640,height:480});
 assert.deepEqual(snapshot.scene.model.turretMounts,scene.model.turretMounts);assert.notEqual(snapshot.scene.model.turretMounts,scene.model.turretMounts);
 for(const projection of ['perspective','orthographic']){
  const camera=turntableCamera(snapshot,{...imageDefaults(view,640,480),projection});
  for(let i=0;i<36;i++){camera.yaw=i*Math.PI/18;for(const p of blockFramePoints(blocks)){const q=projectPoint(p,camera,640,480);assert.ok(q&&q[0]>0&&q[0]<640&&q[1]>0&&q[1]<480);}}
 }
});
test('Frame Selected includes posed turrets and respects the Paint Mode toggle',()=>{
 const scene=fixture(),view=area().view,mount=scene.model.turretMounts[0];
 assert.deepEqual(visibleFrameBlocks(scene,view,true),[]);
 scene.selectedTurretIds=new Set([mount.id]);
 assert.equal(visibleFrameBlocks(scene,view,true).length,4);
 view.interactionMode='paint';view.hidePaintAttachments=true;
 assert.deepEqual(visibleFrameBlocks(scene,view,true),[]);
 view.interactionMode='object';
 assert.equal(visibleFrameBlocks(scene,view,true).length,4);
});
test('all model formats include baked turret poses and preserve snapshot isolation',async()=>{
 const scene=fixture(),snapshot=captureExport(scene,{showThinBlocks:false},{scope:'visible'});
 assert.equal(snapshot.blocks.length,4);assert.ok(snapshot.blocks.every(b=>b.exportPositions?.length));
 const options={mode:'detailed',longest:100,budget:512,includeTransparent:true,cleanup:true};
 for(const format of ['stl','obj','glb','gltf','3mf']){
  const result=await prepareExport(snapshot,{...options,format});assert.equal(result.objects.length,4);assert.ok(encodeExport(result).bytes.length>0);
 }
 const shell=await prepareExport(snapshot,{...options,format:'stl',mode:'shell'});assert.ok(encodeExport(shell).bytes.length>84);
 scene.model.turretMounts[0].hidden=true;
 assert.throws(()=>captureExport(scene,{showThinBlocks:false},{scope:'visible'}),/no blocks/);
 assert.equal(captureExport(scene,{}, {scope:'all'}).blocks.length,5);
});
