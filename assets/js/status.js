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
          row('訂單編號', o.orderNo) +
          row('訂購日期', o.orderedAt) +
          row('商品', o.planTitle) +
          row('金額', U.money(o.total)) +
          row('付款方式', o.paymentName) +
          row('付款狀態', o.paymentStatus) +
          row('訂單狀態', o.orderStatus);
        $('lookup-result').classList.remove('hide');
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
