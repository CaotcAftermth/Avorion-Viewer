// Each viewport owns its display settings; legacy camera state stays compatible.
export const VIEWPORT_DEFAULTS=Object.freeze({
  showGizmo:true,showOverlays:true,axisX:true,axisY:true,axisZ:true,gridScale:1,axisInfinite:true,axisLength:70,axisWidth:1,axisBrightness:1,ambientOnly:false,ambientStrength:1,ambientDetail:.35,
  showText:true,showPerformance:false,showStats:true,shadeSelected:true,outlineSelected:false,showBlockBounds:false,showModelDimensions:false,
  wireOverlay:false,wireThreshold:1,wireOpacity:1,shading:'MATERIAL',
  lighting:'STUDIO',studioLight:'Default',matcap:'Red Wax',background:'WORLD',backgroundColor:'#0d0d0d',
  backfaceCulling:true,objectOutline:true,outlineColor:'#000000',specular:true,
  xray:false,xrayAlpha:.5,shadows:true,shadowIntensity:.5,dof:false,focusDistance:10,aperture:2.8,
  focalLength:50,clipStart:.01,clipEnd:1000
});
const enums={shading:['WIREFRAME','SOLID','MATERIAL','RENDERED'],lighting:['STUDIO','MATCAP'],background:['THEME','WORLD','VIEWPORT'],studioLight:['Default'],matcap:['Red Wax']};
const ranges={axisLength:[.001,1e12],axisWidth:[.5,12],axisBrightness:[0,4],ambientStrength:[0,4],ambientDetail:[0,1],gridScale:[.001,1000],wireThreshold:[0,1],wireOpacity:[0,1],xrayAlpha:[0,1],shadowIntensity:[0,1],focusDistance:[.001,1e7],aperture:[.1,64],focalLength:[1,300],clipStart:[.0001,1e6],clipEnd:[.001,1e7]};
export function ensureViewportOptions(view){
  if(!view.display||typeof view.display!=='object'||Array.isArray(view.display))delete view.display;
  if(view.display&&view.display.shadeSelected===undefined&&typeof view.display.outlineSelected==='boolean'){
    view.display.shadeSelected=view.display.outlineSelected;view.display.outlineSelected=false;
  }
  const value=view.display??={...VIEWPORT_DEFAULTS,shading:view.wire?'WIREFRAME':'MATERIAL'};
  // Render timing became opt-in; turn it off once in layouts saved before that.
  if(value.performanceOptIn!==true){value.showPerformance=false;value.performanceOptIn=true;}
  for(const [key,fallback] of Object.entries(VIEWPORT_DEFAULTS)){
    const v=value[key];
    if(enums[key]?!enums[key].includes(v):ranges[key]?(!Number.isFinite(v)||v<ranges[key][0]||v>ranges[key][1]):typeof fallback==='boolean'?typeof v!=='boolean':!/^#[\da-f]{6}$/i.test(v))value[key]=fallback;
  }
  if(value.clipEnd<=value.clipStart){value.clipStart=.01;value.clipEnd=1000;}
  view.wire=value.shading==='WIREFRAME';
  return value;
}
export function viewportPreferences(p,view){
  const d=view.display;if(!d)return p;
  const preview=d.shading!=='RENDERED';
  return {...p,clipStart:d.clipStart,clipEnd:d.clipEnd,
    ...(preview?{shaderDirectionalEnabled:true,shaderAmbientEnabled:true,shaderSkyEnabled:true,shaderAzimuth:35,shaderElevation:50,shaderLight:1,shaderAmbient:.35,shaderSkyAmbient:.3,shaderSpill:0}:{}),
    shaderSpecular:d.specular?p.shaderSpecular:0,
    ...(d.ambientOnly?{shaderDirectionalEnabled:false,shaderSkyEnabled:false,shaderAmbientEnabled:true,shaderAmbient:d.ambientStrength,shaderAmbientColor:'#ffffff',shaderSpecular:0,shaderMinReflection:0,shaderMaxReflection:0,shaderSpill:0}:{})};
}
