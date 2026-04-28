# Amazon Search Result Filter 說明

這份 Tampermonkey 腳本用在 Amazon 搜尋結果頁。它會在每個非 Sponsored 商品卡片上方加入 ASIN 操作列，方便快速篩選、勾選並複製候選 ASIN。

## 功能摘要

- 在 Amazon 搜尋結果商品卡片上方顯示 ASIN、標題、評分、評論數與價格。
- 自動略過 Sponsored 商品。
- 頁面載入後會預設勾選前 10 個商品。
- 可依最高數量、最低價格、最低評分、最高評分、最少評論數、包含單詞與排除單詞進行篩選。
- 支援從 Amazon Detail 腳本帶入 `tm_*` 篩選參數，並自動套用。
- 可手動點擊商品操作列切換勾選狀態。
- 可複製已勾選 ASIN，輸出順序會依照頁面出現順序排列。
- 支援動態載入結果，搜尋頁往下捲動載入新商品後會自動補上操作列。
- 面板可拖曳、縮小、隱藏，位置與顯示狀態會保留。

## 快捷鍵

- `Cmd/Ctrl + G`：依目前面板條件重新篩選。
- `Cmd/Ctrl + D`：複製已勾選 ASIN，一行一個。
- `Cmd/Ctrl + E`：清空目前勾選。
- `Cmd/Ctrl + B`：顯示或隱藏篩選面板。

## 面板欄位

- 最大數量：篩選後最多勾選幾個商品。
- 最低價格：只選擇價格大於或等於此數值的商品。
- 最低評分：只選擇 rating 大於或等於此數值的商品。
- 最高評分：只選擇 rating 小於或等於此數值的商品。
- 最少評論數：只選擇 reviews 大於或等於此數值的商品。
- 排除單詞：商品標題包含任一排除詞時不勾選。
- 包含單詞：商品標題必須包含所有指定詞才會勾選。

包含與排除單詞可用空白、逗號或全形逗號分隔。

## Detail Page 連動參數

當從 Amazon Detail 腳本產生的 Search Term Strategy 連結進入搜尋結果頁時，此腳本會讀取網址中的 `tm_*` 參數並填入面板：

- `tm_min_price`：最低價格。
- `tm_min_rating`：最低評分。
- `tm_max_rating`：最高評分。
- `tm_min_reviews`：最少評論數。
- `tm_intent`：顯示策略意圖，例如 substitute、complementary 或 subject/IP。

若網址中有上述參數，腳本會在載入後自動執行一次篩選。

## 複製內容

`Cmd/Ctrl + D` 會複製目前已勾選的 ASIN，一行一個。若同一個 ASIN 在頁面中重複出現，只會輸出一次。

## 適用網址

- `https://www.amazon.com/s?*`
- `https://www.amazon.co.uk/s?*`
- `https://www.amazon.co.jp/s?*`

## 安裝方式

1. 開啟下方 userscript 連結：
   `https://raw.githubusercontent.com/willychia/tampermonkey/main/amazon/search-result-filter/search-result-filter.user.js`
2. Tampermonkey 會自動開啟安裝頁面。
3. 點選安裝後，重新整理 Amazon 搜尋結果頁即可使用。

## 注意事項

- Amazon 搜尋結果 DOM 可能因站點、語言或版面測試而不同，若抓不到價格、評分或評論數，該欄位會以預設值處理。
- 此腳本只處理目前瀏覽器已載入的搜尋結果，不會自動跨頁爬取。
- 篩選與複製都以目前頁面上已載入的商品為準。
