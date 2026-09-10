/* ============================================================
   冰盞紅 — 團購・企業訂購詢價
   有設定 api.url 就寫入試算表的「團購詢價」工作表；
   沒設定就把內容整理好讓客人用 LINE 傳，不假裝已送出。
   ============================================================ */
(function () {
  'use strict';

  var C = window.BZH, U = window.BZHUtil;
  var form = document.getElementById('wholesale-form');
  if (!C || !U || !form) return;

  var $ = function (id) { return document.getElementById(id); };
  var apiUrl = (C.api && C.api.url) || '';
  var track = function (n, p) { if (U.track) U.track(n, p); };

  function cleanPhone(v) { return String(v || '').replace(/[^\d]/g, ''); }
  function validPhone(v) { return /^0\d{8,9}$/.test(cleanPhone(v)); }
  function validEmail(v) { return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function setError(id, on) {
    var f = $(id);
    if (!f) return;
    f.classList.toggle('has-error', on);
    var input = f.querySelector('.input,.textarea,.select');
    if (input) input.classList.toggle('is-error', on);
  }

  /* ---------- 縣市下拉與外島提示 ---------- */
  var ship = C.shipping || {};
  var areaSel = $('area');
  (ship.cities || []).forEach(function (city) {
    var o = document.createElement('option');
    o.value = city; o.textContent = city;
    areaSel.appendChild(o);
  });

  areaSel.addEventListener('change', function () {
    var warn = $('area-warn');
    var ask = (ship.askFirst || []).indexOf(this.value) > -1;
    warn.classList.toggle('hide', !ask);
    if (ask) warn.innerHTML = '<p><strong>' + this.value + '</strong>：' + (ship.askFirstNote || '') + '</p>';
  });

  /* ---------- 未設定 API 的提示 ---------- */
  if (!apiUrl) $('api-warn').classList.remove('hide');

  /* ---------- 純文字版本（給 LINE 用）---------- */
  function toText(d) {
    var L = ['【冰盞紅・團購詢價】'];
    if (d.org) L.push('單位：' + d.org);
    L.push('用途：' + d.usage);
    L.push('預計箱數：' + d.qty + ' 箱（每箱 ' + C.product.perBox + ' 瓶）');
    if (d.when) L.push('希望到貨：' + d.when);
    L.push('配送縣市：' + d.area);
    L.push('聯絡人：' + d.name);
    L.push('電話：' + d.phone);
    if (d.email) L.push('Email：' + d.email);
    if (d.note) L.push('需求說明：' + d.note);
    return L.join('\n');
  }

  function copyToClipboard(text, btn) {
    function done(ok) {
      btn.textContent = ok ? '✓ 已複製，請貼到 LINE 傳送' : '請手動選取內容複製';
      setTimeout(function () { btn.textContent = '送出詢價需求'; btn.disabled = false; }, 4000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else { done(false); }
  }

  /* ---------- 送出 ---------- */
  var submitting = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return;

    var ok = true, first = null;
    function check(id, pass) {
      setError(id, !pass);
      if (!pass) { ok = false; if (!first) first = $(id); }
    }

    var qty = parseInt($('qty').value, 10);
    check('f-usage', !!$('usage').value);
    check('f-qty', !isNaN(qty) && qty >= 1);
    check('f-area', !!areaSel.value);
    check('f-name', $('name').value.trim().length >= 2);
    check('f-phone', validPhone($('phone').value));
    check('f-email', validEmail($('email').value.trim()));

    $('submit-err').style.display = ok ? 'none' : 'block';
    if (!ok) {
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var data = {
      action: 'wholesale',
      org: $('org').value.trim(),
      usage: $('usage').value,
      qty: qty,
      bottles: qty * C.product.perBox,
      when: $('when').value,
      area: areaSel.value,
      name: $('name').value.trim(),
      phone: cleanPhone($('phone').value),
      email: $('email').value.trim(),
      note: $('note').value.trim(),
      website: $('website').value,
      submittedAt: new Date().toISOString()
    };
    if (data.website) return;               // 機器人，靜默忽略

    var btn = $('submit-btn');
    submitting = true;
    btn.disabled = true;

    if (!apiUrl) {
      btn.textContent = '整理中…';
      track('wholesale_manual', { qty: data.qty });
      copyToClipboard(toText(data), btn);
      submitting = false;
      return;
    }

    btn.textContent = '送出中…';
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || res.ok !== true) throw new Error('伺服器回應異常');
        $('ok').classList.remove('hide');
        track('wholesale_inquiry', { qty: data.qty, usage: data.usage });
        btn.textContent = '✓ 已送出，我們會盡快與您聯絡';
        $('ok').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (err) {
        console.error('[冰盞紅] 團購詢價送出失敗：', err);
        submitting = false;
        btn.disabled = false;
        btn.textContent = '送出詢價需求';
        $('submit-err').textContent = '送出失敗，請改用官方 LINE 或電話與我們聯絡，謝謝。';
        $('submit-err').style.display = 'block';
      });
  });
})();
