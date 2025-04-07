document.addEventListener('DOMContentLoaded', async () => {
  chrome.runtime.sendMessage({ action: 'getCookie', name: 'user' }, async (response) => {
    const user = response.value ? JSON.parse(response.value) : null;
    if (!user) {
      alert('尚未登入，請先登入');
      window.location.href = chrome.runtime.getURL('html/login.html');
      return;
    }

    document.getElementById('usernameDisplay').textContent = user.username;

    // 取得完整信用卡資訊
    const creditCards = await fetch('http://localhost:3000/credit-cards-details').then(res => res.json());
    const userCards = await fetch(`http://localhost:3000/user-cards/${user.user_id}`).then(res => res.json());

    const cardContainer = document.getElementById('cardContainer');

    // 顯示信用卡資料與圖片
    creditCards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.innerHTML = `
        <input type="checkbox" id="card-${card.credit_card_id}" ${userCards.includes(card.credit_card_id) ? 'checked' : ''}>
        <img src="${card.image_url}" alt="${card.card_name}" style="width:100px;height:auto;">
        <div>
          <strong>${card.card_name}</strong><br>
          銀行：${card.company_name}
        </div>
      `;
      cardContainer.appendChild(cardDiv);
    });

    document.getElementById('saveCards').onclick = async () => {
      const selectedCards = Array.from(document.querySelectorAll('.card input[type=checkbox]:checked'))
        .map(input => parseInt(input.id.split('-')[1]));

      await fetch('http://localhost:3000/save-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, credit_card_ids: selectedCards })
      });

      alert('信用卡已儲存');
    };

    document.getElementById('updateBtn').onclick = async () => {
      const newUsername = document.getElementById('newUsername').value;
      const newEmail = document.getElementById('newEmail').value;
      const newPassword = document.getElementById('newPassword').value;

      const body = {};
      if (newUsername) body.username = newUsername;
      if (newEmail) body.email = newEmail;
      if (newPassword) body.password = newPassword;

      if (Object.keys(body).length === 0) {
        alert('請輸入要更新的內容');
        return;
      }

      const res = await fetch(`http://localhost:3000/user/${user.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await res.json();
      if (result.success) alert('更新成功');
      else alert(result.error || '更新失敗');
    };

    // 正確跳轉寫法
    document.getElementById('goMain').onclick = () => {
      window.location.href = chrome.runtime.getURL('html/main.html');
    };
  });
});
