/**
 * Shared setlist / planner loading for worship-control / worship-display / worship-prep.
 *
 * The committed setlist (js/worship-songs.js -> window.WORSHIP_SETLIST) is the
 * source of truth. The published Google Sheet CSV is only a fallback for when the
 * automation hasn't run yet. That CSV can contain quoted, multi-line fields (the
 * "Fixes" column), so it needs a real parser - a naive split('\n') turns every
 * continuation line into a phantom song.
 */
(function (global) {
  var SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSBczlDX3xoDhPZdmURMEmduM_s1lYvPZiRovZ-ObHroIEsnJ9u1D813GaRlLK6Q9NsDpOTtL4UaRnu/pub?gid=0&single=true&output=csv';

  // ── EDIT ME ────────────────────────────────────────────────────────────────
  // Paste the planner (Google Sheet) edit link here (the URL in the
  // address bar when you have the sheet open, ending in /edit). Until it's set,
  // the "Open the planner" buttons open a read-only view of the sheet.
  var SHEET_EDIT = 'https://docs.google.com/spreadsheets/d/1sMsj05hV3QEJ0hrvwt_aEnB2RXzVfHae5UD7c-StPeA/edit?gid=0#gid=0';
  // ───────────────────────────────────────────────────────────────────────────
  var SHEET_VIEW = SHEET_CSV.replace('/pub?', '/pubhtml?').replace('&single=true&output=csv', '');
  var SHEET_LINK = SHEET_EDIT || SHEET_VIEW;

  // RFC-4180-ish CSV -> array of rows (each row an array of cell strings)
  function parseCsv(text) {
    var rows = [], row = [], cell = '', i = 0, inQuotes = false, c;
    while (i < text.length) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(cell); cell = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += c; i++;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }

  // "How Long, O Lord?" (what a person types) -> "how-long-o-lord-how-long-psalm-13"
  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD')
      .replace(/&rsquo;|&#39;|&apos;/g, "'").replace(/&amp;/g, 'and')
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function normTitle(s) {
    return String(s).toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }
  function resolveSlug(text) {
    var L = (typeof global.LEGACY_SONGS !== 'undefined') ? global.LEGACY_SONGS
          : (typeof LEGACY_SONGS !== 'undefined') ? LEGACY_SONGS : null;
    var guess = slugify(text);
    if (!L) return guess;
    if (L[guess]) return guess;
    if (L[text.trim()]) return text.trim();
    var q = normTitle(text), best = null;
    for (var slug in L) {
      var t = normTitle(L[slug].title || slug);
      if (t === q) return slug;
      if (q && (t.indexOf(q) === 0 || t.indexOf(' ' + q) !== -1 || q.indexOf(t) === 0)) {
        if (!best || t.length < normTitle(L[best].title || best).length) best = slug;
      }
    }
    return best || guess;
  }

  function slugsFromCsv(text) {
    var rows = parseCsv(text);
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var hasHeader = head.indexOf('song') !== -1;
    var col = hasHeader ? head.indexOf('song') : 0;
    return (hasHeader ? rows.slice(1) : rows)
      .map(function (r) { return (r[col] || '').trim(); })
      .filter(Boolean)
      .map(resolveSlug);
  }

  // resolve(slugs) is called with the final list of slugs, from whichever source
  function loadSetlist(resolve) {
    if (Array.isArray(global.WORSHIP_SETLIST) && global.WORSHIP_SETLIST.length) {
      resolve(global.WORSHIP_SETLIST.slice());
      return;
    }
    fetch(SHEET_CSV)
      .then(function (r) { return r.text(); })
      .then(function (t) { resolve(slugsFromCsv(t)); })
      .catch(function () { resolve([]); });
  }

  // The full plan for Sunday, in planner order, with lyrics from the best source:
  //   approved song  -> the locked library entry   (approved: true)
  //   pending song   -> its current draft          (approved: false)
  // resolve([{ slug, title, lyrics:[{label,lines}], approved }])
  function loadSongs(resolve) {
    var L = (typeof global.LEGACY_SONGS !== 'undefined') ? global.LEGACY_SONGS : {};
    var approved = Array.isArray(global.WORSHIP_SETLIST) ? global.WORSHIP_SETLIST : [];

    fetch(SHEET_CSV).then(function (r) { return r.text(); }).then(function (t) {
      var slugs = slugsFromCsv(t);
      if (!slugs.length) { resolve([]); return; }
      Promise.all(slugs.map(function (slug) {
        if (L[slug] && L[slug].lyrics) {
          return Promise.resolve({ slug: slug, title: L[slug].title, lyrics: L[slug].lyrics,
                                   approved: approved.indexOf(slug) !== -1 });
        }
        return fetch('drafts/' + slug + '.json?t=' + Date.now())
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (!d || !d.candidates) return { slug: slug, title: slug, lyrics: null, approved: false };
            var c = null, i;
            for (i = 0; i < d.candidates.length; i++) {
              if (d.forced && d.candidates[i].videoId === d.forced && d.candidates[i].lyrics) { c = d.candidates[i]; break; }
            }
            if (!c) for (i = 0; i < d.candidates.length; i++) { if (d.candidates[i].lyrics) { c = d.candidates[i]; break; } }
            return { slug: slug, title: d.title || slug, lyrics: c ? c.lyrics : null, approved: false };
          })
          .catch(function () { return { slug: slug, title: slug, lyrics: null, approved: false }; });
      })).then(resolve);
    }).catch(function () {
      // no planner reachable — fall back to the approved list only
      loadSetlist(function (sl) {
        resolve(sl.map(function (s) {
          return { slug: s, title: (L[s] && L[s].title) || s, lyrics: (L[s] && L[s].lyrics) || null, approved: true };
        }));
      });
    });
  }

  // Presentation only — split a projection line that crams two sung phrases onto
  // one line ("X for the water so my soul Y") at a natural break near the middle.
  // Same words, never reordered or dropped.
  var BREAKS = [' so ', ' and ', ' but ', ' O ', ' yet ', ' for ', ' to ', ' where ',
                ' when ', ' that ', ' though ', ' even though '];
  function splitLine(line, limit) {
    limit = limit || 42;
    if (line.length <= limit) return [line];
    var mid = line.length / 2, best = -1, bestD = 1e9, bi;
    for (bi = 0; bi < BREAKS.length; bi++) {
      var from = 6;
      while (true) {
        var at = line.toLowerCase().indexOf(BREAKS[bi], from);
        if (at < 6 || at > line.length - 6) break;
        var d = Math.abs(at - mid);
        if (d < bestD) { bestD = d; best = at; }
        from = at + 1;
      }
    }
    if (best < 0) return [line];
    var a = line.slice(0, best).trim();
    var b = line.slice(best + 1).trim();          // keep the break word on line 2
    return splitLine(a, limit).concat(splitLine(b, limit));
  }
  function tidyBlocks(blocks) {
    return (blocks || []).map(function (bl) {
      var out = [];
      (bl.lines || []).forEach(function (l) { out = out.concat(splitLine(l)); });
      return { label: bl.label || '', lines: out };
    });
  }

  global.LBCSheet = {
    SHEET_CSV: SHEET_CSV, SHEET_LINK: SHEET_LINK, sheetEditSet: !!SHEET_EDIT,
    parseCsv: parseCsv, slugsFromCsv: slugsFromCsv, loadSetlist: loadSetlist,
    loadSongs: loadSongs, resolveSlug: resolveSlug,
    splitLine: splitLine, tidyBlocks: tidyBlocks
  };
})(window);
