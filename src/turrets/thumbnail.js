import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';

// One renderer serves all tiles; cached canvases survive editor redraws without
// allocating a WebGL context for every asset.
let renderer;
const previews=new WeakMap();
export function thumbnail(canvas,asset){
  let preview=previews.get(asset);
  if(!preview){
    renderer??=new THREE.WebGLRenderer({alpha:true,antialias:true});
    renderer.setSize(360,240,false);renderer.setClearColor(0,0);
    const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);
    scene.add(new THREE.HemisphereLight(0xffffff,0x657080,2));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,5,4);scene.add(light);
    const profile=defaultOrientationProfile();
    try{
      for(const block of asset.blocks){
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.BufferAttribute(blockSurfaceGeometry(block,profile).positions,3));
        geometry.computeVertexNormals();
        const material=new THREE.MeshStandardMaterial({color:'#'+block.color.slice(-6),roughness:.75,metalness:.1});
        group.add(new THREE.Mesh(geometry,material));
      }
      const bounds=new THREE.Box3().setFromObject(group),sphere=bounds.getBoundingSphere(new THREE.Sphere());
      if(bounds.isEmpty()||!Number.isFinite(sphere.radius))throw Error('Turret has no preview geometry.');
      group.position.copy(sphere.center).negate();
      const radius=Math.max(sphere.radius,1e-6),camera=new THREE.PerspectiveCamera(35,1.5,radius*.01,radius*20);
      const distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.08;
      camera.position.set(1,.7,1.3).normalize().multiplyScalar(distance);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
      renderer.render(scene,camera);
      preview=document.createElement('canvas');preview.width=360;preview.height=240;
      preview.getContext('2d').drawImage(renderer.domElement,0,0);previews.set(asset,preview);
    }finally{
      for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();}
      renderer.renderLists.dispose();
    }
  }
  canvas.width=preview.width;canvas.height=preview.height;
  canvas.setAttribute('aria-label',asset.name+' geometry preview');
  canvas.getContext('2d').drawImage(preview,0,0);
}
