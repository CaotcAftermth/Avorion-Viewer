import {componentSockets} from './core.js';
import {nativeToView} from '../block-model.js';
import {projectPoint} from '../navigation.js';
export function drawComponentSockets(ctx,scene,view,width,height,visible){
 if(!scene.showComponentSockets||!scene.visible||view.display?.showOverlays===false||view.interactionMode==='paint')return [];
 const hits=[];ctx.save();ctx.strokeStyle='#ffbe68';ctx.lineWidth=2;
 for(const socket of componentSockets(scene)){
  if(scene.hiddenIds?.has(socket.blockId))continue;
  const screen=projectPoint(nativeToView(socket.position),view,width,height);if(!screen||!visible(socket))continue;
  const size=socket.id===scene.selectedComponentSocketId?9:5;
  ctx.strokeRect(screen[0]-size,screen[1]-size,size*2,size*2);
  const tip=projectPoint(nativeToView(socket.position.map((v,i)=>v+socket.normal[i]*.5)),view,width,height);
  if(tip){ctx.beginPath();ctx.moveTo(screen[0],screen[1]);ctx.lineTo(tip[0],tip[1]);ctx.stroke();}
  hits.push({...socket,screen});
 }ctx.restore();return hits.sort((a,b)=>a.screen[2]-b.screen[2]);
}
