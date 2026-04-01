(function () {
    "use strict";

    if (window.TMTabulatorPageUtils) return;

    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

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

    function bindSelectionState(activeTable, counterId, hoveredState) {
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

    async function sortByField(activeTable, field, dir) {
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

    window.TMTabulatorPageUtils = {
        bindSelectionState,
        ensureButtons,
        ensureCounter,
        getTableBySelector,
        isEditingEvent,
        scrollFirstSelectedToTop,
        sortByField,
        startInitObserver,
        wait
    };
})();
