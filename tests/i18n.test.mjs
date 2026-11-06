import test from 'node:test';
import assert from 'node:assert/strict';
import { activeViewportTheme, editorTheme, PREFERENCE_SECTIONS, FACTORY_PREFERENCES, createPreferencesStore, customColorSeed, validPreference, FIELDS } from '../src/preferences.js';
import { LANGUAGES, resolveLanguage, setLanguage, t, tf, currentLanguage } from '../src/i18n.js';

const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; };
const preferenceText = () => PREFERENCE_SECTIONS.flatMap(s => [s.label, ...s.panels.flatMap(p => [p.label, ...p.fields.flatMap(f => [f.label, f.description, ...(f.options || []).map(o => o[1])])])]);

test('browser language resolves to a supported interface language', () => {
  assert.equal(resolveLanguage('auto', ['de-AT', 'en']), 'de');
  assert.equal(resolveLanguage('auto', ['pt-BR']), 'pt-BR');
  assert.equal(resolveLanguage('auto', ['pt-PT']), 'pt-BR');
  assert.equal(resolveLanguage('auto', ['zh-CN']), 'zh');
  assert.equal(resolveLanguage('auto', ['ja-JP']), 'ja');
  assert.equal(resolveLanguage('auto', ['pl-PL']), 'pl');
  assert.equal(resolveLanguage('auto', ['ko-KR']), 'en');
  assert.equal(resolveLanguage('fr'), 'fr');
  assert.equal(resolveLanguage('xx'), 'en');
});

test('every language translates every preference string and keeps placeholders', async () => {
  const text = [...new Set(preferenceText())].filter(s => /[A-Za-z]/.test(s) && !LANGUAGES.some(([, name]) => name === s));
  for (const [code] of LANGUAGES.filter(([code]) => code !== 'en')) {
    const table = (await import(`../src/i18n/${code}.js`)).default;
    const missing = text.filter(s => !Object.hasOwn(table, s));
    assert.equal(missing.length, 0, `${code} missing ${missing.length}: ${missing.slice(0, 12).join(' | ')}`);
    for (const [source, translated] of Object.entries(table)) {
      for (const token of ['{0}', '<code>', '<br>']) assert.equal(translated.split(token).length, source.split(token).length, `${code}: ${token} in "${source}"`);
    }
  }
});

test('t falls back to English and handles menu check marks and templates', async () => {
  await setLanguage('de');
  assert.equal(currentLanguage(), 'de');
  assert.equal(t('Preferences'), 'Einstellungen');
  assert.equal(t('✓  Outliner'), '✓  Outliner');
  assert.equal(t('✓  Properties'), '✓  Eigenschaften');
  assert.equal(t('Not a known string'), 'Not a known string');
  assert.equal(tf('Change {0}', 'X'), 'X ändern');
  await setLanguage('en');
  assert.equal(t('Preferences'), 'Preferences');
});

test('language preference defaults to automatic and validates codes', () => {
  assert.equal(FACTORY_PREFERENCES.language, 'auto');
  assert.ok(validPreference('language', 'pt-BR'));
  assert.ok(!validPreference('language', 'jp'));
});

test('number defaults sit on their step grid so browsers do not flag them invalid', () => {
  for (const field of Object.values(FIELDS).filter(f => f.type === 'number')) {
    const steps = (field.default - field.min) / field.step;
    assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6, `${field.key} default ${field.default} is off its ${field.step} step from ${field.min}`);
  }
});

test('enabling editor custom colors starts from the active theme', () => {
  const store = createPreferencesStore(memory());
  store.set('theme', 'graphite');
  store.set('outlinerCustomColors', true);
  assert.equal(store.value.outlinerBackground, '#272e38');
  assert.equal(store.value.outlinerHeader, '#303a47');
  // Colors the user already chose are not overwritten.
  store.set('outlinerCustomColors', false); store.set('outlinerText', '#123456'); store.set('theme', 'contrast');
  assert.deepEqual(customColorSeed(store.value, 'outlinerCustomColors'), {});
});

test('viewport presets apply exact colors and preserve unrelated theme settings',()=>{
  const storage=memory(),store=createPreferencesStore(storage);
  store.set('viewportHeader','#123456');
  for(const [key,bottom,top] of [
    ['blender','#393939'],['maya','#4e4e4e','#2a2a2a'],['max','#444444','#1d1d1d'],
    ['cinema4d','#4a4a4a','#313131'],['zbrush','#3c3c3c','#000000'],['sketchup','#ccccc9']
  ]){
    assert.ok(store.set('viewportTheme',key));
    assert.equal(activeViewportTheme(store.value),key);
    assert.equal(editorTheme(store.value,'viewport').background,bottom);
    assert.equal(store.value.viewportGradient,!!top);
    if(top)assert.equal(store.value.viewportGradientTop,top);
    assert.equal(store.value.viewportHeader,'#123456');
    assert.equal(store.value.theme,'blender');
  }
  store.set('viewportBackground','#112233');store.save();
  assert.equal(activeViewportTheme(createPreferencesStore(storage).value),'custom');
});
