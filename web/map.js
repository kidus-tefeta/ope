/* THE MAP. One page, for every project.

   BookHere's road map is the shape all of them take: a project at the top,
   phases branching off it, a system card under each with its own icon and
   status, that card's parts drawn under it, a milestone rail, a phase bar,
   drag to pan, zoom in for the detail. That whole engine lives in
   roadmap.html now, and every project's map is that page.

   Where the data comes from is the only thing that differs:

   1. THE PROJECT'S OWN PAGE. If a project already keeps a road map page of
      its own (BookHere does, hand written, with its own wordmark and its own
      copy) OPE runs that exact file instead, so it stays itself to the pixel.
      Its door and its server are undone on the way in, since neither exists
      in here, and every script it names is read off disk and put inline.

   2. DRAWN FROM PROJECTS.md. Everything else gets the same page, filled from
      what the project already writes: a major number is a phase and a
      milestone, a minor number is a system card, its tasks are that card's
      parts, and Planning / Building / Done is its status. Nothing new to
      keep, no setup, it draws the moment PROJECTS.md exists.

   window.OPEMap.render(numbers, rootName, files) is all app.js calls. */
(function(){
  'use strict';
  var COLORS = ['#FBBF24','#4ADE80','#22D3EE','#FB923C','#818CF8','#F472B6','#38BDF8','#A78BFA'];

  var ICON_WORDS = [
    [/pay|stripe|money|price|bill|charge|subscription|deposit|refund|invoice/i, 'money'],
    [/log ?in|sign ?in|sign ?up|auth|password|account|claim/i, 'auth'],
    [/calendar|schedul|appointment|book(ing)?|event|date/i, 'calendar'],
    [/database|\bsql\b|\bdata\b|\bstore\b|backend|table/i, 'data'],
    [/secur|lock|block|protect|guard|privacy|private|shield|legal|terms/i, 'shield'],
    [/\bchat\b|message|email|mail|\bai\b|assistant|support|review/i, 'chat'],
    [/phone|\bapp\b|ios|android|mobile|wallet|card/i, 'phone'],
    [/door|gate|access|invite|onboard|sign up/i, 'door'],
    [/\bmap\b|seo|marketing|reach|outreach|share|social|film/i, 'reach'],
    [/design|brush|style|look|theme|\bui\b|visual|page/i, 'brush'],
    [/setting|control|admin|dashboard|panel|office|studio/i, 'control']
  ];
  function pickIcon(text){
    var s = String(text || '');
    for(var i = 0; i < ICON_WORDS.length; i++) if(ICON_WORDS[i][0].test(s)) return ICON_WORDS[i][1];
    return 'graph';
  }

  function $(id){ return document.getElementById(id); }

  /* the first real sentence, for the one line a card has room for */
  function kickOf(text, fallback){
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if(!s) return fallback || '';
    var m = /^(.{1,150}?[.!?])(\s|$)/.exec(s);
    return m ? m[1] : s.slice(0, 150);
  }

  /* ------------------------------------------------- from PROJECTS.md

     A task list reads "1 none / 1a what gets built / 2 what he does / 2a ...".
     Each number becomes one part of the card: what gets built is its name,
     and anything the person has to do themselves is a bullet under it. */
  function partsOf(p){
    var by = {}, order = [];
    (p.tasks || []).forEach(function(t){
      var num = (String(t.id).match(/^\d+/) || [''])[0];
      if(!num) return;
      var kind = String(t.id).slice(num.length).toLowerCase() || 'n';
      if(!by[num]){ by[num] = {}; order.push(num); }
      by[num][kind] = t;
    });
    return order.map(function(num){
      var g = by[num];
      var built = g.a || {};
      var yours = g.n && g.n.text && !/^none\b/i.test(g.n.text.trim()) ? g.n : null;
      var waits = g.b || null;
      var atoms = [], steps = [], tags = [];
      /* the indented detail written under the task, when there is any */
      (built.atoms || []).forEach(function(a){ atoms.push(a); });
      (built.steps || []).forEach(function(s){ steps.push(s); });
      if(yours){ atoms.push('Yours: ' + yours.text); tags.push('todo'); (yours.atoms || []).forEach(function(a){ atoms.push(a); }); }
      if(waits){ atoms.push('Waiting on you: ' + waits.text); tags.push('risk'); }
      return {t: built.text || ('Task ' + num), tags: tags, atoms: atoms, steps: steps};
    });
  }

  function fromProjects(numbers, rootName){
    var by = {};
    (numbers || []).forEach(function(n){ (by[n.major] = by[n.major] || []).push(n); });
    var majors = Object.keys(by).map(Number).sort(function(a, b){ return a - b; });
    var PH = [], MS = [], SYS = [], META = {};

    majors.forEach(function(m, i){
      var parts = by[m].slice().sort(function(a, b){ return a.minor - b.minor; });
      /* a heading for the whole number, "## 6.0 The OPE app", names its own
         phase and says what it is. Most projects never write one, so the
         number itself is the fallback. */
      var zero = parts[0] && parts[0].minor === 0 ? parts.shift() : null;
      if(!parts.length){ parts = zero ? [zero] : []; zero = null; }
      var head = zero || parts[0];
      var phase = zero ? (zero.named || zero.summary || ('Project ' + m)) : ('Project ' + m);
      var mid = 'M' + (i + 1);
      var building = parts.filter(function(p){ return p.building; });

      PH.push({name: phase, color: COLORS[i % COLORS.length],
               blurb: kickOf(head.blurb, head.named || head.summary || '')});
      MS.push({id: mid, name: phase, sess: 0,
               done: parts.every(function(p){ return !p.building && !p.planning; }),
               note: parts.length + ' in all' + (building.length ? ', ' + building.map(function(p){ return p.name; }).join(' and ') + ' being built now' : '') + '.'});

      parts.forEach(function(p){
        var title = (p.name + ' ' + (p.named || p.summary || '')).trim();
        if(META[title]) title = title + ' ';
        SYS.push({title: title, accent: PH[i].color,
                  kick: kickOf(p.blurb, p.named || p.summary || ''),
                  subs: partsOf(p)});
        META[title] = {phase: phase, m: mid, illus: pickIcon(title + ' ' + (p.blurb || '')),
                       status: p.planning ? 'plan' : (p.building ? 'build' : 'live')};
      });
    });

    return {PROJECT: {name: rootName || 'your project', tagline: ''},
            PHASES: PH, MILESTONES: MS, SYS: SYS, META: META};
  }

  /* ------------------------------------------------- a project's own page */
  /* OPE's own shell says so in its first comment. A project that happens to
     carry a copy of it is not a project with a road map of its own, it is
     the same empty page, so it is passed over and filled from PROJECTS.md
     like everybody else. */
  var SHELL_MARK = /OPE'S ROAD MAP PAGE/;
  function findOwnMaps(files){
    return (files || []).filter(function(f){
      if(/node_modules|\/vendor\//.test(f)) return false;
      return /(^|\/)[^\/]*map[^\/]*\.html$/i.test(f);
    });
  }
  function dirOf(path){ var i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i + 1); }

  /* every .js the page names, read off disk by its own name, wherever it
     actually sits, so the page runs with no server under it */
  function inlineScripts(src, htmlPath, files){
    var want = {}, m, re = /['"\/]([\w.-]+\.js)(\?[^'"]*)?['"]/g;
    while((m = re.exec(src))) want[m[1]] = true;
    var names = Object.keys(want);
    if(!names.length) return Promise.resolve(src);
    var here = dirOf(htmlPath);
    return Promise.all(names.map(function(name){
      var path = (files || []).filter(function(f){ return f === here + name || f.slice(-(name.length + 1)) === '/' + name; })[0];
      if(!path) return Promise.resolve(null);
      return OPEBridge.call('read', {path: path}).then(function(r){
        return r && r.text ? {name: name, text: r.text} : null;
      }).catch(function(){ return null; });
    })).then(function(got){
      var add = '';
      got.filter(Boolean).forEach(function(g){
        src = src.replace(new RegExp('<script[^>]*src=["\'][^"\']*' + g.name.replace(/\./g, '\\.') + '[^"\']*["\'][^>]*>\\s*<\\/script>', 'gi'), '');
        add += '<script>\n' + g.text + '\n</script>\n';
      });
      return add ? src.replace(/<body([^>]*)>/i, '<body$1>\n' + add) : src;
    });
  }

  function unlock(src){
    /* the door: a locked body, a panel over everything, and the block that
       asks a Worker for a pass. None of it can be answered from in here. */
    src = src.replace(/<body([^>]*)class=["']([^"']*)locked([^"']*)["']([^>]*)>/i, '<body$1class="$2$3"$4>');
    src = src.replace(/<div id=["']door["'][\s\S]*?\n<\/div>\n/i, '');
    src = src.replace(/\(function\(\)\s*\{[\s\S]*?tryStored\(\);\s*\}\)\(\);/, '');
    if(/function\s+boot\s*\(/.test(src)) src += '\n<script>if(typeof boot==="function")boot();</script>\n';
    return src;
  }

  var ownCache = {};
  function loadOwnMap(files){
    if(!window.OPEBridge) return Promise.resolve(null);
    var paths = findOwnMaps(files);
    return paths.reduce(function(chain, path){
      return chain.then(function(found){
        if(found) return found;
        return OPEBridge.call('read', {path: path}).then(function(r){
          var src = r && r.text;
          if(!src || !/<html|<body/i.test(src) || SHELL_MARK.test(src)) return null;
          if(ownCache.src === src) return ownCache.out;
          return inlineScripts(src, path, files).then(function(full){
            var out = unlock(full);
            ownCache = {src: src, out: out};
            return out;
          });
        }).catch(function(){ return null; });
      });
    }, Promise.resolve(null));
  }

  /* ------------------------------------------------- OPE's own page */
  var shell = null;
  function loadShell(){
    if(shell) return Promise.resolve(shell);
    return fetch('roadmap.html').then(function(r){ return r.text(); }).then(function(t){
      shell = t; return t;
    }).catch(function(){ return null; });
  }

  function fill(page, data){
    var js = 'window.BH_PROJECT=' + JSON.stringify(data.PROJECT) + ';\n'+
             'window.BH_PHASES=' + JSON.stringify(data.PHASES) + ';\n'+
             'window.BH_MILESTONES=' + JSON.stringify(data.MILESTONES) + ';\n'+
             'window.BH_SYS=' + JSON.stringify(data.SYS) + ';\n'+
             'window.BH_META=' + JSON.stringify(data.META) + ';\n';
    return page.replace(/<body([^>]*)>/i, '<body$1>\n<script>\n' + js + '</script>\n');
  }

  /* ------------------------------------------------- what app.js calls */
  function showFrame(html, key){
    var frame = $('mapFrame');
    $('mapEmpty').classList.add('hidden');
    frame.classList.remove('hidden');
    if(frame.getAttribute('data-key') === key) return;
    frame.setAttribute('data-key', key);
    frame.srcdoc = html;
  }

  function showEmpty(msg){
    var frame = $('mapFrame');
    frame.classList.add('hidden');
    frame.removeAttribute('data-key');
    frame.srcdoc = '';
    var empty = $('mapEmpty');
    empty.classList.remove('hidden');
    empty.innerHTML = msg;
  }

  function render(numbers, rootName, files){
    loadOwnMap(files).then(function(own){
      if(own) return showFrame(own, 'own:' + (ownCache.src || '').length);

      if(!(numbers || []).length){
        return showEmpty('<div><h3>No numbered projects yet</h3>'+
          '<p>Ask your AI coder to start one: "project 1.0, build me &hellip;"<br>'+
          'The map draws itself the moment PROJECTS.md exists.</p></div>');
      }
      return loadShell().then(function(page){
        if(!page) return showEmpty('<div><h3>The map could not load</h3><p>roadmap.html is missing from OPE.</p></div>');
        var data = fromProjects(numbers, rootName);
        showFrame(fill(page, data), 'gen:' + rootName + ':' + JSON.stringify(data.SYS).length + ':' + JSON.stringify(data.META).length);
      });
    });
  }

  window.OPEMap = {render: render};
})();
