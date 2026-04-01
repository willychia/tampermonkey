// ==UserScript==
// @name         Ad Group Page Additional Functions (Optimized V8)
// @namespace    http://tampermonkey.net/
// @version      2026.04.01.V1
// @description  修正跳頂問題、優化選取邏輯、強化捲軸位置保持。
// @match        https://admin.hourloop.com/amazon_ads/sp/ad_groups?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const SELECTOR = "#ad-groups-table";
    const INIT_FLAG = "__agp_stable_v8";
    let cachedTable = null;

    const isEditing = (e) => {
        const tag = e.target.tagName;
        return e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
    };

    const getTable = () => {
        if (cachedTable && document.body.contains(cachedTable.element)) return cachedTable;
        if (typeof window.Tabulator !== "undefined" && window.Tabulator.findTable) {
            const tables = window.Tabulator.findTable(SELECTOR);
            if (tables && tables.length > 0) return tables[0];
        }
        return null;
    };

    const injectCSS = () => {
        if (document.getElementById("agp-v8-css")) return;
        const s = document.createElement("style");
        s.id = "agp-v8-css";
        s.textContent = `
            .tabulator-tableholder { scroll-behavior: auto !important; } /* 防止還原位置時產生平滑動畫導致失效 */
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
            #agp-panel { position: fixed; top: 10px; right: 80px; z-index: 20000; background: #1a1a1a; color: #fff; padding: 12px; border-radius: 10px; border: 1px solid #444; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            .agp-in { background: #333; border: 1px solid #555; color: #fff; width: 55px; border-radius: 4px; padding: 3px; margin-left: 5px; }
            .agp-btn { background: #3b82f6; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-top: 8px; font-size: 12px; font-weight: bold; }
        `;
        document.head.appendChild(s);
    };

    function initEnhancements() {
        const table = getTable();
        if (!table || table[INIT_FLAG]) return;

        try {
            const firstCol = table.getColumns()[0];
            if (firstCol && !firstCol.getField()) {
                const def = firstCol.getDefinition();
                def.field = "checkBox";
            }
        } catch (e) {}

        injectCSS();
        setupUI(table);

        const imgCol = table.getColumn("product_image_url");
        if (imgCol) {
            imgCol.setWidth(200);
            table.getRows().forEach(r => r.normalizeHeight?.());
        }

        table[INIT_FLAG] = true;
        cachedTable = table;
    }

    function setupUI(table) {
        if (document.getElementById("agp-panel")) return;
        const panel = document.createElement("div");
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

        const update = () => {
            const countSpan = document.getElementById("agp-count");
            if (countSpan) countSpan.textContent = table.getSelectedRows().length;
        };
        table.on("rowSelectionChanged", update);

        document.getElementById("agp-apply").onclick = () => {
            const holder = table.element.querySelector(".tabulator-tableholder");
            const savedPos = holder ? holder.scrollTop : 0;

            const val = document.getElementById("agp-asin-area").value;
            const set = new Set(val.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean));

            table.deselectRow();
            table.getRows().forEach(r => {
                const asin = r.getElement()?.querySelector('a[href*="asin:"]')?.textContent?.trim()?.toUpperCase();
                const name = (r.getData().ad_group_name || "").toUpperCase();
                if (set.has(name) || (asin && set.has(asin))) r.select();
            });

            // 排序會導致跳頂，這裡強制拉回
            table.setSort("checkBox", "desc").then(() => {
                if (holder) setTimeout(() => holder.scrollTop = savedPos, 50);
            });
        };
        document.getElementById("agp-clear").onclick = () => table.deselectRow();
    }

    window.addEventListener("keydown", (e) => {
        if (isEditing(e)) return;
        const table = getTable();
        if (!table) return;

        // --- 核心防禦：紀錄捲軸位置 ---
        const holder = table.element.querySelector(".tabulator-tableholder");
        const savedScrollTop = holder ? holder.scrollTop : 0;

        const isCmd = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();

        if (isCmd && ["1", "2", "3", "4", "5", "6", "x", "g", "e", "b", "d"].includes(key)) {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (key === "g") {
                const n = parseInt(document.getElementById("agp-g-count").value) || 10;
                table.deselectRow();
                // 優化：直接從數據層抓前 N 列，效能更好且穩定
                const rows = table.getRows("active").slice(0, n);
                rows.forEach(r => r.select());
            } else if (key === "6") {
                const btns = document.querySelectorAll(".tabulator-col .tabulator-header-popup-button");
                if (btns[1]) {
                    btns[1].click();
                    setTimeout(() => {
                        const items = document.querySelectorAll(".tabulator-menu-item");
                        if (items[0]) items[0].click();
                    }, 50);
                }
            } else if (key === "e") {
                const active = table.getRows("active");
                table.getSelectedRows().length ? table.deselectRow(active) : table.selectRow(active);
            } else if (key === "b") {
                table.deselectRow();
            } else if (key === "d") {
                const links = table.getSelectedRows().map(r => r.getElement()?.querySelector('a[href*="/dp/"]')?.href).filter(Boolean);
                if (links.length <= 20) links.forEach(url => window.open(url, "_blank"));
            } else {
                const btns = document.querySelectorAll(".tabulator-col .tabulator-header-popup-button");
                if (btns[0]) {
                    btns[0].click();
                    setTimeout(() => {
                        const items = document.querySelectorAll(".tabulator-menu-item");
                        const idx = key === "x" ? 6 : parseInt(key) - 1;
                        if (items[idx]) items[idx].click();
                    }, 50);
                }
            }

            // --- 操作結束後強制還原捲軸 ---
            if (holder) {
                setTimeout(() => { holder.scrollTop = savedScrollTop; }, 10);
            }

        } else if (e.key === "Enter") {
            const h = document.querySelector(".tabulator-row:hover");
            if (h) {
                e.preventDefault();
                const row = table.getRows().find(r => r.getElement() === h);
                if (row) row.toggleSelect();
            }
        } else if (isCmd && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            const s = table.getSelectedRows();
            if (s.length > 0) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const t = e.key === "ArrowUp" ? s[0].getPrevRow() : s[s.length - 1].getNextRow();
                if (t && t.select) {
                    table.deselectRow();
                    t.select();
                    // 移動選取後通常會希望看到該列，這裡可以考慮是否要調用 t.getElement().scrollIntoView()
                }
            }
        }
    }, true);

    setInterval(initEnhancements, 2000);
    initEnhancements();

})();
