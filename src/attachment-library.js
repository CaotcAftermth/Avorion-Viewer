import {mountTurretLibrary} from './turrets/library.js';
import {mountComponentLibrary} from './components/library.js';
export function mountAttachmentLibrary(host,node,scene,changed){
 const tabs=document.createElement('div'),content=document.createElement('div');tabs.className='dialog-actions';host.append(tabs,content);let controller;
 function show(kind){controller?.dispose();content.replaceChildren();node.assetKind=kind;for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.kind===kind));controller=kind==='components'?mountComponentLibrary(content,scene,changed):mountTurretLibrary(content,changed);}
 for(const [kind,label] of [['turrets','Turrets'],['components','Components']]){const button=document.createElement('button');button.textContent=label;button.dataset.kind=kind;button.onclick=()=>show(kind);tabs.append(button);}
 show(node.assetKind||'turrets');return {sync:()=>controller?.sync?.(),dispose:()=>controller?.dispose()};
}
