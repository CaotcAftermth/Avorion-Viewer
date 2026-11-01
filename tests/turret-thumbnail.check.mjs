import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 const xml=await readFile('C:/Users/joshu/.codex/attachments/0b550090-428b-47cc-b4c4-261c708a8d20/Pasted text.txt','utf8');
 const results=await page.evaluate(async xml=>{
  const {thumbnail}=await import('/src/turrets/thumbnail.js'),{importTurretXml}=await import('/src/turrets/core.js'),{makeBlock}=await import('/src/block-model.js');
  const native=importTurretXml(xml,'DX4','dx4'),out=[];const panel=document.createElement('div');panel.id='thumbnail-proof';panel.style.cssText='position:fixed;inset:0;background:#303030;z-index:99999;display:flex;align-items:center;flex-wrap:wrap;gap:10px';document.body.append(panel);
  for(const asset of [{name:'Cube',blocks:[makeBlock()]},{name:'Angled edge',blocks:[makeBlock({typeIndex:21})]},native]){
   const canvas=document.createElement('canvas');thumbnail(canvas,asset);panel.append(canvas);
   const bytes=canvas.getContext('2d').getImageData(0,0,360,240).data,colors=new Set();let pixels=0,minX=360,maxX=0,minY=240,maxY=0;
   for(let i=0;i<bytes.length;i+=4)if(bytes[i+3]>128){pixels++;colors.add(bytes.slice(i,i+3).join(','));const x=i/4%360,y=Math.floor(i/4/360);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
   const copy=document.createElement('canvas');thumbnail(copy,asset);out.push({name:asset.name,pixels,colors:colors.size,minX,maxX,minY,maxY,cached:copy.toDataURL()===canvas.toDataURL()});
  }return out;
 },xml);
 for(const r of results){assert.ok(r.pixels>500,JSON.stringify(r));assert.ok(r.colors>3,JSON.stringify(r));assert.ok(r.minX>0&&r.minY>0&&r.maxX<359&&r.maxY<239,JSON.stringify(r));assert.equal(r.cached,true);}
 await page.locator('#thumbnail-proof').screenshot({path:'test-results/turret-thumbnails.png'});assert.deepEqual(errors,[]);console.log(results);
}finally{await browser.close();}

