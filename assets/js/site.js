/* ============================================================
   冰盞紅 — 全站共用腳本
   職責：把 config.js 的設定「填進」頁面，並處理全站共用的互動：
     - 檔期／供貨狀態切換
     - 大字模式（A／A+）
     - 桌機版電話按鈕（複製號碼而非撥號）
     - LINE 按鈕圖示
     - GA4（有設定才載入）與事件追蹤
   HTML 只寫 data-bzh="鍵名"，數字與文案一律由這裡供應，
   所以改價格永遠只要改 config.js 一個地方。
   ============================================================ */
(function () {
  'use strict';

  var C = window.BZH;
  if (!C) { console.error('[冰盞紅] 找不到 config.js，請確認載入順序。'); return; }

  /* ---------- 工具 ---------- */
  function money(n) { return 'NT$ ' + Number(n).toLocaleString('zh-TW'); }
  function num(n) { return Number(n).toLocaleString('zh-TW'); }
  function isTBD(v) { return typeof v === 'string' && v.indexOf('[待確認]') === 0; }

  function planById(id) {
    for (var i = 0; i < C.plans.length; i++) if (C.plans[i].id === id) return C.plans[i];
    return null;
  }
  function paymentById(id) {
    for (var i = 0; i < C.payments.length; i++) if (C.payments[i].id === id) return C.payments[i];
    return null;
  }

  /* 依方案 + 付款方式計算金額。全站唯一的計價來源。 */
  function calc(planId, paymentId) {
    var p = planById(planId);
    var pay = paymentById(paymentId);
    if (!p) return null;
    var fee = (pay && pay.feePerBox ? pay.feePerBox : 0) * p.boxes;
    return { plan: p, payment: pay || null, goods: p.price, fee: fee,
             feeName: (pay && pay.feeName) || '', total: p.price + fee };
  }

  /* ---------- 固定頁首高度 → CSS 變數 ----------
     錨點跳轉的偏移量必須跟著實際頁首走。導覽在中等寬度會換行，
     頁首高度不是固定值，寫死會讓標題被蓋住。 */
  function syncHeaderHeight() {
    var h = document.querySelector('.site-header');
    if (!h) return;
    var px = Math.round(h.getBoundingClientRect().height);
    if (px > 0) document.documentElement.style.setProperty('--header-h', px + 'px');
  }

  /* ---------- 供貨狀態（DICT 會用到，必須先宣告）---------- */
  var stock = C.stock || { status: 'open' };

  /* ---------- 檔期切換 ---------- */
  var camp = C.campaign;
  var on = !!camp.enabled;
  var campaignLabel = on ? camp.label : camp.labelOff;

  /* ---------- 可填入頁面的字典 ---------- */
  var box1 = planById('box1') || { price: 0, bottles: 0, boxes: 1 };
  var box2 = planById('box2') || { price: 0, bottles: 0, boxes: 2 };
  var cod = paymentById('cod') || { feePerBox: 0 };

  var DICT = {
    'brand.name': C.brand.name,
    'brand.product': C.brand.product,
    'brand.tagline': C.brand.tagline,

    'contact.lineId': C.contact.lineId,
    'contact.tel': C.contact.tel,
    'contact.hours': C.contact.hours,
    'contact.tel2': (C.contact.tel2 || ''),
    'store.address': (C.store && C.store.address) || '',
    'store.services': (C.store && C.store.services) || '',
    'store.hours': (C.store && C.store.hours) || '',

    'campaign.label': campaignLabel,
    'campaign.heroTitle': on ? camp.heroTitle : camp.heroTitleOff,
    'campaign.banner': on ? camp.bannerText : camp.bannerTextOff,
    'campaign.deadline': (on && camp.deadline) || '',
    'campaign.deliveryWindow': (on && camp.deliveryWindow) || '',

    'product.volume': C.product.volume,
    'product.perBox': C.product.perBox + ' 瓶',
    'product.shelfLife': C.product.shelfLifeDays + ' 天',
    'product.single': money(C.product.singleRefPrice) + ' ／瓶',
    'product.spec': C.product.volume + ' × ' + C.product.perBox + ' 瓶',
    'product.ingredients': C.product.ingredients.join('、'),

    'price.box1': money(box1.price),
    'price.box1.plain': num(box1.price),
    'price.box2': money(box2.price),
    'price.box2.plain': num(box2.price),
    'price.box2.perBottle': money(Math.round(box2.price / box2.bottles)),
    'price.box2.save': money(box1.price * 2 - box2.price),

    'cod.fee': money(cod.feePerBox) + ' ／箱',
    'cod.feePlain': num(cod.feePerBox),
    'cod.total1': money(box1.price + cod.feePerBox * box1.boxes),
    'cod.total2': money(box2.price + cod.feePerBox * box2.boxes),

    'stock.note': (stock.status === 'closed' ? stock.closedNote
                  : stock.status === 'preorder' ? stock.preorderNote : ''),
    'shipping.remoteNote': C.shipping.remoteNote || '',
    'gift.note': (C.gift && C.gift.note) || '',
    'shipping.method': C.shipping.method,
    'shipping.leadTime': C.shipping.leadTime,
    'shipping.areaNote': C.shipping.areaNote,
    'shipping.arriveNote': C.shipping.arriveNote || '',

    'bank.name': C.bank.bankName,
    'bank.code': C.bank.bankCode,
    'bank.branch': C.bank.branch,
    'bank.account': C.bank.account,
    'bank.holder': C.bank.holder,

    'legal.company': C.legal.companyName,
    'legal.taxId': C.legal.taxId,
    'legal.foodReg': C.legal.foodRegNo,
    'legal.address': C.legal.address,

    'year': String(new Date().getFullYear())
  };

  /* ---------- 填入文字 ---------- */
  function fillText(root) {
    (root || document).querySelectorAll('[data-bzh]').forEach(function (el) {
      var key = el.getAttribute('data-bzh');
      if (Object.prototype.hasOwnProperty.call(DICT, key)) {
        el.textContent = DICT[key];
        if (isTBD(DICT[key])) el.classList.add('tbd');
      }
    });
  }

  /* ---------- 填入連結 ---------- */
  function fillLinks(root) {
    var r = root || document;
    r.querySelectorAll('[data-bzh-link="line"]').forEach(function (a) {
      a.href = C.contact.lineUrl;
      a.target = '_blank';
      a.rel = 'noopener';
    });
    r.querySelectorAll('[data-bzh-link="tel"]').forEach(function (a) {
      a.href = 'tel:' + C.contact.telDial;
    });
    r.querySelectorAll('[data-bzh-link="tel2"]').forEach(function (a) {
      a.href = 'tel:' + (C.contact.tel2Dial || '');
    });
    r.querySelectorAll('[data-bzh-link="map"]').forEach(function (a) {
      if (C.store && C.store.mapUrl) { a.href = C.store.mapUrl; a.target = '_blank'; a.rel = 'noopener'; }
    });
  }

  /* ---------- 檔期區塊顯示／隱藏 ----------
     data-bzh-campaign="on"  → 只有活動期間顯示
     data-bzh-campaign="off" → 只有活動結束後顯示 */
  function applyCampaign(root) {
    (root || document).querySelectorAll('[data-bzh-campaign]').forEach(function (el) {
      var want = el.getAttribute('data-bzh-campaign') === 'on';
      if (want !== on) el.classList.add('hide');
    });
  }

  /* ---------- 供貨狀態 ----------
     'preorder' 在頁首下方插入提示；'closed' 另外把「立即訂購」改成 LINE 詢問並停用表單。 */
  function applyStock() {
    if (stock.status === 'open') return;
    var closed = stock.status === 'closed';

    var bar = document.createElement('div');
    bar.className = 'stockbar' + (closed ? ' stockbar--closed' : '');
    bar.setAttribute('role', 'status');
    bar.textContent = closed ? stock.closedNote : stock.preorderNote;

    var header = document.querySelector('.site-header');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);

    if (!closed) return;

    document.querySelectorAll('a[href^="order.html"]').forEach(function (a) {
      a.href = C.contact.lineUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      if (a.classList.contains('btn')) a.textContent = '用 LINE 詢問開賣時間';
    });
    var form = document.getElementById('order-form');
    if (form) {
      form.querySelectorAll('input,select,textarea,button').forEach(function (el) { el.disabled = true; });
      var barBtn = document.getElementById('bar-btn');
      if (barBtn) { barBtn.disabled = true; barBtn.textContent = '目前暫停接單'; }
    }
  }

  /* ---------- 圖片佔位 ----------
     圖片載入失敗時顯示「待製圖」框，而不是破圖。 */
  function bindPlaceholders(root) {
    (root || document).querySelectorAll('.ph img, .ing__fig img, .tile img, .bleed__bg img, .hero__media img').forEach(function (img) {
      var box = img.closest('.ph') || img.closest('.ing__fig') || img.closest('.tile') || img.closest('.bleed__bg') || img.closest('.hero__media');
      if (!box) return;
      var fallback = img.getAttribute('data-fallback');
      function fail() {
        // 正式圖還沒到，先用同組已完成的圖暫代；暫代也失敗才顯示佔位框
        if (fallback && img.getAttribute('src') !== fallback) {
          img.setAttribute('src', fallback);
          var pic = img.parentNode && img.parentNode.tagName === 'PICTURE' ? img.parentNode : null;
          if (pic) pic.querySelectorAll('source').forEach(function (so) { so.remove(); });
          return;
        }
        box.classList.add('is-empty');
      }
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }

  /* ---------- 提示訊息（toast）---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  /* ---------- 桌機版電話按鈕 ----------
     桌機沒有撥號功能，點 tel: 會跳出系統對話框。改成顯示號碼、點一下複製。 */
  var isDesktop = !!(window.matchMedia &&
    window.matchMedia('(hover:hover) and (pointer:fine)').matches);

  function desktopTel() {
    if (!isDesktop) return;
    document.querySelectorAll('[data-bzh-link="tel"]').forEach(function (a) {
      if (a.querySelector('.num') === null && a.textContent.indexOf(C.contact.tel) === -1) {
        var s = document.createElement('span');
        s.className = 'num';
        s.textContent = C.contact.tel;
        a.appendChild(document.createTextNode(' '));
        a.appendChild(s);
      }
      a.title = '點一下複製電話號碼';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        copyText(C.contact.tel).then(
          function () { toast('已複製客服電話 ' + C.contact.tel); },
          function () { toast('客服電話 ' + C.contact.tel); }
        );
      });
    });
  }

  /* ---------- LINE 按鈕圖示 ----------
     白字在 LINE 綠上對比不足，加圖示讓辨識不只靠文字。 */
  var LINE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.4 7.2 8 7.9.3.1.7.2.8.5.1.3.1.7 0 1l-.1.8c0 .2-.2.9.8.5s5.3-3.1 7.2-5.3C20.6 14.9 22 13.1 22 11c0-4.4-4.5-8-10-8zm-3.6 10.4H6.3a.5.5 0 0 1-.5-.5V9.1a.5.5 0 0 1 1 0v3.3h1.6a.5.5 0 0 1 0 1zm1.6-.5a.5.5 0 0 1-1 0V9.1a.5.5 0 0 1 1 0v3.8zm4.9 0a.5.5 0 0 1-.9.3l-2.1-2.8v2.5a.5.5 0 0 1-1 0V9.1a.5.5 0 0 1 .9-.3l2.1 2.8V9.1a.5.5 0 0 1 1 0v3.8zm3.4-2.4a.5.5 0 0 1 0 1h-1.6v1h1.6a.5.5 0 0 1 0 1h-2.1a.5.5 0 0 1-.5-.5V9.1a.5.5 0 0 1 .5-.5h2.1a.5.5 0 0 1 0 1h-1.6v1h1.6z"/></svg>';

  function lineGlyph(root) {
    (root || document).querySelectorAll('.btn--line').forEach(function (b) {
      if (!b.querySelector('svg')) b.insertAdjacentHTML('afterbegin', LINE_ICON);
    });
  }

  /* ---------- 大字模式 ----------
     html 的 font-size 放大 18%，所有 rem 單位一起放大。記在本機。 */
  var FONT_KEY = 'bzh-font-lg';
  function fontSize() {
    var root = document.documentElement;
    var btn = document.getElementById('fontsize-toggle');
    var onNow = false;
    try { onNow = localStorage.getItem(FONT_KEY) === '1'; } catch (e) {}
    function apply(v) {
      root.classList.toggle('font-lg', v);
      if (btn) {
        btn.setAttribute('aria-pressed', v ? 'true' : 'false');
        btn.title = v ? '恢復標準字體' : '放大字體';
      }
    }
    apply(onNow);
    if (btn) {
      btn.addEventListener('click', function () {
        onNow = !onNow;
        apply(onNow);
        try { localStorage.setItem(FONT_KEY, onNow ? '1' : '0'); } catch (e) {}
        track('font_size_toggle', { large: onNow });
      });
    }
  }

  /* ---------- GA4 與事件追蹤 ----------
     config.analytics.ga4 有值才載入；沒有就全部是空操作。 */
  var GA = (C.analytics && C.analytics.ga4) || '';

  function analytics() {
    document.querySelectorAll('[data-bzh-analytics]').forEach(function (el) {
      var want = el.getAttribute('data-bzh-analytics') === 'on';
      if (want !== !!GA) el.classList.add('hide');
    });
    if (!GA) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA);
    document.head.appendChild(s);
  }

  function track(name, params) {
    if (!GA || typeof window.gtag !== 'function') return;
    try { window.gtag('event', name, params || {}); } catch (e) {}
  }

  /* ---------- 對外 API ---------- */
  window.BZHUtil = {
    money: money,
    num: num,
    isTBD: isTBD,
    planById: planById,
    paymentById: paymentById,
    calc: calc,
    campaignLabel: campaignLabel,
    campaignOn: on,
    stock: stock,
    dict: DICT,
    isDesktop: isDesktop,
    toast: toast,
    copyText: copyText,
    track: track,
    refresh: function (root) {
      fillText(root); fillLinks(root); applyCampaign(root); bindPlaceholders(root); lineGlyph(root);
    }
  };

  /* ---------- 啟動 ---------- */
  function init() {
    fillText(); fillLinks(); applyCampaign(); applyStock(); bindPlaceholders();
    lineGlyph(); fontSize(); desktopTel(); analytics();
    syncHeaderHeight();
    document.querySelectorAll('[data-bzh-title]').forEach(function (el) {
      el.textContent = el.getAttribute('data-bzh-title').replace('{campaign}', campaignLabel);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 字體載入完與視窗改變寬度時，頁首高度都可能變
  window.addEventListener('load', syncHeaderHeight);
  window.addEventListener('resize', syncHeaderHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderHeight);
})();
