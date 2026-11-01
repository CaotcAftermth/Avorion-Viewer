import test from 'node:test';
import assert from 'node:assert/strict';
import { blockCount, filterModels, formatSize, createModelLibraryState } from '../src/model-browser.js';

const item = path => ({ path, file: { size: 1, lastModified: 1 } });
const items = ['Alpha.xml', 'Fleet/Carrier Mk2.xml', 'Fleet/Gamma.xml', 'Wrecks/old carrier.xml'].map(item);

test('block count reads every block element and ignores look-alike tags', () => {
  assert.equal(blockCount('<ship><block index="2"/><block index="3"></block><blocks/><blockade/><block\n index="4"/></ship>'), 3);
  assert.equal(blockCount('<ship/>'), 0);
});

test('search matches every word in name or subfolder, case-insensitively', () => {
  assert.deepEqual(filterModels(items, 'carrier').map(i => i.path), ['Fleet/Carrier Mk2.xml', 'Wrecks/old carrier.xml']);
  assert.deepEqual(filterModels(items, 'fleet MK2').map(i => i.path), ['Fleet/Carrier Mk2.xml']);
  assert.equal(filterModels(items, '  ').length, 4);
});

test('favorites and recent views are scoped to the folder; recent keeps open order', () => {
  const favorites = new Set(['ships/Alpha.xml', 'other/Fleet/Gamma.xml']);
  assert.deepEqual(filterModels(items, '', { view: 'favorites', favorites, folder: 'ships' }).map(i => i.path), ['Alpha.xml']);
  const recent = ['ships/Fleet/Gamma.xml', 'ships/Alpha.xml'];
  assert.deepEqual(filterModels(items, '', { view: 'recent', recent, folder: 'ships' }).map(i => i.path), ['Fleet/Gamma.xml', 'Alpha.xml']);
});

test('sizes read naturally', () => {
  assert.equal(formatSize(512), '512 B');
  assert.equal(formatSize(2048), '2.0 KB');
  assert.equal(formatSize(5 * 1024 * 1024), '5.0 MB');
});

test('library state remembers favorites, recent order and counts, and prunes removed files', async () => {
  const data = new Map(), store = { get: async k => data.get(k), put: async (k, v) => { data.set(k, structuredClone(v)); } };
  const state = createModelLibraryState(store);
  await state.load();
  state.toggleFavorite('ships/Alpha.xml');
  state.opened('ships/Alpha.xml'); state.opened('ships/Beta.xml'); state.opened('ships/Alpha.xml');
  state.setMeta('ships/Alpha.xml|1|1', { blocks: 7 }); state.setMeta('ships/Gone.xml|1|1', { blocks: 2 });
  const live = new Set(['ships/Alpha.xml|1|1']); live.folder = 'ships'; state.prune(live);
  await new Promise(r => setTimeout(r, 350));
  const again = createModelLibraryState(store), saved = await again.load();
  assert.deepEqual([...saved.favorites], ['ships/Alpha.xml']);
  assert.deepEqual(saved.recent, ['ships/Alpha.xml', 'ships/Beta.xml']);
  assert.deepEqual(saved.meta, { 'ships/Alpha.xml|1|1': { blocks: 7 } });
});
