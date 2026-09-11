# -*- coding: utf-8 -*-
"""為 assets/img 下的大圖產生多種寬度，供 srcset 使用。
   只處理比最小級距還寬的圖；QR、logo、icon 不動。"""
import os, sys, glob
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
os.chdir(r'E:\光陽\冰盞紅')

WIDTHS = [480, 800, 1200]          # 再上去就是原圖本身
SKIP = ('line-qr', 'linepay-qr', 'logo-', 'og-cover')   # 不需要響應式的

made = saved = 0
for src in sorted(glob.glob('assets/img/*.jpg')):
    base = os.path.splitext(os.path.basename(src))[0]
    if base.startswith(SKIP) or '@' in base:
        continue
    im = Image.open(src).convert('RGB')
    W, H = im.size
    for w in WIDTHS:
        if w >= W:
            continue
        out_j = 'assets/img/%s@%dw.jpg' % (base, w)
        out_w = 'assets/img/%s@%dw.webp' % (base, w)
        if os.path.isfile(out_j) and os.path.isfile(out_w):
            continue
        r = im.resize((w, round(H * w / W)), Image.LANCZOS)
        q = 80
        r.save(out_j, 'JPEG', quality=q, optimize=True, progressive=True)
        r.save(out_w, 'WEBP', quality=78, method=6)
        made += 2
        saved += os.path.getsize(src) - os.path.getsize(out_j)
print('產生 %d 個檔案' % made)
