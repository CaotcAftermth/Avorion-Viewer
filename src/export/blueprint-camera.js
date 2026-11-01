import {alignView,orbit} from '../navigation.js';

// Store angles and panel-relative offsets, so preview gestures survive resolution changes.
export function blueprintCamera(camera,settings,source={yaw:0,pitch:0,roll:0}){
  const view={yaw:source.yaw,pitch:source.pitch,roll:source.roll||0,projection:'orthographic'};
  if(camera==='isometric'){view.yaw=Math.PI/4;view.pitch=Math.atan(1/Math.sqrt(2));view.roll=0;}
  else if(camera!=='current')alignView(view,camera);
  if(settings.orientation){Object.assign(view,settings.orientation);view.roll=0;}
  view.roll+=settings.rotation*Math.PI/180;
  return view;
}
export function orbitBlueprint(settings,camera,source,dx,dy,preferences){
  const view=blueprintCamera(camera,settings,source);orbit(view,dx,dy,{...preferences,autoPerspective:false});
  settings.orientation={yaw:view.yaw,pitch:view.pitch};settings.rotation=0;
}
export function panBlueprint(settings,dx,dy,width,height){
  settings.pan={x:Math.max(-2,Math.min(2,(settings.pan?.x||0)+dx/width)),y:Math.max(-2,Math.min(2,(settings.pan?.y||0)+dy/height))};
}
export function frameBlueprint(settings){settings.scale=1;settings.pan={x:0,y:0};}
