import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const types = { '.wasm': 'application/wasm', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.bmp': 'image/bmp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const ORIGIN = 'http://127.0.0.1:5173';
http.createServer(async (req, res) => {
  // Saved models and textures belong to one exact address. Send localhost and
  // other spellings to the canonical one so they always find the same storage.
  if (req.headers.host !== '127.0.0.1:5173') { res.writeHead(308, { Location: ORIGIN + req.url }).end(); return; }
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let path = resolve(root, '.' + urlPath);
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(await readFile(path));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(5173, '127.0.0.1', () => console.log('Avorion Viewer: http://127.0.0.1:5173'));
