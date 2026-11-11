import {addComponentAsset, loadComponentLibrary} from '../components/library.js';
import {addTurretAsset, loadTurretLibrary} from '../turrets/library.js';
import {restoreEmbeddedTurrets} from '../turrets/embedded.js';
import {sourceRevision} from './lifecycle.js';

async function registerMounts(mounts,load,add){
  if(!mounts?.length)return;
  const assets=new Map((await load()).map(asset=>[asset.id,asset]));
  const resolved=new Map();
  for(const mount of mounts){
    const id=mount.source?.assetId||mount.assetId||mount.asset.id;
    let saved=resolved.get(id)||assets.get(id);
    if(!saved){
      saved=await add({...structuredClone(mount.asset),id});
      assets.set(saved.id,saved);
    }
    resolved.set(id,saved);
    // Keep the project's mounted copy and revision. Only its library link may change.
    mount.assetId=saved.id;
    mount.source={assetId:saved.id,revision:mount.source?.revision??sourceRevision(mount.asset)};
  }
}

export async function registerProjectAssets(model){
  const results=await Promise.allSettled([
    registerMounts(model.turretMounts,loadTurretLibrary,addTurretAsset),
    registerMounts(model.componentSetup?.mounts,loadComponentLibrary,asset=>addComponentAsset(asset,{force:!asset.sourceXml})),
  ]);
  const failures=results.flatMap(result=>result.status==='rejected'?[result.reason]:[]);
  // A detached native turret still belongs in the library, but opening the
  // project must never mount it again.
  await restoreEmbeddedTurrets(model,{load:loadTurretLibrary,add:addTurretAsset},{attach:false});
  return failures;
}
