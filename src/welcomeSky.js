import * as THREE from './vendor/three.module.js';
import {createSkybox} from './skybox.js';
import {WORLD_DEFAULTS,skySpecification} from './sky-settings.js';

// Render the shared sky generator once, then retain only a lightweight 2D image.
export async function paintWelcomeSky(canvas,preferences,isVisible){
 const sky=createSkybox();let renderer;
 try{
  await sky.ready;if(!isVisible()||sky.status!=='Ready')return false;
  const p={...WORLD_DEFAULTS,...preferences,worldEnabled:true,worldResolution:256};
  renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
  const width=Math.min(1440,window.innerWidth),height=Math.round(width*window.innerHeight/window.innerWidth);
  renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const texture=sky.texture(renderer,p);if(!texture)return false;
  const scene=new THREE.Scene();scene.background=texture;
  const camera=new THREE.PerspectiveCamera(75,width/height,.1,10);
  const direction=skySpecification(p).clouds[0]?.direction||[0,0,-1];
  camera.lookAt(new THREE.Vector3(...direction));camera.updateMatrixWorld();
  renderer.render(scene,camera);
  canvas.width=width;canvas.height=height;
  canvas.getContext('2d').drawImage(renderer.domElement,0,0);
  return true;
 }finally{sky.dispose();if(renderer){renderer.dispose();renderer.forceContextLoss();}}
}
