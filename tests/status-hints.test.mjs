import test from 'node:test';
import assert from 'node:assert/strict';
import {statusHint} from '../src/status-hints.js';

test('active tools override area hints and paint actions follow the selected tool',()=>{
 const context={editor:'viewport',view:{interactionMode:'paint',paint:{tool:'fill'}}};
 assert.match(statusHint(context),/fill connected matching blocks/);
 assert.match(statusHint({...context,target:'header',activity:'magnifier'}),/Wheel resizes Brush or Restore/);
 assert.match(statusHint({...context,activity:'placement'}),/occupied socket/);
});

test('status hints follow remapped bindings and omit unassigned shortcuts',()=>{
 const hint=statusHint({editor:'viewport',selected:true,preferences:{keymap_selected:'KeyG',keymap_wheelZoom:''}});
 assert.match(hint,/G Frame Selected/);
 assert.doesNotMatch(hint,/Unassigned|Wheel Zoom/);
 assert.match(statusHint({editor:'properties',category:'components'}),/symmetry/);
 assert.match(statusHint({editor:'properties',category:'coverage',target:'numeric'}),/Shift for fine adjustment/);
});
