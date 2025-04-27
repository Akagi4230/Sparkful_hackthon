-- ======== 先刪除舊資料庫 & 新建 ========
DROP DATABASE IF EXISTS credit_card_optimizer;
CREATE DATABASE credit_card_optimizer;
USE credit_card_optimizer;

-- ======== 使用者表 ========
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role ENUM('user', 'developer') DEFAULT 'user'
);

-- ======== 信用卡公司表 ========
CREATE TABLE CreditCardCompanies (
    company_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(100) NOT NULL,
    company_description TEXT
);

-- ======== 信用卡表（調整欄位與 JSON 對應） ========
CREATE TABLE CreditCards (
    credit_card_id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    card_name VARCHAR(100) NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    rewards JSON NOT NULL, -- 儲存回饋資訊（domestic、international 等）
    payment_platforms JSON, -- 行動支付平台
    store_platforms JSON, -- 優惠店商平台
    features JSON NOT NULL, -- 產品特色
    annual_fee VARCHAR(255) NOT NULL, -- 年費
    additional_benefits JSON, -- 其他優勢
    best_use TEXT NOT NULL, -- 最佳用途
    FOREIGN KEY (company_id) REFERENCES CreditCardCompanies(company_id)
);

-- ======== 使用者個人信用卡表（用戶可勾選持有多張卡） ========
CREATE TABLE UserPersonalCreditCards (
    user_id INT NOT NULL,
    credit_card_id INT NOT NULL,
    PRIMARY KEY (user_id, credit_card_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (credit_card_id) REFERENCES CreditCards(credit_card_id)
);

-- ======== 初始資料 ========

-- 1) 使用者
INSERT INTO Users (username, password, email, role) VALUES
('testuser', '$2b$10$NyLwRcFtw/wQ8wC5Q8.w.eM35A1FlNtHd1AcM/12T1S1v3WiFLYne', 'testuser@example.com', 'developer');

-- 2) 信用卡公司
INSERT INTO CreditCardCompanies (company_name, company_description) VALUES
('滙豐銀行', '提供多元現金回饋與優惠方案'),
('台新銀行', '提供多種悠遊卡與紅利優惠'),
('遠東商銀', '提供專業的金融與信用卡服務'),
('中國信託', '國內大型金融機構，提供LinePay等多元卡片'),
('聯邦銀行', '提供旅遊及日系消費優惠'),
('美國運通', '高端信用卡，提供五星級服務');

-- 3) 信用卡（僅插入 #1 到 #13，#14 到 #16 不插入）
INSERT INTO CreditCards (company_id, card_name, image_url, rewards, payment_platforms, store_platforms, features, annual_fee, additional_benefits, best_use) VALUES
(1, '滙豐銀行 Live+現金回饋卡', 'https://drive.google.com/thumbnail?id=1H_eaNsu_VwQgGWCm6Ll98C2DET20xzum&sz=w1366', 
 '{"domestic": "4.88% (含3%通路加碼+1%自動扣繳，額外1%上限200元/月)", "international": "5.88% (日本/新加坡/馬來西亞/越南/菲律賓/印度/斯里蘭卡餐飲加碼1%，額外5%上限200元/月)", "insurance": "0.88%", "department_store": "3.88% (額外3%上限888元/月)"}', 
 '[]', '[]', 
 '["串流影音", "美食外送回饋", "線上購物回饋", "訂房網回饋"]', 
 '首年免年費，次年起使用電子/行動帳單免年費，或消費滿8萬/12次免年費', 
 '["2025/6/30前日本/新加坡/越南/馬來西亞/印度/斯里蘭卡餐飲優惠，最高5.88%", "國內一般通路0.88%回饋無上限", "王品集團餐廳15%瘋點數回饋無上限", "保費分期3.88%起優惠利率", "全亞洲200+餐廳85折"]', 
 '高回饋餐飲/購物/娛樂，適合海外旅行及王品集團消費'),
(1, '滙豐銀行 匯鑽卡', 'https://drive.google.com/thumbnail?id=1SUt4I0UXPqybDr92LEM_xFbOxQRpRTKk&sz=w1366', 
 '{"domestic": "6% (行動支付/外送/網購，需累積5000點+滙豐帳戶30萬)", "payment": "6% (需累積5000點+滙豐帳戶30萬)", "insurance": "1% (無上限)"}', 
 '["街口支付"]', '[]', 
 '["串流影音", "美食外送回饋", "線上購物回饋", "訂房網回饋"]', 
 '首年免年費，次年起電子/行動帳單或消費滿8萬/12次免年費', 
 '["街口支付/遊戲/影音串流/線上訂房/網購3%回饋，翻倍至6% (上限2000元)", "一般消費1%無上限，翻倍至2% (需累積5000點+帳戶30萬)", "現金積點兌換航空哩程 (1元=2哩)", "機場接送優惠價668元起", "年薪需超25萬"]', 
 '街口支付及數位消費高回饋，適合高資產用戶'),
(2, '台新銀行 玫瑰悠遊Mastercard卡', 'https://drive.google.com/thumbnail?id=1USTJMDE3K0Ijj5jiDVofiRuzpV5TmBVe&sz=w1366', 
 '{"domestic": "3.3% (超商/交通/餐飲/展演，上限10,000點/期)", "international": "3.3% (日韓歐美，上限10,000點/期)"}', 
 '[]', '[]', 
 '["國內消費回饋", "國外消費回饋", "保險回饋", "加油回饋"]', 
 '首年免年費，次年起電子/行動帳單免年費', 
 '["選擇「天天刷」「大筆刷」「好饗刷」，2025/1/2-3/31全通路3.3%", "2025/4/1-6/30台新帳戶扣繳享3.3%，否則1.5%", "台新Point回饋，Richart Life APP切換方案"]', 
 '超商/交通/餐飲高回饋，適合靈活消費及海外旅行'),
(2, '台新銀行 太陽悠遊JCB卡', 'https://drive.google.com/thumbnail?id=1-2Rm_8b0GkcTGGcBJKpFrADbLrt5xVTv&sz=w1366', 
 '{"domestic": "3.3% (超商/交通/餐飲/展演，上限10,000點/期)", "international": "3.3% (日韓歐美，上限10,000點/期)"}', 
 '[]', '[]', 
 '["國內消費回饋", "國外消費回饋", "保險回饋", "加油回饋"]', 
 '首年免年費，次年起電子/行動帳單免年費', 
 '["選擇「天天刷」「大筆刷」「好饗刷」，2025/1/2-3/31全通路3.3%", "2025/4/1-6/30台新帳戶扣繳享3.3%，否則1.5%", "台新Point回饋，Richart Life APP切換方案"]', 
 'JCB通路及超商/交通/餐飲，適合靈活消費'),
(1, '滙豐銀行 現金回饋御璽卡', 'https://drive.google.com/thumbnail?id=1UlquHrU8TaiTZbvGIP3ZBu0JsGU_zomU&sz=w1366', 
 '{"domestic": "1.22% (無上限)", "international": "2.22% (無上限)", "insurance": "3.88% (分期優惠利率)"}', 
 '[]', '[]', 
 '["國內消費回饋", "國外消費回饋", "無腦刷回饋", "沒有回饋上限"]', 
 '首年免年費，次年起電子/行動帳單或消費滿8萬/12次免年費', 
 '["旅平險2000萬", "現金積點兌換航空哩程 (1元=2哩)", "回饋直接折抵帳單", "年薪需超25萬"]', 
 '無上限回饋，適合高額消費及海外旅行'),
(3, '遠東商銀 遠東樂家+卡', 'https://drive.google.com/thumbnail?id=18i_nfdm-kyKHS6xAs4ttHyt4PxYmHNf9&sz=w1366', 
 '{"domestic": "0.5%", "international": "3.5% (滿額加碼)", "insurance": "3%", "department_store": "4% (含0.5%國內消費)"}', 
 '["LINE Pay", "街口", "悠遊付", "Pi拍錢包", "歐付寶", "HAPPY GO Pay"]', '[]', 
 '["大賣場回饋", "百貨公司回饋", "餐飲回饋", "影城回饋"]', 
 '首年免年費，次年起消費滿6萬/12筆或電子帳單+扣繳+3筆免年費', 
 '["2025/3/31前LINE Pay/街口/悠遊付/Pi拍錢包/歐付寶最高5% (需登錄，上限100元/月)", "綁定遠銀LINE官方帳號加碼4%，最高5% (上限100元/月)", "HAPPY GO Pay最高5倍HAPPY GO點數", "寵物商店/動物醫院10%回饋", "學費3期0利率", "免費機場貴賓室 (滿額)"]', 
 '行動支付及百貨，適合家庭及寵物主人'),
(4, '中國信託 LINE Pay卡', 'https://drive.google.com/thumbnail?id=1Dik1cyh5dGV2RhuimRUGSyilpvCxM5Ef&sz=w1366', 
 '{"domestic": "1% (無上限)", "international": "5% (日韓泰新，LINE POINTS)", "payment": "1%", "insurance": "1%"}', 
 '["LINE Pay"]', '["Hotels.com", "Klook"]', 
 '["行動支付回饋", "旅行社折扣", "餐飲回饋", "線上購物回饋"]', 
 '綁定LINE Pay或電子帳單免年費', 
 '["Hotels.com/Klook最高16% LINE POINTS", "海外2.8%無上限", "年薪需超20萬"]', 
 'LINE Pay及旅遊訂票，適合海外消費'),
(3, '遠東商銀 快樂信用卡', 'https://drive.google.com/thumbnail?id=1uGiMSK1c96GdpE4DW07FsqVVMN4bVjXW&sz=w1366', 
 '{"domestic": "5% (百貨/藥妝/網購/咖啡/服飾)", "international": "3% (滿額)", "online": "5%", "transportation": "3% (高鐵/台鐵滿3000元)"}', 
 '["LINE Pay", "街口", "悠遊付", "Pi拍錢包", "歐付寶"]', '[]', 
 '["百貨公司回饋", "線上購物回饋", "大眾運輸回饋", "餐飲折扣"]', 
 '首年免年費，次年起刷12筆或6萬免年費', 
 '["2025/3/31前LINE Pay/街口/悠遊付/Pi拍錢包/歐付寶最高5% (需登錄，上限100元/月)", "綁定遠銀LINE官方帳號加碼4%，最高5% (上限100元/月)", "悠遊卡自動加值5%回饋", "遠百停車3小時免費", "學費3期0利率", "HAPPY GO點數最高2倍"]', 
 '網購及大眾運輸，適合遠東集團消費'),
(2, '台新銀行 @GoGo icash御璽卡', 'https://drive.google.com/thumbnail?id=1XJAJhnog2DemUDvpD5q37obasIHvGv2y&sz=w1366', 
 '{"payment": "20% (台新Pay/街口支付，需任務)", "online": "3% (指定平台)"}', 
 '["街口支付", "台新Pay"]', '["蝦皮", "momo", "PChome", "Yahoo", "Amazon", "Coupang", "東森", "博客來", "Agoda"]', 
 '["行動支付回饋", "旅平險 (2000萬)", "線上購物回饋", "繳稅優惠"]', 
 '刷1筆免年費', 
 '["新光/威秀平日2D電影6折", "Agoda訂房12%回饋", "頂級餐飲85折"]', 
 '行動支付及網購，適合電影及旅遊愛好者'),
(1, '滙豐銀行 Live+現金回饋卡 (Premier)', 'https://drive.google.com/thumbnail?id=1H_eaNsu_VwQgGWCm6Ll98C2DET20xzum&sz=w1366', 
 '{"domestic": "4.88% (含3%通路加碼+1%自動扣繳，上限200元/月)", "international": "5.88% (日本/新加坡/馬來西亞/越南/菲律賓/印度/斯里蘭卡餐飲，上限200元/月)", "payment": "10% (OPEN POINT)"}', 
 '["OPEN POINT"]', '[]', 
 '["串流影音", "美食外送回饋", "線上購物回饋", "訂房網回饋"]', 
 '首年免年費，次年起電子/行動帳單或消費滿8萬/12次免年費', 
 '["2025/6/30前日本/新加坡/越南/馬來西亞/印度/斯里蘭卡餐飲優惠，最高5.88%", "國內一般通路0.88%回饋無上限", "王品集團15%瘋點數回饋無上限", "保費分期3.88%起", "全亞洲200+餐廳85折"]', 
 'OPEN POINT及海外餐飲，適合高回饋消費'),
(1, '滙豐銀行 旅人御璽卡 (Premier)', 'https://drive.google.com/thumbnail?id=1jnHMhT9SqX5Pc3DhtKwp2Qe7fNPyvY4N&sz=w1366', 
 '{"domestic": "NT$18=1哩 (無上限)", "international": "NT$15=1哩 (無上限)"}', 
 '[]', '[]', 
 '["機場接送", "機場貴賓室", "旅平險 (2000萬)", "哩程回饋無上限"]', 
 '2500元，可用旅遊積分折抵', 
 '["兌換15+航空公司哩程或IHG/Accor/Marriot飯店", "1000哩折50元 (最低消費200元，上限100%)", "5000哩折1500元刷卡金", "旅遊積分兌換公益捐款", "免費機場接送/貴賓室2次，停車45天", "年薪需超25萬"]', 
 '哩程累積，適合高端旅遊者'),
(1, '滙豐銀行 匯鑽卡 (Premier)', 'https://drive.google.com/thumbnail?id=1SUt4I0UXPqybDr92LEM_xFbOxQRpRTKk&sz=w1366', 
 '{"domestic": "6% (行動支付/外送/網購，需累積5000點+滙豐帳戶30萬)", "payment": "6% (需累積5000點+滙豐帳戶30萬)", "insurance": "1% (無上限)"}', 
 '["街口支付"]', '[]', 
 '["串流影音", "美食外送回饋", "線上購物回饋", "訂房網回饋"]', 
 '首年免年費，次年起電子/行動帳單或消費滿8萬/12次免年費', 
 '["街口支付/遊戲/影音串流/線上訂房/網購3%回饋，翻倍至6% (上限2000元)", "一般消費1%無上限，翻倍至2% (需累積5000點+帳戶30萬)", "現金積點兌換航空哩程 (1元=2哩)", "機場接送優惠價668元起", "年薪需超25萬"]', 
 '街口支付及數位消費，適合高資產用戶'),
(1, '滙豐銀行 現金回饋御璽卡 (Premier)', 'https://drive.google.com/thumbnail?id=1UlquHrU8TaiTZbvGIP3ZBu0JsGU_zomU&sz=w1366', 
 '{"domestic": "1.22% (無上限)", "international": "2.22% (無上限)", "insurance": "1.22%"}', 
 '[]', '[]', 
 '["國內消費回饋", "國外消費回饋", "無腦刷回饋", "沒有回饋上限"]', 
 '首年免年費，次年起電子/行動帳單或消費滿8萬/12次免年費', 
 '["旅平險2000萬", "現金積點兌換航空哩程 (1元=2哩)", "指定飯店美食買一送一", "年薪需超25萬"]', 
 '無上限回饋，適合高額消費及海外旅行');

-- Done !