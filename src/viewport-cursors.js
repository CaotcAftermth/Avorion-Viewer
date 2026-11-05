import {cursorSVGs,brushRingPaths} from './assets/cursors/traced-cursors.js';

export const CURSOR_NAMES=[['select','Select'],['orbit','Orbit'],['pan-open','Pan'],['frame','Frame All'],['brush','Brush'],['eyedropper','Eyedropper'],['replace','Replace Color with Selected'],['fill','Connected Fill'],['restore','Restore']];
let activePreferences={};
const cache=new Map();
export function setCursorPreferences(value){
  activePreferences=value;
  globalThis.document?.querySelectorAll('[data-cursor-icon]').forEach(el=>{el.outerHTML=cursorIcon(el.dataset.cursorIcon);});
}
const number=(p,key,fallback)=>Number.isFinite(p[key])?p[key]:fallback;
export function cursorArtwork(name,p=activePreferences){
  let svg=cursorSVGs[name];if(!svg)return null;
  const primary=p.cursorPrimaryColor||'#f9f9fb',secondary=p.cursorSecondaryColor||'#dea466',weight=number(p,'cursorLineWeight',1);
  svg=svg.replace(/#F9F9FB/gi,primary).replace(/#DEA466/gi,secondary);
  if(weight!==1){
    const operation=weight<1?'erode':'dilate',amount=Math.abs(weight-1)*4;
    svg=svg.replace(/(<path\b[^>]*fill=")([^" ]+)("[^>]*)(\/?>)/g,(all,a,color,b,end)=>color.toLowerCase()==='#080a0d'?all:all.replace(/\s*\/?>$/,' filter="url(#cursor-weight)"/>'));
    svg=svg.replace(/(<svg\b[^>]*>)/,'$1'+`<defs><filter id="cursor-weight" x="-20%" y="-20%" width="140%" height="140%"><feMorphology operator="${operation}" radius="${amount}"/></filter></defs>`);
  }
  return svg;
}
export function cursorIcon(name,p=activePreferences){
  // Full Brush artwork belongs on tool buttons; center-only belongs at pointer.
  const svg=name==='brush'?cursorArtwork('brush-icon',p):cursorArtwork(name,p);
  const artwork=svg||cursorArtwork('select',p);
  const points=[...artwork.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].flatMap(m=>[...m[1].matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map(([,x,y])=>[+x,+y]));
  const bounds=name==='select'?[101,66,183,187]:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
  const side=Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])*1.06,cx=(bounds[0]+bounds[2])/2,cy=(bounds[1]+bounds[3])/2;
  return artwork.replace(/viewBox="[^"]+"/,'viewBox="'+[cx-side/2,cy-side/2,side,side].join(' ')+'"').replace('<svg ',`<svg data-cursor-icon="${name}" aria-hidden="true" `);
}
export function cursorVisual(name,radius=0,p=activePreferences){
  const artwork=cursorArtwork(name,p);if(!artwork)return null;
  const size=40*Math.max(.5,Math.min(2,number(p,'cursorScale',1)));
  const id=name==='pan-closed'?'pan-open':name;
  const angle=number(p,'cursorAngle_'+id,0)*Math.PI/180,distance=number(p,'cursorDistance_'+id,0);
  // Hotspot moves relative to artwork. Defaults put arrow tips at click point.
  let dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance;
  const pad=8,cx=pad+size/2+Math.max(0,-dx-size/2),cy=pad+size/2+Math.max(0,-dy-size/2);
  const x=cx+dx,y=cy+dy;
  const width=Math.ceil(Math.max(cx+size/2,x+6)+pad),height=Math.ceil(Math.max(cy+size/2,y+6)+pad);
  const target=distance>0&&['replace','restore'].includes(name)?`<path d="M${x-5} ${y}h10M${x} ${y-5}v10" fill="none" stroke="#080a0d" stroke-width="3"/><path d="M${x-5} ${y}h10M${x} ${y-5}v10" fill="none" stroke="${p.cursorPrimaryColor||'#f9f9fb'}" stroke-width="1"/>`:'';
  const icon=artwork.replace(/width="40" height="40"/,`x="${cx-size/2}" y="${cy-size/2}" width="${size}" height="${size}"`);
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${icon}${target}</svg>`,x:Math.round(x),y:Math.round(y),width,height,artworkCenter:[cx,cy]};
}
export function cursorCSS(name,radius=0,p=activePreferences){
  if(!cursorSVGs[name])return name==='region'?'crosshair':'default';
  const key=JSON.stringify([name,name==='restore'?radius:0,...Object.keys(p).filter(k=>k.startsWith('cursor')).sort().map(k=>[k,p[k]])]);
  if(!cache.has(key)){
    const v=cursorVisual(name,radius,p);
    // Browser native cursors must fit within 128px. Large Restore badges get
    // compacted with a matching hotspot, while the paint area remains exact.
    if(v.width>128||v.height>128){const ratio=128/Math.max(v.width,v.height);v.svg=v.svg.replace(/width="\d+" height="\d+"/,`width="${Math.round(v.width*ratio)}" height="${Math.round(v.height*ratio)}" viewBox="0 0 ${v.width} ${v.height}"`);v.x=Math.round(v.x*ratio);v.y=Math.round(v.y*ratio);}
    cache.set(key,`url("data:image/svg+xml,${encodeURIComponent(v.svg)}") ${v.x} ${v.y}, ${name.startsWith('pan-')?'move':'crosshair'}`);
    if(cache.size>256)cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}
export function viewportCursor(view,dragMode,rightHeld=false,region=false){
  if(region)return 'region';
  const tool=dragMode&&dragMode!=='paint'?dragMode:view.interactionMode==='paint'?view.paint?.tool||'brush':view.tool||'select';
  return tool==='pan'?(rightHeld?'pan-closed':'pan-open'):tool;
}
export function brushRingGeometry(radius,p=activePreferences){
  const thickness=24/99*number(p,'cursorLineWeight',1);
  return brushRingPaths.map(({d,fill})=>({fill:fill.toLowerCase()==='#dea466'?(p.cursorSecondaryColor||fill):fill,d:d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,(_,x,y)=>{
    const dx=Number(x)-128,dy=Number(y)-128,r=Math.hypot(dx,dy),distance=Math.max(0,radius+(r-99)*thickness);
    return `${(dx/r*distance).toFixed(4)},${(dy/r*distance).toFixed(4)}`;
  })}));
}
let ringKey,ringPaths;
export function drawBrushRing(ctx,point,radius,p=activePreferences){
  if(!(radius>0))return;
  const key=JSON.stringify([radius,p.cursorLineWeight,p.cursorSecondaryColor]);
  if(key!==ringKey){ringKey=key;ringPaths=brushRingGeometry(radius,p).map(({d,fill})=>({path:new Path2D(d),fill}));}
  ctx.save();ctx.translate(point[0],point[1]);
  for(const {path,fill} of ringPaths){ctx.fillStyle=fill;ctx.fill(path,'evenodd');}
  ctx.restore();
}
