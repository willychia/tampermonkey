# Target Page 頁面說明

這份 Tampermonkey 腳本用來強化 Hourloop Amazon Ads 後台合併後的 Target Page，保留原 Keyword Targeting 與 Product Targeting 兩頁共用的表格操作、批次選取、Bid 調整與匯出功能。

## 功能摘要

- 滑鼠停留的列會顯示紅色框線。
- 已選取的列會顯示黃色框線。
- 右上角會顯示目前已選取筆數。
- 右下角提供展開群組、收合群組、捲到最上方、捲到最下方按鈕。
- 針對部分欄位追加更方便的表頭篩選：
  - `stock_on_hand` 可直接做數值小於等於篩選
  - `last_buy_box_timestamp` 可用「幾小時內」方式篩選
  - `created_at` 可用「幾天內」方式篩選

## 快捷鍵

- `Enter`：切換目前滑鼠停留列的選取狀態
- `Cmd/Ctrl + A`：找出符合條件的列，將 Bid 自動更新為 `min(1, CPC)`，並逐筆送出儲存
- `Cmd/Ctrl + D`：找出高 ACOS 且適合降價的列，將 Bid 更新成計算後的 `target bid`，並逐筆送出儲存
- `Cmd/Ctrl + E`：全選或取消全選目前畫面中的有效列
- `Cmd/Ctrl + B`：清空所有選取
- `Cmd/Ctrl + S`：將目前表格資料匯出成 Excel
- `Cmd/Ctrl + ↑ / ↓`：把選取往上一列或下一列移動
- `Cmd/Ctrl + 1 / 2 / 3`：觸發第 2 組表頭選單中的第 1 到第 3 個預設操作
- `Cmd/Ctrl + 4`：觸發第 3 組表頭選單中的第 1 個預設操作
- `Cmd/Ctrl + X`：觸發第 4 組表頭選單中的第 1 個預設操作

## `Cmd/Ctrl + A` 自動調價條件

只有同時符合下列條件的列才會被自動勾選並更新 Bid：

- `days_of_supply > 7`
- `acos <= 0.1`
- `units_sold_same_sku > 0`
- `bid < 1`
- `bid < cpc`

更新時會把 Bid 設成 `min(1, CPC)`，並自動點擊儲存按鈕。

## `Cmd/Ctrl + D` 高 ACOS 自動降價邏輯

只有同時符合下列條件的列才會被自動勾選並更新 Bid：

- `acos > 0.2`
- `bid > target bid`

計算方式如下：

- `target bid = max(round(cpc * 0.2 / acos, 2), 0.05)`

符合條件時，Bid input 會直接被改成 `target bid`，並自動點擊儲存按鈕。

## 不包含的舊功能

- Product Targeting 舊頁面的 ASIN 批次勾選框已移除。
- Keyword Targeting 舊頁面的 `Cmd/Ctrl + F` 關鍵字詞數篩選已移除。

## 適用網址

- `https://admin.hourloop.com/amazon_ads/sp/targets?*`

## 安裝方式

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/)
2. 開啟下列安裝連結：
   `https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/target-page/target-page.user.js`
3. 在 Tampermonkey 中確認安裝並啟用腳本
4. 重新整理 Target Page 後開始使用

## 注意事項

- 本腳本依賴 `admin/shared/tabulator-page-utils.js`，會透過 `@require` 自動載入。
- 頁面重新渲染後，腳本會自動重新綁定 Tabulator，不需要手動重裝。
- 建議先在小量資料上測試快捷鍵與自動調價流程，再批次操作。
