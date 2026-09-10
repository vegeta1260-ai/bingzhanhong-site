/* ============================================================
   冰盞紅 — 訂購流程
   ------------------------------------------------------------
   計價一律透過 BZHUtil.calc()，避免頁面上出現對不起來的金額。
   訂單送出：
     - config.api.url 有值 → POST 到 Google Apps Script，寫入試算表
     - config.api.url 為空 → 誠實告知尚未啟用，改為整理訂單內容供 LINE 傳送
   ============================================================ */
(function () {
  'use strict';

  var C = window.BZH, U = window.BZHUtil;
  var form = document.getElementById('order-form');
  if (!C || !U || !form) return;

  var state = { plan: null, payment: null };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 產生方案選項 ---------------- */
  function renderPlans() {
    var box = $('plan-opts');
    box.innerHTML = C.plans.map(function (p, i) {
      var badge = p.badge ? '<span class="opt__flag">' + p.badge + '</span>' : '';
      return '' +
        '<label class="opt" data-plan="' + p.id + '">' +
          '<input type="radio" name="plan" value="' + p.id + '">' +
          '<span class="opt__title">' + U.campaignLabel + '｜' + p.title + badge + '</span>' +
          '<span class="opt__meta">' + p.spec + '　･　' + p.note + '</span>' +
          '<span class="opt__price">' + U.money(p.price) + '</span>' +
        '</label>';
    }).join('');
  }

  /* ---------------- 產生付款選項 ---------------- */
  function renderPayments() {
    var box = $('pay-opts');
    box.innerHTML = C.payments.map(function (p) {
      var extra = p.feePerBox
        ? '<span class="opt__meta">每箱加收 ' + U.money(p.feePerBox) + ' ' + (p.feeName || '處理費') + '</span>'
        : '<span class="opt__meta">' + p.desc + '</span>';
      return '' +
        '<label class="opt" data-pay="' + p.id + '">' +
          '<input type="radio" name="payment" value="' + p.id + '">' +
          '<span class="opt__title">' + p.name + '</span>' +
          extra +
        '</label>';
    }).join('');
  }

  /* ---------------- 選取狀態外觀 ---------------- */
  function syncChecked(name) {
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.closest('.opt').classList.toggle('is-checked', input.checked);
    });
  }

  /* ---------------- 步驟指示 ---------------- */
  function syncSteps() {
    var items = document.querySelectorAll('.steps li');
    if (items.length < 3) return;
    var done = [!!state.plan, !!state.payment, !!$('rname').value.trim()];
    items.forEach(function (li, i) {
      li.classList.toggle('is-done', done[i]);
      li.classList.toggle('is-active', !done[i] && (i === 0 || done[i - 1]));
    });
  }

  /* ---------------- 更新金額與摘要 ---------------- */
  function update() {
    var r = state.plan ? U.calc(state.plan, state.payment) : null;

    // 兩箱寄送提醒
    $('two-box-note').classList.toggle('hide', !(r && r.plan.boxes > 1));

    // 付款方式說明
    ['atm', 'linepay', 'cod'].forEach(function (id) {
      var el = $('pay-note-' + id);
      if (el) el.classList.toggle('hide', state.payment !== id);
    });

    var rows = $('summary-rows');
    var bar = $('bar-total');
    var barLabel = $('bar-label');

    if (!r) {
      rows.innerHTML = '<p class="small" style="margin:0">請先於上方選擇購買方案。</p>';
      $('summary-total').textContent = U.money(0);
      $('summary-hint').textContent = '';
      bar.textContent = U.money(0);
      barLabel.textContent = '尚未選擇方案';
      syncSteps();
      return;
    }

    var html = '' +
      row('商品', U.campaignLabel + '｜' + r.plan.title + '（' + r.plan.spec + '）') +
      row('商品金額', U.money(r.goods));
    if (r.fee > 0) html += row(r.feeName || '處理費', '＋ ' + U.money(r.fee) + '（' + U.money(r.payment.feePerBox) + ' × ' + r.plan.boxes + ' 箱）');
    html += row('付款方式', r.payment ? r.payment.name : '尚未選擇');
    html += row('配送方式', C.shipping.method);
    if (r.plan.boxes > 1) html += row('寄送箱數', r.plan.boxes + ' 個獨立冷藏宅配箱');
    if ($('city') && $('city').value) html += row('配送縣市', $('city').value);
    if ($('gift') && $('gift').checked) html += row('送禮', '附上賀卡留言');

    rows.innerHTML = html;
    $('summary-total').textContent = U.money(r.total);
    $('summary-hint').textContent = r.payment && r.payment.id === 'cod'
      ? '此金額為收到商品時應付給宅配人員的金額（已含貨到付款處理費）。'
      : (r.payment ? '請於送出訂單後依畫面指示完成付款。' : '請選擇付款方式，金額才會計算完成。');

    bar.textContent = U.money(r.total);
    barLabel.textContent = r.plan.title + '（' + r.plan.bottles + ' 瓶）' + (r.payment ? '・' + r.payment.short : '');
    syncSteps();
  }

  function row(k, v) {
    return '<div class="summary__row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }

  /* ---------------- 驗證 ---------------- */
  function cleanPhone(v) { return String(v || '').replace(/[^\d]/g, ''); }
  function validPhone(v) { var d = cleanPhone(v); return /^0\d{8,9}$/.test(d); }
  function validEmail(v) { return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function setError(fieldId, on) {
    var f = $(fieldId);
    if (!f) return;
    f.classList.toggle('has-error', on);
    var input = f.querySelector('.input,.textarea,.select');
    if (input) input.classList.toggle('is-error', on);
  }

  function validate(focus) {
    var ok = true, firstBad = null;

    function check(fieldId, pass) {
      setError(fieldId, !pass);
      if (!pass) { ok = false; if (!firstBad) firstBad = $(fieldId); }
    }

    $('plan-err').style.display = state.plan ? 'none' : 'block';
    $('pay-err').style.display = state.payment ? 'none' : 'block';
    if (!state.plan) { ok = false; if (!firstBad) firstBad = $('plan-opts'); }
    if (!state.payment) { ok = false; if (!firstBad) firstBad = $('pay-opts'); }

    check('f-rname', $('rname').value.trim().length >= 2);
    check('f-rphone', validPhone($('rphone').value));
    check('f-city', !!$('city').value);
    check('f-addr', $('addr').value.trim().length >= 6);
    check('f-email', validEmail($('email').value.trim()));

    if (!$('same').checked) {
      check('f-bname', $('bname').value.trim().length >= 2);
      check('f-bphone', validPhone($('bphone').value));
    } else {
      setError('f-bname', false); setError('f-bphone', false);
    }

    $('submit-err').style.display = ok ? 'none' : 'block';
    if (!ok && focus && firstBad) {
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = firstBad.querySelector && firstBad.querySelector('.input,.textarea,.select');
      if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 350);
    }
    return ok;
  }

  /* ---------------- 組成訂單資料 ---------------- */
  function buildPayload() {
    var r = U.calc(state.plan, state.payment);
    var same = $('same').checked;
    return {
      planId: r.plan.id,
      planTitle: U.campaignLabel + '｜' + r.plan.title,
      boxes: r.plan.boxes,
      bottles: r.plan.bottles,
      goods: r.goods,
      fee: r.fee,
      feeName: r.feeName,
      total: r.total,
      paymentId: r.payment.id,
      paymentName: r.payment.name,
      receiverName: $('rname').value.trim(),
      receiverPhone: cleanPhone($('rphone').value),
      city: $('city').value,
      address: $('addr').value.trim().replace(/\s+/g, ' '),
      isGift: $('gift') ? $('gift').checked : false,
      giftMessage: ($('gift') && $('gift').checked && $('giftmsg')) ? $('giftmsg').value.trim() : '',
      buyerName: same ? $('rname').value.trim() : $('bname').value.trim(),
      buyerPhone: same ? cleanPhone($('rphone').value) : cleanPhone($('bphone').value),
      email: $('email').value.trim(),
      note: $('note').value.trim(),
      campaign: U.campaignOn ? C.campaign.label : C.campaign.labelOff,
      website: $('website').value,          // 蜜罐欄位
      submittedAt: new Date().toISOString()
    };
  }

  /* 給客人用 LINE 傳送的純文字訂單（未啟用資料表時使用） */
  function payloadToText(o) {
    var L = [];
    L.push('【冰盞紅・訂購單】');
    L.push('商品：' + o.planTitle + '（' + o.bottles + ' 瓶 / ' + o.boxes + ' 箱）');
    L.push('金額：' + U.money(o.goods));
    if (o.fee > 0) L.push((o.feeName || '處理費') + '：' + U.money(o.fee));
    L.push('應付合計：' + U.money(o.total));
    L.push('付款方式：' + o.paymentName);
    L.push('收件人：' + o.receiverName);
    L.push('收件電話：' + o.receiverPhone);
    L.push('配送地址：' + o.city + ' ' + o.address);
    if (o.isGift) L.push('※ 送禮，賀卡留言：' + (o.giftMessage || '（未填）'));
    if (o.buyerName !== o.receiverName || o.buyerPhone !== o.receiverPhone) {
      L.push('訂購人：' + o.buyerName + '（' + o.buyerPhone + '）');
    }
    if (o.email) L.push('Email：' + o.email);
    if (o.note) L.push('備註：' + o.note);
    return L.join('\n');
  }

  /* ---------------- 送出 ---------------- */
  var submitting = false;

  function submit() {
    if (submitting) return;
    if (!validate(true)) return;

    var payload = buildPayload();
    if (payload.website) return;            // 機器人，靜默忽略

    var btn = $('submit-btn'), barBtn = $('bar-btn');
    submitting = true;
    btn.disabled = true; barBtn.disabled = true;
    btn.textContent = '訂單送出中…請稍候';

    var apiUrl = (C.api && C.api.url) || '';

    if (!apiUrl) {
      // 尚未啟用資料表：不假裝已送出，改交給客人用 LINE 傳送
      payload.saved = false;
      payload.text = payloadToText(payload);
      finish(payload);
      return;
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 避免 CORS 預檢
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error(data && data.message || '伺服器回應異常');
        payload.saved = true;
        payload.orderNo = data.orderNo || '';
        finish(payload);
      })
      .catch(function (err) {
        console.error('[冰盞紅] 訂單送出失敗：', err);
        payload.saved = false;
        payload.failed = true;
        payload.text = payloadToText(payload);
        finish(payload);
      });
  }

  function finish(payload) {
    try { sessionStorage.setItem('bzh_order', JSON.stringify(payload)); } catch (e) {}
    location.href = 'done.html';
  }

  /* ---------------- 縣市下拉與外島提示 ---------------- */
  var ship = C.shipping || {};

  function renderCities() {
    var sel = $('city');
    if (!sel) return;
    (ship.cities || []).forEach(function (city) {
      var o = document.createElement('option');
      o.value = city; o.textContent = city;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      var warn = $('city-warn');
      var ask = (ship.askFirst || []).indexOf(this.value) > -1;
      warn.classList.toggle('hide', !ask);
      if (ask) {
        warn.innerHTML = '<p><strong>' + this.value + '</strong>：' + (ship.askFirstNote || '') + '</p>' +
                         '<p>仍然可以送出訂單，我們會先與您確認可否配送再安排出貨。</p>';
      }
    });
  }

  /* ---------------- 送禮模式 ---------------- */
  function bindGift() {
    var cb = $('gift'), block = $('gift-block'), msg = $('giftmsg'), count = $('giftmsg-count');
    if (!cb || !block) return;
    cb.addEventListener('change', function () {
      block.classList.toggle('hide', !this.checked);
      update();
    });
    if (msg && count) {
      msg.addEventListener('input', function () { count.textContent = this.value.length; });
    }
  }

  /* ---------------- 事件綁定 ---------------- */
  renderPlans();
  renderPayments();
  renderCities();
  bindGift();

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'plan') { state.plan = t.value; syncChecked('plan'); update(); }
    if (t.name === 'payment') { state.payment = t.value; syncChecked('payment'); update(); }
    if (t.id === 'city') update();
    if (t.id === 'same') {
      $('buyer-block').classList.toggle('hide', t.checked);
      if (t.checked) { setError('f-bname', false); setError('f-bphone', false); }
    }
  });

  form.addEventListener('input', function (e) {
    var f = e.target.closest && e.target.closest('.field');
    if (f && f.classList.contains('has-error')) {
      f.classList.remove('has-error');
      e.target.classList.remove('is-error');
    }
    if (e.target.id === 'rname') syncSteps();
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  $('bar-btn').addEventListener('click', submit);

  // 首頁方案卡帶進來的 ?plan=box1 / box2
  var pre = new URLSearchParams(location.search).get('plan');
  if (pre) {
    var input = form.querySelector('input[name="plan"][value="' + pre + '"]');
    if (input) { input.checked = true; state.plan = pre; syncChecked('plan'); }
  }

  // 未設定 API 時，先在表單上告知
  if (!(C.api && C.api.url)) $('api-warn').classList.remove('hide');

  update();
})();
