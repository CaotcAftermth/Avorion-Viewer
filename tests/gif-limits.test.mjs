import test from 'node:test';
import assert from 'node:assert/strict';
import {fitGifSize,gifLimits} from '../src/export/gif-limits.js';
test('GIF dimensions fit timing limits and preserve proportions',()=>{
 assert.equal(gifLimits(6,15).frames,90);
 assert.deepEqual(fitGifSize(2048,2048,6,15),{width:1333,height:1333});
 for(const duration of [1,4,6,20])for(const fps of [5,15,30])for(const [w,h] of [[3840,2160],[2048,2048],[600,1200],[1,32768]]){
 const s=fitGifSize(w,h,duration,fps);assert.ok(s.width>=1&&s.height>=1&&s.width<=2048&&s.height<=2048);assert.ok(s.width*s.height*Math.round(duration*fps)<=160000000);
 }
 assert.deepEqual(fitGifSize(1900,1000,6,15,'width'),{width:1777,height:1000});
 assert.deepEqual(fitGifSize(640,360,6,15),{width:640,height:360});
});
