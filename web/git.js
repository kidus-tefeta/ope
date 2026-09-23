/* VERSIONS, FROM GIT.

   A version is a git tag named with the project number: 1.0, 1.1, 2.0. The OPE
   prompt tells the AI to make one at the end of every version. A project that
   was never built with the prompt still has a history, so when there are no
   numbered tags, every commit is shown as a step instead.

   What a version "touched" is worked out two ways:
     changes  the files that differ from the version before it
     lines    the lines in the file as it is NOW whose last change came from a
              commit inside that version, so a line that was rewritten later
              belongs to the later version, which is the truth */
(function(){
  var EMPTY = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';   // git's empty tree
  var NUM = /^(?:v|ope[\/-])?(\d+)\.(\d+)$/i;

  function git(args){ return OPEBridge.call('git', {args: args}); }

  function isRepo(){
    return git(['rev-parse', '--is-inside-work-tree'])
      .then(function(r){ return r.code === 0 && /true/.test(r.out); })
      .catch(function(){ return false; });
  }

  function loadVersions(){
    return isRepo().then(function(repo){
      if(!repo) return {repo:false, numbered:false, projects:[]};
      var fmt = '%(refname:short)%09%(objectname)%09%(*objectname)%09%(creatordate:iso-strict)%09%(contents:subject)';
      return git(['for-each-ref', '--sort=creatordate', '--format=' + fmt, 'refs/tags']).then(function(r){
        var tags = r.out.split('\n').filter(Boolean).map(function(l){
          var p = l.split('\t'), m = NUM.exec(p[0] || '');
          if(!m) return null;
          return {name: m[1] + '.' + m[2], tag: p[0], major: +m[1], minor: +m[2],
                  commit: p[2] || p[1], date: p[3] || '', summary: p[4] || ''};
        }).filter(Boolean);
        if(tags.length) return numbered(tags);
        return history();
      });
    });
  }

  function numbered(tags){
    tags.sort(function(a, b){ return a.major - b.major || a.minor - b.minor; });
    tags.forEach(function(t, i){ t.prev = i ? tags[i - 1].commit : EMPTY; });
    var byMajor = {};
    tags.forEach(function(t){ (byMajor[t.major] = byMajor[t.major] || []).push(t); });
    var projects = Object.keys(byMajor).map(Number).sort(function(a, b){ return a - b; }).map(function(m){
      return {id: m + '.0', title: 'Project ' + m + '.0', versions: byMajor[m]};
    });
    return {repo:true, numbered:true, projects: projects};
  }

  /* THE NUMBERS ARE IN THE HISTORY, NOT IN A LIST SOMEBODY KEEPS.
     The method says every save is written as "1.11 what it did", so the project
     numbers are already in the git log. Reading them there means a version
     somebody else started shows up by itself, with no list to keep up to date
     and nothing to remember. */
  function numbersFromLog(){
    return git(['log', '--format=%H%x09%cI%x09%s', '-n', '600']).then(function(r){
      if(r.code !== 0) return [];
      var by = {};
      r.out.split('\n').filter(Boolean).forEach(function(l){
        var p = l.split('\t'), m = /^\s*(?:v|ope[\/-])?(\d+)\.(\d+)\b[:. ]?\s*(.*)$/.exec(p[2] || '');
        if(!m) return;
        var name = m[1] + '.' + m[2];
        var v = by[name] || (by[name] = {name: name, major: +m[1], minor: +m[2], commits: [], summary: '', date: p[1]});
        v.commits.push(p[0]);
        /* the log runs newest first, so the last line seen is the first save of
           that version, and its words are what the version set out to do */
        var said = (m[3] || '').replace(/^\d+[a-z]?\s+/i, '').trim();
        if(said) v.summary = said.charAt(0).toUpperCase() + said.slice(1);
        v.date = p[1];
      });
      return Object.keys(by).map(function(k){ return by[k]; })
        .sort(function(a, b){ return a.major - b.major || a.minor - b.minor; });
    }).catch(function(){ return []; });
  }

  /* THE NUMBER EXISTS THE MOMENT IT IS SAID.
     A project gets its first save only after work has started, so the history
     cannot show a project that was named a minute ago. The method writes it
     into PROJECTS.md first, as "## 1.13 Reviews" with "Building" or "Done" on
     the line under it, and this reads that. */
  function projectsFile(){
    return OPEBridge.call('read', {path: 'PROJECTS.md'}).then(function(r){
      var out = [], cur = null;
      String((r && r.text) || '').split('\n').forEach(function(line){
        var h = /^#{1,3}\s*(?:project\s+)?(\d+)\.(\d+)\b[:.]?\s*(.*)$/i.exec(line.trim());
        if(h){
          cur = {name: h[1] + '.' + h[2], major: +h[1], minor: +h[2], summary: h[3].trim(), building: false, planning: false, tasks: [], blurbLines: []};
          out.push(cur); return;
        }
        /* the tasks under it: "1 none", "1a what gets built", "2b what waits
           on the person", with or without bold or a list dash in front */
        var t = cur && /^[-*\s]*\**\s*(\d+[a-z]?)\**[.:)]?\s+(.+)$/i.exec(line.trim());
        /* an indented line under a task is that task's own detail, and the
           only place the deeper half of the map can come from: a dash is a
           plain words bullet, a number is a step in how it works. Written in
           PROJECTS.md and nowhere else, so it cannot drift from the file the
           method already makes everybody keep. */
        var deep = cur && cur.tasks.length && /^\s{2,}(?:[-*]|\d+[.)])\s+\S/.test(line);
        if(deep){
          var last = cur.tasks[cur.tasks.length - 1];
          var d = /^\s+[-*]\s+(.+)$/.exec(line);
          if(d) last.atoms.push(d[1].replace(/\*\*/g, '').trim());
          else last.steps.push(/^\s+\d+[.)]\s+(.+)$/.exec(line)[1].replace(/\*\*/g, '').trim());
          return;
        }
        if(t && cur.status !== undefined){ cur.tasks.push({id: t[1].toLowerCase(), text: t[2].replace(/\*\*/g, '').trim(), atoms: [], steps: []}); return; }
        if(cur && cur.status === undefined && line.trim()){
          var w = line.trim().toLowerCase();
          cur.status = /^building\b/.test(w) ? 'building' : /^planning\b/.test(w) ? 'planning' : /^done\b/.test(w) ? 'done' : '';
          cur.building = cur.status === 'building';
          cur.planning = cur.status === 'planning';
          return;
        }
        /* the plain paragraphs written between the status word and the task
           list: what the project actually is, for a person who never sees
           the code. The map has nothing else worth showing when someone
           zooms in, so it is kept, not thrown away like before. */
        if(cur && cur.status !== undefined && !cur.tasks.length) cur.blurbLines.push(line);
      });
      out.forEach(function(p){
        p.blurb = p.blurbLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        delete p.blurbLines;
      });
      return out;
    }).catch(function(){ return []; });
  }

  function history(){
    return git(['log', '--format=%H%x09%P%x09%cI%x09%s', '-n', '300']).then(function(r){
      var rows = r.out.split('\n').filter(Boolean).map(function(l){
        var p = l.split('\t');
        return {commit: p[0], parent: (p[1] || '').split(' ')[0], date: p[2], summary: p[3] || ''};
      }).reverse();
      if(!rows.length) return {repo:true, numbered:false, projects:[]};
      var versions = rows.map(function(c, i){
        return {name: 'step ' + (i + 1), commit: c.commit, prev: c.parent || EMPTY, date: c.date,
                summary: c.summary, step: true};
      });
      return {repo:true, numbered:false, projects:[{id:'history', title:'History', versions: versions}]};
    });
  }

  /* a numbered project that is not one unbroken stretch of history, just the
     commits that belong to it, however far apart */
  function changesOf(list){
    var files = {};
    return list.reduce(function(chain, c){
      return chain.then(function(){
        return git(['show', '--relative', '--name-status', '--format=', '-M', c]).then(function(r){
          r.out.split('\n').filter(Boolean).forEach(function(l){
            var p = l.split('\t'), st = (p[0] || '').charAt(0), path = (st === 'R' || st === 'C') ? p[2] : p[1];
            if(!path) return;
            var was = files[path];
            if(st === 'R' || st === 'C') st = 'M';
            if(st === 'D') files[path] = (was === 'A') ? null : 'D';
            else if(was === 'A' && st === 'M') files[path] = 'A';
            else if(was === 'D' && st === 'A') files[path] = 'M';
            else files[path] = st;
          });
        });
      });
    }, Promise.resolve()).then(function(){
      return Object.keys(files).filter(function(p){ return files[p]; }).map(function(p){ return {path: p, status: files[p]}; });
    });
  }

  /* NOW: WHAT IS BEING WRITTEN THIS MINUTE.
     Not a version yet, the working folder as it stands against the last
     checkpoint. It is how you watch an AI coder work: the files it is touching
     get their green box the moment it saves them. */
  function liveChanges(){
    return git(['status', '--porcelain', '--untracked-files=all']).then(function(r){
      if(r.code !== 0) return [];
      var out = [];
      r.out.split('\n').filter(Boolean).forEach(function(l){
        var code = l.slice(0, 2), path = l.slice(3);
        if(/^R/.test(code)){ var bits = path.split(' -> '); path = bits[bits.length - 1]; }
        if(path.charAt(0) === '"') { try { path = JSON.parse(path); } catch(e){} }
        var st = code === '??' ? 'A' : /D/.test(code) ? 'D' : /A/.test(code) ? 'A' : 'M';
        out.push({path: path, status: st});
      });
      return out;
    }).catch(function(){ return []; });
  }

  /* the lines of a file that are new or changed since the last checkpoint */
  function liveLines(path){
    var pick = function(r){
      var nums = [], m;
      var re = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
      while((m = re.exec(r.out))){
        var start = +m[1], count = m[2] === undefined ? 1 : +m[2];
        for(var i = 0; i < count; i++) nums.push(start + i);
      }
      return nums;
    };
    return git(['diff', '-U0', '--no-color', 'HEAD', '--', path]).then(function(r){
      if(r.code === 0 && r.out) return pick(r);
      /* a brand new file is in no commit, so git has nothing to compare it to */
      return git(['diff', '-U0', '--no-color', '--no-index', '--', '/dev/null', path])
        .then(pick).catch(function(){ return []; });
    }).catch(function(){ return []; });
  }

  function changes(v){
    if(v.live) return liveChanges();
    if(v.commits) return changesOf(v.commits);
    return git(['diff', '--relative', '--name-status', '-M', v.prev, v.commit]).then(function(r){
      var files = [];
      r.out.split('\n').filter(Boolean).forEach(function(l){
        var p = l.split('\t'), s = (p[0] || '').charAt(0);
        if(s === 'R' || s === 'C') files.push({path: p[2], status: 'M', from: p[1]});
        else files.push({path: p[1], status: s});
      });
      return files;
    });
  }

  var rangeCache = {};
  function commitsIn(v){
    if(v.commits){ var own = {}; v.commits.forEach(function(h){ own[h] = true; }); return Promise.resolve(own); }
    var key = v.prev + '..' + v.commit;
    if(rangeCache[key]) return Promise.resolve(rangeCache[key]);
    var args = v.prev === EMPTY ? ['rev-list', v.commit] : ['rev-list', v.commit, '^' + v.prev];
    return git(args).then(function(r){
      var set = {};
      r.out.split('\n').filter(Boolean).forEach(function(h){ set[h] = true; });
      rangeCache[key] = set;
      return set;
    });
  }

  /* the line numbers, in the file as it is on disk now, that the version wrote */
  function lines(v, path){
    if(v.bare) return liveLines(path);
    if(v.live) return Promise.all([liveLines(path), linesOfVersion(v, path)]).then(function(both){
      var seen = {}, out = [];
      both[0].concat(both[1]).forEach(function(n){ if(!seen[n]){ seen[n] = true; out.push(n); } });
      return out;
    });
    return linesOfVersion(v, path);
  }

  function linesOfVersion(v, path){
    return Promise.all([commitsIn(v), git(['blame', '--porcelain', '--', path])]).then(function(res){
      var set = res[0], r = res[1], out = [];
      if(r.code !== 0) return out;
      r.out.split('\n').forEach(function(l){
        var m = /^([0-9a-f]{40}) \d+ (\d+)/.exec(l);
        if(m && set[m[1]]) out.push(+m[2]);
      });
      return out;
    });
  }

  function checkpoint(path){
    return git(['add', '--', path]).then(function(){
      return git(['commit', '-m', 'OPE edit: ' + path, '--', path]);
    }).then(function(r){
      if(r.code !== 0) throw new Error((r.err || r.out || 'Nothing to save.').trim().split('\n').pop());
      return r;
    });
  }

  function startTracking(){
    return git(['init']).then(function(){ return git(['add', '-A']); })
      .then(function(){ return git(['commit', '-m', '1.0: first checkpoint']); })
      .then(function(r){
        if(r.code !== 0) throw new Error((r.err || r.out).trim().split('\n').pop() || 'git could not save a checkpoint.');
        return git(['tag', '-a', '1.0', '-m', 'First checkpoint']);
      });
  }

  function listFiles(repo){
    if(!repo) return OPEBridge.call('list').then(function(r){ return r.files || []; });
    return git(['ls-files', '--cached', '--others', '--exclude-standard']).then(function(r){
      var seen = {}, out = [];
      r.out.split('\n').forEach(function(f){ if(f && !seen[f]){ seen[f] = true; out.push(f); } });
      return out.sort();
    });
  }

  window.OPEGit = {EMPTY: EMPTY, isRepo: isRepo, loadVersions: loadVersions, changes: changes, lines: lines,
    liveChanges: liveChanges, numbersFromLog: numbersFromLog, projectsFile: projectsFile,
                   checkpoint: checkpoint, startTracking: startTracking, listFiles: listFiles};
})();
