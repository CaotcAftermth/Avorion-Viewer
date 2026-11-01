import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION, FEATURE_AREAS, PATCH } from '../src/version.js';

test('app version is pre-1.0 semver derived from the feature areas', () => {
  assert.match(APP_VERSION, /^0\.\d+\.\d+$/);
  assert.equal(APP_VERSION, `0.${FEATURE_AREAS.length}.${PATCH}`);
  FEATURE_AREAS.forEach(([version], i) => assert.equal(version, `0.${i + 1}`));
});
test('package.json matches the app version and the status bar uses it at runtime', () => {
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version, APP_VERSION);
  assert.ok(readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').includes("querySelector('b').textContent=APP_VERSION"));
});
