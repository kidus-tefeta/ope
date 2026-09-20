// Copies the Monaco editor (the editor inside VS Code) and xterm (the terminal)
// into web/vendor, so OPE works with no internet. Only the English build of
// Monaco is kept.
import { cpSync, rmSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules/monaco-editor/min/vs');
const to = join(root, 'web/vendor/vs');
if (!existsSync(from)) { console.error('Run npm install first.'); process.exit(1); }
rmSync(to, { recursive: true, force: true });
mkdirSync(dirname(to), { recursive: true });
cpSync(from, to, { recursive: true });
for (const f of readdirSync(to)) if (/^nls\.messages\./.test(f)) rmSync(join(to, f));
console.log('monaco copied to web/vendor/vs');

// the terminal: the xterm build and the fit addon that keeps it the size of the
// window. Three small files, no loader, plain <script> tags.
const term = [
  ['node_modules/@xterm/xterm/lib/xterm.js', 'web/vendor/xterm/xterm.js'],
  ['node_modules/@xterm/xterm/css/xterm.css', 'web/vendor/xterm/xterm.css'],
  ['node_modules/@xterm/addon-fit/lib/addon-fit.js', 'web/vendor/xterm/addon-fit.js']
];
if (!existsSync(join(root, 'node_modules/@xterm/xterm'))) { console.error('Run npm install first (xterm is missing).'); process.exit(1); }
rmSync(join(root, 'web/vendor/xterm'), { recursive: true, force: true });
mkdirSync(join(root, 'web/vendor/xterm'), { recursive: true });
for (const [f, t] of term) cpSync(join(root, f), join(root, t));
console.log('xterm copied to web/vendor/xterm');
