import {access,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {APP_VERSION} from '../src/version.js';
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function exists(path){try{await access(path);return true;}catch{return false;}}
function run(command,args){return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',shell:false});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`Documentation build failed (${code}). Install docs/site/requirements.txt in .venv-docs first.`)));});}
export async function buildDocs(destination='dist/docs'){
 const output=resolve(destination);if(!['dist/docs','docs/site/public'].some(p=>resolve(p)===output))throw Error('Unexpected documentation destination');
 const stage=resolve('docs/site/.sphinx-source');
 await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
 const tree=JSON.parse(await readFile('docs/site/manual.json','utf8'));
 const pages=[];function visit(node){if(!/^[a-z0-9-]+$/.test(node.id)||pages.some(p=>p.id===node.id))throw Error('Invalid/duplicate manual page');pages.push(node);for(const child of node.children||[])visit(child);}for(const node of tree)visit(node);
 const toctree=nodes=>'\n```{toctree}\n:maxdepth: 2\n\n'+nodes.map(p=>`${p.title} <${p.id}>`).join('\n')+'\n```\n';
 for(const page of pages){
  let text=await readFile(`docs/site/content/${page.id}.md`,'utf8');
  text=text.replace(/^# .+$/m,'# '+page.title);
  text=text.replace(/\]\(\.\.\/assets\/([^)]+)\)/g,'](assets/$1)');
  text=text.replace(/\[([^\]]+)\]\(\.\.\/([a-z0-9-]+)\/(#[^)]+)?\)/g,(m,label,id,anchor='')=>pages.some(p=>p.id===id)?`[${label}](${id}.md${anchor})`:m);
  text=text.replace(/\[([^\]]+)\]\(\.\.\/examples\/([^)]+)\)/g,(_,label,file)=>'{download}'+String.fromCharCode(96)+label+' <examples/'+file+'>'+String.fromCharCode(96));
  text=text.replace(/!\[([^\]]+)\]\((assets\/[^)]+)\)/g,(_,caption,url)=>{
   const focus=page.id==='topbar'&&url.endsWith('ui-topbar-condensed.svg')?'topbar-menus':page.id==='workspaces'&&url.endsWith('ui-topbar-condensed.svg')?'workspace-tabs':page.id==='status-bar'&&url.endsWith('ui-statusbar-condensed.svg')?'status-bar':page.id==='editor-viewport'&&url.endsWith('viewport-header-condensed.svg')?'viewport-mode':null;
   return ':::{figure} '+url+'\n:alt: '+caption+'\n:target: ../'+url+((url.endsWith('-condensed.svg')||(page.id==='editor-info'&&url.endsWith('editor-info.png')))?'\n:class: manual-bar-image'+(focus?' focus-'+focus:''):(focus?'\n:class: focus-'+focus:''))+'\n\n'+caption+'\n:::\n';
  });
  // Downloads stay at a stable URL, while Sphinx handles and fingerprints instructional figures.
  if(page.children?.length)text+='\n## In this section\n'+toctree(page.children);
  await writeFile(join(stage,`${page.id}.md`),text);
 }
 const root='# Avorion Viewer Manual\n\nThe reference manual for Avorion Viewer: its interface, editors, projects, and output tools. Start with the [Introduction](introduction.md), or use the sections below.\n\n```{figure} assets/workspace.png\n:alt: Avorion Viewer with the tutorial ship, viewport, Outliner, Properties and Info areas.\n:width: 760px\n\nAvorion Viewer’s interface. Editor areas can be rearranged for the task at hand.\n```\n\n```{toctree}\n:maxdepth: 1\n\nIntroduction <introduction>\n```\n\n```{toctree}\n:caption: Sections\n:maxdepth: 2\n\n'+tree.filter(p=>p.id!=='introduction').map(p=>`${p.title} <${p.id}>`).join('\n')+'\n```\n';
 await writeFile(join(stage,'index.md'),root);
 await cp('docs/site/examples',join(stage,'examples'),{recursive:true});
 await cp('docs/site/conf.py',join(stage,'conf.py'));await cp('docs/site/static',join(stage,'_static'),{recursive:true});await cp('docs/site/assets',join(stage,'assets'),{recursive:true});
 await mkdir(join(stage,'_static/app-window'),{recursive:true});
 for(const file of ['layout.js','workspace-tree.js','keymaps.js'])await cp('src/'+file,join(stage,'_static/app-window',file));
 await writeFile(join(stage,'release.txt'),APP_VERSION);
 const local=resolve('.venv-docs',process.platform==='win32'?'Scripts/python.exe':'bin/python');const python=process.env.DOCS_PYTHON||(await exists(local)?local:(process.platform==='win32'?'python':'python3'));
 await rm(output,{recursive:true,force:true});
 await run(python,['-m','sphinx','-b','dirhtml','-W','--keep-going','-q',stage,output]);
 await cp('docs/site/examples',join(output,'examples'),{recursive:true});await cp('docs/site/assets',join(output,'assets'),{recursive:true});
 const redirects=JSON.parse(await readFile('docs/site/redirects.json','utf8'));
 for(const [old,target]of Object.entries(redirects)){
  if(pages.some(p=>p.id===old))continue;const [id,anchor]=target.split('#');if(!pages.some(p=>p.id===id))throw Error(`Invalid redirect ${old}: ${target}`);
  const href='../'+id+'/'+(anchor?'#'+anchor:'');await mkdir(join(output,old),{recursive:true});await writeFile(join(output,old,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(href)}"><title>Moved · Manual</title></head><body><a href="${esc(href)}">Continue to the updated guide</a></body></html>`);
 }
 await writeFile(join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['',...pages.map(p=>p.id+'/')].map(p=>`<url><loc>https://avorion-viewer.com/docs/${p}</loc></url>`).join('')}</urlset>`);
 console.log(`Built ${pages.length+1} manual pages with Sphinx + Furo in ${destination}`);return pages;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await buildDocs(process.argv.includes('--dev')?'docs/site/public':'dist/docs');
