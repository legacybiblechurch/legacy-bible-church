/**
 * LBC Edit Mode — turn it on by adding ?edit to any page's address.
 *
 * Click any outlined text and type. Your changes are kept as a draft in this
 * browser (across every page) until you press Publish, which saves them
 * straight into the website. They are live about a minute later.
 *
 * How a change is saved: every editable element carries a permanent id in the
 * page source (data-e="about-12", put there by scripts/tag_editable.py). Publish
 * fetches the page's source from GitHub, finds that id, replaces only what is
 * inside that element, checks the result, and commits it. Nothing else on the
 * page is touched.
 */
(function () {
  if (!new URLSearchParams(window.location.search).has('edit')) return;

  var REPO = 'legacybiblechurch/legacy-bible-church';
  var TOKEN_KEY = 'lbc-site-token', DRAFT_KEY = 'lbc-draft-v2', LIVE_KEY = 'lbc-going-live';
  var PAGE = (location.pathname.split('/').pop() || 'index.html');
  if (!/\.html$/.test(PAGE)) PAGE = 'index.html';

  function load(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function norm(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  /* ── styles ─────────────────────────────────────────────────── */
  var st = document.createElement('style');
  st.textContent =
    '[data-e]{outline:1px dashed rgba(201,168,76,.45);outline-offset:3px;border-radius:2px;cursor:text;transition:outline-color .15s}' +
    '[data-e]:hover{outline-color:rgba(201,168,76,.9)}' +
    '[data-e]:focus{outline:2px solid #C9A84C;background:rgba(201,168,76,.06)}' +
    '[data-e].lbc-changed{outline:2px solid #C9A84C}' +
    '[data-e].lbc-live{outline:2px solid #7bb37e}' +
    'body{padding-bottom:64px!important}' +
    '#lbc-bar{position:fixed;left:0;right:0;bottom:0;min-height:56px;background:#15130c;border-top:2px solid #C9A84C;z-index:99999;display:flex;align-items:center;gap:12px;padding:8px 16px;font:500 14px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#ececed;box-shadow:0 -4px 18px rgba(0,0,0,.4)}' +
    '#lbc-msg{flex:1;min-width:0}#lbc-msg small{display:block;color:#9a9a9e;font-weight:400;font-size:12px}' +
    '#lbc-bar button{font:inherit;font-weight:600;border-radius:8px;padding:10px 16px;cursor:pointer;border:1px solid #3a3a3e;background:#232327;color:#ececed;white-space:nowrap}' +
    '#lbc-bar button.go{background:#C9A84C;border-color:#C9A84C;color:#16130a}' +
    '#lbc-bar button:disabled{opacity:.45;cursor:default}' +
    '#lbc-ov{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;font:400 14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
    '#lbc-box{background:#161618;color:#c9c9cc;border:1px solid #2a2a2e;border-radius:12px;max-width:560px;width:100%;padding:24px 26px;max-height:90vh;overflow:auto}' +
    '#lbc-box h3{color:#ececed;font-size:19px;margin:0 0 8px}#lbc-box b{color:#ececed}#lbc-box ol{margin:10px 0 14px 20px}#lbc-box li{margin-bottom:7px}' +
    '#lbc-box code{background:#232327;border:1px solid #2a2a2e;padding:1px 6px;border-radius:4px;font-size:12.5px}' +
    '#lbc-box a{color:#C9A84C}' +
    '#lbc-box input{width:100%;font:13px ui-monospace,Menlo,monospace;background:#0d0d0f;color:#ececed;border:1px solid #2a2a2e;border-radius:7px;padding:10px 11px;margin-top:4px}' +
    '#lbc-box .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}' +
    '#lbc-box button{font:600 14px -apple-system,sans-serif;border-radius:8px;padding:10px 16px;cursor:pointer;border:1px solid #3a3a3e;background:#232327;color:#ececed}' +
    '#lbc-box button.go{background:#C9A84C;border-color:#C9A84C;color:#16130a}' +
    '#lbc-err{color:#d98a7a;min-height:20px;margin-top:8px;font-size:13px}' +
    '#lbc-list{margin:10px 0;padding:0;list-style:none}#lbc-list li{padding:7px 0;border-bottom:1px solid #202024;font-size:13px}' +
    '#lbc-list .ok{color:#7bb37e}#lbc-list .bad{color:#d98a7a}' +
    '@media(max-width:600px){#lbc-bar{flex-wrap:wrap}#lbc-msg{flex-basis:100%}#lbc-bar button{flex:1}}';
  document.head.appendChild(st);

  /* ── bar ────────────────────────────────────────────────────── */
  var bar = document.createElement('div');
  bar.id = 'lbc-bar';
  bar.innerHTML = '<div id="lbc-msg"></div><button id="lbc-undo">Undo all</button><button class="go" id="lbc-pub">Publish</button>';
  document.body.appendChild(bar);

  function paintBar(text, sub) {
    var d = load(DRAFT_KEY), n = Object.keys(d).length;
    var pages = {}; Object.keys(d).forEach(function (k) { pages[k.split('|')[0]] = 1; });
    var np = Object.keys(pages).length;
    document.getElementById('lbc-msg').innerHTML = text ||
      (n ? '<b>' + n + ' change' + (n === 1 ? '' : 's') + '</b> ready' + (np > 1 ? ' on ' + np + ' pages' : '') +
           '<small>Not on the website yet — press Publish.</small>'
         : 'Editing — click any outlined text and type.<small>' + (sub || 'Changes save themselves as a draft until you publish.') + '</small>');
    document.getElementById('lbc-pub').disabled = !n;
    document.getElementById('lbc-undo').style.display = n ? '' : 'none';
  }

  /* ── keep ?edit while moving between pages ──────────────────── */
  document.querySelectorAll('a[href]').forEach(function (a) {
    var h = a.getAttribute('href');
    if (!h || /^(https?:|\/\/|mailto:|tel:|#)/.test(h) || /[?&]edit\b/.test(h)) return;
    var parts = h.split('#');
    a.setAttribute('href', parts[0] + (parts[0].indexOf('?') !== -1 ? '&' : '?') + 'edit' + (parts[1] ? '#' + parts[1] : ''));
  });

  /* ── what the person typed, as clean HTML ───────────────────── */
  var KEEP = { A: 1, STRONG: 1, EM: 1, B: 1, I: 1, U: 1, BR: 1, P: 1, UL: 1, OL: 1, LI: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, CITE: 1, SUP: 1, SUB: 1 };
  var ATTRS = { href: 1, target: 1, rel: 1, 'class': 1, id: 1 };
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function clean(node, top) {
    var out = '';
    node.childNodes.forEach(function (c) {
      if (c.nodeType === 3) { out += esc(c.data); return; }
      if (c.nodeType !== 1) return;
      var tag = c.tagName;
      if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|IMG|SVG|VIDEO|AUDIO)$/.test(tag)) return;
      var inner = clean(c, false);
      if (tag === 'BR') { out += '<br>'; return; }
      if (tag === 'DIV') {                       // Chrome wraps new lines in <div>
        if (out && !/<br>$|<\/p>$|<\/li>$/.test(out)) out += '<br>';
        out += inner; return;
      }
      if (!KEEP[tag]) { out += inner; return; }  // span, font... keep the words, drop the wrapper
      var a = '';
      for (var i = 0; i < c.attributes.length; i++) {
        var at = c.attributes[i];
        if (ATTRS[at.name] && !/^\s*javascript:/i.test(at.value)) a += ' ' + at.name + '="' + at.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
      }
      out += '<' + tag.toLowerCase() + a + '>' + inner + '</' + tag.toLowerCase() + '>';
    });
    return top ? out.replace(/(<br>\s*)+$/, '').trim() : out;
  }

  /* ── wire every editable element ────────────────────────────── */
  var originals = {};                     // id -> clean html as loaded
  var draft = load(DRAFT_KEY), live = load(LIVE_KEY), now = Date.now();
  Object.keys(live).forEach(function (k) { if (now - live[k].at > 20 * 60000) delete live[k]; });

  document.querySelectorAll('[data-e]').forEach(function (el) {
    var id = el.getAttribute('data-e'), key = PAGE + '|' + id;
    originals[id] = clean(el, true);

    if (live[key]) {
      // published a moment ago: the site may still be serving the old copy
      if (norm(el.textContent) === norm(live[key].text)) delete live[key];
      else { el.innerHTML = live[key].html; el.classList.add('lbc-live'); el.title = 'Published — going live'; originals[id] = live[key].html; }
    }
    if (draft[key]) { el.innerHTML = draft[key].html; el.classList.add('lbc-changed'); }

    el.contentEditable = 'true';
    el.spellcheck = true;
    if (el.tagName === 'A' || el.tagName === 'BUTTON') el.addEventListener('click', function (e) { e.preventDefault(); });
    el.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });

    el.addEventListener('paste', function (e) {               // plain text only
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
    el.addEventListener('input', function () {
      var html = clean(el, true), d = load(DRAFT_KEY);
      if (norm(html) !== norm(originals[id]) && norm(el.textContent)) d[key] = { html: html, text: norm(el.textContent), page: PAGE, id: id };
      else delete d[key];
      save(DRAFT_KEY, d);
      el.classList.remove('lbc-live');
      el.classList.toggle('lbc-changed', !!d[key]);
      paintBar();
    });
  });
  save(LIVE_KEY, live);
  paintBar();

  document.getElementById('lbc-undo').onclick = function () {
    if (!confirm('Throw away every unpublished change, on every page?')) return;
    save(DRAFT_KEY, {});
    location.reload();
  };

  /* ── GitHub ─────────────────────────────────────────────────── */
  function gh(path, opts) {
    opts = opts || {};
    return fetch('https://api.github.com' + path, {
      method: opts.method || 'GET',
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token(), 'X-GitHub-Api-Version': '2022-11-28' },
      body: opts.body
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!r.ok) {
          var m = (j && j.message) || ('Error ' + r.status);
          if (r.status === 401) m = 'This computer’s connection was rejected. Connect it again.';
          if (r.status === 403) m = 'This computer can read the site but not save to it. The token needs Contents set to “Read and write”.';
          if (r.status === 404) m = 'Could not reach the website’s files. Check the internet connection.';
          if (r.status === 409) m = 'Someone else just changed this page. Reload and try again.';
          var e = new Error(m); e.status = r.status; throw e;
        }
        return j;
      });
    });
  }
  function b64e(s) { var b = new TextEncoder().encode(s), o = '', C = 0x8000; for (var i = 0; i < b.length; i += C) o += String.fromCharCode.apply(null, b.subarray(i, i + C)); return btoa(o); }
  function b64d(s) { var bin = atob(String(s).replace(/\s/g, '')), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); }
  function checkAccess() {
    return gh('/repos/' + REPO).then(function () {
      return fetch('https://api.github.com/repos/' + REPO + '/git/refs', { method: 'POST',
        headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token(), 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ ref: 'refs/heads/main', sha: '0000000000000000000000000000000000000000' }) });
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('This token can read the site but not save to it. Set Contents to “Read and write”.');
    });
  }

  /* ── replacing one element in the page source ───────────────── */
  function spanOf(src, id) {
    var m = new RegExp('<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\sdata-e="' + id.replace(/[-]/g, '\\-') + '"[^>]*>').exec(src);
    if (!m) return null;
    var tag = m[1].toLowerCase(), from = m.index + m[0].length, depth = 1;
    var re = new RegExp('<!--[\\s\\S]*?-->|<(/?)' + tag + '\\b[^>]*>', 'gi');
    re.lastIndex = from;
    var t;
    while ((t = re.exec(src))) {
      if (t[0].indexOf('<!--') === 0) continue;
      if (t[1]) { depth--; if (depth === 0) return { from: from, to: t.index, tag: tag }; }
      else if (!/\/>$/.test(t[0])) depth++;
    }
    return null;
  }
  function applyEdits(src, edits) {
    var results = [];
    edits.forEach(function (e) {
      var sp = spanOf(src, e.id);
      if (!sp) { results.push({ e: e, ok: false, why: 'that part of the page no longer exists' }); return; }
      var next = src.slice(0, sp.from) + e.html + src.slice(sp.to);
      // prove it: the page must still parse, keep every editable id, and show the new words
      var doc = new DOMParser().parseFromString(next, 'text/html');
      var was = (src.match(/\sdata-e="/g) || []).length, is = doc.querySelectorAll('[data-e]').length;
      var el = doc.querySelector('[data-e="' + e.id + '"]');
      if (!el || norm(el.textContent) !== norm(e.text)) { results.push({ e: e, ok: false, why: 'the change did not come out the way you typed it' }); return; }
      if (is !== was) { results.push({ e: e, ok: false, why: 'it would have disturbed another part of the page' }); return; }
      src = next; results.push({ e: e, ok: true });
    });
    return { src: src, results: results };
  }

  /* ── publish ────────────────────────────────────────────────── */
  function overlay(html) {
    var o = document.getElementById('lbc-ov'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'lbc-ov'; o.innerHTML = '<div id="lbc-box">' + html + '</div>';
    document.body.appendChild(o); return o;
  }
  function connect(then) {
    var o = overlay(
      '<h3>Connect this computer</h3>' +
      'Publishing needs permission to save to the church website. One-time setup on this computer.' +
      '<ol><li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener"><b>this GitHub page</b></a>, signed in as the church account.</li>' +
      '<li>Name it <code>site editor</code>. Expiration: <b>No expiration</b>.</li>' +
      '<li><b>Repository access</b> → <b>Only select repositories</b> → <code>legacy-bible-church</code>.</li>' +
      '<li><b>Repository permissions</b> → <b>Add permissions</b> → <code>Contents</code> → <b>Read and write</b>.</li>' +
      '<li><b>Generate token</b>, copy it, paste it here.</li></ol>' +
      '<input id="lbc-tok" type="password" placeholder="github_pat_…" autocomplete="off">' +
      '<div id="lbc-err"></div>' +
      '<div class="row"><button id="lbc-x">Not now</button><button class="go" id="lbc-ok">Connect</button></div>');
    o.querySelector('#lbc-x').onclick = function () { o.remove(); };
    o.querySelector('#lbc-ok').onclick = function () {
      var t = o.querySelector('#lbc-tok').value.trim(); if (!t) return;
      try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
      o.querySelector('#lbc-err').textContent = 'Checking…';
      checkAccess().then(function () { o.remove(); then(); })
        .catch(function (e) { o.querySelector('#lbc-err').textContent = e.message; });
    };
  }

  var busy = false;
  function publish() {
    if (busy) return;
    var d = load(DRAFT_KEY), keys = Object.keys(d);
    if (!keys.length) return;
    if (!token()) { connect(publish); return; }
    busy = true;
    document.getElementById('lbc-pub').disabled = true;
    paintBar('Publishing…<small>Saving your changes to the website.</small>');

    var byPage = {};
    keys.forEach(function (k) { (byPage[d[k].page] = byPage[d[k].page] || []).push(d[k]); });
    var report = [], chain = Promise.resolve();

    Object.keys(byPage).forEach(function (page) {
      chain = chain.then(function () {
        return gh('/repos/' + REPO + '/contents/' + page + '?ref=main&cb=' + Date.now()).then(function (f) {
          var out = applyEdits(b64d(f.content), byPage[page]);
          var good = out.results.filter(function (r) { return r.ok; });
          report = report.concat(out.results.map(function (r) { r.page = page; return r; }));
          if (!good.length) return;
          return gh('/repos/' + REPO + '/contents/' + page, { method: 'PUT', body: JSON.stringify({
            message: 'site edit: ' + page + ' (' + good.length + ' change' + (good.length === 1 ? '' : 's') + ')\n\nMade in the page editor.',
            content: b64e(out.src), sha: f.sha, branch: 'main' }) });
        }).catch(function (e) {
          if (e.status === 401 || e.status === 403) throw e;
          byPage[page].forEach(function (x) { report.push({ e: x, ok: false, why: e.message, page: page }); });
        });
      });
    });

    chain.then(function () {
      var d2 = load(DRAFT_KEY), lv = load(LIVE_KEY);
      report.forEach(function (r) {
        if (!r.ok) return;
        var k = r.page + '|' + r.e.id;
        delete d2[k];
        lv[k] = { html: r.e.html, text: r.e.text, at: Date.now() };
        if (r.page === PAGE) {
          var el = document.querySelector('[data-e="' + r.e.id + '"]');
          if (el) { el.classList.remove('lbc-changed'); el.classList.add('lbc-live'); originals[r.e.id] = r.e.html; }
        }
      });
      save(DRAFT_KEY, d2); save(LIVE_KEY, lv);
      var ok = report.filter(function (r) { return r.ok; }).length, bad = report.length - ok;
      var o = overlay(
        '<h3>' + (bad ? (ok ? 'Mostly published' : 'Could not publish') : 'Published') + '</h3>' +
        (ok ? '<b>' + ok + ' change' + (ok === 1 ? '' : 's') + '</b> saved to the website. Visitors see ' + (ok === 1 ? 'it' : 'them') + ' in about a minute.' : '') +
        (bad ? '<ul id="lbc-list">' + report.filter(function (r) { return !r.ok; }).map(function (r) {
          return '<li class="bad">“' + esc(r.e.text.slice(0, 60)) + '…” on ' + r.page.replace('.html', '') + ' — ' + esc(r.why) + '. It is still in your draft.</li>'; }).join('') + '</ul>' : '') +
        '<div class="row"><button class="go" id="lbc-x">OK</button></div>');
      o.querySelector('#lbc-x').onclick = function () { o.remove(); };
    }).catch(function (e) {
      if (e.status === 401 || e.status === 403) { try { localStorage.removeItem(TOKEN_KEY); } catch (x) {} }
      var o = overlay('<h3>Could not publish</h3>' + esc(e.message) + ' Your changes are still saved as a draft.<div class="row"><button class="go" id="lbc-x">OK</button></div>');
      o.querySelector('#lbc-x').onclick = function () { o.remove(); if (e.status === 401 || e.status === 403) connect(publish); };
    }).then(function () { busy = false; paintBar(); });
  }
  document.getElementById('lbc-pub').onclick = publish;

  window.addEventListener('beforeunload', function () { /* drafts are already saved */ });
  window.__lbcEdit = { applyEdits: applyEdits, spanOf: spanOf, clean: clean };   // for tests
})();
