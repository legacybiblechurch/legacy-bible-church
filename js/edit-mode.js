/**
 * LBC Edit Mode
 * Activated when the URL contains ?edit
 *
 * Key features:
 * - Auto-detects editable content on any page
 * - Saves edits to localStorage as you type — switching tabs won't lose anything
 * - Accumulates changes across ALL pages into one draft
 * - One "Send" email covers everything, from every page
 * - After sending, draft is cleared
 */
(function () {
  if (!new URLSearchParams(window.location.search).has('edit')) return;

  var PAGE_KEY = window.location.pathname || '/';
  var DRAFT_KEY = 'lbc-draft'; // shared across all pages

  function getDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveDraft(draft) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }
  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  /* ── STYLES ───────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    '#lbc-bar {',
      'position:fixed; bottom:0; left:0; right:0; height:48px;',
      'background:#C9A84C; z-index:99999;',
      'display:flex; align-items:center; justify-content:space-between;',
      'padding:0 20px; gap:12px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'box-shadow:0 -2px 12px rgba(0,0,0,0.35);',
    '}',
    '#lbc-bar-label { font-size:13px; font-weight:700; color:#1a1200; flex:1; }',
    '#lbc-count {',
      'background:#1a1200; color:#C9A84C;',
      'font-size:11px; font-weight:700;',
      'padding:3px 9px; border-radius:20px;',
      'display:none;',
    '}',
    '#lbc-count.visible { display:inline-block; }',
    '#lbc-send-btn {',
      'background:#1a1200; color:#C9A84C; border:none;',
      'padding:8px 18px; border-radius:6px; font-size:13px;',
      'font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap;',
    '}',
    '#lbc-send-btn:hover { background:#000; }',
    '[data-editable] {',
      'outline:2px dashed rgba(201,168,76,0.45) !important;',
      'outline-offset:3px !important; border-radius:3px;',
      'cursor:text !important;',
      'user-select:text !important; -webkit-user-select:text !important;',
      'transition:outline-color 0.2s, background 0.2s;',
    '}',
    '[data-editable]:hover { outline-color:#C9A84C !important; background:rgba(201,168,76,0.07) !important; }',
    '[data-editable]:focus { outline:2px solid #C9A84C !important; background:rgba(201,168,76,0.1) !important; }',
    '[data-editable].lbc-changed { outline-color:#5cb85c !important; }',

    /* Overlay */
    '#lbc-overlay {',
      'position:fixed; inset:0; background:rgba(0,0,0,0.78);',
      'z-index:999999; display:flex; align-items:center; justify-content:center;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '}',
    '#lbc-box {',
      'background:#1c1c1c; border:1px solid #333; border-radius:14px;',
      'padding:28px; max-width:520px; width:92%; color:#fff;',
    '}',
    '#lbc-box h3 { margin:0 0 6px; color:#C9A84C; font-size:17px; }',
    '#lbc-box p  { margin:0 0 16px; font-size:14px; color:#999; line-height:1.55; }',
    '#lbc-box textarea {',
      'width:100%; height:160px; background:#111; border:1px solid #3a3a3a;',
      'color:#ccc; border-radius:7px; padding:10px 12px; font-size:12px;',
      'font-family:"Menlo","Courier New",monospace; resize:vertical;',
      'box-sizing:border-box; margin-bottom:16px;',
    '}',
    '.lbc-btn-row { display:flex; gap:8px; }',
    '.lbc-btn-row button {',
      'flex:1; padding:11px 8px; border-radius:7px; font-size:13px;',
      'font-weight:700; cursor:pointer; border:none; font-family:inherit;',
    '}',
    '#lbc-email-btn  { background:#C9A84C; color:#111; }',
    '#lbc-copy-btn   { background:#2e2e2e; color:#ccc; border:1px solid #444 !important; }',
    '#lbc-clear-btn  { background:#2e2e2e; color:#c88; border:1px solid #633 !important; }',
    '#lbc-close-btn  { background:#222; color:#666; }',
    '#lbc-copied-msg { color:#5cb85c; font-size:13px; margin-top:10px; display:none; }',
  ].join('');
  document.head.appendChild(style);

  /* ── EDIT BAR ─────────────────────────────────────────────────── */
  var bar = document.createElement('div');
  bar.id = 'lbc-bar';
  bar.innerHTML =
    '<div id="lbc-bar-label">✏️ Edit Mode — click any gold-outlined text to edit</div>' +
    '<span id="lbc-count"></span>' +
    '<button id="lbc-send-btn">Send All Changes to Quaid →</button>';
  document.body.appendChild(bar);

  /* ── PRESERVE ?edit WHEN NAVIGATING ──────────────────────────── */
  document.querySelectorAll('a[href]').forEach(function(link) {
    var href = link.getAttribute('href');
    if (!href) return;
    if (href.indexOf('http') === 0 || href.indexOf('//') === 0 ||
        href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 ||
        href.indexOf('#') === 0) return;
    if (href.indexOf('?edit') !== -1 || href.indexOf('&edit') !== -1) return;
    link.setAttribute('href', href + (href.indexOf('?') !== -1 ? '&' : '?') + 'edit');
  });

  /* ── UPDATE CHANGE COUNTER ────────────────────────────────────── */
  function updateCount() {
    var draft  = getDraft();
    var total  = Object.keys(draft).length;
    var countEl = document.getElementById('lbc-count');
    if (total > 0) {
      countEl.textContent = total + ' change' + (total !== 1 ? 's' : '') + ' pending';
      countEl.classList.add('visible');
    } else {
      countEl.classList.remove('visible');
    }
  }

  /* ── AUTO-DETECT EDITABLE ELEMENTS ───────────────────────────── */
  var tagged  = new Set();
  var counter = 0;

  document.querySelectorAll('[data-editable]').forEach(function(el) { tagged.add(el); });

  function nearestHeading(el) {
    var scope = el.closest('section, .hero, .page-header, article');
    if (!scope) return '';
    var h = scope.querySelector('h1, h2');
    return h ? h.innerText.trim().replace(/\s+/g,' ').slice(0,35) : '';
  }

  function shouldSkip(el) {
    if (!el || !el.innerText || !el.innerText.trim()) return true;
    if (el.querySelector('img, svg, canvas, video, audio')) return true;
    if (el.closest('nav, footer, form, script, style, [data-no-edit]')) return true;
    var p = el.parentElement;
    while (p) { if (tagged.has(p)) return true; p = p.parentElement; }
    return false;
  }

  function register(el, label) {
    if (tagged.has(el) || shouldSkip(el)) return;
    el.dataset.editable = el.dataset.editable || ('e' + (counter++));
    el.dataset.label    = el.dataset.label    || label;
    tagged.add(el);
  }

  document.querySelectorAll('.prose').forEach(function(el) {
    register(el, nearestHeading(el) + ' — Content');
  });
  document.querySelectorAll('.card__body').forEach(function(el) {
    var t = (el.closest('.card,.sermon-card') || {}).querySelector && el.closest('.card,.sermon-card').querySelector('h3');
    register(el, ((t && t.innerText.trim()) || nearestHeading(el)) + ' — Card text');
  });
  document.querySelectorAll('section h2, .page-header h1').forEach(function(el) {
    if (el.closest('nav,footer')) return;
    register(el, 'Heading: "' + el.innerText.trim().slice(0,40) + '"');
  });
  document.querySelectorAll('section h3, .sermon-card h3, .series-card h3').forEach(function(el) {
    if (el.closest('nav,footer')) return;
    register(el, '"' + el.innerText.trim().slice(0,40) + '"');
  });
  document.querySelectorAll('section p, .hero p, .page-header p').forEach(function(el) {
    if (el.closest('nav,footer,form')) return;
    register(el, nearestHeading(el) + ' — "' + el.innerText.trim().slice(0,30) + '"');
  });
  document.querySelectorAll('a.btn, a.inline-link, button.btn').forEach(function(el) {
    if (el.closest('nav,footer,form')) return;
    register(el, 'Button: "' + el.innerText.trim() + '"');
  });
  document.querySelectorAll('.sermon-card__date, .sermon-card__desc, .series-card__label').forEach(function(el) {
    register(el, nearestHeading(el) + ' — ' + (el.className.split('__')[1] || 'text'));
  });
  document.querySelectorAll('blockquote p, blockquote cite, .zelle-email, address').forEach(function(el) {
    if (el.closest('nav,footer')) return;
    register(el, nearestHeading(el) + ' — ' + el.tagName.toLowerCase());
  });
  document.querySelectorAll('.faq-item__answer p').forEach(function(el) {
    var q = (el.closest('details') || {}).querySelector && el.closest('details').querySelector('summary');
    register(el, 'FAQ: "' + ((q && q.innerText.trim().slice(0,40)) || '') + '"');
  });
  document.querySelectorAll('p.text-muted').forEach(function(el) {
    if (el.closest('nav,footer')) return;
    register(el, nearestHeading(el) + ' — Role label');
  });

  /* ── WIRE UP + RESTORE DRAFTS ─────────────────────────────────── */
  var originals = {};
  var draft = getDraft();

  document.querySelectorAll('[data-editable]').forEach(function(el) {
    var id  = el.dataset.editable;
    var lbl = el.dataset.label || id;
    var storageKey = PAGE_KEY + '|' + id;

    // Record the true original (before any draft restore)
    originals[id] = el.innerText.trim();

    // Restore any saved draft for this element
    if (draft[storageKey]) {
      el.innerText = draft[storageKey].text;
      el.classList.add('lbc-changed');
    }

    el.contentEditable = 'true';
    el.spellcheck = true;

    if (el.tagName === 'A' || el.tagName === 'BUTTON') {
      el.addEventListener('click', function(e) { e.preventDefault(); });
    }

    el.addEventListener('input', function() {
      var now = el.innerText.trim();
      var d   = getDraft();
      if (now !== originals[id]) {
        d[storageKey] = { label: lbl, text: now };
      } else {
        delete d[storageKey]; // reverted to original — remove from draft
      }
      saveDraft(d);
      el.classList.toggle('lbc-changed', now !== originals[id]);
      updateCount();
    });
  });

  updateCount();

  /* ── BUILD EMAIL ──────────────────────────────────────────────── */
  function buildBody() {
    var d = getDraft();
    var keys = Object.keys(d);
    if (!keys.length) return null;

    // Group by page path
    var byPage = {};
    keys.forEach(function(k) {
      var parts   = k.split('|');
      var page    = parts[0] || '/';
      var pageName = page.replace(/\//g,'').replace('.html','') || 'Home';
      pageName = pageName.charAt(0).toUpperCase() + pageName.slice(1);
      if (!byPage[pageName]) byPage[pageName] = [];
      byPage[pageName].push(d[k]);
    });

    var lines = ['Hi Quaid,', '', 'Here are my website updates:', ''];
    Object.keys(byPage).forEach(function(page) {
      lines.push('=== ' + page + ' page ===');
      byPage[page].forEach(function(item) {
        lines.push('');
        lines.push('--- ' + item.label + ' ---');
        lines.push(item.text);
      });
      lines.push('');
    });
    lines.push('— Dad');
    return lines.join('\n');
  }

  /* ── SEND BUTTON ──────────────────────────────────────────────── */
  document.getElementById('lbc-send-btn').addEventListener('click', function() {
    var body = buildBody();
    if (!body) {
      alert('No changes yet — click any gold-outlined text to start editing.');
      return;
    }
    showOverlay(body);
  });

  function showOverlay(body) {
    var subject = encodeURIComponent('Website Updates from Dad');
    var bodyEnc = encodeURIComponent(body);
    var d       = getDraft();
    var total   = Object.keys(d).length;

    var overlay = document.createElement('div');
    overlay.id = 'lbc-overlay';
    overlay.innerHTML =
      '<div id="lbc-box">' +
        '<h3>Ready to Send</h3>' +
        '<p>This email contains all <strong style="color:#C9A84C">' + total + ' change' + (total !== 1 ? 's' : '') + '</strong> ' +
        'across every page you edited — not just this one.<br><br>' +
        'After Quaid receives it, click <strong style="color:#C9A84C">Clear Draft</strong> so you start fresh next time.</p>' +
        '<textarea readonly>' + body + '</textarea>' +
        '<div class="lbc-btn-row">' +
          '<button id="lbc-email-btn">Open Email →</button>' +
          '<button id="lbc-copy-btn">Copy</button>' +
          '<button id="lbc-clear-btn">Clear Draft</button>' +
          '<button id="lbc-close-btn">Close</button>' +
        '</div>' +
        '<div id="lbc-copied-msg">✓ Copied! Paste into an email to Quaid.</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('lbc-email-btn').addEventListener('click', function() {
      window.location.href = 'mailto:HQBarnie@gmail.com?subject=' + subject + '&body=' + bodyEnc;
    });
    document.getElementById('lbc-copy-btn').addEventListener('click', function() {
      navigator.clipboard.writeText(body).then(function() {
        document.getElementById('lbc-copied-msg').style.display = 'block';
      });
    });
    document.getElementById('lbc-clear-btn').addEventListener('click', function() {
      clearDraft();
      document.querySelectorAll('[data-editable].lbc-changed').forEach(function(el) {
        el.classList.remove('lbc-changed');
      });
      updateCount();
      overlay.remove();
      alert('Draft cleared. All changes have been reset.');
    });
    document.getElementById('lbc-close-btn').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  }
})();
