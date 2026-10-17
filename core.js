/* Кіно: логіка. Дані фільмів беруться з OMDb API, а ваші списки, оцінки й нотатки лежать лише в цьому телефоні. */
(function () {
  'use strict';
  var KEY = 'kino_state_v1';
  var VERSION = 'v1';
  var FB = window.FB = {
    fetch: function (u, o) { return window.fetch(u, o); },
    jsonp: jsonpRequest,
    now: function () { return Date.now(); }
  };
  var S = null, listeners = [], saveFailed = false;

  // ---------- Допоміжне ----------
  function clean(v) { v = v == null ? '' : String(v).trim(); return v === 'N/A' ? '' : v; }
  function isId(id) { return /^tt\d{6,10}$/.test(String(id)); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function validPoster(u) { u = clean(u); return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ''; }
  function minutesOf(s) { var m = /(\d+)\s*min/i.exec(clean(s)); return m ? Number(m[1]) : 0; }
  function listOf(s) { s = clean(s); return s ? s.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12) : []; }
  function num(v) { var n = parseFloat(clean(v).replace(/,/g, '')); return isNaN(n) ? null : n; }
  function typeOf(t) { t = clean(t).toLowerCase(); return t === 'series' || t === 'episode' ? t : 'movie'; }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { /* ігноруємо */ } }); }
  function on(f) { listeners.push(f); }

  // ---------- Стан ----------
  function freshState() { return { v: 1, key: '', items: {}, meta: { created: FB.now(), lastBackup: 0 } }; }
  function normalizeItem(x) {
    if (!x || !isId(x.id)) return null;
    var r = x.ratings || {};
    var seasons = {};
    if (x.seasons && typeof x.seasons === 'object') Object.keys(x.seasons).slice(0, 60).forEach(function (k) {
      if (!/^\d{1,3}$/.test(k) || !Array.isArray(x.seasons[k])) return;
      seasons[k] = x.seasons[k].slice(0, 200).map(function (e) { return { n: Number(e.n) || 0, title: String(e.title || '').slice(0, 120), rating: e.rating == null ? null : num(e.rating), released: String(e.released || '').slice(0, 20) }; }).filter(function (e) { return e.n > 0; });
    });
    var watched = {}; if (x.watched && typeof x.watched === 'object') Object.keys(x.watched).slice(0, 4000).forEach(function (k) { if (/^\d{1,3}x\d{1,4}$/.test(k) && x.watched[k]) watched[k] = 1; });
    var my = Number(x.myRating); my = my >= 1 && my <= 10 ? Math.round(my) : null;
    return {
      id: x.id, title: String(x.title || '').slice(0, 200), year: String(x.year || '').slice(0, 12), type: typeOf(x.type), poster: validPoster(x.poster),
      rated: String(x.rated || '').slice(0, 12), released: String(x.released || '').slice(0, 24), runtime: Math.max(0, Math.min(1000, Number(x.runtime) || 0)),
      genre: Array.isArray(x.genre) ? x.genre.map(String).slice(0, 12) : [], director: String(x.director || '').slice(0, 200), writer: String(x.writer || '').slice(0, 300), actors: String(x.actors || '').slice(0, 300),
      plot: String(x.plot || '').slice(0, 2000), language: String(x.language || '').slice(0, 100), country: String(x.country || '').slice(0, 100), awards: String(x.awards || '').slice(0, 300),
      ratings: { imdb: r.imdb == null ? null : num(r.imdb), votes: String(r.votes || '').slice(0, 20), rt: r.rt == null ? null : num(r.rt), meta: r.meta == null ? null : num(r.meta) },
      totalSeasons: Math.max(0, Math.min(100, Number(x.totalSeasons) || 0)),
      status: x.status === 'seen' ? 'seen' : 'want', myRating: my, note: String(x.note || '').slice(0, 1000),
      addedAt: Number(x.addedAt) || 0, seenAt: Number(x.seenAt) || 0, updatedAt: Number(x.updatedAt) || 0, fetchedAt: Number(x.fetchedAt) || 0,
      seasons: seasons, watched: watched
    };
  }
  function normalizeState(o) {
    var s = freshState(); if (!o || typeof o !== 'object') return s;
    s.key = typeof o.key === 'string' ? o.key.trim().slice(0, 64) : '';
    if (o.items && typeof o.items === 'object') Object.keys(o.items).slice(0, 5000).forEach(function (k) { var it = normalizeItem(o.items[k]); if (it) s.items[it.id] = it; });
    if (o.meta && typeof o.meta === 'object') { s.meta.created = Number(o.meta.created) || s.meta.created; s.meta.lastBackup = Number(o.meta.lastBackup) || 0; }
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { S = normalizeState(JSON.parse(raw)); return; } } catch (e) { /* пошкоджено: починаємо наново */ }
    S = freshState();
  }
  function save(silent) {
    try { localStorage.setItem(KEY, JSON.stringify(S)); saveFailed = false; } catch (e) { saveFailed = true; }
    if (!silent) emit();
  }
  function init() { if (!S) load(); FB.state = S; }

  // ---------- OMDb ----------
  function keyOf() { return (S.key || '').trim(); }
  function setKey(k) { S.key = String(k || '').trim().slice(0, 64); save(); }
  function err(code, msg, extra) { var e = new Error(msg || code); e.code = code; if (extra) e.detail = extra; return e; }
  function jsonpRequest(url) {
    return new Promise(function (resolve, reject) {
      var cb = 'kino_cb_' + Math.random().toString(36).slice(2), s = document.createElement('script'), done = false;
      function fin(fn, v) { if (done) return; done = true; try { delete window[cb]; } catch (e) { window[cb] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); fn(v); }
      window[cb] = function (d) { fin(resolve, d); };
      s.onerror = function () { fin(reject, new Error('jsonp')); };
      setTimeout(function () { fin(reject, new Error('jsonp-timeout')); }, 10000);
      s.src = url + '&callback=' + cb; document.head.appendChild(s);
    });
  }
  async function api(params) {
    var key = keyOf(); if (!key) throw err('NO_KEY');
    var q = ['apikey=' + encodeURIComponent(key)];
    Object.keys(params).forEach(function (k) { if (params[k] !== '' && params[k] != null) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k])); });
    var url = 'https://www.omdbapi.com/?' + q.join('&'); var data;
    try {
      var res = await FB.fetch(url);
      try { data = await res.json(); } catch (je) { throw err('NETWORK'); }
    } catch (e) {
      if (e && e.code) throw e;
      // Якщо браузер не пускає звичайний запит, пробуємо запасний спосіб (JSONP)
      try { data = await FB.jsonp(url); } catch (e2) { throw err('NETWORK'); }
    }
    if (data && data.Response === 'False') {
      var m = String(data.Error || '');
      if (/invalid api key|no api key/i.test(m)) throw err('INVALID_KEY', m, m);
      if (/limit/i.test(m)) throw err('LIMIT', m, m);
      if (/not found|incorrect imdb/i.test(m)) throw err('NOT_FOUND', m, m);
      if (/too many/i.test(m)) throw err('TOO_MANY', m, m);
      throw err('API', m, m);
    }
    if (!data || typeof data !== 'object') throw err('NETWORK');
    return data;
  }
  function describeError(e) {
    var c = e && e.code;
    if (c === 'NO_KEY') return 'Спершу додайте ключ OMDb у розділі «Ще».';
    if (c === 'INVALID_KEY') return 'OMDb не прийняв ключ. Перевірте, чи ви скопіювали його повністю і чи підтвердили його листом на пошті.';
    if (c === 'LIMIT') return 'На сьогодні ліміт безкоштовних запитів OMDb вичерпано. Спробуйте завтра. Те, що вже у ваших списках, відкривається без запитів.';
    if (c === 'NETWORK') return 'Немає зв’язку з OMDb. Перевірте інтернет і спробуйте ще раз.';
    if (c === 'TOO_MANY') return 'Забагато збігів. Додайте більше слів у назву.';
    if (c === 'NOT_FOUND') return 'Нічого не знайдено. Спробуйте назву англійською або ID з IMDb (наприклад, tt0133093).';
    return 'OMDb повернув помилку' + (e && e.detail ? ': ' + String(e.detail).slice(0, 120) : '') + '.';
  }
  function toItem(d) {
    var rt = null, meta = null;
    (Array.isArray(d.Ratings) ? d.Ratings : []).forEach(function (r) {
      var v = clean(r && r.Value);
      if (r && r.Source === 'Rotten Tomatoes') { var m = /(\d+)\s*%/.exec(v); if (m) rt = Number(m[1]); }
      if (r && r.Source === 'Metacritic') { var m2 = /(\d+)\s*\//.exec(v); if (m2) meta = Number(m2[1]); }
    });
    var ms = num(d.Metascore); if (meta == null && ms != null) meta = ms;
    return normalizeItem({
      id: clean(d.imdbID), title: clean(d.Title), year: clean(d.Year), type: d.Type, poster: d.Poster, rated: clean(d.Rated), released: clean(d.Released), runtime: minutesOf(d.Runtime),
      genre: listOf(d.Genre), director: clean(d.Director), writer: clean(d.Writer), actors: clean(d.Actors), plot: clean(d.Plot), language: clean(d.Language), country: clean(d.Country), awards: clean(d.Awards),
      ratings: { imdb: num(d.imdbRating), votes: clean(d.imdbVotes), rt: rt, meta: meta }, totalSeasons: parseInt(clean(d.totalSeasons), 10) || 0,
      status: 'want', addedAt: 0, seenAt: 0, updatedAt: 0, fetchedAt: FB.now()
    });
  }
  async function search(q, type, page) {
    q = String(q || '').trim(); if (!q) return { items: [], total: 0 };
    if (isId(q)) { var one = await details(q); return { items: [brief(one)], total: 1 }; }
    var p = { s: q, page: page || 1 }; if (type === 'movie' || type === 'series') p.type = type;
    try {
      var d = await api(p);
      var items = (Array.isArray(d.Search) ? d.Search : []).map(function (x) { return { id: clean(x.imdbID), title: clean(x.Title), year: clean(x.Year), type: typeOf(x.Type), poster: validPoster(x.Poster) }; }).filter(function (x) { return isId(x.id); });
      return { items: items, total: parseInt(d.totalResults, 10) || items.length };
    } catch (e) { if (e.code === 'NOT_FOUND') return { items: [], total: 0 }; throw e; }
  }
  function brief(it) { return { id: it.id, title: it.title, year: it.year, type: it.type, poster: it.poster }; }
  async function details(id) {
    if (!isId(id)) throw err('NOT_FOUND');
    var it = toItem(await api({ i: id, plot: 'full' }));
    if (!it) throw err('API', 'bad response');
    return it;
  }
  async function loadSeason(id, n) {
    var d = await api({ i: id, Season: n });
    var eps = (Array.isArray(d.Episodes) ? d.Episodes : []).map(function (e) { return { n: parseInt(e.Episode, 10) || 0, title: clean(e.Title), rating: num(e.imdbRating), released: clean(e.Released) }; }).filter(function (e) { return e.n > 0; });
    var it = S.items[id];
    if (it) { it.seasons[String(n)] = eps; it.updatedAt = stamp(it.updatedAt); save(); }
    return eps;
  }
  async function testKey() {
    var d = await api({ i: 'tt0133093' });
    return { ok: true, title: clean(d.Title) };
  }

  // ---------- Бібліотека ----------
  function stamp(prev) { return Math.max(FB.now(), (Number(prev) || 0) + 1); }
  function getItem(id) { return S.items[id] || null; }
  function addOrUpdate(fresh, status) {
    fresh = normalizeItem(fresh); if (!fresh) return null;
    var ex = S.items[fresh.id]; var t = FB.now();
    if (ex) {
      ['title', 'year', 'type', 'poster', 'rated', 'released', 'runtime', 'genre', 'director', 'writer', 'actors', 'plot', 'language', 'country', 'awards', 'ratings', 'totalSeasons', 'fetchedAt'].forEach(function (k) { ex[k] = fresh[k]; });
      ex.updatedAt = stamp(ex.updatedAt); save(); return ex;
    }
    fresh.status = status === 'seen' ? 'seen' : 'want'; fresh.addedAt = t; fresh.seenAt = fresh.status === 'seen' ? t : 0; fresh.updatedAt = t;
    S.items[fresh.id] = fresh; save(); return fresh;
  }
  function setStatus(fresh, status) {
    if (status !== 'want' && status !== 'seen') return null;
    var it = S.items[fresh.id] ? S.items[fresh.id] : addOrUpdate(fresh, status);
    if (it.status !== status) { it.status = status; it.seenAt = status === 'seen' ? FB.now() : 0; it.updatedAt = stamp(it.updatedAt); save(); }
    return it;
  }
  function setMyRating(id, n) {
    var it = S.items[id]; if (!it) return null; n = Number(n);
    it.myRating = n >= 1 && n <= 10 && it.myRating !== n ? Math.round(n) : null;
    it.updatedAt = stamp(it.updatedAt); save(); return it;
  }
  function setNote(id, text) { var it = S.items[id]; if (!it) return; it.note = String(text || '').slice(0, 1000); it.updatedAt = stamp(it.updatedAt); save(true); }
  function removeItem(id) { var it = S.items[id]; if (!it) return null; delete S.items[id]; save(); return it; }
  function restoreItem(it) { var n = normalizeItem(it); if (n) { S.items[n.id] = n; save(); } }
  async function refresh(id) { var fresh = await details(id); return addOrUpdate(fresh, 'want'); }
  function epKey(s, e) { return s + 'x' + e; }
  function toggleEpisode(id, s, e) {
    var it = S.items[id]; if (!it) return; var k = epKey(s, e);
    if (it.watched[k]) delete it.watched[k]; else it.watched[k] = 1;
    it.updatedAt = stamp(it.updatedAt); save(true);
  }
  function setSeasonWatched(id, s, on) {
    var it = S.items[id]; var eps = it && it.seasons[String(s)]; if (!eps) return;
    eps.forEach(function (e) { var k = epKey(s, e.n); if (on) it.watched[k] = 1; else delete it.watched[k]; });
    it.updatedAt = stamp(it.updatedAt); save(true);
  }
  function seasonProgress(it, s) {
    var eps = it.seasons[String(s)] || []; var w = eps.filter(function (e) { return it.watched[epKey(s, e.n)]; }).length;
    return { watched: w, total: eps.length };
  }
  function watchedCount(it) { return Object.keys(it.watched).length; }

  var SORTS = { added: 'Нещодавно додані', seen: 'Нещодавно переглянуті', title: 'За назвою', year: 'За роком', imdb: 'За рейтингом IMDb', mine: 'За моєю оцінкою' };
  function yearNum(it) { var m = /\d{4}/.exec(it.year); return m ? Number(m[0]) : 0; }
  function list(status, o) {
    o = o || {};
    var arr = Object.keys(S.items).map(function (k) { return S.items[k]; }).filter(function (it) { return it.status === status; });
    if (o.type === 'movie' || o.type === 'series') arr = arr.filter(function (it) { return it.type === o.type; });
    if (o.genre) arr = arr.filter(function (it) { return it.genre.indexOf(o.genre) >= 0; });
    var cmp = {
      added: function (a, b) { return b.addedAt - a.addedAt; },
      seen: function (a, b) { return b.seenAt - a.seenAt || b.addedAt - a.addedAt; },
      title: function (a, b) { return a.title.localeCompare(b.title, 'uk'); },
      year: function (a, b) { return yearNum(b) - yearNum(a); },
      imdb: function (a, b) { return (b.ratings.imdb || 0) - (a.ratings.imdb || 0); },
      mine: function (a, b) { return (b.myRating || 0) - (a.myRating || 0); }
    }[o.sort] || function (a, b) { return b.addedAt - a.addedAt; };
    return arr.sort(cmp);
  }
  function genres(status) {
    var m = {}; list(status).forEach(function (it) { it.genre.forEach(function (g) { m[g] = (m[g] || 0) + 1; }); });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a] || a.localeCompare(b); }).map(function (g) { return { name: g, count: m[g] }; });
  }
  function randomPick(status, o) { var a = list(status, o); return a.length ? a[Math.floor(Math.random() * a.length)] : null; }
  function stats() {
    var seen = list('seen'), want = list('want'); var rated = seen.filter(function (it) { return it.myRating; });
    var minutes = 0;
    seen.forEach(function (it) { if (it.type === 'series') minutes += watchedCount(it) * (it.runtime || 0); else minutes += it.runtime || 0; });
    var g = genres('seen').slice(0, 3);
    return { want: want.length, seen: seen.length, avgMine: rated.length ? round1(rated.reduce(function (t, it) { return t + it.myRating; }, 0) / rated.length) : null, minutes: minutes, topGenres: g };
  }
  function fmtMinutes(m) {
    m = Math.round(m || 0); if (m < 60) return m + ' хв';
    var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return (d ? d + ' д ' : '') + h + ' год' + (!d && m % 60 ? ' ' + (m % 60) + ' хв' : '');
  }

  // ---------- Копія даних ----------
  function exportJSON() {
    S.meta.lastBackup = FB.now(); save(true);
    return JSON.stringify({ app: 'kino', v: 1, exportedAt: FB.now(), items: S.items }, null, 2);
  }
  function importJSON(text) {
    var o; try { o = JSON.parse(text); } catch (e) { return { error: 'Це не файл копії: не вдалося прочитати.' }; }
    if (!o || o.app !== 'kino' || !o.items || typeof o.items !== 'object') return { error: 'Це не файл копії «Кіно».' };
    var added = 0, updated = 0;
    Object.keys(o.items).slice(0, 5000).forEach(function (k) {
      var n = normalizeItem(o.items[k]); if (!n) return; var ex = S.items[n.id];
      if (!ex) { S.items[n.id] = n; added++; } else if (n.updatedAt > ex.updatedAt) { S.items[n.id] = n; updated++; }
    });
    save(); return { added: added, updated: updated };
  }

  Object.assign(FB, {
    VERSION: VERSION, init: init, on: on, save: save, isSaveFailed: function () { return saveFailed; },
    keyOf: keyOf, setKey: setKey, search: search, details: details, loadSeason: loadSeason, testKey: testKey, describeError: describeError, toItem: toItem,
    getItem: getItem, setStatus: setStatus, setMyRating: setMyRating, setNote: setNote, removeItem: removeItem, restoreItem: restoreItem, refresh: refresh,
    toggleEpisode: toggleEpisode, setSeasonWatched: setSeasonWatched, seasonProgress: seasonProgress, watchedCount: watchedCount,
    list: list, genres: genres, randomPick: randomPick, stats: stats, fmtMinutes: fmtMinutes, SORTS: SORTS, brief: brief,
    exportJSON: exportJSON, importJSON: importJSON, isId: isId, normalizeState: normalizeState, normalizeItem: normalizeItem, api: api, epKey: epKey
  });
  init();
})();
