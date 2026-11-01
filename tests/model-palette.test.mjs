import test from 'node:test';
import assert from 'node:assert/strict';
import {modelPalette} from '../src/model-palette.js';
import {applyBlockColors} from '../src/block-colors.js';
test('model palette counts both active channels once per block and invalidates on edits and undo',()=>{
 const scene={loaded:true,model:{blocks:[{id:'a',color:'ff112233',secondaryColor:'ff112233'},{id:'b',color:'ff445566',secondaryColor:'80112233'},{id:'c',color:'ff445566',secondaryColor:'00000000'}]}};
 const initial=modelPalette(scene);assert.deepEqual(initial,[{hex:'#112233',count:2},{hex:'#445566',count:2}]);assert.equal(modelPalette(scene),initial);
 const patches=applyBlockColors(scene,[{id:'a',color:'ff445566',secondaryColor:'00000000'}],{writeXml:false});assert.deepEqual(modelPalette(scene),[{hex:'#445566',count:3},{hex:'#112233',count:1}]);
 applyBlockColors(scene,patches.map(p=>p.before),{writeXml:false});assert.deepEqual(modelPalette(scene),initial);
 scene.loaded=false;assert.deepEqual(modelPalette(scene),[]);
});
