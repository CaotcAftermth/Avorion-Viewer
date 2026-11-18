import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {serveWorkspace} from './local-route.mjs';

const browser = await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
    const page = await browser.newPage();
    await serveWorkspace(page);
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    page.on('console', message=>{if(message.type()==='error' && message.text().includes('Shader Error'))errors.push(message.text());});
    await page.goto('http://127.0.0.1:5173/');
    const result = await page.evaluate(async()=>{
        const {createShipNameImage} = await import('/src/avorion/lib/geometry/shipName.js');
        function bounds(text) {
            const image=createShipNameImage(text,512);
            let left=512,right=-1,bottom=-1,top=512;
            for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(image.data[(y*512+x)*4]>128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
            return {left,right,top,bottom};
        }
        return {short:bounds('A'),long:bounds('A'.repeat(53))};
    });
    // A short name reaches the 70% glyph-height cap, with symmetric margins.
    assert.ok(Math.abs(result.short.top/512-.15)<.005);
    assert.ok(Math.abs((511-result.short.bottom)/512-.15)<.005);
    // A long name reaches both sides and shrinks uniformly below that cap.
    assert.ok(result.long.left<=1 && result.long.right>=510);
    assert.ok(result.long.top>result.short.top);
    assert.ok(Math.abs(result.long.top-(511-result.long.bottom))<=1);
    await page.locator('#welcome-dialog[open]').waitFor();
    await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()));
    await page.getByRole('button',{name:'Help',exact:true}).click();
    await page.getByRole('menuitem',{name:'Texture Assignments…'}).click();
    const frame=page.getByRole('dialog',{name:'Texture Assignments'}).frameLocator('iframe');
    await frame.locator('.texture-block-picker summary').click();
    await frame.getByRole('searchbox',{name:'Search block types'}).fill('ship name');
    await frame.getByRole('button',{name:'Ship Name (600)',exact:true}).click();
    await frame.getByText('Blocks 7 visible / 7',{exact:false}).waitFor();
    await frame.locator('canvas').first().screenshot();
    assert.deepEqual(errors,[]);
    console.log('Ship Name: measured padding, width fitting, and seven-size shader preview passed.',result);
} finally {await browser.close();}
