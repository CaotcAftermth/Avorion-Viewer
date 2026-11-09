import test from 'node:test';
import assert from 'node:assert/strict';
import {socketAppearance,DEFAULT_SOCKET_APPEARANCE,appearanceColor,draftingBackground} from '../src/components/socket-appearance.js';
test('socket appearance validates stored colors and opacity without changing defaults',()=>{
 assert.deepEqual(socketAppearance(null),DEFAULT_SOCKET_APPEARANCE);assert.deepEqual(socketAppearance('bad'),DEFAULT_SOCKET_APPEARANCE);
 assert.deepEqual(socketAppearance({gridColor:'url(untrusted)',gridOpacity:NaN,backgroundColor:'#ffffff',backgroundOpacity:2}),{...DEFAULT_SOCKET_APPEARANCE,backgroundColor:'#ffffff',backgroundOpacity:1});
 assert.equal(socketAppearance({gridOpacity:-1}).gridOpacity,0);assert.equal(socketAppearance({gridOpacity:.35,gridColor:'#ff00aa'}).gridOpacity,.35);
 assert.equal(draftingBackground({...DEFAULT_SOCKET_APPEARANCE,backgroundOpacity:0}),'rgb(32,37,43)');
 assert.equal(appearanceColor('#ff00aa',.35),'rgba(255,0,170,0.35)');
});
