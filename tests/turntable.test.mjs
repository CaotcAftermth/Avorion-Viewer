import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTurntable,turntableCamera} from '../src/export/turntable.js';
import {imageDefaults,captureImage} from '../src/export/image-options.js';
import {makeBlock,makeModel,blockFramePoints} from '../src/block-model.js';
import {area} from '../src/layout.js';
import {projectPoint} from '../src/navigation.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
const options=()=>({...imageDefaults(area().view,640,480),type:'turntable',format:'gif',duration:4,fps:15,direction:'clockwise',background:'solid',camera:'isometric'});
test('turntable validates timing, transparent output and bounded frame work',()=>{
 const o=options();assert.equal(validateTurntable(o).frames,60);assert.doesNotThrow(()=>validateTurntable({...o,background:'transparent'}));
 for(const patch of [{duration:0},{duration:NaN},{fps:31},{fps:5.5},{direction:'invalid'},{width:2049},{width:2048,height:2048,duration:20,fps:30}])assert.throws(()=>validateTurntable({...o,...patch}));
});
test('turntable Frame All keeps elongated, offset geometry inside every angle',()=>{
 const blocks=[makeBlock({position:{x:20,y:-10,z:40},size:{x:3,y:5,z:70}})],scene={loaded:true,visible:true,model:makeModel(blocks),selectedIds:new Set(),hiddenIds:new Set()};
 const snapshot=captureImage(scene,area().view,FACTORY_PREFERENCES,{width:640,height:480});
 const original=JSON.stringify(snapshot.view);
 for(const projection of ['perspective','orthographic']){
  const view=turntableCamera(snapshot,{...options(),projection});
  for(let i=0;i<72;i++){
   view.yaw=i*Math.PI/36;
   for(const point of blockFramePoints(blocks)){const p=projectPoint(point,view,640,480);assert.ok(p&&p[0]>0&&p[0]<640&&p[1]>0&&p[1]<480);}
  }
 }
 assert.equal(JSON.stringify(snapshot.view),original);
});

test('Frame All fills a wide output and respects current projection and elevation',()=>{
 const blocks=[makeBlock({size:{x:70,y:3,z:5}})],scene={loaded:true,visible:true,model:makeModel(blocks),selectedIds:new Set(),hiddenIds:new Set()};
 const source=area().view;source.projection='perspective';source.pitch=.3;
 const snapshot=captureImage(scene,source,FACTORY_PREFERENCES,{width:1000,height:400});
 const o={...options(),width:1000,height:400,projection:'current',camera:'isometric',elevation:10,margin:.06};
 const view=turntableCamera(snapshot,o);assert.equal(view.projection,'perspective');assert.equal(view.pitch,10*Math.PI/180);
 let maxWidth=0;
 for(let i=0;i<72;i++){
  view.yaw=i*Math.PI/36;const points=blockFramePoints(blocks).map(p=>projectPoint(p,view,1000,400));
  assert.ok(points.every(p=>p&&p[0]>=59.9&&p[0]<=940.1&&p[1]>=23.9&&p[1]<=376.1));
  maxWidth=Math.max(maxWidth,Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])));
 }
 assert.ok(maxWidth>700,`Expected width >700, got ${maxWidth}`);
 assert.equal(turntableCamera(snapshot,{...o,camera:'current',elevation:undefined}).pitch,.3);
});
