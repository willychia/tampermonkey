// ==UserScript==
// @name         Ad Group Page Additional Functions (stable merge)
// @namespace    http://tampermonkey.net/
// @version      2025.11.26.01
// @description  Keep all your features + safer init, CSS classes, keybind guards, and small UX fixes for Tabulator on the ad group page.
// @match        https://admin.hourloop.com/amazon_ads/sp/ad_groups?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.js?v=2025112601
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.js?v=2025112601
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /** =========================
   *  Config / Constants
   *  ========================= */
  const TABLE_SELECTOR = "#ad-groups-table";
  const RETRY_MS = 500;
  const MAX_TRIES = 60; // ~30s
  const STYLE_ID = "agp-enhance-style";
  const COUNTER_ID = "selection-counter";
  const INIT_FLAG = "__agpEnhanced";

  /** =========================
   *  Utils
   *  ========================= */
  const isEditing = (ev) => {
    const el = ev.target;
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    const editable = el.isContentEditable;
    return editable || tag === "input" || tag === "textarea" || tag === "select";
  };

  const hasTabulator = () =>
    typeof window.Tabulator !== "undefined" &&
    typeof window.Tabulator.findTable === "function";

  const getFirstTable = () => {
    if (!hasTabulator()) return null;
    const arr = window.Tabulator.findTable(TABLE_SELECTOR) || [];
    return arr[0] || null;
  };

  const waitForTableAndInit = (tries = 0) => {
    try {
      const table = getFirstTable();
      if (table && !table[INIT_FLAG]) {
        initTableEnhancements(table);
        return;
      }
    } catch (_) {}
    if (tries < MAX_TRIES) {
      setTimeout(() => waitForTableAndInit(tries + 1), RETRY_MS);
    }
  };

  const observeForTable = () => {
    const obs = new MutationObserver(() => {
      const table = getFirstTable();
      if (table && !table[INIT_FLAG]) {
        initTableEnhancements(table);
      }
    });
    obs.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  };

  const ensureStyleInstalled = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .tmk-row-hover { outline: 3px solid red !important; outline-offset: -2px; }
      .tmk-row-selected { outline: 3px solid white !important; outline-offset: -2px; }
    
      /* 右上角資訊卡容器（可互動） */
      #selection-panel{
        position: fixed;
        top: 10px;
        right: 80px;
        z-index: 9999;
        padding: 8px 12px;
        background: rgba(0,0,0,.72);
        color: #fff;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 14px rgba(0,0,0,.25);
        -webkit-backdrop-filter: blur(2px);
        backdrop-filter: blur(2px);
        pointer-events: auto; /* 允許輸入框互動 */
      }
      #selection-counter{
        margin: 0 0 6px 0;
      }
      #gcount-wrap{
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #gcount-wrap label{
        font-size: 12px;
        opacity: .85;
        white-space: nowrap;
      }
      #gcount-input{
        width: 64px;
        height: 24px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,.25);
        background: rgba(255,255,255,.1);
        color: #fff;
        padding: 0 6px;
        font-size: 12px;
        outline: none;
      }
      #gcount-input:focus{
        border-color: rgba(255,255,255,.5);
        background: rgba(255,255,255,.18);
      }
    
      .agp-mini-btn{
        position: fixed;
        z-index: 9999;
        padding: 10px 15px;
        background: rgba(0,0,0,.7);
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
      }
      .agp-mini-btn:hover{ background: #000; }
    `;

    document.head.appendChild(style);
  };

  /** =========================
   *  Core Enhancements (merged)
   *  ========================= */
  function initTableEnhancements(table) {
    try {
      if (table[INIT_FLAG]) return;
      table[INIT_FLAG] = true;

      ensureStyleInstalled();

      // —— 1) 你原本：把第一欄補上 field=checkBox（後面 setSort 會用到）
      try {
        const defs = table.getColumnDefinitions();
        if (Array.isArray(defs) && defs.length > 0) {
          defs[0].field = "checkBox";
          table.setColumns(defs);
        }
      } catch (e) {}

      // —— 2) 數字 / 相對時間 headerFilter（加上防呆）
      enhanceColumns(table);

      // —— 3) 滑鼠 hover / 勾選外框（改為 class，避免重繪洗掉）
      // installRowHighlight(table);

      // —— 4) 右上角勾選列數
      attachSelectionCounter(table);

      // —— 5) 右下角按鈕（展開/收起群組、回頂/回底）
      installCornerButtons(table);

      // —— 6) 快捷鍵（完整保留並加「輸入中不觸發」的防呆）
      installHotkeys(table);

      // —— 7) ASIN 批次勾選盒
      installAsinPicker(table);

      console.info("[Ad Group Page] Enhancements initialized.");
    } catch (err) {
      console.error("[Ad Group Page] init error:", err);
    }
  }

  function enhanceColumns(table) {
    const original = table.getColumnDefinitions() || [];
    const cols = original.map(col => {
      if (col.field === "num_enabled_targets") {
        return {
          ...col,
          headerFilter: "number",
          headerFilterFunc: "<=",
          headerFilterPlaceholder: "Less than",
        };
      }
      if (col.field === "last_buy_box_timestamp") {
        return {
          ...col,
          headerFilter: "number",
          headerFilterPlaceholder: "Hours within",
          headerFilterFunc: (filterValue, cellValue) => {
            const v = parseFloat(filterValue);
            if (!Number.isFinite(v)) return true;     // 空/非數字 → 不過濾
            if (!cellValue) return false;
            const t = new Date(cellValue);
            if (Number.isNaN(t.getTime())) return false;
            const hours = (Date.now() - t.getTime()) / 36e5;
            return hours <= v;
          },
        };
      }
      if (col.field === "category") {
        return {
          ...col,
          headerFilter: "select",
          headerFilterParams: function (column) {
            return buildSelectOptionsSortedByCount(column, {
              includeEmpty: false,
              showCount: true,
              emptyLabel: "",
            });
          },
        };
      }
      return col;
    });
    table.setColumns(cols);
    try { table.updateOption({ headerFilterLiveFilter: true }); } catch(_) {}
  }

  function installRowHighlight(table) {
    table.on("rowMouseEnter", (_e, row) => {
      row.getElement().classList.add("tmk-row-hover");
    });
    table.on("rowMouseLeave", (_e, row) => {
      const el = row.getElement();
      el.classList.remove("tmk-row-hover");
      // 勾選中會有白框
      if (row.isSelected()) el.classList.add("tmk-row-selected");
      else el.classList.remove("tmk-row-selected");
    });
    table.on("rowSelected", row => {
      row.getElement().classList.add("tmk-row-selected");
    });
    table.on("rowDeselected", row => {
      row.getElement().classList.remove("tmk-row-selected");
    });
  }

  function attachSelectionCounter(table) {
    // 容器（含：計數文字 + G 選取數輸入框）
    let panel = document.getElementById("selection-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "selection-panel";
      panel.innerHTML = `
        <div id="selection-counter">已選擇 0 列</div>
        <div id="gcount-wrap">
          <label for="gcount-input">Cmd+G 勾選數：</label>
          <input id="gcount-input" type="number" min="1" step="1" value="10" />
        </div>
      `;
      document.body.appendChild(panel);
    }
  
    const counterEl = panel.querySelector("#selection-counter");
    const update = () => {
      counterEl.textContent = `已選擇 ${table.getSelectedRows().length} 列`;
    };
  
    table.on("rowSelectionChanged", update);
    update();
  }

  function installCornerButtons(table) {
    const mkBtn = (text, right, bottom, action, title="") => {
      const b = document.createElement("button");
      b.className = "agp-mini-btn";
      b.textContent = text;
      b.style.right = right;
      b.style.bottom = bottom;
      if (title) b.title = title;
      b.addEventListener("click", action);
      document.body.appendChild(b);
    };

    mkBtn("⬆", "50px",  "120px", () => window.scrollTo({ top: 0, behavior: "smooth" }), "Scroll to top");
    mkBtn("⬇", "50px",  "60px",  () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), "Scroll to bottom");
  }

  function scrollSelectedRowToTop(table) {
    const selected = table.getSelectedRows();
    if (!selected.length) return;
    const firstRow = selected[0];
    table.scrollToRow(firstRow, "top", false).then(() => {
      const rowEl = firstRow.getElement();
      if (!rowEl) return;
      const container = table.element;
      const rowOffset = rowEl.offsetTop;
      container.scrollTop = rowOffset;
      const tableTopOffset = container.getBoundingClientRect().top + window.scrollY;
      const targetY = rowOffset + tableTopOffset;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }).catch(() => {});
  }

  function copyToClipboard(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function installHotkeys(table) {
    // —— 公用：欄位排序選單操作
    const openHeaderMenuAndClickOption = (columnIndex = 0, optionIndex = 0) => {
      const buttons = document.querySelectorAll(".tabulator-col .tabulator-header-popup-button");
      if (!buttons[columnIndex]) return;
      buttons[columnIndex].click();
      setTimeout(() => {
        const items = document.querySelectorAll(".tabulator-menu-item");
        if (items[optionIndex]) items[optionIndex].click();
      }, 200);
    };

    let hoveredRow = null;
    table.on("rowMouseEnter", (_e, row) => { hoveredRow = row; });
    table.on("rowMouseLeave", (_e, _row) => { hoveredRow = null; });

    // —— 所有快捷鍵都加「編輯中不觸發」的防呆
    document.addEventListener("keydown", (event) => {
      if (isEditing(event)) return;

      // Enter → 切換目前 hover 行的選取
      if (event.key === "Enter" && hoveredRow) {
        event.preventDefault();
        hoveredRow.toggleSelect();
      }

      // Cmd/Ctrl + ↑ / ↓ → 移動選取到上一行 / 下一行
      if ((event.metaKey || event.ctrlKey) && event.key === "ArrowUp") {
        event.preventDefault();
        const selectedRows = table.getSelectedRows();
        if (selectedRows.length) {
          const prev = selectedRows[0].getPrevRow();
          table.deselectRow();
          if (prev) prev.select();
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "ArrowDown") {
        event.preventDefault();
        const selectedRows = table.getSelectedRows();
        if (selectedRows.length) {
          const next = selectedRows[selectedRows.length - 1].getNextRow();
          table.deselectRow();
          if (next) next.select();
        }
      }

      // Cmd/Ctrl + E → 全選 / 全不選（當前 active rows）
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        const active = table.getRows("active");
        if (table.getSelectedRows().length) table.deselectRow(active);
        else table.selectRow(active);
      }

      // Cmd/Ctrl + B → 清空選取
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        table.deselectRow();
      }

      // Cmd/Ctrl + D → 開啟選取列的 product_image_url 欄位中的連結（<=20）
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const links = [];
        table.getSelectedRows().forEach(r => {
          const cell = r.getCell("product_image_url");
          const el = cell && cell.getElement();
          const a = el && el.querySelector("a");
          if (a && a.href) links.push(a.href);
        });
        if (!links.length) console.warn("沒有找到可用的超連結");
        else if (links.length > 20) console.warn("勾選過多的超連結");
        else links.forEach(href => window.open(href, "_blank"));
      }

      // Cmd/Ctrl + I → 開啟選取列的 search_similar_items 的連結（<=20）
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        const links = [];
        table.getSelectedRows().forEach(r => {
          const cell = r.getCell("product_image_url");
          const el = cell && cell.getElement();
          const a = el && el.querySelector("img");
          if (a && a.src) links.push('https://www.amazon.com/stylesnap?q=' + a.src);
        });
        if (!links.length) console.warn("沒有找到可用的超連結");
        else if (links.length > 20) console.warn("勾選過多的超連結");
        else links.forEach(href => window.open(href, "_blank"));
      }

      // Cmd/Ctrl + G → 勾選當前頁面前 N 列（由輸入框決定，預設 10）
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        const rows = table.getRows("active");
        if (!rows || !rows.length) return console.warn("當前頁面沒有可選取的列");
      
        // 讀取輸入框的值
        const inputEl = document.getElementById("gcount-input");
        let N = 10;
        if (inputEl) {
          const v = parseInt(inputEl.value, 10);
          if (Number.isFinite(v) && v > 0) N = v;
        }
      
        table.deselectRow();
        rows.slice(0, N).forEach(r => r.select());
        table.scrollToRow(rows[0], "top", true);
      }

      // Cmd/Ctrl + 數字鍵 / X → 開欄位選單並點指定項目
      const key = event.key;
      if ((event.metaKey || event.ctrlKey) && ["1","2","3","4","5","x","X"].includes(key)) {
        event.preventDefault();
        const map = { "1":0, "2":1, "3":2, "4":3, "5":4, "x":6, "X":6 };
        openHeaderMenuAndClickOption(0, map[key]);
      }
    });
  }

  function installAsinPicker(table) {
    if (document.getElementById("asin-filter-box")) return;

    const box = document.createElement("div");
    box.id = "asin-filter-box";
    Object.assign(box.style, {
      position: "fixed",
      top: "10px",
      right: "360px",
      zIndex: 9999,
      background: "#fff",
      border: "1px solid #ccc",
      padding: "10px",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      maxWidth: "340px",
    });
    box.innerHTML = `
      <div style="font-weight:700; margin-bottom:6px;">勾選符合 ASIN</div>
      <textarea id="asin-input" rows="3" style="width:320px; font-family:monospace;" placeholder="以逗號或換行分隔，如：B0XXXXX1, B0XXXXX2"></textarea>
      <div style="margin-top:6px; display:flex; gap:8px;">
        <button id="apply-asin-filter" class="agp-mini-btn" style="position:static;padding:6px 10px;">套用</button>
        <button id="asin-clear" class="agp-mini-btn" style="position:static;padding:6px 10px;background:#666;">清除選取</button>
      </div>
    `;
    document.body.appendChild(box);

    const parseList = (txt) =>
      txt
        .split(/[\s,]+/)
        .map(s => s.trim().toUpperCase().replace(/^"|"$/g, ""))
        .filter(Boolean);

    document.getElementById("apply-asin-filter").addEventListener("click", () => {
      const txt = (document.getElementById("asin-input").value || "").trim();
      if (!txt) return;
      const list = parseList(txt);

      const rows = table.getRows();
      table.deselectRow();
      let matched = 0;

      rows.forEach(row => {
        const data = row.getData();
        const rowEl = row.getElement();
        // 以 ad_group_name 為主；若空，嘗試從 DOM 中 a[href*="asin:"] 的文字
        let asin = (data.ad_group_name || "").toUpperCase();
        if (!asin && rowEl) {
          const a = rowEl.querySelector('a[href*="asin:"]');
          asin = (a && a.textContent && a.textContent.trim().toUpperCase()) || "";
        }
        if (list.includes(asin)) {
          matched++;
          row.select();
        }
      });

      try { table.setSort("checkBox", "desc"); } catch(_) {}
      scrollSelectedRowToTop(table);
      console.log(`共勾選 ${matched} 筆 ASIN 符合的資料`);
    });

    document.getElementById("asin-clear").addEventListener("click", () => {
      table.deselectRow();
    });
  }

  // 建一個小工具：把某欄位的 unique 值依「出現次數」降序排序
  function buildSelectOptionsSortedByCount(column, options = {}) {
    const {
      includeEmpty = false,   // 要不要保留空值
      showCount = false,      // 下拉選單的文字要不要顯示次數
      emptyLabel = "(All)"    // 空值顯示文字
    } = options;
  
    const countMap = new Map();
  
    // 統計每個值的出現次數
    column.getCells().forEach(cell => {
      let v = cell.getValue();
  
      // 視需求決定要不要跳過 null / 空字串
      if (v === null || v === undefined || v === "") {
        if (!includeEmpty) return;
        v = ""; // 一律當成空字串 key
      }
  
      countMap.set(v, (countMap.get(v) || 0) + 1);
    });
  
    // 轉成陣列，方便排序： [value, count]
    const entries = Array.from(countMap.entries());
  
    // 依「次數」降序排序；次數一樣用 value 字母順序
    entries.sort((a, b) => {
      const countDiff = b[1] - a[1]; // 降序
      if (countDiff !== 0) return countDiff;
      return String(a[0]).localeCompare(String(b[0]));
    });
  
    // 組成 Tabulator 需要的 { value: label } 物件
    const result = {};
  
    for (const [value, count] of entries) {
      if (value === "" && includeEmpty) {
        result[""] = emptyLabel;
      } else {
        result[value] = showCount
          ? `${value} (${count})`  // 例如：Roman (123)
          : value;                 // 只顯示文字
      }
    }
  
    return result;
  }

  /** =========================
   *  Bootstrap
   *  ========================= */
  document.addEventListener("DOMContentLoaded", () => waitForTableAndInit());
  waitForTableAndInit(0);
  observeForTable();
})();
