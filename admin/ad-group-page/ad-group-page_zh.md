# Ad Group 頁面中文說明

這份 Tampermonkey 腳本用來強化 Hourloop Amazon Ads 後台的 Ad Group 頁面，重點放在更穩定的批次勾選、快捷操作，以及排序後仍維持捲動位置。

## 功能摘要

- 滑鼠停留的列會顯示紅色外框。
- 已選取的列會顯示藍色外框與深色底。
- 右上角面板會顯示目前已選取筆數。
- 面板內可輸入數字，搭配 `Cmd/Ctrl + G` 快速選取前 N 筆有效列。
- 面板提供文字區塊，可貼上 ASIN 或 Ad Group Name 批次勾選。
- 執行排序或部分快捷操作後，會盡量保留原本的表格捲動位置，避免跳回頂部。
- `product_image_url` 欄位會自動加寬，讓圖片資訊更容易查看。

## 快捷鍵

- `Enter`：切換目前滑鼠停留列的選取狀態
- `Cmd/Ctrl + E`：全選或取消全選目前畫面中的有效列
- `Cmd/Ctrl + G`：依右上角輸入值，選取前 N 筆有效列
- `Cmd/Ctrl + B`：清空所有選取
- `Cmd/Ctrl + D`：開啟已選取列中的產品連結，最多 20 個分頁
- `Cmd/Ctrl + ↑ / ↓`：把選取往上一列或下一列移動
- `Cmd/Ctrl + 1 / 2 / 3 / 4 / 5`：觸發第 1 組表頭選單中的第 1 到第 5 個預設操作
- `Cmd/Ctrl + 6`：觸發第 2 組表頭選單中的第 1 個預設操作
- `Cmd/Ctrl + X`：觸發第 1 組表頭選單中的第 7 個預設操作

## 批次勾選面板

右上角面板提供兩個主要功能：

- 在輸入框貼上 ASIN 或 Ad Group Name，點擊「套用選取」後，腳本會比對表格資料並自動勾選符合項目。
- 點擊「清空」可直接取消所有已選取列。

比對完成後，腳本會將 `checkBox` 欄位排序到前面，同時盡量把原本的捲動位置保留下來。

## 適用網址

- `https://admin.hourloop.com/amazon_ads/sp/ad_groups?*`

## 安裝方式

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/)
2. 開啟下列安裝連結：
   `https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/ad-group-page/ad-group-page.user.js`
3. 在 Tampermonkey 中確認安裝並啟用腳本
4. 重新整理 Ad Group 頁面後開始使用

## 注意事項

- 此腳本直接依賴頁面上的 Tabulator 物件，不需要額外 `@require` 共用工具。
- 如果一次開啟過多產品連結，瀏覽器可能會擋住新分頁；腳本目前限制最多只開 20 個。
- 建議先在小量資料上測試批次選取與快捷鍵流程，再大範圍使用。
