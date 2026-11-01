import test from 'node:test';
import assert from 'node:assert/strict';
import { area, defaults, leaves, validateState } from '../src/layout.js';
import { STEP, NEAR, basis, dot, ensureCamera, orbit, pan, zoom, dolly, alignView, opposite, snapAxis, viewLabel, frameBounds, projectPoint, clipNear, zoomRegion, dragMode, navigationKey, REFERENCE_VERTICES } from '../src/navigation.js';

const camera = () => area().view;
const close = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test('rightward orbit decreases yaw; vertical drag retains its direction', () => {
  const view=camera(),start={...view};orbit(view,20,10);
  close(view.yaw,start.yaw-.16);close(view.pitch,start.pitch+.08);
  orbit(view,-20,-10);close(view.yaw,start.yaw);close(view.pitch,start.pitch);
});
test('orbit clears pole roll and restores a level camera in both projections', () => {
  for(const pole of ['top','bottom'])for(const projection of ['perspective','orthographic'])for(const roll of [-Math.PI/2,Math.PI/2,Math.PI]){
    const view=camera();alignView(view,pole);Object.assign(view,{roll,projection});
    orbit(view,0,0);assert.equal(view.roll,roll);
    orbit(view,10,pole==='top'?-10:10);
    assert.equal(view.roll,0);assert.equal(view.projection,projection);
    close(basis(view).right[2],0);assert.ok(basis(view).up[2]>0);
  }
});
test('front-facing geometry follows rightward mouse motion, without mirrored camera coordinates', () => {
  const view=camera();alignView(view,'front');
  const point=[0,-1,1],before=projectPoint(point,view,800,600);
  orbit(view,40,0);
  assert.ok(projectPoint(point,view,800,600)[0]>before[0]);
  const b=basis(view),cross=[b.right[1]*b.up[2]-b.right[2]*b.up[1],b.right[2]*b.up[0]-b.right[0]*b.up[2],b.right[0]*b.up[1]-b.right[1]*b.up[0]];
  cross.forEach((v,i)=>close(v,b.back[i]));
});
test('six rightward numpad steps reach the right-side axis', () => {
  const view=camera();alignView(view,'front');
  const command=navigationKey({code:'Numpad6'});
  for(let i=0;i<6;i++)orbit(view,command.x,command.y);
  assert.equal(viewLabel(view),'Right Perspective');
});
test('orbit pivot remains fixed in screen space', () => {
  const view=camera();view.target=[4,-6,2];
  const before=projectPoint(view.target,view,900,600);orbit(view,80,-20);
  const after=projectPoint(view.target,view,900,600);
  close(before[0],after[0]);close(before[1],after[1]);
});
test('MMB modifier precedence distinguishes orbit, pan, zoom, and dolly', () => {
  assert.equal(dragMode({button:1}),'orbit');
  assert.equal(dragMode({button:1,shiftKey:true}),'pan');
  assert.equal(dragMode({button:1,ctrlKey:true}),'zoom');
  assert.equal(dragMode({button:1,ctrlKey:true,shiftKey:true}),'dolly');
  assert.equal(dragMode({button:0},'pan'),'pan');
});
test('camera basis stays orthonormal under orbit and roll', () => {
  const view=camera();view.roll=.7;const b=basis(view);
  for(const v of Object.values(b))close(dot(v,v),1);
  close(dot(b.right,b.up),0);close(dot(b.right,b.back),0);close(dot(b.up,b.back),0);
});
test('pan follows screen pixels in either projection and after roll', () => {
  for(const projection of ['orthographic','perspective']){
    const view=camera();view.projection=projection;view.roll=.3;
    const point=[...view.target],before=projectPoint(point,view,800,500);
    pan(view,60,-35,800,500);const after=projectPoint(point,view,800,500);
    close(after[0]-before[0],60);close(after[1]-before[1],-35);
    assert.notDeepEqual(view.target,point);
  }
});
test('six axis views preserve perspective and reset roll', () => {
  for(const [name,direction] of Object.entries({front:[0,-1,0],back:[0,1,0],right:[1,0,0],left:[-1,0,0],top:[0,0,1],bottom:[0,0,-1]})){
    const view=camera();view.roll=1;view.projection='perspective';alignView(view,name);
    basis(view).back.forEach((v,i)=>close(v,direction[i]));
    assert.equal(view.roll,0);assert.equal(viewLabel(view),`${name[0].toUpperCase()+name.slice(1)} Perspective`);
  }
});
test('opposite reverses the viewing direction; axis snapping selects the nearest axis', () => {
  const view=camera(),before=basis(view).back;opposite(view);
  basis(view).back.forEach((v,i)=>close(v,-before[i]));
  view.yaw=.05;view.pitch=.02;snapAxis(view);assert.equal(viewLabel(view),'Front Perspective');
});
test('dolly moves the pivot without changing orbit distance and enables perspective', () => {
  const view=camera(),before=structuredClone(view);dolly(view,-40,800,600);
  assert.equal(view.projection,'perspective');assert.equal(view.zoom,before.zoom);
  assert.ok(dot(view.target.map((v,i)=>v-before.target[i]),basis(view).back)<0);
});
test('frame bounds centers and fits geometry for narrow and wide editors', () => {
  for(const projection of ['perspective','orthographic'])for(const [width,height] of [[180,600],[1200,200],[800,600]]){
    const view=camera();Object.assign(view,{projection,roll:.4,target:[200,-4,80],zoom:.2,panX:40,panY:-50});
    assert.equal(frameBounds(view,REFERENCE_VERTICES,width,height),true);
    assert.deepEqual(view.target,[0,0,1]);
    for(const p of REFERENCE_VERTICES){const screen=projectPoint(p,view,width,height);assert.ok(screen&&screen[0]>=width*.13&&screen[0]<=width*.87&&screen[1]>=height*.13&&screen[1]<=height*.87);}
  }
});
test('empty framing and tiny region drags leave camera unchanged', () => {
  const view=camera(),before=structuredClone(view);
  assert.equal(frameBounds(view,[],800,600),false);
  assert.equal(zoomRegion(view,{x:10,y:10,width:2,height:4},800,600),false);
  assert.deepEqual(view,before);
});
test('region zoom centers its rectangle and has an inverse zoom-out factor', () => {
  const view=camera();alignView(view,'front');
  const point=[2,0,1],before=projectPoint(point,view,800,600);
  zoomRegion(view,{x:before[0]-100,y:before[1]-100,width:200,height:200},800,600);
  const after=projectPoint(point,view,800,600);close(after[0],400);close(after[1],300);close(view.zoom,3);
  zoomRegion(view,{x:300,y:200,width:200,height:200},800,600,true);close(view.zoom,1);
});
test('perspective shrinks distant geometry while orthographic preserves size', () => {
  const view=camera();alignView(view,'front');view.projection='perspective';
  const near=projectPoint([1,0,1],view,800,600),far=projectPoint([1,5,1],view,800,600);
  assert.ok(near[0]>far[0]);view.projection='orthographic';
  close(projectPoint([1,0,1],view,800,600)[0],projectPoint([1,5,1],view,800,600)[0]);
});
test('near-plane clipping handles lines, polygons, and fully hidden geometry', () => {
  assert.deepEqual(clipNear([[0,0,-2],[1,1,-1]],false),[]);
  for(const points of [clipNear([[0,0,-2],[1,1,2]],false),clipNear([[0,0,-2],[1,0,2],[0,1,2]])]){
    assert.ok(points.length>=2);assert.ok(points.every(p=>p.every(Number.isFinite)&&p[2]>=NEAR));
  }
});
test('numpad modifiers map before generic Ctrl filtering', () => {
  assert.deepEqual(navigationKey({code:'Numpad1',ctrlKey:true}),{action:'align',value:'back'});
  assert.deepEqual(navigationKey({code:'Numpad4',ctrlKey:true}),{action:'pan',x:40,y:0});
  assert.deepEqual(navigationKey({code:'Numpad6',shiftKey:true}),{action:'roll',value:STEP});
  assert.deepEqual(navigationKey({code:'Numpad5'}),{action:'projection'});
  assert.deepEqual(navigationKey({code:'NumpadDecimal'}),{action:'selected'});
  assert.deepEqual(navigationKey({code:'KeyB',shiftKey:true}),{action:'region'});
  assert.equal(navigationKey({code:'Numpad4',metaKey:true}),null);
  assert.equal(navigationKey({code:'Digit4'}),null);
});
test('zoom remains within persisted limits and legacy camera state upgrades in place', () => {
  const view=camera();zoom(view,1e10);assert.equal(view.zoom,5);zoom(view,1e-10);assert.equal(view.zoom,.000001);
  const state=defaults(),old=leaves(state.workspaces[0].root)[0].view;
  delete old.target;delete old.roll;delete old.projection;
  assert.equal(validateState(state),true);ensureCamera(old);assert.equal(validateState(state),true);
  assert.deepEqual(old.target,[0,0,1]);old.projection='invalid';assert.equal(validateState(state),false);
});



test('framing deep models fits each projection and keeps orthographic camera outside geometry',()=>{
  const points=[];for(const x of [-1,1])for(const y of [-100,100])for(const z of [-1,1])points.push([x,y,z]);
  const perspective=camera(),orthographic=camera();alignView(perspective,'front');alignView(orthographic,'front');orthographic.projection='orthographic';
  frameBounds(perspective,points,800,600);frameBounds(orthographic,points,800,600);
  assert.notEqual(perspective.zoom,orthographic.zoom);assert.deepEqual(perspective.target,orthographic.target);
  assert.ok(orthographic.orthographicDistance>100);
});

test('asymmetric depth framing centers projected bounds with consistent margins',()=>{
 const points=[[-30,-60,-5],[4,-60,9],[30,60,5],[-3,40,1]];
 for(const projection of ['perspective','orthographic'])for(const [width,height] of [[900,500],[300,800]]){
  const view=camera();Object.assign(view,{projection,roll:.3});frameBounds(view,points,width,height);
  const projected=points.map(p=>projectPoint(p,view,width,height)),xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
  close((Math.min(...xs)+Math.max(...xs))/2,width/2);close((Math.min(...ys)+Math.max(...ys))/2,height/2);
  const occupancy=Math.max((Math.max(...xs)-Math.min(...xs))/width,(Math.max(...ys)-Math.min(...ys))/height);assert.ok(Math.abs(occupancy-.72)<1e-6);
 }
});
