/* ============================================================
   冰盞紅 — 訂購流程
   ------------------------------------------------------------
   計價一律透過 BZHUtil.calc()，避免頁面上出現對不起來的金額。
   訂單送出：
     - config.api.url 有值 → POST 到 Google Apps Script，寫入試算表
     - config.api.url 為空 → 誠實告知尚未啟用，改為整理訂單內容供 LINE 傳送
   送出前有一個「確認資料」步驟：第一次按只放大摘要，第二次才真的送。
   ============================================================ */
(function () {
  'use strict';

  var C = window.BZH, U = window.BZHUtil;
  var form = document.getElementById('order-form');
  if (!C || !U || !form) return;

  var state = { plan: null, payment: null };
  var confirmed = false;
  var submitting = false;

  var $ = function (id) { return document.getElementById(id); };
  var track = function (n, p) { if (U.track) U.track(n, p); };

  /* ---------------- 產生方案選項 ---------------- */
  function renderPlans() {
    $('plan-opts').innerHTML = C.plans.map(function (p) {
      var badge = p.badge ? '<span class="opt__flag">' + p.badge + '</span>' : '';
      return '' +
        '<label class="opt opt--pic" data-plan="' + p.id + '">' +
          '<input type="radio" name="plan" value="' + p.id + '">' +
          (p.img ? '<span class="opt__thumb"><img src="' + p.img + '" alt="' + (p.imgAlt || '') + '" loading="lazy" width="240" height="300"></span>' : '') +
          '<span class="opt__body">' +
          '<span class="opt__title">' + U.campaignLabel + '｜' + p.title + badge + '</span>' +
          '<span class="opt__meta">' + p.spec + '　･　' + p.note + '</span>' +
          '<span class="opt__price">' + U.money(p.price) + '</span>' +
          '</span>' +
        '</label>';
    }).join('');
  }

  /* ---------------- 產生付款選項 ---------------- */
  function renderPayments() {
    $('pay-opts').innerHTML = C.payments.map(function (p) {
      var extra = p.feePerBox
        ? '<span class="opt__meta">每箱加收 ' + U.money(p.feePerBox) + ' ' + (p.feeName || '處理費') + '</span>'
        : '<span class="opt__meta">' + p.desc + '</span>';
      return '' +
        '<label class="opt" data-pay="' + p.id + '">' +
          '<input type="radio" name="payment" value="' + p.id + '">' +
          '<span class="opt__title">' + p.name + '</span>' + extra +
        '</label>';
    }).join('');
  }

  /* ---------------- 縣市／鄉鎮區 ---------------- */
  var ship = C.shipping || {};
  var DIST = window.BZH_DISTRICTS || null;

  function renderCities() {
    var sel = $('city');
    (ship.cities || []).forEach(function (city) {
      var o = document.createElement('option');
      o.value = city; o.textContent = city;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      // 外島提示
      var warn = $('city-warn');
      var ask = (ship.askFirst || []).indexOf(this.value) > -1;
      warn.classList.toggle('hide', !ask);
      if (ask) {
        warn.innerHTML = '<p><strong>' + this.value + '</strong>：' + (ship.askFirstNote || '') + '</p>' +
                         '<p>仍然可以送出訂單，我們會先與您確認可否配送再安排出貨。</p>';
      }
      fillDistricts(this.value);
    });
    if (!DIST) $('f-district').classList.add('hide');
  }

  function fillDistricts(city, keep) {
    var sel = $('district');
    if (!DIST) return;
    var list = DIST[city] || [];
    sel.innerHTML = '<option value="">' + (list.length ? '請選擇' : '請先選擇縣市') + '</option>';
    list.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d; o.textContent = d;
      sel.appendChild(o);
    });
    sel.disabled = !list.length;
    if (keep && list.indexOf(keep) > -1) sel.value = keep;
  }

  /* ---------------- 電話即時提示 ---------------- */
  function cleanPhone(v) { return String(v || '').replace(/[^\d]/g, ''); }
  function validPhone(v) { return /^0\d{8,9}$/.test(cleanPhone(v)); }
  function validEmail(v) { return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function phoneHint(input, fieldId) {
    var f = $(fieldId);
    var hint = f.querySelector('.field__hint');
    var ok = f.querySelector('.field__ok');
    var d = cleanPhone(input.value);
    var base = hint ? (hint.getAttribute('data-base') || '') : '';

    function normal(msg) { f.classList.remove('is-ok'); if (hint) hint.textContent = msg || base; }
    function good(msg) { f.classList.add('is-ok'); if (ok) ok.textContent = msg; }

    if (!d) { normal(); return; }
    if (/^09/.test(d)) {
      if (d.length < 10) normal('手機號碼共 10 碼，還差 ' + (10 - d.length) + ' 碼');
      else if (d.length === 10) good('✓ 手機號碼格式正確');
      else normal('號碼多了 ' + (d.length - 10) + ' 碼，請檢查');
    } else if (/^0/.test(d)) {
      if (d.length >= 9 && d.length <= 10) good('✓ 市話格式正確');
      else normal('市話請含區碼，共 9–10 碼');
    } else {
      normal('電話號碼請以 0 開頭');
    }
  }

  /* ---------------- 送禮模式 ---------------- */
  function bindGift() {
    var cb = $('gift'), block = $('gift-block'), msg = $('giftmsg'), count = $('giftmsg-count');
    cb.addEventListener('change', function () {
      block.classList.toggle('hide', !this.checked);
      update();
    });
    msg.addEventListener('input', function () { count.textContent = this.value.length; });
    if (new URLSearchParams(location.search).get('gift') === '1') {
      cb.checked = true;
      block.classList.remove('hide');
    }
  }

  /* ---------------- 記住收件資料（只存本機）---------------- */
  var REM_KEY = 'bzh-remember';

  function readRemembered() {
    try { return JSON.parse(localStorage.getItem(REM_KEY) || 'null'); } catch (e) { return null; }
  }

  function bindRemember() {
    if (!(C.remember && C.remember.enabled)) return;
    var d = readRemembered();
    var bar = $('remember-bar');
    if (!d || !d.rname) return;
    $('remember-summary').textContent = d.rname + '・' + (d.city || '') + (d.district || '');
    bar.classList.remove('hide');

    $('remember-fill').addEventListener('click', function () {
      $('rname').value = d.rname || '';
      $('rphone').value = d.rphone || '';
      $('city').value = d.city || '';
      $('city').dispatchEvent(new Event('change', { bubbles: true }));
      fillDistricts(d.city || '', d.district || '');
      $('addr').value = d.addr || '';
      $('email').value = d.email || '';
      $('remember').checked = true;
      phoneHint($('rphone'), 'f-rphone');
      bar.classList.add('hide');
      update();
      U.toast('已帶入上次的收件資料');
      track('remember_fill');
    });
    $('remember-clear').addEventListener('click', function () {
      try { localStorage.removeItem(REM_KEY); } catch (e) {}
      bar.classList.add('hide');
      U.toast('已清除儲存的收件資料');
    });
  }

  function saveRemembered() {
    try {
      if ($('remember').checked) {
        localStorage.setItem(REM_KEY, JSON.stringify({
          rname: $('rname').value.trim(),
          rphone: cleanPhone($('rphone').value),
          city: $('city').value,
          district: DIST ? $('district').value : '',
          addr: $('addr').value.trim(),
          email: $('email').value.trim()
        }));
      } else {
        localStorage.removeItem(REM_KEY);
      }
    } catch (e) {}
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
  function row(k, v) {
    return '<div class="summary__row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }

  function update() {
    var r = state.plan ? U.calc(state.plan, state.payment) : null;

    $('two-box-note').classList.toggle('hide', !(r && r.plan.boxes > 1));
    ['atm', 'linepay', 'cod'].forEach(function (id) {
      $('pay-note-' + id).classList.toggle('hide', state.payment !== id);
    });

    var rows = $('summary-rows'), bar = $('bar-total'), barLabel = $('bar-label');

    if (!r) {
      rows.innerHTML = '<p class="small" style="margin:0">請先於上方選擇購買方案。</p>';
      $('summary-total').textContent = U.money(0);
      $('summary-hint').textContent = '';
      bar.textContent = U.money(0);
      barLabel.textContent = '尚未選擇方案';
      syncSteps();
      return;
    }

    var html = row('商品', U.campaignLabel + '｜' + r.plan.title + '（' + r.plan.spec + '）') +
               row('商品金額', U.money(r.goods));
    if (r.fee > 0) html += row(r.feeName || '處理費', '＋ ' + U.money(r.fee) + '（' + U.money(r.payment.feePerBox) + ' × ' + r.plan.boxes + ' 箱）');
    html += row('付款方式', r.payment ? r.payment.name : '尚未選擇');
    html += row('配送方式', C.shipping.method);
    if (r.plan.boxes > 1) html += row('寄送箱數', r.plan.boxes + ' 個獨立冷藏宅配箱');
    var addrLine = [$('city').value, DIST ? $('district').value : '', $('addr').value.trim()].filter(Boolean).join(' ');
    if (addrLine) html += row('配送地址', addrLine);
    if ($('rname').value.trim()) html += row('收件人', $('rname').value.trim() + (validPhone($('rphone').value) ? '　' + cleanPhone($('rphone').value) : ''));
    if ($('gift').checked) html += row('送禮', '附上賀卡留言');

    rows.innerHTML = html;
    $('summary-total').textContent = U.money(r.total);
    $('summary-hint').textContent = r.payment && r.payment.id === 'cod'
      ? '此金額為收到商品時應付給宅配人員的金額（已含貨到付款處理費）。'
      : (r.payment ? '請於送出訂單後依畫面指示完成付款。' : '請選擇付款方式，金額才會計算完成。');

    bar.textContent = U.money(r.total);
    barLabel.textContent = r.plan.title + '（' + r.plan.bottles + ' 瓶）' + (r.payment ? '・' + r.payment.short : '');
    syncSteps();
  }

  /* ---------------- 驗證 ---------------- */
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
    if (DIST) check('f-district', !!$('district').value);
    check('f-addr', $('addr').value.trim().length >= 4);
    check('f-email', validEmail($('email').value.trim()));
    check('f-arrive', arriveValid());

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

  /* ---------------- 確認步驟 ---------------- */
  function setConfirmUI(on) {
    confirmed = on;
    $('summary').classList.toggle('is-confirm', on);
    $('submit-btn').textContent = on ? '資料無誤，送出訂單' : '確認訂單內容';
    $('bar-btn').textContent = on ? '送出訂單' : '確認訂單';
  }

  /* ---------------- 組成訂單資料 ---------------- */
  function buildPayload() {
    var r = U.calc(state.plan, state.payment);
    var same = $('same').checked;
    var district = DIST ? $('district').value : '';
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
      district: district,
      address: (district ? district + ' ' : '') + $('addr').value.trim().replace(/\s+/g, ' '),
      arriveDate: ($('arrive') && $('arrive').value) || '',
      isGift: $('gift').checked,
      giftMessage: $('gift').checked ? $('giftmsg').value.trim() : '',
      buyerName: same ? $('rname').value.trim() : $('bname').value.trim(),
      buyerPhone: same ? cleanPhone($('rphone').value) : cleanPhone($('bphone').value),
      email: $('email').value.trim(),
      note: $('note').value.trim(),
      campaign: U.campaignOn ? C.campaign.label : C.campaign.labelOff,
      website: $('website').value,
      submittedAt: new Date().toISOString()
    };
  }

  function payloadToText(o) {
    var L = ['【冰盞紅・訂購單】'];
    L.push('商品：' + o.planTitle + '（' + o.bottles + ' 瓶 / ' + o.boxes + ' 箱）');
    L.push('金額：' + U.money(o.goods));
    if (o.fee > 0) L.push((o.feeName || '處理費') + '：' + U.money(o.fee));
    L.push('應付合計：' + U.money(o.total));
    L.push('付款方式：' + o.paymentName);
    L.push('收件人：' + o.receiverName);
    L.push('收件電話：' + o.receiverPhone);
    L.push('配送地址：' + o.city + ' ' + o.address);
    if (o.arriveDate) L.push('希望到貨日：' + o.arriveDate.replace(/-/g, '/'));
    if (o.isGift) L.push('※ 送禮，賀卡留言：' + (o.giftMessage || '（未填）'));
    if (o.buyerName !== o.receiverName || o.buyerPhone !== o.receiverPhone) {
      L.push('訂購人：' + o.buyerName + '（' + o.buyerPhone + '）');
    }
    if (o.email) L.push('Email：' + o.email);
    if (o.note) L.push('備註：' + o.note);
    return L.join('\n');
  }

  /* ---------------- 送出 ---------------- */
  function submit() {
    if (submitting) return;
    if (!validate(true)) { setConfirmUI(false); return; }

    // 第一次按：只放大摘要讓客人再看一次
    if (!confirmed) {
      setConfirmUI(true);
      $('summary').scrollIntoView({ behavior: 'smooth', block: 'center' });
      track('confirm_order', { plan: state.plan, payment: state.payment });
      return;
    }

    var payload = buildPayload();
    if (payload.website) return;

    var btn = $('submit-btn'), barBtn = $('bar-btn');
    submitting = true;
    btn.disabled = true; barBtn.disabled = true;
    btn.textContent = '訂單送出中…請稍候';
    saveRemembered();
    track('submit_order', { plan: payload.planId, payment: payload.paymentId, value: payload.total, gift: payload.isGift });

    var apiUrl = (C.api && C.api.url) || '';
    if (!apiUrl) {
      payload.saved = false;
      payload.text = payloadToText(payload);
      finish(payload);
      return;
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error((data && data.message) || '伺服器回應異常');
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

  /* ---------------- 希望到貨日 ---------------- */
  // 只用本地時間組 yyyy-mm-dd，避免 toISOString() 因時區把日期退一天
  function ymd(d) {
    return d.getFullYear() + '-' +
           ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
           ('0' + d.getDate()).slice(-2);
  }
  function arriveBounds() {
    var sp = C.shipping || {};
    var lo = new Date(), hi = new Date();
    lo.setDate(lo.getDate() + (sp.arriveMinDays || 3));
    hi.setDate(hi.getDate() + (sp.arriveMaxDays || 30));
    return { lo: ymd(lo), hi: ymd(hi) };
  }
  function setupArrive() {
    var el = $('arrive');
    if (!el) return;
    var b = arriveBounds();
    el.min = b.lo; el.max = b.hi;
    var label = $('arrive-range');
    if (label) label.textContent = b.lo.replace(/-/g, '/') + ' 至 ' + b.hi.replace(/-/g, '/');
  }
  function arriveValid() {
    var el = $('arrive');
    if (!el) return true;
    var v = el.value;
    if (!v) return true;                 // 選填，空白代表不指定
    var b = arriveBounds();
    return v >= b.lo && v <= b.hi;
  }

  /* ---------------- 事件綁定 ---------------- */
  renderPlans();
  renderPayments();
  renderCities();
  setupArrive();
  bindGift();
  bindRemember();

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (confirmed) setConfirmUI(false);
    if (t.name === 'plan') { state.plan = t.value; syncChecked('plan'); update(); track('select_plan', { plan: t.value }); }
    if (t.name === 'payment') { state.payment = t.value; syncChecked('payment'); update(); track('select_payment', { payment: t.value }); }
    if (t.id === 'city' || t.id === 'district') update();
    if (t.id === 'same') {
      $('buyer-block').classList.toggle('hide', t.checked);
      if (t.checked) { setError('f-bname', false); setError('f-bphone', false); }
    }
  });

  form.addEventListener('input', function (e) {
    var t = e.target;
    if (confirmed) setConfirmUI(false);
    var f = t.closest && t.closest('.field');
    if (f && f.classList.contains('has-error')) {
      f.classList.remove('has-error');
      t.classList.remove('is-error');
    }
    if (t.id === 'rphone') phoneHint(t, 'f-rphone');
    if (t.id === 'bphone') phoneHint(t, 'f-bphone');
    if (t.id === 'rname' || t.id === 'addr') update();
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  $('bar-btn').addEventListener('click', submit);

  // 首頁方案卡帶進來的 ?plan=box1 / box2
  var pre = new URLSearchParams(location.search).get('plan');
  if (pre) {
    var input = form.querySelector('input[name="plan"][value="' + pre + '"]');
    if (input) { input.checked = true; state.plan = pre; syncChecked('plan'); }
  }

  if (!(C.api && C.api.url)) $('api-warn').classList.remove('hide');

  update();
})();
