import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import http from 'node:http';
import {viewerHandler} from './serve.mjs';
await mkdir('docs/site/assets/controls',{recursive:true});
const manifest={density:3,fixture:process.env.DOCS_EXAMPLE_XML||'docs/site/examples/tutorial-ship.xml',temporaryFixture:!process.env.DOCS_EXAMPLE_XML,entries:[]},annotations={};
const handler=viewerHandler('.');const server=http.createServer((req,res)=>{if(req.headers.origin===`http://127.0.0.1:${server.address().port}`)req.headers.origin='http://127.0.0.1:5173';req.headers.host='127.0.0.1:5173';handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75);let count=0;
if(process.argv.includes('--finish')){Object.assign(manifest,JSON.parse(await readFile('docs/site/assets/control-captures.json','utf8')));Object.assign(annotations,JSON.parse(await readFile('docs/site/static/image-annotations.json','utf8')));count=Math.max(0,...manifest.entries.map(e=>Number(e.id?.match(/-(\d+)$/)?.[1]||0)));}
try{
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:3});await page.addInitScript(()=>localStorage.setItem('avorion-viewer.input-style-chosen.v1','1'));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#main-menu button').first().waitFor();await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('menuitem',{name:'Welcome',exact:true}).click();await page.locator('#welcome-dialog').screenshot({path:'docs/site/assets/ui-welcome.png'});await page.locator('#welcome-dialog .icon-button').first().click();
await page.evaluate(xml=>{const dt=new DataTransfer();dt.items.add(new File([xml],'Documentation example.xml',{type:'text/xml'}));for(const type of ['dragenter','dragover','drop'])document.querySelector('#screen').dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt}));},await readFile(manifest.fixture,'utf8'));
await page.waitForFunction(()=>document.querySelector('.ship-name')?.textContent.includes('Documentation example'));await page.waitForTimeout(250);
const shot=async(selector,file)=>{const locator=page.locator(selector).first();await locator.screenshot({path:'docs/site/assets/'+file});return locator.boundingBox();};
await page.screenshot({path:'docs/site/assets/workspace.png'});
await shot('#topbar','ui-topbar.png');await shot('#statusbar','ui-statusbar.png');await shot('.area[data-editor=viewport] .area-header','viewport-header.png');
for(const [editor,file]of [['outliner','editor-outliner.png'],['properties','editor-properties.png'],['info','editor-info.png']])await shot(`.area[data-editor=${editor}]`,file);
async function annotation(key,containerSelector,targetSelector,label){const container=page.locator(containerSelector).first(),target=page.locator(targetSelector).first();if(!await target.count())return;const c=await container.boundingBox(),t=await target.boundingBox();if(c&&t)annotations[key]={label,rect:[(t.x-c.x)/c.width,(t.y-c.y)/c.height,t.width/c.width,t.height/c.height]};}
await annotation('topbar-menus','#topbar','#main-menu','Application menus');await annotation('workspace-tabs','#topbar','#workspaces','Workspace tabs');await annotation('status-bar','#statusbar','#statusbar','Entire status bar');await annotation('viewport-mode','.area[data-editor=viewport] .area-header','.area[data-editor=viewport] [aria-label="Interaction mode"]','Interaction mode');await annotation('editor-selector','.area[data-editor=viewport] .area-header','.area[data-editor=viewport] .editor-switch','Editor selector');
async function crop(locator,label,section,kind='control'){
 if(!await locator.count())return;await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();if(!box||box.width<1||box.height<1)return;
 const viewport=page.viewportSize();const x=Math.max(0,box.x),y=Math.max(0,box.y),width=Math.min(viewport.width,box.x+box.width)-x,height=Math.min(viewport.height,box.y+box.height)-y;if(width<1||height<1)return;
 const id=slug(section+'-'+label)+'-'+(++count),file='controls/'+id+'.png';
 // A screenshot-only outline identifies the discussed control without changing layout or pixels afterward.
 const mark=await page.evaluateHandle(b=>{const e=document.createElement('div');e.dataset.documentationHighlight='';Object.assign(e.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483647',border:'2px solid #ffca69',boxShadow:'0 0 0 2px #12181ccc',left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px'});document.body.append(e);return e;},box);
 await page.screenshot({path:'docs/site/assets/'+file,clip:{x,y,width,height}});await mark.evaluate(e=>e.remove());
 manifest.entries.push({id,label,section,kind,file,cssWidth:width,cssHeight:height,pixelWidth:Math.round(width*3),pixelHeight:Math.round(height*3),status:box.y>=0&&box.y+box.height<=viewport.height?'captured':'visible-portion'});
}
async function controls(selector,section){const nodes=page.locator(selector);const length=await nodes.count();for(let i=0;i<length;i++){const node=nodes.nth(i);if(!await node.isVisible())continue;const label=await node.getAttribute('aria-label')||await node.getAttribute('title')||await node.innerText();if(label.trim()&&!/^Model #/.test(label))await crop(node,label.trim(),section);}}
if(!process.argv.includes('--finish')){
await controls('.area[data-editor=viewport] .viewport-toolbar button','editor-viewport');
await controls('#main-menu button','topbar');
await controls('.area[data-editor=viewport] .area-header button','viewport-header');
await page.getByLabel('Interaction mode',{exact:true}).first().selectOption('paint');await page.waitForTimeout(150);await page.screenshot({path:'docs/site/assets/paint-workspace.png'});
await controls('.area[data-editor=viewport] .viewport-toolbar button','painting');
await controls('.paint-tool-settings button','painting');
await page.getByLabel('Interaction mode',{exact:true}).first().selectOption('object');
await page.setViewportSize({width:1440,height:1600});
const propertyArea=page.locator('.area[data-editor=properties]').first();
const tabs=await propertyArea.locator('.property-tabs button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')||n.title||n.textContent));
for(const [tabIndex,tab] of tabs.entries()){const button=propertyArea.locator('.property-tabs button').nth(tabIndex);if(await button.isDisabled()){await crop(button,tab+' (disabled until an attachment is selected)','property-symbols','symbol');continue;}await button.click();await crop(button,tab,'property-symbols','symbol');
 console.log('Capturing property tab:',tab);
 const section=/World|Shaders/i.test(tab)?'world':/Turrets|Components/i.test(tab)?'turrets':/Coverage/i.test(tab)?'coverage':/Workspace/i.test(tab)?'workspaces':'editor-properties';
 const panels=propertyArea.locator('.property-content details.panel');const length=await panels.count();
 for(let i=0;i<length;i++){const panel=panels.nth(i);if(!await panel.count())continue;const label=await panel.locator('summary').first().innerText();try{await panel.evaluate(e=>{for(const other of e.closest('.property-content').querySelectorAll('details.panel'))if(other!==e&&!other.contains(e))other.open=false;e.open=true;});await crop(panel,tab+' · '+label,section,'panel');}catch(error){manifest.entries.push({label:tab+' · '+label,section,kind:'panel',status:'needs-fixture-review',reason:error.message.split('\n')[0]});}}
}
}
await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Window',exact:true}).click();await page.getByRole('menuitem',{name:'Open Color Workshop',exact:true}).click();await shot('.area[data-editor=color]','editor-color.png');await controls('.area[data-editor=color] .area-header button, .area[data-editor=color] [role=tab]','colors');
const color=page.locator('.area[data-editor=color]').first();await color.locator('.editor-switch').click();await page.getByRole('menuitem',{name:'Asset Library',exact:true}).click();await shot('.area[data-editor=assets]','editor-assets.png');await controls('.area[data-editor=assets] .area-header button','assets');
manifest.capturePassCompleted=true;await writeFile('docs/site/assets/control-captures.json',JSON.stringify(manifest,null,2)+'\n');await writeFile('docs/site/static/image-annotations.json',JSON.stringify(annotations,null,2)+'\n');console.log(`Captured ${manifest.entries.length} controls, property symbols and sections at 3× density.`);
}finally{await writeFile('docs/site/assets/control-captures.json',JSON.stringify(manifest,null,2)+'\n');await writeFile('docs/site/static/image-annotations.json',JSON.stringify(annotations,null,2)+'\n');await browser.close();await new Promise(r=>server.close(r));}
