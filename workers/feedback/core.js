// Limits are also enforced by the Worker; browser checks are only for usability.
export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 7 * 1024 * 1024;
export const MAX_REPORT_CHARS = 16000;
export const REPORT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class FeedbackError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const json = (value, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export async function limitedBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_REQUEST_BYTES) throw new FeedbackError(413, 'Report is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new FeedbackError(400, 'Missing report.');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new FeedbackError(413, 'Report is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export function imageType(bytes) {
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)
    && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width > 8192 || height > 8192 || width * height > 32000000) return null;
    return { extension: 'png', mime: 'image/png' };
  }
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    && bytes.at(-2) === 255 && bytes.at(-1) === 217) return { extension: 'jpg', mime: 'image/jpeg' };
  return null;
}

export async function parseReport(form) {
  const allowed = new Set(['id', 'kind', 'title', 'report', 'consent', 'token', 'image']);
  for (const key of form.keys()) if (!allowed.has(key)) throw new FeedbackError(400, 'Unexpected report field.');
  const field = (key, max) => {
    const values = form.getAll(key), value = values[0];
    if (values.length !== 1 || typeof value !== 'string' || value.length > max || !value.trim()) throw new FeedbackError(400, `Invalid ${key}.`);
    return value.trim();
  };
  const id = field('id', 36), kind = field('kind', 10), title = field('title', 100), report = field('report', MAX_REPORT_CHARS);
  if (!REPORT_ID.test(id) || !['bug', 'idea', 'other'].includes(kind) || field('consent', 4) !== 'true') throw new FeedbackError(400, 'Invalid report or missing public-post consent.');
  const token = field('token', 2048), images = [];
  const files = form.getAll('image');
  if (files.length > MAX_IMAGES) throw new FeedbackError(400, 'Attach at most three screenshots.');
  for (const file of files) {
    if (typeof file === 'string' || !file.size || file.size > MAX_IMAGE_BYTES) throw new FeedbackError(400, 'Each screenshot must be at most 2 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer()), type = imageType(bytes);
    if (!type || file.type !== type.mime) throw new FeedbackError(400, 'Only PNG and JPEG screenshots are accepted.');
    images.push({ bytes, ...type });
  }
  return { id, kind, title, report, token, images };
}

export async function hash(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
export async function reportHash(report) {
  return hash(JSON.stringify([report.kind, report.title, report.report, await Promise.all(report.images.map(i => hash(i.bytes)))]));
}
export async function verifyTurnstile(token, ip, env, origin, send = fetch) {
  try {
    const response = await send('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && result.action === 'feedback' && result.hostname === new URL(origin).hostname;
  } catch { return false; }
}
// Prevent anonymous reports from pinging GitHub users or embedding remote tracking images.
export function publicText(value) {
  return value.replace(/@/g, '@\u200b').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/!/g, '&#33;');
}
export function issueBody(report, imageUrls) {
  const images = imageUrls.map((url, index) => `![Screenshot ${index + 1}](${url})`);
  return `${publicText(report.report)}\n\n${images.join('\n\n')}\n\nSubmitted anonymously through Avorion Viewer.\n\n<!-- avorion-feedback:${report.id} -->`;
}
