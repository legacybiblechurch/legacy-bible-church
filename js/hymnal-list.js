/**
 * Builds the Hymnal's A–Z list from the song library (js/songs-data.js).
 * Because it reads LEGACY_SONGS directly, it always reflects what the worship
 * automation has approved — new songs, updated videos, corrected lyrics.
 */
(function () {
  var L = (typeof LEGACY_SONGS !== 'undefined') ? LEGACY_SONGS : {};
  var listEl = document.getElementById('hymnalList');
  var navEl = document.getElementById('azNav');
  if (!listEl) return;

  function decode(t) {
    var d = document.createElement('textarea');
    d.innerHTML = t || '';
    return d.value;
  }
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // sort/group key: drop a leading "The ", first letter uppercased
  function letterOf(title) {
    var t = title.replace(/^the\s+/i, '').trim();
    var c = (t[0] || '#').toUpperCase();
    return /[A-Z]/.test(c) ? c : '#';
  }
  function sortKey(title) {
    return title.replace(/^the\s+/i, '').replace(/[^a-z0-9 ]/gi, '').toLowerCase().trim();
  }

  var songs = Object.keys(L).map(function (slug) {
    var title = decode(L[slug].title || slug);
    return { slug: slug, title: title, youtube: L[slug].youtube || '', letter: letterOf(title), key: sortKey(title) };
  }).sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });

  // group
  var groups = {};
  songs.forEach(function (s) { (groups[s.letter] = groups[s.letter] || []).push(s); });
  var letters = Object.keys(groups).sort();

  // A–Z nav (every letter shown; inactive if no songs)
  if (navEl) {
    var full = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    navEl.innerHTML = full.map(function (c) {
      var id = c === '#' ? 'num' : c;
      var has = groups[c];
      return '<a href="#hym-' + id + '"' + (has ? '' : ' class="inactive"') + '>' + (c === '#' ? '#' : c) + '</a>';
    }).join('');
  }

  listEl.innerHTML = letters.map(function (c) {
    var id = c === '#' ? 'num' : c;
    var items = groups[c].map(function (s) {
      var yt = s.youtube;
      var isVideo = /youtube\.com\/watch|youtu\.be\//.test(yt);
      var titleHtml = isVideo || yt
        ? '<a href="' + esc(yt) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>'
        : '<span>' + esc(s.title) + '</span>';
      return '<li>' + titleHtml +
        '<a href="song.html?s=' + esc(s.slug) + '" class="lyrics-btn" title="View &amp; print lyrics">Lyrics</a></li>';
    }).join('');
    return '<div class="hymnal-section" id="hym-' + id + '">' +
      '<h2 class="hymnal-letter">' + (c === '#' ? '0–9' : c) + '</h2>' +
      '<ul class="hymnal-songs">' + items + '</ul></div>';
  }).join('');
})();
