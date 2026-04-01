// ==UserScript==
// @name         Product Targeting Page Enhanced Pro
// @namespace    http://tampermonkey.net/
// @version      2026.04.01.8
// @description  Product Targeting 加強版：Cmd+A 自動調價、ASIN 批次勾選、UI 優化
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

    const SELECTOR = "#targets-table";
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

            if (col.field === "last_buy_box_timestamp") {
                return {
                    ...col,
                    headerFilter: "number",
                    headerFilterPlaceholder: "Hours within",
                    headerFilterFunc: (filterValue, cellValue) => {
                        const v = parseFloat(filterValue);
                        if (!Number.isFinite(v) || !cellValue) return true;
                        const hours = (Date.now() - new Date(cellValue).getTime()) / 36e5;
                        return hours <= v;
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
            { id: "ptp-btn-expand", text: "E", right: "100px", bottom: "120px", action: () => getTable()?.getGroups().forEach((g) => g.show()) },
            { id: "ptp-btn-collapse", text: "C", right: "100px", bottom: "60px", action: () => getTable()?.getGroups().forEach((g) => g.hide()) },
            { id: "ptp-btn-up", text: "⬆", right: "50px", bottom: "120px", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
            { id: "ptp-btn-down", text: "⬇", right: "50px", bottom: "60px", action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }
        ], BUTTON_CLASS);

        if (!document.getElementById(ASIN_BOX_ID)) {
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
                    smartConditionSelectAndSave();
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

            if (daysOfSupply > 7 && acos <= 0.1 && unitsSold > 0 && bidVal < cpcVal) {
                row.select();
                targetRows.push(row);
            }
        });

        if (targetRows.length === 0) {
            console.log("沒有符合條件的 Target");
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

    async function applyAsinFilter() {
        table = getTable();
        if (!table) return;

        const text = document.getElementById("asin-input")?.value.trim();
        if (!text) return;

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
