/* ============================================================
   冰盞紅 — 訂單完成頁
   讀取訂購頁存進 sessionStorage 的資料，依「是否真的寫入資料表」
   與「付款方式」顯示不同的下一步。不會在未寫入時謊稱已送出。
   ============================================================ */
(function () {
  'use strict';

  var C = window.BZH, U = window.BZHUtil;
  if (!C || !U) return;

  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { var el = $(id); if (el) el.classList.remove('hide'); };
  var track = function (n, p) { if (U.track) U.track(n, p); };

  var order = null;
  try { order = JSON.parse(sessionStorage.getItem('bzh_order') || 'null'); } catch (e) {}

  /* ---------- 直接開啟本頁（沒有訂單資料）---------- */
  if (!order) {
    $('done-mark').textContent = '？';
    $('done-mark').style.background = 'var(--tan)';
    $('done-title').textContent = '找不到訂單資料';
    $('done-sub').innerHTML = '這個頁面需要從訂購流程進入。<br>如果您剛才已送出訂單，請透過官方 LINE 或電話與我們確認。';
    return;
  }

  /* ---------- 訂單摘要 ---------- */
  function row(k, v) {
    return '<div class="summary__row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }

  var html = '' +
    row('商品', order.planTitle) +
    row('數量', order.bottles + ' 瓶（' + order.boxes + ' 箱）') +
    row('商品金額', U.money(order.goods));
  if (order.fee > 0) html += row(order.feeName || '處理費', '＋ ' + U.money(order.fee));
  html += row('付款方式', order.paymentName);
  html += row('收件人', order.receiverName);
  html += row('收件電話', order.receiverPhone);
  html += row('配送地址', (order.city ? order.city + ' ' : '') + order.address);
  if (order.arriveDate) html += row('希望到貨日', order.arriveDate.replace(/-/g, '/'));
  if (order.isGift) html += row('送禮', order.giftMessage ? '賀卡留言：' + order.giftMessage : '附贈賀卡');
  if (order.boxes > 1) html += row('寄送方式', order.boxes + ' 個獨立冷藏宅配箱');
  if (order.note) html += row('備註', order.note);

  $('recap-rows').innerHTML = html;
  $('recap-total').textContent = U.money(order.total);
  $('recap-total-label').textContent = order.paymentId === 'cod' ? '貨到應付金額' : '應付金額';
  show('recap-block');

  /* ---------- 狀態分流 ---------- */
  if (order.saved) {
    track('order_saved', { payment: order.paymentId, value: order.total, boxes: order.boxes });
    $('done-title').textContent = '訂單已送出';
    $('done-sub').textContent = '感謝您的訂購！我們已收到您的訂單。';
    if (order.orderNo) {
      $('orderno').textContent = order.orderNo;
      show('orderno-box');
    }
  } else {
    // 未寫入資料表：明確告知，不謊稱成功
    track('order_manual', { failed: !!order.failed, payment: order.paymentId });
    $('done-mark').textContent = '！';
    $('done-mark').style.background = 'var(--warm)';
    show('manual-block');

    if (order.failed) {
      $('done-title').textContent = '訂單尚未送出';
      $('done-sub').textContent = '網路連線發生問題，您的訂單還沒有送到我們這裡。';
      $('manual-title').textContent = '請改用 LINE 或電話完成訂購';
      $('manual-desc').textContent = '您填寫的內容已保留在下方，請複製後用官方 LINE 傳給我們，或直接來電，我們會立即為您建立訂單。';
    } else {
      $('done-title').textContent = '請再完成最後一步';
      $('done-sub').textContent = '目前線上訂單系統尚未開通，需要請您把訂單內容傳給我們。';
      $('manual-title').textContent = '訂單內容已為您整理好';
      $('manual-desc').textContent = '請按下「複製訂單內容」，再用官方 LINE 傳送給我們，我們會為您建立訂單並回覆確認。';
    }

    $('manual-text').value = order.text || '';

    $('copy-btn').addEventListener('click', function () {
      var ta = $('manual-text');
      var btn = this;
      track('copy_line_order');
      function done(ok) {
        btn.textContent = ok ? '✓ 已複製，請貼到 LINE 傳送' : '請長按上方文字自行複製';
        setTimeout(function () { btn.textContent = '複製訂單內容'; }, 4000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        ta.removeAttribute('readonly');
        ta.select(); ta.setSelectionRange(0, 99999);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        ta.setAttribute('readonly', 'readonly');
        done(ok);
      }
    });
  }

  /* ---------- 依付款方式顯示下一步 ---------- */
  if (order.paymentId === 'atm') {
    show('next-atm');
    $('atm-amount').textContent = U.money(order.total);
    if (U.isTBD(C.bank.account)) show('bank-tbd');
  } else if (order.paymentId === 'linepay') {
    show('next-linepay');
    $('linepay-amount').textContent = U.money(order.total);
  } else if (order.paymentId === 'cod') {
    show('next-cod');
    $('cod-amount').textContent = U.money(order.total);
  }

  // 佔位圖與連結重新綁定（本頁有動態顯示的區塊）
  U.refresh(document);
})();
