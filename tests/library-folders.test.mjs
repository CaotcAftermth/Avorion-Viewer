import test from 'node:test';
import assert from 'node:assert/strict';
import { createFolderStore, folderPermission, listFolderFiles, supportsFolderHandles, FILE_FILTERS } from '../src/library-folders.js';

const file = name => ({ kind: 'file', name, getFile: async () => new File(['x'], name) });
const dir = (name, children) => ({ kind: 'directory', name, async *values() { yield* children; } });

test('folder walk filters by type, skips hidden entries, keeps relative paths, and sorts naturally', async () => {
  const root = dir('ships', [file('ship10.xml'), file('ship2.xml'), file('notes.txt'), dir('.cache', [file('hidden.xml')]), dir('Fleet', [file('Carrier.xml')])]);
  assert.deepEqual((await listFolderFiles(root, FILE_FILTERS.models)).map(f => f.path), ['Fleet/Carrier.xml', 'ship2.xml', 'ship10.xml']);
  assert.equal((await listFolderFiles(root, null)).length, 4);
});

test('folder walk respects depth and count limits', async () => {
  const deep = dir('a', [dir('b', [dir('c', [file('deep.xml')])]), file('top.xml')]);
  assert.deepEqual((await listFolderFiles(deep, null, { maxDepth: 1 })).map(f => f.path), ['top.xml']);
  assert.equal((await listFolderFiles(deep, null, { maxFiles: 1 })).length, 1);
});

test('permission only prompts when asked to', async () => {
  let asked = 0;
  const handle = { queryPermission: async () => 'prompt', requestPermission: async () => { asked++; return 'granted'; } };
  assert.equal(await folderPermission(handle), 'prompt');
  assert.equal(asked, 0);
  assert.equal(await folderPermission(handle, true), 'granted');
  assert.equal(asked, 1);
  assert.equal(await folderPermission(null), 'denied');
  assert.equal(await folderPermission({ queryPermission: async () => { throw Error('gone'); } }), 'denied');
});

test('folder store remembers and forgets handles per kind', async () => {
  const data = new Map(), store = createFolderStore({ get: async k => data.get(k), put: async (k, v) => { data.set(k, v); } });
  const handle = { name: 'blocks' };
  await store.set('textures', handle);
  assert.equal(await store.get('textures'), handle);
  assert.equal(await store.get('models'), null);
  await store.forget('textures');
  assert.equal(await store.get('textures'), null);
  const copy = { name: 'ships', savedAt: 1, files: [{ path: 'Alpha.xml', file: { name: 'Alpha.xml' } }] };
  await store.setCopy('models', copy);
  assert.equal(await store.getCopy('models'), copy);
  assert.equal(await store.get('models'), null);
  await store.forgetCopy('models');
  assert.equal(await store.getCopy('models'), null);
});

test('remembered folders need the directory picker in a secure page', () => {
  assert.equal(supportsFolderHandles({}), false);
  assert.equal(supportsFolderHandles({ showDirectoryPicker() {}, isSecureContext: true }), true);
  assert.equal(supportsFolderHandles({ showDirectoryPicker() {}, isSecureContext: false }), false);
});
