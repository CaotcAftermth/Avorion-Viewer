// Shared screen-space socket glyph: the original cyan ring and outward normal.
export function drawSocketMarker(ctx,point,tip,{selected=false,target=false,occupied=false,warning=false,color='#75ddff',shape='circle'}={}){
 ctx.save();ctx.strokeStyle=warning?'#f19a8d':color;ctx.lineWidth=2;
 ctx.setLineDash(occupied?[3,3]:[]);
 const radius=target?11:selected?10:8;ctx.beginPath();if(shape==='square')ctx.rect(point[0]-radius,point[1]-radius,radius*2,radius*2);else ctx.arc(point[0],point[1],radius,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([]);
 if(tip){ctx.beginPath();ctx.moveTo(point[0],point[1]);ctx.lineTo(tip[0],tip[1]);ctx.stroke();}
 ctx.restore();
}
export function socketOnScreen(point,width,height){return !!point&&point[0]>=0&&point[1]>=0&&point[0]<=width&&point[1]<=height;}
// Distance wins first; coincident glyphs select the nearer visible surface.
export function pickSocketMarker(hits,x,y,radius=12){
 return hits.filter(s=>Math.hypot(s.screen[0]-x,s.screen[1]-y)<=radius)
  .sort((a,b)=>Math.hypot(a.screen[0]-x,a.screen[1]-y)-Math.hypot(b.screen[0]-x,b.screen[1]-y)||a.screen[2]-b.screen[2])[0]||null;
}
export function selectSocketMarker(scene,socket){
 const component=socket.type==='component';
 const mount=(component?scene.model?.componentSetup?.mounts:scene.model?.turretMounts)?.find(m=>m.socketId===socket.id);
 scene.selectedComponentMountId=component?mount?.id||null:null;
 scene.selectedComponentMountIds=new Set(scene.selectedComponentMountId?[scene.selectedComponentMountId]:[]);
 scene.selectedComponentSocketId=component?socket.id:null;
 scene.selectedTurretId=!component?mount?.id||null:null;
 scene.selectedTurretIds=new Set(scene.selectedTurretId?[scene.selectedTurretId]:[]);
 scene.turretSockets??={};scene.turretSockets.selectedId=component?null:socket.id;
 return component?{componentSocketId:socket.id}:{socketId:socket.id};
}
