/**
 * ============================================================
 * 冰盞紅 — 訂單接收後端（Google Apps Script）
 * ------------------------------------------------------------
 * 用途：把網站訂單寫入 Google 試算表，並支援付款回報與訂單查詢。
 *
 * 安裝步驟請見專案根目錄的 README.md「第 2 步：開通訂單系統」。
 * ============================================================
 */

/** 通知信箱：填入後每筆新訂單會寄一封通知信。留空則不寄。 */
var NOTIFY_EMAIL = '';

/** 工作表名稱 */
var SHEET_ORDERS    = '訂單';
var SHEET_REPORTS   = '付款回報';
var SHEET_WHOLESALE = '團購詢價';

/** 訂單編號前綴 */
var ORDER_PREFIX = 'BZH';

/** 訂單表欄位（順序即為試算表欄位順序，請勿隨意調換） */
var ORDER_HEADERS = [
  '訂單編號', '訂購日期', '訂購人', '訂購人電話',
  '收件人', '收件人電話', '配送縣市', '配送地址', 'Email',
  '方案', '箱數', '瓶數',
  '商品金額', '處理費', '訂單金額',
  '付款方式', '付款狀態', '訂單狀態',
  '備註', '送禮', '賀卡留言', '檔期', '建立時間'
];

var REPORT_HEADERS = [
  '回報時間', '訂單編號', '聯絡電話', '付款方式', '帳號後5碼', '付款日期', '補充說明', '處理狀態'
];

var WHOLESALE_HEADERS = [
  '詢價時間', '單位／公司', '用途', '預計箱數', '瓶數', '希望到貨日',
  '配送縣市', '聯絡人', '電話', 'Email', '需求說明', '處理狀態'
];

var ORDER_STATUSES   = ['待確認', '備貨中', '已出貨', '已完成', '已取消'];
var PAYMENT_STATUSES = ['待付款', '待核對', '已付款', '貨到付款', '未完成'];


/* ============================================================
   一次性設定：在編輯器選擇 setup 後按「執行」，建立工作表與標題列
   ============================================================ */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var orders = ss.getSheetByName(SHEET_ORDERS) || ss.insertSheet(SHEET_ORDERS);
  if (orders.getLastRow() === 0) {
    orders.appendRow(ORDER_HEADERS);
  }
  orders.setFrozenRows(1);
  orders.getRange(1, 1, 1, ORDER_HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#F4EDE2');

  // 付款狀態 / 訂單狀態 下拉選單，方便手動更新
  var lastRow = Math.max(orders.getMaxRows(), 500);
  applyDropdown_(orders, ORDER_HEADERS.indexOf('付款狀態') + 1, lastRow, PAYMENT_STATUSES);
  applyDropdown_(orders, ORDER_HEADERS.indexOf('訂單狀態') + 1, lastRow, ORDER_STATUSES);

  var reports = ss.getSheetByName(SHEET_REPORTS) || ss.insertSheet(SHEET_REPORTS);
  if (reports.getLastRow() === 0) {
    reports.appendRow(REPORT_HEADERS);
  }
  reports.setFrozenRows(1);
  reports.getRange(1, 1, 1, REPORT_HEADERS.length)
         .setFontWeight('bold')
         .setBackground('#F4EDE2');
  applyDropdown_(reports, REPORT_HEADERS.indexOf('處理狀態') + 1, lastRow, ['未處理', '已核對', '查無款項']);

  var wholesale = ss.getSheetByName(SHEET_WHOLESALE) || ss.insertSheet(SHEET_WHOLESALE);
  if (wholesale.getLastRow() === 0) {
    wholesale.appendRow(WHOLESALE_HEADERS);
  }
  wholesale.setFrozenRows(1);
  wholesale.getRange(1, 1, 1, WHOLESALE_HEADERS.length)
           .setFontWeight('bold')
           .setBackground('#F4EDE2');
  applyDropdown_(wholesale, WHOLESALE_HEADERS.indexOf('處理狀態') + 1, lastRow,
                 ['未處理', '已報價', '已成交', '未成交']);

  SpreadsheetApp.getUi().alert('設定完成，已建立「訂單」「付款回報」「團購詢價」三個工作表。');
}

function applyDropdown_(sheet, col, lastRow, values) {
  if (col < 1) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).build();
  sheet.getRange(2, col, lastRow - 1, 1).setDataValidation(rule);
}


/* ============================================================
   前端呼叫入口
   ============================================================ */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // 蜜罐欄位有值 = 機器人，直接回成功但不寫入
    if (body.website) return json({ ok: true, orderNo: '' });

    switch (body.action) {
      case 'report':    return json(handleReport_(body));
      case 'lookup':    return json(handleLookup_(body));
      case 'wholesale': return json(handleWholesale_(body));
      default:       return json(handleOrder_(body));
    }
  } catch (err) {
    return json({ ok: false, message: String(err) });
  }
}

function doGet() {
  return json({ ok: true, service: '冰盞紅訂單系統', time: new Date().toISOString() });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================
   建立訂單
   ============================================================ */
function handleOrder_(d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);                      // 避免同時下單拿到相同編號
  try {
    var sheet = mustSheet_(SHEET_ORDERS, ORDER_HEADERS);
    var now = new Date();
    var tz = Session.getScriptTimeZone() || 'Asia/Taipei';
    var orderNo = nextOrderNo_(sheet, now, tz);

    var paymentStatus = (d.paymentId === 'cod') ? '貨到付款' : '待付款';

    sheet.appendRow([
      orderNo,
      Utilities.formatDate(now, tz, 'yyyy/MM/dd HH:mm'),
      d.buyerName || '',
      asText_(d.buyerPhone),
      d.receiverName || '',
      asText_(d.receiverPhone),
      d.city || '',
      d.address || '',
      d.email || '',
      d.planTitle || '',
      d.boxes || '',
      d.bottles || '',
      d.goods || 0,
      d.fee || 0,
      d.total || 0,
      d.paymentName || '',
      paymentStatus,
      '待確認',
      d.note || '',
      d.isGift ? '是' : '',
      d.giftMessage || '',
      d.campaign || '',
      now
    ]);

    notify_(orderNo, d);
    return { ok: true, orderNo: orderNo };
  } finally {
    lock.releaseLock();
  }
}

/** 產生當日流水號：BZH-20260910-001 */
function nextOrderNo_(sheet, now, tz) {
  var datePart = Utilities.formatDate(now, tz, 'yyyyMMdd');
  var prefix = ORDER_PREFIX + '-' + datePart + '-';
  var last = sheet.getLastRow();
  var seq = 0;

  if (last > 1) {
    // 只往回看 200 列即可，足夠涵蓋單日訂單量
    var from = Math.max(2, last - 200);
    var values = sheet.getRange(from, 1, last - from + 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var v = String(values[i][0] || '');
      if (v.indexOf(prefix) === 0) {
        var n = parseInt(v.substring(prefix.length), 10);
        if (!isNaN(n) && n > seq) seq = n;
      }
    }
  }
  return prefix + ('00' + (seq + 1)).slice(-3);
}

/** 電話與後 5 碼要保留開頭的 0，強制以文字儲存 */
function asText_(v) {
  var s = String(v == null ? '' : v);
  return s ? "'" + s : '';
}


/* ============================================================
   付款回報
   ============================================================ */
function handleReport_(d) {
  var sheet = mustSheet_(SHEET_REPORTS, REPORT_HEADERS);
  var tz = Session.getScriptTimeZone() || 'Asia/Taipei';

  sheet.appendRow([
    Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd HH:mm'),
    d.orderNo || '',
    asText_(d.phone),
    d.methodName || d.method || '',
    asText_(d.last5),
    d.paidAt || '',
    d.note || '',
    '未處理'
  ]);

  // 找得到對應訂單時，順手把付款狀態改成「待核對」
  if (d.orderNo) {
    var orders = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
    if (orders) {
      var found = findOrderRow_(orders, d.orderNo, d.phone);
      if (found) {
        var col = ORDER_HEADERS.indexOf('付款狀態') + 1;
        var current = orders.getRange(found.row, col).getValue();
        if (current === '待付款') orders.getRange(found.row, col).setValue('待核對');
      }
    }
  }

  if (NOTIFY_EMAIL) {
    MailApp.sendEmail(NOTIFY_EMAIL, '【冰盞紅】付款回報 ' + (d.orderNo || ''),
      '訂單編號：' + (d.orderNo || '（未填）') +
      '\n電話：' + (d.phone || '') +
      '\n付款方式：' + (d.methodName || '') +
      '\n後 5 碼：' + (d.last5 || '') +
      '\n付款日期：' + (d.paidAt || '') +
      '\n說明：' + (d.note || ''));
  }

  return { ok: true };
}


/* ============================================================
   團購・企業訂購詢價
   ============================================================ */
function handleWholesale_(d) {
  var sheet = mustSheet_(SHEET_WHOLESALE, WHOLESALE_HEADERS);
  var tz = Session.getScriptTimeZone() || 'Asia/Taipei';

  sheet.appendRow([
    Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd HH:mm'),
    d.org || '',
    d.usage || '',
    d.qty || '',
    d.bottles || '',
    d.when || '',
    d.area || '',
    d.name || '',
    asText_(d.phone),
    d.email || '',
    d.note || '',
    '未處理'
  ]);

  if (NOTIFY_EMAIL) {
    MailApp.sendEmail(NOTIFY_EMAIL, '【冰盞紅】團購詢價 ' + (d.org || d.name || ''),
      '單位：' + (d.org || '（個人）') +
      '
用途：' + (d.usage || '') +
      '
箱數：' + (d.qty || '') +
      '
希望到貨：' + (d.when || '') +
      '
配送縣市：' + (d.area || '') +
      '
聯絡人：' + (d.name || '') + '　' + (d.phone || '') +
      '
Email：' + (d.email || '') +
      '
說明：' + (d.note || ''));
  }

  return { ok: true };
}


/* ============================================================
   訂單查詢（需訂單編號 + 電話一致，避免任意查詢他人訂單）
   ============================================================ */
function handleLookup_(d) {
  var orders = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!orders) return { ok: false, message: '尚未建立訂單工作表' };

  var found = findOrderRow_(orders, d.orderNo, d.phone);
  if (!found) return { ok: true, order: null };

  var r = found.values;
  function col(name) { return r[ORDER_HEADERS.indexOf(name)]; }

  return {
    ok: true,
    order: {
      orderNo: String(col('訂單編號')),
      orderedAt: String(col('訂購日期')),
      planTitle: String(col('方案')),
      total: Number(col('訂單金額')) || 0,
      paymentName: String(col('付款方式')),
      paymentStatus: String(col('付款狀態')),
      orderStatus: String(col('訂單狀態'))
    }
  };
}

function findOrderRow_(sheet, orderNo, phone) {
  var last = sheet.getLastRow();
  if (last < 2) return null;

  var data = sheet.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues();
  var noIdx = ORDER_HEADERS.indexOf('訂單編號');
  var bpIdx = ORDER_HEADERS.indexOf('訂購人電話');
  var rpIdx = ORDER_HEADERS.indexOf('收件人電話');
  var wantNo = String(orderNo || '').trim().toUpperCase();
  var wantPhone = digits_(phone);

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[noIdx]).trim().toUpperCase() !== wantNo) continue;
    if (wantPhone) {
      var ok = digits_(row[bpIdx]) === wantPhone || digits_(row[rpIdx]) === wantPhone;
      if (!ok) continue;
    }
    return { row: i + 2, values: row };
  }
  return null;
}

function digits_(v) {
  return String(v == null ? '' : v).replace(/[^\d]/g, '');
}


/* ============================================================
   共用
   ============================================================ */
function mustSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notify_(orderNo, d) {
  if (!NOTIFY_EMAIL) return;
  var lines = [
    '訂單編號：' + orderNo,
    '方案：' + (d.planTitle || '') + '（' + (d.bottles || '') + ' 瓶 / ' + (d.boxes || '') + ' 箱）',
    '金額：' + (d.total || 0),
    '付款方式：' + (d.paymentName || ''),
    '收件人：' + (d.receiverName || '') + '　' + (d.receiverPhone || ''),
    '地址：' + (d.address || ''),
    '訂購人：' + (d.buyerName || '') + '　' + (d.buyerPhone || ''),
    'Email：' + (d.email || ''),
    '備註：' + (d.note || '')
  ];
  MailApp.sendEmail(NOTIFY_EMAIL, '【冰盞紅】新訂單 ' + orderNo, lines.join('\n'));
}
