import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import mysql.connector
import time

# 匯率
USD_TO_TWD = 32.3

# MySQL 設定
db_config = {
    'user': 'root',              # <- 改成你的 MySQL 帳號
    'password': 'Akagikaga1941', # <- 改成你的 MySQL 密碼
    'host': 'localhost',
    'database': 'credit_card_optimizer',
    'charset': 'utf8mb4'
}

# 將價格資訊寫入 SQL
def insert_price_data(url, domain, price_str, currency, twd_price):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        sql = '''
            INSERT INTO ProductPrices (url, domain, original_price_str, currency, price_in_twd)
            VALUES (%s, %s, %s, %s, %s)
        '''
        cursor.execute(sql, (url, domain, price_str, currency, twd_price))
        conn.commit()
        print("✅ 成功寫入 SQL 資料庫！")
    except mysql.connector.Error as err:
        print("❌ 資料庫錯誤：", err)
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# 網站判斷
def detect_site(url):
    hostname = urlparse(url).hostname
    if hostname is None:
        return 'unknown'
    if 'pchome.com.tw' in hostname:
        return 'pchome'
    elif 'amazon.' in hostname:
        return 'amazon'
    elif 'momoshop.com.tw' in hostname:
        return 'momo'
    elif 'books.com.tw' in hostname:
        return 'books'
    elif 'coupang.com' in hostname:
        return 'coupang'
    else:
        return 'unknown'

# PChome 價格擷取
def scrape_price_pchome(url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    res = requests.get(url, headers=headers)
    soup = BeautifulSoup(res.text, 'html.parser')
    discount_price_tag = soup.find('div', class_='o-prodPrice__price')
    discount_price = discount_price_tag.text.strip() if discount_price_tag else "找不到"
    currency = "TWD"
    try:
        twd_price = float(discount_price.replace("$", "").replace(",", ""))
    except:
        twd_price = 0.0
    return discount_price, currency, twd_price

# Amazon 價格擷取
def scrape_price_amazon(url):
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get(url)
    time.sleep(3)
    try:
        symbol = driver.find_element(By.CLASS_NAME, 'a-price-symbol').text
        whole = driver.find_element(By.CLASS_NAME, 'a-price-whole').text.replace(",", "")
        fraction = driver.find_element(By.CLASS_NAME, 'a-price-fraction').text
        price_str = f"{symbol}{whole}.{fraction}"
        currency = "USD" if "US$" in symbol or "$" in symbol else "TWD"
        price = float(f"{whole}.{fraction}")
    except Exception as e:
        print("❌ 無法擷取 Amazon 價格：", e)
        driver.quit()
        return "找不到", "未知", 0.0
    driver.quit()
    twd_price = convert_to_twd(price, currency)
    return price_str, currency, twd_price

# Coupang 價格擷取
def scrape_price_coupang(url):
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get(url)
    time.sleep(5)
    try:
        soup = BeautifulSoup(driver.page_source, "html.parser")
        discount_price_tag = soup.select_one("div.rvisdp-price__final")
        discount_price = discount_price_tag.text.strip().replace(",", "").replace("$", "") if discount_price_tag else None
        original_price_tag = soup.select_one("div.rvisdp-price__original")
        original_price = original_price_tag.text.strip().replace(",", "").replace("$", "") if original_price_tag else None
        driver.quit()
        if discount_price and discount_price.isdigit():
            return f"${discount_price}", "TWD", int(discount_price)
        elif original_price and original_price.isdigit():
            return f"${original_price}", "TWD", int(original_price)
    except Exception as e:
        print("❌ Coupang 價格擷取失敗：", e)
        driver.quit()
    return "找不到", "未知", 0.0

# momo 價格擷取
def scrape_price_momo(url):
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get(url)
    time.sleep(5)
    try:
        soup = BeautifulSoup(driver.page_source, "html.parser")
        seo_prices = soup.select("span.seoPrice")
        prices = []
        for tag in seo_prices:
            text = tag.get_text(strip=True).replace(",", "").replace("$", "")
            if text.isdigit():
                prices.append(int(text))
        if prices:
            min_price = min(prices)
            driver.quit()
            return f"${min_price}", "TWD", min_price
        price_tag = soup.select_one("span.price")
        if price_tag and price_tag.text.strip().replace(",", "").isdigit():
            price = int(price_tag.text.strip().replace(",", ""))
            driver.quit()
            return f"${price}", "TWD", price
    except Exception as e:
        print("❌ momo 價格擷取失敗：", e)
        driver.quit()
    return "找不到", "未知", 0.0

# 博客來價格擷取
def scrape_price_books(url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    res = requests.get(url, headers=headers)
    soup = BeautifulSoup(res.text, 'html.parser')
    try:
        discount_tag = soup.select_one("strong.price01 > b")
        original_tag = soup.select_one("ul.price li em")
        discount = discount_tag.text.strip() if discount_tag else None
        original = original_tag.text.strip() if original_tag else None
        if discount and discount.isdigit():
            return f"${discount}", "TWD", int(discount)
        elif original and original.isdigit():
            return f"${original}", "TWD", int(original)
    except Exception as e:
        print("❌ 博客來價格擷取失敗：", e)
    return "找不到", "未知", 0.0

# 匯率轉換
def convert_to_twd(amount, currency):
    if currency == "USD":
        return round(amount * USD_TO_TWD, 2)
    return amount

# 主程式
def main():
    url = input("請輸入商品網址（支援 PChome、Amazon、momo、博客來、Coupang）：\n")
    site = detect_site(url)

    if site == 'pchome':
        price_str, currency, twd_price = scrape_price_pchome(url)
    elif site == 'amazon':
        price_str, currency, twd_price = scrape_price_amazon(url)
    elif site == 'momo':
        price_str, currency, twd_price = scrape_price_momo(url)
    elif site == 'books':
        price_str, currency, twd_price = scrape_price_books(url)
    elif site == 'coupang':
        price_str, currency, twd_price = scrape_price_coupang(url)
    else:
        print("❌ 不支援的網站")
        return

    print("\n【擷取結果】")
    print(f"網站平台：{site}")
    print(f"原始價格：{price_str}")
    print(f"幣別：{currency}")
    print(f"換算台幣：約 {twd_price} 元")

    # ✅ 寫入資料庫
    insert_price_data(url, site, price_str, currency, twd_price)

if __name__ == "__main__":
    main()