import {mountTurretLibrary} from './turrets/library.js';
import {mountComponentLibrary} from './components/library.js';
export const ASSET_KINDS=[['turrets','Turrets'],['components','Components']];
// The Turrets / Components switch lives in the Asset Library header (see app.js);
// the body shows one asset grid at a time.
export function mountAttachmentLibrary(host,node,scene,changed){
 let controller;
 function show(kind){controller?.dispose();host.replaceChildren();host.classList.remove('turret-library');node.assetKind=kind;controller=kind==='components'?mountComponentLibrary(host,changed):mountTurretLibrary(host,changed);}
 show(node.assetKind==='components'?'components':'turrets');
 return {assetAreaId:node.id,show,sync:()=>controller?.sync?.(),dispose:()=>controller?.dispose()};
}
