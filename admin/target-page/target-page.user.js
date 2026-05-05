// ==UserScript==
// @name         Ads Team Toolbox - Admin - Target Page
// @namespace    http://tampermonkey.net/
// @version      2026.05.05.2
// @description  Target Page 加強版：批次選取、匯出與 UI 優化
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/targets?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/target-page/target-page.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/target-page/target-page.user.js
// @require      https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/shared/tabulator-page-utils.js
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    "use strict";

    // -----------------------------
    // 基本設定與狀態
    // -----------------------------
    // Target Page 由原 Keyword/Product Targeting 頁合併而來，
    // 這裡保留兩邊共用的 Tabulator 操作與批次調價狀態。
    const SELECTOR = "#targets-table";
    const TABLE_FLAG = "__target_page_enhanced_bound";
    const COUNTER_ID = "selection-counter";
    const BUTTON_CLASS = "custom-float-btn";
    const EXPORT_FILE_NAME = "targets.xlsx";
    const utils = window.TMTabulatorPageUtils;
    if (!utils) {
        console.error("TMTabulatorPageUtils failed to load for target page.");
        return;
    }
    let table = null;
    const hoveredState = { current: null };
    let keydownBound = false;
    let observerStarted = false;

    // -----------------------------
    // UI 樣式
    // -----------------------------
    // 注入 hover、selected、選取計數器與浮動按鈕樣式，
    // 讓 Target Page 保留原本兩頁都有的操作回饋。
    GM_addStyle(`
        .hover-highlight { border: 3px solid red !important; }
        .selected-highlight { border: 3px solid yellow !important; }
        #selection-counter {
            position: fixed; top: 10px; right: 80px; z-index: 9999;
            padding: 8px 15px; background: rgba(0, 0, 0, 0.7);
            color: white; border-radius: 5px; font-size: 14px; font-weight: bold;
            pointer-events: none;
        }
        .custom-float-btn {
            position: fixed; z-index: 9999; padding: 10px 15px;
            background: rgba(0, 0, 0, 0.7); color: white; border: none;
            border-radius: 5px; cursor: pointer; font-size: 14px;
        }
        .custom-float-btn:hover { background: black; }
    `);

    // -----------------------------
    // 取得表格與初始化
    // -----------------------------
    // 表格出現或由 SPA 重建後，會重新補上欄位設定、事件與浮動 UI。
    function getTable() {
        return utils.getTableBySelector(SELECTOR);
    }

    function init() {
        table = getTable();
        if (!table) return;

        utils.installScrollPersistence("target-page", SELECTOR);

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
    // 整合 Keyword/Product 兩頁的欄位 filter：
    // 庫存可做 <= 篩選，Buy Box 與建立時間可用相對時間篩選。
    function setupColumns(activeTable) {
        const columns = activeTable.getColumnDefinitions();
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

            if (col.field === "last_buy_box_timestamp" || col.field === "created_at") {
                const isCreatedAt = col.field === "created_at";
                return {
                    ...col,
                    headerFilter: "number",
                    headerFilterPlaceholder: isCreatedAt ? "Days within" : "Hours within",
                    headerFilterFunc: (filterValue, cellValue) => {
                        const v = parseFloat(filterValue);
                        if (!Number.isFinite(v) || !cellValue) return true;
                        const diffHours = (Date.now() - new Date(cellValue).getTime()) / 36e5;
                        return (isCreatedAt ? diffHours / 24 : diffHours) <= v;
                    }
                };
            }

            return col;
        });

        activeTable.setColumns(enhancedCols);
    }

    // -----------------------------
    // 浮動 UI
    // -----------------------------
    // 建立選取計數器與上下捲動、展開收合群組按鈕。
    function setupUI() {
        utils.ensureCounter(COUNTER_ID, table ? `已選擇 ${table.getSelectedRows().length} 列` : "已選擇 0 列");
        utils.ensureButtons([
            { id: "target-btn-expand", text: "E", right: "100px", bottom: "120px", action: () => getTable()?.getGroups().forEach((g) => g.show()) },
            { id: "target-btn-collapse", text: "C", right: "100px", bottom: "60px", action: () => getTable()?.getGroups().forEach((g) => g.hide()) },
            { id: "target-btn-up", text: "⬆", right: "50px", bottom: "120px", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
            { id: "target-btn-down", text: "⬇", right: "50px", bottom: "60px", action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }
        ], BUTTON_CLASS);
    }

    function bindTableEvents(activeTable) {
        utils.bindSelectionState(activeTable, COUNTER_ID, hoveredState);
    }

    // -----------------------------
    // 鍵盤快捷鍵
    // -----------------------------
    // 保留原兩頁共用快捷鍵，移除舊 Keyword-only 的 Cmd/Ctrl + F 與 Product-only ASIN 工具。
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

            switch (key) {
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
                    const selectedActiveCount = activeRows.filter((r) => r.isSelected()).length;
                    selectedActiveCount > 0 ? table.deselectRow(activeRows) : table.selectRow(activeRows);
                    break;
                }
                case "b":
                    e.preventDefault();
                    table.deselectRow();
                    break;
                case "s":
                    e.preventDefault();
                    table.download("xlsx", EXPORT_FILE_NAME, { sheetName: "Data" });
                    break;
                case "1":
                case "2":
                case "3":
                case "4": {
                    e.preventDefault();
                    const colIdx = key === "4" ? 2 : 1;
                    const optIdx = key === "4" ? 0 : parseInt(key, 10) - 1;
                    openHeaderMenu(colIdx, optIdx);
                    break;
                }
                case "x":
                    e.preventDefault();
                    openHeaderMenu(3, 0);
                    break;
            }
        });
    }

    // -----------------------------
    // 單列移動
    // -----------------------------
    // 用鍵盤在相鄰列之間移動目前選取狀態。
    function moveSelection(direction) {
        table = getTable();
        if (!table) return;

        const selected = table.getSelectedRows();
        if (selected.length === 0) return;

        const targetRow = direction > 0
            ? selected[selected.length - 1].getNextRow()
            : selected[0].getPrevRow();

        if (!targetRow) return;

        table.deselectRow();
        targetRow.select();
        targetRow.getElement()?.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    // -----------------------------
    // 表頭選單、排序與定位
    // -----------------------------
    // 呼叫 Tabulator 內建表頭選單，並在批次操作後把已選列排到前方。
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
    // 計數器與重建監聽
    // -----------------------------
    // 計數器會在每次選取狀態變動後更新，
    // observer 則會在 SPA 重建表格後重新呼叫 init。
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

        utils.startInitObserver(SELECTOR, init);
    }

    // -----------------------------
    // 啟動入口
    // -----------------------------
    // 腳本載入後立即啟用 observer，
    // 讓後續不論表格何時出現都能自動套用增強功能。
    startInitObserver();
})();
