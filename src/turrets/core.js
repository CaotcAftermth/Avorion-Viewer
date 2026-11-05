import * as THREE from '../vendor/three.module.js';
import {makeBlock,makeModel,parseAvorionXml} from '../block-model.js';
export const PARTS=['base','body','barrel'];
const rad=THREE.MathUtils.degToRad;
export const vector=a=>new THREE.Vector3(...a);
export function frame(position,rotation=[0,0,0]){
  return new THREE.Matrix4().compose(vector(position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(rad),'XYZ')),new THREE.Vector3(1,1,1));
}
function pivotMatrix(pivot,angle){
  return new THREE.Matrix4().makeTranslation(...pivot.position).multiply(new THREE.Matrix4().makeRotationAxis(vector(pivot.axis).normalize(),rad(angle))).multiply(new THREE.Matrix4().makeTranslation(...pivot.position.map(v=>-v)));
}
export function pitchLimits(asset){return asset.pitch.limits??{min:-15,max:90};}
export function clampElevation(asset,value){const {min,max}=pitchLimits(asset);return Math.max(min,Math.min(max,value));}
export function partMatrices(asset,socket,instance){
  const mount=frame(socket.position,socket.rotation).multiply(frame(instance.offset||[0,0,0],instance.rotation||[0,0,0])).multiply(new THREE.Matrix4().makeRotationY(rad(instance.twist))).scale(new THREE.Vector3().setScalar(effectiveScale(asset,instance))).multiply(frame(asset.attachment.position,asset.attachment.rotation).invert());
  const yaw=pivotMatrix(asset.yaw,instance.yaw),pitch=pivotMatrix(asset.pitch,clampElevation(asset,instance.pitch)*(asset.pitch.elevationSign??(asset.native?-1:1)));
  return {base:mount,body:mount.clone().multiply(yaw),barrel:mount.clone().multiply(yaw).multiply(pitch)};
}
export function socketAtFace(position,normal,id){
  const up=vector(normal).normalize(),forward=new THREE.Vector3(0,0,1);
  if(Math.abs(up.dot(forward))>.95)forward.set(1,0,0);
  forward.addScaledVector(up,-forward.dot(up)).normalize();
  const right=up.clone().cross(forward).normalize(),matrix=new THREE.Matrix4().makeBasis(right,up,forward),euler=new THREE.Euler().setFromRotationMatrix(matrix,'XYZ');
  return {id,name:'Surface mount',position:[...position],rotation:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)};
}
export function plainBlocks(model){return model.blocks.map(({el,itemEl,...b})=>structuredClone(b));}
export function assetFromModel(model,id,sourceXml=''){
  const {min,max}=model.bounds,center=[(min.x+max.x)/2,(min.y+max.y)/2,(min.z+max.z)/2];
  return {id,name:model.fileName,sourceXml,sourceSize:null,muzzles:[],blocks:plainBlocks(model),parts:Object.fromEntries(model.blocks.map(b=>[b.id,'base'])),attachment:{position:[center[0],min.y,center[2]],rotation:[0,0,0]},yaw:{position:center.slice(),axis:[0,1,0]},pitch:{position:center.slice(),axis:[1,0,0],limits:{min:-15,max:90},elevationSign:1}};
}
export function importTurretXml(text,name,id){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror'))throw Error('Invalid turret XML.');
  const root=doc.documentElement;
  const sections=PARTS.map(part=>[...root.children].find(e=>e.tagName===part));
  if(sections.every(Boolean)){
    const numeric=(node,key)=>{const raw=node.getAttribute(key);if(raw===null||!raw.trim()||!Number.isFinite(Number(raw)))throw Error('Invalid '+node.tagName+' '+key);return Number(raw);};
    const offsets={},blocks=[],parts={};
    for(let n=0;n<PARTS.length;n++){
      const part=PARTS[n],section=sections[n],offset=['px','py','pz'].map(key=>numeric(section,key));offsets[part]=offset;
      if(!section.getElementsByTagName('block').length)continue;
      const parsed=parseAvorionXml('<ship>'+new XMLSerializer().serializeToString(section)+'</ship>',name,text.length);
      for(const block of plainBlocks(parsed)){
        const localId=block.id;block.id=part+':'+localId;if(block.parentId)block.parentId=part+':'+block.parentId;
        block.sourceLocalPosition={...block.position};
        for(let i=0;i<3;i++)block.position[['x','y','z'][i]]+=offset[i];
        parts[block.id]=part;blocks.push(block);
      }
    }
    if(!blocks.length)throw Error('Turret contains no blocks.');
    const size=numeric(root,'size');if(!isTurretSize(size))throw Error('Invalid source turret size.');
    const asset=assetFromModel(makeModel(blocks,name),id,text);asset.parts=parts;asset.sourceSize=size;
    asset.attachment.position=[0,0,0];asset.yaw.position=offsets.body.slice();asset.pitch.position=offsets.barrel.slice();
    asset.pitch.elevationSign=-1;
    asset.native={rootName:root.tagName,offsets,coaxial:root.getAttribute('coaxial'),shotColor:root.getAttribute('shot_color'),version:[...root.children].find(e=>e.tagName==='version')?.outerHTML||null};
    asset.muzzlePositions=[...root.children].filter(e=>e.tagName==='muzzlePosition').map(e=>['x','y','z'].map(key=>numeric(e,key)));
    return asset;
  }
  const designs=[...doc.getElementsByTagName('turretDesign')];
  if(designs.length>1)throw Error('This file contains multiple turret designs. Import one standalone design for this milestone.');
  // Parse an isolated design, so the ship parser does not intentionally skip it.
  const design=designs[0];
  const isolated=design?'<ship>'+[...design.children].map(el=>new XMLSerializer().serializeToString(el)).join('')+'</ship>':text;
  return assetFromModel(parseAvorionXml(isolated,name,text.length),id,text);
}
export function createInstance(assetId,socketId,id){return {id,name:'Mounted turret',assetId,socketId,scale:1,turretSize:null,twist:0,yaw:0,pitch:0,colors:{}};}
export function demoProject(){
  const model=makeModel([
    makeBlock({id:'b0',position:{x:0,y:.3,z:0},size:{x:2.6,y:.6,z:2.6},color:'ff626e80'}),
    makeBlock({id:'b1',position:{x:0,y:1.1,z:0},size:{x:2,y:1,z:1.8},color:'ffb6c5d9'}),
    makeBlock({id:'b2',position:{x:-.5,y:1.2,z:-2},size:{x:.35,y:.35,z:3.3},color:'ffdda454'}),
    makeBlock({id:'b3',position:{x:.5,y:1.2,z:-2},size:{x:.35,y:.35,z:3.3},color:'ffdda454'})
  ],'Twin-barrel test turret');
  const asset=assetFromModel(model,'asset-demo');asset.sourceSize=2.5;asset.attachment.position=[0,0,0];asset.yaw.position=[0,.6,0];asset.pitch.position=[0,1.2,0];asset.parts={b0:'base',b1:'body',b2:'barrel',b3:'barrel'};
  const sockets=[{id:'top',name:'Top',position:[-4,2,0],rotation:[0,0,0]},{id:'bottom',name:'Underside',position:[4,-2,0],rotation:[180,0,0]},{id:'side',name:'Side',position:[8,0,0],rotation:[0,0,-90]},{id:'angled',name:'Angled',position:[4,2,0],rotation:[0,0,-35]}];
  return {format:'avorion-turret-lab',version:2,assets:[asset],sockets,instances:sockets.map((s,i)=>({...createInstance(asset.id,s.id,'copy-'+i),name:s.name+' turret',turretSize:asset.sourceSize})),ship:{name:'Mount test hull',blocks:[makeBlock({size:{x:16,y:4,z:6},position:{x:0,y:0,z:0},color:'ff344452'})]}};
}
export function validateProject(p){
  const fail=message=>{throw Error(message);},finite=(v,n=3)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite),name=v=>typeof v==='string'&&v.length>0&&v.length<=200;
  if(p?.format!=='avorion-turret-lab'||p.version!==2)fail('Unsupported Turret Lab project.');
  for(const key of ['assets','sockets','instances'])if(!Array.isArray(p[key])||p[key].length>500)fail('Invalid '+key+' list (maximum 500).');
  for(const key of ['assets','sockets','instances']){const ids=new Set();for(const o of p[key]){if(!name(o.id)||!name(o.name)||ids.has(o.id))fail('Missing or duplicate '+key+' identity.');ids.add(o.id);}}
  let total=0;
  function blocks(list){
    if(!Array.isArray(list)||!list.length)fail('Missing model blocks.');total+=list.length;if(total>100000)fail('Lab limit: 100,000 source blocks.');
    const ids=new Set();for(const b of list){if(!name(b.id)||ids.has(b.id)||!b.position||!b.size||!['x','y','z'].every(k=>Number.isFinite(b.position[k])&&Number.isFinite(b.size[k])&&b.size[k]>=0)||!Number.isInteger(b.typeIndex)||![b.look,b.up].every(v=>Number.isInteger(v)&&v>=0&&v<=5)||!/^([0-9a-f]{8})$/i.test(b.color))fail('Invalid model block.');ids.add(b.id);}
  }
  for(const a of p.assets){blocks(a.blocks);
    const limits=pitchLimits(a);
    if(!Number.isFinite(limits.min)||!Number.isFinite(limits.max)||limits.min< -90||limits.min>0||limits.max<0||limits.max>90)fail('Pitch limits must contain neutral and stay within -90 to +90 degrees.');
    if(a.pitch.elevationSign!==undefined&&![1,-1].includes(a.pitch.elevationSign))fail('Invalid elevation direction.');if(a.muzzlePositions!==undefined&&(!a.native||!Array.isArray(a.muzzlePositions)||a.muzzlePositions.some(v=>!finite(v))))fail('Invalid muzzle positions.');if(a.native&&(!a.native.offsets||PARTS.some(part=>!finite(a.native.offsets[part]))))fail('Invalid native component offsets.');if(a.sourceSize!==null&&!isTurretSize(a.sourceSize))fail('Source turret size must be 0.5–10 in steps of 0.5.');if(!Array.isArray(a.muzzles)||new Set(a.muzzles).size!==a.muzzles.length||a.muzzles.some(id=>!a.blocks.some(b=>b.id===id)||a.parts?.[id]!=='barrel'))fail('Muzzles must be unique barrel block IDs.');if(!finite(a.attachment?.position)||!finite(a.attachment?.rotation))fail('Invalid attachment frame.');for(const key of ['yaw','pitch'])if(!finite(a[key]?.position)||!finite(a[key]?.axis)||vector(a[key].axis).length()<1e-8)fail('Pivot axes must have nonzero length.');if(!a.parts||a.blocks.some(b=>!PARTS.includes(a.parts[b.id])))fail('Assign every block to base, body or barrel.');}
  for(const s of p.sockets)if(!finite(s.position)||!finite(s.rotation))fail('Invalid socket frame.');
  const occupied=new Set();for(const i of p.instances){if(!p.assets.some(a=>a.id===i.assetId)||!p.sockets.some(s=>s.id===i.socketId))fail('Unresolved turret or socket reference.');if(i.turretSize!==null&&(!isTurretSize(i.turretSize)||!p.assets.find(a=>a.id===i.assetId).sourceSize))fail('Select a source size before setting turret size (0.5–10 in steps of 0.5).');if(occupied.has(i.socketId))fail('A socket already has a turret.');occupied.add(i.socketId);if(!Number.isFinite(i.scale)||i.scale<.01||i.scale>100||![i.twist,i.yaw,i.pitch].every(Number.isFinite))fail('Scale must be 1–10,000%; angles must be finite.');if(!i.colors||Object.entries(i.colors).some(([part,color])=>!PARTS.includes(part)||!/^#[0-9a-f]{6}$/i.test(color)))fail('Invalid part color.');}
  if(p.ship)blocks(p.ship.blocks);
  return p;
}
export function readProject(text){return upgradeProject(JSON.parse(text));}
export function writeProject(project){validateProject(project);return JSON.stringify(project,null,2);}

// Size envelopes supplied by the user at turret size 0.5; larger envelopes
// are proportional. They describe component extents, not unknown game origins.
export const isTurretSize=value=>Number.isFinite(value)&&value>=.5&&value<=10&&Number.isInteger(value*2);
export function effectiveScale(asset,instance){return instance.scale*(asset.sourceSize&&instance.turretSize?instance.turretSize/asset.sourceSize:1);}
export function componentEnvelope(part,size){if(!PARTS.includes(part)||!isTurretSize(size))throw Error('Invalid component or turret size.');return (part==='base'?[.5,.5,.5]:part==='body'?[.75,.75,.75]:[.75,.75,2.25]).map(v=>v*size/.5);}
export function componentBounds(asset,part){const blocks=asset.blocks.filter(b=>asset.parts[b.id]===part);if(!blocks.length)return null;return makeModel(blocks).bounds;}
export function upgradeProject(input){
  const p=structuredClone(input);
  if(p?.format==='avorion-turret-lab'&&p.version===1){
    for(const a of p.assets||[]){for(const id of Object.keys(a.parts||{}))if(a.parts[id]==='head')a.parts[id]='body';a.sourceSize=null;a.muzzles=[];}
    for(const i of p.instances||[]){if(i.colors?.head!==undefined){i.colors.body=i.colors.head;delete i.colors.head;}i.turretSize=null;}
    p.version=2;
  }
  // Older native projects stored raw X rotation rather than upward elevation.
  if(p?.format==='avorion-turret-lab'&&p.version===2){
    validateProject(p);
    for(const a of p.assets){
      const legacyNative=a.native&&a.pitch.elevationSign===undefined;
      a.pitch.elevationSign??=a.native?-1:1;
      a.pitch.limits??={min:-15,max:90};
      for(const i of p.instances.filter(i=>i.assetId===a.id))i.pitch=clampElevation(a,legacyNative?-i.pitch:i.pitch);
    }
  }
  return validateProject(p);
}

