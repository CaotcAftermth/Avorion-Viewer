import {symmetryCenter} from './components/mounting.js';
import {symmetryAxesOrder} from './symmetry-controls.js';
import {paintOptions} from './paint-tools.js';
import {nativeToView,viewToNative} from './block-model.js';
import {modelExtents,dimensionRulers,exteriorRuler} from './model-overlays.js';
import {liveBlocks} from './ship-structure.js';
import {basis,cameraPoint,projectCamera,clipNear} from './navigation.js';
export function drawSymmetryPlanes(ctx,scene,view,width,height){
    if(view.display?.showOverlays===false||!scene.loaded||!scene.model?.bounds)return;
    const paint=view.interactionMode==='paint',bounds=scene.model.bounds,axes=symmetryAxesOrder;
    if(!paint&&!axes.some(axis=>scene.componentSymmetry?.[axis]))return;
    const o=paint?paintOptions(view):{
      symmetry:scene.componentSymmetry,planeVisible:scene.componentSymmetryPlaneVisible,
      origin:Object.fromEntries(symmetryCenter(scene).map((value,i)=>[axes[i],value]))
    };
    const extent=Math.max(1,...axes.map(a=>bounds.max[a]-bounds.min[a]))*.65;
    ctx.save();
    for(const [index,axis] of axes.entries()){
      if(!o.symmetry[axis]||o.planeVisible?.[axis]===false)continue;
      const others=axes.filter(a=>a!==axis),center=Object.fromEntries(axes.map(a=>[a,(bounds.min[a]+bounds.max[a])/2]));center[axis]=o.origin[axis];
      const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>{const point={...center};point[others[0]]+=u*extent;point[others[1]]+=v*extent;return nativeToView(axes.map(a=>point[a]));});
      let points=corners.map(point=>cameraPoint(point,view));if(view.projection==='perspective')points=clipNear(points,true);points=points.map(point=>projectCamera(point,view,width,height));if(points.length<3)continue;
      ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
      const color=['#e17b7b','#91bd7b','#7da9ed'][index];ctx.globalAlpha=.1;ctx.fillStyle=color;ctx.fill();ctx.globalAlpha=.8;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
      ctx.font='11px sans-serif';ctx.fillStyle=color;ctx.fillText(axis.toUpperCase()+' mirror · '+o.origin[axis],points[0][0]+4,points[0][1]-4);
    }ctx.restore();
  }
export function drawDimensions(ctx,scene,view,width,height,preferences,cache={}){
    let {dimensionBlocks,dimensionBounds,dimensionAnchors=[]}=cache;
    const getPreferences=()=>preferences;
    if(width<2||height<2||!view.display?.showOverlays||!view.display.showModelDimensions||!scene.loaded||!scene.visible)return;
    const blocks=liveBlocks(scene);if(blocks!==dimensionBlocks){dimensionBlocks=blocks;dimensionBounds=modelExtents(blocks);dimensionAnchors=[];}if(!dimensionBounds)return;
    const fontSize=preferences.imageExportDimensions?Math.max(6,Math.min(96,preferences.imageDimensionFontSize??12)):12;
    const labelHeight=fontSize+8;
    ctx.save();ctx.font=`${fontSize}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const screen=p=>projectCamera(cameraPoint(nativeToView(p),view),view,width,height),center=screen(dimensionBounds.min.map((v,i)=>(v+dimensionBounds.max[i])/2));
    const corners=[];
    for(const x of [dimensionBounds.min[0],dimensionBounds.max[0]])for(const y of [dimensionBounds.min[1],dimensionBounds.max[1]])for(const z of [dimensionBounds.min[2],dimensionBounds.max[2]])corners.push(screen([x,y,z]));
    if(corners.some(p=>!p||!p.every(Number.isFinite))){ctx.restore();return;}
    const segment=(a,b)=>{ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};
    const back=viewToNative(basis(view).back);
    for(let axis=0;axis<3;axis++){
      // Re-evaluate outer edges as the camera turns. A small hysteresis prevents
      // equal candidates flickering, without retaining a now-distant rear edge.
      let best,previous;
      for(const first of [-1,1])for(const second of [-1,1])for(const side of [-1,1]){
        const directions=[...back],others=[0,1,2].filter(i=>i!==axis);directions[others[0]]=first;directions[others[1]]=second;
        const ruler=dimensionRulers(dimensionBounds,directions)[axis],start=screen(ruler.start),end=screen(ruler.end);
        if(!start||!end)continue;
        const placement=exteriorRuler(start,end,corners,side);if(!placement)continue;
        const offscreen=[placement.a,placement.b].reduce((s,p)=>s+Math.max(0,50-p[0],p[0]-width+50)+Math.max(0,30-p[1],p[1]-height+30),0);
        const score=Math.hypot(placement.a[0]-start[0],placement.a[1]-start[1])+offscreen*4;
        const key=first+','+second+','+side,candidate={ruler,start,end,placement,score,key};
        if(key===dimensionAnchors[axis])previous=candidate;
        if(!best||score<best.score)best=candidate;
      }
      if(previous&&best&&previous.score<=best.score+12)best=previous;
      if(!best)continue;dimensionAnchors[axis]=best.key;
      Object.assign(cache,{dimensionBlocks,dimensionBounds,dimensionAnchors});
      const {ruler,start,end,placement}=best;
      const dimensionColor=getPreferences().dimensionAxisColors?['#a34f50','#527ac6','#65a34f'][axis]:'#91cde5';
      const {a,b,normal:[nx,ny]}=placement;
      ctx.strokeStyle=dimensionColor;ctx.lineWidth=1;segment(a,b);
      ctx.globalAlpha=.5;segment(start,a);segment(end,b);ctx.globalAlpha=1;
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uy=(b[1]-a[1])/length;
      const arrowSize=Math.min(7,length/4);ctx.fillStyle=dimensionColor;
      for(const [tip,direction] of [[a,1],[b,-1]]){
        const x=tip[0]+ux*arrowSize*direction,y=tip[1]+uy*arrowSize*direction;
        ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(x-uy*3,y+ux*3);ctx.lineTo(x+uy*3,y-ux*3);ctx.closePath();ctx.fill();
      }
      const blocks=preferences.dimensionUnits==='blocks';
      const label=ruler.label.split(':')[0]+': '+Number((ruler.size*(blocks?1:10)).toPrecision(6))+(blocks?' blocks':' m');
      const w=ctx.measureText(label).width+12;
      const labelGap=labelHeight/2+4+Math.abs(nx)*w/2;
      let x=(a[0]+b[0])/2+nx*labelGap,y=(a[1]+b[1])/2+ny*labelGap;
      if(preferences.imageExportDimensions){
        x=Math.max(w/2+6,Math.min(width-w/2-6,x));
        y=Math.max(labelHeight/2+4,Math.min(height-(preferences.imageExportTitle?Math.max(100,labelHeight/2+4):labelHeight/2+4),y));
      }
      ctx.fillStyle='#202020e8';ctx.fillRect(x-w/2,y-labelHeight/2,w,labelHeight);ctx.fillStyle=dimensionColor;ctx.fillText(label,x,y);
    }ctx.restore();
  }
