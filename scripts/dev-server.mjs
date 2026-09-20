// Runs the OPE interface in a normal browser, for building and testing it.
//
//   npm run dev            then open http://localhost:8790
//
// The Mac app answers the same bridge commands in Swift (mac/main.swift). Both
// sides must stay identical: every command here exists there, with the same
// arguments and the same answer.
import http from 'node:http';
import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, watch, existsSync, statSync, chmodSync } from 'node:fs';
import { join, resolve, relative, extname, dirname, basename, sep } from 'node:path';
import { homedir, platform } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', 'web');
const PROMPT = join(HERE, '..', 'prompt', 'OPE-PROMPT.md');
const PORT = Number(process.env.PORT || 8790);
/* the Windows app runs this same file inside Electron. It sets OPE_TOKEN, and then
   every bridge call must carry it, so no web page open in a browser can reach the
   bridge on 127.0.0.1 */
const TOKEN = process.env.OPE_TOKEN || '';
const HOME = homedir();
const COMPUTER = platform() === 'darwin' ? 'Mac' : 'computer';

let root = process.env.OPE_ROOT || '';
/* the library of project folders, kept on this machine only */
const LIB = join(HOME, '.config', 'ope', 'library.json');
const LEARN = join(HOME, '.config', 'ope', 'learn.json');
const COURSE = join(HOME, 'Desktop', 'OPE Course');
const COURSE_README = '# OPE Course\n\nYour practice work from OPE, Learning while building. Every task has its own folder with task.md (what to do) and test.cjs (what OPE runs to check it). This folder is its own git history, so saving checkpoints here never touches your projects.\n';
const RUN_OK = new Set(['node', 'npm', 'npx', 'python3', 'python', 'pytest', 'go', 'cargo', 'swift', 'deno', 'bun']);
function library(){ try { return JSON.parse(readFileSync(LIB, 'utf8')); } catch { return []; } }
function saveLibrary(items){ mkdirSync(dirname(LIB), { recursive: true }); writeFileSync(LIB, JSON.stringify(items, null, 2)); return items; }
const recent = [];
const listeners = new Set();
let watcher = null;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png' };

/* the only git commands the interface may run */
const GIT_OK = new Set(['for-each-ref', 'log', 'diff', 'blame', 'rev-list', 'rev-parse', 'ls-files',
  'status', 'init', 'add', 'commit', 'tag', 'show']);
const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.build', 'DerivedData', '.venv',
  'venv', '__pycache__', '.cache', 'Pods', '.turbo', '.wrangler', 'coverage']);

/* where a command works: the open project, or, with where: 'course', the OPE
   Course folder on the Desktop where the practice work lives */
function baseOf(b){ return b && b.where === 'course' ? COURSE : root; }
function inside(p, b){
  const top = baseOf(b);
  if (!top) throw new Error('Open a project first.');
  const full = resolve(top, p || '');
  if (full !== top && !full.startsWith(top + sep)) throw new Error('That path is outside the project.');
  return full;
}

function git(args, at){
  return new Promise(done => {
    if (!GIT_OK.has(args[0])) return done({ code: 1, out: '', err: 'not allowed' });
    execFile('git', ['-C', at || root, ...args], { maxBuffer: 64 * 1024 * 1024 }, (e, out, err) =>
      done({ code: e ? (e.code ?? 1) : 0, out: String(out || ''), err: String(err || '') }));
  });
}

async function walk(dir, out, depth){
  if (out.length > 20000 || depth > 25) return;
  let items = [];
  try { items = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const it of items) {
    if (SKIP.has(it.name) || it.name === '.DS_Store') continue;
    const full = join(dir, it.name);
    if (it.isDirectory()) await walk(full, out, depth + 1);
    else if (it.isFile()) out.push(relative(root, full).split(sep).join('/'));
  }
}

function watchRoot(){
  if (watcher) { watcher.close(); watcher = null; }
  if (!root) return;
  let timer = null, seen = new Set();
  watcher = watch(root, { recursive: true }, (_e, name) => {
    if (!name) return;
    const n = String(name);
    const n2 = n.replace(/\\/g, '/');
    if (/(^|\/)(node_modules|\.next|dist|build)(\/|$)/.test(n2)) return;
    if (/^\.git\//.test(n2) && !/^\.git\/(refs|HEAD|index|packed-refs)/.test(n2)) return;
    seen.add(n);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const paths = [...seen]; seen = new Set();
      for (const res of listeners) res.write(`data: ${JSON.stringify({ paths })}\n\n`);
    }, 250);
  });
}

/* THE TERMINAL. A real shell, one for each project, kept running for as long as
   OPE is open, so a long job is never lost by looking at something else.

   What the person types here is theirs. The allowlist above is for the tests OPE
   runs by itself, and none of it applies to this.

   The engine is node-pty: a real pty on Mac and Linux, ConPTY on Windows. When
   it cannot be loaded, OPE runs the shell on plain pipes instead and says so out
   loud, because a pipe is not a terminal: no prompt, no progress bars, nothing
   that asks a question. It never pretends.

   Output is pushed to the page down the same stream the file watcher uses, in
   base64 so no byte can corrupt the JSON or split a character, gathered up and
   sent at most every 16 ms. */
const PTY_KEEP = 200 * 1024;  /* scrollback held for coming back to, bytes */
const PTY_FLUSH = 16;         /* how often output is sent to the page, ms */
const shells = new Map();     /* project folder -> the shell running in it */
let ptyMod;                   /* undefined: not tried yet. null: not available */
let ptyWhy = '';

/* node-pty is shipped with spawn-helper missing the bit that says it may be
   run, and without it every spawn on Mac and Linux dies with posix_spawnp
   failed. Put it back, once, before the first shell. */
function ptyHelper(pkg){
  if (!pkg || platform() === 'win32') return;
  for (const d of ['build/Release', 'build/Debug', `prebuilds/${platform()}-${process.arch}`]) {
    const f = join(pkg, d, 'spawn-helper');
    try { if (existsSync(f) && !(statSync(f).mode & 0o111)) chmodSync(f, 0o755); } catch {}
  }
}

async function loadPty(){
  if (ptyMod !== undefined) return ptyMod;
  /* in the Windows app this bridge runs from the app's resources, outside the
     asar, so it cannot find node-pty itself: the window loads it and hands it
     over (desktop/main.mjs) */
  const given = globalThis.__opePty;
  if (given && typeof given.spawn === 'function') { ptyHelper(globalThis.__opePtyDir); return (ptyMod = given); }
  try {
    try { ptyHelper(dirname(dirname(fileURLToPath(import.meta.resolve('node-pty'))))); } catch {}
    const m = await import('node-pty');
    const mod = typeof m.spawn === 'function' ? m : m.default;
    if (!mod || typeof mod.spawn !== 'function') throw new Error('node-pty loaded without spawn');
    ptyMod = mod;
  } catch (e) {
    ptyMod = null;
    ptyWhy = String(globalThis.__opePtyWhy || (e && e.message) || e);
  }
  return ptyMod;
}

/* their own shell, the one they have in Terminal */
function shellFor(){
  if (platform() === 'win32') {
    const ps = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    return existsSync(ps) ? ps : (process.env.ComSpec || 'cmd.exe');
  }
  return process.env.SHELL || '/bin/zsh';
}
function shellArgs(exe, real){
  if (platform() !== 'win32') return real ? ['-l'] : [];
  if (/powershell\.exe$/i.test(exe)) return real ? ['-NoLogo'] : ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'];
  return real ? [] : ['/Q'];
}
function shellEnv(){
  const env = Object.assign({}, process.env, { TERM: 'xterm-256color', COLORTERM: 'truecolor' });
  /* the bridge's own secret never goes into the person's shell */
  delete env.OPE_TOKEN; delete env.ELECTRON_RUN_AS_NODE;
  return env;
}
function ptySize(cols, rows){
  return [Math.max(20, Math.min(400, Math.round(Number(cols) || 80))),
          Math.max(4, Math.min(200, Math.round(Number(rows) || 24)))];
}

function ptySend(o){
  const line = `data: ${JSON.stringify({ pty: o })}\n\n`;
  for (const res of listeners) { try { res.write(line); } catch {} }
}
function ptyKeep(s, buf){
  s.keep.push(buf); s.kept += buf.length;
  while (s.kept > PTY_KEEP && s.keep.length > 1) s.kept -= s.keep.shift().length;
  if (s.kept > PTY_KEEP) { const b = s.keep[0]; s.keep[0] = b.subarray(b.length - PTY_KEEP); s.kept = PTY_KEEP; }
}
function ptyFlush(s){
  if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  if (!s.pend.length) return;
  const all = Buffer.concat(s.pend); s.pend = [];
  ptySend({ data: all.toString('base64') });
}
function ptyData(s, chunk){
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
  if (!buf.length) return;
  ptyKeep(s, buf); s.pend.push(buf);
  if (!s.timer) s.timer = setTimeout(() => { s.timer = null; ptyFlush(s); }, PTY_FLUSH);
}
function ptyEnded(s, code){
  if (!s.running) return;
  s.running = false;
  ptyFlush(s);
  ptySend({ exit: typeof code === 'number' ? code : 0 });
}
/* the shell is killed, but its death is still announced the same way as any
   other: the page hears one exit, whoever asked for it */
function ptyStop(s){
  try { s.proc && s.proc.kill(); } catch { s.running = false; }
}
function closeShells(){
  for (const s of shells.values()) { try { ptyStop(s); } catch {} }
  shells.clear();
}
/* nothing is left running behind the app */
globalThis.__opeCloseShells = closeShells;
process.on('exit', closeShells);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(sig, () => { closeShells(); process.exit(0); });

async function ptyStart(at, cols, rows){
  const old = shells.get(at);
  if (old) { ptyStop(old); shells.delete(at); }
  const mod = await loadPty();
  const [c, r] = ptySize(cols, rows);
  const exe = shellFor();
  const s = { cwd: at, shell: exe, kind: mod ? 'pty' : 'pipe', keep: [], kept: 0, pend: [], timer: null, running: true };
  if (mod) {
    s.proc = mod.spawn(exe, shellArgs(exe, true), { name: 'xterm-256color', cols: c, rows: r, cwd: at, env: shellEnv() });
    s.proc.onData(d => ptyData(s, d));
    s.proc.onExit(e => ptyEnded(s, e && typeof e.exitCode === 'number' ? e.exitCode : 0));
  } else {
    s.why = 'The real terminal engine did not load, so this is the shell on plain pipes: '
      + (ptyWhy || 'node-pty is not installed') + '. Commands run and you see what they print, but nothing interactive works.';
    s.proc = spawn(exe, shellArgs(exe, false), { cwd: at, env: shellEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    s.proc.stdout.on('data', d => ptyData(s, d));
    s.proc.stderr.on('data', d => ptyData(s, d));
    s.proc.on('error', e => { ptyData(s, '\r\n' + e.message + '\r\n'); ptyEnded(s, 1); });
    s.proc.on('close', code => ptyEnded(s, code == null ? 0 : code));
  }
  shells.set(at, s);
  return ptyAnswer(s, true);
}
function ptyAnswer(s, started){
  const out = { ok: true, started, cwd: s.cwd, shell: s.shell,
    buffer: started ? '' : Buffer.concat(s.keep).toString('base64') };
  if (s.kind === 'pipe') { out.degraded = true; out.why = s.why; }
  return out;
}

/* OPE Chat, the twin of the Chat enum in main.swift. A browser has no Apple
   model, so here it is always Ollama or nothing. */
const CHAT_MODEL = 'qwen2.5-coder:3b';
const OLLAMA = 'http://127.0.0.1:11434';
let pulling = null;
const CHAT_RULES = [
  'You are OPE Chat, a friendly assistant inside OPE, an app for people who build software by talking to an AI coder and cannot read code themselves.',
  'Talk like a normal, helpful AI. Answer greetings, small talk, maths and general questions directly and briefly, the way any assistant would. Do not mention the code unless the person asks about it.',
  'When they ask about the code, explain what a file, a function or a line does, why it is there and how it connects to the rest, in plain words a non programmer understands, and explain any technical word the first time you use it. Use only the code you are shown.',
  'One limit: you never write code, rewrite it, suggest a fix or debug. If they ask for that, say in one sentence that their AI coder can make the change.',
  'Only greet them if they greeted you. Keep answers short.'
].join('\n');
async function ollamaHasModel(){
  try {
    const r = await fetch(OLLAMA + '/api/tags', { signal: AbortSignal.timeout(2000) });
    const j = await r.json();
    return (j.models || []).some(m => m.name === CHAT_MODEL || m.name.startsWith(CHAT_MODEL));
  } catch { return null; }
}
function chatPrompt(b, budget){
  const head = [];
  if (b.project) head.push('Project: ' + b.project);
  if (b.version) head.push('Version picked: ' + b.version);
  if (b.file) head.push('File open: ' + b.file);
  if (b.lines) head.push('Lines selected: ' + b.lines);
  let code = String(b.code || '');
  if (code.length > budget) code = code.slice(0, budget) + '\n[the rest of the file was cut to fit]';
  return head.join('\n') + (code ? '\n\nThe code they have open, for if they ask about it:\n```\n' + code + '\n```' : '') + '\n\nThe person says: ' + String(b.question || '');
}
async function chatEngine(){
  const has = await ollamaHasModel();
  if (has === true) return { engine: 'ollama', label: 'Qwen2.5 Coder 3B, on this ' + COMPUTER };
  if (has === false) return Object.assign({ engine: 'need-model', label: 'Needs a 1.9 GB download' }, pulling ? { pulling } : {});
  const installed = ['/usr/local/bin/ollama', '/opt/homebrew/bin/ollama', '/Applications/Ollama.app',
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe')].some(existsSync);
  return installed ? { engine: 'start-ollama', label: 'Open Ollama to use OPE Chat' }
                   : { engine: 'none', label: 'Needs Ollama, free, from ollama.com' };
}
async function chatAsk(b){
  if (await ollamaHasModel() !== true) throw new Error('OPE Chat has no model on this ' + COMPUTER + ' yet.');
  const r = await fetch(OLLAMA + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: CHAT_MODEL, stream: false, options: { num_ctx: 8192, temperature: 0.2 },
      messages: [{ role: 'system', content: CHAT_RULES }, { role: 'user', content: chatPrompt(b, 18000) }] }) });
  const j = await r.json();
  if (j.error) throw new Error('Ollama could not answer: ' + j.error);
  return { answer: (j.message && j.message.content) || '', engine: 'ollama' };
}
function chatPull(){
  if (pulling) return;
  pulling = { status: 'starting', completed: 0, total: 0 };
  (async () => {
    try {
      const r = await fetch(OLLAMA + '/api/pull', { method: 'POST', body: JSON.stringify({ model: CHAT_MODEL, stream: true }) });
      const dec = new TextDecoder(); let buf = '';
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        let i; while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          try { const j = JSON.parse(line);
            if (j.error) { pulling = { status: 'error', error: j.error }; return; }
            pulling = { status: j.status || '', total: j.total, completed: j.completed }; } catch {}
        }
      }
      pulling = null;
    } catch { pulling = { status: 'error', error: 'The download stopped. Check Ollama is open and try again.' }; }
  })();
}

async function command(b){
  switch (b.cmd) {
    case 'hello': return { kind: TOKEN ? 'desktop' : 'dev', root, recent, library: library() };
    case 'open': {
      const p = resolve(String(b.path || '').replace(/^~(?=$|[\/\\])/, HOME));
      if (!existsSync(p) || !statSync(p).isDirectory()) throw new Error('That folder does not exist.');
      root = p;
      const i = recent.indexOf(p); if (i >= 0) recent.splice(i, 1); recent.unshift(p); recent.length = Math.min(recent.length, 8);
      watchRoot();
      const lib = library();
      if (!lib.some(x => x.path === p)) { lib.push({ path: p, name: basename(p) }); saveLibrary(lib); }
      return { root, library: lib };
    }
    case 'pick': return { root: '', manual: true };
    case 'prompt': return { text: readFileSync(PROMPT, 'utf8') };
    case 'git': return baseOf(b) ? git((b.args || []).map(String), baseOf(b)) : { code: 1, out: '', err: 'no project' };
    case 'list': { const out = []; if (root) await walk(root, out, 0); return { files: out.sort() }; }
    case 'read': {
      const full = inside(b.path, b);
      const s = await stat(full);
      if (s.size > 2 * 1024 * 1024) return { tooBig: true, size: s.size };
      const buf = await readFile(full);
      if (buf.subarray(0, 8000).includes(0)) return { binary: true, size: s.size };
      return { text: buf.toString('utf8'), size: s.size };
    }
    case 'write': { const to = inside(b.path, b); mkdirSync(dirname(to), { recursive: true }); await writeFile(to, String(b.text ?? ''), 'utf8'); return { ok: true }; }
    /* LEARNING. Where you are, what you passed, skipped and keep getting wrong,
       kept on this machine only, the same for every project you open */
    /* THE OPE COURSE FOLDER. The practice work has its own folder on the
       Desktop, its own git history, and never touches anybody's project */
    case 'courseInit': {
      mkdirSync(COURSE, { recursive: true });
      if (!existsSync(join(COURSE, '.git'))) {
        writeFileSync(join(COURSE, 'README.md'), COURSE_README);
        await git(['init'], COURSE);
        await git(['add', '-A'], COURSE);
        /* the first save is signed as OPE, so it works before git knows your name */
        await new Promise(ok => execFile('git', ['-C', COURSE, '-c', 'user.name=OPE', '-c', 'user.email=ope@localhost',
          'commit', '-m', 'OPE Course: the start'], () => ok()));
      }
      return { path: COURSE };
    }
    case 'courseOpen': {
      const to = inside(b.path || '', { where: 'course' });
      const opener = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'explorer' : 'xdg-open';
      execFile(opener, [to], () => {});
      return { ok: true };
    }
    case 'learnGet': { try { return { data: JSON.parse(readFileSync(LEARN, 'utf8')) }; } catch { return { data: {} }; } }
    case 'learnSave': { mkdirSync(dirname(LEARN), { recursive: true }); writeFileSync(LEARN, JSON.stringify(b.data || {}, null, 2)); return { ok: true }; }
    /* a test, run in the project folder. Only the programs tests are run with,
       never a shell, and never for longer than a minute */
    case 'run': {
      if (!baseOf(b)) throw new Error('Open a project first.');
      const args = (b.args || []).map(String);
      if (!RUN_OK.has(args[0])) throw new Error('OPE only runs tests with ' + [...RUN_OK].join(', ') + '.');
      /* node is the one this app already carries, so a test runs even where
         Node was never installed (the Windows app is Node inside Electron) */
      const exe = args[0] === 'node' ? process.execPath : args[0];
      return await new Promise(done => execFile(exe, args.slice(1), { cwd: baseOf(b), timeout: 60000, maxBuffer: 8 * 1024 * 1024,
        env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }), shell: platform() === 'win32' && args[0] !== 'node' },
        (e, out, err) => done({ code: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: String(out || ''),
          err: String(err || '') + (e && e.killed ? '\nStopped after a minute.' : '') })));
    }
    /* THE TERMINAL. Separate from run: this is the person's own shell, and what
       they type in it is theirs. Output comes back on the /events stream. */
    case 'ptyOpen': {
      if (!root) throw new Error('Open a project first.');
      const s = shells.get(root);
      /* one shell for each project: if it is still alive, come back to it and
         bring what it printed while nobody was looking */
      if (s && s.running) return ptyAnswer(s, false);
      return await ptyStart(root, b.cols, b.rows);
    }
    case 'ptyWrite': {
      const s = shells.get(root);
      if (!s || !s.running) throw new Error('The terminal is not open.');
      const data = String(b.data ?? '');
      if (s.kind === 'pty') s.proc.write(data); else s.proc.stdin.write(data);
      return { ok: true };
    }
    case 'ptyResize': {
      const s = shells.get(root);
      if (s && s.running && s.kind === 'pty') { const [c, r] = ptySize(b.cols, b.rows); try { s.proc.resize(c, r); } catch {} }
      return { ok: true };
    }
    case 'ptyClose': {
      const s = shells.get(root);
      if (s) { ptyStop(s); shells.delete(root); }
      return { ok: true };
    }
    case 'ptyState': {
      const s = shells.get(root);
      return { open: !!s, running: !!(s && s.running), cwd: s ? s.cwd : root };
    }
    case 'chatEngine': return chatEngine();
    case 'chat': return chatAsk(b);
    case 'chatPull': chatPull(); return { ok: true };
    /* reading a picture uses Apple's Vision, which only the Mac app can reach */
    case 'readImage': throw new Error('Reading pictures works in the Mac app, not in the browser.');
    case 'chatOpen': return { ok: false };
    case 'copy': return { ok: false };
    case 'install': {
      if (!root) throw new Error('Open a project first.');
      const SYS = join(HERE, '..', 'system'), added = [], kept = [];
      const agentsSrc = readFileSync(join(SYS, 'AGENTS.md'), 'utf8');
      const agents = join(root, 'AGENTS.md');
      if (existsSync(agents)) { const have = readFileSync(agents, 'utf8');
        if (have.includes('(OPE)')) kept.push('AGENTS.md'); else { writeFileSync(agents, have + '\n\n' + agentsSrc); added.push('AGENTS.md (added to yours)'); } }
      else { writeFileSync(agents, agentsSrc); added.push('AGENTS.md'); }
      const claude = join(root, 'CLAUDE.md');
      if (existsSync(claude)) { const have = readFileSync(claude, 'utf8');
        if (have.includes('@AGENTS.md')) kept.push('CLAUDE.md'); else { writeFileSync(claude, have + '\n\n@AGENTS.md\n'); added.push('CLAUDE.md (added to yours)'); } }
      else { writeFileSync(claude, '@AGENTS.md\n'); added.push('CLAUDE.md'); }
      const walkSys = d => { for (const it of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, it.name), rel = relative(SYS, p);
        if (it.isDirectory()) { walkSys(p); continue; }
        if (rel === 'AGENTS.md' || rel === 'CLAUDE.md') continue;
        const to = join(root, 'ope-system', rel);
        if (existsSync(to)) { kept.push('ope-system/' + rel); continue; }
        mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, readFileSync(p)); added.push('ope-system/' + rel);
      } };
      walkSys(SYS);
      return { added, kept };
    }
    case 'log': console.error('OPE: ' + b.text); return { ok: true };
    case 'libraryRemove': return { items: saveLibrary(library().filter(x => x.path !== String(b.path))) };
    default: throw new Error('Unknown command ' + b.cmd);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (TOKEN && (url.pathname === '/events' || url.pathname === '/bridge')
      && req.headers['x-ope-token'] !== TOKEN && url.searchParams.get('t') !== TOKEN) {
    res.writeHead(403); return res.end();
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': hi\n\n'); listeners.add(res); req.on('close', () => listeners.delete(res)); return;
  }
  if (url.pathname === '/bridge' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    try { const out = await command(JSON.parse(body || '{}'));
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out)); }
    catch (e) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  const file = join(WEB, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(WEB)) { res.writeHead(404); return res.end(); }
  try { const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, '127.0.0.1', () => { if (root) watchRoot(); console.log(`OPE dev on http://localhost:${PORT}`); });
