/**
 * Post-install script: copies Material Icons font files from node_modules
 * to client/public/vendor/material-icons/ for fully offline serving.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'node_modules', 'material-icons', 'iconfont');
const dest = path.join(root, 'client', 'public', 'vendor', 'material-icons');

if (!existsSync(src)) {
  console.warn('[vendor-icons] material-icons package not found, skipping.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

const files = [
  'material-icons.woff2',
  'material-icons.woff',
];

let copied = 0;
for (const f of files) {
  const srcFile = path.join(src, f);
  if (existsSync(srcFile)) {
    copyFileSync(srcFile, path.join(dest, f));
    copied++;
    console.log(`[vendor-icons] Copied ${f}`);
  } else {
    console.warn(`[vendor-icons] ${f} not found in package, skipping.`);
  }
}

console.log(`[vendor-icons] Done. ${copied} file(s) vendored.`);
