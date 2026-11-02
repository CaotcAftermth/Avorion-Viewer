import { DurableObject } from 'cloudflare:workers';
import { FeedbackError, REPORT_ID, json, limitedBody, parseReport, hash, reportHash, verifyTurnstile, issueBody, publicText } from './core.js';

function origins(env) { return (env.ALLOWED_ORIGINS || '').split(',').filter(Boolean); }
function ready(env) { return env.ENABLED === 'true' && Boolean(env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY && env.GITHUB_TOKEN && env.IP_HASH_SECRET); }
function cors(response, origin) {
  const result = new Response(response.body, response);
  result.headers.set('Access-Control-Allow-Origin', origin);
  result.headers.set('Vary', 'Origin');
  result.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  result.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    // Public, random image URLs are needed by GitHub's image proxy. No listing endpoint.
    if (url.pathname.startsWith('/images/') && ['GET', 'HEAD'].includes(request.method)) {
      const parts = url.pathname.split('/');
      if (parts.length !== 4 || !REPORT_ID.test(parts[2]) || !/^[0-2]\.(png|jpg)$/.test(parts[3])) return json({ error: 'Not found.' }, 404);
      const object = request.method === 'HEAD' ? await env.IMAGES.head(url.pathname.slice(1)) : await env.IMAGES.get(url.pathname.slice(1));
      if (!object) return json({ error: 'Not found.' }, 404);
      return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
        'Content-Type': object.httpMetadata.contentType,
        'Content-Length': String(object.size), 'ETag': object.httpEtag,
        'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer',
      } });
    }
    if (!origins(env).includes(origin)) return json({ error: 'Origin not allowed.' }, 403);
    try {
      if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
      if (request.method === 'GET' && url.pathname === '/config') return cors(json({ enabled: ready(env), siteKey: ready(env) ? env.TURNSTILE_SITE_KEY : null }), origin);
      if (url.pathname !== '/reports' || request.method !== 'POST') return cors(json({ error: 'Not found.' }, 404), origin);
      if (!ready(env)) throw new FeedbackError(503, 'Anonymous reporting is unavailable. Use the GitHub link or copy your report.');
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) throw new FeedbackError(403, 'Client address unavailable.');
      if (!(await env.REQUEST_LIMIT.limit({ key: ip })).success) throw new FeedbackError(429, 'Too many requests. Try again later.');
      const type = request.headers.get('Content-Type') || '';
      if (!type.startsWith('multipart/form-data;')) throw new FeedbackError(415, 'Expected a multipart report.');
      const body = await limitedBody(request);
      const form = await new Response(body, { headers: { 'Content-Type': type } }).formData();
      const report = await parseReport(form);
      if (!await verifyTurnstile(report.token, ip, env, origin)) throw new FeedbackError(403, 'Verification expired or failed. Please verify again.');
      // Daily salt prevents long-term correlation; raw client addresses never enter storage.
      const day = new Date().toISOString().slice(0, 10);
      const ipHash = await hash(`${env.IP_HASH_SECRET}:${day}:${ip}`);
      const coordinator = env.REPORTS.get(env.REPORTS.idFromName('feedback-v1'));
      return cors(await coordinator.fetch(new Request('https://internal/reports', {
        method: 'POST', headers: { 'Content-Type': type, 'X-Client-Hash': ipHash }, body,
      })), origin);
    } catch (error) {
      return cors(json({ error: error instanceof FeedbackError ? error.message : 'Could not process the report. Keep your report and try again later.' }, error instanceof FeedbackError ? error.status : 503), origin);
    }
  },
};

export class FeedbackReports extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, digest TEXT NOT NULL, client TEXT NOT NULL, created INTEGER NOT NULL,
      state TEXT NOT NULL, issue TEXT
    ); CREATE INDEX IF NOT EXISTS reports_created ON reports(created);
    CREATE INDEX IF NOT EXISTS reports_client_created ON reports(client, created);`);
  }

  async fetch(request) {
    const report = await parseReport(await request.formData()), digest = await reportHash(report), now = Date.now();
    const client = request.headers.get('X-Client-Hash');
    // No awaits between lookup, quota checks, and insert: one reservation even under concurrent retries.
    const previous = this.sql.exec('SELECT * FROM reports WHERE id = ?', report.id).toArray()[0];
    if (previous) {
      if (previous.digest !== digest) return json({ error: 'This report reference already belongs to different content.' }, 409);
      if (previous.state === 'sent') return json({ issueUrl: previous.issue, id: report.id });
      return json({ error: 'This report may already have been submitted. Keep the reference; do not submit it again.', id: report.id, uncertain: true }, 409);
    }
    const midnight = new Date().setUTCHours(0, 0, 0, 0);
    if (this.sql.exec('SELECT COUNT(*) AS n FROM reports WHERE created >= ?', midnight).one().n >= 10
      || this.sql.exec('SELECT COUNT(*) AS n FROM reports WHERE client = ? AND created >= ?', client, now - 600000).one().n >= 3) {
      return json({ error: 'Report limit reached. Try later or use the GitHub link.' }, 429);
    }
    this.sql.exec("INSERT INTO reports VALUES (?, ?, ?, ?, 'pending', NULL)", report.id, digest, client, now);
    // The record stores only a content hash, state and URL, never report text or screenshots.
    const keys = [], urls = [];
    let githubStarted = false;
    try {
      for (const [index, image] of report.images.entries()) {
        const key = `images/${report.id}/${index}.${image.extension}`;
        keys.push(key);
        await this.env.IMAGES.put(key, image.bytes, { httpMetadata: { contentType: image.mime } });
        urls.push(`${this.env.PUBLIC_URL}/${key}`);
      }
      githubStarted = true;
      const response = await fetch(`https://api.github.com/repos/${this.env.GITHUB_REPOSITORY}/issues`, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Avorion-Viewer-Feedback', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: publicText(report.title), body: issueBody(report, urls),
          labels: [report.kind === 'bug' ? 'bug' : report.kind === 'idea' ? 'enhancement' : 'feedback'] }),
      });
      if (response.status !== 201) throw new Error('GitHub did not confirm issue creation.');
      const issue = await response.json();
      const expected = `https://github.com/${this.env.GITHUB_REPOSITORY}/issues/`;
      if (typeof issue.html_url !== 'string' || !issue.html_url.startsWith(expected) || !/^\d+$/.test(issue.html_url.slice(expected.length))) throw new Error('Unexpected issue URL.');
      this.sql.exec("UPDATE reports SET state = 'sent', issue = ? WHERE id = ?", issue.html_url, report.id);
      return json({ issueUrl: issue.html_url, id: report.id }, 201);
    } catch {
      // Never retry an ambiguous GitHub POST: its response can be lost after it creates the issue.
      this.sql.exec("UPDATE reports SET state = ? WHERE id = ?", githubStarted ? 'uncertain' : 'failed', report.id);
      if (!githubStarted) await Promise.allSettled(keys.map(key => this.env.IMAGES.delete(key)));
      return json({ error: githubStarted ? 'GitHub did not confirm receipt. Keep this reference and check existing issues before making another report.' : 'Upload failed. Keep this reference and use the GitHub link.', id: report.id, uncertain: true }, 503);
    }
  }
}
