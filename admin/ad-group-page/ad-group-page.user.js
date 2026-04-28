// ==UserScript==
// @name         Ads Team Toolbox - Admin - Ad Group Page
// @namespace    http://tampermonkey.net/
// @version      2026.04.28.1
// @description  修正跳頂問題、優化選取邏輯、強化捲軸位置保持。
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/ad_groups?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/ad-group-page/ad-group-page.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/ad-group-page/ad-group-page.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // -----------------------------
    // 基本設定與狀態
    // -----------------------------
    // 這一段集中管理表格 selector、初始化旗標與執行期間需要追蹤的狀態，
    // 方便後續各功能共用同一份表格參考。
    const SELECTOR = "#ad-groups-table";
    // 在 Tabulator 實例上打旗標，避免同一張表被重複修補欄位與綁事件。
    const TABLE_FLAG = "__agp_stable_v9";
    let table = null;
    let uiBoundTable = null;
    let observerStarted = false;

    // -----------------------------
    // 基礎工具函式
    // -----------------------------
    // 這些小工具負責判斷使用者是否正在輸入，
    // 並提供等待、抓表格與偵測目標 DOM 是否被重建的能力。
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

    // -----------------------------
    // 樣式注入
    // -----------------------------
    // 這裡統一覆寫選取列、hover 列與浮動面板的樣式，
    // 讓腳本功能啟用後能立刻提供穩定的視覺回饋。
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

    // -----------------------------
    // 主初始化流程
    // -----------------------------
    // 每次偵測到表格出現或重建時，都從這裡進入，
    // 先補強欄位定義，再建立 UI 與事件綁定。
    function initEnhancements() {
        table = getTable();
        if (!table) return;

        if (!table[TABLE_FLAG]) {
            // 某些 Tabulator 欄位定義是動態生成的，初始化後再補強比較穩定。
            setupColumns(table);
            resizeImageColumn(table);
            table[TABLE_FLAG] = true;
        }

        injectCSS();
        setupUI(table);
    }

    // -----------------------------
    // 表格欄位補強
    // -----------------------------
    // Ad Group 頁面有些欄位定義是動態產生的，
    // 這裡會補上 checkbox 欄位名稱，並只針對特定欄位做局部修補，避免重建整張表頭。
    function setupColumns(activeTable) {
        try {
            const firstCol = activeTable.getColumns()[0];
            // 第一欄原本是無 field 的 checkbox 欄，補上欄位名後才能拿來排序。
            if (firstCol && !firstCol.getField()) {
                firstCol.getDefinition().field = "checkBox";
            }

            const enabledTargetsCol = activeTable.getColumn("num_enabled_targets");
            if (enabledTargetsCol) {
                enabledTargetsCol.updateDefinition({
                    headerFilter: "number",
                    headerFilterFunc: "<=",
                    headerFilterPlaceholder: "<="
                });
            }
        } catch (e) {
            console.warn("Failed to enhance Ad Group columns", e);
        }
    }

    function resizeImageColumn(activeTable) {
        const imgCol = activeTable.getColumn("product_image_url");
        if (!imgCol) return;

        imgCol.setWidth(200);
        activeTable.getRows().forEach((row) => row.normalizeHeight?.());
    }

    // -----------------------------
    // 浮動面板與計數器
    // -----------------------------
    // 這一段建立右上角操作面板，提供選取數量顯示、
    // Cmd+G 預設筆數輸入，以及 ASIN / ad group name 批次勾選功能。
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
            // 只在表格實例切換時重綁事件，避免 SPA 反覆 init 導致計數器重複更新。
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

    // -----------------------------
    // 批次勾選邏輯
    // -----------------------------
    // 這裡會把貼上的文字拆成集合，並同時比對 ASIN 與 ad group name，
    // 勾選完成後再把已選列排到前面，同時盡量維持原本捲動位置。
    async function applyBatchSelection() {
        const activeTable = getTable();
        if (!activeTable) return;

        const holder = activeTable.element.querySelector(".tabulator-tableholder");
        // 勾選與排序都可能改變畫面位置，先記住捲動位置，最後再還原。
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

    // -----------------------------
    // 表頭選單觸發
    // -----------------------------
    // 用統一方法模擬點擊 Tabulator 表頭選單，
    // 讓快捷鍵可以直接呼叫既有的欄位操作。
    function clickHeaderMenu(buttonIndex, itemIndex) {
        const btns = document.querySelectorAll(".tabulator-col .tabulator-header-popup-button");
        if (!btns[buttonIndex]) return;

        btns[buttonIndex].click();
        setTimeout(() => {
            const items = document.querySelectorAll(".tabulator-menu-item");
            if (items[itemIndex]) items[itemIndex].click();
        }, 50);
    }

    // -----------------------------
    // 鍵盤快捷鍵
    // -----------------------------
    // 這裡集中處理各種批次操作快捷鍵，包括快速勾選、
    // 清空、開連結、切換表頭選單與移動選取列。
    window.addEventListener("keydown", (e) => {
        if (isEditing(e)) return;

        table = getTable();
        if (!table) return;

        const holder = table.element.querySelector(".tabulator-tableholder");
        const savedScrollTop = holder ? holder.scrollTop : 0;
        const isCmd = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();

        // 攔截常用快捷鍵，改成對目前表格執行批次操作。
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

    // -----------------------------
    // 自動重新初始化
    // -----------------------------
    // 因為頁面是 SPA 形式，表格可能在切換條件後整個被替換，
    // 所以需要 observer 持續監看 DOM 變化並重新套用功能。
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
            // 頁面是動態渲染的，所以用 observer 等表格出現或被重建時再補強功能。
            observer.observe(document.body, { childList: true, subtree: true });
            scheduleInit();
        };

        startObserving();
    }

    // -----------------------------
    // 啟動入口
    // -----------------------------
    // 頁面載入後先啟動 observer，再立即嘗試初始化一次，
    // 確保不論表格先出現或後出現都能正常套用功能。
    startInitObserver();
    initEnhancements();
})();
