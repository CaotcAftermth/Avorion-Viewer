import * as THREE from '../../../vendor/three.module.js';

// Bounds reject entire block groups before testing exact surface triangles.
// IDs stay independent of triangle sorting and GPU buffer positions.
export function installBlockRaycast(mesh,prepared){
  let version=-1,root;
  const inverse=new THREE.Matrix4(),ray=new THREE.Ray(),point=new THREE.Vector3();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
  function build(){
    const positions=mesh.geometry.getAttribute('position');
    const entries=[];
    for(const [id,stateRanges] of mesh.userData.ranges){
      const instanceId=mesh.userData.instanced?stateRanges[0][0]:undefined;
      const ranges=instanceId===undefined?stateRanges:[[0,positions.count]];
      const offset=instanceId===undefined?new THREE.Vector3():new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('aOffset'),instanceId);
      const box=new THREE.Box3();
      for(const [start,count] of ranges)for(let i=start;i<start+count;i++)box.expandByPoint(point.fromBufferAttribute(positions,i).add(offset));
      entries.push({id,ranges,box,offset,instanceId});
    }
    function split(entries){
      const box=new THREE.Box3();for(const e of entries)box.union(e.box);
      if(entries.length<=16)return {box,entries};
      const size=box.getSize(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
      entries.sort((a,b)=>a.box.min[axis]+a.box.max[axis]-b.box.min[axis]-b.box.max[axis]);
      const mid=entries.length>>1;return {box,left:split(entries.slice(0,mid)),right:split(entries.slice(mid))};
    }
    root=split(entries);mesh.userData.pickTree=root;version=positions.version;
  }
  mesh.raycast=(raycaster,hits)=>{
    const positions=mesh.geometry.getAttribute('position');if(version!==positions.version)build();
    inverse.copy(mesh.matrixWorld).invert();ray.copy(raycaster.ray).applyMatrix4(inverse);
    const visit=node=>{
      if(!ray.intersectsBox(node.box))return;
      if(!node.entries){visit(node.left);visit(node.right);return;}
      for(const e of node.entries){
        if(mesh.userData.hidden?.has(e.id)||!ray.intersectsBox(e.box))continue;
        for(const [start,count] of e.ranges)for(let i=start;i<start+count;i+=3){
          a.fromBufferAttribute(positions,i).add(e.offset);b.fromBufferAttribute(positions,i+1).add(e.offset);c.fromBufferAttribute(positions,i+2).add(e.offset);
          const flags=Math.floor(mesh.geometry.getAttribute('aParams').getY(e.instanceId??i));
          const cull=mesh.material.uniforms.uCull.value>.5&&!(flags&32);
          if(!ray.intersectTriangle(a,b,c,cull,point))continue;
          const world=point.clone().applyMatrix4(mesh.matrixWorld),distance=raycaster.ray.origin.distanceTo(world);
          if(distance<raycaster.near||distance>raycaster.far)continue;
          THREE.Triangle.getNormal(a,b,c,normal);
          hits.push({distance,point:world,object:mesh,blockId:e.id,instanceId:e.instanceId,face:{a:i,b:i+1,c:i+2,normal:normal.clone()},faceIndex:i/3});
        }
      }
    };visit(root);
  };
  // Build during model preparation, not the first click.
  if(prepared){root=prepared;mesh.userData.pickTree=root;version=mesh.geometry.getAttribute('position').version;}else build();
}
