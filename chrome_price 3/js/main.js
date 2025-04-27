document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: 'getCookie', name: 'user' }, (response) => {
    const user = response.value ? JSON.parse(response.value) : null;
    if (!user) {
      alert('尚未登入，請先登入');
      window.location.href = 'login.html';
      return;
    }

    const usernameDisplay = document.getElementById('usernameDisplay');
    usernameDisplay.textContent = user.username;

    document.getElementById('checkPrice').addEventListener('click', async () => {
      const chatBox = document.getElementById('chat-history');
      const resultElement = document.getElementById('result');
      const loader = document.getElementById('loading');
      chatBox.innerHTML = '';
      resultElement.textContent = '';
      loader.style.display = 'block';

      try {
        const [tab] = await new Promise(resolve => {
          chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });
        const url = tab.url;

        // 1️⃣ 擷取價格資訊
        const resPrice = await fetch('http://localhost:3000/eco_requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        if (!resPrice.ok) {
          resultElement.textContent = '❌ 價格擷取失敗';
          return;
        }

        const { domain, price } = await resPrice.json();

        // ✅ 顯示網站與價格（顯示在 result 區）
        resultElement.textContent = `網站：${domain}，價格：${price} 元`;

        // 2️⃣ 查詢使用者卡片
        const resCards = await fetch(`http://localhost:3000/user-cards/${user.user_id}`);
        const userCards = await resCards.json();

        if (!Array.isArray(userCards) || userCards.length === 0) {
          alert('⚠️ 尚未加入任何卡片，請先到個人資料頁新增卡片。');
          return;
        }

        // 3️⃣ 發送推薦請求
        const resRecommend = await fetch('http://localhost:3000/recommend-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: domain,
            price,
            credit_card_ids: userCards
          })
        });

        const { recommended, best_card } = await resRecommend.json();

        // 清空聊天區域並顯示推薦結果
        chatBox.innerHTML = '';

        // 優先顯示最佳推薦
        if (best_card && best_card.card_id) {
          const cashbackRate = ((best_card.cashback / price) * 100).toFixed(1); // 計算回饋率
          chatBox.innerHTML += `
            <div class="best-recommendation">
              <strong>⭐ 最佳推薦 ⭐</strong><br>
              卡片名稱：${best_card.card_name}（${best_card.company_name}）<br>
              預計回饋：${best_card.cashback.toFixed(2)} 元（回饋率：${cashbackRate}%）<br>
              原因：${best_card.reason}
            </div>
          `;
        } else {
          chatBox.innerHTML += `<div><strong>最佳推薦：</strong> ${best_card?.reason || '無法確定最佳卡片'}</div>`;
        }

        // 顯示其他推薦（如果有）
        if (recommended && recommended.length > 0 && recommended[0].card_id) {
          chatBox.innerHTML += `<div><strong>其他推薦：</strong></div>`;
          recommended.forEach(item => {
            if (item.card_id) {
              chatBox.innerHTML += `
                <div>✅ <strong>${item.card_name}</strong>（<em>${item.company_name}</em>）：${item.reason}</div>
              `;
            }
          });
        }

      } catch (err) {
        console.error('❌ 分析失敗：', err);
        resultElement.textContent = '分析失敗，請稍後再試';
      } finally {
        loader.style.display = 'none';
      }
    });

    // Gemini 聊天送出
    document.getElementById('sendBtn').addEventListener('click', sendChat);
    document.getElementById('logout').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'removeCookie', name: 'user' });
      window.location.href = 'login.html';
    });
    document.getElementById('goProfile').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('html/profile.html') });
    });
  });
});

// 🤖 Gemini 聊天
async function sendChat() {
  const input = document.getElementById('chat-input');
  const history = document.getElementById('chat-history');
  const message = input.value.trim();
  if (!message) return;

  // 添加使用者訊息
  const userMessage = document.createElement('div');
  userMessage.className = 'chat-message user';
  userMessage.textContent = message;
  history.appendChild(userMessage);

  input.value = '思考中...';
  input.disabled = true;

  try {
    const resp = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await resp.json();
    const reply = data.reply;

    // 解析 Gemini 回覆並格式化
    const aiMessage = document.createElement('div');
    aiMessage.className = 'chat-message ai';

    const lines = reply.split('\n').filter(line => line.trim());
    let bestRecommendation = '';
    const otherSuggestions = [];
    let reminder = '';
    let inBestSection = false;
    let inOtherSection = false;

    lines.forEach(line => {
      if (line.includes('⭐ 最佳推薦 ⭐')) {
        inBestSection = true;
        inOtherSection = false;
        bestRecommendation += '<div class="best-recommendation"><strong>⭐ 最佳推薦 ⭐</strong><br>';
      } else if (line.includes('其他建議：')) {
        inBestSection = false;
        inOtherSection = true;
        otherSuggestions.push('<div class="other-suggestions"><strong>其他建議：</strong><ul>');
      } else if (line.includes('提醒您')) {
        inBestSection = false;
        inOtherSection = false;
        reminder = `<div class="reminder">${line}</div>`;
      } else if (inBestSection) {
        if (line.startsWith('卡片名稱：')) {
          bestRecommendation += `卡片名稱：${line.replace('卡片名稱：', '').trim()}<br>`;
        } else if (line.startsWith('發卡銀行：')) {
          bestRecommendation += `發卡銀行：${line.replace('發卡銀行：', '').trim()}<br>`;
        } else if (line.startsWith('回饋詳情：')) {
          bestRecommendation += `回饋詳情：${line.replace('回饋詳情：', '').trim()}<br>`;
        } else if (line.startsWith('原因：')) {
          bestRecommendation += `原因：${line.replace('原因：', '').trim()}</div>`;
        }
      } else if (inOtherSection && line.startsWith('- ')) {
        const match = line.match(/- (.+?)\（(.+?)\）：(.+)/);
        if (match) {
          const [, cardName, bank, reason] = match;
          otherSuggestions.push(`<li><strong>${cardName.trim()}</strong>（${bank.trim()}）：${reason.trim()}</li>`);
        }
      }
    });

    if (otherSuggestions.length > 0) {
      otherSuggestions.push('</ul></div>');
    }

    aiMessage.innerHTML = bestRecommendation + (otherSuggestions.length > 0 ? otherSuggestions.join('') : '') + (reminder || '');
    history.appendChild(aiMessage);
  } catch (err) {
    console.error(err);
    const aiMessage = document.createElement('div');
    aiMessage.className = 'chat-message ai';
    aiMessage.textContent = '抱歉，伺服器目前無法回應。';
    history.appendChild(aiMessage);
  } finally {
    input.value = '';
    input.disabled = false;
    history.scrollTop = history.scrollHeight;
  }
}