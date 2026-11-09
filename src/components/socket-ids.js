const encode=encodeURIComponent;
const decode=value=>{try{return decodeURIComponent(value);}catch{return null;}};
export const mountedComponentSocketId=(mountId,socketId)=>`mounted-component:${encode(mountId)}:${encode(socketId)}`;
export const mountedTurretSocketId=(mountId,blockId,faceId)=>`mounted-turret:${encode(mountId)}:${encode(blockId)}:${faceId}`;
export const mountedBlockId=(mountId,blockId)=>`component:${mountId}:${blockId}`;
export function mountedSocketReference(id){
 const parts=String(id).split(':');if(parts[0]==='mounted-component'&&parts.length===3)return {kind:'component',mountId:decode(parts[1]),socketId:decode(parts[2])};
 if(parts[0]==='mounted-turret'&&parts.length===4)return {kind:'turret',mountId:decode(parts[1]),blockId:decode(parts[2]),faceId:Number(parts[3])};return null;
}
export function componentBranchIds(mounts,initial){const ids=new Set(initial);let changed=true;while(changed){changed=false;for(const mount of mounts)if(ids.has(mountedSocketReference(mount.socketId)?.mountId)&&!ids.has(mount.id)){ids.add(mount.id);changed=true;}}return ids;}
