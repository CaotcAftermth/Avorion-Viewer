import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {serveWorkspace} from './local-route.mjs';

const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:650},acceptDownloads:true});
  await serveWorkspace(page);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&message.text().includes('Shader Error'))errors.push(message.text());});
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#welcome-dialog[open]').waitFor();
  await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()));
  await page.getByRole('button',{name:'Help',exact:true}).click();
  await page.getByRole('menuitem',{name:'Texture Assignments…'}).click();
  const dialog=page.getByRole('dialog',{name:'Texture Assignments'});
  const frame=dialog.frameLocator('iframe');
  const picker=frame.locator('.texture-block-picker summary');
  await picker.waitFor({timeout:10000}).catch(async error=>{
    error.message+='\nWorkspace status: '+await dialog.locator('[role="status"]').textContent();
    throw error;
  });
  const header = frame.locator('.area-header').filter({hasText:'Texture properties'});
  assert.ok(await header.evaluate(el=>el.getBoundingClientRect().right - el.querySelector('.area-options').getBoundingClientRect().right < 12));
  assert.equal(await frame.locator('[data-editor=outliner]').count(),0);
  assert.match(await picker.textContent(),/Crew Quarters \(6\)/);
  assert.equal(await frame.getByLabel('Material',{exact:true}).inputValue(),'1');
  await frame.getByText('Blocks 7 visible / 7',{exact:false}).waitFor();
  await frame.getByText('Back Orthographic',{exact:true}).waitFor();
  await frame.getByRole('button',{name:'Material Shading',exact:true}).click();
  const emission=frame.getByLabel('Window emission',{exact:true});
  await emission.fill('2');
  await emission.press('Tab');
  // Picking a distant variant must not reopen the list at its beginning.
  await picker.click();
  await frame.getByRole('searchbox',{name:'Search block types'}).fill('Super Rich Rift');
  await frame.locator('.texture-block-list button:not(.texture-block-arrow)').filter({hasText:/\(551\)$/}).click();
  const selectedVisible=async()=>{
    await frame.locator('.texture-block-list [aria-current=true]').waitFor();
    await page.waitForTimeout(40);
    return frame.locator('.texture-block-list').evaluate(list=>{
      const selected=list.querySelector('[aria-current=true]'),a=selected.getBoundingClientRect(),b=list.getBoundingClientRect();
      return {visible:a.top>=b.top&&a.bottom<=b.bottom,scroll:list.scrollTop,text:selected.textContent,entry:[a.top,a.bottom],bounds:[b.top,b.bottom],height:list.clientHeight};
    });
  };
  await picker.click();
  let selected=await selectedVisible();assert.match(selected.text,/\(551\)$/);assert.ok(selected.visible,JSON.stringify(selected));assert.ok(selected.scroll>0);
  await frame.getByRole('searchbox',{name:'Search block types'}).press('Escape');
  await picker.click();selected=await selectedVisible();assert.ok(selected.visible,JSON.stringify(selected));assert.ok(selected.scroll>0);
  await frame.getByRole('searchbox',{name:'Search block types'}).press('Escape');
  // Material changes rebuild the picker; the selected variant must stay visible.
  await frame.getByLabel('Material',{exact:true}).selectOption('0');
  await picker.click();selected=await selectedVisible();assert.ok(selected.visible,JSON.stringify(selected));assert.match(selected.text,/\(551\)$/);
  await frame.getByRole('searchbox',{name:'Search block types'}).press('Escape');
  await picker.click();
  const blockList=frame.locator('.texture-block-list');
  const variants=blockList.getByRole('button',{name:'Variants for Blank Hull (1)',exact:true});
  const smartHull=blockList.getByRole('button',{name:'Smart Hull (2)',exact:true});
  assert.equal(await smartHull.count(),0);
  await variants.click();
  await smartHull.waitFor();
  await frame.getByRole('searchbox',{name:'Search block types'}).fill('hull (2)');
  await smartHull.click();
  await frame.getByLabel('Material',{exact:true}).selectOption('3');
  await frame.getByLabel('Specularity',{exact:true}).fill('2.2');
  await frame.getByLabel('Specularity',{exact:true}).press('Tab');
  await frame.getByRole('button',{name:'Texture Maps',exact:true}).click();
  await frame.getByRole('button',{name:'Inspect Material glow',exact:true}).click();
  const lastMap=frame.getByLabel('Material glow scaling',{exact:true});
  await lastMap.scrollIntoViewIfNeeded();
  await lastMap.selectOption('fixed');
  await lastMap.selectOption('');
  const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    canvas.width=canvas.height=20;
    context.fillStyle='magenta';context.fillRect(0,0,20,20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await frame.getByLabel('Add texture images').setInputFiles({name:'preview-map.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await frame.getByText('1 of 1 texture images loaded for this workspace.').waitFor();
  await frame.getByRole('button',{name:'Inspect Albedo',exact:true}).click();
  const albedo=frame.getByLabel('Albedo',{exact:true});
  await albedo.selectOption('file:preview-map');
  await frame.getByLabel('Albedo scaling',{exact:true}).selectOption('fit');
  const trigger=frame.getByRole('button',{name:/Open texture preview: preview-map/});
  await trigger.click();
  const quickPreview=frame.getByRole('dialog',{name:/Texture preview: preview-map/});
  const previewImage=quickPreview.getByRole('img');
  await previewImage.waitFor();
  assert.equal(await previewImage.evaluate(async image=>{await image.decode();return image.naturalWidth;}),20);
  await quickPreview.getByRole('button',{name:'Close'}).press('Escape');
  await quickPreview.waitFor({state:'detached'});
  assert.ok(await trigger.evaluate(button=>document.activeElement===button));
  await frame.getByLabel('Stock / Edited').selectOption('stock');
  assert.ok(await albedo.isDisabled());
  assert.equal(await frame.getByRole('img',{name:'preview-map'}).count(),0);
  await frame.getByLabel('Stock / Edited').selectOption('edited');
  assert.equal(await albedo.inputValue(),'file:preview-map');
  const maskToggle=frame.getByRole('checkbox',{name:'Color Mask'});
  const canvas=frame.locator('[data-editor=viewport] canvas').first();
  const countMaskColors=async()=>{
    const shot=await canvas.screenshot();
    return page.evaluate(async base64=>{
      const bitmap=await createImageBitmap(await (await fetch('data:image/png;base64,'+base64)).blob());
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
      const ctx=canvas.getContext('2d');
      ctx.drawImage(bitmap,0,0);
      const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
      let red=0,blue=0;
      for(let i=0;i<data.length;i+=4){
        if(data[i]>245&&data[i+1]<10&&data[i+2]<10)red++;
        if(data[i+2]>245&&data[i]<10&&data[i+1]<10)blue++;
      }
      return {red,blue};
    },shot.toString('base64'));
  };
  await maskToggle.check();
  await frame.getByText('Primary',{exact:true}).waitFor();
  const beforeMask=await countMaskColors();
  assert.ok(beforeMask.red>100,JSON.stringify(beforeMask));
  const paintMask=frame.getByLabel('Paint / cutout mask',{exact:true});
  await paintMask.selectOption('file:preview-map');
  const afterMask=await countMaskColors();
  assert.ok(afterMask.blue>beforeMask.blue+100,JSON.stringify({beforeMask,afterMask}));
  await paintMask.selectOption('');
  await maskToggle.uncheck();
  assert.ok((await countMaskColors()).red<beforeMask.red);
  const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Export JSON'}).click()]);
  assert.equal(download.suggestedFilename(),'texture-assignments.json');
  const saved=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.deepEqual(saved.assignments,[
    {typeIndex:6,materialIndex:1,textures:{},shading:{},windowEmission:2},
    {typeIndex:2,materialIndex:3,textures:{albedo:'preview-map'},shading:{specularity:2.2},scaling:{albedo:'fit'}},
  ]);
  // Execute the production mapping helper with a repeating 4-step texture.
  const shaderSource=await readFile('src/avorion/lib/geometry/gameShader.js','utf8');
  const uvHelpers=shaderSource.slice(shaderSource.indexOf('uniform sampler2D uTextureScales;',shaderSource.indexOf('const FRAG =')),shaderSource.indexOf('vec4 sampleShipName('));
  const tileSamples=await page.evaluate(helpers=>{
    const canvas=document.createElement('canvas');
    canvas.width=100; canvas.height=1;
    const gl=canvas.getContext('webgl2');
    const compile=(kind,source)=>{
      const shader=gl.createShader(kind);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,`#version 300 es
      void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`#version 300 es
      precision highp float;
      precision highp sampler2DArray;
      uniform sampler2DArray tiles;
      uniform float width;
      uniform int mode;
      uniform float surface;
      const int MAP_ALBEDO=0,MAP_NORMAL=1;
      int uTextureScaling[1];
      vec4 vSurface;
      const float uTileScale=.1;
      vec2 vFaceUV,faceDx,faceDy;
      out vec4 color;
      ${helpers}
      void main(){
        uTextureScaling[0]=mode;
        vSurface=vec4(width,1.,0.,0.);
        vFaceUV=vec2(gl_FragCoord.x/100.,.5);
        faceDx=dFdx(vFaceUV);faceDy=dFdy(vFaceUV);
        if (surface == 6.0) color=sampleFrameworkMask(tiles,1.,0);
        else if (surface == 4.0 || surface == 5.0 || surface == 38.0) color=sampleGeneratorDetail(tiles,1.,surface,0);
        else color=surface > 0.0 ? sampleFunctional(tiles,1.,surface,0) : sampleCenteredFace(tiles,1.,1.,0);
      }`));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program,'uTextureScales'),1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY,gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.R8,4,1,2,0,gl.RED,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0,32,96,160,224]));
    return [[10,0,0],[20,0,0],[20,1,0],[2,0,31],[2,1,31],[5,0,33],[5,0,35],[5,0,4],[5,0,5],[.5,0,6],[.75,0,6],[.75,1,6],[2,0,32],[2,1,32]].map(([width,mode,surface])=>{
      gl.uniform1f(gl.getUniformLocation(program,'width'),width);
      gl.uniform1i(gl.getUniformLocation(program,'mode'),mode);
      gl.uniform1f(gl.getUniformLocation(program,'surface'),surface);
      gl.drawArrays(gl.TRIANGLES,0,3);
      return [10,30,40,55,60,80].map(x=>{
        const pixel=new Uint8Array(4);
        gl.readPixels(x,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        return pixel[0];
      });
    });
  },uvHelpers);
  // Existing defaults are corner-centered; only Assembly's native mapping shifts.
  assert.deepEqual(tileSamples,[[160,224,224,32,32,96],[32,160,224,32,32,160],[32,96,96,160,160,224],[96,32,32,224,224,160],[32,96,96,160,160,224],
    [96,32,32,224,224,160],[96,32,32,224,224,160],
    [160,224,224,32,32,96],[160,224,224,32,32,96],
    [32,96,96,160,160,224],[32,160,224,32,32,160],[32,96,96,160,160,224],
    [224,160,160,96,96,32],[32,96,96,160,160,224]]);
  const parentHasTexture=await page.evaluate(async()=>{
    const {textureLibrary}=await import('/src/avorion/lib/textures/textureLibrary.js');
    return textureLibrary.has('preview-map');
  });
  assert.equal(parentHasTexture,false);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Help',exact:true}).click();
  await page.getByRole('menuitem',{name:'Texture Assignments…'}).click();
  await picker.waitFor({timeout:10000}).catch(async error=>{
    const state=await frame.locator('body').evaluate(async()=>{const {textureLibrary:t}=await import('/src/avorion/lib/textures/textureLibrary.js');return {pending:t.pending,loaded:t.loadedCount,blobs:t.blobs.size,scanning:t.scanning};});
    console.log('Reopen diagnostic',state,await dialog.locator('[role=status]').textContent(),errors);
    error.message+=' Reopen status: '+await dialog.locator('[role=status]').textContent()+' textures: '+JSON.stringify(state)+' errors: '+JSON.stringify(errors);throw error;
  });
  await picker.click();selected=await selectedVisible();assert.ok(selected.visible,JSON.stringify(selected));assert.match(selected.text,/\(2\)$/);
  await frame.getByRole('searchbox',{name:'Search block types'}).press('Escape');
  await frame.getByRole('button',{name:'Inspect Albedo',exact:true}).click();
  await albedo.waitFor();
  assert.equal(await albedo.inputValue(),'file:preview-map');
  await frame.getByRole('button',{name:'Reset this block and material'}).click();
  assert.equal(await albedo.inputValue(),'');
  assert.deepEqual(errors,[]);
  console.log('Texture Assignments preserves its layout and drafts, previews local maps, compares stock, and exports JSON.');
} finally {
  await browser.close();
}
