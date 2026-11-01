import * as THREE from '../vendor/three.module.js';
import {ensureCoverage,currentCoverage} from './coverage-state.js';
import {coverageOptions,sampleColor,heatColor,differenceColor,TURRET_COLORS} from './coverage-sampling.js';
import {differences,baselineCompatible} from './coverage-stats.js';
import {globeSurface,fanSurface,polarSurface} from './coverage-surface.js';
import {nativeToView} from '../block-model.js';
import {polarPoint} from './coverage-polar.js';
import {projectPoint} from '../navigation.js';
let group,mesh,pickMesh,outline,outlineKey,resultRef,paintKey;
function dispose(){if(!group)return;group.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});group.clear();pickMesh?.geometry.dispose();pickMesh?.material.dispose();pickMesh=null;mesh=null;outline=null;outlineKey=null;}
export function releaseCoverage(){dispose();group?.removeFromParent();group=null;resultRef=null;paintKey=null;}
// Colors follow each turret's position in the full mount list, so filtering the
// display to a selection or group never repaints the remaining turrets.
const turretColor=(result,options,index)=>{const t=result.turrets[index],slot=t?.colorIndex??index;return options.colors?.[t?.id]||TURRET_COLORS[slot%TURRET_COLORS.length];};
export function displayMetric(scene,result,options=coverageOptions(scene)){return options.metric==='difference'&&!baselineCompatible(scene.coverageBaseline,result)?'clear':options.metric;}
function configureCoverageMaterial(material,configureDepth){
 // The viewer's ship shader outputs display colors into a linear framebuffer.
 // Encode these standard Three.js materials too, so colors match the legend.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','gl_FragColor = sRGBTransferOETF(gl_FragColor);');};
 material.customProgramCacheKey=()=>'weapon-coverage-display-colors-v1';configureDepth(material);
}
function gradientTexture(options){
 const bytes=new Uint8Array(256*3*4);
 for(let i=0;i<256;i++){const c=heatColor(i/255,1,options.palette).convertLinearToSRGB();bytes.set([c.r*255,c.g*255,c.b*255,255],i*4);bytes.set([164,123,209,255],(256+i)*4);bytes.set([105,114,124,255],(512+i)*4);}
 const texture=new THREE.DataTexture(bytes,256,3);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
export function syncCoverage(world,scene,view,configureDepth,disabled=false){
 if(!group){group=new THREE.Group();group.name='Weapon coverage';world.add(group);}
 const options=coverageOptions(scene),state=disabled?null:ensureCoverage(scene),result=state?.result;
 group.visible=!!result&&!disabled&&view.display?.showOverlays!==false;
 if(!group.visible){if(!scene.showFireCoverage)dispose();return group;}
 const metric=displayMetric(scene,result,options),key=JSON.stringify([metric,options.showObstructions,options.overlapOnly,options.individual,options.showGrid,options.scaleMax,options.autoScale,options.palette,options.colors,metric==='difference'?scene.coverageBaseline?.key+scene.coverageBaseline?.label:null]);
 if(resultRef!==result||paintKey!==key){
  dispose();resultRef=result;paintKey=key;
  const max=Math.max(1,...result.samples.map(s=>s[metric]||0)),limit=options.autoScale?max:Math.max(1,options.scaleMax),color=new THREE.Color();
  const deltas=metric==='difference'?differences(scene.coverageBaseline,result):null;
  const polar=result.mode==='slice'&&!!result.polar;
  const fans=!polar&&result.mode==='slice'&&options.individual&&!['blind','difference'].includes(metric);
  const smooth=result.mode==='sphere'&&!['blind','difference'].includes(metric);
  const data=polar?polarSurface(result,{...options,metric},limit,i=>turretColor(result,options,i)):smooth?globeSurface(result,metric,limit,options):fans?fanSurface(result,{...options,metric}):{positions:[],colors:[],sampleMap:[]};
  if(fans){data.colors=[];for(const index of data.turretIndices){color.set(turretColor(result,options,index));data.colors.push(color.r,color.g,color.b);}
   for(let i=0;i<result.samples.length;i++)if(result.samples[i].classification==='unresolved'){const cell=result.cells[i];color.set('#a47bd1');for(const tri of cell.vertices.length===3?[[0,1,2]]:[[0,1,2],[0,2,3]]){for(const v of tri){data.positions.push(...cell.vertices[v]);data.colors.push(color.r,color.g,color.b);}data.sampleMap.push(i);}}
  }
  if(!fans&&!smooth&&!polar)for(const [i,cell] of result.cells.entries()){
   const s=result.samples[i];if(!s.valid||options.overlapOnly&&s.clear<2||!options.showObstructions&&s.classification==='structurally-obstructed')continue;
   if(deltas){if(deltas[i]===null)continue;color.copy(differenceColor(deltas[i],options.autoScale?Math.max(1,...deltas.map(Math.abs)):3));}else color.set(sampleColor(s,{...options,metric},max));
   for(let j=1;j<cell.vertices.length-1;j++){for(const p of [cell.vertices[0],cell.vertices[j],cell.vertices[j+1]]){data.positions.push(...p);data.colors.push(color.r,color.g,color.b);}data.sampleMap.push(i);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  if(data.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
  if(data.colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({map:smooth?gradientTexture(options):null,vertexColors:!!data.colors,side:result.mode==='sphere'?THREE.FrontSide:THREE.DoubleSide,transparent:true,opacity:options.opacity,depthWrite:result.mode==='sphere',toneMapped:false});configureCoverageMaterial(material,configureDepth);
  mesh=new THREE.Mesh(geometry,material);mesh.userData.sampleMap=data.sampleMap;mesh.userData.fans=fans;mesh.renderOrder=10;group.add(mesh);
  if(fans){
   // Keep blind gaps inspectable even though they have no colored surface.
   const positions=[],sampleMap=[];for(const [i,cell] of result.cells.entries())for(const tri of cell.vertices.length===3?[[0,1,2]]:[[0,1,2],[0,2,3]]){for(const v of tri)positions.push(...cell.vertices[v]);sampleMap.push(i);}
   pickMesh=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));pickMesh.userData.sampleMap=sampleMap;
  }
  function lines(points,hex,opacity,colors=null){if(!points.length)return;const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3));if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const m=new THREE.LineBasicMaterial({color:hex,vertexColors:!!colors,transparent:true,opacity,depthWrite:false,toneMapped:false});configureCoverageMaterial(m,configureDepth);const o=new THREE.LineSegments(g,m);o.renderOrder=11;group.add(o);}
  if(fans){const colors=[];for(const index of data.edgeTurrets){color.set(turretColor(result,options,index));colors.push(color.r,color.g,color.b);}lines(data.edges,'#ffffff',.65,colors);}
  if(polar)lines(data.edges,'#ffffff',.85,data.edgeColors);
  if(options.showGrid||result.mode==='sphere'){
   const points=[],c=result.center,r=result.radius||result.extent;
   if(result.mode==='sphere'){
    const p=(lat,lon)=>[c[0]+r*1.001*Math.cos(lat)*Math.sin(lon),c[1]+r*1.001*Math.sin(lat),c[2]+r*1.001*Math.cos(lat)*Math.cos(lon)];
    for(let lat=-60;lat<=60;lat+=30)for(let i=0;i<144;i++)points.push(...p(lat*Math.PI/180,i*Math.PI/72),...p(lat*Math.PI/180,(i+1)*Math.PI/72));
    for(let lon=0;lon<360;lon+=30)for(let i=0;i<72;i++)points.push(...p(-Math.PI/2+i*Math.PI/72,lon*Math.PI/180),...p(-Math.PI/2+(i+1)*Math.PI/72,lon*Math.PI/180));
   }else{
    const axes=result.plane==='front'?[0,1,2]:result.plane==='side'?[2,1,0]:[0,2,1];
    const p=(radius,a)=>{const v=[...c];v[axes[0]]+=radius*Math.cos(a);v[axes[1]]+=radius*Math.sin(a);v[axes[2]]+=result.offset||0;return v;};
    for(const radius of [r/2,r])for(let i=0;i<144;i++)points.push(...p(radius,i*Math.PI/72),...p(radius,(i+1)*Math.PI/72));
    for(let i=0;i<4;i++)points.push(...p(0,0),...p(r,i*Math.PI/2));
   }
   lines(points,result.mode==='sphere'?'#081326':'#90abc3',options.showGrid ? .35 : .16);
  }
  // Polar rings extend past the slice extent; frame them too.
  const center=new THREE.Vector3(...result.center),radius=(result.radius||result.extent)*(polar?1.75:1);
  group.userData.bounds=new THREE.Box3(center.clone().addScalar(-radius),center.clone().addScalar(radius));
 }
 // The pinned-cell outline is its own object: pinning never re-tessellates the field.
 const index=scene.coverageInspection?.index,nextOutline=JSON.stringify([index,result.cells.length]);
 if(outlineKey!==nextOutline){
  if(outline){outline.geometry.dispose();outline.material.dispose();outline.removeFromParent();outline=null;}
  outlineKey=nextOutline;const selected=result.cells[index];
  if(selected){const points=[],vertices=selected.vertices||polarOutline(result,selected);for(let j=0;j<vertices.length;j++)points.push(...vertices[j],...vertices[(j+1)%vertices.length]);
   const m=new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,depthWrite:false,toneMapped:false});configureCoverageMaterial(m,configureDepth);
   outline=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),m);outline.renderOrder=12;group.add(outline);}
 }
 if(mesh)mesh.material.opacity=mesh.userData.fans?options.opacity*.48:options.opacity;
 return group;
}
// A polar cell's outline: its wedge between two radii (band radii for arcs).
function polarOutline(result,cell){
 const [r0,r1]=cell.kind==='arc'?[result.extent*1.02,result.extent*1.09]:[cell.r0,cell.r1],n=Math.max(1,Math.ceil((cell.to-cell.from)/(Math.PI/90))),out=[];
 for(let k=0;k<=n;k++)out.push(polarPoint(result,cell.from+(cell.to-cell.from)*k/n,r1));
 for(let k=n;k>=0;k--)out.push(polarPoint(result,cell.from+(cell.to-cell.from)*k/n,r0));
 return out;
}
export function pickCoverage(raycaster,scene){
 if(!group?.visible||!mesh||!coverageOptions(scene).inspect)return null;
 const target=pickMesh||mesh,hit=raycaster.intersectObject(target)[0];if(!hit)return null;
 const index=target.userData.sampleMap[hit.faceIndex],result=currentCoverage(scene)?.result;
 return result?{index,sample:result.samples[index],center:result.center}:null;
}
export function coverageDescription(inspection){
 if(!inspection)return [];
 const s=inspection.sample,d=s.point.map((v,i)=>v-inspection.center[i]),length=Math.hypot(...d)||1,p=s.polar;
 const where=p?`Bearing ${(p.bearing*180/Math.PI).toFixed(1)}° (${p.reference})${p.infinite?' · at infinity':` · distance ${p.r0.toFixed(2)}–${p.r1.toFixed(2)}`}`:`Target ${s.point.map(n=>n.toFixed(2)).join(', ')} · direction ${d.map(n=>(n/length).toFixed(2)).join(', ')}`;
 return [where,
  `${s.classification} · ${s.potential} eligible / ${s.clear} clear / ${s.obstructed} blocked`,
  ...s.contributors.map(t=>`${t.name}: ${t.clear?'clear':'blocked'}${t.fixed?` (fixed, ${Math.min(...t.paths.map(p=>p.offAxis??0)).toFixed(1)}° off-axis)`:''}${t.partial?' (some muzzles blocked)':''}${t.unresolvedMuzzles?' (some muzzles unresolved)':''}${t.paths.some(p=>p.blocker)?' · '+[...new Set(t.paths.filter(p=>p.blocker).map(p=>(p.blocker.turretId?'turret '+p.blocker.turretId+' / ':'')+p.blocker.blockId))].join(', '):''}`),
  ...(s.unresolved.length?['Unresolved aiming: '+s.unresolved.join(', ')]:[])];
}
export function drawCoverageLegend(ctx,scene,view,width,height){
 if(!scene.showFireCoverage||view.display?.showOverlays===false)return;
 const state=currentCoverage(scene),r=state?.result,options=coverageOptions(scene),o={...options,metric:r?displayMetric(scene,r,options):options.metric};ctx.save();ctx.font='12px sans-serif';
 const polar=r?.mode==='slice'&&!!r.polar,fans=!polar&&r?.mode==='slice'&&o.individual&&!['blind','difference'].includes(o.metric);
 if(r&&(fans||polar)&&o.showShip)for(const [i,t] of r.turrets.entries()){
  if(!t.position)continue;const p=projectPoint(nativeToView(t.position),view,width,height);if(!p)continue;const label=String((t.colorIndex??i)+1);
  ctx.beginPath();ctx.arc(p[0],p[1],9,0,Math.PI*2);ctx.fillStyle='#08101ce8';ctx.fill();ctx.strokeStyle=turretColor(r,o,i);ctx.stroke();ctx.fillStyle='#f1f6ff';ctx.textAlign='center';ctx.fillText(label,p[0],p[1]+4);ctx.textAlign='left';
 }
 const title=r?.mode==='sphere'?'SPHERICAL HEATMAP':`${(r?.plane||o.plane).toUpperCase()} · DIRECTIONAL SLICE`;
 ctx.fillStyle='#07111ce8';ctx.fillRect(10,height-83,Math.min(width-20,470),73);
 ctx.fillStyle='#edf4fc';ctx.font='bold 12px sans-serif';ctx.fillText(title,22,height-63);ctx.font='12px sans-serif';
 if(r&&fans){
  let x=22;for(let i=0;i<Math.min(r.turrets.length,8);i++){ctx.fillStyle=turretColor(r,o,i);ctx.fillRect(x,height-49,12,8);ctx.fillStyle='#dce5ef';ctx.fillText(String((r.turrets[i].colorIndex??i)+1),x+17,height-41);x+=43;}
  ctx.fillStyle='#a4b6cb';ctx.fillText(`${o.metric} fields · overlaps blend${o.metric==='clear'?' · dark gaps are blind':''}`,22,height-22);
 }else if(r&&polar){
  const limit=o.autoScale?Math.max(1,...r.samples.map(s=>s[o.metric]||0)):o.scaleMax,gradient=ctx.createLinearGradient(22,0,172,0);
  if(o.metric!=='blind'){for(let i=0;i<=20;i++)gradient.addColorStop(i/20,'#'+heatColor(1-i/20,1,o.palette).getHexString());ctx.fillStyle=gradient;ctx.fillRect(22,height-49,150,9);ctx.fillStyle='#dce5ef';ctx.fillText(`${limit}+`,22,height-34);ctx.textAlign='right';ctx.fillText('0',172,height-34);ctx.textAlign='left';}
  let x=190;for(let i=0;i<Math.min(r.turrets.length,7);i++){ctx.fillStyle=turretColor(r,o,i);ctx.fillRect(x,height-49,12,8);ctx.fillStyle='#dce5ef';ctx.fillText(String((r.turrets[i].colorIndex??i)+1),x+17,height-41);x+=38;}
  ctx.fillStyle='#a4b6cb';ctx.fillText(`Band: ${o.metric==='blind'?'class':o.metric+' count'} at infinity · rings: turret arcs, amber blocked · white line: dead zone${r.polar.partial?' · field pending':''}`,22,height-18,Math.max(20,Math.min(width-20,470)-24));
 }else if(r&&o.metric==='difference'){
  const gradient=ctx.createLinearGradient(22,0,272,0);for(let i=0;i<=20;i++)gradient.addColorStop(i/20,'#'+differenceColor(3-i*.3,3).getHexString());
  ctx.fillStyle=gradient;ctx.fillRect(22,height-49,250,9);ctx.fillStyle='#dce5ef';ctx.fillText('+3 clear turrets',22,height-22);ctx.textAlign='right';ctx.fillText('−3 vs baseline',272,height-22);ctx.textAlign='left';ctx.fillStyle='#a4b6cb';ctx.fillText(`Baseline: ${scene.coverageBaseline.label}`,290,height-22,Math.max(20,Math.min(width-20,470)-290));
 }else if(r&&o.metric!=='blind'){
  const limit=o.autoScale?Math.max(1,...r.samples.map(s=>s[o.metric]||0)):o.scaleMax,gradient=ctx.createLinearGradient(22,0,272,0);
  for(let i=0;i<=20;i++)gradient.addColorStop(i/20,'#'+heatColor(1-i/20,1,o.palette).getHexString());
  ctx.fillStyle=gradient;ctx.fillRect(22,height-49,250,9);ctx.fillStyle='#dce5ef';ctx.fillText(`${limit}+ ${o.metric} turrets`,22,height-22);ctx.textAlign='right';ctx.fillText(o.metric==='clear'?'0 · blind':'0',272,height-22);ctx.textAlign='left';
 }else{ctx.fillStyle='#b9c9db';ctx.fillText(r?'Pink: blocked · Amber: partial · Green: covered':state?.status||'Attach turrets to analyze',22,height-35);}
 if(state?.status&&r){ctx.fillStyle='#b9c9db';ctx.fillText(state.status,22,height-92);}
 else if(r?.warnings.length){ctx.fillStyle='#e5b57e';ctx.fillText(r.warnings[0],22,height-92,Math.max(20,width-44));}
 const inspection=scene.coverageHover||scene.coverageInspection;
 if(inspection&&o.inspect){const text=coverageDescription(inspection),x=64;let y=155;
  for(const line of text.slice(0,7)){ctx.fillStyle='#111923ee';ctx.fillRect(x,y-12,Math.min(width-x-10,ctx.measureText(line).width+10),17);ctx.fillStyle='#ffffff';ctx.fillText(line,x+5,y,Math.max(20,width-x-20));y+=17;}
 }
 ctx.restore();
}
