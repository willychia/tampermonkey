// ==UserScript==
// @name         Ad Group Page Additional Functions (Optimized V8)
// @namespace    http://tampermonkey.net/
// @version      2026.04.01.5
// @description  修正跳頂問題、優化選取邏輯、強化捲軸位置保持。
// @match        https://admin.hourloop.com/amazon_ads/sp/ad_groups?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const SELECTOR = "#ad-groups-table";
    const TABLE_FLAG = "__agp_stable_v9";
    let table = null;
    let uiBoundTable = null;
    let observerStarted = false;

    const isEditing = (e) => {
        const target = e.target;
        const tag = target?.tagName || "";
        return target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
    };

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const getTable = () => {
        if (typeof window.Tabulator === "undefined" || !window.Tabulator.findTable) return null;
        return window.Tabulator.findTable(SELECTOR)[0] || null;
    };

    const nodeTouchesSelector = (node) => {
        if (!(node instanceof Element)) return false;
        return node.matches(SELECTOR) || Boolean(node.querySelector(SELECTOR));
    };

    function mutationsTouchTable(mutations) {
        return mutations.some((mutation) => {
            if (nodeTouchesSelector(mutation.target)) return true;
            return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => nodeTouchesSelector(node));
        });
    }

    const injectCSS = () => {
        if (document.getElementById("agp-v8-css")) return;
        const s = document.createElement("style");
        s.id = "agp-v8-css";
        s.textContent = `
            .tabulator-tableholder { scroll-behavior: auto !important; }
            .tabulator-row.tabulator-selected {
                outline: 2px solid #3b82f6 !important;
                outline-offset: -2px;
                background-color: #2d3748 !important;
                color: #ffffff !important;
                opacity: 1 !important;
            }
            .tabulator-row:hover {
                outline: 2px solid #ef4444 !important;
                outline-offset: -2px;
                z-index: 10 !important;
                background-color: #1a202c !important;
            }
            #agp-panel {
                position: fixed; top: 10px; right: 80px; z-index: 20000;
                background: #1a1a1a; color: #fff; padding: 12px; border-radius: 10px;
                border: 1px solid #444; font-family: sans-serif;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            }
            .agp-in {
                background: #333; border: 1px solid #555; color: #fff;
                width: 55px; border-radius: 4px; padding: 3px; margin-left: 5px;
            }
            .agp-btn {
                background: #3b82f6; color: #fff; border: none; padding: 6px 12px;
                border-radius: 6px; cursor: pointer; margin-top: 8px;
                font-size: 12px; font-weight: bold;
            }
        `;
        document.head.appendChild(s);
    };

    function initEnhancements() {
        table = getTable();
        if (!table) return;

        if (!table[TABLE_FLAG]) {
            patchFirstColumn(table);
            resizeImageColumn(table);
            table[TABLE_FLAG] = true;
        }

        injectCSS();
        setupUI(table);
    }

    function patchFirstColumn(activeTable) {
        try {
            const firstCol = activeTable.getColumns()[0];
            if (firstCol && !firstCol.getField()) {
                firstCol.getDefinition().field = "checkBox";
            }
        } catch (e) {
            console.warn("Failed to patch checkbox field", e);
        }
    }

    function resizeImageColumn(activeTable) {
        const imgCol = activeTable.getColumn("product_image_url");
        if (!imgCol) return;

        imgCol.setWidth(200);
        activeTable.getRows().forEach((row) => row.normalizeHeight?.());
    }

    function setupUI(activeTable) {
        let panel = document.getElementById("agp-panel");
        if (!panel) {
            panel = document.createElement("div");
            panel.id = "agp-panel";
            panel.innerHTML = `
                <div style="font-size: 13px; margin-bottom: 5px;">已選: <span id="agp-count">0</span> 列</div>
                <div style="margin-bottom: 8px;">Cmd+G 數: <input type="number" id="agp-g-count" class="agp-in" value="10"></div>
                <textarea id="agp-asin-area" placeholder="貼上 ASIN..." style="width: 160px; height: 50px; display: block; font-size: 11px; background: #000; color: #0f0; border: 1px solid #444; border-radius: 4px; padding: 4px;"></textarea>
                <div style="display: flex; gap: 5px;">
                    <button id="agp-apply" class="agp-btn">套用選取</button>
                    <button id="agp-clear" class="agp-btn" style="background: #555">清空</button>
                </div>
            `;
            document.body.appendChild(panel);
        }

        if (uiBoundTable !== activeTable) {
            activeTable.on("rowSelectionChanged", () => updateCounter(activeTable));
            uiBoundTable = activeTable;
        }

        const applyBtn = document.getElementById("agp-apply");
        const clearBtn = document.getElementById("agp-clear");
        if (applyBtn) applyBtn.onclick = applyBatchSelection;
        if (clearBtn) clearBtn.onclick = () => getTable()?.deselectRow();

        updateCounter(activeTable);
    }

    function updateCounter(activeTable) {
        const countSpan = document.getElementById("agp-count");
        if (countSpan) countSpan.textContent = String(activeTable.getSelectedRows().length);
    }

    async function applyBatchSelection() {
        const activeTable = getTable();
        if (!activeTable) return;

        const holder = activeTable.element.querySelector(".tabulator-tableholder");
        const savedPos = holder ? holder.scrollTop : 0;
        const val = document.getElementById("agp-asin-area")?.value || "";
        const set = new Set(val.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean));

        activeTable.deselectRow();
        activeTable.getRows().forEach((row) => {
            const asin = row.getElement()?.querySelector('a[href*="asin:"]')?.textContent?.trim()?.toUpperCase();
            const name = (row.getData().ad_group_name || "").toUpperCase();
            if (set.has(name) || (asin && set.has(asin))) row.select();
        });

        const result = activeTable.setSort("checkBox", "desc");
        if (result && typeof result.then === "function") {
            await result;
        }

        if (holder) {
            await wait(50);
            holder.scrollTop = savedPos;
        }

        updateCounter(activeTable);
    }

    function clickHeaderMenu(buttonIndex, itemIndex) {
        const btns = document.querySelectorAll(".tabulator-col .tabulator-header-popup-button");
        if (!btns[buttonIndex]) return;

        btns[buttonIndex].click();
        setTimeout(() => {
            const items = document.querySelectorAll(".tabulator-menu-item");
            if (items[itemIndex]) items[itemIndex].click();
        }, 50);
    }

    window.addEventListener("keydown", (e) => {
        if (isEditing(e)) return;

        table = getTable();
        if (!table) return;

        const holder = table.element.querySelector(".tabulator-tableholder");
        const savedScrollTop = holder ? holder.scrollTop : 0;
        const isCmd = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();

        if (isCmd && ["1", "2", "3", "4", "5", "6", "x", "g", "e", "b", "d"].includes(key)) {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (key === "g") {
                const n = parseInt(document.getElementById("agp-g-count")?.value || "10", 10) || 10;
                table.deselectRow();
                table.getRows("active").slice(0, n).forEach((row) => row.select());
            } else if (key === "6") {
                clickHeaderMenu(1, 0);
            } else if (key === "e") {
                const activeRows = table.getRows("active");
                table.getSelectedRows().length ? table.deselectRow(activeRows) : table.selectRow(activeRows);
            } else if (key === "b") {
                table.deselectRow();
            } else if (key === "d") {
                const links = table.getSelectedRows()
                    .map((row) => row.getElement()?.querySelector('a[href*="/dp/"]')?.href)
                    .filter(Boolean);
                if (links.length <= 20) links.forEach((url) => window.open(url, "_blank"));
            } else {
                const itemIndex = key === "x" ? 6 : parseInt(key, 10) - 1;
                clickHeaderMenu(0, itemIndex);
            }

            if (holder) {
                setTimeout(() => {
                    holder.scrollTop = savedScrollTop;
                }, 10);
            }

            updateCounter(table);
            return;
        }

        if (e.key === "Enter") {
            const hovered = document.querySelector(".tabulator-row:hover");
            if (!hovered) return;

            e.preventDefault();
            const row = table.getRows().find((item) => item.getElement() === hovered);
            if (row) row.toggleSelect();
            updateCounter(table);
            return;
        }

        if (isCmd && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            const selected = table.getSelectedRows();
            if (selected.length === 0) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            const targetRow = e.key === "ArrowUp" ? selected[0].getPrevRow() : selected[selected.length - 1].getNextRow();
            if (!targetRow?.select) return;

            table.deselectRow();
            targetRow.select();
            updateCounter(table);
        }
    }, true);

    function startInitObserver() {
        if (observerStarted) return;
        observerStarted = true;

        let scheduled = false;
        const scheduleInit = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                initEnhancements();
            });
        };

        const observer = new MutationObserver((mutations) => {
            if (mutationsTouchTable(mutations)) {
                scheduleInit();
            }
        });

        const startObserving = () => {
            if (!document.body) {
                requestAnimationFrame(startObserving);
                return;
            }
            observer.observe(document.body, { childList: true, subtree: true });
            scheduleInit();
        };

        startObserving();
    }

    startInitObserver();
    initEnhancements();
})();
