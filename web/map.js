/* THE MAP. Every numbered project, drawn instead of listed, in the same card
   style as the BookHere and KTeC road maps: an icon, a status pill, a title,
   a kicker line, a footer count. Click a card and its own tasks read as a
   plain bulleted list, the same shape as those maps' "in plain words".

   No new data. app.js already reads PROJECTS.md and the git tags for the
   flat Projects list (OPEGit.projectsFile + OPEGit.numbersFromLog, merged
   into S.numbers: name, major, minor, named, building, planning, blurb,
   tasks). This just draws that same list as a live, pan and zoom map.

   Two tiers deep, not BookHere's four: a major number is a phase, a minor
   number is a card. PROJECTS.md has no third tier of its own, so a card's
   tasks show as the bulleted detail directly, not another row of cards.

   window.OPEMap.render(numbers, rootName) is the only thing app.js calls. */
(function(){
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#FBBF24','#4ADE80','#22D3EE','#FB923C','#818CF8','#F472B6','#38BDF8','#A78BFA'];

  var TRUNK_W = 220, TRUNK_H = 110, TRUNK_Y = 40;
  var PHASE_Y = 220, PHASE_W = 260, PHASE_H = 118;
  var CARD_Y = 420, CARD_W = 220, FRAME_H = 64, CARD_GAP = 26, CARD_VGAP = 22;

  var ILLUS = {
    calendar:'<path d="M18 24h64v58H18z"/><path d="M18 40h64M34 16v14M66 16v14"/><circle cx="40" cy="56" r="3.5" fill="currentColor" stroke="none"/><circle cx="56" cy="56" r="3.5" fill="currentColor" stroke="none"/>',
    auth:'<circle cx="38" cy="42" r="16"/><path d="M50 52l24 24M62 64l8 8M70 56l8 8"/>',
    money:'<rect x="16" y="30" width="68" height="44" rx="8"/><circle cx="50" cy="52" r="11"/><path d="M28 30v-6M72 74v6"/>',
    data:'<ellipse cx="50" cy="26" rx="28" ry="11"/><path d="M22 26v22c0 6 12 11 28 11s28-5 28-11V26M22 48v22c0 6 12 11 28 11s28-5 28-11V48"/>',
    control:'<rect x="16" y="20" width="68" height="60" rx="8"/><path d="M30 38h14M56 38h14M30 54h30M30 66h20"/><circle cx="66" cy="60" r="6"/>',
    graph:'<circle cx="26" cy="30" r="9"/><circle cx="74" cy="26" r="9"/><circle cx="60" cy="70" r="9"/><circle cx="30" cy="66" r="9"/><path d="M34 34l20 30M35 32l30-2M52 66l-14-2"/>',
    shield:'<path d="M50 16l28 10v22c0 20-14 30-28 36-14-6-28-16-28-36V26z"/><path d="M38 50l9 9 17-19"/>',
    chat:'<path d="M20 30h44a8 8 0 018 8v18a8 8 0 01-8 8H40l-14 12V64h-6a8 8 0 01-8-8V38a8 8 0 018-8z"/><path d="M32 44h24M32 54h16"/>',
    reach:'<path d="M22 44l44-18v40L22 56z"/><path d="M22 44H16v12h6M30 60v14h10V62"/><path d="M74 38c6 3 6 15 0 18"/>',
    brush:'<path d="M64 20l16 16-30 30-16-16z"/><path d="M34 50l-8 20 20-8"/><path d="M26 70c-4 6-6 8-10 10 6 2 10 0 14-4"/>',
    door:'<path d="M26 84V22a6 6 0 016-6h36a6 6 0 016 6v62"/><path d="M18 84h64"/><circle cx="62" cy="52" r="3.5" fill="currentColor" stroke="none"/>',
    phone:'<rect x="30" y="14" width="40" height="72" rx="9"/><path d="M44 22h12"/><circle cx="50" cy="74" r="3.5" fill="currentColor" stroke="none"/>'
  };
  var ICON_WORDS = [
    [/pay|stripe|money|price|bill|charge|subscription|deposit|refund|invoice/i, 'money'],
    [/log ?in|sign ?in|sign ?up|auth|password|account/i, 'auth'],
    [/calendar|schedul|appointment|book(ing)?|event|date/i, 'calendar'],
    [/database|\bsql\b|\bdata\b|\bstore\b|backend/i, 'data'],
    [/secur|lock|block|protect|guard|privacy|private|shield/i, 'shield'],
    [/\bchat\b|message|\bai\b|assistant|support/i, 'chat'],
    [/phone|\bapp\b|ios|android|mobile/i, 'phone'],
    [/door|gate|access|invite|onboard/i, 'door'],
    [/\bmap\b|seo|marketing|reach|outreach|share|social/i, 'reach'],
    [/design|brush|style|look|theme|\bui\b|visual/i, 'brush'],
    [/setting|control|admin|dashboard|panel/i, 'control']
  ];
  function pickIcon(text){
    var s = String(text || '');
    for(var i = 0; i < ICON_WORDS.length; i++) if(ICON_WORDS[i][0].test(s)) return ICON_WORDS[i][1];
    return 'graph';
  }

  var STATUS = {plan: ['s-plan', 'planned'], build: ['s-build', 'building'], done: ['s-done', 'done']};

  var vp = null, world = null, svg = null;
  var scale = 1, tx = 0, ty = 0, worldW = 800, worldH = 600;

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function el(cls, parent){ var d = document.createElement('div'); d.className = cls; (parent || world).appendChild(d); return d; }
  function colorOf(major){ return COLORS[(major - 1) % COLORS.length]; }
  function statusOf(n){ return n.planning ? 'plan' : (n.building ? 'build' : 'done'); }
  /* the first real sentence of a blurb, for a card too small for the whole
     paragraph; the full text still shows once a card is opened */
  function kickOf(text){
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    var m = /^(.{1,140}?[.!?])(\s|$)/.exec(s);
    return m ? m[1] : s.slice(0, 140);
  }

  function link(x1, y1, x2, y2, color){
    var midY = (y1 + y2) / 2;
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ' ' + x2 + ' ' + midY + ' ' + x2 + ' ' + y2);
    p.setAttribute('class', 'maplink');
    p.style.stroke = color;
    p.style.filter = 'drop-shadow(0 0 4px ' + color + ') drop-shadow(0 0 1.5px ' + color + ')';
    svg.appendChild(p);
    return p;
  }

  function groupByMajor(numbers){
    var by = {};
    (numbers || []).forEach(function(n){ (by[n.major] = by[n.major] || []).push(n); });
    return Object.keys(by).map(Number).sort(function(a, b){ return a - b; }).map(function(m){
      var parts = by[m].slice().sort(function(a, b){ return a.minor - b.minor; });
      var head = parts[0];
      return {major: m, color: colorOf(m), title: (head.named || head.summary || ('Project ' + m + '.0')), blurb: head.blurb || '', parts: parts};
    });
  }

  function statusPill(s){
    var v = STATUS[s] || STATUS.plan;
    return '<span class="stag ' + v[0] + '"><i></i>' + v[1] + '</span>';
  }

  /* BOOKHERE'S OWN MAP, whatever is really in it. Its numbers never lined up
     with PROJECTS.md's, and Kidus said not to bother making them: when this
     project has its own public/bookhere-data.js, that real file is the map,
     not a redraw of PROJECTS.md. Same card engine, real content. */
  var richCache = {};
  function loadRich(){
    if(!window.OPEBridge) return Promise.resolve(null);
    return OPEBridge.call('read', {path: 'public/bookhere-data.js'}).then(function(r){
      var src = r && r.text;
      if(!src) return null;
      if(richCache.src === src) return richCache.data;
      var sandbox = {};
      try {
        (new Function('window', src))(sandbox);
        if(!sandbox.BH_PHASES || !sandbox.BH_SYS || !sandbox.BH_META) return null;
        richCache = {src: src, data: sandbox};
        return sandbox;
      } catch(e){ return null; }
    }).catch(function(){ return null; });
  }

  function render(numbers, rootName){
    loadRich().then(function(bh){
      if(bh) renderRich(bh, rootName); else renderGeneric(numbers, rootName);
    });
  }

  function renderGeneric(numbers, rootName){
    vp = $('mapVp'); world = $('mapWorld');
    var empty = $('mapEmpty'), detail = $('mapDetail');
    detail.classList.add('hidden'); detail.innerHTML = '';
    world.innerHTML = '';
    var phases = groupByMajor(numbers);

    if(!phases.length){
      empty.classList.remove('hidden');
      empty.innerHTML = '<div><h3>No numbered projects yet</h3>'+
        '<p>Ask your AI coder to start one: "project 1.0, build me &hellip;"<br>'+
        'The map draws itself the moment PROJECTS.md exists.</p></div>';
      return;
    }
    empty.classList.add('hidden');

    svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'maplinks'); world.appendChild(svg);

    var totalW = Math.max(phases.length * (PHASE_W + CARD_GAP) - CARD_GAP, TRUNK_W);
    var startX = (totalW - (phases.length * (PHASE_W + CARD_GAP) - CARD_GAP)) / 2;
    var trunkCx = totalW / 2;

    var trunk = el('mproj');
    trunk.style.cssText = 'left:' + (trunkCx - TRUNK_W / 2) + 'px;top:' + TRUNK_Y + 'px;width:' + TRUNK_W + 'px;height:' + TRUNK_H + 'px';
    trunk.innerHTML = '<h1>' + esc(rootName || 'your project') + '</h1>'+
      '<div class="num"><span>' + phases.length + ' project' + (phases.length === 1 ? '' : 's') + '</span></div>';
    world.appendChild(trunk);

    var maxBottom = CARD_Y;
    phases.forEach(function(p, i){
      var cx = startX + i * (PHASE_W + CARD_GAP) + PHASE_W / 2;
      p.cx = cx;
      link(trunkCx, TRUNK_Y + TRUNK_H, cx, PHASE_Y, p.color);

      var st = allDone(p) ? 'done' : (p.parts.some(function(x){ return x.building; }) ? 'build' : (p.parts.every(function(x){ return x.planning; }) ? 'plan' : 'build'));
      var node = el('mphase s-' + st);
      node.style.cssText = 'left:' + (cx - PHASE_W / 2) + 'px;top:' + PHASE_Y + 'px;width:' + PHASE_W + 'px;height:' + PHASE_H + 'px;border-color:' + p.color;
      node.innerHTML = '<h2 style="color:' + p.color + '">' + esc(p.major + '.0') + '</h2><p>' + esc(p.title) + '</p>';
      node.onclick = function(e){ e.stopPropagation(); openPhase(p); };
      world.appendChild(node);

      var y = CARD_Y;
      p.parts.forEach(function(part){
        var s = statusOf(part);
        var h = cardHeight(part);
        link(cx, PHASE_Y + PHASE_H, cx, y + FRAME_H / 2, p.color);
        var card = el('mpkg s-' + s);
        card.style.cssText = 'left:' + (cx - CARD_W / 2) + 'px;top:' + y + 'px;width:' + CARD_W + 'px;height:' + h + 'px';
        card.innerHTML =
          '<div class="mtag">' + esc(part.name) + '</div>'+
          statusPill(s)+
          '<div class="frame" style="color:' + p.color + '"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+
            (ILLUS[pickIcon((part.named || part.summary || '') + ' ' + (part.blurb || ''))] || ILLUS.graph)+
          '</svg></div>'+
          '<div class="body"><h3>' + esc(part.named || part.summary || part.name) + '</h3>'+
          (part.blurb ? '<p class="kick">' + esc(kickOf(part.blurb)) + '</p>' : '')+
          '<div class="cnt">' + (part.tasks || []).length + ' task' + ((part.tasks || []).length === 1 ? '' : 's') + '</div></div>';
        card.onclick = function(e){ e.stopPropagation(); openCard(p, part); };
        world.appendChild(card);
        y += h + CARD_VGAP;
      });
      if(y > maxBottom) maxBottom = y;
    });

    worldW = totalW; worldH = maxBottom + 60;
    world.style.width = worldW + 'px'; world.style.height = worldH + 'px';
    svg.setAttribute('width', worldW); svg.setAttribute('height', worldH);
    home();
  }

  /* a card grows a line for its kicker, so the frame never clips it */
  function cardHeight(part){
    var h = FRAME_H + 54;
    if(part.blurb) h += 34;
    return h;
  }

  function allDone(p){ return p.parts.every(function(x){ return !x.building && !x.planning; }); }

  function openPhase(p){
    var detail = $('mapDetail');
    detail.innerHTML =
      '<div class="mdcard" style="border-color:' + p.color + '">'+
        '<button class="mdx" id="mapDetailX" type="button" aria-label="Close">&times;</button>'+
        '<div class="mdpath">' + esc(p.major + '.0') + '</div>'+
        '<h3>' + esc(p.title) + '</h3>'+
        (p.blurb ? blurbHtml(p.blurb) : '')+
        '<div class="mdsec">' + p.parts.length + ' part' + (p.parts.length === 1 ? '' : 's') + '</div>'+
        '<div class="mdrows">' + p.parts.map(function(x){
          return '<div class="mdrow" data-n="' + esc(x.name) + '"><b>' + esc(x.name) + '</b> ' + esc(x.named || x.summary || '') + statusPill(statusOf(x)) + '</div>';
        }).join('') + '</div>'+
      '</div>';
    detail.classList.remove('hidden');
    $('mapDetailX').onclick = function(){ detail.classList.add('hidden'); };
    Array.prototype.forEach.call(detail.querySelectorAll('.mdrow'), function(row, i){
      row.onclick = function(){ openCard(p, p.parts[i]); };
    });
  }

  /* the paragraphs someone actually wrote in PROJECTS.md, between the status
     word and the task list: the real explanation, prose, not bullets. */
  function blurbHtml(text){
    var paras = String(text || '').split(/\n\s*\n/).map(function(s){ return s.trim(); }).filter(Boolean);
    return paras.map(function(s){ return '<p class="mdblurb">' + esc(s) + '</p>'; }).join('');
  }

  function openCard(p, part){
    var detail = $('mapDetail');
    var tasks = part.tasks || [];
    detail.innerHTML =
      '<div class="mdcard" style="border-color:' + p.color + '">'+
        '<button class="mdx" id="mapDetailX" type="button" aria-label="Close">&times;</button>'+
        '<div class="mdpath">' + esc(p.major + '.0 · ' + part.name) + '</div>'+
        '<h3>' + esc(part.named || part.summary || part.name) + '</h3>'+
        statusPill(statusOf(part))+
        (part.blurb ? blurbHtml(part.blurb) : '')+
        (tasks.length ? '<div class="mdsec">in plain words</div><ul class="mdatoms">' +
          tasks.map(function(t){ return '<li><b>' + esc(t.id) + '</b> ' + esc(t.text) + '</li>'; }).join('') + '</ul>' : '')+
      '</div>';
    detail.classList.remove('hidden');
    $('mapDetailX').onclick = function(){ detail.classList.add('hidden'); };
  }

  var RICH_STATUS = {plan: ['s-plan','planned'], build: ['s-build','building'], live: ['s-live','live'],
    done: ['s-done','decided'], later: ['s-later','parked'], built: ['s-built','built · not run']};
  function richPill(st){
    var v = RICH_STATUS[st] || RICH_STATUS.plan;
    return '<span class="stag ' + v[0] + '"><i></i>' + v[1] + '</span>';
  }
  var TAG_CLASS = {later: 't-later', risk: 't-risk', todo: 't-todo', locked: 't-locked'};
  function tagsHtml(tags){
    if(!tags || !tags.length) return '';
    return '<div class="mdtags">' + tags.map(function(t){
      var cls = /^m\d$/i.test(t) ? 't-m' : (TAG_CLASS[t] || 't-plan');
      var text = /^m\d$/i.test(t) ? t.toUpperCase() + ' build' : (t === 'later' ? 'parked' : t);
      return '<span class="tg ' + cls + '">' + esc(text) + '</span>';
    }).join('') + '</div>';
  }
  /* a <code> in the real text, kept as code, everything else escaped */
  function rich(s){
    return esc(s).replace(/&lt;code&gt;/g, '<code>').replace(/&lt;\/code&gt;/g, '</code>')
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
  }

  function renderRich(bh, rootName){
    vp = $('mapVp'); world = $('mapWorld');
    var empty = $('mapEmpty'), detail = $('mapDetail');
    detail.classList.add('hidden'); detail.innerHTML = '';
    world.innerHTML = '';
    empty.classList.add('hidden');

    var phases = bh.BH_PHASES.map(function(ph, i){ return {name: ph.name, color: ph.color, blurb: ph.blurb, major: i + 1, sys: []}; });
    var byName = {}; phases.forEach(function(p){ byName[p.name] = p; });
    bh.BH_SYS.forEach(function(s){
      var m = bh.BH_META[s.title];
      if(!m || !byName[m.phase]) return;
      byName[m.phase].sys.push({sys: s, meta: m});
    });
    phases = phases.filter(function(p){ return p.sys.length; });
    if(!phases.length){ renderGeneric([], rootName); return; }

    svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'maplinks'); world.appendChild(svg);

    var totalW = Math.max(phases.length * (PHASE_W + CARD_GAP) - CARD_GAP, TRUNK_W);
    var startX = (totalW - (phases.length * (PHASE_W + CARD_GAP) - CARD_GAP)) / 2;
    var trunkCx = totalW / 2;

    var trunk = el('mproj');
    trunk.style.cssText = 'left:' + (trunkCx - TRUNK_W / 2) + 'px;top:' + TRUNK_Y + 'px;width:' + TRUNK_W + 'px;height:' + TRUNK_H + 'px';
    trunk.innerHTML = '<h1>' + esc(rootName || 'bookhere') + '</h1><div class="num"><span>' + bh.BH_SYS.length + ' systems</span></div>';
    world.appendChild(trunk);

    var maxBottom = CARD_Y;
    phases.forEach(function(p, i){
      var cx = startX + i * (PHASE_W + CARD_GAP) + PHASE_W / 2;
      p.cx = cx;
      link(trunkCx, TRUNK_Y + TRUNK_H, cx, PHASE_Y, p.color);

      var statuses = p.sys.map(function(x){ return x.meta.status; });
      var st = statuses.every(function(s){ return s === 'live' || s === 'done'; }) ? 'done' :
        (statuses.some(function(s){ return s === 'build'; }) ? 'build' : 'plan');
      var node = el('mphase s-' + st);
      node.style.cssText = 'left:' + (cx - PHASE_W / 2) + 'px;top:' + PHASE_Y + 'px;width:' + PHASE_W + 'px;height:' + PHASE_H + 'px;border-color:' + p.color;
      node.innerHTML = '<h2 style="color:' + p.color + '">' + esc(p.name) + '</h2><p>' + esc(p.blurb || '') + '</p>';
      node.onclick = function(e){ e.stopPropagation(); openRichPhase(p); };
      world.appendChild(node);

      var y = CARD_Y;
      p.sys.forEach(function(row){
        var s = row.sys, m = row.meta;
        var h = FRAME_H + 54 + (s.kick ? 34 : 0);
        link(cx, PHASE_Y + PHASE_H, cx, y + FRAME_H / 2, p.color);
        var card = el('mpkg s-' + (m.status === 'live' ? 'done' : m.status));
        card.style.cssText = 'left:' + (cx - CARD_W / 2) + 'px;top:' + y + 'px;width:' + CARD_W + 'px;height:' + h + 'px';
        card.innerHTML =
          '<div class="mtag">' + esc(m.m) + '</div>'+
          richPill(m.status)+
          '<div class="frame" style="color:' + p.color + '"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+
            (ILLUS[m.illus] || ILLUS.graph)+
          '</svg></div>'+
          '<div class="body"><h3>' + esc(s.title) + '</h3>'+
          (s.kick ? '<p class="kick">' + esc(s.kick) + '</p>' : '')+
          '<div class="cnt">' + s.subs.length + ' part' + (s.subs.length === 1 ? '' : 's') + '</div></div>';
        card.onclick = function(e){ e.stopPropagation(); openRichSys(p, row); };
        world.appendChild(card);
        y += h + CARD_VGAP;
      });
      if(y > maxBottom) maxBottom = y;
    });

    worldW = totalW; worldH = maxBottom + 60;
    world.style.width = worldW + 'px'; world.style.height = worldH + 'px';
    svg.setAttribute('width', worldW); svg.setAttribute('height', worldH);
    home();
  }

  function openRichPhase(p){
    var detail = $('mapDetail');
    detail.innerHTML =
      '<div class="mdcard" style="border-color:' + p.color + '">'+
        '<button class="mdx" id="mapDetailX" type="button" aria-label="Close">&times;</button>'+
        '<div class="mdpath">' + esc(p.name) + '</div>'+
        '<h3>' + esc(p.name) + '</h3>'+
        (p.blurb ? '<p class="mdblurb">' + esc(p.blurb) + '</p>' : '')+
        '<div class="mdsec">' + p.sys.length + ' system' + (p.sys.length === 1 ? '' : 's') + '</div>'+
        '<div class="mdrows">' + p.sys.map(function(row){
          return '<div class="mdrow"><b>' + esc(row.meta.m) + '</b> ' + esc(row.sys.title) + richPill(row.meta.status) + '</div>';
        }).join('') + '</div>'+
      '</div>';
    detail.classList.remove('hidden');
    $('mapDetailX').onclick = function(){ detail.classList.add('hidden'); };
    Array.prototype.forEach.call(detail.querySelectorAll('.mdrow'), function(row, i){
      row.onclick = function(){ openRichSys(p, p.sys[i]); };
    });
  }

  function openRichSys(p, row){
    var detail = $('mapDetail');
    var s = row.sys, m = row.meta;
    detail.innerHTML =
      '<div class="mdcard" style="border-color:' + p.color + '">'+
        '<button class="mdx" id="mapDetailX" type="button" aria-label="Close">&times;</button>'+
        '<div class="mdpath">' + esc(p.name + ' · ' + m.m) + '</div>'+
        '<h3>' + esc(s.title) + '</h3>'+
        richPill(m.status)+
        (s.kick ? '<p class="mdblurb">' + esc(s.kick) + '</p>' : '')+
        '<div class="mdsec">' + s.subs.length + ' part' + (s.subs.length === 1 ? '' : 's') + '</div>'+
        '<div class="mdrows">' + s.subs.map(function(sub, i){
          return '<div class="mdrow" data-i="' + i + '"><b>' + esc(sub.t) + '</b> ' + rich(sub.atoms[0] || '') + '</div>';
        }).join('') + '</div>'+
      '</div>';
    detail.classList.remove('hidden');
    $('mapDetailX').onclick = function(){ detail.classList.add('hidden'); };
    Array.prototype.forEach.call(detail.querySelectorAll('.mdrow'), function(row2, i){
      row2.onclick = function(){ openRichSub(p, row, s.subs[i]); };
    });
  }

  function openRichSub(p, row, sub){
    var detail = $('mapDetail');
    detail.innerHTML =
      '<div class="mdcard" style="border-color:' + p.color + '">'+
        '<button class="mdx" id="mapDetailX" type="button" aria-label="Close">&times;</button>'+
        '<div class="mdpath">' + esc(p.name + ' · ' + row.sys.title) + '</div>'+
        '<h3>' + esc(sub.t) + '</h3>'+
        tagsHtml(sub.tags)+
        '<div class="mdsec">in plain words</div>'+
        '<ul class="mdatoms">' + (sub.atoms || []).map(function(a){ return '<li>' + rich(a) + '</li>'; }).join('') + '</ul>'+
        (sub.steps && sub.steps.length ? '<div class="mdsec">how it works</div><ol class="mdsteps">' +
          sub.steps.map(function(st){ return '<li>' + rich(st) + '</li>'; }).join('') + '</ol>' : '')+
      '</div>';
    detail.classList.remove('hidden');
    $('mapDetailX').onclick = function(){ detail.classList.add('hidden'); };
  }

  function apply(){
    world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    world.dataset.z = scale < 0.55 ? 'far' : (scale < 0.95 ? 'near' : 'deep');
  }
  function clampScale(s){ return Math.max(0.15, Math.min(2, s)); }

  /* a fixed, always-legible start, not a shrink-to-fit: BookHere's map does
     the same, a wide project pans instead of getting small enough to blur. */
  function home(){
    var box = vp.getBoundingClientRect();
    scale = clampScale(box.width < 700 ? 0.42 : 0.62);
    tx = box.width / 2 - (worldW / 2) * scale;
    ty = 20;
    apply();
  }

  function wire(){
    vp = $('mapVp');
    vp.addEventListener('wheel', function(e){
      e.preventDefault();
      var box = vp.getBoundingClientRect();
      var mx = e.clientX - box.left, my = e.clientY - box.top;
      var wx = (mx - tx) / scale, wy = (my - ty) / scale;
      scale = clampScale(scale * (e.deltaY < 0 ? 1.08 : 0.93));
      tx = mx - wx * scale; ty = my - wy * scale;
      apply();
    }, {passive: false});

    /* no setPointerCapture: capturing on vp retargets the click that follows
       onto vp itself, which would swallow every click on a card. Tracking
       on window instead, the same way the BookHere map does it. */
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    vp.addEventListener('pointerdown', function(e){
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY; ox = tx; oy = ty;
    });
    window.addEventListener('pointermove', function(e){
      if(!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if(Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      tx = ox + dx; ty = oy + dy; apply();
    });
    var up = function(){ dragging = false; };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    vp.addEventListener('click', function(e){ if(moved){ e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    window.addEventListener('resize', function(){ if(world && world.style.width) home(); });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  window.OPEMap = {render: render, home: home};
})();
