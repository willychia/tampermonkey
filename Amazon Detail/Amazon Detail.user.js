// ==UserScript==
// @name         Amazon Detail - Product Targeting Panel
// @namespace    https://willy-toolbox.example
// @version      2026.04.28.13
// @description  在 Amazon 商品頁整理 Product Targeting 候選 ASIN、圖片、勾選清單與 OpenAI Core Keywords。
// @author       Willy Chia
// @match        https://www.amazon.com/dp/*
// @match        https://www.amazon.com/*/dp/*
// @match        https://www.amazon.com/gp/product/*
// @updateURL    https://raw.githubusercontent.com/willychia/tampermonkey/main/Amazon%20Detail/Amazon%20Detail.user.js
// @downloadURL  https://raw.githubusercontent.com/willychia/tampermonkey/main/Amazon%20Detail/Amazon%20Detail.user.js
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.openai.com
// ==/UserScript==

(function () {
    "use strict";

    const CONFIG = {
        MAX_PER_SECTION: 10,
        MAX_KEYWORDS: 5,
        DEFAULT_MODEL: "gpt-5.4-nano",
        PANEL_ID: "amz-detail-pt-panel",
        RESCUE_ID: "amz-detail-pt-rescue",
        STORAGE_KEY: "amz-detail-product-targeting-v1",
        THEME_COLOR: "#e47911",
        BAR_BG: "#232f3e"
    };

    const CATEGORY = {
        DIRECT: "direct",
        COMPLEMENTARY: "complementary",
        REVIEW: "review"
    };

    const CATEGORY_LABEL = {
        [CATEGORY.DIRECT]: "直接競品",
        [CATEGORY.COMPLEMENTARY]: "互補品",
        [CATEGORY.REVIEW]: "待確認"
    };

    const DIRECT_PATTERNS = [
        /compare/i,
        /similar/i,
        /also viewed/i,
        /related to this item/i,
        /customers who viewed/i,
        /brands related/i
    ];

    const COMPLEMENTARY_PATTERNS = [
        /frequently bought/i,
        /buy it with/i,
        /also bought/i,
        /customers bought/i,
        /accessor/i,
        /replacement/i,
        /bundle/i
    ];

    const DIRECT_SELECTORS = [
        "#HLCXComparisonWidget_feature_div",
        "#similarities_feature_div",
        "#compareWithSimilarItems_feature_div",
        "#comparison_table",
        "#sims-consolidated-1_feature_div",
        "#sp_detail_thematic-domains_desktop-top_feature_div",
        "#customers_also_viewed_feature_div",
        "#desktop-dp-sims_session-similarities-sims-feature"
    ];

    const COMPLEMENTARY_SELECTORS = [
        "#freqBoughtTogether_feature_div",
        "#buybox_winning_feature_div",
        "#bundleV2_feature_div",
        "#similarities_feature_div",
        "#customers_also_bought_feature_div",
        "#dp-ads-center-promo_feature_div"
    ];

    const MODULE_SELECTORS = [
        "[id$='_feature_div']",
        "[data-feature-name]",
        "[cel_widget_id]",
        ".a-carousel-container",
        ".a-section"
    ];

    const COLOR_WORDS = new Set([
        "black", "white", "gray", "grey", "silver", "gold", "blue", "red", "green", "pink",
        "purple", "yellow", "orange", "brown", "clear", "transparent", "beige", "navy"
    ]);

    const MARKETING_WORDS = new Set([
        "new", "upgraded", "upgrade", "premium", "best", "heavy", "duty", "durable", "portable",
        "professional", "pro", "classic", "modern", "universal", "multi", "use", "easy", "large",
        "small", "medium", "lightweight", "compatible", "perfect", "great", "with", "without",
        "for", "and", "or", "the", "a", "an", "of", "to", "in", "on", "by", "from"
    ]);

    const PRODUCT_WORD_STOPLIST = new Set([
        ...MARKETING_WORDS,
        "pack", "pcs", "piece", "pieces", "set", "sets", "size", "inch", "inches", "ft", "feet",
        "oz", "ounce", "ounces", "lb", "lbs", "cm", "mm", "ml", "liter", "liters", "count",
        "amazon", "seller", "sellers", "rank", "ranks", "ranking", "customer", "customers", "item", "items"
    ]);

    const state = {
        product: null,
        candidates: {
            [CATEGORY.DIRECT]: [],
            [CATEGORY.COMPLEMENTARY]: [],
            [CATEGORY.REVIEW]: []
        },
        keywords: [],
        keywordMode: "rule",
        selected: {
            [CATEGORY.DIRECT]: new Set(),
            [CATEGORY.COMPLEMENTARY]: new Set(),
            [CATEGORY.REVIEW]: new Set()
        },
        isVisible: true,
        flashTimer: null
    };

    GM_addStyle(`
        #${CONFIG.PANEL_ID} {
            position: fixed; top: 80px; right: 20px; z-index: 2147483647;
            width: 360px; max-height: calc(100vh - 110px); overflow: hidden;
            background: rgba(255,255,255,0.97); border: 2px solid #ddd; border-radius: 12px;
            font: 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2); color: #111; display: flex; flex-direction: column;
        }
        #${CONFIG.PANEL_ID} .panel-header {
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            padding: 11px 14px; border-bottom: 1px solid #e6e6e6; cursor: move; background: #fff;
        }
        #${CONFIG.PANEL_ID} .panel-title { font-weight: 800; color: ${CONFIG.THEME_COLOR}; }
        #${CONFIG.PANEL_ID} .panel-body { overflow: auto; padding: 12px 14px 14px; }
        #${CONFIG.PANEL_ID} .settings-row {
            display: grid; grid-template-columns: 1fr 92px; gap: 6px; margin: 8px 0 10px;
        }
        #${CONFIG.PANEL_ID} .settings-row input {
            min-width: 0; border: 1px solid #ddd; border-radius: 5px; padding: 5px 6px; font-size: 12px;
        }
        #${CONFIG.PANEL_ID} .settings-actions { display: flex; gap: 6px; margin-bottom: 10px; }
        #${CONFIG.PANEL_ID} .mini-btn {
            border: 1px solid #ddd; background: #fff; border-radius: 5px; padding: 5px 7px;
            cursor: pointer; font-weight: 700; font-size: 11px; color: #333;
        }
        #${CONFIG.PANEL_ID} .mini-btn:hover { border-color: ${CONFIG.THEME_COLOR}; color: ${CONFIG.THEME_COLOR}; }
        #${CONFIG.PANEL_ID} .btn-toggle {
            border: 0; background: transparent; color: #666; cursor: pointer; font-size: 16px; font-weight: 800;
            padding: 0 4px;
        }
        #${CONFIG.PANEL_ID} .pt-summary { margin-bottom: 10px; line-height: 1.45; color: #333; }
        #${CONFIG.PANEL_ID} .pt-asin { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; }
        #${CONFIG.PANEL_ID} h3 {
            margin: 14px 0 7px; font-size: 13px; color: #111; display: flex; align-items: center; justify-content: space-between;
        }
        #${CONFIG.PANEL_ID} .section-count { color: #666; font-size: 11px; font-weight: 600; }
        #${CONFIG.PANEL_ID} .keyword-row,
        #${CONFIG.PANEL_ID} .asin-row {
            border: 1px solid #e5e5e5; border-radius: 8px; padding: 7px 8px; margin-bottom: 6px; background: #fff;
        }
        #${CONFIG.PANEL_ID} .keyword-top,
        #${CONFIG.PANEL_ID} .asin-top { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
        #${CONFIG.PANEL_ID} .keyword-input {
            flex: 1; min-width: 0; border: 1px solid #ddd; border-radius: 5px; padding: 4px 6px; font-size: 12px;
        }
        #${CONFIG.PANEL_ID} .score { color: #666; font-size: 11px; line-height: 1.35; margin-top: 4px; }
        #${CONFIG.PANEL_ID} .asin-link,
        #${CONFIG.PANEL_ID} .search-link { color: #0066c0; text-decoration: none; font-weight: 700; }
        #${CONFIG.PANEL_ID} .asin-main { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
        #${CONFIG.PANEL_ID} .asin-img {
            width: 100%; height: 220px; border-radius: 6px; object-fit: contain; background: #f7f7f7; border: 1px solid #eee;
            cursor: pointer;
        }
        #${CONFIG.PANEL_ID} .asin-check { width: 16px; height: 16px; flex: 0 0 auto; accent-color: ${CONFIG.THEME_COLOR}; }
        #${CONFIG.PANEL_ID} .asin-only {
            display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 15px;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800;
        }
        #${CONFIG.PANEL_ID} .empty { color: #777; font-size: 12px; padding: 8px; border: 1px dashed #ccc; border-radius: 8px; }
        #${CONFIG.PANEL_ID} .hint {
            margin-top: 12px; padding-top: 9px; border-top: 1px solid #eee; color: #666; line-height: 1.45; font-size: 11px;
        }
        #${CONFIG.RESCUE_ID} {
            position: fixed; top: 78px; right: 20px; z-index: 2147483647;
            display: none; align-items: center; justify-content: center;
            height: 34px; padding: 0 12px; border: 0; border-radius: 8px;
            background: ${CONFIG.THEME_COLOR}; color: #fff; font: 800 12px system-ui, sans-serif;
            box-shadow: 0 4px 16px rgba(0,0,0,0.25); cursor: pointer;
        }
        .amz-detail-pt-flash {
            position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.9); color: #fff; padding: 12px 24px; border-radius: 30px;
            z-index: 2147483647; display: none; font-weight: 700; font: 13px system-ui, sans-serif;
        }
    `);

    function loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || "{}");
        } catch (_) {
            return {};
        }
    }

    function saveSettings(patch = {}) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ ...loadSettings(), ...patch }));
        } catch (_) {
            // 記憶面板位置失敗不影響主要功能。
        }
    }

    function getApiKey() {
        try {
            return GM_getValue("openai_api_key", "");
        } catch (_) {
            return "";
        }
    }

    function setApiKey(value) {
        try {
            GM_setValue("openai_api_key", value || "");
        } catch (_) {
            // API key 儲存失敗時，保留本次頁面操作即可。
        }
    }

    function getOpenAiModel() {
        try {
            return GM_getValue("openai_model", CONFIG.DEFAULT_MODEL) || CONFIG.DEFAULT_MODEL;
        } catch (_) {
            return CONFIG.DEFAULT_MODEL;
        }
    }

    function setOpenAiModel(value) {
        try {
            GM_setValue("openai_model", normalizeText(value) || CONFIG.DEFAULT_MODEL);
        } catch (_) {
            // Model 儲存失敗不影響掃描。
        }
    }

    const settings = loadSettings();
    state.isVisible = settings.isVisible !== false;

    const panel = document.createElement("div");
    panel.id = CONFIG.PANEL_ID;
    panel.innerHTML = `
        <div class="panel-header">
            <span class="panel-title">PT Candidates</span>
            <button class="btn-toggle" id="amz-detail-pt-hide" type="button" title="隱藏面板">×</button>
        </div>
        <div class="panel-body"></div>
    `;
    document.body.appendChild(panel);

    const rescueBtn = document.createElement("button");
    rescueBtn.id = CONFIG.RESCUE_ID;
    rescueBtn.type = "button";
    rescueBtn.textContent = "PT";
    rescueBtn.title = "顯示 Product Targeting 面板";
    document.body.appendChild(rescueBtn);

    const flashEl = document.createElement("div");
    flashEl.className = "amz-detail-pt-flash";
    document.body.appendChild(flashEl);

    if (settings.panelLeft !== undefined && settings.panelTop !== undefined) {
        panel.style.left = `${settings.panelLeft}px`;
        panel.style.top = `${settings.panelTop}px`;
        panel.style.right = "auto";
    }

    function normalizeText(value) {
        return (value || "").replace(/\s+/g, " ").trim();
    }

    function cleanForMatch(value) {
        return normalizeText(value).toLowerCase();
    }

    function isEditingEvent(ev) {
        const el = ev.target;
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        return el.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
    }

    function flash(message) {
        flashEl.textContent = message;
        flashEl.style.display = "block";
        clearTimeout(state.flashTimer);
        state.flashTimer = setTimeout(() => {
            flashEl.style.display = "none";
        }, 2200);
    }

    function setPanelVisible(isVisible, shouldSave = true) {
        state.isVisible = isVisible;
        panel.style.display = isVisible ? "flex" : "none";
        rescueBtn.style.display = isVisible ? "none" : "flex";
        if (isVisible) requestAnimationFrame(ensurePanelPosition);
        if (shouldSave) saveSettings({ isVisible });
    }

    function ensurePanelPosition() {
        const rect = panel.getBoundingClientRect();
        const width = panel.offsetWidth || rect.width || 360;
        const height = panel.offsetHeight || rect.height || 100;
        const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
        const top = Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - height - 8));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = "auto";
        saveSettings({ panelLeft: Math.round(left), panelTop: Math.round(top) });
    }

    function setupDrag(panelEl) {
        const header = panelEl.querySelector(".panel-header");
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener("mousedown", (e) => {
            if (e.target.closest(".btn-toggle")) return;
            dragging = true;
            const rect = panelEl.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            panelEl.style.transition = "none";
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            const width = panelEl.offsetWidth;
            const height = panelEl.offsetHeight;
            const left = Math.min(Math.max(8, e.clientX - offsetX), window.innerWidth - width - 8);
            const top = Math.min(Math.max(8, e.clientY - offsetY), window.innerHeight - height - 8);
            panelEl.style.left = `${left}px`;
            panelEl.style.top = `${top}px`;
            panelEl.style.right = "auto";
        });

        document.addEventListener("mouseup", () => {
            if (!dragging) return;
            dragging = false;
            panelEl.style.transition = "";
            ensurePanelPosition();
        });
    }

    function getCurrentAsin() {
        const urlMatch = location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
        if (urlMatch) return urlMatch[1].toUpperCase();

        const selectors = [
            "#ASIN",
            "input[name='ASIN']",
            "input[name='asin']",
            "[data-asin]"
        ];
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            const value = el?.value || el?.getAttribute("data-asin");
            if (/^[A-Z0-9]{10}$/i.test(value || "")) return value.toUpperCase();
        }

        const textMatch = document.body.innerText.match(/\bB0[A-Z0-9]{8}\b/i);
        return textMatch ? textMatch[0].toUpperCase() : "";
    }

    function getTitleFromNode(node) {
        const selectors = [
            "h2 a span",
            "h2 span",
            "h3 a span",
            "h3 span",
            ".a-truncate-full",
            ".a-size-base-plus",
            ".a-size-medium",
            ".a-link-normal[title]",
            "img[alt]"
        ];
        const candidates = [];
        selectors.forEach((selector) => {
            const el = node.querySelector(selector);
            if (!el) return;
            ["title", "aria-label", "alt"].forEach((attr) => {
                const value = normalizeText(el.getAttribute(attr));
                if (value && !/^(previous|next)$/i.test(value)) candidates.push(value);
            });
            const text = normalizeText(el.textContent);
            if (text && text.length > 8) candidates.push(text);
        });
        candidates.sort((a, b) => b.length - a.length);
        return candidates[0] || "";
    }

    function getPriceFromNode(node) {
        const text = normalizeText(node.querySelector(".a-price .a-offscreen")?.textContent)
            || normalizeText(node.querySelector(".a-price")?.textContent).replace(/\s+/g, "");
        return text || "";
    }

    function parseNumber(value) {
        const match = normalizeText(value).match(/(\d[\d,.]*)/);
        return match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
    }

    function getProductPrice() {
        return parseNumber(document.querySelector("#corePrice_feature_div .a-price .a-offscreen")?.textContent
            || document.querySelector("#priceblock_ourprice")?.textContent
            || document.querySelector("#priceblock_dealprice")?.textContent
            || document.querySelector("#price_inside_buybox")?.textContent
            || "");
    }

    function getProductRating() {
        const text = normalizeText(document.querySelector("#acrPopover")?.getAttribute("title")
            || document.querySelector("#acrPopover .a-icon-alt")?.textContent
            || document.querySelector("[data-hook='rating-out-of-text']")?.textContent
            || "");
        const match = text.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) || 0 : 0;
    }

    function getProductReviews() {
        return parseNumber(document.querySelector("#acrCustomerReviewText")?.textContent || "");
    }

    function getRatingFromNode(node) {
        const text = normalizeText(node.querySelector(".a-icon-alt")?.textContent);
        const match = text.match(/(\d+(?:\.\d+)?)/);
        return match ? `${match[1]}★` : "";
    }

    function normalizeAmazonImageUrl(url) {
        if (!url || /transparent-pixel|grey-pixel|sprite/i.test(url)) return "";
        const cleanUrl = url.split("?")[0];
        return cleanUrl.replace(/\._[^.]+_\.(jpg|jpeg|png|webp)$/i, ".$1");
    }

    function parseDynamicImageCandidates(value) {
        if (!value) return [];
        try {
            return Object.entries(JSON.parse(value)).map(([url, size]) => ({
                url,
                score: (parseInt(size?.[0], 10) || 0) * (parseInt(size?.[1], 10) || 0)
            }));
        } catch (_) {
            return [];
        }
    }

    function parseSrcsetCandidates(value) {
        if (!value) return [];
        return value.split(",")
            .map((part) => {
                const pieces = normalizeText(part).split(/\s+/);
                const url = pieces[0] || "";
                const descriptor = pieces[1] || "";
                const width = parseInt(descriptor.replace(/\D/g, ""), 10) || 0;
                return { url, score: width };
            })
            .filter((item) => item.url);
    }

    function getBestImageUrl(img) {
        if (!img) return "";
        const candidates = [
            ...parseDynamicImageCandidates(img.getAttribute("data-a-dynamic-image")),
            ...parseSrcsetCandidates(img.getAttribute("srcset")),
            { url: img.getAttribute("data-old-hires") || "", score: 1000000 },
            { url: img.currentSrc || "", score: 1000 },
            { url: img.src || "", score: 900 },
            { url: img.getAttribute("data-src") || "", score: 800 }
        ]
            .map((item) => ({ ...item, url: normalizeAmazonImageUrl(item.url) }))
            .filter((item) => item.url);

        candidates.sort((a, b) => b.score - a.score || b.url.length - a.url.length);
        return candidates[0]?.url || "";
    }

    function getImageFromNode(node) {
        const img = node.querySelector("img");
        return getBestImageUrl(img);
    }

    function getBrand() {
        const byline = normalizeText(document.querySelector("#bylineInfo")?.textContent)
            .replace(/^Visit the /i, "")
            .replace(/ Store$/i, "")
            .replace(/^Brand:\s*/i, "");
        if (byline) return byline;

        const rows = [...document.querySelectorAll("#productOverview_feature_div tr, #prodDetails tr, #detailBullets_feature_div li")];
        for (const row of rows) {
            const text = normalizeText(row.textContent);
            if (/^Brand\b/i.test(text) || /\bBrand\b/i.test(text)) {
                return normalizeText(text.replace(/.*Brand\s*:?\s*/i, ""));
            }
        }
        return "";
    }

    function getBreadcrumbs() {
        return [...document.querySelectorAll("#wayfinding-breadcrumbs_feature_div a, #wayfinding-breadcrumbs_container a")]
            .map((el) => normalizeText(el.textContent))
            .filter(Boolean);
    }

    function getBullets() {
        return [...document.querySelectorAll("#feature-bullets li span.a-list-item")]
            .map((el) => normalizeText(el.textContent))
            .filter((text) => text && !/make sure this fits/i.test(text));
    }

    function getBsrTexts() {
        const containers = [
            document.querySelector("#detailBullets_feature_div"),
            document.querySelector("#productDetails_detailBullets_sections1"),
            document.querySelector("#prodDetails")
        ].filter(Boolean);
        return containers
            .map((el) => normalizeText(el.textContent))
            .join(" ")
            .split(/(?=#\d|Best Sellers Rank| in )/i)
            .map(normalizeText)
            .filter((text) => /Best Sellers Rank|#\d| in /i.test(text))
            .slice(0, 6);
    }

    function getVariationText() {
        return [...document.querySelectorAll("#twister_feature_div .a-row, #variation_color_name, #variation_size_name, #variation_style_name")]
            .map((el) => normalizeText(el.textContent))
            .filter(Boolean)
            .join(" ");
    }

    function getProductInfo() {
        return {
            asin: getCurrentAsin(),
            title: normalizeText(document.querySelector("#productTitle")?.textContent),
            brand: getBrand(),
            image: getBestImageUrl(document.querySelector("#landingImage") || document.querySelector("#imgTagWrapperId img")),
            price: getProductPrice(),
            rating: getProductRating(),
            reviews: getProductReviews(),
            breadcrumbs: getBreadcrumbs(),
            bullets: getBullets(),
            bsrTexts: getBsrTexts(),
            variationText: getVariationText(),
            url: location.href.split("#")[0]
        };
    }

    function getModuleName(module) {
        const id = module.id ? module.id.replace(/_/g, " ") : "";
        const attr = module.getAttribute("data-feature-name") || module.getAttribute("cel_widget_id") || "";
        const heading = normalizeText(module.querySelector("h2, h3, .a-carousel-heading, .a-section h2")?.textContent);
        return normalizeText([heading, id, attr].filter(Boolean).join(" | ")) || "Amazon recommendation module";
    }

    function classifyModule(module, forcedCategory = "") {
        if (forcedCategory) return forcedCategory;
        const name = cleanForMatch(getModuleName(module));
        if (DIRECT_PATTERNS.some((pattern) => pattern.test(name))) return CATEGORY.DIRECT;
        if (COMPLEMENTARY_PATTERNS.some((pattern) => pattern.test(name))) return CATEGORY.COMPLEMENTARY;
        return CATEGORY.REVIEW;
    }

    function findCandidateModules() {
        const entries = [];
        DIRECT_SELECTORS.forEach((selector) => {
            document.querySelectorAll(selector).forEach((module) => entries.push({ module, category: CATEGORY.DIRECT }));
        });
        COMPLEMENTARY_SELECTORS.forEach((selector) => {
            document.querySelectorAll(selector).forEach((module) => entries.push({ module, category: CATEGORY.COMPLEMENTARY }));
        });
        MODULE_SELECTORS.forEach((selector) => {
            document.querySelectorAll(selector).forEach((module) => {
                if (module.querySelector("a[href*='/dp/'], a[href*='/gp/product/'], [data-asin]")) {
                    entries.push({ module, category: "" });
                }
            });
        });

        const seen = new Set();
        return entries.filter(({ module, category }) => {
            if (!module || seen.has(module)) return false;
            seen.add(module);
            return Boolean(category) || module !== document.body;
        });
    }

    function extractAsinsFromModule(module, category, productAsin) {
        const moduleName = getModuleName(module);
        const resolvedCategory = classifyModule(module, category);
        const items = [];
        const nodes = [...module.querySelectorAll("[data-asin], a[href*='/dp/'], a[href*='/gp/product/']")];

        nodes.forEach((node) => {
            const raw = node.getAttribute("data-asin")
                || node.href?.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1]
                || "";
            const asin = raw.toUpperCase();
            if (!/^[A-Z0-9]{10}$/.test(asin) || asin === productAsin) return;

            const itemRoot = node.closest("[data-asin], li, .a-carousel-card, td, .a-section") || node;
            items.push({
                asin,
                category: resolvedCategory,
                source: moduleName,
                title: getTitleFromNode(itemRoot),
                image: getImageFromNode(itemRoot),
                price: getPriceFromNode(itemRoot),
                rating: getRatingFromNode(itemRoot)
            });
        });

        return items;
    }

    function scoreCandidate(candidate) {
        const source = cleanForMatch(candidate.sources.join(" "));
        let score = 0;
        if (candidate.category === CATEGORY.DIRECT) {
            if (/compare|similar/i.test(source)) score += 70;
            if (/also viewed|related/i.test(source)) score += 55;
            score += 25;
        } else if (candidate.category === CATEGORY.COMPLEMENTARY) {
            if (/frequently bought|buy it with/i.test(source)) score += 70;
            if (/also bought|customers bought/i.test(source)) score += 55;
            score += 20;
        } else {
            score += 10;
        }
        score += Math.min(candidate.sources.length - 1, 4) * 12;
        if (candidate.title) score += 8;
        if (candidate.image) score += 4;
        if (candidate.price) score += 5;
        if (candidate.rating) score += 4;
        return score;
    }

    function collectCandidates(productAsin) {
        const byAsin = new Map();

        findCandidateModules().forEach(({ module, category }) => {
            extractAsinsFromModule(module, category, productAsin).forEach((item) => {
                const current = byAsin.get(item.asin) || {
                    asin: item.asin,
                    category: item.category,
                    sources: [],
                    title: "",
                    image: "",
                    price: "",
                    rating: ""
                };

                if (!current.sources.includes(item.source)) current.sources.push(item.source);
                if (!current.title && item.title) current.title = item.title;
                if (!current.image && item.image) current.image = item.image;
                if (!current.price && item.price) current.price = item.price;
                if (!current.rating && item.rating) current.rating = item.rating;
                if (current.category === CATEGORY.REVIEW && item.category !== CATEGORY.REVIEW) current.category = item.category;
                byAsin.set(item.asin, current);
            });
        });

        const grouped = {
            [CATEGORY.DIRECT]: [],
            [CATEGORY.COMPLEMENTARY]: [],
            [CATEGORY.REVIEW]: []
        };

        byAsin.forEach((candidate) => {
            candidate.score = scoreCandidate(candidate);
            grouped[candidate.category].push(candidate);
        });

        Object.keys(grouped).forEach((key) => {
            grouped[key].sort((a, b) => b.score - a.score || a.asin.localeCompare(b.asin));
            grouped[key] = grouped[key].slice(0, CONFIG.MAX_PER_SECTION);
        });

        return grouped;
    }

    function tokenize(value) {
        return cleanForMatch(value)
            .replace(/&/g, " and ")
            .replace(/[^a-z0-9\s-]/g, " ")
            .split(/\s+/)
            .map((token) => token.replace(/^-+|-+$/g, ""))
            .filter(Boolean);
    }

    function isNoiseToken(token, brandTokens) {
        if (!token || token.length < 2) return true;
        if (brandTokens.has(token)) return true;
        if (COLOR_WORDS.has(token)) return true;
        if (PRODUCT_WORD_STOPLIST.has(token)) return true;
        if (/^\d+$/.test(token)) return true;
        if (/^\d+(?:x|oz|in|inch|cm|mm|ml|lb|lbs|pack|pcs?)$/i.test(token)) return true;
        return false;
    }

    function addPhrase(map, phrase, source, weight, brandTokens) {
        const tokens = tokenize(phrase).filter((token) => !isNoiseToken(token, brandTokens));
        if (tokens.length < 2 || tokens.length > 4) return;

        const normalized = tokens.join(" ");
        if (!normalized || normalized.length < 5) return;

        const entry = map.get(normalized) || {
            keyword: normalized,
            score: 0,
            sources: new Set(),
            penalties: 0
        };

        entry.score += weight;
        entry.sources.add(source);
        if (tokens.length === 2 || tokens.length === 3) entry.score += 3;
        if (tokens.length === 4) entry.score -= 1;
        if (tokens.some((token) => MARKETING_WORDS.has(token))) entry.penalties += 3;
        map.set(normalized, entry);
    }

    function addNgrams(map, text, source, weight, brandTokens) {
        const tokens = tokenize(text);
        for (let size = 2; size <= 4; size++) {
            for (let i = 0; i <= tokens.length - size; i++) {
                addPhrase(map, tokens.slice(i, i + size).join(" "), source, weight, brandTokens);
            }
        }
    }

    function generateKeywords(product) {
        const map = new Map();
        const brandTokens = new Set(tokenize(product.brand));

        addNgrams(map, product.title, "title", 10, brandTokens);
        product.breadcrumbs.forEach((text) => addNgrams(map, text, "category", 8, brandTokens));
        product.bsrTexts.forEach((text) => addNgrams(map, text, "category", 8, brandTokens));
        product.bullets.slice(0, 5).forEach((text) => addNgrams(map, text, "bullet", 4, brandTokens));
        addNgrams(map, product.variationText, "variation", 2, brandTokens);

        const titleTokens = tokenize(product.title).filter((token) => !isNoiseToken(token, brandTokens));
        for (let size = Math.min(4, titleTokens.length); size >= 2; size--) {
            addPhrase(map, titleTokens.slice(0, size).join(" "), "title", 7, brandTokens);
        }

        return [...map.values()]
            .map((entry) => {
                const sources = [...entry.sources];
                const repeatBoost = Math.max(0, sources.length - 1) * 5;
                return {
                    keyword: entry.keyword,
                    score: Math.round(entry.score + repeatBoost - entry.penalties),
                    sources
                };
            })
            .filter((entry) => entry.score > 8)
            .sort((a, b) => b.score - a.score || a.keyword.length - b.keyword.length)
            .slice(0, CONFIG.MAX_KEYWORDS);
    }

    function generateStrategyKeywords(product) {
        const baseKeywords = generateKeywords(product);
        const primary = baseKeywords[0]?.keyword || product.title || product.asin || "";
        const category = product.breadcrumbs?.slice(-1)[0] || baseKeywords[1]?.keyword || primary;
        const subject = product.brand && !/amazon/i.test(product.brand)
            ? `${product.brand} ${primary}`.trim()
            : category;

        return [
            enforceSubstituteFilters({
                type: "Substitute",
                keyword: primary,
                score: 90,
                sources: ["Rule fallback: weaker direct alternatives with traffic"]
            }, product),
            {
                type: "Complementary",
                keyword: `${category} accessories`.replace(/\s+/g, " ").trim(),
                score: 82,
                sources: ["Rule fallback: healthy related products"]
            },
            {
                type: "Subject/IP",
                keyword: subject,
                score: 78,
                sources: ["Rule fallback: subject, brand, or theme products"]
            }
        ].map((item) => enforceStrategyFilters(item, product)).filter((item) => item.keyword).slice(0, 3);
    }

    function gmRequestJson(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "POST",
                url: options.url,
                headers: options.headers || {},
                data: options.data ? JSON.stringify(options.data) : undefined,
                timeout: options.timeout || 30000,
                onload: (response) => {
                    let body = null;
                    try {
                        body = JSON.parse(response.responseText || "{}");
                    } catch (err) {
                        reject(new Error(`OpenAI returned non-JSON response: ${err.message}`));
                        return;
                    }
                    if (response.status < 200 || response.status >= 300) {
                        reject(new Error(body?.error?.message || `OpenAI request failed with ${response.status}`));
                        return;
                    }
                    resolve(body);
                },
                onerror: () => reject(new Error("OpenAI request failed")),
                ontimeout: () => reject(new Error("OpenAI request timed out"))
            });
        });
    }

    function extractResponseText(response) {
        if (typeof response.output_text === "string") return response.output_text;
        const chunks = [];
        (response.output || []).forEach((item) => {
            (item.content || []).forEach((content) => {
                if (content.text) chunks.push(content.text);
            });
        });
        return chunks.join("\n");
    }

    function parseKeywordJson(text) {
        const cleaned = normalizeText(text)
            .replace(/^```(?:json)?/i, "")
            .replace(/```$/i, "")
            .trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        const json = JSON.parse(match ? match[0] : cleaned);
        const strategies = Array.isArray(json.strategies) ? json.strategies : Array.isArray(json.keywords) ? json.keywords : [];
        return strategies
            .map((item, index) => ({
                type: normalizeText(item.type || item.intent || `Strategy ${index + 1}`),
                keyword: normalizeText(item.searchTerm || item.keyword || item),
                score: Number.isFinite(Number(item.score)) ? Number(item.score) : Math.max(100 - index * 8, 60),
                minReviews: Number.isFinite(Number(item.minReviews)) ? Number(item.minReviews) : null,
                minRating: Number.isFinite(Number(item.minRating)) ? Number(item.minRating) : null,
                maxRating: Number.isFinite(Number(item.maxRating)) ? Number(item.maxRating) : null,
                minPrice: Number.isFinite(Number(item.minPrice)) ? Number(item.minPrice) : null,
                sources: [normalizeText(item.reason || item.filterDirection || "OpenAI").replace(/\s+/g, " ") || "OpenAI"]
            }))
            .filter((item) => item.keyword)
            .slice(0, 3);
    }

    function isSubstituteStrategy(item) {
        return /^substitute$/i.test(normalizeText(item?.type || item?.intent || ""));
    }

    function isHealthyStrategy(item) {
        return /^(complementary|subject\/?ip)$/i.test(normalizeText(item?.type || item?.intent || ""));
    }

    function enforceSubstituteFilters(item, product) {
        if (!item || !isSubstituteStrategy(item)) return item;
        return {
            ...item,
            minReviews: null,
            minRating: null,
            maxRating: Math.max(product.rating || 0, 3),
            minPrice: product.price || null
        };
    }

    function enforceHealthyProductFilters(item) {
        if (!item || !isHealthyStrategy(item)) return item;
        return {
            ...item,
            minReviews: 50,
            minRating: 4,
            maxRating: null,
            minPrice: null
        };
    }

    function enforceStrategyFilters(item, product) {
        return enforceHealthyProductFilters(enforceSubstituteFilters(item, product));
    }

    function buildOpenAiPrompt(product) {
        return [
            "You generate Amazon Product Targeting search term strategies.",
            "Return strict JSON only with this shape:",
            "{\"strategies\":[{\"type\":\"Substitute\",\"searchTerm\":\"2-5 word search term\",\"score\":95,\"minReviews\":null,\"minRating\":null,\"maxRating\":4.2,\"minPrice\":20,\"reason\":\"short reason\"}]}",
            "Rules:",
            "- Generate exactly 3 strategies: Substitute, Complementary, Subject/IP.",
            "- Substitute: find direct alternatives where shoppers may switch to this product. The script will hard-code Substitute filters after your response: minPrice equals the current product price, maxRating equals max(current rating, 3), minReviews is null, and minRating is null. Focus on the best Substitute search term.",
            "- Complementary: find healthy related products shoppers may buy before or with this product. The script will hard-code Complementary filters after your response: minRating 4, minReviews 50, minPrice null, maxRating null. Focus on the best Complementary search term.",
            "- Subject/IP: if the product has a clear subject, franchise, character, licensed IP, theme, or named object, generate one search term for that subject/IP. If none exists, use a strong category/theme term. The script will hard-code Subject/IP filters after your response: minRating 4, minReviews 50, minPrice null, maxRating null.",
            "- Do not use maxPrice, include, exclude, or limit.",
            "- If a filter is not appropriate, return null.",
            "- Search terms should be concise English phrases.",
            "",
            `ASIN: ${product.asin || ""}`,
            `Title: ${product.title || ""}`,
            `Brand: ${product.brand || ""}`,
            `Current Price: ${product.price || ""}`,
            `Current Rating: ${product.rating || ""}`,
            `Current Reviews: ${product.reviews || ""}`,
            `Main Image URL: ${product.image || ""}`,
            `Breadcrumbs: ${(product.breadcrumbs || []).join(" > ")}`,
            `BSR/Category Text: ${(product.bsrTexts || []).join(" | ")}`,
            `Bullets: ${(product.bullets || []).slice(0, 5).join(" | ")}`,
            `Variation Text: ${product.variationText || ""}`
        ].join("\n");
    }

    function buildOpenAiInput(product) {
        const content = [
            { type: "input_text", text: buildOpenAiPrompt(product) }
        ];

        if (product.image) {
            content.push({
                type: "input_image",
                image_url: product.image,
                detail: "auto"
            });
        }

        return [{ role: "user", content }];
    }

    async function generateOpenAiKeywords(product) {
        const apiKey = getApiKey();
        if (!apiKey) return null;

        const response = await gmRequestJson({
            url: "https://api.openai.com/v1/responses",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            data: {
                model: getOpenAiModel(),
                input: buildOpenAiInput(product),
                max_output_tokens: 700
            }
        });

        const keywords = parseKeywordJson(extractResponseText(response))
            .map((item) => enforceStrategyFilters(item, product));
        return keywords.length ? keywords : null;
    }

    function searchUrl(item) {
        const strategy = typeof item === "string" ? { keyword: item } : item || {};
        const params = new URLSearchParams();
        params.set("k", strategy.keyword || "");
        if (strategy.type) params.set("tm_intent", strategy.type.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
        if (strategy.minReviews !== null && strategy.minReviews !== undefined) params.set("tm_min_reviews", String(strategy.minReviews));
        if (strategy.minRating !== null && strategy.minRating !== undefined) params.set("tm_min_rating", String(strategy.minRating));
        if (strategy.maxRating !== null && strategy.maxRating !== undefined) params.set("tm_max_rating", String(strategy.maxRating));
        if (strategy.minPrice !== null && strategy.minPrice !== undefined) {
            params.set("tm_min_price", String(strategy.minPrice));
            params.set("low-price", String(strategy.minPrice));
        }
        return `https://www.amazon.com/s?${params.toString()}`;
    }

    function asinUrl(asin) {
        return `https://www.amazon.com/dp/${asin}`;
    }

    function setDefaultSelection() {
        Object.values(CATEGORY).forEach((category) => {
            state.selected[category] = category === CATEGORY.REVIEW
                ? new Set()
                : new Set((state.candidates[category] || []).map((item) => item.asin));
        });
    }

    function isCandidateSelected(category, asin) {
        return state.selected[category]?.has(asin);
    }

    function getSelectedCandidates(category) {
        return (state.candidates[category] || []).filter((item) => isCandidateSelected(category, item.asin));
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function filterSummary(item) {
        const parts = [];
        if (item.minReviews !== null && item.minReviews !== undefined) parts.push(`Reviews >= ${item.minReviews}`);
        if (item.minRating !== null && item.minRating !== undefined) parts.push(`Rating >= ${item.minRating}`);
        if (item.maxRating !== null && item.maxRating !== undefined) parts.push(`Rating <= ${item.maxRating}`);
        if (item.minPrice !== null && item.minPrice !== undefined) parts.push(`Price >= $${item.minPrice}`);
        return parts.join(" · ") || "No filters";
    }

    function renderKeywords() {
        if (state.keywords.length === 0) return `<div class="empty">No search term strategies found on current page</div>`;
        return state.keywords.map((item, index) => `
            <div class="keyword-row" data-keyword-index="${index}">
                <div class="score" style="margin-top:0;font-weight:800;">${escapeHtml(item.type || `Strategy ${index + 1}`)}</div>
                <div class="keyword-top">
                    <input class="keyword-input" value="${escapeHtml(item.keyword)}" data-keyword-input="${index}">
                    <a class="search-link" target="_blank" href="${searchUrl(item)}">Search</a>
                </div>
                <div class="score">${escapeHtml(filterSummary(item))}</div>
                <div class="score">score ${item.score} · ${escapeHtml(item.sources.join(" + "))}</div>
            </div>
        `).join("");
    }

    function renderSettings() {
        const model = getOpenAiModel();
        const hasKey = Boolean(getApiKey());
        return `
            <div class="settings-row">
                <input id="amz-detail-openai-key" type="password" placeholder="${hasKey ? "OpenAI key saved" : "OpenAI API key"}">
                <input id="amz-detail-openai-model" type="text" value="${escapeHtml(model)}" title="OpenAI model">
            </div>
            <div class="settings-actions">
                <button class="mini-btn" id="amz-detail-save-openai" type="button">Save OpenAI</button>
                <button class="mini-btn" id="amz-detail-clear-openai" type="button">Clear Key</button>
                <span class="score">Keywords: ${escapeHtml(state.keywordMode)}</span>
            </div>
        `;
    }

    function renderCandidate(candidate, category) {
        const checked = isCandidateSelected(category, candidate.asin) ? "checked" : "";
        return `
            <div class="asin-row">
                <div class="asin-main">
                    <label class="asin-only">
                        <input class="asin-check" type="checkbox" data-candidate-category="${category}" data-candidate-asin="${candidate.asin}" ${checked}>
                        <a class="asin-link" href="${asinUrl(candidate.asin)}" target="_blank">${candidate.asin}</a>
                    </label>
                    ${candidate.image
                        ? `<img class="asin-img" src="${escapeHtml(candidate.image)}" alt="" data-toggle-candidate="${category}:${candidate.asin}">`
                        : `<div class="asin-img" data-toggle-candidate="${category}:${candidate.asin}"></div>`}
                </div>
            </div>
        `;
    }

    function renderCandidateSection(category) {
        const items = state.candidates[category] || [];
        const selectedCount = getSelectedCandidates(category).length;
        return `
            <h3>${CATEGORY_LABEL[category]} <span class="section-count" data-section-count="${category}">${selectedCount}/${items.length} selected</span></h3>
            ${items.length ? items.map((item) => renderCandidate(item, category)).join("") : `<div class="empty">No candidates found on current page</div>`}
        `;
    }

    function renderPanel() {
        const body = panel.querySelector(".panel-body");
        const product = state.product || getProductInfo();
        const productMeta = [
            product.price ? `Price: $${product.price}` : "Price: not found",
            product.rating ? `Rating: ${product.rating}` : "Rating: not found",
            product.reviews ? `Reviews: ${product.reviews}` : "Reviews: not found"
        ].join(" · ");
        body.innerHTML = `
            <div class="pt-summary">
                <div><span class="pt-asin">${escapeHtml(product.asin || "ASIN not found")}</span></div>
                <div>${escapeHtml(product.title || "Title not found")}</div>
                <div class="score">${escapeHtml(productMeta)}</div>
            </div>
            ${renderSettings()}
            <h3>Search Term Strategy <span class="section-count">${state.keywords.length}/3</span></h3>
            ${renderKeywords()}
            ${renderCandidateSection(CATEGORY.DIRECT)}
            ${renderCandidateSection(CATEGORY.COMPLEMENTARY)}
            ${renderCandidateSection(CATEGORY.REVIEW)}
            <h3>High Traffic Research Links</h3>
            <div class="keyword-row">
                ${(state.keywords.length ? state.keywords : [{ keyword: product.title || product.asin || "" }]).slice(0, 3).map((item) => `
                    <div><a class="search-link" target="_blank" href="${searchUrl(item)}">${escapeHtml(item.keyword || "Search current product")}</a></div>
                `).join("")}
            </div>
            <div class="hint">
                Cmd/Ctrl + G 更新 · Cmd/Ctrl + D 複製 · Cmd/Ctrl + B 隱藏/顯示。每區最多 ${CONFIG.MAX_PER_SECTION} 個 ASIN。
            </div>
        `;

        body.querySelectorAll("[data-keyword-input]").forEach((input) => {
            input.addEventListener("input", () => {
                const index = parseInt(input.getAttribute("data-keyword-input"), 10);
                const nextValue = normalizeText(input.value);
                if (!state.keywords[index]) return;
                state.keywords[index].keyword = nextValue;
                const link = input.closest(".keyword-row")?.querySelector(".search-link");
                if (link) link.href = searchUrl(state.keywords[index]);
            });
        });

        body.querySelector("#amz-detail-save-openai")?.addEventListener("click", () => {
            const keyInput = body.querySelector("#amz-detail-openai-key");
            const modelInput = body.querySelector("#amz-detail-openai-model");
            const nextKey = normalizeText(keyInput?.value || "");
            if (nextKey) setApiKey(nextKey);
            setOpenAiModel(modelInput?.value || CONFIG.DEFAULT_MODEL);
            flash(nextKey ? "OpenAI 設定已儲存" : "Model 已儲存，API key 保持不變");
            renderPanel();
        });

        body.querySelector("#amz-detail-clear-openai")?.addEventListener("click", () => {
            setApiKey("");
            flash("OpenAI API key 已清除，會改用規則版 keywords");
            renderPanel();
        });

        body.querySelectorAll("[data-candidate-asin]").forEach((input) => {
            input.addEventListener("change", () => {
                const category = input.getAttribute("data-candidate-category");
                const asin = input.getAttribute("data-candidate-asin");
                if (!state.selected[category]) return;
                if (input.checked) state.selected[category].add(asin);
                else state.selected[category].delete(asin);
                const counter = body.querySelector(`[data-section-count="${category}"]`);
                if (counter) counter.textContent = `${getSelectedCandidates(category).length}/${(state.candidates[category] || []).length} selected`;
            });
        });

        body.querySelectorAll("[data-toggle-candidate]").forEach((image) => {
            image.addEventListener("click", () => {
                const [category, asin] = image.getAttribute("data-toggle-candidate").split(":");
                const checkbox = body.querySelector(`[data-candidate-category="${category}"][data-candidate-asin="${asin}"]`);
                if (!checkbox) return;
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
            });
        });
    }

    async function scanPage() {
        state.product = getProductInfo();
        state.candidates = collectCandidates(state.product.asin);
        setDefaultSelection();
        state.keywords = generateStrategyKeywords(state.product);
        state.keywordMode = "rule fallback";
        renderPanel();
        setPanelVisible(true);

        if (getApiKey()) {
            flash("正在用 OpenAI 產生 Core Keywords...");
            try {
                const aiKeywords = await generateOpenAiKeywords(state.product);
                if (aiKeywords) {
                    state.keywords = aiKeywords;
                    state.keywordMode = "OpenAI";
                    renderPanel();
                }
            } catch (err) {
                console.warn("OpenAI keyword generation failed", err);
                state.keywordMode = "rule fallback";
                renderPanel();
                flash(`OpenAI 失敗，已改用規則版：${err.message}`);
                return;
            }
        }

        renderPanel();
        setPanelVisible(true);

        const direct = state.candidates[CATEGORY.DIRECT].length;
        const comp = state.candidates[CATEGORY.COMPLEMENTARY].length;
        const review = state.candidates[CATEGORY.REVIEW].length;
        flash(`已更新：競品 ${direct}、互補 ${comp}、待確認 ${review}，Keywords: ${state.keywordMode}`);
    }

    function formatCandidateList(items) {
        if (!items || items.length === 0) return "No candidates found on current page";
        return items.map((item) => {
            const image = item.image ? `\n  Image: ${item.image}` : "";
            return `- ${item.asin}${image}`;
        }).join("\n");
    }

    function buildMarkdown() {
        const product = state.product || getProductInfo();
        const keywordLines = state.keywords.length
            ? state.keywords.map((item) => `- ${item.type || "Strategy"}: ${item.keyword} (${filterSummary(item)}; score ${item.score})\n  ${searchUrl(item)}\n  Reason: ${item.sources.join(" + ")}`).join("\n")
            : "No search term strategies found on current page";

        return [
            `# Product Targeting Candidates for ${product.asin || "Unknown ASIN"}`,
            "",
            `Title: ${product.title || "Title not found"}`,
            `URL: ${product.url || location.href}`,
            "",
            "## Search Term Strategy",
            keywordLines,
            "",
            "## Direct Competitors",
            formatCandidateList(getSelectedCandidates(CATEGORY.DIRECT)),
            "",
            "## Complementary Products",
            formatCandidateList(getSelectedCandidates(CATEGORY.COMPLEMENTARY)),
            "",
            "## Need Review",
            formatCandidateList(getSelectedCandidates(CATEGORY.REVIEW)),
            "",
            "## High Traffic Research Links",
            state.keywords.length
                ? state.keywords.slice(0, 3).map((item) => `- ${item.type || "Strategy"} - ${item.keyword}: ${searchUrl(item)}`).join("\n")
                : `- Search current product: ${searchUrl(product.title || product.asin || "")}`
        ].join("\n");
    }

    async function copyMarkdown() {
        if (!state.product) await scanPage();
        GM_setClipboard(buildMarkdown());
        flash("已複製 Product Targeting Markdown");
    }

    panel.querySelector("#amz-detail-pt-hide").addEventListener("click", () => {
        setPanelVisible(false);
        flash("面板已隱藏，按 Cmd/Ctrl + B 恢復");
    });

    rescueBtn.addEventListener("click", () => {
        setPanelVisible(true);
        flash("顯示 Product Targeting 面板");
    });

    document.addEventListener("keydown", (e) => {
        if (!(e.metaKey || e.ctrlKey) || isEditingEvent(e)) return;
        const key = e.key.toLowerCase();
        if (key === "g") {
            e.preventDefault();
            scanPage();
        }
        if (key === "d") {
            e.preventDefault();
            copyMarkdown();
        }
        if (key === "b") {
            e.preventDefault();
            setPanelVisible(!state.isVisible);
            flash(state.isVisible ? "顯示面板" : "面板已隱藏");
        }
    });

    window.addEventListener("resize", () => {
        if (state.isVisible) ensurePanelPosition();
    });

    setupDrag(panel);
    setPanelVisible(state.isVisible, false);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scanPage, { once: true });
    } else {
        scanPage();
    }
})();
