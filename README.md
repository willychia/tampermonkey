# TamperMonkey Utilities

Tampermonkey scripts for Amazon pages and Hourloop Amazon Ads admin pages.

## Scripts

- `Amazon Detail/Amazon Detail.user.js`
  Amazon detail page helpers for Product Targeting candidate ASINs and core keyword research links.
- `Amazon Search/Amazon Search.user.js`
  Amazon search result helpers for ASIN filtering and copying.
- `ads/product_targeting_page/product_targeting_page.user.js`
  Product targeting helpers for bulk selection, ASIN filtering, and bid updates.
- `ads/keyword_targeting_page/keyword_targeting_page.user.js`
  Keyword targeting helpers for bulk selection, long-tail filtering, and bid updates.
- `ads/ad_group_page/ad_group_page.user.js`
  Ad group helpers for bulk selection, quick-open actions, and scroll-safe batch operations.
- `ads/shared/tabulator_page_utils.js`
  Shared helper utilities used by the Tabulator-based page scripts.

## Chinese Docs

- `Amazon Detail/Amazon Detail_zh.md`
  中文說明：Amazon Detail Page Product Targeting 候選面板
- `ads/product_targeting_page/product_targeting_page_zh.md`
  中文說明：Product Targeting 頁面腳本
- `ads/keyword_targeting_page/keyword_targeting_page_zh.md`
  中文說明：Keyword Targeting 頁面腳本
- `ads/ad_group_page/ad_group_page_zh.md`
  中文說明：Ad Group 頁面腳本

## Install Links

- Amazon Detail: `https://raw.githubusercontent.com/willychia/tampermonkey/main/Amazon%20Detail/Amazon%20Detail.user.js`
- Amazon Search: `https://raw.githubusercontent.com/willychia/tampermonkey/main/Amazon%20Search/Amazon%20Search.user.js`
- Product Targeting: `https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/product_targeting_page/product_targeting_page.user.js`
- Keyword Targeting: `https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/keyword_targeting_page/keyword_targeting_page.user.js`
- Ad Group: `https://raw.githubusercontent.com/willychia/tampermonkey/main/ads/ad_group_page/ad_group_page.user.js`

## Maintenance Notes

- Each page script is maintained directly in its `.user.js` file.
- Use the `.user.js` links above for installs and updates so Tampermonkey recognizes them as installable userscripts.
- Product and keyword pages share a common helper via Tampermonkey `@require`.
- The pages rely on Tabulator tables rendered inside the Hourloop admin.
- Page-specific documentation is stored beside each script.
- Versions are date-based so release changes are easy to track.

## Suggested Check Flow

1. Edit the matching `.user.js` page script.
2. Reload the Hourloop page.
3. Test shortcuts on a small result set before using bulk actions broadly.
