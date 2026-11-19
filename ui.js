/* Kinoman: інтерфейс */
(function () {
  'use strict';
  var F = window.FB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app, tabsEl, sheetRoot, toastEl;
  var ui = {
    tab: 'home', homeView: 'cat', allNews: false, allSoon: false, homeMt: 'movie', homeGenre: '', dc: {}, advice: null, fl: { mt: 'movie', genre: '', decade: '', vote: '' }, syncMsg: null, colMsg: null, duo: { a: [], b: [], max: 0, type: '' }, mood: 0, hideSeen: false, lastTab: '', cat: { sh: {}, shown: { movie: 5, tv: 5, toon: 5 }, forKey: null, token: 0 },
    q: '', type: '', results: [], total: 0, page: 0, loading: false, searched: false, error: null, token: 0,
    lists: { want: { sort: 'added', type: '', genre: '' }, watching: { sort: 'added', type: '', genre: '' }, seen: { sort: 'seen', type: '', genre: '' } },
    busy: {}, stack: [], sheet: null, enter: false, tmdbMsg: null, keyMsg: null, backupMsg: null
  };
  var detCache = {};
  var TABS = [['home', 'Головна', 'home'], ['search', 'Пошук', 'search'], ['want', 'Обрані', 'heart'], ['watching', 'Дивлюсь', 'play'], ['seen', 'Переглянуто', 'eye'], ['more', 'Ще', 'more']];
  var NAMES = { want: 'Обрані', watching: 'Дивлюсь', seen: 'Переглянуто' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n, c) { return '<svg class="ic ' + (c || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function hue(id) { return ((parseInt(String(id).replace(/\D/g, ''), 10) || 0) * 137) % 360; }
  function typeLabel(t) { return t === 'series' ? 'Серіал' : 'Фільм'; }
  function plural(n, a, b, c) { var m = n % 100, d = n % 10; return (m > 10 && m < 20) ? c : d === 1 ? a : (d >= 2 && d <= 4) ? b : c; }

  // ---------- Сповіщення ----------
  var toastTimer;
  function toast(msg, label, fn) {
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (label ? '<button type="button" data-act="toast-act">' + esc(label) + '</button>' : '');
    toastEl.classList.add('show'); toastEl._fn = fn || null;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, label ? 6000 : 2600);
  }

  // ---------- Малі блоки ----------
  function posterHtml(url, title) {
    return '<span class="poster"><span class="ph">' + esc(title) + '</span>' + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</span>';
  }
  // Скелетони: сірі силуети на місці того, що ще вантажиться
  function skLines(n, cls) { var a = ''; for (var i = 0; i < n; i++) a += '<i></i>'; return '<div class="skl' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + a + '</div>'; }
  function skPeople(n) { var a = ''; for (var i = 0; i < n; i++) a += '<div class="person sk" aria-hidden="true"><span class="pic"></span><i></i><i></i></div>'; return a; }
  function skRows(n) { var a = ''; for (var i = 0; i < n; i++) a += '<div class="row sk" aria-hidden="true"><span class="poster"></span>' + skLines(2) + '</div>'; return a; }
  function skEps(n) { var a = ''; for (var i = 0; i < n; i++) a += '<div class="ep sk" aria-hidden="true"><span class="box"></span>' + skLines(2) + '</div>'; return a; }
  function skWait(label, n) { return '<div class="review skr" role="status" aria-label="' + esc(label) + '">' + skLines(n || 3) + '</div>'; }
  function sheetSk() { return '<div role="status" aria-label="Завантаження"><div class="scores" aria-hidden="true"><div class="score skb"></div><div class="score skb"></div><div class="score skb"></div></div>' + skLines(1, 'btnl') + '<div class="skb skbox" aria-hidden="true"></div>' + skLines(4) + '<div class="strip" style="margin-top:22px">' + skPeople(5) + '</div></div>'; }
  // Вікова позначка: «6+», «12+»… за рейтингом із OMDb
  var AGE_TXT = { 0: 'для будь-якого віку', 6: 'дітям від 6 років', 12: 'від 12 років', 14: 'від 14 років', 16: 'від 16 років', 18: 'лише дорослим' };
  function ageBadge(it, cls) { var a = F.ageOf(it); return a == null ? '' : '<span class="age a' + a + (cls ? ' ' + cls : '') + '" title="Вікова позначка: ' + esc(AGE_TXT[a]) + ' (рейтинг ' + esc(it.rated) + ')">' + a + '+</span>'; }
  function emptyHtml(icon, title, text, btn) {
    return '<div class="empty"><div class="ill">' + ic(icon) + '</div><b>' + esc(title) + '</b><div>' + esc(text) + '</div>' + (btn || '') + '</div>';
  }
  function noKeyHtml() {
    return '<div class="notice">' + ic('alert') + '<div><b>Потрібен ключ OMDb</b><div class="sub">Це безкоштовно: ключ приходить на пошту. Вставте його в розділі «Ще».</div><p style="margin:10px 0 0"><button class="btn sm" data-act="tab" data-tab="more">Додати ключ</button></p></div></div>';
  }

  // ---------- Пошук ----------
  function rowHtml(r) {
    var lib = F.getItem(r.id), busy = ui.busy[r.id];
    var acts;
    if (lib) acts = '<button class="chip on" data-act="open" data-id="' + r.id + '">' + ic('check', 'sm') + (lib.status === 'seen' ? 'Бачив' : lib.status === 'watching' ? 'Дивлюсь' : 'В обраному') + '</button>';
    else acts = [['want', 'plus', 'В обране'], ['watching', 'play', 'Дивлюсь'], ['seen', 'eye', 'Бачив']].map(function (c) { return '<button class="chip" data-act="quick" data-st="' + c[0] + '" data-id="' + r.id + '"' + (busy ? ' disabled' : '') + '>' + ic(c[1], 'sm') + c[2] + '</button>'; }).join('');
    return '<div class="row glow" style="--h:' + hue(r.id) + '"><button class="open" data-act="open" data-id="' + r.id + '">' + posterHtml(r.poster, r.title) + '<span class="txt"><span class="t">' + esc(r.title) + '</span><span class="m">' + esc(typeLabel(r.type)) + (r.year ? ', ' + esc(r.year) : '') + '</span></span></button><div class="acts">' + acts + '</div></div>';
  }
  function HD(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { r[k] = o[k]; }); if (F.hideGrpOn()) r.hide = true; return r; }
  function featureHtml() {
    if (ui.loading || ui.results.length || ui.searched || ui.q.trim()) return '';
    var want = F.list('want', HD()); if (!want.length) return '';
    var it = ui.heroId && F.getItem(ui.heroId) && F.getItem(ui.heroId).status === 'want' ? F.getItem(ui.heroId) : null;
    if (!it) { it = F.randomPick('want', HD()); ui.heroId = it.id; }
    var r = it.ratings, pills = '';
    if (r.imdb != null) pills += '<span class="pill">IMDb ' + r.imdb.toFixed(1) + '</span>';
    if (r.rt != null) pills += '<span class="pill rt' + (r.rt >= 60 ? ' good' : '') + '">' + r.rt + '%</span>';
    if (r.meta != null) pills += '<span class="pill mt">MC ' + r.meta + '</span>';
    return '<section class="feature glow" style="--h:' + hue(it.id) + '" aria-label="Що подивитись"><div class="bg" style="' + (it.poster ? 'background-image:url(\'' + esc(it.poster) + '\')' : '') + '"></div><div class="beam"></div><div class="in">' + posterHtml(it.poster, it.title) +
      '<div class="lbl">Що подивитись сьогодні</div><h3>' + esc(it.titleUk || it.title) + '</h3><div class="meta">' + esc(typeLabel(it.type)) + (it.year ? ', ' + esc(it.year) : '') + (it.runtime ? ', ' + esc(F.fmtMinutes(it.runtime)) : '') + '</div>' + (pills ? '<div class="rates">' + pills + '</div>' : '') +
      '<div class="acts"><button class="btn" data-act="open" data-id="' + it.id + '">Відкрити</button>' + (want.length > 1 ? '<button class="btn ghost" data-act="rehero" aria-label="Інший фільм">' + ic('shuffle', 'sm') + 'Інший</button>' : '') + '</div></div></section>';
  }
  function tileHtml(it, i) {
    var r = it.ratings, b = '';
    if (it.myRating) b = '<span class="badge"><span class="me">' + it.myRating + '</span></span>';
    else if (r.imdb != null) b = '<span class="badge"><span>' + r.imdb.toFixed(1) + '</span></span>';
    return '<button class="tile glow" style="--h:' + hue(it.id) + ';--i:' + i + '" data-act="open" data-id="' + it.id + '"><span class="poster"><span class="ph">' + esc(it.titleUk || it.title) + '</span>' + (it.poster ? '<img src="' + esc(it.poster) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + b + '</span><span class="name">' + esc(it.titleUk || it.title) + '</span></button>';
  }
  function shelfHtml(title, items, tab) {
    if (!items.length) return '';
    return '<section class="shelf"><div class="shelf-h"><h2>' + esc(title) + '</h2><button class="more-link" data-act="tab" data-tab="' + tab + '">Усі ' + F.list(tab).length + '</button></div><div class="strip">' + items.map(tileHtml).join('') + '</div></section>';
  }
  var ST_IC = { want: ['heart', 'В обраних'], watching: ['play', 'Дивлюсь'], seen: ['eye', 'Переглянуто'] };
  var catInfo = {};
  function catTile(r) {
    if (F.isNope(r.mt, r.tid) && !F.tmdbStatus(r.mt, r.tid)) return '';
    catInfo[r.mt + ':' + r.tid] = r;
    var st = F.tmdbStatus(r.mt, r.tid), data = ' data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '"' + (r.back ? ' data-back="' + esc(r.back) + '"' : '');
    var btn = '<button class="tile glow" style="--h:' + hue(r.tid) + '" data-act="cat"' + data + '><span class="poster"><span class="ph">' + esc(r.title) + '</span><img src="' + esc(F.tmdbImg(r.poster, 'w342')) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' + (function () { var im = F.imdbFor(r.mt, r.tid); return im != null ? '<span class="badge"><span class="imdb" title="IMDb">IMDb ' + im.toFixed(1) + '</span></span>' : r.vote ? '<span class="badge"><span class="tm" title="Оцінка TMDB">TMDB ' + r.vote.toFixed(1) + '</span></span>' : ''; })() + (r.rank ? '<span class="rk" aria-label="Місце ' + r.rank + '">' + r.rank + '</span>' : '') + '</span><span class="name">' + esc(r.title) + '</span><span class="yr">' + esc(r.year) + '</span></button>';
    var mark = st && ST_IC[st] ? (st === 'want' ? '<button class="qin st-want" data-act="catun"' + data + ' aria-label="Прибрати з обраних: ' + esc(r.title) + '">' + ic('heart', 'sm') + '</button>' : '<span class="qin st-' + st + '" role="img" aria-label="' + ST_IC[st][1] + '">' + ic(ST_IC[st][0], 'sm') + '</span>') : '<button class="qadd" data-act="catadd"' + data + ' aria-label="В обране: ' + esc(r.title) + '">' + ic('plus', 'sm') + '</button>';
    var nope = st ? '' : '<button class="qnope" data-act="catnope"' + data + ' aria-label="Не цікавить: ' + esc(r.title) + '">' + ic('eyeoff', 'sm') + '</button>';
    return '<div class="tw">' + btn + mark + nope + '</div>';
  }
  // «Сховати переглянуте» у каталозі
  function vis(items) { return ui.hideSeen ? items.filter(function (r) { return F.tmdbStatus(r.mt, r.tid) !== 'seen'; }) : items; }
  function catShelf(title, items) {
    if (!items || !items.length) return '';
    return '<section class="shelf"><div class="shelf-h"><h2>' + esc(title) + '</h2></div><div class="strip">' + items.map(catTile).join('') + '</div></section>';
  }
  var GENRES = [['35', 'Комедії'], ['28', 'Бойовики'], ['18', 'Драми'], ['27', 'Жахи'], ['878', 'Фантастика'], ['53', 'Трилери'], ['16', 'Мультфільми'], ['anime', 'Аніме'], ['80', 'Кримінал'], ['10749', 'Романтика'], ['12', 'Пригоди'], ['10751', 'Сімейні'], ['9648', 'Детективи'], ['99', 'Документальні']];
  var DECADES = [['', 'Будь-які роки'], ['2020', '2020-ті'], ['2010', '2010-ті'], ['2000', '2000-ні'], ['1990', '90-ті'], ['1980', '80-ті'], ['1', 'Старіші']];
  var VOTES = [['', 'Будь-який рейтинг'], ['6', 'Від 6'], ['7', 'Від 7'], ['8', 'Від 8']];
  // Спільний завантажувач добірок TMDB: стан за ключем, повтор після помилки
  function disc(key, fn) {
    var d = ui.dc[key];
    if (!d) { d = ui.dc[key] = { key: key, fn: fn, page: 1, loading: true, items: null, more: false, error: null, busy: false }; fn(1).then(function (r) { d.items = r.items; d.more = r.more; }, function (e) { d.error = e; }).then(function () {
      d.loading = false; paintDisc(d, true);
    }); }
    return d;
  }
  // оновлюємо лише блок результатів, щоб не збити набір у полі пошуку
  function paintDisc(d, fallback) {
    var box = app && app.querySelector('[data-disc="' + d.key + '"]'); if (box) box.innerHTML = discInner(d); else if (fallback && (ui.tab === 'home' || ui.tab === 'search')) render();
  }
  async function discMore(key) {
    var d = ui.dc[key]; if (!d || d.busy || !d.more) return; d.busy = true; paintDisc(d);
    try { var r = await d.fn(d.page + 1); d.page++; var seen = {}; d.items.forEach(function (x) { seen[x.mt + x.tid] = 1; }); r.items.forEach(function (x) { if (!seen[x.mt + x.tid]) d.items.push(x); }); d.more = r.more; }
    catch (e) { toast(F.describeError(e)); }
    d.busy = false; paintDisc(d);
  }
  function discOpts(mt, genre, decade, vote) { return { genre: genre === 'anime' ? 0 : Number(genre) || 0, anime: genre === 'anime', decade: Number(decade) || 0, minVote: Number(vote) || 0 }; }
  function discGrid(d) { return '<div data-disc="' + esc(d.key) + '">' + discInner(d) + '</div>'; }
  function discInner(d) {
    if (d.loading) return '<div class="tgrid" role="status" aria-label="Завантажуємо">' + skTiles(12) + '</div>';
    if (d.error) return '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(d.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="redisc">Спробувати ще раз</button></p></div></div>';
    var shown = vis(d.items);
    if (!shown.length && !d.more) return emptyHtml('film', 'Нічого не знайшли', d.items.length ? 'Усе знайдене вже переглянуте. Вимкніть «Сховати переглянуте».' : 'Спробуйте м’якші фільтри.');
    return '<div class="tgrid">' + shown.map(catTile).join('') + (d.busy ? skTiles(6) : '') + '</div>' + (d.busy ? '' : d.more ? '<p class="morewrap"><button class="btn ghost sm" data-act="discmore" data-key="' + esc(d.key) + '">Показати ще</button></p>' : '');
  }
  var MOODS = [['Будь-що', ''], ['Легке', 'щось легке й веселе'], ['До 90 хв', 'короткий фільм тривалістю до 90 хвилин'], ['Щоб подумати', 'розумне, непросте кіно, над яким цікаво думати'], ['Напружене', 'щось напружене: трилер чи детектив'], ['Удвох', 'для романтичного вечора удвох'], ['Сімейне', 'для сімейного перегляду, без жорсткого контенту']];
  function adviceHtml() {
    if (!F.gemKeyOf()) return '';
    var a = ui.advice;
    var h = '<section class="advice"><div class="adv-h"><div><h2>Порада від Gemini</h2><p class="sub">На основі ваших оцінок</p></div><button class="btn sm" data-act="advise"' + (a && a.loading ? ' disabled' : '') + '>' + ic('sparkle', 'sm') + (a && a.items ? 'Ще порада' : 'Порадь') + '</button></div>';
    h += '<div class="chips moods" role="group" aria-label="Настрій">' + MOODS.map(function (m, i) { return '<button class="chip' + (ui.mood === i ? ' on' : '') + '" data-act="mood" data-i="' + i + '" aria-pressed="' + (ui.mood === i) + '">' + m[0] + '</button>'; }).join('') + '</div>';
    if (a && a.loading) h += skWait('Gemini думає', 3);
    else if (a && a.error) h += '<p class="er-t" role="status">' + esc(F.describeError(a.error)) + '</p>';
    else if (a && a.items) h += '<div class="adv-list">' + a.items.map(function (x, i) { return '<button class="adv" data-act="adv-open" data-i="' + i + '"><b>' + esc(x.title || x.orig) + '</b><span class="m">' + esc([x.mt === 'tv' ? 'Серіал' : 'Фільм', x.year, x.orig && x.orig !== x.title ? x.orig : ''].filter(Boolean).join(', ')) + '</span><span class="w">' + esc(x.why) + '</span></button>'; }).join('') + '</div>';
    return h + '</section>';
  }
  function ago(d) { return d <= 0 ? 'сьогодні' : d === 1 ? 'вчора' : d + ' ' + plural(d, 'день', 'дні', 'днів') + ' тому'; }
  function newsHtml() {
    var n0 = F.newSeasons().concat(F.newEpisodes()); if (!n0.length) return '';
    var n = ui.allNews ? n0 : n0.slice(0, 3);
    return '<section class="news"><div class="sec-h"><h2>Вийшло нове</h2>' + (n0.length > 3 ? '<button class="more-link" data-act="showall" data-k="allNews">' + (ui.allNews ? 'Згорнути' : 'Усі ' + n0.length) + '</button>' : '') + '</div>' + n.map(function (x) {
      if (!x.ep) return seasonRow(x);
      return '<div class="newrow glow" style="--h:' + hue(x.item.id) + '"><button class="nopen" data-act="open" data-id="' + x.item.id + '"><span class="poster"><span class="ph">' + esc(x.item.title) + '</span>' + (x.item.poster ? '<img src="' + esc(x.item.poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><span class="nt"><b>' + esc(x.item.titleUk || x.item.title) + '</b><span>Серія S' + x.ep.s + 'E' + x.ep.e + (x.ep.name ? ', ' + esc(x.ep.name) : '') + '</span><span class="when">' + ago(x.days) + '</span></span></button>' +
        '<button class="chip" data-act="markep" data-id="' + x.item.id + '" data-s="' + x.ep.s + '" data-e="' + x.ep.e + '" aria-label="Уже переглянув серію">' + ic('check', 'sm') + 'Бачив</button></div>';
    }).join('') + '</section>';
  }
  function seasonRow(x) {
    return '<div class="newrow glow nseason" style="--h:' + hue(x.item.id) + '"><button class="nopen" data-act="open" data-id="' + x.item.id + '"><span class="poster"><span class="ph">' + esc(x.item.title) + '</span>' + (x.item.poster ? '<img src="' + esc(x.item.poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><span class="nt"><b>' + esc(x.item.titleUk || x.item.title) + '</b><span>Новий сезон ' + x.s + '</span><span class="when">' + ago(Math.max(0, x.days)) + '</span></span></button>' +
      '<span class="nacts"><button class="chip on" data-act="resume" data-id="' + x.item.id + '">' + ic('play', 'sm') + 'Дивлюсь</button><button class="chip ghost-x" data-act="skipseason" data-id="' + x.item.id + '" aria-label="Не цікаво, сховати">' + ic('x', 'sm') + '</button></span></div>';
  }
  function catData(r) { return ' data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '"'; }
  function soonAll() { return F.upcoming().concat(F.folUpcoming()).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); }
  function soonHtml() {
    var u0 = soonAll(); if (!u0.length) return '';
    var u = ui.allSoon ? u0 : u0.slice(0, 3);
    return '<section class="soon"><div class="sec-h"><h2>Скоро</h2>' + (u0.length > 3 ? '<button class="more-link" data-act="showall" data-k="allSoon">' + (ui.allSoon ? 'Згорнути' : 'Усі ' + u0.length) + '</button>' : '') + '</div><div class="soonlist">' + u.map(function (x) {
      var p = x.date.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])), far = d.getFullYear() !== new Date(FB.now()).getFullYear();
      var sd = '<span class="sd"><b>' + d.getDate() + '</b><span>' + ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'][d.getMonth()] + (far ? ' ' + String(d.getFullYear()).slice(2) : '') + '</span></span>';
      if (x.fol) return '<button class="soonrow k-fol" data-act="cat"' + catData(x.r) + '>' + sd + '<span class="st"><b>' + esc(x.r.title) + '</b><span>' + esc(x.label) + '</span></span></button>';
      return '<button class="soonrow" data-act="open" data-id="' + x.item.id + '">' + sd + '<span class="st"><b>' + esc(x.item.titleUk || x.item.title) + '</b><span>' + esc(x.label) + '</span></span></button>';
    }).join('') + '</div></section>';
  }
  // «Стежу»: актори й режисери, чиї нові фільми потрапляють у «Скоро»
  function folShelf() {
    var a = F.followed(); if (!a.length) return '';
    return '<section class="shelf fol"><div class="shelf-h"><h2>Стежу</h2><span class="sub">' + a.length + '</span></div><div class="strip">' + a.map(function (p) {
      return '<button class="person" data-act="person" data-pid="' + p.id + '" data-name="' + esc(p.name) + '" data-photo="' + esc(p.photo) + '"><span class="pic"><span class="ph">' + esc(initials(p.name)) + '</span>' + (p.photo ? '<img src="' + esc(F.tmdbImg(p.photo, 'w185')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><b>' + esc(p.name) + '</b>' + (p.dept === 'dir' ? '<span>Режисер</span>' : '') + '</button>';
    }).join('') + '</div></section>';
  }
  function calEntry() { return '<button class="marentry" data-act="cal">' + ic('clock', 'sm') + '<span><b>Календар прем’єр</b><span>Нові серії та фільми з ваших списків на два місяці вперед</span></span>' + ic('right', 'sm') + '</button>'; }
  // ---------- Календар прем’єр ----------
  var MON_S = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'], MON_G = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var WD_S = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'], WD_L = ['понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота', 'неділя'], CAL_DAYS = 62;
  function isoAdd(iso, n) { var d = new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function isoDow(iso) { return (new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay() + 6) % 7; }
  function calEntries() {
    var out = F.calendar(CAL_DAYS), seen = {}, lim = isoAdd(F.today(), CAL_DAYS);
    F.folUpcoming().forEach(function (x) { if (x.date <= lim) out.push({ fol: true, r: x.r, item: { id: 'f' + x.r.mt + x.r.tid, title: x.r.title, titleUk: '', poster: F.tmdbImg(x.r.poster, 'w185') }, date: x.date, label: x.label, kind: 'fol' }); });
    out.forEach(function (x) { seen[x.item.id + '|' + x.date + '|' + x.label] = 1; });
    Object.keys(ui.calX || {}).forEach(function (id) { var it = F.getItem(id); if (!it) return; ui.calX[id].forEach(function (e) { var lb = 'S' + e.s + 'E' + e.e, k = id + '|' + e.date + '|' + lb; if (!seen[k]) { seen[k] = 1; out.push({ item: it, date: e.date, label: lb, kind: 'ep' }); } }); });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  // Для серіалів довантажуємо дати решти серій сезону, а не лише найближчої
  function calLoadMore() {
    var today = F.today(), lim = isoAdd(today, CAL_DAYS); ui.calX = ui.calX || {}; ui.calAsk = ui.calAsk || {};
    F.calendar(CAL_DAYS).forEach(function (x) {
      if (x.kind !== 'ep' || !x.s || ui.calAsk[x.item.id]) return; ui.calAsk[x.item.id] = 1;
      F.seasonDates(x.item, x.s).then(function (eps) {
        var add = eps.filter(function (e) { return e.date >= today && e.date <= lim && e.e !== x.e; }).map(function (e) { return { date: e.date, s: x.s, e: e.e }; });
        if (add.length) { ui.calX[x.item.id] = add; if (ui.sheet && ui.sheet.cal) renderSheet(); }
      }, function () { delete ui.calAsk[x.item.id]; });
    });
  }
  function calAct(x) { return x.fol ? ' data-act="cat"' + catData(x.r) : ' data-act="open" data-id="' + x.item.id + '"'; }
  function calHtml() {
    var es = calEntries(), today = F.today();
    var h = '<div class="sheetbar"><button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div><div class="coll cal"><h3>Календар прем’єр</h3><p class="sub">Нові серії, прем’єри фільмів і заплановані перегляди з ваших списків на два місяці вперед, а також нові фільми людей, за якими ви стежите.</p>';
    if (!es.length) return h + emptyHtml('clock', 'Найближчим часом нічого не виходить', 'Додайте серіали в «Дивлюсь» або ще не випущені фільми в «Обрані», і їхні дати з’являться тут.') + '</div>';
    var by = {}; es.forEach(function (x) { (by[x.date] = by[x.date] || []).push(x); });
    var pic = function (it) { return '<span class="cal-p">' + (it.poster ? '<img src="' + esc(it.poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>'; };
    var start = isoAdd(today, -isoDow(today)), end = isoAdd(start, 34);
    h += '<div class="cal-grid"><div class="cal-wd">' + WD_S.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div><div class="cal-cells">';
    for (var i = 0; i < 35; i++) {
      var d = isoAdd(start, i), p = d.split('-'), dn = Number(p[2]);
      h += '<div class="cal-c' + (d < today ? ' past' : d === today ? ' today' : '') + '"><span class="cal-d">' + dn + (dn === 1 || i === 0 ? ' ' + MON_S[Number(p[1]) - 1] : '') + '</span>' + (by[d] || []).map(function (x) { return '<button class="cal-e k-' + x.kind + '"' + calAct(x) + '>' + pic(x.item) + '<span class="st"><b>' + esc(x.item.titleUk || x.item.title) + '</b><span>' + esc(x.label) + '</span></span></button>'; }).join('') + '</div>';
    }
    h += '</div></div>';
    var days = Object.keys(by).sort(), later = days.filter(function (d) { return d > end; }).length;
    h += '<div class="cal-list">' + days.map(function (d, i) {
      var p = d.split('-'), isLater = d > end, head = isLater && (i === 0 || days[i - 1] <= end) ? '<h2 class="cal-lh">Пізніше</h2>' : '';
      return head + '<div class="cal-day' + (isLater ? ' later' : '') + '"><p class="cal-dh"><b>' + Number(p[2]) + ' ' + MON_G[Number(p[1]) - 1] + '</b><span>' + WD_L[isoDow(d)] + (d === today ? ', сьогодні' : '') + '</span></p>' + by[d].map(function (x) { return '<button class="soonrow k-' + x.kind + '"' + calAct(x) + '>' + pic(x.item) + '<span class="st"><b>' + esc(x.item.titleUk || x.item.title) + '</b><span>' + esc(x.label) + '</span></span></button>'; }).join('') + '</div>';
    }).join('') + '</div>';
    return h + (later ? '' : '') + '</div>';
  }
  function plainShelf(title, items) {
    if (!items.length) return '';
    return '<section class="shelf"><div class="shelf-h"><h2>' + esc(title) + '</h2><span class="sub">' + items.length + '</span></div><div class="strip">' + items.slice(0, 20).map(tileHtml).join('') + '</div></section>';
  }
  // ---------- Добірки каталогу ----------
  function shelfState(def) { return ui.cat.sh[def.id]; }
  // Прибрані з головної добірки каталогу (зберігаються на цьому пристрої)
  var hidMem = null;
  function hidShelves() { if (!hidMem) { try { hidMem = JSON.parse(localStorage.getItem('kinoman_hidsh') || '{}') || {}; } catch (e) { hidMem = {}; } } return hidMem; }
  function hidSave() { try { localStorage.setItem('kinoman_hidsh', JSON.stringify(hidMem || {})); } catch (e) { /* без збереження */ } }
  function hideShelf(id, title) { hidShelves()[id] = title || 1; hidSave(); }
  function showShelf(id) { delete hidShelves()[id]; hidSave(); }
  function shelfDel(id, title) { return '<button class="shelf-x" data-act="hidesh" data-id="' + esc(id) + '" data-title="' + esc(title) + '" aria-label="Видалити добірку: ' + esc(title) + '" title="Видалити добірку">' + ic('trash', 'sm') + '</button>'; }
  // Силуети постерів, поки дані вантажаться
  function skTiles(n) { var a = []; for (var i = 0; i < n; i++) a.push('<div class="tw sk" aria-hidden="true"><span class="poster"></span><i></i><i></i></div>'); return a.join(''); }
  // Готові кіносаги: широкі картки, натискання відкриває всі частини по порядку
  function sagaShelf(toon) {
    if (!F.tmdbKeyOf() || hidShelves()[toon ? 'sagas-toon' : 'sagas']) return '';
    var all = F.sagaList(toon), ready = all.filter(function (x) { return x.cid; });
    F.sagasResolve().then(function (ch) { if (ch) paintSagas(); }, function () {});
    if (!all.length) return '';
    var cards = ready.length ? ready.map(function (x) {
      var m = F.marathonOf('ms' + x.cid), img = x.back ? F.tmdbImg(x.back, 'w780') : x.poster ? F.tmdbImg(x.poster, 'w342') : '';
      return '<button class="cw saga glow" style="--h:' + hue(x.cid) + '" data-act="saga" data-q="' + esc(x.q) + '" data-cid="' + x.cid + '"><span class="cw-img"' + (img ? ' style="background-image:url(\'' + esc(img) + '\')"' : '') + '>' + (m && m.total ? '<span class="cw-bar"><i style="width:' + Math.round(m.done / m.total * 100) + '%"></i></span>' : '') + '</span><span class="cw-t">' + esc(x.name) + '</span><span class="cw-m">' + (m && m.total ? 'Переглянуто ' + m.done + ' з ' + m.total : 'Усі частини по порядку') + '</span></button>';
    }).join('') : [0, 1, 2, 3, 4].map(function () { return '<div class="cw sk" aria-hidden="true"><span class="cw-img"></span><i></i><i></i></div>'; }).join('');
    return '<section class="shelf sagas" data-sagas="' + (toon ? 1 : 0) + '"><div class="shelf-h"><h2>' + (toon ? 'Мультсаги' : 'Кіносаги') + '</h2><span class="shelf-acts"><button class="more-link" data-act="marfind">Знайти іншу</button>' + shelfDel(toon ? 'sagas-toon' : 'sagas', toon ? 'Мультсаги' : 'Кіносаги') + '</span></div><div class="strip">' + cards + '</div></section>';
  }
  // Перемальовує рядок саг, коли довантажились нові, і зберігає, куди його прогорнули
  function paintSagas() {
    var box = app && app.querySelector('[data-sagas]'); if (!box || ui.tab !== 'home') return;
    var st = box.querySelector('.strip'), x = st ? st.scrollLeft : 0, h = sagaShelf(box.getAttribute('data-sagas') === '1');
    if (!h) { box.remove(); return; }
    var tmp = document.createElement('div'); tmp.innerHTML = h; var nb = tmp.firstElementChild; box.replaceWith(nb);
    var ns = nb.querySelector('.strip'); if (ns && x) ns.scrollLeft = x;
  }
  function shelvesHtml(defs) {
    var a = defs.map(shelfSection), all = mix();
    if (all || ui.homeMt !== 'tv') a.splice(Math.min(2, a.length), 0, sagaShelf(!all && ui.homeMt === 'toon'));
    return a.join('');
  }
  function shelfSection(def) {
    var st = shelfState(def); if (!st) return '';
    var top = !!def.top, items = st.items ? vis(st.items) : [], total = items.length; if (def.limit) items = items.slice(0, top ? 10 : 15);
    var h = '<section class="shelf' + (top ? ' top10' : '') + '" data-shelf="' + esc(def.id) + '"><div class="shelf-h"><h2>' + esc(shTitle(def)) + '</h2><span class="shelf-acts">' + (total ? '<button class="more-link" data-act="coll" data-id="' + esc(def.id) + '">Усі</button>' : '') + shelfDel(def.id, shTitle(def)) + '</span></div>';
    if (st.loading) return h + '<div class="strip" role="status" aria-label="Завантажуємо">' + skTiles(8) + '</div></section>';
    if (st.error) return h + '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(st.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="reshelf" data-id="' + esc(def.id) + '">Спробувати ще раз</button></p></div></div></section>';
    if (!total) return '';
    return h + '<div class="strip">' + items.map(catTile).join('') + '</div></section>';
  }
  function paintShelf(def) {
    var box = app && app.querySelector('[data-shelf="' + def.id + '"]'); if (!box) return;
    var html = shelfSection(def); if (html) box.outerHTML = html; else box.remove();
    var d0 = homeDefs()[0]; if (d0 && d0.id === def.id) paintHero();
  }
  // ---------- ПК: великий банер на головній ----------
  var backTried = {};
  // Широкий кадр для тайтла зі списків: один легкий запит до TMDB, далі з кешу
  function needBack(it, done) {
    if (!it || !isDesktop() || !F.tmdbKeyOf() || F.backKnown(it.id) || backTried[it.id]) return;
    backTried[it.id] = true;
    F.fetchBack(it).then(function (p) { if (p) done(); }, function () { /* без кадру теж добре */ });
  }
  function heroData(r) { return ' data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '" data-back="' + esc(r.back) + '"'; }
  function heroCat() {
    var def = homeDefs()[0], st = def && shelfState(def);
    var picks = st && st.items ? vis(st.items).filter(function (r) { return r.back && !(F.isNope(r.mt, r.tid) && !F.tmdbStatus(r.mt, r.tid)); }).slice(0, 5) : [];
    if (!picks.length) return st && !st.loading ? '' : '<section class="bb wait" data-hero aria-hidden="true"></section>';
    if (ui.heroKey !== def.id) { ui.heroKey = def.id; ui.heroIx = 0; }
    var ix = Math.min(ui.heroIx || 0, picks.length - 1), r = picks[ix], s = F.tmdbStatus(r.mt, r.tid), im = F.imdbFor(r.mt, r.tid), d = heroData(r);
    var pill = im != null ? '<span class="pill">IMDb ' + im.toFixed(1) + '</span>' : r.vote ? '<span class="pill mt">TMDB ' + r.vote.toFixed(1) + '</span>' : '';
    var meta = [r.mt === 'tv' ? 'Серіал' : ui.homeMt === 'toon' && !mix() ? 'Мультфільм' : 'Фільм', r.year].filter(Boolean).join(', ');
    var add = s && ST_IC[s] ? '<span class="bb-st">' + ic(ST_IC[s][0], 'sm') + ST_IC[s][1] + '</span>' : '<button class="btn ghost" data-act="catadd"' + d + '>' + ic('plus', 'sm') + 'В обране</button>';
    ui.heroN = picks.length;
    var th = picks.length > 1 ? '<ol class="bb-q" aria-label="' + esc(def.title) + '">' + picks.map(function (x, i) { return '<li><button type="button" data-act="heropick" data-i="' + i + '" aria-pressed="' + (i === ix) + '"><b>' + (i + 1) + '</b><span>' + esc(x.title) + '</span>' + (i === ix ? '<i class="bb-pr"></i>' : '') + '</button></li>'; }).join('') + '</ol>' : '';
    setAmb(F.tmdbImg(r.poster, 'w92'), r.tid, true);
    var hk = def.id + ':' + r.tid, still = ui.heroLast === hk; ui.heroLast = hk;
    return '<section class="bb' + (still ? ' still' : '') + '" data-hero aria-label="' + esc(def.title) + '"><div class="bb-img" style="background-image:url(\'' + esc(isDesktop() ? F.tmdbImg(r.back, 'w1280') : F.tmdbImg(r.poster || r.back, 'w780')) + '\')"></div><div class="bb-in"><p class="bb-l">' + esc(def.title) + '</p><h2 class="bb-t">' + esc(r.title) + '</h2><p class="bb-m">' + pill + '<span>' + esc(meta) + '</span></p>' + (r.plot ? '<p class="bb-p">' + esc(r.plot) + '</p>' : '') +
      '<div class="bb-a"><button class="btn" data-act="cat"' + d + '>Детальніше</button>' + add + '</div></div>' + th + '</section>';
  }
  function heroMine() {
    var it = F.list('watching')[0]; if (!it) return '';
    var back = F.backOf(it.id), nx = F.nextForMe(it), r = it.ratings;
    needBack(it, paintHero); ui.heroN = 0; setAmb(it.poster, it.id, true);
    var pill = r.imdb != null ? '<span class="pill">IMDb ' + r.imdb.toFixed(1) + '</span>' : '';
    var meta = [typeLabel(it.type), it.year, it.runtime ? F.fmtMinutes(it.runtime) : ''].filter(Boolean).join(', ');
    var plot = it.plotUk || it.plot || '';
    var img = back ? '<div class="bb-img" style="background-image:url(\'' + esc(F.tmdbImg(back, 'w1280')) + '\')"></div>' : '<div class="bb-img soft" style="' + (it.poster ? 'background-image:url(\'' + esc(it.poster) + '\')' : '') + '"></div>';
    return '<section class="bb glow" data-hero style="--h:' + hue(it.id) + '" aria-label="Продовжити перегляд">' + img + '<div class="bb-in"><p class="bb-l">Продовжити перегляд' + (nx ? ', далі ' + F.epCode(nx) : '') + '</p><h2 class="bb-t">' + esc(it.titleUk || it.title) + '</h2><p class="bb-m">' + pill + '<span>' + esc(meta) + '</span></p>' + (plot ? '<p class="bb-p">' + esc(plot) + '</p>' : '') +
      '<div class="bb-a"><button class="btn" data-act="open" data-id="' + it.id + '">Відкрити</button><button class="btn ghost" data-act="finish" data-id="' + it.id + '">' + ic('check', 'sm') + 'Завершив</button></div></div>' + (back ? '' : '<div class="bb-poster">' + posterHtml(it.poster, it.title) + '</div>') + '</section>';
  }
  function heroHtml() {
    var h = ui.homeGenre && ui.homeMt !== 'toon' && !mix() ? '' : !isDesktop() ? (ui.homeView === 'cat' && F.tmdbKeyOf() ? heroCat() : '') : F.tmdbKeyOf() ? heroCat() : heroMine();
    ui.heroDom = h.replace('class="bb still"', 'class="bb"');
    return h;
  }
  function heroNext() { if (ui.tab !== 'home' || ui.sheet || !(ui.heroN > 1)) return; ui.heroIx = ((ui.heroIx || 0) + 1) % ui.heroN; paintHero(); }
  // «Продовжити перегляд»: широкі картки з кадром і смужкою прогресу
  function contHtml() {
    var all = F.list('watching'); if (!all.length) return '';
    return '<section class="shelf cont" data-cont><div class="shelf-h"><h2>Продовжити перегляд</h2><button class="more-link" data-act="tab" data-tab="watching">Усі ' + all.length + '</button></div><div class="strip">' + all.slice(0, 10).map(function (it) {
      needBack(it, paintCont);
      var back = F.backOf(it.id), nx = F.nextForMe(it), tot = 0; Object.keys(it.seasonEps || {}).forEach(function (k) { tot += Number(it.seasonEps[k]) || 0; });
      var pct = it.type === 'series' && tot ? Math.min(100, Math.round(F.watchedCount(it) / tot * 100)) : 0;
      var sub = it.type === 'series' ? (nx ? 'Далі ' + F.epCode(nx) : F.watchedCount(it) ? 'Переглянуто ' + F.watchedCount(it) + ' еп.' : 'Серіал, ' + it.year) : [it.year, it.runtime ? F.fmtMinutes(it.runtime) : ''].filter(Boolean).join(', ');
      var img = back ? F.tmdbImg(back, 'w780') : it.poster;
      return '<button class="cw glow" style="--h:' + hue(it.id) + '" data-act="open" data-id="' + it.id + '"><span class="cw-img' + (back ? '' : ' soft') + '"' + (img ? ' style="background-image:url(\'' + esc(img) + '\')"' : '') + '>' + (pct ? '<span class="cw-bar"><i style="width:' + pct + '%"></i></span>' : '') + '</span><span class="cw-t">' + esc(it.titleUk || it.title) + '</span><span class="cw-m">' + esc(sub) + (pct ? ', ' + pct + '%' : '') + '</span></button>';
    }).join('') + '</div></section>';
  }
  function paintCont() { var box = app && app.querySelector('[data-cont]'); if (!box || ui.tab !== 'home') return; var keep = box.querySelector('.strip'), x = keep ? keep.scrollLeft : 0; box.outerHTML = contHtml(); var n = app.querySelector('[data-cont] .strip'); if (n && x) n.scrollLeft = x; }
  // Головна на ПК: один екран замість «Моє» / «Каталог»
  function renderHomeDesktop() {
    var mt = ui.homeMt, toon = mt === 'toon', key = F.tmdbKeyOf();
    var all = mix(), tools = '<button type="button" class="chip hs-chip' + (ui.hideSeen ? ' on' : '') + '" data-act="hideseen" aria-pressed="' + ui.hideSeen + '">' + ic('eye', 'sm') + 'Без переглянутого</button><button type="button" class="chip" data-act="marfind">' + ic('film', 'sm') + 'Кіномарафони</button>';
    var bar = '<div class="catbar' + (all || toon ? ' slim' : '') + '"><div class="chips" role="group" aria-label="Жанри">' + (all || toon ? '' : '<button class="chip' + (!ui.homeGenre ? ' on' : '') + '" data-act="hgenre" data-g="">Усі жанри</button>' + GENRES.filter(function (g) { return g[0] !== '16' && g[0] !== 'anime'; }).map(function (g) { return '<button class="chip' + (ui.homeGenre === g[0] ? ' on' : '') + '" data-act="hgenre" data-g="' + g[0] + '">' + g[1] + '</button>'; }).join('')) + '</div><div class="catbar-r">' + tools + '</div></div>';
    if (key && !toon && !all && ui.homeGenre) {
      var gk = 'h:' + mt + ':' + ui.homeGenre, go = discOpts(mt, ui.homeGenre, '', '');
      return '<div class="nohero"></div>' + bar + discGrid(disc(gk, function (pg) { return F.discover(mt, go, pg); }));
    }
    var h = heroHtml(); if (!h) h = '<div class="nohero"></div>';
    if (!key) return h + '<div class="notice">' + ic('film') + '<div><b>Каталог потребує ключ TMDB</b><div class="sub">З ним тут з’являться добірки, великий банер і кадри з фільмів. Ключ безкоштовний, його вставляють у налаштуваннях.</div><p style="margin:10px 0 0"><button class="btn sm" data-act="tab" data-tab="more">Додати ключ TMDB</button></p></div></div>';
    h += adviceHtml() + bar;
    ensureShelves();
    if (!all && (toon || mt === 'tv')) h += '<section class="shelf studios"><div class="shelf-h"><h2>' + (toon ? 'Студії' : 'Студії й канали') + '</h2></div><div class="chips" role="group">' + F.studios(mt).map(function (s) { return '<button type="button" class="chip" data-act="studio" data-id="' + s.id + '">' + esc(s.name) + '</button>'; }).join('') + '</div></section>';
    h += shelvesHtml(homeDefs());
    if (!all && ui.cat.shown[mt] < F.collDefs(mt).length) h += '<p class="morewrap"><button class="btn ghost" data-act="moreshelves">Більше добірок</button></p>';
    return h;
  }
  function paintHero() {
    var box = app && app.querySelector('[data-hero]'); if (!box || ui.tab !== 'home') return;
    var prev = ui.heroDom, h = heroHtml();
    // той самий банер уже на екрані: не перемальовуємо, щоб не блимав і не збивався відлік
    if (h && ui.heroDom === prev && box.classList.contains('bb') && !box.classList.contains('wait')) return;
    if (h) box.outerHTML = h; else box.remove();
  }
  function loadShelf(def) {
    var tok = ui.cat.token, st = ui.cat.sh[def.id] = { loading: true, items: null, more: false, error: null };
    F.collection(def.id, 1).then(function (r) { st.items = r.items; st.more = r.more; }, function (e) { st.error = e; }).then(function () {
      if (tok !== ui.cat.token) return; st.loading = false; paintShelf(def);
    });
  }
  function ensureShelves() {
    if (ui.tab !== 'home' || (ui.homeView !== 'cat' && !isDesktop()) || !F.tmdbKeyOf() || (ui.homeGenre && ui.homeMt !== 'toon' && !mix())) return;
    homeDefs().forEach(function (d) { if (!ui.cat.sh[d.id]) loadShelf(d); });
  }
  function renderHome() {
    var kk = F.tmdbKeyOf(); if (ui.cat.forKey !== kk) { ui.cat.forKey = kk; ui.cat.sh = {}; ui.cat.token++; }
    if (isDesktop()) return renderHomeDesktop();
    var h = '<div class="page-h"><h1 class="logo"><i></i>Kinoman</h1></div>';
    var mine = ui.homeView === 'mine';
    h += '<div class="hv" role="tablist" aria-label="Головна">' + [['mine', 'Моє'], ['cat', 'Каталог']].map(function (v) { return '<button type="button" role="tab" data-act="homeview" data-v="' + v[0] + '" aria-selected="' + (ui.homeView === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>';
    if (mine) {
      var body0 = newsHtml() + shelfHtml('Дивлюсь зараз', F.list('watching').slice(0, 12), 'watching') + marSection() + soonHtml() + calEntry() + folShelf() + F.colList().map(function (c) { return plainShelf(c.name, F.colItems(c.id)); }).join('');
      return h + (body0 || emptyHtml('play', 'Тут буде те, що ви дивитесь', 'Нові серії, найближчі прем’єри й заплановані перегляди з’являться тут. Почніть з каталогу.', '<p><button class="btn" data-act="homeview" data-v="cat">Відкрити каталог</button></p>'));
    }
    h += heroHtml();
    h += adviceHtml();
    if (F.tmdbKeyOf()) h += '<button class="marentry" data-act="marfind">' + ic('film', 'sm') + '<span><b>Кіномарафони</b><span>Франшизи по порядку: «Володар перснів», Marvel, «Гаррі Поттер»…</span></span>' + ic('right', 'sm') + '</button>';
    var mt = ui.homeMt, toon = mt === 'toon';
    h += '<div class="seg cat-seg" role="group" aria-label="Каталог">' + F.CATS.map(function (t) { return '<button type="button" data-act="hometype" data-mt="' + t[0] + '" aria-pressed="' + (mt === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (!F.tmdbKeyOf()) return h + '<div class="notice">' + ic('film') + '<div><b>Каталог потребує ключ TMDB</b><div class="sub">З ним тут з’являться добірки: що в тренді, що йде в кіно, топи за жанрами й десятиліттями. Ключ безкоштовний, його вставляють у розділі «Ще».</div><p style="margin:10px 0 0"><button class="btn sm" data-act="tab" data-tab="more">Додати ключ</button></p></div></div>';
    var hsChip = '<button type="button" class="chip hs-chip' + (ui.hideSeen ? ' on' : '') + '" data-act="hideseen" aria-pressed="' + ui.hideSeen + '">' + ic('eye', 'sm') + 'Без переглянутого</button>';
    if (toon) h += '<div class="chips">' + hsChip + '</div>';
    else h += '<div class="chips" role="group" aria-label="Фільтри">' + hsChip + '<span class="cdiv" aria-hidden="true"></span><button class="chip' + (!ui.homeGenre ? ' on' : '') + '" data-act="hgenre" data-g="">Усе</button>' + GENRES.filter(function (g) { return g[0] !== '16' && g[0] !== 'anime'; }).map(function (g) { return '<button class="chip' + (ui.homeGenre === g[0] ? ' on' : '') + '" data-act="hgenre" data-g="' + g[0] + '">' + g[1] + '</button>'; }).join('') + '</div>';
    if (!toon && ui.homeGenre) {
      var gk = 'h:' + mt + ':' + ui.homeGenre, go = discOpts(mt, ui.homeGenre, '', '');
      return h + discGrid(disc(gk, function (pg) { return F.discover(mt, go, pg); }));
    }
    ensureShelves();
    if (toon || mt === 'tv') h += '<section class="shelf studios"><div class="shelf-h"><h2>' + (toon ? 'Студії' : 'Студії й канали') + '</h2></div><div class="chips" role="group" aria-label="' + (toon ? 'Студії' : 'Студії й канали') + '">' + F.studios(mt).map(function (s) { return '<button type="button" class="chip" data-act="studio" data-id="' + s.id + '">' + esc(s.name) + '</button>'; }).join('') + '</div></section>';
    var defs = F.collDefs(mt), n = ui.cat.shown[mt], body = shelvesHtml(defs.slice(0, n));
    h += body;
    var states = defs.slice(0, n).map(shelfState).filter(Boolean);
    if (states.length && states.every(function (x) { return !x.loading && !x.error && !vis(x.items).length; })) h += emptyHtml('film', 'Каталог порожній', 'TMDB не повернув жодного фільму. Спробуйте пізніше.');
    if (n < defs.length) h += '<p class="morewrap"><button class="btn ghost" data-act="moreshelves">Більше добірок</button></p>';
    return h;
  }
  // ---------- Уся добірка ----------
  // ---------- Кіномарафони ----------
  function marBar(done, total) { var p = total ? Math.round(done / total * 100) : 0; return '<span class="mbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '" aria-label="Переглянуто ' + done + ' з ' + total + '"><i style="width:' + p + '%"></i></span>'; }
  function marSection() {
    var ms = F.marathons(); if (!ms.length) return '';
    return '<section class="mars"><div class="sec-h"><h2>Кіномарафони</h2>' + (F.tmdbKeyOf() ? '<button class="more-link" data-act="marfind">Новий</button>' : '') + '</div>' + ms.map(function (m) {
      return '<button class="marrow" data-act="maropen" data-id="' + esc(m.id) + '"><span class="mt"><b>' + esc(m.name) + '</b><span>' + (m.done === m.total ? 'Пройдено повністю' : m.next ? 'Далі: ' + esc(m.next.title) + (m.next.year ? ' (' + esc(m.next.year) + ')' : '') : '') + '</span></span><span class="mprog"><b>' + m.done + ' з ' + m.total + '</b>' + marBar(m.done, m.total) + '</span></button>';
    }).join('') + '</section>';
  }
  function marLink(sh, lib) {
    var x = exOf(sh, lib), tc = (lib && lib.tcoll) || x.tcoll; if (!tc || !F.tmdbKeyOf()) return '';
    var saved = F.marathonOf('mt' + tc.id);
    return '<button class="marlink" data-act="martmdb" data-cid="' + tc.id + '">' + ic('film', 'sm') + '<span><b>Кіномарафон «' + esc(F.collName(tc.name)) + '»</b><span>' + (saved ? 'Переглянуто ' + saved.done + ' з ' + saved.total : 'Усі частини по порядку') + '</span></span>' + ic('right', 'sm') + '</button>';
  }
  function marHtml(c) {
    var m = c.mar, saved = m.id ? F.marathonOf(m.id) : null, data = saved || m.data;
    var parts = (saved ? saved.parts : (data.parts || []).map(function (p, i) { return { tid: p.tid, mt: p.mt, title: p.title, year: p.year, poster: p.poster, rank: i + 1, st: F.tmdbStatus(p.mt, p.tid) }; }));
    var done = parts.filter(function (p) { return p.st === 'seen'; }).length, left = parts.filter(function (p) { return !p.st; }).length;
    var h = '<div class="sheetbar">' + (ui.stack.length ? '<button class="back" data-act="back" aria-label="Назад">' + ic('left') + '</button>' : '') + '<button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div><div class="coll marsheet">';
    h += '<h3>' + esc(data.name) + '</h3><p class="sub">' + parts.length + ' ' + plural(parts.length, 'частина', 'частини', 'частин') + ' у порядку перегляду' + (data.src === 'ai' ? ', склав Gemini' : '') + '</p>';
    h += '<div class="mprog big"><b>Переглянуто ' + done + ' з ' + parts.length + '</b>' + marBar(done, parts.length) + '</div>';
    if (data.missed) h += '<p class="fine">' + data.missed + ' ' + plural(data.missed, 'назву', 'назви', 'назв') + ' не знайдено в TMDB, їх пропущено.</p>';
    h += '<p class="bak-acts">' + (saved ? (left ? '<button class="btn sm" data-act="maraddall"' + (m.busy ? ' disabled' : '') + '>' + ic('heart', 'sm') + 'Усе непереглянуте в «Обрані» (' + left + ')</button>' : '') + '<button class="btn ghost sm" data-act="mardel">Видалити марафон</button>'
      : '<button class="btn sm" data-act="marsave">' + ic('play', 'sm') + 'Почати марафон</button>') + '</p>';
    if (m.msg) h += '<p class="' + (m.msg.ok ? 'ok' : 'er-t') + '" role="status">' + esc(m.msg.text) + '</p>';
    h += '<div class="tgrid">' + parts.map(catTile).join('') + '</div>';
    return h + '</div>';
  }
  function marFindHtml(c) {
    var f = c.find;
    var h = '<div class="sheetbar"><button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div><div class="coll">';
    h += '<h3>Кіномарафони</h3><p class="sub">Знайдіть франшизу: усі частини стануть по порядку, а додаток рахуватиме, скільки вже переглянуто.</p>';
    h += '<form class="keyrow" data-form="marq"><input type="search" id="marq" name="marq" value="' + esc(f.q || '') + '" placeholder="Напр. Володар перснів, Marvel хронологічно" autocomplete="off" aria-label="Франшиза"><button class="btn" type="submit"' + (f.busy ? ' disabled' : '') + '>Знайти</button></form>';
    if (f.busy) h += '<div class="rows" role="status" aria-label="Шукаємо">' + skRows(3) + '</div>';
    if (f.err) h += '<p class="er-t" role="status">' + esc(f.err) + '</p>';
    if (f.res) {
      h += f.res.length ? '<div class="baklist">' + f.res.map(function (r) { return '<button class="marrow" data-act="martmdb" data-cid="' + r.cid + '"><span class="mt"><b>' + esc(r.name) + '</b><span>Колекція TMDB</span></span>' + ic('right', 'sm') + '</button>'; }).join('') + '</div>' : '<p class="fine">У TMDB такої колекції немає.</p>';
      if (F.gemKeyOf()) h += '<p class="bak-acts"><button class="btn ghost sm" data-act="marai"' + (f.busy ? ' disabled' : '') + '>' + ic('sparkle', 'sm') + 'Скласти з Gemini: «' + esc(f.q) + '»</button></p><p class="fine">Gemini підійде для всесвітів без окремої колекції (Marvel, DC) або «хронологічно».</p>';
      else h += '<p class="fine">Для Marvel чи DC додайте ключ Gemini в «Ще»: він складе список сам.</p>';
    }
    return h + '</div>';
  }
  // Готова кіносага: складена з кількох колекцій і окремих фільмів; збережену оновлюємо, коли виходять нові частини
  async function openSaga(q, cid) {
    var key = 'ms' + Math.floor(Number(cid)); if (ui.busy[key]) return;
    if (ui.sheet && !ui.sheet.wheel) pushCurrent();
    if (F.marathonOf(key)) {
      ui.sheet = { coll: { id: 'mar', title: F.marathonOf(key).name, mar: { id: key } } }; renderSheet();
      F.sagaData(q).then(function (d) { var now = F.marathonOf(key); if (now && d.parts.length && d.parts.length !== now.total) { F.saveMarathon(d); if (ui.sheet && ui.sheet.coll && ui.sheet.coll.mar && ui.sheet.coll.mar.id === key) renderSheet(); } }, function () {});
      return;
    }
    ui.busy[key] = true; toast('Відкриваємо…');
    try { var d = await F.sagaData(q); toastEl.classList.remove('show'); ui.sheet = { coll: { id: 'mar', title: d.name, mar: { id: null, data: d } } }; renderSheet(); var n = $('.sheet', sheetRoot); if (n) n.scrollTop = 0; }
    catch (e) { toast(F.describeError(e)); goBack(); }
    delete ui.busy[key];
  }
  async function openMarTmdb(cid) {
    var key = 'mt' + Math.floor(Number(cid)); if (ui.busy[key]) return;
    if (ui.sheet && !ui.sheet.wheel) pushCurrent();
    if (F.marathonOf(key)) { ui.sheet = { coll: { id: 'mar', title: F.marathonOf(key).name, mar: { id: key } } }; renderSheet(); return; }
    ui.busy[key] = true; toast('Відкриваємо…');
    try { var d = await F.tmdbCollection(cid); toastEl.classList.remove('show'); ui.sheet = { coll: { id: 'mar', title: d.name, mar: { id: null, data: d } } }; renderSheet(); var n = $('.sheet', sheetRoot); if (n) n.scrollTop = 0; }
    catch (e) { toast(F.describeError(e)); if (ui.stack.length) { var p = ui.stack.pop(); if (p.coll) showColl(p.coll); else if (p.person) openPerson(p.person); else openSheet(p.id, p.brief); } }
    delete ui.busy[key];
  }
  function collHtml(sh) {
    var c = sh.coll;
    if (c.mar) return marHtml(c);
    if (c.find) return marFindHtml(c);
    var h = '<div class="sheetbar">' + (ui.stack.length ? '<button class="back" data-act="back" aria-label="Назад">' + ic('left') + '</button>' : '') + '<button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div><div class="coll"><h3>' + esc(c.title) + '</h3><p class="sub">' + c.items.length + ' ' + plural(c.items.length, 'фільм і серіал', 'фільми й серіали', 'фільмів і серіалів') + '</p>';
    if (c.limit) h += yearBar(c);
    if (c.sorts) h += sortBar(c);
    h += '<div class="tgrid"' + (c.busy ? ' role="status" aria-label="Завантажуємо"' : '') + '>' + vis(c.items).map(catTile).join('') + (c.busy ? skTiles(c.items.length ? 6 : 12) : '') + '</div>';
    if (c.error) h += '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(c.error)) + '</div></div>';
    if (c.sorts && (c.genre || c.age) && !c.busy && !c.items.length && !c.error) h += '<p class="fine">Нічого не знайшлося. Спробуйте інший жанр або вік.</p>';
    if (c.limit && c.year && !c.busy && !c.items.length && !c.error) h += '<p class="fine">За цей період замало оцінених. Спробуйте десятиліття або інший рік.</p>';
    if (!c.busy && c.more) h += '<p class="morewrap"><button class="btn ghost sm" data-act="collmore">Показати ще</button></p>';
    return h + '</div>';
  }
  // Підбірки з фільтрами (новорічні): сортування, жанр і вік
  function sortBar(c) {
    var sel = function (k, label, opts) { return '<select data-change="collsort" data-k="' + k + '" aria-label="' + label + '"' + (c.busy ? ' disabled' : '') + '>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (c[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    return '<div class="tools yrbar collf">' + sel('sort', 'Сортування', [['', 'За популярністю'], ['rating', 'За рейтингом']]) + sel('genre', 'Жанр', [['', 'Усі жанри']].concat(F.COLL_GENRES)) + sel('age', 'Вік', [['', 'Будь-який вік']].concat(F.COLL_AGES)) + '</div>';
  }
  async function collSort(k, val) {
    var sh = ui.sheet, c = sh && sh.coll; if (!c || !c.sorts || c.busy || !/^(sort|genre|age)$/.test(k)) return;
    c[k] = String(val || ''); c.error = null; c.page = 1;
    if (!c.sort && !c.genre && !c.age) { c.items = c.base.slice(); c.more = c.baseMore; renderSheet(); return; }
    var key = c.sort + '|' + c.genre + '|' + c.age, now = function () { return c.sort + '|' + c.genre + '|' + c.age === key; };
    c.items = []; c.more = false; c.busy = true; renderSheet();
    try { var r = await F.collection(c.id, 1, '', { sort: c.sort, genre: c.genre, age: c.age }); if (now()) { c.items = r.items; c.more = r.more; } }
    catch (e) { if (now()) { c.error = e; c.items = []; } }
    c.busy = false; if (ui.sheet === sh) renderSheet();
  }
  // «Топ N»: вибір року або десятиліття
  function yearBar(c) {
    var y0 = new Date(FB.now()).getFullYear(), o = '<option value="">Усі роки</option><optgroup label="Десятиліття">', d, y;
    for (d = Math.floor(y0 / 10) * 10; d >= 1950; d -= 10) o += '<option value="d' + d + '"' + (c.year === 'd' + d ? ' selected' : '') + '>' + d + '-ті</option>';
    o += '</optgroup><optgroup label="Рік">';
    for (y = y0; y >= 1950; y--) o += '<option value="y' + y + '"' + (c.year === 'y' + y ? ' selected' : '') + '>' + y + '</option>';
    return '<div class="tools yrbar"><select data-change="collyear" aria-label="Рік випуску"' + (c.busy ? ' disabled' : '') + '>' + o + '</optgroup></select></div>';
  }
  async function collYear(val) {
    var sh = ui.sheet, c = sh && sh.coll; if (!c || !c.limit || c.busy) return;
    if (!/^([yd]\d{4})?$/.test(val)) val = '';
    c.year = val; c.error = null;
    if (!val) { c.items = c.base.slice(); renderSheet(); return; }
    c.busy = true; renderSheet();
    try { var r = await F.collection(c.id, 1, val); if (c.year === val) c.items = r.items; }
    catch (e) { if (c.year === val) { c.error = e; c.items = []; } }
    c.busy = false; if (ui.sheet === sh) renderSheet();
  }
  async function openStudio(def) {
    var c = { id: def.id, title: def.title, items: [], base: [], limit: def.limit, year: '', page: 1, more: false, busy: true, error: null };
    ui.sheet = { coll: c }; ui.stack = []; renderSheet(); var sh = ui.sheet;
    try { var r = await F.collection(def.id, 1); c.items = r.items; c.base = r.items.slice(); }
    catch (e) { c.error = e; }
    c.busy = false; if (ui.sheet === sh) renderSheet();
  }
  function openColl(id) {
    var def = F.collDefs('movie').concat(F.collDefs('tv'), F.collDefs('toon')).filter(function (d) { return d.id === id; })[0], st = ui.cat.sh[id]; if (!def || !st || !st.items) return;
    ui.sheet = { coll: { id: id, title: def.title, items: st.items.slice(), base: st.items.slice(), baseMore: st.more, limit: def.limit, year: '', sorts: !!def.sorts, sort: '', genre: '', age: '', page: 1, more: st.more, busy: false, error: null } }; ui.stack = []; renderSheet();
  }
  async function collMore() {
    var sh = ui.sheet, c = sh && sh.coll; if (!c || c.busy || !c.more) return; c.busy = true; c.error = null; renderSheet();
    try { var r = await F.collection(c.id, c.page + 1, '', { sort: c.sort, genre: c.genre, age: c.age }); c.page++; var seen = {}; c.items.forEach(function (x) { seen[x.mt + x.tid] = 1; }); r.items.forEach(function (x) { if (!seen[x.mt + x.tid]) c.items.push(x); }); c.more = r.more; }
    catch (e) { c.error = e; }
    c.busy = false; if (ui.sheet === sh) renderSheet();
  }
  // ---------- Підказки під час набору ----------
  var suggTimer = null, suggTok = 0;
  function hideSugg() { clearTimeout(suggTimer); suggTok++; var b = $('#sugg'); if (b) { b.classList.remove('show'); b.innerHTML = ''; } }
  function queueSugg(now) {
    clearTimeout(suggTimer);
    var q = ui.q.trim(); if (q.length < 2 || !F.tmdbKeyOf() || F.isId(q)) { hideSugg(); return; }
    suggTimer = setTimeout(function () { loadSugg(q); }, now ? 0 : 280);
  }
  async function loadSugg(q) {
    var tok = ++suggTok, items;
    try { items = await F.suggest(q); } catch (e) { items = null; }
    var b = $('#sugg'), inp = $('#q');
    if (tok !== suggTok || !b || !inp || inp.value.trim() !== q || document.activeElement !== inp) return;
    var people = (items && items.people) || [];
    if (!items || (!items.length && !people.length)) { b.classList.remove('show'); b.innerHTML = ''; return; }
    var media = items.map(function (r) {
      return '<button type="button" class="sg" role="option" data-act="cat" data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '"><span class="sp">' + (r.poster ? '<img src="' + esc(F.tmdbImg(r.poster, 'w92')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ic('film', 'sm')) + '</span><span class="st"><b>' + esc(r.title) + '</b><span>' + esc([r.mt === 'tv' ? 'Серіал' : 'Фільм', r.year, r.orig].filter(Boolean).join(', ')) + '</span></span>' + (r.vote ? '<span class="sv">★ ' + r.vote.toFixed(1) + '</span>' : '') + '</button>';
    }).join('');
    var ppl = people.map(function (p) {
      return '<button type="button" class="sg" role="option" data-act="person" data-pid="' + p.pid + '" data-name="' + esc(p.name) + '" data-photo="' + esc(p.photo) + '"><span class="sp round">' + (p.photo ? '<img src="' + esc(F.tmdbImg(p.photo, 'w92')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : esc(initials(p.name))) + '</span><span class="st"><b>' + esc(p.name) + '</b><span>' + esc(p.dept || 'Кіно') + '</span></span></button>';
    }).join('');
    b.innerHTML = items.peopleFirst ? ppl + media : media + ppl;
    b.classList.add('show');
  }
  function sel(name, opts, val, label) { return '<select data-change="fl" data-k="' + name + '" aria-label="' + label + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(val) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function filterHtml() {
    var f = ui.fl;
    f.mt = ui.type === 'series' ? 'tv' : 'movie';
    var h = '<section class="filters"><h2>Підбір за фільтрами</h2><p class="sub" style="margin:0 0 10px">' + (f.mt === 'tv' ? 'Серіали' : 'Фільми') + ' за жанром, роками й рейтингом. Тип перемикається вище.</p>';
    h += '<div class="fgrid">' + sel('genre', [['', 'Усі жанри']].concat(GENRES), f.genre, 'Жанр') + sel('decade', DECADES, f.decade, 'Роки') + sel('vote', VOTES, f.vote, 'Рейтинг') + '</div></section>';
    var key = 'f:' + [f.mt, f.genre, f.decade, f.vote].join(':'), o = discOpts(f.mt, f.genre, f.decade, f.vote), mt = f.mt;
    return h + discGrid(disc(key, function (pg) { return F.discover(mt, o, pg); }));
  }
  function histHtml() {
    return '<div class="qhist"><div class="qh-h"><h2>Нещодавно шукали</h2><button class="btn ghost sm" data-act="qhclear">Очистити</button></div><div class="chips cols">' +
      F.queries().map(function (q) { return '<button class="chip" data-act="qh" data-q="' + esc(q) + '">' + ic('clock', 'sm') + esc(q) + '</button>'; }).join('') + '</div></div>';
  }
  function renderSearch() {
    var h = '<div class="page-h"><h1>Пошук</h1></div>';
    if (!F.keyOf()) h += noKeyHtml();
    h += '<div class="sbox"><form class="searchbar" data-form="search" role="search"><input type="search" id="q" name="q" aria-autocomplete="list" aria-controls="sugg" placeholder="' + (F.gemKeyOf() ? 'Назва фільму чи серіалу' : 'Назва англійською або IMDb ID') + '" value="' + esc(ui.q) + '" autocomplete="off" autocapitalize="none" enterkeyhint="search" aria-label="Назва фільму чи серіалу"><button class="btn" type="submit" aria-label="Шукати">' + ic('search') + '</button></form><div id="sugg" class="sugg" role="listbox" aria-label="Підказки"></div></div>';
    h += '<div class="seg" role="group" aria-label="Тип">' + [['', 'Усе'], ['movie', 'Фільми'], ['series', 'Серіали']].map(function (t) { return '<button type="button" data-act="type" data-type="' + t[0] + '" aria-pressed="' + (ui.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (ui.error) h += '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(ui.error)) + (ui.error.code === 'NEED_GEMINI' ? '<p style="margin:10px 0 0"><button class="btn sm" data-act="tab" data-tab="more">Додати ключ Gemini</button></p>' : '') + '</div></div>';
    if (ui.results.length && ui.corrected) h += '<p class="sub" style="margin:0 0 6px">За «' + esc(ui.q.trim()) + '» нічого немає. Показано результати для «' + esc(ui.corrected) + '».</p>';
    else if (ui.results.length && ui.translatedAs) h += '<p class="sub" style="margin:0 0 6px">Шукали за оригінальною назвою: ' + esc(ui.translatedAs) + '</p>';
    if (ui.results.length && ui.exact) h += '<p class="sub" style="margin:0 0 6px">Назва надто загальна, тому показано один найточніший збіг. Щоб уточнити, додайте рік, наприклад «Dark 2017».</p>';
    if (ui.results.length) {
      h += '<div class="rows">' + ui.results.map(rowHtml).join('') + '</div>';
      if (ui.results.length < ui.total) h += '<div class="more">' + (ui.loading ? '<div class="rows" role="status" aria-label="Завантаження">' + skRows(2) + '</div>' : '<button class="btn ghost block" data-act="more">Показати ще</button>') + '</div>';
    } else if (ui.loading) h += '<div class="rows" role="status" aria-label="Шукаємо">' + skRows(6) + '</div>';
    else if (ui.searched && !ui.error) h += emptyHtml('film', 'Нічого не знайшли', 'OMDb знає назви англійською. Спробуйте оригінальну назву або вставте ID з IMDb, наприклад tt0133093.');
    else if (!ui.error && F.queries().length) h += histHtml() + (F.tmdbKeyOf() ? filterHtml() : '');
    else if (!ui.error && F.tmdbKeyOf()) h += filterHtml();
    else if (!ui.error && F.keyOf()) h += emptyHtml('film', 'Що шукаємо?', 'Введіть назву фільму чи серіалу. Рейтинги IMDb, Rotten Tomatoes та Metacritic з’являться в картці.');
    return h;
  }
  async function doSearch(more) {
    var q = ui.q.trim(); if (!q) return;
    var tok = ++ui.token; ui.loading = true; ui.error = null; if (!more) { ui.exact = false; ui.translatedAs = ''; ui.corrected = ''; }
    if (!more) { ui.results = []; ui.total = 0; ui.page = 0; ui.searched = false; }
    render();
    try {
      var page = more ? ui.page + 1 : 1; var r = await F.search(q, ui.type, page);
      if (tok !== ui.token) return;
      var seen = {}; ui.results.forEach(function (x) { seen[x.id] = 1; });
      ui.results = ui.results.concat(r.items.filter(function (x) { return !seen[x.id]; })); ui.total = r.total; ui.page = page; ui.searched = true; ui.exact = !!r.exact; ui.translatedAs = r.translatedAs || ''; ui.corrected = r.corrected || ''; if (page === 1 && r.items.length) F.addQuery(q);
    } catch (e) { if (tok !== ui.token) return; ui.error = e; ui.searched = true; }
    ui.loading = false; render();
  }

  // ---------- Списки ----------
  function cardHtml(it, i, status) {
    var img = it.poster ? '<img src="' + esc(it.poster) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '';
    var st = ' style="--h:' + hue(it.id) + ';--i:' + i + '"', nm = esc(it.titleUk || it.title);
    // у «Сім’єю» на постері видно, з якого віку
    var lf = ui.lists[status], ageB = lf && lf.fam ? ageBadge(it, 'onp') : '';
    if (status === 'seen') {
      if (ageB) img += ageB;
      var num = it.myRating ? '<b class="me">' + it.myRating + '</b><i>з 10</i>' : (it.type === 'series' && F.watchedCount(it) ? '<b class="done">' + F.watchedCount(it) + '</b><i>еп.</i>' : '<b class="none">—</b><i>без оцінки</i>');
      var when = it.seenAt ? new Date(it.seenAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      return '<button class="card stub glow"' + st + ' data-act="open" data-id="' + it.id + '"><span class="poster"><span class="ph">' + esc(it.title) + '</span>' + img + (F.hasNewSeason(it) ? '<span class="nsflag">Новий сезон</span>' : '') + '</span><span class="mid"><span class="name">' + nm + '</span><span class="yr">' + esc(it.year) + (it.ratings.imdb != null ? ', IMDb ' + it.ratings.imdb.toFixed(1) : '') + '</span>' + (when ? '<span class="when">' + esc(when) + '</span>' : '') + '</span><span class="num">' + num + '</span></button>';
    }
    var b = '';
    if (ageB) img += ageB;
    if (it.ratings.imdb != null) b += '<span>' + it.ratings.imdb.toFixed(1) + '</span>';
    if (it.myRating) b += '<span class="me" title="Моя оцінка">' + it.myRating + '</span>';
    else if (it.type === 'series' && F.watchedCount(it)) b += '<span class="done">' + F.watchedCount(it) + ' еп.</span>';
    var nx = status === 'watching' ? F.nextForMe(it) : null;
    return '<button class="card glow"' + st + ' data-act="open" data-id="' + it.id + '"><span class="poster"><span class="ph">' + esc(it.title) + '</span>' + img + '<span class="badge">' + b + '</span><span class="over"><span class="name">' + nm + '</span><span class="yr">' + esc(it.year) + '</span>' + (nx ? '<span class="nx">Далі ' + F.epCode(nx) + '</span>' : '') + '</span></span></button>';
  }
  function renderList(status) {
    var f = ui.lists[status], total = F.list(status).length, all = F.list(status, HD()), items = F.list(status, HD(f));
    var avg = status === 'seen' ? F.stats().avgMine : null;
    var h = (isDesktop() ? '<div class="libnav" role="tablist" aria-label="Колекція">' + ['watching', 'want', 'seen'].map(function (k) { return '<button type="button" role="tab" data-act="tab" data-tab="' + k + '" aria-selected="' + (k === status) + '">' + NAMES[k] + '<sup>' + F.list(k).length + '</sup></button>'; }).join('') + '</div>' : '') + '<div class="page-h big"><div><h1>' + NAMES[status] + '</h1><p class="sub">' + all.length + ' ' + (status !== 'seen' ? plural(all.length, 'позиція', 'позиції', 'позицій') : plural(all.length, 'фільм і серіал', 'фільми й серіали', 'фільмів і серіалів')) + (avg != null ? ', середня оцінка ' + avg.toFixed(1) : '') + '</p></div>' + (status === 'want' && all.length > 1 ? '<span class="hbtns"><button class="btn soft sm" data-act="duo">' + ic('heart', 'sm') + 'Вдвох</button><button class="btn soft sm" data-act="random">' + ic('shuffle', 'sm') + 'Що подивитись?</button></span>' : '') + '</div>';
    // ПК: «Вийшло нове» і «Скоро» живуть тут, а не на головній
    if (isDesktop() && status === 'watching') { var wk = newsHtml() + soonHtml(); if (wk) h += '<div class="week">' + wk + '</div>'; }
    if (!total) {
      return h + (status === 'want' ? emptyHtml('heart', 'Тут буде ваш список', 'Знайдіть фільм і натисніть «В обране», щоб не забути його.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>')
        : status === 'watching' ? emptyHtml('play', 'Зараз нічого не дивитесь', 'Натисніть «Дивлюсь» у картці фільму чи серіалу. Для серіалів тут буде видно, скільки серій вже позаду.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>')
        : emptyHtml('eye', 'Поки нічого не переглянуто', 'Позначайте фільми як переглянуті й ставте свої оцінки від 1 до 10.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>'));
    }
    // З ким дивитись: один перемикач замість трьох окремих кнопок
    var twoN = F.list(status, { two: true }).length, famN = F.list(status, { fam: true }).length, meN = F.list(status, { hide: true }).length;
    var myCols = F.colList();
    if (f.col && !myCols.some(function (c) { return c.id === f.col; })) { ['want', 'watching', 'seen'].forEach(function (k) { if (ui.lists[k]) ui.lists[k].col = ''; }); items = F.list(status, HD(f)); }
    var who = f.col ? 'col:' + f.col : f.two ? 'two' : f.fam ? 'fam' : F.hideGrpOn() ? 'me' : 'all';
    h += '<div class="who" role="group" aria-label="З ким дивитись">' + [['all', 'Усі', total, ''], ['me', 'Тільки я', meN, ''], ['two', 'Удвох', twoN, 'heart'], ['fam', 'Сім’єю', famN, 'home']].map(function (w) { return '<button type="button" data-act="who" data-w="' + w[0] + '" aria-pressed="' + (who === w[0]) + '">' + (w[3] ? ic(w[3], 'sm') : '') + w[1] + '<i>' + w[2] + '</i></button>'; }).join('') +
      myCols.map(function (c) { var on = who === 'col:' + c.id; return '<span class="whoc' + (on ? ' on' : '') + '"><button type="button" data-act="who" data-w="col:' + c.id + '" aria-pressed="' + on + '">' + ic('film', 'sm') + esc(c.name) + '<i>' + F.list(status, { col: c.id }).length + '</i></button><button type="button" class="whox" data-act="delcol" data-c="' + c.id + '" aria-label="Видалити добірку ' + esc(c.name) + '" title="Видалити добірку">' + ic('x', 'sm') + '</button></span>'; }).join('') +
      '<button type="button" class="whoadd" data-act="newcolrow" aria-label="Створити добірку" title="Створити добірку">' + ic('plus', 'sm') + 'Добірка</button></div>';
    if (who === 'fam' && famN) {
      var noAge = F.list(status, { fam: true }).filter(function (it) { return F.ageOf(it) == null; }).length;
      h += '<div class="agebar" role="group" aria-label="Вік дитини"><span class="agel">Вік</span>' + [['', 'Будь-який'], ['0', '0+'], ['6', 'до 6+'], ['12', 'до 12+'], ['16', 'до 16+']].map(function (a) { return '<button type="button" class="chip' + ((f.age || '') === a[0] ? ' on' : '') + '" data-act="agef" data-age="' + a[0] + '" aria-pressed="' + ((f.age || '') === a[0]) + '">' + a[1] + '</button>'; }).join('') + '</div>';
      if (f.age && noAge) h += '<p class="fine" style="margin:-4px 0 12px">Без вікової позначки: ' + noAge + '. Їх не показано, бо невідомо, з якого вони віку.</p>';
    }
    var bar = '<div class="seg" role="group" aria-label="Тип">' + [['', 'Усе'], ['movie', 'Фільми'], ['series', 'Серіали'], ['toon', 'Мультики']].map(function (t) { return '<button type="button" data-act="ltype" data-type="' + t[0] + '" aria-pressed="' + (f.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    bar += '<div class="tools"><select data-change="time" aria-label="Час">' + [['', 'Будь-який час'], ['90', 'До 90 хв'], ['120', '90 хв – 2 год'], ['121', 'Понад 2 год']].map(function (o) { return '<option value="' + o[0] + '"' + ((f.time || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><select data-change="sort" aria-label="Сортування">' + F.SORTS_FOR[status].map(function (k) { return '<option value="' + k + '"' + (f.sort === k ? ' selected' : '') + '>' + esc(F.SORTS[k]) + '</option>'; }).join('') + '</select></div>';
    var oc = status === 'want' ? F.oldCount('want') : 0;
    if (oc || f.old) bar += '<button type="button" class="chip' + (f.old ? ' on' : '') + '" data-act="oldf" aria-pressed="' + !!f.old + '">' + ic('clock', 'sm') + 'Давно лежить ' + oc + '</button>';
    h += '<div class="fbar">' + bar + '</div>';
    var gs = F.genres(status, f.col ? { col: f.col } : (f.two || f.fam) ? {} : HD());
    if (gs.length > 1) h += '<div class="chips" role="group" aria-label="Жанри"><button class="chip' + (!f.genre ? ' on' : '') + '" data-act="genre" data-genre="">Усі жанри</button>' + gs.slice(0, 14).map(function (g) { return '<button class="chip' + (f.genre === g.name ? ' on' : '') + '" data-act="genre" data-genre="' + esc(g.name) + '">' + esc(F.genreUk(g.name)) + ' ' + g.count + '</button>'; }).join('') + '</div>';
    if (!items.length && who === 'fam' && f.age) return h + emptyHtml('home', 'Для такого віку нічого немає', 'Оберіть старший вік або «Будь-який».');
    if (!items.length && f.col) return h + emptyHtml('film', 'У цій добірці тут порожньо', 'Відкрийте картку фільму і в розділі «Добірки» додайте його сюди.');
    if (!items.length) return h + (who === 'two' || who === 'fam' ? emptyHtml(who === 'two' ? 'heart' : 'home', who === 'two' ? 'Для перегляду вдвох тут порожньо' : 'Для перегляду сім’єю тут порожньо', 'Відкрийте картку фільму і в розділі «Добірки» позначте «' + (who === 'two' ? 'Для двох' : 'Сімейні') + '».') : emptyHtml('film', 'За цим фільтром порожньо', 'Змініть тип, жанр чи час.'));
    return h + '<div class="' + (status === 'seen' ? 'stubs' : 'grid') + '">' + items.map(function (it, i) { var c = cardHtml(it, i, status); return status === 'watching' ? '<div class="cardwrap">' + c + '<button class="fin" data-act="finish" data-id="' + it.id + '" aria-label="Завершив: ' + esc(it.titleUk || it.title) + '">' + ic('check', 'sm') + 'Завершив</button></div>' : c; }).join('') + '</div>';
  }

  // ---------- Ще ----------
  function archPanel() {
    var a = F.archived(); if (!a.length) return '';
    var h = '<section class="panel"><div class="sec-h" style="margin:0 0 6px"><h2 style="margin:0">Архів</h2><button class="more-link" data-act="archshow">' + (ui.archOpen ? 'Сховати' : 'Показати ' + a.length) + '</button></div><p class="sub" style="margin:0">Прибране зі списків, але не видалене. Оцінки враховуються в статистиці.</p>';
    if (ui.archOpen) h += '<div class="baklist">' + a.map(function (it) { return '<div class="bakrow"><button class="archopen" data-act="open" data-id="' + it.id + '"><b>' + esc(it.titleUk || it.title) + '</b> <i>' + esc(NAMES[it.status]) + (it.year ? ', ' + esc(it.year) : '') + '</i></button><button class="chip" data-act="arch" data-id="' + it.id + '" data-on="">Повернути</button></div>'; }).join('') + '</div>';
    return h + '</section>';
  }
  function yearPanel() {
    var y = new Date(FB.now()).getFullYear(), st = F.yearStats(y);
    if (!st.count) { var p = F.yearStats(y - 1); if (p.count) { st = p; y = y - 1; } }
    var h = '<section class="panel yearcard"><h2>Ваш ' + y + ' у кіно</h2>';
    if (!st.count) return h + '<p class="sub">Тут з’явиться підсумок року, щойно ви позначите фільм як переглянутий.</p></section>';
    h += '<div class="ybig"><div><b>' + st.count + '</b><span>' + plural(st.count, 'тайтл', 'тайтли', 'тайтлів') + '</span></div><div><b>' + esc(st.minutes ? F.fmtMinutes(st.minutes) : '—') + '</b><span>за екраном</span></div>' + (st.avg != null ? '<div><b>' + st.avg.toFixed(1) + '</b><span>середня оцінка</span></div>' : '') + '</div>';
    if (st.genres.length) h += '<p class="sub">Улюблені жанри: ' + st.genres.map(function (g) { return esc(F.genreUk(g)); }).join(', ') + '</p>';
    if (st.top.length) h += '<ol class="ytop">' + st.top.map(function (it) { return '<li><span>' + esc(it.titleUk || it.title) + '</span><b>' + it.myRating + '</b></li>'; }).join('') + '</ol>';
    return h + '<p style="margin:12px 0 0"><button class="btn sm" data-act="yearimg" data-y="' + y + '">' + ic('download', 'sm') + 'Зберегти картинку</button></p></section>';
  }
  function colPanel() {
    var cols = F.colList();
    var h = '<section class="panel"><h2>Ваші добірки</h2>';
    if (!cols.length) h += '<p class="sub" style="margin:0 0 10px">Добірки на кшталт «На вечір удвох» чи «Різдвяні». Додати фільм у добірку можна в його картці.</p>';
    else h += '<div class="collist">' + cols.map(function (c) { return '<div class="colrow"><b>' + esc(c.name) + '</b><span class="sub">' + F.colItems(c.id).length + '</span><button class="icon-btn sm" data-act="rencol" data-c="' + c.id + '" aria-label="Перейменувати ' + esc(c.name) + '">✎</button><button class="icon-btn sm" data-act="delcol" data-c="' + c.id + '" aria-label="Видалити ' + esc(c.name) + '">' + ic('trash', 'sm') + '</button></div>'; }).join('') + '</div>';
    var hs = hidShelves(), hk = Object.keys(hs);
    if (hk.length) h += '<h2 style="margin-top:18px">Видалені добірки каталогу</h2><div class="collist">' + hk.map(function (k) { return '<div class="colrow"><b>' + esc(typeof hs[k] === 'string' ? hs[k] : k) + '</b><button class="btn ghost sm" data-act="showsh" data-id="' + esc(k) + '">Повернути</button></div>'; }).join('') + '</div>' + (hk.length > 1 ? '<p class="bak-acts"><button class="btn ghost sm" data-act="showshall">Повернути всі</button></p>' : '');
    return h + '</section>';
  }
  function syncPanel() {
    var so = F.syncOf();
    var h = '<section class="panel"><h2>Синхронізація між пристроями</h2><p class="sub" style="margin:0 0 10px">Ваші списки зберігаються у вашому Google Диску через власний скрипт. Однакові адреса й секретне слово на двох телефонах дають однакові списки.</p>';
    h += '<form data-form="sync"><label class="fl" for="syncurl">Адреса скрипта</label><input type="text" id="syncurl" name="syncurl" value="' + esc(so.url) + '" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" autocapitalize="none" spellcheck="false">' +
      '<label class="fl" for="synccode">Секретне слово</label><input type="password" id="synccode" name="synccode" value="' + esc(so.code) + '" autocomplete="off" autocapitalize="none" spellcheck="false"><p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="submit">Зберегти</button><button class="btn ghost sm" type="button" data-act="syncnow"' + (so.url && so.code ? '' : ' disabled') + '>' + ic('refresh', 'sm') + 'Синхронізувати</button></p></form>';
    if (ui.syncMsg) h += '<p class="' + (ui.syncMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.syncMsg.text) + '</p>';
    if (so.at) h += '<p class="fine">Остання синхронізація: ' + esc(new Date(so.at).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + '. Додаток синхронізується й сам, коли ви його відкриваєте.</p>';
    h += '<p class="fine">Адреса й слово зберігаються лише на цьому пристрої та не потрапляють у копію даних.</p>';
    if (so.url && so.code) h += bakHtml(so);
    return h + '</section>';
  }
  function bakHtml(so) {
    var b = ui.bak || {}, h = '<div class="bak"><h3>Резервні копії в Google Диску</h3>';
    h += '<p class="sub">' + (so.bak ? 'Остання копія: ' + esc(new Date(so.bak).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })) + '. ' : 'Копій ще не було. ') + 'Додаток робить копію сам раз на тиждень; зберігаються останні 8 у папці «Kinoman — копії».</p>';
    h += '<p class="bak-acts"><button class="btn sm" data-act="baknow"' + (b.busy ? ' disabled' : '') + '>Зберегти копію зараз</button><button class="btn ghost sm" data-act="baklist"' + (b.busy ? ' disabled' : '') + '>Відновити з копії</button></p>';
    if (b.msg) h += '<p class="' + (b.msg.ok ? 'ok' : 'er-t') + '" role="status">' + esc(b.msg.text) + '</p>';
    if (b.old) h += '<p class="fine">Як оновити скрипт: відкрийте свій проєкт на script.google.com, замініть весь код новим файлом kinoman-sync.gs (своє слово в SECRET залиште), далі «Розгорнути» → «Керувати розгортаннями» → олівець → «Нова версія» → «Розгорнути». Адреса не зміниться.</p>';
    if (b.list) h += b.list.length ? '<div class="baklist">' + b.list.map(function (x) {
      var p = x.date.split('-'); return '<div class="bakrow"><span>' + esc(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })) + (x.size ? ' <i>' + Math.max(1, Math.round(x.size / 1024)) + ' КБ</i>' : '') + '</span><button class="chip" data-act="bakrestore" data-name="' + esc(x.name) + '">Відновити</button></div>';
    }).join('') + '</div><p class="fine">Відновлення додає записи з копії: нічого з теперішнього не видаляється, новіші зміни не затираються.</p>' : '<p class="fine">У папці ще немає копій.</p>';
    return h + '</div>';
  }
  // Картинка «Мій рік у кіно» для збереження чи надсилання
  async function saveYearImage(y) {
    var st = F.yearStats(y); if (!st.count) return;
    try { if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load('800 80px Unbounded'), document.fonts.load('600 40px Onest')]); } catch (e) { /* стандартний шрифт */ }
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1350; var g = c.getContext('2d'); if (!g) { toast('Телефон не дав створити картинку.'); return; }
    var bg = g.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, '#2A0F24'); bg.addColorStop(0.55, '#120D1C'); bg.addColorStop(1, '#0C0A12'); g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    var gl = g.createRadialGradient(540, -80, 10, 540, -80, 760); gl.addColorStop(0, 'rgba(255,79,139,.45)'); gl.addColorStop(1, 'rgba(255,79,139,0)'); g.fillStyle = gl; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = '#F5C518'; for (var i = 0; i < 26; i++) { g.beginPath(); g.arc(70 + i * 37.5, 70, 6, 0, 7); g.fill(); }
    var D = '"Unbounded", "Onest", system-ui, sans-serif', B = '"Onest", system-ui, sans-serif';
    g.fillStyle = '#F3EEF6'; g.font = '800 92px ' + D; g.fillText('Мій ' + y, 80, 220); g.fillText('у кіно', 80, 330);
    var stat = function (x, yy, big, small, col) { g.fillStyle = col; g.font = '900 96px ' + D; g.fillText(big, x, yy); g.fillStyle = '#9D95AE'; g.font = '600 34px ' + B; g.fillText(small, x, yy + 52); };
    stat(80, 520, String(st.count), plural(st.count, 'тайтл', 'тайтли', 'тайтлів'), '#FF4F8B');
    stat(560, 520, st.minutes >= 60 ? String(Math.round(st.minutes / 60)) : String(st.minutes), st.minutes >= 60 ? 'годин за екраном' : 'хвилин за екраном', '#F5C518');
    var yy = 700;
    if (st.genres.length) { g.fillStyle = '#9D95AE'; g.font = '600 34px ' + B; g.fillText('Улюблені жанри', 80, yy); g.fillStyle = '#F3EEF6'; g.font = '700 44px ' + B; g.fillText(st.genres.map(F.genreUk).join(', '), 80, yy + 58); yy += 150; }
    if (st.top.length) {
      g.fillStyle = '#9D95AE'; g.font = '600 34px ' + B; g.fillText('Мій топ', 80, yy); yy += 66;
      st.top.forEach(function (it, n) { var t = it.titleUk || it.title; g.font = '700 44px ' + B; while (g.measureText(t).width > 760 && t.length > 4) t = t.slice(0, -2); if (t !== (it.titleUk || it.title)) t += '…'; g.fillStyle = '#F3EEF6'; g.fillText((n + 1) + '. ' + t, 80, yy); g.fillStyle = '#F5C518'; g.font = '900 46px ' + D; g.fillText(String(it.myRating), 940, yy); yy += 72; });
    }
    g.fillStyle = '#FF4F8B'; g.beginPath(); g.arc(92, 1262, 12, 0, 7); g.fill(); g.fillStyle = '#F3EEF6'; g.font = '800 40px ' + D; g.fillText('Kinoman', 120, 1276);
    c.toBlob(async function (blob) {
      if (!blob) { toast('Не вдалося зберегти картинку.'); return; }
      var name = 'kinoman-' + y + '.png', file = null; try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { /* старий браузер */ }
      try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Мій ' + y + ' у кіно' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }, 'image/png');
  }
  function agoUk(t) {
    if (!t) return 'ніколи';
    var m = Math.round((FB.now() - t) / 60000); if (m < 2) return 'щойно'; if (m < 60) return m + ' хв тому';
    var hh = Math.round(m / 60); if (hh < 24) return hh + ' год тому';
    var d = Math.round(hh / 24); return d + ' ' + plural(d, 'день', 'дні', 'днів') + ' тому';
  }
  function statusHtml() {
    var st = F.status(), rows = [];
    var row = function (lvl, name, val) { rows.push('<li class="st-' + lvl + '"><i></i><span>' + name + '</span><b>' + val + '</b></li>'); };
    row(!st.omdbKey ? 'bad' : st.omLimit ? 'bad' : st.omdb > 800 ? 'warn' : 'ok', 'OMDb', !st.omdbKey ? 'немає ключа' : st.omLimit ? 'ліміт на сьогодні вичерпано' : 'сьогодні ' + st.omdb + ' з ~1000 запитів');
    row(st.tmdbKey ? 'ok' : 'warn', 'TMDB', st.tmdbKey ? 'працює, сьогодні ' + st.tmdb + ' запитів' : 'немає ключа');
    row(!st.gemKey ? 'warn' : st.gemLimit ? 'warn' : 'ok', 'Gemini', !st.gemKey ? 'немає ключа' : st.gemLimit ? 'був ліміт, зачекайте трохи' : 'сьогодні ' + st.gem + ' запитів');
    if (st.sync) {
      var old = FB.now() - st.bakAt > 3 * 86400000;
      row(old ? 'warn' : 'ok', 'Копія на Диску', st.bakAt ? agoUk(st.bakAt) : 'ще не робилась');
      row(FB.now() - st.syncAt > 7 * 86400000 ? 'warn' : 'ok', 'Синхронізація', agoUk(st.syncAt));
    } else row('warn', 'Копія й синхронізація', 'не підключено');
    row(st.saveFailed ? 'bad' : 'ok', 'Дані в телефоні', st.saveFailed ? 'не вдалося зберегти, бракує місця' : st.items + ' ' + plural(st.items, 'фільм', 'фільми', 'фільмів') + ', ' + st.kb + ' КБ');
    var bad = rows.filter(function (r) { return /st-bad/.test(r); }).length, warn = rows.filter(function (r) { return /st-warn/.test(r); }).length;
    return '<section class="panel health"><h2>Стан</h2><p class="sub" style="margin:0 0 8px">' + (bad ? 'Є проблема, гляньте червоний рядок.' : warn ? 'Усе працює, але є на що звернути увагу.' : 'Усе працює.') + '</p><ul class="hl">' + rows.join('') + '</ul></section>';
  }
  function renderMore() {
    var s = F.stats(), hasKey = !!F.keyOf();
    var h = '<div class="page-h"><h1>Ще</h1></div>';
    h += statusHtml();
    h += '<section class="panel"><h2>Ключ OMDb</h2><p class="sub" style="margin:0 0 10px">Усі дані про фільми беруться з OMDb. Безкоштовний ключ можна отримати на <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">omdbapi.com</a>: оберіть FREE, вкажіть пошту й підтвердіть її листом.</p>';
    h += '<form class="keyrow" data-form="key"><input type="text" id="key" name="key" value="' + esc(F.keyOf()) + '" placeholder="Ключ з листа" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Ключ OMDb"><button class="btn" type="submit">Зберегти</button></form>';
    h += '<p style="margin:10px 0 0"><button class="btn ghost sm" data-act="testkey"' + (hasKey ? '' : ' disabled') + '>Перевірити ключ</button></p>';
    if (ui.keyMsg) h += '<p class="' + (ui.keyMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.keyMsg.text) + '</p>';
    h += '<p class="fine">Ключ зберігається лише на цьому пристрої й не потрапляє в копію даних. OMDb приймає ключ лише в адресі запиту, тому нікому його не показуйте й не публікуйте.</p></section>';
    h += '<section class="panel"><h2>TMDB (необов’язково)</h2><p class="sub" style="margin:0 0 10px">З ключем TMDB у картці фільму з’являються склад акторів із фото, схожі фільми та українські назви й описи. Безкоштовний ключ: <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>. Підійде довгий «API Read Access Token» або короткий «API Key».</p>';
    h += '<form class="keyrow" data-form="tmdbkey"><input type="text" id="tmdbkey" name="tmdbkey" value="' + esc(F.tmdbKeyOf()) + '" placeholder="Ключ TMDB" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Ключ TMDB"><button class="btn" type="submit">Зберегти</button></form>';
    h += '<p style="margin:10px 0 0"><button class="btn ghost sm" data-act="testtmdb"' + (F.tmdbKeyOf() ? '' : ' disabled') + '>Перевірити ключ</button></p>';
    if (ui.tmdbMsg) h += '<p class="' + (ui.tmdbMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.tmdbMsg.text) + '</p>';
    h += '<p class="fine">Ключ зберігається лише на цьому пристрої й не потрапляє в копію даних. Цей додаток використовує TMDB API, але не схвалений і не сертифікований TMDB.</p></section>';
    h += '<section class="panel"><h2>Gemini (необов’язково)</h2><p class="sub" style="margin:0 0 10px">З ключем Gemini можна шукати фільми українською та перекладати сюжет. Без нього все працює, але назви треба вводити англійською.</p>';
    h += '<form class="keyrow" data-form="gemkey"><input type="text" id="gemkey" name="gemkey" value="' + esc(F.gemKeyOf()) + '" placeholder="Ключ Gemini" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Ключ Gemini"><button class="btn" type="submit">Зберегти</button></form>';
    h += '<p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="testgem"' + (F.gemKeyOf() ? '' : ' disabled') + '>Перевірити ключ</button>' + (!F.gemKeyOf() && F.foreignGemKey() ? '<button class="btn soft sm" data-act="usenutri">Взяти ключ із NutriPlan</button>' : '') + '</p>';
    if (ui.gemMsg) h += '<p class="' + (ui.gemMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.gemMsg.text) + '</p>';
    h += '<p class="fine">Ключ зберігається лише на цьому пристрої й не потрапляє в копію даних. До Google надсилається тільки назва, яку ви шукаєте, та опис фільму для перекладу. Це безкоштовно в межах ліміту Google.</p></section>';
    h += '<section class="panel"><h2>Ваша статистика</h2><div class="stats"><div class="stat"><div class="v">' + s.seen + '</div><div class="n">переглянуто</div></div><div class="stat"><div class="v">' + s.want + '</div><div class="n">в обраному</div></div><div class="stat"><div class="v">' + (s.avgMine == null ? '—' : s.avgMine.toFixed(1)) + '</div><div class="n">середня оцінка</div></div><div class="stat"><div class="v">' + (s.minutes ? esc(F.fmtMinutes(s.minutes)) : '—') + '</div><div class="n">часу за екраном</div></div></div>' + (s.topGenres.length ? '<p class="sub">Найчастіше: ' + s.topGenres.map(function (g) { return esc(F.genreUk(g.name)); }).join(', ') + '</p>' : '') + '</section>';
    h += yearPanel() + chartsPanel() + recordsPanel() + colPanel() + archPanel() + syncPanel();
    h += '<section class="panel"><h2>Копія даних</h2><p class="sub" style="margin:0 0 10px">Списки, оцінки й нотатки лежать тільки на цьому пристрої. Збережіть копію, щоб перенести їх на інший пристрій чи не втратити при очищенні браузера.</p><div class="actions" style="margin-top:0"><button class="btn ghost" data-act="export">' + ic('download', 'sm') + 'Зберегти копію</button><button class="btn ghost" data-act="import">' + ic('upload', 'sm') + 'Відновити</button></div><input type="file" id="import-file" accept="application/json,.json" class="hide">';
    if (ui.backupMsg) h += '<p class="' + (ui.backupMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.backupMsg.text) + '</p>';
    if (F.isSaveFailed()) h += '<p class="er-t">Телефон не дає зберегти дані. Звільніть місце або вимкніть приватний режим.</p>';
    h += '</section>';
    var nopeN = F.nopeCount();
    if (nopeN) h += '<p class="fine">Приховано з каталогу кнопкою «Не цікавить»: ' + nopeN + '. <button class="btn ghost sm" data-act="nopeclear">' + ic('eye', 'sm') + 'Повернути всі</button></p>';
    h += '<p class="fine"><button class="btn ghost sm" data-act="hardupd">' + ic('refresh', 'sm') + 'Оновити додаток</button></p>';
    h += '<p class="fine">Версія додатка: kinoman-' + F.VERSION + '. Дані фільмів: <a href="https://www.omdbapi.com/" target="_blank" rel="noopener">OMDb API</a>. Опис і назви англійською. Рейтинги належать IMDb, Rotten Tomatoes та Metacritic.</p>';
    return h;
  }

  // ---------- Картка фільму ----------
  function scoreClass(kind, v) {
    if (v == null) return 'none';
    if (kind === 'rt') return v >= 60 ? 'good' : 'bad';
    return v >= 61 ? 'good' : v >= 40 ? 'mid' : 'bad';
  }
  // Режисер: з ключем TMDB ім’я веде на сторінку з усією фільмографією
  function dirRow(it) {
    var names = String(it.director || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!names.length) return '';
    if (!F.tmdbKeyOf()) return dlRow('Режисер', it.director);
    return '<dt>Режисер</dt><dd>' + names.map(function (n) { return '<button type="button" class="lnk" data-act="dir" data-name="' + esc(n) + '">' + esc(n) + '</button>'; }).join(', ') + '</dd>';
  }
  function dlRow(k, v) { return v ? '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>' : ''; }
  function seasonBlock(sh, it, lib) {
    if (it.type !== 'series' || !it.totalSeasons) return '';
    var n = sh.season, h = '<h2>Сезони й серії</h2><div class="seasons" role="group" aria-label="Сезони">';
    for (var i = 1; i <= it.totalSeasons; i++) h += '<button type="button" data-act="season" data-n="' + i + '" aria-pressed="' + (n === i) + '">' + i + '</button>';
    h += '</div>';
    if (!n) return h + '<p class="sub">Оберіть сезон, щоб побачити серії й відмічати переглянуті.</p>';
    if (sh.loadingSeason === n) return h + '<div role="status" aria-label="Завантаження">' + skEps(6) + '</div>';
    if (sh.seasonError && sh.seasonError.n === n) return h + '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.seasonError.e)) + '</div></div>';
    var eps = (lib && lib.seasons[String(n)]) || sh.tmp[n];
    if (!eps) return h;
    if (!eps.length) return h + '<p class="sub">Для цього сезону OMDb не має списку серій.</p>';
    var w = lib ? F.seasonProgress(lib, n).watched : 0;
    h += '<p class="sub" style="margin:4px 0 0">Переглянуто ' + w + ' з ' + eps.length + '</p><div class="prog"><i style="width:' + Math.round(100 * w / eps.length) + '%"></i></div>';
    h += '<p style="margin:8px 0"><button class="btn ghost sm" data-act="season-all" data-on="' + (w === eps.length ? 0 : 1) + '">' + (w === eps.length ? 'Зняти всі позначки' : 'Позначити весь сезон') + '</button></p>';
    h += epChart(eps, n, lib);
    eps.forEach(function (e) {
      var on = lib && lib.watched[F.epKey(n, e.n)];
      h += '<button id="ep-' + e.n + '" class="ep' + (on ? ' on' : '') + '" data-act="ep" data-e="' + e.n + '" aria-pressed="' + (!!on) + '"><span class="box">' + ic('check', 'sm') + '</span><span class="et"><b>' + e.n + '. ' + esc(e.title || 'Без назви') + '</b>' + (e.released ? '<span>' + esc(e.released) + '</span>' : '') + '</span>' + (e.rating != null ? '<span class="er">' + e.rating.toFixed(1) + '</span>' : '') + '</button>';
    });
    return h;
  }
  // Оцінки серій IMDb (з OMDb) стовпчиками, як на IMDb: пунктир — середня, золотом — найкраща
  function epChart(eps, n, lib) {
    var rs = eps.filter(function (e) { return e.rating != null; });
    if (rs.length < 2) return '';
    var vals = rs.map(function (e) { return e.rating; }), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var hOf = function (v) { return Math.round(26 + (mx > mn ? (v - mn) / (mx - mn) : 0.5) * 46); };
    var bars = eps.map(function (e) {
      var on = lib && lib.watched[F.epKey(n, e.n)], best = e.rating != null && e.rating === mx;
      return '<button type="button" class="ebar' + (best ? ' best' : '') + (on ? ' on' : '') + '" data-act="epjump" data-e="' + e.n + '" aria-label="Серія ' + e.n + (e.rating != null ? ', IMDb ' + e.rating.toFixed(1) : ', без оцінки') + '">' + (e.rating != null ? '<span class="eb" style="height:' + hOf(e.rating) + 'px">' + e.rating.toFixed(1) + '</span>' : '<span class="eb none">—</span>') + '<span class="el">E' + e.n + '</span></button>';
    }).join('');
    return '<div class="echart"><p class="ehead">Оцінки серій IMDb <span class="avg">★ ' + avg.toFixed(1) + '</span> <span class="sub">у середньому</span></p><div class="escroll"><div class="ebars" style="--avg:' + (hOf(avg) + 22) + 'px">' + bars + '</div></div></div>';
  }
  function sheetTr(sh, lib, it) {
    var ex = sh.extras && sh.extras.data;
    if (lib && (lib.plotUk || lib.titleUk)) return { titleUk: lib.titleUk, plotUk: lib.plotUk };
    var t = sh.tr || {}; return { titleUk: t.titleUk || (ex && ex.titleUk) || '', plotUk: t.plotUk || (ex && ex.plotUk) || '' };
  }
  function initials(n) { return String(n).split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
  function exOf(sh, lib) { return lib && lib.xv >= 3 ? lib : (sh.extras && sh.extras.data) || lib || {}; }
  function watchRow(sh, lib, it, tr) {
    var x = exOf(sh, lib);
    var trailer = x.trailer ? 'https://www.youtube.com/watch?v=' + x.trailer : 'https://www.youtube.com/results?search_query=' + encodeURIComponent(it.title + ' ' + String(it.year).slice(0, 4) + ' трейлер');
    var av = sh.avail, line = '';
    if (av && av.loading) line = '<p class="avail wait">Київстар ТБ: перевіряю…</p>';
    else if (av && av.data) line = '<p class="avail ' + (av.data.sub || av.data.free ? 'yes' : av.data.found ? 'paid' : 'no') + '">' + esc(F.kyivstarText(av.data)) + '<small>за даними TMDB</small></p>';
    return '<div class="watch"><a class="btn sm trailer" href="' + esc(trailer) + '" target="_blank" rel="noopener">' + ic('play', 'sm') + 'Трейлер</a>' +
      '</div>' + line;
  }
  function nextBlock(sh, lib, it) {
    if (it.type !== 'series') return '';
    var x = exOf(sh, lib), parts = [];
    if (lib && lib.status === 'watching') { var nx = F.nextForMe(lib); parts.push(nx ? '<div><span>Далі для вас</span><b>' + F.epCode(nx) + '</b></div>' : '<div><span>Далі для вас</span><b>Усе переглянуто</b></div>'); }
    if (x.nextAir) parts.push('<div><span>Нова серія</span><b>' + esc(F.dateUk(x.nextAir.date)) + (x.nextAir.s ? ' (S' + x.nextAir.s + 'E' + x.nextAir.e + ')' : '') + '</b></div>');
    else if (x.tvStatus === 'Ended' || x.tvStatus === 'Canceled') parts.push('<div><span>Статус</span><b>' + (x.tvStatus === 'Ended' ? 'Серіал завершено' : 'Серіал закрито') + '</b></div>');
    else if (x.tvStatus === 'Returning Series') parts.push('<div><span>Статус</span><b>Буде продовження, дату ще не оголосили</b></div>');
    return parts.length ? '<div class="nextinfo">' + parts.join('') + '</div>' : '';
  }
  function colBlock(lib) {
    if (!lib) return '';
    var cols = F.colList();
    return '<h2>Добірки</h2><div class="chips cols" role="group" aria-label="Добірки"><button class="chip two' + (lib.two ? ' on' : '') + '" data-act="togtwo" aria-pressed="' + !!lib.two + '">' + ic('heart', 'sm') + 'Для двох</button><button class="chip fam' + (lib.fam ? ' on' : '') + '" data-act="togfam" aria-pressed="' + !!lib.fam + '">' + ic('home', 'sm') + 'Сімейні</button>' + cols.map(function (c) { var on = lib.cols.indexOf(c.id) >= 0; return '<button class="chip' + (on ? ' on' : '') + '" data-act="togcol" data-c="' + c.id + '" aria-pressed="' + on + '">' + (on ? ic('check', 'sm') : '') + esc(c.name) + '</button>'; }).join('') + '<button class="chip" data-act="newcol">' + ic('plus', 'sm') + 'Нова добірка</button></div>';
  }
  function personHtml(sh) {
    var p = sh.person, d = sh.pdata;
    var h = '<div class="sheetbar">' + (ui.stack.length ? '<button class="back" data-act="back" aria-label="Назад">' + ic('left') + '</button>' : '') + '<button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div>';
    var photo = (d && d.photo) || p.photo, fol = d && F.isFollowed(d.id);
    h += '<div class="phero"><span class="pic big"><span class="ph">' + esc(initials(p.name)) + '</span>' + (photo ? '<img src="' + esc(F.tmdbImg(photo, 'w342')) + '" alt="" referrerpolicy="no-referrer">' : '') + '</span><h3>' + esc((d && d.name) || p.name) + '</h3>' +
      (d && (d.born || d.place) ? '<div class="meta">' + esc([d.born ? F.dateUk(d.born) : '', d.place].filter(Boolean).join(', ')) + '</div>' : '') +
      (d ? '<p class="pfol"><button class="btn sm' + (fol ? ' soft' : '') + '" data-act="follow" aria-pressed="' + !!fol + '">' + ic(fol ? 'check' : 'plus', 'sm') + (fol ? 'Стежу' : 'Стежити') + '</button><span>' + (fol ? 'Нові фільми з’являться в «Скоро» й календарі' : 'Щоб нові фільми з’являлися в «Скоро»') + '</span></p>' : '') + '</div><div class="body">';
    if (sh.pnone) return h + '<div class="notice">' + ic('alert') + '<div>Не знайшли цю людину в TMDB.</div></div></div>';
    if (sh.perr) return h + '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.perr)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="reperson">Спробувати ще раз</button></p></div></div></div>';
    if (!d) return h + '<div role="status" aria-label="Завантаження">' + skLines(4) + '<div class="tgrid" style="margin-top:22px">' + skTiles(6) + '</div></div></div>';
    if (d.bio) h += '<p class="plot bio' + (sh.bioOpen ? ' open' : '') + '">' + esc(d.bio) + '</p>' + (d.bio.length > 320 ? '<p style="margin:0"><button class="btn ghost sm" data-act="bio">' + (sh.bioOpen ? 'Згорнути' : 'Читати далі') + '</button></p>' : '');
    var soon = (d.soon || []).filter(function (x) { return !F.isNope(x.mt, x.tid); });
    if (soon.length) h += '<h2>Скоро вийде</h2><div class="soonlist">' + soon.slice(0, 8).map(function (x) {
      var q = x.date.split('-'), st = F.tmdbStatus(x.mt, x.tid);
      return '<button class="soonrow" data-act="cat"' + catData({ mt: x.mt, tid: x.tid, title: x.title, year: q[0], poster: x.poster }) + '><span class="sd"><b>' + Number(q[2]) + '</b><span>' + MON_S[Number(q[1]) - 1] + ' ' + q[0].slice(2) + '</span></span><span class="st"><b>' + esc(x.title) + '</b><span>' + (x.job === 'dir' ? 'Режисер' : 'У ролях') + (x.mt === 'tv' ? ', серіал' : '') + (st ? ', уже у ваших списках' : '') + '</span></span></button>';
    }).join('') + '</div>';
    var sec = function (title, arr, flag) {
      if (!arr || !arr.length) return '';
      // згорнутий список: на телефоні 12 (чотири рядки по три), на ПК — рівно два повні рядки (обрізає fitGrids)
      var open = !!sh[flag], a = open ? arr : arr.slice(0, isDesktop() ? 40 : 12);
      return '<h2>' + title + '<small class="cnt">' + arr.length + '</small></h2><div class="tgrid"' + (open ? '' : ' data-fit="' + arr.length + '"') + '>' + a.map(function (r) { return catTile(r).replace('</span></button>', '</span>' + (r.character ? '<span class="role">' + esc(r.character) + '</span>' : '') + '</button>'); }).join('') + '</div>' +
        (arr.length > 12 ? '<p class="fitbtn" style="margin:16px 0 0"><button class="btn ghost block" data-act="allknown" data-k="' + flag + '">' + (open ? 'Згорнути' : 'Показати всі ' + arr.length) + '</button></p>' : '');
    };
    var dirs = sec('Режисерські роботи', d.directed, 'allDir'), roles = sec(d.directed && d.directed.length ? 'Ролі' : 'Фільми й серіали', d.known, 'allKnown');
    h += d.dept === 'dir' || (d.directed && d.directed.length > d.known.length) ? dirs + roles : roles + dirs;
    return h + '</div>';
  }
  // p.id = 0: людину знаємо лише на ім’я (режисер із картки фільму), тож спершу шукаємо її в TMDB
  async function openPerson(p) {
    ui.sheet = { person: { id: Number(p.id) || 0, name: p.name || '', photo: p.photo || '' }, pdata: null, perr: null, pnone: false };
    renderSheet(); var sh = ui.sheet;
    try {
      if (!sh.person.id) { var f = await F.findPerson(sh.person.name); if (ui.sheet !== sh) return; if (!f) { sh.pnone = true; renderSheet(); return; } sh.person.id = f.id; sh.person.photo = f.photo; }
      var d = await F.person(sh.person.id);
      if (ui.sheet === sh) { sh.pdata = d; if (!sh.person.name) sh.person.name = d.name; if (!sh.person.photo) sh.person.photo = d.photo; renderSheet(); }
    }
    catch (e) { if (ui.sheet === sh) { sh.perr = e; renderSheet(); } }
  }
  function pushCurrent() {
    var cur = ui.sheet; if (!cur || cur.wheel || cur.duo) return;
    if (cur.cal) { var cl = $('.sheet', sheetRoot); ui.stack.push({ cal: true, scroll: cl ? cl.scrollTop : 0 }); return; }
    if (cur.coll) { var cs = $('.sheet', sheetRoot); cur.coll.scroll = cs ? cs.scrollTop : 0; ui.stack.push({ coll: cur.coll }); }
    else if (cur.person) ui.stack.push({ person: cur.person });
    else if (cur.pend) ui.stack.push({ pend: cur.pend, brief: cur.brief });
    else ui.stack.push({ id: cur.id, brief: cur.brief || (cur.item ? F.brief(cur.item) : null) });
  }
  // ---------- Колесо «Що дивимось?» ----------
  function wheelHtml(sh) {
    var w = sh.wheel, n = w.items.length, a = 360 / n, R = 150, cx = 160, cy = 160;
    var segs = w.items.map(function (it, i) {
      var a0 = (i * a - 90) * Math.PI / 180, a1 = ((i + 1) * a - 90) * Math.PI / 180, mid = (i + 0.5) * a;
      var p = 'M' + cx + ' ' + cy + ' L' + (cx + R * Math.cos(a0)).toFixed(1) + ' ' + (cy + R * Math.sin(a0)).toFixed(1) + ' A' + R + ' ' + R + ' 0 ' + (a > 180 ? 1 : 0) + ' 1 ' + (cx + R * Math.cos(a1)).toFixed(1) + ' ' + (cy + R * Math.sin(a1)).toFixed(1) + ' Z';
      var t = (it.titleUk || it.title); t = t.length > 15 ? t.slice(0, 14) + '…' : t;
      return '<path d="' + p + '" fill="hsl(' + hue(it.id) + ' 55% ' + (i % 2 ? 30 : 38) + '%)" stroke="rgba(0,0,0,.35)" stroke-width="1"/><text transform="rotate(' + (mid - 90).toFixed(1) + ' ' + cx + ' ' + cy + ')" x="' + (cx + 28) + '" y="' + (cy + 4) + '" class="wt">' + esc(t) + '</text>';
    }).join('');
    var h = '<div class="sheetbar"><button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div><div class="wheel-wrap"><h3>Що дивимось?</h3><p class="sub">Колесо обере з ваших «Обраних»</p>' +
      '<div class="wheel"><i class="pin" aria-hidden="true"></i><svg id="wheel-svg" viewBox="0 0 320 320" style="transform:rotate(' + w.from + 'deg)" role="img" aria-label="Колесо з ' + n + ' фільмів">' + segs + '<circle cx="160" cy="160" r="26" class="hub"/></svg></div>';
    if (w.pick != null) { var it = w.items[w.pick]; h += '<div class="wres" role="status"><span class="sub">Сьогодні дивимось</span><b>' + esc(it.titleUk || it.title) + '</b><div class="acts"><button class="btn" data-act="open" data-id="' + it.id + '">Відкрити</button><button class="btn ghost" data-act="spin">' + ic('refresh', 'sm') + 'Ще раз</button></div></div>'; }
    else h += '<div class="wres"><button class="btn" data-act="spin"' + (w.spinning ? ' disabled' : '') + '>' + (w.spinning ? 'Крутиться…' : 'Крутити') + '</button></div>';
    return h + '</div>';
  }
  // ---------- Вечір удвох ----------
  function duoHtml() {
    var d = ui.duo, gs = F.genres('want').slice(0, 12);
    var h = '<div class="sheetbar"><button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div><div class="duo"><h3>Вечір удвох</h3><p class="sub">Кожен обирає, що любить. Підберемо з ваших «Обраних» те, що підійде обом.</p>';
    ['a', 'b'].forEach(function (w, n) {
      h += '<h4>Хто ' + (n + 1) + '-й: жанри <span class="sub">(можна пропустити)</span></h4><div class="chips" role="group" aria-label="Жанри ' + (n + 1) + '-го">' + gs.map(function (g) { return '<button class="chip' + (d[w].indexOf(g.name) >= 0 ? ' on' : '') + '" data-act="duog" data-who="' + w + '" data-g="' + esc(g.name) + '" aria-pressed="' + (d[w].indexOf(g.name) >= 0) + '">' + esc(F.genreUk(g.name)) + '</button>'; }).join('') + '</div>';
    });
    h += '<h4>Скільки є часу</h4><div class="chips" role="group" aria-label="Час">' + [[0, 'Не важливо'], [100, 'До 100 хв'], [130, 'До 130 хв']].map(function (o) { return '<button class="chip' + (d.max === o[0] ? ' on' : '') + '" data-act="duom" data-v="' + o[0] + '" aria-pressed="' + (d.max === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
    h += '<h4>Що саме</h4><div class="chips" role="group" aria-label="Тип">' + [['', 'Усе'], ['movie', 'Фільм'], ['series', 'Серіал']].map(function (o) { return '<button class="chip' + (d.type === o[0] ? ' on' : '') + '" data-act="duot" data-v="' + o[0] + '" aria-pressed="' + (d.type === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
    var res = F.duoPick(d.a, d.b, d.max, d.type);
    h += '<h4>Підійде</h4>';
    if (!res.length) return h + '<div class="notice">' + ic('film') + '<div>Нічого не підійшло. Спробуйте прибрати жанр чи обмеження за часом.</div></div></div>';
    return h + '<div class="duores">' + res.map(function (r) {
      return '<button class="duorow" data-act="open" data-id="' + r.item.id + '"><span class="poster"><span class="ph">' + esc(r.item.title) + '</span>' + (r.item.poster ? '<img src="' + esc(r.item.poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><span class="nt"><b>' + esc(r.item.titleUk || r.item.title) + '</b><span>' + (r.both ? 'Підходить обом' : 'Підходить одному') + (r.item.runtime ? ', ' + esc(F.fmtMinutes(r.item.runtime)) : '') + '</span></span></button>';
    }).join('') + '</div></div>';
  }
  function openDuo() { ui.duo = { a: [], b: [], max: 0, type: '' }; ui.sheet = { duo: true }; ui.stack = []; renderSheet(); }

  // ---------- Картинка для поширення ----------
  function loadImg(src) {
    return new Promise(function (res) {
      if (!src || !/^https:\/\//.test(src)) return res(null);
      var im = new Image(), done = false, fin = function (v) { if (!done) { done = true; res(v); } };
      im.crossOrigin = 'anonymous'; im.onload = function () { fin(im); }; im.onerror = function () { fin(null); };
      setTimeout(function () { fin(null); }, 6000); im.src = src;
    });
  }
  async function shareFilmImage(id) {
    var it = F.getItem(id); if (!it) return;
    try { if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load('800 80px Unbounded'), document.fonts.load('600 40px Onest')]); } catch (e) { /* стандартний шрифт */ }
    var im = await loadImg(it.poster);
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1350; var g = c.getContext('2d'); if (!g) { toast('Телефон не дав створити картинку.'); return; }
    var hu = hue(it.id), bg = g.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, 'hsl(' + hu + ' 55% 18%)'); bg.addColorStop(1, '#0C0A12'); g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    var D = '"Unbounded", "Onest", system-ui, sans-serif', B = '"Onest", system-ui, sans-serif', name = it.titleUk || it.title;
    var px = 80, py = 80, pw = 480, ph = 720;
    g.save(); g.beginPath(); if (g.roundRect) g.roundRect(px, py, pw, ph, 28); else g.rect(px, py, pw, ph); g.clip();
    if (im) { var sc = Math.max(pw / im.width, ph / im.height), w = im.width * sc, h2 = im.height * sc; g.drawImage(im, px + (pw - w) / 2, py + (ph - h2) / 2, w, h2); }
    else { g.fillStyle = 'hsl(' + hu + ' 50% 28%)'; g.fillRect(px, py, pw, ph); g.fillStyle = '#F3EEF6'; g.font = '800 48px ' + D; wrapText(g, name, px + 30, py + 300, pw - 60, 58, 4); }
    g.restore();
    var x = 620, y = 150;
    g.fillStyle = '#F5C518'; g.font = '900 120px ' + D; g.fillText(it.ratings.imdb != null ? it.ratings.imdb.toFixed(1) : '—', x, y + 80); g.fillStyle = '#9D95AE'; g.font = '600 32px ' + B; g.fillText('IMDb', x, y + 130);
    if (it.myRating) { g.fillStyle = '#FF4F8B'; g.font = '900 120px ' + D; g.fillText(String(it.myRating), x, y + 330); g.fillStyle = '#9D95AE'; g.font = '600 32px ' + B; g.fillText('моя оцінка з 10', x, y + 380); }
    if (it.ratings.rt != null) { g.fillStyle = '#F3EEF6'; g.font = '800 54px ' + D; g.fillText(it.ratings.rt + '%', x, y + (it.myRating ? 500 : 330)); g.fillStyle = '#9D95AE'; g.font = '600 32px ' + B; g.fillText('Rotten Tomatoes', x, y + (it.myRating ? 548 : 378)); }
    g.fillStyle = '#F3EEF6'; g.font = '800 64px ' + D; var ny = wrapText(g, name, 80, 930, 920, 76, 3);
    g.fillStyle = '#9D95AE'; g.font = '600 36px ' + B; g.fillText([String(it.year || '').slice(0, 4), it.genre.slice(0, 3).map(F.genreUk).join(', ')].filter(Boolean).join('  |  '), 80, ny + 20);
    if (it.note) { g.fillStyle = '#F3EEF6'; g.font = 'italic 600 38px ' + B; wrapText(g, '«' + it.note.replace(/\s+/g, ' ').slice(0, 140) + (it.note.length > 140 ? '…' : '') + '»', 80, ny + 90, 920, 52, 3); }
    g.fillStyle = '#FF4F8B'; g.beginPath(); g.arc(92, 1262, 12, 0, 7); g.fill(); g.fillStyle = '#F3EEF6'; g.font = '800 40px ' + D; g.fillText('Kinoman', 120, 1276);
    c.toBlob(async function (blob) {
      if (!blob) { toast('Не вдалося зберегти картинку.'); return; }
      var fn = 'kinoman-' + it.id + '.png', file = null; try { file = new File([blob], fn, { type: 'image/png' }); } catch (e) { /* старий браузер */ }
      try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(im ? 'Картинку збережено' : 'Картинку збережено без постера');
    }, 'image/png');
  }
  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    var words = String(text).split(/\s+/), line = '', n = 0;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (g.measureText(t).width > maxW && line) { if (++n >= maxLines) { line += '…'; break; } g.fillText(line, x, y); y += lh; line = words[i]; } else line = t;
    }
    g.fillText(line, x, y); return y + lh;
  }
  function colsChart(title, arr) {
    var mx = Math.max.apply(null, arr.map(function (x) { return x.n; })); if (!(mx > 0)) return '';
    return '<h3 class="ch">' + title + '</h3><div class="cols" role="img" aria-label="' + esc(title + ': ' + arr.map(function (x) { return x.k + ' ' + x.n; }).join(', ')) + '">' + arr.map(function (x) { return '<div class="col"><span class="cn">' + (x.n || '') + '</span><i style="height:' + (x.n ? Math.max(6, Math.round(x.n / mx * 100)) : 2) + '%"></i><span class="ck">' + esc(x.k) + '</span></div>'; }).join('') + '</div>';
  }
  function barsChart(title, arr) {
    var mx = Math.max.apply(null, arr.map(function (x) { return x.n; })); if (!(mx > 0)) return '';
    return '<h3 class="ch">' + title + '</h3><div class="hbars">' + arr.map(function (x) { return '<div class="hb"><span class="hk">' + esc(x.k) + '</span><span class="hv"><i style="width:' + Math.max(4, Math.round(x.n / mx * 100)) + '%"></i></span><b>' + x.n + '</b></div>'; }).join('') + '</div>';
  }
  function chartsPanel() {
    var c = F.charts(), h = '<section class="panel"><h2>Статистика</h2>';
    var rated = c.ratings.some(function (x) { return x.n > 0; });
    if (!c.total && !rated) return h + '<p class="sub">Графіки з’являться, коли ви почнете позначати переглянуте й ставити оцінки.</p></section>';
    h += colsChart('Переглянуто за останні 12 місяців', c.months) + (c.years.length > 1 ? colsChart('Переглянуто за роками', c.years) : '') + barsChart('Улюблені жанри', c.genres) + colsChart('Ваші оцінки', c.ratings);
    return h + '</section>';
  }
  function recordsPanel() {
    var r = F.records(); var h = '<section class="panel"><h2>Мої рекорди</h2>';
    if (!r.length) return h + '<p class="sub">Тут з’являться ваші рекорди: найдовший серіал, найвища оцінка та інше. Позначайте переглянуте й ставте оцінки.</p></section>';
    return h + '<div class="recs">' + r.map(function (x) { return '<div class="rec-row"><span class="sub">' + esc(x.k) + '</span><b>' + esc(x.v) + '</b><span>' + esc(x.n) + '</span></div>'; }).join('') + '</div></section>';
  }
  // Постери наперед, щоб вони були й без інтернету (кеш робить сервіс-воркер)
  function warmPosters() {
    if (!window.caches) return;
    var urls = []; F.list('want').concat(F.list('watching'), F.list('seen')).forEach(function (it) { if (it.poster && /^https:\/\//.test(it.poster) && urls.indexOf(it.poster) < 0) urls.push(it.poster); });
    urls = urls.slice(0, 60); var i = 0;
    (function next() {
      if (i >= urls.length) return; var u = urls[i++];
      caches.match(u).then(function (hit) { if (hit) return; return new Promise(function (r) { var im = new Image(); im.onload = im.onerror = function () { r(); }; im.referrerPolicy = 'no-referrer'; im.src = u; setTimeout(r, 4000); }); }).then(function () { setTimeout(next, 150); }, function () { setTimeout(next, 150); });
    })();
  }

  function openWheel() {
    var all = F.list('want', HD(ui.lists.want)).slice(); for (var i = all.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = all[i]; all[i] = all[j]; all[j] = t; }
    ui.sheet = { wheel: { items: all.slice(0, 10), from: 0, spinning: false, pick: null } }; ui.stack = []; renderSheet();
  }
  function spinWheel() {
    var sh = ui.sheet; if (!sh || !sh.wheel || sh.wheel.spinning) return; var w = sh.wheel, n = w.items.length, a = 360 / n;
    var k = Math.floor(Math.random() * n), jitter = (Math.random() - 0.5) * a * 0.6;
    var to = w.from - (w.from % 360) + 360 * 6 + (360 - (k + 0.5) * a) + jitter;
    w.spinning = true; w.pick = null; renderSheet();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var svg = $('#wheel-svg'); if (svg) { svg.getBoundingClientRect(); svg.style.transition = reduce ? 'none' : 'transform ' + (FB.wheelMs / 1000) + 's cubic-bezier(.15,.85,.2,1)'; svg.style.transform = 'rotate(' + to + 'deg)'; }
    w.from = to; w.target = k;
    setTimeout(function () { if (ui.sheet !== sh) return; w.spinning = false; w.pick = k; renderSheet(); }, reduce ? 50 : FB.wheelMs);
  }
  FB.wheelMs = 4300;
  function castBlock(sh, lib) {
    if (!F.tmdbKeyOf()) return '<div class="notice">' + ic('film') + '<div><b>Актори з фото й схожі фільми</b><div class="sub">Додайте безкоштовний ключ TMDB у розділі «Ще», і тут з’являться склад, ролі та добірка схожого.</div><p style="margin:10px 0 0"><button class="btn sm" data-act="sheet-more">Додати ключ TMDB</button></p></div></div>';
    var ex = sh.extras || {}, cast = lib && lib.cast.length ? lib.cast : (ex.data && ex.data.cast) || [];
    if (cast.length) return '<h2>Актори</h2><div class="strip">' + cast.map(function (c) {
      return '<button class="person"' + (c.id ? ' data-act="person" data-pid="' + c.id + '" data-name="' + esc(c.name) + '" data-photo="' + esc(c.photo) + '"' : ' disabled') + '><span class="pic"><span class="ph">' + esc(initials(c.name)) + '</span>' + (c.photo ? '<img src="' + esc(F.tmdbImg(c.photo, 'w185')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><b>' + esc(c.name) + '</b>' + (c.character ? '<span>' + esc(c.character) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    if (ex.loading) return '<h2>Актори</h2><div class="strip" role="status" aria-label="Завантажуємо акторів">' + skPeople(6) + '</div>';
    if (ex.error) return '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(ex.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="extras">Спробувати ще раз</button></p></div></div>';
    return '';
  }
  function recsBlock(sh, lib) {
    var ex = sh.extras || {}, recs = lib && lib.recs.length ? lib.recs : (ex.data && ex.data.recs) || [];
    if (!recs.length) return '';
    return '<h2>Схожі фільми й серіали</h2><div class="strip">' + recs.map(function (r) {
      return '<button class="rec" data-act="rec" data-mt="' + r.mt + '" data-tid="' + r.tid + '"><span class="poster"><span class="ph">' + esc(r.title) + '</span>' + (r.poster ? '<img src="' + esc(F.tmdbImg(r.poster, 'w185')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><span class="name">' + esc(r.title) + '</span><span class="yr">' + esc(r.year) + (r.mt === 'tv' ? ', серіал' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  function sheetHtml() {
    if (ui.sheet.cal) return calHtml();
    var sh = ui.sheet;
    if (sh.person) return personHtml(sh);
    if (sh.wheel) return wheelHtml(sh);
    if (sh.duo) return duoHtml();
    if (sh.coll) return collHtml(sh);
    var lib = F.getItem(sh.id), it = lib || sh.item;
    var hdr = '<div class="sheetbar">' + (ui.stack.length ? '<button class="back" data-act="back" aria-label="Назад">' + ic('left') + '</button>' : '') + '<button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div>';
    if (!it) {
      var b = sh.brief;
      return hdr + '<div class="hero"><div class="in">' + posterHtml(b && b.poster, b ? b.title : '') + '<div class="info"><h3>' + esc(b ? b.title : '') + '</h3><div class="meta">' + (b ? esc(typeLabel(b.type)) + (b.year ? ', ' + esc(b.year) : '') : '') + '</div></div></div></div><div class="body">' +
        (sh.error ? '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="retry">Спробувати ще раз</button></p></div></div>' : sheetSk()) + '</div>';
    }
    var r = it.ratings, tr = sheetTr(sh, lib, it), age = F.ageOf(it);
    var bk = isDesktop() ? F.backOf(it.id) : '';
    if (lib) needBack(lib, function () { if (ui.sheet === sh) renderSheet(); });
    var h = hdr + '<div class="hero glow' + (bk ? ' has-back' : '') + '" style="--h:' + hue(it.id) + '">' + (bk ? '<div class="bd" style="background-image:url(\'' + esc(F.tmdbImg(bk, 'w1280')) + '\')"></div>' : '') + '<div class="bg" style="' + (it.poster ? 'background-image:url(\'' + esc(it.poster) + '\')' : '') + '"></div><div class="in">' + posterHtml(it.poster, it.title) + '<div class="info"><h3>' + esc(tr.titleUk || it.title) + '</h3><div class="meta">' + (tr.titleUk && tr.titleUk !== it.title ? esc(it.title) + '<br>' : '') + esc(typeLabel(it.type)) + (it.year ? ', ' + esc(it.year) : '') + (it.runtime ? '<br>' + esc(F.fmtMinutes(it.runtime)) + (it.type === 'series' ? ' за серію' : '') : '') + (it.rated && age == null ? '<br>' + esc(it.rated) : '') + '</div>' + (age != null ? '<div class="agerow">' + ageBadge(it) + '<span>' + esc(AGE_TXT[age]) + '</span></div>' : '') + '</div></div></div><div class="body">';
    h += '<div class="scores"><div class="score imdb"><div class="v">' + (r.imdb != null ? r.imdb.toFixed(1) + '<small>/10</small>' : '—') + '</div><div class="n">IMDb' + (r.votes ? ', ' + esc(r.votes) : '') + '</div></div>' +
      '<div class="score ' + scoreClass('rt', r.rt) + '"><div class="v">' + (r.rt != null ? r.rt + '<small>%</small>' : '—') + '</div><div class="n">Rotten Tomatoes</div></div>' +
      '<div class="score ' + scoreClass('meta', r.meta) + '"><div class="v">' + (r.meta != null ? r.meta + '<small>/100</small>' : '—') + '</div><div class="n">Metacritic</div></div></div>';
    h += watchRow(sh, lib, it, tr);
    if (it.genre.length) h += '<div class="tags">' + it.genre.map(function (g) { return '<span class="tag">' + esc(F.genreUk(g)) + '</span>'; }).join('') + '</div>';
    var seen = !!(lib && lib.status === 'seen');
    h += '<div class="ticket"><div class="tk-top">' + (seen ? '<span class="stamp' + (sh.stamp ? ' pop' : '') + '">ПЕРЕГЛЯНУТО</span>' : '') +
      '<div class="status">' + [['want', 'heart', 'Обране'], ['watching', 'play', 'Дивлюсь'], ['seen', 'eye', 'Переглянуто']].map(function (c) { var on = !!(lib && lib.status === c[0]); return '<button class="btn ghost' + (on ? ' on' : '') + '" data-act="status" data-st="' + c[0] + '" aria-pressed="' + on + '">' + ic(c[1], 'sm') + '<span>' + c[2] + '</span></button>'; }).join('') + '</div>';
    if (seen && lib.seenAt) h += '<p class="tk-date">Переглянуто ' + esc(new Date(lib.seenAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p>';
    sh.stamp = false;
    h += '</div><div class="tk-cut"><i></i></div><div class="tk-bot"><div class="tk-h">Моя оцінка' + (lib && lib.myRating ? ': ' + lib.myRating + ' з 10' : '') + '</div><div class="scale" role="group" aria-label="Моя оцінка">';
    for (var i = 1; i <= 10; i++) h += '<button type="button" data-act="rate" data-n="' + i + '" class="' + (lib && lib.myRating === i ? 'on' : lib && lib.myRating && i < lib.myRating ? 'fill' : '') + '" aria-label="Оцінка ' + i + '" aria-pressed="' + !!(lib && lib.myRating === i) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/></svg></button>';
    h += '</div>';
    if (lib) h += '<div class="tk-note"><label class="fl" for="note">Нотатка</label><textarea id="note" data-input="note" maxlength="1000" placeholder="З ким дивились, що сподобалось, кому порадити">' + esc(lib.note) + '</textarea></div>';
    if (lib && lib.status !== 'seen') h += '<div class="tk-plan"><label class="fl" for="plan">Запланувати перегляд</label><div class="planrow"><input type="date" id="plan" data-change="plan" min="' + F.ymd(FB.now()) + '" value="' + esc(lib.planAt) + '">' + (lib.planAt ? '<button class="btn ghost sm" data-act="planclear">Скасувати</button>' : '') + '</div></div>';
    h += '</div></div>';
    if (it.plot) {
      var showUk = tr.plotUk && !sh.showOrig;
      h += '<h2>Сюжет</h2><p class="plot">' + esc(showUk ? tr.plotUk : it.plot) + '</p>';
      if (tr.plotUk) h += '<p style="margin:0"><button class="btn ghost sm" data-act="toggle-orig">' + (showUk ? 'Показати оригінал' : 'Показати переклад') + '</button></p>';
      else if (sh.translating) h += skWait('Перекладаємо', 4);
      else h += '<p style="margin:0"><button class="btn ghost sm" data-act="translate">' + ic('sparkle', 'sm') + 'Перекласти українською</button></p>' + (sh.trError ? '<p class="er-t" role="status" style="margin:8px 0 0">' + esc(sh.trError) + '</p>' : '');
    }
    h += reviewBlock(sh, it);
    h += recapBlock(sh, it, lib);
    h += colBlock(lib);
    h += castBlock(sh, lib);
    var dl = dirRow(it) + dlRow('Сценарій', it.writer) + dlRow('У ролях', (lib && lib.cast.length) || (sh.extras && sh.extras.data && sh.extras.data.cast.length) ? '' : it.actors) + dlRow('Вихід', F.dateUk(it.released)) + dlRow('Країна', F.countryUk(it.country)) + dlRow('Мова', F.langUk(it.language)) + dlRow('Нагороди', it.awards);
    if (dl) h += '<dl class="dl">' + dl + '</dl>';
    h += nextBlock(sh, lib, it);
    h += seasonBlock(sh, it, lib);
    h += marLink(sh, lib);
    h += recsBlock(sh, lib);
    h += '<div class="actions"><a class="btn ghost sm" href="https://www.imdb.com/title/' + esc(it.id) + '/" target="_blank" rel="noopener">' + ic('link', 'sm') + 'Відкрити в IMDb</a>';
    h += '<button class="btn ghost sm" data-act="sharelink">' + ic('upload', 'sm') + 'Надіслати посилання</button>';
    if (lib) h += '<button class="btn ghost sm" data-act="shareimg" data-id="' + esc(lib.id) + '">' + ic('download', 'sm') + 'Картинка' + '</button>';
    if (lib) h += '<button class="btn ghost sm" data-act="refresh"' + (sh.refreshing ? ' disabled' : '') + '>' + ic('refresh', 'sm') + (sh.refreshing ? 'Оновлюємо…' : 'Оновити рейтинги') + '</button><button class="btn danger sm" data-act="remove">' + ic('trash', 'sm') + 'Видалити зі списків</button>';
    if (lib) h += '<button class="btn ghost sm" data-act="arch" data-on="' + (lib.arch ? '' : '1') + '">' + ic('archive', 'sm') + (lib.arch ? 'Повернути з архіву' : 'В архів') + '</button>';
    h += '</div>';
    if (sh.error) h += '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.error)) + '</div></div>';
    if (lib && lib.fetchedAt) h += '<p class="fine">Рейтинги станом на ' + esc(new Date(lib.fetchedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })) + ' Вони змінюються, тож за потреби оновіть.</p>';
    return h + '</div>';
  }
  // ПК: у згорнутій сітці лишаємо рівно два повні рядки, щоб другий рядок не був напівпорожній
  // Поки є «Показати ще», неповний останній ряд ховаємо: він з'явиться разом із наступною порцією
  function tailGrids() {
    Array.prototype.forEach.call(document.querySelectorAll('.tgrid'), function (g) {
      var kids = g.children, n = kids.length, i, nx = g.nextElementSibling, more = !!(nx && nx.classList.contains('morewrap'));
      for (i = 0; i < n; i++) kids[i].classList.remove('tail-hide');
      if (!more) return;
      var cols = String(getComputedStyle(g).gridTemplateColumns || '').split(' ').filter(Boolean).length; if (!(cols > 1) || n <= cols) return;
      for (i = n - (n % cols); i < n; i++) kids[i].classList.add('tail-hide');
    });
  }
  var tailT = 0;
  function tailSoon() { if (tailT) return; tailT = requestAnimationFrame(function () { tailT = 0; tailGrids(); }); }
  function fitGrids() {
    if (!isDesktop()) return;
    Array.prototype.forEach.call(sheetRoot.querySelectorAll('.tgrid[data-fit]'), function (g) {
      var cols = String(getComputedStyle(g).gridTemplateColumns || '').split(' ').filter(Boolean).length; if (!(cols > 0)) return;
      var total = Number(g.getAttribute('data-fit')) || 0, have = g.children.length, keep = Math.max(cols, Math.min(have, cols * 2));
      if (have < total) keep -= keep % cols;
      while (g.children.length > keep) g.removeChild(g.lastElementChild);
      var btn = g.nextElementSibling; if (btn && btn.classList.contains('fitbtn') && g.children.length >= total) btn.remove();
    });
  }
  function renderSheet() {
    syncExtras();
    document.documentElement.classList.toggle('has-sheet', !!ui.sheet);
    if (!ui.sheet) { sheetRoot.innerHTML = ''; document.body.style.overflow = ''; ambReset(); histSync(); return; }
    if (ui.sheet.id || ui.sheet.pend) { var ai = ui.sheet.item || ui.sheet.brief || F.getItem(ui.sheet.id); if (ai && ai.poster) setAmb(ai.poster, ui.sheet.id || ui.sheet.pend.tid, false); }
    if (peekEl) peekHide();
    var old = $('.sheet', sheetRoot), top = old ? old.scrollTop : 0, again = !!old;
    sheetRoot.innerHTML = '<div class="scrim' + (again ? ' static' : '') + '" data-act="scrim"><div class="sheet' + (ui.sheet.wheel ? ' wheel-sheet' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(ui.sheet.person ? ui.sheet.person.name : ui.sheet.wheel ? 'Колесо' : ui.sheet.duo ? 'Вечір удвох' : ui.sheet.coll ? ui.sheet.coll.title : (ui.sheet.item || ui.sheet.brief || {}).title || 'Картка') + '">' + sheetHtml() + '</div></div>';
    var n = $('.sheet', sheetRoot); if (n && top) n.scrollTop = top;
    document.body.style.overflow = 'hidden';
    fitGrids();
    histSync();
  }
  async function openSheet(id, brief) {
    if (!F.isId(id)) return;
    var lib = F.getItem(id);
    ui.sheet = { id: id, brief: brief || (lib ? F.brief(lib) : null), item: lib || detCache[id] || null, error: null, season: 0, tmp: {}, loadingSeason: 0, seasonError: null, refreshing: false };
    renderSheet();
    if (!ui.sheet.item) await loadSheetItem(); else { loadExtras(false); autoRefreshRatings(ui.sheet, lib); }
  }
  async function loadSheetItem() {
    var sh = ui.sheet; if (!sh) return; sh.error = null;
    try { var it = await F.details(sh.id); detCache[sh.id] = it; if (ui.sheet === sh) { sh.item = it; renderSheet(); loadExtras(false); } }
    catch (e) { if (ui.sheet === sh) { sh.error = e; renderSheet(); } }
  }
  // Картка з каталогу відкривається одразу: постер і назва вже є, решта домальовується
  function openCat(mt, tid, brief, back) {
    mt = mt === 'tv' ? 'tv' : 'movie'; tid = Math.floor(Number(tid)); if (!(tid > 0)) return;
    ui.sheet = { id: '', pend: { mt: mt, tid: tid, back: back || '' }, brief: brief || null, item: null, error: null, season: 0, tmp: {}, loadingSeason: 0, seasonError: null, refreshing: false };
    renderSheet(); resolveCat();
  }
  async function resolveCat() {
    var sh = ui.sheet; if (!sh || !sh.pend) return; sh.error = null;
    try {
      var id = await F.tmdbImdbId(sh.pend.mt, sh.pend.tid); if (ui.sheet !== sh) return;
      if (sh.pend.back) F.setBack(id, sh.pend.back);
      var lib = F.getItem(id); sh.id = id; if (sh.brief) sh.brief.id = id; sh.pend = null; sh.item = lib || detCache[id] || null;
      renderSheet();
      if (!sh.item) await loadSheetItem(); else { loadExtras(false); autoRefreshRatings(sh, lib); }
    } catch (e) { if (ui.sheet === sh) { sh.error = e; renderSheet(); } }
  }
  // Плавний перехід: постер із плитки «розгортається» в картку (де браузер уміє; інакше звичайна поява)
  var vtBusy = false, vtFrom = '';
  function canMorph() { return !!document.startViewTransition && !vtBusy && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches); }
  function onScreen(n) { if (!n) return false; var b = n.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.top < window.innerHeight && b.right > 0 && b.left < window.innerWidth; }
  function tileSel(el) { var d = el.dataset || {}; return d.act === 'open' && F.isId(d.id) ? '[data-act="open"][data-id="' + d.id + '"]' : d.act === 'cat' && /^\d+$/.test(d.tid || '') ? '[data-act="cat"][data-tid="' + d.tid + '"][data-mt="' + (d.mt === 'tv' ? 'tv' : 'movie') + '"]' : ''; }
  function morph(el, fn) {
    var p = el && el.querySelector ? el.querySelector('.poster') : null;
    vtFrom = '';
    if (!p || !onScreen(p) || !canMorph()) { fn(); return; }
    var root = document.documentElement, ran = false, run = function () { if (ran) return; ran = true; p.style.viewTransitionName = ''; fn(); };
    var done = function () { vtBusy = false; root.classList.remove('vt'); p.style.viewTransitionName = ''; };
    vtFrom = tileSel(el); p.style.viewTransitionName = 'kposter'; root.classList.add('vt'); vtBusy = true;
    try { var t = document.startViewTransition(run); t.finished.then(done, done); } catch (e) { done(); run(); }
  }
  function closeSheet() {
    var from = vtFrom, had = ui.sheet && !ui.stack.length && (ui.sheet.id || ui.sheet.pend) && $('.hero .poster', sheetRoot);
    ui.sheet = null; ui.stack = []; vtFrom = '';
    var find = function () { var n = from ? app.querySelector(from + ' .poster') : null; return onScreen(n) ? n : null; };
    if (!had || !from || !canMorph() || !find()) { renderSheet(); return; }
    var root = document.documentElement, tgt = null, ran = false;
    var run = function () { if (ran) return; ran = true; renderSheet(); if (!ui.sheet) { tgt = find(); if (tgt) tgt.style.viewTransitionName = 'kposter'; } };
    var done = function () { vtBusy = false; root.classList.remove('vt'); if (tgt) tgt.style.viewTransitionName = ''; };
    root.classList.add('vt'); vtBusy = true;
    try { var t = document.startViewTransition(run); t.finished.then(done, done); } catch (e) { done(); run(); }
  }
  // Повернення до списку (напр. «Топ 100») на те саме місце
  function showColl(c) { ui.sheet = { coll: c }; renderSheet(); var n = $('.sheet', sheetRoot); if (n) n.scrollTop = c.scroll || 0; }
  // Крок назад: до попередньої картки, списку чи людини. Повертає false, якщо назад нема куди.
  function goBack() {
    var prev = ui.stack.pop(); if (!prev) return false;
    if (prev.cal) { ui.sheet = { cal: true }; renderSheet(); var cn = $('.sheet', sheetRoot); if (cn) cn.scrollTop = prev.scroll || 0; }
    else if (prev.coll) showColl(prev.coll); else if (prev.person) openPerson(prev.person); else if (prev.pend) openCat(prev.pend.mt, prev.pend.tid, prev.brief, prev.pend.back); else openSheet(prev.id, prev.brief);
    return true;
  }
  // Закриття (хрестик, Esc, натискання поза карткою): на крок назад, а повністю закриває лише перша картка.
  function dismiss() { if (!goBack()) closeSheet(); }
  function recapBlock(sh, it, lib) {
    if (!F.gemKeyOf() || it.type !== 'series') return '';
    var src = lib || it, opts = F.recapOptions(src); if (!opts.length) return '';
    var r = sh.recap || {}, label = function (o) { return o.e ? 'Сезон ' + o.s + ' до серії ' + o.e : 'Сезон ' + o.s; };
    var h = '<h2>Нагадай, що було</h2><div class="chips cols" role="group" aria-label="Який сезон переказати">' + opts.map(function (o) { var k = o.s + ':' + o.e, on = r.sel === k; return '<button class="chip' + (on ? ' on' : '') + '" data-act="recap" data-s="' + o.s + '" data-e="' + o.e + '" aria-pressed="' + on + '">' + esc(label(o)) + '</button>'; }).join('') + '</div>';
    if (!r.sel) return h + '<p class="fine">Короткий переказ від Gemini, щоб не передивлятися перед продовженням. Розкриває лише вибраний сезон, далі нічого.</p>';
    if (r.loading) return h + skWait('Gemini згадує', 4);
    if (r.error) return h + '<p class="er-t" role="status">' + esc(F.describeError(r.error) || 'Не вдалося отримати переказ.') + '</p>';
    if (r.data && r.data.none) return h + '<p class="review none">Gemini не пам’ятає цей сезон достатньо точно, тож краще не вигадувати.</p>';
    return h + '<p class="review">' + esc(r.data.t) + '</p><p class="fine">Переказ ШІ може містити неточності.</p>';
  }
  async function loadRecap(s1, e1) {
    var sh = ui.sheet; if (!sh) return; var it = sheetItem(); if (!it) return;
    var src = F.getItem(it.id) || it, o = { s: s1, e: e1 }, key = s1 + ':' + e1;
    if (sh.recap && sh.recap.sel === key && !sh.recap.error) { sh.recap = null; renderSheet(); return; }
    var c = F.recapOf(src, o);
    if (c && (c.t || c.none)) { sh.recap = { sel: key, data: c }; renderSheet(); return; }
    sh.recap = { sel: key, loading: true }; renderSheet();
    try { var d = await F.aiRecap(src, o); if (ui.sheet !== sh || !sh.recap || sh.recap.sel !== key) return; sh.recap = { sel: key, data: d }; }
    catch (e) { if (ui.sheet !== sh) return; sh.recap = { sel: key, error: e }; }
    renderSheet();
  }
  function reviewBlock(sh, it) {
    if (!F.gemKeyOf()) return '';
    var r = sh.rev, h = '<h2>Коротко від ШІ</h2>';
    if (!r || r.loading) return h + skWait('Gemini пише рецензію', 3);
    if (r.error) return h + '<p class="er-t" role="status">' + esc(F.describeError(r.error) || 'Не вдалося отримати рецензію.') + '</p><p style="margin:0"><button class="btn ghost sm" data-act="review">Спробувати ще раз</button></p>';
    if (r.data && r.data.none) return h + '<p class="review none">Gemini не знає цей твір достатньо, щоб чесно оцінити.</p>';
    return h + '<p class="review">' + esc(r.data.t) + '</p><p class="fine">Без спойлерів. Це думка ШІ, вона може помилятися.</p>';
  }
  async function loadReview(force) {
    var sh = ui.sheet; if (!sh || !F.gemKeyOf()) return; var it = sheetItem(); if (!it || !it.title) return;
    if (!force && sh.rev) return;
    var c = !force && F.reviewOf(it.id);
    if (c && (c.t || c.none)) { sh.rev = { data: c }; renderSheet(); return; }
    sh.rev = { loading: true }; if (force) renderSheet();
    try { var d = await F.aiReview(it, force); if (ui.sheet !== sh) return; sh.rev = { data: d }; }
    catch (e) { if (ui.sheet !== sh) return; sh.rev = { error: e }; }
    renderSheet();
  }
  async function loadExtras(force) {
    loadReview(false);
    var sh = ui.sheet; if (!sh || !F.tmdbKeyOf()) return; var it = sheetItem(); if (!it) return;
    var lib = F.getItem(it.id);
    var fresh = lib && lib.xv >= 3 && (lib.type !== 'series' || FB.now() - lib.exAt < 86400000);
    if (!force && (fresh || (sh.extras && (sh.extras.data || sh.extras.loading || sh.extras.error)))) { loadAvail(); return; }
    sh.extras = { loading: true, error: null, data: null }; renderSheet();
    try {
      var d = await F.tmdbExtras(it);
      if (ui.sheet !== sh) return;
      sh.extras = { loading: false, error: null, data: d.none ? null : d };
      if (F.getItem(it.id) && !d.none) F.setExtras(it.id, d);
      setTimeout(loadAvail, 0);
    } catch (e) { if (ui.sheet !== sh) return; sh.extras = { loading: false, error: e, data: null }; }
    renderSheet(); render();
  }
  // Київстар ТБ: перевіряється щоразу при відкритті картки (наявність змінюється)
  // Вимкнено у v29: дані TMDB/JustWatch для України не містять Київстар ТБ, тож відповідь завжди була б «немає»
  var AVAIL_ON = false;
  async function loadAvail() {
    var sh = ui.sheet; if (!AVAIL_ON || !sh || sh.avail || !F.tmdbKeyOf()) return;
    var it = sheetItem(); if (!it) return;
    var lib = F.getItem(it.id), x = exOf(sh, lib);
    if (!(x.tmdbId > 0)) return;
    sh.avail = { loading: true }; renderSheet();
    try { var a = await F.kyivstar(x.mt, x.tmdbId); if (ui.sheet !== sh) return; sh.avail = a ? { data: a } : null; }
    catch (e) { if (ui.sheet !== sh) return; sh.avail = { error: e }; }
    renderSheet();
  }
  function syncExtras() {
    var sh = ui.sheet; if (!sh || !sh.extras || !sh.extras.data) return;
    var lib = F.getItem(sh.id); if (lib && !(lib.xv >= 3)) F.setExtras(sh.id, sh.extras.data);
  }
  function sheetItem() { var sh = ui.sheet; return sh ? (sh.item || F.getItem(sh.id)) : null; }
  // Відмічена серія в «Обраних» означає, що серіал уже дивляться
  function startWatching(id) { var l = F.getItem(id); if (l && l.status === 'want' && F.watchedCount(l)) F.setStatus(l, 'watching'); }
  function ensureInLibrary(st) { var sh = ui.sheet, it = sheetItem(); if (!it) return null; return F.setStatus(it, st || 'want'); }
  // Сезон у кеші застарів: серій менше, ніж за даними TMDB, або в когось ще немає рейтингу
  function seasonStale(lib, n, eps) {
    if (!eps || !eps.length) return true;
    var exp = lib && lib.seasonEps && lib.seasonEps[n]; if (exp && eps.length < exp) return true;
    return eps.some(function (e) { return e.rating == null; });
  }
  async function loadSeasonNow(n) {
    var sh = ui.sheet; if (!sh) return; sh.season = n; sh.seasonError = null;
    var lib = F.getItem(sh.id); sh.fresh = sh.fresh || {};
    var cached = (lib && lib.seasons[String(n)]) || sh.tmp[n];
    if (cached && (sh.fresh[n] || !seasonStale(lib, n, cached))) { renderSheet(); return; }
    if (cached) {
      // Показуємо кеш одразу, а свіжі дані підтягуємо у фоні (раз за відкриття картки)
      sh.fresh[n] = 1; renderSheet();
      try { var up = await F.loadSeason(sh.id, n); if (ui.sheet === sh) { sh.tmp[n] = up; renderSheet(); } } catch (e) { /* лишаємо кеш */ }
      return;
    }
    sh.loadingSeason = n; sh.fresh[n] = 1; renderSheet();
    try { var eps = await F.loadSeason(sh.id, n); if (ui.sheet === sh) { sh.tmp[n] = eps; sh.loadingSeason = 0; renderSheet(); } }
    catch (e) { if (ui.sheet === sh) { sh.loadingSeason = 0; sh.seasonError = { n: n, e: e }; renderSheet(); } }
  }
  // Рейтинги й кількість сезонів у бібліотеці тихо оновлюємо при відкритті картки, якщо дані старші за 3 доби
  var autoRef = {};
  async function autoRefreshRatings(sh, lib) {
    if (!lib || autoRef[lib.id]) return;
    var age = Date.now() - (lib.fetchedAt || 0), none = lib.ratings.imdb == null;
    if (age < (none ? 21600000 : 259200000)) return;
    autoRef[lib.id] = 1;
    try { await F.refresh(lib.id); if (ui.sheet === sh) renderSheet(); render(); } catch (e) { /* без шуму: ліміт чи мережа */ }
  }

  // ---------- Вивід ----------
  // ---------- Історія браузера: «Назад» закриває картку чи повертає розділ, а не виводить із сайту ----------
  // Кожна відкрита картка й кожен розділ — запис в історії. Адреса з #f=tt… відкриває картку фільму.
  var hist = { cur: null, url: '', lock: false, wait: false, tm: 0 };
  function hDepth() { return ui.sheet ? ui.stack.length + 1 : 0; }
  function hKey() { return ui.tab + (ui.tab === 'home' && isDesktop() ? ':' + (ui.deskAll === false ? ui.homeMt : 'all') : ''); }
  function hState() { var sh = ui.sheet; return { k: 1, key: hKey(), depth: hDepth(), f: sh && F.isId(sh.id) ? sh.id : '', p: sh && sh.person && sh.person.id > 0 ? sh.person.id : 0, pn: sh && sh.person ? String(sh.person.name || '').slice(0, 80) : '' }; }
  function hUrl() {
    var st = hState(), h = st.f ? '#f=' + st.f : st.p ? '#p=' + st.p : !st.depth && ui.tab !== 'home' ? '#t=' + ui.tab : '';
    return location.pathname + location.search + h;
  }
  function hSet(st, url, push) { try { history[push ? 'pushState' : 'replaceState'](st, '', url); hist.cur = st; hist.url = url; } catch (e) { /* історія недоступна */ } }
  function histSync() {
    if (!hist.cur || hist.lock || hist.wait) return;
    var st = hState(), url = hUrl(), cur = hist.cur;
    if (st.depth < cur.depth) {
      // картку закрили кнопкою: відмотуємо історію на стільки ж кроків
      hist.wait = true; clearTimeout(hist.tm);
      hist.tm = setTimeout(function () { if (hist.wait) { hist.wait = false; hSet(hState(), hUrl(), false); } }, 800);
      try { history.go(st.depth - cur.depth); } catch (e) { hist.wait = false; clearTimeout(hist.tm); }
      return;
    }
    if (st.depth > cur.depth || st.key !== cur.key) { hSet(st, url, true); return; }
    if (url !== hist.url || st.f !== cur.f || st.p !== cur.p) hSet(st, url, false);
  }
  function applyKey(key) {
    var a = String(key || 'home').split(':'), tab = TABS.some(function (t) { return t[0] === a[0]; }) ? a[0] : 'home';
    if (tab === 'home' && a[1]) { var all = a[1] === 'all'; ui.deskAll = all; if (!all) ui.homeMt = a[1] === 'tv' ? 'tv' : a[1] === 'toon' ? 'toon' : 'movie'; ui.homeGenre = ''; ui.heroIx = 0; ui.heroKey = ''; }
    setTab(tab);
  }
  // Посилання: #f=tt0133093 (фільм), #p=525 (людина), #t=want (розділ)
  function openLink(hash) {
    var m = /^#(f|p|t)=([\w-]{1,20})$/.exec(String(hash || '')); if (!m) return false;
    if (m[1] === 'f' && F.isId(m[2])) { ui.stack = []; openSheet(m[2]); return true; }
    if (m[1] === 'p' && /^[1-9]\d{0,8}$/.test(m[2])) { ui.stack = []; openPerson({ id: Number(m[2]), name: '', photo: '' }); return true; }
    if (m[1] === 't' && m[2] !== ui.tab && TABS.some(function (t) { return t[0] === m[2]; })) { setTab(m[2]); return true; }
    return false;
  }
  function onPop(e) {
    var s = e.state && e.state.k ? e.state : null;
    if (hist.wait) {
      // це наш власний крок назад після закриття картки
      hist.wait = false; clearTimeout(hist.tm);
      hist.cur = s || { k: 1, key: hKey(), depth: 0, f: '', p: 0, pn: '' }; hist.url = location.pathname + location.search + location.hash;
      histSync(); return;
    }
    hist.lock = true;
    try {
      if (!s) { if (spotEl) closeSpot(); openLink(location.hash); }
      else {
        if (spotEl) closeSpot();
        var d = hDepth();
        while (d > s.depth) { if (!goBack()) closeSheet(); var nd = hDepth(); if (nd >= d) break; d = nd; }
        // «Вперед»: картку фільму чи людини можна відкрити знову
        if (d < s.depth) { if (ui.sheet) pushCurrent(); if (F.isId(s.f)) openSheet(s.f); else if (s.p > 0) openPerson({ id: s.p, name: s.pn || '', photo: '' }); }
        if (s.key !== hKey()) applyKey(s.key);
      }
    } catch (er) { /* лишаємось там, де є */ }
    hist.lock = false;
    hSet(hState(), hUrl(), false);
  }
  function histInit() {
    if (!window.history || !history.pushState) return;
    var link = location.hash, prior = history.state && history.state.k && history.state.depth > 0;
    if (prior && /^#[fp]=/.test(link)) {
      // сторінку перезавантажили з відкритою карткою: запис під нею вже є, тож просто відкриваємо її знову
      hist.lock = true; try { openLink(link); } catch (e) { /* головна */ } hist.lock = false;
      hSet(hState(), hUrl(), false); if (hist.cur) window.addEventListener('popstate', onPop); return;
    }
    hist.lock = true;
    try { if (/^#t=/.test(link)) openLink(link); } catch (e) { /* головна */ }
    hist.lock = false;
    hSet(hState(), hUrl(), false);
    if (!hist.cur) return;
    window.addEventListener('popstate', onPop);
    if (/^#[fp]=/.test(link)) openLink(link);
  }
  function render() {
    var st = ui.tab, keep = !ui.enter && ui.lastTab === st ? Array.prototype.map.call(app.querySelectorAll('.strip'), function (x) { return x.scrollLeft; }) : null; ui.lastTab = st;
    app.className = 'tab-' + st + (ui.enter ? ' enter' : ''); ui.enter = false;
    app.innerHTML = st === 'home' ? renderHome() : st === 'search' ? renderSearch() : st === 'more' ? renderMore() : renderList(st) + (isDesktop() && st === 'watching' ? marSection() + folShelf() + F.colList().map(function (c) { return plainShelf(c.name, F.colItems(c.id)); }).join('') : '');
    tabsEl.innerHTML = isDesktop() ? navDesktop(st) : TABS.map(function (t) { return '<button data-act="tab" data-tab="' + t[0] + '" aria-label="' + t[1] + '"' + (st === t[0] ? ' aria-current="page"' : '') + '>' + ic(t[2]) + '<span>' + t[1] + '</span>' + '</button>'; }).join('');
    tabsEl.classList.toggle('desk', isDesktop());
    if (keep) Array.prototype.forEach.call(app.querySelectorAll('.strip'), function (x, i) { if (keep[i]) x.scrollLeft = keep[i]; });
    if (ui.sheet) renderSheet(); else histSync();
  }
  function setTab(t) { ui.tab = t; ui.enter = true; ui.keyMsg = null; ui.backupMsg = null; ui.gemMsg = null; ui.tmdbMsg = null; render(); window.scrollTo(0, 0); if (t !== 'home') ambReset(); if (t === 'search' && isDesktop()) { var q = $('#q'); if (q) q.focus(); } }
  // ---------- ПК: широкий екран ----------
  // ПК: «Головна» змішує фільми, серіали й мультики; окремі пункти меню показують одну категорію
  function mix() { return isDesktop() && ui.deskAll !== false; }
  function homeDefs() {
    var hid = hidShelves(), ok = function (d) { return d && !hid[d.id]; };
    if (!mix()) return F.collDefs(ui.homeMt).filter(ok).slice(0, ui.cat.shown[ui.homeMt]);
    var m = F.collDefs('movie').filter(ok), t = F.collDefs('tv').filter(ok), c = F.collDefs('toon').filter(ok);
    return [m[0], t[0], m[1], t[1], c[0], m[2], t[2], c[1], m[3], t[3]].filter(Boolean);
  }
  function shTitle(def) {
    if (!mix() || def.top || def.kw) return def.title;
    var has = function (k) { return F.collDefs(k).some(function (d) { return d.id === def.id; }); };
    return def.title + (has('toon') ? ', мультики' : has('tv') ? ', серіали' : ', фільми');
  }
  function navDesktop(st) {
    var lib = st === 'want' || st === 'watching' || st === 'seen'; if (lib) ui.libTab = st;
    var home = st === 'home', cur = function (on) { return on ? ' aria-current="page"' : ''; };
    var cat = function (mt, label) { return '<button class="nl" data-act="desk" data-mt="' + mt + '"' + cur(home && (mt ? !mix() && ui.homeMt === mt : mix())) + '>' + label + '</button>'; };
    return '<button class="brand" data-act="desk" data-mt="" aria-label="Kinoman, на головну"><i></i>Kinoman</button>' +
      '<button class="nl ico" data-act="spot" aria-label="Пошук" title="Пошук ( / )">' + ic('search') + '</button>' +
      cat('', 'Головна') + cat('movie', 'Фільми') + cat('tv', 'Серіали') + cat('toon', 'Мультики') +
      '<button class="nl" data-act="tab" data-tab="' + (ui.libTab || 'watching') + '"' + cur(lib) + '>Моя колекція</button>' +
      '<button class="nl" data-act="cal">Календар</button>' +
      '<button class="nl" data-act="tab" data-tab="search"' + cur(st === 'search') + '>Підбір</button>' +
      '<button class="nl ico last" data-act="tab" data-tab="more" aria-label="Налаштування і статистика" title="Налаштування і статистика"' + cur(st === 'more') + '>' + ic('more') + '</button>';
  }
  // ---------- ПК: колір інтерфейсу від постера ----------
  var ambCache = {}, ambBase = '', ambTok = 0;
  function ambCompute(url) {
    if (!url) return Promise.resolve('');
    if (ambCache[url] != null) return Promise.resolve(ambCache[url]);
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
      im.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 16; c.height = 24; var g = c.getContext('2d'); g.drawImage(im, 0, 0, 16, 24);
          var d = g.getImageData(0, 0, 16, 24).data, x = 0, y = 0, w = 0, ss = 0;
          for (var i = 0; i < d.length; i += 4) {
            var r = d[i] / 255, gr = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gr, b), dl = mx - Math.min(r, gr, b); if (mx < 0.14 || dl < 0.1) continue;
            var hh = (mx === r ? ((gr - b) / dl) % 6 : mx === gr ? (b - r) / dl + 2 : (r - gr) / dl + 4) * Math.PI / 3, wt = dl * mx;
            x += Math.cos(hh) * wt; y += Math.sin(hh) * wt; w += wt; ss += dl / mx * wt;
          }
          if (w < 1) { res(ambCache[url] = ''); return; }
          res(ambCache[url] = 'hsl(' + Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) + ' ' + Math.round(Math.max(50, Math.min(84, ss / w * 100))) + '% 68%)');
        } catch (e) { res(ambCache[url] = ''); }
      };
      im.onerror = function () { res(ambCache[url] = ''); };
      im.src = url;
    });
  }
  function ambApply(c) { if (c) document.documentElement.style.setProperty('--amb', c); else document.documentElement.style.removeProperty('--amb'); }
  // base=true: колір сторінки (банер); інакше тимчасовий (наведення, відкрита картка)
  function setAmb(url, id, base) {
    var fb = 'hsl(' + hue(id) + ' 70% 68%)', tok = ++ambTok;
    url = String(url || '').replace(/(image\.tmdb\.org\/t\/p\/)\w+\//, '$1w92/');
    ambCompute(url).then(function (c) { c = c || fb; if (base) ambBase = c; if (tok === ambTok && (base ? !ui.sheet : true)) ambApply(c); });
  }
  function ambReset() { ambTok++; ambApply(ui.tab === 'home' ? ambBase : ''); }
  // ---------- ПК: швидкий пошук поверх сторінки ----------
  var spotEl = null, spotTok = 0, spotT = 0;
  function sgRow(attrs, pic, title, sub, right) { return '<button type="button" class="sg" ' + attrs + '><span class="sp' + (pic.round ? ' round' : '') + '">' + pic.html + '</span><span class="st"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></span>' + (right ? '<span class="sv">' + right + '</span>' : '') + '</button>'; }
  function spotLocal(q) {
    var lq = q.toLowerCase(), its = F.state && F.state.items ? Object.keys(F.state.items).map(function (k) { return F.state.items[k]; }) : [];
    return its.filter(function (it) { return it && !it.arch && ((it.title || '').toLowerCase().indexOf(lq) >= 0 || (it.titleUk || '').toLowerCase().indexOf(lq) >= 0); }).slice(0, 4);
  }
  function libRow(it) { return sgRow('data-act="open" data-id="' + it.id + '"', { html: it.poster ? '<img src="' + esc(it.poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ic('film', 'sm') }, it.titleUk || it.title, [typeLabel(it.type), it.year, NAMES[it.status]].filter(Boolean).join(', '), it.myRating ? '★ ' + it.myRating : ''); }
  function spotPaint(html) { var b = spotEl && spotEl.querySelector('.spot-res'); if (b) { b.innerHTML = html; var f = b.querySelector('.sg'); if (f) f.classList.add('sel'); } }
  function spotIdle() {
    var w = F.list('watching').slice(0, 4), qs = F.queries().slice(0, 5), h = '';
    if (w.length) h += '<p class="spot-h">Дивлюсь зараз</p>' + w.map(libRow).join('');
    if (qs.length) h += '<p class="spot-h">Нещодавно шукали</p>' + qs.map(function (q) { return sgRow('data-act="spotfill" data-q="' + esc(q) + '"', { html: ic('clock', 'sm') }, q, 'Повторити пошук', ''); }).join('');
    h += '<p class="spot-h">Перейти</p>' + sgRow('data-act="tab" data-tab="search"', { html: ic('sparkle', 'sm') }, 'Підбір за жанром, роками й рейтингом', 'Коли не знаєте, що шукати', '') + sgRow('data-act="tab" data-tab="' + (ui.libTab || 'watching') + '"', { html: ic('bookmark', 'sm') }, 'Колекція', 'Обрані, дивлюсь, переглянуто', '');
    spotPaint(h);
  }
  async function spotRun(q) {
    var tok = ++spotTok, loc = spotLocal(q), h = '';
    var all = sgRow('data-act="spotgo" data-q="' + esc(q) + '"', { html: ic('search', 'sm') }, 'Усі результати для «' + q + '»', 'Повний пошук з рейтингами IMDb', '↵');
    if (loc.length) h += '<p class="spot-h">У вашій колекції</p>' + loc.map(libRow).join('');
    spotPaint(h + all);
    if (!F.tmdbKeyOf()) return;
    var items; try { items = await F.suggest(q); } catch (e) { items = null; }
    if (tok !== spotTok || !spotEl || !items) return;
    var media = items.map(function (r) { return sgRow('data-act="cat" data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '"', { html: r.poster ? '<img src="' + esc(F.tmdbImg(r.poster, 'w92')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ic('film', 'sm') }, r.title, [r.mt === 'tv' ? 'Серіал' : 'Фільм', r.year, r.orig].filter(Boolean).join(', '), r.vote ? '★ ' + r.vote.toFixed(1) : ''); }).join('');
    var ppl = (items.people || []).map(function (p) { return sgRow('data-act="person" data-pid="' + p.pid + '" data-name="' + esc(p.name) + '" data-photo="' + esc(p.photo) + '"', { round: true, html: p.photo ? '<img src="' + esc(F.tmdbImg(p.photo, 'w92')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : esc(initials(p.name)) }, p.name, p.dept || 'Кіно', ''); }).join('');
    var found = (items.peopleFirst ? ppl + media : media + ppl);
    spotPaint(h + (found ? '<p class="spot-h">Каталог</p>' + found : '') + all);
  }
  function openSpot() {
    if (spotEl) return;
    spotEl = document.createElement('div'); spotEl.id = 'spot'; spotEl.setAttribute('data-act', 'spotclose');
    spotEl.innerHTML = '<div class="spot-box" role="dialog" aria-modal="true" aria-label="Пошук"><div class="spot-in">' + ic('search') + '<input type="search" id="spotq" placeholder="Фільм, серіал або актор" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Пошук"><kbd>Esc</kbd></div><div class="spot-res" role="listbox"></div><p class="spot-f"><span><kbd>↑</kbd><kbd>↓</kbd> вибір</span><span><kbd>↵</kbd> відкрити</span></p></div>';
    document.body.appendChild(spotEl);
    var inp = spotEl.querySelector('#spotq');
    inp.addEventListener('input', function () { clearTimeout(spotT); var q = inp.value.trim(); if (q.length < 2) { spotTok++; spotIdle(); return; } spotT = setTimeout(function () { spotRun(q); }, 220); });
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
      var rows = Array.prototype.slice.call(spotEl.querySelectorAll('.sg')), i = rows.indexOf(spotEl.querySelector('.sg.sel'));
      e.preventDefault();
      if (e.key === 'Enter') { var q = inp.value.trim(); if (rows[i]) rows[i].click(); else if (q) { closeSpot(); spotGo(q); } return; }
      if (!rows.length) return; if (rows[i]) rows[i].classList.remove('sel');
      i = (i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; rows[i].classList.add('sel'); rows[i].scrollIntoView({ block: 'nearest' });
    });
    spotIdle(); inp.focus();
  }
  function closeSpot() { if (!spotEl) return; clearTimeout(spotT); spotTok++; spotEl.remove(); spotEl = null; }
  function spotGo(q) { ui.q = q; setTab('search'); var qi = $('#q'); if (qi) { qi.value = q; qi.blur(); } doSearch(false); }
  // ---------- ПК: картка-підказка над постером у каталозі ----------
  var peekEl = null, peekT = 0, peekFor = null, peekPend = null;
  function peekHide() { clearTimeout(peekT); peekFor = null; peekPend = null; if (peekEl) peekEl.classList.remove('show'); }
  function peekShow(tile) {
    var r = catInfo[tile.dataset.mt + ':' + tile.dataset.tid]; if (!r || !tile.isConnected) return;
    if (!peekEl) { peekEl = document.createElement('div'); peekEl.className = 'peek'; document.body.appendChild(peekEl); peekEl.addEventListener('mouseleave', peekHide);
      peekEl.addEventListener('click', function (e) { var hit = e.target.closest('[data-act]'), main = peekEl.querySelector('.pk-img'); if (hit) { if (hit.dataset.act === 'cat') peekHide(); return; } peekHide(); if (main) onAct(main); }); }
    var s = F.tmdbStatus(r.mt, r.tid), im = F.imdbFor(r.mt, r.tid), d = ' data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '"' + (r.back ? ' data-back="' + esc(r.back) + '"' : '');
    var pill = im != null ? '<span class="pill">IMDb ' + im.toFixed(1) + '</span>' : r.vote ? '<span class="pill mt">TMDB ' + r.vote.toFixed(1) + '</span>' : '';
    peekEl.innerHTML = '<button class="pk-img" data-act="cat"' + d + ' aria-label="' + esc(r.title) + '" style="background-image:url(\'' + esc(F.tmdbImg(r.back || r.poster, r.back ? 'w780' : 'w342')) + '\')"></button><div class="pk-b"><b class="pk-t">' + esc(r.title) + '</b><p class="pk-m">' + pill + '<span>' + esc([r.mt === 'tv' ? 'Серіал' : 'Фільм', r.year].filter(Boolean).join(', ')) + '</span></p>' + (r.plot ? '<p class="pk-p">' + esc(r.plot) + '</p>' : '') +
      '<div class="pk-a"><button class="btn sm" data-act="cat"' + d + '>Детальніше</button>' + (s && ST_IC[s] ? '<span class="bb-st">' + ic(ST_IC[s][0], 'sm') + ST_IC[s][1] + '</span>' : '<button class="btn ghost sm" data-act="catadd"' + d + '>' + ic('plus', 'sm') + 'В обране</button><button class="icon-btn sm" data-act="catnope"' + d + ' aria-label="Не цікавить" title="Не цікавить">' + ic('eyeoff', 'sm') + '</button>') + '</div></div>';
    var t = tile.getBoundingClientRect(), w = 360, x = Math.max(12, Math.min(window.innerWidth - w - 12, t.left + t.width / 2 - w / 2));
    peekEl.style.width = w + 'px'; peekEl.style.left = x + 'px'; peekEl.style.top = '0px'; peekEl.classList.add('show');
    var hgt = peekEl.offsetHeight, y = Math.max(12, Math.min(window.innerHeight - hgt - 12, t.top + t.height / 2 - hgt / 2));
    peekEl.style.top = y + 'px'; peekEl.style.transformOrigin = (t.left + t.width / 2 - x) + 'px ' + (t.top + t.height / 2 - y) + 'px';
    peekFor = tile;
  }
  function isDesktop() { return !!(window.matchMedia && window.matchMedia('(min-width:1024px)').matches); }
  // Стрілки для горизонтальних полиць: одна пара на сторінку, з’являється над полицею під курсором
  function initDesktop() {
    if (!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var cur = null, hideT = 0;
    var mk = function (dir) { var b = document.createElement('button'); b.type = 'button'; b.className = 'sarrow ' + (dir < 0 ? 'prev' : 'next'); b.setAttribute('aria-label', dir < 0 ? 'Прокрутити назад' : 'Прокрутити далі'); b.innerHTML = ic(dir < 0 ? 'left' : 'right'); b.addEventListener('click', function () { if (cur && cur.isConnected) cur.scrollBy({ left: dir * Math.max(240, cur.clientWidth * 0.8), behavior: 'smooth' }); }); b.addEventListener('mouseenter', function () { clearTimeout(hideT); }); b.addEventListener('mouseleave', later); document.body.appendChild(b); return b; };
    var prev = mk(-1), next = mk(1);
    function place() {
      if (!cur || !cur.isConnected || !isDesktop()) { prev.classList.remove('show'); next.classList.remove('show'); return; }
      var r = cur.getBoundingClientRect(), max = cur.scrollWidth - cur.clientWidth;
      // по висоті центруємо на постері, а не на підписі під ним
      var p = cur.querySelector('.poster, .pic, .cw-img'), pr = p ? p.getBoundingClientRect() : r, y = pr.top + pr.height / 2 - 22;
      prev.style.top = next.style.top = y + 'px';
      prev.style.left = (r.left + 6) + 'px'; next.style.left = (r.right - 50) + 'px';
      prev.classList.toggle('show', max > 4 && cur.scrollLeft > 4);
      next.classList.toggle('show', max > 4 && cur.scrollLeft < max - 4);
    }
    function later() { clearTimeout(hideT); hideT = setTimeout(function () { cur = null; place(); }, 180); }
    var ambT = 0, ambOn = null, raf = 0;
    document.addEventListener('mouseover', function (e) {
      if (!isDesktop() || !e.target.closest) return;
      var c = e.target.closest('.tile, .card, .cw, .rec');
      if (c !== ambOn) {
        ambOn = c; clearTimeout(ambT);
        if (c && !ui.sheet) ambT = setTimeout(function () { var im = c.querySelector('img'), bg = c.querySelector('.cw-img'); var u = im ? im.currentSrc || im.src : bg ? (/url\(["']?([^"')]+)/.exec(bg.style.backgroundImage) || [])[1] : ''; setAmb(u, c.dataset.tid || c.dataset.id || 0, false); }, 160);
        else if (!c && !ui.sheet) ambT = setTimeout(ambReset, 600);
      }
      var tile = e.target.closest('.tw > .tile[data-act="cat"]'), inPeek = e.target.closest('.peek');
      if (tile && tile !== peekFor && tile !== peekPend) { peekHide(); peekPend = tile; peekT = setTimeout(function () { peekPend = null; if (!ui.sheet) peekShow(tile); }, 520); }
      else if (!tile && !inPeek && !e.target.closest('.tw')) peekHide();
    });
    document.addEventListener('mousemove', function (e) {
      if (raf || !isDesktop()) return; var bb = e.target.closest && e.target.closest('.bb'); if (!bb) return;
      raf = requestAnimationFrame(function () { raf = 0; var r = bb.getBoundingClientRect(); bb.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); bb.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3)); });
    });
    document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.peek')) return; peekHide(); }, true);
    document.addEventListener('mouseover', function (e) {
      var s = e.target.closest && e.target.closest('.strip, .seasons');
      if (s) { clearTimeout(hideT); if (s !== cur) { cur = s; } place(); }
      else if (cur && !(e.target.closest && e.target.closest('.sarrow'))) later();
    });
    document.addEventListener('scroll', function (e) { if (peekFor || peekPend) peekHide(); if (cur) { if (e.target === cur) place(); else { cur = null; place(); } } }, true);
    var fitT = 0;
    window.addEventListener('resize', function () { tailSoon(); cur = null; place(); clearTimeout(fitT); fitT = setTimeout(function () { if (ui.sheet && ui.sheet.person) renderSheet(); }, 200); });
  }

  // ---------- Події ----------
  async function onAct(el) {
    var a = el.dataset.act, id = el.dataset.id;
    switch (a) {
      case 'tab': setTab(el.dataset.tab); break;
      case 'hometype': ui.homeMt = el.dataset.mt === 'tv' ? 'tv' : el.dataset.mt === 'toon' ? 'toon' : 'movie'; ui.enter = true; render(); break;
      case 'homeview': ui.homeView = el.dataset.v === 'mine' ? 'mine' : 'cat'; try { localStorage.setItem('kinoman_home_view', ui.homeView); } catch (e) { /* без збереження */ } ui.enter = true; render(); window.scrollTo(0, 0); break;
      case 'resume': { var ri = F.getItem(el.dataset.id); if (ri) { F.setStatus(ri, 'watching'); toast('«' + (ri.titleUk || ri.title) + '» знову в «Дивлюсь»'); } break; }
      case 'skipseason': { var si = F.getItem(el.dataset.id); if (si) { var prevS = si.doneS; F.skipSeason(si.id); toast('Сховано. Нагадаю про наступний сезон', 'Повернути', function () { F.skipSeason(si.id, prevS); }); } break; }
      case 'who': { var ww = el.dataset.w, wc = ww.indexOf('col:') === 0 ? ww.slice(4) : ''; ['want', 'watching', 'seen'].forEach(function (k) { if (ui.lists[k]) ui.lists[k].col = wc; }); F.setHideGrp(ww === 'me'); ['want', 'watching', 'seen'].forEach(function (k) { var lf0 = ui.lists[k]; if (lf0) { lf0.two = ww === 'two'; lf0.fam = ww === 'fam'; lf0.genre = ''; if (ww !== 'fam') lf0.age = ''; } }); render(); break; }
      case 'agef': { var af = ui.lists[ui.tab]; if (af) { af.age = /^(0|6|12|16)$/.test(el.dataset.age || '') ? el.dataset.age : ''; render(); } break; }
      case 'twof': { var tf = ui.lists[ui.tab]; if (tf) { tf.two = !tf.two; render(); } break; }
      case 'togtwo': { var lt = ui.sheet && F.getItem(ui.sheet.id); if (lt) { var on2 = F.toggleTwo(lt.id); toast(on2 ? 'Позначено «Для двох»' : 'Прибрано з «Для двох»'); renderSheet(); render(); } break; }
      case 'review': loadReview(true); break;
      case 'qh': { ui.q = el.dataset.q || ''; var qi = $('#q'); if (qi) qi.value = ui.q; doSearch(false); break; }
      case 'qhclear': F.clearQueries(); render(); break;
      case 'recap': loadRecap(Number(el.dataset.s) || 1, Number(el.dataset.e) || 0); break;
      case 'hidegrp': { F.setHideGrp(!F.hideGrpOn()); toast(F.hideGrpOn() ? 'Сховано «Для двох», «Сімейні» й добірки' : 'Знову показуємо все'); render(); break; }
      case 'famf': { var ff = ui.lists[ui.tab]; if (ff) { ff.fam = !ff.fam; render(); } break; }
      case 'togfam': { var lf2 = ui.sheet && F.getItem(ui.sheet.id); if (lf2) { var on3 = F.toggleFam(lf2.id); toast(on3 ? 'Позначено «Сімейні»' : 'Прибрано з «Сімейні»'); renderSheet(); render(); } break; }
      case 'oldf': { var lf = ui.lists[ui.tab]; if (lf) { lf.old = !lf.old; render(); } break; }
      case 'arch': {
        var aid = el.dataset.id || (ui.sheet && ui.sheet.id), on = !!el.dataset.on, ai0 = F.getItem(aid); if (!ai0) break;
        F.setArch(aid, on);
        if (on) { dismiss(); toast('Перенесено в архів. Знайдете в «Ще»', 'Повернути', function () { F.setArch(aid, false); }); } else { if (ui.sheet && ui.sheet.id === aid) renderSheet(); toast('Повернуто до «' + NAMES[ai0.status] + '»'); }
        break;
      }
      case 'archshow': ui.archOpen = !ui.archOpen; render(); break;
      case 'marfind': if (ui.sheet && !ui.sheet.wheel) pushCurrent(); ui.sheet = { coll: { id: 'marfind', title: 'Кіномарафони', find: { q: '', res: null, busy: false, err: '' } } }; renderSheet(); setTimeout(function () { var q = $('#marq'); if (q) q.focus(); }, 50); break;
      case 'martmdb': openMarTmdb(el.dataset.cid); break;
      case 'saga': openSaga(el.dataset.q, el.dataset.cid); break;
      case 'maropen': { var mo = F.marathonOf(el.dataset.id); if (mo) { ui.sheet = { coll: { id: 'mar', title: mo.name, mar: { id: el.dataset.id } } }; ui.stack = []; renderSheet(); } break; }
      case 'marai': {
        var fc = ui.sheet && ui.sheet.coll && ui.sheet.coll.find; if (!fc || fc.busy) return; fc.busy = true; fc.err = ''; renderSheet();
        try { var am = await F.aiMarathon(fc.q); fc.busy = false; if (!am || !am.parts.length) { fc.err = 'Gemini не склав список, спробуйте інакше сформулювати.'; renderSheet(); break; } pushCurrent(); ui.sheet = { coll: { id: 'mar', title: am.name, mar: { id: null, data: am } } }; renderSheet(); var ns = $('.sheet', sheetRoot); if (ns) ns.scrollTop = 0; }
        catch (e) { fc.busy = false; fc.err = F.describeError(e); renderSheet(); }
        break;
      }
      case 'marsave': { var mm = ui.sheet && ui.sheet.coll && ui.sheet.coll.mar; if (!mm || !mm.data) break; var mid = F.saveMarathon(mm.data); if (mid) { mm.id = mid; toast('Марафон додано в «Моє»'); renderSheet(); } break; }
      case 'mardel': { var md = ui.sheet && ui.sheet.coll && ui.sheet.coll.mar; if (!md || !md.id) break; if (!window.confirm('Видалити марафон? Фільми у ваших списках залишаться.')) return; F.removeMarathon(md.id); closeSheet(); toast('Марафон видалено'); break; }
      case 'maraddall': {
        var ma = ui.sheet && ui.sheet.coll && ui.sheet.coll.mar, mo2 = ma && F.marathonOf(ma.id); if (!mo2 || ma.busy) return;
        var todo = mo2.parts.filter(function (p) { return !p.st; }); ma.busy = true; var okN = 0, failN = 0;
        for (var ti = 0; ti < todo.length; ti++) {
          ma.msg = { ok: true, text: 'Додаємо ' + (ti + 1) + ' з ' + todo.length + '…' }; renderSheet();
          try { var tid0 = await F.tmdbImdbId(todo[ti].mt, todo[ti].tid), had = F.getItem(tid0); if (had) F.setTmdbRef(tid0, todo[ti].mt, todo[ti].tid); else { var dd = detCache[tid0] || await F.details(tid0); detCache[tid0] = dd; F.setStatus(dd, 'want'); F.setTmdbRef(tid0, todo[ti].mt, todo[ti].tid); } okN++; }
          catch (e) { failN++; if (e && /KEY|LIMIT|NETWORK/.test(String(e.code))) { ma.msg = { ok: false, text: F.describeError(e) }; break; } }
        }
        ma.busy = false; if (!ma.msg || ma.msg.ok) ma.msg = { ok: !failN, text: 'Додано в «Обрані»: ' + okN + (failN ? '. Не вдалося: ' + failN + ' (немає в OMDb).' : '.') }; renderSheet(); break;
      }
      case 'showall': if (el.dataset.k === 'allNews' || el.dataset.k === 'allSoon') { ui[el.dataset.k] = !ui[el.dataset.k]; render(); } break;
      case 'moreshelves': ui.cat.shown[ui.homeMt] += 5; render(); break;
      case 'hidesh': { var hid0 = el.dataset.id, ht = el.dataset.title || ''; if (!window.confirm('Видалити добірку «' + ht + '» з головної? Повернути її можна в розділі «Ще».')) return; hideShelf(hid0, ht); render(); toast('Добірку видалено', 'Повернути', function () { showShelf(hid0); render(); }); break; }
      case 'showsh': showShelf(el.dataset.id); render(); break;
      case 'showshall': hidMem = {}; hidSave(); render(); toast('Усі добірки повернуто'); break;
      case 'reshelf': { var rs = F.collDefs(ui.homeMt).filter(function (d) { return d.id === el.dataset.id; })[0]; if (rs) { delete ui.cat.sh[rs.id]; loadShelf(rs); paintShelf(rs); } break; }
      case 'coll': openColl(el.dataset.id); break;
      case 'studio': { var sd = F.studioDef(el.dataset.id); if (sd) openStudio(sd); break; }
      case 'hideseen': ui.hideSeen = !ui.hideSeen; try { localStorage.setItem('kinoman_hide_seen', ui.hideSeen ? '1' : ''); } catch (e) { /* без збереження */ } render(); break;
      case 'catun': {
        var un = F.tmdbItem(el.dataset.mt, el.dataset.tid);
        if (un && un.status === 'want') { var ug = F.removeItem(un.id); render(); if (ug) toast('Прибрано з «Обраних»', 'Повернути', function () { F.restoreItem(ug); render(); }); }
        break;
      }
      case 'catnope': {
        var nm2 = el.dataset.mt, nt2 = el.dataset.tid, nti = el.dataset.title;
        F.setNope(nm2, nt2, true); render();
        toast('«' + nti + '» більше не показуватиметься', 'Повернути', function () { F.setNope(nm2, nt2, false); render(); });
        break;
      }
      case 'nopeclear': { var nn = F.nopeCount(); F.clearNope(); toast('Повернуто в каталог: ' + nn); render(); break; }
      case 'catadd': {
        var qk = 'add' + el.dataset.mt + el.dataset.tid; if (ui.busy[qk]) return; ui.busy[qk] = true; el.disabled = true;
        try {
          var qi = await F.tmdbImdbId(el.dataset.mt, el.dataset.tid), have = F.getItem(qi);
          if (have) { F.setTmdbRef(qi, el.dataset.mt, el.dataset.tid); toast('Уже у списку «' + NAMES[have.status] + '»'); }
          else { var qd = detCache[qi] || await F.details(qi); detCache[qi] = qd; F.setStatus(qd, 'want'); F.setTmdbRef(qi, el.dataset.mt, el.dataset.tid); toast('Додано до «Обраних»', 'Прибрати', function () { F.removeItem(qi); }); }
        } catch (e) { toast(F.describeError(e)); }
        delete ui.busy[qk]; render(); break;
      }
      case 'mood': ui.mood = Math.max(0, Math.min(MOODS.length - 1, Number(el.dataset.i) || 0)); render(); break;
      case 'planclear': if (ui.sheet && ui.sheet.id) F.setPlan(ui.sheet.id, ''); break;
      case 'collmore': collMore(); break;
      case 'discmore': discMore(el.dataset.key); break;
      case 'cat': {
        hideSugg(); var qb = $('#q'); if (qb && document.activeElement === qb) qb.blur();
        var cmt = el.dataset.mt === 'tv' ? 'tv' : 'movie', ctid = el.dataset.tid, cback = el.dataset.back || '';
        var cbr = { id: '', title: el.dataset.title || '', year: el.dataset.year || '', type: cmt === 'tv' ? 'series' : 'movie', poster: F.tmdbImg(el.dataset.poster, 'w342') };
        morph(ui.sheet ? null : el, function () { if (ui.sheet && !ui.sheet.wheel) pushCurrent(); openCat(cmt, ctid, cbr, cback); });
        break;
      }
      case 'heropick': ui.heroIx = Number(el.dataset.i) || 0; paintHero(); break;
      case 'spot': openSpot(); break;
      case 'cal': if (ui.sheet && !ui.sheet.wheel) pushCurrent(); else ui.stack = []; ui.sheet = { cal: true }; renderSheet(); calLoadMore(); break;
      case 'desk': ui.deskAll = !el.dataset.mt; if (el.dataset.mt) ui.homeMt = el.dataset.mt === 'tv' ? 'tv' : el.dataset.mt === 'toon' ? 'toon' : 'movie'; ui.homeGenre = ''; ui.heroIx = 0; ui.heroKey = ''; setTab('home'); break;
      case 'spotgo': spotGo(el.dataset.q || ''); break;
      case 'type': ui.type = el.dataset.type; if (ui.q.trim() && ui.searched) doSearch(false); else render(); break;
      case 'more': doSearch(true); break;
      case 'open': {
        var br = null; for (var i = 0; i < ui.results.length; i++) if (ui.results[i].id === id) br = ui.results[i];
        morph(ui.sheet ? null : el, function () { if (ui.sheet && ui.sheet.cal) pushCurrent(); openSheet(id, br); });
        break;
      }
      case 'quick': {
        if (ui.busy[id] || F.getItem(id)) return; ui.busy[id] = true; render();
        try { var det = detCache[id] || await F.details(id); detCache[id] = det; F.setStatus(det, el.dataset.st); toast(el.dataset.st === 'seen' ? 'Додано до «Переглянуто»' : el.dataset.st === 'watching' ? 'Додано до «Дивлюсь»' : 'Додано в «Обрані»', 'Скасувати', function () { F.removeItem(id); }); }
        catch (e) { ui.error = e; }
        delete ui.busy[id]; render(); break;
      }
      case 'close': dismiss(); break;
      case 'retry': if (ui.sheet && ui.sheet.pend) resolveCat(); else loadSheetItem(); renderSheet(); break;
      case 'status': {
        var cur = F.getItem(ui.sheet.id), it0 = sheetItem(); if (!it0) return;
        if (cur && cur.status === el.dataset.st) {
          if (cur.status === 'want') { var wg = F.removeItem(cur.id); renderSheet(); render(); if (wg) toast('Прибрано з «Обраних»', 'Повернути', function () { F.restoreItem(wg); renderSheet(); render(); }); }
          break;
        }
        if (el.dataset.st === 'seen') ui.sheet.stamp = true;
        F.setStatus(it0, el.dataset.st); break;
      }
      case 'rate': {
        var it1 = sheetItem(); if (!it1) return;
        var lib1 = F.getItem(it1.id), becameSeen = false;
        if (!lib1) { F.setStatus(it1, 'seen'); becameSeen = true; }
        else if ((lib1.status === 'want' || lib1.status === 'watching') && lib1.myRating == null) { F.setStatus(lib1, 'seen'); becameSeen = true; }
        F.setMyRating(it1.id, Number(el.dataset.n));
        if (becameSeen && ui.sheet) { ui.sheet.stamp = true; renderSheet(); }
        break;
      }
      case 'rehero': { var cur0 = ui.heroId, tries = 0, nx; do { nx = F.randomPick('want', HD()); } while (nx && nx.id === cur0 && F.list('want', HD()).length > 1 && ++tries < 20); if (nx) ui.heroId = nx.id; render(); break; }
      case 'sheet-more': closeSheet(); setTab('more'); break;
      case 'extras': loadExtras(true); break;
      case 'back': goBack(); break;
      case 'person': hideSugg(); pushCurrent(); openPerson({ id: Number(el.dataset.pid), name: el.dataset.name, photo: el.dataset.photo }); break;
      case 'reperson': if (ui.sheet && ui.sheet.person) openPerson(ui.sheet.person); break;
      case 'allknown': if (ui.sheet) { var ak = el.dataset.k === 'allDir' ? 'allDir' : 'allKnown'; ui.sheet[ak] = !ui.sheet[ak]; renderSheet(); } break;
      case 'follow': {
        var ps = ui.sheet, pd = ps && ps.person && ps.pdata; if (!pd) break;
        var was = F.isFollowed(pd.id);
        if (was) F.setFollow({ id: pd.id }, false);
        else if (!F.setFollow({ id: pd.id, name: pd.name, photo: pd.photo, dept: pd.dept }, true, pd.soon)) { toast('Стежити можна щонайбільше за 60 людьми.'); break; }
        toast(was ? 'Більше не стежите за: ' + pd.name : 'Стежите. Нові фільми з’являться в «Скоро»');
        renderSheet(); break;
      }
      case 'dir': { hideSugg(); pushCurrent(); openPerson({ id: 0, name: el.dataset.name || '', photo: '' }); break; }
      case 'sharelink': {
        var lid = ui.sheet && ui.sheet.id; if (!F.isId(lid)) break;
        var li = sheetItem(), lt = li ? (li.titleUk || li.title) + (li.year ? ' (' + String(li.year).slice(0, 4) + ')' : '') : 'Kinoman', lu = location.origin + location.pathname + '#f=' + lid;
        if (navigator.share) { try { await navigator.share({ title: lt, text: lt, url: lu }); } catch (e) { /* передумали */ } }
        else { try { await navigator.clipboard.writeText(lu); toast('Посилання скопійовано'); } catch (e) { toast('Не вдалося скопіювати посилання.'); } }
        break;
      }
      case 'bio': if (ui.sheet) { ui.sheet.bioOpen = !ui.sheet.bioOpen; renderSheet(); } break;
      case 'hgenre': ui.homeGenre = el.dataset.g; render(); break;
      case 'redisc': Object.keys(ui.dc).forEach(function (k) { if (ui.dc[k].error) delete ui.dc[k]; }); render(); break;
      case 'advise': {
        if (ui.advice && ui.advice.loading) return; ui.advice = { loading: true }; render();
        try { var adv = await F.advise(MOODS[ui.mood][1]); ui.advice = { items: adv }; } catch (e) { ui.advice = { error: e }; }
        render(); break;
      }
      case 'adv-open': {
        var x = ui.advice && ui.advice.items && ui.advice.items[Number(el.dataset.i)]; if (!x) return;
        if (!F.tmdbKeyOf()) { ui.q = (x.orig || x.title) + (x.year ? ' ' + x.year : ''); setTab('search'); doSearch(false); break; }
        toast('Відкриваємо…');
        try { var hit = await F.findTmdb(x); if (!hit) { toast('Не знайшли цей фільм у TMDB. Спробуйте пошук.'); break; } var im = await F.tmdbImdbId(hit.mt, hit.tid); toastEl.classList.remove('show'); openSheet(im, { id: im, title: hit.title, year: hit.year, type: hit.mt === 'tv' ? 'series' : 'movie', poster: F.tmdbImg(hit.poster, 'w342') }); }
        catch (e) { toast(F.describeError(e)); }
        break;
      }
      case 'togcol': { var lc = ui.sheet && F.getItem(ui.sheet.id); if (lc) { F.toggleCol(lc.id, el.dataset.c); renderSheet(); } break; }
      case 'newcol': {
        var nm = window.prompt('Назва добірки, наприклад «На вечір удвох»'); if (!nm || !nm.trim()) return;
        var cid = F.addCol(nm); var lc2 = ui.sheet && F.getItem(ui.sheet.id); if (cid && lc2) F.toggleCol(lc2.id, cid); else if (!cid && lc2 && /^для\s*двох$/i.test(String(nm).trim()) && !lc2.two) F.toggleTwo(lc2.id); else if (!cid && lc2 && /^сімейні$/i.test(String(nm).trim()) && !lc2.fam) F.toggleFam(lc2.id); renderSheet(); render(); break;
      }
      case 'newcolrow': { var nm2 = window.prompt('Назва добірки, наприклад «На вечір удвох»'); if (!nm2 || !nm2.trim()) return; var nc = F.addCol(nm2); if (!nc) { toast('Така добірка вже є'); return; } toast('Добірку створено. Додавайте фільми в їхніх картках'); render(); break; }
      case 'rencol': { var cur1 = F.colList().filter(function (c) { return c.id === el.dataset.c; })[0]; if (!cur1) return; var nn = window.prompt('Нова назва добірки', cur1.name); if (nn && nn.trim()) F.renameCol(cur1.id, nn); render(); break; }
      case 'delcol': { var cur2 = F.colList().filter(function (c) { return c.id === el.dataset.c; })[0]; if (!cur2) return; if (window.confirm('Видалити добірку «' + cur2.name + '»? Фільми лишаться у ваших списках.')) F.removeCol(cur2.id); render(); break; }
      case 'spin': spinWheel(); break;
      case 'shareimg': shareFilmImage(el.dataset.id); break;
      case 'duo': openDuo(); break;
      case 'duog': { var w = el.dataset.who === 'b' ? 'b' : 'a', ix = ui.duo[w].indexOf(el.dataset.g); if (ix >= 0) ui.duo[w].splice(ix, 1); else ui.duo[w].push(el.dataset.g); renderSheet(); break; }
      case 'duom': ui.duo.max = Number(el.dataset.v) || 0; renderSheet(); break;
      case 'duot': ui.duo.type = el.dataset.v; renderSheet(); break;
      case 'markep': F.markEpisodeSeen(el.dataset.id, Number(el.dataset.s), Number(el.dataset.e)); toast('Серію відмічено'); break;
      case 'finish': {
        var fi = F.getItem(el.dataset.id); if (!fi) break;
        F.setStatus(fi, 'seen'); openSheet(fi.id); if (ui.sheet) { ui.sheet.stamp = true; renderSheet(); } toast('Переглянуто. Поставте оцінку'); break;
      }
      case 'yearimg': saveYearImage(Number(el.dataset.y)); break;
      case 'baknow': case 'baklist': case 'bakrestore': {
        var bk = ui.bak = ui.bak || {}; if (bk.busy) return;
        if (el.dataset.act === 'bakrestore' && !window.confirm('Відновити записи з цієї копії? Теперішні записи залишаться.')) return;
        bk.busy = true; bk.msg = { ok: true, text: el.dataset.act === 'baklist' ? 'Шукаємо копії…' : el.dataset.act === 'baknow' ? 'Зберігаємо…' : 'Відновлюємо…' }; render();
        try {
          if (el.dataset.act === 'baknow') { await F.backupNow(); bk.msg = { ok: true, text: 'Копію збережено в Google Диску.' }; bk.list = null; }
          else if (el.dataset.act === 'baklist') { bk.list = await F.listBackups(); bk.msg = null; }
          else { var rb = await F.restoreBackup(el.dataset.name); bk.msg = { ok: true, text: 'Відновлено. Додано: ' + rb.added + ', оновлено: ' + rb.updated + '.' }; }
          bk.old = false;
        } catch (e) { bk.msg = { ok: false, text: F.describeError(e) }; bk.old = !!(e && e.code === 'SYNC_OLD'); }
        bk.busy = false; render(); break;
      }
      case 'syncnow': {
        if (ui.syncBusy) return; ui.syncBusy = true; ui.syncMsg = { ok: true, text: 'Синхронізуємо…' }; render();
        try { var sr = await F.syncNow(); ui.syncMsg = { ok: true, text: 'Готово. Отримано нових: ' + sr.added + ', оновлено: ' + sr.updated + (sr.removed ? ', прибрано видалених: ' + sr.removed : '') + '.' }; }
        catch (e) { ui.syncMsg = { ok: false, text: F.describeError(e) }; }
        ui.syncBusy = false; render(); break;
      }
      case 'rec': {
        if (!ui.sheet) return;
        var rcur = ui.sheet, rlib = F.getItem(rcur.id), recs = rlib && rlib.recs.length ? rlib.recs : (rcur.extras && rcur.extras.data && rcur.extras.data.recs) || [], rr = null;
        for (var ri = 0; ri < recs.length; ri++) if (String(recs[ri].tid) === el.dataset.tid) rr = recs[ri];
        pushCurrent();
        openCat(el.dataset.mt, el.dataset.tid, rr ? { id: '', title: rr.title, year: rr.year, type: rr.mt === 'tv' ? 'series' : 'movie', poster: F.tmdbImg(rr.poster, 'w342') } : null, '');
        break;
      }
      case 'toggle-orig': if (ui.sheet) { ui.sheet.showOrig = !ui.sheet.showOrig; renderSheet(); } break;
      case 'translate': {
        var sh2 = ui.sheet, it4 = sheetItem(); if (!sh2 || !it4 || sh2.translating) return;
        sh2.translating = true; sh2.trError = ''; sh2.showOrig = false; renderSheet();
        try {
          var t4 = await F.translateItem(it4);
          if (F.getItem(it4.id)) F.setTranslation(it4.id, t4); else sh2.tr = t4;
          if (!t4.plotUk) sh2.trError = 'Gemini не повернув переклад. Спробуйте ще раз.';
        } catch (e) { sh2.trError = F.describeError(e); }
        sh2.translating = false; if (ui.sheet === sh2) { renderSheet(); render(); } break;
      }
      case 'season': loadSeasonNow(Number(el.dataset.n)); break;
      case 'epjump': { var er = document.getElementById('ep-' + Math.floor(Number(el.dataset.e))); if (er) { er.scrollIntoView({ behavior: 'smooth', block: 'center' }); er.classList.remove('flash'); void er.offsetWidth; er.classList.add('flash'); } break; }
      case 'ep': {
        var it2 = sheetItem(); if (!it2) return;
        if (!F.getItem(it2.id)) { var lib2 = F.setStatus(it2, 'watching'); var t = ui.sheet.tmp[ui.sheet.season]; if (t) { lib2.seasons[String(ui.sheet.season)] = t; } }
        F.toggleEpisode(it2.id, ui.sheet.season, Number(el.dataset.e)); startWatching(it2.id); renderSheet(); render(); break;
      }
      case 'season-all': {
        var it3 = sheetItem(); if (!it3) return;
        if (!F.getItem(it3.id)) { var lib3 = F.setStatus(it3, 'watching'); var t3 = ui.sheet.tmp[ui.sheet.season]; if (t3) lib3.seasons[String(ui.sheet.season)] = t3; }
        F.setSeasonWatched(it3.id, ui.sheet.season, el.dataset.on === '1'); startWatching(it3.id); renderSheet(); render(); break;
      }
      case 'refresh': {
        var sh = ui.sheet; if (!sh || sh.refreshing) return; sh.refreshing = true; sh.error = null; renderSheet();
        try { await F.refresh(sh.id); toast('Рейтинги оновлено'); } catch (e) { sh.error = e; }
        sh.refreshing = false; if (ui.sheet === sh) { renderSheet(); render(); loadExtras(true); } break;
      }
      case 'remove': {
        var gone = F.removeItem(ui.sheet.id); dismiss();
        if (gone) toast('Видалено зі списків', 'Повернути', function () { F.restoreItem(gone); }); break;
      }
      case 'hardupd': {
        // Лише файли додатка: списки, оцінки й ключі лишаються на місці
        toast('Оновлюємо…');
        try { if (navigator.serviceWorker) { var regs = await navigator.serviceWorker.getRegistrations(); for (var ri = 0; ri < regs.length; ri++) { try { await regs[ri].update(); } catch (e2) { /* без мережі */ } } } } catch (e) { /* немає підтримки */ }
        try { if (window.caches) { var ks = await caches.keys(); await Promise.all(ks.filter(function (k) { return k !== 'kinoman-img'; }).map(function (k) { return caches.delete(k); })); } } catch (e) { /* немає підтримки */ }
        location.reload(); break;
      }
      case 'ltype': ui.lists[ui.tab].type = el.dataset.type; render(); break;
      case 'genre': ui.lists[ui.tab].genre = el.dataset.genre; render(); break;
      case 'random': {
        if (F.list('want', HD(ui.lists.want)).length >= 2) openWheel(); else { var p = F.randomPick('want', HD(ui.lists.want)); if (p) openSheet(p.id); } break;
      }
      case 'testkey': {
        ui.keyMsg = { ok: true, text: 'Перевіряємо…' }; render();
        try { await F.testKey(); ui.keyMsg = { ok: true, text: 'Ключ працює.' }; } catch (e) { ui.keyMsg = { ok: false, text: F.describeError(e) }; }
        render(); break;
      }
      case 'testtmdb': {
        ui.tmdbMsg = { ok: true, text: 'Перевіряємо…' }; render();
        try { await F.testTmdb(); ui.tmdbMsg = { ok: true, text: 'Ключ TMDB працює.' }; } catch (e) { ui.tmdbMsg = { ok: false, text: F.describeError(e) }; }
        render(); break;
      }
      case 'testgem': {
        ui.gemMsg = { ok: true, text: 'Перевіряємо…' }; render();
        try { await F.testGemini(); ui.gemMsg = { ok: true, text: 'Ключ Gemini працює.' }; } catch (e) { ui.gemMsg = { ok: false, text: F.describeError(e) || 'Не вдалося перевірити ключ.' }; }
        render(); break;
      }
      case 'usenutri': ui.gemMsg = F.useForeignGemKey() ? { ok: true, text: 'Ключ взято. Натисніть «Перевірити ключ».' } : { ok: false, text: 'Ключ NutriPlan не знайдено.' }; render(); break;
      case 'export': doExport(); break;
      case 'import': { var fi = $('#import-file'); if (fi) fi.click(); break; }
      case 'toast-act': { var fn = toastEl._fn; toastEl.classList.remove('show'); toastEl._fn = null; if (fn) fn(); break; }
    }
  }
  async function doExport() {
    var text = F.exportJSON(), name = 'kinoman-kopiya-' + F.ymd(Date.now()) + '.json';
    try {
      var file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Копія Kinoman' }); ui.backupMsg = { ok: true, text: 'Копію збережено.' }; render(); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    ui.backupMsg = { ok: true, text: 'Файл копії завантажено.' }; render();
  }
  function onSubmit(form) {
    var kind = form.dataset.form;
    if (kind === 'marq') {
      var fc = ui.sheet && ui.sheet.coll && ui.sheet.coll.find; if (!fc || fc.busy) return; fc.q = form.elements.marq.value.trim(); if (fc.q.length < 2) return;
      fc.busy = true; fc.err = ''; fc.res = null; renderSheet();
      F.searchMarathons(fc.q).then(function (r) { fc.res = r; }, function (e) { fc.err = F.describeError(e); fc.res = []; }).then(function () { fc.busy = false; if (ui.sheet && ui.sheet.coll && ui.sheet.coll.find === fc) renderSheet(); });
      return;
    }
    if (kind === 'search') { ui.q = form.elements.q.value; hideSugg(); var qi = $('#q'); if (qi) qi.blur(); doSearch(false); }
    if (kind === 'tmdbkey') { F.setTmdbKey(form.elements.tmdbkey.value); ui.tmdbMsg = F.tmdbKeyOf() ? { ok: true, text: 'Ключ збережено. Натисніть «Перевірити ключ».' } : { ok: true, text: 'Ключ видалено.' }; render(); }
    if (kind === 'sync') { var okS = F.setSync(form.elements.syncurl.value, form.elements.synccode.value); ui.syncMsg = okS ? { ok: true, text: F.syncOf().url && F.syncOf().code ? 'Збережено. Натисніть «Синхронізувати».' : 'Збережено.' } : { ok: false, text: 'Це не схоже на адресу скрипта Google. Вона має закінчуватись на /exec.' }; render(); }
    if (kind === 'gemkey') { F.setGemKey(form.elements.gemkey.value); ui.gemMsg = F.gemKeyOf() ? { ok: true, text: 'Ключ збережено. Натисніть «Перевірити ключ».' } : { ok: true, text: 'Ключ видалено.' }; ui.error = null; render(); }
    if (kind === 'key') {
      F.setKey(form.elements.key.value); ui.keyMsg = F.keyOf() ? { ok: true, text: 'Ключ збережено. Натисніть «Перевірити ключ», щоб переконатись, що він працює.' } : { ok: false, text: 'Ключ порожній.' }; ui.error = null; render();
    }
  }

  function init() {
    app = $('#app'); tabsEl = $('#tabs'); sheetRoot = $('#sheet-root'); toastEl = $('#toast');
    if (window.MutationObserver) { var tmo = new MutationObserver(tailSoon); tmo.observe(app, { childList: true, subtree: true }); tmo.observe(sheetRoot, { childList: true, subtree: true }); }
    F.init();
    F.on(function () { render(); });
    // тиха синхронізація під час відкриття й коли додаток ховається
    var autoSync = function () { var so = F.syncOf(); if (!so.url || !so.code || ui.syncBusy || FB.now() - so.at < 30000) return; ui.syncBusy = true; F.syncNow().then(function () { ui.syncBusy = false; render(); }, function () { ui.syncBusy = false; }).then(function () { return F.autoBackup(); }).then(function (r) { if (r && ui.tab === 'more') render(); }, function () { /* спробуємо наступного разу */ }); };
    try { ui.hideSeen = localStorage.getItem('kinoman_hide_seen') === '1'; } catch (e) { /* без збереження */ }
    var hv = ''; try { hv = localStorage.getItem('kinoman_home_view') || ''; } catch (e) { /* без збереження */ }
    // без збереженого вибору: «Моє», якщо там щось є, інакше каталог
    ui.homeView = hv === 'mine' || hv === 'cat' ? hv : (F.list('watching').length || F.newEpisodes().length || F.newSeasons().length || F.marathons().length || F.upcoming().length || F.colList().length ? 'mine' : 'cat');
    setTimeout(autoSync, 800);
    setTimeout(function () { F.refreshFollowed(8).then(function (n) { if (n) render(); }, function () { /* без інтернету */ }); }, 4000);
    setTimeout(function () { if (F.tmdbKeyOf()) F.refreshSeries(6).then(function (n) { if (n) render(); }, function () { /* без інтернету */ }).then(function () { return F.fillTmdbIds(8); }).then(function (n) { if (n) render(); }, function () { /* без інтернету */ }); warmPosters(); }, 2500);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') autoSync(); });
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'scrim') { if (e.target === el) dismiss(); return; }
      if (el.dataset.act === 'spotclose') { if (e.target === el) closeSpot(); return; }
      if (el.dataset.act === 'spotfill') { var si = spotEl && spotEl.querySelector('#spotq'); if (si) { si.value = el.dataset.q || ''; si.focus(); spotRun(si.value.trim()); } return; }
      if (spotEl && el.closest('#spot')) closeSpot();
      onAct(el);
    });
    document.addEventListener('submit', function (e) { var f = e.target.closest('form[data-form]'); if (f) { e.preventDefault(); onSubmit(f); } });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.dataset && el.dataset.change === 'sort') { ui.lists[ui.tab].sort = el.value; render(); }
      if (el.dataset && el.dataset.change === 'collyear') { collYear(el.value); }
      if (el.dataset && el.dataset.change === 'collsort') { collSort(el.dataset.k, el.value); }
      if (el.dataset && el.dataset.change === 'plan' && ui.sheet && ui.sheet.id) { F.setPlan(ui.sheet.id, el.value); }
      if (el.dataset && el.dataset.change === 'time') { ui.lists[ui.tab].time = el.value; render(); }
      if (el.dataset && el.dataset.change === 'fl' && /^(genre|decade|vote)$/.test(el.dataset.k)) { ui.fl[el.dataset.k] = el.value; render(); }
      if (el.id === 'import-file' && el.files && el.files[0]) {
        var rd = new FileReader();
        rd.onload = function () { var r = F.importJSON(String(rd.result)); ui.backupMsg = r.error ? { ok: false, text: r.error } : { ok: true, text: 'Додано ' + r.added + ', оновлено ' + r.updated + '.' }; render(); };
        rd.onerror = function () { ui.backupMsg = { ok: false, text: 'Не вдалося прочитати файл.' }; render(); };
        rd.readAsText(el.files[0]);
      }
    });
    document.addEventListener('input', function (e) { var el = e.target; if (el.id === 'q') { ui.q = el.value; if (!ui.q.trim() && (ui.searched || ui.results.length)) { ui.token++; ui.results = []; ui.searched = false; ui.error = null; ui.loading = false; ui.corrected = ''; ui.translatedAs = ''; var pos = el.selectionStart; render(); var q2 = $('#q'); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e2) { /* ignore */ } } } queueSugg(); return; } if (el.dataset && el.dataset.input === 'note' && ui.sheet) F.setNote(ui.sheet.id, el.value); });
    // тап по підказці не забирає фокус у поля, тож список не зникає раніше за клік
    document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('#sugg')) e.preventDefault(); });
    document.addEventListener('focusin', function (e) { if (e.target.id === 'q' && e.target.value.trim().length >= 2) queueSugg(true); });
    document.addEventListener('focusout', function (e) { if (e.target.id === 'q') setTimeout(function () { var a = document.activeElement; if (!a || !a.closest || !a.closest('#sugg')) hideSugg(); }, 180); });
    document.addEventListener('error', function (e) {
      var t = e.target; if (t && t.tagName === 'IMG' && t.closest('.poster')) t.remove();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (spotEl) { closeSpot(); return; } if ($('#sugg.show')) { hideSugg(); return; } if (ui.sheet) dismiss(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л') && isDesktop()) { e.preventDefault(); if (spotEl) closeSpot(); else openSpot(); return; }
      if (spotEl) return;
      // ПК: «/» відкриває пошук, цифри 1–6 перемикають розділи (не під час введення тексту)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      if (e.key === '/' || e.key === '.' && e.code === 'Slash') { e.preventDefault(); if (isDesktop()) { openSpot(); return; } if (ui.sheet) closeSheet(); if (ui.tab !== 'search') setTab('search'); var q = $('#q'); if (q) { q.focus(); q.select(); } return; }
      if (isDesktop() && !ui.sheet && ui.tab === 'home' && ui.heroN > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && window.scrollY < 200) { ui.heroIx = ((ui.heroIx || 0) + (e.key === 'ArrowRight' ? 1 : ui.heroN - 1)) % ui.heroN; paintHero(); return; }
      if (!ui.sheet && e.key >= '1' && e.key <= String(TABS.length)) { setTab(TABS[Number(e.key) - 1][0]); }
    });
    initDesktop();
    // ширина вікна перетнула межу телефон/ПК: перемальовуємо (банер є лише на ПК)
    var mq = window.matchMedia && window.matchMedia('(min-width:1024px)'); if (mq && mq.addEventListener) mq.addEventListener('change', function () { render(); });
    window.addEventListener('scroll', function () { document.documentElement.classList.toggle('scrolled', window.scrollY > 24); }, { passive: true });
    document.addEventListener('animationend', function (e) { if (e.animationName === 'bbprog') heroNext(); });
    render();
    histInit();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  window.KinoUI = { ui: ui, render: render, openSheet: openSheet, toast: toast };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
