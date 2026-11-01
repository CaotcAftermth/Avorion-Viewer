import test from 'node:test';
import assert from 'node:assert/strict';
import { cubeFaces, cubeCommand } from '../src/view-cube.js';
import { area } from '../src/layout.js';
import { alignView } from '../src/navigation.js';
import { parsePreferences, validPreference } from '../src/preferences.js';

test('labels follow each projected face edge without mirroring',()=>{
  const view=area().view;
  for(const [yaw,pitch,roll] of [[.6,.4,0],[-2,-.5,.8],[2.7,.9,-1.2]]){
    Object.assign(view,{yaw,pitch,roll});
    for(const face of cubeFaces(view)){
      const [a,b,c,d,x,y]=face.labelTransform,[p0,p1,,p3]=face.points;
      assert.ok(Math.abs(a*46-(p1[0]-p0[0]))<1e-9);
      assert.ok(Math.abs(b*46-(p1[1]-p0[1]))<1e-9);
      assert.ok(Math.abs(c*46-(p0[0]-p3[0]))<1e-9);
      assert.ok(Math.abs(d*46-(p0[1]-p3[1]))<1e-9);
      assert.ok(a*d-b*c>0,'Visible labels must not be mirrored');
      assert.ok(Number.isFinite(x)&&Number.isFinite(y));
    }
  }
  for(const name of ['front','back','left','right','top','bottom']){
    alignView(view,name);const [a,b,c,d]=cubeFaces(view)[0].labelTransform;
    assert.ok(Math.abs(a-1)<1e-9&&Math.abs(d-1)<1e-9&&Math.abs(b)<1e-9&&Math.abs(c)<1e-9,name+' label reads upright');
  }
});
test('cube controls issue independent quarter turns',()=>{
  assert.equal(cubeCommand('left').x,-cubeCommand('right').x);
  assert.equal(cubeCommand('up').y,-cubeCommand('down').y);
  assert.deepEqual(cubeCommand('home'),{action:'home'});
  assert.deepEqual(cubeCommand('clockwise'),{action:'pole-roll',value:1});
  assert.deepEqual(cubeCommand('counterclockwise'),{action:'pole-roll',value:-1});
});
test('cube size validates and older preferences retain a usable default',()=>{
  assert.equal(parsePreferences('{"version":1}').viewCubeSize,120);
  for(const value of [80,120,240])assert.equal(validPreference('viewCubeSize',value),true);
  for(const value of [0,79,241,Infinity,'120'])assert.equal(validPreference('viewCubeSize',value),false);
  assert.equal(parsePreferences('{"version":1,"viewCubeSize":180}').viewCubeSize,180);
});
import { CUBE_VIEWS, cubeRegions, alignCubeView } from '../src/view-cube.js';
import { basis } from '../src/navigation.js';
test('all 26 cube targets align the camera to their face, edge, or corner',()=>{
  assert.equal(Object.keys(CUBE_VIEWS).length,26);
  const counts=[0,0,0,0],view=area().view;
  for(const [name,direction] of Object.entries(CUBE_VIEWS)){
    counts[direction.filter(Boolean).length]++;alignCubeView(view,name);
    const length=Math.hypot(...direction),back=basis(view).back;
    direction.forEach((v,i)=>assert.ok(Math.abs(back[i]-v/length)<1e-9,name));
    assert.equal(view.roll,0);assert.equal(view.projection,'perspective');
  }
  assert.deepEqual(counts,[0,6,12,8]);
});
test('cube patches cover each visible face and combine shared edge and corner targets',()=>{
  const view=area().view;view.yaw=Math.PI/4;view.pitch=.6;
  const regions=cubeRegions(view);
  assert.equal(regions.reduce((sum,region)=>sum+region.patches.length,0),27);
  assert.equal(regions.find(region=>region.name==='top-front-right').patches.length,3);
  assert.equal(regions.find(region=>region.name==='front-right').patches.length,2);
  assert.equal(regions.find(region=>region.name==='front').patches.length,1);
  const polygonArea=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0)/2);
  assert.ok(Math.abs(regions.reduce((sum,r)=>sum+r.patches.reduce((s,p)=>s+polygonArea(p),0),0)-cubeFaces(view).reduce((sum,f)=>sum+polygonArea(f.points),0))<1e-8);
  alignView(view,'front');assert.equal(cubeRegions(view).length,9);
});
import { selectCubeView, homeCubeView } from '../src/view-cube.js';
import { isPoleView, rotatePoleView } from '../src/view-cube.js';
test('default Home is Top Front Right and every view respects projection toggle',()=>{
  const defaults=area().view;assert.equal(defaults.projection,'perspective');
  basis(defaults).back.forEach((v,i)=>assert.ok(Math.abs(v-[1,-1,1][i]/Math.sqrt(3))<1e-9));
  for(const projection of ['perspective','orthographic']){
    const view={...area().view,projection};
    for(const name of Object.keys(CUBE_VIEWS)){alignCubeView(view,name);assert.equal(view.projection,projection);selectCubeView(view,name);assert.equal(view.projection,projection);}
    for(const name of ['front','back','left','right','top','bottom']){alignView(view,name);assert.equal(view.projection,projection);}
    homeCubeView(view);assert.equal(view.projection,projection);
  }
});
test('pole rotation is exactly 90 degrees, reverses, and never changes viewing direction',()=>{
  for(const name of ['top','bottom']){
    const view=area().view;alignCubeView(view,name);const before=structuredClone(view),back=basis(view).back;
    assert.ok(isPoleView(view));assert.equal(rotatePoleView(view,true),true);assert.equal(view.roll,Math.PI/2);assert.deepEqual(basis(view).back,back);
    rotatePoleView(view,false);assert.deepEqual(view,before);
    for(let i=0;i<4;i++)rotatePoleView(view,true);assert.ok(Math.abs(view.roll)<1e-9);
  }
  const view=area().view,before=structuredClone(view);assert.equal(rotatePoleView(view),false);assert.deepEqual(view,before);
});
test('reselecting any cardinal face flips to its opposite, including rolled views',()=>{
  for(const name of ['front','back','left','right','top','bottom']){
    const view=area().view;alignCubeView(view,name);view.roll=.8;
    selectCubeView(view,name);
    const back=basis(view).back;CUBE_VIEWS[name].forEach((value,i)=>assert.ok(Math.abs(back[i]+value)<1e-9));
    assert.equal(view.roll,0);
  }
});
test('edge and corner reselection never flips and selecting another face aligns normally',()=>{
  const view=area().view;
  for(const [name,direction] of Object.entries(CUBE_VIEWS).filter(([,direction])=>direction.filter(Boolean).length>1)){
    alignCubeView(view,name);const before=structuredClone(view);selectCubeView(view,name);assert.deepEqual(view,before);
  }
  alignCubeView(view,'front');selectCubeView(view,'right');assert.ok(Math.abs(view.yaw-Math.PI/2)<1e-9);
});
test('Home resets the complete camera to default perspective without resetting display settings',()=>{
  const view=area().view,defaults=structuredClone(view);
  Object.assign(view,{yaw:2,pitch:-1,zoom:4,panX:44,panY:-10,target:[8,9,10],roll:1,grid:false,wire:true,tool:'pan'});
  homeCubeView(view);
  for(const key of ['yaw','pitch','zoom','panX','panY','target','roll'])assert.deepEqual(view[key],defaults[key]);
  assert.equal(view.projection,'perspective');assert.equal(view.grid,false);assert.equal(view.wire,true);assert.equal(view.tool,'pan');
});
