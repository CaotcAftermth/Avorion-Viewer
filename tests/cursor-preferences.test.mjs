import test from 'node:test';
import assert from 'node:assert/strict';
import {cursorPreviewLayout} from '../src/cursor-preferences.js';
import {cursorVisual} from '../src/viewport-cursors.js';
import {FACTORY_PREFERENCES} from '../src/preferences.js';
test('preview target orbits fixed artwork center at cardinal directions',()=>{
 for(const [angle,dx,dy] of [[0,20,0],[90,0,20],[180,-20,0],[270,0,-20]]){const p={...FACTORY_PREFERENCES,cursorAngle_select:angle,cursorDistance_select:20},v=cursorVisual('select',24,p),layout=cursorPreviewLayout('select',p);assert.equal(layout.left+v.artworkCenter[0],96);assert.equal(layout.top+v.artworkCenter[1],96);assert.ok(Math.abs(layout.target[0]-96-dx)<1);assert.ok(Math.abs(layout.target[1]-96-dy)<1);}
});

test('Restore honors the configured target distance instead of a forced minimum',()=>{const p={...FACTORY_PREFERENCES,cursorAngle_restore:0,cursorDistance_restore:10};const layout=cursorPreviewLayout('restore',p);assert.ok(Math.abs(layout.target[0]-106)<1);assert.ok(Math.abs(layout.target[1]-96)<1);});
