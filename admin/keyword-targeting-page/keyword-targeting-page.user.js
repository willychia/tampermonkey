// ==UserScript==
// @name         Ads Team Toolbox - Admin - Keyword Targeting Page
// @namespace    http://tampermonkey.net/
// @version      2026.05.05.1
// @description  Keyword Targeting 加強版：長尾關鍵字勾選、批次選取、匯出與 UI 優化
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/keywords?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/keyword-targeting-page/keyword-targeting-page.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/keyword-targeting-page/keyword-targeting-page.user.js
// @require      https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/shared/tabulator-page-utils.js
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    "use strict";

    // -----------------------------
    // 基本設定與狀態
    // -----------------------------
    // 這裡集中定義表格 selector、初始化旗標與畫面互動所需的共用狀態，
    // 讓後續函式能透過同一份資料來源協作。
    const SELECTOR = "#keywords-table";
    // 用旗標記錄這個 Tabulator 實例是否已完成增強設定，避免重複 setColumns/綁事件。
    const TABLE_FLAG = "__ktp_enhanced_bound";
    const COUNTER_ID = "selection-counter";
    const BUTTON_CLASS = "custom-float-btn";
    const utils = window.TMTabulatorPageUtils;
    if (!utils) {
        console.error("TMTabulatorPageUtils failed to load for keyword targeting page.");
        return;
    }
    let table = null;
    const hoveredState = { current: null };
    let keydownBound = false;
    let observerStarted = false;

    // -----------------------------
    // UI 樣式
    // -----------------------------
    // 這裡注入共用的 hover、selected、計數器與浮動按鈕樣式，
    // 讓使用者能快速辨識目前選取狀態與可用操作。
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
    // 主初始化流程會在表格出現時補上欄位設定、事件與 UI，
    // 並確保相同表格不會被重複綁定。
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
    // 這裡替特定欄位補上更實用的 header filter，
    // 讓庫存、Buy Box 時間與建立時間可以直接用相對條件篩選。
    function setupColumns(activeTable) {
        const columns = activeTable.getColumnDefinitions();
        // 讓第一欄 checkbox 具備固定 field，後續才能用來排序已選取資料。
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
                const isDay = col.field === "created_at";
                return {
                    ...col,
                    headerFilter: "number",
                    headerFilterPlaceholder: isDay ? "Days within" : "Hours within",
                    headerFilterFunc: (filterValue, cellValue) => {
                        const v = parseFloat(filterValue);
                        if (!Number.isFinite(v) || !cellValue) return true;
                        // 將日期欄位轉成距今幾小時/幾天，讓表頭可以直接輸入相對時間篩選。
                        const diff = (Date.now() - new Date(cellValue).getTime()) / 36e5;
                        return (isDay ? diff / 24 : diff) <= v;
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
    // 建立選取計數器與上下捲動、展開收合群組按鈕，
    // 讓常見動作不需要每次都靠原生頁面操作。
    function setupUI() {
        utils.ensureCounter(COUNTER_ID, table ? `已選擇 ${table.getSelectedRows().length} 列` : "已選擇 0 列");
        utils.ensureButtons([
            { id: "ktp-btn-expand", text: "E", right: "100px", bottom: "120px", action: () => getTable()?.getGroups().forEach((g) => g.show()) },
            { id: "ktp-btn-collapse", text: "C", right: "100px", bottom: "60px", action: () => getTable()?.getGroups().forEach((g) => g.hide()) },
            { id: "ktp-btn-up", text: "⬆", right: "50px", bottom: "120px", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
            { id: "ktp-btn-down", text: "⬇", right: "50px", bottom: "60px", action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }
        ], BUTTON_CLASS);
    }

    function bindTableEvents(activeTable) {
        utils.bindSelectionState(activeTable, COUNTER_ID, hoveredState);
    }

    // -----------------------------
    // 鍵盤快捷鍵
    // -----------------------------
    // 這一段統一攔截本頁最常用的快捷鍵，
    // 包含長尾關鍵字勾選、匯出與表頭選單操作。
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

            // 將常用的批次操作綁到鍵盤，減少反覆滑鼠操作。
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
                case "f":
                    e.preventDefault();
                    keywordSmartSelect();
                    break;
                case "b":
                    e.preventDefault();
                    table.deselectRow();
                    break;
                case "s":
                    e.preventDefault();
                    table.download("xlsx", "filtered_table.xlsx", { sheetName: "Data" });
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
    // 單列移動與長尾關鍵字勾選
    // -----------------------------
    // 這兩個功能分別負責用鍵盤移動目前選取列，
    // 與快速找出詞數不等於 2 的關鍵字，方便集中檢查例外資料。
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

    async function keywordSmartSelect() {
        table = getTable();
        if (!table) return;

        table.deselectRow();
        table.getRows("active").forEach((row) => {
            const kw = row.getData().keyword || "";
            const wordCount = kw.trim()
                ? kw.trim().split(/\s+/).filter(Boolean).length
                : 0;

            // 只保留詞數不是 2 的列。
            if (wordCount !== 2) {
                row.select();
            }
        });

        await sortByCheckBox();
        utils.scrollFirstSelectedToTop(table);
    }

    // -----------------------------
    // 表頭選單、排序與定位
    // -----------------------------
    // 這一段負責觸發 Tabulator 內建選單，
    // 並在批次操作後把已選列排到前方、捲回可視位置。
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

        // 共用 observer 會在表格被 SPA 重建時重新執行 init。
        utils.startInitObserver(SELECTOR, init);
    }

    // -----------------------------
    // 啟動入口
    // -----------------------------
    // 腳本載入後立即啟用 observer，
    // 讓後續不論表格何時出現都能自動套用增強功能。
    startInitObserver();
})();
