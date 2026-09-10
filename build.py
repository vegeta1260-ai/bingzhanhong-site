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
PAGES = ['index.html', 'product.html', 'story.html', 'order.html',
         'done.html', 'status.html', 'wholesale.html', 'info.html']
SITEMAP_PAGES = ['index.html', 'product.html', 'story.html', 'wholesale.html', 'info.html']

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


# ---------- WebP：有同名 .webp 就用 <picture> 包起來，舊瀏覽器自動退回 .jpg ----------
PICTURE_RE = re.compile(r'<picture><source srcset="[^"]*" type="image/webp">(<img[^>]*>)</picture>')
IMG_RE = re.compile(r'<img([^>]*\ssrc="(assets/img/[^"]+)\.jpg"[^>]*)>')


def wrap_webp(text):
    text = PICTURE_RE.sub(r'\1', text)                  # 先拆掉舊的包裝，保持可重複執行
    def rep(m):
        webp = m.group(2) + '.webp'
        if not os.path.isfile(os.path.join(ROOT, webp.replace('/', os.sep))):
            return m.group(0)
        return '<picture><source srcset="%s" type="image/webp">%s</picture>' % (webp, m.group(0))
    return IMG_RE.sub(rep, text)


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
    return version_assets(wrap_webp(out))


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
