/* Prototype A — shared behaviour: context/region model, region picker,
   mobile sheet, sidebar scroll affordance, TOC scroll-spy, filters,
   "not in prototype" tooltips. No dependencies. */
(function () {
  'use strict';

  var KEY_HOME = 'hub-proto-home-region';
  var KEY_LAST = 'hub-proto-last-context';
  var REGIONS = { freiburg: { name: 'Galaxy Freiburg', href: 'freiburg.html' } };
  var body = document.body;
  var ctx = { id: body.dataset.ctx, kind: body.dataset.ctxKind, name: body.dataset.ctxName };
  var params = new URLSearchParams(location.search);
  var storageOK = true;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(kind) {
    try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch (e) { storageOK = false; return null; }
  }
  function get(kind, k) {
    try { var s = store(kind); return s ? s.getItem(k) : null; } catch (e) { storageOK = false; return null; }
  }
  function set(kind, k, v) {
    try { var s = store(kind); if (!s) return; if (v == null) s.removeItem(k); else s.setItem(k, v); } catch (e) { storageOK = false; }
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ------------------------------------------------------------ theme -- */
  /* System (prefers-color-scheme) by default. The switch sets data-theme on
     <html> and remembers it; ?theme=light|dark wins for this view (applied
     before paint by the inline head script) and is carried on internal links. */
  var KEY_THEME = 'hub-proto-theme';
  var root = document.documentElement;
  var urlTheme = params.get('theme');
  if (urlTheme !== 'light' && urlTheme !== 'dark') urlTheme = null;
  function themeMode() {
    if (urlTheme) return urlTheme;
    var t = get('local', KEY_THEME);
    return t === 'light' || t === 'dark' ? t : 'system';
  }
  function applyTheme(mode) {
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else root.removeAttribute('data-theme');
    $$('[data-theme-switch] input').forEach(function (i) { i.checked = i.value === mode; });
  }
  applyTheme(themeMode());
  $$('[data-theme-switch] input').forEach(function (i) {
    i.addEventListener('change', function () {
      if (!i.checked) return;
      if (urlTheme) {
        urlTheme = null;
        try { var u = new URL(location.href); u.searchParams.delete('theme'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
      }
      set('local', KEY_THEME, i.value === 'system' ? null : i.value);
      applyTheme(i.value);
    });
  });
  document.addEventListener('click', function (ev) {
    if (!urlTheme) return;
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || a.target === '_blank') return;
    var href = a.getAttribute('href');
    if (!/^[\w.-]+\.html([?#]|$)/.test(href)) return;
    var url = new URL(href, location.href);
    url.searchParams.set('theme', urlTheme);
    a.setAttribute('href', url.pathname.split('/').pop() + url.search + url.hash);
  }, true);

  /* ------------------------------------------------------------ state -- */
  var embed = params.get('embed') === '1';
  if (embed) body.classList.add('is-embed');

  var home = get('local', KEY_HOME) || params.get('home');
  if (ctx.kind === 'region') { home = ctx.id; set('local', KEY_HOME, home); }
  if (home && !REGIONS[home]) home = null;

  var lastRaw = get('session', KEY_LAST) || params.get('from');
  var last = null;
  if (lastRaw) { var p = lastRaw.split('|'); last = { id: p[0], kind: p[1], name: p[2] }; }
  set('session', KEY_LAST, ctx.id + '|' + ctx.kind + '|' + ctx.name);

  var live = $('#ctx-live');
  function announce(msg) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 60);
  }

  function applyHome() {
    $$('[data-region-group]').forEach(function (g) {
      var id = g.getAttribute('data-region-group');
      g.hidden = !(home === id || ctx.id === id);
    });
    var name = home ? REGIONS[home].name : '';
    $$('[data-back]').forEach(function (a) {
      var show = !!home && ctx.id !== home && !embed;
      a.hidden = !show;
      if (show) a.setAttribute('href', REGIONS[home].href);
    });
    $$('[data-home-name]').forEach(function (n) { n.textContent = name; });
    var foot = $('[data-home-foot]');
    if (foot) foot.hidden = !home;
    $$('[data-home-badge]').forEach(function (b) { b.hidden = b.getAttribute('data-home-badge') !== home; });
    $$('[data-home-only]').forEach(function (n) { n.hidden = !home; });
  }
  applyHome();

  /* context change: highlight + announce */
  if (last && last.id !== ctx.id) {
    var label = { region: 'region', global: 'global', project: 'project' }[ctx.kind] || ctx.kind;
    window.setTimeout(function () {
      announce('Now viewing: ' + ctx.name + ' (' + label + ')');
      var box = $('[data-ctx-box]');
      var chip = $('[data-open-picker]');
      [box, chip].forEach(function (el) { if (el) el.classList.add('is-changed'); });
      window.setTimeout(function () {
        [box, chip].forEach(function (el) { if (el) el.classList.remove('is-changed'); });
      }, reduceMotion ? 3000 : 2300);
    }, 350);
  }

  /* storage blocked (sandboxed iframe): carry state in the URL instead */
  document.addEventListener('click', function (ev) {
    if (storageOK) return;
    var a = ev.target.closest && ev.target.closest('a[href$=".html"], a[href*=".html?"], a[href*=".html#"]');
    if (!a || a.target === '_blank') return;
    var url = new URL(a.getAttribute('href'), location.href);
    if (home) url.searchParams.set('home', home);
    url.searchParams.set('from', ctx.id + '|' + ctx.kind + '|' + ctx.name);
    if (embed) url.searchParams.set('embed', '1');
    a.setAttribute('href', url.pathname.split('/').pop() + url.search + url.hash);
  }, true);

  /* embedded view: context locked, global pages open in a new tab */
  if (embed) {
    $$('a[data-global]').forEach(function (a) {
      a.target = '_blank'; a.rel = 'noopener';
      var s = document.createElement('span'); s.className = 'sr-only'; s.textContent = ' (opens in a new tab)';
      a.appendChild(s);
    });
    var cb = $('#ctx-btn');
    if (cb) { cb.setAttribute('aria-disabled', 'true'); cb.removeAttribute('aria-controls'); }
  }

  /* ----------------------------------------------- "not in prototype" -- */
  var tip = document.createElement('div');
  tip.className = 'proto-tip'; tip.id = 'proto-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  body.appendChild(tip);
  var tipFor = null;
  function showTip(el) {
    tipFor = el;
    tip.textContent = '(not in prototype) ' + (el.getAttribute('data-proto') || '');
    tip.hidden = false;
    var r = el.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    var top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = r.top - h - 6;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
    el.setAttribute('aria-describedby', 'proto-tip');
  }
  function hideTip() {
    if (tipFor) tipFor.removeAttribute('aria-describedby');
    tipFor = null; tip.hidden = true;
  }
  document.addEventListener('mouseover', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-proto]');
    if (el) showTip(el); else if (tipFor && document.activeElement !== tipFor) hideTip();
  });
  document.addEventListener('focusin', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-proto]');
    if (el) showTip(el); else hideTip();
  });
  document.addEventListener('scroll', hideTip, true);
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[aria-disabled="true"]');
    if (el) { ev.preventDefault(); if (el.hasAttribute('data-proto')) showTip(el); }
  });
  $$('[data-search-form]').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var inp = $('input', f);
      inp.setAttribute('data-proto', '/search/?q=' + encodeURIComponent(inp.value));
      showTip(inp);
      window.setTimeout(function () { inp.removeAttribute('data-proto'); }, 2500);
    });
  });

  /* ---------------------------------------------------- region picker -- */
  var picker = (function () {
    var btn = $('#ctx-btn'), menu = $('#region-menu');
    if (!btn || !menu) return { open: function () {}, close: function () {}, isOpen: function () { return false; } };
    function items() { return $$('a.rmenu__item', menu); }
    function outside(ev) { if (!menu.contains(ev.target) && !btn.contains(ev.target)) close(false); }
    function open(focusItem) {
      if (embed) return;
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', outside, true);
      if (focusItem !== false) {
        var cur = $('[aria-current="true"]', menu) || $('[data-region="' + home + '"]', menu) || items()[0];
        if (cur) cur.focus();
      }
    }
    function close(returnFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      if (returnFocus) btn.focus();
    }
    btn.addEventListener('click', function () { if (menu.hidden) open(); else close(true); });
    btn.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); open(); }
    });
    menu.addEventListener('keydown', function (ev) {
      var list = items(), i = list.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (ev.key === 'Home') { ev.preventDefault(); list[0].focus(); }
      else if (ev.key === 'End') { ev.preventDefault(); list[list.length - 1].focus(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(true); }
    });
    menu.addEventListener('focusout', function (ev) {
      var to = ev.relatedTarget;
      if (to && !menu.contains(to) && to !== btn) close(false);
    });
    var forget = $('[data-forget-home]', menu);
    if (forget) forget.addEventListener('click', function () {
      set('local', KEY_HOME, null);
      home = null;
      applyHome();
      announce('Home region cleared');
      btn.focus();
      close(false);
    });
    return { open: open, close: close, isOpen: function () { return !menu.hidden; } };
  })();

  /* ------------------------------------------------ mobile nav sheet -- */
  var sheet = $('#sidebar');
  var menuBtn = $('[data-menu-toggle]');
  var chip = $('[data-open-picker]');
  var backdrop = $('[data-sheet-backdrop]');
  var mainWrap = $('[data-main-wrap]');
  var mbar = $('[data-mbar]');
  var mq = window.matchMedia('(max-width: 1023.98px)');
  var trigger = null;

  function focusables(root) {
    return $$('a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([tabindex="-1"]), select, [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) { return (el.offsetParent !== null || el === document.activeElement) && !(el.type === 'radio' && !el.checked); });
  }
  function setInert(on) {
    [mainWrap, mbar].forEach(function (el) { if (!el) return; if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  }
  function openSheet(from, withPicker) {
    if (!sheet || !mq.matches) return;
    trigger = from;
    sheet.classList.add('is-open');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Menu');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    if (chip) chip.setAttribute('aria-expanded', withPicker ? 'true' : 'false');
    if (backdrop) backdrop.hidden = false;
    document.documentElement.classList.add('sheet-open');
    setInert(true);
    window.setTimeout(function () {
      if (withPicker) picker.open();
      else { var c = $('[data-sheet-close]', sheet); if (c) c.focus(); }
      updateShadows();
    }, reduceMotion ? 0 : 60);
  }
  function closeSheet(restore) {
    if (!sheet || !sheet.classList.contains('is-open')) return;
    picker.close(false);
    sheet.classList.remove('is-open');
    sheet.setAttribute('role', 'region'); sheet.removeAttribute('aria-modal'); sheet.setAttribute('aria-label', 'Sidebar');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    if (chip) chip.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.hidden = true;
    document.documentElement.classList.remove('sheet-open');
    setInert(false);
    if (restore !== false && trigger) trigger.focus();
    trigger = null;
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { openSheet(menuBtn, false); });
  if (chip) chip.addEventListener('click', function () {
    if (embed) { showTip(chip); return; }
    openSheet(chip, true);
  });
  var closeBtn = $('[data-sheet-close]');
  if (closeBtn) closeBtn.addEventListener('click', function () { closeSheet(); });
  if (backdrop) backdrop.addEventListener('click', function () { closeSheet(); });
  document.addEventListener('keydown', function (ev) {
    if (!sheet || !sheet.classList.contains('is-open')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(); return; }
    if (ev.key === 'Tab') {
      var f = focusables(sheet);
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); lastEl.focus(); }
      else if (!ev.shiftKey && document.activeElement === lastEl) { ev.preventDefault(); first.focus(); }
      else if (!sheet.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
    }
  });
  var onMq = function () { if (!mq.matches) closeSheet(false); };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);

  /* mobile search row */
  var msToggle = $('[data-msearch-toggle]');
  var msForm = $('#msearch');
  if (msToggle && msForm) {
    msToggle.addEventListener('click', function () {
      var open = msForm.hidden;
      msForm.hidden = !open;
      msToggle.setAttribute('aria-expanded', String(open));
      if (open) $('input', msForm).focus();
    });
    msForm.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { msForm.hidden = true; msToggle.setAttribute('aria-expanded', 'false'); msToggle.focus(); }
    });
  }

  /* ------------------------------------------------ nav disclosures -- */
  $$('.nav-sec__btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var ex = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!ex));
      var list = document.getElementById(b.getAttribute('aria-controls'));
      if (list) list.hidden = ex;
      updateShadows();
    });
  });

  /* ------------------------------------ sidebar scroll affordance ----- */
  var sc = $('[data-sb-scroll]');
  var wrap = $('[data-sb-wrap]');
  var more = null;
  function updateShadows() {
    if (!sc || !wrap) return;
    wrap.classList.toggle('has-above', sc.scrollTop > 2);
    var rest = sc.scrollHeight - sc.clientHeight - sc.scrollTop;
    wrap.classList.toggle('has-below', rest > 2);
    wrap.classList.toggle('has-more', rest > 120);
  }
  if (sc && wrap) {
    more = document.createElement('button');
    more.type = 'button'; more.className = 'sb-more'; more.tabIndex = -1;
    more.setAttribute('aria-hidden', 'true');
    more.innerHTML = 'More <svg class="icon" aria-hidden="true"><use href="#i-chevron-down"/></svg>';
    more.addEventListener('click', function () { sc.scrollBy({ top: sc.clientHeight * 0.7, behavior: reduceMotion ? 'auto' : 'smooth' }); });
    wrap.appendChild(more);
    sc.addEventListener('scroll', updateShadows, { passive: true });
    window.addEventListener('resize', updateShadows);
    var act = $('[aria-current="page"]', sc);
    if (act) {
      var r = act.getBoundingClientRect(), s = sc.getBoundingClientRect();
      if (r.bottom > s.bottom - 48) sc.scrollTop += r.bottom - s.bottom + s.height / 3;
    }
    updateShadows();
  }

  /* --------------------------------------------------- TOC scroll-spy -- */
  var toc = $('[data-toc]');
  if (toc) {
    var links = $$('a[href^="#"]', toc).filter(function (a) { return a.getAttribute('href').length > 1 && a.getAttribute('href') !== '#main'; });
    var targets = links.map(function (a) { return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); });
    var railScroller = toc.closest('.rail__inner');
    var current = null;
    var setActive = function (a) {
      if (a === current) return;
      current = a;
      links.forEach(function (l) {
        if (l === a) { l.setAttribute('aria-current', 'true'); l.classList.add('is-active'); }
        else { l.removeAttribute('aria-current'); l.classList.remove('is-active'); }
      });
      if (a && railScroller && railScroller.scrollHeight > railScroller.clientHeight) {
        var ar = a.getBoundingClientRect(), rr = railScroller.getBoundingClientRect();
        if (ar.top < rr.top + 40 || ar.bottom > rr.bottom - 40) railScroller.scrollTop += (ar.top - rr.top) - rr.height / 3;
      }
    };
    var ticking = false;
    var spy = function () {
      ticking = false;
      var line = Math.min(160, window.innerHeight * 0.3);
      var active = null;
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (!t || t.offsetParent === null) continue;
        if (t.getBoundingClientRect().top <= line) active = links[i]; else break;
      }
      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 4) {
        for (var j = targets.length - 1; j >= 0; j--) { if (targets[j] && targets[j].offsetParent !== null) { active = links[j]; break; } }
      }
      setActive(active);
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(spy); } }, { passive: true });
    window.addEventListener('resize', spy);
    spy();
  }

  /* -------------------------------------------------------- filters --- */
  function fmt(n) { return n.toLocaleString('en-US'); }

  $$('[data-filter]').forEach(function (box) {
    var mode = box.getAttribute('data-mode') || 'year';
    var unit = box.getAttribute('data-unit') || 'items';
    var counts = {}; try { counts = JSON.parse(box.getAttribute('data-counts') || '{}'); } catch (e) {}
    var total = parseInt(box.getAttribute('data-total') || '0', 10);
    var btns = $$('[data-year-btn]', box);
    var sel = $('[data-year-select]', box);
    var wpSel = $('[data-wp-select]', box);
    var rows = $$('li[data-year]', box);
    var status = $('[data-status]', box);
    var empty = $('[data-empty]', box);
    var emptyText = $('[data-empty-text]', box);
    var pager = $('.pager', box);
    var pressed = btns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
    var state = { year: pressed ? pressed.getAttribute('data-year-btn') : 'all', wp: '' };

    function render(announceIt) {
      var shown = 0;
      rows.forEach(function (r) {
        var ok = state.year === 'all' || r.getAttribute('data-year') === state.year;
        if (ok && state.wp) ok = (' ' + (r.getAttribute('data-wp') || '') + ' ').indexOf(' ' + state.wp + ' ') > -1;
        r.hidden = !ok;
        if (ok) shown++;
      });
      $$('[data-year-sec]', box).forEach(function (s) {
        var vis = $$('li[data-year]', s).filter(function (r) { return !r.hidden; }).length;
        s.hidden = vis === 0;
        var c = $('[data-year-count]', s); if (c) c.textContent = vis;
      });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-year-btn') === state.year)); });
      if (sel) sel.value = btns.some(function (b) { return b.getAttribute('data-year-btn') === state.year; }) ? '' : state.year;
      if (empty) empty.hidden = shown > 0;
      if (pager) pager.hidden = shown === 0;
      var msg;
      if (mode === 'esg') {
        var parts = [];
        if (state.year !== 'all') parts.push('from ' + state.year);
        if (state.wp) parts.push('in WP' + state.wp);
        msg = parts.length ? 'Showing ' + shown + ' of 139 news items ' + parts.join(' ') : 'Showing all 139 news items';
      } else if (state.year === 'all') {
        msg = 'Showing ' + shown + ' of ' + fmt(total) + ' ' + unit;
      } else {
        var n = counts[state.year] || 0;
        msg = 'Showing ' + shown + ' of ' + fmt(n) + ' ' + unit + ' from ' + state.year;
        if (shown === 0 && emptyText) emptyText.textContent = '[This prototype holds only the newest items. The live list has ' + fmt(n) + ' ' + unit + ' from ' + state.year + '.]';
      }
      if (shown === 0 && mode === 'esg' && emptyText) emptyText.textContent = 'No news items match this year and work package. Try another combination.';
      if (status) status.textContent = msg;
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { state.year = b.getAttribute('data-year-btn'); render(true); }); });
    if (sel) sel.addEventListener('change', function () { if (sel.value) { state.year = sel.value; render(true); } });
    if (wpSel) wpSel.addEventListener('change', function () { state.wp = wpSel.value; render(true); });
    $$('[data-clear-filters]', box).forEach(function (c) {
      c.addEventListener('click', function () {
        state.year = btns[0] ? btns[0].getAttribute('data-year-btn') : 'all'; state.wp = '';
        if (wpSel) wpSel.value = '';
        render(true);
        if (btns[0]) btns[0].focus();
      });
    });
    if (mode === 'esg') {
      var wp = params.get('wp') || ((params.get('tag') || '').match(/esg-wp(\d)/) || [])[1];
      if (wp && wpSel) { state.wp = wp; wpSel.value = wp; }
    }
    render(false);
  });

  /* directory filters (use.html) */
  var dir = $('[data-dir-filter]');
  if (dir) {
    var list = $('[data-dir-list]');
    var cards = $$('li', list);
    var sec = dir.closest('section');
    var dstatus = $('[data-status]', sec);
    var dempty = $('[data-empty]', sec);
    var f = { q: $('[data-f="q"]', dir), type: $('[data-f="type"]', dir), loc: $('[data-f="loc"]', dir), platform: $('[data-f="platform"]', dir) };
    var run = function () {
      var q = f.q.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var ok = (!q || c.getAttribute('data-search').indexOf(q) > -1) &&
          (!f.type.value || c.getAttribute('data-type') === f.type.value) &&
          (!f.loc.value || c.getAttribute('data-loc') === f.loc.value) &&
          (!f.platform.value || (' ' + c.getAttribute('data-platform') + ' ').indexOf(' ' + f.platform.value + ' ') > -1);
        c.hidden = !ok; if (ok) shown++;
      });
      var filtered = q || f.type.value || f.loc.value || f.platform.value;
      dstatus.textContent = filtered ? 'Showing ' + shown + ' of 12 sample servers matching your filters' : 'Showing 12 sample servers of 224';
      dempty.hidden = shown > 0;
    };
    ['input', 'change'].forEach(function (evn) { dir.addEventListener(evn, run); });
    $$('[data-clear-filters]', sec).forEach(function (b) {
      b.addEventListener('click', function () { f.q.value = ''; f.type.value = ''; f.loc.value = ''; f.platform.value = ''; run(); f.q.focus(); });
    });
  }
})();
