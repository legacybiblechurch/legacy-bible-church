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

  function slugsFromCsv(text) {
    var rows = parseCsv(text);
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var hasHeader = head.indexOf('song') !== -1;
    var col = hasHeader ? head.indexOf('song') : 0;
    return (hasHeader ? rows.slice(1) : rows)
      .map(function (r) { return (r[col] || '').trim(); })
      .filter(Boolean);
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

  global.LBCSheet = {
    SHEET_CSV: SHEET_CSV, SHEET_LINK: SHEET_LINK, sheetEditSet: !!SHEET_EDIT,
    parseCsv: parseCsv, slugsFromCsv: slugsFromCsv, loadSetlist: loadSetlist
  };
})(window);
