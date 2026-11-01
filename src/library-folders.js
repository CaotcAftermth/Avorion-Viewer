// Remembered asset folders.
// Chrome and Edge can hand the page a FileSystemDirectoryHandle. Unlike the File
// objects from <input webkitdirectory>, a handle can be stored in IndexedDB and
// reopened on a later visit: silently when the browser kept the permission,
// otherwise after one click (requestPermission needs a user gesture).
// Other browsers fall back to the session-only folder picker.
import { openSessionStore } from './session-persistence.js';

export const FOLDER_KINDS = ['textures', 'models', 'other'];
export const FILE_FILTERS = { textures: /\.(png|bmp|jpe?g|webp)$/i, models: /\.xml$/i, other: null };

export function supportsFolderHandles(win = globalThis) {
  return typeof win?.showDirectoryPicker === 'function' && win.isSecureContext !== false;
}

export function createFolderStore(store = openSessionStore()) {
  const key = kind => 'folder:' + kind;
  return {
    async get(kind) { try { return (await store.get(key(kind))) || null; } catch { return null; } },
    set: (kind, handle) => store.put(key(kind), handle),
    forget: kind => store.put(key(kind), null),
    // Saved copies stand in for folders the browser will not remember
    // (Chrome blocks Program Files and AppData, where Avorion keeps its files).
    async getCopy(kind) { try { return (await store.get('copy:' + kind)) || null; } catch { return null; } },
    setCopy: (kind, copy) => store.put('copy:' + kind, copy),
    forgetCopy: kind => store.put('copy:' + kind, null),
  };
}

/** 'granted' | 'prompt' | 'denied'. With request=true this must run inside a click. */
export async function folderPermission(handle, request = false) {
  if (!handle) return 'denied';
  const options = { mode: 'read' };
  try {
    const state = await handle.queryPermission?.(options) ?? 'granted';
    if (state === 'granted' || !request) return state;
    return await handle.requestPermission(options);
  } catch { return 'denied'; }
}

/**
 * Walk a directory handle and return matching files as { file, path }, sorted by path.
 * Hidden entries are skipped; depth and count limits keep a mis-picked drive root cheap.
 */
export async function listFolderFiles(handle, filter = null, { maxDepth = 8, maxFiles = 20000 } = {}) {
  const out = [];
  async function walk(dir, prefix, depth) {
    for await (const entry of dir.values()) {
      if (out.length >= maxFiles) return;
      if (entry.name.startsWith('.')) continue;
      const path = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.kind === 'directory') { if (depth < maxDepth) await walk(entry, path, depth + 1); continue; }
      if (filter && !filter.test(entry.name)) continue;
      try { out.push({ file: await entry.getFile(), path }); } catch { /* unreadable file: skip */ }
    }
  }
  await walk(handle, '', 0);
  return out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
}
