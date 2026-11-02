// Crash recovery. While a model is on screen each tab keeps a small record in
// localStorage and removes it when the page closes cleanly. A record that is
// still there on the next launch, with no live tab holding it, means the last
// session ended without closing: the tab ran out of memory, the GPU reset, or
// the browser was killed. The saved model is then held back until the user
// chooses, so autoload cannot walk straight back into the same crash.
export const CRASH_PREFIX = 'avorion-viewer.crash-guard.v1.';
const LOCK_PREFIX = 'avorion-viewer.tab.';
const MEMORY_FAILURE = /out of memory|allocation failed|invalid array length|invalid typed array length|array buffer allocation/i;

function crashKeys(storage) {
  const keys = [];
  try { for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(CRASH_PREFIX)) keys.push(key); } } catch {}
  return keys;
}
function readRecord(storage, key) {
  try { const record = JSON.parse(storage.getItem(key) || 'null'); return record && typeof record.tab === 'string' ? record : null; } catch { return null; }
}
async function heldLocks(locks) {
  try { const { held = [] } = await locks.query(); return new Set(held.map(lock => lock.name)); } catch { return null; }
}

// Records left by tabs that are no longer running, newest first. Without the
// Web Locks API every record counts, which can only cause an extra prompt.
export async function findCrashRecords({ storage, locks = globalThis.navigator?.locks } = {}) {
  const keys = crashKeys(storage);
  if (!keys.length) return [];
  const live = locks?.query ? await heldLocks(locks) : null;
  return keys.map(key => ({ key, ...readRecord(storage, key) }))
    .filter(record => record.tab && !live?.has(LOCK_PREFIX + record.tab))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}
export function forgetCrashRecords(storage, records) { for (const { key } of records) try { storage.removeItem(key); } catch {} }

export function isMemoryFailure(error) {
  if (!error) return false;
  if (error.name === 'RangeError' && /alloc|array length|buffer|memory/i.test(error.message || '')) return true;
  return MEMORY_FAILURE.test(String(error.message || error));
}

export function createCrashGuard({ storage, scene, locks = globalThis.navigator?.locks, now = Date.now, frame = callback => requestAnimationFrame(callback) }) {
  const tab = Math.random().toString(36).slice(2, 10) + now().toString(36), key = CRASH_PREFIX + tab;
  let model = null, revision = null, phase = null, release = null;
  // Holding a lock for the tab's lifetime lets a later launch tell a crashed tab from one still open.
  try { locks?.request?.(LOCK_PREFIX + tab, () => new Promise(resolve => { release = resolve; }))?.catch?.(() => {}); } catch {}
  const write = next => { phase = next; try { storage.setItem(key, JSON.stringify({ tab, phase, fileName: model?.fileName || '', blocks: model?.blocks?.length || 0, at: now() })); } catch {} };
  const clear = () => { phase = null; try { storage.removeItem(key); } catch {} };
  function settle() {
    const watched = model; let frames = 0;
    const step = () => {
      if (model !== watched || phase !== 'loading') return;
      if (scene.renderPreparing) frames = 0; else if (++frames >= 3) { write('shown'); return; }
      frame(step);
    };
    frame(step);
  }
  return {
    tab,
    get phase() { return phase; },
    // Call after anything that may load, replace, rebuild or clear the model.
    track() {
      const current = scene.loaded ? scene.model : null;
      if (current === model && (!current || scene.revision === revision)) return;
      model = current; revision = scene.revision;
      if (!model) { clear(); return; }
      if (phase !== 'failed') { write('loading'); settle(); }
    },
    // A failure seen while it happens: keep the record so a reload still offers recovery.
    fail() { if (model) write('failed'); },
    // Clean exit (pagehide without bfcache).
    close() { clear(); },
    // Returning from the back/forward cache: re-arm for the model still shown.
    resume() { model = null; revision = null; phase = null; this.track(); },
    dispose() { clear(); release?.(); },
  };
}

const REASONS = {
  loading: name => `The viewer closed while loading ${name}. This usually means the model needed more memory than the browser allows.`,
  failed: name => `The graphics card or browser ran out of memory while showing ${name}.`,
  shown: name => `The viewer did not close cleanly while ${name} was open. It may have run out of memory.`,
  safe: name => `Safe start was requested. ${name} is still saved and has not been loaded.`,
};

// Resolves to 'clear', 'retry' or 'lite' (retry without restoring textures).
export function askCrashRecovery({ reason = 'shown', fileName = '', blocks = 0, translate = text => text } = {}) {
  const name = fileName ? `“${fileName}”` : 'the last model';
  const dialog = document.createElement('dialog');
  dialog.id = 'crash-recovery-dialog';
  dialog.setAttribute('aria-labelledby', 'crash-recovery-title');
  dialog.innerHTML = `
    <div class="dialog-heading"><span class="eyebrow"></span></div>
    <h1 id="crash-recovery-title"></h1>
    <p data-reason></p>
    <p class="dialog-note" data-detail></p>
    <div class="dialog-actions"><button type="button" data-choice="lite"></button><button type="button" data-choice="retry"></button><button type="button" class="primary" data-choice="clear"></button></div>`;
  dialog.querySelector('.eyebrow').textContent = translate('CRASH RECOVERY');
  dialog.querySelector('h1').textContent = translate(reason === 'safe' ? 'Safe start' : 'The last session did not finish');
  dialog.querySelector('[data-reason]').textContent = translate(REASONS[reason] ? REASONS[reason](name) : REASONS.shown(name));
  dialog.querySelector('[data-detail]').textContent = translate('Clear scene starts empty and keeps your textures. Your XML file on disk is not touched.') + (blocks ? ` (${blocks.toLocaleString()} ${translate('blocks')})` : '');
  dialog.querySelector('[data-choice=lite]').textContent = translate('Try without textures');
  dialog.querySelector('[data-choice=retry]').textContent = translate('Try again');
  dialog.querySelector('[data-choice=clear]').textContent = translate('Clear scene');
  document.body.append(dialog);
  return new Promise(resolve => {
    const done = choice => { dialog.close(); dialog.remove(); resolve(choice); };
    dialog.addEventListener('cancel', event => event.preventDefault()); // a choice is required
    dialog.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => done(button.dataset.choice)));
    dialog.showModal();
    dialog.querySelector('[data-choice=clear]').focus();
  });
}

// Shown once per page when memory or the graphics context fails mid-session.
export function warnLiveFailure({ message, clearScene, translate = text => text }) {
  if (document.getElementById('crash-live-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'crash-live-dialog';
  dialog.innerHTML = `<div class="dialog-heading"><span class="eyebrow"></span></div><h1></h1><p></p><div class="dialog-actions"><button type="button" data-keep></button><button type="button" class="primary" data-clear></button></div>`;
  dialog.querySelector('.eyebrow').textContent = translate('MEMORY WARNING');
  dialog.querySelector('h1').textContent = translate('The viewer is running out of memory');
  dialog.querySelector('p').textContent = translate(message) + ' ' + translate('Clearing the scene frees the model. If the page reloads, you will be asked before the model loads again.');
  dialog.querySelector('[data-keep]').textContent = translate('Keep model');
  dialog.querySelector('[data-clear]').textContent = translate('Clear scene');
  document.body.append(dialog);
  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector('[data-keep]').onclick = close;
  dialog.querySelector('[data-clear]').onclick = () => { close(); clearScene(); };
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}
