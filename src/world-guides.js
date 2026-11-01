import * as THREE from './vendor/three.module.js';
import {metrics} from './navigation.js';

// Keep roughly 24–240 CSS pixels between grid lines at the orbit target.
export function gridSpacing(view,width,height){
  const base=view.display?.gridScale??1;
  const desired=24/Math.max(1e-12,metrics(view,width,height).scale);
  return base*10**Math.ceil(Math.log10(desired/base));
}

// Analytic ray/plane intersections have no geometry boundary, including when
// panning away from the origin. Axes use camera-facing planes through each axis.
export function createWorldGuides(){
  const geometry=new THREE.PlaneGeometry(2,2);
  const vertexShader=`varying vec2 ndc;void main(){ndc=position.xy;gl_Position=vec4(position.xy,0.,1.);}`;
  const fragmentShader=`
    varying vec2 ndc;
    uniform mat4 inverseProjection,cameraWorld,worldView,projection;
    uniform vec3 axis,color,majorColor,planeNormal;
    uniform float spacing,axisMode,halfLength,lineWidth,brightness,pixelRatio,logDepth,farClip;
    vec3 unproject(float z){vec4 p=inverseProjection*vec4(ndc,z,1.);return (cameraWorld*vec4(p.xyz/p.w,1.)).xyz;}
    float gridLine(vec2 uv){vec2 width=max(fwidth(uv),vec2(.000001));vec2 d=abs(fract(uv-.5)-.5)/width;return 1.-smoothstep(.4,1.2,min(d.x,d.y));}
    void main(){
      vec3 nearPoint=unproject(-1.),ray=normalize(unproject(0.)-nearPoint);
      // Model-focused near clipping must not remove foreground guides.
      // Perspective rays start at the eye; orthographic rays at the eye plane.
      vec3 origin=cameraWorld[3].xyz;
      if(projection[3][3]>.5){
        float eyeZ=(worldView*vec4(nearPoint,1.)).z;
        origin=nearPoint-cameraWorld[2].xyz*eyeZ;
      }
      float denominator=dot(ray,planeNormal);
      if(abs(denominator)<.000001)discard;
      float t=-dot(origin,planeNormal)/denominator;
      if(t<0.)discard;
      vec3 point=origin+ray*t;
      vec4 eye=worldView*vec4(point,1.),clip=projection*eye;
      float alpha;vec3 tint=color;
      if(axisMode>.5){
        float along=dot(point,axis);
        if(halfLength>0.&&abs(along)>halfLength)discard;
        vec3 side=normalize(cross(planeNormal,axis));
        float distance=dot(point,side);
        float pixels=abs(distance)/max(fwidth(distance),.000001);
        alpha=1.-smoothstep(max(0.,lineWidth*pixelRatio*.5-.5),lineWidth*pixelRatio*.5+.5,pixels);
      }else{
        vec2 uv=point.xz/spacing;
        float minor=gridLine(uv),major=gridLine(uv/10.);
        // Fade subpixel cells at the horizon; never terminate at a square edge.
        float fade=1.-smoothstep(.15,1.,max(length(dFdx(uv)),length(dFdy(uv))));
        alpha=max(minor*.65,major)*fade;
        tint=mix(color,majorColor,major);
      }
      if(alpha<.005)discard;
      float depth=clip.z/clip.w*.5+.5;
      if(logDepth>.5)depth=log2(max(.000001,1.-eye.z))/log2(farClip+1.);
      gl_FragDepth=clamp(depth,0.,.9999999);
      gl_FragColor=vec4(tint*brightness,alpha);
    }`;
  const make=(axisMode,axis,color)=>{
    const uniforms={inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},worldView:{value:new THREE.Matrix4()},projection:{value:new THREE.Matrix4()},axis:{value:new THREE.Vector3(...axis)},color:{value:new THREE.Color(color)},majorColor:{value:new THREE.Color()},planeNormal:{value:new THREE.Vector3(0,1,0)},spacing:{value:1},axisMode:{value:axisMode},halfLength:{value:0},lineWidth:{value:1},brightness:{value:1},pixelRatio:{value:1},logDepth:{value:0},farClip:{value:1000}};
    const mesh=new THREE.Mesh(axisMode?geometry.clone():geometry,new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false}));
    mesh.frustumCulled=false;mesh.renderOrder=axisMode?11:10;return mesh;
  };
  const grid=make(0,[0,1,0],0x555555);
  const axes=[make(1,[1,0,0],0xa34f50),make(1,[0,0,-1],0x65a34f),make(1,[0,1,0],0x527ac6)];
  const update=(camera,view,width,height,theme,dpr,log,spacingSize=null)=>{
    const d=view.display||{},back=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,2);
    const spacing=gridSpacing(view,spacingSize?.width||width,spacingSize?.height||height);
    for(const [i,mesh] of [grid,...axes].entries()){
      const u=mesh.material.uniforms;
      mesh.visible=d.showOverlays!==false&&(i?!!d[['axisX','axisY','axisZ'][i-1]]:!!view.grid);
      u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.cameraWorld.value.copy(camera.matrixWorld);
      u.worldView.value.copy(camera.matrixWorldInverse);u.projection.value.copy(camera.projectionMatrix);
      u.logDepth.value=log;u.farClip.value=camera.far;u.pixelRatio.value=dpr;
      if(i){
        u.planeNormal.value.copy(back).addScaledVector(u.axis.value,-back.dot(u.axis.value));
        if(u.planeNormal.value.lengthSq()<1e-10){mesh.visible=false;continue;}
        u.planeNormal.value.normalize();u.halfLength.value=d.axisInfinite?0:(d.axisLength??70)/2;
        u.lineWidth.value=d.axisWidth??1;u.brightness.value=d.axisBrightness??1;
        // Rasterize only a narrow screen-space strip around the projected axis.
        // Keep analytic intersections for finite endpoints and accurate depth.
        const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
        const origin=new THREE.Vector4(0,0,0,1).applyMatrix4(matrix),direction=new THREE.Vector4(...u.axis.value.toArray(),0).applyMatrix4(matrix);
        const line=new THREE.Vector3(origin.x,origin.y,origin.w).cross(new THREE.Vector3(direction.x,direction.y,direction.w));
        let nx=2*line.x/width,ny=2*line.y/height;const length=Math.hypot(nx,ny);
        if(length<1e-12){mesh.visible=false;continue;}
        nx/=length;ny/=length;const constant=(line.z-line.x-line.y)/length;
        const signed=nx*width/2+ny*height/2+constant,cx=width/2-nx*signed,cy=height/2-ny*signed;
        const extent=Math.hypot(width,height)*2,half=u.lineWidth.value/2+2;
        const corners=[[-1,-1],[1,-1],[-1,1],[1,1]],positions=mesh.geometry.getAttribute('position');
        corners.forEach(([along,across],j)=>positions.setXYZ(j,2*(cx-ny*along*extent+nx*across*half)/width-1,2*(cy+nx*along*extent+ny*across*half)/height-1,0));positions.needsUpdate=true;

      }else{
        u.spacing.value=spacing;u.color.value.setStyle(theme.grid,THREE.LinearSRGBColorSpace);u.majorColor.value.setStyle(theme.majorGrid,THREE.LinearSRGBColorSpace);
      }
    }
  };
  return {grid,axes,update};
}
