// ==UserScript==
// @name         Ad Group Page Additonal Function
// @namespace    http://tampermonkey.net/
// @version      2025-07-04
// @description  Add functions to Amazon Ads ad group page
// @match        https://admin.hourloop.com/amazon_ads/sp/ad_groups?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.js
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  
  
  // ===========================================
  // 🧩 功能初始化主程序：初始化表格與增強邏輯
  // ===========================================
  function initTableEnhancements() {
    
    var table = Tabulator.findTable("#ad-groups-table")[0];
    if (!table) return;
    
    let columns = table.getColumnDefinitions();
    
    columns[0].field = "checkBox"; // 幫第一欄補上 field
    
    // 找到你想篩選的欄位（例如 num_enabled_targets）
    columns = columns.map(col => {
      if (col.field === "num_enabled_targets") {
        return {
          ...col,
          headerFilter: "number",
          headerFilterFunc: "<=",
          headerFilterPlaceholder: "Less than"
        };
      } else if (col.field === "stock_on_hand") {
        return {
          ...col,
          headerFilter: "number",
          headerFilterFunc: "<=",
          headerFilterPlaceholder: "Less than"
        };
      }
      return col;
    });
    
    // 套用更新後的欄位設定
    table.setColumns(columns);
    
    
    let hoveredRow = null; // 記錄當前 Hover 的行
    
    // ✅ [功能] 滑鼠懸停行 → 外框標示為紅色
    table.on("rowMouseEnter", function(e, row) {
      hoveredRow = row;
      let rowElement = row.getElement();
      rowElement.style.border = "3px solid red";
    });
    
    // 當滑鼠離開時，恢復原來的邊框
    table.on("rowMouseLeave", function(e, row) {
      let rowElement = row.getElement();
      rowElement.style.border = row.isSelected() ? "3px solid white" : "";
      hoveredRow = null;
    });
    
    // ✅ [功能] 勾選行時 → 外框標示為白色
    table.on("rowSelected", function(row) {
      row.getElement().style.border = "3px solid white";
    });
    
    table.on("rowDeselected", function(row) {
      row.getElement().style.border = "";
    });
    
    // ✅ [UI] 建立右上角選取列數的顯示區塊
    let counterDiv = document.createElement("div");
    counterDiv.id = "selection-counter";
    counterDiv.style.position = "fixed";
    counterDiv.style.top = "10px";
    counterDiv.style.right = "80px";
    counterDiv.style.zIndex = "9999";
    counterDiv.style.padding = "8px 15px";
    counterDiv.style.background = "rgba(0, 0, 0, 0.7)";
    counterDiv.style.color = "white";
    counterDiv.style.borderRadius = "5px";
    counterDiv.style.fontSize = "14px";
    counterDiv.style.fontWeight = "bold";
    counterDiv.innerText = "已選擇 0 列";
    
    document.body.appendChild(counterDiv);
    
    // ✅ 2. 更新顯示數字
    function updateSelectionCounter() {
      let selectedCount = table.getSelectedRows().length;
      counterDiv.innerText = `已選擇 ${selectedCount} 列`;
    }
    
    // ✅ 3. 監聽勾選變更
    table.on("rowSelected", updateSelectionCounter);
    table.on("rowDeselected", updateSelectionCounter);
    
    console.log("勾選計數器已啟動");
    
    // ✅ [快捷鍵] Enter → 切換目前 Hover 行的選取狀態
    document.addEventListener("keydown", function(event) {
      if (event.key === "Enter" && hoveredRow) {
        event.preventDefault(); // 阻止預設行為
        hoveredRow.toggleSelect();
      }
    });
    
    // ✅ [快捷鍵] Cmd/Ctrl + ↑ → 選取上一行
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "ArrowUp") {
        event.preventDefault(); // 阻止預設行為
        let selectedRows = table.getSelectedRows();
        let allRows = table.getRows();
        if (selectedRows.length > 0) {
          let firstRow = selectedRows[0]; // 取得當前選中的第一行
          let prevRow = firstRow.getPrevRow(); // 獲取上一行
          selectedRows.forEach(row => row.deselect()); // 取消所有勾選
          if (prevRow) prevRow.select(); // 選擇上一行
        }
      }
    });
    
    // ✅ [快捷鍵] Cmd/Ctrl + ↓ → 選取下一行
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "ArrowDown") {
        event.preventDefault(); // 阻止預設行為
        let selectedRows = table.getSelectedRows();
        let allRows = table.getRows();
        if (selectedRows.length > 0) {
          let lastRow = selectedRows[selectedRows.length - 1]; // 取得當前選中的最後一行
          let nextRow = lastRow.getNextRow(); // 獲取下一行
          selectedRows.forEach(row => row.deselect()); // 取消所有勾選
          if (nextRow) nextRow.select(); // 選擇下一行
        }
      }
    });
    
    // ✅ [快捷鍵] Cmd/Ctrl + E → 勾選 / 取消所有列
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "e") {
        event.preventDefault(); // 阻止預設行為
        let allRows = table.getRows("active");
        let selectedRows = table.getSelectedRows();
        if (selectedRows.length > 0) {
          table.deselectRow(allRows); // 取消全部勾選
        } else {
          table.selectRow(allRows); // 全部勾選
        }
      }
    });
    
    // ✅ [快捷鍵] Cmd/Ctrl + F → 高亮並勾選符合條件的列（如 num_enabled_targets < 10）
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault(); // 阻止預設行為
        let allRows = table.getRows(); // 取得當前排序後的所有行
        let matchingRows = []; // 存放符合條件的行資訊
        
        allRows.forEach(row => {
          let data = row.getData();
          let rowElement = row.getElement();
          
          if (!rowElement) return; // 確保行已載入
          
          if (data.num_enabled_targets < 10) {
            rowElement.style.backgroundColor = "rgba(255, 255, 100, 0.3)"; // 透明淡黃色
            
            // ✅ 取得行的當前視覺位置
            let position = row.getPosition();
            
            // ✅ 只存入 position 不是 false 的行
            if (position !== false) {
              matchingRows.push({ row, position });
            }
          } else {
            rowElement.style.backgroundColor = ""; // 回復原色
          }
        });
        
        // ✅ 找到 `matchingRows` 中 `position` 最小的行
        if (matchingRows.length > 0) {
          let topRow = matchingRows.reduce((min, row) => row.position < min.position ? row : min, matchingRows[0]);
          
          // ✅ 先取消所有勾選，再勾選最上方的符合條件行
          table.deselectRow();
          topRow.row.select();
          
          console.log("已勾選最上方的符合條件行");
        }
        
        scrollSelectedRowToTop();
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "b") {
        event.preventDefault(); // 阻止預設行為
        let allRows = table.getRows(); // 取得當前排序後的所有行
        
        allRows.forEach(row => {
          let data = row.getData();
          let rowElement = row.getElement();
          
          if (!rowElement) return; // 確保行已載入
          
          rowElement.style.backgroundColor = ""; // 回復原色
        });
        
        table.deselectRow();
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "d") {
        event.preventDefault(); // 阻止預設行為
        let selectedRows = table.getSelectedRows();
        let links = [];
        
        selectedRows.forEach(row => {
          let cell = row.getCell("product_image_url"); // 只抓這個欄位
          if (cell) {
            let cellElement = cell.getElement();
            let anchorTag = cellElement.querySelector("a"); // 找到 <a> 標籤
            if (anchorTag && anchorTag.href) {
              links.push(anchorTag.href); // 抓取 <a> 的 href 屬性
            }
          }
        });
        
        if (links.length > 0 && links.length <= 20) {
          links.forEach(link => window.open(link, "_blank")); // 在新分頁開啟
        } else if (links.length > 20) {
          console.warn("勾選過多的超連結");
        } else {
          console.warn("沒有找到可用的超連結");
        }
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault(); // 阻止預設行為
        let selectedRows = table.getSelectedRows();
        let links = [];
        
        selectedRows.forEach(row => {
          let cell = row.getCell("num_enabled_targets"); // 只抓這個欄位
          if (cell) {
            let cellElement = cell.getElement();
            let anchorTag = cellElement.querySelector("a"); // 找到 <a> 標籤
            if (anchorTag && anchorTag.href) {
              links.push(anchorTag.href); // 抓取 <a> 的 href 屬性
            }
          }
        });
        
        if (links.length > 0 && links.length <= 20) {
          links.forEach(link => window.open(link, "_blank")); // 在新分頁開啟
        } else if (links.length > 20) {
          console.warn("勾選過多的超連結");
        } else {
          console.warn("沒有找到可用的超連結");
        }
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        let filteredRows = table.getRows("active"); // 取得目前篩選後的行
        
        if (filteredRows.length === 0) {
          console.warn("沒有篩選後的資料可供下載");
          return;
        }
        
        // ✅ 將篩選後的數據轉換為 JSON
        let dataToExport = filteredRows.map(row => row.getData());
        
        // ✅ 下載 Excel 檔案
        table.download("xlsx", "filtered_table.xlsx", {
          sheetName: "Filtered Data",
          data: dataToExport // 只下載篩選後的資料
        });
        
        console.log("篩選後的表格已下載");
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "j") {
        event.preventDefault();
        let allRows = table.getRows();
        
        allRows.forEach(row => {
          let data = row.getData();
          let rowElement = row.getElement();
          
          if (!rowElement) return; // 確保行已載入
          
          if (!data.product_image_url) {
            console.log(data.ad_group_name);
            row.select();
          }
        });
        
        if(table.getSelectedData()) {
          table.setSort("checkBox", "desc");
        };
        
      }
    });
    
    // ✅ [快捷鍵] Cmd/Ctrl + 數字鍵 → 開啟表格欄位排序選單
    
    // ===========================================
    // 🔧 公用函式：點擊表格欄位選單中的選項
    // ===========================================
    function openHeaderMenuAndClickOption(columnIndex = 0, optionIndex = 0) {
      
      let menuButtons = document.querySelectorAll('.tabulator-col .tabulator-header-popup-button');
      if (menuButtons[columnIndex]) {
        menuButtons[columnIndex].click(); // 打開選單
        
        setTimeout(() => {
          let menuItems = document.querySelectorAll('.tabulator-menu-item');
          if (menuItems[optionIndex]) {
            menuItems[optionIndex].click(); // 點擊選單選項
          }
        }, 200);
      }
    }
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "1") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(0, 0);
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "2") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(0, 1);
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "3") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(0, 2);
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "4") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(0, 3);
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "5") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(0, 4);
      }
    });
    
    document.addEventListener("keydown", function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "x") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(0, 5);
      }
    });
    
    
    // ✅ 複製到剪貼簿
    
    // ===========================================
    // 📋 公用函式：複製文字到剪貼簿
    // ===========================================
    function copyToClipboard(text) {
      
      let textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    
    // ✅ 新增右下角的「回到最上方」與「回到最下方」按鈕
    
    // ===========================================
    // 🖱️ UI 建立：右下角功能按鈕產生器
    // ===========================================
    function createRightDownButton(text, right, bottom, action) {
      
      let btn = document.createElement("button");
      btn.innerText = text;
      btn.style.position = "fixed";
      btn.style.right = right;
      btn.style.bottom = bottom;
      btn.style.zIndex = "9999";
      btn.style.padding = "10px 15px";
      btn.style.background = "rgba(0, 0, 0, 0.7)";
      btn.style.color = "white";
      btn.style.border = "none";
      btn.style.borderRadius = "5px";
      btn.style.cursor = "pointer";
      btn.style.fontSize = "14px";
      btn.addEventListener("mouseenter", () => btn.style.background = "black");
      btn.addEventListener("mouseleave", () => btn.style.background = "rgba(0, 0, 0, 0.7)");
      btn.addEventListener("click", action);
      document.body.appendChild(btn);
    }
    
    
    // 「回到最上方」按鈕
    createRightDownButton("E", "100px", "120px", expandAllGroups);
    // 「回到最上方」按鈕
    createRightDownButton("C", "100px", "60px", collapseAllGroups);
    
    // 「回到最上方」按鈕
    createRightDownButton("⬆", "50px", "120px", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    // 「回到最下方」按鈕
    createRightDownButton("⬇", "50px", "60px", () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    
    function collapseAllGroups() {
      let groupCount = table.getGroups().length;
      for (let i = 0; i < groupCount; i++) {
        table.getGroups()[i].hide();
      }
    };
    
    function expandAllGroups() {
      let groupCount = table.getGroups().length;
      for (let i = 0; i < groupCount; i++) {
        table.getGroups()[i].show();
      }
    };
    
    
    // ===========================================
    // 🧭 輔助功能：將選取的行滾動到頁面頂部
    // ===========================================
    function scrollSelectedRowToTop() {
      
      let selectedRows = table.getSelectedRows();
      
      if (selectedRows.length === 0) {
        console.warn("沒有選擇任何行，無法滾動");
        return;
      }
      
      let firstRow = selectedRows[0]; // 取得第一個被勾選的行
      
      // ✅ 1. 讓 Tabulator 內部滾動到該行，確保它被載入
      table.scrollToRow(firstRow, "top", false).then(() => {
        console.log("已將表格滾動到該行");
        
        // ✅ 2. 取得該行的 DOM 元素
        let rowElement = firstRow.getElement();
        if (!rowElement) {
          console.warn("仍無法找到行的 DOM 元素，可能是虛擬 DOM 尚未渲染");
          return;
        }
        
        // ✅ 3. 讓 Tabulator 內部滾動條精確滾動，使該行置頂
        let tableContainer = table.element; // Tabulator 容器
        let rowOffset = rowElement.offsetTop; // 計算行的位置
        tableContainer.scrollTop = rowOffset;
        
        console.log("Tabulator 內部滾動成功");
        
        // ✅ 4. 讓網頁主滾動條同步調整
        let tableTopOffset = tableContainer.getBoundingClientRect().top + window.scrollY;
        let targetScrollY = rowOffset + tableTopOffset;
        window.scrollTo({ top: targetScrollY, behavior: "smooth" });
        
        console.log("已將頁面滾動到該行");
      }).catch(() => {
        console.warn("表格滾動失敗，可能是虛擬 DOM 限制");
      });
    }
    
    if (document.getElementById("asin-filter-box")) return; // 避免重複插入
    
    // 建立輸入區塊
    const container = document.createElement("div");
    container.id = "asin-filter-box";
    container.style.position = "fixed";
    container.style.top = "10px";
    container.style.right = "200px";
    container.style.zIndex = 9999;
    container.style.background = "#fff";
    container.style.border = "1px solid #ccc";
    container.style.padding = "10px";
    container.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    container.style.borderRadius = "8px";
    container.innerHTML = `
    <textarea id="asin-input" rows="5" style="width: 200px;" placeholder="貼上 ASIN，一行一個"></textarea>
    <br>
    <button id="apply-asin-filter">勾選符合 ASIN</button>
    `;
    document.body.appendChild(container);
    
    // 處理按鈕點擊
    document.getElementById("apply-asin-filter").addEventListener("click", () => {
      const asinText = document.getElementById("asin-input").value.trim();
      if (!asinText) return;
      
      const asinList = asinText
      .split(/[\s,]+/)
      .map(a => a.trim().toUpperCase().replace(/^"|"$/g, ''))
      .filter(a => a); // 清除空白
      
      console.log(asinList);
      
      const rows = table.getRows();
      
      table.deselectRow(); // 清除舊的勾選
      
      let matchedCount = 0;
      
      rows.forEach(row => {
        const data = row.getData();
        const rowElement = row.getElement();
        
        let asin = (data.ad_group_name || "").toUpperCase();
        if (!asin && rowElement) {
          asin = rowElement.querySelector('a[href*="asin:"]')?.textContent?.trim().toUpperCase() || "";
        }
        
        if (asinList.includes(asin)) {
          matchedCount++;
          row.select();
        }
      });
      
      table.setSort("checkBox", "desc");
      
      scrollSelectedRowToTop();
      
      console.log(`共勾選 ${matchedCount} 筆 ASIN 符合的資料`);
    });
    
    console.log("Tampermonkey Script Loaded: Tabulator Enhancements Activated!");
  }
  
  let checkTabulator = setInterval(() => {
    if (typeof Tabulator !== "undefined" && Tabulator.findTable("#ad-groups-table").length > 0) {
      clearInterval(checkTabulator);
      initTableEnhancements();
    }
  }, 500);
})();
