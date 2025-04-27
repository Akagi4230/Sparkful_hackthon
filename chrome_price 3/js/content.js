// js/content.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleOverlay') {
    toggleOverlay();
  }
  // ...其他訊息處理（例如 analyze）
});

function toggleOverlay() {
  let overlay = document.getElementById('cc-overlay');
  if (overlay) {
    // 如果已存在則移除
    overlay.remove();
    return;
  }
  // 建立 overlay
  overlay = document.createElement('div');
  overlay.id = 'cc-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '10px';
  overlay.style.right = '10px';
  overlay.style.width = '300px';
  overlay.style.backgroundColor = 'white';
  overlay.style.border = '1px solid #ccc';
  overlay.style.padding = '10px';
  overlay.style.zIndex = '999999';
  overlay.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
  // 建立內容：顯示使用者狀態、價格、分析按鈕
  overlay.innerHTML = `
    <h3>信用卡回饋助手</h3>
    <p>價格：<span id="cc-price">尚未取得</span></p>
    <button id="cc-analyze">分析此頁</button>
    <button id="cc-close">關閉</button>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('cc-close').addEventListener('click', () => {
    overlay.remove();
  });
  
  document.getElementById('cc-analyze').addEventListener('click', () => {
    // 分析價格：這裡直接發送訊息給 background，再由 background 呼叫內容腳本的分析邏輯
    chrome.runtime.sendMessage({ action: 'analyze', user_id: getUserId() });
  });
}

function getUserId() {
  // 你需要從 cookie 或其他方式取得目前使用者ID
  // 這裡只做示範，可根據你的需求改寫
  // 例如：透過 chrome.storage.local.get('user') 同步取得 user 資料
  return 1; // 假設使用者ID為 1
}
