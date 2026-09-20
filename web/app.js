/* OPE, the interface.

   Four panels, left to right: the projects, the versions of the one you picked,
   the files, and the code. Pick a version and every folder it touched gets a
   green box. Open one and the files it touched are boxed. Open a file and the
   lines it wrote are boxed. Everything reads from the project folder and from
   git, and everything you save goes straight back into the real file. */
(function(){
  var S = {root:'', repo:false, numbered:false, projects:[], project:null, version:null,
           changed:{}, gone:[], dirs:{}, files:[], open:{}, path:'', dirty:false, loadedText:'',
           editor:null, monaco:null, deco:[], promptText:'', recent:[], busy:false,
           /* what is being written this minute, and whether the window follows it.
              Opening a file yourself stops the following; picking Now starts it. */
           live:[], hot:{}, follow:true};
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function base(p){ return String(p).split(/[\/\\]/).pop(); }
  function status(left, right){ if(left != null) $('statusLeft').textContent = left; if(right != null) $('statusRight').textContent = right; }

  /* ------------------------------------------------------------ the editor */
  var LANG = {js:'javascript', mjs:'javascript', cjs:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript',
    json:'json', html:'html', htm:'html', vue:'html', svelte:'html', css:'css', scss:'scss', less:'less', md:'markdown',
    py:'python', swift:'swift', go:'go', rs:'rust', java:'java', kt:'kotlin', rb:'ruby', php:'php', sh:'shell',
    zsh:'shell', bash:'shell', yml:'yaml', yaml:'yaml', sql:'sql', c:'c', h:'c', cpp:'cpp', cc:'cpp', hpp:'cpp',
    cs:'csharp', xml:'xml', plist:'xml', svg:'xml', toml:'ini', ini:'ini', env:'ini', dart:'dart', lua:'lua',
    r:'r', m:'objective-c', mm:'objective-c', graphql:'graphql', gql:'graphql', txt:'plaintext'};
  function langFor(path){
    var name = base(path).toLowerCase();
    if(name === 'dockerfile') return 'dockerfile';
    var ext = name.indexOf('.') >= 0 ? name.split('.').pop() : '';
    return LANG[ext] || 'plaintext';
  }

  function loadMonaco(){
    return new Promise(function(done){
      var baseUrl = location.href.replace(/[^\/]*$/, '');
      window.MonacoEnvironment = {getWorkerUrl: function(){
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
          'self.MonacoEnvironment={baseUrl:"' + baseUrl + 'vendor/"};importScripts("' + baseUrl + 'vendor/vs/base/worker/workerMain.js");');
      }};
      require.config({paths:{vs:'vendor/vs'}});
      require(['vs/editor/editor.main'], function(){
        var m = window.monaco;
        m.editor.defineTheme('ope', {base:'vs-dark', inherit:true, rules:[], colors:{
          'editor.background':'#000000', 'editorGutter.background':'#000000', 'editor.lineHighlightBackground':'#0b1116',
          'editorLineNumber.foreground':'#4a535a', 'editorLineNumber.activeForeground':'#f2f2f2',
          'editor.selectionBackground':'#264f78', 'editorIndentGuide.background1':'#12191e',
          'scrollbarSlider.background':'#1f2a3180', 'minimap.background':'#000000'}});
        S.monaco = m;
        S.editor = m.editor.create($('code'), {value:'', language:'plaintext', theme:'ope', automaticLayout:true,
          fontFamily:'ui-monospace, "SF Mono", Menlo, monospace', fontSize:13, minimap:{enabled:true},
          scrollBeyondLastLine:false, renderLineHighlight:'line', smoothScrolling:false});
        S.editor.onDidChangeModelContent(function(){
          if(!S.path) return;
          setDirty(S.editor.getValue() !== S.loadedText);
        });
        S.editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, save);
        done();
      });
    });
  }

  function setDirty(d){
    S.dirty = d;
    $('dirty').classList.toggle('hidden', !d);
    $('saveBtn').disabled = !d;
  }

  /* ------------------------------------------------------------ the views */
  function show(which){
    $('welcome').classList.toggle('hidden', which !== 'welcome');
    $('learn').classList.toggle('hidden', which !== 'learn');
    if(which !== 'learn' && window.OPELearn) OPELearn.hide();
    $('code').classList.toggle('hidden', which !== 'code');
    $('blank').classList.toggle('hidden', which !== 'blank');
    var code = which === 'code';
    $('saveBtn').classList.toggle('hidden', !code);
    $('checkBtn').classList.toggle('hidden', !code || !S.repo);
    if(!code){ $('lineTag').classList.add('hidden'); $('dirty').classList.add('hidden'); }
    if(code && S.editor) S.editor.layout();
  }

  function welcome(){
    S.path = ''; setDirty(false);
    $('tabName').textContent = 'Welcome';
    var recent = (S.recent || []).filter(function(r){ return r !== S.root; });
    $('welcome').innerHTML =
      '<div class="term">'+
        '<h1>OPE</h1><p class="under">Out Past Engineering. See the app your AI built, version by version.</p>'+
        '<p class="line"><i>&gt;</i> step 1 <em>open your project and press Add OPE to this project. Your AI coder reads it by itself (or copy the prompt for tools that do not read files)</em></p>'+
        '<p class="line"><i>&gt;</i> step 2 <em>tell it: "project 1.0, build me ..."</em></p>'+
        '<p class="line"><i>&gt;</i> step 3 <em>open the project folder here and pick a version</em></p>'+
        '<div class="acts2">'+
          '<button class="btn big go" id="copyPrompt" type="button">Copy the prompt</button>'+
          '<button class="btn big" id="openBtn" type="button">'+(S.root ? 'Open another project' : 'Open a project')+'</button>'+
          (S.root ? '<button class="btn big go" id="installBtn" type="button">Add OPE to this project</button>' : '')+
        '</div>'+
        '<pre id="promptText">'+esc(unwrap(S.promptText) || 'Loading the prompt...')+'</pre>'+
        (recent.length ? '<div class="recent"><p class="line"><em>recent</em></p>'+
          recent.map(function(r){ return '<button type="button" data-recent="'+esc(r)+'">'+esc(r)+'</button>'; }).join('')+'</div>' : '')+
      '</div>';
    $('copyPrompt').onclick = copyPrompt;
    $('openBtn').onclick = pickProject;
    if($('installBtn')) $('installBtn').onclick = installSystem;
    Array.prototype.forEach.call(document.querySelectorAll('[data-recent]'), function(b){
      b.onclick = function(){ openRoot(b.getAttribute('data-recent')); };
    });
    show('welcome');
  }

  /* the prompt is written with hard line breaks for a text editor; in a narrow
     box those breaks land mid line, so paragraphs are joined for reading only */
  function unwrap(text){
    var out = [], code = false;
    String(text || '').split('\n').forEach(function(l){
      if(/^```/.test(l)){ code = !code; out.push(l); return; }
      var prev = out.length ? out[out.length - 1] : '';
      var starts = /^\s*($|#|[-*] |\d+\. |```|---)/.test(l);
      var prevEnds = !prev || /^\s*(#|```|---)/.test(prev) || code;
      if(!code && !starts && !prevEnds && /\S/.test(prev)) out[out.length - 1] = prev + ' ' + l.trim();
      else out.push(l);
    });
    return out.join('\n');
  }

  /* the rules file every AI coder reads by itself, and the full system as a
     folder it opens only when the work needs it */
  function installSystem(){
    var b = $('installBtn'); b.disabled = true; b.textContent = 'Adding...';
    OPEBridge.call('install').then(function(r){
      b.textContent = 'Added to ' + base(S.root);
      var line = (r.added.length ? 'Added ' + r.added.length + ' files' : 'Already added') + (r.kept.length ? ', kept ' + r.kept.length + ' you already had' : '');
      return reload().then(function(){ status(line); });
    }).catch(function(e){ b.disabled = false; b.textContent = 'Add OPE to this project'; status(e.message); });
  }

  function copyPrompt(){
    var b = $('copyPrompt'), text = S.promptText;
    var done = function(){ b.textContent = 'Copied'; setTimeout(function(){ b.textContent = 'Copy the prompt'; }, 1600); };
    OPEBridge.call('copy', {text: text}).then(function(r){
      if(r.ok) return done();
      return navigator.clipboard.writeText(text).then(done);
    }).catch(function(){ b.textContent = 'Select the text below and copy it'; });
  }

  function blank(msg){ $('blank').innerHTML = '<div>'+msg+'</div>'; show('blank'); }

  /* ------------------------------------------------------------ opening */
  function pickProject(){
    OPEBridge.call('pick').then(function(r){
      if(r.root) return openRoot(r.root, true);
      if(r.manual) askPath();
    }).catch(function(e){ status(e.message); });
  }

  function askPath(){
    $('sheetCard').innerHTML = '<h2>Open a project</h2><p>The full path to the project folder.</p>'+
      '<input id="pathIn" placeholder="/Users/you/projects/my-app" autofocus>'+
      '<div class="acts"><button class="btn" id="cancelIn" type="button">Cancel</button>'+
      '<button class="btn go" id="okIn" type="button">Open</button></div>';
    $('sheet').classList.remove('hidden');
    var go = function(){ var v = $('pathIn').value.trim(); if(v){ $('sheet').classList.add('hidden'); openRoot(v); } };
    $('okIn').onclick = go; $('cancelIn').onclick = function(){ $('sheet').classList.add('hidden'); };
    $('pathIn').onkeydown = function(e){ if(e.key === 'Enter') go(); if(e.key === 'Escape') $('cancelIn').click(); };
    setTimeout(function(){ $('pathIn').focus(); }, 30);
  }

  function openRoot(path, already){
    var step = already ? Promise.resolve({root: path}) : OPEBridge.call('open', {path: path});
    return step.then(function(r){
      if(r.root !== S.root){ S.libSel = null; S.libMajor = null; }
      S.root = r.root; S.project = null; S.version = null; S.open = {}; S.path = ''; S.changed = {}; S.dirs = {}; S.gone = [];
      if(S.recent.indexOf(r.root) < 0) S.recent.unshift(r.root);
      if(r.library) S.library = r.library;
      $('where').textContent = r.root;
      return reload();
    }).then(function(){
      blank('Pick a project on the left, then a version.<br>Folders it touched get a green box.');
      $('tabName').textContent = base(S.root);
    }).catch(function(e){ status(e.message); });
  }

  function reload(){
    /* the project being looked at, remembered across the reload, because its
       list can be rebuilt from the numbers below and would otherwise be lost */
    var keepId = S.project && S.project.id;
    return OPEGit.loadVersions().then(function(d){
      S.repo = d.repo; S.numbered = d.numbered; S.projects = d.projects;
      if(S.libSel && applyLibSel()){ /* the numbered selection is rebuilt from the library */ }
      else if(S.libMajor && applyLibMajor()){ S.version = null; }
      else if(S.project) S.project = S.projects.filter(function(p){ return p.id === S.project.id; })[0] || null;
      if(S.version && S.project && !S.version.lib){
        var keep = S.version.name;
        S.version = S.project.versions.filter(function(v){ return v.name === keep; })[0] || null;
      }
      return OPEGit.listFiles(S.repo);
    }).then(function(files){
      S.files = files;
      return Promise.all([S.repo ? OPEGit.numbersFromLog() : [], OPEGit.projectsFile()]);
    }).then(function(both){
      /* the history says what was saved; PROJECTS.md says what was named and
         what is being built right now. A number in either one is a project. */
      var byName = {};
      (both[0] || []).forEach(function(n){ byName[n.name] = n; });
      (both[1] || []).forEach(function(f){
        var n = byName[f.name];
        if(n){ n.building = f.building; n.planning = f.planning; n.tasks = f.tasks; if(f.summary) n.named = f.summary; }
        else byName[f.name] = {name: f.name, major: f.major, minor: f.minor, commits: [],
                               summary: f.summary, named: f.summary, building: f.building, planning: f.planning, tasks: f.tasks};
      });
      S.numbers = Object.keys(byName).map(function(k){ return byName[k]; })
        .sort(function(a, b){ return a.major - b.major || a.minor - b.minor; });
      /* a folder with no library entry and no tags still gets its projects by
         number, so this works for anybody who opens a folder, not only here */
      if(!S.libMajor && !S.libSel && !S.numbered && S.numbers.length){
        var groups = {};
        S.numbers.forEach(function(n){
          (groups[n.major] = groups[n.major] || []).push({name: n.name, summary: n.named || n.summary,
            commits: n.commits, building: n.building, planning: n.planning, tasks: n.tasks});
        });
        S.projects = Object.keys(groups).map(Number).sort(function(a, b){ return a - b; }).map(function(m){
          return {id: 'num:' + m, title: 'Project ' + m + '.0', versions: groups[m]};
        });
        var again = S.projects.filter(function(p){ return p.id === keepId; })[0];
        if(again) S.project = again;
        else if(!S.project && S.projects.length === 1 && keepId) S.project = S.projects[0];
        if(S.version && S.project && !S.version.bare){
          var name = S.version.name;
          S.version = S.project.versions.filter(function(v){ return v.name === name; })[0] || S.version;
        }
      }
      renderProjects(); renderVersions();
      return S.version ? markVersion(S.version) : renderTree();
    }).then(function(){
      status(S.libSel ? 'Project ' + S.libSel + ', from your numbered projects' : S.repo ? (S.numbered ? 'Tracking versions with git' : 'Git history, no numbered versions yet') : 'Not tracked by git yet',
             isLive(S.version) ? (hotLine() || versionLine()) : S.version ? versionLine() : '');
    });
  }

  /* ------------------------------------------------------------ projects */
  /* THE LIBRARY. Every project folder you keep, in one list. The open one is
     expanded to show its numbered projects; any other opens with one click.
     The list lives on this Mac only, never in the app itself. */
  function inner(){
    if(!S.root) return '';
    if(!S.repo){
      return '<div class="empty sub"><b>No versions yet.</b><br>This folder is not saved with git, so OPE cannot see its history.'+
        '<br><br><button class="btn go" id="trackBtn" type="button">Start tracking as 1.0</button></div>';
    }
    if(!S.projects.length) return '<div class="empty sub"><b>No checkpoints yet.</b><br>When your AI saves version 1.0 it shows up here.</div>';
    return (S.numbered ? '' : '<div class="empty sub">Built without the OPE prompt, so every save shows as a step.</div>')+
      S.projects.map(function(p, i){
        var on = S.project && S.project.id === p.id;
        return '<button class="row sub'+(on ? ' sel' : '')+'" data-p="'+i+'" type="button"><span class="caret">'+(on ? '▾' : '▸')+'</span>'+
          '<span class="name">'+esc(p.title)+'</span><span class="meta">'+p.versions.length+'</span></button>';
      }).join('');
  }

  /* NUMBERED PROJECTS. A library entry can carry a project number (1.0, 1.8,
     1.1.4) and the commits that made it. They are listed by number, a number
     sits under its whole number (1.8 under 1.0), and picking one boxes in green
     exactly what those commits touched. Entries with no number are plain folders. */
  function numParts(n){ return String(n).split('.').map(Number); }
  function numCmp(a, b){
    var x = numParts(a), y = numParts(b);
    for(var i = 0; i < Math.max(x.length, y.length); i++){ var d = (x[i] || 0) - (y[i] || 0); if(d) return d; }
    return 0;
  }
  function libNumbered(){ return (S.library || []).filter(function(e){ return e.number; }).sort(function(a, b){ return numCmp(a.number, b.number); }); }
  function libParent(e, all){
    var major = numParts(e.number)[0] + '.0';
    if(e.number === major) return null;
    return all.filter(function(x){ return x.number === major; })[0] || null;
  }
  function libVersion(e){ return {name: e.number, summary: e.name, commits: e.commits || null, note: e.note || '', lib: true}; }
  function libGroup(top, all){
    var kids = all.filter(function(x){ return libParent(x, all) === top; });
    var versions = (kids.length ? kids : [top]).map(libVersion);
    /* WHAT SOMEBODY ELSE STARTED SHOWS UP TOO.
       The library is a list kept by hand. The history is the truth: a version
       saved as "1.12 ..." belongs to this project whether anybody wrote it down
       or not, so it is added here rather than waiting to be typed in. */
    var major = numParts(top.number)[0];
    (S.numbers || []).forEach(function(n){
      if(n.major !== major) return;
      var have = versions.filter(function(v){ return v.name === n.name; })[0];
      if(have){ if(!have.commits && n.commits.length) have.commits = n.commits; have.building = n.building; have.planning = n.planning; have.tasks = n.tasks; return; }
      versions.push({name: n.name, summary: n.named || n.summary, commits: n.commits, lib: true, fromLog: true,
                     building: n.building, planning: n.planning, tasks: n.tasks});
    });
    versions.sort(function(a, b){ return numCmp(a.name, b.name); });
    return {id: 'lib:' + top.number, title: top.number + ' ' + top.name, versions: versions};
  }
  function applyLibMajor(){
    var all = libNumbered(), top = all.filter(function(x){ return x.number === S.libMajor; })[0];
    if(!top) return null;
    S.project = libGroup(top, all);
    return top;
  }
  function selectMajor(top){
    var go = top.path === S.root ? Promise.resolve() : openRoot(top.path);
    return Promise.resolve(go).then(function(){
      S.libMajor = top.number; S.libSel = null; S.version = null;
      applyLibMajor(); clearMarks();
      if($('versions').classList.contains('shut')) fold('versions', false);
      renderProjects(); renderVersions();
      status('Pick a version of ' + top.number + ' in the next column', '');
    });
  }
  function applyLibSel(){
    var all = libNumbered(), e = all.filter(function(x){ return x.number === S.libSel; })[0];
    if(!e) return null;
    var parent = libParent(e, all), kids = all.filter(function(x){ return parent && libParent(x, all) === parent; });
    var versions = (parent ? kids : [e]).map(libVersion);
    var top = parent || e;
    S.libMajor = top.number;
    S.project = libGroup(top, all);
    versions = S.project.versions;
    S.version = versions.filter(function(v){ return v.name === e.number; })[0];
    return e;
  }
  function selectNumbered(e){
    var go = e.path === S.root ? Promise.resolve() : openRoot(e.path);
    return Promise.resolve(go).then(function(){
      S.libSel = e.number;
      applyLibSel();
      if($('versions').classList.contains('shut')) fold('versions', false);
      renderProjects(); renderVersions();
      if(S.version && S.version.commits && S.repo){ status('Project ' + e.number + ', ' + e.name); return markVersion(S.version); }
      clearMarks();
      status(e.note || (S.repo ? 'No commits are matched to ' + e.number + ' yet.' : 'This folder is not saved with git.'), e.number + ' ' + e.name);
    });
  }

  function renderProjects(){
    var box = $('projectList');
    var all = libNumbered();
    var plain = (S.library || []).filter(function(e){ return !e.number; });
    if(S.root && !(S.library || []).some(function(x){ return x.path === S.root; })) plain.unshift({path: S.root, name: base(S.root)});
    S.libOpen = S.libOpen || {};
    var html = [];
    all.filter(function(e){ return !libParent(e, all); }).forEach(function(top){
      html.push('<div class="lib'+(top.path === S.root ? ' on' : '')+'">'+
        '<button class="row libname'+(S.libMajor === top.number ? ' sel' : '')+'" data-num="'+esc(top.number)+'" type="button" title="'+esc(top.path)+'">'+
          '<span class="num">'+esc(top.number)+'</span><span class="name">'+esc(top.name)+'</span></button></div>');
    });
    if(plain.length){
      if(all.length) html.push('<div class="group">OTHER FOLDERS</div>');
      plain.forEach(function(item){
        var active = item.path === S.root, open = active && !S.innerShut;
        html.push('<div class="lib'+(active ? ' on' : '')+'">'+
          '<button class="row libname" data-plain="'+esc(item.path)+'" type="button" title="'+esc(item.path)+'">'+
            '<span class="caret">'+(open ? '▾' : '▸')+'</span><span class="name">'+esc(item.name || base(item.path))+'</span>'+
            '<span class="x" data-unlib="'+esc(item.path)+'" title="Take it off the list" role="button" aria-label="Take it off the list">×</span></button>'+
          (open ? inner() : '')+'</div>');
      });
    }
    box.innerHTML = (html.join('') || '<div class="empty">Add a project folder to begin.</div>')+
      '<button class="row addlib" id="addLib" type="button"><span class="caret">+</span><span class="name">Add a project folder</span></button>';

    Array.prototype.forEach.call(box.querySelectorAll('[data-num]'), function(b){
      b.onclick = function(){
        var n = b.getAttribute('data-num'), top = all.filter(function(x){ return x.number === n; })[0];
        if(top) selectMajor(top);
      };
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-plain]'), function(b){
      b.onclick = function(ev){
        var path = b.getAttribute('data-plain');
        if(ev.target.hasAttribute('data-unlib')){
          OPEBridge.call('libraryRemove', {path: path}).then(function(r){ S.library = r.items || []; renderProjects(); });
          return;
        }
        S.libSel = null; S.libMajor = null;
        if(path === S.root){ S.innerShut = !S.innerShut; renderProjects(); return; }
        S.innerShut = false;
        openRoot(path);
      };
    });
    $('addLib').onclick = pickProject;
    var track = $('trackBtn');
    if(track) track.onclick = function(){
      if(!confirm('This saves the folder with git, which adds a hidden .git folder inside it.\n\n'+
                  'If this folder is uploaded as a website exactly as it is, that .git folder would go with it. Continue?')) return;
      track.disabled = true; track.textContent = 'Saving...';
      OPEGit.startTracking().then(reload).catch(function(e){ track.disabled = false; track.textContent = 'Start tracking as 1.0'; status(e.message); });
    };
    Array.prototype.forEach.call(box.querySelectorAll('[data-p]'), function(b){
      b.onclick = function(){
        var p = S.projects[+b.getAttribute('data-p')];
        S.libSel = null; S.libMajor = null;
        S.project = (S.project && S.project.id === p.id) ? null : p;
        if(S.project && $('versions').classList.contains('shut')) fold('versions', false);
        if(!S.project){ S.version = null; clearMarks(); }
        renderProjects(); renderVersions();
      };
    });
  }

  function renderVersions(){
    var panel = $('versions');
    var hot = hotList(), live = hot.length > 0;
    panel.classList.toggle('hidden', !S.project && !live);
    if(!S.project && !live) return;
    $('versionsHead').textContent = S.project ? S.project.title.toUpperCase() : 'NOW';
    /* NOW IS ITS OWN ROW, AND IT NEVER CLAIMS A NUMBER.
       Two chats can be in one folder on two different projects at once, so the
       work happening this minute does not belong to whichever version is last.
       Now says what is moving and names the files; the numbered versions below
       it stay what they have always been, what that version built. */
    var list = (S.project ? S.project.versions : []).slice();
    var building = list.some(function(v){ return v.building; });
    if(live){
      var say = hot.length > 2
        ? base(hot[0]) + ', ' + base(hot[1]) + ' and ' + (hot.length - 2) + ' more'
        : hot.map(base).join(', ');
      if(building) list = list.map(function(v){ return v.building ? Object.assign({}, v, {live: true, now: say}) : v; });
      else list = [{name: 'Now', live: true, bare: true, summary: say}].concat(list);
    }
    var same = function(a, b){ return a && b && (a.bare || b.bare ? !!a.bare === !!b.bare : (a.lib || !a.commit) ? a.name === b.name : a.commit === b.commit); };
    $('versionList').innerHTML = list.map(function(v, i){
      return '<button class="row ver'+(same(S.version, v) ? ' sel' : '')+(v.live ? ' live' : '')+(v.lib && !v.commits ? ' faint' : '')+'" data-v="'+i+'" type="button">'+
        '<b>'+esc(v.name)+(v.bare ? '<i class="now"></i>' : v.live ? '<i class="now">Now</i>' : v.building ? '<i class="bld">building</i>' : v.planning ? '<i class="bld">planning</i>' : '')+'</b>'+
        (v.summary ? '<span>'+esc(v.summary)+'</span>' : '')+
        (v.now ? '<span class="nowsay">'+esc(v.now)+'</span>' : '')+
        /* a project that is being built with no task list is the mistake this
           is here to catch, so it says so on the row */
        (v.building ? '<span class="'+(v.tasks && v.tasks.length ? '' : 'notasks')+'">'+
          (v.tasks && v.tasks.length ? taskCount(v.tasks) : 'No task list yet')+'</span>' : '')+
        /* planning is talk, not code: no task list is expected yet */
        (v.planning ? '<span>Planning, no code yet</span>' : '')+'</button>';
    }).join('');
    Array.prototype.forEach.call($('versionList').querySelectorAll('[data-v]'), function(b){
      b.onclick = function(){
        var v = list[+b.getAttribute('data-v')];
        if(v.lib){
          var e = libNumbered().filter(function(x){ return x.number === v.name; })[0];
          /* a version the history knows and the hand kept list does not is
             picked here, like any other */
          if(e){ selectNumbered(e); return; }
        }
        if(same(S.version, v)){ S.version = null; clearMarks(); renderVersions(); return; }
        S.version = v; S.follow = true; renderVersions(); markVersion(v);
      };
    });
  }

  function taskCount(tasks){
    var mine = tasks.filter(function(t){ return /a$/.test(t.id); }).length;
    var theirs = tasks.filter(function(t){ return /^\d+$/.test(t.id) && !/^none\b/i.test(t.text); }).length;
    return mine + (mine === 1 ? ' task' : ' tasks') + (theirs ? ', ' + theirs + ' for you' : '');
  }

  /* THE TASK LIST, WHERE THE CODE WOULD BE, until a file is opened */
  function showTasks(v){
    if(!v || !v.tasks || !v.tasks.length) return;
    blank('<div class="tasks"><p class="tk">Project ' + esc(v.name) + (v.summary ? ' · ' + esc(v.summary) : '') +
      (v.building ? ' · building' : '') + '</p>' +
      v.tasks.map(function(t){
        var kind = /a$/.test(t.id) ? 'a' : /b$/.test(t.id) ? 'b' : 'n';
        return '<div class="task ' + kind + '"><b>' + esc(t.id) + '</b><span>' + esc(t.text) + '</span></div>';
      }).join('') + '</div>');
  }

  function versionLine(){
    var n = Object.keys(S.changed).length;
    return S.version ? S.version.name + ' · ' + n + (n === 1 ? ' file' : ' files') + ' touched' : '';
  }

  /* ------------------------------------------------------------ marking */
  function clearMarks(){
    S.changed = {}; S.dirs = {}; S.gone = [];
    renderTree(); status(null, '');
    if(S.path) paintLines();
  }

  /* the version being built is the last one, so that is the one the work on
     disk belongs to, however it was picked: from the library or from git */
  /* the work happening now belongs to the project PROJECTS.md says is being
     built. With none marked, it stands on its own row and claims no number. */
  function isLive(v){ return !!(v && (v.bare || v.building) && hotList().length); }

  /* WHAT IS BEING WRITTEN, RIGHT NOW, BY WHOEVER IS WRITING IT.
     Two chats can be in one project at the same time, one on the SQL and one
     on the tools. Every file touched in the last minute and a half is flagged,
     not just the newest, so both halves are seen moving at once. */
  /* NOW IS ACTIVITY, NOT MESS.
     An uncommitted file that nobody has touched for an hour is not being
     written, it is just sitting there, so it gets no flag. A file is Now only
     while something is actually saving it. */
  var HOT_FOR = 90000;
  function hotTouch(path){ S.hot[path] = Date.now(); }
  function hotList(){
    var now = Date.now(), out = [];
    Object.keys(S.hot).forEach(function(p){
      if(now - S.hot[p] > HOT_FOR) delete S.hot[p]; else out.push(p);
    });
    return out.sort(function(a, b){ return S.hot[b] - S.hot[a]; });
  }
  function hotLine(){
    var list = hotList();
    if(!list.length) return null;
    if(list.length === 1) return 'Now · writing ' + list[0];
    return 'Now · writing ' + base(list[0]) + ' and ' + (list.length - 1) + ' more';
  }

  /* every folder above a file, so the row is on screen and not folded away */
  function openFolders(path){
    var parts = path.split('/');
    for(var i = 1; i < parts.length; i++) S.open[parts.slice(0, i).join('/')] = true;
  }

  function markVersion(v){
    var get = isLive(v) && !v.bare
      ? OPEGit.changes(v).then(function(files){
          var seen = {}; files.forEach(function(f){ seen[f.path] = true; });
          return hotList().filter(function(p){ return !seen[p]; })
            .map(function(p){ return {path: p, status: 'M'}; }).concat(files);
        })
      : v.bare ? Promise.resolve(hotList().map(function(p){ return {path: p, status: 'M'}; }))
      : OPEGit.changes(v);
    return get.then(function(files){
      if(S.version !== v) return;
      S.changed = {}; S.dirs = {}; S.gone = [];
      files.forEach(function(f){
        if(f.status === 'D'){ S.gone.push(f.path); }
        S.changed[f.path] = f.status;
        var parts = f.path.split('/');
        for(var i = 1; i < parts.length; i++) S.dirs[parts.slice(0, i).join('/')] = true;
      });
      if(isLive(v)) hotList().forEach(openFolders);
      renderTree();
      status(null, isLive(v) ? (hotLine() || versionLine()) : versionLine());
      if(isLive(v) && S.follow && !S.dirty){
        var top = hotList()[0];
        if(top && top !== S.path) return Promise.resolve(openFile(top)).then(function(){ status(null, hotLine()); });
      }
      if(S.path) paintLines(); else showTasks(v);
    }).catch(function(e){ status(e.message); });
  }

  /* ------------------------------------------------------------ the tree */
  function buildTree(){
    var rootNode = {dirs:{}, files:[]};
    var all = S.files.slice();
    S.gone.forEach(function(g){ if(all.indexOf(g) < 0) all.push(g); });
    all.forEach(function(path){
      var parts = path.split('/'), node = rootNode;
      for(var i = 0; i < parts.length - 1; i++){
        node = node.dirs[parts[i]] = node.dirs[parts[i]] || {dirs:{}, files:[]};
      }
      node.files.push(path);
    });
    return rootNode;
  }

  function renderTree(){
    var box = $('tree');
    if(!S.root){ box.innerHTML = ''; $('fileCount').textContent = ''; return; }
    $('fileCount').textContent = S.files.length + ' files';
    var html = [];
    (function walk(node, prefix, depth){
      Object.keys(node.dirs).sort(function(a, b){ return a.localeCompare(b); }).forEach(function(name){
        var path = prefix ? prefix + '/' + name : name, open = !!S.open[path], green = !!S.dirs[path];
        html.push('<button class="row'+(green ? ' green' : '')+'" data-dir="'+esc(path)+'" type="button" style="padding-left:'+(10 + depth * 14)+'px">'+
          '<span class="caret">'+(open ? '▾' : '▸')+'</span><span class="name">'+esc(name)+'</span>'+
          (green ? '<span class="meta">'+esc(S.version.name)+'</span>' : '')+'</button>');
        if(open) walk(node.dirs[name], path, depth + 1);
      });
      node.files.sort(function(a, b){ return base(a).localeCompare(base(b)); }).forEach(function(path){
        var st = S.changed[path], gone = st === 'D';
        /* THE ONE BEING WRITTEN THIS SECOND, not just one of the touched.
           That is the whole point of Now: which SQL file, which tool. */
        var hot = isLive(S.version) && !!S.hot[path];
        html.push('<button class="row'+(st && !gone ? ' green' : '')+(gone ? ' gone' : '')+(hot ? ' hot' : '')+(S.path === path ? ' sel' : '')+
          '" data-file="'+esc(path)+'" type="button" style="padding-left:'+(22 + depth * 14)+'px"'+(gone ? ' disabled' : '')+'>'+
          '<span class="name">'+esc(base(path))+'</span>'+
          (hot ? '<span class="meta now">writing</span>'
               : st ? '<span class="meta">'+({A:'new', M:'changed', D:'removed', T:'changed'}[st] || 'changed')+'</span>' : '')+'</button>');
      });
    })(buildTree(), '', 0);
    box.innerHTML = html.join('') || '<div class="empty">This folder is empty.</div>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-dir]'), function(b){
      b.onclick = function(){
        var p = b.getAttribute('data-dir'); S.open[p] = !S.open[p]; renderTree();
        if(!S.open[p] || !S.dirs[p]) return;
        /* the files a version touched can sit below a long run of subfolders */
        var first = Array.prototype.filter.call($('tree').querySelectorAll('[data-file].green'), function(f){
          return f.getAttribute('data-file').indexOf(p + '/') === 0 && f.getAttribute('data-file').slice(p.length + 1).indexOf('/') < 0;
        })[0];
        if(first) first.scrollIntoView({block: 'center'});
      };
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-file]'), function(b){
      /* their choice wins: opening a file yourself stops Now following the work,
         and picking Now again starts it */
      b.onclick = function(){ S.follow = false; openFile(b.getAttribute('data-file')); };
    });
  }

  /* ------------------------------------------------------------ a file */
  function openFile(path){
    if(S.dirty && S.path && path !== S.path && !confirm('You have unsaved changes in ' + base(S.path) + '. Leave them?')) return;
    return OPEBridge.call('read', {path: path}).then(function(r){
      S.path = path; $('notice').classList.add('hidden');
      $('tabName').textContent = base(path); $('tab').title = path;
      renderTree();
      if(r.binary){ blank(esc(base(path)) + ' is not a text file, so there is no code to show.'); return; }
      if(r.tooBig){ blank(esc(base(path)) + ' is too big to open here.'); return; }
      if(!S.editor){ blank('The code view is still loading.'); return; }
      var m = S.monaco, uri = m.Uri.parse('ope:///' + encodeURI(path));
      var model = m.editor.getModel(uri);
      if(model) model.setValue(r.text); else model = m.editor.createModel(r.text, langFor(path), uri);
      m.editor.getModels().forEach(function(x){ if(x !== model) x.dispose(); });
      S.loadedText = r.text;
      S.editor.setModel(model);
      setDirty(false);
      show('code');
      paintLines();
    }).catch(function(e){ blank(esc(e.message)); });
  }

  function paintLines(){
    if(!S.editor || !S.path) return;
    var tag = $('lineTag');
    var clear = function(){ S.deco = S.editor.deltaDecorations(S.deco, []); tag.classList.add('hidden'); };
    if(!S.version || !S.repo || !S.changed[S.path]) return clear();
    var picked = S.version, path = S.path;
    /* the version to ask, which for the one being built is that version plus
       whatever is on disk. It is a copy, so what is compared below is the
       version the reader picked, not this. */
    var v = picked.bare ? picked : isLive(picked) ? Object.assign({}, picked, {live: true}) : picked;
    OPEGit.lines(v, path).then(function(nums){
      if(S.version !== picked || S.path !== path) return;
      nums.sort(function(a, b){ return a - b; });
      var set = {}; nums.forEach(function(n){ set[n] = true; });
      var m = S.monaco, list = [];
      nums.forEach(function(n){
        var cls = 'ope-line' + (set[n - 1] ? '' : ' first') + (set[n + 1] ? '' : ' last');
        list.push({range: new m.Range(n, 1, n, 1), options:{isWholeLine:true, className: cls,
          linesDecorationsClassName:'ope-gutter', overviewRuler:{color:'#22C55E', position: m.editor.OverviewRulerLane.Left}}});
      });
      S.deco = S.editor.deltaDecorations(S.deco, list);
      tag.textContent = nums.length ? nums.length + ' lines from ' + v.name : 'nothing from ' + v.name + ' left in this file';
      tag.classList.remove('hidden');
      /* JUMP ONCE, NOT ON EVERY REPAINT.
         Now repaints every time a file is saved, and it was pulling the page
         back to the first green line each time, so scrolling was impossible
         while an AI coder was writing. */
      var key = (v.name || '') + '|' + path;
      if(nums.length && S.jumped !== key){ S.jumped = key; S.editor.revealLineInCenterIfOutsideViewport(nums[0]); }
    });
  }

  function save(){
    if(!S.path || !S.dirty) return;
    var text = S.editor.getValue(), b = $('saveBtn');
    b.disabled = true; b.textContent = 'Saving...';
    return OPEBridge.call('write', {path: S.path, text: text}).then(function(){
      S.loadedText = text; setDirty(false); b.textContent = 'Save';
      status('Saved ' + S.path);
    }).catch(function(e){ b.textContent = 'Save'; setDirty(true); status(e.message); });
  }

  function checkpointFile(){
    if(!S.path) return;
    var go = S.dirty ? save() : Promise.resolve();
    var b = $('checkBtn'); b.disabled = true; b.textContent = 'Saving...';
    Promise.resolve(go).then(function(){ return OPEGit.checkpoint(S.path); }).then(function(){
      status('Checkpoint saved for ' + S.path); return reload();
    }).catch(function(e){ status(e.message); })
      .then(function(){ b.disabled = false; b.textContent = 'Checkpoint'; });
  }

  /* ------------------------------------------------------------ live */
  var pending = null;
  OPEBridge.onChange(function(ev){
    if(!S.root) return;
    clearTimeout(pending);
    pending = setTimeout(function(){
      var paths = ev.paths || [];
      reload().then(function(){
        /* following Now: the file that just changed is the one to look at */
        /* the watcher hands us what was saved, which is the only thing that
           means somebody is working. Paths can arrive whole, so cut them back
           to where the project starts. */
        var hit = null;
        paths.forEach(function(p){
          var rel = p;
          if(S.root && p.indexOf(S.root + '/') === 0) rel = p.slice(S.root.length + 1);
          if(rel.indexOf('/.git/') >= 0 || rel.indexOf('.git/') === 0) return;
          if(S.files.indexOf(rel) < 0) return;      /* not a file of this project */
          hotTouch(rel); hit = rel;
        });
        if(hit){
          renderVersions();                     /* Now appears the moment work starts */
          if(!isLive(S.version)) return;
          openFolders(hit); renderTree(); status(null, hotLine());
          if(S.follow && !S.dirty && hit !== S.path){
            return Promise.resolve(openFile(hit)).then(function(){ status(null, hotLine()); });
          }
        }
        if(!S.path) return;
        var touched = !paths.length || paths.some(function(p){ return p === S.path || p.slice(-S.path.length) === S.path; });
        if(!touched) return;
        OPEBridge.call('read', {path: S.path}).then(function(r){
          if(r.text == null || r.text === S.editor.getValue()) return;
          if(!S.dirty){
            var pos = S.editor.getPosition(), top = S.editor.getScrollTop();
            S.loadedText = r.text; S.editor.getModel().setValue(r.text); setDirty(false);
            if(pos) S.editor.setPosition(pos); S.editor.setScrollTop(top);
            paintLines(); status('Updated ' + S.path + ' from disk');
          } else {
            var n = $('notice');
            n.innerHTML = '<span>' + esc(base(S.path)) + ' changed on disk while you were editing.</span>'+
              '<button class="btn" id="takeDisk" type="button">Load the new version</button>'+
              '<button class="btn" id="keepMine" type="button">Keep mine</button>';
            n.classList.remove('hidden');
            $('takeDisk').onclick = function(){ n.classList.add('hidden'); S.loadedText = r.text; S.editor.getModel().setValue(r.text); setDirty(false); paintLines(); };
            $('keepMine').onclick = function(){ n.classList.add('hidden'); };
          }
        }).catch(function(){});
      });
    }, 150);
  });

  /* ------------------------------------------------------------ folding */
  function fold(panel, shut){
    var el = $(panel);
    var now = shut == null ? !el.classList.contains('shut') : shut;
    el.classList.toggle('shut', now);
    var chev = el.querySelector('.chev');
    if(chev) chev.textContent = now ? '›' : '‹';
    try{ localStorage.setItem('ope-fold-' + panel, now ? '1' : ''); }catch(e){}
    if(S.editor) setTimeout(function(){ S.editor.layout(); }, 30);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-fold]'), function(h){
    h.onclick = function(){ fold(h.getAttribute('data-fold')); };
  });
  $('chatLogo').onclick = function(){ fold('chat'); };
  /* a narrow window folds the chat first, then the projects, once, as it crosses */
  var lastW = innerWidth;
  function narrow(){
    var w = innerWidth;
    if(w < 1240 && lastW >= 1240) fold('chat', true);
    if(w < 1040 && lastW >= 1040) fold('projects', true);
    lastW = w;
  }
  addEventListener('resize', narrow);
  if(innerWidth < 1240){ lastW = 9999; narrow(); }
  ['projects', 'chat'].forEach(function(p){
    try{ if(localStorage.getItem('ope-fold-' + p)) fold(p, true); }catch(e){}
  });

  /* ------------------------------------------------------------ OPE Chat

     It explains, and nothing else, and it says so. It runs on this Mac: Apple's
     own model where there is one, Qwen2.5 Coder 3B through Ollama everywhere
     else. What it is shown is the file open in the editor, or only the lines
     selected, so the question and the code arrive together. */
  var CHAT = {engine:'', busy:false, poll:null};

  /* THE RULE IS KEPT HERE, NOT LEFT TO THE MODEL.

     Told plainly never to fix anything, the 3B model was asked to fix a bug and
     invented one, then wrote the "corrected" code for it. A small model does not
     hold a rule under pressure. So a question asking for a change or a fix never
     reaches it as asked: it is told to explain what the code does now, and the
     answer says first that OPE Chat only explains. And whatever comes back, a
     block of code is taken out before it is shown, because a person who cannot
     read code will paste it in. */
  var CHANGE = /\b(fix(e[sd])?|repair|debug|chang(e|ing)|edit|modify|rewrite|refactor|improve|optimi[sz]e|add|remov(e|ing)|delete|build|creat(e|ing)|implement|make (it|this|them)|updat(e|ing)|replace|convert|write (me )?(the |some |a |new )?code|give me (the )?(new |fixed |full |updated )?code|bugs?|broken|not working|does ?n[o']t work|crash(es|ing)?|errors?)\b/i;
  var SAYS_NO = 'OPE Chat only explains code. Your AI coder can make that change. Here is what this code does now.';
  function noCode(t){
    return String(t || '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/```[\s\S]*$/, '')
      .replace(/^.*\b(corrected|fixed|updated|modified|new|revised) (version of the )?code\b.*:\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function chatSetup(e){
    var box = $('chatSetup'), line = $('chatEngine');
    CHAT.engine = e.engine; line.textContent = e.label || '';
    if(e.engine === 'apple' || e.engine === 'ollama'){ box.classList.add('hidden'); box.innerHTML = ''; stopPoll(); return; }
    box.classList.remove('hidden');
    if(e.engine === 'none'){
      box.innerHTML = '<p>' + (window.opeDesktop ? 'OPE Chat uses a free model through Ollama.' : 'This Mac has no Apple Intelligence, so OPE Chat uses a free model through Ollama.') + '</p>' +
        '<button type="button" id="chatGet">Get Ollama, free</button><p>Then come back here and OPE downloads the model, 1.9 GB, once.</p>';
      $('chatGet').onclick = function(){ OPEBridge.call('chatOpen', {url:'https://ollama.com/download'}); };
      startPoll(8000);
    } else if(e.engine === 'start-ollama'){
      box.innerHTML = '<p>Ollama is installed but not open.</p><button type="button" id="chatStart">Open Ollama</button>';
      $('chatStart').onclick = function(){ OPEBridge.call('chatOpen', {}); };
      startPoll(3000);
    } else if(e.engine === 'need-model'){
      var p = e.pulling;
      if(p && p.status === 'error'){
        box.innerHTML = '<p>' + esc(p.error) + '</p><button type="button" id="chatPull">Try the download again</button>';
      } else if(p){
        var pct = p.total ? Math.floor(100 * (p.completed || 0) / p.total) : 0;
        box.innerHTML = '<p>Downloading the model. ' + (p.total ? pct + '% of ' + (p.total / 1e9).toFixed(1) + ' GB' : esc(p.status)) + '</p>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>';
        startPoll(1500); return;
      } else {
        box.innerHTML = '<p>One download, 1.9 GB, and OPE Chat works with no internet from then on.</p>' +
          '<button type="button" id="chatPull">Download the model</button>';
      }
      var b = $('chatPull');
      if(b) b.onclick = function(){ b.disabled = true; OPEBridge.call('chatPull').then(function(){ startPoll(1500); checkEngine(); }); };
    }
  }
  function startPoll(ms){ stopPoll(); CHAT.poll = setTimeout(checkEngine, ms); }
  function stopPoll(){ if(CHAT.poll){ clearTimeout(CHAT.poll); CHAT.poll = null; } }
  function checkEngine(){
    CHAT.poll = null;
    return OPEBridge.call('chatEngine').then(chatSetup).catch(function(){ $('chatEngine').textContent = 'OPE Chat is not available'; });
  }

  /* plain text from the model, shown as paragraphs, with `code` kept readable */
  function chatText(t){
    return String(t || '').trim().split(/\n{2,}/).map(function(par){
      return '<p>' + esc(par).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function chatContext(){
    var out = {project: S.root ? base(S.root) : '', version: S.version ? S.version.name : '', file: S.path || '', code: '', lines: ''};
    if(S.editor && S.path){
      var sel = S.editor.getSelection(), model = S.editor.getModel();
      if(sel && !sel.isEmpty()){
        out.code = model.getValueInRange(sel);
        out.lines = sel.startLineNumber + ' to ' + sel.endLineNumber;
      } else {
        out.code = S.editor.getValue();
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ a picture in the chat

     The words in it are read on this Mac by Apple's Vision and go to the model
     with the question. Nothing is sent anywhere. It reads words, not what the
     picture looks like, and it says so when there are none. */
  var PIC = null;   // {url, text, words}
  function clearPic(){ PIC = null; $('askPic').classList.add('hidden'); $('askPicImg').removeAttribute('src'); $('askFile').value = ''; }
  function takePic(file){
    if(!file || !/^image\//.test(file.type)) return;
    if(file.size > 20 * 1024 * 1024){ status('That picture is over 20 MB.'); return; }
    var fr = new FileReader();
    fr.onload = function(){
      var url = fr.result;
      $('askPicImg').src = url; $('askPicText').textContent = 'Reading the words in the picture';
      $('askPic').classList.remove('hidden');
      PIC = {url: url, text: '', words: 0, reading: true};
      var mine = PIC;
      OPEBridge.call('readImage', {data: url}).then(function(r){
        if(PIC !== mine) return;
        PIC.text = String(r.text || '').trim(); PIC.words = r.words || 0; PIC.reading = false;
        $('askPicText').textContent = PIC.words ? PIC.words + ' words read from the picture' : 'No words found in this picture';
      }).catch(function(err){
        if(PIC !== mine) return;
        PIC.reading = false; $('askPicText').textContent = err.message;
      });
    };
    fr.readAsDataURL(file);
  }
  $('askAttach').onclick = function(){ $('askFile').click(); };
  $('askFile').onchange = function(){ takePic(this.files && this.files[0]); };
  $('askPicX').onclick = clearPic;
  $('askIn').addEventListener('paste', function(e){
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for(var i = 0; i < items.length; i++){
      if(items[i].kind === 'file' && /^image\//.test(items[i].type)){
        e.preventDefault(); takePic(items[i].getAsFile());
        /* the Mac app's web view still dropped a stray mark into the box on an
           image paste, which then went to the model as the question. Whatever
           was typed before the paste is put back. */
        var box = this, keep = box.value, at = box.selectionStart;
        setTimeout(function(){ if(box.value !== keep){ box.value = keep; try{ box.setSelectionRange(at, at); }catch(_){} } }, 0);
        return;
      }
    }
  });
  /* a picture dropped anywhere else must not replace the whole app with the image */
  document.addEventListener('dragover', function(e){ e.preventDefault(); });
  document.addEventListener('drop', function(e){ if(!e.target.closest || !e.target.closest('#askForm')) e.preventDefault(); });
  (function(){
    var form = $('askForm');
    form.addEventListener('dragover', function(e){ e.preventDefault(); form.classList.add('drop'); });
    form.addEventListener('dragleave', function(){ form.classList.remove('drop'); });
    form.addEventListener('drop', function(e){
      e.preventDefault(); form.classList.remove('drop');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) takePic(f);
    });
  })();

  $('askForm').onsubmit = function(e){
    e.preventDefault();
    var box = $('askIn'), text = box.value.replace(/[\uFFFC\u200B]/g, '').trim();
    var pic = PIC;
    if(pic && pic.reading) return status('Still reading the words in the picture.');
    if(!text && !pic) return box.focus();
    if(CHAT.busy) return;
    var log = $('chatLog');
    var intro = $('chatIntro'); if(intro && CHAT.engine && (CHAT.engine === 'apple' || CHAT.engine === 'ollama')) intro.remove();
    var ctx = chatContext();
    var about = ctx.file ? (ctx.lines ? base(ctx.file) + ', lines ' + ctx.lines : base(ctx.file)) : 'No file open';
    log.insertAdjacentHTML('beforeend', '<div class="chat-msg me"><span class="about">' + esc(about) + '</span>' +
      (pic ? '<img class="shot" alt="" src="' + esc(pic.url) + '">' : '') + esc(text) + '</div>');
    if(pic && !pic.text){
      clearPic(); box.value = '';
      log.insertAdjacentHTML('beforeend', '<div class="chat-msg bad">There are no words in that picture for OPE to read. OPE reads the words in a picture, not what it looks like.</div>');
      log.scrollTop = log.scrollHeight; return;
    }
    if(CHAT.engine !== 'apple' && CHAT.engine !== 'ollama'){
      log.insertAdjacentHTML('beforeend', '<div class="chat-msg bad">OPE Chat needs a model on this ' + (window.opeDesktop ? 'computer' : 'Mac') + ' first. The steps are above.</div>');
      log.scrollTop = log.scrollHeight; return;
    }
    var wait = document.createElement('div');
    wait.className = 'chat-msg wait'; wait.textContent = 'Reading the code';
    log.appendChild(wait); log.scrollTop = log.scrollHeight;
    box.value = ''; CHAT.busy = true;
    var said = text + (pic ? (text ? '\n\n' : '') + pic.text : '');
    /* the gate looks at what they typed. A screenshot of an error is full of the
       word error, and treating that as a request to fix would throw the picture
       away. The model still never writes code, and any code it writes is cut. */
    var change = CHANGE.test(text);
    var asked = change ? 'Explain in plain words what this code does now. Do not suggest, write or describe any change or fix.' : text;
    /* with nothing typed, the small models only answered the picture when told
       plainly what to do with it: answer what it asks, explain what went wrong */
    if(pic){
      var ask = change ? asked : (text || 'If it asks a question, reply with the answer itself first, not the question. Then explain anything in it that went wrong, in plain words.');
      asked = 'Here is text from a picture they added:\n' + pic.text + '\n\n' + ask;
    }
    clearPic();
    OPEBridge.call('chat', Object.assign({question: asked}, ctx)).then(function(r){
      var answer = noCode(r.answer);
      /* Apple's model opens every answer with Hi, because every question is a
         fresh conversation to it. Only a greeting gets one back. */
      if(!/^\s*(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/i.test(said))
        answer = answer.replace(/^\s*(hi|hey|hello)( there)?[!.,]?\s*/i, '');
      wait.className = 'chat-msg ai';
      wait.innerHTML = (change ? '<p>' + esc(SAYS_NO) + '</p>' : '') + (chatText(answer) || '<p>No answer came back. Try asking again.</p>');
    }).catch(function(err){
      wait.className = 'chat-msg bad'; wait.textContent = err.message;
    }).then(function(){ CHAT.busy = false; log.scrollTop = log.scrollHeight; });
  };
  $('askIn').onkeydown = function(e){ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); $('askForm').requestSubmit(); } };
  checkEngine();

  /* ------------------------------------------------------------ start */
  $('where').onclick = pickProject;
  $('saveBtn').onclick = save;
  $('checkBtn').onclick = checkpointFile;
  Array.prototype.forEach.call(document.querySelectorAll('.rail .ico'), function(b){
    b.onclick = function(){
      var v = b.getAttribute('data-view');
      if(v === 'open') return pickProject();
      document.querySelectorAll('.rail .ico').forEach(function(x){ x.classList.toggle('on', x === b); });
      if(v === 'prompt') welcome();
      if(v === 'learn'){ S.path = ''; setDirty(false); $('tabName').textContent = 'Learn'; show('learn'); OPELearn.show(); }
      if(v === 'projects'){ if(S.path) show('code'); else if(S.root) blank('Pick a project on the left, then a version.<br>Folders it touched get a green box.'); else welcome(); }
    };
  });
  window.addEventListener('beforeunload', function(e){ if(S.dirty){ e.preventDefault(); e.returnValue = ''; } });

  renderProjects(); renderTree();
  Promise.all([
    OPEBridge.call('hello').catch(function(){ return {}; }),
    OPEBridge.call('prompt').catch(function(){ return {text:''}; }),
    /* the code view must never stop the app from opening */
    Promise.race([loadMonaco(), new Promise(function(done){ setTimeout(done, 8000); })])
  ]).then(function(res){
    S.recent = res[0].recent || [];
    S.library = res[0].library || [];
    renderProjects();
    S.promptText = res[1].text || '';
    if(res[0].root) openRoot(res[0].root, true);
    else welcome();
  });
  /* Learn opens a file at the line its piece starts on, and goes back to the code view */
  function openAt(path, line){
    document.querySelectorAll('.rail .ico').forEach(function(x){ x.classList.toggle('on', x.getAttribute('data-view') === 'projects'); });
    S.follow = false;
    return Promise.resolve(openFile(path)).then(function(){
      if(line && S.editor){ S.editor.revealLineInCenter(line); S.editor.setPosition({lineNumber: line, column: 1}); S.editor.focus(); }
    });
  }
  /* Learn only opens the course folder as the project; opening a folder swaps the
     view, so Learn asks for its own view back afterwards */
  function showLearn(){
    document.querySelectorAll('.rail .ico').forEach(function(x){ x.classList.toggle('on', x.getAttribute('data-view') === 'learn'); });
    S.path = ''; setDirty(false);
    $('tabName').textContent = 'Learn';
    show('learn');
  }
  window.OPE = {state: S, openRoot: openRoot, openFile: openAt, showLearn: showLearn};
})();
