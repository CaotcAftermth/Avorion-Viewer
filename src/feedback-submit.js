import { t } from './i18n.js';

export const FEEDBACK_SERVICE = 'https://avorion-viewer-feedback.caotcaftermth.workers.dev';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
let turnstileLoading;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoading) {
    turnstileLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const timer = setTimeout(() => { script.remove(); reject(new Error('Verification could not load.')); }, 15000);
      script.onload = () => { clearTimeout(timer); window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification unavailable.')); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Verification could not load.')); };
      document.head.append(script);
    }).catch(error => { turnstileLoading = undefined; throw error; });
  }
  return turnstileLoading;
}

// Re-encode chosen screenshots so filenames and EXIF metadata are not uploaded.
export async function prepareScreenshot(file) {
  if (!['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Choose PNG or JPEG screenshots, at most 2 MiB each.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 32000000) throw new Error('Screenshot dimensions are too large.');
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare screenshot.');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('Screenshot exceeds 2 MiB after processing. Resize it and try again.');
    return blob;
  } finally { bitmap.close(); }
}

export function attachAnonymousFeedback(dialog, { report, title, kind, message }) {
  const area = document.createElement('section'); area.className = 'feedback-submit';
  area.innerHTML = `<p>Submit without a GitHub account. Your report and chosen screenshots become public on GitHub. Do not include passwords, personal information, or private game content.</p>
    <label class="feedback-message"><span>Screenshots (optional; up to 3 PNG/JPEG images, 2 MiB each)</span><input type="file" accept="image/png,image/jpeg" multiple data-images></label>
    <div class="feedback-images"></div>
    <label class="check-row"><input type="checkbox" data-consent> I reviewed the report and screenshots and agree to publish them publicly.</label>
    <p class="dialog-note">Only selected screenshots and the report preview are uploaded. Model and texture files stay on your device. Cloudflare processes the request and bot verification. Screenshots expire after 90 days.</p>
    <div data-verification></div>`;
  area.hidden = true;
  dialog.querySelector('.feedback-preview').after(area);
  const status = dialog.querySelector('.feedback-status'), files = area.querySelector('[data-images]');
  const thumbnails = area.querySelector('.feedback-images'), consent = area.querySelector('[data-consent]');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'primary';
  button.textContent = t('Submit public report'); button.hidden = true; button.disabled = true;
  dialog.querySelector('.dialog-actions').append(button);
  let images = [], objectUrls = [], widget, token = '', busy = false, preparing = false, closed = false, attempted = false, terminal = false, selection = 0;
  const id = crypto.randomUUID();
  const cleanupImages = () => { objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls = []; };
  const sync = () => {
    button.disabled = busy || preparing || terminal || !token || !consent.checked || !message().trim();
    dialog.querySelectorAll('[data-close]').forEach(control => { control.disabled = busy; });
  };
  dialog.addEventListener('input', sync);
  files.addEventListener('change', async () => {
    const version = ++selection;
    cleanupImages(); images = []; thumbnails.replaceChildren(); preparing = true; sync();
    try {
      const selected = [...files.files];
      if (selected.length > 3) throw new Error('Choose at most three screenshots.');
      const prepared = [];
      for (const file of selected) prepared.push(await prepareScreenshot(file));
      if (closed || version !== selection) return;
      images = prepared;
      images.forEach((image, index) => {
        const url = URL.createObjectURL(image); objectUrls.push(url);
        const figure = document.createElement('figure'), thumbnail = document.createElement('img'), caption = document.createElement('figcaption');
        thumbnail.src = url; thumbnail.alt = `Screenshot ${index + 1}`;
        caption.textContent = `Screenshot ${index + 1}`; figure.append(thumbnail, caption); thumbnails.append(figure);
      });
      status.textContent = '';
    } catch (error) {
      if (version === selection) { files.value = ''; status.textContent = t(error.message); }
    } finally { if (version === selection) { preparing = false; sync(); } }
  });
  button.onclick = async () => {
    if (button.disabled) return;
    if (report().length > 16000) { status.textContent = t('Report is too long. Shorten it or turn off recent errors.'); return; }
    busy = true;
    // Lock the snapshot on first attempt. Every retry uses the same UUID and content.
    if (!attempted) {
      attempted = true;
      dialog.querySelectorAll('textarea, input, .feedback-kinds button').forEach(el => { el.disabled = true; });
    }
    sync(); status.textContent = t('Submitting report…');
    const body = new FormData();
    for (const [key, value] of Object.entries({ id, kind: kind(), title: title(), report: report(), consent: 'true', token })) body.set(key, value);
    images.forEach((blob, index) => body.append('image', blob, `screenshot-${index + 1}.png`));
    try {
      const response = await fetch(`${FEEDBACK_SERVICE}/reports`, { method: 'POST', body, credentials: 'omit', signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (closed) return;
      if (!response.ok) {
        terminal = result.uncertain === true;
        throw new Error(result.error || 'Submission failed.');
      }
      if (!/^https:\/\/github\.com\/CaotcAftermth\/Avorion-Viewer\/issues\/\d+$/.test(result.issueUrl)) throw new Error('The server returned an unexpected issue link.');
      terminal = true;
      status.textContent = t('Report submitted.');
      const link = document.createElement('a'); link.href = result.issueUrl; link.textContent = t('View GitHub issue'); link.target = '_blank'; link.rel = 'noopener noreferrer';
      status.append(' ', link);
      button.textContent = t('Submitted');
    } catch (error) {
      if (!closed) status.textContent = `${t(error.message)} ${t('Report reference:')} ${id}${terminal ? '' : ' ' + t('Retry uses the same reference to avoid duplicates.')}`;
    } finally {
      busy = false; token = '';
      if (!closed && widget !== undefined) window.turnstile?.reset(widget);
      sync();
    }
  };
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    closed = true; selection++; cleanupImages();
    if (widget !== undefined) window.turnstile?.remove(widget);
  }, { once: true });
  // No third-party challenge is loaded until the user opens feedback and the service is enabled.
  (async () => {
    try {
      const response = await fetch(`${FEEDBACK_SERVICE}/config`, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Anonymous reporting unavailable. Use the GitHub link or copy your report.');
      const config = await response.json();
      if (closed) return;
      if (!config.enabled || !config.siteKey) throw new Error('Anonymous reporting unavailable. Use the GitHub link or copy your report.');
      const turnstile = await loadTurnstile();
      if (closed) return;
      area.hidden = false; button.hidden = false;
      widget = turnstile.render(area.querySelector('[data-verification]'), {
        sitekey: config.siteKey, action: 'feedback', theme: 'auto',
        callback: value => { token = value; sync(); },
        'expired-callback': () => { token = ''; sync(); },
        'error-callback': () => { token = ''; status.textContent = t('Verification failed. Use the GitHub link or reopen feedback to try again.'); sync(); },
      });
    } catch { if (!closed) status.textContent = t('Anonymous reporting unavailable. Use the GitHub link or copy your report.'); }
  })();
}
