import * as THREE from '../vendor/three.module.js';
import {exportPaintedXml} from '../color-workshop.js';
import {parseAvorionXml} from '../block-model.js';
import {componentEntries} from './core.js';

// Bake mounted components into the ship as real blocks, so the game can load them.
// Avorion blocks only face along the six axes, so every component must be turned
// by multiples of 90° (socket, twist and attachment rotation together).
const AXIS_VECTORS=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const round=v=>{const r=Math.round(v*1e6)/1e6;return Object.is(r,-0)?0:r;};
function axisIndex(vector){
 const i=vector.findIndex(v=>Math.abs(v)>.5);
 if(i<0||vector.some((v,j)=>j!==i&&Math.abs(v)>1e-4)||Math.abs(Math.abs(vector[i])-1)>1e-4)return -1;
 return i*2+(vector[i]>0?1:0);
}
// Splits a placement matrix into translation, a 90°-step rotation and a uniform scale.
export function axisAlignedTransform(matrix){
 const position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,quaternion,scale);
 if(Math.abs(scale.x-scale.y)>1e-4||Math.abs(scale.x-scale.z)>1e-4||scale.x<=0)return null;
 const rotation=new THREE.Matrix4().makeRotationFromQuaternion(quaternion),e=rotation.elements;
 const columns=[[e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]]];
 if(columns.some(c=>axisIndex(c)<0))return null;
 return {matrix,rotate:v=>{const r=new THREE.Vector3(...v).applyMatrix4(rotation);return [r.x,r.y,r.z].map(n=>Math.round(n));},scale:scale.x};
}
export function bakedBlocks(scene){
 const offset=scene.model.placementOffset||{x:0,y:0,z:0},problems=[],blocks=[];
 for(const entry of componentEntries(scene)){
  if(entry.instance.hidden)continue;
  const label=(entry.instance.name||entry.asset.name)+' on '+entry.socket.name;
  const transform=axisAlignedTransform(entry.matrix);
  if(!transform){problems.push(label+': rotation is not a multiple of 90°');continue;}
  for(const block of entry.asset.blocks){
   const center=new THREE.Vector3(block.position.x,block.position.y,block.position.z).applyMatrix4(entry.matrix);
   const size=transform.rotate([block.size.x,block.size.y,block.size.z]).map(v=>Math.abs(v)*transform.scale);
   const look=axisIndex(transform.rotate(AXIS_VECTORS[block.look])),up=axisIndex(transform.rotate(AXIS_VECTORS[block.up]));
   blocks.push({block,parentBlockId:entry.socket.blockId,center:[center.x-offset.x,center.y-offset.y,center.z-offset.z],size,look,up});
  }
 }
 return {blocks,problems};
}
export function bakeComponentsXml(scene){
 const model=scene.model;if(!model?.doc)throw Error('Open a ship XML before baking components.');
 const {blocks,problems}=bakedBlocks(scene);
 if(problems.length)throw Error('Cannot bake: '+problems.join('; ')+'. Use 90° steps for socket rotation, twist and attachment rotation.');
 if(!blocks.length)throw Error('No visible mounted components to bake.');
 const doc=new DOMParser().parseFromString(exportPaintedXml(model),'application/xml');
 const original=[...model.doc.getElementsByTagName('block')],copies=doc.getElementsByTagName('block');
 const first=copies[original.indexOf(model.blocks[0].el)],plan=first?.parentElement?.tagName==='item'?first.parentElement.parentElement:null;
 if(!plan)throw Error('Could not find the ship plan in the XML.');
 const items=[...plan.children].filter(el=>el.tagName==='item');
 let next=Math.max(-1,...items.map(el=>Number(el.getAttribute('index'))).filter(Number.isFinite))+1;
 const root=items.find(el=>!el.hasAttribute('parent'))?.getAttribute('index')??items[0]?.getAttribute('index');
 const parentIndex=new Map(model.blocks.map(b=>[b.id,b.itemEl?.getAttribute('index')]));
 const ns=plan.namespaceURI;
 for(const baked of blocks){
  const item=doc.createElementNS(ns,'item'),el=doc.createElementNS(ns,'block'),{block}=baked;
  const parent=parentIndex.get(baked.parentBlockId)??root;if(parent!=null)item.setAttribute('parent',parent);item.setAttribute('index',String(next++));
  const lower=baked.center.map((v,i)=>round(v-baked.size[i]/2)),upper=baked.center.map((v,i)=>round(v+baked.size[i]/2));
  for(const [key,value] of Object.entries(block.unknownAttrs||{}))el.setAttribute(key,value);
  for(const [key,value] of [['lx',lower[0]],['ly',lower[1]],['lz',lower[2]],['ux',upper[0]],['uy',upper[1]],['uz',upper[2]],['index',block.typeIndex],['material',block.materialIndex],['look',baked.look],['up',baked.up],['color',block.color]])el.setAttribute(key,String(value));
  item.append(el);plan.append(item);
 }
 const text=new XMLSerializer().serializeToString(doc);
 parseAvorionXml(text,model.fileName,text.length);
 return {text,count:blocks.length};
}
