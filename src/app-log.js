// Shared activity log. The Info editor renders it; any module can report into it
// without importing app.js. Errors and warnings keep their level so the Info
// editor can filter them and the feedback report can attach the recent ones.
export const LOG_LIMIT = 200;
const entries = [], listeners = new Set();
const REPEAT_WINDOW = 4000;

export function logEntries() { return entries; }
export function onLog(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function emit() { listeners.forEach(listener => listener(entries)); }

export function errorText(error) {
  if (error == null) return 'Unknown error';
  if (typeof error === 'string') return error;
  return String(error.message || error.reason?.message || error.reason || error) || 'Unknown error';
}

// Repeats of the same message (a render loop failing every frame) collapse into one row.
export function addLog(message, category = 'LAYOUT', level = 'info', detail = '') {
  const text = String(message ?? '').trim().slice(0, 2000) || 'Unknown error';
  const last = entries[entries.length - 1], now = new Date();
  if (last && last.message === text && last.category === category && last.level === level && now - last.time < REPEAT_WINDOW) {
    last.count = (last.count || 1) + 1; last.time = now; emit(); return last;
  }
  const entry = { time: now, category, message: text, level, ...(detail ? { detail: String(detail).slice(0, 4000) } : {}) };
  entries.push(entry);
  if (entries.length > LOG_LIMIT) entries.splice(0, entries.length - LOG_LIMIT);
  emit();
  return entry;
}
export function reportError(error, category = 'ERROR') {
  if (error?.name === 'AbortError') return null;
  return addLog(errorText(error), category, 'error', error?.stack || '');
}
export function reportWarning(message, category = 'WARNING') { return addLog(errorText(message), category, 'warning'); }
export function clearLog() { entries.length = 0; emit(); }
export function errorCount() { return entries.reduce((n, e) => n + (e.level === 'error' ? (e.count || 1) : 0), 0); }
export function recentProblems(limit = 10) { return entries.filter(e => e.level !== 'info').slice(-limit); }

// Uncaught errors, rejected promises and console.error output (three.js reports
// shader compile failures there) all land in the log.
let installed = false;
const IGNORED = /ResizeObserver loop|Script error\.?$/;
export function installGlobalErrorCapture(target = globalThis) {
  if (installed || !target?.addEventListener) return;
  installed = true;
  target.addEventListener('error', event => {
    if (event.target && event.target !== target) return; // optional asset probes are not app errors
    const text = errorText(event.error || event.message);
    if (!IGNORED.test(text)) addLog(text, 'UNCAUGHT', 'error', event.error?.stack || (event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : ''));
  });
  target.addEventListener('unhandledrejection', event => {
    if (event.reason?.name === 'AbortError') return;
    addLog(errorText(event.reason), 'UNCAUGHT', 'error', event.reason?.stack || '');
  });
  const console = target.console;
  if (console?.error) {
    const original = console.error.bind(console);
    console.error = (...args) => {
      original(...args);
      try {
        const text = args.map(a => a instanceof Error ? a.message : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(' ').replace(/%c/g, '');
        if (!IGNORED.test(text)) addLog(text.slice(0, 600), 'CONSOLE', 'error', args.find(a => a instanceof Error)?.stack || '');
      } catch { /* never let logging break the caller */ }
    };
  }
}
