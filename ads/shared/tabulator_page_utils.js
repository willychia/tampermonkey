(function () {
    "use strict";

    // -----------------------------
    // 模組初始化
    // -----------------------------
    // 這個檔案提供多個頁面共用的 Tabulator 小工具，
    // 掛在 window 上之後就能被各個 userscript 重複使用。
    // 避免共用工具在同一頁被重複掛載，造成事件或方法覆寫。
    if (window.TMTabulatorPageUtils) return;

    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    // -----------------------------
    // 基礎工具
    // -----------------------------
    // 這些方法主要處理延遲等待與編輯狀態判斷，
    // 讓鍵盤快捷鍵不會干擾使用者在輸入元件內的操作。
    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isEditingEvent(ev) {
        const el = ev.target;
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        return el.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
    }

    function getTableBySelector(selector) {
        const tabulator = pageWindow?.Tabulator;
        if (typeof tabulator === "undefined" || !tabulator.findTable) return null;
        return tabulator.findTable(selector)[0] || null;
    }

    const TOAST_CONTAINER_ID = "tm-page-toast-container";
    let toastHideTimer = null;

    function ensureToastContainer() {
        let container = document.getElementById(TOAST_CONTAINER_ID);
        if (container) return container;

        container = document.createElement("div");
        container.id = TOAST_CONTAINER_ID;
        container.style.position = "fixed";
        container.style.top = "16px";
        container.style.left = "50%";
        container.style.transform = "translateX(-50%)";
        container.style.zIndex = "10000";
        container.style.pointerEvents = "none";
        document.body.appendChild(container);
        return container;
    }

    function showAlert(message) {
        const container = ensureToastContainer();

        container.textContent = message;
        container.style.padding = "10px 16px";
        container.style.background = "rgba(32, 33, 36, 0.92)";
        container.style.color = "#fff";
        container.style.borderRadius = "8px";
        container.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.24)";
        container.style.fontSize = "14px";
        container.style.fontWeight = "600";
        container.style.opacity = "1";
        container.style.transition = "opacity 0.2s ease";

        if (toastHideTimer) {
            clearTimeout(toastHideTimer);
        }

        toastHideTimer = setTimeout(() => {
            container.style.opacity = "0";
        }, 2600);
    }

    // -----------------------------
    // DOM 與狀態比對
    // -----------------------------
    // 這一段用來穩定判斷兩個 row 是否為同一列，
    // 並在需要時建立共用的計數器與浮動按鈕。
    function sameRow(rowA, rowB) {
        return rowA && rowB && rowA.getElement && rowB.getElement && rowA.getElement() === rowB.getElement();
    }

    function ensureCounter(counterId, text) {
        let counterDiv = document.getElementById(counterId);
        if (!counterDiv) {
            counterDiv = document.createElement("div");
            counterDiv.id = counterId;
            document.body.appendChild(counterDiv);
        }
        if (typeof text === "string") counterDiv.innerText = text;
        return counterDiv;
    }

    function ensureButtons(buttons, buttonClass) {
        buttons.forEach((btn) => {
            let el = document.getElementById(btn.id);
            if (!el) {
                el = document.createElement("button");
                el.id = btn.id;
                el.className = buttonClass;
                el.innerText = btn.text;
                el.style.right = btn.right;
                el.style.bottom = btn.bottom;
                document.body.appendChild(el);
            }
            el.onclick = btn.action;
        });
    }

    // -----------------------------
    // 表格互動綁定
    // -----------------------------
    // 將 hover、選取與計數器更新集中管理，
    // 讓各頁只要呼叫一次就能取得一致的互動效果。
    function bindSelectionState(activeTable, counterId, hoveredState) {
        // 將列 hover 與 selected 狀態統一集中處理，讓各頁腳本共用同一套視覺回饋。
        const update = () => {
            const counterDiv = document.getElementById(counterId);
            if (counterDiv) {
                counterDiv.innerText = `已選擇 ${activeTable.getSelectedRows().length} 列`;
            }
        };

        activeTable.on("rowMouseEnter", (e, row) => {
            hoveredState.current = row;
            row.getElement().classList.add("hover-highlight");
        });

        activeTable.on("rowMouseLeave", (e, row) => {
            if (sameRow(hoveredState.current, row)) hoveredState.current = null;
            row.getElement().classList.remove("hover-highlight");
        });

        activeTable.on("rowSelected", (row) => {
            row.getElement().classList.add("selected-highlight");
            update();
        });

        activeTable.on("rowDeselected", (row) => {
            row.getElement().classList.remove("selected-highlight");
            update();
        });
    }

    // -----------------------------
    // 排序與定位
    // -----------------------------
    // 這些 helper 用來在批次勾選或排序後，
    // 將畫面快速定位回使用者最需要看的列。
    async function sortByField(activeTable, field, dir) {
        // Tabulator 在某些情況下排序是非同步的，這裡統一等待排序完成再往下執行。
        const result = activeTable.setSort(field, dir);
        if (result && typeof result.then === "function") {
            await result;
        }
        await wait(100);
    }

    function scrollFirstSelectedToTop(activeTable) {
        const selected = activeTable.getSelectedRows()[0];
        if (selected) {
            activeTable.scrollToRow(selected, "top", false);
        }
    }

    function nodeTouchesSelector(node, selector) {
        if (!(node instanceof Element)) return false;
        return node.matches(selector) || Boolean(node.querySelector(selector));
    }

    // -----------------------------
    // DOM 變動監聽
    // -----------------------------
    // Hourloop 頁面常常會由前端框架重新渲染表格，
    // 因此需要透過 MutationObserver 在表格重建時自動重新初始化。
    function mutationsTouchSelector(mutations, selector) {
        return mutations.some((mutation) => {
            if (nodeTouchesSelector(mutation.target, selector)) return true;
            return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => nodeTouchesSelector(node, selector));
        });
    }

    function startInitObserver(selector, init) {
        let scheduled = false;

        const scheduleInit = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                init();
            });
        };

        const observer = new MutationObserver((mutations) => {
            // Tabulator 表格常會被前端框架重建，偵測到相關 DOM 變動時重新初始化即可。
            if (mutationsTouchSelector(mutations, selector)) {
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
        return observer;
    }

    // -----------------------------
    // 對外匯出
    // -----------------------------
    // 將共用方法統一掛到全域，
    // 讓頁面腳本只需透過 window.TMTabulatorPageUtils 存取。
    window.TMTabulatorPageUtils = {
        bindSelectionState,
        ensureButtons,
        ensureCounter,
        getTableBySelector,
        isEditingEvent,
        scrollFirstSelectedToTop,
        showAlert,
        sortByField,
        startInitObserver,
        wait
    };
})();
