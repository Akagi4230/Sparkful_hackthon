document.getElementById('registerBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role')?.value || 'user';
  const msg = document.getElementById('registerMsg') || document.getElementById('errorMsg');
  const privacyCheck = document.getElementById('privacyCheck').checked;

  if (!privacyCheck) {
    msg.textContent = '請先同意隱私權政策與 cookie 使用';
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role })
    });
    const data = await response.json();

    if (data.error) {
      msg.textContent = data.error;
      return;
    }

    alert('註冊成功！');

    chrome.runtime.sendMessage({
      action: 'setCookie',
      name: 'user',
      value: JSON.stringify(data)
    });

    // ✅ 導向到 profile.html 填寫信用卡資料
    window.location.href = 'main.html';
  } catch (err) {
    msg.textContent = '註冊失敗，請稍後再試';
  }
});
// 加在 register.html 或 register.js 中
document.getElementById('togglePrivacy').addEventListener('click', () => {
  const content = document.getElementById('privacyContent');
  content.style.display = (content.style.display === 'none' || content.style.display === '') ? 'block' : 'none';
});

