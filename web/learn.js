/* LEARNING WHILE BUILDING.

   Two modes for each project. Building is OPE as it always was. Learning while
   building teaches you to code on your own project, from barely touching a
   laptop to reviewing and rejecting an AI's code.

   How a piece of work reaches you:
     1. your AI coder writes the full, working code, and tags pieces of it in
        ope-learn/tags.json with a skill and a stage (ope-learn/LEARN.md tells
        it how, and AGENTS.md tells it to read that)
     2. OPE checks each tag with simple rules and keeps the HIGHER stage when
        they disagree, so nothing too hard ever reaches you
     3. a piece at your skill is handed to you: read it and explain it, change
        it until its test passes, or write it where OPE cut it out
     4. if your project has nothing at your skill today, the practice bank does
   You pass a skill by a test or by an explanation your AI coder grades. There
   is no jumping, but every stage opens with a door test that passes the whole
   stage. "Just do it for me" is always there, and every skip is remembered.

   Everything about you lives in one file on this computer (learnGet/learnSave).
   Everything about the project lives in its ope-learn folder. */
(function(){
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function call(cmd, args){ return OPEBridge.call(cmd, args); }
  function now(){ return new Date().toISOString(); }

  var DIR = 'ope-learn';
  var SKILLS = window.OPESkills, ALL = SKILLS.all(), BANK = window.OPEBank;
  var L = {data: null, open: false, last: null, note: null};

  /* ------------------------------------------------------------ who you are */
  function me(){
    var d = L.data;
    d.me = d.me || {};
    var m = d.me;
    m.passed = m.passed || {}; m.doors = m.doors || {}; m.skips = m.skips || [];
    m.mistakes = m.mistakes || {}; m.done = m.done || {}; m.count = m.count || 0;
    return m;
  }
  function load(){
    return call('learnGet').then(function(r){ L.data = r.data || {}; L.data.modes = L.data.modes || {}; me(); });
  }
  function keep(){ return call('learnSave', {data: L.data}); }
  function root(){ return (window.OPE && OPE.state.root) || ''; }
  function mode(){ return (L.data && L.data.modes[root()]) || 'build'; }
  /* 6.3: Learn only. No project and no AI coder. The OPE Course folder IS the
     project, every piece comes from the practice bank, and OPE Chat marks the
     written answers. Learning while building is the same course on your code. */
  function solo(){ return mode() === 'solo'; }
  function learning(){ return mode() === 'learn' || solo(); }

  /* the first skill not passed. There is no other way forward. */
  function current(){
    var m = me();
    for(var i = 0; i < ALL.length; i++) if(!m.passed[ALL[i].id]) return ALL[i];
    return null;
  }
  function stageOf(n){ return SKILLS.filter(function(s){ return s.n === n; })[0]; }
  function skillOf(id){ return ALL.filter(function(s){ return s.id === id; })[0]; }
  function weak(){
    var m = me(), out = {};
    Object.keys(m.mistakes).forEach(function(k){ if(m.mistakes[k] >= 2) out[k] = true; });
    m.skips.forEach(function(s){ if(s.skill) out[s.skill] = true; });
    return Object.keys(out).filter(skillOf);
  }

  /* ------------------------------------------------------------ the rules check */
  /* The AI says how hard a piece is. These rules say how hard it at least is,
     from what is actually in it. The higher of the two wins, because the whole
     point is that a beginner is never handed something beyond them. */
  function ruleStage(code){
    var s = 1, lines = String(code).split('\n').length;
    if(/\b(for|while)\b/.test(code) && (code.match(/\b(for|while)\b/g) || []).length >= 2) s = Math.max(s, 3);
    if(/\b(async|await|Promise|fetch|axios|XMLHttpRequest|setTimeout)\b/.test(code)) s = Math.max(s, 4);
    if(/\b(class|extends|prototype|reduce|RegExp)\b/.test(code) || /\/[^\/\n]+\/[gimsuy]*\s*\.(test|exec)|\.(match|replace)\(\s*\//.test(code)) s = Math.max(s, 4);
    if(/\b(SELECT|INSERT|UPDATE|DELETE)\s/.test(code) || /\b(crypto|jwt|password|token|secret|stripe)\b/i.test(code)) s = Math.max(s, 6);
    if(lines > 25) s = Math.max(s, 4);
    if(lines > 60) s = Math.max(s, 6);
    return s;
  }

  /* ------------------------------------------------------------ the project's side */
  function readJSON(path){
    return call('read', {path: path}).then(function(r){ try { return JSON.parse(r.text || ''); } catch(e){ return null; } })
      .catch(function(){ return null; });
  }
  function readText(path, where){ return call('read', {path: path, where: where}).then(function(r){ return r.text || ''; }).catch(function(){ return null; }); }
  function write(path, text, where){ return call('write', {path: path, text: text, where: where}); }

  /* THE OPE COURSE. Practice work never goes into anybody's project. It lives
     in its own folder on the Desktop, with its own git history, made the first
     time it is needed. Pieces of your own project stay in your project. */
  var C = 'course';
  function course(){
    return L.course ? Promise.resolve(L.course) : call('courseInit').then(function(r){ L.course = r.path; return r.path; });
  }

  /* the tags the AI wrote, each checked against the file it points at */
  function tags(){
    return readJSON(DIR + '/tags.json').then(function(list){
      list = Array.isArray(list) ? list : (list && list.pieces) || [];
      return Promise.all(list.map(function(t){
        if(!t || !t.id || !t.file || !t.skill || !skillOf(t.skill)) return null;
        return readText(t.file).then(function(text){
          if(text == null) return null;
          var lines = text.split('\n'), start = +t.start, end = +t.end;
          /* the file moved on since it was tagged: find the first line again */
          if(t.first && (lines[start - 1] || '').trim() !== String(t.first).trim()){
            var at = lines.map(function(l){ return l.trim(); }).indexOf(String(t.first).trim());
            if(at < 0) return null;
            end = at + 1 + (end - start); start = at + 1;
          }
          if(!(start >= 1 && end >= start && end <= lines.length)) return null;
          var code = lines.slice(start - 1, end).join('\n');
          var ai = Math.max(0, Math.min(7, +t.stage || skillOf(t.skill).stage));
          return Object.assign({}, t, {start: start, end: end, code: code, ai: ai, rule: ruleStage(code),
            stage: Math.max(ai, ruleStage(code))});
        });
      })).then(function(all){ return all.filter(Boolean); });
    });
  }

  /* ------------------------------------------------------------ LEARN.md */
  /* What the AI coder reads. It is rewritten whenever the mode or your place
     changes, so the AI always knows where you are and what it may do. */
  function learnMd(wait){
    if(mode() !== 'learn'){
      return '# Learning while building (OPE)\n\nMode: Building\n\nThe person is not learning in this project right now. Ignore ope-learn and build as normal.\n';
    }
    wait = wait || [];
    var c = current(), st = c ? stageOf(c.stage) : null, off = st && !st.ai, w = weak();
    var ids = SKILLS.map(function(s){
      return 'Part ' + s.n + ' ' + s.name + ': ' + s.skills.map(function(k){ return k.id; }).join(', ');
    }).join('\n');
    var waitList = wait.map(function(t){
      return '- `' + t.id + '`: `' + t.file + '` lines ' + t.start + ' to ' + t.end + ', ' + (skillOf(t.skill) ? skillOf(t.skill).name : t.skill) +
        '. ' + (t.ask || '') + ' Test: `' + t.test + '`';
    });
    return [
      '# Learning while building (OPE)',
      '',
      'Mode: Learning',
      c ? 'Where they are: Part ' + c.stage + ' ' + c.stageName + ', milestone `' + c.id + '` (' + c.name + ').' : 'They have passed every part.',
      'AI coder: ' + (off ? '**off**. Part 4 and above.' : 'on'),
      w.length ? 'Weak spots to bring back: ' + w.map(function(k){ return '`' + k + '`'; }).join(', ') + '.' : '',
      '',
      'The person is learning to code on this project. Read this before any work, every time.',
      '',
      '## Waiting on the person',
      wait.length
        ? '**Build nothing more in this project until this list is empty.** No new feature, no next task, no next version, not even "while you do that". You may only explain, guide, answer questions and check their work.\n\n' + waitList.join('\n') +
          '\n\nA piece leaves this list when its test passes and they press Check my work in OPE, or when they press Just do it for me. OPE rewrites this file then. You can run the test yourself when they ask you to check it, but only OPE marks it done.'
        : 'Nothing. You may build.',
      '',
      '## 1. Build, and leave their part',
      off ? 'You are switched off for writing code (see 5). You still tag, grade, explain and guide.'
          : 'Write the full, working code as you always would. Then, in the same run, pick **one or two** small pieces of what you just wrote that suit the milestone they are on (or a weak spot) and leave them for the person. Never more than two in one build.',
      '',
      'Tags go in `ope-learn/tags.json`, a list. Add to it, never remove what is there:',
      '',
      '```json',
      '[{"id": "t12", "file": "src/cart.js", "start": 14, "end": 19, "first": "function total(items) {",',
      '  "skill": "write-loop", "stage": 3, "kind": "write",',
      '  "ask": "Write the loop that adds up every price in items.",',
      '  "standin": "return 0",',
      '  "test": "node ope-learn/tests/t12.test.cjs"}]',
      '```',
      '',
      '- `id` new every time. `start` and `end` are line numbers of YOUR finished code, both included. `first` is the exact first line, so OPE can find it if lines move.',
      '- `skill` is one of the ids below. `stage` is how hard YOU think it is, 0 to 7. OPE checks it and keeps the harder of the two.',
      '- `kind` is `read` (they explain what it does, no test), `tweak` (they change it until the test passes) or `write` (OPE takes those lines out and they write them back).',
      '- `standin` (for `write`): one or a few lines OPE puts in the gap so the app still runs while the piece is theirs, like `return 0` or `return []`. The app must not crash with it in place.',
      '- `test` is required for tweak and write: one command that exits 0 only when the piece is right. Write the test file too. It must **pass on your real code and fail on the stand-in**; run it both ways before you tag.',
      '- OPE adds `done` (`passed` or `skipped`) to a tag when it is finished. Never remove it, never set it yourself.',
      '- **Never leave them** login, payments, passwords, tokens, security checks, or anything that deletes or could lose data. Those you always write yourself.',
      '',
      '## 2. Tell them which part is theirs',
      'At the end of the run, in plain words, tell them what OPE left for them. Name the file, the lines and what the piece does, one line each. For example:',
      '',
      '> OPE left one piece of this for you: in `src/cart.js`, lines 14 to 19, the loop that adds up the prices. It is your turn. Open Learn in OPE to see it and its test.',
      '',
      'Then ask exactly one question: **"Do you want step by step help, or do you want to try it yourself?"**',
      '',
      '## 3. Step by step, only if they ask',
      'Guide one small move at a time: what to look at, what the next line needs to do, a question that leads them there. Wait for them after each step. Never type their piece for them, not even "just this once". If they say they will try it themselves, step back and wait until they ask.',
      '',
      '## 4. When they are in a hurry',
      'If they say **urgent** or **no learning this time**, do that one build without leaving a new piece. Pieces already waiting stay waiting, and "Just do it for me" in OPE is how they hand one back.',
      '',
      '## 5. Grade their answers',
      'When a file in `ope-learn/answers/`' + (L.course ? ', or in `' + L.course + '/answers/`,' : '') + ' says `Verdict: waiting`, read the question, the code and their answer. Change that line to `Verdict: pass` or `Verdict: fail`, and add a `## Why` section in plain words: what they got right, what they missed. Pass means they understood it, not that the wording is perfect. For `elite-system`, check what they say against the real code.',
      '',
      '## 6. Part 4 and above: you are off',
      off ? '**This applies now.** Do not write, change or fix code in this project for them. Explain, point at the line, ask a question that leads them there, but they type the code. If they ask you to write it, say they are at Part ' + c.stage + ' and the code is theirs to write. You may still write tests and tags, and plant a bug when a Debugger task asks you to.'
          : 'Not yet. From Part 4 up you stop writing code for them; this file will say so.',
      '',
      '## Milestone ids',
      '',
      ids,
      ''
    ].filter(function(l, i, a){ return !(l === '' && a[i - 1] === ''); }).join('\n');
  }

  /* the AI coder only reads LEARN.md because AGENTS.md tells it to */
  var HOOK = '\n\n## Learning while building (OPE)\n\nIf `ope-learn/LEARN.md` exists and says `Mode: Learning`, read it before any work and follow it. It says where the person is, which pieces to leave for them, what to grade and, from Part 4, that you stop writing code for them. While it lists a piece under Waiting on the person, build nothing more in this project.\n';
  function hookAgents(){
    return readText('AGENTS.md').then(function(have){
      if(have != null && have.indexOf('ope-learn/LEARN.md') >= 0) return;
      if(have == null) return call('install').then(function(){ return readText('AGENTS.md'); }).then(function(again){
        if(again != null && again.indexOf('ope-learn/LEARN.md') < 0) return write('AGENTS.md', again + HOOK);
      });
      return write('AGENTS.md', have + HOOK);
    });
  }
  /* YOUR PART. The pieces the AI coder left for the person that OPE is still
     waiting on: tagged for the milestone they are on, easy enough for them, a
     piece they change or write, and not yet passed or skipped. While this list has
     anything in it, LEARN.md tells the AI coder to build nothing more. */
  function waiting(){
    if(mode() !== 'learn') return Promise.resolve([]);   /* never in Learn only */
    /* exactly the pieces OPE would hand out (see pick), so a piece too hard
       for them, or for another milestone, never blocks the AI coder */
    var m = me(), c = current();
    if(!c) return Promise.resolve([]);
    /* the piece in their hands right now is waiting even though its lines are
       out of the file, where the tag can no longer find them */
    var out = (m.work && m.work.source === 'project' && m.work.tag && (m.work.tag.kind || 'write') !== 'read') ? [m.work.tag] : [];
    return tags().then(function(list){
      return out.concat(list.filter(function(t){
        var kind = t.kind || (c.stage <= 1 ? 'read' : c.stage === 2 ? 'tweak' : 'write');
        return kind !== 'read' && t.test && !t.done && !m.done[t.id] && t.skill === c.id && t.stage <= c.stage &&
          !out.some(function(o){ return o.id === t.id; });
      }));
    }).catch(function(){ return out; });
  }
  function syncMd(){
    /* Learn only writes nothing into anybody's project: no LEARN.md, no tags */
    if(!root() || solo()) return Promise.resolve();
    /* written only when it changed, so opening Learn does not touch the project */
    return Promise.all([waiting(), readText(DIR + '/LEARN.md')]).then(function(r){
      var md = learnMd(r[0]);
      if(r[1] !== md) return write(DIR + '/LEARN.md', md);
    });
  }
  /* OPE writes the outcome onto the tag, so the AI coder can see it too */
  function markTag(id, how){
    return readJSON(DIR + '/tags.json').then(function(list){
      if(!Array.isArray(list)) return;
      var hit = false;
      list.forEach(function(t){ if(t && t.id === id){ t.done = how; t.doneAt = now(); hit = true; } });
      if(hit) return write(DIR + '/tags.json', JSON.stringify(list, null, 2) + '\n');
    });
  }

  /* ------------------------------------------------------------ choosing the next piece */
  function bankFor(skill){
    var all = BANK.filter(function(t){ return t.skill === skill; });
    return (solo() && all.filter(function(t){ return t.solo; })[0]) || all.filter(function(t){ return !t.solo; })[0] || all[0];
  }
  function doorFor(n){ return BANK.filter(function(t){ return t.door === n; })[0]; }

  function pick(){
    var m = me(), c = current();
    if(!c) return Promise.resolve(null);
    /* every third piece goes back to a weak spot */
    var w = weak();
    if(w.length && m.count && m.count % 3 === 0 && !m.reviewed){
      var t = bankFor(w[0]);
      if(t) return Promise.resolve({source: 'bank', review: true, id: t.id, skill: t.skill});
    }
    if(solo()){ var b0 = bankFor(c.id); return Promise.resolve(b0 ? {source: 'bank', id: b0.id, skill: b0.skill} : null); }
    return tags().then(function(list){
      var st = c.stage;
      var mine = list.filter(function(t){
        var kind = t.kind || (st <= 1 ? 'read' : st === 2 ? 'tweak' : 'write');
        return t.skill === c.id && !m.done[t.id] && !t.done && t.stage <= st && (kind === 'read' || t.test);
      })[0];
      if(mine) return {source: 'project', id: mine.id, skill: mine.skill, tag: mine};
      var b = bankFor(c.id);
      return b ? {source: 'bank', id: b.id, skill: b.skill} : null;
    });
  }

  /* a practice piece gives way the moment your own project has one for the
     same skill, because your own code is the point */
  function better(w){
    if(solo() || w.source !== 'bank' || w.review || w.door != null) return Promise.resolve(w);
    return pick().then(function(p){ return p && p.source === 'project' ? p : w; });
  }

  /* ------------------------------------------------------------ doing a piece */
  function practiceDir(t){ return t.id; }
  function comment(file, text){
    var ext = (file.split('.').pop() || '').toLowerCase();
    if(/^(py|sh|zsh|bash|rb|yml|yaml|toml|r|pl)$/.test(ext)) return '# ' + text;
    if(/^(html|htm|xml|svg|vue|svelte|md)$/.test(ext)) return '<!-- ' + text + ' -->';
    if(/^(css|scss|less)$/.test(ext)) return '/* ' + text + ' */';
    if(/^(sql|lua)$/.test(ext)) return '-- ' + text;
    return '// ' + text;
  }
  function marks(file, id){ return {start: comment(file, 'OPE start ' + id), end: comment(file, 'OPE end ' + id)}; }

  /* a bank task is written into the practice folder the first time it is met */
  function setUp(p){
    var m = me();
    m.work = p; m.reviewed = !!p.review;
    if(p.source === 'bank'){
      var t = BANK.filter(function(x){ return x.id === p.id; })[0], dir = practiceDir(t);
      return course().then(function(){ return readText(dir + '/task.md', C); }).then(function(have){
        /* a weak spot coming back starts clean, not with last time's answer in it */
        if(have != null && !p.review) return;
        var files = Object.assign({'task.md': '# ' + t.title + '\n\n' + t.ask + '\n'}, t.files || {});
        if(t.kind === 'check') files['test.cjs'] = BANK.testFile(t.test);
        return Object.keys(files).reduce(function(ch, f){
          return ch.then(function(){ return write(dir + '/' + f, files[f], C); });
        }, Promise.resolve());
      });
    }
    var tag = p.tag;
    if((tag.kind || 'write') !== 'write') return Promise.resolve();
    /* WRITE: the lines come out, the original is kept, and two marker lines
       show where their code goes. The rest of the file is untouched. */
    return readText(tag.file).then(function(text){
      var lines = text.split('\n'), mk = marks(tag.file, tag.id);
      if(text.indexOf(mk.start) >= 0) return;
      var original = lines.slice(tag.start - 1, tag.end).join('\n');
      var pad = (lines[tag.start - 1].match(/^\s*/) || [''])[0];
      /* the stand-in the AI coder wrote keeps the app running while the piece
         is theirs; the test fails on it until the real code is in */
      var stand = tag.standin ? String(tag.standin).split('\n').map(function(l){ return pad + l; }) : [];
      var hole = [pad + mk.start, pad + comment(tag.file, 'Your turn: ' + (tag.ask || 'write this part'))].concat(stand, [pad + mk.end]);
      return write(DIR + '/held/' + tag.id + '.json', JSON.stringify({file: tag.file, original: original}, null, 2)).then(function(){
        return write(tag.file, lines.slice(0, tag.start - 1).concat(hole, lines.slice(tag.end)).join('\n'));
      });
    });
  }

  function answerPath(p){ return p.source === 'bank' ? 'answers/' + p.id + '.md' : DIR + '/answers/' + p.id + '.md'; }
  function answerWhere(p){ return p.source === 'bank' ? C : undefined; }
  function verdict(p){
    return readText(answerPath(p), answerWhere(p)).then(function(t){
      if(t == null) return null;
      var v = /^Verdict:\s*(pass|fail|waiting)/mi.exec(t);
      var why = /##\s*Why\s*\n([\s\S]*)$/i.exec(t);
      return {state: v ? v[1].toLowerCase() : 'waiting', why: why ? why[1].trim() : ''};
    });
  }
  function sendAnswer(p, info, text){
    var body = [
      '# ' + info.title,
      '',
      'Skill: `' + (p.skill || 'door') + '`',
      'Verdict: waiting',
      '',
      '## The question',
      info.ask,
      '',
      '## The code' + (info.where ? ' (' + info.where + ')' : ''),
      '```',
      info.code || '(their whole project)',
      '```',
      '',
      '## Their answer',
      text,
      ''
    ].join('\n');
    return write(answerPath(p), body, answerWhere(p));
  }

  /* 6.3: with no AI coder, OPE Chat marks the answer. It is the small model that
     runs on this computer, so it is kinder and blunter than Claude Code, and the
     card says so. */
  function markWithChat(p, i, answer){
    var q = [
      'You are marking a beginner\'s answer in a coding course. Be fair and plain.',
      'The question: ' + i.ask,
      'A good answer covers: ' + (i.model || 'the point of the question'),
      'Their answer: ' + answer,
      '',
      'Reply with PASS or FAIL on the first line on its own. Then two or three plain sentences saying what they got right and what they missed. Pass them if they understood it, even if the wording is rough.'
    ].join('\n');
    return call('chat', {question: q, code: i.code || '', file: i.where, project: 'OPE Course'}).then(function(r){
      var text = String((r && r.answer) || '').trim();
      var pass = /^\s*(pass|correct|right)\b/i.test(text);
      var why = text.replace(/^\s*(pass|fail|correct|wrong)\b[:.\s-]*/i, '').trim();
      return readText(answerPath(p), answerWhere(p)).then(function(have){
        var body = (have || '').replace(/^Verdict:.*$/m, 'Verdict: ' + (pass ? 'pass' : 'fail')) +
          '\n\n## Why\n' + (why || text) + '\n\nMarked by OPE Chat, the small model on this computer.\n';
        return write(answerPath(p), body, answerWhere(p));
      });
    });
  }

  function testArgs(p){
    if(p.source === 'bank') return ['node', p.id + '/test.cjs'];
    return String(p.tag.test || '').match(/"[^"]*"|'[^']*'|\S+/g).map(function(a){ return a.replace(/^["']|["']$/g, ''); });
  }

  /* ------------------------------------------------------------ passing, failing, skipping */
  function pass(p){
    var m = me();
    m.done[p.id] = now(); m.count++;
    if(p.door != null){
      stageOf(p.door).skills.forEach(function(k){ if(!m.passed[k.id]) m.passed[k.id] = now(); });
      m.doors[p.door] = 'passed';
    } else if(p.skill){
      if(p.review){ m.mistakes[p.skill] = 0; m.skips = m.skips.filter(function(s){ return s.skill !== p.skill; }); }
      else m.passed[p.skill] = m.passed[p.skill] || now();
    }
    m.work = null;
    var tidy = Promise.resolve();
    /* their code stays; only the two marker lines go */
    if(p.source === 'project' && (p.tag.kind || 'write') === 'write'){
      tidy = readText(p.tag.file).then(function(text){
        var mk = marks(p.tag.file, p.id);
        return write(p.tag.file, text.split('\n').filter(function(l){ return l.trim() !== mk.start && l.trim() !== mk.end; }).join('\n'));
      });
    }
    if(p.source === 'project') tidy = tidy.then(function(){ return markTag(p.id, 'passed'); });
    return tidy.then(keep).then(syncMd);
  }
  function mistake(p){
    var m = me(), k = p.skill || ('door-' + p.door);
    m.mistakes[k] = (m.mistakes[k] || 0) + 1;
    if(p.door != null) m.doors[p.door] = 'failed';
    return keep().then(syncMd);
  }
  function skip(p){
    var m = me();
    m.skips.push({id: p.id, skill: p.skill || null, door: p.door, at: now()});
    m.done[p.id] = now(); m.work = null;
    if(p.door != null){ m.doors[p.door] = 'skipped'; return keep().then(syncMd); }
    /* a skip moves you on, but it is written down as a skip, the skill becomes
       a weak spot, and it comes back until you pass it for real */
    if(p.skill && !p.review && !m.passed[p.skill]) m.passed[p.skill] = 'skipped';
    var go = Promise.resolve();
    if(p.source === 'project' && (p.tag.kind || 'write') === 'write'){
      go = Promise.all([readText(p.tag.file), readJSON(DIR + '/held/' + p.id + '.json')]).then(function(r){
        var text = r[0], held = r[1], mk = marks(p.tag.file, p.id);
        if(text == null || !held) return;
        var lines = text.split('\n'), a = -1, b = -1;
        lines.forEach(function(l, i){ if(l.trim() === mk.start) a = i; if(l.trim() === mk.end) b = i; });
        if(a < 0 || b < a) return;
        return write(p.tag.file, lines.slice(0, a).concat(held.original.split('\n'), lines.slice(b + 1)).join('\n'));
      });
    } else if(p.source === 'bank'){
      var t = BANK.filter(function(x){ return x.id === p.id; })[0], dir = practiceDir(t);
      if(t.kind === 'check' && t.solve){
        go = Promise.resolve(typeof t.solve === 'function'
          ? t.solve({here: L.course + '/' + dir, git: function(a){ return call('git', {args: a, where: C}); }}) : t.solve).then(function(sol){
          var files = sol.files || (sol.commit ? {} : sol);
          return Object.keys(files).reduce(function(ch, f){ return ch.then(function(){ return write(dir + '/' + f, files[f], C); }); }, Promise.resolve())
            .then(function(){ if(sol.commit) return call('git', {args: ['add', '-A', '--', dir], where: C}).then(function(){ return call('git', {args: ['commit', '-m', sol.commit, '--', dir], where: C}); }); });
        });
      }
    }
    if(p.source === 'project') go = go.then(function(){ return markTag(p.id, 'skipped'); });
    return go.then(keep).then(syncMd);
  }

  /* ------------------------------------------------------------ the panel */
  function info(p){
    if(p.source === 'bank'){
      var t = BANK.filter(function(x){ return x.id === p.id; })[0];
      var file = t.files && Object.keys(t.files).filter(function(f){ return !/\.(md|txt)$/.test(f) || f === 'why.md'; })[0];
      return {title: t.title, ask: t.ask, kind: t.kind, where: file ? practiceDir(t) + '/' + file : practiceDir(t) + '/task.md',
              folder: t.id, full: (L.course || 'OPE Course') + '/' + t.id,
              code: file && t.files[file], model: t.model, from: p.door != null ? 'The door test' : p.review ? 'Back to a weak spot' : 'The practice bank'};
    }
    var tag = p.tag, kind = tag.kind || 'write';
    return {title: skillOf(tag.skill).name, ask: tag.ask || (kind === 'read' ? 'What do these lines do, and why are they here?' : 'Make the test pass.'),
            kind: kind === 'read' ? 'explain' : 'check', where: tag.file, line: tag.start, code: tag.code,
            from: 'Your own project, ' + tag.file + ' line ' + tag.start, stages: 'your AI said ' + tag.ai + ', the rules said ' + tag.rule};
  }

  function render(){
    var box = $('learn');
    if(!box || !L.data) return;
    var now = root() ? mode() : 'none';
    var pick3 = function(id, label){
      return '<button type="button" role="radio" data-mode="' + id + '" aria-checked="' + (now === id) + '" class="' + (now === id ? 'on' : '') + '">' + label + '</button>';
    };
    var head = '<div class="lrn"><h1>LEARN</h1>'+
      '<div class="modes" role="radiogroup" aria-label="How OPE works">'+
        pick3('build', 'Building') + pick3('learn', 'Learning while building') + pick3('solo', 'Learn only')+
      '</div>';
    if(!root()){
      box.innerHTML = head + '<p class="under">No project open. Building and Learning while building both need one. <b>Learn only</b> does not: press it and OPE makes an OPE Course folder on your Desktop, opens it, and teaches you to code from there.</p></div>';
      wire(); return;
    }
    if(!learning()){
      box.innerHTML = head + '<p class="under">Building: OPE works as it always has. Learning while building leaves small pieces of this project for you, each with a test. Learn only teaches you the whole course with no project at all.</p></div>';
      wire(); return;
    }
    syncMd().catch(function(){});
    var m = me(), c = current();
    if(!c){ box.innerHTML = head + '<p class="under">Every part is passed. You can review and reject an AI\'s code and say why.</p></div>'; wire(); return; }
    var st = stageOf(c.stage), inStage = st.skills.filter(function(k){ return m.passed[k.id]; }).length;
    var html = head+
      '<div class="where2"><b>Part ' + st.n + ' ' + esc(st.name) + '</b><span>You can ' + esc(st.can) + ' once this part is passed.</span></div>'+
      '<ol class="ladder">' + SKILLS.map(function(s){
        var done = s.skills.every(function(k){ return m.passed[k.id]; });
        return '<li class="' + (done ? 'done' : s.n === st.n ? 'now' : '') + '" title="Part ' + s.n + ' ' + esc(s.name) + '"><i>' + s.n + '</i><span>' + esc(s.name) + '</span></li>';
      }).join('') + '</ol>'+
      '<p class="skill">Milestone ' + (inStage + 1) + ' of ' + st.skills.length + ': <b>' + esc(c.name) + '</b>' + (st.ai ? '' : ' <em class="off">AI coder off</em>') + '</p>'+
      '<ol class="miles" aria-label="The milestones of this part">' + st.skills.map(function(k){
        var cls = m.passed[k.id] === 'skipped' ? 'skip' : m.passed[k.id] ? 'done' : k.id === c.id ? 'now' : '';
        return '<li class="' + cls + '" title="' + esc(k.name) + '"></li>';
      }).join('') + '</ol>';
    var door = doorFor(st.n), noneYet = inStage === 0 && !m.doors[st.n];
    var w = m.work;
    if(!w && noneYet && door){
      html += '<div class="card2"><p class="k">THE DOOR TEST</p><p>Already know Part ' + st.n + '? Pass this one test and all ' + st.skills.length + ' milestones count. Fail it and you go through them one at a time, which is fine.</p>'+
        '<div class="acts3"><button class="btn go" type="button" id="lDoor">Take the door test</button><button class="btn" type="button" id="lNoDoor">Start at milestone 1</button></div></div>';
    } else if(w){
      html += '<div class="card2" id="lWork"><p class="k">Loading your piece...</p></div>';
    } else {
      html += '<div class="card2"><p>Finding your next piece...</p></div>';
    }
    var wk = weak();
    if(wk.length) html += '<p class="weak">Weak spots, coming back: ' + wk.map(function(k){ return esc(skillOf(k).name); }).join(', ') + '</p>';
    if(m.skips.length) html += '<p class="weak">Skipped ' + m.skips.length + ' time' + (m.skips.length === 1 ? '' : 's') + '.</p>';
    /* what just happened stays on screen until the next thing you do */
    if(L.note) html += '<div class="card2"><p class="k">' + esc(L.note.head) + '</p><pre class="' + L.note.cls + '">' + esc(L.note.text) + '</pre></div>';
    box.innerHTML = html + '</div>';
    wire();
    if(!w && !(noneYet && door)) return next();
    if(w) return better(w).then(function(p){
      if(p === w) return drawWork(w);
      return setUp(p).then(keep).then(syncMd).then(render);
    });
  }

  function next(){
    return pick().then(function(p){
      if(!p){ me().work = null; return render(); }
      return setUp(p).then(keep).then(syncMd).then(render);
    }).catch(function(e){ OPEBridge.report(e.message); });
  }

  function drawWork(p){
    var box = $('lWork'); if(!box) return;
    var i = info(p);
    var explain = i.kind === 'explain';
    /* a practice piece from before the OPE Course folder existed is written
       there now, so the folder the card points at is really there */
    var ready = p.source === 'bank'
      ? course().then(function(){ i = info(p); return readText(p.id + '/task.md', C); }).then(function(have){ return have == null ? setUp(p).then(keep) : null; })
      : Promise.resolve();
    return ready.then(function(){ return explain ? verdict(p) : null; }).then(function(v){
      box = $('lWork'); if(!box) return;
      var steps = stepsFor(p);
      var html = '<p class="k">' + esc(i.from.toUpperCase()) + '</p><h2>' + esc(i.title) + '</h2><p class="lask">' + esc(i.ask) + '</p>'+
        (steps.length ? '<p class="k">STEP BY STEP</p><ol class="lsteps">' + steps.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '')+
        (explain && i.code ? '<pre class="lcode">' + esc(i.code) + '</pre>' : '')+
        (editable(p).length ? '<div class="led" id="lEdit"></div>' : '')+
        (i.stages ? '<p class="small">How hard: ' + esc(i.stages) + '. OPE uses the harder one.</p>' : '')+
        (i.folder ? '<p class="small">Your folder: <b class="path">' + esc(i.full) + '</b></p>' : '')+
        '<div class="acts3"><button class="btn" type="button" id="lOpen">' + (i.folder ? 'Open the folder' : 'Open ' + esc(i.where.split('/').pop())) + '</button>';
      if(explain){
        if(v && v.state === 'waiting'){
          html += solo()
            ? '</div><p class="wait">OPE Chat is reading it…</p>'
            : '</div><p class="wait">Sent. Tell your AI coder: <b>grade my OPE answer</b>. The verdict shows here when it has.</p>';
        } else {
          if(v && v.state === 'fail') html += '</div><p class="bad">Not yet.</p>' + (v.why ? '<pre class="why">' + esc(v.why) + '</pre>' : '') + '<div class="acts3">';
          html += '</div><textarea id="lAns" rows="6" placeholder="Explain it in your own words."></textarea>'+
            (solo() ? '<p class="small">OPE Chat marks this one. It is the small model on this computer, not your AI coder, so it is quick and a little rough.</p>' : '')+
            '<div class="acts3"><button class="btn go" type="button" id="lSend">' + (solo() ? 'Have OPE Chat mark it' : 'Send to my AI coder') + '</button>';
        }
        if(v && v.state === 'pass') html = '<p class="k">PASSED</p><h2>' + esc(i.title) + '</h2>' + (v.why ? '<pre class="why">' + esc(v.why) + '</pre>' : '') + '<div class="acts3"><button class="btn go" type="button" id="lNext">Next piece</button>';
      } else {
        html += '<button class="btn go" type="button" id="lRun">Check my work</button>';
      }
      html += (v && v.state === 'pass' ? '' : '<button class="btn quiet" type="button" id="lSkip">Just do it for me</button>') + '</div>'+
        (L.last && L.last.id === p.id ? '<pre class="out ' + (L.last.code === 0 ? 'ok' : 'no') + '">' + esc(L.last.text) + '</pre>' : '');
      box.innerHTML = html;
      drawEditor(p);
      var q = function(id){ return document.getElementById(id); };
      if(q('lOpen')) q('lOpen').onclick = function(){
        if(i.folder) return call('courseOpen', {path: i.folder}).catch(function(e){ OPEBridge.report(e.message); });
        window.OPE.openFile(i.where, i.line);
      };
      if(q('lRun')) q('lRun').onclick = function(){ L.note = null; saveEd(p).then(function(){ check(p); }); };
      if(q('lSend')) q('lSend').onclick = function(){
        var t = q('lAns').value.trim(); if(t.length < 10) return q('lAns').focus();
        var b = q('lSend'); b.disabled = true; b.textContent = solo() ? 'OPE Chat is reading it…' : 'Sending…';
        sendAnswer(p, i, t)
          .then(function(){ return solo() ? markWithChat(p, i, t) : null; })
          .then(render)
          .catch(function(e){
            b.disabled = false; b.textContent = 'Have OPE Chat mark it';
            L.note = {head: 'OPE CHAT COULD NOT MARK IT', text: e.message + '\n\nOpen OPE Chat on the right and set its model up, then press the button again. Your answer is saved.', cls: 'why'};
            render();
          });
      };
      if(q('lNext')) q('lNext').onclick = function(){ L.note = null; pass(p).then(render); };
      if(q('lSkip')) q('lSkip').onclick = function(){
        if(q('lSkip').dataset.sure !== '1'){ q('lSkip').dataset.sure = '1'; q('lSkip').textContent = 'It counts as a skip. Press again'; return; }
        L.note = explain && i.model ? {head: 'A GOOD ANSWER TO THE ONE YOU SKIPPED', text: i.model, cls: 'why'} : null;
        L.last = null;
        skip(p).then(next);
      };
    });
  }

  /* ------------------------------------------------------------ steps and the editor */
  /* which computer this is, so the steps say Finder or File Explorer, Return or Enter */
  function plat(){
    var d = window.opeDesktop;
    if(d && d.platform === 'win32') return 'win';
    if(!OPEBridge.native && !d && /Win/i.test(navigator.platform || '')) return 'win';
    return 'mac';
  }
  /* every task says exactly what to do, one small action per step */
  function stepsFor(p){
    if(p.source === 'bank'){
      var st = (window.OPESteps || {})[p.id] || {};
      return st[plat()] || st.all || st.mac || [];
    }
    var tag = p.tag, kind = tag.kind || 'write', mk = marks(tag.file, tag.id);
    if(kind === 'read') return [
      'Press Open ' + tag.file.split('/').pop() + '. OPE shows your code and puts the cursor on line ' + tag.start + '.',
      'Read lines ' + tag.start + ' to ' + tag.end + ' slowly, one line at a time. For each line, say out loud what it does.',
      'Come back here with the cap button on the left.',
      'In the box below, write what those lines do and why they are there, in your own words.',
      'Press Send to my AI coder, then tell your AI coder: grade my OPE answer.'];
    return [
      'Press Open ' + tag.file.split('/').pop() + '. OPE shows your code and puts the cursor on line ' + tag.start + '.',
      'Find the two lines that say ' + mk.start.trim() + ' and ' + mk.end.trim() + '. Your code goes between them.',
      tag.standin
        ? 'Replace the line that says Your turn, and the stand-in under it (' + String(tag.standin).split('\n')[0].trim() + '), with your code. The stand-in only keeps the app running until yours is in. Leave the two OPE lines where they are.'
        : 'Replace the line that says Your turn with your code. Leave the two OPE lines where they are.',
      'Press Save at the top right, or Command S (Control S on Windows).',
      'Come back here with the cap button on the left and press Check my work.',
      'If it says FAIL, read the line after FAIL: it says what is still wrong. Fix that and check again.'];
  }
  /* the files a task has you work in, from Part 1 on. Part 0 is done by hand in
     the folder, because doing it by hand is the lesson */
  function editable(p){
    if(p.source !== 'bank') return [];
    var t = BANK.filter(function(x){ return x.id === p.id; })[0];
    var part = p.door != null ? p.door : (skillOf(t.skill) || {}).stage;
    if(!part || t.kind !== 'check' || typeof t.solve === 'function') return [];
    var out = Object.keys(t.files || {}).concat(Object.keys((t.solve && t.solve.files) || t.solve || {}));
    return out.filter(function(f, i){ return f !== 'task.md' && out.indexOf(f) === i; });
  }
  function drawEditor(p){
    var files = editable(p), box = $('lEdit');
    if(!files.length || !box) return;
    if(files.indexOf(L.edFile) < 0) L.edFile = files[0];
    var f = L.edFile;
    box.innerHTML = '<div class="ltabs" role="tablist">' + files.map(function(x){
        return '<button type="button" role="tab" aria-selected="' + (x === f) + '" class="' + (x === f ? 'on' : '') + '" data-f="' + esc(x) + '">' + esc(x) + '</button>';
      }).join('') + '</div>'+
      '<textarea id="lEd" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="' + esc(f) + '"></textarea>'+
      '<div class="acts3"><button class="btn" type="button" id="lSave">Save</button><span class="small" id="lSaved"></span></div>';
    var ed = $('lEd');
    readText(p.id + '/' + f, C).then(function(t){ ed.value = t || ''; ed.dataset.was = ed.value; });
    ed.onkeydown = function(e){
      if(e.key === 'Tab'){ e.preventDefault(); var a = ed.selectionStart; ed.setRangeText('  ', a, ed.selectionEnd, 'end'); }
      if((e.metaKey || e.ctrlKey) && e.key === 's'){ e.preventDefault(); saveEd(p); }
    };
    $('lSave').onclick = function(){ saveEd(p); };
    Array.prototype.forEach.call(box.querySelectorAll('[data-f]'), function(b){
      b.onclick = function(){ saveEd(p).then(function(){ L.edFile = b.getAttribute('data-f'); drawEditor(p); }); };
    });
  }
  function saveEd(p){
    var ed = $('lEd');
    if(!ed || ed.value === ed.dataset.was) return Promise.resolve();
    return write(p.id + '/' + L.edFile, ed.value, C).then(function(){
      ed.dataset.was = ed.value; var s = $('lSaved'); if(s) s.textContent = 'Saved ' + L.edFile;
    });
  }

  function check(p){
    var b = document.getElementById('lRun'); if(b){ b.disabled = true; b.textContent = 'Checking...'; }
    return call('run', {args: testArgs(p), where: p.source === 'bank' ? C : undefined}).then(function(r){
      var text = (r.out || '') + (r.err ? '\n' + r.err : '');
      L.last = {id: p.id, code: r.code, text: text.trim() || (r.code === 0 ? 'Passed.' : 'It did not pass.')};
      if(r.code === 0){ L.note = {head: 'PASSED', text: L.last.text, cls: 'out ok'}; L.last = null; return pass(p).then(render); }
      return mistake(p).then(render);
    }).catch(function(e){ L.last = {id: p.id, code: 1, text: e.message}; render(); });
  }

  function wire(){
    Array.prototype.forEach.call(document.querySelectorAll('#learn [data-mode]'), function(b){
      b.onclick = function(){ setMode(b.getAttribute('data-mode')); };
    });
    var d = $('lDoor'), n = $('lNoDoor');
    if(d) d.onclick = function(){
      var st = current().stage, t = doorFor(st);
      var p = {source: 'bank', id: t.id, door: st};
      me().doors[st] = 'tried';
      setUp(p).then(keep).then(syncMd).then(render);
    };
    if(n) n.onclick = function(){ me().doors[current().stage] = 'declined'; keep().then(render); };
  }

  function setMode(v){
    /* Learn only has no project of its own, so the course folder becomes one:
       its files and its history are then there to look at, and Part 0's git
       milestones have a real history to read. */
    if(v === 'solo'){
      return course().then(function(path){
        return Promise.resolve(window.OPE.openRoot(path)).then(function(){
          L.data.modes[path] = 'solo';
          window.OPE.showLearn();
          return keep();
        });
      }).then(render).catch(function(e){ OPEBridge.report(e.message); });
    }
    if(root()) L.data.modes[root()] = v;
    return keep().then(function(){ return v === 'learn' ? course().then(hookAgents) : null; }).then(syncMd).then(render)
      .catch(function(e){ OPEBridge.report(e.message); });
  }

  /* ------------------------------------------------------------ in and out */
  function show(){ L.open = true; return (L.data ? Promise.resolve() : load()).then(function(){ return learning() ? course() : null; }).then(render); }
  function hide(){ L.open = false; }
  var redraw = null;
  OPEBridge.onChange(function(ev){
    if(!L.open || !L.data) return;
    var paths = ev.paths || [];
    /* the AI graded an answer or wrote new tags */
    if(!paths.some(function(p){ return /ope-learn\/(answers|tags)/.test(p); })) return;
    clearTimeout(redraw); redraw = setTimeout(render, 300);
  });

  window.OPELearn = {show: show, hide: hide, ruleStage: ruleStage, learnMd: function(){ return learnMd(); },
                     _state: L, _tags: tags, _pick: pick};
})();
