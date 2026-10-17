/* Kinoman: інтерфейс */
(function () {
  'use strict';
  var F = window.FB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app, tabsEl, sheetRoot, toastEl;
  var ui = {
    tab: 'home', homeMt: 'movie', homeGenre: '', dc: {}, advice: null, fl: { mt: 'movie', genre: '', decade: '', vote: '' }, syncMsg: null, colMsg: null, duo: { a: [], b: [], max: 0, type: '' }, cat: { sh: {}, shown: { movie: 5, tv: 5, toon: 5 }, forKey: null, token: 0 },
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
  function featureHtml() {
    if (ui.loading || ui.results.length || ui.searched || ui.q.trim()) return '';
    var want = F.list('want'); if (!want.length) return '';
    var it = ui.heroId && F.getItem(ui.heroId) && F.getItem(ui.heroId).status === 'want' ? F.getItem(ui.heroId) : null;
    if (!it) { it = F.randomPick('want'); ui.heroId = it.id; }
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
  function catTile(r) {
    return '<button class="tile glow" style="--h:' + hue(r.tid) + '" data-act="cat" data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '"><span class="poster"><span class="ph">' + esc(r.title) + '</span><img src="' + esc(F.tmdbImg(r.poster, 'w342')) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' + (r.vote ? '<span class="badge"><span class="tm">★ ' + r.vote.toFixed(1) + '</span></span>' : '') + '</span><span class="name">' + esc(r.title) + '</span><span class="yr">' + esc(r.year) + '</span></button>';
  }
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
    if (d.loading) return '<div class="spin" role="status" aria-label="Завантажуємо"></div>';
    if (d.error) return '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(d.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="redisc">Спробувати ще раз</button></p></div></div>';
    if (!d.items.length) return emptyHtml('film', 'Нічого не знайшли', 'Спробуйте м’якші фільтри.');
    return '<div class="tgrid">' + d.items.map(catTile).join('') + '</div>' + (d.busy ? '<div class="spin" role="status" aria-label="Завантажуємо"></div>' : d.more ? '<p class="morewrap"><button class="btn ghost sm" data-act="discmore" data-key="' + esc(d.key) + '">Показати ще</button></p>' : '');
  }
  function adviceHtml() {
    if (!F.gemKeyOf()) return '';
    var a = ui.advice;
    var h = '<section class="advice"><div class="adv-h"><div><h2>Порада від Gemini</h2><p class="sub">На основі ваших оцінок</p></div><button class="btn sm" data-act="advise"' + (a && a.loading ? ' disabled' : '') + '>' + ic('sparkle', 'sm') + (a && a.items ? 'Ще порада' : 'Порадь') + '</button></div>';
    if (a && a.loading) h += '<div class="spin" role="status" aria-label="Gemini думає"></div>';
    else if (a && a.error) h += '<p class="er-t" role="status">' + esc(F.describeError(a.error)) + '</p>';
    else if (a && a.items) h += '<div class="adv-list">' + a.items.map(function (x, i) { return '<button class="adv" data-act="adv-open" data-i="' + i + '"><b>' + esc(x.title || x.orig) + '</b><span class="m">' + esc([x.mt === 'tv' ? 'Серіал' : 'Фільм', x.year, x.orig && x.orig !== x.title ? x.orig : ''].filter(Boolean).join(', ')) + '</span><span class="w">' + esc(x.why) + '</span></button>'; }).join('') + '</div>';
    return h + '</section>';
  }
  function ago(d) { return d <= 0 ? 'сьогодні' : d === 1 ? 'вчора' : d + ' ' + plural(d, 'день', 'дні', 'днів') + ' тому'; }
  function newsHtml() {
    var n = F.newEpisodes(); if (!n.length) return '';
    return '<section class="news"><h2>Вийшло нове</h2>' + n.map(function (x) {
      return '<div class="newrow glow" style="--h:' + hue(x.item.id) + '"><button class="nopen" data-act="open" data-id="' + x.item.id + '"><span class="poster"><span class="ph">' + esc(x.item.title) + '</span>' + (x.item.poster ? '<img src="' + esc(x.item.poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><span class="nt"><b>' + esc(x.item.titleUk || x.item.title) + '</b><span>Серія S' + x.ep.s + 'E' + x.ep.e + (x.ep.name ? ', ' + esc(x.ep.name) : '') + '</span><span class="when">' + ago(x.days) + '</span></span></button>' +
        '<button class="chip" data-act="markep" data-id="' + x.item.id + '" data-s="' + x.ep.s + '" data-e="' + x.ep.e + '" aria-label="Уже переглянув серію">' + ic('check', 'sm') + 'Бачив</button></div>';
    }).join('') + '</section>';
  }
  function soonHtml() {
    var u = F.upcoming(); if (!u.length) return '';
    return '<section class="soon"><h2>Скоро</h2><div class="soonlist">' + u.map(function (x) {
      var p = x.date.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      return '<button class="soonrow" data-act="open" data-id="' + x.item.id + '"><span class="sd"><b>' + d.getDate() + '</b><span>' + ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'][d.getMonth()] + '</span></span><span class="st"><b>' + esc(x.item.titleUk || x.item.title) + '</b><span>' + esc(x.label) + '</span></span></button>';
    }).join('') + '</div></section>';
  }
  function plainShelf(title, items) {
    if (!items.length) return '';
    return '<section class="shelf"><div class="shelf-h"><h2>' + esc(title) + '</h2><span class="sub">' + items.length + '</span></div><div class="strip">' + items.slice(0, 20).map(tileHtml).join('') + '</div></section>';
  }
  // ---------- Добірки каталогу ----------
  function shelfState(def) { return ui.cat.sh[def.id]; }
  function shelfSection(def) {
    var st = shelfState(def); if (!st) return '';
    var h = '<section class="shelf" data-shelf="' + esc(def.id) + '"><div class="shelf-h"><h2>' + esc(def.title) + '</h2>' + (st.items && st.items.length ? '<button class="more-link" data-act="coll" data-id="' + esc(def.id) + '">Усі</button>' : '') + '</div>';
    if (st.loading) return h + '<div class="spin" role="status" aria-label="Завантажуємо"></div></section>';
    if (st.error) return h + '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(st.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="reshelf" data-id="' + esc(def.id) + '">Спробувати ще раз</button></p></div></div></section>';
    if (!st.items.length) return '';
    return h + '<div class="strip">' + st.items.map(catTile).join('') + '</div></section>';
  }
  function paintShelf(def) {
    var box = app && app.querySelector('[data-shelf="' + def.id + '"]'); if (!box) return;
    var html = shelfSection(def); if (html) box.outerHTML = html; else box.remove();
  }
  function loadShelf(def) {
    var tok = ui.cat.token, st = ui.cat.sh[def.id] = { loading: true, items: null, more: false, error: null };
    F.collection(def.id, 1).then(function (r) { st.items = r.items; st.more = r.more; }, function (e) { st.error = e; }).then(function () {
      if (tok !== ui.cat.token) return; st.loading = false; paintShelf(def);
    });
  }
  function ensureShelves() {
    if (ui.tab !== 'home' || !F.tmdbKeyOf() || (ui.homeGenre && ui.homeMt !== 'toon')) return;
    F.collDefs(ui.homeMt).slice(0, ui.cat.shown[ui.homeMt]).forEach(function (d) { if (!ui.cat.sh[d.id]) loadShelf(d); });
  }
  function renderHome() {
    var kk = F.tmdbKeyOf(); if (ui.cat.forKey !== kk) { ui.cat.forKey = kk; ui.cat.sh = {}; ui.cat.token++; }
    var h = '<div class="page-h"><h1 class="logo"><i></i>Kinoman</h1></div>';
    h += adviceHtml() + newsHtml();
    h += shelfHtml('Дивлюсь зараз', F.list('watching').slice(0, 12), 'watching');
    h += soonHtml();
    h += F.colList().map(function (c) { return plainShelf(c.name, F.colItems(c.id)); }).join('');
    var mt = ui.homeMt, toon = mt === 'toon';
    h += '<div class="seg cat-seg" role="group" aria-label="Каталог">' + F.CATS.map(function (t) { return '<button type="button" data-act="hometype" data-mt="' + t[0] + '" aria-pressed="' + (mt === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (!F.tmdbKeyOf()) return h + '<div class="notice">' + ic('film') + '<div><b>Каталог потребує ключ TMDB</b><div class="sub">З ним тут з’являться добірки: що в тренді, що йде в кіно, топи за жанрами й десятиліттями. Ключ безкоштовний, його вставляють у розділі «Ще».</div><p style="margin:10px 0 0"><button class="btn sm" data-act="tab" data-tab="more">Додати ключ</button></p></div></div>';
    if (!toon) h += '<div class="chips" role="group" aria-label="Жанри"><button class="chip' + (!ui.homeGenre ? ' on' : '') + '" data-act="hgenre" data-g="">Усе</button>' + GENRES.filter(function (g) { return g[0] !== '16' && g[0] !== 'anime'; }).map(function (g) { return '<button class="chip' + (ui.homeGenre === g[0] ? ' on' : '') + '" data-act="hgenre" data-g="' + g[0] + '">' + g[1] + '</button>'; }).join('') + '</div>';
    if (!toon && ui.homeGenre) {
      var gk = 'h:' + mt + ':' + ui.homeGenre, go = discOpts(mt, ui.homeGenre, '', '');
      return h + discGrid(disc(gk, function (pg) { return F.discover(mt, go, pg); }));
    }
    ensureShelves();
    var defs = F.collDefs(mt), n = ui.cat.shown[mt], body = defs.slice(0, n).map(shelfSection).join('');
    h += body;
    var states = defs.slice(0, n).map(shelfState).filter(Boolean);
    if (states.length && states.every(function (x) { return !x.loading && !x.error && !x.items.length; })) h += emptyHtml('film', 'Каталог порожній', 'TMDB не повернув жодного фільму. Спробуйте пізніше.');
    if (n < defs.length) h += '<p class="morewrap"><button class="btn ghost" data-act="moreshelves">Більше добірок</button></p>';
    return h;
  }
  // ---------- Уся добірка ----------
  function collHtml(sh) {
    var c = sh.coll;
    var h = '<div class="sheetbar">' + (ui.stack.length ? '<button class="back" data-act="back" aria-label="Назад">' + ic('left') + '</button>' : '') + '<button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div><div class="coll"><h3>' + esc(c.title) + '</h3><p class="sub">' + c.items.length + ' ' + plural(c.items.length, 'фільм і серіал', 'фільми й серіали', 'фільмів і серіалів') + '</p>';
    h += '<div class="tgrid">' + c.items.map(catTile).join('') + '</div>';
    if (c.error) h += '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(c.error)) + '</div></div>';
    if (c.busy) h += '<div class="spin" role="status" aria-label="Завантажуємо"></div>';
    else if (c.more) h += '<p class="morewrap"><button class="btn ghost sm" data-act="collmore">Показати ще</button></p>';
    return h + '</div>';
  }
  function openColl(id) {
    var def = F.collDefs('movie').concat(F.collDefs('tv'), F.collDefs('toon')).filter(function (d) { return d.id === id; })[0], st = ui.cat.sh[id]; if (!def || !st || !st.items) return;
    ui.sheet = { coll: { id: id, title: def.title, items: st.items.slice(), page: 1, more: st.more, busy: false, error: null } }; ui.stack = []; renderSheet();
  }
  async function collMore() {
    var sh = ui.sheet, c = sh && sh.coll; if (!c || c.busy || !c.more) return; c.busy = true; c.error = null; renderSheet();
    try { var r = await F.collection(c.id, c.page + 1); c.page++; var seen = {}; c.items.forEach(function (x) { seen[x.mt + x.tid] = 1; }); r.items.forEach(function (x) { if (!seen[x.mt + x.tid]) c.items.push(x); }); c.more = r.more; }
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
    if (!items || !items.length) { b.classList.remove('show'); b.innerHTML = ''; return; }
    b.innerHTML = items.map(function (r) {
      return '<button type="button" class="sg" role="option" data-act="cat" data-mt="' + r.mt + '" data-tid="' + r.tid + '" data-title="' + esc(r.title) + '" data-year="' + esc(r.year) + '" data-poster="' + esc(r.poster) + '"><span class="sp">' + (r.poster ? '<img src="' + esc(F.tmdbImg(r.poster, 'w92')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ic('film', 'sm')) + '</span><span class="st"><b>' + esc(r.title) + '</b><span>' + esc([r.mt === 'tv' ? 'Серіал' : 'Фільм', r.year, r.orig].filter(Boolean).join(', ')) + '</span></span>' + (r.vote ? '<span class="sv">★ ' + r.vote.toFixed(1) + '</span>' : '') + '</button>';
    }).join('');
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
  function renderSearch() {
    var h = '<div class="page-h"><h1>Пошук</h1></div>';
    if (!F.keyOf()) h += noKeyHtml();
    h += '<div class="sbox"><form class="searchbar" data-form="search" role="search"><input type="search" id="q" name="q" aria-autocomplete="list" aria-controls="sugg" placeholder="' + (F.gemKeyOf() ? 'Назва фільму чи серіалу' : 'Назва англійською або IMDb ID') + '" value="' + esc(ui.q) + '" autocomplete="off" autocapitalize="none" enterkeyhint="search" aria-label="Назва фільму чи серіалу"><button class="btn" type="submit" aria-label="Шукати">' + ic('search') + '</button></form><div id="sugg" class="sugg" role="listbox" aria-label="Підказки"></div></div>';
    h += '<div class="seg" role="group" aria-label="Тип">' + [['', 'Усе'], ['movie', 'Фільми'], ['series', 'Серіали']].map(function (t) { return '<button type="button" data-act="type" data-type="' + t[0] + '" aria-pressed="' + (ui.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (ui.error) h += '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(ui.error)) + (ui.error.code === 'NEED_GEMINI' ? '<p style="margin:10px 0 0"><button class="btn sm" data-act="tab" data-tab="more">Додати ключ Gemini</button></p>' : '') + '</div></div>';
    if (ui.results.length && ui.translatedAs) h += '<p class="sub" style="margin:0 0 6px">Шукали за оригінальною назвою: ' + esc(ui.translatedAs) + '</p>';
    if (ui.results.length && ui.exact) h += '<p class="sub" style="margin:0 0 6px">Назва надто загальна, тому показано один найточніший збіг. Щоб уточнити, додайте рік, наприклад «Dark 2017».</p>';
    if (ui.results.length) {
      h += '<div>' + ui.results.map(rowHtml).join('') + '</div>';
      if (ui.results.length < ui.total) h += '<div class="more">' + (ui.loading ? '<div class="spin" role="status" aria-label="Завантаження"></div>' : '<button class="btn ghost block" data-act="more">Показати ще</button>') + '</div>';
    } else if (ui.loading) h += '<div class="spin" role="status" aria-label="Шукаємо"></div>';
    else if (ui.searched && !ui.error) h += emptyHtml('film', 'Нічого не знайшли', 'OMDb знає назви англійською. Спробуйте оригінальну назву або вставте ID з IMDb, наприклад tt0133093.');
    else if (!ui.error && F.tmdbKeyOf()) h += filterHtml();
    else if (!ui.error && F.keyOf()) h += emptyHtml('film', 'Що шукаємо?', 'Введіть назву фільму чи серіалу. Рейтинги IMDb, Rotten Tomatoes та Metacritic з’являться в картці.');
    return h;
  }
  async function doSearch(more) {
    var q = ui.q.trim(); if (!q) return;
    var tok = ++ui.token; ui.loading = true; ui.error = null; if (!more) { ui.exact = false; ui.translatedAs = ''; }
    if (!more) { ui.results = []; ui.total = 0; ui.page = 0; ui.searched = false; }
    render();
    try {
      var page = more ? ui.page + 1 : 1; var r = await F.search(q, ui.type, page);
      if (tok !== ui.token) return;
      var seen = {}; ui.results.forEach(function (x) { seen[x.id] = 1; });
      ui.results = ui.results.concat(r.items.filter(function (x) { return !seen[x.id]; })); ui.total = r.total; ui.page = page; ui.searched = true; ui.exact = !!r.exact; ui.translatedAs = r.translatedAs || '';
    } catch (e) { if (tok !== ui.token) return; ui.error = e; ui.searched = true; }
    ui.loading = false; render();
  }

  // ---------- Списки ----------
  function cardHtml(it, i, status) {
    var img = it.poster ? '<img src="' + esc(it.poster) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '';
    var st = ' style="--h:' + hue(it.id) + ';--i:' + i + '"', nm = esc(it.titleUk || it.title);
    if (status === 'seen') {
      var num = it.myRating ? '<b class="me">' + it.myRating + '</b><i>з 10</i>' : (it.type === 'series' && F.watchedCount(it) ? '<b class="done">' + F.watchedCount(it) + '</b><i>еп.</i>' : '<b class="none">—</b><i>без оцінки</i>');
      var when = it.seenAt ? new Date(it.seenAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      return '<button class="card stub glow"' + st + ' data-act="open" data-id="' + it.id + '"><span class="poster"><span class="ph">' + esc(it.title) + '</span>' + img + '</span><span class="mid"><span class="name">' + nm + '</span><span class="yr">' + esc(it.year) + (it.ratings.imdb != null ? ', IMDb ' + it.ratings.imdb.toFixed(1) : '') + '</span>' + (when ? '<span class="when">' + esc(when) + '</span>' : '') + '</span><span class="num">' + num + '</span></button>';
    }
    var b = '';
    if (it.ratings.imdb != null) b += '<span>' + it.ratings.imdb.toFixed(1) + '</span>';
    if (it.myRating) b += '<span class="me" title="Моя оцінка">' + it.myRating + '</span>';
    else if (it.type === 'series' && F.watchedCount(it)) b += '<span class="done">' + F.watchedCount(it) + ' еп.</span>';
    var nx = status === 'watching' ? F.nextForMe(it) : null;
    return '<button class="card glow"' + st + ' data-act="open" data-id="' + it.id + '"><span class="poster"><span class="ph">' + esc(it.title) + '</span>' + img + '<span class="badge">' + b + '</span><span class="over"><span class="name">' + nm + '</span><span class="yr">' + esc(it.year) + '</span>' + (nx ? '<span class="nx">Далі ' + F.epCode(nx) + '</span>' : '') + '</span></span></button>';
  }
  function renderList(status) {
    var f = ui.lists[status], all = F.list(status), items = F.list(status, f);
    var avg = status === 'seen' ? F.stats().avgMine : null;
    var h = '<div class="page-h big"><div><h1>' + NAMES[status] + '</h1><p class="sub">' + all.length + ' ' + (status !== 'seen' ? plural(all.length, 'позиція', 'позиції', 'позицій') : plural(all.length, 'фільм і серіал', 'фільми й серіали', 'фільмів і серіалів')) + (avg != null ? ', середня оцінка ' + avg.toFixed(1) : '') + '</p></div>' + (status === 'want' && all.length > 1 ? '<span class="hbtns"><button class="btn soft sm" data-act="duo">' + ic('heart', 'sm') + 'Вдвох</button><button class="btn soft sm" data-act="random">' + ic('shuffle', 'sm') + 'Що подивитись?</button></span>' : '') + '</div>';
    if (!all.length) {
      return h + (status === 'want' ? emptyHtml('heart', 'Тут буде ваш список', 'Знайдіть фільм і натисніть «В обране», щоб не забути його.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>')
        : status === 'watching' ? emptyHtml('play', 'Зараз нічого не дивитесь', 'Натисніть «Дивлюсь» у картці фільму чи серіалу. Для серіалів тут буде видно, скільки серій вже позаду.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>')
        : emptyHtml('eye', 'Поки нічого не переглянуто', 'Позначайте фільми як переглянуті й ставте свої оцінки від 1 до 10.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>'));
    }
    h += '<div class="seg" role="group" aria-label="Тип">' + [['', 'Усе'], ['movie', 'Фільми'], ['series', 'Серіали']].map(function (t) { return '<button type="button" data-act="ltype" data-type="' + t[0] + '" aria-pressed="' + (f.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="tools"><select data-change="time" aria-label="Час">' + [['', 'Будь-який час'], ['90', 'До 90 хв'], ['120', '90 хв – 2 год'], ['121', 'Понад 2 год']].map(function (o) { return '<option value="' + o[0] + '"' + ((f.time || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><select data-change="sort" aria-label="Сортування">' + Object.keys(F.SORTS).map(function (k) { return '<option value="' + k + '"' + (f.sort === k ? ' selected' : '') + '>' + esc(F.SORTS[k]) + '</option>'; }).join('') + '</select></div>';
    var gs = F.genres(status);
    if (gs.length > 1) h += '<div class="chips" role="group" aria-label="Жанри"><button class="chip' + (!f.genre ? ' on' : '') + '" data-act="genre" data-genre="">Усі жанри</button>' + gs.slice(0, 14).map(function (g) { return '<button class="chip' + (f.genre === g.name ? ' on' : '') + '" data-act="genre" data-genre="' + esc(g.name) + '">' + esc(F.genreUk(g.name)) + ' ' + g.count + '</button>'; }).join('') + '</div>';
    if (!items.length) return h + emptyHtml('film', 'За цим фільтром порожньо', 'Змініть тип, жанр чи час.');
    return h + '<div class="' + (status === 'seen' ? 'stubs' : 'grid') + '">' + items.map(function (it, i) { var c = cardHtml(it, i, status); return status === 'watching' ? '<div class="cardwrap">' + c + '<button class="fin" data-act="finish" data-id="' + it.id + '" aria-label="Завершив: ' + esc(it.titleUk || it.title) + '">' + ic('check', 'sm') + 'Завершив</button></div>' : c; }).join('') + '</div>';
  }

  // ---------- Ще ----------
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
    return h + '</section>';
  }
  function syncPanel() {
    var so = F.syncOf();
    var h = '<section class="panel"><h2>Синхронізація між пристроями</h2><p class="sub" style="margin:0 0 10px">Ваші списки зберігаються у вашому Google Диску через власний скрипт. Однакові адреса й секретне слово на двох телефонах дають однакові списки.</p>';
    h += '<form data-form="sync"><label class="fl" for="syncurl">Адреса скрипта</label><input type="text" id="syncurl" name="syncurl" value="' + esc(so.url) + '" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" autocapitalize="none" spellcheck="false">' +
      '<label class="fl" for="synccode">Секретне слово</label><input type="password" id="synccode" name="synccode" value="' + esc(so.code) + '" autocomplete="off" autocapitalize="none" spellcheck="false"><p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="submit">Зберегти</button><button class="btn ghost sm" type="button" data-act="syncnow"' + (so.url && so.code ? '' : ' disabled') + '>' + ic('refresh', 'sm') + 'Синхронізувати</button></p></form>';
    if (ui.syncMsg) h += '<p class="' + (ui.syncMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.syncMsg.text) + '</p>';
    if (so.at) h += '<p class="fine">Остання синхронізація: ' + esc(new Date(so.at).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + '. Додаток синхронізується й сам, коли ви його відкриваєте.</p>';
    return h + '<p class="fine">Адреса й слово зберігаються лише в цьому телефоні та не потрапляють у копію даних.</p></section>';
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
  function renderMore() {
    var s = F.stats(), hasKey = !!F.keyOf();
    var h = '<div class="page-h"><h1>Ще</h1></div>';
    h += '<section class="panel"><h2>Ключ OMDb</h2><p class="sub" style="margin:0 0 10px">Усі дані про фільми беруться з OMDb. Безкоштовний ключ можна отримати на <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">omdbapi.com</a>: оберіть FREE, вкажіть пошту й підтвердіть її листом.</p>';
    h += '<form class="keyrow" data-form="key"><input type="text" id="key" name="key" value="' + esc(F.keyOf()) + '" placeholder="Ключ з листа" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Ключ OMDb"><button class="btn" type="submit">Зберегти</button></form>';
    h += '<p style="margin:10px 0 0"><button class="btn ghost sm" data-act="testkey"' + (hasKey ? '' : ' disabled') + '>Перевірити ключ</button></p>';
    if (ui.keyMsg) h += '<p class="' + (ui.keyMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.keyMsg.text) + '</p>';
    h += '<p class="fine">Ключ зберігається лише в цьому телефоні й не потрапляє в копію даних. OMDb приймає ключ лише в адресі запиту, тому нікому його не показуйте й не публікуйте.</p></section>';
    h += '<section class="panel"><h2>TMDB (необов’язково)</h2><p class="sub" style="margin:0 0 10px">З ключем TMDB у картці фільму з’являються склад акторів із фото, схожі фільми та українські назви й описи. Безкоштовний ключ: <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>. Підійде довгий «API Read Access Token» або короткий «API Key».</p>';
    h += '<form class="keyrow" data-form="tmdbkey"><input type="text" id="tmdbkey" name="tmdbkey" value="' + esc(F.tmdbKeyOf()) + '" placeholder="Ключ TMDB" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Ключ TMDB"><button class="btn" type="submit">Зберегти</button></form>';
    h += '<p style="margin:10px 0 0"><button class="btn ghost sm" data-act="testtmdb"' + (F.tmdbKeyOf() ? '' : ' disabled') + '>Перевірити ключ</button></p>';
    if (ui.tmdbMsg) h += '<p class="' + (ui.tmdbMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.tmdbMsg.text) + '</p>';
    h += '<p class="fine">Ключ зберігається лише в цьому телефоні й не потрапляє в копію даних. Цей додаток використовує TMDB API, але не схвалений і не сертифікований TMDB.</p></section>';
    h += '<section class="panel"><h2>Gemini (необов’язково)</h2><p class="sub" style="margin:0 0 10px">З ключем Gemini можна шукати фільми українською та перекладати сюжет. Без нього все працює, але назви треба вводити англійською.</p>';
    h += '<form class="keyrow" data-form="gemkey"><input type="text" id="gemkey" name="gemkey" value="' + esc(F.gemKeyOf()) + '" placeholder="Ключ Gemini" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Ключ Gemini"><button class="btn" type="submit">Зберегти</button></form>';
    h += '<p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="testgem"' + (F.gemKeyOf() ? '' : ' disabled') + '>Перевірити ключ</button>' + (!F.gemKeyOf() && F.foreignGemKey() ? '<button class="btn soft sm" data-act="usenutri">Взяти ключ із NutriPlan</button>' : '') + '</p>';
    if (ui.gemMsg) h += '<p class="' + (ui.gemMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.gemMsg.text) + '</p>';
    h += '<p class="fine">Ключ зберігається лише в цьому телефоні й не потрапляє в копію даних. До Google надсилається тільки назва, яку ви шукаєте, та опис фільму для перекладу. Це безкоштовно в межах ліміту Google.</p></section>';
    h += '<section class="panel"><h2>Ваша статистика</h2><div class="stats"><div class="stat"><div class="v">' + s.seen + '</div><div class="n">переглянуто</div></div><div class="stat"><div class="v">' + s.want + '</div><div class="n">в обраному</div></div><div class="stat"><div class="v">' + (s.avgMine == null ? '—' : s.avgMine.toFixed(1)) + '</div><div class="n">середня оцінка</div></div><div class="stat"><div class="v">' + (s.minutes ? esc(F.fmtMinutes(s.minutes)) : '—') + '</div><div class="n">часу за екраном</div></div></div>' + (s.topGenres.length ? '<p class="sub">Найчастіше: ' + s.topGenres.map(function (g) { return esc(F.genreUk(g.name)); }).join(', ') + '</p>' : '') + '</section>';
    h += yearPanel() + recordsPanel() + colPanel() + syncPanel();
    h += '<section class="panel"><h2>Копія даних</h2><p class="sub" style="margin:0 0 10px">Списки, оцінки й нотатки лежать тільки в цьому телефоні. Збережіть копію, щоб перенести їх на інший пристрій чи не втратити при очищенні браузера.</p><div class="actions" style="margin-top:0"><button class="btn ghost" data-act="export">' + ic('download', 'sm') + 'Зберегти копію</button><button class="btn ghost" data-act="import">' + ic('upload', 'sm') + 'Відновити</button></div><input type="file" id="import-file" accept="application/json,.json" class="hide">';
    if (ui.backupMsg) h += '<p class="' + (ui.backupMsg.ok ? 'ok' : 'er-t') + '" role="status" style="margin:10px 0 0">' + esc(ui.backupMsg.text) + '</p>';
    if (F.isSaveFailed()) h += '<p class="er-t">Телефон не дає зберегти дані. Звільніть місце або вимкніть приватний режим.</p>';
    h += '</section>';
    h += '<p class="fine">Версія додатка: kinoman-' + F.VERSION + '. Дані фільмів: <a href="https://www.omdbapi.com/" target="_blank" rel="noopener">OMDb API</a>. Опис і назви англійською. Рейтинги належать IMDb, Rotten Tomatoes та Metacritic.</p>';
    return h;
  }

  // ---------- Картка фільму ----------
  function scoreClass(kind, v) {
    if (v == null) return 'none';
    if (kind === 'rt') return v >= 60 ? 'good' : 'bad';
    return v >= 61 ? 'good' : v >= 40 ? 'mid' : 'bad';
  }
  function dlRow(k, v) { return v ? '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>' : ''; }
  function seasonBlock(sh, it, lib) {
    if (it.type !== 'series' || !it.totalSeasons) return '';
    var n = sh.season, h = '<h2>Сезони й серії</h2><div class="seasons" role="group" aria-label="Сезони">';
    for (var i = 1; i <= it.totalSeasons; i++) h += '<button type="button" data-act="season" data-n="' + i + '" aria-pressed="' + (n === i) + '">' + i + '</button>';
    h += '</div>';
    if (!n) return h + '<p class="sub">Оберіть сезон, щоб побачити серії й відмічати переглянуті.</p>';
    if (sh.loadingSeason === n) return h + '<div class="spin" role="status" aria-label="Завантаження"></div>';
    if (sh.seasonError && sh.seasonError.n === n) return h + '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.seasonError.e)) + '</div></div>';
    var eps = (lib && lib.seasons[String(n)]) || sh.tmp[n];
    if (!eps) return h;
    if (!eps.length) return h + '<p class="sub">Для цього сезону OMDb не має списку серій.</p>';
    var w = lib ? F.seasonProgress(lib, n).watched : 0;
    h += '<p class="sub" style="margin:4px 0 0">Переглянуто ' + w + ' з ' + eps.length + '</p><div class="prog"><i style="width:' + Math.round(100 * w / eps.length) + '%"></i></div>';
    h += '<p style="margin:8px 0"><button class="btn ghost sm" data-act="season-all" data-on="' + (w === eps.length ? 0 : 1) + '">' + (w === eps.length ? 'Зняти всі позначки' : 'Позначити весь сезон') + '</button></p>';
    eps.forEach(function (e) {
      var on = lib && lib.watched[F.epKey(n, e.n)];
      h += '<button class="ep' + (on ? ' on' : '') + '" data-act="ep" data-e="' + e.n + '" aria-pressed="' + (!!on) + '"><span class="box">' + ic('check', 'sm') + '</span><span class="et"><b>' + e.n + '. ' + esc(e.title || 'Без назви') + '</b>' + (e.released ? '<span>' + esc(e.released) + '</span>' : '') + '</span>' + (e.rating != null ? '<span class="er">' + e.rating.toFixed(1) + '</span>' : '') + '</button>';
    });
    return h;
  }
  function sheetTr(sh, lib, it) {
    var ex = sh.extras && sh.extras.data;
    if (lib && (lib.plotUk || lib.titleUk)) return { titleUk: lib.titleUk, plotUk: lib.plotUk };
    var t = sh.tr || {}; return { titleUk: t.titleUk || (ex && ex.titleUk) || '', plotUk: t.plotUk || (ex && ex.plotUk) || '' };
  }
  function initials(n) { return String(n).split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
  function exOf(sh, lib) { return lib && lib.xv >= 3 ? lib : (sh.extras && sh.extras.data) || lib || {}; }
  function gsearch(site, q) { return 'https://www.google.com/search?q=' + encodeURIComponent('site:' + site + ' ' + q); }
  function watchRow(sh, lib, it, tr) {
    var x = exOf(sh, lib), name = tr.titleUk || it.title;
    var trailer = x.trailer ? 'https://www.youtube.com/watch?v=' + x.trailer : 'https://www.youtube.com/results?search_query=' + encodeURIComponent(it.title + ' ' + String(it.year).slice(0, 4) + ' трейлер');
    return '<div class="watch"><a class="btn sm trailer" href="' + esc(trailer) + '" target="_blank" rel="noopener">' + ic('play', 'sm') + 'Трейлер</a>' +
      '<a class="btn ghost sm" href="' + esc(gsearch('tv.kyivstar.ua', name)) + '" target="_blank" rel="noopener">Київстар ТБ</a>' +
      '<a class="btn ghost sm" href="' + esc(gsearch('sweet.tv', name)) + '" target="_blank" rel="noopener">SWEET.TV</a></div>';
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
    return '<h2>Добірки</h2><div class="chips cols" role="group" aria-label="Добірки">' + cols.map(function (c) { var on = lib.cols.indexOf(c.id) >= 0; return '<button class="chip' + (on ? ' on' : '') + '" data-act="togcol" data-c="' + c.id + '" aria-pressed="' + on + '">' + (on ? ic('check', 'sm') : '') + esc(c.name) + '</button>'; }).join('') + '<button class="chip" data-act="newcol">' + ic('plus', 'sm') + 'Нова добірка</button></div>';
  }
  function personHtml(sh) {
    var p = sh.person, d = sh.pdata;
    var h = '<div class="sheetbar">' + (ui.stack.length ? '<button class="back" data-act="back" aria-label="Назад">' + ic('left') + '</button>' : '') + '<button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div>';
    var photo = (d && d.photo) || p.photo;
    h += '<div class="phero"><span class="pic big"><span class="ph">' + esc(initials(p.name)) + '</span>' + (photo ? '<img src="' + esc(F.tmdbImg(photo, 'w342')) + '" alt="" referrerpolicy="no-referrer">' : '') + '</span><h3>' + esc((d && d.name) || p.name) + '</h3>' +
      (d && (d.born || d.place) ? '<div class="meta">' + esc([d.born ? F.dateUk(d.born) : '', d.place].filter(Boolean).join(', ')) + '</div>' : '') + '</div><div class="body">';
    if (sh.perr) return h + '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.perr)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="reperson">Спробувати ще раз</button></p></div></div></div>';
    if (!d) return h + '<div class="spin" role="status" aria-label="Завантаження"></div></div>';
    if (d.bio) h += '<p class="plot bio' + (sh.bioOpen ? ' open' : '') + '">' + esc(d.bio) + '</p>' + (d.bio.length > 320 ? '<p style="margin:0"><button class="btn ghost sm" data-act="bio">' + (sh.bioOpen ? 'Згорнути' : 'Читати далі') + '</button></p>' : '');
    var kn = sh.allKnown ? d.known : d.known.slice(0, 12);
    if (d.known.length) h += '<h2>Фільми й серіали</h2><div class="tgrid">' + kn.map(function (r) { return catTile(r).replace('</span></button>', '</span>' + (r.character ? '<span class="role">' + esc(r.character) + '</span>' : '') + '</button>'); }).join('') + '</div>';
    if (d.known.length > 12) h += '<p style="margin:16px 0 0"><button class="btn ghost block" data-act="allknown">' + (sh.allKnown ? 'Згорнути' : 'Показати всі ' + d.known.length) + '</button></p>';
    return h + '</div>';
  }
  async function openPerson(p) {
    ui.sheet = { person: { id: p.id, name: p.name, photo: p.photo }, pdata: null, perr: null };
    renderSheet(); var sh = ui.sheet;
    try { var d = await F.person(p.id); if (ui.sheet === sh) { sh.pdata = d; renderSheet(); } }
    catch (e) { if (ui.sheet === sh) { sh.perr = e; renderSheet(); } }
  }
  function pushCurrent() {
    var cur = ui.sheet; if (!cur || cur.wheel || cur.duo) return;
    if (cur.coll) ui.stack.push({ coll: cur.coll });
    else if (cur.person) ui.stack.push({ person: cur.person });
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
    var all = F.list('want', ui.lists.want).slice(); for (var i = all.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = all[i]; all[i] = all[j]; all[j] = t; }
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
    if (ex.loading) return '<div class="spin" role="status" aria-label="Завантажуємо акторів"></div>';
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
        (sh.error ? '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="retry">Спробувати ще раз</button></p></div></div>' : '<div class="spin" role="status" aria-label="Завантаження"></div>') + '</div>';
    }
    var r = it.ratings, tr = sheetTr(sh, lib, it);
    var h = hdr + '<div class="hero glow" style="--h:' + hue(it.id) + '"><div class="bg" style="' + (it.poster ? 'background-image:url(\'' + esc(it.poster) + '\')' : '') + '"></div><div class="in">' + posterHtml(it.poster, it.title) + '<div class="info"><h3>' + esc(tr.titleUk || it.title) + '</h3><div class="meta">' + (tr.titleUk && tr.titleUk !== it.title ? esc(it.title) + '<br>' : '') + esc(typeLabel(it.type)) + (it.year ? ', ' + esc(it.year) : '') + (it.runtime ? '<br>' + esc(F.fmtMinutes(it.runtime)) + (it.type === 'series' ? ' за серію' : '') : '') + (it.rated ? '<br>' + esc(it.rated) : '') + '</div></div></div></div><div class="body">';
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
    h += '</div></div>';
    if (it.plot) {
      var showUk = tr.plotUk && !sh.showOrig;
      h += '<h2>Сюжет</h2><p class="plot">' + esc(showUk ? tr.plotUk : it.plot) + '</p>';
      if (tr.plotUk) h += '<p style="margin:0"><button class="btn ghost sm" data-act="toggle-orig">' + (showUk ? 'Показати оригінал' : 'Показати переклад') + '</button></p>';
      else if (sh.translating) h += '<div class="spin" role="status" aria-label="Перекладаємо"></div>';
      else h += '<p style="margin:0"><button class="btn ghost sm" data-act="translate">' + ic('sparkle', 'sm') + 'Перекласти українською</button></p>' + (sh.trError ? '<p class="er-t" role="status" style="margin:8px 0 0">' + esc(sh.trError) + '</p>' : '');
    }
    h += colBlock(lib);
    h += castBlock(sh, lib);
    var dl = dlRow('Режисер', it.director) + dlRow('Сценарій', it.writer) + dlRow('У ролях', (lib && lib.cast.length) || (sh.extras && sh.extras.data && sh.extras.data.cast.length) ? '' : it.actors) + dlRow('Вихід', F.dateUk(it.released)) + dlRow('Країна', F.countryUk(it.country)) + dlRow('Мова', F.langUk(it.language)) + dlRow('Нагороди', it.awards);
    if (dl) h += '<dl class="dl">' + dl + '</dl>';
    h += nextBlock(sh, lib, it);
    h += seasonBlock(sh, it, lib);
    h += recsBlock(sh, lib);
    h += '<div class="actions"><a class="btn ghost sm" href="https://www.imdb.com/title/' + esc(it.id) + '/" target="_blank" rel="noopener">' + ic('link', 'sm') + 'Відкрити в IMDb</a>';
    if (lib) h += '<button class="btn ghost sm" data-act="shareimg" data-id="' + esc(lib.id) + '">' + ic('download', 'sm') + 'Поділитись' + '</button>';
    if (lib) h += '<button class="btn ghost sm" data-act="refresh"' + (sh.refreshing ? ' disabled' : '') + '>' + ic('refresh', 'sm') + (sh.refreshing ? 'Оновлюємо…' : 'Оновити рейтинги') + '</button><button class="btn danger sm" data-act="remove">' + ic('trash', 'sm') + 'Видалити зі списків</button>';
    h += '</div>';
    if (sh.error) h += '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.error)) + '</div></div>';
    if (lib && lib.fetchedAt) h += '<p class="fine">Рейтинги станом на ' + esc(new Date(lib.fetchedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })) + ' Вони змінюються, тож за потреби оновіть.</p>';
    return h + '</div>';
  }
  function renderSheet() {
    syncExtras();
    if (!ui.sheet) { sheetRoot.innerHTML = ''; document.body.style.overflow = ''; return; }
    var old = $('.sheet', sheetRoot), top = old ? old.scrollTop : 0, again = !!old;
    sheetRoot.innerHTML = '<div class="scrim' + (again ? ' static' : '') + '" data-act="scrim"><div class="sheet' + (ui.sheet.wheel ? ' wheel-sheet' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(ui.sheet.person ? ui.sheet.person.name : ui.sheet.wheel ? 'Колесо' : ui.sheet.duo ? 'Вечір удвох' : ui.sheet.coll ? ui.sheet.coll.title : (ui.sheet.item || ui.sheet.brief || {}).title || 'Картка') + '">' + sheetHtml() + '</div></div>';
    var n = $('.sheet', sheetRoot); if (n && top) n.scrollTop = top;
    document.body.style.overflow = 'hidden';
  }
  async function openSheet(id, brief) {
    if (!F.isId(id)) return;
    var lib = F.getItem(id);
    ui.sheet = { id: id, brief: brief || (lib ? F.brief(lib) : null), item: lib || detCache[id] || null, error: null, season: 0, tmp: {}, loadingSeason: 0, seasonError: null, refreshing: false };
    renderSheet();
    if (!ui.sheet.item) await loadSheetItem(); else loadExtras(false);
  }
  async function loadSheetItem() {
    var sh = ui.sheet; if (!sh) return; sh.error = null;
    try { var it = await F.details(sh.id); detCache[sh.id] = it; if (ui.sheet === sh) { sh.item = it; renderSheet(); loadExtras(false); } }
    catch (e) { if (ui.sheet === sh) { sh.error = e; renderSheet(); } }
  }
  function closeSheet() { ui.sheet = null; ui.stack = []; renderSheet(); }
  async function loadExtras(force) {
    var sh = ui.sheet; if (!sh || !F.tmdbKeyOf()) return; var it = sheetItem(); if (!it) return;
    var lib = F.getItem(it.id);
    var fresh = lib && lib.xv >= 3 && (lib.type !== 'series' || FB.now() - lib.exAt < 86400000);
    if (!force && (fresh || (sh.extras && (sh.extras.data || sh.extras.loading || sh.extras.error)))) return;
    sh.extras = { loading: true, error: null, data: null }; renderSheet();
    try {
      var d = await F.tmdbExtras(it);
      if (ui.sheet !== sh) return;
      sh.extras = { loading: false, error: null, data: d.none ? null : d };
      if (F.getItem(it.id) && !d.none) F.setExtras(it.id, d);
    } catch (e) { if (ui.sheet !== sh) return; sh.extras = { loading: false, error: e, data: null }; }
    renderSheet(); render();
  }
  function syncExtras() {
    var sh = ui.sheet; if (!sh || !sh.extras || !sh.extras.data) return;
    var lib = F.getItem(sh.id); if (lib && !(lib.xv >= 3)) F.setExtras(sh.id, sh.extras.data);
  }
  function sheetItem() { var sh = ui.sheet; return sh ? (sh.item || F.getItem(sh.id)) : null; }
  // Відмічена серія в «Обраних» означає, що серіал уже дивляться
  function startWatching(id) { var l = F.getItem(id); if (l && l.status === 'want' && F.watchedCount(l)) F.setStatus(l, 'watching'); }
  function ensureInLibrary(st) { var sh = ui.sheet, it = sheetItem(); if (!it) return null; return F.setStatus(it, st || 'want'); }
  async function loadSeasonNow(n) {
    var sh = ui.sheet; if (!sh) return; sh.season = n; sh.seasonError = null;
    var lib = F.getItem(sh.id);
    if ((lib && lib.seasons[String(n)]) || sh.tmp[n]) { renderSheet(); return; }
    sh.loadingSeason = n; renderSheet();
    try { var eps = await F.loadSeason(sh.id, n); if (ui.sheet === sh) { sh.tmp[n] = eps; sh.loadingSeason = 0; renderSheet(); } }
    catch (e) { if (ui.sheet === sh) { sh.loadingSeason = 0; sh.seasonError = { n: n, e: e }; renderSheet(); } }
  }

  // ---------- Вивід ----------
  function render() {
    var st = ui.tab;
    app.className = ui.enter ? 'enter' : ''; ui.enter = false;
    app.innerHTML = st === 'home' ? renderHome() : st === 'search' ? renderSearch() : st === 'more' ? renderMore() : renderList(st);
    tabsEl.innerHTML = TABS.map(function (t) { return '<button data-act="tab" data-tab="' + t[0] + '" aria-label="' + t[1] + '"' + (st === t[0] ? ' aria-current="page"' : '') + '>' + ic(t[2]) + '<span>' + t[1] + '</span>' + '</button>'; }).join('');
    if (ui.sheet) renderSheet();
  }
  function setTab(t) { ui.tab = t; ui.enter = true; ui.keyMsg = null; ui.backupMsg = null; ui.gemMsg = null; ui.tmdbMsg = null; render(); window.scrollTo(0, 0); }

  // ---------- Події ----------
  async function onAct(el) {
    var a = el.dataset.act, id = el.dataset.id;
    switch (a) {
      case 'tab': setTab(el.dataset.tab); break;
      case 'hometype': ui.homeMt = el.dataset.mt === 'tv' ? 'tv' : el.dataset.mt === 'toon' ? 'toon' : 'movie'; ui.enter = true; render(); break;
      case 'moreshelves': ui.cat.shown[ui.homeMt] += 5; render(); break;
      case 'reshelf': { var rs = F.collDefs(ui.homeMt).filter(function (d) { return d.id === el.dataset.id; })[0]; if (rs) { delete ui.cat.sh[rs.id]; loadShelf(rs); paintShelf(rs); } break; }
      case 'coll': openColl(el.dataset.id); break;
      case 'collmore': collMore(); break;
      case 'discmore': discMore(el.dataset.key); break;
      case 'cat': {
        hideSugg(); var qb = $('#q'); if (qb && document.activeElement === qb) qb.blur();
        var ck = 'cat' + el.dataset.tid; if (ui.busy[ck]) return; ui.busy[ck] = true; toast('Відкриваємо…');
        try {
          var imdb0 = await F.tmdbImdbId(el.dataset.mt, el.dataset.tid); toastEl.classList.remove('show'); if (ui.sheet && !ui.sheet.wheel) pushCurrent();
          openSheet(imdb0, { id: imdb0, title: el.dataset.title, year: el.dataset.year, type: el.dataset.mt === 'tv' ? 'series' : 'movie', poster: F.tmdbImg(el.dataset.poster, 'w342') });
        } catch (e) { toast(F.describeError(e)); }
        delete ui.busy[ck]; break;
      }
      case 'type': ui.type = el.dataset.type; if (ui.q.trim() && ui.searched) doSearch(false); else render(); break;
      case 'more': doSearch(true); break;
      case 'open': {
        var br = null; for (var i = 0; i < ui.results.length; i++) if (ui.results[i].id === id) br = ui.results[i];
        openSheet(id, br); break;
      }
      case 'quick': {
        if (ui.busy[id] || F.getItem(id)) return; ui.busy[id] = true; render();
        try { var det = detCache[id] || await F.details(id); detCache[id] = det; F.setStatus(det, el.dataset.st); toast(el.dataset.st === 'seen' ? 'Додано до «Переглянуто»' : el.dataset.st === 'watching' ? 'Додано до «Дивлюсь»' : 'Додано в «Обрані»', 'Скасувати', function () { F.removeItem(id); }); }
        catch (e) { ui.error = e; }
        delete ui.busy[id]; render(); break;
      }
      case 'close': closeSheet(); break;
      case 'retry': loadSheetItem(); renderSheet(); break;
      case 'status': {
        var cur = F.getItem(ui.sheet.id), it0 = sheetItem(); if (!it0) return;
        if (cur && cur.status === el.dataset.st) { break; }
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
      case 'rehero': { var cur0 = ui.heroId, tries = 0, nx; do { nx = F.randomPick('want'); } while (nx && nx.id === cur0 && F.list('want').length > 1 && ++tries < 20); if (nx) ui.heroId = nx.id; render(); break; }
      case 'sheet-more': closeSheet(); setTab('more'); break;
      case 'extras': loadExtras(true); break;
      case 'back': { var prev = ui.stack.pop(); if (prev && prev.coll) { ui.sheet = { coll: prev.coll }; renderSheet(); } else if (prev && prev.person) openPerson(prev.person); else if (prev) openSheet(prev.id, prev.brief); break; }
      case 'person': pushCurrent(); openPerson({ id: Number(el.dataset.pid), name: el.dataset.name, photo: el.dataset.photo }); break;
      case 'reperson': if (ui.sheet && ui.sheet.person) openPerson(ui.sheet.person); break;
      case 'allknown': if (ui.sheet) { ui.sheet.allKnown = !ui.sheet.allKnown; renderSheet(); } break;
      case 'bio': if (ui.sheet) { ui.sheet.bioOpen = !ui.sheet.bioOpen; renderSheet(); } break;
      case 'hgenre': ui.homeGenre = el.dataset.g; render(); break;
      case 'redisc': Object.keys(ui.dc).forEach(function (k) { if (ui.dc[k].error) delete ui.dc[k]; }); render(); break;
      case 'advise': {
        if (ui.advice && ui.advice.loading) return; ui.advice = { loading: true }; render();
        try { var adv = await F.advise(); ui.advice = { items: adv }; } catch (e) { ui.advice = { error: e }; }
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
        var cid = F.addCol(nm); var lc2 = ui.sheet && F.getItem(ui.sheet.id); if (cid && lc2) F.toggleCol(lc2.id, cid); renderSheet(); render(); break;
      }
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
      case 'syncnow': {
        if (ui.syncBusy) return; ui.syncBusy = true; ui.syncMsg = { ok: true, text: 'Синхронізуємо…' }; render();
        try { var sr = await F.syncNow(); ui.syncMsg = { ok: true, text: 'Готово. Отримано нових: ' + sr.added + ', оновлено: ' + sr.updated + (sr.removed ? ', прибрано видалених: ' + sr.removed : '') + '.' }; }
        catch (e) { ui.syncMsg = { ok: false, text: F.describeError(e) }; }
        ui.syncBusy = false; render(); break;
      }
      case 'rec': {
        if (!ui.sheet || ui.busy['rec' + el.dataset.tid]) return; var rk = 'rec' + el.dataset.tid; ui.busy[rk] = true; toast('Відкриваємо…');
        try {
          var imdb = await F.tmdbImdbId(el.dataset.mt, el.dataset.tid), cur = ui.sheet, recs = (F.getItem(cur.id) && F.getItem(cur.id).recs.length ? F.getItem(cur.id).recs : (cur.extras && cur.extras.data && cur.extras.data.recs) || []), rr = null;
          for (var ri = 0; ri < recs.length; ri++) if (String(recs[ri].tid) === el.dataset.tid) rr = recs[ri];
          ui.stack.push({ id: cur.id, brief: cur.brief || (cur.item ? F.brief(cur.item) : null) });
          toastEl.classList.remove('show');
          openSheet(imdb, rr ? { id: imdb, title: rr.title, year: rr.year, type: rr.mt === 'tv' ? 'series' : 'movie', poster: F.tmdbImg(rr.poster, 'w342') } : null);
        } catch (e) { toast(F.describeError(e)); }
        delete ui.busy[rk]; break;
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
        var gone = F.removeItem(ui.sheet.id); closeSheet();
        if (gone) toast('Видалено зі списків', 'Повернути', function () { F.restoreItem(gone); }); break;
      }
      case 'ltype': ui.lists[ui.tab].type = el.dataset.type; render(); break;
      case 'genre': ui.lists[ui.tab].genre = el.dataset.genre; render(); break;
      case 'random': {
        if (F.list('want', ui.lists.want).length >= 2) openWheel(); else { var p = F.randomPick('want', ui.lists.want); if (p) openSheet(p.id); } break;
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
    var text = F.exportJSON(), name = 'kinoman-kopiya-' + new Date().toISOString().slice(0, 10) + '.json';
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
    F.init();
    F.on(function () { render(); });
    // тиха синхронізація під час відкриття й коли додаток ховається
    var autoSync = function () { var so = F.syncOf(); if (!so.url || !so.code || ui.syncBusy || FB.now() - so.at < 30000) return; ui.syncBusy = true; F.syncNow().then(function () { ui.syncBusy = false; render(); }, function () { ui.syncBusy = false; }); };
    setTimeout(autoSync, 800);
    setTimeout(function () { if (F.tmdbKeyOf()) F.refreshSeries(6).then(function (n) { if (n) render(); }, function () { /* без інтернету */ }); warmPosters(); }, 2500);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') autoSync(); });
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'scrim') { if (e.target === el) closeSheet(); return; }
      onAct(el);
    });
    document.addEventListener('submit', function (e) { var f = e.target.closest('form[data-form]'); if (f) { e.preventDefault(); onSubmit(f); } });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.dataset && el.dataset.change === 'sort') { ui.lists[ui.tab].sort = el.value; render(); }
      if (el.dataset && el.dataset.change === 'time') { ui.lists[ui.tab].time = el.value; render(); }
      if (el.dataset && el.dataset.change === 'fl' && /^(genre|decade|vote)$/.test(el.dataset.k)) { ui.fl[el.dataset.k] = el.value; render(); }
      if (el.id === 'import-file' && el.files && el.files[0]) {
        var rd = new FileReader();
        rd.onload = function () { var r = F.importJSON(String(rd.result)); ui.backupMsg = r.error ? { ok: false, text: r.error } : { ok: true, text: 'Додано ' + r.added + ', оновлено ' + r.updated + '.' }; render(); };
        rd.onerror = function () { ui.backupMsg = { ok: false, text: 'Не вдалося прочитати файл.' }; render(); };
        rd.readAsText(el.files[0]);
      }
    });
    document.addEventListener('input', function (e) { var el = e.target; if (el.id === 'q') { ui.q = el.value; queueSugg(); return; } if (el.dataset && el.dataset.input === 'note' && ui.sheet) F.setNote(ui.sheet.id, el.value); });
    // тап по підказці не забирає фокус у поля, тож список не зникає раніше за клік
    document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('#sugg')) e.preventDefault(); });
    document.addEventListener('focusin', function (e) { if (e.target.id === 'q' && e.target.value.trim().length >= 2) queueSugg(true); });
    document.addEventListener('focusout', function (e) { if (e.target.id === 'q') setTimeout(function () { var a = document.activeElement; if (!a || !a.closest || !a.closest('#sugg')) hideSugg(); }, 180); });
    document.addEventListener('error', function (e) {
      var t = e.target; if (t && t.tagName === 'IMG' && t.closest('.poster')) t.remove();
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if ($('#sugg.show')) { hideSugg(); return; } if (ui.sheet) closeSheet(); } });
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  window.KinoUI = { ui: ui, render: render, openSheet: openSheet, toast: toast };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
