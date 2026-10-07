/* Galaxy Community Hub — prototype direction B. Shared behaviour for every page.
   Context model: the URL (page) decides the context; a remembered home region lives in
   localStorage "hub-proto-home-region"; the previous context lives in sessionStorage so a
   context change can be highlighted and announced. Every storage access is wrapped. */
(function () {
  'use strict';

  var HOME_KEY = 'hub-proto-home-region';
  var LAST_KEY = 'hub-proto-last-context';
  var VIEW_KEY = 'hub-proto-view';
  var REGIONS = { freiburg: { name: 'Galaxy Freiburg', short: 'Freiburg', href: 'freiburg.html' } };

  function store(kind) {
    return {
      get: function (k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window[kind].setItem(k, v); } catch (e) { /* storage unavailable */ } },
      del: function (k) { try { window[kind].removeItem(k); } catch (e) { /* storage unavailable */ } }
    };
  }
  var local = store('localStorage');
  var session = store('sessionStorage');
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var params = new URLSearchParams(location.search);
  var body = document.body;
  var ctx = {
    type: body.dataset.ctxType,
    id: body.dataset.ctxId,
    announce: body.dataset.ctxAnnounce
  };
  var ctxKey = ctx.type + ':' + ctx.id;
  var framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  var embed = params.get('embed') === '1';

  /* ---------- Theme: System (prefers-color-scheme) / Light / Dark ----------
     The switch sets data-theme on <html> and remembers it in localStorage; ?theme=light|dark wins
     for this view (applied before paint by the inline head script) and is carried on internal links. */
  var THEME_KEY = 'hub-proto-theme';
  var root = document.documentElement;
  var urlTheme = params.get('theme');
  if (urlTheme !== 'light' && urlTheme !== 'dark') { urlTheme = null; }
  function themeMode() {
    if (urlTheme) { return urlTheme; }
    var t = local.get(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  }
  function applyTheme(mode) {
    if (mode === 'light' || mode === 'dark') { root.setAttribute('data-theme', mode); } else { root.removeAttribute('data-theme'); }
    $$('[data-theme-switch] input').forEach(function (i) { i.checked = i.value === mode; });
  }
  applyTheme(themeMode());
  $$('[data-theme-switch] input').forEach(function (i) {
    i.addEventListener('change', function () {
      if (!i.checked) { return; }
      if (urlTheme) {
        urlTheme = null;
        try { var u = new URL(location.href); u.searchParams.delete('theme'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { /* ignore */ }
      }
      if (i.value === 'system') { local.del(THEME_KEY); } else { local.set(THEME_KEY, i.value); }
      applyTheme(i.value);
    });
  });
  document.addEventListener('click', function (e) {
    if (!urlTheme) { return; }
    var a = e.target.closest('a[href]');
    if (!a || a.target === '_blank') { return; }
    var href = a.getAttribute('href');
    if (!/^[\w.-]+\.html([?#]|$)/.test(href)) { return; }
    var url = new URL(href, location.href);
    url.searchParams.set('theme', urlTheme);
    a.setAttribute('href', url.pathname.split('/').pop() + url.search + url.hash);
  }, true);

  /* ---------- Stub links ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[aria-disabled="true"], button[aria-disabled="true"]');
    if (a) { e.preventDefault(); }
  });

  /* ---------- External links when framed / embedded ---------- */
  if (framed || embed) {
    $$('a[href^="http"]').forEach(function (a) {
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* ---------- Context: home region, back link, change highlight + announcement ---------- */
  var fromParam = params.get('from');
  var last = session.get(LAST_KEY);
  if (fromParam) {
    last = fromParam.indexOf(':') > -1 ? fromParam
      : fromParam === 'global' ? 'global:global'
      : fromParam === 'esg' ? 'project:esg'
      : 'region:' + fromParam;
  }
  if (ctx.type === 'region') { local.set(HOME_KEY, ctx.id); }
  var home = local.get(HOME_KEY);
  if (!home && last && last.indexOf('region:') === 0) { home = last.split(':')[1]; }
  if (embed) { home = null; }

  function renderHome() {
    var region = home && REGIONS[home];
    var away = region && !(ctx.type === 'region' && ctx.id === home);
    $$('[data-ctx-back]').forEach(function (a) {
      if (away) {
        a.href = region.href;
        var label = a.querySelector('[data-ctx-back-name]');
        if (label) { label.textContent = region.name; }
        a.hidden = false;
      } else {
        a.hidden = true;
      }
    });
    $$('[data-home-badge]').forEach(function (b) { b.hidden = !(home && b.dataset.homeBadge === home); });
    $$('[data-homefoot]').forEach(function (f) {
      f.hidden = !region;
      var n = f.querySelector('[data-homefoot-name]');
      if (n && region) { n.textContent = region.short; }
    });
  }
  renderHome();

  $$('[data-forget]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      local.del(HOME_KEY);
      home = null;
      renderHome();
      announce('Home region forgotten.');
    });
  });

  var live = $('#ctx-live');
  function announce(text) {
    if (!live) { return; }
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 60);
  }
  if (last && last !== ctxKey && !embed) {
    $$('.picker__btn').forEach(function (b) {
      b.classList.add('is-changed');
      window.setTimeout(function () { b.classList.remove('is-changed'); }, 3200);
    });
    window.setTimeout(function () { announce('Now viewing: ' + ctx.announce); }, 700);
  }
  session.set(LAST_KEY, ctxKey);

  /* ---------- Embedded (iframe) mode: context locked ---------- */
  if (embed) {
    document.documentElement.classList.add('is-embed');
    $$('.picker__btn').forEach(function (b) {
      b.setAttribute('aria-disabled', 'true');
      b.setAttribute('aria-label', b.getAttribute('aria-label') + ' (locked in embedded view)');
      b.dataset.tip = 'Context locked in embedded view';
    });
    $$('a[data-scope="global"]').forEach(function (a) {
      a.target = '_blank';
      a.rel = 'noopener';
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = ' (opens in a new tab)';
      a.appendChild(sr);
    });
  }

  /* ---------- Region picker (disclosure of links) ---------- */
  $$('[data-picker]').forEach(function (picker) {
    var btn = $('.picker__btn', picker);
    var menu = $('.picker__menu', picker);
    if (!btn || !menu) { return; }
    function items() { return $$('a, button', menu).filter(function (el) { return el.offsetParent !== null; }); }
    function open() {
      if (btn.getAttribute('aria-disabled') === 'true') { return; }
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      var cur = $('[aria-current="page"]', menu) || items()[0];
      if (cur) { cur.focus(); }
    }
    function close(focusBtn) {
      if (menu.hidden) { return; }
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) { btn.focus(); }
    }
    btn.addEventListener('click', function () { menu.hidden ? open() : close(false); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    menu.addEventListener('keydown', function (e) {
      var list = items();
      var i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
    });
    picker.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !picker.contains(e.relatedTarget)) { close(false); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!picker.contains(e.target)) { close(false); }
    });
  });

  /* ---------- Generic disclosures (nav groups, sheet region list) ---------- */
  $$('[data-disclosure]').forEach(function (btn) {
    var target = document.getElementById(btn.getAttribute('aria-controls'));
    if (!target) { return; }
    btn.addEventListener('click', function () {
      var openNow = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(openNow));
      target.hidden = !openNow;
    });
  });

  /* ---------- Mobile search panel ---------- */
  var msearch = $('#msearch');
  var stoggle = $('.search-toggle');
  if (msearch && stoggle) {
    var minput = $('input', msearch);
    stoggle.addEventListener('click', function () {
      var openNow = !msearch.classList.contains('is-open');
      msearch.classList.toggle('is-open', openNow);
      stoggle.setAttribute('aria-expanded', String(openNow));
      if (openNow && minput) { minput.focus(); }
    });
    msearch.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        msearch.classList.remove('is-open');
        stoggle.setAttribute('aria-expanded', 'false');
        stoggle.focus();
      }
    });
  }

  /* ---------- Cmd/Ctrl+K focuses search ---------- */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      var desk = $('.topbar .search__input');
      if (desk && desk.offsetParent !== null) { e.preventDefault(); desk.focus(); return; }
      if (stoggle && stoggle.offsetParent !== null) { e.preventDefault(); if (!msearch.classList.contains('is-open')) { stoggle.click(); } else { $('input', msearch).focus(); } }
    }
  });

  /* ---------- Mobile menu sheet: focus trap, Escape, focus return ---------- */
  var sheet = $('#sheet');
  var menuBtn = $('.menu-toggle');
  if (sheet && menuBtn) {
    var panel = $('.sheet__panel', sheet);
    var outside = $$('body > *').filter(function (el) { return el !== sheet && el.tagName !== 'SCRIPT' && el.id !== 'ctx-live'; });
    var focusables = function () {
      return $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', panel)
        .filter(function (el) { return el.offsetParent !== null; });
    };
    function openSheet() {
      sheet.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('sheet-open');
      outside.forEach(function (el) { el.inert = true; });
      var first = $('.sheet__close', panel);
      if (first) { first.focus(); }
    }
    function closeSheet() {
      if (sheet.hidden) { return; }
      sheet.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('sheet-open');
      outside.forEach(function (el) { el.inert = false; });
      menuBtn.focus();
    }
    menuBtn.addEventListener('click', openSheet);
    $$('[data-close]', sheet).forEach(function (el) { el.addEventListener('click', closeSheet); });
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') { return; }
      var f = focusables();
      if (!f.length) { return; }
      var firstEl = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) { closeSheet(); } });
  }

  /* ---------- On this page: scroll-spy ---------- */
  var rail = $('.toc-rail');
  if (rail && 'IntersectionObserver' in window) {
    var links = $$('ol a[href^="#"]', rail).filter(function (a) { return a.hash.length > 1; });
    var targets = links.map(function (a) { return document.getElementById(decodeURIComponent(a.hash.slice(1))); });
    var visible = new Set();
    var setActive = function (id) {
      links.forEach(function (a) {
        if (decodeURIComponent(a.hash.slice(1)) === id) {
          a.setAttribute('aria-current', 'true');
          var top = a.offsetTop - rail.offsetTop;
          if (top < rail.scrollTop || top > rail.scrollTop + rail.clientHeight - 40) { rail.scrollTop = top - 80; }
        } else {
          a.removeAttribute('aria-current');
        }
      });
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { visible.add(en.target); } else { visible.delete(en.target); } });
      var first = targets.filter(function (t) { return t && visible.has(t); })[0];
      if (first) { setActive(first.id); }
      else {
        var above = targets.filter(function (t) { return t && t.getBoundingClientRect().top < 120; });
        var firstT = targets.filter(Boolean)[0];
        if (above.length) { setActive(above[above.length - 1].id); }
        else if (firstT) { setActive(firstT.id); }
      }
    }, { rootMargin: '-72px 0px -66% 0px', threshold: 0 });
    targets.forEach(function (t) { if (t) { io.observe(t); } });
    window.addEventListener('scroll', function () {
      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 4) {
        var lastT = targets.filter(Boolean).pop();
        if (lastT) { setActive(lastT.id); }
      }
    }, { passive: true });
  }

  /* ---------- Listing: rows / tiles ---------- */
  $$('[data-viewtoggle]').forEach(function (group) {
    var scope = document.getElementById(group.dataset.viewtoggle);
    var btns = $$('button[data-view]', group);
    function set(v, save) {
      scope.setAttribute('data-view', v);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === v)); });
      if (save) { local.set(VIEW_KEY, v); }
    }
    var saved = local.get(VIEW_KEY);
    if (saved === 'tiles' || saved === 'rows') { set(saved, false); }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.view, true); }); });
  });

  /* ---------- Listing: year filter (news, past events) ---------- */
  $$('[data-yearfilter]').forEach(function (group) {
    var scope = document.getElementById(group.dataset.yearfilter);
    var status = document.getElementById(group.dataset.status);
    var empty = document.getElementById(group.dataset.empty);
    var more = document.getElementById(group.dataset.more);
    var chips = $$('button[data-year]', group);
    var select = $('select', group);
    function apply(year, label, total) {
      var items = $$('.row[data-year], .tile[data-year]', scope);
      var n = 0;
      items.forEach(function (el) {
        var show = year === 'recent' || el.dataset.year === year;
        el.hidden = !show;
        if (show && el.classList.contains('row')) { n++; }
      });
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.year === year)); });
      if (select && year !== select.value) { select.value = ''; }
      if (empty) {
        empty.hidden = n > 0;
        var y = $('[data-empty-year]', empty);
        if (y) { y.textContent = label || year; }
      }
      if (more) { more.hidden = n === 0; }
      if (status) {
        var tpl = year === 'recent' ? status.dataset.recent : (n ? status.dataset.year : status.dataset.none);
        status.textContent = tpl.replace('{n}', n).replace('{year}', label || year).replace('{total}', total || '');
      }
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { apply(c.dataset.year, c.dataset.label, c.dataset.total); }); });
    if (select) {
      select.addEventListener('change', function () {
        if (!select.value) { return; }
        var o = select.selectedOptions[0];
        apply(select.value, select.value, o && o.dataset.total);
      });
    }
  });

  /* ---------- ESG news: work-package filter ---------- */
  var wp = $('[data-wpfilter]');
  if (wp) {
    var list = document.getElementById(wp.dataset.wpfilter);
    var wstatus = document.getElementById(wp.dataset.status);
    var wempty = document.getElementById(wp.dataset.empty);
    var wbtns = $$('button[data-wp]', wp);
    var applyWp = function (key) {
      var total = 0;
      $$('.yeargroup', list).forEach(function (g) {
        var n = 0;
        $$('[data-wps]', g).forEach(function (el) {
          var show = key === 'all' || (' ' + el.dataset.wps + ' ').indexOf(' ' + key + ' ') > -1;
          el.hidden = !show;
          if (show && el.classList.contains('row')) { n++; }
        });
        g.hidden = n === 0;
        var c = $('[data-yearcount]', g);
        if (c) { c.textContent = n + (n === 1 ? ' article' : ' articles'); }
        total += n;
        var tocLink = document.querySelector('.toc a[href="#' + g.id + '"] .toc__count');
        if (tocLink) { tocLink.textContent = '(' + n + ')'; }
      });
      wbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.wp === key)); });
      if (wempty) { wempty.hidden = total > 0; }
      if (wstatus) {
        var label = key === 'all' ? '' : ' tagged ' + key.replace('esg-wp', 'WP');
        wstatus.textContent = 'Showing ' + total + ' of 139 articles' + label + '.';
      }
    };
    wbtns.forEach(function (b) { b.addEventListener('click', function () { applyWp(b.dataset.wp); }); });
    var preset = params.get('wp');
    if (preset && /^[1-5]$/.test(preset)) { applyWp('esg-wp' + preset); }
  }

  /* ---------- Use Galaxy: platform directory filters (sample of 12) ---------- */
  var pform = $('#platform-filters');
  if (pform) {
    var cards = $$('.plat[data-scope]');
    var pstatus = $('#platform-status');
    var pempty = $('#platform-empty');
    var run = function () {
      var q = (pform.q.value || '').trim().toLowerCase();
      var t = pform.type.value, l = pform.loc.value, p = pform.platform.value;
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!q || c.dataset.text.indexOf(q) > -1) && (!t || c.dataset.scope === t) &&
          (!l || c.dataset.loc === l) && (!p || (' ' + c.dataset.platform + ' ').indexOf(' ' + p + ' ') > -1);
        c.hidden = !ok;
        if (ok) { n++; }
      });
      pstatus.textContent = 'Showing ' + n + ' of ' + cards.length + ' sample servers (224 in the full directory).';
      pempty.hidden = n > 0;
    };
    pform.addEventListener('input', run);
    pform.addEventListener('change', run);
    pform.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    pform.addEventListener('reset', function () { window.setTimeout(run, 0); });
    $$('[data-clear-filters]').forEach(function (b) { b.addEventListener('click', function () { pform.reset(); }); });
  }
})();
