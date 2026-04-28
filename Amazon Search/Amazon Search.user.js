// ==UserScript==
// @name         Amazon Search - Smart Panel & Filter (v2.4.0)
// @namespace    https://willy-toolbox.example
// @version      2.4.0
// @description  支援 Detail Page tm_* 篩選參數、最高評分、面板拖曳、設定記憶、動態載入重掃描與 ASIN 複製。
// @author       Willy
// @match        https://www.amazon.com/s?*
// @match        https://www.amazon.co.uk/s?*
// @match        https://www.amazon.co.jp/s?*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/Amazon%20Search/Amazon%20Search.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/Amazon%20Search/Amazon%20Search.user.js
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        COPY_DELIM: '\n',
        THEME_COLOR: '#e47911',
        BAR_BG: '#232f3e',
        PRICE_COLOR: '#FFD700',
        STORAGE_KEY: 'amz-search-smart-panel-v2'
    };

    const state = {
        selected: new Set(),
        allProducts: [],
        processedItems: new WeakSet(),
        autoPickCounted: 0,
        isMinimized: false,
        isVisible: true,
        flashTimer: null
    };

    /** ===== UI 樣式升級 ===== */
    GM_addStyle(`
        #amz-asin-panel {
            position: fixed; top: 80px; right: 20px; z-index: 2147483647;
            background: rgba(255, 255, 255, 0.95); border: 2px solid #ddd; border-radius: 12px;
            font: 13px system-ui, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            width: 240px; display: flex; flex-direction: column;
            transition: all 0.3s ease; opacity: 0.4; backdrop-filter: blur(4px);
        }
        /* 滑鼠移入恢復不透明 */
        #amz-asin-panel:hover { opacity: 1; background: #fff; }

        /* 縮小模式樣式 */
        #amz-asin-panel.minimized { width: 120px; overflow: hidden; opacity: 0.8; }
        #amz-asin-panel.minimized .filter-body,
        #amz-asin-panel.minimized .hint-box { display: none; }

        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid #eee; cursor: move; }
        .btn-toggle { cursor: pointer; color: #888; font-size: 16px; font-weight: bold; padding: 0 5px; }
        .btn-toggle:hover { color: ${CONFIG.THEME_COLOR}; }

        .filter-body { padding: 10px 15px; display: flex; flex-direction: column; gap: 6px; }
        .filter-group { display: flex; flex-direction: column; gap: 3px; }
        .filter-group label { font-weight: 600; font-size: 11px; color: #555; }
        .filter-group input { padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; }

        .hint-box { background: #f9f9f9; padding: 8px 15px; border-radius: 0 0 12px 12px; font-size: 11px; border-top: 1px solid #eee; line-height: 1.5; }

        /* Action Bar */
        .amz-asin-action-bar { background-color: ${CONFIG.BAR_BG}; color: #fff; display: flex; flex-direction: column; padding: 10px 14px; border-radius: 8px 8px 0 0; cursor: pointer; margin-bottom: 2px; }
        .amz-asin-action-bar.selected { background-color: ${CONFIG.THEME_COLOR} !important; }
        .bar-asin { font-family: monospace; font-weight: 800; font-size: 18px; }
        .bar-title { font-size: 12px; line-height: 1.35; margin-bottom: 6px; overflow-wrap: anywhere; word-break: normal; }
        .bar-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; font-size: 12px; color: rgba(255,255,255,0.88); }
        .bar-price { font-size: 16px; font-weight: 800; color: ${CONFIG.PRICE_COLOR}; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4px; }

        .amz-asin-check-wrapper { width: 22px; height: 22px; background: #fff; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
        .amz-asin-check-icon { color: ${CONFIG.THEME_COLOR}; font-weight: 900; display: none; font-size: 16px; }
        .amz-asin-action-bar.selected .amz-asin-check-icon { display: block; }

        .amz-flash { position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.9); color: #fff; padding: 12px 28px; border-radius: 30px; z-index: 2147483647; display: none; font-weight: 600; }

        #amz-panel-rescue {
            position: fixed; top: 78px; right: 20px; z-index: 2147483647;
            display: none; align-items: center; justify-content: center;
            height: 34px; padding: 0 12px; border: 0; border-radius: 8px;
            background: ${CONFIG.THEME_COLOR}; color: #fff; font: 800 12px system-ui, sans-serif;
            box-shadow: 0 4px 16px rgba(0,0,0,0.25); cursor: pointer;
        }
        #amz-panel-rescue:hover { filter: brightness(0.95); }
    `);

    function loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '{}');
        } catch (_) {
            return {};
        }
    }

    function saveSettings(patch = {}) {
        try {
            const current = loadSettings();
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
        } catch (_) {
            // 設定記憶失敗不影響主要篩選功能。
        }
    }

    const settings = loadSettings();
    state.isMinimized = Boolean(settings.isMinimized);
    state.isVisible = settings.isVisible !== false;

    /** ===== 初始化面板 ===== */
    const panel = document.createElement('div');
    panel.id = 'amz-asin-panel';
    panel.innerHTML = `
        <div class="panel-header">
            <span style="font-weight:800;color:${CONFIG.THEME_COLOR}">AMZ Filter</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <span><b id="main-count">0</b></span>
                <span id="panel-minimize-btn" class="btn-toggle" title="縮小/展開">−</span>
            </div>
        </div>
        <div class="filter-body">
            <div class="filter-group"><label>最大數量 (⌘+G)</label><input type="number" id="f-limit" value="10"></div>
            <div class="filter-group"><label>最低價格</label><input type="number" id="f-min" placeholder="0"></div>
            <div class="filter-group"><label>最低評分</label><input type="number" id="f-rating" min="0" max="5" step="0.1" placeholder="0-5"></div>
            <div class="filter-group"><label>最高評分</label><input type="number" id="f-max-rating" min="0" max="5" step="0.1" placeholder="0-5"></div>
            <div class="filter-group"><label>最少評論數</label><input type="number" id="f-reviews" min="0" step="1" placeholder="0"></div>
            <div class="filter-group"><label>排除單詞</label><input type="text" id="f-excl"></div>
            <div class="filter-group"><label>包含單詞</label><input type="text" id="f-incl"></div>
        </div>
        <div class="hint-box">
            <b>⌘ G</b> 篩選 | <b>⌘ D</b> 複製 | <b>⌘ E</b> 清除<br>
            <b>⌘ B</b> 顯示/隱藏面板
        </div>
    `;
    document.body.appendChild(panel);
    if (settings.panelLeft !== undefined && settings.panelTop !== undefined) {
        panel.style.left = `${settings.panelLeft}px`;
        panel.style.top = `${settings.panelTop}px`;
        panel.style.right = 'auto';
    }

    const rescueBtn = document.createElement('button');
    rescueBtn.id = 'amz-panel-rescue';
    rescueBtn.type = 'button';
    rescueBtn.title = '顯示 AMZ Filter 面板';
    rescueBtn.textContent = 'AMZ';
    document.body.appendChild(rescueBtn);

    function getDefaultPanelPosition(width) {
        return {
            left: Math.max(8, window.innerWidth - width - 20),
            top: 80
        };
    }

    function getSafePanelPosition() {
        const rect = panel.getBoundingClientRect();
        const width = panel.offsetWidth || rect.width || 240;
        const height = panel.offsetHeight || rect.height || 80;
        const minVisible = Math.min(80, Math.max(40, width / 3));
        const isLost =
            rect.right < minVisible ||
            rect.left > window.innerWidth - minVisible ||
            rect.bottom < minVisible ||
            rect.top > window.innerHeight - minVisible;
        const base = isLost ? getDefaultPanelPosition(width) : { left: rect.left, top: rect.top };

        return {
            left: Math.min(Math.max(8, base.left), Math.max(8, window.innerWidth - width - 8)),
            top: Math.min(Math.max(8, base.top), Math.max(8, window.innerHeight - height - 8))
        };
    }

    function ensurePanelPosition() {
        const position = getSafePanelPosition();
        panel.style.left = `${position.left}px`;
        panel.style.top = `${position.top}px`;
        panel.style.right = 'auto';
        saveSettings({ panelLeft: Math.round(position.left), panelTop: Math.round(position.top) });
    }

    function setPanelVisible(isVisible, shouldSave = true) {
        state.isVisible = isVisible;
        panel.style.display = isVisible ? 'flex' : 'none';
        rescueBtn.style.display = isVisible ? 'none' : 'flex';
        if (isVisible) requestAnimationFrame(ensurePanelPosition);
        if (shouldSave) saveSettings({ isVisible: state.isVisible });
    }

    panel.classList.toggle('minimized', state.isMinimized);
    setPanelVisible(state.isVisible, false);
    document.getElementById('panel-minimize-btn').textContent = state.isMinimized ? "+" : "−";

    rescueBtn.onclick = () => {
        setPanelVisible(true);
        flash('顯示面板');
    };

    // 面板縮小切換
    document.getElementById('panel-minimize-btn').onclick = () => {
        state.isMinimized = !state.isMinimized;
        panel.classList.toggle('minimized', state.isMinimized);
        document.getElementById('panel-minimize-btn').textContent = state.isMinimized ? "+" : "−";
        saveSettings({ isMinimized: state.isMinimized });
    };

    setupDrag(panel);

    const flashEl = document.createElement('div');
    flashEl.className = 'amz-flash';
    document.body.appendChild(flashEl);

    /** ===== 核心邏輯 ===== */
    function flash(msg) {
        flashEl.textContent = msg;
        flashEl.style.display = 'block';
        clearTimeout(state.flashTimer);
        state.flashTimer = setTimeout(() => (flashEl.style.display = 'none'), 2000);
    }

    function applyUrlFilters() {
        const params = new URLSearchParams(location.search);
        const mappings = [
            ['tm_min_price', 'f-min'],
            ['tm_min_rating', 'f-rating'],
            ['tm_max_rating', 'f-max-rating'],
            ['tm_min_reviews', 'f-reviews']
        ];
        let applied = false;

        mappings.forEach(([param, inputId]) => {
            const value = params.get(param);
            const input = document.getElementById(inputId);
            if (value !== null && value !== '' && input) {
                input.value = value;
                applied = true;
            }
        });

        const intent = params.get('tm_intent');
        if (intent) {
            panel.querySelector('.hint-box').insertAdjacentHTML(
                'afterbegin',
                `<div style="margin-bottom:4px;"><b>Intent</b>: ${intent.replace(/_/g, ' ')}</div>`
            );
            applied = true;
        }

        return applied;
    }

    function updateCountUI() { document.getElementById('main-count').textContent = state.selected.size; }
    function toggleSelect(asin, barEl, isSelected) {
        if (isSelected) {
            state.selected.add(asin);
        } else {
            state.selected.delete(asin);
        }
        syncAsinBars(asin);
        if (barEl) barEl.classList.toggle('selected', state.selected.has(asin));
        updateCountUI();
    }

    function syncAsinBars(asin) {
        state.allProducts
            .filter(info => info.asin === asin && info.bar.isConnected)
            .forEach(info => info.bar.classList.toggle('selected', state.selected.has(asin)));
    }

    function clearSelected() {
        state.selected.clear();
        state.allProducts.forEach(p => p.bar.classList.remove('selected'));
        updateCountUI();
    }

    function parseTerms(value) {
        return value.toLowerCase().split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
    }

    function getFilterValues() {
        return {
            limit: Math.max(0, parseInt(document.getElementById('f-limit').value, 10) || 10),
            minPrice: parseFloat(document.getElementById('f-min').value) || 0,
            minRating: parseFloat(document.getElementById('f-rating').value) || 0,
            maxRating: parseFloat(document.getElementById('f-max-rating').value) || 0,
            minReviews: parseInt(document.getElementById('f-reviews').value, 10) || 0,
            excl: parseTerms(document.getElementById('f-excl').value),
            incl: parseTerms(document.getElementById('f-incl').value)
        };
    }

    function normalizeProductText(value) {
        return (value || '').replace(/\s+/g, ' ').trim();
    }

    function getProductTitle(item) {
        const selectors = [
            'h2 a',
            'h2 a span',
            'h2 span',
            'h3 a',
            'h3 a span',
            '.a-text-normal',
            '.s-title-instructions-style',
            'img.s-image'
        ];
        const candidates = [];

        for (const selector of selectors) {
            const el = item.querySelector(selector);
            if (!el) continue;
            ['aria-label', 'title', 'alt'].forEach(attr => {
                const text = normalizeProductText(el.getAttribute(attr));
                if (text) candidates.push(text);
            });
            const textContent = normalizeProductText(el.textContent);
            if (textContent) candidates.push(textContent);
            const innerText = normalizeProductText(el.innerText);
            if (innerText) candidates.push(innerText);
        }

        candidates.sort((a, b) => {
            const aTruncated = /(?:\.{3}|…)\s*$/.test(a);
            const bTruncated = /(?:\.{3}|…)\s*$/.test(b);
            if (aTruncated !== bTruncated) return aTruncated ? 1 : -1;
            return b.length - a.length;
        });

        return candidates[0] || "";
    }

    function getCleanTitle(item) {
        const title = getProductTitle(item);
        if (title) return title.toLowerCase();
        return "";
    }

    function runFilter() {
        pruneProducts();
        const { limit, minPrice, minRating, maxRating, minReviews, excl, incl } = getFilterValues();

        clearSelected();

        let count = 0;
        for (let info of state.allProducts) {
            if (count >= limit) break;
            const title = (info.title || getCleanTitle(info.item)).toLowerCase();
            let match = true;
            if (info.price < minPrice) match = false;
            if (match && minRating > 0 && info.rating < minRating) match = false;
            if (match && maxRating > 0 && info.rating > maxRating) match = false;
            if (match && minReviews > 0 && info.reviews < minReviews) match = false;
            if (match && excl.length > 0 && excl.some(w => title.includes(w))) match = false;
            if (match && incl.length > 0 && !incl.every(w => title.includes(w))) match = false;
            if (match) { toggleSelect(info.asin, info.bar, true); count++; }
        }
        flash(`🔍 篩選完成：符合 ${state.selected.size} 項`);
    }

    function isSponsored(item) {
        const text = item.innerText || '';
        return text.includes('Sponsored') || text.includes('贊助') || text.includes('スポンサー');
    }

    function getPriceInfo(item) {
        const priceText = item.querySelector('.a-price .a-offscreen')?.innerText
            || item.querySelector('.a-price')?.innerText?.replace(/\s+/g, '')
            || '$0';
        const priceNum = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        return { priceText, priceNum };
    }

    function parseCompactNumber(value) {
        const text = normalizeProductText(value);
        const match = text.match(/(\d[\d.,]*)(?:\s*([kKmM]))?/);
        if (!match) return 0;
        const suffix = match[2]?.toLowerCase();
        const numberText = suffix
            ? match[1].replace(',', '.')
            : match[1].replace(/[,.]/g, '');
        const number = parseFloat(numberText);
        const multiplier = suffix === 'm' ? 1000000 : suffix === 'k' ? 1000 : 1;
        return Math.round(number * multiplier) || 0;
    }

    function parseRating(value) {
        const text = normalizeProductText(value);
        const match = text.match(/(\d+(?:[.,]\d+)?)/);
        return match ? parseFloat(match[1].replace(',', '.')) || 0 : 0;
    }

    function getRatingInfo(item) {
        const ratingEl = item.querySelector('i.a-icon-star-small span.a-icon-alt, i.a-icon-star span.a-icon-alt, .a-icon-alt');
        const ratingText = ratingEl?.innerText || ratingEl?.textContent || '';
        const ratingNum = parseRating(ratingText);
        return {
            ratingText: ratingNum ? ratingNum.toFixed(1).replace(/\.0$/, '') : 'No rating',
            ratingNum
        };
    }

    function getReviewsInfo(item) {
        const selectors = [
            'a[href*="#customerReviews"] span.a-size-base',
            'a[href*="customerReviews"] span.a-size-base',
            'a[aria-label*="ratings"]',
            'a[aria-label*="rating"]',
            'span[aria-label*="ratings"]',
            'span[aria-label*="rating"]'
        ];

        for (const selector of selectors) {
            const el = item.querySelector(selector);
            const raw = el?.getAttribute('aria-label') || el?.innerText || el?.textContent || '';
            if (/(?:stars?|out of|つ星|星)/i.test(raw)) continue;
            const reviewsNum = parseCompactNumber(raw);
            if (reviewsNum) {
                return {
                    reviewsText: reviewsNum.toLocaleString('en-US'),
                    reviewsNum
                };
            }
        }

        return { reviewsText: '0', reviewsNum: 0 };
    }

    function pruneProducts() {
        state.allProducts = state.allProducts.filter(info => info.item.isConnected && info.bar.isConnected);
    }

    function getSelectedAsinsInPageOrder() {
        pruneProducts();
        const ordered = [];
        const seen = new Set();
        for (const info of state.allProducts) {
            if (state.selected.has(info.asin) && !seen.has(info.asin)) {
                ordered.push(info.asin);
                seen.add(info.asin);
            }
        }
        for (const asin of state.selected) {
            if (!seen.has(asin)) ordered.push(asin);
        }
        return ordered;
    }

    function scan() {
        const items = document.querySelectorAll('div.s-result-item[data-component-type="s-search-result"][data-asin]');
        items.forEach((item) => {
            const asin = item.getAttribute('data-asin')?.trim();
            if (!asin || state.processedItems.has(item) || item.querySelector('.amz-asin-action-bar')) return;
            if (isSponsored(item)) {
                state.processedItems.add(item);
                return;
            }

            const target = item.querySelector('.s-product-image-container, .puis-image-container, .s-image-square-aspect, .a-section, .s-image');
            if (!target) return;
            state.processedItems.add(item);

            const { priceText, priceNum } = getPriceInfo(item);
            const { ratingText, ratingNum } = getRatingInfo(item);
            const { reviewsText, reviewsNum } = getReviewsInfo(item);
            const title = getProductTitle(item);

            const bar = document.createElement('div');
            bar.className = 'amz-asin-action-bar';
            bar.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span class="bar-asin">${asin}</span>
                    <div class="amz-asin-check-wrapper"><span class="amz-asin-check-icon">✓</span></div>
                </div>
                <div class="bar-title"></div>
                <div class="bar-meta"><span class="bar-rating"></span><span class="bar-reviews"></span></div>
                <div class="bar-price"></div>
            `;
            bar.querySelector('.bar-title').textContent = title || '(未抓到商品標題)';
            bar.querySelector('.bar-rating').textContent = `★ ${ratingText}`;
            bar.querySelector('.bar-reviews').textContent = `評論 ${reviewsText}`;
            bar.querySelector('.bar-price').textContent = priceText;

            bar.onclick = (e) => { e.stopPropagation(); toggleSelect(asin, bar, !state.selected.has(asin)); };
            target.parentNode.insertBefore(bar, target);

            state.allProducts.push({ asin, bar, price: priceNum, rating: ratingNum, reviews: reviewsNum, item: item, title });
            syncAsinBars(asin);

            if (state.autoPickCounted < 10) { toggleSelect(asin, bar, true); state.autoPickCounted++; }
        });
    }

    function setupDrag(panelEl) {
        const header = panelEl.querySelector('.panel-header');
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.btn-toggle')) return;
            dragging = true;
            const rect = panelEl.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            panelEl.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const width = panelEl.offsetWidth;
            const height = panelEl.offsetHeight;
            const left = Math.min(Math.max(8, e.clientX - offsetX), window.innerWidth - width - 8);
            const top = Math.min(Math.max(8, e.clientY - offsetY), window.innerHeight - height - 8);
            panelEl.style.left = `${left}px`;
            panelEl.style.top = `${top}px`;
            panelEl.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            panelEl.style.transition = '';
            const rect = panelEl.getBoundingClientRect();
            saveSettings({ panelLeft: Math.round(rect.left), panelTop: Math.round(rect.top) });
        });
    }

    /** ===== 鍵盤監聽 ===== */
    document.addEventListener('keydown', (e) => {
        if (!(e.metaKey || e.ctrlKey)) return;
        const key = e.key?.toLowerCase();

        if (key === 'g') { e.preventDefault(); runFilter(); }
        if (key === 'd') { e.preventDefault(); GM_setClipboard(getSelectedAsinsInPageOrder().join(CONFIG.COPY_DELIM)); flash(`✅ 已複製 ${state.selected.size} 個 ASIN`); }
        if (key === 'e') { e.preventDefault(); clearSelected(); flash('🧹 已清空'); }

        // Cmd + B: 切換面板可見性
        if (key === 'b') {
            e.preventDefault();
            setPanelVisible(!state.isVisible);
            flash(state.isVisible ? '顯示面板' : '面板已隱藏 (按 ⌘B 或 AMZ 恢復)');
        }
    });

    window.addEventListener('resize', () => {
        if (state.isVisible) ensurePanelPosition();
    });

    let timer;
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => { pruneProducts(); scan(); }, 300); }).observe(document.body, { childList: true, subtree: true });
    const hasUrlFilters = applyUrlFilters();
    scan();
    if (hasUrlFilters) {
        setTimeout(() => {
            runFilter();
            flash('已套用 Detail Page 篩選條件');
        }, 700);
    }
})();
