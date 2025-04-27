const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// 設置靜態檔案目錄以提供前端檔案
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// 確保 public 目錄存在並複製前端檔案
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('✅ 創建 public 目錄');
}

const copyIfNotExists = (src, dest) => {
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`✅ 已複製 ${path.basename(src)} 到 ${path.dirname(dest)}`);
  }
};
copyIfNotExists(path.join(__dirname, 'backend.html'), path.join(publicDir, 'backend.html'));
copyIfNotExists(path.join(__dirname, 'backend.js'), path.join(publicDir, 'js/backend.js'));

// 設置 JSON 資料檔案路徑
const dataDir = path.join(__dirname, 'data');
const jsonPath = path.join(dataDir, 'credit_cards.json');

// MySQL 連線設定
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Ray930715',
  database: 'credit_card_optimizer'
});

db.connect(err => {
  if (err) {
    console.error('❌ MySQL 連接失敗:', err);
    return;
  }
  console.log('✅ MySQL 連接成功');
});

// 匯率常數
const USD_TO_TWD = 32.3;
const CNY_TO_TWD = 4.45;

// 偽造的 HTTP 標頭
const fakeHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Referer': 'https://www.google.com/',
  'Connection': 'keep-alive',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Upgrade-Insecure-Requests': '1'
};

// Puppeteer 瀏覽器實例
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    if (browserInstance) await browserInstance.close().catch(() => {});
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    console.log('✅ Puppeteer 瀏覽器實例已啟動');
  }
  return browserInstance;
}

// 網站爬蟲映射
const siteScrapeMap = {
  'pchome.com.tw': scrapePricePchome,
  'amazon.': scrapePriceAmazon,
  'momoshop.com.tw': scrapePriceMomo,
  'books.com.tw': scrapePriceBooks,
  'coupang.com': scrapePriceCoupang,
  'taobao.com': scrapePriceTaobao
};

function getScrapeFunction(url) {
  try {
    const hostname = new URL(url).hostname;
    console.log(`ℹ️ 解析域名: ${hostname}`);
    for (const [domain, scrapeFn] of Object.entries(siteScrapeMap)) {
      if (hostname.includes(domain)) {
        console.log(`ℹ️ 找到對應網站: ${domain}`);
        return scrapeFn;
      }
    }
    console.error('❌ 不支援的網站');
    return null;
  } catch (e) {
    console.error(`❌ URL 解析失敗: ${e.message}`);
    return null;
  }
}

async function scrapeWithRetry(scrapeFn, url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`ℹ️ 開始抓取: URL=${url}, 嘗試 ${i + 1}/${maxRetries}`);
      return await scrapeFn(url);
    } catch (e) {
      console.warn(`⚠️ 重試 ${i + 1}/${maxRetries} 失敗: ${e.message}`);
      if (i === maxRetries - 1) {
        console.error(`❌ 抓取最終失敗: URL=${url}, 錯誤=${e.message}`);
        throw e;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// 各網站價格爬蟲函數
async function scrapePricePchome(url) {
  try {
    console.log(`ℹ️ PChome 抓取開始: ${url}`);
    const response = await axios.get(url, { headers: fakeHeaders, timeout: 10000 });
    console.log(`ℹ️ PChome 頁面載入成功: 狀態碼=${response.status}`);
    const $ = cheerio.load(response.data);
    const selectors = ['div.o-prodPrice__price', '.price', '#ProdPrice'];
    let priceTag = selectors.map(sel => $(sel).text().trim()).find(tag => tag) || '';
    const price = parseFloat(priceTag.replace(/[$NT,]/g, '')) || 0.0;
    if (!price) throw new Error('價格標籤未找到');
    console.log(`✅ PChome 抓取成功: 價格=$${price}`);
    return [`$${price}`, 'TWD', price];
  } catch (e) {
    console.error(`❌ PChome 抓取失敗: ${e.message}`);
    return ['找不到', 'TWD', 0.0];
  }
}

async function scrapePriceAmazon(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    console.log(`ℹ️ Amazon 抓取開始: ${url}`);
    await page.setExtraHTTPHeaders(fakeHeaders);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.a-price-symbol, .a-price, .a-offscreen', { timeout: 10000 });
    const price = await page.evaluate(() => {
      const symbol = document.querySelector('.a-price-symbol')?.textContent || '$';
      const whole = document.querySelector('.a-price-whole')?.textContent.replace(',', '') || '0';
      const fraction = document.querySelector('.a-price-fraction')?.textContent || '00';
      return { symbol, whole, fraction };
    });
    const priceStr = `${price.symbol}${price.whole}.${price.fraction}`;
    const currency = price.symbol.includes('US$') || price.symbol === '$' ? 'USD' : 'TWD';
    const priceNum = parseFloat(`${price.whole}.${price.fraction}`) || 0.0;
    const twdPrice = currency === 'USD' ? Math.round(priceNum * USD_TO_TWD * 100) / 100 : priceNum;
    console.log(`✅ Amazon 抓取成功: 價格=${priceStr}, TWD=${twdPrice}`);
    return [priceStr, currency, twdPrice];
  } catch (e) {
    console.error(`❌ Amazon 抓取失敗: ${e.message}`);
    return ['找不到', '未知', 0.0];
  } finally {
    console.log(`ℹ️ Amazon 關閉頁面`);
    await page.close();
  }
}

async function scrapePriceTaobao(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    console.log(`ℹ️ 淘寶抓取開始: ${url}`);
    await page.setExtraHTTPHeaders({
      ...fakeHeaders,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.taobao.com/'
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    const price = await page.evaluate(() => {
      const selectors = ['.Price--realSales--3C5RbpW', '.tm-promo-price', '.tm-price', '[data-spm="mainPrice"]'];
      return selectors.map(sel => document.querySelector(sel)?.textContent.trim().replace(/[,]/g, '')).find(p => p) || null;
    });
    const priceNum = parseFloat(price) || 0.0;
    const twdPrice = priceNum ? Math.round(priceNum * CNY_TO_TWD * 100) / 100 : 0.0;
    console.log(`✅ 淘寶抓取成功: 價格=¥${priceNum}, TWD=${twdPrice}`);
    return [`¥${priceNum}`, 'CNY', twdPrice];
  } catch (e) {
    console.error(`❌ 淘寶抓取失敗: ${e.message}`);
    return ['找不到', '未知', 0.0];
  } finally {
    console.log(`ℹ️ 淘寶關閉頁面`);
    await page.close();
  }
}

async function scrapePriceMomo(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    console.log(`ℹ️ momo 抓取開始: ${url}`);
    await page.setExtraHTTPHeaders({
      ...fakeHeaders,
      'Referer': 'https://www.momoshop.com.tw/'
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    const price = await page.evaluate(() => {
      const selectors = ['li.special span.price', 'span.seoPrice', 'span.price', '.price'];
      return selectors.map(sel => document.querySelector12(sel)?.textContent.trim().replace(/[$,]/g, '')).find(p => p) || null;
    });
    const priceNum = parseInt(price) || 0.0;
    console.log(`✅ momo 抓取成功: 價格=$${priceNum}`);
    return [`$${priceNum}`, 'TWD', priceNum];
  } catch (e) {
    console.error(`❌ momo 抓取失敗: ${e.message}`);
    return ['找不到', '未知', 0.0];
  } finally {
    console.log(`ℹ️ momo 關閉頁面`);
    await page.close();
  }
}

async function scrapePriceBooks(url) {
  try {
    console.log(`ℹ️ 博客來抓取開始: ${url}`);
    const response = await axios.get(url, { headers: fakeHeaders, timeout: 10000 });
    console.log(`ℹ️ 博客來頁面載入成功: 狀態碼=${response.status}`);
    const $ = cheerio.load(response.data);
    const selectors = ['strong.price01 > b', '.price', 'ul.price li em'];
    let priceTag = selectors.map(sel => $(sel).text().trim()).find(tag => tag && !isNaN(tag)) || '';
    const price = parseInt(priceTag) || 0.0;
    console.log(`✅ 博客來抓取成功: 價格=$${price}`);
    return [`$${price}`, 'TWD', price];
  } catch (e) {
    console.error(`❌ 博客來抓取失敗: ${e.message}`);
    return ['找不到', '未知', 0.0];
  }
}

async function scrapePriceCoupang(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    console.log(`ℹ️ Coupang 抓取開始: ${url}`);
    await page.setExtraHTTPHeaders(fakeHeaders);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    const price = await page.evaluate(() => {
      const selectors = ['div.rvisdp-price__final', '.prod-price', 'div.rvisdp-price__original'];
      return selectors.map(sel => document.querySelector(sel)?.textContent.trim().replace(/[,$]/g, '')).find(p => p) || null;
    });
    const priceNum = parseInt(price) || 0.0;
    console.log(`✅ Coupang 抓取成功: 價格=$${priceNum}`);
    return [`$${priceNum}`, 'TWD', priceNum];
  } catch (e) {
    console.error(`❌ Coupang 抓取失敗: ${e.message}`);
    return ['找不到', '未知', 0.0];
  } finally {
    console.log(`ℹ️ Coupang 關閉頁面`);
    await page.close();
  }
}

// 價格爬取 API
app.post('/eco_requests', async (req, res) => {
  try {
    const { url } = req.body;
    console.log(`ℱ️ 收到價格抓取請求: URL=${url}`);
    if (!url) {
      console.error('❌ 缺少 URL 參數');
      return res.status(400).json({ error: '請提供商品網址' });
    }

    const scrapeFn = getScrapeFunction(url);
    if (!scrapeFn) {
      console.error('❌ 不支援的網站');
      return res.status(400).json({ error: '不支援的網站' });
    }

    const [priceStr, currency, twdPrice] = await scrapeWithRetry(scrapeFn, url);
    const domain = new URL(url).hostname;
    console.log(`✅ 抓取結果: 域名=${domain}, 價格=${priceStr}, 幣種=${currency}, TWD=${twdPrice}`);
    res.json({ domain, price: twdPrice, price_str: priceStr, currency });
  } catch (e) {
    console.error(`❌ API 處理失敗: URL=${req.body.url}, 錯誤=${e.message}, 堆棧=${e.stack}`);
    res.status(500).json({ error: `伺服器錯誤：${e.message}` });
  }
});

// 根路由
app.get('/', (req, res) => {
  console.log('ℱ️ 訪問根路由');
  res.send('後端伺服器已啟動');
});

// 使用者登入 API
app.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  console.log(`ℱ️ 登入請求: identifier=${identifier}`);

  const sql = `SELECT * FROM Users WHERE username = ? OR email = ? LIMIT 1`;
  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) {
      console.error(`❌ 資料庫查詢失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    if (results.length === 0) {
      console.error('❌ 使用者不存在');
      return res.status(401).json({ error: '使用者不存在' });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.error('❌ 密碼錯誤');
      return res.status(401).json({ error: '密碼錯誤' });
    }

    console.log(`✅ 登入成功: user_id=${user.user_id}`);
    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  });
});

// 取得信用卡詳細資訊 API
app.get('/credit-cards-details', (req, res) => {
  console.log('ℱ️ 請求信用卡詳細資訊');
  const sql = `
    SELECT c.credit_card_id, c.image_url, c.card_name, comp.company_name, c.additional_benefits
    FROM CreditCards c
    JOIN CreditCardCompanies comp ON c.company_id = comp.company_id
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error(`❌ 資料庫查詢失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫錯誤' });
    }

    const parsedResults = results.map(card => {
      let benefits = [];
      if (typeof card.additional_benefits === 'string') {
        try {
          benefits = JSON.parse(card.additional_benefits);
        } catch {
          benefits = card.additional_benefits
            .split(/[,\n]+/)
            .map(s => s.trim())
            .filter(Boolean);
        }
      } else if (Array.isArray(card.additional_benefits)) {
        benefits = card.additional_benefits;
      }

      return {
        credit_card_id: card.credit_card_id,
        image_url: card.image_url,
        card_name: card.card_name,
        company_name: card.company_name,
        additional_benefits: benefits
      };
    });
    console.log(`✅ 信用卡詳細資訊查詢成功: 共 ${parsedResults.length} 筆`);
    res.json(parsedResults);
  });
});

// 使用者註冊 API
app.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  console.log(`ℱ️ 註冊請求: username=${username}, email=${email}`);

  if (!username || !email || !password) {
    console.error('❌ 缺少必要欄位');
    return res.status(400).json({ error: '請填寫所有欄位' });
  }

  const checkSQL = 'SELECT * FROM Users WHERE username = ? OR email = ?';
  db.query(checkSQL, [username, email], async (err, results) => {
    if (err) {
      console.error(`❌ 資料庫查詢失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    if (results.length > 0) {
      console.error('❌ 帳號或信箱已存在');
      return res.status(409).json({ error: '帳號或信箱已存在' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insertSQL = 'INSERT INTO Users (username, password, email, role) VALUES (?, ?, ?, ?)';
    db.query(insertSQL, [username, hash, email, role || 'user'], (err, result) => {
      if (err) {
        console.error(`❌ 註冊失敗: ${err.message}`);
        return res.status(500).json({ error: '註冊失敗' });
      }
      console.log(`✅ 註冊成功: user_id=${result.insertId}`);
      res.json({
        user_id: result.insertId,
        username,
        email,
        role: role || 'user'
      });
    });
  });
});

// 刪除使用者 API
app.delete('/user/:id', (req, res) => {
  const user_id = req.params.id;
  console.log(`ℱ️ 刪除使用者請求: user_id=${user_id}`);

  db.query('DELETE FROM UserPersonalCreditCards WHERE user_id = ?', [user_id], (err) => {
    if (err) {
      console.error(`❌ 刪除信用卡資料失敗: ${err.message}`);
      return res.status(500).json({ error: '刪除使用者信用卡資料失敗' });
    }
    db.query('DELETE FROM Users WHERE user_id = ?', [user_id], (err) => {
      if (err) {
        console.error(`❌ 刪除使用者失敗: ${err.message}`);
        return res.status(500).json({ error: '刪除使用者帳號失敗' });
      }
      console.log(`✅ 使用者刪除成功: user_id=${user_id}`);
      res.json({ success: true });
    });
  });
});

// 查詢使用者資訊 API
app.get('/user/:id', (req, res) => {
  const user_id = req.params.id;
  console.log(`ℱ️ 查詢使用者資訊: user_id=${user_id}`);

  db.query('SELECT user_id, username, email FROM Users WHERE user_id = ?', [user_id], (err, results) => {
    if (err) {
      console.error(`❌ 資料庫查詢失敗: ${err.message}`);
      return res.status(500).json({ error: '伺服器錯誤' });
    }
    if (results.length === 0) {
      console.error('❌ 使用者不存在');
      return res.status(404).json({ error: '使用者不存在' });
    }
    console.log(`✅ 使用者資訊查詢成功: user_id=${user_id}`);
    res.json(results[0]);
  });
});

// 更新使用者資訊 API
app.put('/user/:id', async (req, res) => {
  const user_id = req.params.id;
  const { username, email, password } = req.body;
  console.log(`ℱ️ 更新使用者請求: user_id=${user_id}`);

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
    console.error('❌ 沒有可更新的欄位');
    return res.status(400).json({ error: '沒有可更新的欄位' });
  }

  const sql = `UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`;
  values.push(user_id);

  db.query(sql, values, (err) => {
    if (err) {
      console.error(`❌ 更新失敗: ${err.message}`);
      return res.status(500).json({ error: '更新失敗' });
    }
    console.log(`✅ 使用者更新成功: user_id=${user_id}`);
    res.json({ success: true });
  });
});

// 取得所有信用卡 API
app.get('/credit-cards', (req, res) => {
  console.log('ℱ️ 請求所有信用卡');
  db.query('SELECT credit_card_id, card_name FROM CreditCards', (err, results) => {
    if (err) {
      console.error(`❌ 資料庫查詢失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    console.log(`✅ 信用卡查詢成功: 共 ${results.length} 筆`);
    res.json(results);
  });
});

// 儲存使用者信用卡 API
app.post('/save-cards', (req, res) => {
  const { user_id, credit_card_ids } = req.body;
  console.log(`ℱ️ 儲存使用者信用卡: user_id=${user_id}, card_ids=${credit_card_ids}`);

  db.query('DELETE FROM UserPersonalCreditCards WHERE user_id = ?', [user_id], err => {
    if (err) {
      console.error(`❌ 刪除舊信用卡失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    const values = credit_card_ids.map(card_id => [user_id, card_id]);
    if (values.length > 0) {
      db.query('INSERT INTO UserPersonalCreditCards (user_id, credit_card_id) VALUES ?', [values], err => {
        if (err) {
          console.error(`❌ 插入新信用卡失敗: ${err.message}`);
          return res.status(500).json({ error: '資料庫錯誤' });
        }
        console.log(`✅ 信用卡儲存成功: user_id=${user_id}`);
        res.json({ success: true });
      });
    } else {
      console.log(`✅ 無新信用卡儲存: user_id=${user_id}`);
      res.json({ success: true });
    }
  });
});

// 查詢使用者信用卡 API
app.get('/user-cards/:user_id', (req, res) => {
  const user_id = req.params.user_id;
  console.log(`ℱ️ 查詢使用者信用卡: user_id=${user_id}`);

  db.query('SELECT credit_card_id FROM UserPersonalCreditCards WHERE user_id = ?', [user_id], (err, results) => {
    if (err) {
      console.error(`❌ 資料庫查詢失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    console.log(`✅ 使用者信用卡查詢成功: user_id=${user_id}, 共 ${results.length} 筆`);
    res.json(results.map(row => row.credit_card_id));
  });
});

// 提取銀行名稱的輔助函數
function extractBankName(cardName) {
  const bankNames = [
    '滙豐銀行',
    '台新銀行',
    '遠東商銀',
    '中國信託',
    '聯邦銀行',
    '美國運通'
  ];
  for (const bank of bankNames) {
    if (cardName.startsWith(bank)) {
      return bank;
    }
  }
  return '未知銀行';
}

// 根據銀行名稱查找 company_id
async function getCompanyId(bankName) {
  return new Promise((resolve, reject) => {
    db.query('SELECT company_id FROM CreditCardCompanies WHERE company_name = ?', [bankName], (err, results) => {
      if (err) {
        console.error(`❌ 查詢公司 ID 失敗: ${err.message}`);
        return reject(err);
      }
      if (results.length === 0) {
        console.error(`❌ 找不到對應公司: ${bankName}`);
        return reject(new Error(`找不到公司: ${bankName}`));
      }
      resolve(results[0].company_id);
    });
  });
}

// 後台新增信用卡 API（同時寫入 MySQL 和 JSON）
app.post('/api/add-card', async (req, res) => {
  const { name, imageUrl, rewards, paymentPlatforms, storePlatforms, features, annualFee, additionalBenefits, bestUse } = req.body;
  console.log(`ℱ️ 新增信用卡請求: card_name=${name}`);

  if (!name || !imageUrl || !rewards || !features || !annualFee || !bestUse) {
    console.error('❌ 缺少必要欄位');
    return res.status(400).json({ error: '請填寫所有必填欄位' });
  }

  try {
    const bankName = extractBankName(name);
    const companyId = await getCompanyId(bankName);

    const sql = `
      INSERT INTO CreditCards (company_id, card_name, image_url, rewards, payment_platforms, store_platforms, features, annual_fee, additional_benefits, best_use)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        companyId, name, imageUrl, rewards,
        JSON.stringify(paymentPlatforms), JSON.stringify(storePlatforms),
        JSON.stringify(features), annualFee,
        JSON.stringify(additionalBenefits || []), bestUse
      ],
      async (err, result) => {
        if (err) {
          console.error(`❌ MySQL 插入失敗: ${err.message}`);
          return res.status(500).json({ error: '資料庫插入失敗' });
        }

        const newCardId = result.insertId;

        let jsonData = [];
        try {
          jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch (err) {
          console.error(`❌ 讀取 JSON 失敗: ${err.message}`);
          return res.status(500).json({ error: '讀取 JSON 失敗' });
        }

        const newCardJson = {
          id: newCardId,
          name: name,
          imageURL: imageUrl,
          rewards: JSON.parse(rewards),
          paymentPlatforms: paymentPlatforms,
          storePlatforms: storePlatforms,
          features: features,
          annualFee: annualFee,
          additionalBenefits: additionalBenefits || [],
          bestUse: bestUse
        };
        jsonData.push(newCardJson);

        try {
          fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
          console.log(`✅ JSON 檔案更新成功: credit_card_id=${newCardId}`);
        } catch (err) {
          console.error(`❌ 寫入 JSON 失敗: ${err.message}`);
          db.query('DELETE FROM CreditCards WHERE credit_card_id = ?', [newCardId], (rollbackErr) => {
            if (rollbackErr) console.error(`❌ 回滾失敗: ${rollbackErr.message}`);
          });
          return res.status(500).json({ error: '寫入 JSON 失敗' });
        }

        console.log(`✅ 信用卡新增成功: credit_card_id=${newCardId}`);
        res.json({ success: true, credit_card_id: newCardId });
      }
    );
  } catch (err) {
    console.error(`❌ 新增信用卡失敗: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// 後台取得所有信用卡 API
app.get('/api/cards', (req, res) => {
  console.log('ℱ️ 請求後台信用卡清單');
  const sql = `
    SELECT credit_card_id, company_id, card_name, image_url, rewards,
           payment_platforms, store_platforms, features, annual_fee, additional_benefits, best_use
    FROM CreditCards
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error(`❌ 資料庫查詢失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫錯誤' });
    }

    const parseField = (val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
        }
      }
      return Array.isArray(val) ? val : [];
    };

    const parsedResults = results.map(card => ({
      credit_card_id: card.credit_card_id,
      company_id: card.company_id,
      card_name: card.card_name,
      image_url: card.image_url,
      rewards: parseField(card.rewards),
      payment_platforms: parseField(card.payment_platforms),
      store_platforms: parseField(card.store_platforms),
      features: parseField(card.features),
      additional_benefits: parseField(card.additional_benefits),
      best_use: card.best_use,
      annual_fee: card.annual_fee
    }));

    console.log(`✅ 後台信用卡查詢成功: 共 ${parsedResults.length} 筆`);
    res.json(parsedResults);
  });
});

// 後台刪除信用卡 API
app.delete('/api/delete-card/:id', (req, res) => {
  const cardId = parseInt(req.params.id, 10);
  console.log(`ℱ️ 刪除信用卡請求: credit_card_id=${cardId}`);

  // 1. 先從 MySQL 刪除
  db.query('DELETE FROM CreditCards WHERE credit_card_id = ?', [cardId], (err, result) => {
    if (err) {
      console.error(`❌ MySQL 刪除失敗: ${err.message}`);
      return res.status(500).json({ error: '資料庫刪除失敗' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到該信用卡' });
    }

    // 2. 再從 JSON 檔案中移除
    let jsonData;
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      jsonData = JSON.parse(raw);
    } catch (e) {
      console.error(`❌ 讀取 JSON 失敗: ${e.message}`);
      return res.status(500).json({ error: '讀取 JSON 失敗' });
    }

    const filtered = jsonData.filter(card => card.id !== cardId);
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(filtered, null, 2), 'utf8');
      console.log(`✅ JSON 檔案更新成功：刪除 id=${cardId}`);
    } catch (e) {
      console.error(`❌ 寫入 JSON 失敗: ${e.message}`);
      return res.status(500).json({ error: '寫入 JSON 失敗' });
    }

    console.log(`✅ 刪除成功: credit_card_id=${cardId}`);
    res.json({ success: true });
  });
});

// 信用卡推薦 API
app.post('/recommend-cards', async (req, res) => {
  const { platform, price, credit_card_ids } = req.body;
  console.log(`ℹ️ 信用卡推薦請求: platform=${platform}, price=${price}, card_ids=${credit_card_ids}`);

  if (!platform || !price) {
    console.error('❌ 缺少必要參數: platform 或 price');
    return res.status(400).json({ error: '缺少必要參數' });
  }

  if (!Array.isArray(credit_card_ids) || credit_card_ids.length === 0) {
    console.log('ℹ️ credit_card_ids 為空，返回提示訊息');
    return res.json({
      recommended: [
        { card_id: null, card_name: null, company_name: null, reason: '尚未加入任何卡片，請先加入卡片才能計算回饋' }
      ],
      best_card: null
    });
  }

  // 從 JSON 檔案中讀取信用卡資料
  let creditCardsData;
  try {
    creditCardsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    console.error(`❌ 讀取 credit_cards.json 失敗: ${err.message}`);
    return res.status(500).json({ error: '讀取 JSON 失敗' });
  }

  // 過濾使用者的信用卡
  const userCards = creditCardsData.filter(card => credit_card_ids.includes(card.id));
  const recommended = [];

  // 計算每張卡片的回饋金額
  userCards.forEach(card => {
    let cashbackRate = 0;
    let cashbackAmount = 0;
    let reason = '';

    // 檢查 paymentPlatforms 和 storePlatforms 是否包含指定平台
    const platformLower = platform.toLowerCase();
    const isPlatformSupported = card.paymentPlatforms.some(p => p.toLowerCase() === platformLower) ||
                               card.storePlatforms.some(s => s.toLowerCase() === platformLower);

    if (isPlatformSupported) {
      reason += `支援 ${platform} 平台；`;
    }

    // 檢查 rewards 中是否有適用於該平台的回饋率
    for (const [key, reward] of Object.entries(card.rewards)) {
      const match = reward.match(/(\d+(\.\d+)?)\s*%/);
      if (match) {
        const rate = parseFloat(match[1]);
        // 優先檢查是否有特定平台的回饋（例如 payment 或 online）
        if ((key === 'payment' && card.paymentPlatforms.some(p => p.toLowerCase() === platformLower)) ||
            (key === 'online' && card.storePlatforms.some(s => s.toLowerCase() === platformLower))) {
          cashbackRate = rate;
          reason += `提供 ${rate}% 回饋於 ${platform}；`;
          break;
        }
        // 否則檢查是否有一般回饋（domestic 或 international）
        else if ((key === 'domestic' && !isPlatformSupported) || key === 'international') {
          cashbackRate = rate;
          reason += `提供 ${rate}% ${key === 'domestic' ? '國內' : '國際'} 回饋；`;
        }
      }
    }

    // 計算回饋金額（考慮上限）
    if (cashbackRate > 0) {
      cashbackAmount = (price * cashbackRate) / 100;
      // 檢查是否有回饋上限
      const rewardStr = JSON.stringify(card.rewards);
      const capMatch = rewardStr.match(/上限(\d+)[元點]/);
      if (capMatch) {
        const cap = parseInt(capMatch[1]);
        if (cashbackAmount > cap) {
          cashbackAmount = cap;
          reason += `回饋上限 ${cap} 元；`;
        }
      }
    }

    if (cashbackRate > 0 || isPlatformSupported) {
      const bankName = extractBankName(card.name);
      recommended.push({
        card_id: card.id,
        card_name: card.name,
        company_name: bankName,
        cashback_rate: cashbackRate,
        cashback_amount: cashbackAmount,
        reason: reason.trim()
      });
    }
  });

  if (recommended.length === 0) {
    console.log('ℹ️ 無合適卡片推薦');
    recommended.push({
      card_id: null,
      card_name: null,
      company_name: null,
      reason: '目前找不到合適卡片'
    });
  }

  let bestCard = null;
  try {
    // 準備 Gemini 提示，包含完整的卡片資訊和計算的回饋
    const cardInfo = userCards.map(card => {
      const bankName = extractBankName(card.name);
      const cardRecommendations = recommended.filter(rec => rec.card_id === card.id);
      const cashbackInfo = cardRecommendations.length > 0
        ? `回饋率: ${cardRecommendations[0].cashback_rate}%, 回饋金額: ${cardRecommendations[0].cashback_amount.toFixed(2)} 元`
        : '無特定回饋';
      return `卡片ID: ${card.id}, 名稱: ${card.name}, 發卡銀行: ${bankName}, 優惠詳情: ${JSON.stringify(card.rewards)}, ${cashbackInfo}, 適用平台: ${JSON.stringify([...card.paymentPlatforms, ...card.storePlatforms])}`;
    }).join('\n');

    const prompt = `
在 ${platform} 平台消費 ${price} 台幣，使用者的信用卡如下：
${cardInfo}

請根據提供的回饋率和金額，推薦最適合的信用卡，並以以下格式回覆，確保最佳推薦放在最前面，且格式醒目：
⭐ 最佳推薦 ⭐
卡片名稱：{卡片名稱}
發卡銀行：{發卡銀行}
回饋率：{回饋率}%
回饋金額：{金額} 元
原因：{原因}

其他推薦卡片：
- {卡片名稱}（{發卡銀行}）：{回饋率}% - {金額} 元 - {原因}
（如果有多張卡片，逐一列出）

請優先選擇回饋金額最高的卡片作為最佳推薦，並考慮平台的適用性。
`;

    const geminiKey = 'AIzaSyBRUhPK-bA5tL3sogpgiQO3mVtPcpKWGRg';
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    console.log('ℹ️ 正在呼叫 Gemini API 進行最佳卡片分析');
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      }
    });

    const response = result.response;
    const reply = response.text();
    console.log(`✅ Gemini 回應成功: ${reply.substring(0, 50)}...`);

    const lines = reply.split('\n');
    const bestCardInfo = {
      card_name: '',
      company_name: '',
      cashback_rate: 0,
      cashback: 0,
      reason: ''
    };
    let otherRecommendations = [];

    let isBestSection = false;
    let isOtherSection = false;

    lines.forEach(line => {
      if (line.includes('⭐ 最佳推薦 ⭐')) {
        isBestSection = true;
        isOtherSection = false;
      } else if (line.includes('其他推薦卡片：')) {
        isBestSection = false;
        isOtherSection = true;
      } else if (isBestSection) {
        if (line.startsWith('卡片名稱：')) {
          bestCardInfo.card_name = line.replace('卡片名稱：', '').trim();
        } else if (line.startsWith('發卡銀行：')) {
          bestCardInfo.company_name = line.replace('發卡銀行：', '').trim();
        } else if (line.startsWith('回饋率：')) {
          bestCardInfo.cashback_rate = parseFloat(line.replace('回饋率：', '').replace('%', '').trim()) || 0;
        } else if (line.startsWith('回饋金額：')) {
          bestCardInfo.cashback = parseFloat(line.replace('回饋金額：', '').replace(' 元', '').trim()) || 0;
        } else if (line.startsWith('原因：')) {
          bestCardInfo.reason = line.replace('原因：', '').trim();
        }
      } else if (isOtherSection && line.startsWith('- ')) {
        const match = line.match(/- (.+?)\（(.+?)\）：(\d+\.?\d*%) - (\d+\.?\d*) 元 - (.+)/);
        if (match) {
          const [, cardName, companyName, cashbackRate, cashbackAmount, reason] = match;
          const cardId = userCards.find(card => card.name === cardName.trim())?.id;
          if (cardId) {
            otherRecommendations.push({
              card_id: cardId,
              card_name: cardName.trim(),
              company_name: companyName.trim(),
              cashback_rate: parseFloat(cashbackRate),
              cashback_amount: parseFloat(cashbackAmount),
              reason: reason.trim()
            });
          }
        }
      }
    });

    const bestCardId = userCards.find(card => card.name === bestCardInfo.card_name)?.id;
    if (bestCardId) {
      bestCard = {
        card_id: bestCardId,
        card_name: bestCardInfo.card_name,
        company_name: bestCardInfo.company_name,
        cashback: bestCardInfo.cashback,
        cashback_rate: bestCardInfo.cashback_rate,
        reason: bestCardInfo.reason
      };
    } else {
      console.warn('⚠️ Gemini 推薦的卡片未在資料庫中找到');
      bestCard = { card_id: null, card_name: null, company_name: null, cashback: 0, cashback_rate: 0, reason: '無法確定最佳卡片' };
    }

    // 更新 recommended，排除最佳卡片
    recommended.forEach(rec => {
      if (rec.card_id !== bestCard?.card_id) {
        otherRecommendations.push(rec);
      }
    });

    // 如果沒有其他推薦，設置為空陣列
    if (otherRecommendations.length === 0) {
      otherRecommendations.push({
        card_id: null,
        card_name: null,
        company_name: null,
        cashback_rate: 0,
        cashback_amount: 0,
        reason: '無其他推薦卡片'
      });
    }

    console.log(`✅ 推薦結果: 共 ${otherRecommendations.length} 筆其他推薦, 最佳卡片: ${bestCard?.card_name || '無'}`);
    res.json({ recommended: otherRecommendations, best_card: bestCard });
  } catch (err) {
    console.error(`❌ Gemini 分析失敗: ${err.message}`);
    bestCard = {
      card_id: null,
      card_name: null,
      company_name: null,
      cashback: 0,
      cashback_rate: 0,
      reason: 'AI 分析失敗，無法確定最佳卡片'
    };
    res.json({ recommended, best_card: bestCard });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  console.log(`ℹ️ Gemini API 請求: message=${message}`);

  if (!message) {
    console.error('❌ 缺少 message 參數');
    return res.status(400).json({ error: '缺少 message' });
  }

  try {
    // 直接從 JSON 讀取信用卡資料
    let creditCardsData = [];
    try {
      creditCardsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (err) {
      console.error(`❌ 讀取 credit_cards.json 失敗: ${err.message}`);
      return res.status(500).json({ error: '讀取 JSON 失敗' });
    }

    const enrichedCards = creditCardsData.map(card => ({
      id: card.id,
      name: card.name,
      imageURL: card.imageURL,
      company_name: extractBankName(card.name),
      rewards: card.rewards,
      payment_platforms: card.paymentPlatforms,
      store_platforms: card.storePlatforms,
      features: card.features,
      annual_fee: card.annualFee,
      additional_benefits: card.additionalBenefits,
      best_use: card.bestUse
    }));

    const prompt = `
你是一個專業的信用卡推薦小幫手，使用者正在詢問你關於信用卡的建議。以下是你參考的優惠資料：
${JSON.stringify(enrichedCards, null, 2)}
請用口語化中文回應以下問題：「${message}」

如果需要推薦信用卡，請優先推薦回饋率最高或最符合需求的卡片，並以以下格式回覆，確保最佳推薦醒目：
⭐ 最佳推薦 ⭐
卡片名稱：{卡片名稱}
發卡銀行：{發卡銀行}
回饋詳情：{回饋詳情}
原因：{原因}

其他建議（如果有）：
- {卡片名稱}（{發卡銀行}）：{原因}
`;

    const geminiKey = 'AIzaSyBRUhPK-bA5tL3sogpgiQO3mVtPcpKWGRg';
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    console.log('ℹ️ 正在呼叫 Gemini API');
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      }
    });

    const response = result.response;
    const reply = response.text();
    console.log(`✅ Gemini 回應成功: ${reply.substring(0, 50)}...`);
    res.json({ reply });
  } catch (err) {
    console.error(`❌ Gemini 回覆失敗: ${err.message}, 堆棧=${err.stack}`);
    res.status(500).json({ error: 'AI 回覆失敗' });
  }
});

// 啟動伺服器
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
  await getBrowser();
});

// 處理伺服器關閉
process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close();
    console.log('✅ Puppeteer 瀏覽器實例已關閉');
  }
  process.exit();
});