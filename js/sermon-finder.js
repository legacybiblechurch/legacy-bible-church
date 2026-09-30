/**
 * Sermon finder — search and filter the archive on sermons.html.
 *
 * Reads the sermon rows already on the page (date, title, description, audio
 * link) and works out each one's Bible passage from its title. Nothing is
 * stored separately: add a row to the page and it is searchable.
 *
 * A row can state things the title does not:
 *   <li class="sermon-item" data-speaker="Guest Name" data-passage="John 3:16">
 */
(function () {
  var host = document.querySelector('.archive-accordion');
  if (!host) return;

  var BOOKS = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];
  var ORDER = {}; BOOKS.forEach(function (b, i) { ORDER[b] = i; });
  var names = BOOKS.concat(['Psalm']).sort(function (a, b) { return b.length - a.length; });
  var REF = new RegExp('(?:^|[^A-Za-z0-9])(' + names.join('|').replace(/ /g, '\\s+') + ')\\.?\\s+(\\d{1,3})(?:\\s*[.:]\\s*(\\d{1,3})[a-c]?(?:\\s*[-–]\\s*(\\d{1,3})[a-c]?(?:[.:](\\d{1,3}))?)?)?', 'i');
  var BOOKONLY = new RegExp('(?:^|[^A-Za-z0-9])(' + names.join('|').replace(/ /g, '\\s+') + ')\\s+(?:Intro|Introduction|Summary|Overview)\\b', 'i');
  var MONTHS = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };

  function canon(b) {
    b = b.replace(/\s+/g, ' ').toLowerCase();
    if (b === 'psalm') b = 'psalms';
    for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].toLowerCase() === b) return BOOKS[i];
    return null;
  }
  function passageOf(text) {
    var m = REF.exec(text);
    if (m) {
      var book = canon(m[1]); if (!book) return null;
      var ref = (book === 'Psalms' ? 'Psalm' : book) + ' ' + m[2];
      if (m[3]) { ref += ':' + m[3]; if (m[4]) ref += '–' + (m[5] ? m[4] + ':' + m[5] : m[4]); }
      return { book: book, ch: +m[2], v: +(m[3] || 0), v2: m[4] && !m[5] ? +m[4] : 0, ref: ref, raw: m[0] };
    }
    m = BOOKONLY.exec(text);
    if (m && canon(m[1])) return { book: canon(m[1]), ch: 0, v: 0, ref: canon(m[1]) };
    return null;
  }
  function dateOf(t) {
    var m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(t || '');
    if (!m || MONTHS[m[1].toLowerCase()] == null) return null;
    return new Date(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  }
  function fold(t) { return String(t || '').toLowerCase().replace(/[‘’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

  /* ── read the rows ──────────────────────────────────────────── */
  var defaultSpeaker = host.getAttribute('data-speaker') || '';
  var rows = [];
  host.querySelectorAll('li.sermon-item').forEach(function (li, i) {
    var title = (li.querySelector('.sermon-title') || {}).textContent || '';
    var desc = (li.querySelector('.sermon-desc') || {}).textContent || '';
    var dtxt = (li.querySelector('.sermon-date') || {}).textContent || '';
    var d = dateOf(dtxt);
    var p = li.getAttribute('data-passage') ? passageOf(li.getAttribute('data-passage')) : passageOf(title);
    var speaker = li.getAttribute('data-speaker') || defaultSpeaker;
    rows.push({ i: i, li: li, title: title.trim(), desc: desc.trim(), dateText: dtxt.trim(), date: d, year: d ? d.getFullYear() : 0,
      p: p, speaker: speaker,
      hay: fold([title, desc, dtxt, speaker, p ? p.ref + ' ' + p.book + ' ' + p.ch + ' ' + p.book + ' ' + p.ch + ' ' + p.v : ''].join(' ')) });
  });
  if (!rows.length) return;

  function tally(key) {
    var c = {}; rows.forEach(function (r) { var k = key(r); if (k) c[k] = (c[k] || 0) + 1; }); return c;
  }
  var byBook = tally(function (r) { return r.p && r.p.book; });
  var byYear = tally(function (r) { return r.year; });
  var bySpeaker = tally(function (r) { return r.speaker; });

  /* ── the bar ────────────────────────────────────────────────── */
  var css = document.createElement('style');
  css.textContent =
    '.sf{margin:0 0 18px}.sf [hidden]{display:none!important}' +
    '.sf-results{max-width:100%}' +
    '.sf-search{position:relative}' +
    '.sf-search input{width:100%;font:inherit;font-size:16px;color:var(--text,#fff);background:var(--surface,#161618);border:1px solid var(--border,#2a2a2e);border-radius:10px;padding:14px 16px 14px 44px;outline:none}' +
    '.sf-search input:focus{border-color:var(--gold,#C9A84C)}' +
    '.sf-search svg{position:absolute;left:15px;top:50%;transform:translateY(-50%);opacity:.5}' +
    '.sf-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}' +
    '.sf select{font:inherit;font-size:14px;color:var(--text,#fff);background:var(--surface,#161618);border:1px solid var(--border,#2a2a2e);border-radius:8px;padding:9px 30px 9px 12px;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'><path d=\'M1 1l4 4 4-4\' stroke=\'%23999\' fill=\'none\' stroke-width=\'1.5\'/></svg>");background-repeat:no-repeat;background-position:right 11px center}' +
    '.sf select.on{border-color:var(--gold,#C9A84C);color:var(--gold,#C9A84C)}' +
    '.sf-sort{margin-left:auto}' +
    '.sf-meta{display:flex;align-items:center;gap:12px;margin:16px 0 4px;font-size:14px;color:var(--text-muted,#9a9a9e)}' +
    '.sf-clear{font:inherit;font-size:13px;background:none;border:1px solid var(--border,#2a2a2e);color:var(--text,#fff);border-radius:100px;padding:4px 12px;cursor:pointer}' +
    '.sf-results{list-style:none;padding:0;margin:0}' +
    '.sf-results .sermon-item{align-items:center}' +
    '.sf-ref{font-size:12px;font-weight:600;color:var(--gold,#C9A84C);border:1px solid rgba(201,168,76,.35);border-radius:100px;padding:2px 9px;white-space:nowrap}' +
    '.sf-by{font-size:12.5px;color:var(--text-muted,#9a9a9e);white-space:nowrap}' +
    '.sf-empty{padding:34px 0;text-align:center;color:var(--text-muted,#9a9a9e)}' +
    '.sf-more{display:block;margin:18px auto 0;font:inherit;font-size:14px;background:none;border:1px solid var(--border,#2a2a2e);color:var(--text,#fff);border-radius:8px;padding:10px 18px;cursor:pointer}' +
    '@media(max-width:600px){.sf-row select{flex:1 1 46%}.sf-sort{margin-left:0}' +
      '.sf-results .sermon-date{min-width:0;width:100%}.sf-results .sermon-title{flex:1 1 60%}.sf-results .sf-ref{order:3}}';
  document.head.appendChild(css);

  function options(counts, order, all) {
    var keys = Object.keys(counts).sort(order);
    return '<option value="">' + all + '</option>' + keys.map(function (k) {
      return '<option value="' + k + '">' + k + ' (' + counts[k] + ')</option>'; }).join('');
  }
  var bar = document.createElement('div');
  bar.className = 'sf';
  bar.setAttribute('data-no-edit', '');
  bar.innerHTML =
    '<div class="sf-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
    '<input id="sf-q" type="search" placeholder="Search by title, passage, or topic — try “John 17”" autocomplete="off"></div>' +
    '<div class="sf-row">' +
      '<select id="sf-book" aria-label="Book of the Bible">' + options(byBook, function (a, b) { return ORDER[a] - ORDER[b]; }, 'Any book') + '</select>' +
      '<select id="sf-year" aria-label="Year">' + options(byYear, function (a, b) { return b - a; }, 'Any year') + '</select>' +
      // only offered when the page actually says who preached (data-speaker on a row)
      (Object.keys(bySpeaker).length ? '<select id="sf-who" aria-label="Preacher">' + options(bySpeaker, function (a, b) { return a.localeCompare(b); }, 'Any preacher') + '</select>' : '<select id="sf-who" hidden><option value=""></option></select>') +
      '<select id="sf-sort" class="sf-sort" aria-label="Sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="title">Title A–Z</option><option value="bible">Bible order</option></select>' +
    '</div>' +
    '<div class="sf-meta" id="sf-meta" hidden><span id="sf-count"></span><button class="sf-clear" id="sf-clear">Clear</button></div>' +
    '<ul class="sf-results" id="sf-results" hidden></ul>';
  // under the "All Sermons" heading, directly above the list it searches
  host.parentNode.insertBefore(bar, host);

  var q = bar.querySelector('#sf-q'), selBook = bar.querySelector('#sf-book'), selYear = bar.querySelector('#sf-year'),
      selWho = bar.querySelector('#sf-who'), selSort = bar.querySelector('#sf-sort'),
      out = bar.querySelector('#sf-results'), meta = bar.querySelector('#sf-meta'), shown = 40;

  function sorter(mode) {
    if (mode === 'old') return function (a, b) { return (a.date || 0) - (b.date || 0); };
    if (mode === 'title') return function (a, b) { return a.title.localeCompare(b.title); };
    if (mode === 'bible') return function (a, b) {
      var A = a.p ? ORDER[a.p.book] * 1e6 + a.p.ch * 1e3 + a.p.v : 1e12, B = b.p ? ORDER[b.p.book] * 1e6 + b.p.ch * 1e3 + b.p.v : 1e12;
      return A - B || (a.date || 0) - (b.date || 0); };
    return function (a, b) { return (b.date || 0) - (a.date || 0); };
  }

  function run() {
    // "John 17" means the passage, not any sermon preached on the 17th: pull a
    // Bible reference out of the query and match it against each sermon's passage
    var text = q.value, want = passageOf(text);
    if (want && want.raw) text = text.replace(want.raw.replace(/^[^A-Za-z0-9]/, ''), ' ');
    else want = null;
    var words = fold(text).split(' ').filter(Boolean);
    var active = words.length || want || selBook.value || selYear.value || selWho.value || selSort.value !== 'new';
    [selBook, selYear, selWho].forEach(function (s) { s.classList.toggle('on', !!s.value); });
    selSort.classList.toggle('on', selSort.value !== 'new');
    host.hidden = !!active; out.hidden = !active; meta.hidden = !active;
    if (!active) { out.innerHTML = ''; return; }

    var hits = rows.filter(function (r) {
      if (selBook.value && (!r.p || r.p.book !== selBook.value)) return false;
      if (selYear.value && String(r.year) !== selYear.value) return false;
      if (selWho.value && r.speaker !== selWho.value) return false;
      if (want) {
        if (!r.p || r.p.book !== want.book || r.p.ch !== want.ch) return false;
        if (want.v && r.p.v && !(want.v >= r.p.v && want.v <= (r.p.v2 || r.p.v)) && want.v !== r.p.v) return false;
      }
      for (var i = 0; i < words.length; i++) if ((' ' + r.hay + ' ').indexOf(' ' + words[i]) === -1) return false;
      return true;
    }).sort(sorter(selSort.value));

    bar.querySelector('#sf-count').textContent = hits.length + (hits.length === 1 ? ' sermon' : ' sermons');
    out.innerHTML = '';
    if (!hits.length) { out.innerHTML = '<li class="sf-empty">No sermons match. Try fewer words, or clear a filter.</li>'; return; }
    hits.slice(0, shown).forEach(function (r) {
      var li = r.li.cloneNode(true);
      // copies must not carry edit ids (the originals in the archive do)
      li.removeAttribute('data-e'); li.querySelectorAll('[data-e]').forEach(function (e) { e.removeAttribute('data-e'); e.removeAttribute('contenteditable'); });
      var btn = li.querySelector('.play-btn');
      if (btn) { btn.classList.remove('playing'); btn.innerHTML = '&#9654;'; }
      var t = li.querySelector('.sermon-title');
      if (r.p && t) { var chip = document.createElement('span'); chip.className = 'sf-ref'; chip.textContent = r.p.ref; t.parentNode.insertBefore(chip, t.nextSibling); }
      if (r.speaker && t) { var by = document.createElement('span'); by.className = 'sf-by'; by.textContent = r.speaker; t.parentNode.insertBefore(by, t.nextSibling); }
      out.appendChild(li);
    });
    if (hits.length > shown) {
      var more = document.createElement('button'); more.className = 'sf-more';
      more.textContent = 'Show ' + Math.min(40, hits.length - shown) + ' more';
      more.onclick = function () { shown += 40; run(); };
      var wrap = document.createElement('li'); wrap.style.listStyle = 'none'; wrap.appendChild(more); out.appendChild(wrap);
    }
  }
  var timer;
  q.addEventListener('input', function () { shown = 40; clearTimeout(timer); timer = setTimeout(run, 120); });
  [selBook, selYear, selWho, selSort].forEach(function (s) { s.addEventListener('change', function () { shown = 40; run(); }); });
  bar.querySelector('#sf-clear').onclick = function () { q.value = ''; selBook.value = selYear.value = selWho.value = ''; selSort.value = 'new'; shown = 40; run(); q.focus(); };

  window.__sermonFinder = { rows: rows, passageOf: passageOf };
})();
