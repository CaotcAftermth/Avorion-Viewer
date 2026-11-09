import {socketFaces,socketNormalChoices,orientSocket} from './socket-face.js';
import {componentSetup,savedSocket} from './core.js';
export const SOCKET_BATCH_LIMIT=100;
// Reuse the selected geometric face, not a world direction, across rotated blocks.
export function planSocketBatch(model,typeIndex,sourceFace,normal){
 const setup=componentSetup(model),sockets=[],choice=socketNormalChoices(sourceFace).findIndex(c=>c.normal.every((n,i)=>Math.abs(n-normal[i])<1e-6));
 if(choice<0)throw Error('Choose a valid outward direction.');
 let matched=0,duplicates=0;
 for(const block of model.blocks){
  if(block.deleted||block.typeIndex!==typeIndex)continue;matched++;
  const face=socketFaces(block).find(f=>f.faceId===sourceFace.faceId);if(!face)continue;
  if(setup.sockets.some(s=>s.blockId===block.id&&(s.faceId===face.faceId||s.position.every((n,i)=>Math.abs(n+block.position['xyz'[i]]-face.position[i])<1e-6)))){duplicates++;continue;}
  const direction=socketNormalChoices(face)[choice];if(!direction)throw Error('Matching faces have incompatible directions.');
  const socket=savedSocket(model,orientSocket(face,direction.normal),'Socket '+(setup.sockets.length+sockets.length+1));socket.faceId=face.faceId;
  sockets.push(socket);
  if(sockets.length>SOCKET_BATCH_LIMIT)throw Error(`More than ${SOCKET_BATCH_LIMIT} sockets would be created. Choose a less common block type.`);
  if(setup.sockets.length+sockets.length>1000)throw Error('This setup would exceed the 1,000 socket limit.');
 }
 return {sockets,matched,duplicates};
}
