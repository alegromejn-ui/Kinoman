/* Kinoman: логіка. Дані фільмів беруться з OMDb API, а ваші списки, оцінки й нотатки лежать лише в цьому телефоні. */
(function () {
  'use strict';
  var KEY = 'kino_state_v1';
  var VERSION = 'v10';
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
  function freshState() { return { v: 1, key: '', gemKey: '', tmdbKey: '', sync: { url: '', code: '', at: 0 }, tr: {}, items: {}, cols: {}, gone: {}, meta: { created: FB.now(), lastBackup: 0 } }; }
  function imgPath(p) { p = String(p || ''); return /^\/[\w-]{5,60}\.(jpg|jpeg|png|webp)$/.test(p) ? p : ''; }
  function cleanCast(a) { return (Array.isArray(a) ? a : []).slice(0, 20).map(function (c) { return c && c.name ? { id: Math.max(0, Math.floor(Number(c.id) || 0)), name: String(c.name).slice(0, 80), character: String(c.character || '').slice(0, 100), photo: imgPath(c.photo) } : null; }).filter(Boolean); }
  function cleanSeasonEps(o) { var r = {}; if (o && typeof o === 'object') Object.keys(o).slice(0, 100).forEach(function (k) { var n = Math.floor(Number(o[k])); if (/^\d{1,3}$/.test(k) && Number(k) > 0 && n > 0 && n < 1000) r[k] = n; }); return r; }
  function cleanNextAir(o) { if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(String(o.date))) return null; var sn = Math.floor(Number(o.s)), en = Math.floor(Number(o.e)); return { date: String(o.date), s: sn > 0 ? sn : 0, e: en > 0 ? en : 0, name: String(o.name || '').slice(0, 120) }; }
  function cleanRecs(a) { return (Array.isArray(a) ? a : []).slice(0, 20).map(function (r) { var id = Math.floor(Number(r && r.tid) || 0); return id > 0 && r.title ? { tid: id, mt: r.mt === 'tv' ? 'tv' : 'movie', title: String(r.title).slice(0, 120), year: /^\d{4}$/.test(String(r.year)) ? String(r.year) : '', poster: imgPath(r.poster) } : null; }).filter(Boolean); }
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
      tmdbId: Number(x.tmdbId) > 0 ? Math.floor(Number(x.tmdbId)) : 0, mt: x.mt === 'tv' ? 'tv' : x.mt === 'movie' ? 'movie' : '', cast: cleanCast(x.cast), recs: cleanRecs(x.recs),
      titleUk: String(x.titleUk || '').slice(0, 200), plotUk: String(x.plotUk || '').slice(0, 2500),
      trailer: /^[\w-]{11}$/.test(String(x.trailer || '')) ? String(x.trailer) : '', seasonEps: cleanSeasonEps(x.seasonEps), nextAir: cleanNextAir(x.nextAir), tvStatus: String(x.tvStatus || '').slice(0, 40),
      xv: Number(x.xv) || 0, exAt: Number(x.exAt) || 0, cols: Array.isArray(x.cols) ? x.cols.map(String).filter(function (c) { return /^c[\w]{1,24}$/.test(c); }).slice(0, 50) : [],
      status: x.status === 'seen' ? 'seen' : x.status === 'watching' ? 'watching' : 'want', myRating: my, note: String(x.note || '').slice(0, 1000),
      addedAt: Number(x.addedAt) || 0, seenAt: Number(x.seenAt) || 0, updatedAt: Number(x.updatedAt) || 0, fetchedAt: Number(x.fetchedAt) || 0,
      seasons: seasons, watched: watched
    };
  }
  function cleanCols(o) { var r = {}; if (o && typeof o === 'object') Object.keys(o).slice(0, 50).forEach(function (k) { var c = o[k]; if (/^c\w{1,24}$/.test(k) && c && String(c.name || '').trim()) r[k] = { name: String(c.name).trim().slice(0, 40), at: Number(c.at) || 0, upd: Number(c.upd) || Number(c.at) || 0, del: !!c.del }; }); return r; }
  function cleanGone(o) { var r = {}; if (o && typeof o === 'object') Object.keys(o).slice(0, 5000).forEach(function (k) { if (isId(k) && Number(o[k]) > 0) r[k] = Number(o[k]); }); return r; }
  function validSyncUrl(u) { u = String(u || '').trim(); return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,120}\/exec$/.test(u) ? u : ''; }
  function normalizeState(o) {
    var s = freshState(); if (!o || typeof o !== 'object') return s;
    s.key = typeof o.key === 'string' ? o.key.trim().slice(0, 64) : '';
    s.tmdbKey = typeof o.tmdbKey === 'string' ? o.tmdbKey.trim().slice(0, 600) : '';
    s.gemKey = typeof o.gemKey === 'string' ? o.gemKey.trim().slice(0, 200) : '';
    if (o.sync && typeof o.sync === 'object') s.sync = { url: validSyncUrl(o.sync.url), code: String(o.sync.code || '').slice(0, 100), at: Number(o.sync.at) || 0 };
    s.cols = cleanCols(o.cols); s.gone = cleanGone(o.gone);
    if (o.tr && typeof o.tr === 'object') Object.keys(o.tr).slice(0, 200).forEach(function (k) { var v = o.tr[k]; if (v && Array.isArray(v.titles)) s.tr[String(k).slice(0, 100)] = { titles: v.titles.map(function (x) { return String(x).slice(0, 120); }).filter(Boolean).slice(0, 3), year: /^\d{4}$/.test(String(v.year)) ? String(v.year) : '' }; });
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


  // ---------- Gemini (необов'язково): переклад пошуку й опису ----------
  var GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  FB.geminiDelays = [1000, 2000, 4000];
  FB.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function gemKeyOf() { return (S.gemKey || '').trim(); }
  function setGemKey(k) { S.gemKey = String(k || '').trim().slice(0, 200); save(); }
  function foreignGemKey() { try { return (localStorage.getItem('nutriplan_user_gemini_key') || '').trim(); } catch (e) { return ''; } }
  function useForeignGemKey() { var k = foreignGemKey(); if (!k) return false; setGemKey(k); return true; }
  async function gemErrorDetail(res) {
    var raw = ''; try { raw = await res.text(); } catch (e) { return ''; }
    raw = String(raw || '').trim(); if (!raw) return '';
    try { var o = JSON.parse(raw); var em = o && o.error; var m = em && (em.message || em.status); if (m) return String(m).slice(0, 300); } catch (e2) { /* не JSON */ }
    return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  }
  async function gemini(payload) {
    var key = gemKeyOf(); if (!key) throw err('NEED_GEMINI');
    var used = 0, lastErr = null, softErr = null;
    for (var mi = 0; mi < GEMINI_MODELS.length; mi++) {
      var model = GEMINI_MODELS[mi];
      for (;;) {
        var res;
        try {
          // ключ іде лише в заголовку, ніколи в адресі
          res = await FB.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) });
        } catch (ne) {
          lastErr = softErr = err('GEM_NETWORK');
          if (used >= FB.geminiDelays.length) break;
          await FB.sleep(FB.geminiDelays[used++]); continue;
        }
        if (res.ok) return await res.json();
        lastErr = err('GEM_HTTP'); lastErr.status = res.status; lastErr.model = model; lastErr.detail = await gemErrorDetail(res);
        if (res.status === 404) break;
        if (res.status === 429 || res.status >= 500) { softErr = lastErr; if (used >= FB.geminiDelays.length) break; await FB.sleep(FB.geminiDelays[used++]); continue; }
        throw lastErr;
      }
    }
    if (lastErr && lastErr.status === 404 && softErr) throw softErr;
    throw lastErr || err('GEM_HTTP');
  }
  async function geminiJson(prompt, schema) {
    var data = await gemini({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema } });
    var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    var text = (parts || []).map(function (p) { return p.text || ''; }).join('');
    try { return JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()); } catch (e) { throw err('GEM_BAD'); }
  }
  function describeGemError(e) {
    var c = e && e.code, st = c === 'GEM_HTTP' ? e.status : 0;
    if (c === 'NEED_GEMINI') return 'Щоб шукати українською, додайте ключ Gemini у розділі «Ще». Без нього шукайте назву англійською.';
    if (c === 'GEM_NETWORK') return 'Немає зв’язку з Gemini. Перевірте інтернет і спробуйте ще раз.';
    if (c === 'GEM_BAD') return 'Gemini відповів незрозуміло. Спробуйте ще раз.';
    if (st === 400 || st === 401 || st === 403) {
      var d = String((e && e.detail) || ''), low = d.toLowerCase();
      if (/leak/.test(low)) return 'Google вимкнув цей ключ Gemini, бо він був у відкритому доступі. Створіть новий на aistudio.google.com/apikey.';
      if (/not valid|invalid/.test(low)) return 'Google вважає ключ Gemini недійсним. Скопіюйте його ще раз повністю.';
      if (/referer|referrer/.test(low)) return 'Ключ Gemini обмежено за сайтом. У Google AI Studio зніміть це обмеження.';
      return 'Gemini відхилив запит (код ' + st + ')' + (d ? ': «' + d.slice(0, 140) + '»' : '') + '.';
    }
    if (st === 404) return 'Жодна з моделей Gemini недоступна для цього ключа.';
    if (st === 429) return 'Перевищено ліміт запитів Gemini. Зачекайте хвилину й спробуйте ще раз.';
    if (st >= 500) return 'Моделі Gemini зараз перевантажені (код ' + st + '). Спробуйте ще раз за кілька хвилин.';
    return null;
  }
  function hasCyrillic(s) { return /[Ѐ-ӿ]/.test(String(s)); }
  async function translateQuery(q) {
    var k = q.toLowerCase().replace(/\s+/g, ' ').trim();
    if (S.tr[k]) return S.tr[k];
    var o = await geminiJson('Користувач шукає фільм або серіал за назвою, яку написав українською, російською чи латиницею з помилками: «' + q.replace(/[«»"]/g, '') + '». Поверни JSON з полями titles (від одного до трьох варіантів оригінальної назви так, як вона записана на IMDb, найімовірніший першим; для іноземних стрічок міжнародна англійська назва) та year (рік першого виходу, якщо ти певен, інакше порожній рядок). Нічого не вигадуй: якщо не впізнаєш, дай найближчі за звучанням варіанти.',
      { type: 'OBJECT', properties: { titles: { type: 'ARRAY', items: { type: 'STRING' } }, year: { type: 'STRING' } }, required: ['titles'] });
    var titles = (Array.isArray(o.titles) ? o.titles : []).map(function (x) { return String(x).trim(); }).filter(Boolean).slice(0, 3);
    if (!titles.length) throw err('NOT_FOUND');
    var rec = { titles: titles, year: /^\d{4}$/.test(String(o.year || '')) ? String(o.year) : '' };
    var keys = Object.keys(S.tr); if (keys.length >= 150) delete S.tr[keys[0]];
    S.tr[k] = rec; save(true); return rec;
  }
  async function translateItem(it) {
    var o = await geminiJson('Ти перекладач для додатка про кіно. Фільм або серіал: «' + it.title + '» (' + it.year + '). Сюжет англійською: ' + (it.plot || '(немає)') + '\nПоверни JSON: title_uk (загальновживана українська назва в Україні, лише якщо ти її достеменно знаєш, інакше порожній рядок; нічого не вигадуй) і plot_uk (природний переклад сюжету українською, без нових подробиць; порожній рядок, якщо сюжету немає).',
      { type: 'OBJECT', properties: { title_uk: { type: 'STRING' }, plot_uk: { type: 'STRING' } }, required: ['title_uk', 'plot_uk'] });
    return { titleUk: String(o.title_uk || '').trim().slice(0, 200), plotUk: String(o.plot_uk || '').trim().slice(0, 2500) };
  }
  function setTranslation(id, t) { var it = S.items[id]; if (!it) return; it.titleUk = t.titleUk || ''; it.plotUk = t.plotUk || ''; it.updatedAt = stamp(it.updatedAt); save(true); }
  async function testGemini() { var o = await geminiJson('Поверни JSON {"ok":"так"}', { type: 'OBJECT', properties: { ok: { type: 'STRING' } }, required: ['ok'] }); return !!o; }


  // ---------- TMDB (необов'язково): склад акторів із фото, схожі фільми, українські назви ----------
  function tmdbKeyOf() { return (S.tmdbKey || '').trim(); }
  function setTmdbKey(k) { S.tmdbKey = String(k || '').trim().slice(0, 600); catCache = {}; save(); }
  function tmdbImg(path, size) { return imgPath(path) ? 'https://image.tmdb.org/t/p/' + (size || 'w185') + path : ''; }
  async function tmdb(path, params) {
    var key = tmdbKeyOf(); if (!key) throw err('NEED_TMDB');
    var q = []; Object.keys(params || {}).forEach(function (k) { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k])); });
    var headers = { Accept: 'application/json' };
    // довгий «API Read Access Token» іде в заголовку; короткий ключ API TMDB приймає лише в адресі
    if (key.length > 60) headers.Authorization = 'Bearer ' + key; else q.push('api_key=' + encodeURIComponent(key));
    var res;
    try { res = await FB.fetch('https://api.themoviedb.org/3' + path + (q.length ? '?' + q.join('&') : ''), { headers: headers }); } catch (e) { throw err('TMDB_NETWORK'); }
    if (!res.ok) { var e2 = err('TMDB_HTTP'); e2.status = res.status; throw e2; }
    try { return await res.json(); } catch (e3) { throw err('TMDB_NETWORK'); }
  }
  function describeTmdbError(e) {
    var c = e && e.code, st = e && e.status;
    if (c === 'NEED_TMDB') return 'Додайте ключ TMDB у розділі «Ще».';
    if (c === 'TMDB_NETWORK') return 'Немає зв’язку з TMDB. Перевірте інтернет і спробуйте ще раз.';
    if (c === 'TMDB_HTTP') {
      if (st === 401) return 'TMDB не прийняв ключ. Скопіюйте його повністю: це «API Read Access Token» або «API Key» зі сторінки themoviedb.org/settings/api.';
      if (st === 404) return 'TMDB не знайшов цей фільм.';
      if (st === 429) return 'TMDB просить трохи зачекати. Спробуйте за хвилину.';
      if (st >= 500) return 'TMDB зараз недоступний (код ' + st + '). Спробуйте пізніше.';
      return 'TMDB повернув помилку (код ' + st + ').';
    }
    return null;
  }
  function yearOf(d) { var m = /^(\d{4})/.exec(String(d || '')); return m ? m[1] : ''; }
  async function tmdbExtras(it) {
    var f = await tmdb('/find/' + it.id, { external_source: 'imdb_id', language: 'uk-UA' });
    var movies = Array.isArray(f.movie_results) ? f.movie_results : [], tvs = Array.isArray(f.tv_results) ? f.tv_results : [];
    var pickTv = it.type === 'series' ? !!tvs[0] : (!movies[0] && !!tvs[0]);
    var hit = pickTv ? tvs[0] : movies[0];
    if (!hit || !(hit.id > 0)) return { none: true };
    var mt = pickTv ? 'tv' : 'movie';
    var d = await tmdb('/' + mt + '/' + hit.id, { language: 'uk-UA', append_to_response: 'credits,recommendations,videos', include_video_language: 'uk,en,null' });
    var cast = cleanCast(((d.credits && d.credits.cast) || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).slice(0, 14).map(function (c) { return { id: c.id, name: c.name, character: c.character, photo: c.profile_path }; }));
    var recs = cleanRecs(((d.recommendations && d.recommendations.results) || []).filter(function (r) { return r && r.poster_path; }).slice(0, 14).map(function (r) { var rm = r.media_type === 'tv' || (!r.media_type && mt === 'tv') ? 'tv' : 'movie'; return { tid: r.id, mt: rm, title: r.title || r.name, year: yearOf(r.release_date || r.first_air_date), poster: r.poster_path }; }));
    var title = clean(mt === 'tv' ? d.name : d.title), orig = clean(mt === 'tv' ? d.original_name : d.original_title);
    var vids = ((d.videos && d.videos.results) || []).filter(function (v) { return v && v.site === 'YouTube' && /^[\w-]{11}$/.test(String(v.key)) && (v.type === 'Trailer' || v.type === 'Teaser'); });
    vids.sort(function (a, b) { var sc = function (v) { return (v.iso_639_1 === 'uk' ? 0 : v.iso_639_1 === 'en' ? 2 : 4) + (v.type === 'Trailer' ? 0 : 1) - (v.official ? 0.5 : 0); }; return sc(a) - sc(b); });
    var seasonEps = {}; (Array.isArray(d.seasons) ? d.seasons : []).forEach(function (x) { if (x && x.season_number > 0 && x.episode_count > 0) seasonEps[x.season_number] = x.episode_count; });
    var na = d.next_episode_to_air;
    var tvx = mt === 'tv' ? { seasonEps: cleanSeasonEps(seasonEps), nextAir: na ? cleanNextAir({ date: na.air_date, s: na.season_number, e: na.episode_number, name: na.name }) : null, tvStatus: String(d.status || '') } : { seasonEps: {}, nextAir: null, tvStatus: '' };
    return { xv: 2, trailer: vids[0] ? vids[0].key : '', seasonEps: tvx.seasonEps, nextAir: tvx.nextAir, tvStatus: tvx.tvStatus, tmdbId: hit.id, mt: mt, titleUk: title && title !== it.title && /[Ѐ-ӿ]/.test(title) ? title : '', plotUk: /[Ѐ-ӿ]/.test(String(d.overview || '')) ? String(d.overview).trim().slice(0, 2500) : '', cast: cast, recs: recs };
  }
  function setExtras(id, ex) {
    var it = S.items[id]; if (!it || !ex || ex.none) return;
    it.tmdbId = ex.tmdbId; it.mt = ex.mt; it.cast = ex.cast; it.recs = ex.recs; it.trailer = ex.trailer || ''; it.seasonEps = ex.seasonEps || {}; it.nextAir = ex.nextAir || null; it.tvStatus = ex.tvStatus || ''; it.xv = ex.xv || 0; it.exAt = FB.now();
    if (ex.titleUk && !it.titleUk) it.titleUk = ex.titleUk;
    if (ex.plotUk && !it.plotUk) it.plotUk = ex.plotUk;
    it.updatedAt = stamp(it.updatedAt); save(true);
  }
  async function tmdbImdbId(mt, tid) {
    var d = await tmdb('/' + (mt === 'tv' ? 'tv' : 'movie') + '/' + Math.floor(Number(tid)) + '/external_ids', {});
    var id = clean(d.imdb_id); if (!isId(id)) throw err('NO_IMDB');
    return id;
  }
  // Каталог для головної: добірки TMDB, кеш на годину лише в пам’яті
  var catCache = {};
  var CAT = {
    trending: { movie: '/trending/movie/week', tv: '/trending/tv/week' },
    now: { movie: '/movie/now_playing', tv: '/tv/on_the_air' },
    top: { movie: '/movie/top_rated', tv: '/tv/top_rated' },
    popular: { movie: '/movie/popular', tv: '/tv/popular' }
  };
  async function catalog(kind, mt) {
    mt = mt === 'tv' ? 'tv' : 'movie'; var path = CAT[kind] && CAT[kind][mt]; if (!path) return [];
    var ck = kind + ':' + mt, c = catCache[ck]; if (c && FB.now() - c.t < 3600000) return c.items;
    var p = { language: 'uk-UA', page: 1 }; if (kind === 'now' && mt === 'movie') p.region = 'UA';
    var d = await tmdb(path, p);
    var items = (Array.isArray(d.results) ? d.results : []).filter(function (r) { return r && r.id > 0 && imgPath(r.poster_path) && clean(r.title || r.name); }).slice(0, 20).map(function (r) {
      var v = Number(r.vote_average); return { tid: Math.floor(r.id), mt: mt, title: clean(r.title || r.name), year: yearOf(r.release_date || r.first_air_date), poster: r.poster_path, vote: v > 0 ? round1(v) : null };
    });
    catCache[ck] = { t: FB.now(), items: items }; return items;
  }
  // Підказки під час набору: TMDB шукає і українською, і англійською
  var sugCache = {}, sugKeys = [];
  async function suggest(q) {
    q = clean(q).slice(0, 80); if (q.length < 2) return [];
    var ck = q.toLowerCase(); if (sugCache[ck]) return sugCache[ck];
    var d = await tmdb('/search/multi', { query: q, language: 'uk-UA', include_adult: 'false', page: 1 });
    var items = (Array.isArray(d.results) ? d.results : []).filter(function (r) { return r && r.id > 0 && (r.media_type === 'movie' || r.media_type === 'tv') && clean(r.title || r.name); }).slice(0, 8).map(function (r) {
      var title = clean(r.title || r.name), orig = clean(r.original_title || r.original_name), v = Number(r.vote_average);
      return { tid: Math.floor(r.id), mt: r.media_type, title: title, orig: orig && orig !== title ? orig : '', year: yearOf(r.release_date || r.first_air_date), poster: imgPath(r.poster_path), vote: v > 0 ? round1(v) : null };
    });
    sugCache[ck] = items; sugKeys.push(ck); if (sugKeys.length > 60) delete sugCache[sugKeys.shift()];
    return items;
  }
  // Підбір за жанром, десятиліттям і рейтингом
  var TV_GENRE = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 27: 9648, 53: 9648, 10749: 18 };
  async function discover(mt, o) {
    mt = mt === 'tv' ? 'tv' : 'movie'; o = o || {};
    var p = { language: 'uk-UA', sort_by: 'popularity.desc', include_adult: 'false', page: 1 };
    var g = Math.floor(Number(o.genre) || 0); if (g > 0) p.with_genres = mt === 'tv' && TV_GENRE[g] ? TV_GENRE[g] : g;
    if (o.anime) { p.with_genres = 16; p.with_original_language = 'ja'; }
    var dec = Math.floor(Number(o.decade) || 0), df = mt === 'tv' ? 'first_air_date' : 'primary_release_date';
    if (dec === 1) { p[df + '.lte'] = '1979-12-31'; } else if (dec >= 1980) { p[df + '.gte'] = dec + '-01-01'; p[df + '.lte'] = (dec + 9) + '-12-31'; }
    var mv = Number(o.minVote) || 0; if (mv > 0) { p['vote_average.gte'] = mv; p['vote_count.gte'] = 150; p.sort_by = 'vote_average.desc'; }
    var ck = 'd:' + mt + ':' + JSON.stringify(p), c = catCache[ck]; if (c && FB.now() - c.t < 3600000) return c.items;
    var d = await tmdb('/discover/' + mt, p);
    var items = (Array.isArray(d.results) ? d.results : []).filter(function (r) { return r && r.id > 0 && imgPath(r.poster_path) && clean(r.title || r.name); }).slice(0, 20).map(function (r) {
      var v = Number(r.vote_average); return { tid: Math.floor(r.id), mt: mt, title: clean(r.title || r.name), year: yearOf(r.release_date || r.first_air_date), poster: r.poster_path, vote: v > 0 ? round1(v) : null };
    });
    catCache[ck] = { t: FB.now(), items: items }; return items;
  }
  // Сторінка актора
  async function person(pid) {
    pid = Math.floor(Number(pid)); if (!(pid > 0)) throw err('TMDB_HTTP');
    var d = await tmdb('/person/' + pid, { language: 'uk-UA', append_to_response: 'combined_credits' });
    var bio = clean(d.biography);
    if (!bio) { try { var en = await tmdb('/person/' + pid, { language: 'en-US' }); bio = clean(en.biography); } catch (e) { /* без біографії */ } }
    var seen = {}, known = ((d.combined_credits && d.combined_credits.cast) || []).filter(function (c) { return c && c.id > 0 && (c.media_type === 'movie' || c.media_type === 'tv') && imgPath(c.poster_path) && clean(c.title || c.name); });
    known.sort(function (a, b) { return (Number(b.vote_count) || 0) - (Number(a.vote_count) || 0); });
    known = known.filter(function (c) { var k = c.media_type + c.id; if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 40).map(function (c) {
      var v = Number(c.vote_average); return { tid: Math.floor(c.id), mt: c.media_type, title: clean(c.title || c.name), year: yearOf(c.release_date || c.first_air_date), poster: c.poster_path, vote: v > 0 ? round1(v) : null, character: clean(c.character).slice(0, 80) };
    });
    return { id: pid, name: clean(d.name).slice(0, 80), photo: imgPath(d.profile_path), bio: bio.slice(0, 3000), born: /^\d{4}-\d{2}-\d{2}$/.test(String(d.birthday)) ? d.birthday : '', place: clean(d.place_of_birth).slice(0, 120), known: known };
  }
  async function testTmdb() { await tmdb('/configuration', {}); return true; }

  // ---------- Порада від Gemini ----------
  async function advise() {
    var all = Object.keys(S.items).map(function (k) { return S.items[k]; });
    var liked = all.filter(function (it) { return it.myRating; }).sort(function (a, b) { return b.myRating - a.myRating; });
    if (liked.length < 1 && !all.length) throw err('ADVICE_EMPTY');
    var line = function (it) { return '«' + it.title + '» (' + it.year + ')' + (it.myRating ? ' — ' + it.myRating + '/10' : ''); };
    var top = liked.slice(0, 15).map(line), low = liked.filter(function (it) { return it.myRating <= 5; }).slice(0, 6).map(line);
    var known = all.slice(0, 120).map(function (it) { return it.title; });
    var o = await geminiJson('Ти кінорадник для глядача з України. Його оцінки:\n' + (top.join('\n') || '(оцінок ще немає)') + (low.length ? '\nНе сподобалось:\n' + low.join('\n') : '') +
      '\nЩе в його списках (не радь їх): ' + known.join('; ') + '\nПорадь 6 фільмів або серіалів, яких немає в списках, різних за жанром і роком, що найімовірніше йому сподобаються. Для кожного: title (назва українською, як її знають в Україні), original_title (оригінальна назва), year, type (movie або tv), why (одне речення українською, чому саме йому, з посиланням на його оцінки).',
      { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, original_title: { type: 'STRING' }, year: { type: 'STRING' }, type: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['title', 'original_title', 'year', 'type', 'why'] } } }, required: ['items'] });
    return (Array.isArray(o.items) ? o.items : []).slice(0, 8).map(function (x) {
      return { title: clean(x.title).slice(0, 120), orig: clean(x.original_title).slice(0, 120), year: /^\d{4}/.test(String(x.year)) ? String(x.year).slice(0, 4) : '', mt: x.type === 'tv' ? 'tv' : 'movie', why: clean(x.why).slice(0, 300) };
    }).filter(function (x) { return x.title || x.orig; });
  }
  // Знайти фільм у TMDB за назвою й роком (для порад)
  async function findTmdb(x) {
    var tries = [x.orig, x.title].filter(Boolean);
    for (var i = 0; i < tries.length; i++) {
      var list = await suggest(tries[i]); var hit = null;
      for (var j = 0; j < list.length && !hit; j++) if (list[j].mt === x.mt && (!x.year || list[j].year === x.year)) hit = list[j];
      for (j = 0; j < list.length && !hit; j++) if (!x.year || list[j].year === x.year) hit = list[j];
      if (hit) return hit;
    }
    return null;
  }

  // ---------- Українські підписи без ШІ ----------
  var GENRES = { 'Action': 'Бойовик', 'Adventure': 'Пригоди', 'Animation': 'Анімація', 'Biography': 'Біографія', 'Comedy': 'Комедія', 'Crime': 'Кримінал', 'Documentary': 'Документальний', 'Drama': 'Драма', 'Family': 'Сімейний', 'Fantasy': 'Фентезі', 'Film-Noir': 'Нуар', 'History': 'Історичний', 'Horror': 'Жахи', 'Music': 'Музика', 'Musical': 'Мюзикл', 'Mystery': 'Детектив', 'Romance': 'Мелодрама', 'Sci-Fi': 'Фантастика', 'Short': 'Короткометражка', 'Sport': 'Спорт', 'Thriller': 'Трилер', 'War': 'Військовий', 'Western': 'Вестерн', 'Reality-TV': 'Реаліті', 'Talk-Show': 'Ток-шоу', 'News': 'Новини', 'Game-Show': 'Ігрове шоу' };
  var COUNTRIES = { 'United States': 'США', 'USA': 'США', 'United Kingdom': 'Велика Британія', 'UK': 'Велика Британія', 'France': 'Франція', 'Germany': 'Німеччина', 'West Germany': 'ФРН', 'Italy': 'Італія', 'Spain': 'Іспанія', 'Canada': 'Канада', 'Australia': 'Австралія', 'Japan': 'Японія', 'South Korea': 'Південна Корея', 'China': 'Китай', 'Hong Kong': 'Гонконг', 'India': 'Індія', 'Ukraine': 'Україна', 'Poland': 'Польща', 'Sweden': 'Швеція', 'Denmark': 'Данія', 'Norway': 'Норвегія', 'Finland': 'Фінляндія', 'Ireland': 'Ірландія', 'Mexico': 'Мексика', 'Brazil': 'Бразилія', 'Argentina': 'Аргентина', 'Russia': 'Росія', 'Soviet Union': 'СРСР', 'New Zealand': 'Нова Зеландія', 'Czech Republic': 'Чехія', 'Czechoslovakia': 'Чехословаччина', 'Netherlands': 'Нідерланди', 'Belgium': 'Бельгія', 'Austria': 'Австрія', 'Switzerland': 'Швейцарія', 'Turkey': 'Туреччина', 'Hungary': 'Угорщина', 'Iceland': 'Ісландія', 'Greece': 'Греція', 'Israel': 'Ізраїль', 'Thailand': 'Таїланд', 'South Africa': 'ПАР', 'Taiwan': 'Тайвань', 'Romania': 'Румунія', 'Georgia': 'Грузія' };
  var LANGS = { 'English': 'англійська', 'French': 'французька', 'German': 'німецька', 'Spanish': 'іспанська', 'Italian': 'італійська', 'Japanese': 'японська', 'Korean': 'корейська', 'Mandarin': 'мандаринська', 'Cantonese': 'кантонська', 'Russian': 'російська', 'Ukrainian': 'українська', 'Hindi': 'гінді', 'Portuguese': 'португальська', 'Swedish': 'шведська', 'Danish': 'данська', 'Norwegian': 'норвезька', 'Finnish': 'фінська', 'Polish': 'польська', 'Latin': 'латинська', 'Arabic': 'арабська', 'Turkish': 'турецька', 'Dutch': 'нідерландська', 'Czech': 'чеська', 'Hungarian': 'угорська', 'Greek': 'грецька', 'Hebrew': 'іврит', 'Thai': 'тайська', 'Icelandic': 'ісландська', 'None': 'без діалогів' };
  var MONTHS = { Jan: 'січня', Feb: 'лютого', Mar: 'березня', Apr: 'квітня', May: 'травня', Jun: 'червня', Jul: 'липня', Aug: 'серпня', Sep: 'вересня', Oct: 'жовтня', Nov: 'листопада', Dec: 'грудня' };
  function genreUk(g) { return GENRES[g] || g; }
  function mapList(str, map) { return String(str || '').split(',').map(function (x) { x = x.trim(); return map[x] || x; }).filter(Boolean).join(', '); }
  function countryUk(s) { return mapList(s, COUNTRIES); }
  function langUk(s) { return mapList(s, LANGS); }
  function dateUk(s) { var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim()); if (iso) { var mk = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(iso[2]) - 1]; if (mk) return Number(iso[3]) + ' ' + MONTHS[mk] + ' ' + iso[1]; } var m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(String(s || '').trim()); return m && MONTHS[m[2]] ? m[1] + ' ' + MONTHS[m[2]] + ' ' + m[3] : String(s || ''); }

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
    var g = describeGemError(e) || describeTmdbError(e) || describeSyncError(e); if (g) return g;
    if (e && e.code === 'NO_IMDB') return 'Для цього тайтла в TMDB немає IMDb ID, тож відкрити його тут не вдасться.';
    if (c === 'NO_KEY') return 'Спершу додайте ключ OMDb у розділі «Ще».';
    if (c === 'INVALID_KEY') return 'OMDb не прийняв ключ. Перевірте, чи ви скопіювали його повністю і чи підтвердили його листом на пошті.';
    if (c === 'LIMIT') return 'На сьогодні ліміт безкоштовних запитів OMDb вичерпано. Спробуйте завтра. Те, що вже у ваших списках, відкривається без запитів.';
    if (c === 'NETWORK') return 'Немає зв’язку з OMDb. Перевірте інтернет і спробуйте ще раз.';
    if (c === 'TOO_MANY') return 'Забагато збігів. Додайте рік після назви (наприклад, «Dark 2017») або оберіть вище «Фільми» чи «Серіали».';
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
  async function trySearch(q, type, page, year) {
    var p = { s: q, page: page || 1 }; if (type === 'movie' || type === 'series') p.type = type; if (year) p.y = year;
    try {
      var d = await api(p);
      var items = (Array.isArray(d.Search) ? d.Search : []).map(function (x) { return { id: clean(x.imdbID), title: clean(x.Title), year: clean(x.Year), type: typeOf(x.Type), poster: validPoster(x.Poster) }; }).filter(function (x) { return isId(x.id); });
      return { items: items, total: parseInt(d.totalResults, 10) || items.length };
    } catch (e) {
      if (e.code === 'NOT_FOUND') return { items: [], total: 0 };
      if (e.code === 'TOO_MANY' && (page || 1) === 1) {
        // Назва надто загальна: просимо в OMDb найточніший збіг за назвою
        var t = { t: q }; if (type === 'movie' || type === 'series') t.type = type; if (year) t.y = year;
        try { var one = toItem(await api(t)); if (one) return { items: [brief(one)], total: 1, exact: true }; } catch (e2) { /* лишаємо початкову помилку */ }
      }
      throw e;
    }
  }
  async function search(q, type, page) {
    q = String(q || '').trim(); if (!q) return { items: [], total: 0 };
    if (isId(q)) { var one = await details(q); return { items: [brief(one)], total: 1 }; }
    if (hasCyrillic(q)) {
      // Назва українською: Gemini підказує оригінальну назву, а далі звичайний пошук OMDb
      if (page && page > 1) return { items: [], total: 0 };
      if (!gemKeyOf()) throw err('NEED_GEMINI');
      var tr = await translateQuery(q), items = [], seen = {}, firstErr = null;
      for (var i = 0; i < tr.titles.length; i++) {
        try {
          var r = await trySearch(tr.titles[i], type, 1, i === 0 ? tr.year : '');
          if (!r.items.length && i === 0 && tr.year) r = await trySearch(tr.titles[i], type, 1, '');
          r.items.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = 1; items.push(x); } });
        } catch (e) { if (e.code === 'INVALID_KEY' || e.code === 'LIMIT' || e.code === 'NETWORK' || e.code === 'NO_KEY') throw e; firstErr = firstErr || e; }
        if (items.length >= 8) break;
      }
      if (!items.length && firstErr && firstErr.code !== 'NOT_FOUND' && firstErr.code !== 'TOO_MANY') throw firstErr;
      return { items: items, total: items.length, translatedAs: tr.titles[0] };
    }
    // Рік наприкінці назви («Dark 2017») уточнює пошук; якщо з роком нічого немає, шукаємо як є («Blade Runner 2049»)
    var m = /^(.*\S)\s+((?:19|20)\d{2})$/.exec(q);
    if (m) { var r0 = await trySearch(m[1], type, page, m[2]); if (r0.total) return r0; }
    return trySearch(q, type, page, '');
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
    fresh.status = status === 'seen' ? 'seen' : status === 'watching' ? 'watching' : 'want'; delete S.gone[fresh.id]; fresh.addedAt = t; fresh.seenAt = fresh.status === 'seen' ? t : 0; fresh.updatedAt = t;
    S.items[fresh.id] = fresh; save(); return fresh;
  }
  function setStatus(fresh, status) {
    if (status !== 'want' && status !== 'seen' && status !== 'watching') return null;
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
  function removeItem(id) { var it = S.items[id]; if (!it) return null; delete S.items[id]; S.gone[id] = stamp(it.updatedAt); save(); return it; }
  function restoreItem(it) { var n = normalizeItem(it); if (n) { n.updatedAt = stamp(Math.max(n.updatedAt, S.gone[n.id] || 0)); delete S.gone[n.id]; S.items[n.id] = n; save(); } }
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
    var seen = list('seen'), want = list('want'), watching = list('watching'); var rated = seen.filter(function (it) { return it.myRating; });
    var minutes = 0;
    seen.forEach(function (it) { if (it.type === 'series') minutes += watchedCount(it) * (it.runtime || 0); else minutes += it.runtime || 0; });
    var g = genres('seen').slice(0, 3);
    return { want: want.length, watching: watching.length, seen: seen.length, avgMine: rated.length ? round1(rated.reduce(function (t, it) { return t + it.myRating; }, 0) / rated.length) : null, minutes: minutes, topGenres: g };
  }
  function fmtMinutes(m) {
    m = Math.round(m || 0); if (m < 60) return m + ' хв';
    var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return (d ? d + ' д ' : '') + h + ' год' + (!d && m % 60 ? ' ' + (m % 60) + ' хв' : '');
  }

  // ---------- Добірки ----------
  function colList() { return Object.keys(S.cols).filter(function (k) { return !S.cols[k].del; }).map(function (k) { return { id: k, name: S.cols[k].name, at: S.cols[k].at }; }).sort(function (a, b) { return a.at - b.at; }); }
  function addCol(name) { name = String(name || '').trim().slice(0, 40); if (!name) return null; var id = 'c' + FB.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); var t = FB.now(); S.cols[id] = { name: name, at: t, upd: t, del: false }; save(); return id; }
  function renameCol(id, name) { name = String(name || '').trim().slice(0, 40); var c = S.cols[id]; if (!c || !name) return; c.name = name; c.upd = stamp(c.upd); save(); }
  function removeCol(id) { var c = S.cols[id]; if (!c) return; c.del = true; c.upd = stamp(c.upd); Object.keys(S.items).forEach(function (k) { var it = S.items[k], i = it.cols.indexOf(id); if (i >= 0) { it.cols.splice(i, 1); it.updatedAt = stamp(it.updatedAt); } }); save(); }
  function toggleCol(itemId, colId) { var it = S.items[itemId]; if (!it || !S.cols[colId] || S.cols[colId].del) return; var i = it.cols.indexOf(colId); if (i >= 0) it.cols.splice(i, 1); else it.cols.push(colId); it.updatedAt = stamp(it.updatedAt); save(); }
  function colItems(colId) { return Object.keys(S.items).map(function (k) { return S.items[k]; }).filter(function (it) { return it.cols.indexOf(colId) >= 0; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }); }

  // ---------- Серіали: що далі ----------
  function epsIn(it, s) { return it.seasonEps[s] || (it.seasons[String(s)] ? it.seasons[String(s)].length : 0); }
  function nextForMe(it) {
    if (it.type !== 'series') return null;
    var best = null; Object.keys(it.watched).forEach(function (k) { var m = /^(\d+)x(\d+)$/.exec(k); if (!m) return; var s = +m[1], e = +m[2]; if (!best || s > best.s || (s === best.s && e > best.e)) best = { s: s, e: e }; });
    if (!best) return { s: 1, e: 1 };
    var n = epsIn(it, best.s);
    if (!n || best.e < n) return { s: best.s, e: best.e + 1 };
    var total = it.totalSeasons || Object.keys(it.seasonEps).length;
    if (best.s < total || it.seasonEps[best.s + 1]) return { s: best.s + 1, e: 1 };
    return null;
  }
  function epCode(x) { return 'S' + x.s + 'E' + x.e; }

  // ---------- Підсумок року ----------
  function yearStats(y) {
    var from = new Date(y, 0, 1).getTime(), to = new Date(y + 1, 0, 1).getTime();
    var seen = list('seen').filter(function (it) { return it.seenAt >= from && it.seenAt < to; });
    var minutes = 0; seen.forEach(function (it) { minutes += it.type === 'series' ? watchedCount(it) * (it.runtime || 0) : (it.runtime || 0); });
    var gm = {}; seen.forEach(function (it) { it.genre.forEach(function (g) { gm[g] = (gm[g] || 0) + 1; }); });
    var genres = Object.keys(gm).sort(function (a, b) { return gm[b] - gm[a] || a.localeCompare(b); }).slice(0, 3);
    var rated = seen.filter(function (it) { return it.myRating; }).sort(function (a, b) { return b.myRating - a.myRating || (b.ratings.imdb || 0) - (a.ratings.imdb || 0); });
    return { year: y, count: seen.length, movies: seen.filter(function (it) { return it.type !== 'series'; }).length, series: seen.filter(function (it) { return it.type === 'series'; }).length, minutes: minutes, genres: genres, top: rated.slice(0, 5), avg: rated.length ? round1(rated.reduce(function (t, it) { return t + it.myRating; }, 0) / rated.length) : null };
  }

  // ---------- Синхронізація через ваш Google Apps Script ----------
  function syncOf() { return { url: S.sync.url, code: S.sync.code, at: S.sync.at }; }
  function setSync(url, code) { var u = validSyncUrl(url); if (String(url || '').trim() && !u) return false; S.sync.url = u; S.sync.code = String(code || '').trim().slice(0, 100); save(); return true; }
  function payload() { return { app: 'kino', v: 2, exportedAt: FB.now(), items: S.items, cols: S.cols, gone: S.gone }; }
  // Злиття: виграє новіше; видалення пам’ятаються, щоб не воскресали
  function mergeIn(o) {
    var added = 0, updated = 0, removed = 0;
    var gone = cleanGone(o.gone); Object.keys(gone).forEach(function (k) { if (!(S.gone[k] >= gone[k])) S.gone[k] = gone[k]; });
    var cols = cleanCols(o.cols); Object.keys(cols).forEach(function (k) { var c = cols[k], ex = S.cols[k]; if (!ex || c.upd > ex.upd) S.cols[k] = c; });
    if (o.items && typeof o.items === 'object') Object.keys(o.items).slice(0, 5000).forEach(function (k) {
      var n = normalizeItem(o.items[k]); if (!n) return; var ex = S.items[n.id];
      if (S.gone[n.id] && S.gone[n.id] >= n.updatedAt) return;
      if (!ex) { S.items[n.id] = n; added++; } else if (n.updatedAt > ex.updatedAt) { S.items[n.id] = n; updated++; }
    });
    Object.keys(S.gone).forEach(function (k) { var ex = S.items[k]; if (ex && S.gone[k] >= ex.updatedAt) { delete S.items[k]; removed++; } });
    return { added: added, updated: updated, removed: removed };
  }
  async function syncCall(body) {
    var res; try { res = await FB.fetch(S.sync.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' }); } catch (e) { throw err('SYNC_NETWORK'); }
    if (!res.ok) { var e1 = err('SYNC_HTTP'); e1.status = res.status; throw e1; }
    var o; try { o = await res.json(); } catch (e2) { throw err('SYNC_BAD'); }
    if (!o || o.ok !== true) { var e3 = err(o && o.error === 'code' ? 'SYNC_CODE' : 'SYNC_BAD'); throw e3; }
    return o;
  }
  async function syncNow() {
    if (!S.sync.url || !S.sync.code) throw err('NEED_SYNC');
    var got = await syncCall({ action: 'get', code: S.sync.code });
    var r = { added: 0, updated: 0, removed: 0 };
    if (got.data && typeof got.data === 'object') { if (got.data.app !== 'kino') throw err('SYNC_BAD'); r = mergeIn(got.data); }
    await syncCall({ action: 'put', code: S.sync.code, data: payload() });
    S.sync.at = FB.now(); save(); return r;
  }
  function describeSyncError(e) {
    var c = e && e.code;
    if (c === 'NEED_SYNC') return 'Вставте адресу скрипта й секретне слово.';
    if (c === 'SYNC_NETWORK') return 'Немає зв’язку зі скриптом Google. Перевірте інтернет і чи скрипт розгорнуто для «Усі».';
    if (c === 'SYNC_CODE') return 'Секретне слово не збігається з тим, що в скрипті.';
    if (c === 'SYNC_HTTP') return 'Google повернув помилку (код ' + e.status + '). Перевірте, що скрипт розгорнуто як вебзастосунок.';
    if (c === 'SYNC_BAD') return 'Скрипт відповів не так, як очікувалось. Перевірте, що вставлено код саме для Kinoman.';
    if (c === 'ADVICE_EMPTY') return 'Спершу оцініть кілька фільмів, щоб порада була точною.';
    return null;
  }

  // ---------- Копія даних ----------
  function exportJSON() {
    S.meta.lastBackup = FB.now(); save(true);
    return JSON.stringify(payload(), null, 2);
  }
  function importJSON(text) {
    var o; try { o = JSON.parse(text); } catch (e) { return { error: 'Це не файл копії: не вдалося прочитати.' }; }
    if (!o || o.app !== 'kino' || !o.items || typeof o.items !== 'object') return { error: 'Це не файл копії Kinoman.' };
    var added = 0, updated = 0;
    Object.keys(o.items).slice(0, 5000).forEach(function (k) {
      var n = normalizeItem(o.items[k]); if (!n) return; var ex = S.items[n.id];
      if (!ex) { S.items[n.id] = n; delete S.gone[n.id]; added++; } else if (n.updatedAt > ex.updatedAt) { S.items[n.id] = n; updated++; }
    });
    var cols = cleanCols(o.cols); Object.keys(cols).forEach(function (k) { var c = cols[k], ex = S.cols[k]; if (!ex || c.upd > ex.upd) S.cols[k] = c; });
    save(); return { added: added, updated: updated };
  }

  Object.assign(FB, {
    VERSION: VERSION, init: init, on: on, save: save, isSaveFailed: function () { return saveFailed; },
    discover: discover, person: person, advise: advise, findTmdb: findTmdb, colList: colList, addCol: addCol, renameCol: renameCol, removeCol: removeCol, toggleCol: toggleCol, colItems: colItems, nextForMe: nextForMe, epCode: epCode, yearStats: yearStats, syncOf: syncOf, setSync: setSync, syncNow: syncNow, mergeIn: mergeIn,
    keyOf: keyOf, setKey: setKey, tmdbKeyOf: tmdbKeyOf, setTmdbKey: setTmdbKey, tmdbExtras: tmdbExtras, setExtras: setExtras, tmdbImdbId: tmdbImdbId, catalog: catalog, suggest: suggest, testTmdb: testTmdb, tmdbImg: tmdbImg, gemKeyOf: gemKeyOf, setGemKey: setGemKey, foreignGemKey: foreignGemKey, useForeignGemKey: useForeignGemKey, translateItem: translateItem, setTranslation: setTranslation, testGemini: testGemini, genreUk: genreUk, countryUk: countryUk, langUk: langUk, dateUk: dateUk, hasCyrillic: hasCyrillic, search: search, details: details, loadSeason: loadSeason, testKey: testKey, describeError: describeError, toItem: toItem,
    getItem: getItem, setStatus: setStatus, setMyRating: setMyRating, setNote: setNote, removeItem: removeItem, restoreItem: restoreItem, refresh: refresh,
    toggleEpisode: toggleEpisode, setSeasonWatched: setSeasonWatched, seasonProgress: seasonProgress, watchedCount: watchedCount,
    list: list, genres: genres, randomPick: randomPick, stats: stats, fmtMinutes: fmtMinutes, SORTS: SORTS, brief: brief,
    exportJSON: exportJSON, importJSON: importJSON, isId: isId, normalizeState: normalizeState, normalizeItem: normalizeItem, api: api, epKey: epKey
  });
  init();
})();
