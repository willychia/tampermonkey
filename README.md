# TamperMonkey 工具集

這個專案收錄 Ads Team 使用的 Tampermonkey 腳本，主要用於 Amazon 前台頁面與 Hourloop Amazon Ads 後台頁面。

## 腳本清單

- `amazon/detail-page-to-product-targeting/detail-page-to-product-targeting.user.js`
  Amazon 商品頁工具，用於整理 Product Targeting 候選 ASIN、放大圖片、勾選清單與 OpenAI search term strategies。
- `amazon/search-result-filter/search-result-filter.user.js`
  Amazon 搜尋結果頁工具，支援 ASIN 篩選、Detail Page `tm_*` 參數篩選與複製。
- `admin/product-targeting-page/product-targeting-page.user.js`
  Product Targeting 後台工具，支援批次勾選、ASIN 篩選與 Bid 調整。
- `admin/keyword-targeting-page/keyword-targeting-page.user.js`
  Keyword Targeting 後台工具，支援批次勾選、長尾字詞篩選與 Bid 調整。
- `admin/ad-group-page/ad-group-page.user.js`
  Ad Group 後台工具，支援批次勾選、快速開啟與排序後保留捲動位置。
- `admin/shared/tabulator-page-utils.js`
  共用工具，提供 Tabulator 頁面腳本使用的 helper functions。

## 中文說明文件

- `amazon/detail-page-to-product-targeting/detail-page-to-product-targeting_zh.md`
  中文說明：Amazon Detail Page Product Targeting 候選面板
- `admin/product-targeting-page/product-targeting-page_zh.md`
  中文說明：Product Targeting 頁面腳本
- `admin/keyword-targeting-page/keyword-targeting-page_zh.md`
  中文說明：Keyword Targeting 頁面腳本
- `admin/ad-group-page/ad-group-page_zh.md`
  中文說明：Ad Group 頁面腳本

## 安裝連結

- [Amazon Detail](https://raw.githubusercontent.com/willychia/tampermonkey/main/amazon/detail-page-to-product-targeting/detail-page-to-product-targeting.user.js)
- [Amazon Search](https://raw.githubusercontent.com/willychia/tampermonkey/main/amazon/search-result-filter/search-result-filter.user.js)
- [Product Targeting](https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/product-targeting-page/product-targeting-page.user.js)
- [Keyword Targeting](https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/keyword-targeting-page/keyword-targeting-page.user.js)
- [Ad Group](https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/ad-group-page/ad-group-page.user.js)

## 維護注意事項

- 每個頁面腳本都直接維護在對應的 `.user.js` 檔案中。
- 安裝與更新請使用上方 `.user.js` 連結，Tampermonkey 才會辨識為可安裝的 userscript。
- Product Targeting 與 Keyword Targeting 會透過 Tampermonkey `@require` 共用 `admin/shared/tabulator-page-utils.js`。
- Hourloop 後台頁面依賴 Tabulator table，因此相關腳本會讀取頁面上的 Tabulator instance。
- 各頁面的中文說明文件放在腳本旁邊，檔名以 `_zh.md` 結尾。
- 版本號採用日期格式，方便追蹤每次發布。

## 建議檢查流程

1. 修改對應頁面的 `.user.js` 腳本。
2. 重新整理 Amazon 或 Hourloop 頁面。
3. 先用少量資料測試快捷鍵與批次操作，再套用到大量資料。
