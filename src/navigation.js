import { matchesBinding, mappedNavigation } from './keymaps.js';
// Shared camera math for mouse gestures, keyboard shortcuts, and navigation UI.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const STEP = Math.PI / 12;
export const NEAR = 0.05;
export const BASE_DISTANCE = 10;
export const REFERENCE_VERTICES = [[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,2],[1,-1,2],[1,1,2],[-1,1,2]];
export const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const AXIS_VIEWS = {
  front: [0, 0], back: [Math.PI, 0],
  right: [Math.PI / 2, 0], left: [-Math.PI / 2, 0],
  top: [0, Math.PI / 2], bottom: [0, -Math.PI / 2]
};
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export function ensureCamera(view) {
  view.target ??= [0, 0, 1];
  view.roll ??= 0;
  view.projection ??= 'perspective';
  return view;
}

export function basis(view) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const cr = Math.cos(view.roll || 0), sr = Math.sin(view.roll || 0);
  const right = [cy, sy, 0], up = [-sy * sp, cy * sp, cp];
  return {
    right: right.map((v, i) => cr * v + sr * up[i]),
    up: up.map((v, i) => cr * v - sr * right[i]),
    back: [sy * cp, -cy * cp, sp]
  };
}

function cameraDistance(view){return view.projection==='orthographic'?Math.max(BASE_DISTANCE/view.zoom,Number(view.orthographicDistance)||0):BASE_DISTANCE/view.zoom;}

export function metrics(view, width, height) {
  // A 36 mm sensor fitted to the shorter viewport dimension; legacy cameras
  // retain their previous field of view until display settings are migrated.
  const focal = Math.max(1, Math.min(width, height)) * (view.display?view.display.focalLength/36:0.9);
  return { focal, distance: cameraDistance(view), scale: focal / BASE_DISTANCE * view.zoom };
}

export function cameraPoint(point, view, cameraBasis = basis(view)) {
  const relative = point.map((v, i) => v - (view.target || [0, 0, 1])[i]);
  return [dot(relative, cameraBasis.right), dot(relative, cameraBasis.up), cameraDistance(view) - dot(relative, cameraBasis.back)];
}

export function projectCamera(point, view, width, height) {
  if (view.projection === 'perspective' && point[2] < NEAR) return null;
  const m = metrics(view, width, height);
  const scale = view.projection === 'perspective' ? m.focal / point[2] : m.scale;
  return [width / 2 + view.panX + point[0] * scale, height / 2 + view.panY - point[1] * scale, point[2]];
}

export function projectPoint(point, view, width, height) {
  return projectCamera(cameraPoint(point, view), view, width, height);
}

// Clip before perspective division, including when dollying through geometry.
export function clipNear(points, closed = true) {
  const result = [];
  const intersect = (a, b) => {
    const t = (NEAR - a[2]) / (b[2] - a[2]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
  };
  if (!closed) {
    const [a, b] = points;
    if (a[2] < NEAR && b[2] < NEAR) return [];
    return [a[2] < NEAR ? intersect(a, b) : a, b[2] < NEAR ? intersect(a, b) : b];
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (a[2] >= NEAR) result.push(a);
    if ((a[2] >= NEAR) !== (b[2] >= NEAR)) result.push(intersect(a, b));
  }
  return result;
}

export function orbit(view, dx, dy, preferences = {}) {
  ensureCamera(view);
  if(preferences.autoPerspective && (dx||dy) && view.projection==='orthographic' && !viewLabel(view).startsWith('User'))view.projection='perspective';
  if(dx||dy)view.roll=0;
  const sensitivity=preferences.orbitSensitivity ?? 1;
  view.yaw = wrap(view.yaw - dx * 0.008 * sensitivity);
  view.pitch = clamp(view.pitch + dy * 0.008 * sensitivity, -Math.PI / 2, Math.PI / 2);
}

export function pan(view, dx, dy, width, height) {
  ensureCamera(view);
  const b = basis(view), scale = metrics(view, width, height).scale;
  // Absorb legacy pixel offsets so orbiting uses the panned pivot.
  dx += view.panX; dy += view.panY; view.panX = view.panY = 0;
  view.target = view.target.map((v, i) => v - (b.right[i] * dx - b.up[i] * dy) / scale);
}

export function zoom(view, factor) { view.zoom = clamp(view.zoom * factor, 0.000001, 5); }

export function dolly(view, dy, width, height) {
  ensureCamera(view);
  view.projection = 'perspective';
  const back = basis(view).back, distance = dy / metrics(view, width, height).scale;
  view.target = view.target.map((v, i) => clamp(v + back[i] * distance, -1e6, 1e6));
}

export function alignView(view, name) {
  ensureCamera(view);
  [view.yaw, view.pitch] = AXIS_VIEWS[name];
  view.roll = 0;
}

export function opposite(view) { view.yaw = wrap(view.yaw + Math.PI);view.pitch = -view.pitch; }

export function snapAxis(view) {
  const direction = basis(view).back;
  const axis = direction.reduce((best, value, i) => Math.abs(value) > Math.abs(direction[best]) ? i : best, 0);
  alignView(view, axis === 0 ? (direction[0] > 0 ? 'right' : 'left') : axis === 1 ? (direction[1] > 0 ? 'back' : 'front') : (direction[2] > 0 ? 'top' : 'bottom'));
}

export function viewLabel(view) {
  if(Math.abs(Math.abs(view.pitch)-Math.PI/2)<1e-5)return `${view.pitch>0?'Top':'Bottom'} ${view.projection==='perspective'?'Perspective':'Orthographic'}`;
  const axis = Math.abs(view.roll || 0) < 1e-5 && Object.entries(AXIS_VIEWS).find(([, [yaw, pitch]]) => Math.abs(wrap(view.yaw - yaw)) < 1e-5 && Math.abs(view.pitch - pitch) < 1e-5);
  const name = axis ? axis[0][0].toUpperCase() + axis[0].slice(1) : 'User';
  return `${name} ${view.projection === 'perspective' ? 'Perspective' : 'Orthographic'}`;
}

export function frameBounds(view, points, width, height, fill=.72) {
  if (!points.length || width <= 0 || height <= 0) return false;
  ensureCamera(view);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
  view.target=min.map((v,i)=>(v+max[i])/2);view.panX=view.panY=0;
  const b=basis(view),focal=metrics(view,width,height).focal,coords=new Float64Array(points.length*3);let maxDepth=-Infinity;
  points.forEach((p,i)=>{const r=p.map((v,j)=>v-view.target[j]);coords[i*3]=dot(r,b.right);coords[i*3+1]=dot(r,b.up);coords[i*3+2]=dot(r,b.back);maxDepth=Math.max(maxDepth,coords[i*3+2]);});
  const bounds=distance=>{let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
    for(let i=0;i<coords.length;i+=3){const scale=view.projection==='perspective'?focal/(distance-coords[i+2]):focal/distance,x=coords[i]*scale,y=coords[i+1]*scale;left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);}
    return {left,right,bottom,top};};
  const fits=d=>{const r=bounds(d);return r.right-r.left<=width*fill&&r.top-r.bottom<=height*fill;};
  let low=view.projection==='perspective'?Math.max(.0001,maxDepth+NEAR):.0001,high=Math.max(1,low*2);
  while(!fits(high)&&high<1e12)high*=2;
  for(let i=0;i<36;i++){const mid=(low+high)/2;if(fits(mid))high=mid;else low=mid;}
  view.zoom=clamp(BASE_DISTANCE/high,.000001,5);
  // Orthographic scale and camera depth are independent: deep ships must not
  // force a tiny screen footprint just to keep the camera outside the model.
  view.orthographicDistance=Math.max(BASE_DISTANCE/view.zoom,maxDepth+Math.max(1,NEAR));
  const projected=bounds(BASE_DISTANCE/view.zoom);
  view.panX=-(projected.left+projected.right)/2||0;view.panY=(projected.bottom+projected.top)/2||0;
  return true;
}

export function zoomRegion(view, rect, width, height, zoomOut = false) {
  if (rect.width < 8 || rect.height < 8) return false;
  const factor = Math.min(width / rect.width, height / rect.height);
  pan(view, width / 2 - rect.x - rect.width / 2, height / 2 - rect.y - rect.height / 2, width, height);
  zoom(view, zoomOut ? 1 / factor : factor);
  return true;
}

export function dragMode(event, tool = 'select', preferences = {}) {
  if(preferences.emulate3Button&&event.altKey&&event.button===0){
    if(event.ctrlKey&&event.shiftKey)return 'dolly';
    return event.ctrlKey?'zoom':event.shiftKey?'pan':'orbit';
  }
  for(const mode of ['dolly','zoom','pan','orbit'])if(matchesBinding(mode+'Drag',event,preferences,'Mouse'+event.button))return mode;
  return matchesBinding('selectClick',event,preferences,'Mouse'+event.button)?tool:null;
}

export function navigationKey(event, preferences = {}) { return mappedNavigation(event,preferences); }
