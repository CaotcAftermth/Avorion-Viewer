import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION, FEATURE_AREAS, PATCH } from '../src/version.js';

test('app version is pre-1.0 semver derived from the feature areas', () => {
  assert.match(APP_VERSION, /^0\.\d+\.\d+$/);
  assert.equal(APP_VERSION, `0.${FEATURE_AREAS.length}.${PATCH}`);
  FEATURE_AREAS.forEach(([version], i) => assert.equal(version, `0.${i + 1}`));
});
test('package.json and the status bar fallback match the app version', () => {
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version, APP_VERSION);
  assert.ok(readFileSync(new URL('../index.html', import.meta.url), 'utf8').includes(`<b>${APP_VERSION}</b>`));
});
