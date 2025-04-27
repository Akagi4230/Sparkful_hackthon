// js/background.js
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' });
});

// 原有的 listener 務必保留：
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setCookie') {
    chrome.storage.local.set({ [message.name]: message.value }, () => sendResponse({ success: true }));
    return true;
  }

  if (message.action === 'getCookie') {
    chrome.storage.local.get(message.name, (result) => sendResponse({ value: result[message.name] }));
    return true;
  }

  if (message.action === 'removeCookie') {
    chrome.storage.local.remove(message.name, () => sendResponse({ success: true }));
    return true;
  }

  if (message.action === 'calculate') {
    const { price, user_id, category } = message;
    fetch(`http://localhost:3000/user-cards/${user_id}`)
      .then(res => res.json())
      .then(async userCards => {
        if (!userCards.length) {
          chrome.tabs.sendMessage(sender.tab.id, { action: 'showResult', result: { name: '無信用卡', reward: 0 } });
          return;
        }

        const recommendations = [];
        for (const card_id of userCards) {
          const card = await fetch(`http://localhost:3000/credit-card-details/${card_id}`).then(res => res.json());
          const rate = card.reward_categories[category] || card.reward_categories.domestic || 0;
          recommendations.push({ name: card.card_name, reward: price * rate });
        }

        recommendations.sort((a, b) => b.reward - a.reward);
        chrome.tabs.sendMessage(sender.tab.id, { action: 'showResult', result: recommendations[0] });
      });
  }
});
