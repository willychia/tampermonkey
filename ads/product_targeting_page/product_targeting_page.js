// ==UserScript==
// @name         Product Targeting Page Enhanced Pro
// @namespace    http://tampermonkey.net/
// @version      2026.03.13.5
// @description  Product Targeting 加強版：Cmd+A 自動調價、ASIN 批次勾選、UI 優化
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/product_targets?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/product_targeting_page/product_targeting_page.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/product_targeting_page/product_targeting_page.js
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 1. 注入 UI 樣式
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

    let table, hoveredRow = null, counterDiv;

    // 防衝突判斷
    const isEditing = (ev) => {
        const el = ev.target;
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        return el.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
    };

    function init() {
        table = Tabulator.findTable("#targets-table")[0];
        if (!table) return;

        setupColumns();
        setupUI();
        setupEvents();
        console.log("Product Targeting Enhancements Activated!");
    }

    function setupColumns() {
        const columns = table.getColumnDefinitions();
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

        table.setColumns(enhancedCols);
    }

    function setupUI() {
        counterDiv = document.createElement("div");
        counterDiv.id = "selection-counter";
        counterDiv.innerText = "已選擇 0 列";
        document.body.appendChild(counterDiv);

        const buttons = [
            { t: "E", r: "100px", b: "120px", a: () => table.getGroups().forEach((g) => g.show()) },
            { t: "C", r: "100px", b: "60px", a: () => table.getGroups().forEach((g) => g.hide()) },
            { t: "⬆", r: "50px", b: "120px", a: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
            { t: "⬇", r: "50px", b: "60px", a: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }
        ];

        buttons.forEach((btn) => {
            const el = document.createElement("button");
            el.className = "custom-float-btn";
            el.innerText = btn.t;
            el.style.right = btn.r;
            el.style.bottom = btn.b;
            el.onclick = btn.a;
            document.body.appendChild(el);
        });

        if (!document.getElementById("asin-filter-box")) {
            const container = document.createElement("div");
            container.id = "asin-filter-box";
            container.innerHTML = `
                <textarea id="asin-input" rows="5" style="width: 200px; display: block; margin-bottom: 5px;" placeholder="貼上 ASIN，一行一個"></textarea>
                <button id="apply-asin-filter" style="width: 100%; cursor: pointer;">勾選符合 ASIN</button>
            `;
            document.body.appendChild(container);
            document.getElementById("apply-asin-filter").onclick = applyAsinFilter;
        }
    }

    function setupEvents() {
        const updateCounter = () => {
            counterDiv.innerText = `已選擇 ${table.getSelectedRows().length} 列`;
        };

        table.on("rowMouseEnter", (e, row) => {
            hoveredRow = row;
            row.getElement().classList.add("hover-highlight");
        });

        table.on("rowMouseLeave", (e, row) => {
            hoveredRow = null;
            row.getElement().classList.remove("hover-highlight");
        });

        table.on("rowSelected", (row) => {
            row.getElement().classList.add("selected-highlight");
            updateCounter();
        });

        table.on("rowDeselected", (row) => {
            row.getElement().classList.remove("selected-highlight");
            updateCounter();
        });

        document.addEventListener("keydown", (e) => {
            if (isEditing(e)) return;
            const isMod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();

            if (e.key === "Enter" && hoveredRow) {
                e.preventDefault();
                hoveredRow.toggleSelect();
            }

            if (isMod) {
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
                        if (selectedActive.length > 0) {
                            table.deselectRow(activeRows);
                        } else {
                            table.selectRow(activeRows);
                        }
                        break;
                    }
                    case "f":
                        e.preventDefault();
                        targetQualitySelect();
                        break;
                    case "b":
                        e.preventDefault();
                        table.deselectRow();
                        table.getRows().forEach((r) => {
                            r.getElement().style.backgroundColor = "";
                        });
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
            }
        });
    }

    async function smartConditionSelectAndSave() {
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

        sortByCheckBox();
        await new Promise((resolve) => setTimeout(resolve, 300));
        scrollFirstSelectedToTop();

        let count = 0;
        for (const row of targetRows) {
            const data = row.getData();
            const cpcVal = parseFloat(parseFloat(data.cpc || 0).toFixed(2));
            const newBid = Math.min(1, cpcVal).toFixed(2);

            const rowEl = row.getElement();
            const bidInput = rowEl.querySelector('input[name="bid_fixed_value"]');
            const saveBtn = rowEl.querySelector('button.save-bid-button[type="submit"]');

            if (bidInput && saveBtn) {
                bidInput.value = newBid;
                bidInput.dispatchEvent(new Event("input", { bubbles: true }));
                bidInput.dispatchEvent(new Event("change", { bubbles: true }));
                bidInput.style.backgroundColor = "#c8e6c9";
                saveBtn.click();
                count++;
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }

        console.log(`已儲存 ${count} 筆自動優化資料`);
    }

    function applyAsinFilter() {
        const text = document.getElementById("asin-input").value.trim();
        if (!text) return;

        const asinList = text
            .split(/[\s,]+/)
            .map((asin) => asin.trim().toUpperCase().replace(/^"|"$/g, ""))
            .filter((asin) => asin);

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

            if (asinList.includes(asin)) {
                row.select();
                count++;
            }
        });

        sortByCheckBox();
        setTimeout(scrollFirstSelectedToTop, 300);
        console.log(`共勾選 ${count} 筆符合 ASIN 的資料`);
    }

    function targetQualitySelect() {
        table.deselectRow();
        table.getRows("active").forEach((row) => {
            const data = row.getData();
            const kw = data.keyword || "";
            const isSingleSpace = kw.trim().split(/\s+/).length === 2;

            if (!isSingleSpace && data.target_quality && data.target_quality.label === "Unknown" && data.state !== "Archived") {
                row.select();
            }
        });

        sortByCheckBox();
        setTimeout(scrollFirstSelectedToTop, 300);
    }

    function moveSelection(direction) {
        const selected = table.getSelectedRows();
        if (selected.length === 0) return;

        const targetRow = direction > 0 ? selected[selected.length - 1].getNextRow() : selected[0].getPrevRow();
        if (targetRow) {
            table.deselectRow();
            targetRow.select();
            targetRow.getElement().scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }

    function openHeaderMenu(colIdx, optIdx) {
        const buttons = document.querySelectorAll(".tabulator-header-popup-button");
        if (buttons[colIdx]) {
            buttons[colIdx].click();
            setTimeout(() => {
                const items = document.querySelectorAll(".tabulator-menu-item");
                if (items[optIdx]) items[optIdx].click();
            }, 200);
        }
    }

    function sortByCheckBox() {
        const header = document.querySelector(".tabulator-col[tabulator-field='checkBox'] .tabulator-col-sorter");
        if (header) header.click();
    }

    function scrollFirstSelectedToTop() {
        const selected = table.getSelectedRows()[0];
        if (selected) {
            table.scrollToRow(selected, "top", false);
        }
    }

    const checkTabulator = setInterval(() => {
        if (typeof Tabulator !== "undefined" && Tabulator.findTable("#targets-table").length > 0) {
            clearInterval(checkTabulator);
            init();
        }
    }, 500);
})();
