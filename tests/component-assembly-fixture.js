import {makeBlock,makeModel} from '../src/block-model.js';
import {socketAtFace} from '../src/turrets/core.js';
import {socketFaces} from '../src/components/socket-face.js';
import {emptySetup,savedSocket,componentSockets} from '../src/components/core.js';
import {assignComponent} from '../src/components/mounting.js';
export function assemblyAsset(id='child',typeIndex=2,size={x:1,y:1,z:1}){
 const block=makeBlock({id:'part',typeIndex,position:{x:0,y:0,z:0},size}),primary={...socketAtFace([0,-size.y/2,0],[0,-1,0],'primary'),name:'Primary',blockId:'part'},extra={...socketAtFace([size.x/2,0,0],[1,0,0],'right'),name:'Right',blockId:'part'};
 return {id,name:id,blocks:[block],attachment:{position:[0,-size.y/2,0],rotation:[0,0,0]},attachmentSocketId:'primary',sockets:[primary,extra]};
}
export function assemblyFixture(){
 const block=makeBlock({id:'hull',position:{x:0,y:-1,z:0},size:{x:6,y:2,z:6}}),model=makeModel([block],'Assembly test'),face=socketFaces(block).find(f=>f.normal[1]>.99),root=savedSocket(model,face,'Ship top');root.id='ship-top';model.componentSetup={...emptySetup(),sockets:[root]};
 const scene={loaded:true,visible:true,model,selectedIds:new Set(),hiddenIds:new Set(),revision:1},parent=assemblyAsset('parent',20,{x:4,y:1,z:4});model.componentSetup=assignComponent(scene,parent,componentSockets(scene)[0]);model.componentSetup.mounts[0].id='parent';return scene;
}
