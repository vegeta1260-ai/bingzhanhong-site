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
