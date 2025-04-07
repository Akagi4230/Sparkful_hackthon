const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL 連線設定
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Ray_930715',
  database: 'credit_card_optimizer'
});

db.connect(err => {
  if (err) {
    console.error('MySQL 連接失敗:', err);
    return;
  }
  console.log('✅ MySQL 連接成功');
});

// 匯率
const USD_TO_TWD = 32.3;

// 網站判斷
function detectSite(url) {
  try {
    const hostname = new URL(url).hostname;
    if (!hostname) return 'unknown';
    if (hostname.includes('pchome.com.tw')) return 'pchome';
    if (hostname.includes('amazon.')) return 'amazon';
    if (hostname.includes('momoshop.com.tw')) return 'momo';
    if (hostname.includes('books.com.tw')) return 'books';
    if (hostname.includes('coupang.com')) return 'coupang';
    return 'unknown';
  } catch (e) {
    console.error(`❌ URL 解析失敗：${e.message}`);
    return 'unknown';
  }
}

// PChome 價格擷取（使用 axios 和 cheerio）
async function scrapePricePchome(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const $ = cheerio.load(response.data);
    const discountPriceTag = $('div.o-prodPrice__price').text().trim();
    if (!discountPriceTag) {
      console.error('❌ PChome 價格標籤未找到');
      return ["找不到", "TWD", 0.0];
    }
    const discountPrice = discountPriceTag;
    const currency = "TWD";
    const twdPrice = parseFloat(discountPrice.replace("$", "").replace(",", ""));
    return [discountPrice, currency, twdPrice];
  } catch (e) {
    console.error(`❌ PChome 價格擷取失敗：${e.message}`);
    return ["找不到", "TWD", 0.0];
  }
}

// Amazon 價格擷取（使用 puppeteer）
async function scrapePriceAmazon(url) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // 增加超時時間到 60 秒
    await page.waitForSelector('.a-price-symbol', { timeout: 5000 });
    const symbol = await page.$eval('.a-price-symbol', el => el.textContent);
    const whole = await page.$eval('.a-price-whole', el => el.textContent.replace(",", ""));
    const fraction = await page.$eval('.a-price-fraction', el => el.textContent);
    const priceStr = `${symbol}${whole}.${fraction}`;
    const currency = symbol.includes('US$') || symbol === '$' ? 'USD' : 'TWD';
    const price = parseFloat(`${whole}.${fraction}`);
    const twdPrice = currency === 'USD' ? Math.round(price * USD_TO_TWD * 100) / 100 : price;
    return [priceStr, currency, twdPrice];
  } catch (e) {
    console.error(`❌ 無法擷取 Amazon 價格：${e.message}`);
    return ["找不到", "未知", 0.0];
  } finally {
    await browser.close();
  }
}

// momo 價格擷取 (修正版)
async function scrapePriceMomo(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();

    // 設定假標頭 (User-Agent、Accept-Language、Referer等)
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.momoshop.com.tw/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });

    // 設定視窗大小 (viewport)
    await page.setViewport({ width: 1280, height: 800 });

    // 進入 momo 商品頁 (增加超時時間到60秒)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 等待額外5秒以確保所有動態內容載入完畢
    await new Promise(resolve => setTimeout(resolve, 5000));

    const html = await page.content();
    const $ = cheerio.load(html);

    // 嘗試抓取促銷價格 (span.special > span.price)
    let discountPriceTag = $('li.special span.price').first().text().trim().replace(/[$,]/g, '');

    if (discountPriceTag && !isNaN(discountPriceTag)) {
      const price = parseInt(discountPriceTag);
      return [`$${price}`, "TWD", price];
    }

    // 若沒抓到，嘗試抓 seoPrice
    const seoPrices = $('span.seoPrice');
    const prices = [];
    seoPrices.each((i, el) => {
      const text = $(el).text().trim().replace(/[$,]/g, '');
      if (!isNaN(text)) {
        prices.push(parseInt(text));
      }
    });

    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      return [`$${minPrice}`, "TWD", minPrice];
    }

    // 若以上都失敗，最後嘗試抓一般 price
    const priceTag = $('span.price').first().text().trim().replace(/[$,]/g, '');
    if (priceTag && !isNaN(priceTag)) {
      const price = parseInt(priceTag);
      return [`$${price}`, "TWD", price];
    }

    return ["找不到", "未知", 0.0];
  } catch (e) {
    console.error(`❌ momo 價格擷取失敗：${e.message}`);
    return ["找不到", "未知", 0.0];
  } finally {
    await browser.close();
  }
}


// 博客來價格擷取（使用 axios 和 cheerio）
async function scrapePriceBooks(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const $ = cheerio.load(response.data);
    const discountTag = $('strong.price01 > b').text().trim();
    const originalTag = $('ul.price li em').text().trim();
    if (discountTag && !isNaN(discountTag)) {
      const discount = parseInt(discountTag);
      return [`$${discount}`, "TWD", discount];
    }
    if (originalTag && !isNaN(originalTag)) {
      const original = parseInt(originalTag);
      return [`$${original}`, "TWD", original];
    }
    return ["找不到", "未知", 0.0];
  } catch (e) {
    console.error(`❌ 博客來價格擷取失敗：${e.message}`);
    return ["找不到", "未知", 0.0];
  }
}

// Coupang 價格擷取（使用 puppeteer）
async function scrapePriceCoupang(url) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // 增加超時時間到 60 秒

    // 使用 setTimeout 替代 waitForTimeout
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒以確保頁面加載完成

    const html = await page.content();
    const $ = cheerio.load(html);
    const discountPriceTag = $('div.rvisdp-price__final').text().trim().replace(",", "").replace("$", "");
    const originalPriceTag = $('div.rvisdp-price__original').text().trim().replace(",", "").replace("$", "");
    if (discountPriceTag && !isNaN(discountPriceTag)) {
      const discountPrice = parseInt(discountPriceTag);
      return [`$${discountPrice}`, "TWD", discountPrice];
    }
    if (originalPriceTag && !isNaN(originalPriceTag)) {
      const originalPrice = parseInt(originalPriceTag);
      return [`$${originalPrice}`, "TWD", originalPrice];
    }
    return ["找不到", "未知", 0.0];
  } catch (e) {
    console.error(`❌ Coupang 價格擷取失敗：${e.message}`);
    return ["找不到", "未知", 0.0];
  } finally {
    await browser.close();
  }
}

// 匯率轉換
function convertToTwd(amount, currency) {
  if (currency === "USD") {
    return Math.round(amount * USD_TO_TWD * 100) / 100;
  }
  return amount;
}

// 價格抓取 API
app.post('/eco_requests', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: '請提供商品網址' });
    }

    const site = detectSite(url);
    let priceStr, currency, twdPrice;

    if (site === 'pchome') {
      [priceStr, currency, twdPrice] = await scrapePricePchome(url);
    } else if (site === 'amazon') {
      [priceStr, currency, twdPrice] = await scrapePriceAmazon(url);
    } else if (site === 'momo') {
      [priceStr, currency, twdPrice] = await scrapePriceMomo(url);
    } else if (site === 'books') {
      [priceStr, currency, twdPrice] = await scrapePriceBooks(url);
    } else if (site === 'coupang') {
      [priceStr, currency, twdPrice] = await scrapePriceCoupang(url);
    } else {
      return res.status(400).json({ error: '不支援的網站' });
    }

    res.json({
      domain: site,
      price: twdPrice,
      price_str: priceStr,
      currency: currency
    });
  } catch (e) {
    console.error(`❌ API 處理失敗：${e.message}`);
    res.status(500).json({ error: `伺服器錯誤：${e.message}` });
  }
});

// 測試 API
app.get('/', (req, res) => {
  res.send('後端伺服器已啟動');
});

// 登入 API（支援 username 或 email）
app.post('/login', (req, res) => {
  const { identifier, password } = req.body;

  const sql = `SELECT * FROM Users WHERE username = ? OR email = ? LIMIT 1`;
  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    if (results.length === 0) return res.status(401).json({ error: '使用者不存在' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: '密碼錯誤' });

    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  });
});

// 完整信用卡詳細資訊 (含圖片、公司名稱)
app.get('/credit-cards-details', (req, res) => {
  const sql = `
    SELECT c.credit_card_id, c.image_url, c.card_name, comp.company_name, c.additional_benefits
    FROM CreditCards c
    JOIN CreditCardCompanies comp ON c.company_id = comp.company_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results);
  });
});

// 註冊 API
app.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: '請填寫所有欄位' });
  }

  // 檢查帳號或信箱是否已存在
  const checkSQL = 'SELECT * FROM Users WHERE username = ? OR email = ?';
  db.query(checkSQL, [username, email], async (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    if (results.length > 0) return res.status(409).json({ error: '帳號或信箱已存在' });

    // 加密密碼
    const hash = await bcrypt.hash(password, 10);

    // 插入新使用者
    const insertSQL = 'INSERT INTO Users (username, password, email, role) VALUES (?, ?, ?, ?)';
    db.query(insertSQL, [username, hash, email, role || 'user'], (err, result) => {
      if (err) return res.status(500).json({ error: '註冊失敗' });

      // 回傳使用者資料（也可以在這邊寫入 cookie）
      res.json({
        user_id: result.insertId,
        username,
        email,
        role: role || 'user'
      });
    });
  });
});

// 刪除使用者帳號 + 清除該使用者的信用卡紀錄
app.delete('/user/:id', (req, res) => {
  const user_id = req.params.id;

  // 先刪除使用者信用卡關聯資料
  db.query('DELETE FROM UserPersonalCreditCards WHERE user_id = ?', [user_id], (err) => {
    if (err) return res.status(500).json({ error: '刪除使用者信用卡資料失敗' });

    // 再刪除使用者本身
    db.query('DELETE FROM Users WHERE user_id = ?', [user_id], (err) => {
      if (err) return res.status(500).json({ error: '刪除使用者帳號失敗' });

      res.json({ success: true });
    });
  });
});

// 取得單一使用者資訊
app.get('/user/:id', (req, res) => {
  const user_id = req.params.id;
  db.query('SELECT user_id, username, email FROM Users WHERE user_id = ?', [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: '伺服器錯誤' });
    if (results.length === 0) return res.status(404).json({ error: '使用者不存在' });
    res.json(results[0]);
  });
});

// 更新使用者資訊（可改密碼）
app.put('/user/:id', async (req, res) => {
  const user_id = req.params.id;
  const { username, email, password } = req.body;

  const updates = [];
  const values = [];

  if (username) {
    updates.push('username = ?');
    values.push(username);
  }
  if (email) {
    updates.push('email = ?');
    values.push(email);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    updates.push('password = ?');
    values.push(hash);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '沒有可更新的欄位' });
  }

  const sql = `UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`;
  values.push(user_id);

  db.query(sql, values, (err) => {
    if (err) return res.status(500).json({ error: '更新失敗' });
    res.json({ success: true });
  });
});

// 取得所有信用卡
app.get('/credit-cards', (req, res) => {
  db.query('SELECT credit_card_id, card_name FROM CreditCards', (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results);
  });
});

// 儲存使用者信用卡
app.post('/save-cards', (req, res) => {
  const { user_id, credit_card_ids } = req.body;
  db.query('DELETE FROM UserPersonalCreditCards WHERE user_id = ?', [user_id], err => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });

    const values = credit_card_ids.map(card_id => [user_id, card_id]);
    if (values.length > 0) {
      db.query('INSERT INTO UserPersonalCreditCards (user_id, credit_card_id) VALUES ?', [values], err => {
        if (err) return res.status(500).json({ error: '資料庫錯誤' });
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });
});

// 取得使用者擁有的信用卡
app.get('/user-cards/:user_id', (req, res) => {
  const user_id = req.params.user_id;
  db.query('SELECT credit_card_id FROM UserPersonalCreditCards WHERE user_id = ?', [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results.map(row => row.credit_card_id));
  });
});

// 完整信用卡詳細資訊 (含圖片、公司名稱)
app.get('/credit-cards-details', (req, res) => {
  const sql = `
    SELECT c.credit_card_id, c.image_url, c.card_name, comp.company_name, c.additional_benefits
    FROM CreditCards c
    JOIN CreditCardCompanies comp ON c.company_id = comp.company_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results);
  });
});

// 新增信用卡 API（僅開發者使用）
app.post('/add-credit-card', (req, res) => {
  const { company_id, card_name, card_type, reward_categories, additional_benefits } = req.body;

  const sql = `
    INSERT INTO CreditCards (company_id, card_name, card_type, reward_categories, additional_benefits)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      company_id,
      card_name,
      card_type,
      JSON.stringify(reward_categories),
      JSON.stringify(additional_benefits)
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: '新增信用卡失敗' });
      res.json({ success: true, credit_card_id: result.insertId });
    }
  );
});

// 啟動伺服器
app.listen(3000, () => {
  console.log('🚀 伺服器運行於 http://localhost:3000');
});