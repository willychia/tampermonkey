// ==UserScript==
// @name         Keyword Targeting Page Enhanced Pro
// @namespace    http://tampermonkey.net/
// @version      2026.04.01.5
// @description  Cmd+A 條件勾選並自動更新 Bid 為 Min(1, CPC)
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/keywords?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.user.js
// @require      https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/shared/tabulator_page_utils.js
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    "use strict";

    const SELECTOR = "#keywords-table";
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
                const isDay = col.field === "created_at";
                return {
                    ...col,
                    headerFilter: "number",
                    headerFilterPlaceholder: isDay ? "Days within" : "Hours within",
                    headerFilterFunc: (filterValue, cellValue) => {
                        const v = parseFloat(filterValue);
                        if (!Number.isFinite(v) || !cellValue) return true;
                        const diff = (Date.now() - new Date(cellValue).getTime()) / 36e5;
                        return (isDay ? diff / 24 : diff) <= v;
                    }
                };
            }

            return col;
        });

        activeTable.setColumns(enhancedCols);
    }

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
                case "a":
                    e.preventDefault();
                    smartConditionSelectAndAdjustBid();
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

    async function smartConditionSelectAndAdjustBid() {
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

            const isGoodPerformance =
                daysOfSupply > 7 &&
                acos <= 0.1 &&
                unitsSold > 0 &&
                bidVal < cpcVal;

            if (isGoodPerformance) {
                row.select();
                targetRows.push(row);
            }
        });

        if (targetRows.length === 0) {
            console.log("沒有符合條件（含銷量 > 0）的關鍵字");
            return;
        }

        await sortByCheckBox();
        scrollFirstSelectedToTop();

        let processedCount = 0;
        for (const row of targetRows) {
            const data = row.getData();
            const cpcVal = parseFloat(parseFloat(data.cpc || 0).toFixed(2));
            const newBid = Math.min(1, cpcVal).toFixed(2);

            const rowEl = row.getElement();
            const bidInput = rowEl?.querySelector('input[name="bid_fixed_value"]');
            const saveBtn = rowEl?.querySelector('button.save-bid-button[type="submit"]');

            if (!bidInput || !saveBtn) continue;

            bidInput.value = newBid;
            bidInput.dispatchEvent(new Event("input", { bubbles: true }));
            bidInput.dispatchEvent(new Event("change", { bubbles: true }));
            bidInput.style.backgroundColor = "#c8e6c9";
            saveBtn.click();
            processedCount++;
            await utils.wait(200);
        }

        console.log(`✅ 已完成 ${processedCount} 筆含銷量關鍵字的自動優化`);
    }

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
            const words = kw.trim().split(/\s+/);

            if (words.length >= 3) {
                row.select();
            }
        });

        await sortByCheckBox();
        utils.scrollFirstSelectedToTop(table);
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

    startInitObserver();
})();
