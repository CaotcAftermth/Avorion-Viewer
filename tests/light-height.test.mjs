import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlock} from '../src/block-model.js';
import {buildBlockEffects} from '../src/avorion/lib/geometry/blockEffects.js';
import {collectBlockLights} from '../src/avorion/lib/geometry/blockLights.js';
import {defaultOrientationProfile} from '../src/avorion/lib/avorion/orientation.js';

test('light sprites and illumination share height scaling along the oriented emitting axis',()=>{
 const profile=defaultOrientationProfile();
 for(const typeIndex of [61,62,63,64,65])for(const [height,total] of [[1,2.1],[2,3.2],[3,4.3]]){
  // Local +Y follows the up axis in every valid block orientation.
  for(let up=0;up<6;up++)for(let look=0;look<6;look++){
   if(Math.floor(look/2)===Math.floor(up/2))continue;
   const axis=['x','y','z'][Math.floor(up/2)],sign=up%2?1:-1;
   const size={x:7,y:8,z:9};size[axis]=height;
   const position={x:10,y:20,z:30};
   const block=makeBlock({id:'light',typeIndex,look,up,size,position});
   const expected={...position};expected[axis]+=sign*(total-height/2);
   const light=collectBlockLights([block],profile)[0];
   const effects=buildBlockEffects([block],profile,{});
   const roots=effects.mesh.geometry.getAttribute('aRoot');
   for(const [i,key] of ['x','y','z'].entries()){
    assert.ok(Math.abs(light.position[key]-expected[key])<1e-8);
    for(let vertex=0;vertex<roots.count;vertex++)assert.ok(Math.abs(roots.array[vertex*3+i]-expected[key])<1e-5);
   }
   effects.dispose();
  }
 }
});
