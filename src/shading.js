// CPU solid-face shading for the Canvas reference renderer; no GPU shader compilation.
export const REFERENCE_NORMALS=[[0,0,-1],[0,-1,0],[1,0,0],[0,1,0],[-1,0,0],[0,0,1]];
export function shadeFace(normal,viewDirection,p) {
  const azimuth=p.shaderAzimuth*Math.PI/180,elevation=p.shaderElevation*Math.PI/180;
  const light=[Math.sin(azimuth)*Math.cos(elevation),-Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation)];
  const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
  const diffuse=Math.max(0,dot(normal,light));
  const half=light.map((value,i)=>value+viewDirection[i]),length=Math.hypot(...half);
  const specular=diffuse>0&&length>1e-8?Math.pow(Math.max(0,dot(normal,half.map(value=>value/length))),2/(p.shaderRoughness*p.shaderRoughness)):0;
  const exposure=2**p.shaderExposure;
  const channels=[1,3,5].map(offset=>{
    const base=parseInt(p.shaderColor.slice(offset,offset+2),16)/255;
    return Math.round(Math.min(1,Math.max(0,(base*((p.shaderAmbientEnabled===false?0:p.shaderAmbient)+(p.shaderDirectionalEnabled===false?0:p.shaderLight)*diffuse)+p.shaderSpecular*(p.shaderDirectionalEnabled===false?0:p.shaderLight)*specular)*exposure))*255);
  });
  return 'rgb('+channels.join(', ')+')';
}
