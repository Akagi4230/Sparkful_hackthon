document.getElementById('loginBtn').addEventListener('click', async () => {
  const identifier = document.getElementById('identifier').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  const privacyCheck = document.getElementById('privacyCheck').checked;

  if (!privacyCheck) {
    errorMsg.textContent = '請先同意隱私權政策與 cookie 使用';
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await response.json();

    if (data.error) {
      errorMsg.textContent = data.error;
      return;
    }

    chrome.runtime.sendMessage({ action: 'setCookie', name: 'user', value: JSON.stringify(data) });
    alert('登入成功！');

    // ✅ 回到主 main 頁
    window.location.href = 'main.html';
  } catch (err) {
    errorMsg.textContent = '登入失敗，請稍後再試';
  }
});
document.getElementById('togglePrivacy').addEventListener('click', () => {
  const content = document.getElementById('privacyContent');
  content.style.display = (content.style.display === 'none' || content.style.display === '') ? 'block' : 'none';
});
