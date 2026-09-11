/* ============================================================
   冰盞紅 — 全站設定檔
   ------------------------------------------------------------
   ★ 要改價格、聯絡方式、活動文案，全部在這個檔案改。
     改一處，首頁 / 訂購頁 / 完成頁 會一起更新，不會漏改。
   ★ 標示 [待確認] 的欄位，請在正式上線前替換成真實資料。
   ============================================================ */

window.BZH = {

  /* ---------- 品牌 ---------- */
  brand: {
    name: '冰盞紅',
    product: '冰盞紅酸梅湯',
    tagline: '台南手作酸梅湯・冷藏宅配'
  },

  /* ---------- 聯絡方式 ---------- */
  contact: {
    lineId: '@sph0133f',
    lineUrl: 'https://line.me/R/ti/p/@sph0133f',
    tel: '0933-661-041',       // 顯示用
    telDial: '0933661041',     // 撥號用（不含符號）
    hours: '[待確認] 例：每日 10:00–20:00',
    tel2: '06-290-8018',        // 門市市話（粉專公開資訊）
    tel2Dial: '062908018'
  },

  /* ---------- 門市（粉專公開資訊）---------- */
  store: {
    name: '冰盞紅 酸梅湯專賣',
    address: '台南市東區崇明二十四街 29 號',
    postal: '70171',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8D%97%E5%B8%82%E6%9D%B1%E5%8D%80%E5%B4%87%E6%98%8E%E4%BA%8C%E5%8D%81%E5%9B%9B%E8%A1%9729%E8%99%9F',
    services: '外帶・外送・網路預約',
    hours: '[待確認]'
  },

  /* ---------- 正式網址 ----------
     上線後填入，例如 'https://bingzhanhong.tw'。
     build.py 會用它產生 sitemap.xml 與 robots.txt。 */
  site: {
    url: ''
  },

  /* ---------- 流量分析 ----------
     填入 GA4 評估 ID（例如 'G-XXXXXXXXXX'）才會載入 Google Analytics。
     留空 = 完全不載入，隱私權頁也會維持「不使用第三方追蹤」的說法。 */
  analytics: {
    ga4: ''
  },

  /* ---------- 檔期活動 ----------
     中秋檔期結束後，只要把 enabled 改成 false，
     全站文案會自動從「中秋分享箱」切換為常態版「冷藏分享箱」。 */
  campaign: {
    enabled: true,
    label: '中秋分享箱',
    labelOff: '冷藏分享箱',
    heroTitle: '今年中秋，冰箱裡也準備一箱。',
    heroTitleOff: '冰箱裡常備一箱，吃飯配一杯。',
    bannerText: '中秋出貨檔期 [待確認]，冷藏宅配到府',
    bannerTextOff: '全程冷藏宅配到府',
    deadline: '[待確認]',        // 中秋前最後下單日，例：'9/28（日）23:59'
    deliveryWindow: '[待確認]'   // 預計送達區間，例：'10/1–10/4'
  },

  /* ---------- 產品規格 ---------- */
  product: {
    volume: '1000ml',
    perBox: 12,                    // 一箱瓶數
    shelfLifeDays: 10,
    singleRefPrice: 120,           // 單瓶零售參考價（非主力方案）
    ingredients: ['山楂', '烏梅', '洛神', '陳皮', '甘草', '桂花', '梅乾', '冰糖']
  },

  /* ---------- 購買方案 ----------
     price 是商品金額，不含貨到付款處理費。 */
  plans: [
    {
      id: 'box1',
      boxes: 1,
      bottles: 12,
      price: 1490,
      title: '1 箱',
      spec: '1000ml × 12 瓶',
      note: '一個冷藏宅配箱',
      img: 'assets/img/scene-fridge.jpg',
      imgAlt: '冰箱裡常備一箱'
    },
    {
      id: 'box2',
      boxes: 2,
      bottles: 24,
      price: 2880,
      title: '2 箱',
      spec: '1000ml × 12 瓶 × 2 箱',
      note: '分成兩個冷藏宅配箱寄送',
      img: 'assets/img/scene-party.jpg',
      imgAlt: '聚餐時整瓶端上桌',
      badge: '兩箱更划算'
    }
  ],

  /* ---------- 付款方式 ---------- */
  payments: [
    {
      id: 'atm',
      name: 'ATM／網路銀行轉帳',
      short: 'ATM 轉帳',
      desc: '下單後顯示轉帳資訊，轉帳完成後回報後 5 碼即可。',
      feePerBox: 0
    },
    {
      id: 'linepay',
      name: 'LINE Pay 掃碼付款',
      short: 'LINE Pay',
      desc: '下單後掃描 LINE Pay QR Code 完成付款。',
      feePerBox: 0
    },
    {
      id: 'cod',
      name: '貨到付款',
      short: '貨到付款',
      desc: '收到商品時付款，每箱加收 30 元處理費。',
      feePerBox: 30,
      feeName: '貨到付款處理費'
    }
  ],

  /* ---------- 匯款帳戶（ATM）----------
     ★ 上線前務必替換。留 [待確認] 時，頁面會顯示「請透過 LINE 索取」 */
  bank: {
    bankName: '[待確認] 銀行名稱',
    bankCode: '[待確認]',
    branch: '[待確認] 分行',
    account: '[待確認] 帳號',
    holder: '[待確認] 戶名'
  },

  /* ---------- LINE Pay QR Code ----------
     把圖片放到 assets/img/linepay-qr.png 即可自動顯示。 */
  linePayQr: 'assets/img/linepay-qr.png',

  /* ---------- 官方 LINE 加好友 QR Code ----------
     從 LINE 官方帳號管理後台下載，放到 assets/img/line-qr.png。
     桌機使用者會在訂單完成頁看到它（手機直接點連結）。 */
  lineQr: 'assets/img/line-qr.png',

  /* ---------- 供貨狀態 ----------
     手工小批次一定會遇到來不及做。改這裡的 status 即可，全站自動反應：
       'open'     正常接單
       'preorder' 本批售完，開放預購（訂購功能照常運作，加註提示）
       'closed'   暫停接單（訂購按鈕改成 LINE 詢問，表單停用） */
  stock: {
    status: 'open',
    preorderNote: '本批已額滿，目前開放預購。預計出貨時間 [待確認]，下單後我們會以 LINE 或電話與您確認。',
    closedNote: '目前暫停接單。歡迎加入官方 LINE，下一批開賣會第一時間通知您。'
  },

  /* ---------- 配送 ---------- */
  shipping: {
    method: '全程冷藏宅配到府',
    leadTime: '[待確認] 例：訂單確認後 2–3 個工作天出貨',
    areaNote: '[待確認] 例：本島配送，外島與部分山區請先詢問',

    /* 冷藏宅配通常無法到外島。選到這些縣市時，訂購頁會當場提示先詢問，
       避免訂單成立後才發現送不到。 */
    /* 指定到貨日：從今天起算的可選範圍。冷藏排程無法保證，所以文案上寫「希望」而非「指定」 */
    arriveMinDays: 3,
    arriveMaxDays: 30,
    arriveNote: '冷藏配送依當批熬煮與宅配排程出貨，我們會盡量配合，但無法保證一定於當日送達。',

    askFirst: ['澎湖縣', '金門縣', '連江縣'],
    askFirstNote: '冷藏宅配可能無法配送至此地區。請先透過官方 LINE 或電話與我們確認，再完成訂購。',
    remoteNote: '部分山區、離島與偏遠地區可能無法配送或需較長時間，我們會在確認訂單時與您聯絡。',

    /* 訂購頁的縣市下拉選單 */
    cities: [
      '基隆市', '臺北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
      '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣',
      '臺南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣',
      '澎湖縣', '金門縣', '連江縣'
    ]
  },

  /* ---------- 送禮模式 ---------- */
  gift: {
    enabled: true,
    cardMaxLength: 60,
    note: '勾選後，我們會在出貨時附上您的祝福留言，並且不會在包裹外露出金額相關單據。'
  },

  /* ---------- 記住收件資料 ----------
     客人勾選後把收件資料存在自己的裝置（localStorage），不會上傳。 */
  remember: {
    enabled: true
  },

  /* ---------- 訂單系統 ----------
     ★ 部署 google-apps-script/Code.gs 後，把網頁應用程式網址貼在這裡。
       空字串 = 尚未啟用，網站會誠實告知客人改用 LINE 下單，不會假裝已送出。 */
  api: {
    url: ''
  },

  /* ---------- 公司資訊（頁尾）---------- */
  legal: {
    companyName: '[待確認]',
    taxId: '[待確認] 統一編號',
    foodRegNo: '[待確認] 食品業者登錄字號',
    address: '[待確認]'
  }
};
