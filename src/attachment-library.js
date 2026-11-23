import {mountTurretLibrary} from './turrets/library.js';
import {mountComponentLibrary} from './components/library.js';
export const ASSET_KINDS=[['turrets','Turrets'],['components','Components']];
// The Turrets / Components switch lives in the Asset Library header (see app.js);
// the body shows one asset grid at a time.
export function mountAttachmentLibrary(host,node,scene,changed){
 let controller;
 function show(kind){controller?.dispose();host.replaceChildren();host.classList.remove('turret-library');node.assetKind=kind;controller=kind==='components'?mountComponentLibrary(host,changed,{externalSearch:true}):mountTurretLibrary(host,changed);controller.search(node.assetQuery||'');}
 show(node.assetKind==='components'?'components':'turrets');
 return {assetAreaId:node.id,show,search(query){node.assetQuery=query;controller.search(query);},sync:()=>controller?.sync?.(),dispose:()=>controller?.dispose()};
}

export function assetSearch(value,change){
 const input=document.createElement('input');input.type='search';input.className='asset-library-search';input.placeholder='Search assets';input.setAttribute('aria-label','Search assets');input.value=value||'';input.oninput=()=>change(input.value);return input;
}
