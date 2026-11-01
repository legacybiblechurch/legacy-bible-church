/**
 * Sunday Starts Saturday — prepare.html
 * Renders this Sunday's order of worship from what Worship Studio published:
 *   https://worship.legacybiblechurch.com/js/worship-service.js  (the order)
 *   https://worship.legacybiblechurch.com/js/songs-data.js       (song titles and links)
 * Both load as plain scripts before this file. Nothing here is typed by hand.
 * scripts/sunday_mail.py builds the Saturday email from the same two files.
 */
(function () {
  'use strict';

  var SERVICE = window.WORSHIP_SERVICE || [];
  var SAVED = window.WORSHIP_SAVED || {};
  // songs-data.js declares `const LEGACY_SONGS`, a global binding but not a window property
  var SONGS = (typeof LEGACY_SONGS !== 'undefined' ? LEGACY_SONGS : window.LEGACY_SONGS) || {};
  var ZONE = 'America/Los_Angeles';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // The coming Sunday in church time. On a Sunday it is today.
  function sundayLabel() {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date()).reduce(function (o, p) { o[p.type] = p.value; return o; }, {});
    var local = new Date(+parts.year, +parts.month - 1, +parts.day);
    var ahead = (7 - local.getDay()) % 7;
    local.setDate(local.getDate() + ahead);
    return local.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function songOf(slug) { return SONGS[slug] || { title: slug.replace(/-/g, ' ') }; }

  function block(kicker, title, sub) {
    var b = el('div', 'prep-item');
    b.appendChild(el('div', 'prep-item__kicker', kicker));
    if (title) b.appendChild(el('h2', 'prep-item__title', title));
    if (sub) b.appendChild(el('p', 'prep-item__sub', sub));
    return b;
  }

  function render() {
    var host = document.getElementById('prepOrder');
    var dateLine = document.getElementById('prepDate');
    if (dateLine) dateLine.textContent = sundayLabel();
    host.innerHTML = '';

    var items = SERVICE.filter(function (it) { return it && (it.type === 'song' || it.type === 'scripture' || it.type === 'sermon' || it.type === 'words'); });
    if (!items.length) {
      host.appendChild(el('p', 'prep-empty', 'This Sunday has not been set yet. Check back Saturday evening.'));
      return;
    }

    var sermonAt = -1;
    items.forEach(function (it, i) { if (it.type === 'sermon' && sermonAt < 0) sermonAt = i; });

    items.forEach(function (it, i) {
      if (it.type === 'scripture') {
        var ref = it.ref || 'Scripture Reading';
        var b = block('Scripture Reading', ref, it.version ? 'Read in the ' + it.version : '');
        var verses = (it.verses || []).filter(function (v) { return v && String(v.text || '').trim(); });
        if (verses.length) {
          var p = el('div', 'prep-verses');
          verses.forEach(function (v) {
            var line = el('p', 'prep-verse');
            var n = el('sup', 'prep-verse__n', String(v.n));
            line.appendChild(n);
            line.appendChild(document.createTextNode(' ' + String(v.text).replace(/\s+/g, ' ').trim()));
            p.appendChild(line);
          });
          b.appendChild(p);
          if (/NASB/i.test(it.version || '')) {
            b.appendChild(el('p', 'prep-copyright', 'Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission. All rights reserved. lockman.org'));
          }
        } else {
          b.appendChild(el('p', 'prep-item__sub', 'Read it before you come.'));
        }
        host.appendChild(b);
        return;
      }

      if (it.type === 'song') {
        var s = songOf(it.slug);
        var label = sermonAt < 0 ? 'Song' : (i < sermonAt ? 'Opening Song' : 'Closing Song');
        var sb = block(label, s.title);
        if (s.youtube) {
          var a = el('a', 'inline-link', 'Listen before Sunday →');
          a.href = s.youtube; a.target = '_blank'; a.rel = 'noopener';
          sb.appendChild(a);
        }
        host.appendChild(sb);
        return;
      }

      if (it.type === 'sermon') {
        var mb = block('Sermon', it.title || 'Sermon', it.passage ? it.passage : '');
        if (it.passage) mb.appendChild(el('p', 'prep-item__note', 'Read ' + it.passage + ' tonight so the sermon lands on ground you already know.'));
        host.appendChild(mb);
        return;
      }

      if (it.type === 'words') {
        var w = SAVED[it.id] || {};
        host.appendChild(block('Together', w.title || 'The Lord’s Table'));
      }
    });
  }

  // A quiet warning if the order was set before last Sunday's service, so it is a past Sunday's.
  function checkFreshness() {
    var note = document.getElementById('prepStale');
    if (!note || !window.fetch) return;
    fetch('https://api.github.com/repos/legacybiblechurch/worship/commits?path=js/worship-service.js&per_page=1')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var when = list && list[0] && list[0].commit && list[0].commit.committer && list[0].commit.committer.date;
        if (!when) return;
        // noon on the most recent Sunday, church time: an order set before it is a past Sunday's
        var p = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hour12: false })
          .formatToParts(new Date()).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
        var local = new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24);
        var lastSunday = new Date(local); lastSunday.setDate(local.getDate() - local.getDay()); lastSunday.setHours(12, 0, 0, 0);
        if (lastSunday > local) lastSunday.setDate(lastSunday.getDate() - 7);
        var setLocal = new Date(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }).format(new Date(when)).replace(/, 24:/, ', 00:'));
        if (setLocal < lastSunday) {
          note.textContent = 'This order was set on ' + new Date(when).toLocaleDateString('en-US', { timeZone: ZONE, month: 'long', day: 'numeric' }) + ' and may be from a past Sunday.';
          note.style.display = '';
        }
      }).catch(function () {});
  }

  function initSignup() {
    var form = document.getElementById('prepForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('prepSubmit');
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('server'); form.reset(); document.getElementById('prepOk').style.display = 'block'; btn.style.display = 'none'; })
        .catch(function () { document.getElementById('prepErr').style.display = 'block'; btn.disabled = false; btn.textContent = 'Send it to me'; });
    });
  }

  if (document.readyState !== 'loading') { render(); checkFreshness(); initSignup(); }
  else document.addEventListener('DOMContentLoaded', function () { render(); checkFreshness(); initSignup(); });
})();
