#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冰盞紅 — 組建腳本
------------------------------------------------------------
做四件事，每次改完網站就跑一次：

  1. 把 partials/ 的共用片段（頁首、頁尾、底部列、head、scripts）
     同步進每一頁的 <!-- @include:NAME --> … <!-- @end:NAME --> 區塊。
     改一次頁尾，八頁一起更新。
  2. 幫 assets/css、assets/js 的連結加上內容雜湊版本號 ?v=xxxxxxxx。
     檔案內容改了版本號就變，瀏覽器快取自動失效，不用手動 +1。
  3. 從首頁 FAQ 產生 FAQPage 結構化資料（Google 可能在搜尋結果直接展開）。
  4. 依 config.js 的 site.url 產生 sitemap.xml 與 robots.txt。

用法：
  python build.py           組建全部頁面
  python build.py --check   只檢查是否需要重新組建（給 check.py 用），不寫檔

輸出仍然是純 HTML，用瀏覽器直接打開就能看，不需要任何伺服器或套件。
"""
import hashlib
import html as htmllib
import io
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))
PARTIALS = os.path.join(ROOT, 'partials')
PAGES = ['index.html', 'product.html', 'story.html', 'notes.html', 'order.html',
         'done.html', 'status.html', 'wholesale.html', 'info.html']
SITEMAP_PAGES = ['index.html', 'product.html', 'story.html', 'notes.html', 'wholesale.html', 'info.html']

INCLUDE_RE = re.compile(
    r'<!--\s*@include:([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*-->(.*?)<!--\s*@end:\1\s*-->',
    re.S)
ATTR_RE = re.compile(r'([\w-]+)(?:="([^"]*)")?')
ASSET_RE = re.compile(r'((?:href|src)=")(assets/(?:css|js)/[^"?#]+)(\?v=[^"#]*)?(")')


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


# ---------- 極簡樣板：{{key}}、{{#key}}…{{/key}}、{{^key}}…{{/key}} ----------
def render(tpl, ctx):
    def block(m):
        neg, key, body = m.group(1) == '^', m.group(2), m.group(3)
        val = ctx.get(key)
        return body if (bool(val) != neg) else ''
    prev = None
    while prev != tpl:
        prev = tpl
        tpl = re.sub(r'\{\{([#^])([\w-]+)\}\}(.*?)\{\{/\2\}\}', block, tpl, flags=re.S)
    return re.sub(r'\{\{([\w-]+)\}\}', lambda m: str(ctx.get(m.group(1), '')), tpl)


def parse_attrs(s):
    ctx = {}
    for k, v in ATTR_RE.findall(s or ''):
        if k:
            ctx[k] = v if v != '' else True
    return ctx


# ---------- FAQ → JSON-LD ----------
def strip_tags(s):
    s = re.sub(r'<[^>]+>', '', s)
    return htmllib.unescape(re.sub(r'\s+', ' ', s)).strip()


def faq_jsonld(page_html):
    items = re.findall(
        r'<details[^>]*>\s*<summary>(.*?)</summary>\s*<p class="faq__a">(.*?)</p>',
        page_html, re.S)
    if not items:
        return ''
    data = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
            {'@type': 'Question', 'name': strip_tags(q),
             'acceptedAnswer': {'@type': 'Answer', 'text': strip_tags(a)}}
            for q, a in items
        ]
    }
    return ('<script type="application/ld+json">\n' +
            json.dumps(data, ensure_ascii=False, indent=2) + '\n</script>')


# ---------- 資產版本號 ----------
_hash_cache = {}


def asset_hash(rel):
    if rel in _hash_cache:
        return _hash_cache[rel]
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    if not os.path.isfile(p):
        _hash_cache[rel] = None
        return None
    with open(p, 'rb') as f:
        h = hashlib.sha1(f.read()).hexdigest()[:8]
    _hash_cache[rel] = h
    return h


def version_assets(text):
    def rep(m):
        h = asset_hash(m.group(2))
        if not h:
            return m.group(0)
        return '%s%s?v=%s%s' % (m.group(1), m.group(2), h, m.group(4))
    return ASSET_RE.sub(rep, text)


# ---------- 響應式圖片：產生 srcset，讓手機不要下載 2000px 的圖 ----------
# 變體由 tools/gen_images.py 產生，檔名格式 name@480w.jpg / name@480w.webp。
# sizes 預設 100vw（不會漏抓，只會多抓）；需要更精準時在 <img> 上加 data-sizes。
SRCSET_WIDTHS = (480, 800, 1200)
PICTURE_RE = re.compile(r'<picture><source [^>]*type="image/webp"[^>]*>(<img[^>]*>)</picture>')
IMG_RE = re.compile(r'<img([^>]*\ssrc="(assets/img/[^"]+)\.jpg"[^>]*)>')
GEN_ATTR_RE = re.compile(r'\s(?:srcset|sizes)="[^"]*"')
SIZES_RE = re.compile(r'\sdata-sizes="([^"]*)"')


def jpeg_width(path):
    """只讀 JPEG 標頭取出實際寬度，避免 build.py 依賴 Pillow。"""
    try:
        with open(path, 'rb') as f:
            if f.read(2) != b'\xff\xd8':
                return 0
            while True:
                b = f.read(1)
                while b and b != b'\xff':
                    b = f.read(1)
                while b == b'\xff':
                    b = f.read(1)
                if not b:
                    return 0
                marker = b[0]
                if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                    continue
                ln = int.from_bytes(f.read(2), 'big')
                if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                    f.read(3)                       # precision + height
                    return int.from_bytes(f.read(2), 'big')
                f.seek(ln - 2, 1)
    except Exception:
        return 0


def _variants(stem, ext):
    out = []
    for w in SRCSET_WIDTHS:
        rel = '%s@%dw.%s' % (stem, w, ext)
        if os.path.isfile(os.path.join(ROOT, rel.replace('/', os.sep))):
            out.append('%s %dw' % (rel, w))
    full = '%s.%s' % (stem, ext)
    fw = jpeg_width(os.path.join(ROOT, ('%s.jpg' % stem).replace('/', os.sep)))
    if fw and os.path.isfile(os.path.join(ROOT, full.replace('/', os.sep))):
        out.append('%s %dw' % (full, fw))
    return ', '.join(out)


def wrap_webp(text):
    text = PICTURE_RE.sub(r'\1', text)                  # 先拆掉舊包裝，保持可重複執行
    def rep(m):
        attrs, stem = m.group(1), m.group(2)
        attrs = GEN_ATTR_RE.sub('', attrs)              # 清掉上一輪產生的 srcset/sizes
        ms = SIZES_RE.search(attrs)
        sizes = ms.group(1) if ms else '100vw'
        jpg_set = _variants(stem, 'jpg')
        img = '<img%s>' % attrs
        if jpg_set.count(',') >= 1:
            img = '<img%s srcset="%s" sizes="%s">' % (attrs, jpg_set, sizes)
        if not os.path.isfile(os.path.join(ROOT, ('%s.webp' % stem).replace('/', os.sep))):
            return img
        webp_set = _variants(stem, 'webp')
        return '<picture><source type="image/webp" srcset="%s" sizes="%s">%s</picture>' % (webp_set, sizes, img)
    return IMG_RE.sub(rep, text)


# ---------- 社群分享與正規網址：一律補成絕對網址 ----------
# LINE 與 Facebook 抓 og:image 需要完整網址，相對路徑會抓不到，
# 分享出去只有一行字沒有圖。這裡在組頁時統一補齊，不用逐頁手改。
META_TAG_RE = re.compile(r'<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"\s*/?>')


def _abs(base, rel):
    if not rel or rel.startswith(('http://', 'https://', '//')):
        return rel
    return base + '/' + rel.lstrip('/')


def absolutize_meta(name, html):
    base = site_url()
    if not base:
        return html                      # 還沒有網域就維持原樣，check.py 會提醒

    page_url = base + '/' + ('' if name == 'index.html' else name)

    def get(pattern):
        m = re.search(pattern, html)
        return m.group(1) if m else ''

    og_image = get(r'<meta property="og:image" content="([^"]*)"')
    abs_image = _abs(base, og_image) if og_image else base + '/assets/img/og-cover.jpg'
    title = get(r'<meta property="og:title" content="([^"]*)"') or get(r'<title>([^<]*)</title>')
    desc = get(r'<meta property="og:description" content="([^"]*)"') \
        or get(r'<meta name="description" content="([^"]*)"')

    # canonical 改為絕對網址
    if re.search(r'<link rel="canonical"[^>]*>', html):
        html = re.sub(r'<link rel="canonical" href="[^"]*">',
                      '<link rel="canonical" href="%s">' % page_url, html)
    # og:image 改為絕對網址
    if og_image:
        html = html.replace('<meta property="og:image" content="%s">' % og_image,
                            '<meta property="og:image" content="%s">' % abs_image)

    # 補上缺的欄位，插在 og:locale 之前（沒有就插在 </head> 之前）
    add = []
    if 'property="og:url"' not in html:
        add.append('<meta property="og:url" content="%s">' % page_url)
    if 'property="og:site_name"' not in html:
        add.append('<meta property="og:site_name" content="冰盞紅">')
    if 'property="og:image:width"' not in html:
        add.append('<meta property="og:image:width" content="1200">')
        add.append('<meta property="og:image:height" content="630">')
    if 'property="og:image:alt"' not in html:
        add.append('<meta property="og:image:alt" content="冰盞紅 手作桂花酸梅湯">')
    if 'name="twitter:card"' not in html:
        add.append('<meta name="twitter:card" content="summary_large_image">')
        add.append('<meta name="twitter:title" content="%s">' % title)
        add.append('<meta name="twitter:description" content="%s">' % desc)
        add.append('<meta name="twitter:image" content="%s">' % abs_image)
    if add:
        block = '\n'.join(add) + '\n'
        anchor = '<meta property="og:locale"'
        html = html.replace(anchor, block + anchor, 1) if anchor in html \
            else html.replace('</head>', block + '</head>', 1)
    return html


# ---------- 組頁 ----------
def build_page(name, page_html):
    def rep(m):
        pname, attrs, _old = m.group(1), m.group(2), m.group(3)
        ctx = parse_attrs(attrs)
        if pname == 'faq-jsonld':
            body = faq_jsonld(page_html)
        else:
            tpl_path = os.path.join(PARTIALS, pname + '.html')
            if not os.path.isfile(tpl_path):
                raise SystemExit('%s：找不到 partials/%s.html' % (name, pname))
            body = render(read(tpl_path), ctx).rstrip('\n')
        return '<!-- @include:%s%s -->\n%s\n<!-- @end:%s -->' % (pname, attrs, body, pname)
    out = INCLUDE_RE.sub(rep, page_html)
    return absolutize_meta(name, version_assets(wrap_webp(out)))


# ---------- sitemap / robots ----------
def site_url():
    cfg = read(os.path.join(ROOT, 'assets', 'js', 'config.js'))
    m = re.search(r"site\s*:\s*\{[^}]*?url\s*:\s*'([^']*)'", cfg, re.S)
    return (m.group(1).strip().rstrip('/') if m else '')


def build_sitemap():
    base = site_url()
    placeholder = not base
    if placeholder:
        base = 'https://待確認.example'
    urls = ''.join(
        '  <url><loc>%s/%s</loc><changefreq>weekly</changefreq></url>\n'
        % (base, '' if p == 'index.html' else p) for p in SITEMAP_PAGES)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls)
    robots = ('User-agent: *\nAllow: /\nDisallow: /order.html\nDisallow: /done.html\n'
              'Disallow: /status.html\n\nSitemap: %s/sitemap.xml\n' % base)
    return xml, robots, placeholder


def main(check_only=False):
    stale = []
    for name in PAGES:
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            continue
        src = read(path)
        out = build_page(name, src)
        if out != src:
            stale.append(name)
            if not check_only:
                write(path, out)

    xml, robots, placeholder = build_sitemap()
    for fname, content in (('sitemap.xml', xml), ('robots.txt', robots)):
        p = os.path.join(ROOT, fname)
        if not os.path.isfile(p) or read(p) != content:
            stale.append(fname)
            if not check_only:
                write(p, content)

    if check_only:
        return stale

    print('已組建 %d 個頁面；更新：%s' % (len(PAGES), ', '.join(stale) if stale else '無變更'))
    if placeholder:
        print('提醒：config.js 的 site.url 還是空的，sitemap.xml 用的是佔位網址，上線前請填寫。')
    return stale


if __name__ == '__main__':
    if '--check' in sys.argv:
        s = main(check_only=True)
        if s:
            print('需要重新組建：' + ', '.join(s))
            sys.exit(1)
        print('組建結果與目前檔案一致。')
    else:
        main()
