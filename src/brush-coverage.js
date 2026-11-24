import {blockSurfaceGeometry} from './avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from './avorion/lib/avorion/orientationProfile.js';
import {nativeToView} from './block-model.js';
import {basis,cameraPoint,projectCamera,clipNear} from './navigation.js';
import {liveBlocks,viewportHiddenIds} from './ship-structure.js';

export function closestTrianglePoint(p,triangle){
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const signs=triangle.map((a,i)=>cross(a,triangle[(i+1)%3],p));
 if(Math.abs(cross(...triangle))>1e-10&&(signs.every(s=>s>=0)||signs.every(s=>s<=0)))return p;
 let best=null,distance=Infinity;
 for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),q=[a[0]+t*dx,a[1]+t*dy],d=(q[0]-p[0])**2+(q[1]-p[1])**2;if(d<distance){best=q;distance=d;}}
 return best;
}
export function visibleBrushFace(id,triangles,x,y,radius,pick){
 const inside=p=>(p[0]-x)**2+(p[1]-y)**2<=radius*radius+1e-8;
 for(const triangle of triangles){const closest=closestTrianglePoint([x,y],triangle);if(!inside(closest))continue;
  const center=[0,1].map(k=>triangle.reduce((sum,p)=>sum+p[k],0)/3),inset=closest.map((v,k)=>v+(center[k]-v)*.001);
  for(const point of [inset,closest,center,...triangle])if(inside(point)&&pick(...point)===id)return true;
 }
 return false;
}
// Keep projected bounds across brush stamps; build detailed faces only for nearby blocks.
export function createBrushCoverage(){
 let cachedKey=[],entries=[],project,hidden;
 return (scene,view,width,height,x,y,radius,known,pick)=>{
  const blocks=liveBlocks(scene),d=view.display,key=[blocks,scene.revision,scene.blockTransforms,width,height,view.yaw,view.pitch,view.roll,view.zoom,view.panX,view.panY,view.projection,...view.target,d?.focalLength,d?.clipStart,d?.clipEnd];
  if(key.some((v,i)=>v!==cachedKey[i])||key.length!==cachedKey.length){
   cachedKey=key;const axes=basis(view);project=p=>cameraPoint(nativeToView(p),view,axes);
   entries=blocks.map(block=>{const points=[];for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])points.push(project([block.position.x+sx*block.size.x/2,block.position.y+sy*block.size.y/2,block.position.z+sz*block.size.z/2]));const screen=points.map(p=>projectCamera(p,view,width,height)).filter(Boolean),near=points.some(p=>p[2]<=0);return {block,minX:near?-Infinity:Math.min(...screen.map(p=>p[0])),maxX:near?Infinity:Math.max(...screen.map(p=>p[0])),minY:near?-Infinity:Math.min(...screen.map(p=>p[1])),maxY:near?Infinity:Math.max(...screen.map(p=>p[1]))};});
  }
  hidden=viewportHiddenIds(scene,view);
  for(const entry of entries){const {block}=entry;if(known.has(block.id)||hidden.has(block.id)||x+radius<entry.minX||x-radius>entry.maxX||y+radius<entry.minY||y-radius>entry.maxY)continue;
   if(!entry.triangles){entry.triangles=[];const positions=blockSurfaceGeometry(block,defaultOrientationProfile()).positions;
    for(let i=0;i<positions.length;i+=9){const points=[];for(let j=0;j<9;j+=3)points.push(project([positions[i+j]+block.position.x,positions[i+j+1]+block.position.y,positions[i+j+2]+block.position.z]));const polygon=(view.projection==='perspective'?clipNear(points):points).map(p=>projectCamera(p,view,width,height)).filter(Boolean);for(let k=1;k<polygon.length-1;k++)entry.triangles.push([polygon[0],polygon[k],polygon[k+1]]);}
   }
   if(visibleBrushFace(block.id,entry.triangles,x,y,radius,pick))known.add(block.id);
  }
 };
}
