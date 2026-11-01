import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const types = { '.wasm': 'application/wasm', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.bmp': 'image/bmp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain' };
const ORIGIN = 'http://127.0.0.1:5173';
export function viewerHandler(directory) {
  const root = resolve(directory);
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    if (req.headers.host !== '127.0.0.1:5173') { res.writeHead(308, { Location: ORIGIN + '/' }).end(); return; }
    if (req.headers.origin && req.headers.origin !== ORIGIN) { res.writeHead(403).end(); return; }
    try {
      const urlPath = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
      const segments = urlPath.split('/').filter(Boolean);
      // Serve only application assets, not repository metadata, logs or credentials.
      if (urlPath.includes('\\') || urlPath.includes(':') || segments.some(s => s.startsWith('.')) ||
          !(segments.length === 0 || ['src', 'prototypes'].includes(segments[0]) ||
            (segments.length === 1 && ['index.html', 'favicon.svg'].includes(segments[0])))) {
        res.writeHead(403).end(); return;
      }
      let path = resolve(root, '.' + urlPath);
      if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
      const [canonicalRoot, canonicalPath] = await Promise.all([realpath(root), realpath(path)]);
      if (!canonicalPath.startsWith(canonicalRoot + sep)) { res.writeHead(403).end(); return; }
      const content = await readFile(canonicalPath);
      res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(404).end('Not found'); }
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
  http.createServer(viewerHandler(root)).listen(5173, '127.0.0.1', () => console.log('Avorion Viewer: ' + ORIGIN));
}
