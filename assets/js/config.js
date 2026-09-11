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
    /* 官方全名。門市「產品特色」與「美味四步飲」兩張海報、以及官方product
       照檔名，都寫「冰盞紅 手作桂花酸梅湯」。桂花是配方裡最上層的香氣，
       名字本身就在說明風味，不該省略。 */
    product: '冰盞紅　手作桂花酸梅湯',
    productShort: '冰盞紅酸梅湯',
    tagline: '台南手作桂花酸梅湯・冷藏宅配'
  },

  /* 兩種瓶。門市與線上規格不同，粉專看到 480ml、網站看到 1000ml 會困惑，
     官方棚拍剛好兩種都有，放在一起對照最清楚。 */
  bottles: {
    solo:  { name: '獨享瓶', volume: '480ml',  where: '門市外帶',   img: 'assets/img/product-solo.jpg' },
    share: { name: '分享瓶', volume: '1000ml', where: '線上訂購',   img: 'assets/img/product-share.jpg' }
  },

  /* ---------- 聯絡方式 ---------- */
  contact: {
    lineId: '@sph0133f',
    lineUrl: 'https://line.me/R/ti/p/@sph0133f',
    telLabel: '訂單專線',      // 業主指定：手機為訂單專線，市話為門市電話
    tel: '0933-661-041',       // 顯示用
    telDial: '0933661041',     // 撥號用（不含符號）
    hours: '週一至週五 10:00–21:00',
    tel2Label: '門市電話',
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
    hours: '週一至週五 10:00–18:00'
  },

  /* ---------- 正式網址 ----------
     上線後填入，例如 'https://bingzhanhong.tw'。
     build.py 會用它產生 sitemap.xml 與 robots.txt。 */
  site: {
    /* GitHub Pages。改用自己的網域時只要換這一行，
       canonical、og:url、og:image、sitemap 會一起跟著換。 */
    url: 'https://vegeta1260-ai.github.io/bingzhanhong-site'
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
    bannerText: '中秋檔期最後下單 9/30（三）23:59，冷藏宅配到府',
    bannerTextOff: '全程冷藏宅配到府',
    deadline: '9/30（三）23:59',  // 中秋前最後下單日
    deliveryWindow: '10/10 前'   // 預計送達區間
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
    bankName: '中國信託銀行',
    bankCode: '822',
    branch: '中華分行',
    account: '440540475140',
    holder: '羅鈞'
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
    leadTime: '訂單確認後 2–3 個工作天出貨',
    areaNote: '本島配送，外島與山區請先詢問',

    /* 冷藏宅配通常無法到外島。選到這些縣市時，訂購頁會當場提示先詢問，
       避免訂單成立後才發現送不到。 */
    /* 指定到貨日：從今天起算的可選範圍。冷藏排程無法保證，所以文案上寫「希望」而非「指定」 */
    arriveMinDays: 3,
    arriveMaxDays: 30,
    /* 可收件的星期。0=日 1=一 … 6=六。業主僅在週二至週六出貨到府，
       週日與週一不收。日期選擇器會擋掉，不是只寫在說明文字裡。 */
    arriveWeekdays: [2, 3, 4, 5, 6],
    arriveWeekdayNote: '可指定的到貨日為<strong>星期二至星期六</strong>，星期日與星期一不配送。',
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
    companyName: '羅鈞',
    /* 業主為免稅籍（營業）登記，沒有統一編號，開立免用統一發票收據。
       taxId 留空時，頁尾會改顯示 taxNote，不會出現空欄。 */
    taxId: '',
    taxNote: '免用統一發票（免稅籍營業登記）',
    foodRegNo: 'D-200158057-00000-8',
    address: '台南市東區崇明二十四街 29 號'
  }
};
