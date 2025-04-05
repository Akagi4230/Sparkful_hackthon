// backend/server.js
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL 連線設定
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Akagikaga1941', // 替換為你的密碼
  database: 'credit_card_optimizer'
});

db.connect(err => {
  if (err) {
    console.error('MySQL 連接失敗:', err);
    return;
  }
  console.log('✅ MySQL 連接成功');
});

// 測試 API
app.get('/', (req, res) => {
  res.send('後端伺服器已啟動');
});

// ✅ 登入 API（支援 username 或 email）
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
    SELECT c.credit_card_id, c.image_url, c.card_name, comp.company_name, c.reward_categories, c.additional_benefits
    FROM CreditCards c
    JOIN CreditCardCompanies comp ON c.company_id = comp.company_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results);
  });
});

// ✅ 註冊 API
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

// ✅ 刪除使用者帳號
app.delete('/user/:id', (req, res) => {
  const user_id = req.params.id;

  db.query('DELETE FROM Users WHERE user_id = ?', [user_id], (err, result) => {
    if (err) return res.status(500).json({ error: '刪除失敗' });
    res.json({ success: true });
  });
});

// ✅ 刪除使用者帳號 + 清除該使用者的信用卡紀錄
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


// ✅ 取得單一使用者資訊
app.get('/user/:id', (req, res) => {
  const user_id = req.params.id;
  db.query('SELECT user_id, username, email FROM Users WHERE user_id = ?', [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: '伺服器錯誤' });
    if (results.length === 0) return res.status(404).json({ error: '使用者不存在' });
    res.json(results[0]);
  });
});

// ✅ 更新使用者資訊（可改密碼）
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


// ✅ 取得所有信用卡
app.get('/credit-cards', (req, res) => {
  db.query('SELECT credit_card_id, card_name FROM CreditCards', (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });
    res.json(results);
  });
});

// ✅ 儲存使用者信用卡
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

// ✅ 取得使用者擁有的信用卡
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
// ✅ 新增信用卡 API（僅開發者使用）
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
