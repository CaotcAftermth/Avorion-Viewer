// Interface localization. English source strings are the keys, so untranslated text
// falls back to English and existing code keeps working without per-string IDs.
// Translation tables live in ./i18n/<code>.js and load on demand.
export const LANGUAGES = [
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['ja', '日本語'],
  ['pl', 'Polski'],
  ['pt-BR', 'Português (Brasil)'],
  ['ru', 'Русский'],
  ['zh', '中文（简体）']
];
// Language names stay in their own language so a user can always find theirs.
export const LANGUAGE_OPTIONS = [['auto', 'Automatic'], ...LANGUAGES];
const NATIVE_NAMES = new Set(LANGUAGES.map(([, name]) => name));

let active = 'en', table = {};
const tables = { en: {} };
const listeners = new Set();

export function resolveLanguage(code, preferred = globalThis.navigator?.languages || []) {
  if (code && code !== 'auto') return LANGUAGES.some(([id]) => id === code) ? code : 'en';
  for (const tag of preferred) {
    const lower = String(tag).toLowerCase();
    if (lower === 'pt-br' || lower.startsWith('pt')) return 'pt-BR';
    const base = lower.split('-')[0];
    const match = LANGUAGES.find(([id]) => id.toLowerCase() === base);
    if (match) return match[0];
  }
  return 'en';
}

export async function loadLanguage(code) {
  if (!tables[code]) tables[code] = (await import(`./i18n/${code}.js`)).default;
  return tables[code];
}

export async function setLanguage(code) {
  const next = resolveLanguage(code);
  let loaded;
  try { loaded = await loadLanguage(next); } catch { loaded = null; }
  const resolved = loaded ? next : 'en';
  if (resolved === active && table === (tables[resolved] || {})) return active;
  active = resolved; table = tables[resolved] || {};
  if (globalThis.document) document.documentElement.lang = active;
  listeners.forEach(listener => listener(active));
  return active;
}

export const currentLanguage = () => active;
export function onLanguageChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }

// Translate one English UI string. Menu check marks and trailing ellipses or arrows are
// kept outside the key so "✓  Outliner" and "Rename…" reuse the plain entries.
export function t(text) {
  if (active === 'en' || typeof text !== 'string' || !text || NATIVE_NAMES.has(text)) return text;
  if (Object.hasOwn(table, text)) return table[text];
  const mark = /^(✓\s+)(.+)$/.exec(text);
  if (mark) return mark[1] + t(mark[2]);
  return text;
}

// Translate a template such as 'Already assigned to {0}. Clear that binding first.'
export function tf(template, ...values) {
  return t(template).replace(/\{(\d+)\}/g, (_, i) => values[Number(i)] ?? '');
}

// Static markup (index.html dialogs, status bar) is translated in place. The English
// original is remembered per node; if code later replaces the text, the new text
// becomes the source. Switching languages, or back to English, therefore works.
const sources = new WeakMap();
function remember(node, slot, current) {
  let slots = sources.get(node);
  if (!slots) sources.set(node, slots = {});
  const entry = slots[slot];
  if (!entry || entry.written !== current) slots[slot] = { source: current, written: current };
  return slots[slot];
}
// Elements marked data-i18n-html hold inline markup (<b>, <code>) and translate as one
// HTML string; only trusted static markup from index.html uses it.
const ATTRIBUTES = ['title', 'aria-label', 'placeholder'];
export function translateDom(root) {
  if (!root) return;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest('script,style,code,kbd,pre,[data-no-translate],[data-i18n-html]')) continue;
      if (!node.nodeValue.trim()) continue;
      const entry = remember(node, 'text', node.nodeValue), core = entry.source.trim();
      node.nodeValue = entry.written = entry.source.replace(core, t(core));
      continue;
    }
    if (node.hasAttribute('data-i18n-html')) {
      const entry = remember(node, 'html', node.innerHTML);
      node.innerHTML = t(entry.source.trim());
      entry.written = node.innerHTML;
    }
    for (const name of ATTRIBUTES) {
      if (!node.hasAttribute(name)) continue;
      const entry = remember(node, name, node.getAttribute(name));
      node.setAttribute(name, entry.written = t(entry.source));
    }
  }
}
