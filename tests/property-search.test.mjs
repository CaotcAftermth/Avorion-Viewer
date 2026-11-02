import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, searchTerms, matchesAll, matchRanges } from '../src/property-search.js';

test('search terms fold case and accents and keep quoted phrases', () => {
  assert.deepEqual(searchTerms('  Primary   COLOR '), ['primary', 'color']);
  assert.deepEqual(searchTerms('"primary color" x'), ['primary color', 'x']);
  assert.deepEqual(searchTerms('Énergie'), ['energie']);
  assert.deepEqual(searchTerms('   '), []);
  assert.equal(fold('Größe'), 'große');
});

test('every term must match somewhere in the text', () => {
  assert.equal(matchesAll('Location X 1.500', searchTerms('location 1.5')), true);
  assert.equal(matchesAll('Location X 1.500', searchTerms('location y')), false);
});

test('match ranges map back to the original text and merge overlaps', () => {
  assert.deepEqual(matchRanges('Primary Color', searchTerms('color')), [[8, 13]]);
  assert.deepEqual(matchRanges('Café crème', searchTerms('cafe')), [[0, 4]]);
  assert.deepEqual(matchRanges('aaaa', searchTerms('aa a')), [[0, 4]]);
  assert.deepEqual(matchRanges('Bloom Threshold', searchTerms('zzz')), []);
});
