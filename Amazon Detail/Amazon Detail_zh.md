# Amazon Detail Product Targeting 面板中文說明

這份 Tampermonkey 腳本用在 Amazon 商品 Detail Page。它會站在目前商品 ASIN 的角度，整理頁面中適合拿來做 Product Targeting 的候選 ASIN，並可用 OpenAI API 產生 Core Keywords 與搜尋連結。

## 功能摘要

- 在商品頁右側顯示 Product Targeting 候選面板。
- 自動取得目前商品 ASIN、標題與網址。
- 從頁面可見推薦模組擷取候選 ASIN 與圖片，並分成：
  - `直接競品`
  - `互補品`
  - `待確認`
- 每個分類最多顯示 10 個 ASIN。
- 候選 ASIN 預設全部勾選；取消勾選後，複製時不會輸出該 ASIN。
- 同一 ASIN 會自動去重；若出現在多個模組，會合併來源並提高排序。
- 可使用 OpenAI API 產生 3 到 5 組 Core Keywords 與 Amazon Search 連結。
- 若未設定 OpenAI API key，或 API 呼叫失敗，會自動退回規則版 Core Keywords。
- 支援在面板中手動編輯 Core Keywords，搜尋連結會即時更新。
- 可複製 Markdown 格式的 Product Targeting 候選清單。

## 快捷鍵

- `Cmd/Ctrl + G`：重新掃描目前 Detail Page 並更新面板。
- `Cmd/Ctrl + D`：複製 Markdown 格式的候選 ASIN 清單。
- `Cmd/Ctrl + B`：顯示或隱藏面板。

若游標正在輸入框、文字區塊、下拉選單或可編輯文字區域中，快捷鍵不會觸發。

## 分類邏輯

### 直接競品

優先從下列類型模組取得：

- Compare with similar items
- Similar items
- Customers also viewed
- Products related to this item

排序時會優先考慮 Compare / Similar 來源、多來源重複出現，以及有圖片資料的 ASIN。

### 互補品

優先從下列類型模組取得：

- Frequently bought together
- Buy it with
- Customers also bought
- 配件、替換品、組合購買相關區塊

排序時會優先考慮 Frequently bought together / Buy it with 來源，以及多來源重複出現的 ASIN。

### 待確認

來源語意不明或一般推薦模組中的 ASIN 會放在待確認。這些 ASIN 需要人工判斷是否同用途、互補或不相關。

## Core Keywords 規則

面板提供 OpenAI API key 與 model 欄位。儲存後，`Cmd/Ctrl + G` 會把目前商品資訊送到 OpenAI，要求回傳 3 到 5 組適合用來搜尋競品 ASIN 的 core keywords。

送出的資料包含：

- 商品標題
- 品牌
- Bullet points
- Breadcrumb / 類目
- BSR / 類目文字
- 變體資訊

OpenAI 回傳格式會被解析成：

- keyword
- score
- reason

若沒有設定 API key，或 OpenAI 呼叫失敗，腳本會使用內建規則產生 2 到 4 個字的 keyword candidates。

加分來源：

- 出現在標題
- 出現在 breadcrumb 或 BSR 類目
- 出現在 bullet points
- 同一詞組出現在多個來源

扣分或排除來源：

- 品牌詞
- 顏色
- pack count
- 尺寸單位
- 過度行銷詞
- 單字 keyword
- 過長 keyword

腳本不跨頁自動爬搜尋結果，高流量候選仍以 Core Keywords 的 Amazon Search links 呈現。

## 複製內容

`Cmd/Ctrl + D` 會複製 Markdown，包含：

- 主商品 ASIN、標題、URL
- Core Keywords 與 Search links
- 已勾選的 Direct Competitors ASIN 與圖片 URL，最多 10 個
- 已勾選的 Complementary Products ASIN 與圖片 URL，最多 10 個
- 已勾選的 Need Review ASIN 與圖片 URL，最多 10 個
- High Traffic Research Links

若某一區沒有抓到候選，會顯示 `No candidates found on current page`。

## 適用網址

- `https://www.amazon.com/dp/*`
- `https://www.amazon.com/*/dp/*`
- `https://www.amazon.com/gp/product/*`

## 安裝方式

1. 安裝 [Tampermonkey](https://www.tampermonkey.net/)
2. 開啟下列安裝連結：
   `https://raw.githubusercontent.com/willychia/tampermonkey/main/Amazon%20Detail/Amazon%20Detail.user.js`
3. 在 Tampermonkey 中確認安裝並啟用腳本。
4. 開啟 Amazon 商品 Detail Page 後使用快捷鍵。

## 注意事項

- Amazon Detail Page 的推薦模組會依商品、登入狀態、地區與載入時機而不同。
- 腳本只掃描目前頁面已載入的 DOM，不會自動開啟其他頁面。
- 高流量候選以 Core Keywords 的 Amazon Search links 呈現，需要點出去後再用 Search Results 腳本收集。
- OpenAI API key 會儲存在 Tampermonkey 的腳本儲存區。這比寫在程式碼中安全，但仍建議使用專用 API key。
