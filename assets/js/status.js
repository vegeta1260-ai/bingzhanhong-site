/* ============================================================
   冰盞紅 — 訂單查詢／付款回報
   兩個獨立表單，都走同一個 Apps Script 端點：
     action=report → 寫入「付款回報」工作表
     action=lookup → 以訂單編號 + 電話 查詢訂單狀態
   未設定 api.url 時，改為引導使用 LINE／電話，不做假查詢。
   ============================================================ */
(function () {
  'use strict';

  var C = window.BZH, U = window.BZHUtil;
  if (!C || !U) return;

  var $ = function (id) { return document.getElementById(id); };
  var apiUrl = (C.api && C.api.url) || '';
  var track = function (n, p) { if (U.track) U.track(n, p); };

  function cleanPhone(v) { return String(v || '').replace(/[^\d]/g, ''); }
  function validPhone(v) { return /^0\d{8,9}$/.test(cleanPhone(v)); }

  function setError(fieldId, on) {
    var f = $(fieldId);
    if (!f) return;
    f.classList.toggle('has-error', on);
    var input = f.querySelector('.input,.textarea,.select');
    if (input) input.classList.toggle('is-error', on);
  }

  function post(body) {
    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  /* ---------- 未設定 API ---------- */
  if (!apiUrl) {
    $('api-warn').classList.remove('hide');
    ['report-btn', 'lookup-btn'].forEach(function (id) {
      var b = $(id);
      b.disabled = true;
      b.textContent = '請改用 LINE 或電話聯絡我們';
    });
  }

  /* ---------- 付款方式切換：ATM 才需要後 5 碼 ---------- */
  $('method').addEventListener('change', function () {
    $('f-last5').classList.toggle('hide', this.value !== 'atm');
    if (this.value !== 'atm') setError('f-last5', false);
  });

  /* ---------- 付款回報 ---------- */
  $('report-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!apiUrl) return;

    var ok = true, first = null;
    function check(id, pass) {
      setError(id, !pass);
      if (!pass) { ok = false; if (!first) first = $(id); }
    }

    var method = $('method').value;
    check('f-phone', validPhone($('phone').value));
    check('f-method', !!method);
    if (method === 'atm') check('f-last5', /^\d{5}$/.test($('last5').value.trim()));

    $('report-err').style.display = ok ? 'none' : 'block';
    if (!ok) { if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

    var btn = $('report-btn');
    btn.disabled = true;
    btn.textContent = '送出中…';

    post({
      action: 'report',
      orderNo: $('orderno').value.trim(),
      phone: cleanPhone($('phone').value),
      method: method,
      methodName: method === 'atm' ? 'ATM 轉帳' : 'LINE Pay',
      last5: method === 'atm' ? $('last5').value.trim() : '',
      paidAt: $('paidat').value,
      note: $('rnote').value.trim(),
      submittedAt: new Date().toISOString()
    })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error('伺服器回應異常');
        $('report-ok').classList.remove('hide');
        track('payment_report', { method: method });
        btn.textContent = '✓ 已送出付款回報';
        $('report-ok').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (err) {
        console.error('[冰盞紅] 付款回報失敗：', err);
        btn.disabled = false;
        btn.textContent = '送出付款回報';
        $('report-err').textContent = '送出失敗，請改用官方 LINE 或電話通知我們，謝謝。';
        $('report-err').style.display = 'block';
      });
  });

  /* ---------- 訂單進度條 ----------
     試算表有兩個欄位：付款狀態與訂單狀態。客人不需要理解那兩欄，
     他只想知道「我的東西到哪了」。這裡把兩欄合成一條四段進度。 */
  var TRACK_STEPS = ['訂單成立', '款項確認', '備貨熬煮', '出貨配送'];

  function trackIndex(order) {
    var pay = String(order.paymentStatus || '');
    var ord = String(order.orderStatus || '');
    if (ord === '已取消') return -1;
    if (ord === '已出貨' || ord === '已完成') return 3;
    if (ord === '備貨中') return 2;
    // 貨到付款不需要事先收款，確認後就直接進備貨
    if (pay === '已付款' || pay === '貨到付款') return 1;
    return 0;
  }

  function trackNote(order) {
    var pay = String(order.paymentStatus || '');
    var ord = String(order.orderStatus || '');
    if (ord === '已取消') return '這張訂單已取消。如有疑問請透過官方 LINE 與我們聯絡。';
    if (ord === '已完成') return '訂單已完成，謝謝您。收到後請立即冷藏，保存期限內喝完。';
    if (ord === '已出貨') return '已交給冷藏宅配。宅配到達時<strong>需要有人簽收</strong>，請保持電話暢通。';
    if (ord === '備貨中') return '您的訂單已排進最近一批熬煮。熬好、裝瓶、冷藏後就會出貨。';
    if (pay === '待核對') return '已收到您的付款回報，我們正在核對款項。核對完成後會排進備貨。';
    if (pay === '貨到付款') return '這張訂單是貨到付款，不需要事先匯款。我們會直接安排備貨。';
    if (pay === '待付款') return '訂單已成立，尚未收到款項。完成轉帳後請到上方<a href="#report">付款回報</a>告訴我們。';
    return '訂單已成立，我們會盡快與您確認。';
  }

  function renderTrack(order) {
    var idx = trackIndex(order);
    var html = '<ol class="track" aria-label="訂單進度">';
    for (var i = 0; i < TRACK_STEPS.length; i++) {
      var cls = 'track__step';
      if (idx < 0) cls += ' is-void';
      else if (i < idx) cls += ' is-done';
      else if (i === idx) cls += ' is-now';
      html += '<li class="' + cls + '"><span class="track__dot"></span>' +
              '<span class="track__label">' + TRACK_STEPS[i] + '</span></li>';
    }
    html += '</ol>';
    html += '<p class="track__note' + (idx < 0 ? ' track__note--void' : '') + '">' + trackNote(order) + '</p>';
    return html;
  }

  /* ---------- 訂單查詢 ---------- */
  $('lookup-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!apiUrl) return;

    var ok = true;
    var hasNo = $('q-orderno').value.trim().length >= 4;
    var hasPhone = validPhone($('q-phone').value);
    setError('f-q-orderno', !hasNo);
    setError('f-q-phone', !hasPhone);
    ok = hasNo && hasPhone;
    if (!ok) return;

    var btn = $('lookup-btn');
    btn.disabled = true;
    btn.textContent = '查詢中…';
    $('lookup-result').classList.add('hide');
    $('lookup-none').classList.add('hide');

    post({
      action: 'lookup',
      orderNo: $('q-orderno').value.trim(),
      phone: cleanPhone($('q-phone').value)
    })
      .then(function (data) {
        btn.disabled = false;
        btn.textContent = '查詢訂單';
        if (!data || data.ok !== true || !data.order) {
          $('lookup-none').classList.remove('hide');
          return;
        }
        var o = data.order;
        function row(k, v) {
          return '<div class="summary__row"><span class="k">' + k + '</span><span class="v">' + (v || '—') + '</span></div>';
        }
        $('lookup-rows').innerHTML =
          renderTrack(o) +
          row('訂單編號', o.orderNo) +
          row('訂購日期', o.orderedAt) +
          row('商品', o.planTitle) +
          row('金額', U.money(o.total)) +
          row('付款方式', o.paymentName) +
          row('付款狀態', o.paymentStatus) +
          row('訂單狀態', o.orderStatus);
        $('lookup-result').classList.remove('hide');
        track('order_lookup', { found: true });
        $('lookup-result').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (err) {
        console.error('[冰盞紅] 訂單查詢失敗：', err);
        btn.disabled = false;
        btn.textContent = '查詢訂單';
        $('lookup-none').classList.remove('hide');
      });
  });
})();
