import {drawSocketMarker,socketOnScreen} from '../socket-markers.js';
import {componentSockets,componentSetup} from './core.js';
import {componentClashes} from './clearance.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';
export function drawComponentSockets(ctx,scene,view,width,height,visible){
 if(!(scene.showComponentSockets||scene.componentDragging||view.interactionMode==='socket')||!scene.visible||view.display?.showOverlays===false||view.interactionMode==='paint')return [];
 const hits=[];ctx.save();ctx.strokeStyle='#ffbe68';ctx.lineWidth=2;
 // Sockets whose component may overlap something are drawn red.
 const clashes=componentClashes(scene),clashing=new Set(componentSetup(scene.model||{}).mounts.filter(m=>clashes.has(m.id)).map(m=>m.socketId));
 for(const socket of componentSockets(scene)){
  if(view.socketFilter==='turrets'||scene.hiddenIds?.has(socket.blockId))continue;
  const screen=projectPoint(nativeToView(socket.position),view,width,height);if(!socketOnScreen(screen,width,height)||!visible(socket))continue;
  const occupied=componentSetup(scene.model||{}).mounts.some(m=>m.socketId===socket.id);
  const tip=projectPoint(nativeToView(socket.position.map((v,i)=>v+socket.normal[i]*.5)),view,width,height);
  drawSocketMarker(ctx,screen,tip,{selected:socket.id===scene.selectedComponentSocketId,target:socket.id===scene.componentDropTarget,occupied,warning:clashing.has(socket.id)});
  hits.push({...socket,screen,occupied,exposed:true});
 }ctx.restore();return hits.sort((a,b)=>a.screen[2]-b.screen[2]);
}
