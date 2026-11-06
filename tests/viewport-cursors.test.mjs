import test from 'node:test';
import assert from 'node:assert/strict';
import {brushRingGeometry,cursorCSS,cursorVisual,cursorArtwork} from '../src/viewport-cursors.js';
import {FACTORY_PREFERENCES,createPreferencesStore} from '../src/preferences.js';
import {ensureViewportOptions} from '../src/viewport-options.js';
const p=FACTORY_PREFERENCES;
test('brush band thickness stays constant across radius changes',()=>{
 const radii=d=>[...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([,x,y])=>Math.hypot(+x,+y));
 const a=brushRingGeometry(16,p),b=brushRingGeometry(64,p);
 for(let i=0;i<a.length;i++){const x=radii(a[i].d),y=radii(b[i].d);assert.ok(x.length>0);x.forEach((r,j)=>assert.ok(Math.abs(y[j]-r-48)<.001));}
 assert.notEqual(brushRingGeometry(32,p)[0].d,brushRingGeometry(32,{...p,cursorLineWeight:2})[0].d);
});
test('cursor appearance, polar target offsets, and preview match native cursor',()=>{
 const a=cursorVisual('replace',0,{...p,cursorAngle_replace:0,cursorDistance_replace:20});
 const b=cursorVisual('replace',0,{...p,cursorAngle_replace:180,cursorDistance_replace:20});
 assert.ok(a.x>b.x);assert.match(a.svg,/stroke-width="1"/);
 assert.ok(cursorVisual('orbit',0,{...p,cursorScale:2}).width>cursorVisual('orbit',0,p).width);
 assert.match(cursorArtwork('orbit',{...p,cursorPrimaryColor:'#123456',cursorSecondaryColor:'#abcdef',cursorLineWeight:2}),/#123456/);
 assert.match(cursorArtwork('orbit',{...p,cursorLineWeight:.5}),/operator="erode"/);
 for(const radius of [0,16,48,64])assert.match(cursorCSS('restore',radius,p),/url\("data:image\/svg\+xml,/);
 const selected=cursorVisual('select',0,p),orbit=cursorVisual('orbit',0,p);
 assert.ok(selected.y-selected.artworkCenter[1]<orbit.y-orbit.artworkCenter[1]);
});
test('cursor settings persist through existing preference store',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},store=createPreferencesStore(storage);
 assert.equal(store.set('cursorScale',1.5),true);store.set('cursorAngle_replace',123);store.set('cursorDistance_replace',17);store.set('cursorSecondaryColor','#123456');
 const saved=createPreferencesStore(storage).value;assert.equal(saved.cursorScale,1.5);assert.equal(saved.cursorAngle_replace,123);assert.equal(saved.cursorDistance_replace,17);assert.equal(saved.cursorSecondaryColor,'#123456');
 assert.equal(store.set('cursorScale',99),false);
});
test('legacy selection tint migrates to independent shade and outline controls',()=>{
 for(const old of [true,false]){const view={display:{outlineSelected:old}};const d=ensureViewportOptions(view);assert.equal(d.shadeSelected,old);assert.equal(d.outlineSelected,false);d.outlineSelected=true;d.shadeSelected=false;ensureViewportOptions(view);assert.equal(d.outlineSelected,true);assert.equal(d.shadeSelected,false);}
});
