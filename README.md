# TamperMonkey Utilities

Tampermonkey scripts for Amazon pages and Hourloop Amazon Ads admin pages.

## Scripts

- `amazon/detail-page-to-product-targeting/detail-page-to-product-targeting.user.js`
  Amazon detail page helpers for Product Targeting candidate ASINs, larger product images, selection, and OpenAI search term strategies.
- `amazon/search-result-filter/search-result-filter.user.js`
  Amazon search result helpers for ASIN filtering, Detail Page `tm_*` filters, and copying.
- `admin/product-targeting-page/product-targeting-page.user.js`
  Product targeting helpers for bulk selection, ASIN filtering, and bid updates.
- `admin/keyword-targeting-page/keyword-targeting-page.user.js`
  Keyword targeting helpers for bulk selection, long-tail filtering, and bid updates.
- `admin/ad-group-page/ad-group-page.user.js`
  Ad group helpers for bulk selection, quick-open actions, and scroll-safe batch operations.
- `admin/shared/tabulator-page-utils.js`
  Shared helper utilities used by the Tabulator-based page scripts.

## Chinese Docs

- `amazon/detail-page-to-product-targeting/detail-page-to-product-targeting_zh.md`
  中文說明：Amazon Detail Page Product Targeting 候選面板
- `admin/product-targeting-page/product-targeting-page_zh.md`
  中文說明：Product Targeting 頁面腳本
- `admin/keyword-targeting-page/keyword-targeting-page_zh.md`
  中文說明：Keyword Targeting 頁面腳本
- `admin/ad-group-page/ad-group-page_zh.md`
  中文說明：Ad Group 頁面腳本

## Install Links

- Amazon Detail: `https://raw.githubusercontent.com/willychia/tampermonkey/main/amazon/detail-page-to-product-targeting/detail-page-to-product-targeting.user.js`
- Amazon Search: `https://raw.githubusercontent.com/willychia/tampermonkey/main/amazon/search-result-filter/search-result-filter.user.js`
- Product Targeting: `https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/product-targeting-page/product-targeting-page.user.js`
- Keyword Targeting: `https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/keyword-targeting-page/keyword-targeting-page.user.js`
- Ad Group: `https://raw.githubusercontent.com/willychia/tampermonkey/main/admin/ad-group-page/ad-group-page.user.js`

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
