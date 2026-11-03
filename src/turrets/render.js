import {componentEntries} from '../components/core.js';
import * as THREE from '../vendor/three.module.js';
import {blockSurfaceGeometry} from '../avorion/lib/geometry/blockSurface.js';
import {defaultOrientationProfile} from '../avorion/lib/avorion/orientationProfile.js';
import {partMatrices,createInstance} from './core.js';
import {sceneSockets} from './sockets.js';
import {mounts} from './mounts.js';
export const TURRET_HIGHLIGHT=[.55,1,.04];
const geometryCache=new Map();
let group,model,items,preview,revision,components;
export function syncTurrets(world,scene,view,configureDepth){
  const next=mounts(scene),ghost=scene.turretPreview;
  if(components!==scene.model?.componentSetup||revision!==scene.revision||model!==scene.model||items!==next||preview!==ghost){
    if(group){world.remove(group);group.traverse(o=>{o.material?.dispose();});}
    group=new THREE.Group();world.add(group);model=scene.model;revision=scene.revision;items=next;preview=ghost;components=scene.model?.componentSetup;
    const used=new Set();
    const sockets=sceneSockets(scene),entries=next.map(m=>({asset:m.asset,socket:sockets.find(s=>s.id===m.socketId),instance:m}));
    entries.push(...componentEntries(scene));
    if(ghost)entries.push({...ghost,instance:{...createInstance(ghost.asset.id,ghost.socket.id,'preview'),turretSize:ghost.size},ghost:true});
    for(const e of entries){if(!e.socket)continue;const matrices=e.component?{base:e.matrix,body:e.matrix,barrel:e.matrix}:partMatrices(e.asset,e.socket,e.instance),holder=new THREE.Group();holder.userData.blockId=e.socket.blockId;holder.userData.mountId=e.ghost||e.component?null:e.instance.id;holder.userData.socketId=e.socket.id;group.add(holder);
      const key=(e.component?'component:':'turret:')+e.asset.id+':'+(e.asset.sourceXml||JSON.stringify([e.asset.blocks,e.asset.parts]))+JSON.stringify(e.asset.blocks.map(b=>b.color));used.add(key);
      let parts=geometryCache.get(key);if(!parts){parts=new Map();for(const part of ['base','body','barrel']){
        const positions=[],colors=[],edges=[];for(const b of e.asset.blocks.filter(b=>(e.asset.parts?.[b.id]||'base')===part)){
          const data=blockSurfaceGeometry(b,defaultOrientationProfile()).positions,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));g.computeVertexNormals();const outline=new THREE.EdgesGeometry(g,25);for(const value of outline.attributes.position.array)edges.push(value);outline.dispose();const base=new THREE.Color('#'+b.color.slice(-6)),light=new THREE.Vector3(-.4,1,.6).normalize(),n=new THREE.Vector3();
          for(let i=0;i<g.attributes.normal.count;i++){positions.push(data[i*3],data[i*3+1],data[i*3+2]);const color=base.clone().multiplyScalar(.45+.55*Math.max(0,n.fromBufferAttribute(g.attributes.normal,i).dot(light)));colors.push(color.r,color.g,color.b);}g.dispose();
        }
        if(positions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const edgeGeometry=new THREE.BufferGeometry();edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));g.userData.blueprintEdges=edgeGeometry;parts.set(part,g);}
      }geometryCache.set(key,parts);}
      holder.userData.hidden=e.instance.hidden;
      const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:!!e.ghost,opacity:e.ghost?.55:1,depthWrite:!e.ghost});
      const highlight={value:0};material.userData.highlight=highlight;
      material.onBeforeCompile=shader=>{
        shader.uniforms.uTurretHighlight=highlight;
        shader.fragmentShader='uniform float uTurretHighlight;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${TURRET_HIGHLIGHT.join(',')}),uTurretHighlight*0.72);`);
      };
      material.customProgramCacheKey=()=> 'turret-lime-highlight-v1';
      configureDepth(material);
      for(const [part,geometry] of parts){const mesh=new THREE.Mesh(geometry,material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(matrices[part]);holder.add(mesh);
        const technicalMaterial=new THREE.LineBasicMaterial({color:new THREE.Color(.72,.88,1)});configureDepth(technicalMaterial);
        const technicalEdges=new THREE.LineSegments(geometry.userData.blueprintEdges,technicalMaterial);
        technicalEdges.userData.blueprintEdges=true;technicalEdges.matrixAutoUpdate=false;technicalEdges.matrix.copy(matrices[part]);technicalEdges.visible=false;holder.add(technicalEdges);
        if(e.ghost){
          geometry.userData.previewEdges??=new THREE.EdgesGeometry(geometry,25);
          const outlineMaterial=new THREE.LineBasicMaterial({color:new THREE.Color(...TURRET_HIGHLIGHT),depthWrite:false});configureDepth(outlineMaterial);
          const outline=new THREE.LineSegments(geometry.userData.previewEdges,outlineMaterial);outline.matrixAutoUpdate=false;outline.matrix.copy(matrices[part]);holder.add(outline);
        }
      }

    }
    for(const [key,parts] of geometryCache)if(!used.has(key)){for(const g of parts.values()){g.userData.previewEdges?.dispose();g.userData.blueprintEdges?.dispose();g.dispose();}geometryCache.delete(key);}
  }
  const blueprint=!!view.display?.blueprint;
  group.traverse(object=>{
    if(object.userData.blueprintEdges){object.visible=blueprint;return;}
    if(!object.isMesh)return;
    const material=object.material;
    if(material.vertexColors===blueprint){material.vertexColors=!blueprint;material.needsUpdate=true;}
    material.color.setRGB(...(blueprint?[.055,.14,.22]:[1,1,1]));
    material.polygonOffset=blueprint;material.polygonOffsetFactor=1;material.polygonOffsetUnits=1;
  });
  if(!group.userData.bounds)group.userData.bounds=new THREE.Box3().setFromObject(group);
  group.visible=!!scene.loaded&&scene.visible;const hidden=scene.hiddenIds||new Set();for(const child of group.children)child.visible=!child.userData.hidden&&!hidden.has(child.userData.blockId);group.traverse(o=>{if(o.material?.userData.highlight)o.material.userData.highlight.value=!blueprint&&o.parent.userData.mountId&&(scene.selectedTurretIds?.has(o.parent.userData.mountId)||o.parent.userData.mountId===scene.selectedTurretId)?1:0;});return group;
}

export function pickMountedTurret(raycaster){
 if(!group?.visible)return null;
 const hits=raycaster.intersectObjects(group.children.filter(c=>c.visible&&c.userData.mountId),true);
 return hits.find(hit=>hit.object.isMesh)||null;
}

export function turretGeometryStats(){return {assets:geometryCache.size,geometries:[...geometryCache.values()].reduce((n,p)=>n+p.size,0),instances:group?.children.length||0};}
