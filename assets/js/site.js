/* ============================================================
   冰盞紅 — 全站共用腳本
   職責：把 config.js 的設定「填進」頁面。
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
    return {
      plan: p,
      payment: pay || null,
      goods: p.price,
      fee: fee,
      feeName: (pay && pay.feeName) || '',
      total: p.price + fee
    };
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

    'campaign.label': campaignLabel,
    'campaign.heroTitle': on ? camp.heroTitle : camp.heroTitleOff,
    'campaign.banner': on ? camp.bannerText : camp.bannerTextOff,

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
     config.stock.status 不是 'open' 時，在頁首下方插入一條提示。
     'closed' 另外把所有「立即訂購」改成 LINE 詢問，並停用訂購表單。 */
  function applyStock() {
    if (stock.status === 'open') return;

    var closed = stock.status === 'closed';
    var text = closed ? stock.closedNote : stock.preorderNote;

    var bar = document.createElement('div');
    bar.className = 'stockbar' + (closed ? ' stockbar--closed' : '');
    bar.setAttribute('role', 'status');
    bar.textContent = text;

    var header = document.querySelector('.site-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(bar, header.nextSibling);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }

    if (!closed) return;

    // 暫停接單：訂購連結導向 LINE，避免客人填完才發現不能買
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
    (root || document).querySelectorAll('.ph img, .ing__fig img').forEach(function (img) {
      var box = img.closest('.ph') || img.closest('.ing__fig');
      if (!box) return;
      function fail() { box.classList.add('is-empty'); }
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
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
    refresh: function (root) {
      fillText(root); fillLinks(root); applyCampaign(root); bindPlaceholders(root);
    }
  };

  /* ---------- 啟動 ---------- */
  function init() {
    fillText(); fillLinks(); applyCampaign(); applyStock(); bindPlaceholders();
    // 網頁標題若含活動字樣，一併同步
    document.querySelectorAll('[data-bzh-title]').forEach(function (el) {
      el.textContent = el.getAttribute('data-bzh-title').replace('{campaign}', campaignLabel);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
