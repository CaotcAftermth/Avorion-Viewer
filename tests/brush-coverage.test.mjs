import test from 'node:test';
import assert from 'node:assert/strict';
import {closestTrianglePoint,visibleBrushFace} from '../src/brush-coverage.js';
test('brush finds sub-grid faces inside the circle',()=>{
 const face=[[2.2,2.2],[2.4,2.2],[2.2,2.4]];
 assert.ok(visibleBrushFace('tiny',[face],0,0,10,(x,y)=>x>=2.2&&y>=2.2?'tiny':null));
 assert.equal(visibleBrushFace('tiny',[face],0,0,10,()=> 'front'),false);
 assert.equal(visibleBrushFace('tiny',[face],0,0,1,()=> 'tiny'),false);
});
test('brush detects a thin edge even when its center lies outside the brush',()=>{
 const face=[[9,-30],[9.2,-30],[9,30]];
 assert.ok(visibleBrushFace('edge',[face],0,0,10,()=> 'edge'));
 assert.deepEqual(closestTrianglePoint([0,0],[[1,-2],[1,2],[3,0]]),[1,0]);
});
