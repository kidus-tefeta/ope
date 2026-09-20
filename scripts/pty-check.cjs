#!/usr/bin/env node
/* Is the terminal a real one?
 *
 * node-pty is native. A copy that did not ship, or was built for a different
 * Electron, still imports on some machines and then fails the moment a shell is
 * asked for, and OPE falls back to plain pipes. The installer would go out
 * looking finished with a terminal that is not one.
 *
 * So this opens a real shell, types into it and waits to hear back, and it says
 * FAIL out loud if any of that does not happen. Run it with the runtime you are
 * shipping, not just with Node:
 *
 *   node scripts/pty-check.cjs                            the dev server's copy
 *   cd desktop && ELECTRON_RUN_AS_NODE=1 npx electron ../scripts/pty-check.cjs
 *
 * The second one is the one that matters: it loads node-pty into Electron's own
 * Node, so a wrong build is caught in the build, not by a person on Windows.
 */
const { createRequire } = require('node:module');
const { join, dirname, resolve } = require('node:path');
const { existsSync, statSync, chmodSync } = require('node:fs');

const where = resolve(process.argv[2] || process.cwd());
const req = createRequire(join(where, 'package.json'));
const runtime = process.versions.electron ? 'Electron ' + process.versions.electron
  : 'Node ' + process.versions.node;
const say = s => console.log(s);

function die(why){
  console.error('');
  console.error('FAIL  the terminal engine does not work in ' + runtime + ' on ' + process.platform + '-' + process.arch + '.');
  console.error('      ' + why);
  console.error('      Shipping this gives people a terminal that is not one: no prompt, no');
  console.error('      progress bars, nothing that can be answered. Fix it, do not ship it.');
  console.error('');
  process.exit(1);
}

say('Terminal engine check, in ' + runtime + ', looking from ' + where);

let dir;
try { dir = join(dirname(req.resolve('node-pty')), '..'); }
catch (e) { die('node-pty is not installed here: ' + e.message); }
say('  found      ' + dir);

/* node-pty ships spawn-helper without the bit that says it may be run */
if (process.platform !== 'win32') {
  for (const d of ['build/Release', 'build/Debug', 'prebuilds/' + process.platform + '-' + process.arch]) {
    const f = join(dir, d, 'spawn-helper');
    try { if (existsSync(f) && !(statSync(f).mode & 0o111)) { chmodSync(f, 0o755); say('  fixed      ' + f + ' was not executable'); } } catch {}
  }
}

let pty;
try { pty = req('node-pty'); }
catch (e) { die('node-pty would not load: ' + e.message); }
say('  loaded     the native module');

const shell = process.platform === 'win32'
  ? (existsSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'))
      ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : (process.env.ComSpec || 'cmd.exe'))
  : (process.env.SHELL || '/bin/sh');

let term;
try {
  term = pty.spawn(shell, process.platform === 'win32' ? ['-NoLogo'] : [], {
    name: 'xterm-256color', cols: 80, rows: 24, cwd: where,
    env: Object.assign({}, process.env, { TERM: 'xterm-256color' })
  });
} catch (e) { die('a shell would not start: ' + e.message); }
say('  started    ' + shell);

/* the quotes matter: the shell echoes back what was typed, so what is looked
   for has to be something only the shell running it can produce */
let heard = '';
let done = false;
const stop = code => { if (done) return; done = true; try { term.kill(); } catch {} process.exit(code); };
term.onData(d => {
  heard += d;
  if (heard.includes('ope-pty-works')) {
    say('  heard      the shell ran what was typed and sent it back');
    say('');
    say('PASS  the terminal is real in ' + runtime + '.');
    stop(0);
  }
});
term.onExit(e => { if (!done) die('the shell died on its own, code ' + (e && e.exitCode) + '. It printed: ' + JSON.stringify(heard.slice(-300))); });
setTimeout(() => { term.write('echo ope-pty-"works"\r'); }, 400);
setTimeout(() => { if (!done) die('nothing came back in 20 seconds. The shell printed: ' + JSON.stringify(heard.slice(-300))); }, 20000);
