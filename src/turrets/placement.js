import {placeTurret,initialTurretSize} from './mounts.js';
export function placeFromLibrary(scene,asset,socket,changed){
  scene.turretPreview=null;scene.turretPlacementError=null;
  try{
    if(!asset.sourceSize)throw Error('This asset has no authored size. Import a native turret XML with size metadata before fitting it to a base.');
    const size=initialTurretSize(asset,socket);
    if(!size)throw Error('This socket is too small for the minimum turret size of 0.5.');
    placeTurret(scene,asset,socket,size);
  }catch(error){scene.turretPlacementError=error.message;}
  changed();
}
