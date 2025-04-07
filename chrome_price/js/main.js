document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: 'getCookie', name: 'user' }, (response) => {
    const user = response.value ? JSON.parse(response.value) : null;
    if (!user) {
      // ✅ 修正路徑
      window.location.href = 'login.html';
      return;
    }

    document.getElementById('checkPrice').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'analyze', user_id: user.user_id });
      });
    });

    document.getElementById('goProfile').addEventListener('click', () => {
      // ✅ 開新分頁跳轉
      chrome.tabs.create({ url: chrome.runtime.getURL('html/profile.html') });
    });

    document.getElementById('logout').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'removeCookie', name: 'user' });
      window.location.href = 'login.html';
    });
  });
});
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: 'getCookie', name: 'user' }, (response) => {
    const user = response.value ? JSON.parse(response.value) : null;
    if (user) {
      document.getElementById('usernameDisplay').textContent = user.username;
    } else {
      document.getElementById('usernameDisplay').textContent = '訪客';
    }

    document.getElementById('checkPrice').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'analyze', user_id: user ? user.user_id : null });
      });
    });

    document.getElementById('goProfile').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('html/profile.html') });
    });

    document.getElementById('logout').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'removeCookie', name: 'user' });
      window.location.href = 'login.html';
    });
  });
});
