import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

// Vite bundles Three.js and the application into one module. Embed that module
// and its stylesheet so file:// needs neither an HTTP server nor a CDN.
const root = resolve('dist');
let html = await readFile(resolve(root, 'index.html'), 'utf8');
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Expected one Vite module and stylesheet');
const localAsset = (url) => {
  const path = resolve(root, url.replace(/^\//, ''));
  if (relative(root, path).startsWith('..')) throw new Error('Asset outside dist');
  return path;
};
const js = await readFile(localAsset(script[1]), 'utf8');
const css = await readFile(localAsset(stylesheet[1]), 'utf8');
html = html.replace(script[0], '');
html = html.replace(stylesheet[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
// Run after the page elements exist. Escape HTML raw-text terminators.
html = html.replace('</body>', () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script></body>`);
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/SKYLIFT-0.5.html', html);
console.log('Standalone game: artifacts/SKYLIFT-0.5.html');
