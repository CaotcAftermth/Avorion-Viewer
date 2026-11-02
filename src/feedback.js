// Help > Send feedback. Anonymous submission uses a separate Cloudflare Worker.
import { attachAnonymousFeedback } from './feedback-submit.js';
import { APP_VERSION, FEATURE_AREAS } from './version.js';
import { recentProblems } from './app-log.js';
import { t, translateDom } from './i18n.js';

export const FEEDBACK_TARGETS = {
  issues: 'https://github.com/CaotcAftermth/Avorion-Viewer/issues',
  email: ''   // e.g. 'feedback@example.com'
};
export const FEEDBACK_KINDS = [['bug', 'Bug report'], ['idea', 'Idea or request'], ['other', 'Other']];
// Browsers and mail apps cut long links; past these the full report goes to the clipboard.
const ISSUE_URL_LIMIT = 7000, MAIL_URL_LIMIT = 1800;

function webglRenderer() {
  try {
    const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2');
    if (!gl) return 'WebGL2 unavailable';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(name);
  } catch { return 'unknown'; }
}

export function feedbackSystemInfo(context = {}) {
  const nav = globalThis.navigator || {}, scr = globalThis.screen || {};
  return [
    ['App', `Avorion Viewer ${APP_VERSION}`],
    ['Page', globalThis.location ? location.origin + location.pathname : ''],
    ['Browser', nav.userAgent || 'unknown'],
    ['Interface language', context.language || 'en'],
    ['Screen', scr.width ? `${scr.width}×${scr.height} @${globalThis.devicePixelRatio || 1}x` : 'unknown'],
    ['Graphics', context.renderer ?? webglRenderer()],
    ['Model', context.model || 'none loaded'],
    ['Textures', context.textures ?? 'unknown'],
  ].filter(([, value]) => value !== '');
}

export function buildFeedbackReport({ kind = 'bug', message = '', includeSystem = true, includeErrors = true, system = [], problems = [] } = {}) {
  const label = FEEDBACK_KINDS.find(([id]) => id === kind)?.[1] || 'Feedback';
  const lines = [`### ${label}`, '', message.trim() || '(no description)', ''];
  if (includeSystem && system.length) lines.push('### System', '', ...system.map(([k, v]) => `- **${k}:** ${v}`), '');
  if (includeErrors) {
    lines.push('### Recent errors and warnings', '');
    if (!problems.length) lines.push('None recorded this session.');
    for (const p of problems) lines.push(`- \`${p.time.toLocaleTimeString([], { hour12: false })}\` **${p.level}** ${p.category}: ${p.message}${p.count > 1 ? ` (×${p.count})` : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function feedbackTitle(kind, message) {
  const first = message.trim().split('\n')[0].slice(0, 80);
  const prefix = kind === 'bug' ? 'Bug' : kind === 'idea' ? 'Idea' : 'Feedback';
  return `${prefix}: ${first || `Avorion Viewer ${APP_VERSION}`}`;
}

export function issueUrl(base, title, body, kind) {
  if (!base) return '';
  const url = new URL(base.replace(/\/+$/, '').replace(/\/issues(\/new)?$/, '') + '/issues/new');
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (kind === 'bug' || kind === 'idea') url.searchParams.set('labels', kind === 'bug' ? 'bug' : 'enhancement');
  return url.href;
}
export function mailUrl(address, title, body) {
  if (!address) return '';
  return `mailto:${encodeURIComponent(address).replace(/%40/g, '@')}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.append(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove(); return ok;
  }
}

const node = (tag, className = '', text = '') => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = t(text); return el; };

export function openFeedback(context = {}, { kind = 'bug', notify = () => {} } = {}) {
  document.querySelector('#feedback-dialog')?.remove();
  const dialog = node('dialog'); dialog.id = 'feedback-dialog'; dialog.className = 'feedback-dialog'; dialog.setAttribute('aria-labelledby', 'feedback-title');
  dialog.innerHTML = `<div class="dialog-heading"><span class="eyebrow">FEEDBACK · v${APP_VERSION}</span><button type="button" class="icon-button" data-close aria-label="Close">×</button></div>
    <h2 id="feedback-title">Send feedback</h2>
    <p>Tell us what went wrong or what you would like. Review your report before sharing it. Reports on GitHub are public.</p>
    <div class="feedback-kinds" role="radiogroup" aria-label="Feedback type"></div>
    <label class="feedback-message"><span>Describe it</span><textarea rows="6" maxlength="4000" placeholder="What did you do, what did you expect, and what happened instead?"></textarea></label>
    <label class="check-row"><input type="checkbox" data-system> Include app version, browser, graphics details and model name</label>
    <label class="check-row"><input type="checkbox" data-errors> <span>Include recent errors from the Info editor</span> <span class="feedback-error-count"></span></label>
    <details class="feedback-preview"><summary>Preview report</summary><pre></pre></details>
    <p class="dialog-note feedback-destination"></p>
    <p class="feedback-status" role="status"></p>
    <div class="dialog-actions"><button type="button" data-close>Cancel</button><button type="button" data-copy>Copy report</button></div>`;
  const kinds = dialog.querySelector('.feedback-kinds'), text = dialog.querySelector('textarea'), system = dialog.querySelector('[data-system]'), errors = dialog.querySelector('[data-errors]');
  const preview = dialog.querySelector('pre'), status = dialog.querySelector('.feedback-status'), actions = dialog.querySelector('.dialog-actions');
  let chosen = kind;
  for (const [id, label] of FEEDBACK_KINDS) {
    const b = node('button', '', label); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.kind = id;
    b.onclick = () => { chosen = id; sync(); }; kinds.append(b);
  }
  const problems = recentProblems(10), info = feedbackSystemInfo(context);
  dialog.querySelector('.feedback-error-count').textContent = problems.length ? `(${problems.length})` : `(${t('none')})`;
  const report = () => buildFeedbackReport({ kind: chosen, message: text.value, includeSystem: system.checked, includeErrors: errors.checked, system: info, problems });
  const title = () => feedbackTitle(chosen, text.value);
  const destinations = [];
  if (FEEDBACK_TARGETS.issues) destinations.push(['Open GitHub issue', () => issueUrl(FEEDBACK_TARGETS.issues, title(), report(), chosen), ISSUE_URL_LIMIT, url => issueUrl(FEEDBACK_TARGETS.issues, title(), `${report().slice(0, 1500)}\n\n…report shortened. The full report is on your clipboard: paste it here.`, chosen)]);
  if (FEEDBACK_TARGETS.email) destinations.push(['Email report', () => mailUrl(FEEDBACK_TARGETS.email, title(), report()), MAIL_URL_LIMIT, () => mailUrl(FEEDBACK_TARGETS.email, title(), 'The full report is on your clipboard. Paste it here.')]);
  dialog.querySelector('.feedback-destination').textContent = t(destinations.length ? 'The report opens prefilled. Review it before you send it.' : 'Copy the report and paste it wherever you share feedback with the developer.');
  destinations.forEach(([label, build, limit, shortened], index) => {
    const b = node('button', index === destinations.length - 1 ? 'primary' : '', label); b.type = 'button';
    b.onclick = async () => {
      if (!text.value.trim()) { status.textContent = t('Add a short description first.'); text.focus(); return; }
      let url = build();
      if (url.length > limit) { await copyText(report()); url = shortened(); status.textContent = t('Report copied to the clipboard because it is too long for a link.'); }
      window.open(url, '_blank', 'noopener,noreferrer');
    };
    actions.append(b);
  });
  if (!destinations.length) dialog.querySelector('[data-copy]').classList.add('primary');
  dialog.querySelector('[data-copy]').onclick = async () => {
    const ok = await copyText(report());
    status.textContent = t(ok ? 'Report copied to the clipboard.' : 'Could not copy. Select the preview text and copy it.');
    if (!ok) dialog.querySelector('details').open = true; else notify('Feedback report copied.');
  };
  function sync() {
    kinds.querySelectorAll('button').forEach(b => { const on = b.dataset.kind === chosen; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
    preview.textContent = report();
  }
  for (const el of [text, system, errors]) el.addEventListener('input', sync);
  dialog.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  translateDom(dialog); sync();
  document.body.append(dialog); dialog.showModal();
  attachAnonymousFeedback(dialog, { report, title, kind: () => chosen, message: () => text.value });
  text.focus();
  return dialog;
}

export function openAbout({ openFeedback: feedback } = {}) {
  document.querySelector('#about-dialog')?.remove();
  const dialog = node('dialog'); dialog.id = 'about-dialog'; dialog.className = 'about-dialog'; dialog.setAttribute('aria-labelledby', 'about-title');
  dialog.innerHTML = `<div class="dialog-heading"><span class="eyebrow">ABOUT</span><button type="button" class="icon-button" data-close aria-label="Close">×</button></div>
    <h2 id="about-title">Avorion Viewer <span class="about-version" data-no-translate></span></h2>
    <p>Pre-release. The middle number counts the major feature areas below; the last number counts smaller features and fixes since the latest one. 1.0 marks the first stable release.</p>
    <ol class="about-areas"></ol>
    <div class="dialog-actions"><button type="button" data-feedback>Send feedback…</button><button type="button" class="primary" data-close>Close</button></div>`;
  dialog.querySelector('.about-version').textContent = `v${APP_VERSION}`;
  const list = dialog.querySelector('.about-areas');
  for (const [version, name, detail] of FEATURE_AREAS) {
    const item = node('li'); const v = node('span', 'about-area-version'); v.textContent = version; v.dataset.noTranslate = '';
    item.append(v, node('b', '', name), node('span', 'about-area-detail', detail)); list.append(item);
  }
  dialog.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dialog.close());
  dialog.querySelector('[data-feedback]').onclick = () => { dialog.close(); feedback?.(); };
  dialog.addEventListener('close', () => dialog.remove());
  translateDom(dialog); document.body.append(dialog); dialog.showModal();
  return dialog;
}
