import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { limitedBody, MAX_REQUEST_BYTES, parseReport, verifyTurnstile, issueBody } from '../workers/feedback/core.js';

const origin = 'https://avorion-viewer.com';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
function form(id = crypto.randomUUID(), overrides = {}, images = []) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ id, kind: 'bug', title: 'Bug: Paint failed', report: 'Paint did not update.', consent: 'true', token: crypto.randomUUID(), ...overrides })) result.set(key, value);
  for (const image of images) result.append('image', image, 'private-filename.png');
  return result;
}
const image = () => new Blob([png], { type: 'image/png' });

test('feedback validates consent, file bytes, repeated fields, count and text size', async () => {
  assert.equal((await parseReport(form(undefined, {}, [image()]))).images[0].extension, 'png');
  await assert.rejects(parseReport(form(undefined, { consent: 'false' })), /consent/);
  await assert.rejects(parseReport(form(undefined, { report: 'x'.repeat(16001) })), /report/);
  await assert.rejects(parseReport(form(undefined, {}, [new Blob(['<svg></svg>'], { type: 'image/png' })])), /PNG/);
  await assert.rejects(parseReport(form(undefined, {}, [image(), image(), image(), image()])), /three/);
  const duplicate = form(); duplicate.append('title', 'other');
  await assert.rejects(parseReport(duplicate), /title/);
});

test('feedback bounds streamed requests even without Content-Length', async () => {
  const request = new Request('https://example.test', { method: 'POST', duplex: 'half', body: new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close();
  } }) });
  await assert.rejects(limitedBody(request), error => error.status === 413);
});

test('Turnstile requires success, correct action and exact frontend hostname', async () => {
  const env = { TURNSTILE_SECRET: 'test-only' };
  for (const [result, expected] of [
    [{ success: true, action: 'feedback', hostname: 'avorion-viewer.com' }, true],
    [{ success: false, action: 'feedback', hostname: 'avorion-viewer.com' }, false],
    [{ success: true, action: 'login', hostname: 'avorion-viewer.com' }, false],
    [{ success: true, action: 'feedback', hostname: 'localhost' }, false],
  ]) assert.equal(await verifyTurnstile('token', '192.0.2.1', env, origin, async () => Response.json(result)), expected);
  assert.equal(await verifyTurnstile('token', '192.0.2.1', env, origin, async () => { throw new Error('offline'); }), false);
});

test('anonymous text cannot add external image embeds or GitHub mentions', () => {
  const body = issueBody({ id: 'reference', report: '@user ![tracking](https://evil.test/a) <img src="https://evil.test/b">' }, ['https://images.test/1.png']);
  assert.doesNotMatch(body, /@user|!\[tracking\]|<img/);
  assert.match(body, /!\[Screenshot 1\]\(https:\/\/images.test\/1.png\)/);
});

test('Worker runtime: origin, verification, uploads, concurrent retries, unknown outcomes and quotas', async t => {
  let calls = [], failGithub = false;
  const usedTokens = new Set();
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: ['index.js', 'core.js'].map(name => ({ type: 'ESModule', path: fileURLToPath(new URL('../workers/feedback/' + name, import.meta.url)) })), compatibilityDate: '2026-11-01',
    durableObjects: { REPORTS: { className: 'FeedbackReports', useSQLite: true } }, r2Buckets: ['IMAGES'],
    ratelimits: { REQUEST_LIMIT: { namespace_id: '1001', simple: { limit: 100, period: 60 } } },
    bindings: { ENABLED: 'true', ALLOWED_ORIGINS: origin, GITHUB_REPOSITORY: 'CaotcAftermth/Avorion-Viewer', PUBLIC_URL: 'https://feedback.test', TURNSTILE_SITE_KEY: 'test-key', TURNSTILE_SECRET: 'test-secret', GITHUB_TOKEN: 'test-token', IP_HASH_SECRET: 'test-salt' },
    outboundService: async request => {
      if (request.url.startsWith('https://challenges.cloudflare.com/')) {
        const body = await request.json(), replay = usedTokens.has(body.response); usedTokens.add(body.response);
        return Response.json({ success: body.response !== 'invalid' && !replay, action: 'feedback', hostname: 'avorion-viewer.com' });
      }
      assert.equal(request.url, 'https://api.github.com/repos/CaotcAftermth/Avorion-Viewer/issues');
      calls.push(await request.json());
      if (failGithub) return Response.json({ message: 'unknown' }, { status: 502 });
      return Response.json({ html_url: `https://github.com/CaotcAftermth/Avorion-Viewer/issues/${calls.length}` }, { status: 201 });
    },
  }));
  t.after(() => mf.dispose());
  let ip = 1;
  const send = async (formBody, extra = {}) => {
    const encoded = new Request('https://feedback.test/reports', { method: 'POST', body: formBody });
    return mf.dispatchFetch(encoded.url, { method: 'POST', headers: { 'Content-Type': encoded.headers.get('Content-Type'), Origin: origin, 'CF-Connecting-IP': `192.0.2.${ip}`, ...extra }, body: await encoded.arrayBuffer() });
  };
  assert.equal((await send(form(), { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await send(form(undefined, { token: 'invalid' }))).status, 403);
  assert.equal(calls.length, 0);
  const id = crypto.randomUUID();
  const responses = await Promise.all([send(form(id, {}, [image()])), send(form(id, {}, [image()]))]);
  assert.ok(responses.some(response => response.status === 201));
  assert.equal(calls.length, 1, 'concurrent retries create one GitHub issue');
  const retry = await send(form(id, {}, [image()]));
  assert.equal(retry.status, 200); assert.match((await retry.json()).issueUrl, /issues\/1$/);
  assert.equal((await send(form(id, { report: 'changed' }, [image()]))).status, 409);
  const screenshot = await mf.dispatchFetch(`https://feedback.test/images/${id}/0.png`);
  assert.equal(screenshot.status, 200); assert.equal(screenshot.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(Buffer.from(await screenshot.arrayBuffer()), png);
  assert.doesNotMatch(calls[0].body, /private-filename/);
  assert.equal((await mf.dispatchFetch('https://feedback.test/images/other/0.svg')).status, 404);
  const token = crypto.randomUUID();
  assert.equal((await send(form(undefined, { token }))).status, 201);
  assert.equal((await send(form(undefined, { token }))).status, 403, 'Turnstile token replay fails');
  failGithub = true;
  const uncertainId = crypto.randomUUID();
  assert.equal((await send(form(uncertainId))).status, 503);
  const count = calls.length;
  assert.equal((await send(form(uncertainId))).status, 409);
  assert.equal(calls.length, count, 'ambiguous GitHub failure is not posted twice');
  assert.equal((await send(form())).status, 429, 'per-client quota enforced');
  failGithub = false;
  for (let n = 3; n < 10; n++) { ip++; assert.equal((await send(form())).status, 201); }
  ip++;
  assert.equal((await send(form())).status, 429, 'global daily cap enforced across client addresses');
});




