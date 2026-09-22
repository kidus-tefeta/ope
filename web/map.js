/* THE MAP. Every numbered project, drawn instead of listed.

   No new data. app.js already reads PROJECTS.md and the git tags for the flat
   Projects list (OPEGit.projectsFile + OPEGit.numbersFromLog, merged into
   S.numbers). This just draws that same list as a live, pan and zoom map:
   each major number a phase, each minor number a part under it, colored,
   status straight from Planning, Building, Done. Same curved glowing line
   style as the BookHere and KTeC road maps.

   window.OPEMap.render(numbers, rootName) is the only thing app.js calls. */
(function(){
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#FBBF24','#4ADE80','#22D3EE','#FB923C','#818CF8','#F472B6','#38BDF8','#A78BFA'];

  var PHASE_W = 168, PHASE_H = 64, PHASE_GAP = 46;
  var PART_W = 168, PART_H = 46, PART_GAP = 14;
  var ROW_Y_PHASE = 96, ROW_Y_PART = 210;
  var TRUNK_W = 150, TRUNK_H = 52, TRUNK_Y = 10;

  var vp = null, world = null, svg = null;
  var scale = 1, tx = 0, ty = 0, worldW = 800, worldH = 600;

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function el(cls, parent){ var d = document.createElement('div'); d.className = cls; (parent || world).appendChild(d); return d; }

  function colorOf(major){ return COLORS[(major - 1) % COLORS.length]; }

  function statusOf(n){
    if(n.planning) return 'plan';
    if(n.building) return 'build';
    return 'done';
  }
  function statusWord(s){ return s === 'plan' ? 'planning' : s === 'build' ? 'building' : 'done'; }

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
      return {major: m, color: colorOf(m), title: (head.named || head.summary || ('Project ' + m + '.0')), parts: parts};
    });
  }

  function render(numbers, rootName){
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

    var totalW = Math.max(phases.length * (PHASE_W + PHASE_GAP) - PHASE_GAP, TRUNK_W);
    var startX = (totalW - (phases.length * (PHASE_W + PHASE_GAP) - PHASE_GAP)) / 2;
    var trunkCx = totalW / 2;

    var trunk = el('mnode trunk');
    trunk.style.cssText = 'left:' + (trunkCx - TRUNK_W / 2) + 'px;top:' + TRUNK_Y + 'px;width:' + TRUNK_W + 'px;height:' + TRUNK_H + 'px';
    trunk.innerHTML = '<b>' + esc(rootName || 'Your project') + '</b><span>' + phases.length + ' project' + (phases.length === 1 ? '' : 's') + '</span>';

    var maxBottom = ROW_Y_PART;
    phases.forEach(function(p, i){
      var cx = startX + i * (PHASE_W + PHASE_GAP) + PHASE_W / 2;
      p.cx = cx;
      link(trunkCx, TRUNK_Y + TRUNK_H, cx, ROW_Y_PHASE, p.color);

      var st = allDone(p) ? 'done' : (p.parts.some(function(x){ return x.building; }) ? 'build' : (p.parts.every(function(x){ return x.planning; }) ? 'plan' : 'build'));
      var node = el('mnode phase s-' + st);
      node.style.cssText = 'left:' + (cx - PHASE_W / 2) + 'px;top:' + ROW_Y_PHASE + 'px;width:' + PHASE_W + 'px;height:' + PHASE_H + 'px;border-color:' + p.color;
      node.innerHTML = '<b style="color:' + p.color + '">' + esc(p.major + '.0') + '</b><span>' + esc(p.title) + '</span>';
      node.onclick = function(e){ e.stopPropagation(); openDetail(p, null); };
      world.appendChild(node);

      var y = ROW_Y_PART;
      p.parts.forEach(function(part){
        var s = statusOf(part);
        link(cx, ROW_Y_PHASE + PHASE_H, cx, y + PART_H / 2, p.color);
        var pn = el('mnode part s-' + s);
        pn.style.cssText = 'left:' + (cx - PART_W / 2) + 'px;top:' + y + 'px;width:' + PART_W + 'px;height:' + PART_H + 'px;border-color:' + p.color;
        pn.innerHTML = '<b>' + esc(part.name) + '</b><span>' + esc(part.named || part.summary || '') + '</span><i class="mtag">' + statusWord(s) + '</i>';
        pn.onclick = function(e){ e.stopPropagation(); openDetail(p, part); };
        world.appendChild(pn);
        y += PART_H + PART_GAP;
      });
      if(y > maxBottom) maxBottom = y;
    });

    world.appendChild(trunk);
    worldW = totalW; worldH = maxBottom + 40;
    world.style.width = worldW + 'px'; world.style.height = worldH + 'px';
    svg.setAttribute('width', worldW); svg.setAttribute('height', worldH);
    home();
  }

  function allDone(p){ return p.parts.every(function(x){ return !x.building && !x.planning; }); }

  function openDetail(p, part){
    var detail = $('mapDetail');
    var color = p.color;
    var tasks = part ? (part.tasks || []) : [];
    detail.innerHTML =
      '<div class="mdcard" style="border-color:' + color + '">'+
        '<button class="mdx" id="mapDetailX" type="button" aria-label="Close">&times;</button>'+
        '<b style="color:' + color + '">' + esc(part ? part.name : p.major + '.0') + '</b>'+
        '<h3>' + esc(part ? (part.named || part.summary || '') : p.title) + '</h3>'+
        (part ? '<p class="mdst">' + statusWord(statusOf(part)) + '</p>' : '<p class="mdst">' + p.parts.length + ' part' + (p.parts.length === 1 ? '' : 's') + '</p>')+
        (tasks.length ? '<ol class="mdtasks">' + tasks.map(function(t){ return '<li><b>' + esc(t.id) + '</b> ' + esc(t.text) + '</li>'; }).join('') + '</ol>' : '')+
        (!part ? '<div class="mdparts">' + p.parts.map(function(x){ return '<span class="s-' + statusOf(x) + '">' + esc(x.name) + '</span>'; }).join('') + '</div>' : '')+
      '</div>';
    detail.classList.remove('hidden');
    $('mapDetailX').onclick = function(){ detail.classList.add('hidden'); };
  }

  function apply(){ world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
  function clampScale(s){ return Math.max(0.3, Math.min(2, s)); }

  function home(){
    var box = vp.getBoundingClientRect();
    var fitS = Math.min((box.width - 40) / worldW, (box.height - 40) / worldH, 1.1);
    scale = clampScale(fitS);
    tx = (box.width - worldW * scale) / 2;
    ty = 16;
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
       onto vp itself, which would swallow every click on a phase or part.
       Tracking on window instead, the same way the BookHere map does it. */
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
