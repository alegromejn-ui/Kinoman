"""Збирає новини кіно й серіалів з Google News (українською) у news.json.

Запускається в GitHub Actions кожні 2 години; результат лежить у гілці news-data,
а додаток читає його з raw.githubusercontent.com (браузер не може читати RSS напряму через CORS).
"""
import email.utils
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

QUERIES = [
    'фільм OR кінофільм OR "у кінотеатрах" when:7d',
    'серіал OR "новий сезон" when:7d',
    'трейлер OR прем\'єра OR "дата виходу" кіно when:7d',
    'Netflix OR Marvel OR "Оскар" OR "касові збори" when:7d',
]
# російські джерела й теми, що часто трапляються під «серіал», але не про кіно
BAD_SRC = re.compile(r'\.ru\b|\bria\b|lenta|tass|kp\.ru|rbc', re.I)
BAD_TITLE = re.compile(r'гороскоп|прогноз погоди|курс валют|телепрограма|телепрограмма', re.I)
MAX_AGE = 7 * 86400
LIMIT = 40


def feed_url(q):
    return 'https://news.google.com/rss/search?' + urllib.parse.urlencode({'q': q, 'hl': 'uk', 'gl': 'UA', 'ceid': 'UA:uk'})


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (news collector)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def parse(xml_bytes, now):
    out = []
    root = ET.fromstring(xml_bytes)
    for it in root.iter('item'):
        title = (it.findtext('title') or '').strip()
        link = (it.findtext('link') or '').strip()
        src_el = it.find('source')
        src = (src_el.text or '').strip() if src_el is not None else ''
        src_url = src_el.get('url', '') if src_el is not None else ''
        try:
            ts = email.utils.parsedate_to_datetime(it.findtext('pubDate') or '').timestamp()
        except (TypeError, ValueError):
            continue
        if not title or not link.startswith('https://') or now - ts > MAX_AGE or ts > now + 3600:
            continue
        # Google News дописує « - Видання» в кінець заголовка
        if src and title.endswith(' - ' + src):
            title = title[: -len(src) - 3].strip()
        if BAD_SRC.search(src_url) or BAD_SRC.search(src) or BAD_TITLE.search(title):
            continue
        out.append({'title': title[:220], 'source': src[:60], 'url': link, 't': int(ts)})
    return out


def norm(t):
    return re.sub(r'[^\w]+', ' ', t.lower()).strip()[:70]


def collect(feeds, now):
    seen, items = set(), []
    for raw in feeds:
        for x in parse(raw, now):
            k = norm(x['title'])
            if k in seen:
                continue
            seen.add(k)
            items.append(x)
    items.sort(key=lambda x: -x['t'])
    return items[:LIMIT]


def main(out_path):
    now = time.time()
    feeds = []
    for q in QUERIES:
        try:
            feeds.append(fetch(feed_url(q)))
        except Exception as e:  # одна стрічка не повинна зупиняти решту
            print('skip', q, e, file=sys.stderr)
    items = collect(feeds, now)
    if not items:
        sys.exit('no news collected')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'t': int(now), 'items': items}, f, ensure_ascii=False, separators=(',', ':'))
    print(len(items), 'items')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'news.json')
