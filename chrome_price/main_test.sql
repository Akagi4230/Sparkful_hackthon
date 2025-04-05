-- ===== 建立資料庫 & 使用之 =====
DROP DATABASE IF EXISTS credit_card_optimizer;
CREATE DATABASE credit_card_optimizer;
USE credit_card_optimizer;

-- ===== 使用者表 =====
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role ENUM('user', 'developer') DEFAULT 'user'
);

-- ===== 信用卡公司表 =====
CREATE TABLE CreditCardCompanies (
    company_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(100) NOT NULL,
    company_description TEXT
);

-- ===== 信用卡表 =====
CREATE TABLE CreditCards (
    credit_card_id INT PRIMARY KEY AUTO_INCREMENT,
    image_url VARCHAR(255),
    company_id INT NOT NULL,
    card_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(50),
    additional_benefits TEXT,
    FOREIGN KEY (company_id) REFERENCES CreditCardCompanies(company_id)
);

-- ===== 卡片回饋表 =====
CREATE TABLE CreditCardCashbacks (
    cc_cb_id INT PRIMARY KEY AUTO_INCREMENT,
    credit_card_id INT NOT NULL,
    category_name VARCHAR(50) NOT NULL,
    reward_percent DECIMAL(5,4) NOT NULL,
    info TEXT,
    FOREIGN KEY (credit_card_id) REFERENCES CreditCards(credit_card_id)
);

-- ===== 卡片功能表 =====
CREATE TABLE CreditCardFeatures (
    cc_feature_id INT PRIMARY KEY AUTO_INCREMENT,
    credit_card_id INT NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (credit_card_id) REFERENCES CreditCards(credit_card_id)
);

-- ===== 使用者個人信用卡表 =====
CREATE TABLE UserPersonalCreditCards (
    user_id INT NOT NULL,
    credit_card_id INT NOT NULL,
    PRIMARY KEY (user_id, credit_card_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (credit_card_id) REFERENCES CreditCards(credit_card_id)
);

-- ===== 網站類別表 =====
CREATE TABLE WebsiteCategories (
    domain VARCHAR(200) PRIMARY KEY,
    category VARCHAR(50) NOT NULL
);

-- ======== 新增：電商平台表 ========
CREATE TABLE EcommercePlatforms (
    platform_id INT PRIMARY KEY AUTO_INCREMENT,
    platform_name VARCHAR(100) NOT NULL,
    description TEXT
);

-- ======== 信用卡 vs 電商平台 關聯表 ========
CREATE TABLE CreditCardEcom (
    cc_ecom_id INT PRIMARY KEY AUTO_INCREMENT,
    credit_card_id INT NOT NULL,
    platform_id INT NOT NULL,
    special_info TEXT,  -- 例如：此卡在該平台有加碼x%
    FOREIGN KEY (credit_card_id) REFERENCES CreditCards(credit_card_id),
    FOREIGN KEY (platform_id) REFERENCES EcommercePlatforms(platform_id)
);

-- ======== 新增：行動支付表 ========
CREATE TABLE PaymentServices (
    service_id INT PRIMARY KEY AUTO_INCREMENT,
    service_name VARCHAR(100) NOT NULL,
    description TEXT
);

-- ======== 信用卡 vs 行動支付 關聯表 ========
CREATE TABLE CreditCardPayment (
    cc_pay_id INT PRIMARY KEY AUTO_INCREMENT,
    credit_card_id INT NOT NULL,
    service_id INT NOT NULL,
    special_info TEXT,  -- 例如：此卡在該支付有加碼
    FOREIGN KEY (credit_card_id) REFERENCES CreditCards(credit_card_id),
    FOREIGN KEY (service_id) REFERENCES PaymentServices(service_id)
);


CREATE TABLE ProductPrices (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    url TEXT NOT NULL,
    domain VARCHAR(100) NOT NULL,
    original_price_str VARCHAR(50),
    currency VARCHAR(10),
    price_in_twd DECIMAL(10, 2),
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ 初始資料 ============

-- 使用者
INSERT INTO Users (username, password, email, role) VALUES
('testuser', '$2b$10$NyLwRcFtw/wQ8wC5Q8.w.eM35A1FlNtHd1AcM/12T1S1v3WiFLYne', 'testuser@example.com', 'developer');

-- 信用卡公司
INSERT INTO CreditCardCompanies (company_name, company_description) VALUES
('滙豐銀行', '提供多元現金回饋與優惠方案'),
('台新銀行', '提供多種悠遊卡與紅利優惠'),
('遠東商銀', '提供專業的金融與信用卡服務'),
('中國信託', '國內大型金融機構，提供LinePay等多元卡片');

-- 網站類別
INSERT INTO WebsiteCategories (domain, category) VALUES
('shopee.tw', 'domestic'),
('amazon.com', 'overseas'),
('pchome.com.tw', 'domestic');

-- === 初始化常見電商平台 ===
INSERT INTO EcommercePlatforms (platform_name) VALUES
('Shopee'),('momo'),('PChome'),('Yahoo'),('Amazon'),('Coupang'),('博客來'),('東森');


-- 以下開始13 張卡

-- 1) Live+現金回饋卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1H_eaNsu_VwQgGWCm6Ll98C2DET20xzum&sz=w1366',
  1,
  'Live+現金回饋卡',
  'Visa',
  '首年免年費、行動帳單可免年費；國內/海外多通路回饋'
);
SET @card1_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card1_id, 'domestic', 0.0488, '滿足指定門檻可達4.88%'),
(@card1_id, 'overseas', 0.0588, '精選國家餐飲加碼'),
(@card1_id, 'insurance', 0.0088, ''),
(@card1_id, 'department_store', 0.0388, '百貨/餐飲/娛樂通路加碼');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card1_id, '串流影音'),
(@card1_id, '美食外送回饋'),
(@card1_id, '線上購物回饋'),
(@card1_id, '訂房網回饋');

-- (範例) 假設此卡特別支援 Shopee / PChome
INSERT INTO CreditCardEcom (credit_card_id, platform_id, special_info)
SELECT @card1_id, platform_id, '指定網購有加碼'
FROM EcommercePlatforms
WHERE platform_name IN ('Shopee','PChome');

-- (範例) 假設此卡支援 OPEN POINT
INSERT INTO CreditCardPayment (credit_card_id, service_id, special_info)
SELECT @card1_id, service_id, 'OPEN POINT 錢包10%'
FROM PaymentServices
WHERE service_name = 'OPEN POINT';

-- 2) 滙豐銀行 匯鑽卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1SUt4I0UXPqybDr92LEM_xFbOxQRpRTKk&sz=w1366',
  1,
  '匯鑽卡',
  'Visa',
  '首年免年費，指定通路最高6%回饋'
);
SET @card2_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card2_id, 'domestic', 0.06, '指定通路任務完成最高6%'),
(@card2_id, 'insurance', 0.01, '保費1%'),
(@card2_id, 'mobile_payment', 0.06, '行動支付最高6%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card2_id, '串流影音'),
(@card2_id, '美食外送回饋'),
(@card2_id, '線上購物回饋'),
(@card2_id, '訂房網回饋');

-- (範例) 行動支付支援 => 街口支付, etc.
INSERT INTO CreditCardPayment (credit_card_id, service_id)
SELECT @card2_id, service_id
FROM PaymentServices
WHERE service_name IN ('街口支付','Line Pay');

-- 3) 台新銀行 玫瑰悠遊Mastercard卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1USTJMDE3K0Ijj5jiDVofiRuzpV5TmBVe&sz=w1366',
  2,
  '玫瑰悠遊Mastercard卡',
  'Mastercard',
  '首年免年費(電子帳單)、最高3.3%紅利點'
);
SET @card3_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card3_id, 'domestic', 0.033, '國內最高3.3%'),
(@card3_id, 'overseas', 0.033, '海外最高3.3%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card3_id, '國內消費回饋'),
(@card3_id, '國外消費回饋'),
(@card3_id, '保險回饋'),
(@card3_id, '加油回饋');

-- 4) 台新銀行 太陽悠遊JCB卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1-2Rm_8b0GkcTGGcBJKpFrADbLrt5xVTv&sz=w1366',
  2,
  '太陽悠遊JCB卡',
  'JCB',
  '首年免年費(電子帳單)、最高3.3%紅利點'
);
SET @card4_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card4_id, 'domestic', 0.033, '國內最高3.3%'),
(@card4_id, 'overseas', 0.033, '海外最高3.3%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card4_id, '國內消費回饋'),
(@card4_id, '國外消費回饋'),
(@card4_id, '保險回饋'),
(@card4_id, '加油回饋');

-- 5) 滙豐銀行 現金回饋御璽卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1UlquHrU8TaiTZbvGIP3ZBu0JsGU_zomU&sz=w1366',
  1,
  '現金回饋御璽卡',
  'Visa',
  '首年免年費，保險分期享優惠'
);
SET @card5_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card5_id, 'domestic', 0.0122, '國內1.22%'),
(@card5_id, 'insurance', 0.0388, '不限公司險種分期');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card5_id, '國內消費回饋'),
(@card5_id, '國外消費回饋'),
(@card5_id, '無腦刷回饋'),
(@card5_id, '沒有回饋上限');

-- 6) 遠東商銀 遠東樂家+卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=18i_nfdm-kyKHS6xAs4ttHyt4PxYmHNf9&sz=w1366',
  3,
  '遠東樂家+卡',
  'Visa',
  '首年免年費，指定通路最高4%'
);
SET @card6_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card6_id, 'domestic', 0.005, '一般國內消費0.5%'),
(@card6_id, 'overseas', 0.035, '海外最高3.5%'),
(@card6_id, 'insurance', 0.03, '保險3%'),
(@card6_id, 'department_store', 0.04, '百貨4%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card6_id, '大賣場回饋'),
(@card6_id, '百貨公司回饋'),
(@card6_id, '餐飲回饋'),
(@card6_id, '影城回饋');

-- 7) 中國信託 LINE Pay卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1Dik1cyh5dGV2RhuimRUGSyilpvCxM5Ef&sz=w1366',
  4,
  'LINE Pay卡',
  'Visa',
  '行動支付/海外消費享回饋'
);
SET @card7_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card7_id, 'overseas', 0.05, '最高5% LINE POINTS'),
(@card7_id, 'mobile_payment', 0.01, '一般行動支付'),
(@card7_id, 'insurance', 0.01, '保險1%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card7_id, '行動支付回饋'),
(@card7_id, '旅行社折扣'),
(@card7_id, '餐飲回饋'),
(@card7_id, '線上購物回饋');

-- 8) 遠東商銀 快樂信用卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1uGiMSK1c96GdpE4DW07FsqVVMN4bVjXW&sz=w1366',
  3,
  '快樂信用卡',
  'Visa',
  '指定百貨/藥妝/網購最高5%，月月滿額'
);
SET @card8_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card8_id, 'domestic', 0.05, '特定通路5%'),
(@card8_id, 'overseas', 0.03, '外幣消費3%'),
(@card8_id, 'department_store', 0.05, '百貨最高5%'),
(@card8_id, 'public_transport', 0.03, '大眾運輸3%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card8_id, '百貨公司回饋'),
(@card8_id, '線上購物回饋'),
(@card8_id, '大眾運輸回饋'),
(@card8_id, '餐飲折扣');

-- 9) 台新銀行 @GoGo icash御璽卡
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1XJAJhnog2DemUDvpD5q37obasIHvGv2y&sz=w1366',
  2,
  '@GoGo icash御璽卡',
  'Visa',
  '行動支付最高20%紅利，週一~週四電影優惠'
);
SET @card9_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card9_id, 'mobile_payment', 0.20, '指定行動支付最高20%點數'),
(@card9_id, 'travel_insurance', 0.00, '旅平險最高2000萬'),
(@card9_id, 'movie', 0.40, '平日最低6折(非現金%)');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card9_id, '行動支付回饋'),
(@card9_id, '旅平險'),
(@card9_id, '線上購物回饋'),
(@card9_id, '繳稅優惠');

-- [範例] 這張卡文中提到「精選網購包含Shopee、momo、PChome、Yahoo、Amazon…」
--    因此可插入多筆 bridging:
INSERT INTO CreditCardEcom (credit_card_id, platform_id, special_info)
SELECT @card9_id, platform_id, '精選網購通路'
FROM EcommercePlatforms
WHERE platform_name IN ('Shopee','momo','PChome','Yahoo','Amazon','博客來','東森森森','Coupang');

-- 10) 滙豐銀行 Live+現金回饋卡 Premier
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1H_eaNsu_VwQgGWCm6Ll98C2DET20xzum&sz=w1366',
  1,
  'Live+現金回饋卡(Premier)',
  'Visa',
  '行動支付10%，海外5.88%，自動扣繳享加碼'
);
SET @card10_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card10_id, 'overseas', 0.0588, '精選國家最高5.88%'),
(@card10_id, 'domestic', 0.0488, '國內最高4.88%'),
(@card10_id, 'mobile_payment', 0.10, 'OPEN POINT 錢包10%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card10_id, '串流影音'),
(@card10_id, '美食外送回饋'),
(@card10_id, '線上購物回饋'),
(@card10_id, '訂房網回饋');

-- 11) 滙豐銀行 旅人御璽卡 Premier
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1jnHMhT9SqX5Pc3DhtKwp2Qe7fNPyvY4N&sz=w1366',
  1,
  '旅人御璽卡(Premier)',
  'Visa',
  '國內NT18=1哩,海外NT15=1哩,回饋無上限'
);
SET @card11_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card11_id, 'overseas', 0.0000, 'NT15=1哩(哩程回饋)'),
(@card11_id, 'domestic', 0.0000, 'NT18=1哩(哩程回饋)');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card11_id, '機場接送'),
(@card11_id, '機場貴賓室'),
(@card11_id, '旅平險'),
(@card11_id, '哩程回饋無上限');

-- 12) 滙豐銀行 匯鑽卡 Premier
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1SUt4I0UXPqybDr92LEM_xFbOxQRpRTKk&sz=w1366',
  1,
  '匯鑽卡(Premier)',
  'Visa',
  '最高6%回饋(含行動支付)；首年免年費'
);
SET @card12_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card12_id, 'domestic', 0.06, '指定通路最高6%'),
(@card12_id, 'insurance', 0.01, '保費1%'),
(@card12_id, 'mobile_payment', 0.06, '行動支付最高6%');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card12_id, '串流影音'),
(@card12_id, '美食外送回饋'),
(@card12_id, '線上購物回饋'),
(@card12_id, '訂房網回饋');

-- 13) 滙豐銀行 現金回饋御璽卡 Premier
INSERT INTO CreditCards (image_url, company_id, card_name, card_type, additional_benefits)
VALUES (
  'https://drive.google.com/thumbnail?id=1UlquHrU8TaiTZbvGIP3ZBu0JsGU_zomU&sz=w1366',
  1,
  '現金回饋御璽卡(Premier)',
  'Visa',
  '國內1.22%,海外2.22%,無上限'
);
SET @card13_id = LAST_INSERT_ID();

INSERT INTO CreditCardCashbacks (credit_card_id, category_name, reward_percent, info)
VALUES
(@card13_id, 'domestic', 0.0122, '無上限'),
(@card13_id, 'overseas', 0.0222, '無上限'),
(@card13_id, 'insurance', 0.0122, '保費分期');

INSERT INTO CreditCardFeatures (credit_card_id, feature_name) VALUES
(@card13_id, '國內消費回饋'),
(@card13_id, '國外消費回饋'),
(@card13_id, '無腦刷回饋'),
(@card13_id, '沒有回饋上限'),
(@card13_id, '串流影音'),
(@card13_id, '美食外送回饋'),
(@card13_id, '線上購物回饋'),
(@card13_id, '訂房網回饋');

-- Done