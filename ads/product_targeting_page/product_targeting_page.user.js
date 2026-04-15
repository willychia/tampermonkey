// ==UserScript==
// @name         Product Targeting Page Enhanced Pro
// @namespace    http://tampermonkey.net/
// @version      2026.04.15.2
// @description  Product Targeting 加強版：Cmd+A 自動調價、Cmd+D 預填降價、ASIN 批次勾選、UI 優化
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/product_targets?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/product_targeting_page/product_targeting_page.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/product_targeting_page/product_targeting_page.user.js
// @require      https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/shared/tabulator_page_utils.js
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    "use strict";

    // -----------------------------
    // 基本設定與狀態
    // -----------------------------
    // 這裡定義產品投放頁面所需的 selector、UI 元件 id 與共用狀態，
    // 讓整份腳本在重複初始化時仍能維持一致行為。
    const SELECTOR = "#targets-table";
    // 在表格實例上標記初始化狀態，避免 SPA 切頁後重複綁同一套增強邏輯。
    const TABLE_FLAG = "__ptp_enhanced_bound";
    const COUNTER_ID = "selection-counter";
    const ASIN_BOX_ID = "asin-filter-box";
    const BUTTON_CLASS = "custom-float-btn";
    const utils = window.TMTabulatorPageUtils;
    if (!utils) {
        console.error("TMTabulatorPageUtils failed to load for product targeting page.");
        return;
    }
    let table = null;
    const hoveredState = { current: null };
    let keydownBound = false;
    let observerStarted = false;

    // -----------------------------
    // UI 樣式
    // -----------------------------
    // 這段負責注入 hover、selected、計數器、浮動按鈕與 ASIN 面板樣式，
    // 讓常用工具固定出現在畫面上且容易辨識。
    GM_addStyle(`
        .hover-highlight { border: 3px solid red !important; }
        .selected-highlight { border: 3px solid yellow !important; }
        #selection-counter {
            position: fixed; top: 10px; right: 80px; z-index: 9999;
            padding: 8px 15px; background: rgba(0, 0, 0, 0.7);
            color: white; border-radius: 5px; font-size: 14px; font-weight: bold; pointer-events: none;
        }
        .custom-float-btn {
            position: fixed; z-index: 9999; padding: 10px 15px;
            background: rgba(0, 0, 0, 0.7); color: white; border: none;
            border-radius: 5px; cursor: pointer; font-size: 14px;
        }
        .custom-float-btn:hover { background: black; }
        #asin-filter-box {
            position: fixed; top: 10px; right: 200px; z-index: 9999;
            background: #fff; border: 1px solid #ccc; padding: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2); border-radius: 8px;
        }
    `);

    // -----------------------------
    // 取得表格與初始化
    // -----------------------------
    // 每次表格出現或被前端重建時，都會從 init 進入，
    // 先補強欄位，再綁定互動與建立浮動 UI。
    function getTable() {
        return utils.getTableBySelector(SELECTOR);
    }

    function init() {
        table = getTable();
        if (!table) return;

        if (!table[TABLE_FLAG]) {
            setupColumns(table);
            bindTableEvents(table);
            table[TABLE_FLAG] = true;
        }

        setupUI();
        bindKeyboardOnce();
        updateCounter();
    }

    // -----------------------------
    // 欄位增強
    // -----------------------------
    // 這一段替 checkbox、庫存與 Buy Box 時間欄位補上更適合操作的定義，
    // 讓勾選排序與表頭篩選可以直接使用。
    function setupColumns(activeTable) {
        const columns = activeTable.getColumnDefinitions();
        // 第一欄補上 field 名稱後，才能把已選取列排到最上面。
        if (columns.length > 0) columns[0].field = "checkBox";

        const enhancedCols = columns.map((col) => {
            if (col.field === "stock_on_hand") {
                return {
                    ...col,
                    headerFilter: "number",
                    headerFilterFunc: "<=",
                    headerFilterPlaceholder: "Less than"
                };
            }

            if (col.field === "last_buy_box_timestamp") {
                return {
                    ...col,
                    headerFilter: "number",
                    headerFilterPlaceholder: "Hours within",
                    headerFilterFunc: (filterValue, cellValue) => {
                        const v = parseFloat(filterValue);
                        if (!Number.isFinite(v) || !cellValue) return true;
                        // 將絕對時間換算成距今小時數，方便直接用相對條件過濾 Buy Box 資料。
                        const hours = (Date.now() - new Date(cellValue).getTime()) / 36e5;
                        return hours <= v;
                    }
                };
            }

            return col;
        });

        activeTable.setColumns(enhancedCols);
    }

    // -----------------------------
    // 浮動 UI 與 ASIN 工具面板
    // -----------------------------
    // 建立選取計數器、上下捲動與群組操作按鈕，
    // 並提供一個可直接貼入 ASIN 做批次勾選的小面板。
    function setupUI() {
        utils.ensureCounter(COUNTER_ID, table ? `已選擇 ${table.getSelectedRows().length} 列` : "已選擇 0 列");
        utils.ensureButtons([
            { id: "ptp-btn-expand", text: "E", right: "100px", bottom: "120px", action: () => getTable()?.getGroups().forEach((g) => g.show()) },
            { id: "ptp-btn-collapse", text: "C", right: "100px", bottom: "60px", action: () => getTable()?.getGroups().forEach((g) => g.hide()) },
            { id: "ptp-btn-up", text: "⬆", right: "50px", bottom: "120px", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
            { id: "ptp-btn-down", text: "⬇", right: "50px", bottom: "60px", action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }
        ], BUTTON_CLASS);

        if (!document.getElementById(ASIN_BOX_ID)) {
            // 建立一個常駐的小工具面板，讓貼上 ASIN 後能直接批次勾選。
            const container = document.createElement("div");
            container.id = ASIN_BOX_ID;
            container.innerHTML = `
                <textarea id="asin-input" rows="5" style="width: 200px; display: block; margin-bottom: 5px;" placeholder="貼上 ASIN，一行一個"></textarea>
                <button id="apply-asin-filter" style="width: 100%; cursor: pointer;">勾選符合 ASIN</button>
            `;
            document.body.appendChild(container);
        }

        const applyBtn = document.getElementById("apply-asin-filter");
        if (applyBtn) applyBtn.onclick = applyAsinFilter;
    }

    function bindTableEvents(activeTable) {
        utils.bindSelectionState(activeTable, COUNTER_ID, hoveredState);
    }

    // -----------------------------
    // 鍵盤快捷鍵
    // -----------------------------
    // 這裡統一管理本頁常用快捷鍵，
    // 包含自動調價、全選/取消、匯出、上下移動與表頭選單。
    function bindKeyboardOnce() {
        if (keydownBound) return;
        keydownBound = true;

        document.addEventListener("keydown", (e) => {
            table = getTable();
            if (!table || utils.isEditingEvent(e)) return;

            const isMod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();

            if (e.key === "Enter" && hoveredState.current) {
                e.preventDefault();
                hoveredState.current.toggleSelect();
                return;
            }

            if (!isMod) return;

            // 保留頁面常用快捷操作，讓產品投放頁能快速做批次勾選與匯出。
            switch (key) {
                case "a":
                    e.preventDefault();
                    smartConditionSelectAndSave();
                    break;
                case "d":
                    e.preventDefault();
                    smartConditionSelectAndPrepareBidReduction();
                    break;
                case "arrowup":
                    e.preventDefault();
                    moveSelection(-1);
                    break;
                case "arrowdown":
                    e.preventDefault();
                    moveSelection(1);
                    break;
                case "e": {
                    e.preventDefault();
                    const activeRows = table.getRows("active");
                    const selectedActive = activeRows.filter((r) => r.isSelected());
                    selectedActive.length > 0 ? table.deselectRow(activeRows) : table.selectRow(activeRows);
                    break;
                }
                case "b":
                    e.preventDefault();
                    table.deselectRow();
                    break;
                case "s":
                    e.preventDefault();
                    table.download("xlsx", "product_targets.xlsx", { sheetName: "Data" });
                    break;
                case "1":
                case "2":
                case "3":
                case "4":
                    e.preventDefault();
                    openHeaderMenu(key === "4" ? 2 : 1, key === "4" ? 0 : parseInt(key, 10) - 1);
                    break;
                case "x":
                    e.preventDefault();
                    openHeaderMenu(3, 0);
                    break;
            }
        });
    }

    // -----------------------------
    // 自動調價流程
    // -----------------------------
    // Cmd/Ctrl + A 會篩出值得加價的 product target，
    // 並逐筆把 bid 更新成 min(1, CPC) 後觸發儲存。
    async function smartConditionSelectAndSave() {
        table = getTable();
        if (!table) return;

        table.deselectRow();
        const activeRows = table.getRows("active");
        const targetRows = [];

        activeRows.forEach((row) => {
            const data = row.getData();
            const daysOfSupply = parseFloat(data.days_of_supply) || 0;
            const acos = parseFloat(data.acos) || 0;
            const unitsSold = parseInt(data.units_sold_same_sku, 10) || 0;
            const bidVal = parseFloat(parseFloat(data.bid || 0).toFixed(2));
            const cpcVal = parseFloat(parseFloat(data.cpc || 0).toFixed(2));

            // 用相同商業條件挑出值得加價的 target，再統一執行儲存。
            if (daysOfSupply > 7 && acos <= 0.1 && unitsSold > 0 && bidVal < 1 && bidVal < cpcVal) {
                row.select();
                targetRows.push(row);
            }
        });

        if (targetRows.length === 0) {
            console.log("沒有符合條件的 Target");
            utils.showAlert("No product target rows matched the Cmd/Ctrl + A conditions.");
            return;
        }

        await sortByCheckBox();
        scrollFirstSelectedToTop();

        let count = 0;
        for (const row of targetRows) {
            const data = row.getData();
            const cpcVal = parseFloat(parseFloat(data.cpc || 0).toFixed(2));
            const newBid = Math.min(1, cpcVal).toFixed(2);

            const rowEl = row.getElement();
            const bidInput = rowEl?.querySelector('input[name="bid_fixed_value"]');
            const saveBtn = rowEl?.querySelector('button.save-bid-button[type="submit"]');

            if (!bidInput || !saveBtn) continue;

            // 透過事件模擬通知前端狀態已更新，避免只改 value 卻沒有觸發儲存邏輯。
            bidInput.value = newBid;
            bidInput.dispatchEvent(new Event("input", { bubbles: true }));
            bidInput.dispatchEvent(new Event("change", { bubbles: true }));
            bidInput.style.backgroundColor = "#c8e6c9";
            saveBtn.click();
            count++;
            await utils.wait(200);
        }

        console.log(`已儲存 ${count} 筆自動優化資料`);
    }

    // Cmd/Ctrl + D 會找出 ACOS 偏高且 bid 可下修的 target，
    // 預先填入計算後的新 bid，保留給使用者逐筆確認後再決定是否儲存。
    async function smartConditionSelectAndPrepareBidReduction() {
        table = getTable();
        if (!table) return;

        table.deselectRow();
        const activeRows = table.getRows("active");
        const targetRows = [];

        activeRows.forEach((row) => {
            const data = row.getData();
            const acos = parseFloat(data.acos) || 0;
            const bidVal = parseFloat(parseFloat(data.bid || 0).toFixed(2));
            const cpcVal = parseFloat(parseFloat(data.cpc || 0).toFixed(2));
            const targetBid = calculateHighAcosTargetBid({ acos, bidVal, cpcVal });

            if (acos > 0.2 && Number.isFinite(targetBid) && bidVal > targetBid) {
                row.select();
                targetRows.push({ row, targetBid });
            }
        });

        if (targetRows.length === 0) {
            console.log("沒有符合 Cmd/Ctrl + D 降價條件的 Target");
            utils.showAlert("No product target rows matched the Cmd/Ctrl + D conditions.");
            return;
        }

        await sortByCheckBox();
        scrollFirstSelectedToTop();

        let preparedCount = 0;
        for (const { row, targetBid } of targetRows) {
            const rowEl = row.getElement();
            const bidInput = rowEl?.querySelector('input[name="bid_fixed_value"]');

            if (!bidInput) continue;

            bidInput.value = targetBid.toFixed(2);
            bidInput.dispatchEvent(new Event("input", { bubbles: true }));
            bidInput.dispatchEvent(new Event("change", { bubbles: true }));
            bidInput.style.backgroundColor = "#fff3cd";
            preparedCount++;
        }

        console.log(`已預填 ${preparedCount} 筆高 ACOS Target 的新 Bid，尚未儲存`);
    }

    // -----------------------------
    // ASIN 批次勾選
    // -----------------------------
    // 這段負責解析使用者貼上的 ASIN 清單，
    // 再從資料欄位或畫面連結中抓出 ASIN 進行比對與勾選。
    async function applyAsinFilter() {
        table = getTable();
        if (!table) return;

        const text = document.getElementById("asin-input")?.value.trim();
        if (!text) return;

        // 接受換行、空白、逗號混合貼上的格式，先標準化成 ASIN 集合。
        const asinSet = new Set(
            text
                .split(/[\s,]+/)
                .map((asin) => asin.trim().toUpperCase().replace(/^"|"$/g, ""))
                .filter(Boolean)
        );

        table.deselectRow();
        let count = 0;

        table.getRows().forEach((row) => {
            const data = row.getData();
            const rowEl = row.getElement();
            let asin = (data.match_expression_value || "").toUpperCase();

            // 若資料欄位沒有 ASIN，就退回從畫面上的連結文字擷取。
            if (!asin && rowEl) {
                const asinLink = rowEl.querySelector('a[href*="asin:"]');
                asin = asinLink ? asinLink.textContent.trim().toUpperCase() : "";
            }

            if (asinSet.has(asin)) {
                row.select();
                count++;
            }
        });

        await sortByCheckBox();
        utils.scrollFirstSelectedToTop(table);
        console.log(`共勾選 ${count} 筆符合 ASIN 的資料`);
    }

    function calculateHighAcosTargetBid({ acos, bidVal, cpcVal }) {
        if (!(acos > 0.2) || !(bidVal > 0) || !(cpcVal > 0)) return NaN;

        const rawTargetBid = cpcVal * 0.1 / acos;
        const roundedTargetBid = Math.round(rawTargetBid * 100) / 100;

        return Math.max(roundedTargetBid, 0.02);
    }

    // -----------------------------
    // 單列移動與表頭選單
    // -----------------------------
    // 這些 helper 讓鍵盤操作可以快速在相鄰列之間切換，
    // 或直接呼叫 Tabulator 表頭選單的既有功能。
    function moveSelection(direction) {
        table = getTable();
        if (!table) return;

        const selected = table.getSelectedRows();
        if (selected.length === 0) return;

        const targetRow = direction > 0 ? selected[selected.length - 1].getNextRow() : selected[0].getPrevRow();
        if (!targetRow) return;

        table.deselectRow();
        targetRow.select();
        targetRow.getElement()?.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    function openHeaderMenu(colIdx, optIdx) {
        const buttons = document.querySelectorAll(".tabulator-header-popup-button");
        if (!buttons[colIdx]) return;

        buttons[colIdx].click();
        setTimeout(() => {
            const items = document.querySelectorAll(".tabulator-menu-item");
            if (items[optIdx]) items[optIdx].click();
        }, 200);
    }

    async function sortByCheckBox() {
        table = getTable();
        if (!table) return;
        await utils.sortByField(table, "checkBox", "desc");
    }

    // -----------------------------
    // 定位、計數器與重建監聽
    // -----------------------------
    // 排序或勾選完成後會把畫面捲到第一筆已選資料，
    // 並透過 observer 在 SPA 重建後重新套用整套功能。
    function scrollFirstSelectedToTop() {
        table = getTable();
        if (!table) return;

        const selected = table.getSelectedRows()[0];
        if (selected) {
            table.scrollToRow(selected, "top", false);
        }
        updateCounter();
    }

    function updateCounter() {
        const counterDiv = document.getElementById(COUNTER_ID);
        if (counterDiv && table) {
            counterDiv.innerText = `已選擇 ${table.getSelectedRows().length} 列`;
        }
    }

    function startInitObserver() {
        if (observerStarted) return;
        observerStarted = true;

        // 表格由前端動態生成時，重新跑 init 以確保 UI 與事件都被補上。
        utils.startInitObserver(SELECTOR, init);
    }

    // -----------------------------
    // 啟動入口
    // -----------------------------
    // 啟動 observer 後，就能在頁面第一次載入與後續重渲染時，
    // 自動替產品投放表格補上所有增強功能。
    startInitObserver();
})();
