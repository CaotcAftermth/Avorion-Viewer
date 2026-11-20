import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const config=JSON.parse(await readFile('docs/site/static/image-annotations.json','utf8'));await mkdir('test-results/documentation',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{for(const density of [1,1.5,2]){const page=await browser.newPage({viewport:{width:1500,height:950},deviceScaleFactor:density});
 for(const [route,key]of [['topbar','topbar-menus'],['workspaces','workspace-tabs'],['status-bar','status-bar']]){
  await page.goto('http://127.0.0.1:5173/docs/'+route+'/');await page.locator('article .annotated-image .image-focus').first().waitFor();
  async function verify(selector){const data=await page.locator(selector).first().evaluate(async(container)=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const i=container.querySelector('img').getBoundingClientRect(),h=container.querySelector('.image-focus').getBoundingClientRect();return{image:{x:i.x,y:i.y,width:i.width,height:i.height},highlight:{x:h.x,y:h.y,width:h.width,height:h.height}};});const [x,y,w,h]=config[key].rect;for(const [actual,expected]of [[data.highlight.x,data.image.x+x*data.image.width],[data.highlight.y,data.image.y+y*data.image.height],[data.highlight.width,w*data.image.width],[data.highlight.height,h*data.image.height]])assert.ok(Math.abs(actual-expected)<1.5,JSON.stringify({route,density,data,actual,expected}));assert.ok(data.image.width*density<=1226.5);}
  await verify('article .annotated-image');await page.locator('article .annotated-image .image-open').click();await page.locator('.manual-image-viewer img').evaluate(e=>e.decode());await verify('.image-viewer-stage');
  const dimensions=await page.locator('.image-viewer-stage').evaluate(e=>({stage:e.getBoundingClientRect().width,image:e.querySelector('img').getBoundingClientRect().width}));assert.ok(Math.abs(dimensions.stage-dimensions.image)<1);
  if(density===1.5)await page.screenshot({path:`test-results/documentation/corrected-${route}-modal.png`});await page.keyboard.press('Escape');
 }await page.close();}console.log('Inline/modal bar highlights and image-stage bounds verified at 100%, 150% and 200% density.');}finally{await browser.close();}
