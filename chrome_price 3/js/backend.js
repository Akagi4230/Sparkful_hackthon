document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:3000';
  
    // 新增卡片
    document.getElementById('cardForm').addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
  
      // 必填驗證
      if (!data.name || !data.imageUrl || !data.rewards || !data.features || !data.annualFee || !data.bestUse) {
        return alert('❌ 請填寫所有必填欄位');
      }
  
      // 處理多行輸入
      data.paymentPlatforms   = data.paymentPlatforms?.split('\n').filter(s => s.trim()) || [];
      data.storePlatforms     = data.storePlatforms?.split('\n').filter(s => s.trim()) || [];
      data.features           = data.features.split('\n').filter(s => s.trim());
      data.additionalBenefits = data.additionalBenefits?.split('\n').filter(s => s.trim()) || [];
  
      try {
        JSON.parse(data.rewards); // 驗證 JSON
        const resp = await fetch(`${API_BASE}/api/add-card`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(await resp.text());
        alert('✅ 卡片新增成功');
        e.target.reset();
        loadCards();
      } catch (err) {
        console.error(err);
        alert(`❌ 新增失敗：${err.message}`);
      }
    });
  
    // 載入並渲染卡片列表
    async function loadCards() {
      try {
        const resp = await fetch(`${API_BASE}/api/cards`);
        if (!resp.ok) throw new Error(await resp.text());
        const cards = await resp.json();
        const list = document.getElementById('cardList');
        list.innerHTML = '';
  
        cards.forEach(card => {
          list.innerHTML += `
            <div class="col">
              <div class="card shadow">
                <img src="${card.image_url}" class="card-img-top" alt="${card.card_name}">
                <div class="card-body">
                  <h5 class="card-title">${card.card_name}</h5>
                  <p class="card-item">
                    回饋資訊：${JSON.stringify(card.rewards)}\n
                    行動支付平台：${(card.payment_platforms||[]).join(', ') || '無'}\n
                    優惠商家平台：${(card.store_platforms||[]).join(', ') || '無'}\n
                    產品特色：${(card.features||[]).join(', ')}\n
                    年費：${card.annual_fee}\n
                    其他優勢：${(card.additional_benefits||[]).join(', ') || '無'}\n
                    最佳用途：${card.best_use}
                  </p>
                  <button class="btn btn-danger btn-sm" data-id="${card.credit_card_id}">🗑️ 刪除</button>
                </div>
              </div>
            </div>`;
        });
  
        // 綁定刪除事件
        document.querySelectorAll('.btn-danger').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (!confirm('確定要刪除嗎？')) return;
            try {
              const resp = await fetch(`${API_BASE}/api/delete-card/${id}`, { method:'DELETE' });
              if (!resp.ok) throw new Error(await resp.text());
              alert('✅ 刪除成功');
              loadCards();
            } catch (err) {
              console.error(err);
              alert(`❌ 刪除失敗：${err.message}`);
            }
          });
        });
  
      } catch (err) {
        console.error(err);
        alert('❌ 無法載入信用卡清單');
      }
    }
  
    loadCards();
  });
  