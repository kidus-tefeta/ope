/* A REAL TERMINAL INSIDE OPE.

   The `>_` in the rail opens it full screen, over everything, with the project
   path across the top. Escape or the close button leaves. Leaving does NOT
   close the shell: there is one shell for each project and it keeps running
   while you look at something else, so a 1.9 GB pull is never lost. A small
   green dot sits on the rail icon while something is still running.

   The screen owns none of the work. The engine does: a pty in Swift on the Mac,
   node-pty in the Node twin on Windows. They answer the same five commands:

     ptyOpen   {cols, rows} -> {ok, started, cwd, shell, buffer, degraded, why}
                              started:false means a shell was already alive and
                              buffer is the scrollback to replay before we attach
     ptyWrite  {data}       every keystroke
     ptyResize {cols, rows} the window changed size
     ptyClose               end the shell
     ptyState               -> {open, running, cwd}

   Output comes back through the bridge as ev.pty = {data:"<base64>"} or
   ev.pty = {exit:code}. It is base64 because a UTF-8 character can be split
   across two reads; the bytes are written into xterm whole, so it never breaks. */
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var MONO = 'ui-monospace,"SF Mono",SFMono-Regular,Menlo,Monaco,"Cascadia Mono",Consolas,monospace';

  var T = {
    term: null,      /* the xterm instance, made once and kept */
    fit: null,
    open: false,     /* the screen is showing */
    live: false,     /* a shell has been asked for at least once */
    running: false,  /* something is still running in it */
    attached: false, /* output is being written into the terminal */
    queue: [],       /* output that arrived while ptyOpen was still answering */
    poll: 0,
    size: null,
    root: '',        /* the project the screen is showing */
    shellRoot: ''    /* the project the live shell belongs to */
  };

  /* ---------------------------------------------------------------- bytes */
  function bytes(b64){
    var raw = atob(b64), out = new Uint8Array(raw.length);
    for(var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  /* the scrollback comes back base64 like everything else, but an engine that
     hands back plain text is written out as it is rather than thrown away */
  function decode(s){
    if(!s) return null;
    try{
      if(/^[A-Za-z0-9+/=\s]+$/.test(s)) return bytes(s.replace(/\s+/g, ''));
    }catch(e){}
    return s;
  }

  /* ----------------------------------------------------------- the screen */
  function build(){
    if($('termView')) return;
    var el = document.createElement('div');
    el.id = 'termView';
    el.className = 'termview hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Terminal');
    el.innerHTML =
      '<header class="termtop">' +
        '<span class="termwhere" id="termWhere">Terminal</span>' +
        '<span class="termhint">Escape to leave. The shell keeps running.</span>' +
        '<button class="termx" id="termX" type="button" title="Close (Escape)" aria-label="Close the terminal">×</button>' +
      '</header>' +
      '<div class="termsay hidden" id="termSay"></div>' +
      '<div class="termbody" id="termBody"></div>';
    document.body.appendChild(el);
    $('termX').onclick = hide;
  }

  function say(text){
    var el = $('termSay');
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
    if(T.fit) setTimeout(resize, 0);
  }

  function note(line){ if(T.term) T.term.write('\r\n\x1b[38;5;244m' + line + '\x1b[0m\r\n'); }

  /* ----------------------------------------------------------- the engine */
  function make(){
    if(T.term) return true;
    if(!window.Terminal || !window.FitAddon) return false;
    var t = new window.Terminal({
      fontFamily: MONO,
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 10000,
      theme: {
        background: '#000000', foreground: '#F2F2F2',
        cursor: '#22C55E', cursorAccent: '#000000',
        selectionBackground: 'rgba(34,197,94,.32)', selectionForeground: '#FFFFFF'
      }
    });
    T.fit = new window.FitAddon.FitAddon();
    t.loadAddon(T.fit);
    t.open($('termBody'));
    /* Escape is the way out of the screen, so it never reaches the shell */
    t.attachCustomKeyEventHandler(function(e){
      if(e.type === 'keydown' && e.key === 'Escape'){ hide(); return false; }
      return true;
    });
    t.onData(function(d){
      if(!T.live) return;
      OPEBridge.call('ptyWrite', {data: d}).catch(function(err){ engineGone(err); });
    });
    T.term = t;
    return true;
  }

  function engineGone(err){
    T.live = false; T.attached = false; setRunning(false);
    note('The terminal engine is not answering: ' + (err && err.message || err));
  }

  function resize(){
    if(!T.term || !T.fit || !T.open) return;
    try{ T.fit.fit(); }catch(e){ return; }
    var c = T.term.cols, r = T.term.rows;
    if(!c || !r) return;
    if(T.size && T.size[0] === c && T.size[1] === r) return;
    T.size = [c, r];
    if(T.live) OPEBridge.call('ptyResize', {cols: c, rows: r}).catch(function(){});
  }
  var resizeSoon = null;
  window.addEventListener('resize', function(){
    clearTimeout(resizeSoon);
    resizeSoon = setTimeout(resize, 80);
  });

  /* output from the shell. It is held in a queue until the scrollback of an
     older shell has been replayed, so nothing lands out of order. */
  OPEBridge.onChange(function(ev){
    var p = ev && ev.pty;
    if(!p) return;
    if(p.data != null){
      if(!T.attached){ T.queue.push(p.data); return; }
      var d = decode(p.data);
      if(d) T.term.write(d);
      setRunning(true);
      return;
    }
    if(p.exit != null){
      T.live = false; T.attached = false; setRunning(false);
      note('The shell ended (' + p.exit + '). Open the terminal again for a new one.');
    }
  });

  function flush(){
    T.attached = true;
    var q = T.queue; T.queue = [];
    q.forEach(function(d){ var x = decode(d); if(x) T.term.write(x); });
  }

  /* ------------------------------------------------------------- the dot */
  function setRunning(on){
    if(T.running === on) return;
    T.running = on;
    var b = document.querySelector('.rail .ico[data-view="term"]');
    if(b) b.classList.toggle('live', !!on);
  }
  /* asked for only while the screen is hidden: while it is open the output
     itself says whether anything is running */
  function watch(){
    clearInterval(T.poll);
    if(T.open || !T.live) return;
    T.poll = setInterval(function(){
      OPEBridge.call('ptyState').then(function(r){
        setRunning(!!(r && r.running));
        if(r && r.open === false){ T.live = false; T.attached = false; clearInterval(T.poll); }
      }).catch(function(){ clearInterval(T.poll); });
    }, 2000);
  }

  /* -------------------------------------------------------------- opening */
  function where(){
    var root = (window.OPE && OPE.state && OPE.state.root) || '';
    return root;
  }

  function show(){
    build();
    T.root = where();
    $('termWhere').textContent = T.root || 'No project open';
    $('termView').classList.remove('hidden');
    T.open = true;
    clearInterval(T.poll);
    if(!make()){
      say('The terminal could not load. Run npm run vendor to put xterm in web/vendor.');
      return;
    }
    T.size = null;
    resize();
    T.term.focus();
    /* a different project has its own shell: let go of this one and ask again */
    if(T.live && T.root !== T.shellRoot){ T.live = false; T.attached = false; T.term.reset(); }
    if(T.live) return;                       /* already attached to a live shell */
    say('');
    T.attached = false; T.queue = [];
    OPEBridge.call('ptyOpen', {cols: T.term.cols || 80, rows: T.term.rows || 24}).then(function(r){
      r = r || {};
      T.live = true; T.shellRoot = T.root;
      if(r.degraded) say('Plain output only on this build' + (r.why ? ': ' + r.why : '') + '. No progress bars and no prompts.');
      if(r.started === false){
        /* a shell was already alive: put back everything it printed while we
           were away, then start listening again */
        T.term.reset();
        var b = decode(r.buffer);
        if(b) T.term.write(b);
      } else {
        T.term.clear();
      }
      flush();
      if(r.cwd) $('termWhere').textContent = r.cwd;
      setRunning(false);
      resize();
      T.term.focus();
    }).catch(function(err){
      T.live = false;
      say('The terminal engine is not answering: ' + (err && err.message || err));
    });
  }

  function hide(){
    if(!T.open) return;
    T.open = false;
    var el = $('termView');
    if(el) el.classList.add('hidden');
    watch();
  }

  function toggle(){ if(T.open) hide(); else show(); }

  window.OPETerm = {open: show, close: hide, toggle: toggle, showing: function(){ return T.open; }};
})();
