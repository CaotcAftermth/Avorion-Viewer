export const sourceRevision=asset=>Number.isInteger(asset?.revision)&&asset.revision>0?asset.revision:1;
export const assetProvenance=asset=>({assetId:asset.id,revision:sourceRevision(asset)});
export const revisedAsset=(next,previous)=>({...next,revision:previous?sourceRevision(previous)+1:sourceRevision(next)});
export function libraryUpdateSummary(mount,asset,kind){
 const warnings=[];
 if(kind==='turret'){
  const limits=asset.pitch?.limits||{min:-15,max:90};
  if(mount.pitch<limits.min||mount.pitch>limits.max)warnings.push('Current elevation exceeds the new asset limits. Adjust elevation before updating.');
  if(!Number.isFinite(asset.sourceSize)||asset.sourceSize<=0)warnings.push('The library asset needs a valid source size.');
 }
 return {before:mount.asset.blocks.length,after:asset.blocks.length,from:mount.source?.revision||sourceRevision(mount.asset),to:sourceRevision(asset),warnings};
}
export function updatedMount(mount,asset,kind){
 const summary=libraryUpdateSummary(mount,asset,kind);if(summary.warnings.length)throw Error(summary.warnings.join(' '));
 return {...mount,assetId:asset.id,asset:structuredClone(asset),source:assetProvenance(asset)};
}
