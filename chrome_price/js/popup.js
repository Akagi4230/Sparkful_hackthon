document.addEventListener('DOMContentLoaded', () => {
  const notLoggedInDiv = document.getElementById('notLoggedIn');
  const loggedInDiv = document.getElementById('loggedInArea');
  const usernameDisplay = document.getElementById('usernameDisplay');
  const priceDisplay = document.getElementById('priceDisplay');

  // 1) 檢查登入
  chrome.runtime.sendMessage({ action: 'getCookie', name: 'user' }, (res) => {
    const user = res.value ? JSON.parse(res.value) : null;

    if (!user) {
      // 未登入
      notLoggedInDiv.classList.remove('hidden');
      loggedInDiv.classList.add('hidden');
      document.getElementById('toLogin').onclick = () => {
        // 開啟 login.html，新分頁
        chrome.tabs.create({ url: 'html/login.html' });
      };
      document.getElementById('toRegister').onclick = () => {
        chrome.tabs.create({ url: 'html/register.html' });
      };
      return;
    }

    // 已登入
    notLoggedInDiv.classList.add('hidden');
    loggedInDiv.classList.remove('hidden');
    usernameDisplay.textContent = user.username;

    // 2) 分析按鈕
    document.getElementById('analyzeBtn').onclick = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'analyze',
          user_id: user.user_id
        });
      });
    };

    // （可選）自動顯示抓到的價格
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getPrice' }, (response) => {
        if (response && response.price) {
          priceDisplay.textContent = response.price;
        }
      });
    });

    // 3) 個人資料設定
    document.getElementById('profileBtn').onclick = () => {
      // 在新Tab打開 profile.html
      chrome.tabs.create({ url: 'html/profile.html' });
    };

    // 4) 登出
    document.getElementById('logoutBtn').onclick = () => {
      chrome.runtime.sendMessage({ action: 'removeCookie', name: 'user' });
      alert('已登出');
      window.location.reload();
    };
  });
});
