DROP DATABASE IF EXISTS credit_card_optimizer;
CREATE DATABASE credit_card_optimizer;
USE credit_card_optimizer;

-- 使用者表
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role ENUM('user', 'admin') DEFAULT 'user'
);

-- 信用卡公司表
CREATE TABLE CreditCardCompanies (
    company_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(100) NOT NULL,
    company_description TEXT
);

-- 信用卡表
CREATE TABLE CreditCards (
    credit_card_id INT PRIMARY KEY AUTO_INCREMENT,
    image_url VARCHAR(255),
    company_id INT NOT NULL,
    card_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(50),
    reward_categories JSON,
    additional_benefits JSON,
    FOREIGN KEY (company_id) REFERENCES CreditCardCompanies(company_id)
);

-- 使用者個人信用卡表
CREATE TABLE UserPersonalCreditCards (
    user_id INT NOT NULL,
    credit_card_id INT NOT NULL,
    PRIMARY KEY (user_id, credit_card_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (credit_card_id) REFERENCES CreditCards(credit_card_id)
);

-- 網站類別表
CREATE TABLE WebsiteCategories (
    domain VARCHAR(200) PRIMARY KEY,
    category VARCHAR(50) NOT NULL
);

INSERT INTO Users (username, password, email, role) VALUES
('testuser', '$2b$10$NyLwRcFtw/wQ8wC5Q8.w.eM35A1FlNtHd1AcM/12T1S1v3WiFLYne', 'testuser@example.com', 'admin');

INSERT INTO CreditCardCompanies (company_name, company_description) VALUES
('滙豐銀行', '提供多元現金回饋與優惠方案'),
('台新銀行', '提供多種悠遊卡與紅利優惠'),
('遠東商銀', '提供專業的金融與信用卡服務');

INSERT INTO CreditCards (company_id, card_name, card_type, reward_categories, additional_benefits, image_url) VALUES
(1, 'Live+現金回饋卡', 'Visa', '{"domestic": 0.0488, "overseas": 0.0588, "insurance": 0.0088, "department_store": 0.0388}', '{}', 'https://drive.google.com/thumbnail?id=1H_eaNsu_VwQgGWCm6Ll98C2DET20xzum&sz=w1366'),
(1, '匯鑽卡', 'Visa', '{"domestic": 0.06, "mobile_payment": 0.06, "insurance": 0.01}', '{"annual_fee": "首年免年費"}', 'https://drive.google.com/thumbnail?id=1SUt4I0UXPqybDr92LEM_xFbOxQRpRTKk&sz=w1366'),
(2, '玫瑰悠遊Mastercard卡', 'Mastercard', '{"domestic": 0.033, "overseas": 0.033}', '{"annual_fee": "首年免年費"}', 'https://drive.google.com/thumbnail?id=1USTJMDE3K0Ijj5jiDVofiRuzpV5TmBVe&sz=w1366'),
(2, '太陽悠遊JCB卡', 'JCB', '{"domestic": 0.033, "overseas": 0.033}', '{"annual_fee": "首年免年費"}', 'https://drive.google.com/thumbnail?id=1-2Rm_8b0GkcTGGcBJKpFrADbLrt5xVTv&sz=w1366'),
(1, '現金回饋御璽卡', 'Visa', '{"domestic": 0.0122, "insurance": 0.0388}', '{"annual_fee": "首年免年費", "travel_insurance": "2000萬"}', 'https://drive.google.com/thumbnail?id=1UlquHrU8TaiTZbvGIP3ZBu0JsGU_zomU&sz=w1366'),
(3, '遠東樂家+卡', 'Visa', '{"domestic": 0.005, "overseas": 0.035, "insurance": 0.03, "department_store": 0.04}', '{}', 'https://drive.google.com/thumbnail?id=18i_nfdm-kyKHS6xAs4ttHyt4PxYmHNf9&sz=w1366');

INSERT INTO WebsiteCategories (domain, category) VALUES
('shopee.tw', 'domestic'),
('amazon.com', 'overseas'),
('pchome.com.tw', 'domestic');