import test from 'node:test';
import assert from 'node:assert/strict';
import { skySpecification,skyKey,WORLD_DEFAULTS } from '../src/sky-settings.js';
import { parsePreferences,FACTORY_PREFERENCES,PREFERENCE_SECTIONS } from '../src/preferences.js';
test('sky generation is repeatable and varies with seed and coordinates',()=>{
  const a=skySpecification(WORLD_DEFAULTS);assert.deepEqual(a,skySpecification(WORLD_DEFAULTS));
  for(const key of ['worldSeed','worldSectorX','worldSectorY'])assert.notDeepEqual(a,skySpecification({...WORLD_DEFAULTS,[key]:7}));
  assert.ok(a.clouds.some(c=>c.type===9));
  for(const c of [...a.clouds,...a.dark,...a.stars])assert.ok(Math.abs(Math.hypot(...c.direction)-1)<1e-10);
});
test('sky controls persist and old preference files gain world defaults',()=>{
  const p={...FACTORY_PREFERENCES,worldSeed:123,worldDust:.8,worldPalette:'custom',worldColorA:'#ff1111'};
  assert.deepEqual(parsePreferences(JSON.stringify(p)),p);
  assert.equal(parsePreferences('{"version":1}').worldResolution,512);
  assert.ok(PREFERENCE_SECTIONS.find(s=>s.id==='viewport').panels.find(p=>p.label==='World'));
});
test('rotation and visibility reuse the sky; generation changes invalidate it',()=>{
  assert.equal(skyKey(WORLD_DEFAULTS),skyKey({...WORLD_DEFAULTS,worldRotation:90,worldEnabled:false}));
  assert.notEqual(skyKey(WORLD_DEFAULTS),skyKey({...WORLD_DEFAULTS,worldClouds:0}));
  assert.equal(skySpecification({...WORLD_DEFAULTS,worldClouds:0}).clouds.length,0);
  assert.equal(skySpecification({...WORLD_DEFAULTS,worldStars:0}).density,0);
  assert.deepEqual(skySpecification({...WORLD_DEFAULTS,worldPalette:'custom',worldColorA:'#ff0000'}).colors[0],[1,0,0]);
});
