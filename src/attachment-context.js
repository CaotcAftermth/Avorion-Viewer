import {componentSockets} from './components/core.js';
import {sceneSockets} from './turrets/sockets.js';
const snapshots=new WeakMap();
export function setAttachmentContext(scene,context){
 scene.attachmentContext=context;
 if(context?.type==='turret'){scene.selectedComponentMountId=null;scene.selectedComponentMountIds=new Set();scene.selectedComponentSocketId=null;}
 if(context?.type==='component'){scene.selectedTurretId=null;scene.selectedTurretIds=new Set();if(scene.turretSockets)scene.turretSockets.selectedId=null;}
 return context;
}
export function syncAttachmentContext(scene,library={}){
 const values={model:scene.model,turret:scene.selectedTurretId,component:scene.selectedComponentMountId,turretSocket:scene.turretSockets?.selectedId,componentSocket:scene.selectedComponentSocketId,turretAsset:library.turretAssetId,componentAsset:library.componentAssetId};
 const prior=snapshots.get(scene)||{};
 let context=scene.attachmentContext;
 if(prior.model!==values.model)context=null;
 for(const [key,type,kind] of [['turretAsset','turret','library'],['componentAsset','component','library'],['turretSocket','turret','socket'],['componentSocket','component','socket'],['turret','turret','instance'],['component','component','instance']])if(values[key]&&values[key]!==prior[key])context={type,kind,id:values[key]};
 if(context?.kind==='instance'){const selection=context.type==='turret'?scene.selectedTurretIds:scene.selectedComponentMountIds;const primary=context.type==='turret'?values.turret:values.component;if(!primary)context=null;else context={...context,ids:[...(selection?.size?selection:new Set([context.id]))]};}
 if(context)setAttachmentContext(scene,context);else scene.attachmentContext=null;
 snapshots.set(scene,{...values,turret:scene.selectedTurretId,component:scene.selectedComponentMountId,turretSocket:scene.turretSockets?.selectedId,componentSocket:scene.selectedComponentSocketId});
 return context;
}
export function resolveAttachmentContext(scene,context,libraries={}){
 if(!context)return null;
 const {type,kind,id}=context;
 const list=kind==='instance'?(type==='turret'?scene.model?.turretMounts:scene.model?.componentSetup?.mounts):kind==='socket'?(type==='turret'?sceneSockets(scene):componentSockets(scene)):libraries[type]?.assets;
 return list?.find(item=>item.id===id)||null;
}
export function routeAttachmentInspector(nodes,context,preferredId){
 if(!context)return null;
 const eligible=nodes.filter(node=>node.editor==='properties'&&!node.attachmentPin&&!node.propertySearch);
 const target=eligible.find(node=>node.id===preferredId)||eligible[0];
 if(target)target.propertyTab=context.type==='turret'?'turrets':'components';
 return target;
}
export function inspectorScene(scene,context){
 if(!context)return scene;
 const mount=context.kind==='instance'?resolveAttachmentContext(scene,context):null;
 const selection={selectedTurretId:context.type==='turret'&&mount?context.id:null,selectedTurretIds:new Set(context.type==='turret'&&mount?context.ids||[context.id]:[]),selectedComponentMountId:context.type==='component'&&mount?context.id:null,selectedComponentMountIds:new Set(context.type==='component'&&mount?context.ids||[context.id]:[]),selectedComponentSocketId:context.type==='component'?(mount?.socketId||(context.kind==='socket'?context.id:null)):null,turretSockets:{...scene.turretSockets,selectedId:context.type==='turret'?(mount?.socketId||(context.kind==='socket'?context.id:null)):null},attachmentContext:context};
 return new Proxy(scene,{get:(target,key)=>Object.hasOwn(selection,key)?selection[key]:target[key],set:(target,key,value)=>{if(Object.hasOwn(selection,key))selection[key]=value;else target[key]=value;return true;}});
}
