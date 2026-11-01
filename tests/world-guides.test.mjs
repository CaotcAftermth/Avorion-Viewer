import test from 'node:test';
import assert from 'node:assert/strict';
import {area,cloneTree} from '../src/layout.js';
import {ensureViewportOptions,viewportPreferences} from '../src/viewport-options.js';
import {gridSpacing,createWorldGuides} from '../src/world-guides.js';
import * as THREE from '../src/vendor/three.module.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
import {gameParams} from '../src/game-renderer.js';

test('ambient-only bypasses studio lighting in every surface shading mode',()=>{
 for(const shading of ['SOLID','MATERIAL','RENDERED']){
  const view=area().view;Object.assign(ensureViewportOptions(view),{shading,ambientOnly:true,ambientStrength:1.25});
  const params=gameParams(viewportPreferences(FACTORY_PREFERENCES,view));
  assert.equal(params.lightIntensity,0);assert.equal(params.ambientIntensity,0);assert.equal(params.ambientFillIntensity,1.25);
  assert.equal(params.specularity,0);assert.equal(params.maxReflectivity,0);assert.equal(params.ambientFillColor,'#ffffff');
 }
});
test('adaptive grid grows with distance, independent of camera translation or projection',()=>{
 const view=area().view;ensureViewportOptions(view);const near=gridSpacing(view,800,600);
 view.zoom/=100;assert.equal(gridSpacing(view,800,600),near*100);
 view.target=[100000,100000,100000];view.panX=200;view.projection='orthographic';assert.equal(gridSpacing(view,800,600),near*100);
 view.display.gridScale=2;assert.equal(gridSpacing(view,800,600),near*200);
});
test('infinite axes and Info order survive layout cloning and JSON persistence',()=>{
 const node=area();Object.assign(ensureViewportOptions(node.view),{axisInfinite:true,axisLength:1234,axisWidth:5,axisBrightness:2});node.infoNewestFirst=true;
 const copy=JSON.parse(JSON.stringify(cloneTree(node)));assert.equal(copy.infoNewestFirst,true);assert.equal(ensureViewportOptions(copy.view).axisInfinite,true);assert.equal(copy.view.display.axisWidth,5);
 copy.view.display.axisWidth=-1;assert.equal(ensureViewportOptions(copy.view).axisWidth,1);assert.equal(node.view.display.axisWidth,5);
});

test('ambient shape contrast defaults gently and preserves the flat-lighting option',()=>{
 const view=area().view,d=ensureViewportOptions(view);assert.equal(d.ambientDetail,.35);
 d.ambientDetail=0;assert.equal(ensureViewportOptions(view).ambientDetail,0);
 d.ambientDetail=2;assert.equal(ensureViewportOptions(view).ambientDetail,.35);
 d.ambientDetail=.6;assert.equal(ensureViewportOptions(JSON.parse(JSON.stringify(view))).ambientDetail,.6);
});

test('grid hides when a perspective eye lies in the floor plane (exact side views)',()=>{
 const view=area().view;ensureViewportOptions(view);view.grid=true;const guides=createWorldGuides(),theme={grid:'#555555',majorGrid:'#666666'};
 const look=(camera,y)=>{camera.position.set(10,y,0);camera.lookAt(0,y,0);camera.updateMatrixWorld();camera.updateProjectionMatrix();guides.update(camera,view,800,600,theme,1,0);return guides.grid.visible;};
 assert.equal(look(new THREE.PerspectiveCamera(50,4/3,.1,1000),0),false);
 assert.equal(look(new THREE.PerspectiveCamera(50,4/3,.1,1000),2),true);
 assert.equal(look(new THREE.OrthographicCamera(-4,4,3,-3,.1,1000),0),true);
});
