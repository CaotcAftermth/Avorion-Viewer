import { cp, mkdir, rm } from 'node:fs/promises';
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'favicon.svg', 'src']) await cp(path, `dist/${path}`, { recursive: true });
console.log('Static site built in dist/ (Three.js bundled locally).');
