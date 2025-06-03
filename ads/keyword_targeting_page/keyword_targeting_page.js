// ==UserScript==
// @name         Keyword Targeting Page Additional Function
// @namespace    http://tampermonkey.net/
// @version      2025-05-29.2
// @description  Add enhanced features to Tabulator table, using tabulator
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/keywords?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.js
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  function initTableEnhancements() {
    var table = Tabulator.findTable("#keywords-table")[0];
    if (!table) return;

    let hoveredRow = null; // 記錄當前 Hover 的行

    // ✅ 1. 當 Hover 列時，外框變成粗紅色
    table.on("rowMouseEnter", function(e, row) {
      hoveredRow = row;
      let rowElement = row.getElement();
      rowElement.style.border = "3px solid red";
    });

    // 當滑鼠離開時，恢復原來的邊框
    table.on("rowMouseLeave", function(e, row) {
      let rowElement = row.getElement();
      rowElement.style.border = row.isSelected() ? "3px solid yellow" : "";
      hoveredRow = null;
    });

    // ✅ 2. 當列被勾選時，外框變成粗黃色
    table.on("rowSelected", function(row) {
      row.getElement().style.border = "3px solid yellow";
    });

    table.on("rowDeselected", function(row) {
      row.getElement().style.border = "";
    });

    // ✅ 1. 創建右上角的顯示框
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

    // ✅ 3. 當 Hover 列且按下 Enter 時，該列勾選/取消勾選
    document.addEventListener("keydown", function(event) {
      if (event.key === "Enter" && hoveredRow) {
        event.preventDefault(); // 阻止預設行為
        hoveredRow.toggleSelect();
      }
    });

    // ✅ 4. Cmd + 上方向鍵：取消當前勾選並改選上一列
    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "ArrowUp") {
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

    // ✅ 5. Cmd + 下方向鍵：取消當前勾選並改選下一列
    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "ArrowDown") {
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

    // ✅ 6. Cmd + E：全部勾選/全部取消勾選
    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "e") {
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

    // ✅ 7. Cmd + F
    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "f") {
        event.preventDefault(); // 阻止預設行為
        table.deselectRow();

        table.getRows().forEach(row => {
          let data = row.getData();
          let rowElement = row.getElement();

          if (!rowElement) return; // 確保行已載入

          if (!isSingleSpace(data.keyword) && data.target_quality.label === "Unknown"  && data.state != "Archived") {
            rowElement.style.backgroundColor = "rgba(255, 255, 100, 0.3)"; // 透明淡黃色
            row.select();
          } else {
            rowElement.style.backgroundColor = ""; // 回復原色
          }
        });

        sortByCheckBox();
        scrollSelectedRowToTop();
      }
    });

    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "b") {
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

    // ✅ 8. Cmd + 1：執行 openHeaderMenuAndClickOption(0, 0)
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
      if (event.metaKey && event.key === "1") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(1, 0);
      }
    });

    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "2") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(1, 1);
      }
    });

    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "3") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(1, 2);
      }
    });

    document.addEventListener("keydown", function(event) {
      if (event.metaKey && event.key === "x") {
        event.preventDefault(); // 阻止預設行為
        openHeaderMenuAndClickOption(3, 0);
      }
    });

    // ✅ 複製到剪貼簿
    function copyToClipboard(text) {
      let textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

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

    function isSingleSpace(str) {
      return str.trim().split(/\s+/).length === 2;
    }

    function sortByCheckBox() {
      document.querySelector("#keywords-table > div.tabulator-header > div > div.tabulator-headers > div:nth-child(1) > div > div > div.tabulator-col-sorter > div").click();
    }

    console.log("Tampermonkey Script Loaded: Tabulator Enhancements Activated!");
  }

  let checkTabulator = setInterval(() => {
    if (typeof Tabulator !== "undefined" && Tabulator.findTable("#keywords-table").length > 0) {
      clearInterval(checkTabulator);
      initTableEnhancements();
    }
  }, 500);
})();
