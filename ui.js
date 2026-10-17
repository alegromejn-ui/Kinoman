/* Кіноман: інтерфейс */
(function () {
  'use strict';
  var F = window.FB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app, tabsEl, sheetRoot, toastEl;
  var ui = {
    tab: 'search',
    q: '', type: '', results: [], total: 0, page: 0, loading: false, searched: false, error: null, token: 0,
    lists: { want: { sort: 'added', type: '', genre: '' }, seen: { sort: 'seen', type: '', genre: '' } },
    busy: {}, stack: [], sheet: null, tmdbMsg: null, keyMsg: null, backupMsg: null
  };
  var detCache = {};
  var TABS = [['search', 'Пошук', 'search'], ['want', 'Хочу', 'bookmark'], ['seen', 'Переглянуто', 'eye'], ['more', 'Ще', 'more']];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n, c) { return '<svg class="ic ' + (c || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
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
    if (lib) acts = '<button class="chip on" data-act="open" data-id="' + r.id + '">' + ic('check', 'sm') + (lib.status === 'seen' ? 'Бачив' : 'Хочу') + '</button>';
    else acts = '<button class="chip" data-act="quick" data-st="want" data-id="' + r.id + '"' + (busy ? ' disabled' : '') + '>' + ic('plus', 'sm') + 'Хочу</button><button class="chip" data-act="quick" data-st="seen" data-id="' + r.id + '"' + (busy ? ' disabled' : '') + '>' + ic('eye', 'sm') + 'Бачив</button>';
    return '<div class="row"><button class="open" data-act="open" data-id="' + r.id + '">' + posterHtml(r.poster, r.title) + '<span class="txt"><span class="t">' + esc(r.title) + '</span><span class="m">' + esc(typeLabel(r.type)) + (r.year ? ', ' + esc(r.year) : '') + '</span></span></button><div class="acts">' + acts + '</div></div>';
  }
  function renderSearch() {
    var h = '<div class="page-h"><h1>Кіноман</h1></div>';
    if (!F.keyOf()) h += noKeyHtml();
    h += '<form class="searchbar" data-form="search" role="search"><input type="search" id="q" name="q" placeholder="' + (F.gemKeyOf() ? 'Назва українською чи англійською' : 'Назва англійською або ID з IMDb') + '" value="' + esc(ui.q) + '" autocomplete="off" autocapitalize="none" enterkeyhint="search" aria-label="Назва фільму чи серіалу"><button class="btn" type="submit" aria-label="Шукати">' + ic('search') + '</button></form>';
    h += '<div class="seg" role="group" aria-label="Тип">' + [['', 'Усе'], ['movie', 'Фільми'], ['series', 'Серіали']].map(function (t) { return '<button type="button" data-act="type" data-type="' + t[0] + '" aria-pressed="' + (ui.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (ui.error) h += '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(ui.error)) + (ui.error.code === 'NEED_GEMINI' ? '<p style="margin:10px 0 0"><button class="btn sm" data-act="tab" data-tab="more">Додати ключ Gemini</button></p>' : '') + '</div></div>';
    if (ui.results.length && ui.translatedAs) h += '<p class="sub" style="margin:0 0 6px">Шукали за оригінальною назвою: ' + esc(ui.translatedAs) + '</p>';
    if (ui.results.length && ui.exact) h += '<p class="sub" style="margin:0 0 6px">Назва надто загальна, тому показано один найточніший збіг. Щоб уточнити, додайте рік, наприклад «Dark 2017».</p>';
    if (ui.results.length) {
      h += '<div>' + ui.results.map(rowHtml).join('') + '</div>';
      if (ui.results.length < ui.total) h += '<div class="more">' + (ui.loading ? '<div class="spin" role="status" aria-label="Завантаження"></div>' : '<button class="btn ghost block" data-act="more">Показати ще</button>') + '</div>';
    } else if (ui.loading) h += '<div class="spin" role="status" aria-label="Шукаємо"></div>';
    else if (ui.searched && !ui.error) h += emptyHtml('film', 'Нічого не знайшли', 'OMDb знає назви англійською. Спробуйте оригінальну назву або вставте ID з IMDb, наприклад tt0133093.');
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
  function cardHtml(it) {
    var b = '';
    if (it.ratings.imdb != null) b += '<span>' + it.ratings.imdb.toFixed(1) + '</span>';
    if (it.myRating) b += '<span class="me" title="Моя оцінка">' + it.myRating + '</span>';
    else if (it.type === 'series' && F.watchedCount(it)) b += '<span class="done">' + F.watchedCount(it) + ' еп.</span>';
    return '<button class="card" data-act="open" data-id="' + it.id + '">' + '<span class="poster"><span class="ph">' + esc(it.title) + '</span>' + (it.poster ? '<img src="' + esc(it.poster) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '<span class="badge">' + b + '</span></span><span class="name">' + esc(it.titleUk || it.title) + '</span><span class="yr">' + esc(it.year) + '</span></button>';
  }
  function renderList(status) {
    var f = ui.lists[status], all = F.list(status), items = F.list(status, f);
    var h = '<div class="page-h"><div><h1>' + (status === 'want' ? 'Хочу' : 'Переглянуто') + '</h1><p class="sub">' + all.length + ' ' + (status === 'want' ? plural(all.length, 'позиція', 'позиції', 'позицій') : plural(all.length, 'фільм і серіал', 'фільми й серіали', 'фільмів і серіалів')) + '</p></div>' + (status === 'want' && all.length > 1 ? '<button class="btn soft sm" data-act="random">' + ic('shuffle', 'sm') + 'Що подивитись?</button>' : '') + '</div>';
    if (!all.length) {
      return h + (status === 'want' ? emptyHtml('bookmark', 'Тут буде ваш список', 'Знайдіть фільм і натисніть «Хочу», щоб не забути його.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>')
        : emptyHtml('eye', 'Поки нічого не переглянуто', 'Позначайте фільми як переглянуті й ставте свої оцінки від 1 до 10.', '<p><button class="btn" data-act="tab" data-tab="search">Знайти фільм</button></p>'));
    }
    h += '<div class="seg" role="group" aria-label="Тип">' + [['', 'Усе'], ['movie', 'Фільми'], ['series', 'Серіали']].map(function (t) { return '<button type="button" data-act="ltype" data-type="' + t[0] + '" aria-pressed="' + (f.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="tools"><select data-change="sort" aria-label="Сортування">' + Object.keys(F.SORTS).map(function (k) { return '<option value="' + k + '"' + (f.sort === k ? ' selected' : '') + '>' + esc(F.SORTS[k]) + '</option>'; }).join('') + '</select></div>';
    var gs = F.genres(status);
    if (gs.length > 1) h += '<div class="chips" role="group" aria-label="Жанри"><button class="chip' + (!f.genre ? ' on' : '') + '" data-act="genre" data-genre="">Усі жанри</button>' + gs.slice(0, 14).map(function (g) { return '<button class="chip' + (f.genre === g.name ? ' on' : '') + '" data-act="genre" data-genre="' + esc(g.name) + '">' + esc(F.genreUk(g.name)) + ' ' + g.count + '</button>'; }).join('') + '</div>';
    if (!items.length) return h + emptyHtml('film', 'За цим фільтром порожньо', 'Змініть тип чи жанр.');
    return h + '<div class="grid">' + items.map(cardHtml).join('') + '</div>';
  }

  // ---------- Ще ----------
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
    h += '<section class="panel"><h2>Ваша статистика</h2><div class="stats"><div class="stat"><div class="v">' + s.seen + '</div><div class="n">переглянуто</div></div><div class="stat"><div class="v">' + s.want + '</div><div class="n">у списку «Хочу»</div></div><div class="stat"><div class="v">' + (s.avgMine == null ? '—' : s.avgMine.toFixed(1)) + '</div><div class="n">середня оцінка</div></div><div class="stat"><div class="v">' + (s.minutes ? esc(F.fmtMinutes(s.minutes)) : '—') + '</div><div class="n">часу за екраном</div></div></div>' + (s.topGenres.length ? '<p class="sub">Найчастіше: ' + s.topGenres.map(function (g) { return esc(F.genreUk(g.name)); }).join(', ') + '</p>' : '') + '</section>';
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
  function castBlock(sh, lib) {
    if (!F.tmdbKeyOf()) return '<div class="notice">' + ic('film') + '<div><b>Актори з фото й схожі фільми</b><div class="sub">Додайте безкоштовний ключ TMDB у розділі «Ще», і тут з’являться склад, ролі та добірка схожого.</div><p style="margin:10px 0 0"><button class="btn sm" data-act="sheet-more">Додати ключ TMDB</button></p></div></div>';
    var ex = sh.extras || {}, cast = lib && lib.cast.length ? lib.cast : (ex.data && ex.data.cast) || [];
    if (cast.length) return '<h2>Актори</h2><div class="strip">' + cast.map(function (c) {
      return '<a class="person" ' + (c.id ? 'href="https://www.themoviedb.org/person/' + c.id + '" target="_blank" rel="noopener"' : '') + '><span class="pic"><span class="ph">' + esc(initials(c.name)) + '</span>' + (c.photo ? '<img src="' + esc(F.tmdbImg(c.photo, 'w185')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span><b>' + esc(c.name) + '</b>' + (c.character ? '<span>' + esc(c.character) + '</span>' : '') + '</a>';
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
    var sh = ui.sheet, lib = F.getItem(sh.id), it = lib || sh.item;
    var hdr = '<div class="sheetbar">' + (ui.stack.length ? '<button class="back" data-act="back" aria-label="Назад">' + ic('left') + '</button>' : '') + '<button class="close" data-act="close" aria-label="Закрити">' + ic('x') + '</button></div>';
    if (!it) {
      var b = sh.brief;
      return hdr + '<div class="hero"><div class="in">' + posterHtml(b && b.poster, b ? b.title : '') + '<div class="info"><h3>' + esc(b ? b.title : '') + '</h3><div class="meta">' + (b ? esc(typeLabel(b.type)) + (b.year ? ', ' + esc(b.year) : '') : '') + '</div></div></div></div><div class="body">' +
        (sh.error ? '<div class="notice warn">' + ic('alert') + '<div>' + esc(F.describeError(sh.error)) + '<p style="margin:10px 0 0"><button class="btn sm" data-act="retry">Спробувати ще раз</button></p></div></div>' : '<div class="spin" role="status" aria-label="Завантаження"></div>') + '</div>';
    }
    var r = it.ratings, tr = sheetTr(sh, lib, it);
    var h = hdr + '<div class="hero"><div class="bg" style="' + (it.poster ? 'background-image:url(\'' + esc(it.poster) + '\')' : '') + '"></div><div class="in">' + posterHtml(it.poster, it.title) + '<div class="info"><h3>' + esc(tr.titleUk || it.title) + '</h3><div class="meta">' + (tr.titleUk && tr.titleUk !== it.title ? esc(it.title) + '<br>' : '') + esc(typeLabel(it.type)) + (it.year ? ', ' + esc(it.year) : '') + (it.runtime ? '<br>' + esc(F.fmtMinutes(it.runtime)) + (it.type === 'series' ? ' за серію' : '') : '') + (it.rated ? '<br>' + esc(it.rated) : '') + '</div></div></div></div><div class="body">';
    h += '<div class="scores"><div class="score imdb"><div class="v">' + (r.imdb != null ? r.imdb.toFixed(1) + '<small>/10</small>' : '—') + '</div><div class="n">IMDb' + (r.votes ? ', ' + esc(r.votes) : '') + '</div></div>' +
      '<div class="score ' + scoreClass('rt', r.rt) + '"><div class="v">' + (r.rt != null ? r.rt + '<small>%</small>' : '—') + '</div><div class="n">Rotten Tomatoes</div></div>' +
      '<div class="score ' + scoreClass('meta', r.meta) + '"><div class="v">' + (r.meta != null ? r.meta + '<small>/100</small>' : '—') + '</div><div class="n">Metacritic</div></div></div>';
    if (it.genre.length) h += '<div class="tags">' + it.genre.map(function (g) { return '<span class="tag">' + esc(F.genreUk(g)) + '</span>'; }).join('') + '</div>';
    h += '<div class="status"><button class="btn ghost' + (lib && lib.status === 'want' ? ' on' : '') + '" data-act="status" data-st="want" aria-pressed="' + !!(lib && lib.status === 'want') + '">' + ic('bookmark', 'sm') + 'Хочу</button><button class="btn ghost' + (lib && lib.status === 'seen' ? ' on' : '') + '" data-act="status" data-st="seen" aria-pressed="' + !!(lib && lib.status === 'seen') + '">' + ic('eye', 'sm') + 'Переглянуто</button></div>';
    if (lib && lib.status === 'seen' && lib.seenAt) h += '<p class="sub" style="margin:6px 0 0">Переглянуто ' + esc(new Date(lib.seenAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p>';
    h += '<h2>Моя оцінка' + (lib && lib.myRating ? ': ' + lib.myRating + ' з 10' : '') + '</h2><div class="scale" role="group" aria-label="Моя оцінка">';
    for (var i = 1; i <= 10; i++) h += '<button type="button" data-act="rate" data-n="' + i + '" class="' + (lib && lib.myRating === i ? 'on' : lib && lib.myRating && i < lib.myRating ? 'fill' : '') + '" aria-pressed="' + !!(lib && lib.myRating === i) + '">' + i + '</button>';
    h += '</div>';
    if (lib) h += '<label class="fl" for="note">Нотатка</label><textarea id="note" data-input="note" maxlength="1000" placeholder="З ким дивились, що сподобалось, кому порадити">' + esc(lib.note) + '</textarea>';
    if (it.plot) {
      var showUk = tr.plotUk && !sh.showOrig;
      h += '<h2>Сюжет</h2><p class="plot">' + esc(showUk ? tr.plotUk : it.plot) + '</p>';
      if (tr.plotUk) h += '<p style="margin:0"><button class="btn ghost sm" data-act="toggle-orig">' + (showUk ? 'Показати оригінал' : 'Показати переклад') + '</button></p>';
      else if (sh.translating) h += '<div class="spin" role="status" aria-label="Перекладаємо"></div>';
      else h += '<p style="margin:0"><button class="btn ghost sm" data-act="translate">' + ic('sparkle', 'sm') + 'Перекласти українською</button></p>' + (sh.trError ? '<p class="er-t" role="status" style="margin:8px 0 0">' + esc(sh.trError) + '</p>' : '');
    }
    h += castBlock(sh, lib);
    var dl = dlRow('Режисер', it.director) + dlRow('Сценарій', it.writer) + dlRow('У ролях', (lib && lib.cast.length) || (sh.extras && sh.extras.data && sh.extras.data.cast.length) ? '' : it.actors) + dlRow('Вихід', F.dateUk(it.released)) + dlRow('Країна', F.countryUk(it.country)) + dlRow('Мова', F.langUk(it.language)) + dlRow('Нагороди', it.awards);
    if (dl) h += '<dl class="dl">' + dl + '</dl>';
    h += seasonBlock(sh, it, lib);
    h += recsBlock(sh, lib);
    h += '<div class="actions"><a class="btn ghost sm" href="https://www.imdb.com/title/' + esc(it.id) + '/" target="_blank" rel="noopener">' + ic('link', 'sm') + 'Відкрити в IMDb</a>';
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
    sheetRoot.innerHTML = '<div class="scrim' + (again ? ' static' : '') + '" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc((ui.sheet.item || ui.sheet.brief || {}).title || 'Картка') + '">' + sheetHtml() + '</div></div>';
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
    if (!force && ((lib && (lib.cast.length || lib.recs.length)) || (sh.extras && (sh.extras.data || sh.extras.loading)))) return;
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
    var lib = F.getItem(sh.id); if (lib && !lib.cast.length && !lib.recs.length) F.setExtras(sh.id, sh.extras.data);
  }
  function sheetItem() { var sh = ui.sheet; return sh ? (sh.item || F.getItem(sh.id)) : null; }
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
    app.innerHTML = st === 'search' ? renderSearch() : st === 'more' ? renderMore() : renderList(st);
    var wc = F.list('want').length;
    tabsEl.innerHTML = TABS.map(function (t) { return '<button data-act="tab" data-tab="' + t[0] + '"' + (st === t[0] ? ' aria-current="page"' : '') + '>' + ic(t[2]) + '<span>' + t[1] + '</span>' + (t[0] === 'want' && wc ? '<span class="cnt">' + wc + '</span>' : '') + '</button>'; }).join('');
    if (ui.sheet) renderSheet();
  }
  function setTab(t) { ui.tab = t; ui.keyMsg = null; ui.backupMsg = null; ui.gemMsg = null; ui.tmdbMsg = null; render(); window.scrollTo(0, 0); }

  // ---------- Події ----------
  async function onAct(el) {
    var a = el.dataset.act, id = el.dataset.id;
    switch (a) {
      case 'tab': setTab(el.dataset.tab); break;
      case 'type': ui.type = el.dataset.type; if (ui.q.trim() && ui.searched) doSearch(false); else render(); break;
      case 'more': doSearch(true); break;
      case 'open': {
        var br = null; for (var i = 0; i < ui.results.length; i++) if (ui.results[i].id === id) br = ui.results[i];
        openSheet(id, br); break;
      }
      case 'quick': {
        if (ui.busy[id] || F.getItem(id)) return; ui.busy[id] = true; render();
        try { var det = detCache[id] || await F.details(id); detCache[id] = det; F.setStatus(det, el.dataset.st); toast(el.dataset.st === 'seen' ? 'Додано до «Переглянуто»' : 'Додано до «Хочу»', 'Скасувати', function () { F.removeItem(id); }); }
        catch (e) { ui.error = e; }
        delete ui.busy[id]; render(); break;
      }
      case 'close': closeSheet(); break;
      case 'retry': loadSheetItem(); renderSheet(); break;
      case 'status': {
        var cur = F.getItem(ui.sheet.id), it0 = sheetItem(); if (!it0) return;
        if (cur && cur.status === el.dataset.st) { break; }
        F.setStatus(it0, el.dataset.st); break;
      }
      case 'rate': {
        var it1 = sheetItem(); if (!it1) return;
        if (!F.getItem(it1.id)) F.setStatus(it1, 'seen');
        else if (F.getItem(it1.id).status === 'want' && F.getItem(it1.id).myRating == null) F.setStatus(F.getItem(it1.id), 'seen');
        F.setMyRating(it1.id, Number(el.dataset.n)); break;
      }
      case 'sheet-more': closeSheet(); setTab('more'); break;
      case 'extras': loadExtras(true); break;
      case 'back': { var prev = ui.stack.pop(); if (prev) openSheet(prev.id, prev.brief); break; }
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
        if (!F.getItem(it2.id)) { var lib2 = F.setStatus(it2, 'want'); var t = ui.sheet.tmp[ui.sheet.season]; if (t) { lib2.seasons[String(ui.sheet.season)] = t; } }
        F.toggleEpisode(it2.id, ui.sheet.season, Number(el.dataset.e)); renderSheet(); render(); break;
      }
      case 'season-all': {
        var it3 = sheetItem(); if (!it3) return;
        if (!F.getItem(it3.id)) { var lib3 = F.setStatus(it3, 'want'); var t3 = ui.sheet.tmp[ui.sheet.season]; if (t3) lib3.seasons[String(ui.sheet.season)] = t3; }
        F.setSeasonWatched(it3.id, ui.sheet.season, el.dataset.on === '1'); renderSheet(); render(); break;
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
        var p = F.randomPick('want', ui.lists.want); if (p) openSheet(p.id); break;
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
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Копія «Кіноман»' }); ui.backupMsg = { ok: true, text: 'Копію збережено.' }; render(); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    ui.backupMsg = { ok: true, text: 'Файл копії завантажено.' }; render();
  }
  function onSubmit(form) {
    var kind = form.dataset.form;
    if (kind === 'search') { ui.q = form.elements.q.value; doSearch(false); }
    if (kind === 'tmdbkey') { F.setTmdbKey(form.elements.tmdbkey.value); ui.tmdbMsg = F.tmdbKeyOf() ? { ok: true, text: 'Ключ збережено. Натисніть «Перевірити ключ».' } : { ok: true, text: 'Ключ видалено.' }; render(); }
    if (kind === 'gemkey') { F.setGemKey(form.elements.gemkey.value); ui.gemMsg = F.gemKeyOf() ? { ok: true, text: 'Ключ збережено. Натисніть «Перевірити ключ».' } : { ok: true, text: 'Ключ видалено.' }; ui.error = null; render(); }
    if (kind === 'key') {
      F.setKey(form.elements.key.value); ui.keyMsg = F.keyOf() ? { ok: true, text: 'Ключ збережено. Натисніть «Перевірити ключ», щоб переконатись, що він працює.' } : { ok: false, text: 'Ключ порожній.' }; ui.error = null; render();
    }
  }

  function init() {
    app = $('#app'); tabsEl = $('#tabs'); sheetRoot = $('#sheet-root'); toastEl = $('#toast');
    F.init();
    F.on(function () { render(); });
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
      if (el.id === 'import-file' && el.files && el.files[0]) {
        var rd = new FileReader();
        rd.onload = function () { var r = F.importJSON(String(rd.result)); ui.backupMsg = r.error ? { ok: false, text: r.error } : { ok: true, text: 'Додано ' + r.added + ', оновлено ' + r.updated + '.' }; render(); };
        rd.onerror = function () { ui.backupMsg = { ok: false, text: 'Не вдалося прочитати файл.' }; render(); };
        rd.readAsText(el.files[0]);
      }
    });
    document.addEventListener('input', function (e) { var el = e.target; if (el.dataset && el.dataset.input === 'note' && ui.sheet) F.setNote(ui.sheet.id, el.value); });
    document.addEventListener('error', function (e) {
      var t = e.target; if (t && t.tagName === 'IMG' && t.closest('.poster')) t.remove();
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ui.sheet) closeSheet(); });
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  window.KinoUI = { ui: ui, render: render, openSheet: openSheet, toast: toast };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
