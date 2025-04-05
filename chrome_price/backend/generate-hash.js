// backend/generate-hash.js
const bcrypt = require('bcrypt');

const password = 'password123'; // 你想要加密的密碼

bcrypt.hash(password, 10).then(hash => {
  console.log('加密後的密碼：', hash);
});
