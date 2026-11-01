// Model browser for the Asset Library's models folder.
// Lists every ship in the folder (subfolders included) with search, block
// counts, size and date, plus Favorites and Recent. Block counts are read once
// per file version and cached with the favorites/recent lists in IndexedDB.
import { openSessionStore } from './session-persistence.js';

const KEY = 'model-library', MAX_ROWS = 500, MAX_RECENT = 20;

export function blockCount(xml) {
  const matches = xml.match(/<block[\s/>]/g);
  return matches ? matches.length : 0;
}
const fileKey = (folder, item) => `${folder}/${item.path}|${item.file.size}|${item.file.lastModified}`;
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
/** Case-insensitive match on every word against path and name. */
export function filterModels(items, query, { view = 'all', favorites = new Set(), recent = [], folder = '' } = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = items.filter(item => words.every(w => item.path.toLowerCase().includes(w)));
  if (view === 'favorites') list = list.filter(item => favorites.has(folder + '/' + item.path));
  if (view === 'recent') {
    const order = new Map(recent.map((path, i) => [path, i]));
    list = list.filter(item => order.has(folder + '/' + item.path)).sort((a, b) => order.get(folder + '/' + a.path) - order.get(folder + '/' + b.path));
  }
  return list;
}

export function createModelLibraryState(store = openSessionStore()) {
  let data, loading, saveTimer;
  const load = () => loading ??= store.get(KEY).catch(() => null).then(saved => {
    data = { meta: saved?.meta || {}, favorites: new Set(saved?.favorites || []), recent: saved?.recent || [] };
    return data;
  });
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.put(KEY, { meta: data.meta, favorites: [...data.favorites], recent: data.recent }).catch(() => {}), 300); };
  return {
    load,
    get data() { return data; },
    setMeta(key, meta) { data.meta[key] = meta; save(); },
    toggleFavorite(path) { if (data.favorites.has(path)) data.favorites.delete(path); else data.favorites.add(path); save(); },
    opened(path) { data.recent = [path, ...data.recent.filter(p => p !== path)].slice(0, MAX_RECENT); save(); },
    /** Drop cached counts for files that no longer exist in the scanned folders. */
    prune(liveKeys) { let dropped = false; for (const key of Object.keys(data.meta)) if (!liveKeys.has(key) && key.startsWith(liveKeys.folder + '/')) { delete data.meta[key]; dropped = true; } if (dropped) save(); },
  };
}

let shared;
const sharedState = () => shared ??= createModelLibraryState();

/**
 * Mount the browser. `folder` is the folder name, `items` the scanned [{file, path}].
 * Returns { update(folder, items), dispose() }.
 */
export function mountModelBrowser(host, { openModel, state = sharedState() } = {}) {
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', 'model-browser');
  const bar = el('div', 'model-browser-bar');
  const search = el('input'); search.type = 'search'; search.placeholder = 'Search models'; search.setAttribute('aria-label', 'Search models');
  const views = el('div', 'model-browser-views'); views.setAttribute('role', 'tablist');
  const viewButtons = Object.fromEntries([['all', 'All'], ['favorites', 'Favorites'], ['recent', 'Recent']].map(([id, label]) => {
    const b = el('button', '', label); b.type = 'button'; b.setAttribute('role', 'tab'); b.onclick = () => { view = id; render(); }; views.append(b); return [id, b];
  }));
  const list = el('div', 'model-browser-list'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Models'); list.tabIndex = 0;
  const footer = el('div', 'model-browser-footer');
  const count = el('span', 'panel-note');
  const open = el('button', '', 'Open model'); open.type = 'button';
  footer.append(count, open);
  bar.append(search, views);
  root.append(bar, list, footer);
  host.append(root);

  let folder = '', items = [], view = 'all', selected = null, disposed = false, metaRun = 0;
  const pathOf = item => folder + '/' + item.path;
  const doOpen = async item => {
    if (!item) return;
    open.disabled = true;
    try { state.opened(pathOf(item)); await openModel?.(item.file); } catch (error) { count.textContent = error.message; } finally { open.disabled = false; render(); }
  };
  open.onclick = () => doOpen(selected);
  search.oninput = () => render();
  list.onkeydown = event => {
    const shown = [...list.querySelectorAll('.model-row')];
    const i = shown.findIndex(r => r.classList.contains('selected'));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = shown[Math.max(0, Math.min(shown.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1)))];
      next?.click(); next?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') { event.preventDefault(); doOpen(selected); }
  };

  function row(item) {
    const data = state.data, path = pathOf(item), meta = data.meta[fileKey(folder, item)];
    const r = el('div', 'model-row'); r.setAttribute('role', 'option');
    const star = el('button', 'model-star', data.favorites.has(path) ? '★' : '☆'); star.type = 'button';
    star.title = data.favorites.has(path) ? 'Remove from Favorites' : 'Add to Favorites'; star.setAttribute('aria-label', star.title);
    star.onclick = event => { event.stopPropagation(); state.toggleFavorite(path); render(); };
    const slash = item.path.lastIndexOf('/');
    const name = el('span', 'model-name', item.path.slice(slash + 1).replace(/\.xml$/i, ''));
    const where = el('span', 'model-folder', slash > 0 ? item.path.slice(0, slash) : '');
    const blocks = el('span', 'model-meta', meta ? meta.blocks.toLocaleString() + (meta.blocks === 1 ? ' block' : ' blocks') : '…');
    const size = el('span', 'model-meta', formatSize(item.file.size));
    const date = el('span', 'model-meta', new Date(item.file.lastModified).toLocaleDateString());
    const label = el('span', 'model-label'); label.append(name, where);
    r.append(star, label, blocks, size, date);
    r.title = item.path;
    if (selected === item) { r.classList.add('selected'); r.setAttribute('aria-selected', 'true'); }
    r.onclick = () => { selected = item; list.querySelectorAll('.model-row.selected').forEach(n => { n.classList.remove('selected'); n.removeAttribute('aria-selected'); }); r.classList.add('selected'); r.setAttribute('aria-selected', 'true'); open.disabled = false; };
    r.ondblclick = () => doOpen(item);
    return r;
  }

  function render() {
    if (disposed || !state.data) return;
    for (const [id, b] of Object.entries(viewButtons)) { b.classList.toggle('active', id === view); b.setAttribute('aria-selected', String(id === view)); }
    const shown = filterModels(items, search.value, { view, favorites: state.data.favorites, recent: state.data.recent, folder });
    if (selected && !shown.includes(selected)) selected = null;
    list.replaceChildren(...shown.slice(0, MAX_ROWS).map(row));
    if (!shown.length) list.append(el('p', 'panel-note', items.length ? (view === 'favorites' ? 'No favorites yet. Click ☆ to add one.' : view === 'recent' ? 'No recently opened models in this folder.' : 'No models match.') : 'No models in this folder.'));
    count.textContent = `${shown.length.toLocaleString()} of ${items.length.toLocaleString()} models` + (shown.length > MAX_ROWS ? ` · showing first ${MAX_ROWS}, refine the search` : '');
    open.disabled = !selected;
  }

  // Count blocks for files not seen before, a few at a time, refreshing as results arrive.
  async function fillMeta() {
    const run = ++metaRun, pending = items.filter(item => !state.data.meta[fileKey(folder, item)]);
    let next = 0, since = 0;
    const live = new Set(items.map(item => fileKey(folder, item))); live.folder = folder; state.prune(live);
    const worker = async () => {
      while (next < pending.length && run === metaRun && !disposed) {
        const item = pending[next++];
        try { state.setMeta(fileKey(folder, item), { blocks: blockCount(await item.file.text()) }); } catch { state.setMeta(fileKey(folder, item), { blocks: 0 }); }
        if (++since >= 25) { since = 0; render(); }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (run === metaRun) render();
  }

  return {
    async update(nextFolder, nextItems) {
      folder = nextFolder; items = nextItems || [];
      if (!items.includes(selected)) selected = null;
      await state.load(); render(); void fillMeta();
    },
    dispose() { disposed = true; metaRun++; root.remove(); },
  };
}
