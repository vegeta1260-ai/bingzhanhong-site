#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冰盞紅 — 上線前檢查腳本
------------------------------------------------------------
上線那天跑一次，紅字就是還不能上。

用法：
  python check.py            列出所有問題（錯誤 + 警告）
  python check.py --strict   警告也視為失敗（正式上線前用這個）

檢查項目：
  [錯誤] 共用片段未同步（請先跑 python build.py）
  [錯誤] 頁面引用的本機檔案不存在（css / js / 內部連結）
  [錯誤] 鄉鎮區資料筆數不等於 368
  [警告] 圖片尚未產出（會顯示「待製圖」佔位框）
  [警告] 圖片超過 300KB
  [警告] 仍有 [待確認] 文字（config.js 與各頁面）
  [警告] 仍有【待業主提供】區塊或「草稿」註記
  [警告] config.js 的 api.url / site.url 為空
"""
import io
import os
import re
import sys

# Windows 主控台預設不是 UTF-8，強制設定避免中文與符號印不出來
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
import build  # noqa: E402

PAGES = build.PAGES
IMG_LIMIT = 300 * 1024

errors, warns = [], []


def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def line_of(text, idx):
    return text.count('\n', 0, idx) + 1


# ---------- 1. 共用片段是否同步 ----------
stale = build.main(check_only=True)
for s in stale:
    errors.append('%s：共用片段或版本號未同步，請先執行 python build.py' % s)

# ---------- 2. 逐頁檢查 ----------
for name in PAGES:
    path = os.path.join(ROOT, name)
    if not os.path.isfile(path):
        errors.append('%s：檔案不存在' % name)
        continue
    html = read(path)
    body = re.sub(r'<!--.*?-->', '', html, flags=re.S)   # 去掉註解再找可見文字

    # 本機資源與連結
    for m in re.finditer(r'(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"', html):
        ref = m.group(1)
        if ref.startswith(('http', 'mailto:', 'tel:', 'data:', '//')) or ref in ('', '/'):
            continue
        ref = ref.lstrip('/')                              # canonical 用的 /page.html 視為站根
        p = os.path.join(ROOT, ref.replace('/', os.sep))
        if ref.startswith('assets/img/'):
            if not os.path.isfile(p):
                warns.append('%s：圖片尚未產出 %s' % (name, ref))
            elif os.path.getsize(p) > IMG_LIMIT and not ref.endswith('.svg'):
                warns.append('%s：圖片超過 300KB（%d KB）%s' % (name, os.path.getsize(p) // 1024, ref))
        elif not os.path.isfile(p):
            errors.append('%s 第 %d 行：找不到 %s' % (name, line_of(html, m.start()), ref))

    # 待確認 / 待補
    for m in re.finditer(r'\[待確認\]|［[^］]*待確認[^］]*］', body):
        warns.append('%s 第 %d 行：仍有「待確認」' % (name, line_of(body, m.start())))
    for m in re.finditer(r'tbd-block|【待業主提供】', body):
        warns.append('%s 第 %d 行：仍有【待業主提供】區塊' % (name, line_of(body, m.start())))
    for m in re.finditer(r'<!--\s*草稿', html):
        warns.append('%s 第 %d 行：草稿段落尚未經業主確認' % (name, line_of(html, m.start())))

# ---------- 2b. 版面：容易造成橫向溢出的寫法 ----------
css_path = os.path.join(ROOT, 'assets', 'css', 'site.css')
if os.path.isfile(css_path):
    css = read(css_path)
    # aspect-ratio 搭配 min-height 又沒給 width，瀏覽器會用高度反推寬度而撐破版面
    for m in re.finditer(r'\{[^{}]*\}', css):
        rule = m.group(0)
        if 'aspect-ratio' in rule and 'min-height' in rule and 'width:' not in rule:
            warns.append('site.css 第 %d 行：規則同時有 aspect-ratio 與 min-height 卻沒有 width，'
                         '可能在窄螢幕撐破版面' % line_of(css, m.start()))

# ---------- 2c. grid 清單裡的裸文字節點 ----------
# <li> 底下如果同時有元素子節點和沒包起來的文字，在 display:grid 的容器裡
# 那段文字會變成獨立的格線項目，被擠進第一欄，畫面上是一個字一行。
# 這個錯誤犯過兩次（送禮重點、條文摘要），所以自動檢查。
def top_level_text(inner):
    """回傳 <li> 直接子層的文字（不含任何子元素內部的文字）。"""
    depth, out, i = 0, [], 0
    for m in re.finditer(r'<(/?)([a-zA-Z][\w-]*)[^>]*?(/?)>', inner):
        if depth == 0:
            out.append(inner[i:m.start()])
        closing, void = m.group(1), m.group(3)
        if closing:
            depth = max(0, depth - 1)
        elif not void and m.group(2).lower() not in ('br', 'img', 'hr', 'input', 'source'):
            depth += 1
        i = m.end()
    if depth == 0:
        out.append(inner[i:])
    return ''.join(out)

if os.path.isfile(css_path):
    grid_lists = set()
    for m in re.finditer(r'\.([A-Za-z0-9_-]+)\s+li\s*\{([^{}]*)\}', css):
        rule_body = m.group(2)
        if 'display:grid' in rule_body.replace(' ', '') and 'grid-template-columns' in rule_body:
            grid_lists.add(m.group(1))

    for name in PAGES:
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            continue
        html = read(path)
        for cls in grid_lists:
            for lm in re.finditer(r'<(?:ul|ol)[^>]*class="[^"]*' + re.escape(cls) + r'[^"]*"[^>]*>', html):
                seg = html[lm.end():]
                end = re.search(r'</(?:ul|ol)>', seg)
                seg = seg[:end.start()] if end else seg
                for li in re.finditer(r'<li[^>]*>(.*?)</li>', seg, re.S):
                    inner = li.group(1)
                    if not re.search(r'<[a-zA-Z]', inner):
                        continue                      # 純文字的 li 沒問題
                    if top_level_text(inner).strip():
                        warns.append('%s 第 %d 行：.%s 的 <li> 有沒包起來的文字，'
                                     'grid 會把它當成獨立項目，畫面上會變成一行一字'
                                     % (name, line_of(html, lm.end() + li.start()), cls))

# ---------- 3. config.js ----------
cfg = read(os.path.join(ROOT, 'assets', 'js', 'config.js'))
for m in re.finditer(r"'(\[待確認\][^']*)'", cfg):
    warns.append('config.js 第 %d 行：%s' % (line_of(cfg, m.start()), m.group(1)))
if re.search(r"api\s*:\s*\{\s*url\s*:\s*''", cfg):
    warns.append('config.js：api.url 為空，訂單不會寫入試算表')
if not build.site_url():
    warns.append('config.js：site.url 為空，sitemap 與分享網址會是佔位值')

# ---------- 4. 鄉鎮區資料 ----------
dist_path = os.path.join(ROOT, 'assets', 'js', 'tw-districts.js')
if os.path.isfile(dist_path):
    # 只數方括號內的項目（鄉鎮市區），不含當作鍵的縣市名
    n = sum(len(re.findall(r"'[^']+'", arr)) for arr in re.findall(r'\[([^\]]*)\]', read(dist_path)))
    if n != 368:
        errors.append('tw-districts.js：鄉鎮市區共 %d 筆，應為 368' % n)
else:
    errors.append('找不到 assets/js/tw-districts.js')

# ---------- 輸出 ----------
def show(label, items, color):
    if not items:
        return
    print('\n%s（%d）' % (label, len(items)))
    for it in items:
        print('  %s %s' % (color, it))

show('錯誤 — 必須修正', errors, '✗')
show('警告 — 上線前確認', warns, '!')

if not errors and not warns:
    print('全部通過，可以上線。')
    sys.exit(0)

strict = '--strict' in sys.argv
if errors or (strict and warns):
    print('\n結果：%s' % ('未通過' if errors else '未通過（--strict）'))
    sys.exit(1)
print('\n結果：無錯誤，但有 %d 項警告。正式上線前請用 --strict 重跑。' % len(warns))
