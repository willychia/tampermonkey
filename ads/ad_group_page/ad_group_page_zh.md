# Admin Ad Group Additional Function

此 Tampermonkey 腳本可增強 Hourloop 的 Amazon Ads 管理介面中使用的 Tabulator 表格。

## 📌 說明

該腳本提供一套 UI 和功能強化，用於與廣告組互動，包括：

### ✅ 核心功能

- **滑鼠懸停highlight**：當滑鼠懸停時，行會highlight顯示為紅色。  
- **行選取邊框**：被選取的行會顯示白色邊框。  
- **選取計數器**：右上角浮動顯示選取的行數。  
- **鍵盤快捷鍵**：  
  - `Enter`：切換懸停行的選取狀態。  
  - `Cmd/Ctrl + ↑ / ↓`：向上/向下移動選取。  
  - `Cmd/Ctrl + E`：全選或取消全選。  
  - `Cmd/Ctrl + F`：highlight顯示 `num_enabled_targets < 10` 的行，並自動捲動至第一筆匹配項目。  
  - `Cmd/Ctrl + B`：清除highlight和選取。  
  - `Cmd/Ctrl + D`：打開所選行的產品圖片連結。  
  - `Cmd/Ctrl + K`：打開所選行的 `num_enabled_targets` 連結。  
  - `Cmd/Ctrl + S`：將篩選後的表格資料匯出至 Excel。  
  - `Cmd/Ctrl + J`：選取所有缺少產品圖片 URL 的行。
  - `Cmd/Ctrl + X`：複製所選取行的Ad Group Name。  
  - `Cmd/Ctrl + 1-5`：按欄位標題選單項（依索引點擊）。  
- **捲動按鈕**：右下角的按鈕可快速捲動至頁面頂部/底部。  
- **群組展開/收合按鈕**：按鈕可展開或收合群組行。  
- **ASIN 篩選框**：手動輸入 ASIN，自動選取匹配的行。  

## 🌐 匹配 URL

- `https://admin.hourloop.com/amazon_ads/sp/ad_groups?*`

## 🛠 安裝需求

- 已安裝 Tampermonkey 擴充套件的瀏覽器
- 頁面需使用具有 `#ad-groups-table` ID 的 Tabulator 實例

## 📥 安裝方式

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/)  
2. 建立新腳本並貼上 `Admin Ad Group Additional Function-2.0.user.js` 的內容  
3. 儲存腳本並確保在造訪匹配 URL 時已啟用
