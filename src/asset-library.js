// Asset Library folders.
// In Chrome and Edge the chosen folders are remembered (see library-folders.js)
// and reopen on later visits, silently or after one Reconnect click. Other
// browsers fall back to a session-only folder picker. Loaded textures are saved
// separately by session-persistence.js, so the Textures row also reports the
// texture library itself.
import { textureLibrary } from './avorion/lib/textures/textureLibrary.js';
import { FOLDER_KINDS, FILE_FILTERS, supportsFolderHandles, createFolderStore, folderPermission, listFolderFiles } from './library-folders.js';
import { mountModelBrowser } from './model-browser.js';

const LABELS = { textures: 'Textures', models: 'XML models', other: 'Other assets' };
// kind -> { name, files: [{file, path}], handle?, savedAt?, state: 'connected'|'prompt'|'denied'|'session'|'copy'|'scanning', error? }
// 'copy' is a model folder read with the one-time picker and kept in IndexedDB.
// Chrome will not remember folders under Program Files or AppData (where Steam
// installs Avorion and the game saves ships), but the one-time picker can read
// them, so the files are saved instead of the folder.
const folders = new Map();
const listeners = new Set();
let store, restored;
const offerOnce = new Set(); // kinds whose remembered-folder picker was just cancelled or refused
const changed = () => listeners.forEach(fn => fn());
const folderStore = () => store ??= createFolderStore();

async function scan(kind, handle) {
  folders.set(kind, { ...folders.get(kind), name: handle.name, handle, state: 'scanning', files: folders.get(kind)?.files || [] }); changed();
  try { folders.set(kind, { name: handle.name, handle, state: 'connected', files: await listFolderFiles(handle, FILE_FILTERS[kind]) }); }
  catch (error) { folders.set(kind, { name: handle.name, handle, state: 'denied', files: [], error: 'Folder could not be read. It may have moved; choose it again.' }); }
  changed();
}

const copyEntry = copy => ({ name: copy.name, savedAt: copy.savedAt, state: 'copy', files: copy.files.map(f => ({ path: f.path, file: f.file })) });

/** Reopen remembered folders without prompting and load saved copies. Runs once per page. */
export function restoreFolders() {
  return restored ??= (async () => {
    await Promise.all(FOLDER_KINDS.map(async kind => {
      const handle = supportsFolderHandles() ? await folderStore().get(kind) : null;
      if (folders.has(kind)) return;
      if (!handle) {
        const copy = kind === 'models' ? await folderStore().getCopy(kind) : null;
        if (copy?.files?.length) { folders.set(kind, copyEntry(copy)); changed(); }
        return;
      }
      const state = await folderPermission(handle);
      if (state === 'granted') await scan(kind, handle);
      else { folders.set(kind, { name: handle.name, handle, state: state === 'prompt' ? 'prompt' : 'denied', files: [] }); changed(); }
    }));
  })();
}

async function reconnect(kinds) {
  for (const kind of kinds) {
    const entry = folders.get(kind);
    if (!entry?.handle) continue;
    const state = await folderPermission(entry.handle, true);
    if (state === 'granted') await scan(kind, entry.handle);
    else { folders.set(kind, { ...entry, state: 'denied', error: 'Permission was not granted. Reconnect or choose the folder again.' }); changed(); }
  }
}

async function choose(kind, actions) {
  if (!supportsFolderHandles()) return pickOnce(kind, actions);
  let handle;
  // Chrome answers a Program Files or AppData folder with its own "Can't open this
  // folder" dialog, which reaches the page as an ordinary cancel. Offer the
  // one-time picker after any cancel so those folders can still be read.
  try { handle = await window.showDirectoryPicker({ id: 'avorion-' + kind, mode: 'read', startIn: folders.get(kind)?.handle || undefined }); }
  catch (error) { if (error?.name !== 'AbortError' && error?.name !== 'SecurityError') throw error; offerOnce.add(kind); changed(); return; }
  offerOnce.delete(kind);
  try { await folderStore().set(kind, handle); await folderStore().forgetCopy(kind); } catch { /* still usable this session */ }
  await scan(kind, handle);
  if (kind === 'textures') await loadPicked(kind, actions);
}

async function loadPicked(kind, actions) {
  const entry = folders.get(kind);
  if (entry?.files.length) await actions.loadTextures?.(entry.files.map(item => item.file));
}

/** The classic folder input: reads any folder, but the browser forgets it afterwards. */
async function pickOnce(kind, actions) {
  await new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.setAttribute('webkitdirectory', ''); input.hidden = true; document.body.append(input);
    input.oncancel = () => { input.remove(); resolve(); };
    input.onchange = () => {
      const filter = FILE_FILTERS[kind], all = [...input.files];
      if (all.length) folders.set(kind, { name: all[0].webkitRelativePath.split('/')[0], state: 'session', files: all.filter(f => !filter || filter.test(f.name)).map(file => ({ file, path: file.webkitRelativePath.split('/').slice(1).join('/') || file.name })) });
      input.remove(); changed(); resolve(all.length > 0);
    };
    input.click();
  }).then(async picked => {
    if (!picked) return;
    offerOnce.delete(kind);
    const entry = folders.get(kind);
    if (kind === 'textures') { await loadPicked(kind, actions); return; }
    if (kind !== 'models') return;
    // Ship XML is small, so keep a copy; the model browser then works on every visit.
    const copy = { name: entry.name, savedAt: Date.now(), files: entry.files.map(({ path, file }) => ({ path, file })) };
    try { await folderStore().setCopy(kind, copy); await folderStore().forget(kind); folders.set(kind, copyEntry(copy)); }
    catch { /* storage full or unavailable: the session copy still works */ }
    changed();
  });
}

async function forget(kind) {
  folders.delete(kind);
  try { await folderStore().forget(kind); await folderStore().forgetCopy(kind); } catch {}
  changed();
}

function statusText(kind) {
  const entry = folders.get(kind), saved = textureLibrary.loadedCount;
  const textures = kind === 'textures' ? (textureLibrary.scanning ? ' · restoring saved textures…' : saved ? ` · ${saved} texture maps saved in this browser` : '') : '';
  if (!entry) return kind === 'textures' ? (textureLibrary.scanning ? 'Restoring saved textures…' : saved ? `${saved} texture maps saved in this browser` : 'No folder chosen') : 'No folder chosen';
  if (entry.state === 'scanning') return `${entry.name} · reading folder…`;
  if (entry.state === 'copy') return `${entry.name} · ${entry.files.length} model${entry.files.length === 1 ? '' : 's'} · saved copy from ${new Date(entry.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
  if (entry.state === 'prompt') return `${entry.name} · needs one click to reconnect` + textures;
  if (entry.state === 'denied') return `${entry.name} · ${entry.error || 'not available'}` + textures;
  return `${entry.name} · ${entry.files.length} ${kind === 'models' ? 'model' : 'file'}${entry.files.length === 1 ? '' : 's'}${entry.state === 'session' ? ' · this session only' : ''}` + textures;
}

export function mountAssetLibrary(host, actions) {
  const remembered = supportsFolderHandles();
  const note = document.createElement('p'); note.className = 'panel-note';
  note.textContent = (remembered ? 'Folders you choose here are remembered and reopen on your next visit. If the browser asks again, one Reconnect click restores them all. ' : 'This browser cannot remember folders. ')
    + 'Loaded textures, and ships read with the one-time picker, are saved in this browser either way.';
  const banner = document.createElement('div'); banner.className = 'asset-folder asset-reconnect';
  const bannerText = document.createElement('span'); bannerText.className = 'panel-note';
  const reconnectAll = document.createElement('button'); reconnectAll.type = 'button'; reconnectAll.textContent = 'Reconnect folders';
  reconnectAll.onclick = () => reconnect(FOLDER_KINDS.filter(k => folders.get(k)?.state === 'prompt'));
  banner.append(bannerText, reconnectAll);
  host.append(note, banner);
  const renders = [];
  const renderBanner = () => {
    const waiting = FOLDER_KINDS.filter(k => folders.get(k)?.state === 'prompt');
    banner.hidden = !waiting.length;
    bannerText.textContent = waiting.length ? `${waiting.map(k => LABELS[k]).join(', ')} ${waiting.length === 1 ? 'folder needs' : 'folders need'} permission again.` : '';
  };
  for (const kind of FOLDER_KINDS) {
    const label = LABELS[kind];
    const row = document.createElement('div'); row.className = 'asset-folder';
    const pick = document.createElement('button'); pick.type = 'button';
    const status = document.createElement('span'); status.className = 'panel-note';
    const again = document.createElement('button'); again.type = 'button'; again.textContent = 'Reconnect';
    const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Load textures';
    const drop = document.createElement('button'); drop.type = 'button'; drop.textContent = 'Forget';
    const once = document.createElement('button'); once.type = 'button';
    const hint = document.createElement('p'); hint.className = 'panel-note asset-blocked-hint';
    hint.textContent = kind === 'models'
      ? 'Chrome cannot remember folders inside Program Files or AppData, where Avorion saves ships. Use the one-time picker for those: the app keeps a copy of your ships, so you only pick again to pick up new ones.'
      : 'Chrome cannot remember folders inside Program Files or AppData, where Steam installs Avorion. Use the one-time picker for those' + (kind === 'textures' ? ': loaded textures stay saved in this browser, so this is a one-time step.' : '.');
    // Models get a searchable browser below the row instead of a dropdown.
    const browserHost = kind === 'models' ? document.createElement('div') : null;
    let browser = null, browsed = null;
    const render = () => {
      const entry = folders.get(kind), list = ['connected', 'session', 'copy'].includes(entry?.state) ? entry.files : [];
      if (browserHost) {
        if (list.length && browsed !== list) { browsed = list; browser ??= mountModelBrowser(browserHost, { openModel: actions.openModel }); void browser.update(entry.name, list); }
        else if (!list.length && browser) { browser.dispose(); browser = null; browsed = null; }
      }
      pick.textContent = (entry ? 'Change ' : 'Choose ') + label + ' folder…';
      status.textContent = statusText(kind);
      again.hidden = !(entry?.state === 'prompt' || (entry?.state === 'denied' && entry.handle));
      drop.hidden = !(entry?.handle || entry?.state === 'copy');
      drop.title = entry?.state === 'copy' ? 'Delete the saved copy of these ships from this browser. Files on disk are not touched.' : 'Stop remembering this folder. Files on disk are not touched.';
      const refresh = entry?.state === 'copy';
      once.textContent = refresh ? 'Refresh…' : 'Use one-time picker…';
      once.title = refresh ? 'Pick the ships folder again to pick up ships saved since the copy was made.' : 'Read a folder the browser will not remember, such as one inside Program Files or AppData.';
      once.hidden = !(refresh || offerOnce.has(kind));
      hint.hidden = !offerOnce.has(kind);
      open.hidden = kind !== 'textures' || !list.length;
    };
    const run = async (button, job) => {
      button.disabled = true;
      try { await job(); } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
    };
    pick.onclick = () => run(pick, () => choose(kind, actions));
    once.onclick = () => run(once, () => pickOnce(kind, actions));
    again.onclick = () => run(again, () => reconnect([kind]));
    drop.onclick = () => run(drop, () => forget(kind));
    open.onclick = () => run(open, async () => {
      open.title = 'Loading selected assets. Wait for loading to finish.';
      await actions.loadTextures?.(folders.get(kind).files.map(item => item.file));
      open.title = 'Load selected assets';
      status.textContent = 'Loaded.';
    });
    row.append(pick, status, again, once, open, drop, hint); host.append(row);
    if (browserHost) host.append(browserHost);
    renders.push(render);
  }
  // Preferences re-mount this panel freely; drop listeners once its host has left the page.
  let seen = false;
  const alive = () => { if (host.isConnected) seen = true; else if (seen) { listeners.delete(renderAll); stopTextures(); return false; } return true; };
  const renderAll = () => { if (!alive()) return; renderBanner(); renders.forEach(r => r()); };
  const stopTextures = textureLibrary.subscribe(() => { if (alive()) renders[0](); });
  listeners.add(renderAll); renderAll();
  void restoreFolders();
}
