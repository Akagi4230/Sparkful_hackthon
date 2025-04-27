document.addEventListener('DOMContentLoaded', () => {
  // 顯示彈出式廣告
  const adPopup = document.getElementById('adPopup');
  adPopup.style.display = 'block';
  document.getElementById('closeAd').onclick = () => adPopup.style.display = 'none';

  // 取得使用者資訊並初始化
  chrome.runtime.sendMessage({ action: 'getCookie', name: 'user' }, async (response) => {
    const user = response.value ? JSON.parse(response.value) : null;
    if (!user) {
      alert('尚未登入，請先登入');
      window.location.href = chrome.runtime.getURL('html/login.html');
      return;
    }

    // 更新使用者名稱
    document.getElementById('usernameDisplay').textContent = user.username;

    // 側邊選單：如果是 developer 顯示後臺連結
    const nav = document.querySelector('.sidebar-nav');
    if (user.role === 'developer') {
      const devLink = document.createElement('a');
      devLink.href = chrome.runtime.getURL('html/backend.html');
      devLink.textContent = '前往後臺';
      nav.appendChild(devLink);
    }

    // 讀取信用卡資料
    const creditCards = await fetch('http://localhost:3000/credit-cards-details').then(res => res.json());
    const userCards = await fetch(`http://localhost:3000/user-cards/${user.user_id}`).then(res => res.json());

    // DOM 元素
    const cardContainer = document.getElementById('cardContainer');
    const bankFilterContainer = document.getElementById('bankFilterContainer');
    const cardSearchInput = document.getElementById('cardSearch');

    // 初始化容器
    cardContainer.innerHTML = '';
    bankFilterContainer.innerHTML = `<label><input type="checkbox" value="all" checked> 全部</label>`;

    // 建立卡片列表
    const allCards = creditCards.map(card => ({ ...card, element: null }));
    allCards.forEach(card => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <img src="${card.image_url}" alt="${card.card_name}">
        <label><input type="checkbox" id="card-${card.credit_card_id}" ${userCards.includes(card.credit_card_id) ? 'checked' : ''}> ${card.card_name}</label>
        <small>${card.company_name}</small>
      `;
      cardContainer.appendChild(div);
      card.element = div;
    });

    // 建立銀行篩選選項
    const banks = [...new Set(allCards.map(c => c.company_name))];
    banks.forEach(bank => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${bank}" checked> ${bank}`;
      bankFilterContainer.appendChild(label);
    });

    // 篩選函式
    function filterCards() {
      const kw = cardSearchInput.value.toLowerCase();
      const selBanks = Array.from(bankFilterContainer.querySelectorAll('input:checked')).map(cb => cb.value);
      allCards.forEach(c => {
        const mKey = c.card_name.toLowerCase().includes(kw) || c.company_name.toLowerCase().includes(kw);
        const mBank = selBanks.includes('all') || selBanks.includes(c.company_name);
        c.element.style.display = (mKey && mBank) ? '' : 'none';
      });
    }

    // 綁定篩選事件
    cardSearchInput.addEventListener('input', filterCards);
    bankFilterContainer.addEventListener('change', filterCards);
    bankFilterContainer.querySelector('input[value="all"]').addEventListener('change', function() {
      const all = this.checked;
      bankFilterContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (cb.value !== 'all') cb.checked = all; });
      filterCards();
    });

    // 儲存信用卡
    document.getElementById('saveCards').onclick = async () => {
      const sel = Array.from(document.querySelectorAll('#cardContainer input:checked')).map(i => parseInt(i.id.split('-')[1]));
      await fetch('http://localhost:3000/save-cards', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: user.user_id, credit_card_ids: sel })
      });
      alert('信用卡已儲存');
    };

    // 更新個人資料
    document.getElementById('updateBtn').onclick = async () => {
      const u = document.getElementById('newUsername').value;
      const e = document.getElementById('newEmail').value;
      const p = document.getElementById('newPassword').value;
      const body = {};
      if (u) body.username = u;
      if (e) body.email = e;
      if (p) body.password = p;
      if (!Object.keys(body).length) { alert('請輸入要更新的內容'); return; }
      const res = await fetch(`http://localhost:3000/user/${user.user_id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
      const r = await res.json();
      alert(r.success ? '更新成功' : r.error || '更新失敗');
    };

    // 返回主頁
    document.getElementById('goMain').onclick = () => window.location.href = chrome.runtime.getURL('html/main.html');
  });
});
