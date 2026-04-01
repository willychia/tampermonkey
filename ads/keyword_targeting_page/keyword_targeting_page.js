// ==UserScript==
// @name         Keyword Targeting Page Enhanced Pro
// @namespace    http://tampermonkey.net/
// @version      2026.03.13.4
// @description  Cmd+A 條件勾選並自動更新 Bid 為 Min(1, CPC)
// @author       Willy Chia
// @match        https://admin.hourloop.com/amazon_ads/sp/keywords?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.js
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        .hover-highlight { border: 3px solid red !important; }
        .selected-highlight { border: 3px solid yellow !important; }
        #selection-counter {
            position: fixed; top: 10px; right: 80px; z-index: 9999;
            padding: 8px 15px; background: rgba(0, 0, 0, 0.7);
            color: white; border-radius: 5px; font-size: 14px; font-weight: bold;
            pointer-events: none;
        }
        .custom-float-btn {
            position: fixed; z-index: 9999; padding: 10px 15px;
            background: rgba(0, 0, 0, 0.7); color: white; border: none;
            border-radius: 5px; cursor: pointer; font-size: 14px;
        }
        .custom-float-btn:hover { background: black; }
    `);

    let table;
    let hoveredRow = null;
    let counterDiv;

    const isEditing = (ev) => {
        const el = ev.target;
        if (!el) return false;
        const tag = (el.tagName || '').toLowerCase();
        return el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    function init() {
        table = Tabulator.findTable('#keywords-table')[0];
        if (!table) return;
        setupColumns();
        setupUI();
        setupEvents();
        console.log('🚀 Bid Auto-Adjust Ready (Cmd+A)!');
    }

    function setupColumns() {
        const columns = table.getColumnDefinitions();
        if (columns.length > 0) columns[0].field = 'checkBox';

        const enhancedCols = columns.map((col) => {
            if (col.field === 'stock_on_hand') {
                return {
                    ...col,
                    headerFilter: 'number',
                    headerFilterFunc: '<=',
                    headerFilterPlaceholder: 'Less than'
                };
            }

            if (col.field === 'last_buy_box_timestamp' || col.field === 'created_at') {
                const isDay = col.field === 'created_at';
                return {
                    ...col,
                    headerFilter: 'number',
                    headerFilterPlaceholder: isDay ? 'Days within' : 'Hours within',
                    headerFilterFunc: (filterValue, cellValue) => {
                        const v = parseFloat(filterValue);
                        if (!Number.isFinite(v) || !cellValue) return true;
                        const diff = (Date.now() - new Date(cellValue).getTime()) / 36e5;
                        return (isDay ? diff / 24 : diff) <= v;
                    }
                };
            }

            return col;
        });

        table.setColumns(enhancedCols);
    }

    function setupUI() {
        counterDiv = document.createElement('div');
        counterDiv.id = 'selection-counter';
        counterDiv.innerText = '已選擇 0 列';
        document.body.appendChild(counterDiv);

        const buttons = [
            { t: 'E', r: '100px', b: '120px', a: () => table.getGroups().forEach((g) => g.show()) },
            { t: 'C', r: '100px', b: '60px', a: () => table.getGroups().forEach((g) => g.hide()) },
            { t: '⬆', r: '50px', b: '120px', a: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
            { t: '⬇', r: '50px', b: '60px', a: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) }
        ];

        buttons.forEach((btn) => {
            const el = document.createElement('button');
            el.className = 'custom-float-btn';
            el.innerText = btn.t;
            el.style.right = btn.r;
            el.style.bottom = btn.b;
            el.onclick = btn.a;
            document.body.appendChild(el);
        });
    }

    function setupEvents() {
        const updateCounter = () => {
            counterDiv.innerText = `已選擇 ${table.getSelectedRows().length} 列`;
        };

        table.on('rowMouseEnter', (e, row) => {
            hoveredRow = row;
            row.getElement().classList.add('hover-highlight');
        });

        table.on('rowMouseLeave', (e, row) => {
            hoveredRow = null;
            row.getElement().classList.remove('hover-highlight');
        });

        table.on('rowSelected', (row) => {
            row.getElement().classList.add('selected-highlight');
            updateCounter();
        });

        table.on('rowDeselected', (row) => {
            row.getElement().classList.remove('selected-highlight');
            updateCounter();
        });

        document.addEventListener('keydown', (e) => {
            if (isEditing(e)) return;

            const isMod = e.metaKey || e.ctrlKey;

            if (e.key === 'Enter' && hoveredRow) {
                e.preventDefault();
                hoveredRow.toggleSelect();
            }

            if (isMod) {
                const key = e.key.toLowerCase();
                switch (key) {
                    case 'a':
                        e.preventDefault();
                        smartConditionSelectAndAdjustBid();
                        break;
                    case 'arrowup':
                        e.preventDefault();
                        moveSelection(-1);
                        break;
                    case 'arrowdown':
                        e.preventDefault();
                        moveSelection(1);
                        break;
                    case 'e': {
                        e.preventDefault();
                        const activeRows = table.getRows('active');
                        const selectedActiveCount = activeRows.filter((r) => r.isSelected()).length;
                        selectedActiveCount > 0 ? table.deselectRow(activeRows) : table.selectRow(activeRows);
                        break;
                    }
                    case 'f':
                        e.preventDefault();
                        keywordSmartSelect();
                        break;
                    case 'b':
                        e.preventDefault();
                        table.deselectRow();
                        table.getRows().forEach((r) => {
                            r.getElement().style.backgroundColor = '';
                        });
                        break;
                    case 's':
                        e.preventDefault();
                        table.download('xlsx', 'filtered_table.xlsx', { sheetName: 'Data' });
                        break;
                    case '1':
                    case '2':
                    case '3':
                    case '4': {
                        e.preventDefault();
                        const colIdx = key === '4' ? 2 : 1;
                        const optIdx = key === '4' ? 0 : parseInt(key, 10) - 1;
                        openHeaderMenu(colIdx, optIdx);
                        break;
                    }
                    case 'x':
                        e.preventDefault();
                        openHeaderMenu(3, 0);
                        break;
                }
            }
        });
    }

    async function smartConditionSelectAndAdjustBid() {
        table.deselectRow();
        const activeRows = table.getRows('active');
        const targetRows = [];

        activeRows.forEach((row) => {
            const data = row.getData();
            const daysOfSupply = parseFloat(data.days_of_supply) || 0;
            const acos = parseFloat(data.acos) || 0;
            const unitsSold = parseInt(data.units_sold_same_sku, 10) || 0;
            const bidVal = parseFloat(parseFloat(data.bid || 0).toFixed(2));
            const cpcVal = parseFloat(parseFloat(data.cpc || 0).toFixed(2));

            const isGoodPerformance =
                daysOfSupply > 7 &&
                acos <= 0.1 &&
                unitsSold > 0 &&
                bidVal < cpcVal;

            if (isGoodPerformance) {
                row.select();
                targetRows.push(row);
            }
        });

        if (targetRows.length === 0) {
            console.log('沒有符合條件（含銷量 > 0）的關鍵字');
            return;
        }

        const header = document.querySelector(".tabulator-col[tabulator-field='checkBox'] .tabulator-col-sorter");
        if (header) header.click();

        await new Promise((resolve) => setTimeout(resolve, 300));
        scrollFirstSelectedToTop();

        let processedCount = 0;
        for (const row of targetRows) {
            const data = row.getData();
            const cpcVal = parseFloat(parseFloat(data.cpc || 0).toFixed(2));
            const newBid = Math.min(1, cpcVal).toFixed(2);

            const rowEl = row.getElement();
            const bidInput = rowEl.querySelector('input[name="bid_fixed_value"]');
            const saveBtn = rowEl.querySelector('button.save-bid-button[type="submit"]');

            if (bidInput && saveBtn) {
                bidInput.value = newBid;
                bidInput.dispatchEvent(new Event('input', { bubbles: true }));
                bidInput.dispatchEvent(new Event('change', { bubbles: true }));

                bidInput.style.backgroundColor = '#c8e6c9';

                saveBtn.click();
                processedCount++;

                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }

        console.log(`✅ 已完成 ${processedCount} 筆含銷量關鍵字的自動優化`);
    }

    function moveSelection(direction) {
        const selected = table.getSelectedRows();
        if (selected.length === 0) return;

        const targetRow = direction > 0
            ? selected[selected.length - 1].getNextRow()
            : selected[0].getPrevRow();

        if (targetRow) {
            table.deselectRow();
            targetRow.select();
            targetRow.getElement().scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    function keywordSmartSelect() {
        table.deselectRow();
        table.getRows('active').forEach((row) => {
            const kw = row.getData().keyword || '';
            const words = kw.trim().split(/\s+/);

            if (words.length >= 3) {
                row.select();
            }
        });

        const header = document.querySelector(".tabulator-col[tabulator-field='checkBox'] .tabulator-col-sorter");
        if (header) header.click();

        setTimeout(scrollFirstSelectedToTop, 300);
    }

    function openHeaderMenu(colIdx, optIdx) {
        const buttons = document.querySelectorAll('.tabulator-header-popup-button');
        if (buttons[colIdx]) {
            buttons[colIdx].click();
            setTimeout(() => {
                const items = document.querySelectorAll('.tabulator-menu-item');
                if (items[optIdx]) items[optIdx].click();
            }, 200);
        }
    }

    function scrollFirstSelectedToTop() {
        const selected = table.getSelectedRows()[0];
        if (selected) {
            table.scrollToRow(selected, 'top', false);
        }
    }

    const checkTabulator = setInterval(() => {
        if (typeof Tabulator !== 'undefined' && Tabulator.findTable('#keywords-table').length > 0) {
            clearInterval(checkTabulator);
            init();
        }
    }, 500);
})();
