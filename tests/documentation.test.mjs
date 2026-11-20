import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {buildDocs} from '../scripts/build-docs.mjs';
test('Furo manual builds a nested hierarchy, figures, downloads and preserved URLs',async()=>{
 const pages=await buildDocs('docs/site/public');const root=resolve('docs/site/public');
 const get=id=>readFile(resolve(root,id,'index.html'),'utf8');
 const home=await get('');assert.match(home,/Sphinx 8\.2\.3 and Furo/);assert.match(home,/sidebar-tree/);
 for(const title of ['User Interface','Editors','Model Project','Workspace Profile','Export','Textures'])assert.ok(home.includes(title));
 const tree=JSON.parse(await readFile('docs/site/manual.json','utf8'));const ui=tree.find(n=>n.id==='user-interface');
 for(const id of ['window-system','splash-screen','topbar','workspaces','status-bar','areas','ui-regions','tabs-panels'])assert.ok(ui.children.some(p=>p.id===id));
 const editors=tree.find(n=>n.id==='editors');assert.equal(editors.children.length,7);
 for(const page of [{id:''},...pages]){
  const path=resolve(root,page.id,'index.html'),html=await readFile(path,'utf8');
  assert.match(html,/<h1[^>]*>/);
  for(const [,raw]of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)){
   if(/^(https?:|mailto:|data:|#)/.test(raw))continue;
   const value=raw.split('?')[0];const destination=resolve(dirname(path),decodeURIComponent(value));
   if(!destination.startsWith(root))continue;
   if(value.endsWith('/'))await access(resolve(destination,'index.html'));else await access(destination);
  }
 }
 const window=await get('window-system');assert.match(window,/window-demo.html/);await access(resolve(root,'_static/app-window/workspace-tree.js'));assert.equal(await readFile(resolve(root,'_static/app-window/workspace-tree.js'),'utf8'),await readFile('src/workspace-tree.js','utf8'));assert.equal(await readFile(resolve(root,'_static/app-window/layout.js'),'utf8'),await readFile('src/layout.js','utf8'));await access(resolve(root,'_static/image-viewer.js'));
 const areas=await get('areas');assert.match(areas,/data-animation/);assert.match(areas,/resize-areas\.gif/);assert.ok(areas.includes('Ctrl+Shift+Space'));
 const redirects=JSON.parse(await readFile('docs/site/redirects.json','utf8'));for(const [old,target]of Object.entries(redirects)){if(pages.some(p=>p.id===old))continue;assert.ok(pages.some(p=>p.id===target.split('#')[0]));assert.match(await get(old),/Continue to the updated guide/);}
 await access(resolve(root,'examples/tutorial-ship.xml'));await access(resolve(root,'searchindex.js'));
});
