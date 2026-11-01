import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject} from '../src/turrets/core.js';
import {createAssetGuides} from '../src/turrets/asset-guides.js';
test('asset guide toggles are independent and follow the turret pose',()=>{
 const a=demoProject().assets[0];a.muzzles=['b2'];a.editorGuides={axes:false,muzzles:false};assert.equal(createAssetGuides(a).children.length,0);
 a.editorGuides.axes=true;const axes=createAssetGuides(a);assert.ok(axes.getObjectByName('yaw-axis'));assert.ok(axes.getObjectByName('pitch-axis'));assert.equal(axes.getObjectByName('muzzle-position'),undefined);
 a.editorGuides={axes:false,muzzles:true};const start=createAssetGuides(a).getObjectByName('muzzle-position').position.clone();a.editorPose={yaw:90,pitch:45};const posed=createAssetGuides(a);assert.equal(posed.getObjectByName('yaw-axis'),undefined);assert.ok(start.distanceTo(posed.getObjectByName('muzzle-position').position)>0.1);
});
